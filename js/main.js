// Wires the game to the page: canvas sizing, the main loop, the sound toggle,
// the "file recovered" dialog and the "this is annoying" button.
import { PAGES } from './config.js';
import { load, save } from './storage.js';
import { Game } from './game/game.js';
import { Renderer } from './game/render.js';
import { Sound } from './game/audio.js';
import { attachInput } from './game/input.js';
import { W, H, STEP } from './game/constants.js';
import { FONT_FACE } from './game/fonts.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const debug = params.has('debug');
const saved = load();

const canvas = $('game');
const stage = $('stage');
const frame = $('frame');
const dialog = $('file-dialog');
const dlgOpen = $('dlg-open');
const dlgKeep = $('dlg-keep');
const soundBtn = $('sound');
const pauseBtn = $('pause-btn');
const annoying = $('annoying');
const links = $('links');
const hudLinksBox = $('hud-links');
const statusBox = $('status');
const skipLink = $('skip');

// The game is drawn on a canvas, which screen readers can't read, so the main events are also
// written to a hidden status line that they read out.
const announce = (words) => { statusBox.textContent = words; };

// A mouse click or tap on a button hands the keyboard back to the game. A button pressed from the
// keyboard keeps the focus, so keyboard and screen-reader users don't lose their place.
const unfocus = (e) => { if (e.detail > 0) e.currentTarget.blur(); };

const sound = new Sound();
sound.setEnabled(saved.sound !== false); // sound is on unless the visitor turned it off before

const renderer = new Renderer(canvas, PAGES);
const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
renderer.reducedMotion = motionQuery.matches;
motionQuery.addEventListener?.('change', (e) => { renderer.reducedMotion = e.matches; });
const touchQuery = matchMedia('(pointer: coarse)');
renderer.touch = touchQuery.matches;
touchQuery.addEventListener?.('change', (e) => { renderer.touch = e.matches; still = ''; });

let dialogPage = null;
let pausedAt = 0;
let still = ''; // which paused screen is on show ('user', 'blur' or 'file'): nothing moves, so it isn't drawn again

const game = new Game({
  pages: PAGES,
  hi: saved.hi || 0,
  maxLevel: saved.maxLevel || 1,
  onEvent(type, d) {
    if (type === 'sfx') {
      sound.play(d.name, d);
      if (d.name === 'lose' && game.lives > 0) announce(game.lives === 1 ? 'Ball lost. Last life.' : `Ball lost. ${game.lives} lives left.`);
    } else if (type === 'file') openDialog(d.id);
    else if (type === 'hiscore') save({ hi: d.hi });
    else if (type === 'progress') save({ maxLevel: d.maxLevel });
    else if (type === 'pause') {
      pausedAt = performance.now();
      if (d.reason === 'user') sound.play('pause');
      if (d.reason !== 'file') announce('Game paused. Press Space to resume.');
    } else if (type === 'resume') announce('Game resumed.');
    else if (type === 'level') announce(`Level ${d.index + 1} of 12: ${game.level.name}. Press Space to launch the ball.`);
    else if (type === 'mode' && d.mode === 'over') announce(`Game over. Score ${game.score}. Press Space to continue from level ${game.levelIndex + 1}.`);
    else if (type === 'mode' && d.mode === 'win') announce(`Archive preserved. All 12 levels cleared. Final score ${game.score}. Press Space to play again.`);
    if (type === 'pause' || type === 'resume' || type === 'mode' || type === 'level') syncPauseButton();
  },
});

// ------------------------------------------------------------------ sizing: always fits, never scrolls

// The "this is annoying" button sits beside the game (with a matching empty column on the
// left so the game stays centred) or, when that would make the game smaller, underneath it.
// Phones held sideways always use the side column; their header moves to the left instead.
const compactQuery = matchMedia('(orientation: landscape) and (max-height: 500px)');

function layout() {
  const cs = getComputedStyle(stage);
  const availW = stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  const availH = stage.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
  const vars = getComputedStyle(document.documentElement);
  const sideW = parseFloat(vars.getPropertyValue('--side-w')) + parseFloat(vars.getPropertyValue('--side-gap'));
  const panelH = parseFloat(vars.getPropertyValue('--panel-h')) + parseFloat(vars.getPropertyValue('--side-gap'));
  const fit = (w, h) => Math.max(100, Math.floor(Math.min(w, (h * 4) / 3)));
  let side = true;
  let w;
  if (compactQuery.matches) w = fit(availW - sideW, availH);
  else {
    const besideW = fit(availW - 2 * sideW, availH);
    const belowW = fit(availW, availH - panelH);
    side = besideW >= belowW;
    w = Math.max(besideW, belowW);
  }
  document.body.classList.toggle('layout-side', side);
  document.body.classList.toggle('layout-bottom', !side);
  const h = Math.floor((w * 3) / 4);
  frame.style.width = `${w}px`;
  frame.style.height = `${h}px`;
  if (renderer.resize(w, h, Math.min(window.devicePixelRatio || 1, 2.5))) still = '';
}
new ResizeObserver(layout).observe(stage);
window.addEventListener('resize', layout);
compactQuery.addEventListener?.('change', layout);
layout();

// Redraw cached text, and re-place the scoreboard links, once the display font has loaded.
if (document.fonts) {
  document.fonts.load(FONT_FACE)
    .then(() => { renderer.cache.clear(); placeHudLinks(); still = ''; })
    .catch(() => {});
}

// ------------------------------------------------------------------ found files in the scoreboard are links

// The game draws the scoreboard on the canvas. These links sit over its files and appear once a
// file has been found. Being real links, they open in a new tab like every other page link.
const hudLinks = new Map();
for (const page of PAGES) {
  const a = document.createElement('a');
  a.className = 'hud-link';
  a.href = page.url;
  a.target = '_blank';
  a.rel = 'noopener';
  a.dataset.page = page.id;
  a.setAttribute('aria-label', `${page.label} (opens in a new tab)`);
  a.hidden = true;
  a.addEventListener('click', (e) => {
    game.markOpened(page.id);
    game.pause('user'); // a page opened in a background tab can't cost a life
    unfocus(e);
  });
  hudLinksBox.append(a);
  hudLinks.set(page.id, a);
}

// Placed in percentages of the frame, so they follow the game at any size. Each link covers its
// file's name and the strip of score bar above it, and reaches almost to its neighbours: on a
// phone the name alone is too small to tap.
function placeHudLinks() {
  const pct = (v, of) => `${(v / of) * 100}%`;
  for (const { page, x, y, w, h } of renderer.hudFiles()) {
    const s = hudLinks.get(page.id).style;
    s.left = pct(x - 5, W);
    s.top = '0';
    s.width = pct(w + 10, W);
    s.height = pct(y + h + 3, H);
  }
}
placeHudLinks();

// Found files stay found, so a change in the count is the only thing to watch for.
let hudFound = -1;
function syncHudLinks() {
  if (game.found.size === hudFound) return;
  hudFound = game.found.size;
  for (const [id, a] of hudLinks) a.hidden = !game.found.has(id);
}

// ------------------------------------------------------------------ main loop (fixed 120 Hz steps)

let last = performance.now();
let acc = 0;
function tick(now) {
  acc += Math.min(0.1, (now - last) / 1000);
  last = now;
  while (acc >= STEP) {
    game.step(STEP);
    acc -= STEP;
  }
  // A paused game is a still picture: draw it once, then leave the screen alone until something changes.
  const pausedFor = game.paused ? game.pauseReason : '';
  if (!pausedFor || pausedFor !== still) {
    renderer.draw(game);
    still = pausedFor;
  }
  syncHudLinks();
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

// Leaving the tab or window pauses the game.
document.addEventListener('visibilitychange', () => { if (document.hidden) game.pause('blur'); });
window.addEventListener('blur', () => game.pause('blur'));

// ------------------------------------------------------------------ the "file recovered" dialog

function openDialog(id) {
  const page = PAGES.find((p) => p.id === id);
  if (!page) return;
  dialogPage = page;
  $('dlg-file').textContent = page.file;
  $('dlg-desc').textContent = page.desc;
  dlgOpen.href = page.url;
  dialog.hidden = false;
  dlgOpen.focus();
}

function closeDialog() {
  dialog.hidden = true;
  dialogPage = null;
  if (dialog.contains(document.activeElement)) document.activeElement.blur();
}

const dialogOpen = () => !dialog.hidden;

// Opening the page leaves the game paused; the visitor presses Space (or P) when they come back.
dlgOpen.addEventListener('click', () => {
  if (dialogPage) game.markOpened(dialogPage.id);
  closeDialog();
  game.pauseReason = 'user';
});
dlgKeep.addEventListener('click', () => {
  closeDialog();
  game.resume();
});
// Keep Tab inside the dialog while it's open.
dialog.addEventListener('keydown', (e) => {
  if (e.key !== 'Tab') return;
  e.preventDefault();
  (document.activeElement === dlgOpen ? dlgKeep : dlgOpen).focus();
});

// ------------------------------------------------------------------ buttons

function syncSound() {
  soundBtn.textContent = `SOUND: ${sound.enabled ? 'ON' : 'OFF'}`;
  soundBtn.setAttribute('aria-pressed', String(sound.enabled));
}
function toggleSound() {
  sound.unlock();
  sound.setEnabled(!sound.enabled);
  save({ sound: sound.enabled });
  syncSound();
}
soundBtn.addEventListener('click', (e) => {
  toggleSound();
  unfocus(e);
});
syncSound();

function syncPauseButton() {
  const paused = game.paused;
  pauseBtn.textContent = paused ? 'RESUME' : 'PAUSE';
  pauseBtn.disabled = !game.canPause();
}
pauseBtn.addEventListener('click', (e) => {
  if (dialogOpen()) return;
  game.togglePause();
  unfocus(e);
});
syncPauseButton();

// "this is annoying" shows the four links (and pauses, so reading them costs nothing); pressing
// it again hides them.
function showLinks(open) {
  if (open) game.pause('user');
  annoying.textContent = open ? "yeah, but it's fun" : 'this is annoying';
  annoying.setAttribute('aria-expanded', String(open));
  links.classList.toggle('shown', open);
}
annoying.addEventListener('click', (e) => {
  showLinks(!links.classList.contains('shown'));
  unfocus(e);
});
for (const a of links.querySelectorAll('a[data-page]')) {
  a.addEventListener('click', (e) => {
    game.markOpened(a.dataset.page);
    unfocus(e);
  });
}

// The first Tab stop on the page, shown only while it has the focus: keyboard and screen-reader
// users can go straight to the four links without playing.
skipLink.hidden = false;
skipLink.addEventListener('click', (e) => {
  e.preventDefault();
  showLinks(true);
  links.querySelector('a').focus();
});

// ------------------------------------------------------------------ input

attachInput({
  game,
  canvas,
  sound,
  isDialogOpen: dialogOpen,
  onToggleSound: toggleSound,
  onPause() {
    if (dialogOpen()) {
      closeDialog();
      game.resume();
    } else game.togglePause();
  },
  // Space while paused or in the dialog continues the game. Presses in the first half second are
  // ignored, so Space that was being mashed to fire lasers when a file dropped doesn't skip the dialog.
  onContinue() {
    if (performance.now() - pausedAt < 500) return;
    if (dialogOpen()) closeDialog();
    game.resume();
  },
  onEscape() {
    if (dialogOpen()) {
      closeDialog();
      game.pauseReason = 'user';
    }
  },
  debugKeys: debug ? debugKeys : null,
});

// ------------------------------------------------------------------ debug helpers: ?debug=1

function debugKeys(e) {
  const levelKeys = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0', 'Minus', 'Equal'];
  const i = levelKeys.indexOf(e.code);
  if (i >= 0) game.start(i);
  else if (e.code === 'KeyF') game.debugSpawnFile();
  else if (e.code === 'KeyU') game.debugSpawnPill();
  else if (e.code === 'KeyK') game.debugClearLevel();
}

if (debug) {
  window.__bitstream = { game, renderer, sound, PAGES };
  const lvl = Number(params.get('level'));
  if (lvl >= 1 && lvl <= 12) game.start(lvl - 1);
}
