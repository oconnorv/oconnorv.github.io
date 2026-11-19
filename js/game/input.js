import { W } from './constants.js';

// Keyboard, mouse and touch. Space is reserved for pause and never scrolls the page
// or presses a focused button.
export function attachInput({ game, canvas, sound, onSpace, onEscape, onToggleSound, isDialogOpen, debugKeys }) {
  const LEFT = new Set(['ArrowLeft', 'KeyA']);
  const RIGHT = new Set(['ArrowRight', 'KeyD']);
  const FIRE = new Set(['ArrowUp', 'KeyW']);

  window.addEventListener('keydown', (e) => {
    sound.unlock();
    if (e.code === 'Space') {
      e.preventDefault();
      if (!e.repeat) onSpace();
      return;
    }
    if (e.code === 'Escape') return onEscape();
    if (isDialogOpen()) return; // let Enter/Tab work normally inside the dialog
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (LEFT.has(e.code) || RIGHT.has(e.code) || FIRE.has(e.code) || e.code === 'ArrowDown') e.preventDefault();
    if (LEFT.has(e.code)) { game.input.left = true; game.input.pointerX = null; }
    else if (RIGHT.has(e.code)) { game.input.right = true; game.input.pointerX = null; }
    else if (FIRE.has(e.code)) {
      game.input.fire = true;
      if (!e.repeat) game.action();
    } else if (e.code === 'KeyM' && !e.repeat) onToggleSound();
    else if (e.code === 'KeyC' && !e.repeat) game.continueGame();
    else if (e.code === 'Enter' && !e.repeat && ['title', 'over', 'win'].includes(game.mode) && e.target === document.body) game.action();
    else if (debugKeys) debugKeys(e);
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space') e.preventDefault();
    if (LEFT.has(e.code)) game.input.left = false;
    else if (RIGHT.has(e.code)) game.input.right = false;
    else if (FIRE.has(e.code)) game.input.fire = false;
  });

  const toGameX = (clientX) => {
    const r = canvas.getBoundingClientRect();
    return ((clientX - r.left) / r.width) * W;
  };

  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse' || e.buttons) game.input.pointerX = toGameX(e.clientX);
  });
  canvas.addEventListener('pointerdown', (e) => {
    sound.unlock();
    if (isDialogOpen() || game.paused) return;
    game.input.pointerX = toGameX(e.clientX);
    game.input.fire = true;
    game.action();
    try { canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  });
  const release = () => { game.input.fire = false; };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
}
