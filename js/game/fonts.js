// The "display" font: everything the game draws as text (title, scoreboard, level cards, messages,
// power-up labels, the bit trail). The page uses the matching setting in css/site.css
// (<html data-font="...">). `scale` keeps text at about the same visual size whichever font is
// used; `regular` and `bold` are the weights each font has.
export const FONTS = {
  pixel: {
    family: 'Silkscreen, "Courier New", monospace', scale: 1, regular: 400, bold: 700, heavy: 700,
    load: ['8px Silkscreen', '700 8px Silkscreen'],
  },
  // Scales were measured against Silkscreen's capital height, then set ~10% larger since these fonts
  // are narrower and have room.
  pixelify: {
    family: '"Pixelify Sans", Silkscreen, monospace', scale: 1.08, regular: 500, bold: 700, heavy: 700,
    load: ['500 10px "Pixelify Sans"', '700 10px "Pixelify Sans"'],
  },
  vt323: {
    family: 'VT323, "Courier New", monospace', scale: 1.3, regular: 400, bold: 400, heavy: 400,
    load: ['10px VT323'],
  },
  dotgothic: {
    family: 'DotGothic16, Silkscreen, monospace', scale: 0.85, regular: 400, bold: 400, heavy: 400,
    load: ['10px DotGothic16'],
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
