// Colour palettes for the game. Every colour the game draws comes from the active palette, so the
// whole look can be changed in one place. The page around the game has matching palettes in
// css/site.css (selected by <html data-theme="...">).
//
// `colors` are named colours used by levels.js (brick colours), powerups.js (chip colours) and
// game.js (effect colours). Everything else is a role used by render.js.
//
// "soft" and "softer" are the original neon with saturated colours toned down (about 20% and 35%
// less saturation, slightly darker); backgrounds, walls, greys and text are unchanged.

export const THEMES = {
  // Toned-down neon on midnight navy (the default).
  soft: {
    name: 'Soft neon',
    label: '#a4afd0',
    bg: '#05071a',
    tile: '#080b24',
    hudBg: '#000000',
    hudLine: '#2b3350',
    wall: { base: '#5a6280', hi: '#a3abc6', lo: '#2a3048' },
    ink: '#04060f',
    text: '#f4f7ff',
    accent: '#33c4e8',
    gold: '#eac241',
    danger: '#eb4a5c',
    shadow: '#173d7c',
    goldShadow: '#5a380a',
    dangerShadow: '#4d1118',
    soft: '#b5c0de',
    softer: '#c9d6ee',
    lifeText: '#f07584',
    dangerSoft: '#f28e9a',
    fileOff: '#3a4466',
    fileOffText: '#7783a8',
    overlay: '3,4,12',
    panelBg: 'rgba(3,5,16,0.92)',
    darkness: 'rgba(2,3,10,0.9)',
    rain: '51,196,232',
    crack: 'rgba(4,6,15,0.7)',
    docLines: 'rgba(4,6,15,0.45)',
    steel: { base: '#aab2c0', hi: '#eef1f6', lo: '#5d6677' },
    bad: '#691925',
    badHatch: 'rgba(235,71,89,0.45)',
    badText: '#f9c9cf',
    badBlink: 'rgba(235,79,97,0.45)',
    paddle: { base: '#c3c9d4', hi: '#f4f6fa', lo: '#626b7c' },
    paddleRot: { base: '#8fb07f', hi: '#c5e0b6', lo: '#4d6642' },
    paddleCap: '#33c4e8',
    laser: '#e88330',
    laserCore: '#f8e5c1',
    ball: { face: '#f4f7ff', shade: '#8fa3c8', trail: '51,196,232' },
    ballCrawl: { face: '#ea913e', shade: '#9e5127', trail: '234,145,62' },
    net: { on: '#6a94ee', off: '#3e67c3', top: '#b6c9f7', label: '#92aff3' },
    filePill: { base: '#eac241', hi: '#f5e8a1', lo: '#8a6a0f' },
    hp: { 1: '#33c4e8', 2: '#3e76ea', 3: '#9266ee', 4: '#e88330', 5: '#eb4a5c' },
    rainbow: ['red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'violet', 'pink'],
    barcode: ['#f4f8ff', '#e3ecff', '#d2e1ff', '#c1d6ff', '#b0cbff', '#9fc0ff'],
    colors: {
      red: '#eb4a5c', orange: '#e89e30', yellow: '#eac241', green: '#85ea41', cyan: '#33c4e8', blue: '#3e76ea',
      violet: '#9266ee', pink: '#eb4fc9', white: '#ffffff', ice: '#92dcf3', lilac: '#ae81f1', navy: '#2e52b8',
      floppy: '#3368e8', sticker: '#eef3ff', paper: '#e3cf95', paperDark: '#c49d4b', film: '#ca8f34', tape: '#b17242',
      wood: '#a76637', woodLight: '#c68247', brass: '#dab859', steel: '#c8d2de', mystery: '#eac241', badSector: '#761b27',
      net: '#3e76ea', netText: '#92b3f3', goldText: '#efd473', danger: '#eb4a5c', dangerText: '#ee6674', text: '#ffffff',
    },
  },

  // A step further down.
  softer: {
    name: 'Softer neon',
    label: '#a4afd0',
    bg: '#05071a',
    tile: '#080b24',
    hudBg: '#000000',
    hudLine: '#2b3350',
    wall: { base: '#5a6280', hi: '#a3abc6', lo: '#2a3048' },
    ink: '#04060f',
    text: '#f4f7ff',
    accent: '#3ab6d5',
    gold: '#d8b646',
    danger: '#da4f5e',
    shadow: '#1f3c6d',
    goldShadow: '#4f3411',
    dangerShadow: '#44161b',
    soft: '#b5c0de',
    softer: '#c9d6ee',
    lifeText: '#e27481',
    dangerSoft: '#e68a95',
    fileOff: '#3a4466',
    fileOffText: '#7783a8',
    overlay: '3,4,12',
    panelBg: 'rgba(3,5,16,0.92)',
    darkness: 'rgba(2,3,10,0.9)',
    rain: '58,182,213',
    crack: 'rgba(4,6,15,0.7)',
    docLines: 'rgba(4,6,15,0.45)',
    steel: { base: '#aab2c0', hi: '#eef1f6', lo: '#5d6677' },
    bad: '#5d1f28',
    badHatch: 'rgba(217,76,91,0.45)',
    badText: '#f1bec5',
    badBlink: 'rgba(219,83,98,0.45)',
    paddle: { base: '#c3c9d4', hi: '#f4f6fa', lo: '#626b7c' },
    paddleRot: { base: '#8fb07f', hi: '#bcd7ae', lo: '#4d6642' },
    paddleCap: '#3ab6d5',
    laser: '#d57e38',
    laserCore: '#f0dcb6',
    ball: { face: '#f4f7ff', shade: '#8fa3c8', trail: '58,182,213' },
    ballCrawl: { face: '#d78b44', shade: '#8d5130', trail: '215,139,68' },
    net: { on: '#6a90df', off: '#4767af', top: '#adc0ee', label: '#8ea9e7' },
    filePill: { base: '#d8b646', hi: '#eade9a', lo: '#79601a' },
    hp: { 1: '#3ab6d5', 2: '#4374d7', 3: '#8e67df', 4: '#d57e38', 5: '#da4f5e' },
    rainbow: ['red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'violet', 'pink'],
    barcode: ['#f4f8ff', '#e3ecff', '#d2e1ff', '#c1d6ff', '#b0cbff', '#9fc0ff'],
    colors: {
      red: '#da4f5e', orange: '#d59638', yellow: '#d8b646', green: '#81d846', cyan: '#3ab6d5', blue: '#4374d7',
      violet: '#8e67df', pink: '#da52bc', white: '#ffffff', ice: '#8ed2e7', lilac: '#a77fe4', navy: '#3955a4',
      floppy: '#3a67d5', sticker: '#eef3ff', paper: '#d7c691', paperDark: '#b5944e', film: '#b4863f', tape: '#a06e49',
      wood: '#95633f', woodLight: '#b77d4a', brass: '#cbad5b', steel: '#c8d2de', mystery: '#d8b646', badSector: '#69222b',
      net: '#4374d7', netText: '#8eace7', goldText: '#e1c972', danger: '#da4f5e', dangerText: '#df6773', text: '#ffffff',
    },
  },

  // The original full-strength neon.
  bright: {
    name: 'Bright neon',
    label: '#a4afd0',
    bg: '#05071a',
    tile: '#080b24',
    hudBg: '#000000',
    hudLine: '#2b3350',
    wall: { base: '#5a6280', hi: '#a3abc6', lo: '#2a3048' },
    ink: '#04060f',
    text: '#f4f7ff',
    accent: '#2fd5ff',
    gold: '#ffd23f',
    danger: '#ff4a5e',
    shadow: '#0b3d91',
    goldShadow: '#6a3d00',
    dangerShadow: '#5a0a14',
    soft: '#b5c0de',
    softer: '#c9d6ee',
    lifeText: '#ff7d8c',
    dangerSoft: '#ff9aa6',
    fileOff: '#3a4466',
    fileOffText: '#7783a8',
    overlay: '3,4,12',
    panelBg: 'rgba(3,5,16,0.92)',
    darkness: 'rgba(2,3,10,0.9)',
    rain: '47,213,255',
    crack: 'rgba(4,6,15,0.7)',
    docLines: 'rgba(4,6,15,0.45)',
    steel: { base: '#aab2c0', hi: '#eef1f6', lo: '#5d6677' },
    bad: '#7a1020',
    badHatch: 'rgba(255,70,90,0.45)',
    badText: '#ffe0e4',
    badBlink: 'rgba(255,80,100,0.45)',
    paddle: { base: '#c3c9d4', hi: '#f4f6fa', lo: '#626b7c' },
    paddleRot: { base: '#8fb07f', hi: '#d2ecc4', lo: '#4d6642' },
    paddleCap: '#2fd5ff',
    laser: '#ff8a2b',
    laserCore: '#fff1d6',
    ball: { face: '#f4f7ff', shade: '#8fa3c8', trail: '47,213,255' },
    ballCrawl: { face: '#ff9a3c', shade: '#b8521a', trail: '255,154,60' },
    net: { on: '#6f9dff', off: '#3b6bd6', top: '#c9d9ff', label: '#9fbcff' },
    filePill: { base: '#ffd23f', hi: '#fff3b0', lo: '#a37800' },
    hp: { 1: '#2fd5ff', 2: '#3b7bff', 3: '#9b6bff', 4: '#ff8a2b', 5: '#ff4a5e' },
    rainbow: ['red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'violet', 'pink'],
    barcode: ['#f4f8ff', '#e3ecff', '#d2e1ff', '#c1d6ff', '#b0cbff', '#9fc0ff'],
    colors: {
      red: '#ff4a5e', orange: '#ffaa2b', yellow: '#ffd23f', green: '#8cff3f', cyan: '#2fd5ff', blue: '#3b7bff',
      violet: '#9b6bff', pink: '#ff4fd8', white: '#ffffff', ice: '#9fe8ff', lilac: '#b98bff', navy: '#1f4fd6',
      floppy: '#2f6bff', sticker: '#eef3ff', paper: '#f0dca0', paperDark: '#d6a94a', film: '#e09a2e', tape: '#c9773a',
      wood: '#c06a2c', woodLight: '#d98a45', brass: '#ecc65a', steel: '#c8d2de', mystery: '#ffd23f', badSector: '#8a1020',
      net: '#3b7bff', netText: '#9fc0ff', goldText: '#ffe27a', danger: '#ff4a5e', dangerText: '#ff6b7a', text: '#ffffff',
    },
  },
};

export const DEFAULT_THEME = 'soft';

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
