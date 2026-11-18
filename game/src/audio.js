'use strict';
/* Procedural WebAudio: no audio files. Engine hum, siren, gunshot, punch,
   pickup chime, mission jingle, crash thud and a light bass-line loop. */

const AudioSys = {
  ctx: null, master: null, engineOsc: null, engineGain: null, musicTimer: null, musicStep: 0,
  muted: false,
  init() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
      // Engine: sawtooth + lowpass, pitch follows speed.
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      const filt = this.ctx.createBiquadFilter();
      filt.type = 'lowpass'; filt.frequency.value = 420;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(filt); filt.connect(this.engineGain); this.engineGain.connect(this.master);
      this.engineOsc.start();
      this.startMusic();
    } catch (e) { /* audio unavailable: game still plays */ }
  },
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
  setEngine(speed01, on) {
    if (!this.ctx) return;
    this.engineGain.gain.setTargetAtTime(on ? 0.05 + speed01 * 0.05 : 0, this.ctx.currentTime, 0.1);
    this.engineOsc.frequency.setTargetAtTime(55 + speed01 * 110, this.ctx.currentTime, 0.08);
  },
  blip(freq, dur, type, vol, slideTo) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  },
  noise(dur, vol, freq) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'lowpass'; filt.frequency.value = freq || 1200;
    const g = this.ctx.createGain(); g.gain.value = vol || 0.3;
    src.connect(filt); filt.connect(g); g.connect(this.master);
    src.start(t);
  },
  gunshot() { this.noise(0.14, 0.5, 2600); this.blip(140, 0.1, 'square', 0.25, 60); },
  punch() { this.noise(0.08, 0.3, 500); },
  pickup() { this.blip(660, 0.09, 'sine', 0.22); setTimeout(() => this.blip(990, 0.12, 'sine', 0.22), 80); },
  crash() { this.noise(0.25, 0.4, 700); },
  siren() { this.blip(720, 0.22, 'sine', 0.1, 950); setTimeout(() => this.blip(950, 0.22, 'sine', 0.1, 720), 230); },
  missionDone() {
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.blip(f, 0.22, 'triangle', 0.25), i * 110));
  },
  busted() { [392, 330, 262].forEach((f, i) => setTimeout(() => this.blip(f, 0.3, 'triangle', 0.25), i * 160)); },
  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    // Chill sunset bassline: Am – F – C – G, one note per beat.
    const bass = [110, 87.3, 130.8, 98];
    this.musicTimer = setInterval(() => {
      if (!this.ctx || this.muted) return;
      const bar = bass[Math.floor(this.musicStep / 4) % 4];
      this.blip(bar, 0.42, 'triangle', 0.07);
      if (this.musicStep % 2 === 0) this.noise(0.03, 0.04, 6000); // hat tick
      this.musicStep++;
    }, 300);
  },
};
