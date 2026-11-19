// 5-row brick font used to spell words out of bricks on the name levels.
const GLYPHS = {
  J: ['.###', '...#', '...#', '#..#', '.##.'],
  O: ['.##.', '#..#', '#..#', '#..#', '.##.'],
  H: ['#..#', '#..#', '####', '#..#', '#..#'],
  N: ['#..#', '##.#', '#.##', '#..#', '#..#'],
  C: ['.###', '#...', '#...', '#...', '.###'],
  R: ['###.', '#..#', '###.', '#.#.', '#..#'],
  "'": ['#', '#', '.', '.', '.'],
};

// Turn a word into level-grid rows. `charFor(i, letter)` picks the grid character for each letter,
// which lets every letter have its own colour or toughness.
export function wordToGrid(word, charFor, { gap = 1, margin = 1 } = {}) {
  const rows = ['', '', '', '', ''];
  [...word].forEach((letter, i) => {
    const g = GLYPHS[letter];
    if (!g) throw new Error(`No brick glyph for "${letter}"`);
    const ch = charFor(i, letter);
    for (let r = 0; r < 5; r++) rows[r] += (i > 0 ? '.'.repeat(gap) : '') + g[r].replace(/#/g, ch);
  });
  const pad = '.'.repeat(margin);
  return rows.map((r) => pad + r + pad);
}
