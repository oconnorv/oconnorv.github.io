// Draws the game in a flat, sharp-edged arcade style: solid colours, bevelled edges,
// square corners, hard drop-shadows. Reads game state; never changes it.
import * as C from './constants.js';
import { POWERUPS } from './powerups.js';
import { HP_COLORS } from './levels.js';

const { W, H, FIELD, HUD_H, PADDLE_Y, PADDLE_H, BALL_R } = C;
const FONT = 'Silkscreen, "Courier New", monospace';
const INK = '#04060f';
const CYAN = '#2fd5ff';
const GOLD = '#ffd23f';
const WHITE = '#f4f7ff';
const DIM = '#7d88aa';
const SHADOW = '#0b3d91';
const RED = '#ff4a5e';

// The ball is a 6x6 grid of 2px "pixels" (12px across, matching BALL_R).
const DISC = ['..##..', '.####.', '######', '######', '.####.', '..##..'];
const DISC_SHADE = ['......', '......', '.....#', '....##', '...##.', '......'];

export class Renderer {
  constructor(canvas, pages) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.pages = pages;
    this.scale = 1;
    this.cache = new Map();
    this.bg = null;
    this.dark = null;
    this.reducedMotion = false;
    this.rain = makeRain();
  }

  resize(cssW, cssH, dpr) {
    const w = Math.max(1, Math.round(cssW * dpr));
    const h = Math.max(1, Math.round(cssH * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.scale = w / W;
    this.cache.clear();
    this.bg = this.dark = null;
  }

  // Offscreen canvas at device resolution, drawn in game coordinates.
  layer(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w * this.scale));
    c.height = Math.max(1, Math.ceil(h * this.scale));
    const x = c.getContext('2d');
    x.scale(c.width / w, c.height / h);
    draw(x);
    return c;
  }

  draw(g) {
    const ctx = this.ctx;
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    ctx.imageSmoothingEnabled = false;
    if (!this.bg) this.bg = this.layer(W, H, (x) => drawBackground(x));
    ctx.drawImage(this.bg, 0, 0, W, H);
    if (g.mode === 'title' || g.mode === 'win') this.drawRain(g.t);

    ctx.save();
    if (!this.reducedMotion && g.fx.shake > 0 && !g.paused) {
      ctx.translate(Math.round((Math.random() - 0.5) * g.fx.shake), Math.round((Math.random() - 0.5) * g.fx.shake));
    }
    if (g.mode === 'play' || g.mode === 'clear' || g.mode === 'over') {
      this.drawBricks(g);
      if (g.effects.backup) this.drawNet(g);
      this.drawPills(g);
      this.drawLasers(g);
      this.drawPaddle(g);
      this.drawBalls(g);
      this.drawParticles(g);
      if (g.level.dark && g.mode !== 'over') this.drawDarkness(g);
      this.drawBursts(g);
      this.drawTexts(g);
    }
    ctx.restore();

    this.drawWalls();
    this.drawHud(g);
    if (g.fx.flash > 0 && !this.reducedMotion) {
      ctx.fillStyle = `rgba(255,255,255,${(g.fx.flash * 0.45).toFixed(3)})`;
      ctx.fillRect(FIELD.x, FIELD.y, FIELD.w, FIELD.h);
    }

    if (g.mode === 'title') this.drawTitle(g);
    else if (g.mode === 'over') this.drawGameOver(g);
    else if (g.mode === 'win') this.drawWin(g);
    else if (g.banner) this.drawBanner(g, g.banner);
    if (g.paused) this.drawPaused(g);
  }

  // ------------------------------------------------------------ playfield

  drawBricks(g) {
    const ctx = this.ctx;
    for (const br of g.bricks) {
      if (!br.alive) continue;
      const color = br.steel || br.mystery || br.bad || br.fixedColor || br.maxHp === 1 ? br.color : HP_COLORS[br.hp];
      const key = `b|${br.w.toFixed(2)}|${br.h}|${color}|${br.steel ? 's' : br.mystery ? 'm' : br.bad ? 'x' : 'n'}`;
      let spr = this.cache.get(key);
      if (!spr) {
        spr = this.layer(br.w, br.h, (x) => drawBrickSprite(x, br.w, br.h, color, br));
        this.cache.set(key, spr);
      }
      ctx.drawImage(spr, br.x, br.y, br.w, br.h);
      if (!br.steel && br.hp < br.maxHp) drawCracks(ctx, br);
      if (br.bad && Math.sin(g.t * 6 + br.seed) > 0.6) {
        ctx.fillStyle = 'rgba(255,80,100,0.45)';
        ctx.fillRect(br.x + 3, br.y + 3, br.w - 6, br.h - 6);
      }
      if (br.file) this.drawGlint(br, g.t);
      if (br.flash > 0) {
        ctx.fillStyle = `rgba(255,255,255,${Math.min(0.8, br.flash * 5).toFixed(3)})`;
        ctx.fillRect(br.x + 1, br.y + 1, br.w - 2, br.h - 2);
      }
    }
  }

  // A brick hiding a file gives off a quick shine every few seconds.
  drawGlint(br, t) {
    const period = 4.2;
    const phase = (t + br.seed * 0.37) % period;
    if (phase > 0.4) return;
    const ctx = this.ctx;
    const k = phase / 0.4;
    ctx.save();
    ctx.beginPath();
    ctx.rect(br.x + 1, br.y + 1, br.w - 2, br.h - 2);
    ctx.clip();
    const x = br.x - br.h + (br.w + br.h * 2) * k;
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.moveTo(x - 4, br.y + br.h);
    ctx.lineTo(x + br.h - 4, br.y);
    ctx.lineTo(x + br.h + 4, br.y);
    ctx.lineTo(x + 4, br.y + br.h);
    ctx.fill();
    ctx.restore();
    if (k > 0.25 && k < 0.75) pixelStar(ctx, br.x + br.w - 6, br.y + 4, WHITE);
  }

  drawNet(g) {
    const ctx = this.ctx;
    const on = Math.floor(g.t * 4) % 2 === 0;
    ctx.fillStyle = on ? '#6f9dff' : '#3b6bd6';
    ctx.fillRect(FIELD.x, C.NET_Y - 1, FIELD.w, 4);
    ctx.fillStyle = '#c9d9ff';
    ctx.fillRect(FIELD.x, C.NET_Y - 1, FIELD.w, 1);
    text(ctx, 'BACKUP', FIELD.x + 6, C.NET_Y - 9, 8, '#9fbcff', 'left', true);
  }

  drawPaddle(g) {
    const ctx = this.ctx;
    const p = g.paddle;
    const e = g.effects;
    const w = Math.round(p.w);
    const x = Math.round(p.x - w / 2);
    const y = PADDLE_Y;
    const h = PADDLE_H;
    const rot = e.width === 'rot';
    ctx.fillStyle = INK;
    ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    bevelRect(ctx, x, y, w, h, rot ? '#8fb07f' : '#c3c9d4', rot ? '#d2ecc4' : '#f4f6fa', rot ? '#4d6642' : '#626b7c', 2);
    const capColor = e.scan > 0 ? '#ff8a2b' : CYAN;
    const cap = Math.min(14, Math.floor(w / 4));
    for (const cx of [x, x + w - cap]) {
      bevelRect(ctx, cx, y, cap, h, capColor, lighten(capColor, 0.5), darken(capColor, 0.45), 2);
    }
    ctx.fillStyle = INK;
    ctx.fillRect(x + cap, y, 1, h);
    ctx.fillRect(x + w - cap - 1, y, 1, h);
    if (e.ingest > 0) {
      ctx.fillStyle = GOLD;
      ctx.fillRect(x + cap + 2, y - 3, w - cap * 2 - 4, 3);
    }
    if (e.scan > 0) {
      ctx.fillStyle = INK;
      ctx.fillRect(x + 3, y - 7, 6, 7);
      ctx.fillRect(x + w - 9, y - 7, 6, 7);
      ctx.fillStyle = '#ff8a2b';
      ctx.fillRect(x + 4, y - 6, 4, 6);
      ctx.fillRect(x + w - 8, y - 6, 4, 6);
    }
  }

  drawBalls(g) {
    const ctx = this.ctx;
    const crawl = g.effects.crawl > 0;
    const hidden = g.effects.linkrot > 0;
    const trailColor = crawl ? '255,154,60' : '47,213,255';
    const face = crawl ? '#ff9a3c' : WHITE;
    const shade = crawl ? '#b8521a' : '#8fa3c8';
    for (const b of g.balls) {
      if (hidden && g.t % 1 > 0.08) continue; // link rot: the ball only flickers into view
      const tr = b.trail;
      if (!b.stuck && tr.length >= 4) {
        ctx.font = `8px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const n = tr.length / 2;
        for (let i = 0; i < n - 1; i += 3) {
          const tx = tr[i * 2], ty = tr[i * 2 + 1];
          const bit = (Math.floor(tx / 9) + Math.floor(ty / 7)) & 1 ? '1' : '0';
          ctx.fillStyle = `rgba(${trailColor},${((i / n) * 0.7).toFixed(3)})`;
          ctx.fillText(bit, Math.round(tx), Math.round(ty));
        }
      }
      const x0 = Math.round(b.x) - BALL_R;
      const y0 = Math.round(b.y) - BALL_R;
      ctx.fillStyle = INK;
      for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) {
        if (DISC[r][c] === '#') ctx.fillRect(x0 + c * 2 - 1, y0 + r * 2 - 1, 4, 4);
      }
      for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) {
        if (DISC[r][c] !== '#') continue;
        ctx.fillStyle = DISC_SHADE[r][c] === '#' ? shade : face;
        ctx.fillRect(x0 + c * 2, y0 + r * 2, 2, 2);
      }
    }
  }

  drawPills(g) {
    const ctx = this.ctx;
    for (const p of g.pills) {
      const x = Math.round(p.x - p.w / 2);
      const y = Math.round(p.y - p.h / 2);
      if (p.file) {
        const page = this.pages.find((q) => q.id === p.file);
        const blinkOn = Math.floor(p.t * 6) % 2 === 0;
        ctx.fillStyle = blinkOn ? WHITE : INK;
        ctx.fillRect(x - 2, y - 2, p.w + 4, p.h + 4);
        bevelRect(ctx, x, y, p.w, p.h, GOLD, '#fff3b0', '#a37800', 2);
        drawDocIcon(ctx, x + 5, y + 3, 9, p.h - 6, WHITE);
        text(ctx, page ? page.pill : 'FILE', x + p.w / 2 + 6, p.y + 0.5, 8, INK);
      } else {
        const def = POWERUPS[p.kind];
        const col = def.good ? def.color : RED;
        ctx.fillStyle = INK;
        ctx.fillRect(x - 1, y - 1, p.w + 2, p.h + 2);
        bevelRect(ctx, x, y, p.w, p.h, col, lighten(col, 0.55), darken(col, 0.45), 2);
        text(ctx, def.label, p.x, p.y + 0.5, 8, !def.good || isDark(col) ? WHITE : INK);
      }
    }
  }

  drawLasers(g) {
    const ctx = this.ctx;
    for (const z of g.lasers) {
      ctx.fillStyle = '#ff8a2b';
      ctx.fillRect(Math.round(z.x) - 1, Math.round(z.y) - 10, 3, 12);
      ctx.fillStyle = '#fff1d6';
      ctx.fillRect(Math.round(z.x), Math.round(z.y) - 10, 1, 12);
    }
  }

  drawParticles(g) {
    const ctx = this.ctx;
    for (const q of g.fx.particles) {
      if (q.life < 0.15 && Math.floor(q.life * 40) % 2) continue; // flicker out instead of fading
      ctx.fillStyle = q.color;
      const s = Math.round(q.size);
      ctx.fillRect(Math.round(q.x - s / 2), Math.round(q.y - s / 2), s, s);
    }
  }

  // Explosions and "file detected" bursts: expanding square outlines.
  drawBursts(g) {
    if (this.reducedMotion) return;
    const ctx = this.ctx;
    for (const f of g.fx.flares) {
      const k = f.t / f.life;
      const r = Math.round(8 + 70 * k);
      ctx.strokeStyle = hexA(f.color, 1 - k);
      ctx.lineWidth = 3;
      ctx.strokeRect(Math.round(f.x) - r, Math.round(f.y) - r, r * 2, r * 2);
      if (k < 0.5) {
        const s = Math.round(r * 0.5);
        ctx.strokeStyle = hexA('#ffffff', 1 - k * 2);
        ctx.lineWidth = 2;
        ctx.strokeRect(Math.round(f.x) - s, Math.round(f.y) - s, s * 2, s * 2);
      }
    }
  }

  drawTexts(g) {
    const ctx = this.ctx;
    for (const q of g.fx.texts) {
      if (q.life - q.t < 0.3 && Math.floor(q.t * 16) % 2) continue;
      text(ctx, q.str, Math.round(q.x), Math.round(q.y), 8, q.color, 'center', true);
    }
  }

  // Level 12: the lights are low. Only the area around the balls and paddle is lit.
  drawDarkness(g) {
    if (!this.dark) {
      this.dark = document.createElement('canvas');
      this.dark.width = this.canvas.width;
      this.dark.height = this.canvas.height;
    }
    const d = this.dark.getContext('2d');
    d.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    d.globalCompositeOperation = 'source-over';
    d.clearRect(0, 0, W, H);
    d.fillStyle = 'rgba(2,3,10,0.9)';
    d.fillRect(FIELD.x, FIELD.y, FIELD.w, FIELD.h);
    d.globalCompositeOperation = 'destination-out';
    const lights = g.balls.map((b) => [b.x, b.y, 120]);
    lights.push([g.paddle.x, PADDLE_Y, 90]);
    for (const p of g.pills) lights.push([p.x, p.y, 40]);
    for (const [x, y, r] of lights) {
      const grd = d.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, 'rgba(0,0,0,1)');
      grd.addColorStop(0.8, 'rgba(0,0,0,0.9)');
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      d.fillStyle = grd;
      d.fillRect(x - r, y - r, r * 2, r * 2);
    }
    this.ctx.drawImage(this.dark, 0, 0, W, H);
  }

  drawRain(t) {
    const ctx = this.ctx;
    ctx.font = `8px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const col of this.rain) {
      const y0 = ((t * col.speed + col.offset) % (H + 200)) - 100;
      for (let i = 0; i < col.bits.length; i++) {
        const y = Math.round(y0 - i * 11);
        if (y < FIELD.y + 4 || y > H) continue;
        ctx.fillStyle = `rgba(47,213,255,${(0.2 * (1 - i / col.bits.length)).toFixed(3)})`;
        ctx.fillText(col.bits[i], col.x, y);
      }
    }
  }

  drawWalls() {
    let spr = this.cache.get('walls');
    if (!spr) {
      spr = this.layer(W, H, (x) => drawWallsSprite(x));
      this.cache.set('walls', spr);
    }
    this.ctx.drawImage(spr, 0, 0, W, H);
  }

  // ------------------------------------------------------------ HUD + screens

  drawHud(g) {
    const ctx = this.ctx;
    label(ctx, 'SCORE', 24, 11);
    text(ctx, String(g.score).padStart(7, '0'), 24, 25, 12, WHITE, 'left');
    label(ctx, 'HI', 148, 11);
    text(ctx, String(Math.max(g.hi, g.score)).padStart(7, '0'), 148, 25, 12, GOLD, 'left');
    label(ctx, 'LEVEL', 400, 11, 'center');
    const lvl = g.mode === 'title' ? '-- / 12' : `${String(g.levelIndex + 1).padStart(2, '0')} / 12`;
    text(ctx, lvl, 400, 25, 12, CYAN, 'center');
    label(ctx, 'LIVES', 488, 11);
    const lives = g.mode === 'title' ? C.START_LIVES : g.lives;
    for (let i = 0; i < Math.min(lives, 7); i++) drawMiniPaddle(ctx, 488 + i * 16, 20);
    label(ctx, 'FILES', 604, 11);
    this.pages.forEach((p, i) => {
      const x = 604 + i * 46;
      const on = g.found.has(p.id);
      drawDocIcon(ctx, x, 17, 8, 11, on ? GOLD : '#2b3350');
      text(ctx, p.hud, x + 11, 23, 8, on ? GOLD : '#4a5578', 'left');
    });
  }

  dim(a = 0.6) {
    this.ctx.fillStyle = `rgba(3,4,12,${a})`;
    this.ctx.fillRect(FIELD.x, FIELD.y, FIELD.w, FIELD.h);
  }

  drawTitle(g) {
    const ctx = this.ctx;
    this.dim(0.3);
    bigText(ctx, 'BITSTREAM', W / 2, 176, 66, CYAN);
    text(ctx, 'A   D I G I T A L   P R E S E R V A T I O N   B R I C K - B R E A K E R', W / 2, 232, 8, WHITE, 'center', true);
    text(ctx, '4 FILES ARE HIDDEN IN THE BRICKS. RECOVER THEM.', W / 2, 270, 10, GOLD, 'center', true);
    if (blink(g.t)) text(ctx, 'PRESS SPACE OR CLICK TO START', W / 2, 336, 12, WHITE, 'center', true);
    if (g.maxLevel > 1) text(ctx, `PRESS C TO CONTINUE FROM LEVEL ${String(g.maxLevel).padStart(2, '0')}`, W / 2, 364, 10, CYAN, 'center', true);
    const rows = [
      ['ARROWS / A D', 'MOVE'],
      ['SPACE / CLICK', 'LAUNCH + FIRE'],
      ['P', 'PAUSE'],
      ['M', 'SOUND ON/OFF'],
    ];
    panel(ctx, 250, 410, 300, 106);
    rows.forEach(([k, v], i) => {
      text(ctx, k, 390, 431 + i * 22, 8, CYAN, 'right');
      text(ctx, v, 410, 431 + i * 22, 8, WHITE, 'left');
    });
  }

  drawBanner(g, b) {
    const ctx = this.ctx;
    const late = b.life - b.t < 0.3;
    if (late && Math.floor(b.t * 16) % 2) return; // blink out
    if (b.kind === 'level') {
      const y = 360;
      panel(ctx, 150, y - 50, 500, 100);
      text(ctx, b.title, W / 2, y - 26, 12, CYAN, 'center', true);
      bigText(ctx, b.sub, W / 2, y + 6, b.sub.length > 24 ? 18 : 26, WHITE);
      text(ctx, 'SPACE / CLICK TO LAUNCH', W / 2, y + 36, 8, DIM, 'center');
    } else if (b.kind === 'clear') {
      bigText(ctx, b.title, W / 2, 328, 30, GOLD);
      text(ctx, b.sub, W / 2, 372, 12, WHITE, 'center', true);
    } else if (b.kind === 'life') {
      text(ctx, b.title, W / 2, 400, 16, '#ff7d8c', 'center', true);
      text(ctx, b.sub, W / 2, 426, 8, '#c9d6ee', 'center', true);
    } else if (b.kind === 'pill') {
      text(ctx, b.title, W / 2, 470, 10, b.color, 'center', true);
      text(ctx, b.sub, W / 2, 490, 8, WHITE, 'center', true);
    }
  }

  drawPaused(g) {
    this.dim(g.pauseReason === 'file' ? 0.75 : 0.62);
    if (g.pauseReason === 'file') return; // the "file recovered" dialog sits on top
    bigText(this.ctx, 'PAUSED', W / 2, 288, 44, WHITE);
    if (blink(g.t)) text(this.ctx, 'PRESS P TO RESUME', W / 2, 340, 12, CYAN, 'center', true);
  }

  drawGameOver(g) {
    const ctx = this.ctx;
    this.dim(0.72);
    bigText(ctx, 'CHECKSUM MISMATCH', W / 2, 248, 32, RED);
    text(ctx, 'GAME OVER', W / 2, 292, 12, '#ff9aa6', 'center', true);
    text(ctx, `SCORE ${g.score}`, W / 2, 330, 12, WHITE, 'center', true);
    if (blink(g.t)) text(ctx, `SPACE / CLICK: CONTINUE FROM LEVEL ${String(g.levelIndex + 1).padStart(2, '0')}`, W / 2, 390, 10, CYAN, 'center', true);
    text(ctx, '(YOUR SCORE STARTS OVER)', W / 2, 412, 8, DIM, 'center');
  }

  drawWin(g) {
    const ctx = this.ctx;
    this.dim(0.45);
    bigText(ctx, 'ARCHIVE PRESERVED', W / 2, 228, 36, GOLD);
    text(ctx, 'ALL 12 LEVELS CLEARED. EVERY BIT ACCOUNTED FOR.', W / 2, 276, 10, WHITE, 'center', true);
    text(ctx, `FINAL SCORE ${g.score}`, W / 2, 316, 14, CYAN, 'center', true);
    if (blink(g.t)) text(ctx, 'SPACE / CLICK TO PLAY AGAIN', W / 2, 388, 10, WHITE, 'center', true);
  }
}

// ------------------------------------------------------------ drawing helpers

function blink(t) {
  return t % 1.1 < 0.75;
}

function makeRain() {
  const cols = [];
  let seed = 7;
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 26; i++) {
    const len = 6 + Math.floor(r() * 14);
    cols.push({ x: Math.round(30 + i * 29.5 + r() * 10), speed: 30 + r() * 60, offset: r() * 800, bits: Array.from({ length: len }, () => (r() < 0.5 ? '0' : '1')) });
  }
  return cols;
}

// Small pixel-font text. `shadow` adds a hard 1px drop-shadow.
function text(ctx, str, x, y, size, color, align = 'center', shadow = false) {
  ctx.font = `${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  if (shadow) {
    ctx.fillStyle = INK;
    ctx.fillText(str, x + 1, y + 1);
  }
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

function label(ctx, str, x, y, align = 'left') {
  text(ctx, str, x, y, 8, DIM, align);
}

// Big headline: flat face colour, dark outline, hard offset shadow.
function bigText(ctx, str, x, y, size, face) {
  ctx.save();
  ctx.font = `700 ${size}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'miter';
  const off = Math.max(2, Math.round(size / 14));
  ctx.lineWidth = Math.max(3, size / 9);
  ctx.strokeStyle = INK;
  ctx.fillStyle = face === GOLD ? '#6a3d00' : face === RED ? '#5a0a14' : SHADOW;
  ctx.strokeText(str, x + off, y + off);
  ctx.fillText(str, x + off, y + off);
  ctx.strokeText(str, x, y);
  ctx.fillStyle = face;
  ctx.fillText(str, x, y);
  ctx.restore();
}

// Flat panel with a double border and square corners.
function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(3,5,16,0.92)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = WHITE;
  ctx.fillRect(x, y, w, 2);
  ctx.fillRect(x, y + h - 2, w, 2);
  ctx.fillRect(x, y, 2, h);
  ctx.fillRect(x + w - 2, y, 2, h);
  ctx.strokeStyle = CYAN;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 4.5, y + 4.5, w - 9, h - 9);
}

// Rectangle with a light top/left edge and a dark bottom/right edge.
function bevelRect(ctx, x, y, w, h, base, hi, lo, e) {
  ctx.fillStyle = base;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = hi;
  ctx.fillRect(x, y, w, e);
  ctx.fillRect(x, y, e, h);
  ctx.fillStyle = lo;
  ctx.fillRect(x, y + h - e, w, e);
  ctx.fillRect(x + w - e, y, e, h);
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function hexA(hex, a) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${Math.max(0, a).toFixed(3)})`;
}

function mix(hex, target, amt) {
  const [r, g, b] = hexToRgb(hex);
  const m = (c) => Math.round(c + (target - c) * amt);
  return `rgb(${m(r)},${m(g)},${m(b)})`;
}

const lighten = (hex, amt) => mix(hex, 255, amt);
const darken = (hex, amt) => mix(hex, 0, amt);

function isDark(hex) {
  const [r, g, b] = hexToRgb(hex);
  return r * 0.299 + g * 0.587 + b * 0.114 < 140;
}

function drawBackground(ctx) {
  ctx.fillStyle = '#05071a';
  ctx.fillRect(0, 0, W, H);
  // faint checkerboard tiles
  ctx.fillStyle = '#080b24';
  const s = 32;
  for (let y = FIELD.y; y < H; y += s) {
    for (let x = FIELD.x; x < FIELD.x + FIELD.w; x += s) {
      if (((x - FIELD.x) / s + (y - FIELD.y) / s) % 2 === 0) ctx.fillRect(x, y, s, s);
    }
  }
  // HUD bar
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, W, HUD_H);
  ctx.fillStyle = '#2b3350';
  ctx.fillRect(0, HUD_H - 2, W, 2);
}

function drawWallsSprite(ctx) {
  const base = '#5a6280', hi = '#a3abc6', lo = '#2a3048';
  // side walls in blocks
  for (const x0 of [0, W - C.WALL]) {
    for (let y = HUD_H; y < H; y += 46) {
      bevelRect(ctx, x0, y, C.WALL, Math.min(46, H - y), base, hi, lo, 2);
      ctx.fillStyle = INK;
      ctx.fillRect(x0, y, C.WALL, 1);
    }
  }
  // top wall in blocks
  for (let x = 0; x < W; x += 50) {
    bevelRect(ctx, x, HUD_H, Math.min(50, W - x), FIELD.y - HUD_H, base, hi, lo, 2);
    ctx.fillStyle = INK;
    ctx.fillRect(x, HUD_H, 1, FIELD.y - HUD_H);
  }
  // dark line along the inside of the walls
  ctx.fillStyle = INK;
  ctx.fillRect(FIELD.x - 1, FIELD.y, 1, H - FIELD.y);
  ctx.fillRect(FIELD.x + FIELD.w, FIELD.y, 1, H - FIELD.y);
  ctx.fillRect(FIELD.x - 1, FIELD.y - 1, FIELD.w + 2, 1);
}

function drawBrickSprite(ctx, w, h, color, br) {
  // 1px gap on every side shows the background between bricks.
  const x = 1, y = 1, bw = w - 2, bh = h - 2;
  const e = Math.max(2, Math.min(3, Math.round(bh / 7)));
  if (br.steel) {
    bevelRect(ctx, x, y, bw, bh, '#aab2c0', '#eef1f6', '#5d6677', e);
    ctx.fillStyle = '#5d6677';
    if (bw > 16) {
      ctx.fillRect(x + e + 2, y + bh / 2 - 1.5, 3, 3);
      ctx.fillRect(x + bw - e - 5, y + bh / 2 - 1.5, 3, 3);
    }
    return;
  }
  const base = br.bad ? '#7a1020' : color;
  bevelRect(ctx, x, y, bw, bh, base, lighten(base, 0.45), darken(base, 0.45), e);
  if (br.bad) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x + e, y + e, bw - 2 * e, bh - 2 * e);
    ctx.clip();
    ctx.fillStyle = 'rgba(255,70,90,0.45)';
    for (let k = -bh; k < bw; k += 8) {
      ctx.beginPath();
      ctx.moveTo(x + k, y + bh);
      ctx.lineTo(x + k + bh, y);
      ctx.lineTo(x + k + bh + 3, y);
      ctx.lineTo(x + k + 3, y + bh);
      ctx.fill();
    }
    ctx.restore();
    ctx.font = `${Math.min(10, bh - 6)}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffe0e4';
    ctx.fillText('ERR', w / 2, h / 2 + 1);
  }
  if (br.mystery) {
    ctx.font = `${Math.min(16, bh - 4)}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = INK;
    ctx.fillText('?', w / 2, h / 2 + 1);
  }
}

function drawCracks(ctx, br) {
  const dmg = 1 - br.hp / br.maxHp;
  const n = Math.ceil(dmg * 3);
  ctx.save();
  ctx.strokeStyle = 'rgba(4,6,15,0.7)';
  ctx.lineWidth = 1.5;
  ctx.lineJoin = 'miter';
  let s = br.seed + 1;
  const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < n; i++) {
    let x = br.x + br.w * (0.2 + r() * 0.6);
    let y = br.y + 3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let k = 0; k < 3; k++) {
      x += (r() - 0.5) * br.w * 0.25;
      y += (br.h - 6) / 3;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawDocIcon(ctx, x, y, w, h, color) {
  const f = Math.min(3, Math.floor(w * 0.35));
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w - f, y);
  ctx.lineTo(x + w, y + f);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(4,6,15,0.45)';
  for (let i = 0; i < 3; i++) ctx.fillRect(x + 2, y + f + 1 + i * 2, w - 4, 1);
}

function drawMiniPaddle(ctx, x, y) {
  ctx.fillStyle = '#c3c9d4';
  ctx.fillRect(x, y - 2, 13, 5);
  ctx.fillStyle = CYAN;
  ctx.fillRect(x, y - 2, 3, 5);
  ctx.fillRect(x + 10, y - 2, 3, 5);
}

function pixelStar(ctx, x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x) - 3, Math.round(y), 7, 1);
  ctx.fillRect(Math.round(x), Math.round(y) - 3, 1, 7);
}
