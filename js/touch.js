/* ============================================================
   touch.js — phones & tablets: twin thumb sticks, ability buttons, touch-sized view
   Left half of the screen: wherever your thumb lands becomes the move stick.
   Right half: wherever it lands becomes the aim stick — push to aim, and it fires while you hold it.
   Aiming is entirely yours: no assist, no lock-on. Buttons sit in an arc in the
   bottom-right corner, built each frame from what the current character can actually do.
   The sticks and buttons are drawn on their own full-resolution layer (#touchlayer) in real CSS
   pixels, so they stay sharp and finger-sized however the pixel-art game canvas is scaled.
   Everything here only runs once the device has been touched (or reports a coarse pointer);
   keyboard + mouse play is untouched.
   ============================================================ */
const TOUCH_STICK_R = 50;   // CSS px the knob travels before the base follows your thumb

class TouchControls {
  constructor(game) {
    this.g = game; this.on = false; this.move = null; this.aim = null; this.tele = null;
    this.held = new Map(); this.buttons = []; this.lastTouch = -1e9; this.aimA = 0; this.aimD = 60;
    this.coarse = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);
    const c = game.canvas, opt = { passive: false };
    this.cv = document.createElement('canvas'); this.cv.id = 'touchlayer'; this.cv.setAttribute('aria-hidden', 'true');
    c.insertAdjacentElement('afterend', this.cv); this.cx = this.cv.getContext('2d'); this.drawn = false;
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
  disable() { this.on = false; document.documentElement.classList.remove('touch'); this.releaseAll(); this.g.resize(); this.render(); }
  releaseAll() {
    const inp = this.g.input; this.move = this.aim = this.tele = null; inp.stick = null; inp.mouseDown = false; inp.rightDown = false;
    this.held.forEach(b => { b.pressed = false; if (b.up) b.up(); }); this.held.clear();
  }
  /* touches in CSS px from the canvas corner; the game's own (logical) coordinates are these divided by its scale */
  pos(t) { const r = this.g.canvas.getBoundingClientRect(); return [t.clientX - r.left, t.clientY - r.top]; }
  toLogical(x, y) { const r = this.g.canvas.getBoundingClientRect(); return [x / r.width * this.g.vw, y / r.height * this.g.vh]; }
  live() { const s = this.g.state; return (s === 'playing' || s === 'wavebreak') && !this.g.telePick; }

  onStart(e) {
    e.preventDefault(); this.lastTouch = performance.now();
    const g = this.g, inp = g.input, W = g.canvas.getBoundingClientRect().width;
    for (const t of e.changedTouches) {
      const [x, y] = this.pos(t), id = t.identifier, [lx, ly] = this.toLogical(x, y);
      if (g.telePick) { this.tele = id; inp.mouseX = lx; inp.mouseY = ly; continue; }   // Runner's teleport map: drag to aim, let go to jump
      if (!this.live()) continue;
      const b = this.hit(x, y);
      if (b) { this.held.set(id, b); b.pressed = true; if (b.down) b.down(); if (navigator.vibrate) try { navigator.vibrate(8); } catch (_) {} continue; }
      const cr = g.cartRect; if (cr && lx >= cr.x && lx <= cr.x + cr.w && ly >= cr.y && ly <= cr.y + cr.h) { g.openShop(); continue; }
      if (x < W * 0.45) { if (!this.move) this.move = { id, ox: x, oy: y, x, y }; }
      else if (!this.aim) this.aim = { id, ox: x, oy: y, x, y };
    }
  }
  onMove(e) {
    e.preventDefault();
    const inp = this.g.input;
    for (const t of e.changedTouches) {
      const [x, y] = this.pos(t), id = t.identifier;
      if (this.tele === id) { [inp.mouseX, inp.mouseY] = this.toLogical(x, y); }
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
  /* called every game frame before the world reads the input: turns the sticks into the mouse + WASD the game already speaks */
  frame() {
    const g = this.g, p = g.player, inp = g.input; if (!p) return;
    if (!this.live()) { if (this.aim) inp.mouseDown = false; return; }
    const mv = this.move && this.vec(this.move); inp.stick = mv && mv.m > 0.2 ? mv : null;
    const av = this.aim && this.vec(this.aim);
    if (av && av.m > 0.25) {
      this.aimA = Math.atan2(av.y, av.x); this.aimD = 40 + av.m * 150; inp.mouseDown = true;   // exactly where the thumb points
    } else { inp.mouseDown = false; if (!this.aim && inp.stick) { this.aimA = Math.atan2(inp.stick.y, inp.stick.x); this.aimD = 60; } }   // not aiming: face where you walk
    inp.mouseX = p.x - g.cam.x + Math.cos(this.aimA) * this.aimD; inp.mouseY = p.y - g.cam.y + Math.sin(this.aimA) * this.aimD;
  }
  hit(x, y) { for (const b of this.buttons) if (Math.hypot(x - b.x, y - b.y) <= b.r + 6) return b; return null; }
  /* the buttons this character has right now, in CSS px from the bottom-right corner */
  layout(W, H) {
    const g = this.g, p = g.player, inp = g.input, B = [], s = W / g.vw;
    const keep = id => { const o = this.buttons.find(b => b.id === id); return o ? o.pressed : false; };
    // slots fill from the corner outward, so whatever buttons a character has sit where the thumb rests
    const slots = [[62, 62], [156, 44], [52, 156], [140, 134], [244, 40], [232, 118], [52, 230]];
    // each button keeps its own slot for this character (a gun without an ability leaves a gap rather than shuffling the rest under your thumb)
    const alt = p.venom ? 'CLAW' : p.demon ? 'KICK' : p.beast ? 'SMASH' : p.moneyT > 0 ? 'MONEY' : null, ca = p.charAbility(), ca2 = p.charAbility2();
    const order = [ca && 'a1', ca2 && 'a2', p.weaponOrder.some(w => WEAPONS[w] && WEAPONS[w].ability) && 'wa', 'rl', p.weaponOrder.length > 1 && 'sw', alt && 'alt', g.carRect && 'car'].filter(Boolean);
    const add = b => { const [sx, sy] = slots[Math.max(0, order.indexOf(b.id))] || slots[slots.length - 1]; b.x = W - sx; b.y = H - sy; b.pressed = keep(b.id); B.push(b); };
    if (ca) add({ id: 'a1', r: 38, label: ca.name, st: ca, col: '#8bd35a', down: () => p.useCharAbility() });
    if (ca2) add({ id: 'a2', r: 31, label: ca2.name, st: ca2, col: '#8af0ff', down: () => g.useSecond() });
    const ab = p.wcfg.ability;
    if (ab && p.form === 'human' && !p.venom && !p.frog && !p.demon && !p.driving) {
      const st = p.overdrive ? { state: 'active', frac: p.ability.active / ab.duration } : p.ability.cd > 0 ? { state: 'cd', frac: 1 - p.ability.cd / ab.cooldown, sub: `${Math.ceil(p.ability.cd)}s` } : { state: 'ready', frac: 1 };
      add({ id: 'wa', r: 29, label: ab.name, st, col: '#ffb02a', down: () => p.useAbility() });
    }
    const rlab = p.venom ? 'CAPTURE' : p.frog ? 'ARMY' : null;   // R does something else in these forms
    add({ id: 'rl', r: 30, label: rlab || 'RELOAD', icon: rlab ? null : 'reload', col: '#f5c518', down: () => { inp.keys.r = true; }, up: () => { inp.keys.r = false; } });
    if (!p.venom && !p.frog && !p.demon && !p.beast && !p.driving && p.weaponOrder.length > 1) add({ id: 'sw', r: 28, label: 'SWAP', icon: 'swap', col: '#e3e6ec', down: () => p.cycle(1) });
    if (alt) add({ id: 'alt', r: 29, label: alt, col: '#ff8a6a', down: () => { inp.rightDown = true; }, up: () => { inp.rightDown = false; } });
    if (g.carRect) add({ id: 'car', r: 27, label: p.car && p.car.civil ? 'GET OUT' : 'GET IN', col: '#5ec2ff', down: () => p.toggleCar() });
    B.push({ id: 'pause', x: W - 128 * s - 30, y: 26 * s, r: 21, label: 'PAUSE', icon: 'pause', col: '#ffffff', pressed: keep('pause'), down: () => g.pause() });   // just left of the WAVE box
    this.buttons = B;
  }
  icon(ctx, kind, x, y, r, col) {
    ctx.save(); ctx.translate(x, y); ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = Math.max(2.5, r * 0.13); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const k = r * 0.46;
    if (kind === 'reload') {   // a circular arrow running clockwise, head at its end
      const a0 = -Math.PI * 0.2, a1 = a0 + Math.PI * 1.55; ctx.beginPath(); ctx.arc(0, 0, k, a0, a1); ctx.stroke();
      const ex = Math.cos(a1) * k, ey = Math.sin(a1) * k, tx = -Math.sin(a1), ty = Math.cos(a1), nx = Math.cos(a1), ny = Math.sin(a1), h = k * 0.62;
      ctx.beginPath(); ctx.moveTo(ex + tx * h * 0.55, ey + ty * h * 0.55); ctx.lineTo(ex - nx * h * 0.55 - tx * h * 0.25, ey - ny * h * 0.55 - ty * h * 0.25); ctx.lineTo(ex + nx * h * 0.55 - tx * h * 0.25, ey + ny * h * 0.55 - ty * h * 0.25); ctx.closePath(); ctx.fill();
    } else if (kind === 'swap') {   // two arrows passing each other
      const h = k * 0.45;
      ctx.beginPath(); ctx.moveTo(-k, -k * 0.38); ctx.lineTo(k, -k * 0.38); ctx.moveTo(k - h, -k * 0.38 - h); ctx.lineTo(k, -k * 0.38); ctx.lineTo(k - h, -k * 0.38 + h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(k, k * 0.38); ctx.lineTo(-k, k * 0.38); ctx.moveTo(-k + h, k * 0.38 - h); ctx.lineTo(-k, k * 0.38); ctx.lineTo(-k + h, k * 0.38 + h); ctx.stroke();
    } else if (kind === 'pause') { const w = k * 0.34; ctx.fillRect(-k * 0.55, -k * 0.75, w, k * 1.5); ctx.fillRect(k * 0.55 - w, -k * 0.75, w, k * 1.5); }
    ctx.restore();
  }
  /* drawn every frame on the overlay; cleared whenever there's nothing to show */
  render() {
    const cv = this.cv, dpr = Math.min(3, window.devicePixelRatio || 1), r = this.g.canvas.getBoundingClientRect(), W = r.width, H = r.height;
    const show = this.on && this.live() && this.g.player;
    if (!show) { if (this.drawn) { this.cx.clearRect(0, 0, cv.width, cv.height); this.drawn = false; } return; }
    const pw = Math.round(W * dpr), ph = Math.round(H * dpr);
    if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; }
    const ctx = this.cx; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H); this.drawn = true;
    this.layout(W, H);
    const t = this.g.time;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    // sticks: a faint ghost where to put your thumbs, the real thing wherever you do
    const stick = (s, gx, gy, col) => {
      const ox = s ? s.ox : gx, oy = s ? s.oy : gy, kx = s ? s.x : gx, ky = s ? s.y : gy;
      ctx.globalAlpha = s ? 0.55 : 0.2; ctx.fillStyle = 'rgba(10,12,18,0.4)'; ctx.beginPath(); ctx.arc(ox, oy, TOUCH_STICK_R, 0, TAU); ctx.fill();
      ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.stroke();
      ctx.globalAlpha = s ? 0.85 : 0.25; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(kx, ky, 22, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
    };
    stick(this.move, Math.max(90, W * 0.2), H - 95, '#ffffff');
    stick(this.aim, W * 0.6, H - 120, '#ff6a5a');
    for (const b of this.buttons) {
      const st = b.st, ready = !st || st.state === 'ready', active = st && (st.state === 'active' || st.state === 'busy'), cd = st && st.state === 'cd';
      ctx.fillStyle = b.pressed ? 'rgba(90,104,136,0.92)' : 'rgba(12,14,20,0.66)'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
      if (cd) { ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.arc(b.x, b.y, b.r, -Math.PI / 2 + TAU * clamp(st.frac, 0, 1), -Math.PI / 2 + TAU); ctx.closePath(); ctx.fill(); }   // the part still recharging
      ctx.lineWidth = 3; ctx.strokeStyle = active ? b.col : ready ? (st && Math.sin(t * 6) > 0.3 ? '#ffffff' : b.col) : 'rgba(255,255,255,0.35)';
      ctx.beginPath(); if (active && st.frac) ctx.arc(b.x, b.y, b.r - 1.5, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(st.frac, 0, 1)); else ctx.arc(b.x, b.y, b.r - 1.5, 0, TAU); ctx.stroke();
      const txt = ready ? b.col : active ? '#ffffff' : '#aab3c5';
      if (b.icon) { this.icon(ctx, b.icon, b.x, b.y, b.r, txt); continue; }
      let label = b.label.split(' ')[0], fs = 11; const max = b.r * 2 - 10;
      ctx.font = `${fs}px "Press Start 2P", monospace`;
      while (fs > 7 && ctx.measureText(label).width > max) { fs--; ctx.font = `${fs}px "Press Start 2P", monospace`; }
      while (label.length > 2 && ctx.measureText(label).width > max) label = label.slice(0, -1);
      const secs = cd && /(\d+(?:\.\d)?)s\b/.exec(st.sub || '');   // recharging: the seconds left, under the name
      ctx.fillStyle = txt; ctx.fillText(label, b.x, b.y + (secs ? -7 : 1));
      if (secs) { ctx.font = '12px "Press Start 2P", monospace'; ctx.fillStyle = '#ffffff'; ctx.fillText(String(Math.ceil(+secs[1])), b.x, b.y + 10); }
    }
  }
}
/* touch mode reads its hints as taps, not keys: "[SPACE] READY · CLICK" → "READY · TAP" */
function touchText(s) {
  return String(s).replace(/\[(?:SPACE|[A-Z])\]\s*(?:·\s*)?/gi, '').replace(/\bCLICK\b/g, 'TAP').replace(/\bclick\b/g, 'tap')
    .replace(/\bhold LMB\b/gi, 'hold the aim stick').replace(/\bLMB\b/g, 'FIRE').replace(/\bRMB\b/g, 'ALT').replace(/\bWASD\b/g, 'STICK').replace(/\b(?:Q\/)?SCROLL SWAP\b/g, 'TAP SWAP').replace(/\bSCROLL\b/g, 'SWAP').replace(/\bCURSOR\b/g, 'AIM').replace(/\bcursor\b/g, 'aim').replace(/^\s*·\s*/, '');
}
