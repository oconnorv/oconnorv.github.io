// All the game's colours ("soft neon": toned-down neon on midnight navy). Change a colour here and
// it changes everywhere in the game. The page around the game uses the matching colour variables
// at the top of css/site.css.
//
// `colors` are named colours used by levels.js (brick colours), powerups.js (chip colours) and
// game.js (effect colours). Everything else is a role used by render.js.
export const T = {
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
};

// A colour name (`'cyan'`, `'paper'`), or a literal colour passed through.
export function color(name) {
  return (name && T.colors[name]) || name;
}
