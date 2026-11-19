// The "display" font: everything the game draws as text (title, scoreboard, level cards, messages,
// power-up labels, the bit trail). The page uses the matching setting in css/site.css
// (<html data-font="...">). `scale` keeps text at about the same visual size whichever font is
// used; `regular` and `bold` are the weights each font has.
export const FONTS = {
  pixel: {
    family: 'Silkscreen, "Courier New", monospace', scale: 1, regular: 400, bold: 700, heavy: 700,
    load: ['8px Silkscreen', '700 8px Silkscreen'],
  },
  orbitron: {
    family: 'Orbitron, Verdana, sans-serif', scale: 0.9, regular: 500, bold: 700, heavy: 900,
    load: ['500 10px Orbitron', '700 10px Orbitron', '900 10px Orbitron'],
  },
  mono: {
    family: '"Share Tech Mono", "Courier New", monospace', scale: 1.15, regular: 400, bold: 400, heavy: 400,
    load: ['10px "Share Tech Mono"'],
  },
};

export let F = FONTS.pixel;
export let fontName = 'pixel';

export function setFont(name) {
  if (!FONTS[name]) return false;
  F = FONTS[name];
  fontName = name;
  return true;
}

// A canvas font string at roughly the same visual size in every font. `weight` is 'regular',
// 'bold' or 'heavy'.
export function font(size, weight = 'regular') {
  return `${F[weight]} ${Math.round(size * F.scale * 10) / 10}px ${F.family}`;
}
