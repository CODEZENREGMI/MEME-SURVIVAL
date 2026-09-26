/* ==========================================================================
   map.js — levels: tile grid, props, collision, flow-field, pre-render, minimap
   ========================================================================== */
const T_ROAD = 0, T_WALK = 1, T_GRASS = 2, T_BLDG = 3, T_HEDGE = 4;

function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

const THEMES = {
  city:       { road: ['#3b3d44', '#34363c', '#43454d'], walk: ['#6b6e78', '#5a5d66', '#767a85'], grass: ['#3f7a34', '#356b2c', '#4c8d3e'], bldg: ['#2b2c33', '#34353d', '#3d3e47', '#5b5e6a'], hedge: ['#1f3d1c', '#2a5226'], mini: ['#3b3d44', '#6b6e78', '#3f7a34', '#232430', '#1f3d1c'] },
  suburbs:    { road: ['#46474d', '#3e3f45', '#4e4f56'], walk: ['#8a8478', '#736e63', '#96907f'], grass: ['#4a8a3a', '#3f7a31', '#5a9e48'], bldg: ['#4a2a22', '#8a4636', '#9d5340', '#6a3428'], hedge: ['#1f3d1c', '#2a5226'], mini: ['#46474d', '#8a8478', '#4a8a3a', '#8a4636', '#1f3d1c'] },
  race:       { road: ['#33353c', '#2c2e34', '#3b3d45'], walk: ['#8a8d96', '#767983', '#979aa3'], grass: ['#4a9a3c', '#3f8a33', '#5aac4a'], bldg: ['#2b2e36', '#5a5f6b', '#6b7080', '#3a3e48'], hedge: ['#1a1c22', '#3a3d45'], mini: ['#33353c', '#8a8d96', '#4a9a3c', '#5a5f6b', '#1a1c22'] },
  lab:        { road: ['#c4cad3', '#b2b8c2', '#d0d6de'], walk: ['#a9aeb8', '#959aa4', '#b8bdc7'], grass: ['#2f3542', '#272c38', '#3a4150'], bldg: ['#3a3f4a', '#eef0f3', '#d8dce3', '#c3c8d0'], hedge: ['#2fd8ff', '#8af0ff'], mini: ['#d5dae1', '#a9aeb8', '#2f3542', '#f2f4f7', '#2fd8ff'] },
  horror:     null,   // painted map: set to the city palette below, only used before the image loads
  industrial: { road: ['#4c4f55', '#44474d', '#54575e'], walk: ['#5c5f66', '#4c4f56', '#686b73'], grass: ['#5a4e3e', '#4e4335', '#665946'], bldg: ['#1f2530', '#333c4c', '#46536a', '#6a7890'], hedge: ['#1f3d1c', '#2a5226'], mini: ['#4c4f55', '#5c5f66', '#5a4e3e', '#4a5670', '#1f3d1c'] },
};
THEMES.horror = THEMES.city;

class GameMap {
  constructor(id = 'city') {
    this.id = id; this.cfg = MAPS[id]; this.theme = THEMES[id];
    this.w = this.cfg.size ? this.cfg.size.w : CONFIG.MAP_W; this.h = this.cfg.size ? this.cfg.size.h : CONFIG.MAP_H; this.ts = CONFIG.TILE;
    this.pw = this.w * this.ts; this.ph = this.h * this.ts;
    this.tiles = new Uint8Array(this.w * this.h);
    this.solid = new Uint8Array(this.w * this.h);
    this.props = []; this.spawns = []; this.fires = []; this.marks = [];
    this.hRoads = []; this.vRoads = [];
    this.rng = mulberry32({ city: 1337, suburbs: 4242, industrial: 9001, lab: 777, race: 2468, horror: 6666 }[id]);
    this.playerStart = { x: 40 * this.ts, y: 25 * this.ts };
    ({ city: this.genCity, suburbs: this.genSuburbs, industrial: this.genIndustrial, lab: this.genLab, race: this.genRace, horror: this.genImage })[id].call(this);
    this.render();
    this.decals = document.createElement('canvas'); this.decals.width = this.pw; this.decals.height = this.ph;
    this.dctx = this.decals.getContext('2d');
    this.cars = this.cfg.cars ? this.props.filter(p => p.type.startsWith('car_') && p.type !== 'car_wreck') : [];
    this.cars.forEach(c => { c.hp = CIVIL_CAR.hp; c.maxHp = CIVIL_CAR.hp; c.hitT = 0; });
    this.lamps = this.props.filter(p => p.type === 'lamp').map((p, i) => ({ x: p.x, y: p.y, broken: this.cfg.dark ? i % 3 !== 1 : false, seed: this.rng() * 100 }));
    if (this.cfg.dark) this.dress();
    if (this.house) { const R = this.rng; for (let i = 0; i < 40; i++) { const a = R() * Math.PI * 2, r = 80 + R() * 160; this.splat(this.house.x + Math.cos(a) * r * 1.3, this.house.y + Math.sin(a) * r, 5 + R() * 9, R() < 0.6 ? '#4a0e0a' : '#2e0806'); } }
  }
  /* horror dressing: old blood, drag marks */
  dress() {
    const R = this.rng;
    for (let i = 0; i < 70; i++) { const x = R() * this.pw, y = R() * this.ph; if (!this.solidAt(x, y)) this.splat(x, y, 6 + R() * 10, R() < 0.7 ? '#4a0e0a' : '#2e0806'); }
    const c = this.dctx; c.strokeStyle = '#3a0a08'; c.lineWidth = 3;
    for (let i = 0; i < 12; i++) { const x = R() * this.pw, y = R() * this.ph, a = R() * 7, l = 30 + R() * 60; if (this.solidAt(x, y)) continue; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke(); }
  }

  /* ---------------------------------------------------------- helpers */
  t(x, y) { return this.tiles[y * this.w + x]; }
  set(x, y, v) { if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.tiles[y * this.w + x] = v; }
  fill(x0, y0, x1, y1, v) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.set(x, y, v); }
  isSolid(tx, ty) { if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return true; return this.solid[ty * this.w + tx] === 1; }
  setSolid(tx, ty, v = 1) { if (tx >= 0 && ty >= 0 && tx < this.w && ty < this.h) this.solid[ty * this.w + tx] = v; }
  block(x0, y0, x1, y1, type = T_BLDG) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (this.t(x, y) !== T_ROAD || type === T_HEDGE) { this.set(x, y, type); this.setSolid(x, y); } }
  add(type, tx, ty, opts = {}) {
    const p = Object.assign({ type, x: tx * this.ts + this.ts / 2, y: ty * this.ts + this.ts / 2, solid: true, tw: 1, th: 1, scale: 1 }, opts);
    if (p.tw > 1 || p.th > 1) { if (opts.x == null) p.x = (tx + p.tw / 2) * this.ts; if (opts.y == null) p.y = (ty + p.th / 2) * this.ts; }
    this.props.push(p);
    if (p.solid) for (let yy = 0; yy < p.th; yy++) for (let xx = 0; xx < p.tw; xx++) this.setSolid(tx + xx, ty + yy);
    return p;
  }
  /* toggle a prop's footprint in the solid grid (cars that get driven away / parked) */
  setPropSolid(pr, on) { const tx = Math.round(pr.x / this.ts - pr.tw / 2), ty = Math.floor(pr.y / this.ts); for (let yy = 0; yy < pr.th; yy++) for (let xx = 0; xx < pr.tw; xx++) this.setSolid(tx + xx, ty + yy, on ? 1 : 0); pr.solid = on; }
  rerender() { this.render(); this.flowTx = -1; }
  /* repaint just the tiles under a prop (cheap alternative to a full re-render when a car moves) */
  patchProp(pr) {
    const ts = this.ts, x = this.canvas.getContext('2d'), T = this.theme, R = mulberry32((pr.x * 31 + pr.y * 17) | 0);
    const tx0 = Math.round(pr.x / ts - pr.tw / 2) - 1, ty0 = Math.floor(pr.y / ts) - 1, tx1 = tx0 + pr.tw + 1, ty1 = ty0 + pr.th + 1;
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) continue; const t = this.t(tx, ty), px = tx * ts, py = ty * ts;
      const pal = t === T_ROAD ? T.road : t === T_WALK ? T.walk : t === T_GRASS ? T.grass : T.bldg;
      x.fillStyle = pal[0]; x.fillRect(px, py, ts, ts);
      if (t === T_WALK) { x.fillStyle = pal[1]; x.fillRect(px, py, ts, 1); x.fillRect(px, py, 1, ts); x.fillStyle = pal[2]; x.fillRect(px + 1, py + 1, ts - 1, 1); }
      else for (let i = 0; i < 5; i++) { x.fillStyle = R() < 0.5 ? pal[1] : pal[2]; x.fillRect(px + Math.floor(R() * ts), py + Math.floor(R() * ts), 2, 1); }
      if (t === T_BLDG) { x.fillStyle = pal[1]; x.fillRect(px + 1, py + 1, ts - 2, ts - 2); }
    }
    // centre-line dashes that may run under the patch
    x.fillStyle = '#e0b830';
    this.hRoads.forEach(([a, b]) => { const y = (a + b + 1) / 2 * ts - 1; if (y < ty0 * ts || y > (ty1 + 1) * ts) return; for (let px = 0; px < this.pw; px += 24) if (px >= tx0 * ts - 12 && px <= (tx1 + 1) * ts && this.t(Math.floor(px / ts), a) === T_ROAD) x.fillRect(px, y, 12, 2); });
    this.vRoads.forEach(([a, b]) => { const xx = (a + b + 1) / 2 * ts - 1; if (xx < tx0 * ts || xx > (tx1 + 1) * ts) return; for (let py = 0; py < this.ph; py += 24) if (py >= ty0 * ts - 12 && py <= (ty1 + 1) * ts && this.t(a, Math.floor(py / ts)) === T_ROAD) x.fillRect(xx, py, 2, 12); });
    // any prop overlapping the patch gets drawn again
    const X0 = tx0 * ts, Y0 = ty0 * ts, X1 = (tx1 + 1) * ts, Y1 = (ty1 + 1) * ts;
    this.props.forEach(q => { if (q.taken) return; const img = Sprites.get(q.type); if (!img) return; const hw = img.width * (q.scale || 1) / 2, hh = img.height * (q.scale || 1) / 2; if (q.x + hw < X0 || q.x - hw > X1 || q.y + hh < Y0 || q.y - hh > Y1) return; Sprites.draw(x, q.type, q.x, q.y, { scale: q.scale }); });
    this.flowTx = -1;
  }
  free(tx, ty) { return tx > 0 && ty > 0 && tx < this.w - 1 && ty < this.h - 1 && !this.isSolid(tx, ty); }
  scatterTrees(n, type = 'tree') {
    const R = this.rng;
    for (let i = 0; i < n; i++) {
      const tx = 3 + Math.floor(R() * (this.w - 6)), ty = 3 + Math.floor(R() * (this.h - 6));
      if (this.t(tx, ty) === T_GRASS && !this.isSolid(tx, ty) && this.t(tx + 1, ty) === T_GRASS && this.t(tx, ty + 1) === T_GRASS && !this.isSolid(tx + 1, ty) && !this.isSolid(tx, ty + 1)) this.add(type, tx, ty);
    }
  }
  scatter(types, n, tile) {
    const R = this.rng;
    for (let i = 0; i < n; i++) {
      const tx = 4 + Math.floor(R() * (this.w - 8)), ty = 4 + Math.floor(R() * (this.h - 8));
      if (this.t(tx, ty) === tile && this.free(tx, ty) && Math.hypot(tx * 16 - this.playerStart.x, ty * 16 - this.playerStart.y) > 80) this.add(types[Math.floor(R() * types.length)], tx, ty);
    }
  }

  /* ---------------------------------------------------------- URBAN CITY */
  /* painted maps: the picture is the ground; this builds the collision, spawns, fires and lamps from the authored layout */
  genImage() {
    const L = this.cfg.layout, box = (r, fn) => { for (let y = r[1]; y <= r[3]; y++) for (let x = r[0]; x <= r[2]; x++) fn(x, y); };
    this.solid.fill(1); this.tiles.fill(T_BLDG);
    L.walk.forEach(r => box(r, (x, y) => { this.setSolid(x, y, 0); this.set(x, y, T_ROAD); }));
    L.block.forEach(r => box(r, (x, y) => { this.setSolid(x, y, 1); this.set(x, y, T_BLDG); }));
    this.spawns = L.spawns.map(([x, y]) => ({ x: x * this.ts, y: y * this.ts }));
    this.fires = L.fires.map(([x, y]) => ({ x, y }));
    L.lamps.forEach(([x, y]) => this.props.push({ type: 'lamp', x, y, painted: true }));   // data for the lighting only — the image already shows them
    this.playerStart = { x: L.start[0] * this.ts, y: L.start[1] * this.ts };
  }
  genCity() {
    const W = this.w, H = this.h;
    this.tiles.fill(T_GRASS);
    this.hRoads = [[12, 15], [34, 37]]; this.vRoads = [[18, 21], [58, 61]];
    this.hRoads.forEach(([a, b]) => this.fill(0, a - 1, W - 1, b + 1, T_WALK));
    this.vRoads.forEach(([a, b]) => this.fill(a - 1, 0, b + 1, H - 1, T_WALK));
    this.fill(22, 16, 57, 33, T_WALK); this.fill(24, 18, 55, 31, T_ROAD);
    this.hRoads.forEach(([a, b]) => this.fill(0, a, W - 1, b, T_ROAD));
    this.vRoads.forEach(([a, b]) => this.fill(a, 0, b, H - 1, T_ROAD));
    this.block(0, 0, W - 1, 3); this.block(0, H - 4, W - 1, H - 1); this.block(0, 0, 3, H - 1); this.block(W - 4, 0, W - 1, H - 1);
    for (let x = 4; x < W - 4; x++) { if (this.t(x, 4) === T_GRASS) this.set(x, 4, T_WALK); if (this.t(x, H - 5) === T_GRASS) this.set(x, H - 5, T_WALK); }
    for (let y = 4; y < H - 4; y++) { if (this.t(4, y) === T_GRASS) this.set(4, y, T_WALK); if (this.t(W - 5, y) === T_GRASS) this.set(W - 5, y, T_WALK); }
    [[7, 6, 13, 9], [66, 6, 72, 9], [7, 41, 13, 44], [66, 41, 72, 44], [27, 6, 35, 8], [44, 6, 52, 8], [27, 41, 35, 43], [44, 41, 52, 43], [7, 20, 12, 29], [67, 20, 72, 29]].forEach(b => this.block(...b));
    this.hRoads.forEach(([a, b]) => { this.spawns.push({ x: 1.5 * 16, y: (a + b + 1) / 2 * 16 }); this.spawns.push({ x: (W - 1.5) * 16, y: (a + b + 1) / 2 * 16 }); });
    this.vRoads.forEach(([a, b]) => { this.spawns.push({ x: (a + b + 1) / 2 * 16, y: 1.5 * 16 }); this.spawns.push({ x: (a + b + 1) / 2 * 16, y: (H - 1.5) * 16 }); });
    this.scatterTrees(90);
    [[28, 21], [51, 21], [28, 28], [51, 28]].forEach(([x, y]) => { this.fill(x, y, x + 1, y + 1, T_GRASS); this.add('tree', x, y, { tw: 2, th: 2, scale: 1.5 }); });
    const cars = ['car_red', 'car_blue', 'car_grey'];
    [[24, 13], [33, 13], [47, 13], [64, 13], [24, 35], [40, 35], [55, 35], [8, 13], [70, 35], [30, 19], [46, 30], [36, 24]].forEach(([x, y], i) => this.add(cars[i % 3], x, y, { tw: 2, th: 1 }));
    const wreck = this.add('car_wreck', 40, 20, { tw: 2, th: 1 }); this.fires.push({ x: wreck.x - 4, y: wreck.y - 2 });
    [[26, 25], [27, 25], [26, 26], [53, 24], [53, 25], [34, 30], [45, 19], [24, 18], [55, 31], [40, 27]].forEach(([x, y], i) => this.add(i % 3 === 0 ? 'crate' : 'barrel', x, y));
    [[10, 17], [69, 33], [12, 33], [67, 17]].forEach(([x, y]) => this.add('dumpster', x, y, { tw: 2, th: 1 }));
    [[19, 8], [60, 26], [20, 44], [59, 8], [30, 13], [50, 36], [40, 25]].forEach(([x, y]) => this.add('manhole', x, y, { solid: false }));
    [[16, 10], [23, 16], [56, 16], [63, 10], [16, 38], [63, 38], [23, 33], [56, 33]].forEach(([x, y]) => this.add('stopsign', x, y));
    [[17, 11], [22, 11], [57, 11], [62, 11], [17, 38], [22, 38], [57, 38], [62, 38], [22, 17], [57, 17], [22, 32], [57, 32]].forEach(([x, y]) => this.add('lamp', x, y, { solid: false }));
    [[6, 11], [73, 11], [6, 38], [73, 38], [23, 22], [56, 27]].forEach(([x, y]) => this.add('hydrant', x, y));
    this.marks.push({ type: 'parking', x: 26, y: 30, n: 8 });
  }

  /* ---------------------------------------------------------- SUBURBS */
  genSuburbs() {
    const W = this.w, H = this.h, R = this.rng;
    this.tiles.fill(T_GRASS);
    this.hRoads = [[23, 26]]; this.vRoads = [[38, 41]];
    this.fill(0, 22, W - 1, 27, T_WALK); this.fill(37, 0, 42, H - 1, T_WALK);
    this.fill(0, 23, W - 1, 26, T_ROAD); this.fill(38, 0, 41, H - 1, T_ROAD);
    // hedge perimeter (road openings stay open)
    const hedge = (x0, y0, x1, y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (this.t(x, y) !== T_ROAD) { this.set(x, y, T_HEDGE); this.setSolid(x, y); } };
    hedge(0, 0, W - 1, 1); hedge(0, H - 2, W - 1, H - 1); hedge(0, 0, 1, H - 1); hedge(W - 2, 0, W - 1, H - 1);
    // houses with driveways
    const houses = [];
    [[6, 5], [18, 5], [28, 6], [46, 5], [58, 6], [69, 5], [6, 39], [18, 40], [28, 39], [46, 40], [58, 39], [69, 40], [6, 14], [28, 14], [48, 14], [70, 13], [6, 31], [28, 31], [48, 31], [70, 32]].forEach(([x, y]) => {
      this.block(x, y, x + 6, y + 4); houses.push([x, y]);
      const dy = y < 23 ? 1 : -1; const cx = x + 3; // driveway toward the horizontal road
      for (let yy = (dy > 0 ? y + 5 : y - 1); yy >= 0 && yy < H && this.t(cx, yy) === T_GRASS; yy += dy) { this.set(cx, yy, T_WALK); this.set(cx + 1, yy, T_WALK); }
      // small front path stops after 6 tiles to keep lawns open
    });
    this.spawns.push({ x: 1.5 * 16, y: 25 * 16 }, { x: (W - 1.5) * 16, y: 25 * 16 }, { x: 40 * 16, y: 1.5 * 16 }, { x: 40 * 16, y: (H - 1.5) * 16 });
    this.scatterTrees(150);
    this.scatter(['bush'], 60, T_GRASS);
    // picket fences along some lawns (decorative, non-solid)
    houses.forEach(([x, y], i) => { if (i % 2) return; const fy = y < 23 ? y + 8 : y - 3; for (let fx = x - 1; fx <= x + 7; fx++) if (this.t(fx, fy) === T_GRASS && !this.isSolid(fx, fy)) this.add('fence_h', fx, fy, { solid: false }); });
    const cars = ['car_red', 'car_blue', 'car_grey'];
    [[10, 24], [30, 24], [52, 24], [66, 24], [39, 10], [39, 36], [20, 11], [61, 34]].forEach(([x, y], i) => this.add(cars[i % 3], x, y, { tw: 2, th: 1 }));
    const wreck = this.add('car_wreck', 44, 24, { tw: 2, th: 1 }); this.fires.push({ x: wreck.x - 4, y: wreck.y - 2 });
    [[36, 20], [43, 20], [36, 29], [43, 29]].forEach(([x, y]) => this.add('lamp', x, y, { solid: false }));
    [[35, 21], [44, 28]].forEach(([x, y]) => this.add('hydrant', x, y));
    [[12, 20], [60, 30], [24, 33]].forEach(([x, y]) => this.add('manhole', x, y, { solid: false }));
    this.scatter(['crate', 'barrel'], 12, T_WALK);
  }

  /* ---------------------------------------------------------- INDUSTRIAL */
  genIndustrial() {
    const W = this.w, H = this.h;
    this.tiles.fill(T_ROAD);
    // gravel patches
    this.fill(4, 4, 20, 10, T_GRASS); this.fill(60, 40, 76, 46, T_GRASS); this.fill(4, 40, 14, 46, T_GRASS); this.fill(64, 4, 76, 9, T_GRASS);
    // perimeter walls with 4 gates
    this.block(0, 0, W - 1, 2); this.block(0, H - 3, W - 1, H - 1); this.block(0, 0, 2, H - 1); this.block(W - 3, 0, W - 1, H - 1);
    const gate = (x0, y0, x1, y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { this.set(x, y, T_ROAD); this.setSolid(x, y, 0); } };
    gate(38, 0, 41, 2); gate(38, H - 3, 41, H - 1); gate(0, 23, 2, 26); gate(W - 3, 23, W - 1, 26);
    this.spawns.push({ x: 40 * 16, y: 1.5 * 16 }, { x: 40 * 16, y: (H - 1.5) * 16 }, { x: 1.5 * 16, y: 25 * 16 }, { x: (W - 1.5) * 16, y: 25 * 16 });
    // warehouses
    [[8, 12, 24, 19], [56, 12, 72, 19], [8, 30, 24, 37], [56, 30, 72, 37], [30, 4, 50, 8], [30, 41, 50, 45], [28, 20, 33, 29], [46, 20, 51, 29]].forEach(b => this.block(...b));
    // walkways / painted lanes around the centre
    this.fill(34, 18, 45, 18, T_WALK); this.fill(34, 31, 45, 31, T_WALK); this.fill(34, 18, 34, 31, T_WALK); this.fill(45, 18, 45, 31, T_WALK);
    // containers
    const cont = ['container_red', 'container_blue', 'container_yellow'];
    [[10, 22], [10, 24], [14, 26], [64, 22], [64, 24], [60, 26], [26, 10], [52, 10], [26, 38], [52, 38], [4, 12], [73, 35], [36, 12], [42, 35]].forEach(([x, y], i) => this.add(cont[i % 3], x, y, { tw: 3, th: 1 }));
    // barrels, crates, burning barrels
    this.scatter(['barrel', 'barrel', 'crate'], 60, T_ROAD);
    [[36, 22], [44, 27], [20, 6], [60, 44]].forEach(([x, y]) => { const b = this.add('barrel', x, y); this.fires.push({ x: b.x, y: b.y - 6 }); });
    [[6, 25], [73, 25], [40, 10], [40, 40]].forEach(([x, y]) => this.add('dumpster', x, y, { tw: 2, th: 1 }));
    [[33, 17], [46, 17], [33, 32], [46, 32], [8, 11], [24, 20], [56, 20], [72, 38]].forEach(([x, y]) => this.add('lamp', x, y, { solid: false }));
    this.marks.push({ type: 'hazard', x: 34, y: 17, w: 12 }, { type: 'hazard', x: 34, y: 32, w: 12 });
  }

  /* ---------------------------------------------------------- RACE CITY */
  genRace() {
    const W = this.w, H = this.h, R = this.rng;
    const inRR = (x, y, x0, y0, x1, y1, r) => { const cx = Math.max(x0 + r, Math.min(x1 - r, x)), cy = Math.max(y0 + r, Math.min(y1 - r, y)); return Math.hypot(x - cx, y - cy) <= r; };
    const outer = [9, 9, 110, 66, 20], inner = [21, 21, 98, 54, 12];
    this.tiles.fill(T_GRASS);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const cx = x + 0.5, cy = y + 0.5; if (inRR(cx, cy, ...outer) && !inRR(cx, cy, ...inner)) this.set(x, y, T_ROAD); }
    this.track = (x, y) => this.t(x, y) === T_ROAD;
    // pit lane + garages inside the bottom straight, paddock behind them
    this.fill(34, 50, 86, 53, T_WALK); this.fill(34, 44, 86, 49, T_WALK);
    this.block(38, 45, 82, 47);                                   // garage row
    for (let x = 41; x <= 79; x += 6) { this.set(x, 47, T_WALK); this.setSolid(x, 47, 0); this.set(x + 1, 47, T_WALK); this.setSolid(x + 1, 47, 0); } // garage doors
    // grandstand along the top straight, parking lot at the bottom
    this.block(0, 0, W - 1, 1); this.block(0, H - 2, W - 1, H - 1); this.block(0, 0, 1, H - 1); this.block(W - 2, 0, W - 1, H - 1);
    this.block(24, 2, 96, 6); this.fill(24, 7, 96, 7, T_WALK);
    this.fill(30, 68, 90, 72, T_WALK);
    // gates in the perimeter = spawn points
    const gate = (x0, y0, x1, y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { this.set(x, y, T_WALK); this.setSolid(x, y, 0); } };
    gate(10, 0, 13, 1); gate(106, 0, 109, 1); gate(58, H - 2, 61, H - 1); gate(0, 36, 1, 39); gate(W - 2, 36, W - 1, 39);
    this.spawns.push({ x: 12 * 16, y: 1 * 16 }, { x: 108 * 16, y: 1 * 16 }, { x: 60 * 16, y: (H - 1) * 16 }, { x: 1 * 16, y: 38 * 16 }, { x: (W - 1) * 16, y: 38 * 16 });
    this.hRoads = []; this.vRoads = [];
    // tire walls hugging the outside of the four corners, cones and barriers around the pits
    const tireRing = (x0, y0, x1, y1, r, sign) => { for (let a = 0; a < Math.PI * 2; a += 0.11) { const cx = a < Math.PI / 2 ? x1 - r : a < Math.PI ? x0 + r : a < Math.PI * 1.5 ? x0 + r : x1 - r, cy = a < Math.PI ? y0 + r : y1 - r; const px = cx + Math.cos(a) * (r + sign), py = cy + Math.sin(a) * (r + sign); const tx = Math.floor(px), ty = Math.floor(py); if (this.t(tx, ty) === T_GRASS && !this.isSolid(tx, ty) && (Math.abs(Math.cos(a)) > 0.35 && Math.abs(Math.sin(a)) > 0.35)) this.add('tires', tx, ty); } };
    tireRing(9, 9, 110, 66, 20, 1.2); tireRing(21, 21, 98, 54, 12, -1.5);
    [[36, 54], [84, 54], [36, 49], [84, 49]].forEach(([x, y]) => this.add('cone', x, y, { solid: false }));
    for (let i = 0; i < 14; i++) this.add('cone', 40 + i * 3, 54, { solid: false });
    // paddock: race cars, crew crates, barrels
    const cars = ['car_red', 'car_blue', 'car_yellow', 'car_white', 'car_grey'];
    [[40, 44], [46, 44], [52, 44], [58, 44], [64, 44], [70, 44], [76, 44]].forEach(([x, y], i) => this.add(cars[i % cars.length], x, y, { tw: 2, th: 1 }));
    [[32, 69], [36, 69], [40, 69], [48, 71], [52, 71], [60, 69], [66, 69], [74, 71], [78, 71], [84, 69]].forEach(([x, y], i) => this.add(cars[(i + 2) % cars.length], x, y, { tw: 2, th: 1 }));
    const wreck = this.add('car_wreck', 92, 60, { tw: 2, th: 1 }); this.fires.push({ x: wreck.x - 4, y: wreck.y - 2 });
    [[35, 45], [36, 45], [84, 45], [85, 45], [37, 52], [83, 52]].forEach(([x, y], i) => this.add(i % 2 ? 'barrel' : 'crate', x, y));
    [[44, 70], [70, 70]].forEach(([x, y]) => this.add('dumpster', x, y, { tw: 2, th: 1 }));
    // trees on the outer grass and the infield, lamps (floodlights) around the track
    this.scatterTrees(120); this.scatter(['bush'], 40, T_GRASS);
    [[20, 8], [100, 8], [8, 30], [8, 46], [111, 30], [111, 46], [30, 57], [90, 57], [60, 22]].forEach(([x, y]) => this.add('lamp', x, y, { solid: false }));
    this.playerStart = { x: 60 * 16, y: 61 * 16 };
    this.marks.push({ type: 'startline', x: 60, y0: 55, y1: 66 }, { type: 'curbs' });
    // ---- the haunted house in the infield: the objective of every wave on this map ----
    const hx = 54, hy = 30; this.house = { tx: hx, ty: hy, tw: HOUSE.tw, th: HOUSE.th, x: (hx + HOUSE.tw / 2) * 16, y: (hy + HOUSE.th / 2) * 16, w: HOUSE.tw * 16, h: HOUSE.th * 16 };
    this.house.door = { x: this.house.x, y: (hy + HOUSE.th) * 16 + 6 };
    for (let y = hy; y < hy + HOUSE.th; y++) for (let x = hx; x < hx + HOUSE.tw; x++) this.setSolid(x, y);
    const cx = this.house.x, cy = this.house.y;
    this.cannonPos = [[-120, -80], [120, -80], [-120, 90], [120, 90]].map(([dx, dy]) => ({ x: cx + dx, y: cy + dy }));
    this.guardPosts = []; for (let i = 0; i < 20; i++) { const a = i / 20 * Math.PI * 2 + 0.15, r = 150 + (i % 2) * 40; this.guardPosts.push({ x: cx + Math.cos(a) * r * 1.35, y: cy + Math.sin(a) * r }); }
    // cover for the player: sandbag walls and concrete barriers in a wide ring, facing the house
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 + 0.3, tx = Math.floor((cx + Math.cos(a) * 330) / 16), ty = Math.floor((cy + Math.sin(a) * 235) / 16); if (this.t(tx, ty) === T_GRASS && this.free(tx, ty) && this.free(tx + 1, ty)) this.add(i % 3 === 0 ? 'barrier' : 'sandbags', tx, ty, { tw: 2, th: 1 }); }
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2, tx = Math.floor((cx + Math.cos(a) * 430) / 16), ty = Math.floor((cy + Math.sin(a) * 300) / 16); if (this.t(tx, ty) === T_GRASS && this.free(tx, ty) && this.free(tx + 1, ty)) this.add('sandbags', tx, ty, { tw: 2, th: 1 }); }
    // graveyard dressing: dead trees, headstones, old blood
    for (let i = 0; i < 14; i++) { const a = R() * Math.PI * 2, r = 130 + R() * 120; const tx = Math.floor((cx + Math.cos(a) * r * 1.3) / 16), ty = Math.floor((cy + Math.sin(a) * r) / 16); if (this.t(tx, ty) === T_GRASS && this.free(tx, ty)) this.add(R() < 0.45 ? 'deadtree' : 'grave', tx, ty); }
    this.props = this.props.filter(p => !(p.type === 'tree' && Math.abs(p.x - cx) < 300 && Math.abs(p.y - cy) < 200)); // no cheerful trees near the house
  }

  /* ---------------------------------------------------------- RESEARCH LAB */
  genLab() {
    const W = this.w, H = this.h;
    const wall = (x0, y0, x1, y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { this.set(x, y, T_BLDG); this.setSolid(x, y); } };
    const door = (x0, y0, x1, y1, t = T_WALK) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { this.set(x, y, t); this.setSolid(x, y, 0); } };
    const glass = (x0, y0, x1, y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { this.set(x, y, T_HEDGE); this.setSolid(x, y); } };
    this.tiles.fill(T_ROAD);                                   // white lab tiles everywhere by default
    // corridors (darker floor)
    this.fill(41, 0, 45, H - 1, T_WALK);                        // main north-south corridor
    this.fill(46, 24, W - 1, 27, T_WALK);                       // east wing corridor
    this.fill(0, 24, 3, 27, T_WALK);                            // west entrance
    this.fill(4, 2, 40, 14, T_GRASS);                           // server hall floor (dark)
    // outer shell
    wall(0, 0, W - 1, 1); wall(0, H - 2, W - 1, H - 1); wall(0, 0, 1, H - 1); wall(W - 2, 0, W - 1, H - 1);
    // west wing walls
    wall(2, 15, 40, 15);                                        // server hall / lab divider
    wall(40, 2, 40, 47);                                        // west wing east wall (corridor side)
    wall(22, 34, 22, 47); wall(22, 34, 40, 34);                 // storage room (SE of the lab)
    wall(2, 40, 12, 40); wall(12, 40, 12, 47);                  // side chamber (SW)
    // east wing walls
    wall(46, 2, 46, 47);                                        // corridor east wall
    wall(46, 15, 78, 15); wall(60, 2, 60, 15);                  // meeting room / offices
    wall(46, 23, 78, 23); wall(46, 28, 78, 28);                 // corridor walls
    wall(60, 28, 60, 39); wall(46, 39, 78, 39);                 // lower offices / annex
    wall(62, 40, 62, 47); wall(68, 40, 68, 47); wall(74, 40, 74, 47); // restroom stalls
    glass(23, 16, 23, 33);                                      // glass partition between lab benches and the tank room
    // doors
    door(20, 15, 22, 15, T_GRASS); door(30, 15, 32, 15, T_GRASS);           // server hall <-> lab
    door(40, 8, 40, 10); door(40, 20, 40, 22); door(40, 30, 40, 32); door(40, 42, 40, 44); // west wing <-> corridor
    door(30, 34, 32, 34, T_ROAD); door(6, 40, 8, 40, T_ROAD); door(23, 24, 23, 26, T_ROAD); // storage, side chamber, glass door
    door(46, 8, 46, 10); door(46, 32, 46, 34); door(46, 43, 46, 45);         // corridor <-> east rooms
    door(60, 8, 60, 10); door(66, 15, 68, 15); door(52, 15, 54, 15);         // meeting/offices
    door(52, 23, 54, 23); door(66, 23, 68, 23); door(52, 28, 54, 28); door(66, 28, 68, 28); door(60, 32, 60, 34);
    door(52, 39, 54, 39); door(64, 39, 66, 39); door(70, 39, 72, 39); door(76, 39, 77, 39);
    door(63, 40, 63, 47, T_ROAD); door(69, 40, 69, 47, T_ROAD); door(75, 40, 77, 47, T_ROAD);
    // exits to the outside world = spawn points
    door(41, 0, 45, 1); door(41, H - 2, 45, H - 1); door(0, 24, 1, 27); door(W - 2, 24, W - 1, 27);
    this.spawns.push({ x: 43 * 16, y: 1 * 16 }, { x: 43 * 16, y: (H - 1) * 16 }, { x: 1 * 16, y: 25.5 * 16 }, { x: (W - 1) * 16, y: 25.5 * 16 });
    this.hRoads = []; this.vRoads = [];
    // ---- furniture ----
    for (let r = 0; r < 4; r++) for (let i = 0; i < 9; i++) if (i !== 4) this.add('server', 6 + i * 4, 3 + r * 3, { th: 1 });   // server racks in rows with a middle aisle
    [[6, 18], [6, 22], [6, 26], [6, 30], [14, 18], [14, 22], [14, 26], [14, 30]].forEach(([x, y]) => this.add('bench', x, y, { tw: 2, th: 1 }));
    [[26, 17], [30, 17], [34, 17], [26, 31], [30, 31], [34, 31]].forEach(([x, y]) => this.add('tank', x, y, { th: 1 }));  // specimen tanks
    [[27, 22], [33, 22], [27, 26], [33, 26]].forEach(([x, y]) => this.add('desk', x, y, { tw: 2, th: 1 }));
    [[25, 37], [27, 37], [25, 39], [36, 44], [38, 44], [36, 46]].forEach(([x, y]) => this.add('hazmat', x, y));
    [[30, 42], [32, 42], [30, 44]].forEach(([x, y]) => this.add('crate', x, y));
    [[4, 43], [8, 43]].forEach(([x, y]) => this.add('bench', x, y, { tw: 2, th: 1 }));
    this.add('table', 50, 8, { tw: 3, th: 1 }); this.add('sofa', 49, 3, { tw: 2, th: 1 }); this.add('plant', 57, 3); this.add('plant', 48, 12);
    [[63, 4], [70, 4], [63, 10], [70, 10]].forEach(([x, y]) => this.add('desk', x, y, { tw: 2, th: 1 }));
    [[49, 30], [55, 30], [49, 35], [55, 35]].forEach(([x, y]) => this.add('desk', x, y, { tw: 2, th: 1 }));
    [[64, 30], [64, 34], [72, 30], [72, 34]].forEach(([x, y]) => this.add('bench', x, y, { tw: 2, th: 1 }));
    [[68, 32]].forEach(([x, y]) => this.add('tank', x, y, { th: 1 }));
    [[48, 42], [54, 42], [48, 45], [54, 45]].forEach(([x, y]) => this.add('toilet', x, y)); [[65, 45], [71, 45]].forEach(([x, y]) => this.add('toilet', x, y));
    [[20, 12], [8, 8], [36, 4]].forEach(([x, y]) => this.add('crate', x, y));
    [[42, 5], [44, 20], [42, 36], [44, 46], [70, 25]].forEach(([x, y]) => this.add('lamp', x, y, { solid: false }));
    this.playerStart = { x: 18 * 16, y: 25 * 16 };
    this.marks.push({ type: 'hazard', x: 24, y: 35, w: 6 }, { type: 'hazard', x: 41, y: 2, w: 5 });
  }

  /* ---------------------------------------------------------- render */
  render() {
    if (this.cfg.image) return this.renderImage();
    const c = document.createElement('canvas'); c.width = this.pw; c.height = this.ph;
    const x = c.getContext('2d'); const ts = this.ts; const R = mulberry32(42); const T = this.theme;
    for (let ty = 0; ty < this.h; ty++) for (let tx = 0; tx < this.w; tx++) {
      const t = this.t(tx, ty), px = tx * ts, py = ty * ts;
      if (t === T_ROAD && this.id === 'lab') {
        x.fillStyle = T.road[0]; x.fillRect(px, py, ts, ts); x.fillStyle = T.road[1]; x.fillRect(px, py, ts, 1); x.fillRect(px, py, 1, ts); x.fillStyle = T.road[2]; x.fillRect(px + 1, py + 1, 6, 1);
        if (R() < 0.05) { x.fillStyle = '#b8bcc6'; x.fillRect(px + 5, py + 6, 5, 3); }
      } else if (t === T_ROAD) {
        x.fillStyle = T.road[0]; x.fillRect(px, py, ts, ts);
        for (let i = 0; i < 5; i++) { x.fillStyle = R() < 0.5 ? T.road[1] : T.road[2]; x.fillRect(px + Math.floor(R() * ts), py + Math.floor(R() * ts), 2, 1); }
        if (R() < 0.04) { x.fillStyle = T.road[1]; x.fillRect(px + 3, py + 8, 9, 1); x.fillRect(px + 8, py + 4, 1, 5); }
      } else if (t === T_WALK) {
        x.fillStyle = T.walk[0]; x.fillRect(px, py, ts, ts);
        x.fillStyle = T.walk[1]; x.fillRect(px, py, ts, 1); x.fillRect(px, py, 1, ts);
        x.fillStyle = T.walk[2]; x.fillRect(px + 1, py + 1, ts - 1, 1);
        if (R() < 0.08) { x.fillStyle = T.walk[1]; x.fillRect(px + 4 + Math.floor(R() * 6), py + 4 + Math.floor(R() * 6), 2, 2); }
      } else if (t === T_GRASS && this.id === 'lab') {
        x.fillStyle = T.grass[0]; x.fillRect(px, py, ts, ts); x.fillStyle = T.grass[1]; x.fillRect(px, py + 7, ts, 2); if (tx % 3 === 0) { x.fillStyle = T.grass[2]; x.fillRect(px + 3, py, 1, ts); }
        if (R() < 0.04) { x.fillStyle = '#5fd35a'; x.fillRect(px + 12, py + 3, 2, 1); }
      } else if (t === T_GRASS) {
        x.fillStyle = T.grass[0]; x.fillRect(px, py, ts, ts);
        for (let i = 0; i < 6; i++) { x.fillStyle = R() < 0.5 ? T.grass[1] : T.grass[2]; x.fillRect(px + Math.floor(R() * ts), py + Math.floor(R() * ts), 1, 2); }
        if (this.id !== 'industrial' && R() < 0.05) { x.fillStyle = R() < 0.5 ? '#f0c419' : '#e8e0d0'; x.fillRect(px + Math.floor(R() * 14), py + Math.floor(R() * 14), 2, 2); }
      } else if (t === T_HEDGE && this.id === 'lab') { // glass partition
        x.fillStyle = 'rgba(47,216,255,0.35)'; x.fillRect(px, py, ts, ts); x.fillStyle = '#8af0ff'; x.fillRect(px + 7, py, 2, ts); x.fillStyle = '#1a3a44'; x.fillRect(px + 6, py, 1, ts); x.fillRect(px + 9, py, 1, ts);
      } else if (t === T_HEDGE) {
        x.fillStyle = T.hedge[0]; x.fillRect(px, py, ts, ts);
        for (let i = 0; i < 8; i++) { x.fillStyle = T.hedge[1]; x.fillRect(px + Math.floor(R() * 14), py + Math.floor(R() * 14), 2, 2); }
      } else {
        x.fillStyle = T.bldg[0]; x.fillRect(px, py, ts, ts);
        x.fillStyle = T.bldg[1]; x.fillRect(px + 1, py + 1, ts - 2, ts - 2);
        if (this.id === 'suburbs') { x.fillStyle = T.bldg[3]; for (let i = 0; i < ts; i += 4) x.fillRect(px, py + i, ts, 1); x.fillStyle = T.bldg[2]; x.fillRect(px + (tx % 2) * 8, py + 1, 8, 3); }
        else if (this.id === 'race') { x.fillStyle = T.bldg[2]; for (let i = 2; i < ts; i += 4) x.fillRect(px + 1, py + i, ts - 2, 2); x.fillStyle = (tx + ty) % 5 === 0 ? '#d3372b' : (tx * 3 + ty) % 7 === 0 ? '#3f7fd8' : T.bldg[3]; x.fillRect(px + 4, py + 6, 3, 2); }
        else if (this.id === 'lab') { x.fillStyle = T.bldg[2]; x.fillRect(px + 2, py + 2, ts - 4, ts - 4); x.fillStyle = T.bldg[3]; x.fillRect(px + 2, py + ts - 4, ts - 4, 2); }
        else if (this.id === 'industrial') { x.fillStyle = T.bldg[2]; for (let i = 0; i < ts; i += 4) x.fillRect(px + i, py, 1, ts); if (R() < 0.05) { x.fillStyle = T.bldg[3]; x.fillRect(px + 3, py + 3, 10, 10); x.fillStyle = T.bldg[0]; x.fillRect(px + 5, py + 5, 6, 6); } }
        else { x.fillStyle = T.bldg[2]; if ((tx + ty) % 3 === 0) x.fillRect(px + 4, py + 4, 8, 8); if (R() < 0.06) { x.fillStyle = T.bldg[3]; x.fillRect(px + 3, py + 3, 10, 10); x.fillStyle = T.bldg[0]; x.fillRect(px + 5, py + 5, 6, 6); } }
      }
    }
    // building edges
    x.fillStyle = '#1b1c22';
    for (let ty = 0; ty < this.h; ty++) for (let tx = 0; tx < this.w; tx++) {
      if (this.t(tx, ty) !== T_BLDG) continue;
      const n = ty > 0 && this.t(tx, ty - 1) !== T_BLDG, s = ty < this.h - 1 && this.t(tx, ty + 1) !== T_BLDG, w = tx > 0 && this.t(tx - 1, ty) !== T_BLDG, e = tx < this.w - 1 && this.t(tx + 1, ty) !== T_BLDG;
      if (n) x.fillRect(tx * ts, ty * ts, ts, 2); if (s) x.fillRect(tx * ts, ty * ts + ts - 3, ts, 3); if (w) x.fillRect(tx * ts, ty * ts, 2, ts); if (e) x.fillRect(tx * ts + ts - 2, ty * ts, 2, ts);
      if (s) { x.fillStyle = this.id === 'suburbs' ? '#3a2018' : '#4a4c58'; x.fillRect(tx * ts + 2, ty * ts + ts - 6, 3, 2); x.fillRect(tx * ts + 9, ty * ts + ts - 6, 3, 2); x.fillStyle = '#1b1c22'; }
    }
    // road markings
    x.fillStyle = '#e0b830';
    this.hRoads.forEach(([a, b]) => { const y = (a + b + 1) / 2 * ts - 1; for (let px = 0; px < this.pw; px += 24) if (this.t(Math.floor(px / ts), a) === T_ROAD) x.fillRect(px, y, 12, 2); });
    this.vRoads.forEach(([a, b]) => { const xx = (a + b + 1) / 2 * ts - 1; for (let py = 0; py < this.ph; py += 24) if (this.t(a, Math.floor(py / ts)) === T_ROAD) x.fillRect(xx, py, 2, 12); });
    x.fillStyle = '#d8d8d0';
    this.hRoads.forEach(([a, b]) => this.vRoads.forEach(([c0, c1]) => {
      for (let i = 0; i < 4; i++) { const yy = a * ts + 2 + i * 16; x.fillRect((c0 - 3) * ts + 2, yy, 6, 10); x.fillRect((c1 + 2) * ts + 8, yy, 6, 10); }
      for (let i = 0; i < 4; i++) { const xx = c0 * ts + 2 + i * 16; x.fillRect(xx, (a - 3) * ts + 2, 10, 6); x.fillRect(xx, (b + 2) * ts + 8, 10, 6); }
    }));
    this.marks.forEach(m => {
      if (m.type === 'curbs') { // red/white kerbs wherever track meets grass
        for (let ty = 0; ty < this.h; ty++) for (let tx = 0; tx < this.w; tx++) {
          if (this.t(tx, ty) !== T_ROAD) continue; const px = tx * ts, py = ty * ts; const col = (tx + ty) % 2 ? '#d3372b' : '#e8e6dc';
          if (this.t(tx, ty - 1) === T_GRASS) { x.fillStyle = col; x.fillRect(px, py, ts, 3); } if (this.t(tx, ty + 1) === T_GRASS) { x.fillStyle = col; x.fillRect(px, py + ts - 3, ts, 3); }
          if (this.t(tx - 1, ty) === T_GRASS) { x.fillStyle = col; x.fillRect(px, py, 3, ts); } if (this.t(tx + 1, ty) === T_GRASS) { x.fillStyle = col; x.fillRect(px + ts - 3, py, 3, ts); }
        }
      }
      if (m.type === 'startline') { for (let ty = m.y0; ty <= m.y1; ty++) if (this.t(m.x, ty) === T_ROAD) for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) { x.fillStyle = (i + j) % 2 ? '#e8e6dc' : '#111'; x.fillRect(m.x * ts + j * 4, ty * ts + i * 4, 4, 4); } }
      if (m.type === 'parking') { x.fillStyle = '#b8b8b0'; for (let i = 0; i < m.n; i++) x.fillRect((m.x + i * 4) * ts, m.y * ts, 2, 24); }
      if (m.type === 'hazard') { for (let i = 0; i < m.w * ts; i += 6) { x.fillStyle = (i / 6) % 2 ? '#e0b830' : '#1b1c22'; x.fillRect(m.x * ts + i, m.y * ts + 6, 6, 4); } }
    });
    this.props.forEach(p => { if (!p.taken) Sprites.draw(x, p.type, p.x, p.y, { scale: p.scale }); });
    x.fillStyle = 'rgba(0,0,0,0.12)';
    if (this.id !== 'lab') for (let i = 0; i < 60; i++) { const px = R() * this.pw, py = R() * this.ph; if (this.t(Math.floor(px / ts), Math.floor(py / ts)) === T_ROAD) { x.beginPath(); x.arc(px, py, 6 + R() * 14, 0, 7); x.fill(); } }
    this.canvas = c;
  }

  /* ---------------------------------------------------------- collision */
  resolve(x, y, r) {
    const ts = this.ts;
    if (this.isSolid(Math.floor(x / ts), Math.floor(y / ts))) { const u = this.unstick(x, y); x = u.x; y = u.y; }
    const tx0 = Math.floor((x - r) / ts), tx1 = Math.floor((x + r) / ts), ty0 = Math.floor((y - r) / ts), ty1 = Math.floor((y + r) / ts);
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      if (!this.isSolid(tx, ty)) continue;
      const cx = Math.max(tx * ts, Math.min(x, tx * ts + ts)), cy = Math.max(ty * ts, Math.min(y, ty * ts + ts));
      let dx = x - cx, dy = y - cy; const d2 = dx * dx + dy * dy;
      if (d2 >= r * r) continue;
      const d = Math.sqrt(d2) || 0.001;
      if (d < 0.01) { dx = 0; dy = -1; }
      const push = r - d; x += dx / d * push; y += dy / d * push;
    }
    x = Math.max(r, Math.min(this.pw - r, x)); y = Math.max(r, Math.min(this.ph - r, y));
    return { x, y };
  }
  unstick(x, y) {
    const ts = this.ts, tx = Math.floor(x / ts), ty = Math.floor(y / ts);
    for (let ring = 1; ring < 8; ring++) {
      let best = null, bd = 1e9;
      for (let dy = -ring; dy <= ring; dy++) for (let dx = -ring; dx <= ring; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
        const nx = tx + dx, ny = ty + dy; if (this.isSolid(nx, ny)) continue;
        const cx = nx * ts + ts / 2, cy = ny * ts + ts / 2, d = Math.hypot(cx - x, cy - y); if (d < bd) { bd = d; best = { x: cx, y: cy }; }
      }
      if (best) return best;
    }
    return { x, y };
  }
  solidAt(x, y) { return this.isSolid(Math.floor(x / this.ts), Math.floor(y / this.ts)); }
  /* line of sight between two points (no solid tile in between) */
  los(x1, y1, x2, y2) {
    const d = Math.hypot(x2 - x1, y2 - y1), n = Math.ceil(d / 6);
    for (let i = 1; i < n; i++) { const t = i / n; if (this.solidAt(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t)) return false; }
    return true;
  }

  /* ---------------------------------------------------------- flow field */
  computeFlow(px, py) {
    const W = this.w, H = this.h, tx = clamp(Math.floor(px / this.ts), 0, W - 1), ty = clamp(Math.floor(py / this.ts), 0, H - 1);
    if (this.flow && this.flowTx === tx && this.flowTy === ty) return;
    this.flowTx = tx; this.flowTy = ty;
    const f = this.flow || (this.flow = new Int16Array(W * H)); f.fill(-1);
    const q = this._q || (this._q = new Int32Array(W * H)); let qh = 0, qt = 0;
    f[ty * W + tx] = 0; q[qt++] = ty * W + tx;
    while (qh < qt) {
      const i = q[qh++], x = i % W, y = (i / W) | 0, d = f[i] + 1;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue; const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const ni = ny * W + nx; if (f[ni] !== -1 || this.solid[ni]) continue;
        if (dx && dy && (this.solid[y * W + nx] || this.solid[ny * W + x])) continue;
        f[ni] = d; q[qt++] = ni;
      }
    }
  }
  flowDir(x, y) {
    if (!this.flow) return null;
    const W = this.w, tx = clamp(Math.floor(x / this.ts), 0, W - 1), ty = clamp(Math.floor(y / this.ts), 0, this.h - 1);
    const here = this.flow[ty * W + tx]; if (here <= 1) return null;
    let best = here, bx = 0, by = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue; const nx = tx + dx, ny = ty + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= this.h) continue;
      const v = this.flow[ny * W + nx]; if (v === -1) continue;
      if (dx && dy && (this.solid[ty * W + nx] || this.solid[ny * W + tx])) continue;
      if (v < best) { best = v; bx = nx; by = ny; }
    }
    if (best === here) return null;
    const cx = bx * this.ts + this.ts / 2, cy = by * this.ts + this.ts / 2; const d = Math.hypot(cx - x, cy - y) || 1;
    return { x: (cx - x) / d, y: (cy - y) / d };
  }

  splat(x, y, size, color) {
    const c = this.dctx; c.fillStyle = color;
    for (let i = 0; i < 5; i++) { const a = Math.random() * 7, d = Math.random() * size; c.beginPath(); c.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, 1 + Math.random() * size * 0.5, 0, 7); c.fill(); }
  }
  renderImage() {
    const c = document.createElement('canvas'); c.width = this.pw; c.height = this.ph; this.canvas = c;
    const x = c.getContext('2d'); x.fillStyle = '#0b0d12'; x.fillRect(0, 0, c.width, c.height);   // until the picture arrives
    // map pictures are immutable (a changed picture gets a new file name), so no ?v= — that also lets the <head> preload be reused
    const load = (url, done) => { const img = new Image(); img.onload = () => done(img); img.onerror = () => done(null); img.src = url; };
    const main = () => load(this.cfg.image, img => {
      if (!img) return;
      x.imageSmoothingEnabled = false; x.drawImage(img, 0, 0, this.pw, this.ph);
      this.image = img; this._mini = null;
      if (window.ui && window.ui.renderMapPreviews) window.ui.renderMapPreviews();   // the map-select card can show it now
    });
    if (!this.cfg.menuImage) return main();
    // the title screen's lighter grade goes first; the heavier gameplay picture follows so it can't slow the title down
    load(this.cfg.menuImage, mi => {
      if (mi) { const m = document.createElement('canvas'); m.width = this.pw; m.height = this.ph; const mx = m.getContext('2d'); mx.imageSmoothingEnabled = false; mx.drawImage(mi, 0, 0, this.pw, this.ph); this.menuCanvas = m; }
      else this.menuFailed = true;
      main();
    });
  }
  draw(ctx, camX, camY, vw, vh, menu) {
    ctx.drawImage(menu && this.menuCanvas || this.canvas, camX, camY, vw, vh, 0, 0, vw, vh);
    ctx.drawImage(this.decals, camX, camY, vw, vh, 0, 0, vw, vh);
  }
  /* real thumbnail of the rendered level for the map-select cards */
  drawPreview(canvas) {
    const c = canvas.getContext('2d'); c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
    const W = canvas.width, H = canvas.height, sx = W / this.pw, sy = H / this.ph;
    c.drawImage(this.canvas, 0, 0, this.pw, this.ph, 0, 0, W, H);
    c.drawImage(this.decals, 0, 0, this.pw, this.ph, 0, 0, W, H);
    c.fillStyle = this.cfg.tint; c.fillRect(0, 0, W, H);
    if (this.cfg.dark) { // the horror map: nearly black, only fires and working lamps visible
      c.fillStyle = 'rgba(1,2,6,0.8)'; c.fillRect(0, 0, W, H);
      const glow = (x, y, r, col) => { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); };
      this.fires.forEach(f => glow(f.x * sx, f.y * sy, 22 * sx * 4, 'rgba(255,150,50,0.85)'));
      this.lamps.forEach(l => { if (!l.broken) glow(l.x * sx, l.y * sy, 14 * sx * 4, 'rgba(255,240,200,0.55)'); });
    }
    const vg = c.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, H); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.45)'); c.fillStyle = vg; c.fillRect(0, 0, W, H);
  }
  /* minimap / preview */
  drawMinimap(canvas, player, zombies, pickups) {
    const c = canvas.getContext('2d'); c.imageSmoothingEnabled = false;
    if (!this._mini) {
      const m = document.createElement('canvas'); m.width = this.w; m.height = this.h; const mc = m.getContext('2d');
      if (this.image) { mc.imageSmoothingEnabled = true; mc.drawImage(this.image, 0, 0, this.w, this.h); this._mini = m; }
      else {
      for (let ty = 0; ty < this.h; ty++) for (let tx = 0; tx < this.w; tx++) { mc.fillStyle = this.theme.mini[this.t(tx, ty)]; mc.fillRect(tx, ty, 1, 1); }
      this.props.forEach(p => { if (p.type === 'tree') { mc.fillStyle = '#2f6b2a'; mc.fillRect(Math.floor(p.x / this.ts), Math.floor(p.y / this.ts), 1, 1); } if (p.type === 'tank') { mc.fillStyle = '#2fd8ff'; mc.fillRect(Math.floor(p.x / this.ts), Math.floor(p.y / this.ts), 1, 1); } });
      this._mini = m;
      }
    }
    const s = Math.min(canvas.width / this.w, canvas.height / this.h), ox = (canvas.width - this.w * s) / 2, oy = (canvas.height - this.h * s) / 2;
    c.fillStyle = 'rgba(10,12,18,0.85)'; c.fillRect(0, 0, canvas.width, canvas.height);
    c.drawImage(this._mini, ox, oy, this.w * s, this.h * s);
    if (this.cfg.dark) { pickups = null; zombies = null; c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(0, 0, canvas.width, canvas.height); c.fillStyle = '#ff9a30'; this.fires.forEach(f => c.fillRect(ox + f.x / this.ts * s - 1, oy + f.y / this.ts * s - 1, 2, 2)); }
    if (pickups) pickups.forEach(p => { c.fillStyle = p.type === 'coin' ? '#f5c518' : p.type === 'health' ? '#ff5a4a' : p.type === 'crate' ? '#ffffff' : '#8bc46e'; c.fillRect(ox + p.x / this.ts * s - 1, oy + p.y / this.ts * s - 1, 2, 2); });
    if (zombies) zombies.forEach(z => { c.fillStyle = z.cfg.boss ? '#c05aff' : z.type === 'tank' ? '#b8c8a0' : z.type === 'fast' ? '#ff6a5a' : z.type === 'exploder' ? '#ffa030' : '#7fd35a'; const r = z.cfg.boss ? 3 : 1.5; c.fillRect(ox + z.x / this.ts * s - r, oy + z.y / this.ts * s - r, r * 2, r * 2); });
    if (this.house) { c.fillStyle = '#5a0a0a'; c.fillRect(ox + this.house.tx * s, oy + this.house.ty * s, this.house.tw * s, this.house.th * s); }
    if (player) { c.fillStyle = '#ffffff'; c.fillRect(ox + player.x / this.ts * s - 2, oy + player.y / this.ts * s - 2, 4, 4); }
  }
}
