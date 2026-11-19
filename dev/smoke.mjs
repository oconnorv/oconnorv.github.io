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

  // ------------------------------------------------------------ the home page never scrolls
  const sizes = [
    { name: 'laptop 1366x768', viewport: { width: 1366, height: 768 } },
    { name: 'desktop 1920x1080', viewport: { width: 1920, height: 1080 } },
    { name: 'small laptop 1280x720', viewport: { width: 1280, height: 720 } },
    { name: 'phone portrait', ...devices['iPhone 13'] },
    { name: 'phone landscape', ...devices['iPhone 13 landscape'] },
  ];
  for (const size of sizes) {
    const { name, ...opts } = size;
    const ctx = await browser.newContext(opts);
    const page = await ctx.newPage();
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
    const fits = () => page.evaluate(() => {
      const d = document.documentElement;
      const f = document.getElementById('frame').getBoundingClientRect();
      const l = document.getElementById('links').getBoundingClientRect();
      return {
        noScroll: d.scrollHeight <= innerHeight + 1 && d.scrollWidth <= innerWidth + 1,
        frameVisible: f.top >= 0 && f.left >= 0 && f.bottom <= innerHeight + 1 && f.right <= innerWidth + 1 && f.width > 200,
        linksVisible: l.bottom <= innerHeight + 1 && l.right <= innerWidth + 1 && l.left >= 0,
        frame: `${Math.round(f.width)}x${Math.round(f.height)}`,
      };
    });
    const before = await fits();
    await page.click('#annoying');
    await page.waitForTimeout(400);
    const after = await fits();
    ok(before.noScroll && before.frameVisible && after.noScroll && after.linksVisible,
      `${name}: no scrolling, game (${before.frame}) and revealed links fit on screen`);
    if (shotsDir) await page.screenshot({ path: path.join(shotsDir, `home-${name.replace(/\W+/g, '-')}.png`) });
    await ctx.close();
  }

  // ------------------------------------------------------------ controls, pause, sound, the annoying button
  {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await ctx.newPage();
    await page.goto(base + '?debug=1', { waitUntil: 'networkidle' });
    const g = (expr) => page.evaluate(`(() => { const game = window.__bitstream.game; return ${expr}; })()`);

    await page.keyboard.press('KeyW');
    ok((await g('game.mode')) === 'play', 'W starts the game');
    let x0 = await g('game.paddle.x');
    await page.keyboard.down('ArrowRight'); await page.waitForTimeout(250); await page.keyboard.up('ArrowRight');
    let x1 = await g('game.paddle.x');
    await page.keyboard.down('KeyA'); await page.waitForTimeout(250); await page.keyboard.up('KeyA');
    let x2 = await g('game.paddle.x');
    await page.keyboard.down('KeyD'); await page.waitForTimeout(150); await page.keyboard.up('KeyD');
    let x3 = await g('game.paddle.x');
    await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(150); await page.keyboard.up('ArrowLeft');
    let x4 = await g('game.paddle.x');
    ok(x1 > x0 + 50 && x2 < x1 - 50 && x3 > x2 + 30 && x4 < x3 - 30, 'arrow keys and A/D move the paddle');

    await page.keyboard.press('KeyW');
    ok((await g('game.balls.some(b => !b.stuck)')), 'W launches the ball');
    await page.keyboard.press('Space');
    ok((await g('game.paused')) === true, 'Space pauses');
    const t0 = await g('game.levelTime');
    await page.waitForTimeout(300);
    ok((await g('game.levelTime')) === t0, 'nothing moves while paused');
    await page.keyboard.press('Space');
    ok((await g('game.paused')) === false, 'Space resumes');
    ok((await page.evaluate(() => scrollY)) === 0, 'Space and arrows never scroll the page');

    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    ok((await g('game.paused')) === true, 'leaving the window pauses the game');
    await page.keyboard.press('Space');

    // sound toggle is remembered
    ok((await page.textContent('#sound')).includes('ON'), 'sound is on by default');
    await page.click('#sound');
    ok((await page.textContent('#sound')).includes('OFF'), 'sound button turns sound off');
    await page.keyboard.press('Space'); // a focused button must not be "clicked" by Space
    ok((await page.textContent('#sound')).includes('OFF'), 'Space does not press the sound button');
    await page.keyboard.press('Space');
    await page.reload({ waitUntil: 'networkidle' });
    ok((await page.textContent('#sound')).includes('OFF'), 'sound setting is remembered after reload');
    await page.click('#sound');

    // the annoying button
    await page.keyboard.press('KeyW');
    await page.keyboard.press('KeyW');
    await page.click('#annoying');
    const ann = await page.evaluate(() => ({
      text: document.getElementById('annoying').textContent,
      vis: getComputedStyle(document.getElementById('links')).visibility,
      n: document.querySelectorAll('#links a').length,
    }));
    ok(ann.text === 'yeah, but it’s cool' && ann.vis === 'visible' && ann.n === 4, '"this is annoying" becomes "yeah, but it\'s cool" and shows the 4 links');
    ok((await g('game.paused')) === true, 'pressing it pauses the game');
    await page.keyboard.press('Space');
    ok((await g('game.paused')) === false && (await page.textContent('#annoying')) === 'yeah, but it’s cool', 'Space then resumes without re-pressing the button');

    // the file dialog
    await page.evaluate(() => window.__bitstream.game.debugSpawnFile('cv'));
    await page.waitForSelector('#file-dialog:not([hidden])', { timeout: 3000 });
    ok((await g('game.paused')) && (await page.textContent('#dlg-file')) === 'CV.PDF', 'catching a file pauses the game and shows the dialog');
    if (shotsDir) await page.screenshot({ path: path.join(shotsDir, 'dialog.png') });
    const [tab] = await Promise.all([ctx.waitForEvent('page'), page.keyboard.press('Enter')]);
    await tab.waitForLoadState();
    ok(tab.url().endsWith('/cv.html'), 'Enter opens the page in a new tab');
    ok((await page.isHidden('#file-dialog')) && (await g('game.paused')), 'after opening, the dialog closes and the game stays paused');
    if (shotsDir) await tab.screenshot({ path: path.join(shotsDir, 'cv-page.png'), fullPage: true });
    await tab.close();
    await page.bringToFront();
    if (shotsDir) await page.screenshot({ path: path.join(shotsDir, 'paused.png') });
    await page.keyboard.press('Space');
    ok((await g('game.paused')) === false, 'Space resumes after coming back');
    const before = await g('game.score');
    await page.evaluate(() => window.__bitstream.game.debugSpawnFile('cv'));
    await page.waitForTimeout(700);
    ok((await page.isHidden('#file-dialog')) && !(await g('game.paused')) && (await g('game.score')) >= before + 500, 'catching an already-opened file gives points, no dialog');

    await page.evaluate(() => window.__bitstream.game.debugSpawnFile('about'));
    await page.waitForSelector('#file-dialog:not([hidden])', { timeout: 3000 });
    await page.keyboard.press('Space');
    ok((await page.isHidden('#file-dialog')) && !(await g('game.paused')), 'Space in the dialog means "keep playing"');
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
