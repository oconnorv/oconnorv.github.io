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
      const resp = await page.goto(base + p, { waitUntil: 'networkidle' });
      await page.waitForTimeout(300);
      ok(resp.ok() && errors.length === 0, `/${p || 'index.html'} loads with no console errors${errors.length ? `: ${errors.join('; ')}` : ''}`);
      await page.close();
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
    const homePairs = [['.wordmark', 'body'], ['#annoying', '#annoying'], ['#links a', 'body'], ['.dlg-desc', '.dlg-panel'], ['.dlg-file', '.dlg-panel'], ['.dlg-titlebar', '.dlg-titlebar'], ['#sound', '#sound']];
    const cvPairs = [['.panel', '.panel'], ['.page h2', '.panel'], ['.entry .when', '.panel'], ['.entry .what span', '.panel'], ['.page-head .file-name', 'body'], ['.page-foot', 'body'], ['.edit-note', '.panel']];
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
    await page.goto(base + 'cv.html', { waitUntil: 'networkidle' });
    low.push(...(await check(cvPairs)));
    ok(low.length === 0, `page text is at least 4.5:1 against its background${low.length ? ` (low: ${low.join(', ')})` : ''}`);
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
      const overlaps = (a) => a.left < f.right && a.right > f.left && a.top < f.bottom && a.bottom > f.top;
      return {
        place: b.left >= f.right - 1 && b.bottom <= f.bottom + 1 ? 'beside' : b.top >= f.bottom - 1 ? 'below' : 'other',
        clear: !overlaps(b) && !overlaps(l),
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
    ok(ann.text === 'yeah, but it’s cool' && ann.vis === 'visible' && ann.n === 4, '"this is annoying" becomes "yeah, but it\'s cool" and shows the 4 links');
    ok((await g('game.paused')) === true, 'pressing it pauses the game');
    await page.keyboard.press('KeyP');
    ok((await g('game.paused')) === false && (await page.textContent('#annoying')) === 'yeah, but it’s cool', 'P then resumes without re-pressing the button');

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
