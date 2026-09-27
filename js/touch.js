/* ============================================================
   touch.js — phones & tablets: twin thumb sticks, ability buttons, touch-sized view
   Left half of the screen: wherever your thumb lands becomes the move stick.
   Right half: wherever it lands becomes the aim stick — push to aim, and it fires while you hold it
   (with a little aim assist toward the zombie you're pointing at). Buttons sit in an arc in the
   bottom-right corner, built each frame from what the current character can actually do.
   Everything here only runs once the device has been touched (or reports a coarse pointer);
   keyboard + mouse play is untouched.
   ============================================================ */
const TOUCH_STICK_R = 34;   // how far (logical px) the knob travels before the base follows your thumb

class TouchControls {
  constructor(game) {
    this.g = game; this.on = false; this.move = null; this.aim = null; this.tele = null;
    this.held = new Map(); this.buttons = []; this.lastTouch = -1e9; this.aimA = 0; this.aimD = 60;
    this.coarse = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);
    const c = game.canvas, opt = { passive: false };
    c.addEventListener('touchstart', e => this.onStart(e), opt);
    c.addEventListener('touchmove', e => this.onMove(e), opt);
    c.addEventListener('touchend', e => this.onEnd(e), opt);
    c.addEventListener('touchcancel', e => this.onEnd(e), opt);
    // the first real touch anywhere (menus included) switches the game into touch mode
    window.addEventListener('touchstart', () => { this.lastTouch = performance.now(); if (!this.on) this.enable(); Audio8.init(); Audio8.resume(); }, { passive: true, capture: true });
    // a laptop with a touchscreen: moving a real mouse hands control back to it
    window.addEventListener('mousemove', e => { if (this.on && !this.coarse && performance.now() - this.lastTouch > 1500 && (e.movementX || e.movementY)) this.disable(); });
    if (this.coarse) this.enable();
  }
  enable() { this.on = true; document.documentElement.classList.add('touch'); this.g.resize(); }
  disable() { this.on = false; document.documentElement.classList.remove('touch'); this.releaseAll(); this.g.resize(); }
  releaseAll() {
    const inp = this.g.input; this.move = this.aim = this.tele = null; inp.stick = null; inp.mouseDown = false; inp.rightDown = false;
    this.held.forEach(b => b.up && b.up()); this.held.clear();
  }
  pos(t) { const r = this.g.canvas.getBoundingClientRect(); return [(t.clientX - r.left) / r.width * this.g.vw, (t.clientY - r.top) / r.height * this.g.vh]; }
  live() { const s = this.g.state; return (s === 'playing' || s === 'wavebreak') && !this.g.telePick; }

  onStart(e) {
    e.preventDefault(); this.lastTouch = performance.now();
    const g = this.g, inp = g.input;
    for (const t of e.changedTouches) {
      const [x, y] = this.pos(t), id = t.identifier;
      if (g.telePick) { this.tele = id; inp.mouseX = x; inp.mouseY = y; continue; }   // Runner's teleport map: drag to aim, let go to jump
      if (!this.live()) continue;
      const b = this.hit(x, y);
      if (b) { this.held.set(id, b); b.pressed = true; if (b.down) b.down(); if (navigator.vibrate) try { navigator.vibrate(8); } catch (_) {} continue; }
      const cr = g.cartRect; if (cr && x >= cr.x && x <= cr.x + cr.w && y >= cr.y && y <= cr.y + cr.h) { g.openShop(); continue; }
      if (x < g.vw * 0.45) { if (!this.move) this.move = { id, ox: x, oy: y, x, y }; }
      else if (!this.aim) this.aim = { id, ox: x, oy: y, x, y };
    }
  }
  onMove(e) {
    e.preventDefault();
    const inp = this.g.input;
    for (const t of e.changedTouches) {
      const [x, y] = this.pos(t), id = t.identifier;
      if (this.tele === id) { inp.mouseX = x; inp.mouseY = y; }
      for (const s of [this.move, this.aim]) if (s && s.id === id) {
        s.x = x; s.y = y; const dx = x - s.ox, dy = y - s.oy, d = Math.hypot(dx, dy);
        if (d > TOUCH_STICK_R) { s.ox = x - dx / d * TOUCH_STICK_R; s.oy = y - dy / d * TOUCH_STICK_R; }   // the base trails your thumb
      }
    }
  }
  onEnd(e) {
    e.preventDefault();
    const g = this.g, inp = g.input;
    for (const t of e.changedTouches) {
      const id = t.identifier;
      if (this.tele === id) { this.tele = null; if (g.telePick) { if (g.telePickTarget()) g.pickTeleport(); else g.closeTelePick(); } }   // let go off the map = back out
      if (this.move && this.move.id === id) { this.move = null; inp.stick = null; }
      if (this.aim && this.aim.id === id) { this.aim = null; inp.mouseDown = false; }
      const b = this.held.get(id); if (b) { this.held.delete(id); b.pressed = false; if (b.up) b.up(); }
    }
  }
  vec(s) { const dx = s.x - s.ox, dy = s.y - s.oy, d = Math.hypot(dx, dy); return d < 0.01 ? { x: 0, y: 0, m: 0 } : { x: dx / d, y: dy / d, m: Math.min(1, d / TOUCH_STICK_R) }; }
  /* a gentle pull toward the zombie closest to where you're pointing */
  assist(p, a) {
    let best = null, bs = Infinity;
    for (const z of this.g.zombies) {
      if (z.dead || z.captured > 0) continue;
      const dx = z.x - p.x, dy = z.y - p.y, d = Math.hypot(dx, dy); if (d > 280 || d < 4) continue;
      let da = Math.atan2(dy, dx) - a; da = Math.abs(Math.atan2(Math.sin(da), Math.cos(da))); if (da > 0.3) continue;
      const s = da * 300 + d; if (s < bs) { bs = s; best = z; }
    }
    return best;
  }
  /* called every game frame before the world reads the input: turns the sticks into the mouse + WASD the game already speaks */
  frame() {
    const g = this.g, p = g.player, inp = g.input; if (!p) return;
    if (!this.live()) { if (this.aim) inp.mouseDown = false; return; }
    const mv = this.move && this.vec(this.move); inp.stick = mv && mv.m > 0.2 ? mv : null;
    const av = this.aim && this.vec(this.aim);
    if (av && av.m > 0.25) {
      let a = Math.atan2(av.y, av.x), d = 40 + av.m * 150; const z = this.assist(p, a);
      if (z) { a = Math.atan2(z.y - p.y, z.x - p.x); d = Math.hypot(z.x - p.x, z.y - p.y); }
      this.aimA = a; this.aimD = d; inp.mouseDown = true;
    } else { inp.mouseDown = false; if (!this.aim && inp.stick) { this.aimA = Math.atan2(inp.stick.y, inp.stick.x); this.aimD = 60; } }   // not aiming: face where you walk
    inp.mouseX = p.x - g.cam.x + Math.cos(this.aimA) * this.aimD; inp.mouseY = p.y - g.cam.y + Math.sin(this.aimA) * this.aimD;
  }
  hit(x, y) { for (const b of this.buttons) if (Math.hypot(x - b.x, y - b.y) <= b.r + 4) return b; return null; }
  /* the buttons this character has right now */
  layout() {
    const g = this.g, p = g.player, inp = g.input, W = g.vw, H = g.vh, B = [];
    const keep = id => { const o = this.buttons.find(b => b.id === id); return o ? o.pressed : false; };
    const add = b => { b.pressed = keep(b.id); B.push(b); };
    const ca = p.charAbility(); if (ca) add({ id: 'a1', x: W - 38, y: H - 40, r: 22, label: ca.name, st: ca, col: '#8bd35a', down: () => p.useCharAbility() });
    const ca2 = p.charAbility2(); if (ca2) add({ id: 'a2', x: W - 96, y: H - 28, r: 19, label: ca2.name, st: ca2, col: '#8af0ff', down: () => g.useSecond() });
    const ab = p.wcfg.ability;
    if (ab && p.form === 'human' && !p.venom && !p.frog && !p.demon && !p.driving) {
      const st = p.overdrive ? { state: 'active', frac: p.ability.active / ab.duration } : p.ability.cd > 0 ? { state: 'cd', frac: 1 - p.ability.cd / ab.cooldown, sub: `${Math.ceil(p.ability.cd)}s` } : { state: 'ready', frac: 1 };
      add({ id: 'wa', x: W - 30, y: H - 100, r: 17, label: ab.name, st, col: '#ffb02a', down: () => p.useAbility() });
    }
    add({ id: 'rl', x: W - 80, y: H - 82, r: 15, label: p.venom || p.frog ? (p.venom ? 'CAPTURE' : 'ARMY') : 'RELOAD', col: '#f5c518', down: () => { inp.keys.r = true; }, up: () => { inp.keys.r = false; } });
    if (!p.venom && !p.frog && !p.demon && !p.beast && !p.driving && p.weaponOrder.length > 1) add({ id: 'sw', x: W - 150, y: H - 20, r: 13, label: 'SWAP', col: '#c9cfdb', down: () => p.cycle(1) });
    const alt = p.venom ? 'CLAW' : p.demon ? 'KICK' : p.beast ? 'SMASH' : p.moneyT > 0 ? 'MONEY' : null;
    if (alt) add({ id: 'alt', x: W - 142, y: H - 64, r: 16, label: alt, col: '#ff8a6a', down: () => { inp.rightDown = true; }, up: () => { inp.rightDown = false; } });
    if (g.carRect) add({ id: 'car', x: W - 30, y: H - 146, r: 14, label: p.car && p.car.civil ? 'GET OUT' : 'GET IN', col: '#5ec2ff', down: () => p.toggleCar() });
    add({ id: 'pause', x: W - 140, y: 22, r: 11, label: 'II', col: '#ffffff', down: () => g.pause() });
    this.buttons = B;
  }
  draw(ctx) {
    if (!this.live()) return;
    this.layout();
    const g = this.g, H = g.vh, W = g.vw, t = g.time;
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    // sticks: a faint ghost where to put your thumbs, the real thing wherever you do
    const stick = (s, gx, gy, col) => {
      const ox = s ? s.ox : gx, oy = s ? s.oy : gy, kx = s ? s.x : gx, ky = s ? s.y : gy;
      ctx.globalAlpha = s ? 0.5 : 0.16; ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(ox, oy, TOUCH_STICK_R, 0, TAU); ctx.stroke();
      ctx.fillStyle = 'rgba(10,12,18,0.35)'; ctx.fill();
      ctx.globalAlpha = s ? 0.8 : 0.22; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(kx, ky, 13, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; ctx.lineWidth = 1;
    };
    stick(this.move, Math.max(58, W * 0.2), H - 62, '#ffffff');
    stick(this.aim, W * 0.64, H - 62, '#ff6a5a');
    for (const b of this.buttons) {
      const st = b.st, ready = !st || st.state === 'ready', active = st && (st.state === 'active' || st.state === 'busy');
      ctx.globalAlpha = 0.9; ctx.fillStyle = b.pressed ? 'rgba(80,92,120,0.95)' : 'rgba(12,14,20,0.72)'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
      if (st && st.state === 'cd') { ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.arc(b.x, b.y, b.r, -Math.PI / 2 + TAU * st.frac, -Math.PI / 2 + TAU); ctx.closePath(); ctx.fill(); }   // the part still recharging
      ctx.globalAlpha = 1; ctx.lineWidth = 2;
      ctx.strokeStyle = active ? b.col : ready ? (st && Math.sin(t * 8) > 0 ? '#ffffff' : b.col) : 'rgba(255,255,255,0.3)';
      ctx.beginPath(); if (active && st.frac) ctx.arc(b.x, b.y, b.r - 1, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(st.frac, 0, 1)); else ctx.arc(b.x, b.y, b.r - 1, 0, TAU); ctx.stroke(); ctx.lineWidth = 1;
      let label = b.label.split(' ')[0], fs = 6; ctx.font = `${fs}px "Press Start 2P", monospace`;
      while (fs > 4 && ctx.measureText(label).width > b.r * 2 - 6) { fs--; ctx.font = `${fs}px "Press Start 2P", monospace`; }
      if (ctx.measureText(label).width > b.r * 2 - 4) label = label.slice(0, Math.floor((b.r * 2 - 4) / (fs * 0.95)));
      const secs = st && st.state === 'cd' && /(\d+(?:\.\d)?)s\b/.exec(st.sub || '');   // recharging: the seconds left, under the name
      ctx.fillStyle = ready ? b.col : active ? '#ffffff' : '#9aa3b5'; ctx.fillText(label, b.x, b.y + (secs ? -3 : 1));
      if (secs) { ctx.font = '6px "Press Start 2P", monospace'; ctx.fillStyle = '#ffffff'; ctx.fillText(String(Math.ceil(+secs[1])), b.x, b.y + 6); }
    }
    ctx.restore();
  }
}
/* touch mode reads its hints as taps, not keys: "[SPACE] READY · CLICK" → "READY · TAP" */
function touchText(s) {
  return String(s).replace(/\[(?:SPACE|[A-Z])\]\s*(?:·\s*)?/gi, '').replace(/\bCLICK\b/g, 'TAP').replace(/\bclick\b/g, 'tap')
    .replace(/\bhold LMB\b/gi, 'hold the aim stick').replace(/\bLMB\b/g, 'FIRE').replace(/\bRMB\b/g, 'ALT').replace(/\bWASD\b/g, 'STICK').replace(/\b(?:Q\/)?SCROLL SWAP\b/g, 'SWAP BTN').replace(/\bSCROLL\b/g, 'SWAP').replace(/\bCURSOR\b/g, 'AIM').replace(/\bcursor\b/g, 'aim').replace(/^\s*·\s*/, '');
}
