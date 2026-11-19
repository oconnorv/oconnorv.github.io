// Wires the game to the page: canvas sizing, the main loop, the sound toggle,
// the "file recovered" dialog and the "this is annoying" button.
import { PAGES } from './config.js';
import { load, save } from './storage.js';
import { Game } from './game/game.js';
import { Renderer } from './game/render.js';
import { Sound } from './game/audio.js';
import { attachInput } from './game/input.js';
import { STEP } from './game/constants.js';
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

const sound = new Sound();
sound.setEnabled(saved.sound !== false); // sound is on unless the visitor turned it off before

const renderer = new Renderer(canvas, PAGES);
const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
renderer.reducedMotion = motionQuery.matches;
motionQuery.addEventListener?.('change', (e) => { renderer.reducedMotion = e.matches; });

let dialogPage = null;
let pausedAt = 0;

const game = new Game({
  pages: PAGES,
  hi: saved.hi || 0,
  maxLevel: saved.maxLevel || 1,
  onEvent(type, d) {
    if (type === 'sfx') sound.play(d.name, d);
    else if (type === 'file') openDialog(d.id);
    else if (type === 'hiscore') save({ hi: d.hi });
    else if (type === 'progress') save({ maxLevel: d.maxLevel });
    else if (type === 'pause') {
      pausedAt = performance.now();
      if (d.reason === 'user') sound.play('pause');
    }
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
  renderer.resize(w, h, Math.min(window.devicePixelRatio || 1, 2.5));
}
new ResizeObserver(layout).observe(stage);
window.addEventListener('resize', layout);
compactQuery.addEventListener?.('change', layout);
layout();

// Redraw cached text once the display font has loaded.
if (document.fonts) {
  document.fonts.load(FONT_FACE)
    .then(() => renderer.cache.clear())
    .catch(() => {});
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
  renderer.draw(game);
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
soundBtn.addEventListener('click', () => {
  toggleSound();
  soundBtn.blur();
});
syncSound();

function syncPauseButton() {
  const paused = game.paused;
  pauseBtn.textContent = paused ? 'RESUME' : 'PAUSE';
  pauseBtn.setAttribute('aria-pressed', String(paused));
  pauseBtn.disabled = !game.canPause();
}
pauseBtn.addEventListener('click', () => {
  if (dialogOpen()) return;
  game.togglePause();
  pauseBtn.blur();
});
syncPauseButton();

annoying.addEventListener('click', () => {
  game.pause('user');
  annoying.textContent = 'yeah, but it’s fun';
  annoying.setAttribute('aria-expanded', 'true');
  links.classList.add('shown');
  annoying.blur();
});
for (const a of links.querySelectorAll('a[data-page]')) {
  a.addEventListener('click', () => {
    game.markOpened(a.dataset.page);
    a.blur();
  });
}

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
