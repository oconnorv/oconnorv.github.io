// The display font, VT323, for everything the game draws as text: title, scoreboard, level cards,
// messages, power-up labels, the bit trail. The page sets the same font in css/site.css (--display).
// VT323 has one weight, and its capitals are small for its size, so the game asks for the size the
// layout wants and font() scales it up.
const FAMILY = 'VT323, "Courier New", monospace';
const SCALE = 1.3;

// What main.js waits for before redrawing cached text.
export const FONT_FACE = '10px VT323';

// A canvas font string.
const made = new Map();
export function font(size) {
  let f = made.get(size);
  if (!f) made.set(size, (f = `${Math.round(size * SCALE * 10) / 10}px ${FAMILY}`));
  return f;
}
