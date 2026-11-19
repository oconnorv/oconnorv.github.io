// Colour palettes for the game. Every colour the game draws comes from the active palette, so the
// whole look can be switched in one place. The page around the game has matching palettes in
// css/site.css (selected by <html data-theme="...">).
//
// `colors` are named colours used by levels.js (brick colours), powerups.js (chip colours) and
// game.js (effect colours). Everything else is a role used by render.js.

export const THEMES = {
  // The original flat look: neon colours on midnight navy.
  neon: {
    label: 'Neon',
    bg: '#05071a', tile: '#080b24', hudBg: '#000000', hudLine: '#2b3350',
    wall: { base: '#5a6280', hi: '#a3abc6', lo: '#2a3048' },
    ink: '#04060f', text: '#f4f7ff', label: '#a4afd0', accent: '#2fd5ff', gold: '#ffd23f', danger: '#ff4a5e',
    shadow: '#0b3d91', goldShadow: '#6a3d00', dangerShadow: '#5a0a14',
    soft: '#b5c0de', softer: '#c9d6ee', lifeText: '#ff7d8c', dangerSoft: '#ff9aa6',
    fileOff: '#3a4466', fileOffText: '#7783a8',
    overlay: '3,4,12', panelBg: 'rgba(3,5,16,0.92)', darkness: 'rgba(2,3,10,0.9)', rain: '47,213,255',
    crack: 'rgba(4,6,15,0.7)', docLines: 'rgba(4,6,15,0.45)',
    steel: { base: '#aab2c0', hi: '#eef1f6', lo: '#5d6677' },
    bad: '#7a1020', badHatch: 'rgba(255,70,90,0.45)', badText: '#ffe0e4', badBlink: 'rgba(255,80,100,0.45)',
    paddle: { base: '#c3c9d4', hi: '#f4f6fa', lo: '#626b7c' },
    paddleRot: { base: '#8fb07f', hi: '#d2ecc4', lo: '#4d6642' },
    paddleCap: '#2fd5ff', laser: '#ff8a2b', laserCore: '#fff1d6',
    ball: { face: '#f4f7ff', shade: '#8fa3c8', trail: '47,213,255' },
    ballCrawl: { face: '#ff9a3c', shade: '#b8521a', trail: '255,154,60' },
    net: { on: '#6f9dff', off: '#3b6bd6', top: '#c9d9ff', label: '#9fbcff' },
    filePill: { base: '#ffd23f', hi: '#fff3b0', lo: '#a37800' },
    hp: { 1: '#2fd5ff', 2: '#3b7bff', 3: '#9b6bff', 4: '#ff8a2b', 5: '#ff4a5e' },
    rainbow: ['red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'violet', 'pink'],
    barcode: ['#f4f8ff', '#e3ecff', '#d2e1ff', '#c1d6ff', '#b0cbff', '#9fc0ff'],
    colors: {
      red: '#ff4a5e', orange: '#ffaa2b', yellow: '#ffd23f', green: '#8cff3f', cyan: '#2fd5ff', blue: '#3b7bff',
      violet: '#9b6bff', pink: '#ff4fd8', white: '#ffffff', ice: '#9fe8ff', lilac: '#b98bff',
      navy: '#1f4fd6', floppy: '#2f6bff', sticker: '#eef3ff', paper: '#f0dca0', paperDark: '#d6a94a',
      film: '#e09a2e', tape: '#c9773a', wood: '#c06a2c', woodLight: '#d98a45', brass: '#ecc65a',
      steel: '#c8d2de', mystery: '#ffd23f', badSector: '#8a1020',
      net: '#3b7bff', netText: '#9fc0ff', goldText: '#ffe27a', danger: '#ff4a5e', dangerText: '#ff6b7a', text: '#ffffff',
    },
  },

  // Classic early-PC (EGA) 16-colour palette: black, DOS blue, bright primaries.
  dos: {
    label: 'DOS 16-colour',
    bg: '#000000', tile: '#000000', hudBg: '#0000aa', hudLine: '#55ffff',
    wall: { base: '#aaaaaa', hi: '#ffffff', lo: '#555555' },
    ink: '#000000', text: '#ffffff', label: '#55ffff', accent: '#55ffff', gold: '#ffff55', danger: '#ff5555',
    shadow: '#0000aa', goldShadow: '#aa5500', dangerShadow: '#aa0000',
    soft: '#aaaaaa', softer: '#ffffff', lifeText: '#ff5555', dangerSoft: '#ff55ff',
    fileOff: '#5555ff', fileOffText: '#aaaaaa',
    overlay: '0,0,0', panelBg: 'rgba(0,0,170,0.96)', darkness: 'rgba(0,0,0,0.92)', rain: '85,255,255',
    crack: 'rgba(0,0,0,0.75)', docLines: 'rgba(0,0,0,0.5)',
    steel: { base: '#aaaaaa', hi: '#ffffff', lo: '#555555' },
    bad: '#aa0000', badHatch: 'rgba(255,85,85,0.55)', badText: '#ffff55', badBlink: 'rgba(255,85,85,0.5)',
    paddle: { base: '#aaaaaa', hi: '#ffffff', lo: '#555555' },
    paddleRot: { base: '#00aa00', hi: '#55ff55', lo: '#005500' },
    paddleCap: '#55ffff', laser: '#ffff55', laserCore: '#ffffff',
    ball: { face: '#ffffff', shade: '#aaaaaa', trail: '85,255,255' },
    ballCrawl: { face: '#ffff55', shade: '#aa5500', trail: '255,255,85' },
    net: { on: '#55ffff', off: '#00aaaa', top: '#ffffff', label: '#55ffff' },
    filePill: { base: '#ffff55', hi: '#ffffff', lo: '#aa5500' },
    hp: { 1: '#55ffff', 2: '#5555ff', 3: '#aa00aa', 4: '#aa5500', 5: '#aa0000' },
    rainbow: ['red', 'yellow', 'green', 'cyan', 'blue', 'pink', 'white', 'violet'],
    barcode: ['#ffffff', '#ffffff', '#aaaaaa', '#aaaaaa', '#ffffff', '#ffffff'],
    colors: {
      red: '#ff5555', orange: '#aa5500', yellow: '#ffff55', green: '#55ff55', cyan: '#55ffff', blue: '#5555ff',
      violet: '#aa00aa', pink: '#ff55ff', white: '#ffffff', ice: '#00aaaa', lilac: '#aa00aa',
      navy: '#0000aa', floppy: '#5555ff', sticker: '#ffffff', paper: '#aaaaaa', paperDark: '#aa5500',
      film: '#aa5500', tape: '#aa5500', wood: '#aa5500', woodLight: '#ff5555', brass: '#ffff55',
      steel: '#aaaaaa', mystery: '#ffff55', badSector: '#aa0000',
      net: '#55ffff', netText: '#55ffff', goldText: '#ffff55', danger: '#ff5555', dangerText: '#ff5555', text: '#ffffff',
    },
  },

  // Mid-90s desktop: grey bevelled chrome, navy title bar, web-safe colours on black.
  desktop: {
    label: '90s desktop',
    bg: '#000000', tile: '#000000', hudBg: '#000080', hudLine: '#c0c0c0',
    wall: { base: '#c0c0c0', hi: '#ffffff', lo: '#808080' },
    ink: '#000000', text: '#ffffff', label: '#c0c0c0', accent: '#00ffff', gold: '#ffff00', danger: '#ff0000',
    shadow: '#000080', goldShadow: '#808000', dangerShadow: '#800000',
    soft: '#c0c0c0', softer: '#ffffff', lifeText: '#ff6666', dangerSoft: '#ff6666',
    fileOff: '#808080', fileOffText: '#c0c0c0',
    overlay: '0,0,0', panelBg: 'rgba(0,0,128,0.96)', darkness: 'rgba(0,0,0,0.92)', rain: '0,255,255',
    crack: 'rgba(0,0,0,0.75)', docLines: 'rgba(0,0,0,0.5)',
    steel: { base: '#c0c0c0', hi: '#ffffff', lo: '#808080' },
    bad: '#800000', badHatch: 'rgba(255,0,0,0.5)', badText: '#ffff00', badBlink: 'rgba(255,0,0,0.45)',
    paddle: { base: '#c0c0c0', hi: '#ffffff', lo: '#808080' },
    paddleRot: { base: '#808000', hi: '#cccc66', lo: '#404000' },
    paddleCap: '#00ffff', laser: '#ff9900', laserCore: '#ffffcc',
    ball: { face: '#ffffff', shade: '#c0c0c0', trail: '0,255,255' },
    ballCrawl: { face: '#ff9900', shade: '#993300', trail: '255,153,0' },
    net: { on: '#00ffff', off: '#008080', top: '#ffffff', label: '#00ffff' },
    filePill: { base: '#ffff00', hi: '#ffffcc', lo: '#999900' },
    hp: { 1: '#00ffff', 2: '#3366ff', 3: '#9933ff', 4: '#ff6600', 5: '#cc0000' },
    rainbow: ['red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'violet', 'pink'],
    barcode: ['#ffffff', '#eeeeee', '#dddddd', '#cccccc', '#c0c0c0', '#b2b2b2'],
    colors: {
      red: '#ff0000', orange: '#ff9900', yellow: '#ffff00', green: '#00ff00', cyan: '#00ffff', blue: '#3366ff',
      violet: '#9933ff', pink: '#ff00ff', white: '#ffffff', ice: '#99ccff', lilac: '#cc99ff',
      navy: '#0033cc', floppy: '#3366ff', sticker: '#ffffff', paper: '#ffffcc', paperDark: '#cccc99',
      film: '#cc9900', tape: '#996633', wood: '#996633', woodLight: '#cc6633', brass: '#ffcc00',
      steel: '#c0c0c0', mystery: '#ffff00', badSector: '#800000',
      net: '#00ffff', netText: '#00ffff', goldText: '#ffff00', danger: '#ff0000', dangerText: '#ff6666', text: '#ffffff',
    },
  },
};

export const DEFAULT_THEME = 'neon';

// The active palette. Other modules import `T` and read it when they draw, so setTheme() takes
// effect everywhere (ES module exports are live bindings).
export let T = THEMES[DEFAULT_THEME];
export let themeName = DEFAULT_THEME;

export function setTheme(name) {
  if (!THEMES[name]) return false;
  T = THEMES[name];
  themeName = name;
  return true;
}

// A colour name from the active palette (`'cyan'`, `'paper'`), or a literal colour passed through.
export function color(name) {
  return (name && T.colors[name]) || name;
}
