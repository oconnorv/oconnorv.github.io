// Draws the game in a Y2K Flash-era style. Reads game state; never changes it.
import * as C from './constants.js';
import { POWERUPS } from './powerups.js';
import { HP_COLORS } from './levels.js';

const { W, H, FIELD, HUD_H, PADDLE_Y, PADDLE_H, BALL_R } = C;
const FONT = 'Silkscreen, "Courier New", monospace';
const CYAN = '#2fd5ff';
const GOLD = '#ffd23f';

export class Renderer {
  constructor(canvas, pages) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.pages = pages;
    this.scale = 1;
    this.cache = new Map();
    this.bg = null;
    this.overlay = null;
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
    this.bg = this.overlay = this.dark = null;
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
    if (!this.bg) this.bg = this.layer(W, H, (x) => drawBackground(x));
    ctx.drawImage(this.bg, 0, 0, W, H);
    const motion = !this.reducedMotion;
    if (g.mode === 'title' || g.mode === 'win') this.drawRain(g.t);

    ctx.save();
    if (motion && g.fx.shake > 0 && !g.paused) ctx.translate((Math.random() - 0.5) * g.fx.shake, (Math.random() - 0.5) * g.fx.shake);

    if (g.mode === 'play' || g.mode === 'clear' || g.mode === 'over') {
      this.drawBricks(g);
      if (g.effects.backup) this.drawNet(g);
      this.drawPills(g);
      this.drawLasers(g);
      this.drawPaddle(g);
      this.drawBalls(g);
      this.drawParticles(g);
      if (g.level.dark && g.mode !== 'over') this.drawDarkness(g);
      this.drawFlares(g);
      this.drawTexts(g);
    }
    ctx.restore();

    this.drawWalls();
    this.drawHud(g);
    if (g.fx.flash > 0 && motion) {
      ctx.fillStyle = `rgba(255,255,255,${(g.fx.flash * 0.5).toFixed(3)})`;
      ctx.fillRect(FIELD.x, FIELD.y, FIELD.w, FIELD.h);
    }

    if (g.mode === 'title') this.drawTitle(g);
    else if (g.mode === 'over') this.drawGameOver(g);
    else if (g.mode === 'win') this.drawWin(g);
    else if (g.banner) this.drawBanner(g, g.banner);
    if (g.paused) this.drawPaused(g);

    if (!this.overlay) this.overlay = this.layer(W, H, (x) => drawScanlines(x));
    ctx.drawImage(this.overlay, 0, 0, W, H);
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
        ctx.fillStyle = 'rgba(255,60,80,0.35)';
        ctx.fillRect(br.x + 2, br.y + 2, br.w - 4, br.h - 4);
      }
      if (br.file) this.drawGlint(br, g.t);
      if (br.flash > 0) {
        ctx.fillStyle = `rgba(255,255,255,${Math.min(0.7, br.flash * 4).toFixed(3)})`;
        roundRect(ctx, br.x + 1.5, br.y + 1.5, br.w - 3, br.h - 3, 4);
        ctx.fill();
      }
    }
  }

  // A brick hiding a file sparkles every few seconds.
  drawGlint(br, t) {
    const period = 4.2;
    const phase = (t + br.seed * 0.37) % period;
    if (phase > 0.45) return;
    const ctx = this.ctx;
    const k = phase / 0.45;
    ctx.save();
    roundRect(ctx, br.x + 1.5, br.y + 1.5, br.w - 3, br.h - 3, 4);
    ctx.clip();
    const x = br.x - br.h + (br.w + br.h * 2) * k;
    const grd = ctx.createLinearGradient(x - 10, 0, x + 10, 0);
    grd.addColorStop(0, 'rgba(255,255,255,0)');
    grd.addColorStop(0.5, 'rgba(255,255,255,0.85)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.moveTo(x - 6, br.y + br.h);
    ctx.lineTo(x + 4, br.y);
    ctx.lineTo(x + 14, br.y);
    ctx.lineTo(x + 4, br.y + br.h);
    ctx.fill();
    ctx.restore();
    if (k > 0.3 && k < 0.7) drawSparkle(ctx, br.x + br.w * 0.8, br.y + 3, 5 * Math.sin(k * Math.PI), '#ffffff');
  }

  drawNet(g) {
    const ctx = this.ctx;
    const a = 0.55 + 0.25 * Math.sin(g.t * 6);
    ctx.save();
    ctx.shadowColor = '#3b7bff';
    ctx.shadowBlur = 10;
    ctx.strokeStyle = `rgba(110,160,255,${a.toFixed(3)})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(FIELD.x, C.NET_Y);
    ctx.lineTo(FIELD.x + FIELD.w, C.NET_Y);
    ctx.stroke();
    ctx.restore();
    text(ctx, 'BACKUP', FIELD.x + 6, C.NET_Y - 7, 8, `rgba(150,190,255,${a.toFixed(3)})`, 'left');
  }

  drawPaddle(g) {
    const ctx = this.ctx;
    const p = g.paddle;
    const e = g.effects;
    const x = p.x - p.w / 2;
    const y = PADDLE_Y;
    ctx.save();
    ctx.shadowColor = e.ingest > 0 ? 'rgba(255,210,63,0.9)' : 'rgba(47,213,255,0.7)';
    ctx.shadowBlur = 14;
    const body = ctx.createLinearGradient(0, y, 0, y + PADDLE_H);
    if (e.width === 'rot') {
      body.addColorStop(0, '#e4ffd6'); body.addColorStop(0.4, '#9fc48f'); body.addColorStop(0.6, '#55704a'); body.addColorStop(1, '#a9cf99');
    } else {
      body.addColorStop(0, '#ffffff'); body.addColorStop(0.38, '#c9d4e3'); body.addColorStop(0.55, '#6f7f97'); body.addColorStop(1, '#dbe5f1');
    }
    roundRect(ctx, x, y, p.w, PADDLE_H, PADDLE_H / 2);
    ctx.fillStyle = body;
    ctx.fill();
    ctx.restore();
    // glowing end caps
    for (const side of [0, 1]) {
      const cx = side ? x + p.w - 9 : x + 9;
      const grd = ctx.createRadialGradient(cx, y + PADDLE_H / 2, 1, cx, y + PADDLE_H / 2, 9);
      const col = e.scan > 0 ? '255,138,43' : '47,213,255';
      grd.addColorStop(0, `rgba(${col},1)`);
      grd.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = grd;
      ctx.fillRect(cx - 9, y, 18, PADDLE_H);
    }
    if (e.scan > 0) {
      ctx.fillStyle = '#ff8a2b';
      ctx.fillRect(x + 6, y - 5, 4, 6);
      ctx.fillRect(x + p.w - 10, y - 5, 4, 6);
    }
    if (e.ingest > 0) {
      ctx.fillStyle = 'rgba(255,210,63,0.9)';
      ctx.fillRect(x + 8, y - 1, p.w - 16, 2);
    }
    ctx.strokeStyle = 'rgba(20,30,50,0.6)';
    ctx.lineWidth = 1;
    roundRect(ctx, x + 0.5, y + 0.5, p.w - 1, PADDLE_H - 1, PADDLE_H / 2);
    ctx.stroke();
  }

  drawBalls(g) {
    const ctx = this.ctx;
    const crawl = g.effects.crawl > 0;
    const hidden = g.effects.linkrot > 0;
    const color = crawl ? '255,120,60' : '47,213,255';
    for (const b of g.balls) {
      if (hidden) {
        if ((g.t % 1) > 0.08) continue; // link rot: the ball only flickers into view
      }
      // trail of bits
      const tr = b.trail;
      if (!b.stuck && tr.length >= 4) {
        ctx.font = `8px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const n = tr.length / 2;
        for (let i = 0; i < n - 1; i += 3) {
          const a = (i / n) * 0.75;
          const tx = tr[i * 2], ty = tr[i * 2 + 1];
          const bit = (Math.floor(tx / 9) + Math.floor(ty / 7)) & 1 ? '1' : '0';
          ctx.fillStyle = `rgba(${color},${a.toFixed(3)})`;
          ctx.fillText(bit, tx, ty);
        }
      }
      ctx.save();
      ctx.shadowColor = `rgba(${color},1)`;
      ctx.shadowBlur = 14;
      const grd = ctx.createRadialGradient(b.x - 2, b.y - 2, 1, b.x, b.y, BALL_R);
      grd.addColorStop(0, '#ffffff');
      grd.addColorStop(0.55, crawl ? '#ffd0a0' : '#c8f4ff');
      grd.addColorStop(1, `rgb(${color})`);
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(b.x, b.y, BALL_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  drawPills(g) {
    const ctx = this.ctx;
    for (const p of g.pills) {
      const x = p.x - p.w / 2;
      const y = p.y - p.h / 2;
      if (p.file) {
        const page = this.pages.find((q) => q.id === p.file);
        const pulse = 0.6 + 0.4 * Math.sin(p.t * 8);
        ctx.save();
        ctx.shadowColor = `rgba(255,210,63,${pulse.toFixed(3)})`;
        ctx.shadowBlur = 16;
        drawPillShape(ctx, x, y, p.w, p.h, GOLD);
        ctx.restore();
        // shimmer
        ctx.save();
        roundRect(ctx, x, y, p.w, p.h, p.h / 2);
        ctx.clip();
        const sx = x + ((p.t * 90) % (p.w + 40)) - 20;
        const sg = ctx.createLinearGradient(sx - 12, 0, sx + 12, 0);
        sg.addColorStop(0, 'rgba(255,255,255,0)');
        sg.addColorStop(0.5, 'rgba(255,255,255,0.7)');
        sg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = sg;
        ctx.fillRect(x, y, p.w, p.h);
        ctx.restore();
        drawDocIcon(ctx, x + 7, y + 3, 10, p.h - 6);
        text(ctx, page ? page.pill : 'FILE', x + p.w / 2 + 6, p.y + 0.5, 8, '#3a2400');
        if (Math.sin(p.t * 5) > 0) drawSparkle(ctx, x + p.w - 6, y + 2, 4, '#ffffff');
      } else {
        const def = POWERUPS[p.kind];
        const col = def.good ? def.color : '#ff4a5e';
        drawPillShape(ctx, x, y, p.w, p.h, col);
        const dark = !def.good || isDark(col);
        text(ctx, def.label, p.x, p.y + 0.5, 8, dark ? '#ffffff' : '#08122a');
      }
    }
  }

  drawLasers(g) {
    const ctx = this.ctx;
    ctx.save();
    ctx.shadowColor = '#ff8a2b';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#ffd7a8';
    for (const z of g.lasers) ctx.fillRect(z.x - 1, z.y - 10, 2, 12);
    ctx.restore();
  }

  drawParticles(g) {
    const ctx = this.ctx;
    for (const q of g.fx.particles) {
      ctx.globalAlpha = Math.max(0, Math.min(1, q.life / 0.5));
      ctx.fillStyle = q.color;
      ctx.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size);
    }
    ctx.globalAlpha = 1;
  }

  drawFlares(g) {
    if (this.reducedMotion) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const f of g.fx.flares) {
      const k = f.t / f.life;
      const a = (1 - k) * 0.9;
      const r = 20 + 90 * k;
      const grd = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r);
      grd.addColorStop(0, hexA(f.color, a));
      grd.addColorStop(1, hexA(f.color, 0));
      ctx.fillStyle = grd;
      ctx.fillRect(f.x - r, f.y - r, r * 2, r * 2);
      // horizontal lens streak
      const sg = ctx.createLinearGradient(f.x - 160, 0, f.x + 160, 0);
      sg.addColorStop(0, 'rgba(255,255,255,0)');
      sg.addColorStop(0.5, `rgba(255,255,255,${(a * 0.7).toFixed(3)})`);
      sg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = sg;
      ctx.fillRect(f.x - 160, f.y - 1.5, 320, 3);
    }
    ctx.restore();
  }

  drawTexts(g) {
    const ctx = this.ctx;
    for (const q of g.fx.texts) {
      const a = Math.min(1, (q.life - q.t) / 0.4);
      ctx.globalAlpha = Math.max(0, a);
      text(ctx, q.str, q.x, q.y, 8, q.color, 'center', true);
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
    d.fillStyle = 'rgba(0,2,10,0.9)';
    d.fillRect(FIELD.x, FIELD.y, FIELD.w, FIELD.h);
    d.globalCompositeOperation = 'destination-out';
    const lights = g.balls.map((b) => [b.x, b.y, 125]);
    lights.push([g.paddle.x, PADDLE_Y, 95]);
    for (const p of g.pills) lights.push([p.x, p.y, 40]);
    for (const [x, y, r] of lights) {
      const grd = d.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, 'rgba(0,0,0,1)');
      grd.addColorStop(0.6, 'rgba(0,0,0,0.75)');
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
        const y = y0 - i * 11;
        if (y < FIELD.y || y > H) continue;
        ctx.fillStyle = `rgba(47,213,255,${(0.22 * (1 - i / col.bits.length)).toFixed(3)})`;
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
    text(ctx, String(g.score).padStart(7, '0'), 24, 25, 12, CYAN, 'left', true);
    label(ctx, 'HI', 148, 11);
    text(ctx, String(Math.max(g.hi, g.score)).padStart(7, '0'), 148, 25, 12, '#9fe8ff', 'left');
    label(ctx, 'LEVEL', 400, 11, 'center');
    const lvl = g.mode === 'title' ? '-- / 12' : `${String(g.levelIndex + 1).padStart(2, '0')} / 12`;
    text(ctx, lvl, 400, 25, 12, '#ffffff', 'center', true);
    label(ctx, 'LIVES', 488, 11);
    const lives = g.mode === 'title' ? C.START_LIVES : g.lives;
    for (let i = 0; i < Math.min(lives, 7); i++) drawMiniPaddle(ctx, 488 + i * 16, 21);
    label(ctx, 'FILES', 604, 11);
    this.pages.forEach((p, i) => {
      const x = 604 + i * 46;
      const on = g.found.has(p.id);
      drawDocIcon(ctx, x, 17, 8, 11, on ? GOLD : 'rgba(150,170,200,0.25)', on);
      text(ctx, p.hud, x + 11, 23, 8, on ? '#ffe27a' : 'rgba(150,170,200,0.4)', 'left');
    });
  }

  dim(a = 0.6) {
    this.ctx.fillStyle = `rgba(2,6,20,${a})`;
    this.ctx.fillRect(FIELD.x, FIELD.y, FIELD.w, FIELD.h);
  }

  drawTitle(g) {
    const ctx = this.ctx;
    this.dim(0.35);
    const bob = this.reducedMotion ? 0 : Math.sin(g.t * 1.6) * 3;
    chromeText(ctx, 'BITSTREAM', W / 2, 178 + bob, 66);
    text(ctx, 'A   D I G I T A L   P R E S E R V A T I O N   B R I C K - B R E A K E R', W / 2, 232, 8, CYAN, 'center');
    text(ctx, '4 FILES ARE HIDDEN IN THE BRICKS. RECOVER THEM.', W / 2, 272, 10, '#ffe27a', 'center', true);
    if (blink(g.t)) text(ctx, 'PRESS W / UP OR CLICK TO START', W / 2, 340, 12, '#ffffff', 'center', true);
    if (g.maxLevel > 1) text(ctx, `PRESS C TO CONTINUE FROM LEVEL ${String(g.maxLevel).padStart(2, '0')}`, W / 2, 368, 10, '#9fe8ff', 'center');
    const rows = [
      ['ARROWS / A D', 'MOVE'],
      ['W / UP / CLICK', 'LAUNCH + FIRE'],
      ['SPACE', 'PAUSE'],
      ['M', 'SOUND ON/OFF'],
    ];
    panel(ctx, 250, 412, 300, 104);
    rows.forEach(([k, v], i) => {
      text(ctx, k, 390, 432 + i * 22, 8, CYAN, 'right');
      text(ctx, v, 410, 432 + i * 22, 8, '#ffffff', 'left');
    });
  }

  drawBanner(g, b) {
    const ctx = this.ctx;
    const fadeIn = Math.min(1, b.t / 0.2);
    const fadeOut = Math.min(1, (b.life - b.t) / 0.35);
    ctx.globalAlpha = Math.max(0, Math.min(fadeIn, fadeOut));
    if (b.kind === 'level') {
      const y = 360;
      panel(ctx, 140, y - 50, 520, 100);
      text(ctx, b.title, W / 2, y - 24, 12, CYAN, 'center', true);
      chromeText(ctx, b.sub, W / 2, y + 10, b.sub.length > 24 ? 20 : 28);
      if (!this.reducedMotion) {
        const sx = 140 + ((b.t / b.life) * 520);
        ctx.fillStyle = 'rgba(47,213,255,0.5)';
        ctx.fillRect(sx, y - 50, 2, 100);
      }
      text(ctx, 'W / UP / CLICK TO LAUNCH', W / 2, y + 38, 8, '#9fb3d6', 'center');
    } else if (b.kind === 'clear') {
      chromeText(ctx, b.title, W / 2, 330, 30);
      text(ctx, b.sub, W / 2, 372, 12, '#ffe27a', 'center', true);
    } else if (b.kind === 'life') {
      text(ctx, b.title, W / 2, 400, 16, '#ff9aa6', 'center', true);
      text(ctx, b.sub, W / 2, 426, 8, '#c9d6ee', 'center');
    } else if (b.kind === 'pill') {
      text(ctx, b.title, W / 2, 470, 10, b.color, 'center', true);
      text(ctx, b.sub, W / 2, 490, 8, '#e6eeff', 'center');
    }
    ctx.globalAlpha = 1;
  }

  drawPaused(g) {
    this.dim(g.pauseReason === 'file' ? 0.72 : 0.6);
    if (g.pauseReason === 'file') return; // the "file recovered" dialog sits on top
    chromeText(this.ctx, 'PAUSED', W / 2, 290, 44);
    if (blink(g.t)) text(this.ctx, 'PRESS SPACE TO RESUME', W / 2, 340, 12, '#ffffff', 'center', true);
  }

  drawGameOver(g) {
    const ctx = this.ctx;
    this.dim(0.7);
    chromeText(ctx, 'CHECKSUM MISMATCH', W / 2, 250, 34, true);
    text(ctx, 'GAME OVER', W / 2, 292, 12, '#ff9aa6', 'center', true);
    text(ctx, `SCORE ${g.score}`, W / 2, 332, 12, CYAN, 'center');
    if (blink(g.t)) text(ctx, `W / UP / CLICK: CONTINUE FROM LEVEL ${String(g.levelIndex + 1).padStart(2, '0')}`, W / 2, 392, 10, '#ffffff', 'center', true);
    text(ctx, '(YOUR SCORE STARTS OVER)', W / 2, 414, 8, '#9fb3d6', 'center');
  }

  drawWin(g) {
    const ctx = this.ctx;
    this.dim(0.45);
    chromeText(ctx, 'ARCHIVE PRESERVED', W / 2, 230, 38);
    text(ctx, 'ALL 12 LEVELS CLEARED. EVERY BIT ACCOUNTED FOR.', W / 2, 278, 10, '#ffe27a', 'center', true);
    text(ctx, `FINAL SCORE ${g.score}`, W / 2, 318, 14, CYAN, 'center', true);
    if (blink(g.t)) text(ctx, 'W / UP / CLICK TO PLAY AGAIN', W / 2, 390, 10, '#ffffff', 'center', true);
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
    cols.push({ x: 30 + i * 29.5 + r() * 10, speed: 30 + r() * 60, offset: r() * 800, bits: Array.from({ length: len }, () => (r() < 0.5 ? '0' : '1')) });
  }
  return cols;
}

function text(ctx, str, x, y, size, color, align = 'center', glow = false) {
  ctx.font = `${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  if (glow) {
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = size * 0.8;
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
    ctx.restore();
  } else {
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
  }
}

function label(ctx, str, x, y, align = 'left') {
  text(ctx, str, x, y, 8, 'rgba(140,170,220,0.7)', align);
}

function chromeText(ctx, str, x, y, size, red = false) {
  ctx.save();
  ctx.font = `700 ${size}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const g = ctx.createLinearGradient(0, y - size / 2, 0, y + size / 2);
  if (red) {
    g.addColorStop(0, '#ffe3e6'); g.addColorStop(0.45, '#ff9aa6'); g.addColorStop(0.5, '#8a1020'); g.addColorStop(0.65, '#ff6b7a'); g.addColorStop(1, '#ffe3e6');
  } else {
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.45, '#cfd9e6'); g.addColorStop(0.5, '#56667e'); g.addColorStop(0.66, '#aebbd0'); g.addColorStop(1, '#ffffff');
  }
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(3, size / 7);
  ctx.strokeStyle = '#06122e';
  ctx.strokeText(str, x, y);
  ctx.shadowColor = red ? 'rgba(255,74,94,0.9)' : 'rgba(47,213,255,0.9)';
  ctx.shadowBlur = size / 2.5;
  ctx.fillStyle = g;
  ctx.fillText(str, x, y);
  ctx.restore();
}

function panel(ctx, x, y, w, h) {
  ctx.save();
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, 'rgba(14,32,74,0.85)');
  g.addColorStop(1, 'rgba(4,10,28,0.85)');
  ctx.fillStyle = g;
  roundRect(ctx, x, y, w, h, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(47,213,255,0.55)';
  ctx.lineWidth = 1;
  roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 8);
  ctx.stroke();
  // corner brackets
  ctx.strokeStyle = 'rgba(160,230,255,0.9)';
  ctx.lineWidth = 2;
  for (const [cx, cy, sx, sy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]]) {
    ctx.beginPath();
    ctx.moveTo(cx + sx * 12, cy);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx, cy + sy * 12);
    ctx.stroke();
  }
  ctx.restore();
}

export function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
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
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0a1f4d');
  g.addColorStop(0.55, '#040c24');
  g.addColorStop(1, '#01040f');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // perspective grid floor
  const horizon = 340;
  ctx.strokeStyle = 'rgba(47,213,255,0.13)';
  ctx.lineWidth = 1;
  for (let i = -16; i <= 16; i++) {
    ctx.beginPath();
    ctx.moveTo(W / 2 + i * 12, horizon);
    ctx.lineTo(W / 2 + i * 110, H);
    ctx.stroke();
  }
  for (let k = 1; k <= 10; k++) {
    const y = horizon + (H - horizon) * (k / 10) ** 1.8;
    ctx.globalAlpha = 0.4 + k * 0.06;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // faint dots
  let seed = 3;
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 70; i++) {
    ctx.fillStyle = `rgba(160,220,255,${(0.08 + r() * 0.25).toFixed(3)})`;
    ctx.fillRect(r() * W, HUD_H + r() * 290, 1.5, 1.5);
  }
  // HUD glass
  const hg = ctx.createLinearGradient(0, 0, 0, HUD_H);
  hg.addColorStop(0, '#13285a');
  hg.addColorStop(1, '#050c22');
  ctx.fillStyle = hg;
  ctx.fillRect(0, 0, W, HUD_H);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(0, 0, W, HUD_H / 2);
}

function drawWallsSprite(ctx) {
  const side = (x0) => {
    const g = ctx.createLinearGradient(x0, 0, x0 + C.WALL, 0);
    g.addColorStop(0, '#3a4659'); g.addColorStop(0.35, '#e9eff7'); g.addColorStop(0.6, '#8e9bb0'); g.addColorStop(1, '#465266');
    ctx.fillStyle = g;
    ctx.fillRect(x0, HUD_H, C.WALL, H - HUD_H);
  };
  side(0);
  side(W - C.WALL);
  const t = ctx.createLinearGradient(0, HUD_H, 0, FIELD.y);
  t.addColorStop(0, '#465266'); t.addColorStop(0.4, '#e9eff7'); t.addColorStop(1, '#5d6a80');
  ctx.fillStyle = t;
  ctx.fillRect(0, HUD_H, W, FIELD.y - HUD_H);
  // cyan inner edge
  ctx.fillStyle = 'rgba(47,213,255,0.85)';
  ctx.fillRect(FIELD.x - 1, FIELD.y, 1, H - FIELD.y);
  ctx.fillRect(FIELD.x + FIELD.w, FIELD.y, 1, H - FIELD.y);
  ctx.fillRect(FIELD.x - 1, FIELD.y - 1, FIELD.w + 2, 1);
  // rivets
  ctx.fillStyle = 'rgba(30,40,60,0.6)';
  for (let y = HUD_H + 40; y < H; y += 60) {
    ctx.fillRect(5, y, 4, 4);
    ctx.fillRect(W - 9, y, 4, 4);
  }
  ctx.fillStyle = 'rgba(47,213,255,0.9)';
  ctx.fillRect(0, HUD_H - 1, W, 1);
}

function drawScanlines(ctx) {
  ctx.fillStyle = 'rgba(0,0,0,0.10)';
  for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
}

function drawBrickSprite(ctx, w, h, color, br) {
  const x = 1.5, y = 1.5, bw = w - 3, bh = h - 3;
  const r = Math.min(4, bh / 3);
  if (br.steel) {
    const g = ctx.createLinearGradient(0, y, 0, y + bh);
    g.addColorStop(0, '#f6f9fc'); g.addColorStop(0.45, '#a7b3c3'); g.addColorStop(0.55, '#6b788b'); g.addColorStop(1, '#cdd6e1');
    roundRect(ctx, x, y, bw, bh, r);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = '#2f3846';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#4a5466';
    if (bw > 14) {
      ctx.beginPath(); ctx.arc(x + 4, y + bh / 2, 1.6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + bw - 4, y + bh / 2, 1.6, 0, Math.PI * 2); ctx.fill();
    }
    return;
  }
  const base = br.bad ? '#6a0c18' : color;
  const g = ctx.createLinearGradient(0, y, 0, y + bh);
  g.addColorStop(0, lighten(base, 0.4));
  g.addColorStop(0.5, base);
  g.addColorStop(1, darken(base, 0.45));
  roundRect(ctx, x, y, bw, bh, r);
  ctx.fillStyle = g;
  ctx.fill();
  if (br.bad) {
    ctx.save();
    roundRect(ctx, x, y, bw, bh, r);
    ctx.clip();
    ctx.strokeStyle = 'rgba(255,60,80,0.55)';
    ctx.lineWidth = 2;
    for (let k = -bh; k < bw; k += 7) {
      ctx.beginPath();
      ctx.moveTo(x + k, y + bh);
      ctx.lineTo(x + k + bh, y);
      ctx.stroke();
    }
    ctx.restore();
  }
  // gel highlight
  const hl = ctx.createLinearGradient(0, y, 0, y + bh * 0.5);
  hl.addColorStop(0, 'rgba(255,255,255,0.65)');
  hl.addColorStop(1, 'rgba(255,255,255,0.05)');
  roundRect(ctx, x + 2, y + 1.5, bw - 4, bh * 0.45, Math.max(1, r - 1));
  ctx.fillStyle = hl;
  ctx.fill();
  roundRect(ctx, x, y, bw, bh, r);
  ctx.strokeStyle = darken(base, 0.6);
  ctx.lineWidth = 1;
  ctx.stroke();
  if (br.mystery) {
    ctx.font = `${Math.min(16, bh - 4)}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#5a3a00';
    ctx.fillText('?', w / 2, h / 2 + 1);
  }
  if (br.bad) {
    ctx.font = `${Math.min(10, bh - 6)}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffd0d6';
    ctx.fillText('ERR', w / 2, h / 2 + 1);
  }
}

function drawCracks(ctx, br) {
  const dmg = 1 - br.hp / br.maxHp;
  const n = Math.ceil(dmg * 3);
  ctx.save();
  ctx.strokeStyle = 'rgba(0,0,20,0.55)';
  ctx.lineWidth = 1.2;
  let s = br.seed + 1;
  const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < n; i++) {
    let x = br.x + br.w * (0.2 + r() * 0.6);
    let y = br.y + 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let k = 0; k < 3; k++) {
      x += (r() - 0.5) * br.w * 0.25;
      y += (br.h - 4) / 3;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawPillShape(ctx, x, y, w, h, color) {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, lighten(color, 0.55));
  g.addColorStop(0.5, color);
  g.addColorStop(1, darken(color, 0.45));
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = g;
  ctx.fill();
  const hl = ctx.createLinearGradient(0, y, 0, y + h * 0.5);
  hl.addColorStop(0, 'rgba(255,255,255,0.75)');
  hl.addColorStop(1, 'rgba(255,255,255,0.05)');
  roundRect(ctx, x + 4, y + 1.5, w - 8, h * 0.42, h / 4);
  ctx.fillStyle = hl;
  ctx.fill();
  roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, h / 2);
  ctx.strokeStyle = darken(color, 0.6);
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawDocIcon(ctx, x, y, w, h, color = '#ffffff', glow = false) {
  ctx.save();
  if (glow) {
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
  }
  const f = Math.min(4, w * 0.4);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w - f, y);
  ctx.lineTo(x + w, y + f);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  for (let i = 0; i < 3; i++) ctx.fillRect(x + 2, y + f + 1 + i * 2.2, w - 4, 1);
}

function drawMiniPaddle(ctx, x, y) {
  const g = ctx.createLinearGradient(0, y - 3, 0, y + 3);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.5, '#7f8ea6');
  g.addColorStop(1, '#dbe5f1');
  roundRect(ctx, x, y - 3, 13, 6, 3);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.fillStyle = CYAN;
  ctx.fillRect(x + 1, y - 1, 2, 2);
  ctx.fillRect(x + 10, y - 1, 2, 2);
}

function drawSparkle(ctx, x, y, r, color) {
  if (r <= 0) return;
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r * 0.25, y - r * 0.25);
  ctx.lineTo(x + r, y);
  ctx.lineTo(x + r * 0.25, y + r * 0.25);
  ctx.lineTo(x, y + r);
  ctx.lineTo(x - r * 0.25, y + r * 0.25);
  ctx.lineTo(x - r, y);
  ctx.lineTo(x - r * 0.25, y - r * 0.25);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
