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
/* ---- the custom HUD: every control has a slot the player can move, resize and fade (Settings → EDIT CONTROLS) ----
   Positions are fractions of the screen (so a layout fits any phone), sizes multiply the base radius in CSS px.
   Slots are generic — whatever the survivor's first ability is goes in a1, the second in a2, and so on. */
const HUD_ITEMS = {
  move: { r: 50, name: 'MOVE STICK', col: '#e3e6ec', stick: true },
  aim:  { r: 42, name: 'AIM STICK', col: '#ff6a5a', stick: true },
  a1:   { r: 38, name: 'ABILITY 1', col: '#8bd35a' },
  a2:   { r: 31, name: 'ABILITY 2', col: '#8af0ff' },
  wa:   { r: 29, name: 'GUN ABILITY', col: '#ffb02a' },
  rl:   { r: 25, name: 'RELOAD', col: '#f5c518', icon: 'reload' },
  sw:   { r: 24, name: 'SWAP', col: '#e3e6ec', icon: 'swap' },
  alt:  { r: 29, name: 'ALT MOVE', col: '#ff8a6a' },
  car:  { r: 27, name: 'CAR', col: '#5ec2ff' },
  map:  { w: 120, h: 75, name: 'MINIMAP', col: '#9aa3b5' },   // logical px, like the rest of the pixel HUD
};
const HUD_PRESETS = {   // [x, y, size]
  arc:    { name: 'THUMB ARC',   move: [0.227, 0.708, 1], aim: [0.73, 0.687, 0.7], a1: [0.878, 0.625, 0.8], a2: [0.878, 0.874, 1], wa: [0.888, 0.416, 1], rl: [0.69, 0.895, 1], sw: [0.779, 0.895, 1], alt: [0.681, 0.458, 1], car: [0.592, 0.644, 1], map: [0.085, 0.47, 0.8] },   // the default: laid out by hand on a real phone
  corner: { name: 'CORNER',      move: [0.15, 0.74, 1], aim: [0.58, 0.71, 1], a1: [0.9225, 0.828, 1], a2: [0.805, 0.878, 1], wa: [0.935, 0.567, 1], rl: [0.825, 0.628, 1], sw: [0.695, 0.889, 1], alt: [0.71, 0.672, 1], car: [0.58, 0.45, 1], map: [0.898, 0.332, 1] },
  left:   { name: 'LEFT-HANDED', move: [0.8, 0.78, 1], aim: [0.4, 0.7, 1], a1: [0.135, 0.7, 1], a2: [0.3, 0.42, 1], wa: [0.16, 0.47, 1], rl: [0.53, 0.8, 1], sw: [0.61, 0.86, 1], alt: [0.4, 0.44, 1], car: [0.49, 0.28, 1], map: [0.915, 0.49, 0.8] },
};
function hudFromPreset(id) { const P = HUD_PRESETS[id] || HUD_PRESETS.arc, items = {}; for (const k in HUD_ITEMS) { const [x, y, sz] = P[k]; items[k] = { x, y, s: sz, o: 1 }; } return { preset: HUD_PRESETS[id] ? id : 'arc', sticks: 'floating', items }; }
/* whatever is saved, cleaned up: unknown slots dropped, numbers clamped, missing slots from the preset */
function hudSanitize(h) {
  const out = hudFromPreset(h && h.preset); if (!h || typeof h !== 'object') return out;
  if (h.sticks === 'fixed') out.sticks = 'fixed';
  const num = (v, a, b, d) => Number.isFinite(+v) ? Math.min(b, Math.max(a, +v)) : d;
  for (const k in HUD_ITEMS) { const it = h.items && h.items[k], o = out.items[k]; if (!it) continue; o.x = num(it.x, 0, 1, o.x); o.y = num(it.y, 0, 1, o.y); o.s = num(it.s, 0.6, 1.5, o.s); o.o = num(it.o, 0.25, 1, o.o); }
  return out;
}

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
  /* the player's layout (or the default thumb arc), and one slot of it in CSS px */
  hud() { const st = this.g.settings; if (!this._hud || this._hudSrc !== st.hud) { this._hud = hudSanitize(st.hud); this._hudSrc = st.hud; } return this._hud; }
  pt(id, W, H) { const it = this.hud().items[id], b = HUD_ITEMS[id]; return { x: it.x * W, y: it.y * H, r: (b.r || 0) * it.s, o: it.o }; }
  /* where the minimap goes, in the game's logical px */
  mapRect() { const g = this.g, it = this.hud().items.map, w = HUD_ITEMS.map.w * it.s, h = HUD_ITEMS.map.h * it.s; return { x: Math.round(clamp(it.x * g.vw - w / 2, 0, g.vw - w)), y: Math.round(clamp(it.y * g.vh - h / 2, 0, g.vh - h)), w, h, o: it.o }; }
  openEditor() { (this.editor || (this.editor = new HudEditor(this))).open(); }
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
      const H = g.canvas.getBoundingClientRect().height, mp = this.pt('move', W, H), ap = this.pt('aim', W, H), mid = (mp.x + ap.x) / 2;
      const fixed = this.hud().sticks === 'fixed', onMove = mp.x < ap.x ? x < mid : x > mid;   // the move stick's side of the screen (mirrored for left-handed layouts)
      const mk = pp => fixed ? { id, ox: pp.x, oy: pp.y, x, y, R: pp.r } : { id, ox: x, oy: y, x, y, R: pp.r };
      if (onMove) { if (!this.move) this.move = mk(mp); } else if (!this.aim) this.aim = mk(ap);
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
        if (d > s.R && this.hud().sticks !== 'fixed') { s.ox = x - dx / d * s.R; s.oy = y - dy / d * s.R; }   // floating: the base trails your thumb
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
  vec(s) { const dx = s.x - s.ox, dy = s.y - s.oy, d = Math.hypot(dx, dy); return d < 0.01 ? { x: 0, y: 0, m: 0 } : { x: dx / d, y: dy / d, m: Math.min(1, d / s.R) }; }
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
    // every button sits in its own slot of the player's layout
    const alt = p.venom ? 'CLAW' : p.demon ? 'KICK' : p.beast ? 'SMASH' : p.moneyT > 0 ? 'MONEY' : null, ca = p.charAbility(), ca2 = p.charAbility2();
    const add = b => { const q = this.pt(b.id, W, H); b.x = q.x; b.y = q.y; b.r = q.r; b.o = q.o; b.pressed = keep(b.id); B.push(b); };
    if (ca) add({ id: 'a1', label: ca.name, st: ca, col: '#8bd35a', down: () => p.useCharAbility() });
    if (ca2) add({ id: 'a2', label: ca2.name, st: ca2, col: '#8af0ff', down: () => g.useSecond() });
    const ab = p.wcfg.ability;
    if (ab && p.form === 'human' && !p.venom && !p.frog && !p.demon && !p.driving) {
      const st = p.overdrive ? { state: 'active', frac: p.ability.active / ab.duration } : p.ability.cd > 0 ? { state: 'cd', frac: 1 - p.ability.cd / ab.cooldown, sub: `${Math.ceil(p.ability.cd)}s` } : { state: 'ready', frac: 1 };
      add({ id: 'wa', label: ab.name, st, col: '#ffb02a', down: () => p.useAbility() });
    }
    // no gun to reload as the venom or the frog (their capture / army already has its own button)
    if (!p.venom && !p.frog && !p.demon && !p.beast) add({ id: 'rl', label: 'RELOAD', icon: 'reload', col: '#f5c518', down: () => { inp.keys.r = true; }, up: () => { inp.keys.r = false; } });
    if (!p.venom && !p.frog && !p.demon && !p.beast && !p.driving && p.weaponOrder.length > 1) add({ id: 'sw', label: 'SWAP', icon: 'swap', col: '#e3e6ec', down: () => p.cycle(1) });
    if (alt) add({ id: 'alt', label: alt, col: '#ff8a6a', down: () => { inp.rightDown = true; }, up: () => { inp.rightDown = false; } });
    if (g.carRect) add({ id: 'car', label: p.car && p.car.civil ? 'GET OUT' : 'GET IN', col: '#5ec2ff', down: () => p.toggleCar() });
    B.push({ id: 'pause', x: W - 128 * s - 30, y: 26 * s, r: 21, o: 1, label: 'PAUSE', icon: 'pause', col: '#ffffff', pressed: keep('pause'), down: () => g.pause() });   // just left of the WAVE box
    // two abilities whose names start the same ("WEB SWING" / "WEB PULL") are told apart by their last word
    const a = B.find(b => b.id === 'a1'), b2 = B.find(b => b.id === 'a2');
    for (const b of B) b.short = b.label.split(' ')[0];
    if (a && b2 && a.short === b2.short) { a.short = a.label.split(' ').pop(); b2.short = b2.label.split(' ').pop(); }
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
    const stick = (s, id) => {
      const q = this.pt(id, W, H), col = HUD_ITEMS[id].col, R = q.r, ox = s ? s.ox : q.x, oy = s ? s.oy : q.y;
      let kx = s ? s.x : q.x, ky = s ? s.y : q.y; const d = Math.hypot(kx - ox, ky - oy); if (d > R) { kx = ox + (kx - ox) / d * R; ky = oy + (ky - oy) / d * R; }   // a fixed stick's knob stays on its ring
      ctx.globalAlpha = (s ? 0.55 : 0.2) * (s ? 1 : q.o); ctx.fillStyle = 'rgba(10,12,18,0.4)'; ctx.beginPath(); ctx.arc(ox, oy, R, 0, TAU); ctx.fill();
      ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.stroke();
      ctx.globalAlpha = (s ? 0.85 : 0.25) * (s ? 1 : q.o); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(kx, ky, R * 0.44, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
    };
    stick(this.move, 'move');
    stick(this.aim, 'aim');
    for (const b of this.buttons) {
      ctx.globalAlpha = b.pressed ? 1 : b.o;
      const st = b.st, ready = !st || st.state === 'ready', active = st && (st.state === 'active' || st.state === 'busy'), cd = st && st.state === 'cd';
      ctx.fillStyle = b.pressed ? 'rgba(90,104,136,0.92)' : 'rgba(12,14,20,0.66)'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
      if (cd) { ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.arc(b.x, b.y, b.r, -Math.PI / 2 + TAU * clamp(st.frac, 0, 1), -Math.PI / 2 + TAU); ctx.closePath(); ctx.fill(); }   // the part still recharging
      ctx.lineWidth = 3; ctx.strokeStyle = active ? b.col : ready ? (st && Math.sin(t * 6) > 0.3 ? '#ffffff' : b.col) : 'rgba(255,255,255,0.35)';
      ctx.beginPath(); if (active && st.frac) ctx.arc(b.x, b.y, b.r - 1.5, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(st.frac, 0, 1)); else ctx.arc(b.x, b.y, b.r - 1.5, 0, TAU); ctx.stroke();
      const txt = ready ? b.col : active ? '#ffffff' : '#aab3c5';
      if (b.icon) { this.icon(ctx, b.icon, b.x, b.y, b.r, txt); continue; }
      let label = b.short, fs = 11; const max = b.r * 2 - 10;
      ctx.font = `${fs}px "Press Start 2P", monospace`;
      while (fs > 6 && ctx.measureText(label).width > max) { fs--; ctx.font = `${fs}px "Press Start 2P", monospace`; }
      while (label.length > 2 && ctx.measureText(label).width > max) label = label.slice(0, -1);
      const secs = cd && /(\d+(?:\.\d)?)s\b/.exec(st.sub || '');   // recharging: the seconds left, under the name
      ctx.fillStyle = txt; ctx.fillText(label, b.x, b.y + (secs ? -7 : 1));
      if (secs) { ctx.font = '12px "Press Start 2P", monospace'; ctx.fillStyle = '#ffffff'; ctx.fillText(String(Math.ceil(+secs[1])), b.x, b.y + 10); }
    }
    ctx.globalAlpha = 1;
  }
}

/* ============================================================
   the EDIT CONTROLS screen: drag every control where your thumbs want it, resize or fade it, pick a preset
   ============================================================ */
class HudEditor {
  constructor(tc) {
    this.tc = tc; this.sel = null; this.drag = null;
    const el = this.el = document.createElement('div'); el.id = 'hud-editor';
    el.innerHTML = `<div class="he-stage"></div>
      <div class="he-bar"><button class="he-layout"></button><button class="he-sticks"></button><button data-act="reset">RESET</button><button data-act="cancel">CANCEL</button><button data-act="save" class="he-save">SAVE</button></div>
      <div class="he-panel"><b class="he-name"></b>
        <label>SIZE <input type="range" min="60" max="150" step="5" class="he-size"><span class="he-sv"></span></label>
        <label>OPACITY <input type="range" min="25" max="100" step="5" class="he-op"><span class="he-ov"></span></label></div>
      <div class="he-help"><b>EDIT CONTROLS</b>Drag any control to move it.<br>Tap one to change its size or fade it.<br>Red means two controls overlap.</div>`;
    document.getElementById('stage').appendChild(el);
    this.stage = el.querySelector('.he-stage');
    el.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.classList.contains('he-layout')) { const ks = Object.keys(HUD_PRESETS), st = this.work.sticks; this.work = hudFromPreset(ks[(ks.indexOf(this.work.preset) + 1) % ks.length]); this.work.sticks = st; this.sel = null; this.build(); }
      else if (b.classList.contains('he-sticks')) { this.work.sticks = this.work.sticks === 'fixed' ? 'floating' : 'fixed'; this.bar(); }
      else if (b.dataset.act === 'reset') { const st = this.work.sticks; this.work = hudFromPreset(this.work.preset); this.work.sticks = st; this.sel = null; this.build(); }
      else if (b.dataset.act === 'cancel') this.close();
      else if (b.dataset.act === 'save') this.save();
    });
    const size = el.querySelector('.he-size'), op = el.querySelector('.he-op');
    size.addEventListener('input', () => { if (!this.sel) return; this.work.items[this.sel].s = size.value / 100; this.place(this.sel); this.check(); this.panel(); });
    op.addEventListener('input', () => { if (!this.sel) return; this.work.items[this.sel].o = op.value / 100; this.place(this.sel); this.panel(); });
    this.stage.addEventListener('pointerdown', e => {
      this.hideHelp(); const n = e.target.closest('.he-item'); if (!n) { this.select(null); return; }
      e.preventDefault(); const id = n.dataset.id, it = this.work.items[id], r = this.stage.getBoundingClientRect();
      this.select(id); this.drag = { id, pid: e.pointerId, dx: e.clientX - (r.left + it.x * r.width), dy: e.clientY - (r.top + it.y * r.height) };
      try { n.setPointerCapture(e.pointerId); } catch (_) {}   // keeps the drag even if the finger slides off the circle
    });
    this.stage.addEventListener('pointermove', e => {
      const d = this.drag; if (!d || d.pid !== e.pointerId) return;
      const r = this.stage.getBoundingClientRect(), it = this.work.items[d.id], snap = v => Math.round(v / 8) * 8;   // an 8 px grid keeps rows tidy
      const { w, h } = this.box(d.id), mx = (w / 2 + 2) / r.width, my = (h / 2 + 2) / r.height;   // never past the edge of the screen
      it.x = clamp(snap(e.clientX - r.left - d.dx) / r.width, mx, 1 - mx); it.y = clamp(snap(e.clientY - r.top - d.dy) / r.height, my, 1 - my);
      this.place(d.id); this.check();
    });
    const end = e => { if (this.drag && this.drag.pid === e.pointerId) this.drag = null; };
    this.stage.addEventListener('pointerup', end); this.stage.addEventListener('pointercancel', end);
    window.addEventListener('keydown', e => { if (e.key === 'Escape' && el.classList.contains('show')) { e.stopPropagation(); this.close(); } }, true);
    window.addEventListener('resize', () => { if (el.classList.contains('show')) this.build(); });
  }
  open() {
    this.work = JSON.parse(JSON.stringify(this.tc.hud())); this.sel = null; this.el.classList.add('show'); document.documentElement.classList.add('hud-editing'); this.build();
    this.el.querySelector('.he-help').classList.add('show'); clearTimeout(this._help); this._help = setTimeout(() => this.hideHelp(), 5000);   // how it works, until you touch something
  }
  hideHelp() { clearTimeout(this._help); this.el.querySelector('.he-help').classList.remove('show'); }
  close() { this.el.classList.remove('show'); document.documentElement.classList.remove('hud-editing'); this.drag = null; }
  save() {
    if (this.stage.querySelector('.he-item.bad')) { this.tc.g.ui.toast('Move the red controls apart first'); return; }
    this.tc.g.settings.hud = JSON.parse(JSON.stringify(this.work)); this.tc._hud = null; this.tc.g.ui.saveGame();
    this.close(); this.tc.g.ui.toast('Controls saved');
  }
  /* the pixel HUD's scale on this screen during a run (see Game.resize), so previews match what you'll see */
  k() { return Math.max(1, this.stage.getBoundingClientRect().height / 300); }
  build() {
    const r = this.stage.getBoundingClientRect(), k = this.k(), vw = r.width / k, vh = r.height / k;
    // the fixed pixel panels, so nothing gets dropped on top of them
    const fixed = [[8, 8, 104, 51, 'HEALTH'], [8, 86, 64, 22, 'CART'], [vw - 120, 8, 112, 36, 'WAVE'], [8, vh - 34, 130, 26, 'WEAPON'], [vw / 2 - 90, vh - 26, 180, 18, 'XP']];
    this.stage.innerHTML = fixed.map(([x, y, w, h, n]) => `<div class="he-fixed" style="left:${x * k}px;top:${y * k}px;width:${w * k}px;height:${h * k}px">${n}</div>`).join('')
      + `<div class="he-fixed he-round" style="left:${r.width - 128 * k - 51}px;top:${26 * k - 21}px;width:42px;height:42px">II</div>`
      + Object.keys(HUD_ITEMS).map(id => `<div class="he-item${HUD_ITEMS[id].stick ? ' stick' : ''}${id === 'map' ? ' rect' : ''}" data-id="${id}" style="--c:${HUD_ITEMS[id].col}"><span>${HUD_ITEMS[id].name.replace(' ', '<br>')}</span></div>`).join('');
    for (const id in HUD_ITEMS) this.place(id);
    this.check(); this.bar(); this.panel();
  }
  box(id) {   // an item's size in CSS px on this screen
    const it = this.work.items[id], b = HUD_ITEMS[id], k = this.k();
    return b.w ? { w: b.w * it.s * k, h: b.h * it.s * k } : { w: b.r * it.s * 2, h: b.r * it.s * 2 };
  }
  place(id) {
    const n = this.stage.querySelector(`[data-id="${id}"]`); if (!n) return;
    const r = this.stage.getBoundingClientRect(), it = this.work.items[id], { w, h } = this.box(id);
    it.x = clamp(it.x, (w / 2 + 2) / r.width, 1 - (w / 2 + 2) / r.width); it.y = clamp(it.y, (h / 2 + 2) / r.height, 1 - (h / 2 + 2) / r.height);   // presets and bigger sizes stay on screen too
    n.style.width = w + 'px'; n.style.height = h + 'px'; n.style.left = (it.x * r.width - w / 2) + 'px'; n.style.top = (it.y * r.height - h / 2) + 'px'; n.style.opacity = it.o;
    n.classList.toggle('sel', id === this.sel);
  }
  /* anything overlapping anything else turns red (circles by distance, the minimap as a box) */
  check() {
    const r = this.stage.getBoundingClientRect(), ids = Object.keys(HUD_ITEMS), bad = new Set();
    const shape = id => { const it = this.work.items[id], { w, h } = this.box(id); return { x: it.x * r.width, y: it.y * r.height, w, h, rect: !!HUD_ITEMS[id].w }; };
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
      const a = shape(ids[i]), b = shape(ids[j]); let hit;
      if (a.rect || b.rect) hit = Math.abs(a.x - b.x) < (a.w + b.w) / 2 - 2 && Math.abs(a.y - b.y) < (a.h + b.h) / 2 - 2;
      else hit = Math.hypot(a.x - b.x, a.y - b.y) < a.w / 2 + b.w / 2 - 2;
      if (hit) { bad.add(ids[i]); bad.add(ids[j]); }
    }
    this.stage.querySelectorAll('.he-item').forEach(n => n.classList.toggle('bad', bad.has(n.dataset.id)));
  }
  select(id) { this.sel = id; for (const k in HUD_ITEMS) this.place(k); this.panel(); }
  bar() {
    this.el.querySelector('.he-layout').textContent = HUD_PRESETS[this.work.preset].name + ' ▸';
    // the toolbar sits between the HEALTH box and the pause button
    const r = this.stage.getBoundingClientRect(), k = this.k(), bar = this.el.querySelector('.he-bar'), l = 112 * k + 6, rr = r.width - 120 * k - 10;
    bar.style.left = l + 'px'; bar.style.width = Math.max(200, rr - l) + 'px';
    this.el.querySelector('.he-sticks').textContent = this.work.sticks === 'fixed' ? 'STICKS: FIXED' : 'STICKS: FLOAT';
  }
  panel() {
    const p = this.el.querySelector('.he-panel'); p.classList.toggle('show', !!this.sel); if (this.sel) this.hideHelp(); if (!this.sel) return;
    const it = this.work.items[this.sel];
    p.querySelector('.he-name').textContent = HUD_ITEMS[this.sel].name;
    p.querySelector('.he-size').value = Math.round(it.s * 100); p.querySelector('.he-sv').textContent = Math.round(it.s * 100) + '%';
    p.querySelector('.he-op').value = Math.round(it.o * 100); p.querySelector('.he-ov').textContent = Math.round(it.o * 100) + '%';
    // keep the panel on the side of the screen away from what you're moving
    const left = it.x > 0.5; p.style.left = left ? '12px' : 'auto'; p.style.right = left ? 'auto' : '12px';
    p.style.top = it.y > 0.5 ? '56px' : 'auto'; p.style.bottom = it.y > 0.5 ? 'auto' : '34px';
  }
}
/* touch mode reads its hints as taps, not keys: "[SPACE] READY · CLICK" → "READY · TAP" */
function touchText(s) {
  return String(s).replace(/\[(?:SPACE|[A-Z])\]\s*(?:·\s*)?/gi, '').replace(/\bCLICK\b/g, 'TAP').replace(/\bclick\b/g, 'tap')
    .replace(/\bhold LMB\b/gi, 'hold the aim stick').replace(/\bLMB\b/g, 'FIRE').replace(/\bRMB\b/g, 'ALT').replace(/\bWASD\b/g, 'STICK').replace(/\bT to shed\b/g, 'tap SYMBIOTE to shed').replace(/(^|·\s)[A-Z] (?=[A-Za-z]{2})/g, '$1').replace(/\bSPACE\b/g, 'ABILITY').replace(/\bSpace\b/g, 'ability').replace(/\b(?:Q\/)?SCROLL SWAP\b/g, 'TAP SWAP').replace(/\bSCROLL\b/g, 'SWAP').replace(/\bCURSOR\b/g, 'AIM').replace(/\bcursor\b/g, 'aim').replace(/^\s*·\s*/, '');
}
