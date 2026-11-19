import { FIELD, BRICK_TOP } from './constants.js';
import { wordToGrid } from './font.js';

// Grid legend:
//   .        empty
//   1-5      brick needing that many hits (1-hit bricks take the level's row colours)
//   S        steel: unbreakable, not needed to clear the level
//   ?        mystery brick: always drops a power-up
//   X        bad sector: blows up its neighbours when destroyed
//   a-z      a brick from the level's palette ({ color, hp })

export const HP_COLORS = { 1: '#2fd5ff', 2: '#3b7bff', 3: '#9b6bff', 4: '#ff8a2b', 5: '#ff4a5e' };
const RAINBOW = ['#ff4a5e', '#ffaa2b', '#ffd23f', '#8cff3f', '#2fd5ff', '#3b7bff', '#9b6bff', '#ff4fd8'];

const CYAN = '#2fd5ff', MAGENTA = '#ff4fd8', LIME = '#8cff3f', ORANGE = '#ffaa2b';

export const LEVELS = [
  {
    name: 'JOHN', card: 'J O H N', top: 150, bh: 28, speed: [260, 380], drop: 0.3, bad: 0.2,
    palette: { a: { color: CYAN }, b: { color: MAGENTA }, c: { color: LIME }, d: { color: ORANGE } },
    grid: wordToGrid('JOHN', (i) => 'abcd'[i]),
  },
  {
    name: "O'CONNOR", card: "O ' C O N N O R", top: 150, bh: 22, speed: [280, 420], drop: 0.26, bad: 0.3,
    palette: {
      a: { color: CYAN }, b: { color: MAGENTA, hp: 2 }, c: { color: LIME }, d: { color: ORANGE, hp: 2 },
      e: { color: CYAN }, f: { color: MAGENTA, hp: 2 }, g: { color: LIME },
    },
    grid: wordToGrid("O'CONNOR", (i) => 'aabcdefg'[i]),
  },
  {
    name: 'V', card: 'V', top: 110, bh: 22, speed: [300, 460], drop: 0.24, bad: 0.4, rowColors: RAINBOW,
    grid: [
      'SS.............SS',
      '2111.........1112',
      '.2111.......1112.',
      '..2111.....1112..',
      '...2111...1112...',
      '....2111?1112....',
      '.....2111112.....',
      '......21112......',
      '.......212.......',
      '........2........',
    ],
  },
  {
    name: 'BARCODE', card: 'B A R C O D E', bh: 26, speed: [320, 480], drop: 0.22, bad: 0.5,
    rowColors: ['#f4f8ff', '#e3ecff', '#d2e1ff', '#c1d6ff', '#b0cbff', '#9fc0ff'],
    grid: Array(6).fill('1.11.1..111.1.11..1.1.11'),
  },
  {
    name: '3.5" FLOPPY', card: '3 . 5 "   F L O P P Y', bh: 26, speed: [330, 500], drop: 0.2, bad: 0.6,
    palette: { d: { color: '#1f4fd6', hp: 2 }, b: { color: '#2f6bff' }, w: { color: '#eef3ff' } },
    grid: [
      '.ddddSSSSddd..',
      '.ddddS..Sdddd.',
      '.ddddSSSSdddd.',
      '.bbbbbbbbbbbb.',
      '.bwwwwwwwwwwb.',
      '.bww?wwww?wwb.',
      '.bwwwwwwwwwwb.',
      '.bbbbbbbbbbbb.',
    ],
  },
  {
    name: 'PUNCH CARD', card: 'P U N C H   C A R D', bh: 22, speed: [340, 520], drop: 0.18, bad: 0.7,
    palette: { c: { color: '#f0dca0' }, d: { color: '#d6a94a', hp: 2 } },
    grid: [
      '..cccccccccccc',
      '.cc.ccdc.cccdc',
      'cccc.cc.cc.ccc',
      'cdc.ccc.cdc.cc',
      'cc.cdcc.c.cccc',
      'ccc.c.cdc.cc.c',
      'c.cccc.ccc.cdc',
      'cccdc.cc.c.ccc',
      'cc.ccc.c.ccc.c',
    ],
  },
  {
    name: 'MICROFILM', card: 'M I C R O F I L M', bh: 24, speed: [345, 525], drop: 0.17, bad: 0.8,
    palette: { k: { color: '#e09a2e' } },
    grid: [
      'S.S.S.S.S.S.S.',
      'kkkkkkkkkkkkkk',
      '2222.2222.2222',
      '2?22.22?2.22?2',
      '2222.2222.2222',
      'kkkkkkkkkkkkkk',
      'S.S.S.S.S.S.S.',
    ],
  },
  {
    name: 'REEL-TO-REEL', card: 'R E E L - T O - R E E L', bh: 30, speed: [370, 560], drop: 0.16, bad: 0.9,
    rowColors: ['#2fd5ff'], palette: { t: { color: '#c9773a' } },
    grid: [
      '...222......222...',
      '..21112....21112..',
      '.211S112..211S112.',
      '.21SSS12..21SSS12.',
      '.211S112..211S112.',
      '..21112....21112..',
      '...222......222...',
      '....t........t....',
      '....tttttttttt....',
    ],
  },
  {
    name: 'CARD CATALOG', card: 'C A R D   C A T A L O G', bh: 24, speed: [370, 570], drop: 0.14, bad: 1.0,
    palette: { r: { color: '#c06a2c', hp: 3 }, q: { color: '#d98a45', hp: 2 }, h: { color: '#ecc65a' } },
    grid: [
      'SSSSS....SSSSS',
      'SrrrrrrrrrrrrS',
      'Shhh?hhhh?hhhS',
      'SqqqqqqqqqqqqS',
      'Shh?hhhhhhh?hS',
      'SqqqqqqqqqqqqS',
      'S....SSSS....S',
    ],
  },
  {
    name: 'SERVER ROOM', card: 'S E R V E R   R O O M', bh: 24, speed: [400, 610], drop: 0.13, bad: 1.2,
    grid: [
      'S4444S4444S4444S',
      'S....S....S....S',
      'S3333S3?33S3333S',
      'S....S....S....S',
      'S3?33S3333S33?3S',
      'S....S....S....S',
      'S2222S2222S2222S',
    ],
  },
  {
    name: 'BAD SECTORS', card: 'B A D   S E C T O R S', bh: 22, speed: [410, 640], drop: 0.12, bad: 1.4,
    grid: [
      '34.2X43S24.X43',
      '2X43.24X3.42S4',
      '.42S34.24X32.3',
      '43X2.3S42.4X24',
      '2.43X24.3S42X.',
      'X342.4X23.4S32',
      '24.3S2X43.2X4.',
      '3X.24.32X4S.23',
      '2.3X42.24.3X2S',
    ],
  },
  {
    name: 'THE DARK ARCHIVE', card: 'T H E   D A R K   A R C H I V E', bh: 24, speed: [430, 680], drop: 0.1, bad: 1.6, dark: true,
    grid: [
      '33333333333333',
      '3SSSSS..SSSSS3',
      '3S4343434343S3',
      '3S33X3333X33S3',
      '3S3434343434S3',
      '3SSSS.SS.SSSS3',
      '23232323232323',
    ],
  },
];

// Build the brick objects for a level definition.
export function buildLevel(def) {
  const top = def.top ?? BRICK_TOP;
  const rows = def.grid.length;
  const cols = def.grid[0].length;
  const bw = FIELD.w / cols;
  const bh = def.bh || 24;
  const cells = [];
  const bricks = [];
  for (let r = 0; r < rows; r++) {
    if (def.grid[r].length !== cols) throw new Error(`${def.name}: row ${r} has ${def.grid[r].length} columns, expected ${cols}`);
    cells.push([]);
    for (let c = 0; c < cols; c++) {
      const ch = def.grid[r][c];
      let brick = null;
      if (ch !== '.' && ch !== ' ') {
        brick = {
          r, c, x: FIELD.x + c * bw, y: top + r * bh, w: bw, h: bh,
          hp: 1, maxHp: 1, steel: false, mystery: false, bad: false, color: null, fixedColor: false,
          file: null, alive: true, flash: 0, seed: (r * 31 + c * 17) % 97,
        };
        if (ch === 'S') { brick.steel = true; brick.hp = brick.maxHp = Infinity; brick.color = '#c8d2de'; }
        else if (ch === '?') { brick.mystery = true; brick.color = '#ffd23f'; }
        else if (ch === 'X') { brick.bad = true; brick.color = '#8a1020'; }
        else if (ch >= '1' && ch <= '5') {
          brick.hp = brick.maxHp = Number(ch);
          if (brick.hp === 1) {
            const rc = def.rowColors;
            brick.color = rc ? rc[r % rc.length] : HP_COLORS[1];
          } else brick.color = HP_COLORS[brick.hp];
        } else if (def.palette && def.palette[ch]) {
          const p = def.palette[ch];
          brick.hp = brick.maxHp = p.hp || 1;
          brick.color = p.color;
          brick.fixedColor = true;
        } else throw new Error(`${def.name}: unknown grid character "${ch}"`);
        bricks.push(brick);
      }
      cells[r].push(brick);
    }
  }
  return { bricks, cells, rows, cols, bw, bh, top };
}
