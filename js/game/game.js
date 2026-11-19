// BITSTREAM game rules and simulation. Nothing in here touches the web page,
// so the same code runs in the browser and in the headless test bot (dev/sim.mjs).
import * as C from './constants.js';
import { clamp, mulberry32 } from './util.js';
import { circleRect, reflect, normalizeDir } from './physics.js';
import { LEVELS, buildLevel } from './levels.js';
import { POWERUPS, pickPowerup } from './powerups.js';

const { W, H, FIELD, PADDLE_Y, PADDLE_H, BALL_R } = C;

export class Game {
  constructor({ pages, seed, onEvent, hi = 0, maxLevel = 1, headless = false } = {}) {
    this.pages = pages;
    this.rnd = mulberry32(seed ?? ((Math.random() * 2 ** 32) >>> 0));
    this.emit = onEvent || (() => {});
    this.headless = headless;
    this.hi = hi;
    this.maxLevel = clamp(maxLevel, 1, LEVELS.length);
    this.input = { left: false, right: false, fire: false, pointerX: null };
    this.found = new Set();   // files caught at least once this visit
    this.opened = new Set();  // files opened this visit
    this.mode = 'title';      // title | play | clear | over | win
    this.paused = false;
    this.pauseReason = null;
    this.t = 0;               // wall-clock time, keeps running while paused (for blinking text)
    this.score = 0;
    this.lives = C.START_LIVES;
    this.levelIndex = 0;
    this.level = LEVELS[0];
    this.layout = null;
    this.bricks = [];
    this.cells = [];
    this.balls = [];
    this.pills = [];
    this.lasers = [];
    this.explosions = [];
    this.paddle = { x: W / 2, vx: 0, w: C.PADDLE_W };
    this.effects = freshEffects();
    this.fx = { particles: [], texts: [], flares: [], shake: 0, flash: 0 };
    this.banner = null;
    this.laserCd = 0;
    this.stats = { bricks: 0, lost: 0 };
  }

  // ---------------------------------------------------------------- flow

  start(levelIndex = 0) {
    this.score = 0;
    this.lives = C.START_LIVES;
    this.stats = { bricks: 0, lost: 0 };
    this.paused = false;
    this.pauseReason = null;
    this.loadLevel(levelIndex);
    this.emit('mode', { mode: this.mode });
  }

  // Start again from the highest level reached (score resets).
  continueGame() {
    if (this.mode === 'title' || this.mode === 'over' || this.mode === 'win') this.start(this.maxLevel - 1);
  }

  loadLevel(i) {
    this.levelIndex = i;
    this.level = LEVELS[i];
    const built = buildLevel(this.level);
    this.layout = built;
    this.bricks = built.bricks;
    this.cells = built.cells;
    const breakable = this.bricks.filter((b) => !b.steel);
    this.remaining = breakable.length;
    this.minRow = Math.min(...breakable.map((b) => b.r));
    this.maxRow = Math.max(...breakable.map((b) => b.r));
    this.hideFiles();
    this.pills = [];
    this.lasers = [];
    this.explosions = [];
    this.effects = freshEffects();
    this.paddle.x = W / 2;
    this.paddle.vx = 0;
    this.paddle.w = C.PADDLE_W;
    this.levelTime = 0;
    this.sinceBrick = 0;
    this.lastNudge = 0;
    this.nudgeNext = false;
    this.mode = 'play';
    this.serve();
    this.banner = { kind: 'level', title: `LEVEL ${String(i + 1).padStart(2, '0')}`, sub: this.level.card, t: 0, life: 2 };
    if (i + 1 > this.maxLevel) {
      this.maxLevel = i + 1;
      this.emit('progress', { maxLevel: this.maxLevel });
    }
    this.emit('level', { index: i });
  }

  // Hide the page files in bricks, mostly near the top.
  hideFiles() {
    const ids = this.levelIndex < 3
      ? this.pages.map((p) => p.id)
      : this.pages.filter((p) => !this.opened.has(p.id)).map((p) => p.id);
    const pool = this.bricks.filter((b) => !b.steel && !b.mystery && !b.bad);
    const span = Math.max(1, this.maxRow - this.minRow);
    for (const id of ids) {
      if (!pool.length) break;
      const weights = pool.map((b) => (1 - (b.r - this.minRow) / span) ** 2 + 0.03);
      let total = weights.reduce((s, w) => s + w, 0);
      let x = this.rnd() * total;
      let k = 0;
      while (k < pool.length - 1 && (x -= weights[k]) >= 0) k++;
      pool[k].file = id;
      pool.splice(k, 1);
    }
  }

  serve() {
    const b = this.newBall(this.paddle.x, PADDLE_Y - BALL_R);
    b.stuck = true;
    b.serve = true;
    b.offset = 0;
    this.balls = [b];
  }

  newBall(x, y) {
    return { x, y, dx: 0, dy: -1, stuck: false, serve: false, offset: 0, stuckT: 0, dead: false, trail: [] };
  }

  // W / up arrow / click / tap.
  action() {
    if (this.paused) return;
    if (this.mode === 'title' || this.mode === 'win') return this.start(0);
    if (this.mode === 'over') return this.start(this.levelIndex);
    if (this.mode !== 'play') return;
    let launched = false;
    for (const b of this.balls) if (b.stuck) { this.launch(b); launched = true; }
    if (launched) {
      if (this.banner && this.banner.kind === 'level') this.banner = null;
      return;
    }
    if (this.effects.scan > 0) this.fireLasers();
  }

  launch(b) {
    b.stuck = false;
    const half = this.paddle.w / 2;
    const t = b.serve ? this.rnd() * 0.6 - 0.3 : clamp(b.offset / half, -1, 1);
    const ang = t * C.MAX_BOUNCE;
    b.dx = Math.sin(ang);
    b.dy = -Math.cos(ang);
    normalizeDir(b, C.MIN_DY);
    b.serve = false;
    this.emit('sfx', { name: 'launch' });
  }

  canPause() {
    return this.mode === 'play' || this.mode === 'clear';
  }

  pause(reason = 'user') {
    if (this.paused || !this.canPause()) return false;
    this.paused = true;
    this.pauseReason = reason;
    this.input.left = this.input.right = this.input.fire = false;
    this.emit('pause', { reason });
    return true;
  }

  resume() {
    if (!this.paused) return false;
    this.paused = false;
    this.pauseReason = null;
    this.emit('resume', {});
    return true;
  }

  togglePause() {
    return this.paused ? this.resume() : this.pause('user');
  }

  markOpened(id) {
    this.opened.add(id);
  }

  // ---------------------------------------------------------------- update

  step(dt = C.STEP) {
    this.t += dt;
    if (this.paused) return;
    this.updateFx(dt);
    if (this.mode === 'play') this.updatePlay(dt);
    else if (this.mode === 'clear') {
      this.movePaddle(dt);
      this.clearT -= dt;
      if (this.clearT <= 0) this.afterClear();
    }
  }

  updatePlay(dt) {
    this.tickEffects(dt);
    this.movePaddle(dt);
    let anyFree = false;
    for (const b of this.balls) {
      if (b.stuck) this.updateStuck(b, dt);
      else {
        anyFree = true;
        this.moveBall(b, dt);
      }
    }
    this.processExplosions();
    if (this.mode !== 'play') return;
    if (this.balls.some((b) => b.dead)) this.balls = this.balls.filter((b) => !b.dead);
    if (this.balls.length === 0) return this.loseLife();
    if (anyFree) {
      this.levelTime += dt;
      this.sinceBrick += dt;
    }
    this.updateLasers(dt);
    this.processExplosions();
    if (this.remaining <= 0) return this.levelClear(false);
    this.updatePills(dt);
    if (this.mode !== 'play' || this.paused) return;
    if (this.sinceBrick > 10 && this.sinceBrick - this.lastNudge > 5) this.nudgeNext = true;
    if (this.sinceBrick > 20) this.sendHelp();
  }

  tickEffects(dt) {
    const e = this.effects;
    if (e.widthT > 0 && (e.widthT -= dt) <= 0) e.width = null;
    if (e.speedT > 0 && (e.speedT -= dt) <= 0) e.speed = null;
    for (const k of ['ingest', 'scan', 'crawl', 'linkrot']) if (e[k] > 0) e[k] = Math.max(0, e[k] - dt);
    this.laserCd = Math.max(0, this.laserCd - dt);
    if (e.scan > 0 && this.input.fire && !this.balls.some((b) => b.stuck)) this.fireLasers();
  }

  targetPaddleW() {
    const w = this.effects.width;
    return C.PADDLE_W * (w === 'tiff' ? 1.5 : w === 'rot' ? 0.6 : 1);
  }

  movePaddle(dt) {
    const p = this.paddle;
    const target = this.targetPaddleW();
    if (p.w !== target) {
      const d = 260 * dt;
      p.w = Math.abs(target - p.w) <= d ? target : p.w + Math.sign(target - p.w) * d;
    }
    const inp = this.input;
    const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    if (dir !== 0) {
      if (p.vx * dir < 0) p.vx = 0;
      p.vx = clamp(p.vx + dir * C.PADDLE_ACCEL * dt, -C.PADDLE_SPEED, C.PADDLE_SPEED);
      p.x += p.vx * dt;
    } else if (inp.pointerX != null) {
      const max = C.POINTER_SPEED * dt;
      const mv = clamp(inp.pointerX - p.x, -max, max);
      p.x += mv;
      p.vx = mv / dt;
    } else p.vx = 0;
    const half = p.w / 2;
    p.x = clamp(p.x, FIELD.x + half, FIELD.x + FIELD.w - half);
  }

  updateStuck(b, dt) {
    const half = this.paddle.w / 2;
    b.offset = clamp(b.offset, -half + BALL_R, half - BALL_R);
    b.x = this.paddle.x + b.offset;
    b.y = PADDLE_Y - BALL_R;
    if (!(this.banner && this.banner.kind === 'level')) b.stuckT += dt;
    if (b.stuckT >= (b.serve ? C.SERVE_AUTO : C.CATCH_AUTO)) this.launch(b);
  }

  ballSpeed() {
    const [s0, s1] = this.level.speed;
    let s = s0 + (s1 - s0) * Math.min(1, this.levelTime / C.RAMP_TIME);
    if (this.effects.speed === 'cold') s *= 0.65;
    else if (this.effects.speed === 'deluge') s *= 1.35;
    return s;
  }

  moveBall(b, dt) {
    const dist = this.ballSpeed() * dt;
    const n = Math.max(1, Math.ceil(dist / (BALL_R * 0.5)));
    const sd = dist / n;
    for (let i = 0; i < n; i++) {
      b.x += b.dx * sd;
      b.y += b.dy * sd;
      this.collideWalls(b);
      if (this.collidePaddle(b) && b.stuck) break;
      this.collideBricks(b);
      if (b.y - BALL_R > H + 8) {
        b.dead = true;
        break;
      }
    }
    if (!this.headless) {
      b.trail.push(b.x, b.y);
      if (b.trail.length > 40) b.trail.splice(0, 2);
    }
  }

  collideWalls(b) {
    const left = FIELD.x + BALL_R;
    const right = FIELD.x + FIELD.w - BALL_R;
    const top = FIELD.y + BALL_R;
    let hit = false;
    if (b.x < left) { b.x = left; b.dx = Math.abs(b.dx); hit = true; }
    else if (b.x > right) { b.x = right; b.dx = -Math.abs(b.dx); hit = true; }
    if (b.y < top) { b.y = top; b.dy = Math.abs(b.dy); hit = true; }
    if (this.effects.backup && b.dy > 0 && b.y + BALL_R > C.NET_Y) {
      b.y = C.NET_Y - BALL_R;
      b.dy = -Math.abs(b.dy);
      this.effects.backup = false;
      this.emit('sfx', { name: 'net' });
      this.flare(b.x, C.NET_Y, '#3b7bff');
      this.text(b.x, C.NET_Y - 20, 'RESTORED FROM BACKUP', '#9fc0ff');
      hit = true;
    }
    if (hit) {
      if (this.nudgeNext && b.y < PADDLE_Y - 220) this.nudge(b);
      normalizeDir(b, C.MIN_DY);
      this.emit('sfx', { name: 'wall' });
    }
  }

  collidePaddle(b) {
    if (b.dy <= 0) return false;
    const p = this.paddle;
    const half = p.w / 2;
    if (b.y + BALL_R < PADDLE_Y || b.y > PADDLE_Y + PADDLE_H * 0.5) return false;
    if (b.x + BALL_R < p.x - half || b.x - BALL_R > p.x + half) return false;
    const t = clamp((b.x - p.x) / half, -1, 1);
    const ang = t * C.MAX_BOUNCE;
    b.dx = Math.sin(ang);
    b.dy = -Math.cos(ang);
    b.y = PADDLE_Y - BALL_R;
    this.emit('sfx', { name: 'paddle' });
    if (this.effects.ingest > 0) {
      b.stuck = true;
      b.serve = false;
      b.offset = b.x - p.x;
      b.stuckT = 0;
    }
    return true;
  }

  cellAt(r, c) {
    if (r < 0 || c < 0 || r >= this.layout.rows || c >= this.layout.cols) return null;
    return this.cells[r][c];
  }

  // A corner contact beside a neighbouring brick is really a flat-face contact.
  // Treat it that way so the ball doesn't snag on the seams between bricks.
  fixCorner(br, h, b) {
    const sx = Math.sign(h.nx), sy = Math.sign(h.ny);
    const nbX = this.cellAt(br.r, br.c + sx);
    const nbY = this.cellAt(br.r + sy, br.c);
    if (nbX && !nbY) {
      h.nx = 0;
      h.ny = sy;
      h.pen = Math.max(0, BALL_R - Math.abs(b.y - (sy > 0 ? br.y + br.h : br.y)));
    } else if (nbY && !nbX) {
      h.ny = 0;
      h.nx = sx;
      h.pen = Math.max(0, BALL_R - Math.abs(b.x - (sx > 0 ? br.x + br.w : br.x)));
    }
  }

  collideBricks(b) {
    const L = this.layout;
    const c0 = Math.floor((b.x - BALL_R - FIELD.x) / L.bw);
    const c1 = Math.floor((b.x + BALL_R - FIELD.x) / L.bw);
    const r0 = Math.floor((b.y - BALL_R - L.top) / L.bh);
    const r1 = Math.floor((b.y + BALL_R - L.top) / L.bh);
    if (r1 < 0 || r0 >= L.rows) return;
    let hits = null;
    for (let r = Math.max(0, r0); r <= Math.min(L.rows - 1, r1); r++) {
      for (let c = Math.max(0, c0); c <= Math.min(L.cols - 1, c1); c++) {
        const br = this.cells[r][c];
        if (!br) continue;
        const h = circleRect(b.x, b.y, BALL_R, br.x, br.y, br.w, br.h);
        if (!h) continue;
        if (h.corner) this.fixCorner(br, h, b);
        (hits || (hits = [])).push({ br, h });
      }
    }
    if (!hits) return;
    hits.sort((a, z) => z.h.pen - a.h.pen);
    let moved = false;
    let bounced = false;
    for (const { br, h: first } of hits) {
      if (!br.alive) continue;
      if (this.effects.crawl > 0 && !br.steel) {
        this.destroyBrick(br);
        continue;
      }
      let h = first;
      if (moved) {
        h = circleRect(b.x, b.y, BALL_R, br.x, br.y, br.w, br.h);
        if (!h) continue;
        if (h.corner) this.fixCorner(br, h, b);
      }
      b.x += h.nx * h.pen;
      b.y += h.ny * h.pen;
      moved = true;
      if (reflect(b, h.nx, h.ny)) {
        bounced = true;
        this.hitBrick(br);
      }
    }
    if (bounced) {
      if (this.nudgeNext) this.nudge(b);
      normalizeDir(b, C.MIN_DY);
    }
  }

  hitBrick(br) {
    if (br.steel) {
      br.flash = 0.18;
      this.emit('sfx', { name: 'steel' });
      return;
    }
    br.hp -= 1;
    br.flash = 0.12;
    if (br.hp <= 0) this.destroyBrick(br);
    else {
      this.score += 10;
      this.emit('sfx', { name: 'tough', hp: br.hp });
    }
  }

  destroyBrick(br) {
    if (!br.alive || br.steel) return;
    br.alive = false;
    this.cells[br.r][br.c] = null;
    this.remaining--;
    this.score += 50 * br.maxHp;
    this.sinceBrick = 0;
    this.lastNudge = 0;
    this.stats.bricks++;
    const cx = br.x + br.w / 2;
    const cy = br.y + br.h / 2;
    this.burst(cx, cy, br.color, br.maxHp > 1 ? 14 : 9);
    this.emit('sfx', { name: 'brick', row: br.r });
    if (br.file) this.spawnFilePill(br.file, cx, cy);
    else if (br.mystery) this.spawnPill(cx, cy, true);
    else if (this.rnd() < this.level.drop * this.heightWeight(br.r)) this.spawnPill(cx, cy, false, br.r);
    if (br.bad) this.explosions.push(br);
  }

  processExplosions() {
    let guard = 0;
    while (this.explosions.length && guard++ < 500) {
      const br = this.explosions.shift();
      this.emit('sfx', { name: 'boom' });
      this.flare(br.x + br.w / 2, br.y + br.h / 2, '#ff4a5e');
      this.fx.shake = Math.max(this.fx.shake, 6);
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const n = this.cellAt(br.r + dr, br.c + dc);
          if (n && !n.steel) this.destroyBrick(n);
        }
      }
    }
  }

  // Top rows drop power-ups about 3x as often as bottom rows.
  heightWeight(r) {
    const span = Math.max(1, this.maxRow - this.minRow);
    return 1.5 - (r - this.minRow) / span;
  }

  spawnPill(x, y, forced, row) {
    if (!forced && this.pills.filter((p) => !p.file).length >= C.MAX_FALLING_PILLS) return;
    const kind = pickPowerup(this.levelIndex + 1, this.level, this.rnd);
    this.pills.push({ x, y, kind, file: null, w: C.PILL_W, h: C.PILL_H, t: 0 });
    if (!forced) this.emit('drop', { row, kind });
  }

  spawnFilePill(id, x, y) {
    this.pills.push({ x, y, kind: 'file', file: id, w: C.FILE_PILL_W, h: C.PILL_H + 2, t: 0 });
    this.flare(x, y, '#ffd23f', 1.4);
    this.text(x, y - 14, 'FILE DETECTED', '#ffe27a', 1.4);
    this.emit('sfx', { name: 'detect' });
  }

  updatePills(dt) {
    const p = this.paddle;
    const left = p.x - p.w / 2;
    const right = p.x + p.w / 2;
    for (let i = 0; i < this.pills.length; i++) {
      const pl = this.pills[i];
      pl.y += C.PILL_SPEED * dt;
      pl.t += dt;
      const caught = pl.y + pl.h / 2 >= PADDLE_Y && pl.y - pl.h / 2 <= PADDLE_Y + PADDLE_H
        && pl.x + pl.w / 2 >= left && pl.x - pl.w / 2 <= right;
      if (caught) {
        this.pills.splice(i, 1);
        i--;
        this.applyPill(pl);
        if (this.paused || this.mode !== 'play') return;
      } else if (pl.y - pl.h / 2 > H) {
        this.pills.splice(i, 1);
        i--;
      }
    }
  }

  applyPill(pl) {
    if (pl.file) return this.catchFile(pl.file, pl.x);
    const def = POWERUPS[pl.kind];
    const e = this.effects;
    this.emit('sfx', { name: def.good ? 'pill' : 'bad' });
    this.banner = { kind: 'pill', title: def.name.toUpperCase(), sub: def.desc.toUpperCase(), color: def.good ? def.color : '#ff6b7a', t: 0, life: 2.2 };
    if (def.good) this.score += 100;
    switch (pl.kind) {
      case 'tiff': e.width = 'tiff'; e.widthT = def.dur; break;
      case 'rot': e.width = 'rot'; e.widthT = def.dur; break;
      case 'cold': e.speed = 'cold'; e.speedT = def.dur; break;
      case 'deluge': e.speed = 'deluge'; e.speedT = def.dur; break;
      case 'ingest': e.ingest = def.dur; break;
      case 'scan': e.scan = def.dur; break;
      case 'crawl': e.crawl = def.dur; break;
      case 'linkrot': e.linkrot = def.dur; break;
      case 'backup': e.backup = true; break;
      case 'restore': this.lives = Math.min(C.MAX_LIVES, this.lives + 1); break;
      case 'lockss': this.splitBalls(); break;
      case 'migrate': this.levelClear(true); break;
    }
  }

  catchFile(id, x) {
    this.found.add(id);
    if (!this.opened.has(id)) {
      this.emit('sfx', { name: 'file' });
      this.pause('file');
      this.emit('file', { id });
    } else {
      this.score += 500;
      this.emit('sfx', { name: 'pill' });
      this.text(x, PADDLE_Y - 24, '+500 ALREADY ARCHIVED', '#ffe27a', 1.4);
    }
  }

  splitBalls() {
    const extra = [];
    for (const b of this.balls) {
      for (const a of [-0.45, 0.45]) {
        if (this.balls.length + extra.length >= C.MAX_BALLS) break;
        const nb = this.newBall(b.x, b.y);
        if (b.stuck) {
          nb.dx = Math.sin(a);
          nb.dy = -Math.cos(a);
        } else {
          const ca = Math.cos(a), sa = Math.sin(a);
          nb.dx = b.dx * ca - b.dy * sa;
          nb.dy = b.dx * sa + b.dy * ca;
        }
        normalizeDir(nb, C.MIN_DY);
        extra.push(nb);
      }
    }
    this.balls.push(...extra);
  }

  fireLasers() {
    if (this.laserCd > 0) return;
    this.laserCd = C.LASER_COOLDOWN;
    const p = this.paddle;
    const off = p.w / 2 - 8;
    this.lasers.push({ x: p.x - off, y: PADDLE_Y - 4 }, { x: p.x + off, y: PADDLE_Y - 4 });
    this.emit('sfx', { name: 'laser' });
  }

  updateLasers(dt) {
    const L = this.layout;
    for (let i = 0; i < this.lasers.length; i++) {
      const z = this.lasers[i];
      z.y -= C.LASER_SPEED * dt;
      let gone = z.y < FIELD.y;
      if (!gone) {
        const br = this.cellAt(Math.floor((z.y - L.top) / L.bh), Math.floor((z.x - FIELD.x) / L.bw));
        if (br) {
          this.hitBrick(br);
          gone = true;
        }
      }
      if (gone) {
        this.lasers.splice(i, 1);
        i--;
      }
    }
  }

  // If nothing has broken for a while, the next wall/brick bounce gets a small random
  // twist, so the ball can't loop forever. It only happens at a bounce, where the player can see it.
  nudge(b) {
    const a = (this.rnd() < 0.5 ? -1 : 1) * (0.12 + this.rnd() * 0.18);
    const ca = Math.cos(a), sa = Math.sin(a);
    const dx = b.dx * ca - b.dy * sa;
    b.dy = b.dx * sa + b.dy * ca;
    b.dx = dx;
    this.nudgeNext = false;
    this.lastNudge = this.sinceBrick;
  }

  // Still stuck on the last few bricks after 20 s: drop a laser pill under one of them.
  sendHelp() {
    const left = this.bricks.filter((b) => b.alive && !b.steel);
    if (!left.length) return;
    const target = left[Math.floor(this.rnd() * left.length)];
    const kind = this.rnd() < 0.6 ? 'scan' : 'crawl';
    this.pills.push({ x: clamp(target.x + target.w / 2, FIELD.x + C.PILL_W / 2, FIELD.x + FIELD.w - C.PILL_W / 2), y: this.layout.top + this.layout.rows * this.layout.bh + 10, kind, file: null, w: C.PILL_W, h: C.PILL_H, t: 0 });
    this.sinceBrick = 6;
    this.lastNudge = 0;
  }

  loseLife() {
    this.lives--;
    this.stats.lost++;
    this.emit('sfx', { name: 'lose' });
    this.fx.shake = 10;
    this.pills = [];
    this.lasers = [];
    this.effects = freshEffects();
    if (this.lives <= 0) return this.gameOver();
    this.levelTime = 0;
    this.sinceBrick = 0;
    this.lastNudge = 0;
    this.serve();
    this.banner = { kind: 'life', title: this.lives === 1 ? 'LAST LIFE' : `${this.lives} LIVES LEFT`, sub: 'W / UP / CLICK TO LAUNCH', t: 0, life: 1.8 };
  }

  gameOver() {
    this.mode = 'over';
    this.balls = [];
    this.banner = null;
    this.updateHi();
    this.emit('sfx', { name: 'gameover' });
    this.emit('mode', { mode: this.mode });
  }

  levelClear(skipped) {
    this.mode = 'clear';
    this.clearT = skipped ? 2 : 2.8;
    const bonus = skipped ? 0 : 1000 * (this.levelIndex + 1);
    this.score += bonus;
    this.pills = [];
    this.lasers = [];
    this.explosions = [];
    for (const b of this.balls) b.stuck = true;
    this.emit('sfx', { name: 'clear' });
    this.banner = {
      kind: 'clear',
      title: skipped ? 'FORMAT MIGRATED' : 'FIXITY CHECK PASSED',
      sub: skipped ? 'SKIPPING TO THE NEXT LEVEL' : `BONUS +${bonus}`,
      t: 0,
      life: this.clearT,
    };
    this.fx.flash = 0.5;
  }

  afterClear() {
    if (this.levelIndex >= LEVELS.length - 1) {
      this.mode = 'win';
      this.balls = [];
      this.banner = null;
      this.updateHi();
      this.emit('sfx', { name: 'win' });
      this.emit('mode', { mode: this.mode });
    } else this.loadLevel(this.levelIndex + 1);
  }

  updateHi() {
    if (this.score > this.hi) {
      this.hi = this.score;
      this.emit('hiscore', { hi: this.hi });
    }
  }

  // ---------------------------------------------------------------- visual effects (state only)

  updateFx(dt) {
    if (this.banner) {
      this.banner.t += dt;
      if (this.banner.t >= this.banner.life) this.banner = null;
    }
    for (const br of this.bricks) if (br.flash > 0) br.flash = Math.max(0, br.flash - dt);
    this.fx.shake = Math.max(0, this.fx.shake - 40 * dt);
    this.fx.flash = Math.max(0, this.fx.flash - dt);
    if (this.headless) return;
    const ps = this.fx.particles;
    for (let i = ps.length - 1; i >= 0; i--) {
      const q = ps[i];
      q.life -= dt;
      if (q.life <= 0) { ps.splice(i, 1); continue; }
      q.vy += 700 * dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
    }
    const ts = this.fx.texts;
    for (let i = ts.length - 1; i >= 0; i--) {
      const q = ts[i];
      q.t += dt;
      q.y -= 26 * dt;
      if (q.t >= q.life) ts.splice(i, 1);
    }
    const fl = this.fx.flares;
    for (let i = fl.length - 1; i >= 0; i--) {
      fl[i].t += dt;
      if (fl[i].t >= fl[i].life) fl.splice(i, 1);
    }
  }

  burst(x, y, color, n) {
    if (this.headless) return;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 60 + Math.random() * 200;
      this.fx.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 80, life: 0.4 + Math.random() * 0.4, max: 0.8, color, size: 2 + Math.random() * 3 });
    }
  }

  text(x, y, str, color = '#ffffff', life = 1) {
    if (this.headless) return;
    this.fx.texts.push({ x, y, str, color, t: 0, life });
  }

  flare(x, y, color, life = 0.6) {
    if (this.headless) return;
    this.fx.flares.push({ x, y, color, t: 0, life });
  }

  // ---------------------------------------------------------------- debug helpers (?debug=1)

  debugSpawnFile(id) {
    if (this.mode !== 'play') return;
    const pageId = id || (this.pages.find((p) => !this.opened.has(p.id)) || this.pages[0]).id;
    this.pills.push({ x: this.paddle.x, y: PADDLE_Y - 70, kind: 'file', file: pageId, w: C.FILE_PILL_W, h: C.PILL_H + 2, t: 0 });
  }

  debugSpawnPill(kind) {
    if (this.mode !== 'play') return;
    const keys = Object.keys(POWERUPS);
    const k = kind || keys[Math.floor(Math.random() * keys.length)];
    this.pills.push({ x: this.paddle.x, y: PADDLE_Y - 70, kind: k, file: null, w: C.PILL_W, h: C.PILL_H, t: 0 });
  }

  debugClearLevel() {
    if (this.mode !== 'play') return;
    for (const br of this.bricks) if (br.alive && !br.steel) {
      br.alive = false;
      this.cells[br.r][br.c] = null;
    }
    this.remaining = 0;
    this.levelClear(false);
  }
}

function freshEffects() {
  return { width: null, widthT: 0, speed: null, speedT: 0, ingest: 0, scan: 0, crawl: 0, linkrot: 0, backup: false };
}

export { LEVELS };
