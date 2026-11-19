import { W } from './constants.js';

// Keyboard, mouse and touch.
// Space (also W, the up arrow, or a click/tap) launches the ball and fires lasers, and continues
// the game when it's paused or showing the "file recovered" dialog. P pauses and unpauses.
// Space never scrolls the page or presses a focused button.
export function attachInput({ game, canvas, sound, onPause, onContinue, onEscape, onToggleSound, isDialogOpen, debugKeys }) {
  const LEFT = new Set(['ArrowLeft', 'KeyA']);
  const RIGHT = new Set(['ArrowRight', 'KeyD']);
  const FIRE = new Set(['Space', 'ArrowUp', 'KeyW']);

  window.addEventListener('keydown', (e) => {
    sound.unlock();
    if (e.code === 'Space') e.preventDefault();
    if (e.code === 'Escape') return onEscape();
    if (e.code === 'KeyP' && !e.metaKey && !e.ctrlKey && !e.altKey) {
      if (!e.repeat) onPause();
      return;
    }
    // Paused or in the dialog: Space continues the game. A held-down Space (key repeat) is ignored,
    // so a player firing lasers when a file drops can't skip the dialog by accident.
    if (e.code === 'Space' && (game.paused || isDialogOpen())) {
      if (!e.repeat) onContinue();
      return;
    }
    // Otherwise, while the dialog is open only Enter/Tab (handled by the browser) and Esc do anything.
    if (isDialogOpen()) return;
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
