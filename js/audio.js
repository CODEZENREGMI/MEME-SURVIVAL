/* ==========================================================================
   audio.js — tiny WebAudio synth for SFX + ambient music loop
   ========================================================================== */
const Audio8 = {
  ctx: null, sfxGain: null, musicGain: null, sfxVol: 0.7, musicVol: 0.4, musicOn: false, _noise: null,

  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.sfxGain = this.ctx.createGain(); this.sfxGain.gain.value = this.sfxVol; this.sfxGain.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain(); this.musicGain.gain.value = this.musicVol; this.musicGain.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 1;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this._noise = buf;
    } catch (e) { console.warn('audio unavailable', e); }
  },
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
  setSfx(v) { this.sfxVol = v; if (this.sfxGain) this.sfxGain.gain.value = v; },
  setMusic(v) { this.musicVol = v; if (this.musicGain) this.musicGain.gain.value = this.track ? v * 0.2 : v; if (this.track) this.track.volume = Math.min(1, v * 1.6 + 0.1); },

  tone(freq, dur, type = 'square', vol = 0.3, slide = 0, delay = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.sfxGain); o.start(t); o.stop(t + dur + 0.02);
  },
  noise(dur, vol = 0.3, filterFreq = 1200, delay = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const s = this.ctx.createBufferSource(); s.buffer = this._noise;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filterFreq;
    const g = this.ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.sfxGain); s.start(t); s.stop(t + dur + 0.02);
  },

  play(name) {
    if (!this.ctx) return;
    switch (name) {
      case 'pistol':  this.noise(0.08, 0.35, 2200); this.tone(320, 0.08, 'square', 0.15, -200); break;
      case 'shotgun': this.noise(0.22, 0.6, 900); this.tone(120, 0.18, 'sawtooth', 0.25, -80); break;
      case 'smg':     this.noise(0.05, 0.25, 2600); this.tone(420, 0.05, 'square', 0.1, -250); break;
      case 'rifle':   this.noise(0.16, 0.5, 1600); this.tone(200, 0.16, 'sawtooth', 0.2, -150); break;
      case 'magnum':  this.noise(0.14, 0.55, 1400); this.tone(180, 0.14, 'sawtooth', 0.25, -120); break;
      case 'flame':   this.noise(0.18, 0.12, 700); break;
      case 'cannon':  this.noise(0.3, 0.7, 500); this.tone(70, 0.35, 'sine', 0.5, -30); this.tone(140, 0.12, 'sawtooth', 0.2, -60); break;
      case 'roar':    this.tone(90, 0.9, 'sawtooth', 0.3, -40); this.tone(135, 0.8, 'square', 0.12, -50, 0.05); this.noise(0.7, 0.25, 900); break;
      case 'thud':    this.noise(0.25, 0.6, 300); this.tone(50, 0.3, 'sine', 0.6, -20); break;
      case 'rocket':  this.noise(0.4, 0.5, 700); this.tone(90, 0.4, 'sawtooth', 0.3, 60); break;
      case 'explode': this.noise(0.6, 0.8, 500); this.tone(60, 0.5, 'sine', 0.5, -40); break;
      case 'hit':     this.noise(0.06, 0.2, 800); break;
      case 'zdie':    this.tone(180 + Math.random() * 60, 0.25, 'sawtooth', 0.15, -120); this.noise(0.15, 0.2, 600); break;
      case 'growl':   this.tone(70 + Math.random() * 40, 0.35, 'sawtooth', 0.08, 30); break;
      case 'moan':    { const f = 140 + Math.random() * 80; this.tone(f, 1.2, 'sawtooth', 0.09, -60); this.tone(f * 1.5, 1.0, 'triangle', 0.05, -90, 0.1); this.noise(0.8, 0.05, 400, 0.2); } break;
      case 'scream':  { const f = 600 + Math.random() * 300; this.tone(f, 0.7, 'sawtooth', 0.12, -350); this.tone(f * 1.02, 0.7, 'square', 0.06, -380); } break;
      case 'flicker': this.noise(0.04, 0.08, 3000); break;
      case 'hurt':    this.tone(220, 0.2, 'square', 0.25, -120); this.noise(0.12, 0.25, 600); break;
      case 'reload':  this.tone(600, 0.05, 'square', 0.12); this.tone(400, 0.05, 'square', 0.12, 0, 0.12); break;
      case 'reloaded':this.tone(700, 0.06, 'square', 0.15); this.tone(1000, 0.08, 'square', 0.15, 0, 0.07); break;
      case 'empty':   this.tone(300, 0.05, 'square', 0.1); break;
      case 'coin':    this.tone(1100, 0.08, 'square', 0.15); this.tone(1600, 0.12, 'square', 0.15, 0, 0.07); break;
      case 'xp':      this.tone(800, 0.06, 'triangle', 0.15); this.tone(1200, 0.1, 'triangle', 0.15, 0, 0.06); break;
      case 'health':  this.tone(500, 0.1, 'triangle', 0.2); this.tone(750, 0.1, 'triangle', 0.2, 0, 0.1); this.tone(1000, 0.15, 'triangle', 0.2, 0, 0.2); break;
      case 'ammo':    this.tone(350, 0.06, 'square', 0.15); this.tone(500, 0.08, 'square', 0.15, 0, 0.07); break;
      case 'weapon':  [440, 554, 659, 880].forEach((f, i) => this.tone(f, 0.15, 'square', 0.15, 0, i * 0.08)); break;
      case 'levelup': [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.2, 'square', 0.18, 0, i * 0.1)); break;
      case 'wave':    this.tone(150, 0.5, 'sawtooth', 0.25, -60); this.tone(110, 0.6, 'sawtooth', 0.2, 0, 0.3); break;
      case 'gameover':[392, 349, 311, 262].forEach((f, i) => this.tone(f, 0.45, 'sawtooth', 0.2, 0, i * 0.35)); break;
      case 'click':   this.tone(900, 0.03, 'square', 0.08); break;
      case 'swap':    this.tone(500, 0.04, 'square', 0.1); this.tone(700, 0.05, 'square', 0.1, 0, 0.05); break;
    }
  },

  /* decoded one-shot clips: fetched and decoded ahead of time so they fire on the exact frame, no load delay */
  _clips: {},
  preloadClip(url) {
    if (this._clips[url]) return;
    const rec = this._clips[url] = { buf: null, el: null };
    fetch(url).then(r => r.ok ? r.arrayBuffer() : Promise.reject(r.status))
      .then(ab => { if (!this.ctx) return Promise.reject('no ctx'); return this.ctx.decodeAudioData(ab); })
      .then(buf => { rec.buf = buf; })
      .catch(() => { try { const a = new window.Audio(url); a.preload = 'auto'; a.load(); rec.el = a; } catch (e) { } }); // fall back to a preloaded <audio>
  },
  _loops: new Set(),
  playClip(url, vol = 1, opts) {
    const loop = !!(opts && opts.loop), rec = this._clips[url];
    if (rec && rec.buf && this.ctx) {
      try {
        this.resume();
        const src = this.ctx.createBufferSource(); src.buffer = rec.buf; src.loop = loop;
        const g = this.ctx.createGain(); g.gain.value = vol;
        src.connect(g); g.connect(this.ctx.destination); src.start(); // straight to the output: these aren't SFX you mix down
        const h = { src, g, vol };
        if (loop) this._loops.add(h); else this._clipSrc = src;
        return h;
      } catch (e) { }
    }
    if (loop) { // not decoded yet: a looping <audio> element does the same job
      try { const a = new window.Audio(url); a.loop = true; a.volume = vol; a.play().catch(() => {}); const h = { el: a, vol }; this._loops.add(h); return h; } catch (e) { return null; }
    }
    if (rec && rec.el) { try { const a = rec.el; a.currentTime = 0; a.volume = vol; a.play().catch(() => {}); return true; } catch (e) { } }
    this.playTrack(url, 0, { once: true, loud: true }); return false; // last resort: the streaming path
  },
  /* stop one looping clip, optionally fading it out */
  stopHandle(h, fade = 0) {
    if (!h) return; this._loops.delete(h);
    try {
      if (h.src) {
        if (fade && this.ctx) { const t = this.ctx.currentTime; h.g.gain.cancelScheduledValues(t); h.g.gain.setValueAtTime(h.g.gain.value, t); h.g.gain.linearRampToValueAtTime(0, t + fade); h.src.stop(t + fade + 0.02); }
        else h.src.stop();
      }
      if (h.el) {
        if (fade) { let v = h.el.volume; const iv = setInterval(() => { v -= 0.1; if (v <= 0) { clearInterval(iv); h.el.pause(); } else h.el.volume = v; }, fade * 100); }
        else h.el.pause();
      }
    } catch (e) { }
  },
  stopAllLoops() { for (const h of [...this._loops]) this.stopHandle(h); },
  /* silence loops while the game is paused (the ability timer is frozen too), bring them back after */
  muteLoops(on) {
    if (this._loopsMuted === on) return; this._loopsMuted = on;
    for (const h of this._loops) {
      try { if (h.g && this.ctx) { h.g.gain.cancelScheduledValues(this.ctx.currentTime); h.g.gain.value = on ? 0 : h.vol; } if (h.el) h.el.volume = on ? 0 : h.vol; } catch (e) { }
    }
  },
  stopClip() { try { if (this._clipSrc) { this._clipSrc.stop(); this._clipSrc = null; } } catch (e) { this._clipSrc = null; } },
  /* play an mp3 track (character theme); ducks the ambient drone while it runs */
  playTrack(url, seconds, opts) {
    this.stopTrack();
    try {
      const a = new window.Audio(url); a.volume = opts && opts.loud ? 1 : Math.min(1, this.musicVol * 1.6 + 0.1); a.loop = !(opts && opts.once); this.track = a;
      if (this.musicGain) this.musicGain.gain.value = this.musicVol * 0.2;
      a.play().catch(() => {});
      if (seconds) this._trackTimer = setTimeout(() => this.stopTrack(), seconds * 1000);
    } catch (e) { }
  },
  stopTrack() {
    clearTimeout(this._trackTimer);
    if (this.track) { const a = this.track; this.track = null; let v = a.volume; const fade = setInterval(() => { v -= 0.08; if (v <= 0) { clearInterval(fade); a.pause(); } else a.volume = v; }, 60); }
    if (this.musicGain) this.musicGain.gain.value = this.musicVol;
  },
  /* ambient music: slow pulsing minor drone */
  startMusic(dark) {
    if (!this.ctx || this.musicOn) return;
    this.musicOn = true; this.dark = !!dark;
    const notes = dark ? [36.7, 38.9, 36.7, 34.6] : [55, 65.4, 58.3, 49];
    let i = 0;
    const step = () => {
      if (!this.musicOn) return;
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator(), o2 = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = 'sawtooth'; o2.type = 'triangle';
      o.frequency.value = notes[i % notes.length]; o2.frequency.value = notes[i % notes.length] * 2.01;
      const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = this.dark ? 180 : 260;
      if (this.dark) { o2.frequency.value = notes[i % notes.length] * 2.06; const w = this.ctx.createBufferSource(); w.buffer = this._noise; const wf = this.ctx.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 900 + Math.random() * 600; wf.Q.value = 6; const wg = this.ctx.createGain(); wg.gain.setValueAtTime(0.0001, t); wg.gain.exponentialRampToValueAtTime(0.06, t + 1.5); wg.gain.exponentialRampToValueAtTime(0.0001, t + 3.8); w.connect(wf); wf.connect(wg); wg.connect(this.musicGain); w.start(t); w.stop(t + 4); }
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.35, t + 0.8); g.gain.exponentialRampToValueAtTime(0.0001, t + 3.9);
      o.connect(f); o2.connect(f); f.connect(g); g.connect(this.musicGain);
      o.start(t); o2.start(t); o.stop(t + 4); o2.stop(t + 4);
      // heartbeat pulse
      for (let k = 0; k < 2; k++) { const p = this.ctx.createOscillator(), pg = this.ctx.createGain(); p.type = 'sine'; p.frequency.value = 50;
        pg.gain.setValueAtTime(0.5, t + k * 0.35); pg.gain.exponentialRampToValueAtTime(0.001, t + k * 0.35 + 0.25); p.connect(pg); pg.connect(this.musicGain); p.start(t + k * 0.35); p.stop(t + k * 0.35 + 0.3); }
      i++;
      this._musicTimer = setTimeout(step, 4000);
    };
    step();
  },
  stopMusic() { this.musicOn = false; clearTimeout(this._musicTimer); },
};
