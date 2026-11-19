// Synthesized sound effects (no audio files). Browsers only allow sound after the
// visitor presses a key or clicks, so unlock() is called from those events.
export class Sound {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
    this.lastBrick = 0;
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.enabled ? 0.22 : 0;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setEnabled(on) {
    this.enabled = on;
    if (this.master) this.master.gain.setTargetAtTime(on ? 0.22 : 0, this.ctx.currentTime, 0.02);
  }

  tone(freq, dur, type = 'square', vol = 0.5, when = 0, slideTo = null) {
    const c = this.ctx;
    const t = c.currentTime + when;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.03);
  }

  noise(dur, vol = 0.5, cutoff = 1200) {
    const c = this.ctx;
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    const g = c.createGain();
    g.gain.value = vol;
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start();
  }

  play(name, d = {}) {
    if (!this.ctx || !this.enabled || this.ctx.state !== 'running') return;
    const seq = (notes, step, type = 'square', vol = 0.28, dur = 0.1) => notes.forEach((f, i) => this.tone(f, dur, type, vol, i * step));
    switch (name) {
      case 'paddle': this.tone(330, 0.07, 'square', 0.32, 0, 470); break;
      case 'wall': this.tone(170, 0.03, 'square', 0.1); break;
      case 'brick': {
        const now = this.ctx.currentTime;
        if (now - this.lastBrick < 0.025) return;
        this.lastBrick = now;
        this.tone(560 + (10 - Math.min(10, d.row || 0)) * 45, 0.06, 'triangle', 0.45);
        break;
      }
      case 'tough': this.tone(190 + (d.hp || 1) * 45, 0.05, 'square', 0.26); break;
      case 'steel': this.tone(1400, 0.04, 'square', 0.12); this.tone(1870, 0.05, 'square', 0.08); break;
      case 'launch': this.tone(440, 0.08, 'square', 0.26, 0, 880); break;
      case 'pill': seq([660, 880, 1100], 0.06, 'square', 0.26, 0.07); break;
      case 'bad': this.tone(300, 0.28, 'sawtooth', 0.28, 0, 80); break;
      case 'detect': seq([880, 1320], 0.07, 'triangle', 0.4, 0.09); break;
      case 'file': seq([523, 659, 784, 1047, 1319], 0.08, 'square', 0.26, 0.12); break;
      case 'laser': this.tone(1300, 0.06, 'square', 0.14, 0, 450); break;
      case 'boom': this.noise(0.35, 0.7, 900); break;
      case 'net': this.tone(220, 0.22, 'triangle', 0.4, 0, 660); break;
      case 'lose': this.tone(440, 0.65, 'sawtooth', 0.26, 0, 55); break;
      case 'clear': seq([523, 659, 784, 1047, 784, 1047, 1319], 0.09); break;
      case 'gameover': seq([392, 330, 262, 196], 0.22, 'triangle', 0.4, 0.26); break;
      case 'win': seq([523, 659, 784, 1047, 1319, 1568, 2093], 0.11, 'square', 0.26, 0.16); break;
      case 'pause': this.tone(660, 0.05, 'square', 0.18); this.tone(440, 0.06, 'square', 0.18, 0.06); break;
    }
  }
}
