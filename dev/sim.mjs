// Headless test bot: plays every level with the real game code and checks it's fair.
//
//   node dev/sim.mjs            # 6 runs per level
//   node dev/sim.mjs 20         # 20 runs per level
//   node dev/sim.mjs 10 12      # 10 runs of level 12 only
//
// The bot's paddle is limited to keyboard speed and it reacts to where the ball was
// ~150 ms ago, so "the bot can clear it" means a quick human can too.
import { Game, LEVELS } from '../js/game/game.js';
import { PAGES } from '../js/config.js';
import { circleRect } from '../js/game/physics.js';
import { POWERUPS } from '../js/game/powerups.js';
import * as C from '../js/game/constants.js';

const RUNS = Number(process.argv[2] || 6);
const ONLY = process.argv[3] ? Number(process.argv[3]) - 1 : null;
const MAX_TIME = 15 * 60; // seconds of game time before a run counts as "too slow"

// Where will this ball cross height y, after bouncing off the side walls?
function predictX(b, y) {
  const t = (y - b.y) / b.dy;
  const x = b.x + b.dx * t;
  const L = C.FIELD.x + C.BALL_R;
  const span = C.FIELD.w - 2 * C.BALL_R;
  let u = (x - L) % (2 * span);
  if (u < 0) u += 2 * span;
  return u <= span ? L + u : L + 2 * span - u;
}

function runLevel(levelIndex, seed, profile) {
  const rnd = mulberry(seed * 7919 + 1);
  let t = 0;
  const res = { cleared: false, time: 0, livesLost: 0, violations: [], stuck: false, filesHidden: 0, drops: [], firstFile: null };
  let noise = 0, trackedDy = 0;
  let aim = 0;
  const game = new Game({
    pages: PAGES, seed, headless: true,
    onEvent(type, d) {
      if (type === 'sfx' && d.name === 'paddle') aim = (rnd() * 2 - 1) * 0.6;
      if (type === 'file') { game.markOpened(d.id); queueMicrotask?.(() => {}); }
      if (type === 'drop') res.drops.push(d.row);
      if (type === 'sfx' && d.name === 'detect' && res.firstFile == null) res.firstFile = t;
    },
  });
  game.start(levelIndex);
  res.filesHidden = game.bricks.filter((b) => b.file).length;
  res.minRow = game.minRow;
  res.maxRow = game.maxRow;
  const hist = [];
  const lag = Math.round(profile.delay / C.STEP);
  let stuckFor = 0;
  while (t < MAX_TIME) {
    // what the bot "sees" is 150 ms old
    hist.push(game.balls.map((b) => ({ x: b.x, y: b.y, dx: b.dx, dy: b.dy, stuck: b.stuck })));
    if (hist.length > lag + 1) hist.shift();
    const view = hist[0];
    let best = null;
    let bestT = Infinity;
    for (const b of view) {
      if (b.stuck || b.dy <= 0) continue;
      const tt = (C.PADDLE_Y - b.y) / b.dy;
      if (tt < bestT) { bestT = tt; best = b; }
    }
    let target;
    if (best) {
      // a person's guess gets better as the ball gets closer
      if (Math.sign(best.dy) !== Math.sign(trackedDy)) noise = gauss(rnd);
      trackedDy = best.dy;
      const path = (C.PADDLE_Y - best.y) / best.dy;
      target = predictX(best, C.PADDLE_Y - C.BALL_R) - aim * game.paddle.w * 0.45 + noise * profile.noise * path;
    }
    else {
      const pill = game.pills.find((p) => p.file || POWERUPS[p.kind]?.good);
      target = pill ? pill.x : view.length ? view[0].x : C.W / 2;
    }
    const dx = target - game.paddle.x;
    game.input.left = dx < -3;
    game.input.right = dx > 3;
    if (game.balls.some((b) => b.stuck) && game.mode === 'play') {
      stuckFor += C.STEP;
      if (stuckFor > 0.4) { game.action(); stuckFor = 0; }
    } else stuckFor = 0;

    const livesBefore = game.lives;
    game.step(C.STEP);
    t += C.STEP;
    if (game.paused) game.resume();
    if (game.lives < livesBefore) res.livesLost++;

    // invariants: ball inside the field and never buried in a brick
    for (const b of game.balls) {
      if (b.stuck || b.dead) continue;
      if (b.x < C.FIELD.x - 0.5 || b.x > C.FIELD.x + C.FIELD.w + 0.5 || b.y < C.FIELD.y - 0.5) res.violations.push(`ball outside field at ${b.x.toFixed(1)},${b.y.toFixed(1)}`);
      for (const br of game.bricks) {
        if (!br.alive) continue;
        const h = circleRect(b.x, b.y, C.BALL_R, br.x, br.y, br.w, br.h);
        if (h && h.pen > 2.5 && game.effects.crawl <= 0) res.violations.push(`ball ${h.pen.toFixed(1)}px inside brick r${br.r}c${br.c}`);
      }
    }
    if (res.violations.length > 5) break;
    if (game.mode === 'clear' || game.levelIndex !== levelIndex || game.mode === 'win') { res.cleared = true; break; }
    if (game.mode === 'over') break;
    if (game.sinceBrick > 45) { res.stuck = true; break; }
  }
  res.time = t;
  return res;
}

function gauss(rnd) {
  return Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());
}

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let failed = false;
const topDrops = [0, 0];
const PROFILES = [
  { name: 'SKILLED bot (150 ms reactions, accurate)', delay: 0.15, noise: 0, strict: true },
  { name: 'CASUAL bot (250 ms reactions, rough aim)', delay: 0.25, noise: 0.06, strict: false },
];
for (const profile of PROFILES) {
console.log(`\n${profile.name}`);
console.log(`level                cleared   avg time   lives lost   files   first file   problems`);
for (let i = 0; i < LEVELS.length; i++) {
  if (ONLY != null && i !== ONLY) continue;
  let cleared = 0, time = 0, lost = 0, problems = [], firstFile = [];
  let files = new Set();
  for (let s = 1; s <= RUNS; s++) {
    const r = runLevel(i, s * 1000 + i, profile);
    if (r.firstFile != null) firstFile.push(r.firstFile);
    if (r.cleared) { cleared++; time += r.time; }
    lost += r.livesLost;
    files.add(r.filesHidden);
    if (r.violations.length) problems.push(`seed ${s}: ${r.violations[0]}`);
    if (r.stuck) problems.push(`seed ${s}: ball stuck (nothing broke for 45 s)`);
    const mid = (r.minRow + r.maxRow) / 2;
    for (const row of r.drops) topDrops[row <= mid ? 0 : 1]++;
  }
  const name = `${String(i + 1).padStart(2)} ${LEVELS[i].name}`.padEnd(20);
  const avg = cleared ? `${(time / cleared / 60).toFixed(1)} min` : '   -   ';
  const ff = firstFile.length ? `${(firstFile.reduce((a, b) => a + b, 0) / firstFile.length).toFixed(0)} s` : '-';
  console.log(`${name} ${String(cleared).padStart(2)}/${RUNS}     ${avg.padStart(8)}   ${(lost / RUNS).toFixed(1).padStart(6)}       ${[...files].join(',').padStart(3)}     ${ff.padStart(6)}     ${problems.slice(0, 2).join(' | ')}`);
  if (problems.length) failed = true;
  if (i < 3 && !(files.size === 1 && files.has(4))) { console.log('   !! levels 1-3 must hide all four files'); failed = true; }
  if (profile.strict && i < 11 && cleared === 0) { console.log('   !! no bot run cleared this level'); failed = true; }
}
}
const totalDrops = topDrops[0] + topDrops[1];
if (totalDrops) console.log(`\nregular power-up drops: ${((100 * topDrops[0]) / totalDrops).toFixed(0)}% from the top half of the bricks, ${((100 * topDrops[1]) / totalDrops).toFixed(0)}% from the bottom half`);
process.exit(failed ? 1 : 0);
