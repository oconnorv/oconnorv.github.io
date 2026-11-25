// Browser checks for the site, using Playwright + Chromium.
//
//   node dev/smoke.mjs                 # run the checks
//   node dev/smoke.mjs --shots DIR     # ...and save screenshots of every level to DIR
//
// It starts its own local web server (python3 -m http.server) on a free port.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import net from 'node:net';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const shotsArg = process.argv.indexOf('--shots');
const shotsDir = shotsArg > 0 ? path.resolve(process.argv[shotsArg + 1]) : null;
if (shotsDir) fs.mkdirSync(shotsDir, { recursive: true });

let failures = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`);
  if (!cond) failures++;
};

const port = await new Promise((res) => {
  const s = net.createServer().listen(0, '127.0.0.1', () => {
    const p = s.address().port;
    s.close(() => res(p));
  });
});
const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
const base = `http://127.0.0.1:${port}/`;
for (let i = 0; i < 50; i++) {
  try { if ((await fetch(base)).ok) break; } catch { /* not up yet */ }
  await new Promise((r) => setTimeout(r, 100));
}

// The file pages draw their text from content/*.md once they've loaded; wait until they have.
const open = async (page, p) => {
  const resp = await page.goto(base + p, { waitUntil: 'networkidle' });
  if (/^(cv|failures|about|contact)\.html$/.test(p)) await page.waitForSelector('main[data-ready]', { timeout: 5000 });
  return resp;
};

// Every page must point at the current version of each script and stylesheet (see dev/stamp.mjs).
const stamp = spawnSync(process.execPath, [path.join(root, 'dev', 'stamp.mjs'), '--check'], { encoding: 'utf8' });
ok(stamp.status === 0, `version tags are up to date${stamp.status ? ` (${stamp.stderr.trim()})` : ''}`);

const browser = await chromium.launch();
try {
  // ------------------------------------------------------------ every page loads without errors
  {
    const ctx = await browser.newContext();
    for (const p of ['', 'cv.html', 'failures.html', 'about.html', 'contact.html', '404.html']) {
      const page = await ctx.newPage();
      const errors = [];
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
      page.on('pageerror', (e) => errors.push(e.message));
      const resp = await open(page, p);
      await page.waitForTimeout(300);
      ok(resp.ok() && errors.length === 0, `/${p || 'index.html'} loads with no console errors${errors.length ? `: ${errors.join('; ')}` : ''}`);
      await page.close();
    }
    await ctx.close();
  }

  // ------------------------------------------------------------ the fonts load (no silent fallback)
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    for (const [p, want] of [['', ['VT323 400', 'DejaVu Sans 400']], ['cv.html', ['VT323 400', 'DejaVu Sans 400', 'DejaVu Sans 700']]]) {
      await open(page, p);
      const got = await page.evaluate(async () => {
        await document.fonts.ready;
        return [...document.fonts].filter((f) => f.status === 'loaded').map((f) => `${f.family.replace(/["']/g, '')} ${f.weight}`);
      });
      const missing = want.filter((w) => !got.includes(w));
      ok(missing.length === 0, `/${p || 'index.html'} loads its fonts${missing.length ? ` (missing: ${missing.join(', ')}; loaded: ${got.join(', ') || 'none'})` : ''}`);
    }
    await ctx.close();
  }

  // ------------------------------------------------------------ colours stay readable (at least 4.5:1)
  {
    const contrast = `(fg, bg) => {
      const lum = (c) => c.match(/[0-9.]+/g).slice(0, 3).map(Number).map((v) => v / 255)
        .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
        .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
      const a = lum(fg), b = lum(bg);
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    }`;
    // [selector, selector whose background it sits on]
    const homePairs = [['.wordmark', 'body'], ['.credit', 'body'], ['#annoying', '#annoying'], ['#links a', 'body'], ['.dlg-desc', '.dlg-panel'], ['.dlg-file', '.dlg-panel'], ['.dlg-titlebar', '.dlg-titlebar'], ['#sound', '#sound']];
    const cvPairs = [['.panel', '.panel'], ['.page h2', '.panel'], ['.entry .when', '.panel'], ['.panel .org', '.panel'], ['.refs a', '.panel'], ['.page-head .file-name', 'body'], ['.page-foot', 'body']];
    const failuresPairs = [['.page .lede', '.panel']];
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await ctx.newPage();
    const check = (pairs) => page.evaluate(([pairs, src]) => {
      const contrast = eval(src);
      const bgOf = (el) => { for (let e = el; e; e = e.parentElement) { const c = getComputedStyle(e).backgroundColor; if (c && c !== 'transparent' && !/^rgba\(.*,\s*0\)$/.test(c)) return c; } return 'rgb(255,255,255)'; };
      return pairs.map(([fg, bg]) => {
        const f = document.querySelector(fg), b = document.querySelector(bg);
        return f && b ? [fg, contrast(getComputedStyle(f).color, bgOf(b))] : [fg, 0];
      }).filter(([, r]) => r < 4.5).map(([sel, r]) => `${sel} ${r.toFixed(2)}:1`);
    }, [pairs, contrast]);
    await page.goto(base, { waitUntil: 'networkidle' });
    const low = await check(homePairs);
    await open(page, 'cv.html');
    low.push(...(await check(cvPairs)));
    await open(page, 'failures.html');
    low.push(...(await check(failuresPairs)));
    ok(low.length === 0, `page text is at least 4.5:1 against its background${low.length ? ` (low: ${low.join(', ')})` : ''}`);

    // These pages are public: no contact details (checked by pattern, so none are written here).
    // Contact is the one page meant to show an email address. And the Robert Wood Johnson
    // Foundation proposal lives on the CV of Failures, not the CV.
    const personal = [
      ['an email address', /[\w.%+-]+@[\w-]+\.[\w.]+/],
      ['a phone number', /\d{3}\D{1,3}\d{3}\D{1,3}\d{4}/],
      ['a street address', /\b\d{2,6}\s+[A-Z][a-z]+\s+(Avenue|Ave|Street|St|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd|Court|Ct)\b/],
      ['a ZIP code', /\b[A-Z]{2}\s+\d{5}\b/],
    ];
    const exposed = [];
    for (const p of ['cv.html', 'failures.html', 'about.html']) {
      await open(page, p);
      const shown = await page.evaluate(() => ({
        text: document.body.innerText,
        contactLinks: document.querySelectorAll('a[href^="mailto:"], a[href^="tel:"]').length,
      }));
      const found = personal.filter(([, re]) => re.test(shown.text)).map(([what]) => what);
      if (shown.contactLinks) found.push('a contact link');
      if (found.length) exposed.push(`${p}: ${found.join(', ')}`);
      if (p === 'cv.html') ok(!/Robert Wood Johnson/i.test(shown.text), 'the CV page leaves out the Robert Wood Johnson Foundation proposal');
    }
    ok(exposed.length === 0, `the CV, CV of Failures and About pages show no contact details${exposed.length ? ` (${exposed.join('; ')})` : ''}`);

    // Every button shows readable text, normally and on hover (a link styled as a button once
    // inherited the panel's link colour and was blank until hovered).
    const badButtons = [];
    for (const p of ['', 'cv.html', 'failures.html', 'about.html', 'contact.html', '404.html']) {
      await open(page, p);
      const buttons = await page.locator('.btn, .annoying').all();
      for (const el of buttons) {
        const measure = () => el.evaluate((e, src) => {
          const contrast = eval(src);
          const cs = getComputedStyle(e);
          return { r: contrast(cs.color, cs.backgroundColor), label: (e.textContent || '').trim() };
        }, contrast);
        const normal = await measure();
        if (!normal.label || normal.r < 4.5) badButtons.push(`${p || 'index.html'} "${normal.label}" ${normal.r.toFixed(2)}:1`);
        if (await el.isVisible()) {
          await el.hover();
          const hover = await measure();
          if (hover.r < 4.5) badButtons.push(`${p || 'index.html'} "${hover.label}" on hover ${hover.r.toFixed(2)}:1`);
          await page.mouse.move(0, 0);
        }
      }
    }
    ok(badButtons.length === 0, `every button has readable text, normally and on hover${badButtons.length ? ` (bad: ${badButtons.join(', ')})` : ''}`);
    await ctx.close();

    const { T } = await import(new URL('../js/game/themes.js', import.meta.url));
    const lumHex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
      .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
    const ratio = (a, b) => { const x = lumHex(a), y = lumHex(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    const gamePairs = [[T.text, T.hudBg], [T.label, T.hudBg], [T.gold, T.hudBg], [T.accent, T.hudBg], [T.fileOffText, T.hudBg],
      [T.text, T.bg], [T.accent, T.bg], [T.gold, T.bg], [T.soft, T.bg], [T.softer, T.bg], [T.lifeText, T.bg], [T.dangerSoft, T.bg]];
    const lowGame = gamePairs.filter(([f, b]) => ratio(f, b) < 4.5).map(([f, b]) => `${f} on ${b} ${ratio(f, b).toFixed(2)}:1`);
    ok(lowGame.length === 0, `in-game text is at least 4.5:1${lowGame.length ? ` (low: ${lowGame.join(', ')})` : ''}`);
  }

  // ------------------------------------------------------------ the file pages fit a phone's width
  {
    const ctx = await browser.newContext(devices['iPhone 13']);
    const page = await ctx.newPage();
    const wide = [];
    for (const p of ['cv.html', 'failures.html', 'about.html', 'contact.html', '404.html']) {
      await open(page, p);
      await page.evaluate(() => document.fonts.ready);
      const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      if (over > 0) wide.push(`${p} by ${over}px`);
    }
    ok(wide.length === 0, `the file pages don't scroll sideways on a phone${wide.length ? ` (${wide.join(', ')})` : ''}`);
    await ctx.close();
  }

  // ------------------------------------------------------------ the file pages show all of their content/*.md
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const problems = [];
    for (const name of ['cv', 'failures', 'about', 'contact']) {
      const lines = fs.readFileSync(path.join(root, 'content', `${name}.md`), 'utf8').split(/\r?\n/).map((l) => l.trim());
      const want = { sections: lines.filter((l) => /^##\s/.test(l)).length, entries: lines.filter((l) => /^###\s/.test(l)).length };
      await open(page, `${name}.html`);
      const got = await page.evaluate(() => {
        const m = document.querySelector('main');
        return { sections: m.querySelectorAll('h2').length, entries: m.querySelectorAll('.entry, .item').length, text: m.innerText };
      });
      if (/didn.t load/.test(got.text)) problems.push(`content/${name}.md didn't load`);
      else if (got.sections !== want.sections || got.entries !== want.entries) {
        problems.push(`${name}: ${got.sections} of ${want.sections} sections, ${got.entries} of ${want.entries} entries`);
      }
      if (/\*\*|\]\(/.test(got.text)) problems.push(`${name}: formatting marks showing`);
      const tags = got.text.match(/<\/?[a-z][a-z0-9]*\b[^>]*>/gi);
      if (tags) problems.push(`${name}: HTML tags showing as text (${[...new Set(tags)].join(' ')})`);
    }
    ok(problems.length === 0, `each file page shows all of its content/*.md text${problems.length ? ` (${problems.join('; ')})` : ''}`);

    await open(page, 'contact.html');
    const mail = await page.evaluate(() => [...document.querySelectorAll('main a[href^="mailto:"]')].map((a) => a.textContent));
    ok(mail.length === 1 && /^[\w.+-]+@[\w-]+(\.[\w-]+)+$/.test(mail[0]), `the Contact page turns "name [at] ... [dot] com" into an email link (${mail.join(', ') || 'none'})`);

    // The reader shows anything that looks like HTML as plain text, and links only to web pages,
    // email addresses or this site.
    const out = await page.evaluate(() => renderPage('# T\n<b onclick="x()">hi</b>\n[bad](javascript:alert(1)) [ok](https://example.org/a_b)'));
    ok(out.includes('&lt;b onclick=&quot;x()&quot;&gt;hi&lt;/b&gt;') && out.includes('<a href="#">bad</a>') && out.includes('<a href="https://example.org/a_b">ok</a>'),
      'the page reader shows HTML as plain text and drops unsafe links');
    const nums = await page.evaluate(() => renderPage('## S\nBecause\n1. one\n2. *two*\nAfter'));
    ok(nums.includes('<p>Because</p>\n<ol>\n<li>one</li>\n<li><em>two</em></li>\n</ol>\n<p>After</p>'), 'the page reader makes numbered lists from "1." lines');
    await ctx.close();
  }

  // ------------------------------------------------------------ the home page never scrolls
  const sizes = [
    { name: 'laptop 1366x768', expect: 'beside', viewport: { width: 1366, height: 768 } },
    { name: 'desktop 1920x1080', expect: 'beside', viewport: { width: 1920, height: 1080 } },
    { name: 'small laptop 1280x720', expect: 'beside', viewport: { width: 1280, height: 720 } },
    { name: 'phone portrait', expect: 'below', ...devices['iPhone 13'] },
    { name: 'phone landscape', expect: 'beside', ...devices['iPhone 13 landscape'] },
  ];
  for (const size of sizes) {
    const { name, expect, ...opts } = size;
    const ctx = await browser.newContext(opts);
    const page = await ctx.newPage();
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
    const fits = () => page.evaluate(() => {
      const d = document.documentElement;
      const f = document.getElementById('frame').getBoundingClientRect();
      const l = document.getElementById('links').getBoundingClientRect();
      const b = document.getElementById('annoying').getBoundingClientRect();
      const c = document.querySelector('.credit').getBoundingClientRect();
      const overlaps = (a) => a.left < f.right && a.right > f.left && a.top < f.bottom && a.bottom > f.top;
      const touches = (a, z) => a.left < z.right && a.right > z.left && a.top < z.bottom && a.bottom > z.top;
      return {
        credit: c.width > 0 && c.left >= 0 && c.bottom <= innerHeight && c.left < innerWidth / 2
          && !overlaps(c) && !touches(c, b) && !touches(c, l),
        place: b.left >= f.right - 1 && b.bottom <= f.bottom + 1 ? 'beside' : b.top >= f.bottom - 1 ? 'below' : 'other',
        clear: !overlaps(b) && !overlaps(l),
        buttonOnScreen: b.left >= 0 && b.top >= 0 && b.right <= innerWidth + 1 && b.bottom <= innerHeight + 1,
        noScroll: d.scrollHeight <= innerHeight + 1 && d.scrollWidth <= innerWidth + 1,
        frameVisible: f.top >= 0 && f.left >= 0 && f.bottom <= innerHeight + 1 && f.right <= innerWidth + 1 && f.width > 200,
        linksVisible: l.bottom <= innerHeight + 1 && l.right <= innerWidth + 1 && l.left >= 0 && l.top >= 0,
        frame: `${Math.round(f.width)}x${Math.round(f.height)}`,
      };
    });
    const before = await fits();
    await page.click('#annoying');
    await page.waitForTimeout(400);
    const after = await fits();
    ok(before.noScroll && before.frameVisible && after.noScroll && after.linksVisible,
      `${name}: no scrolling, game (${before.frame}) and revealed links fit on screen`);
    ok(before.place === expect && after.clear, `${name}: "this is annoying" sits ${expect} the game and never covers it (${before.place})`);
    ok(before.credit && after.credit, `${name}: the credit sits bottom-left without covering the game or the links`);
    ok(before.buttonOnScreen && after.buttonOnScreen, `${name}: "this is annoying" / "yeah, but it's fun" is fully on screen`);
    if (name.startsWith('laptop')) {
      const credit = await page.evaluate(() => {
        const el = document.querySelector('.credit');
        return { lines: [...el.querySelectorAll('span')].map((x) => x.textContent), links: el.querySelectorAll('a').length };
      });
      ok(credit.lines.join(' / ') === 'Imagined by John / Built with Claude' && credit.links === 0, 'credit reads "Imagined by John" over "Built with Claude", with no link');
    }
    if (shotsDir) await page.screenshot({ path: path.join(shotsDir, `home-${name.replace(/\W+/g, '-')}.png`) });
    await ctx.close();
  }

  // ------------------------------------------------------------ controls, pause, sound, the annoying button
  {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await ctx.newPage();
    await page.goto(base + '?debug=1', { waitUntil: 'networkidle' });
    const g = (expr) => page.evaluate(`(() => { const game = window.__bitstream.game; return ${expr}; })()`);

    await page.keyboard.press('Space');
    ok((await g('game.mode')) === 'play', 'Space starts the game');
    const x0 = await g('game.paddle.x');
    await page.keyboard.down('ArrowRight'); await page.waitForTimeout(250); await page.keyboard.up('ArrowRight');
    const x1 = await g('game.paddle.x');
    await page.keyboard.down('KeyA'); await page.waitForTimeout(250); await page.keyboard.up('KeyA');
    const x2 = await g('game.paddle.x');
    await page.keyboard.down('KeyD'); await page.waitForTimeout(150); await page.keyboard.up('KeyD');
    const x3 = await g('game.paddle.x');
    await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(150); await page.keyboard.up('ArrowLeft');
    const x4 = await g('game.paddle.x');
    ok(x1 > x0 + 50 && x2 < x1 - 50 && x3 > x2 + 30 && x4 < x3 - 30, 'arrow keys and A/D move the paddle');

    await page.keyboard.press('Space');
    ok((await g('game.balls.some(b => !b.stuck)')), 'Space launches the ball');
    await page.keyboard.press('KeyP');
    ok((await g('game.paused')) === true, 'P pauses');
    const t0 = await g('game.levelTime');
    await page.keyboard.press('Space');
    ok((await g('game.paused')) === true, 'Space in the first half second of a pause is ignored');
    await page.waitForTimeout(600);
    ok((await g('game.levelTime')) === t0, 'nothing moves while paused');
    await page.keyboard.press('Space');
    ok((await g('game.paused')) === false, 'Space resumes from a pause');
    await page.keyboard.press('KeyP');
    await page.keyboard.press('KeyP');
    ok((await g('game.paused')) === false, 'P toggles pause on and off');
    ok((await page.evaluate(() => scrollY)) === 0, 'Space and arrows never scroll the page');

    // lasers and the sticky paddle use Space too
    await g('(game.effects.scan = 10, game.laserCd = 0, game.lasers = [], 0)');
    await page.keyboard.press('Space');
    ok((await g('game.lasers.length')) >= 2, 'Space fires lasers during SCAN');
    await g('(() => { game.effects.scan = 0; game.effects.ingest = 15; const b = game.balls[0]; b.stuck = true; b.serve = false; b.offset = 10; b.stuckT = 0; })()');
    await page.keyboard.press('Space');
    ok((await g('game.balls[0].stuck')) === false, 'Space launches a ball caught by INGEST');
    await g('(game.effects.ingest = 0, 0)');

    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    ok((await g('game.paused')) === true, 'leaving the window pauses the game');
    await page.keyboard.press('KeyP');

    // sound toggle is remembered
    ok((await page.textContent('#sound')).includes('ON'), 'sound is on by default');
    await page.click('#sound');
    ok((await page.textContent('#sound')).includes('OFF'), 'sound button turns sound off');
    await page.focus('#sound');
    await page.keyboard.press('Space'); // a focused button must not be "clicked" by Space
    ok((await page.textContent('#sound')).includes('OFF'), 'Space does not press a focused button');
    await page.reload({ waitUntil: 'networkidle' });
    ok((await page.textContent('#sound')).includes('OFF'), 'sound setting is remembered after reload');
    await page.click('#sound');

    // the annoying button
    await page.keyboard.press('Space');
    await page.keyboard.press('Space');
    await page.click('#annoying');
    const ann = await page.evaluate(() => ({
      text: document.getElementById('annoying').textContent,
      vis: getComputedStyle(document.getElementById('links')).visibility,
      n: document.querySelectorAll('#links a').length,
    }));
    ok(ann.text === "yeah, but it's fun" && ann.vis === 'visible' && ann.n === 4, '"this is annoying" becomes "yeah, but it\'s fun" and shows the 4 links');
    ok((await g('game.paused')) === true, 'pressing it pauses the game');
    await page.keyboard.press('KeyP');
    ok((await g('game.paused')) === false && (await page.textContent('#annoying')) === "yeah, but it's fun", 'P then resumes without re-pressing the button');
    await page.click('#annoying');
    const closed = await page.evaluate(() => ({
      text: document.getElementById('annoying').textContent,
      vis: getComputedStyle(document.getElementById('links')).visibility,
      expanded: document.getElementById('annoying').getAttribute('aria-expanded'),
    }));
    ok(closed.text === 'this is annoying' && closed.vis === 'hidden' && closed.expanded === 'false', 'pressing it again hides the links and says "this is annoying" again');
    ok((await g('game.paused')) === false, 'hiding the links leaves the game running');
    await page.click('#annoying');
    ok((await page.evaluate(() => getComputedStyle(document.getElementById('links')).visibility)) === 'visible', 'a third press shows the links again');
    await page.keyboard.press('KeyP');

    // the file dialog
    await page.evaluate(() => window.__bitstream.game.debugSpawnFile('cv'));
    await page.waitForSelector('#file-dialog:not([hidden])', { timeout: 3000 });
    ok((await g('game.paused')) && (await page.textContent('#dlg-file')) === 'CV.PDF', 'catching a file pauses the game and shows the dialog');
    await page.keyboard.press('Space');
    await page.keyboard.press('Space');
    ok((await page.isVisible('#file-dialog')) && (await g('game.paused')), 'Space mashed as the file drops does not skip the dialog');
    await page.waitForTimeout(600); // past the half-second guard: a key-repeat (held Space) must still be ignored
    await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', repeat: true })));
    ok((await page.isVisible('#file-dialog')), 'a held-down Space (key repeat) does not skip the dialog');
    if (shotsDir) await page.screenshot({ path: path.join(shotsDir, 'dialog.png') });
    const [tab] = await Promise.all([ctx.waitForEvent('page'), page.keyboard.press('Enter')]);
    await tab.waitForLoadState();
    ok(tab.url().endsWith('/cv.html'), 'Enter opens the page in a new tab');
    ok((await page.isHidden('#file-dialog')) && (await g('game.paused')), 'after opening, the dialog closes and the game stays paused');
    if (shotsDir) await tab.screenshot({ path: path.join(shotsDir, 'cv-page.png'), fullPage: true });
    await tab.close();
    await page.bringToFront();
    if (shotsDir) await page.screenshot({ path: path.join(shotsDir, 'paused.png') });
    await page.waitForTimeout(600);
    await page.keyboard.press('Space');
    ok((await g('game.paused')) === false, 'Space resumes after coming back from the page');
    const before = await g('game.score');
    await page.evaluate(() => window.__bitstream.game.debugSpawnFile('cv'));
    await page.waitForTimeout(700);
    ok((await page.isHidden('#file-dialog')) && !(await g('game.paused')) && (await g('game.score')) >= before + 500, 'catching an already-opened file gives points, no dialog');

    await page.evaluate(() => window.__bitstream.game.debugSpawnFile('about'));
    await page.waitForSelector('#file-dialog:not([hidden])', { timeout: 3000 });
    await page.waitForTimeout(600);
    await page.keyboard.press('Space');
    ok((await page.isHidden('#file-dialog')) && !(await g('game.paused')), 'Space in the dialog means "keep playing"');
    await page.evaluate(() => window.__bitstream.game.debugSpawnFile('contact'));
    await page.waitForSelector('#file-dialog:not([hidden])', { timeout: 3000 });
    await page.keyboard.press('KeyP');
    ok((await page.isHidden('#file-dialog')) && !(await g('game.paused')), 'P in the dialog still works too');

    // found files in the scoreboard are links (cv, about and contact have been caught by now)
    const hud = await page.evaluate(() => {
      const c = document.getElementById('game').getBoundingClientRect();
      return [...document.querySelectorAll('.hud-link')].map((a) => {
        const r = a.getBoundingClientRect();
        return {
          id: a.dataset.page,
          shown: !a.hidden && r.width > 0,
          newTab: a.target === '_blank',
          inBar: r.top >= c.top && r.bottom <= c.top + c.height * (54 / 600) && r.left >= c.left + c.width * 0.6 && r.right <= c.right,
        };
      });
    });
    const shownIds = hud.filter((h) => h.shown).map((h) => h.id).sort().join(', ');
    ok(shownIds === 'about, contact, cv', `found files in the score bar are links and the others aren't (${shownIds || 'none'})`);
    ok(hud.filter((h) => h.shown).every((h) => h.inBar && h.newTab), 'each sits over its file in the score bar and opens in a new tab');
    const [aboutTab] = await Promise.all([ctx.waitForEvent('page'), page.click('.hud-link[data-page="about"]')]);
    await aboutTab.waitForLoadState();
    ok(aboutTab.url().endsWith('/about.html') && (await g('game.opened.has("about")')), 'clicking ABOUT in the score bar opens its page and marks it opened');
    await aboutTab.close();
    await page.bringToFront();
    await g('(game.start(0), 0)'); // a fresh level: the ball waits on the paddle
    const [cvTab] = await Promise.all([ctx.waitForEvent('page'), page.click('.hud-link[data-page="cv"]')]);
    await cvTab.close();
    await page.bringToFront();
    ok((await g('game.paused')) === true && (await g('game.balls[0].stuck')) === true, 'clicking a score-bar link pauses the game and does not launch the ball');
    await ctx.close();
  }

  // ------------------------------------------------------------ screenshots of every level
  if (shotsDir) {
    for (const [label, opts] of [['desktop', { viewport: { width: 1366, height: 768 } }], ['phone', devices['iPhone 13']]]) {
      const ctx = await browser.newContext(opts);
      const page = await ctx.newPage();
      await page.goto(base + '?debug=1', { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);
      if (label === 'desktop') await page.screenshot({ path: path.join(shotsDir, 'title.png') });
      for (let i = 0; i < 12; i++) {
        await page.evaluate((n) => window.__bitstream.game.start(n), i);
        await page.waitForTimeout(150);
        await page.evaluate(() => { window.__bitstream.game.banner = null; });
        await page.waitForTimeout(80);
        await page.screenshot({ path: path.join(shotsDir, `${label}-level-${String(i + 1).padStart(2, '0')}.png`) });
      }
      await ctx.close();
    }
  }
} finally {
  await browser.close();
  server.kill();
}
console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);
