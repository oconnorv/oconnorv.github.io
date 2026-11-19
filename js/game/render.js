// Draws the game in a flat, sharp-edged arcade style: solid colours, bevelled edges,
// square corners, hard drop-shadows. Reads game state; never changes it.
// Every colour comes from `T` in themes.js.
import * as C from './constants.js';
import { POWERUPS } from './powerups.js';
import { T, color } from './themes.js';

const { W, H, FIELD, HUD_H, PADDLE_Y, PADDLE_H, BALL_R } = C;
const FONT = 'Silkscreen, "Courier New", monospace';

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
      const fill = br.steel || br.mystery || br.bad || br.fixedColor || br.maxHp === 1 ? br.color : T.hp[br.hp];
      const key = `b|${br.w.toFixed(2)}|${br.h}|${fill}|${br.steel ? 's' : br.mystery ? 'm' : br.bad ? 'x' : 'n'}`;
      let spr = this.cache.get(key);
      if (!spr) {
        spr = this.layer(br.w, br.h, (x) => drawBrickSprite(x, br.w, br.h, fill, br));
        this.cache.set(key, spr);
      }
      ctx.drawImage(spr, br.x, br.y, br.w, br.h);
      if (!br.steel && br.hp < br.maxHp) drawCracks(ctx, br);
      if (br.flash > 0) {
        ctx.fillStyle = `rgba(255,255,255,${Math.min(0.8, br.flash * 5).toFixed(3)})`;
        ctx.fillRect(br.x + 1, br.y + 1, br.w - 2, br.h - 2);
      }
    }
  }

  drawNet(g) {
    const ctx = this.ctx;
    ctx.fillStyle = T.net.on;
    ctx.fillRect(FIELD.x, C.NET_Y - 1, FIELD.w, 4);
    ctx.fillStyle = T.net.top;
    ctx.fillRect(FIELD.x, C.NET_Y - 1, FIELD.w, 1);
    text(ctx, 'BACKUP', FIELD.x + 6, C.NET_Y - 10, 10, T.net.label, 'left', true);
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
    ctx.fillStyle = T.ink;
    ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    const pc = rot ? T.paddleRot : T.paddle;
    bevelRect(ctx, x, y, w, h, pc.base, pc.hi, pc.lo, 2);
    const capColor = e.scan > 0 ? T.laser : T.paddleCap;
    const cap = Math.min(14, Math.floor(w / 4));
    for (const cx of [x, x + w - cap]) {
      bevelRect(ctx, cx, y, cap, h, capColor, lighten(capColor, 0.5), darken(capColor, 0.45), 2);
    }
    ctx.fillStyle = T.ink;
    ctx.fillRect(x + cap, y, 1, h);
    ctx.fillRect(x + w - cap - 1, y, 1, h);
    if (e.ingest > 0) {
      ctx.fillStyle = T.gold;
      ctx.fillRect(x + cap + 2, y - 3, w - cap * 2 - 4, 3);
    }
    if (e.scan > 0) {
      ctx.fillStyle = T.ink;
      ctx.fillRect(x + 3, y - 7, 6, 7);
      ctx.fillRect(x + w - 9, y - 7, 6, 7);
      ctx.fillStyle = T.laser;
      ctx.fillRect(x + 4, y - 6, 4, 6);
      ctx.fillRect(x + w - 8, y - 6, 4, 6);
    }
  }

  drawBalls(g) {
    const ctx = this.ctx;
    const crawl = g.effects.crawl > 0;
    const hidden = g.effects.linkrot > 0;
    const bs = crawl ? T.ballCrawl : T.ball;
    const trailColor = bs.trail;
    const face = bs.face;
    const shade = bs.shade;
    for (const b of g.balls) {
      ctx.globalAlpha = hidden ? 0.18 : 1; // link rot: the ball fades to a faint ghost while it lasts
      const tr = b.trail;
      if (!hidden && !b.stuck && tr.length >= 4) {
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
      ctx.fillStyle = T.ink;
      for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) {
        if (DISC[r][c] === '#') ctx.fillRect(x0 + c * 2 - 1, y0 + r * 2 - 1, 4, 4);
      }
      for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) {
        if (DISC[r][c] !== '#') continue;
        ctx.fillStyle = DISC_SHADE[r][c] === '#' ? shade : face;
        ctx.fillRect(x0 + c * 2, y0 + r * 2, 2, 2);
      }
    }
    ctx.globalAlpha = 1;
  }

  drawPills(g) {
    const ctx = this.ctx;
    for (const p of g.pills) {
      const x = Math.round(p.x - p.w / 2);
      const y = Math.round(p.y - p.h / 2);
      if (p.file) {
        const page = this.pages.find((q) => q.id === p.file);
        ctx.fillStyle = T.text;
        ctx.fillRect(x - 2, y - 2, p.w + 4, p.h + 4);
        bevelRect(ctx, x, y, p.w, p.h, T.filePill.base, T.filePill.hi, T.filePill.lo, 2);
        drawDocIcon(ctx, x + 6, y + 4, 11, p.h - 8, T.text);
        text(ctx, page ? page.pill : 'FILE', x + p.w / 2 + 7, p.y + 0.5, 11, T.ink);
      } else {
        const def = POWERUPS[p.kind];
        const col = color(def.good ? def.color : 'danger');
        ctx.fillStyle = T.ink;
        ctx.fillRect(x - 1, y - 1, p.w + 2, p.h + 2);
        bevelRect(ctx, x, y, p.w, p.h, col, lighten(col, 0.55), darken(col, 0.45), 2);
        text(ctx, def.label, p.x, p.y + 0.5, 11, !def.good || isDark(col) ? T.text : T.ink);
      }
    }
  }

  drawLasers(g) {
    const ctx = this.ctx;
    for (const z of g.lasers) {
      ctx.fillStyle = T.laser;
      ctx.fillRect(Math.round(z.x) - 1, Math.round(z.y) - 10, 3, 12);
      ctx.fillStyle = T.laserCore;
      ctx.fillRect(Math.round(z.x), Math.round(z.y) - 10, 1, 12);
    }
  }

  // Explosions and "file detected" bursts: expanding square outlines.
  drawBursts(g) {
    if (this.reducedMotion) return;
    const ctx = this.ctx;
    for (const f of g.fx.flares) {
      const k = f.t / f.life;
      const r = Math.round(8 + 70 * k);
      ctx.strokeStyle = hexA(color(f.color), 1 - k);
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
      ctx.globalAlpha = Math.max(0, Math.min(1, (q.life - q.t) / 0.3));
      text(ctx, q.str, Math.round(q.x), Math.round(q.y), 12, color(q.color), 'center', true);
    }
    ctx.globalAlpha = 1;
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
    d.fillStyle = T.darkness;
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
        ctx.fillStyle = `rgba(${T.rain},${(0.2 * (1 - i / col.bits.length)).toFixed(3)})`;
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

  // Two rows: labels on top, big values underneath, in left-aligned groups.
  drawHud(g) {
    const ctx = this.ctx;
    const LY = 15;
    const VY = 39;
    label(ctx, 'SCORE', 20, LY);
    text(ctx, String(g.score).padStart(7, '0'), 20, VY, 20, T.text, 'left');
    label(ctx, 'HI', 150, LY);
    text(ctx, String(Math.max(g.hi, g.score)).padStart(7, '0'), 150, VY, 20, T.gold, 'left');
    label(ctx, 'LEVEL', 280, LY);
    const lvl = g.mode === 'title' ? '--/12' : `${String(g.levelIndex + 1).padStart(2, '0')}/12`;
    text(ctx, lvl, 280, VY, 20, T.accent, 'left');
    label(ctx, 'LIVES', 384, LY);
    const lives = g.mode === 'title' ? C.START_LIVES : g.lives;
    const shown = Math.min(lives, 4);
    for (let i = 0; i < shown; i++) drawMiniPaddle(ctx, 384 + i * 25, VY);
    if (lives > shown) text(ctx, `+${lives - shown}`, 384 + shown * 25, VY, 12, T.text, 'left');
    label(ctx, 'FILES', 512, LY);
    let x = 512;
    for (const p of this.pages) {
      const on = g.found.has(p.id);
      drawDocIcon(ctx, x, VY - 8, 12, 16, on ? T.gold : T.fileOff);
      text(ctx, p.hud, x + 16, VY, 12, on ? T.gold : T.fileOffText, 'left');
      x += 16 + ctx.measureText(p.hud).width + 11;
    }
  }

  dim(a = 0.6) {
    this.ctx.fillStyle = `rgba(${T.overlay},${a})`;
    this.ctx.fillRect(FIELD.x, FIELD.y, FIELD.w, FIELD.h);
  }

  drawTitle(g) {
    const ctx = this.ctx;
    this.dim(0.3);
    bigText(ctx, 'BITSTREAM', W / 2, 150, 66, T.accent);
    text(ctx, 'A DIGITAL PRESERVATION BRICK-BREAKER', W / 2, 212, 16, T.text, 'center', true);
    text(ctx, '4 FILES ARE HIDDEN IN THE BRICKS.', W / 2, 252, 18, T.gold, 'center', true);
    text(ctx, 'RECOVER THEM.', W / 2, 278, 18, T.gold, 'center', true);
    text(ctx, 'PRESS SPACE OR CLICK TO START', W / 2, 330, 22, T.text, 'center', true);
    if (g.maxLevel > 1) text(ctx, `PRESS C TO CONTINUE FROM LEVEL ${String(g.maxLevel).padStart(2, '0')}`, W / 2, 364, 16, T.accent, 'center', true);
    const rows = [
      ['ARROWS / A D', 'MOVE'],
      ['SPACE / CLICK', 'LAUNCH + FIRE'],
      ['P', 'PAUSE'],
      ['M', 'SOUND ON/OFF'],
    ];
    panel(ctx, 175, 396, 450, 156);
    rows.forEach(([k, v], i) => {
      text(ctx, k, 384, 425 + i * 33, 16, T.accent, 'right');
      text(ctx, v, 408, 425 + i * 33, 16, T.text, 'left');
    });
  }

  drawBanner(g, b) {
    const ctx = this.ctx;
    ctx.globalAlpha = Math.max(0, Math.min(1, (b.life - b.t) / 0.3)); // fade out at the end
    if (b.kind === 'level') {
      const y = 362;
      panel(ctx, 130, y - 66, 540, 132);
      text(ctx, b.title, W / 2, y - 40, 16, T.accent, 'center', true);
      bigText(ctx, b.sub, W / 2, y - 3, 28, T.text, 496);
      text(ctx, 'SPACE / CLICK TO LAUNCH', W / 2, y + 40, 14, T.soft, 'center', true);
    } else if (b.kind === 'clear') {
      bigText(ctx, b.title, W / 2, 326, 34, T.gold);
      text(ctx, b.sub, W / 2, 374, 18, T.text, 'center', true);
    } else if (b.kind === 'life') {
      text(ctx, b.title, W / 2, 396, 22, T.lifeText, 'center', true);
      text(ctx, b.sub, W / 2, 428, 14, T.softer, 'center', true);
    } else if (b.kind === 'pill') {
      text(ctx, b.title, W / 2, 464, 16, color(b.color), 'center', true);
      text(ctx, b.sub, W / 2, 490, 14, T.text, 'center', true);
    }
    ctx.globalAlpha = 1;
  }

  drawPaused(g) {
    this.dim(g.pauseReason === 'file' ? 0.75 : 0.62);
    if (g.pauseReason === 'file') return; // the "file recovered" dialog sits on top
    bigText(this.ctx, 'PAUSED', W / 2, 286, 48, T.text);
    text(this.ctx, 'PRESS SPACE TO RESUME', W / 2, 346, 20, T.accent, 'center', true);
  }

  drawGameOver(g) {
    const ctx = this.ctx;
    this.dim(0.72);
    bigText(ctx, 'CHECKSUM MISMATCH', W / 2, 236, 36, T.danger);
    text(ctx, 'GAME OVER', W / 2, 288, 18, T.dangerSoft, 'center', true);
    text(ctx, `SCORE ${g.score}`, W / 2, 330, 20, T.text, 'center', true);
    text(ctx, `SPACE / CLICK: CONTINUE FROM LEVEL ${String(g.levelIndex + 1).padStart(2, '0')}`, W / 2, 392, 16, T.accent, 'center', true);
    text(ctx, '(YOUR SCORE STARTS OVER)', W / 2, 422, 14, T.soft, 'center', true);
  }

  drawWin(g) {
    const ctx = this.ctx;
    this.dim(0.45);
    bigText(ctx, 'ARCHIVE PRESERVED', W / 2, 222, 40, T.gold);
    text(ctx, 'ALL 12 LEVELS CLEARED.', W / 2, 276, 18, T.text, 'center', true);
    text(ctx, 'EVERY BIT ACCOUNTED FOR.', W / 2, 302, 18, T.text, 'center', true);
    text(ctx, `FINAL SCORE ${g.score}`, W / 2, 346, 22, T.accent, 'center', true);
    text(ctx, 'SPACE / CLICK TO PLAY AGAIN', W / 2, 404, 18, T.text, 'center', true);
  }
}

// ------------------------------------------------------------ drawing helpers

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
    ctx.fillStyle = T.ink;
    ctx.fillText(str, x + 1, y + 1);
  }
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

function label(ctx, str, x, y, align = 'left') {
  text(ctx, str, x, y, 12, T.label, align);
}

// Big headline: flat face colour, dark outline, hard offset shadow.
function bigText(ctx, str, x, y, size, face, maxW = W - 90) {
  ctx.save();
  ctx.font = `700 ${size}px ${FONT}`;
  const wide = ctx.measureText(str).width;
  if (wide > maxW) {
    size = Math.floor((size * maxW) / wide);
    ctx.font = `700 ${size}px ${FONT}`;
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'miter';
  const off = Math.max(2, Math.round(size / 14));
  ctx.lineWidth = Math.max(3, size / 9);
  ctx.strokeStyle = T.ink;
  ctx.fillStyle = face === T.gold ? T.goldShadow : face === T.danger ? T.dangerShadow : T.shadow;
  ctx.strokeText(str, x + off, y + off);
  ctx.fillText(str, x + off, y + off);
  ctx.strokeText(str, x, y);
  ctx.fillStyle = face;
  ctx.fillText(str, x, y);
  ctx.restore();
}

// Flat panel with a double border and square corners.
function panel(ctx, x, y, w, h) {
  ctx.fillStyle = T.panelBg;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = T.text;
  ctx.fillRect(x, y, w, 2);
  ctx.fillRect(x, y + h - 2, w, 2);
  ctx.fillRect(x, y, 2, h);
  ctx.fillRect(x + w - 2, y, 2, h);
  ctx.strokeStyle = T.accent;
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
  ctx.fillStyle = T.bg;
  ctx.fillRect(0, 0, W, H);
  // faint checkerboard tiles
  ctx.fillStyle = T.tile;
  const s = 32;
  for (let y = FIELD.y; y < H; y += s) {
    for (let x = FIELD.x; x < FIELD.x + FIELD.w; x += s) {
      if (((x - FIELD.x) / s + (y - FIELD.y) / s) % 2 === 0) ctx.fillRect(x, y, s, s);
    }
  }
  // HUD bar
  ctx.fillStyle = T.hudBg;
  ctx.fillRect(0, 0, W, HUD_H);
  ctx.fillStyle = T.hudLine;
  ctx.fillRect(0, HUD_H - 2, W, 2);
}

function drawWallsSprite(ctx) {
  const { base, hi, lo } = T.wall;
  // side walls in blocks
  for (const x0 of [0, W - C.WALL]) {
    for (let y = HUD_H; y < H; y += 46) {
      bevelRect(ctx, x0, y, C.WALL, Math.min(46, H - y), base, hi, lo, 2);
      ctx.fillStyle = T.ink;
      ctx.fillRect(x0, y, C.WALL, 1);
    }
  }
  // top wall in blocks
  for (let x = 0; x < W; x += 50) {
    bevelRect(ctx, x, HUD_H, Math.min(50, W - x), FIELD.y - HUD_H, base, hi, lo, 2);
    ctx.fillStyle = T.ink;
    ctx.fillRect(x, HUD_H, 1, FIELD.y - HUD_H);
  }
  // dark line along the inside of the walls
  ctx.fillStyle = T.ink;
  ctx.fillRect(FIELD.x - 1, FIELD.y, 1, H - FIELD.y);
  ctx.fillRect(FIELD.x + FIELD.w, FIELD.y, 1, H - FIELD.y);
  ctx.fillRect(FIELD.x - 1, FIELD.y - 1, FIELD.w + 2, 1);
}

function drawBrickSprite(ctx, w, h, fill, br) {
  // 1px gap on every side shows the background between bricks.
  const x = 1, y = 1, bw = w - 2, bh = h - 2;
  const e = Math.max(2, Math.min(3, Math.round(bh / 7)));
  if (br.steel) {
    bevelRect(ctx, x, y, bw, bh, T.steel.base, T.steel.hi, T.steel.lo, e);
    ctx.fillStyle = T.steel.lo;
    if (bw > 16) {
      ctx.fillRect(x + e + 2, y + bh / 2 - 1.5, 3, 3);
      ctx.fillRect(x + bw - e - 5, y + bh / 2 - 1.5, 3, 3);
    }
    return;
  }
  const base = br.bad ? T.bad : fill;
  bevelRect(ctx, x, y, bw, bh, base, lighten(base, 0.45), darken(base, 0.45), e);
  if (br.bad) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x + e, y + e, bw - 2 * e, bh - 2 * e);
    ctx.clip();
    ctx.fillStyle = T.badHatch;
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
    ctx.fillStyle = T.badText;
    ctx.fillText('ERR', w / 2, h / 2 + 1);
  }
  if (br.mystery) {
    ctx.font = `${Math.min(16, bh - 4)}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = T.ink;
    ctx.fillText('?', w / 2, h / 2 + 1);
  }
}

function drawCracks(ctx, br) {
  const dmg = 1 - br.hp / br.maxHp;
  const n = Math.ceil(dmg * 3);
  ctx.save();
  ctx.strokeStyle = T.crack;
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
  ctx.fillStyle = T.docLines;
  for (let i = 0; i < 3; i++) ctx.fillRect(x + 2, y + f + 1 + i * 2, w - 4, 1);
}

function drawMiniPaddle(ctx, x, y) {
  ctx.fillStyle = T.paddle.base;
  ctx.fillRect(x, y - 4, 20, 8);
  ctx.fillStyle = T.paddleCap;
  ctx.fillRect(x, y - 4, 5, 8);
  ctx.fillRect(x + 15, y - 4, 5, 8);
}
