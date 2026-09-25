/* ==========================================================================
   game.js — core loop: input, waves, spawning, collisions, camera, HUD
   ========================================================================== */
class Game {
  constructor(canvas, ui, save) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.ctx.imageSmoothingEnabled = false;
    this.ui = ui; this.save = save; this.settings = save.settings;
    this.vw = CONFIG.VIEW_W; this.vh = CONFIG.VIEW_H; this.scale = 1;
    this.maps = {};
    this.loadout = Object.assign({ char: 'rookie', weapons: ['shotgun', 'smg', 'rifle'], map: 'city' }, save.loadout || {});
    if (!Array.isArray(this.loadout.weapons) || !this.loadout.weapons.length) this.loadout.weapons = ['shotgun', 'smg', 'rifle'];
    this.map = this.getMap(this.loadout.map);
    this.mini = document.createElement('canvas'); this.mini.width = 120; this.mini.height = 75;
    this.lights = []; this.lightCanvas = document.createElement('canvas'); this.lctx = this.lightCanvas.getContext('2d'); this.ambientTimer = 8;
    this.coneCanvas = document.createElement('canvas'); this.cctx = this.coneCanvas.getContext('2d'); this.canBlur = ('filter' in this.lctx);
    this.input = { keys: {}, mouseX: 320, mouseY: 200, worldX: 0, worldY: 0, mouseDown: false };
    this.state = 'menu'; this.time = 0; this.last = 0; this.fps = 0; this._fpsAcc = 0; this._fpsN = 0;
    this.cam = { x: 0, y: 0 }; this.shakeAmt = 0;
    this.grid = new Map();
    this.bindInput();
    this.resize(); window.addEventListener('resize', () => this.resize());
    this.reset();
    requestAnimationFrame(t => this.loop(t));
  }
  getMap(id) { return this.maps[id] || (this.maps[id] = new GameMap(id)); }
  /* the title screen is a night scene: Urban City after dark, lamps burning, headlights on, blood on the road */
  menuScene() {
    if (this._menuSetup === this.state) return;
    this._menuSetup = this.state;
    this.map = this.getMap('city'); this.resize();
    this.map.cfg.dark = false; this.map.lamps.forEach(l => { l.broken = false; });   // the map still renders normally; the night is a tint on top
    this.menuNight = true;
    if (!this.map._menuBlood) { // a few old splatters on the tarmac
      this.map._menuBlood = true;
      for (let i = 0; i < 26; i++) { const x = Math.random() * this.map.pw, y = Math.random() * this.map.ph; if (!this.map.solidAt(x, y)) this.map.splat(x, y, 8 + Math.random() * 16, Math.random() < 0.6 ? '#5a0f0b' : '#3a0a08'); }
    }
    this.menuZombies(6);
    // frame a lit crossroads: score candidate points by lamps and cars in shot, and by how much road is on screen
    const m = this.map, ts = 16; let best = null, bestScore = -1;
    for (let gy = 0; gy < 7; gy++) for (let gx = 0; gx < 7; gx++) {
      const x = m.pw * (gx + 1) / 8, y = m.ph * (gy + 1) / 8;
      if (m.solidAt(x, y)) continue;
      let score = 0;
      for (const l of m.lamps) if (Math.abs(l.x - x) < this.vw * 0.45 && Math.abs(l.y - y) < this.vh * 0.45) score += 3;
      for (const c of m.cars) if (Math.abs(c.x - x) < this.vw * 0.45 && Math.abs(c.y - y) < this.vh * 0.45) score += 1;
      let road = 0, n = 0;                                      // prefer tarmac over rooftops
      for (let sy = -5; sy <= 5; sy++) for (let sx = -7; sx <= 7; sx++) {
        const tx = Math.floor(x / ts) + sx * 3, ty = Math.floor(y / ts) + sy * 3;
        if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) continue;
        n++; const t = m.t(tx, ty); if (t === 0 || t === 1) road++;
      }
      score += n ? (road / n) * 10 : 0;
      if (score > bestScore) { bestScore = score; best = { x, y }; }
    }
    this.menuCam = best || { x: m.pw / 2, y: m.ph / 2 };
  }
  menuLeave() {
    if (!this.menuNight) return;
    this.menuNight = false; this._menuSetup = null;
    if (!this.event && !this.bonaDark && !this.dread) { this.map.cfg.dark = !!MAPS[this.map.id].dark; this.map.lamps.forEach(l => { l.broken = !!this.map.cfg.dark; }); }   // hand the map back to whatever it normally is
    this.zombies = [];
  }
  /* a handful of shufflers wandering through frame, purely for atmosphere */
  menuZombies(n) {
    this.zombies = [];
    for (let i = 0; i < n; i++) {
      const s = this.pickSpawn ? this.pickSpawn() : { x: Math.random() * this.map.pw, y: Math.random() * this.map.ph };
      const z = new Zombie(this, Math.random() < 0.25 ? 'fast' : 'normal', s.x, s.y, 1);
      z.menu = true; z.wanderA = Math.random() * TAU; z.wander = 1 + Math.random() * 3;
      this.zombies.push(z);
    }
  }
  updateMenuZombies(dt) {
    for (const z of this.zombies) {
      z.wander -= dt; if (z.wander <= 0) { z.wander = 1.5 + Math.random() * 3.5; z.wanderA = Math.random() * TAU; z.stop = Math.random() < 0.3; }
      z.hit -= dt; z.walk += dt * 3;
      if (!z.stop) { const sp = z.speed * 0.4, mr = Math.min(z.r, 7);
        z.x += Math.cos(z.wanderA) * sp * dt; let q = this.map.resolve(z.x, z.y, mr); z.x = q.x;
        z.y += Math.sin(z.wanderA) * sp * dt; q = this.map.resolve(z.x, z.y, mr); z.x = q.x; z.y = q.y;
        z.flip = Math.cos(z.wanderA) < 0;
      }
      if (z.x < 20 || z.y < 20 || z.x > this.map.pw - 20 || z.y > this.map.ph - 20) z.wanderA += Math.PI;
    }
  }
  /* admin: jump straight to a wave (starts a run first if needed) */
  adminJump(wave) {
    if (this.state === 'menu' || this.state === 'gameover') { this.ui.closeModals(); this.start(); }
    if (this.state === 'paused') this.resume();
    if (this.state === 'levelup') { this.ui.hideLevelUp(); this.pendingLevelUps = 0; }
    if (this.event) this.endEvent(true); this.bonaGone(); this.endDread(); this.hideJumpscare();
    this.zombies = []; this.ebullets = []; this.bullets = []; this.boss = null; this.state = 'playing'; this.ui.setState('playing');
    this.startWave(wave); this.admin = true; this.ui.toast(`Admin: wave ${wave}`);
  }
  setLoadout(lo) { Object.assign(this.loadout, lo); this.save.loadout = Object.assign({}, this.loadout); this.ui.saveGame(); if (this.state === 'menu') this.reset(); }
  /* integer-scaled canvas that fills the window */
  resize() {
    const W = window.innerWidth, H = window.innerHeight, mw = this.map ? this.map.pw : 1280, mh = this.map ? this.map.ph : 800;
    this._lastW = W; this._lastH = H;
    // integer pixel scale that keeps the view no larger than the map, then stretch the canvas to the full window
    let scale = Math.max(1, Math.floor(H / 400));
    scale = Math.max(scale, Math.ceil(W / mw), Math.ceil(H / mh));
    this.vw = Math.max(320, Math.ceil(W / scale)); this.vh = Math.max(200, Math.ceil(H / scale)); this.scale = scale;
    this.canvas.width = this.vw; this.canvas.height = this.vh; this.lightCanvas.width = this.vw; this.lightCanvas.height = this.vh; this.coneCanvas.width = Math.ceil(this.vw / 2); this.coneCanvas.height = Math.ceil(this.vh / 2);
    this.canvas.style.width = W + 'px'; this.canvas.style.height = H + 'px';
    this.ctx.imageSmoothingEnabled = false; this._vig = {};
  }

  /* ------------------------------------------------------------ setup */
  reset() {
    this.map = this.getMap(this.loadout.map); this.resize();
    this.player = new Player(this, this.map.playerStart.x, this.map.playerStart.y, this.loadout.char, this.loadout.weapons);
    this.zombies = []; this.bullets = []; this.ebullets = []; this.pickups = []; this.particles = []; this.clones = []; this.lures = []; this.milk = []; this.sinkers = [];
    this.wave = 0; this.toSpawn = 0; this.spawnTimer = 0; this.score = 0; this.coins = 0; this.admin = false; this.god = false; this.infAmmo = false;
    this.kills = { normal: 0, fast: 0, tank: 0, exploder: 0, boss: 0, guard: 0 }; this.picked = { health: 0, ammo: 0, coin: 0, xp: 0 };
    this.pendingLevelUps = 0; this.breakTimer = 0; this.boss = null; this.bannerTimer = 0; this.heartsBought = 0;
    if (this.event) this.endEvent(true); this.bonaGone(); this.endDread(); this.hideJumpscare(); this.event = null; this.eventFlicker = 0;
    this.siege = !!this.map.cfg.house; this.house = null; this.turrets = []; this.siegeTimer = 0;
    if (this.siege) this.setupHouse(1);
    this.map.dctx.clearRect(0, 0, this.map.pw, this.map.ph);
    this.cam.x = this.player.x - this.vw / 2; this.cam.y = this.player.y - this.vh / 2;
    this.ui.refreshAll();
  }
  start() {
    this.menuLeave();
    Audio8.init(); Audio8.resume(); Audio8.stopMusic(); Audio8.startMusic(this.map.cfg.dark); Audio8.preloadClip(DREAD.sound); this.preloadScareImg();
    { const ch = CHARACTERS[this.loadout.char]; if (ch && ch.slam && ch.slam.sound) Audio8.preloadClip(ch.slam.sound); }   // the character's own one-shots, ready before they're needed
    this.reset(); this.state = 'playing'; this.ui.setState('playing');
    this.startWave(1);
  }
  toMenu() { if (this.event) this.endEvent(true); this.state = 'menu'; Audio8.stopMusic(); Audio8.stopTrack(); this.reset(); this.ui.setState('menu'); }
  pause() { if (this.state === 'playing' || this.state === 'wavebreak') { this.prevState = this.state; this.state = 'paused'; this.ui.setState('paused'); } }
  openShop() { if (this.state !== 'playing' && this.state !== 'wavebreak') return; this.prevState = this.state; this.state = 'shop'; this.input.mouseDown = false; this.ui.showShop(); Audio8.play('swap'); }
  closeShop() { if (this.state !== 'shop') return; this.state = this.prevState || 'playing'; this.ui.hideShop(); }
  toggleShop() { this.state === 'shop' ? this.closeShop() : this.openShop(); }
  /* buy something from the supply cart; returns true on success */
  heartCost() { return CART.heart + (this.heartsBought || 0) * (CART.heartStep || 0); }
  buy(kind, id) {
    const p = this.player; let cost = 0, apply = null;
    if (kind === 'ammo') { const w = p.weapons[id]; if (!w || w.reserve >= w.maxReserve) return false; cost = CART.ammo[id]; apply = () => { w.reserve = w.maxReserve; if (w.mag === 0 && id === p.current) p.startReload(); }; }
    else if (kind === 'health') { if (p.hp >= p.maxHp) return false; cost = CART.health; apply = () => { p.hp = Math.min(p.maxHp, p.hp + 25); }; }
    else if (kind === 'fullheal') { if (p.hp >= p.maxHp) return false; cost = CART.fullHeal; apply = () => { p.hp = p.maxHp; }; }
    else if (kind === 'heart') { cost = this.heartCost(); apply = () => { p.maxHp += 25; p.hp += 25; this.heartsBought = (this.heartsBought || 0) + 1; if (p.form !== 'human' && p.humanMaxHp) p.humanMaxHp += 25; }; }
    else if (kind === 'weapon') { if (p.weapons[id]) return false; cost = CART.weapon[id]; apply = () => { p.addWeapon(id, true); p.switchTo(id); }; }
    if (!apply || !(cost >= 0)) return false; // unknown item: never charge, never crash
    if (this.coins < cost) { Audio8.play('empty'); this.ui.toast(`Not enough coins — need ${cost - this.coins} more`); return false; }
    this.coins -= cost; apply(); Audio8.play(kind === 'weapon' ? 'weapon' : kind === 'ammo' ? 'ammo' : 'health');
    this.floatText(p.x, p.y - 18, `-${cost}`, '#f5c518');
    return true;
  }
  resume() { if (this.state === 'paused') { this.state = this.prevState || 'playing'; this.ui.setState('playing'); Audio8.resume(); } }

  /* ------------------------------------------------------------ waves */
  startWave(n) {
    this.wave = n; this.toSpawn = waveCount(n); this.spawnTimer = 1.2;
    this.spawnInterval = clamp(1.3 - n * 0.045, 0.3, 1.3);
    this.bossPending = bossCount(n); this.bossKind = pickBossKind(n);
    const tierNames = this.map.cfg.dark
      ? ['Something moves in the dark', 'Fast ones. You\'ll hear them first', 'Heavy footsteps in the black', 'Orange glows in the dark — don\'t let them touch you', 'The dark is full of them']
      : ['Normal zombies approach', 'Fast zombies join the horde', 'Tank zombies incoming', 'Explosive zombies — keep your distance', 'The horde grows stronger'];
    this.ui.showBanner('WAVE ' + n, tierNames[waveTier(n)] + ' · boss incoming: ' + BOSSES[this.bossKind].name + (this.bossPending > 1 ? ' ×' + this.bossPending : ''));
    if (isBlackoutWave(this.map.id, n)) this.startEvent();
    if (n === DREAD.wave) this.startDread(); else this.endDread();
    if (this.siege) { this.setupHouse(n); this.ui.showBanner('WAVE ' + n, `Destroy the house · ${this.house.maxHp} HP · guards: ${HOUSE.guards(n)} · boss: ${BOSSES[this.bossKind].name}`); }
    Audio8.play('wave');
    // weapon crate drops on early waves for weapons not yet owned this run
    if ([2, 4, 6, 8, 11, 14, 17, 20].includes(n)) {
      const missing = WEAPON_ORDER.filter(w => !this.player.weapons[w]);
      const wid = missing.length ? missing[Math.floor(Math.random() * missing.length)] : PICKABLE_WEAPONS[Math.floor(Math.random() * PICKABLE_WEAPONS.length)];
      const sp = this.map.playerStart; const p = this.map.resolve(sp.x + (Math.random() - 0.5) * 200, sp.y + (Math.random() - 0.5) * 120, 6);
      this.pickups.push(new Pickup(this, 'crate', p.x, p.y, wid));
    }
    this.ui.refreshAll();
  }
  spawnTick(dt) {
    if (this.siege) return this.siegeSpawn(dt);
    if (this.toSpawn <= 0 && !this.bossPending) return;
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0 || this.zombies.length >= 130) return;
    this.spawnTimer = this.spawnInterval;
    if (this.bossPending > 0 && this.toSpawn <= waveCount(this.wave) * 0.6) {
      const kind = this.bossPending === bossCount(this.wave) ? this.bossKind : pickBossKind(this.wave); this.bossPending--;
      const s = this.pickSpawn(); const b = this.spawnZombie('boss', s.x, s.y, kind);
      this.ui.showBanner(`BOSS · ${b.bk.name} LV ${this.wave}`, b.bk.desc); Audio8.play('wave'); this.shake(4);
      if (this.toSpawn <= 0) return;
    }
    const comp = waveComposition(this.wave); const group = 1 + Math.floor(Math.random() * Math.min(4, 1 + this.wave / 3));
    const s = this.pickSpawn();
    for (let i = 0; i < group && this.toSpawn > 0; i++) {
      let r = Math.random(), type = 'normal';
      for (const k in comp) { r -= comp[k]; if (r <= 0) { type = k; break; } }
      this.spawnZombie(type, s.x + (Math.random() - 0.5) * 24, s.y + (Math.random() - 0.5) * 24); this.toSpawn--;
    }
  }
  /* ---- Race City siege: the house is the objective ---- */
  setupHouse(n) {
    const h = this.map.house;
    this.house = { hp: HOUSE.hp + HOUSE.hpPerWave * (n - 1), maxHp: HOUSE.hp + HOUSE.hpPerWave * (n - 1), dead: false, cracks: null, deadT: 0 };
    this.siegeTimer = 0; this.siegeBossT = 9; this.toSpawn = 0;
    // cannon emplacements
    this.turrets = this.map.cannonPos.slice(0, HOUSE.cannons).map(c => ({ x: c.x, y: c.y, hp: Math.round(HOUSE.cannonHp * enemyHpScale(n)), maxHp: Math.round(HOUSE.cannonHp * enemyHpScale(n)), cd: 2 + Math.random() * 2, angle: 0, dead: false, dmgMult: 1 + n * 0.03, r: 14, smoke: 0 }));
    // zombie soldiers at their posts
    this.zombies = this.zombies.filter(z => !z.cfg.guard);
    const posts = this.map.guardPosts, count = HOUSE.guards(n);
    for (let i = 0; i < count; i++) { const pst = posts[Math.floor(i * posts.length / count)]; const p = this.map.resolve(pst.x + (Math.random() - 0.5) * 16, pst.y + (Math.random() - 0.5) * 16, 8); const z = this.spawnZombie('guard', p.x, p.y); z.post = pst; }
  }
  siegeSpawn(dt) {
    if (this.house.dead) return;
    this.siegeTimer -= dt; this.siegeBossT -= dt;
    const door = this.map.house.door, alive = this.zombies.filter(z => !z.cfg.guard && !z.cfg.boss).length;
    if (this.bossPending > 0 && this.siegeBossT <= 0) { this.bossPending--; const kind = this.bossKind; const b = this.spawnZombie('boss', door.x + (Math.random() - 0.5) * 30, door.y + 10, kind); this.ui.showBanner(`BOSS · ${b.bk.name} LV ${this.wave}`, b.bk.desc); Audio8.play('wave'); this.shake(5); this.siegeBossT = 25; }
    if (this.siegeTimer > 0 || alive >= HOUSE.alive) return;
    this.siegeTimer = HOUSE.spawnInterval(this.wave);
    const comp = waveComposition(this.wave); let r = Math.random(), type = 'normal'; for (const k in comp) { r -= comp[k]; if (r <= 0) { type = k; break; } }
    const z = this.spawnZombie(type, door.x + (Math.random() - 0.5) * 24, door.y + Math.random() * 10);
    for (let i = 0; i < 3; i++) this.particles.push(new Particle(door.x + (Math.random() - 0.5) * 20, door.y, (Math.random() - 0.5) * 20, -15, 0.8, '#3a1a1a', 3, 'smoke'));
    return z;
  }
  damageHouse(dmg, x, y) {
    const h = this.house; if (!h || h.dead) return;
    h.hp -= dmg; h.hitT = 0.1;
    if (x != null) { for (let i = 0; i < 3; i++) this.particles.push(new Particle(x, y, (Math.random() - 0.5) * 60, -20 - Math.random() * 40, 0.4, '#2a1e22', 2, 'blood')); }
    this.floatText(x != null ? x : this.map.house.x, (y != null ? y : this.map.house.y) - 8, Math.round(dmg), '#ff8a7a');
    if (h.hp <= 0) this.destroyHouse();
  }
  destroyHouse() {
    const h = this.house, H = this.map.house; if (h.dead) return;
    h.hp = 0; h.dead = true; h.deadT = 0;
    this.shake(16); this.whiteFlash = 0.5; Audio8.play('explode'); Audio8.play('scream'); Audio8.play('thud');
    for (let i = 0; i < 90; i++) { const a = Math.random() * TAU, sp = 60 + Math.random() * 180; this.particles.push(new Particle(H.x + (Math.random() - 0.5) * H.w, H.y + (Math.random() - 0.5) * H.h, Math.cos(a) * sp, Math.sin(a) * sp - 60, 0.6 + Math.random() * 0.8, i % 3 ? '#2a1e22' : '#ff6a2a', 3 + Math.random() * 3, i % 3 ? 'blood' : 'fire')); }
    for (let i = 0; i < 30; i++) this.particles.push(new Particle(H.x + (Math.random() - 0.5) * H.w, H.y + (Math.random() - 0.5) * H.h, (Math.random() - 0.5) * 30, -20, 2 + Math.random(), '#333', 5, 'smoke'));
    this.lights.push({ x: H.x, y: H.y, r: 320, life: 0.6, max: 0.6 });
    // the horde collapses with the house; the cannons fall silent
    this.zombies.forEach(z => { if (!z.dead) { z.dead = true; this.blood(z.x, z.y, 4, '#b3221a'); } }); this.zombies = []; this.boss = null; this.bossPending = 0; this.ebullets = [];
    this.turrets.forEach(t => t.dead = true);
    const bonus = 500 + this.wave * 100; this.score += bonus; this.coins += 30 + this.wave * 3;
    this.ui.showBanner('HOUSE DESTROYED', `+${bonus} score · the horde collapses`);
  }
  updateTurrets(dt) {
    for (const t of this.turrets) {
      if (t.dead) continue; t.smoke -= dt; t.webImmune = (t.webImmune || 0) - dt;
      if (t.web > 0) { t.web -= dt; if (t.web <= 0) { t.web = 0; t.webImmune = 1.5; } continue; } // jammed by the web: can't turn or fire
      t.cd -= dt;
      { const P = this.player; if (P && P.floodR > 0 && P.char.cry && dist(t.x, t.y, P.x, P.y) < P.floodR + t.r) t.cd = Math.max(t.cd, 0.3); }   // barrel's full of water
      const tg = this.nearestTarget(t.x, t.y); if (tg === this.player && this.player.invisible) continue; const d = dist(t.x, t.y, tg.x, tg.y);
      if (d < HOUSE.cannon.range) { t.angle += Math.atan2(Math.sin(Math.atan2(tg.y - t.y, tg.x - t.x) - t.angle), Math.cos(Math.atan2(tg.y - t.y, tg.x - t.x) - t.angle)) * Math.min(1, dt * 3); }
      if (t.cd <= 0 && d < HOUSE.cannon.range && this.map.los(t.x, t.y, tg.x, tg.y)) { t.cd = HOUSE.cannon.cd; const gx = t.x + Math.cos(t.angle) * 16, gy = t.y + Math.sin(t.angle) * 16; this.ebullets.push(new EnemyBullet(this, gx, gy, t.angle + (Math.random() - 0.5) * 0.06, HOUSE.cannon, t)); this.lights.push({ x: gx, y: gy, r: 100, life: 0.1, max: 0.1 }); Audio8.play('cannon'); this.shake(1.5); t.smoke = 0.3; }
      if (t.hp < t.maxHp * 0.4 && Math.random() < 0.2) this.particles.push(new Particle(t.x, t.y - 6, (Math.random() - 0.5) * 10, -20, 1, '#333', 3, 'smoke'));
    }
  }
  damageTurret(t, dmg, x, y) { if (t.dead) return; if (t.web > 0) dmg *= 2; t.hp -= dmg; this.spark(x != null ? x : t.x, y != null ? y : t.y, 3); this.floatText(t.x, t.y - 16, Math.round(dmg), '#fff'); if (t.hp <= 0) { t.dead = true; this.explode(t.x, t.y, 40, 20, true); this.score += 150; this.floatText(t.x, t.y - 24, 'CANNON DOWN', '#ffb02a'); } }
  pickSpawn() {
    // prefer spawns not too close to the player
    const sp = this.map.spawns.filter(s => dist(s.x, s.y, this.player.x, this.player.y) > 200);
    return (sp.length ? sp : this.map.spawns)[Math.floor(Math.random() * (sp.length || this.map.spawns.length))];
  }
  spawnZombie(type, x, y, kind) { const z = new Zombie(this, type, x, y, this.wave, kind || (type === 'boss' ? 'brute' : undefined)); this.zombies.push(z); if (type === 'boss') this.boss = z; return z; }
  checkWaveEnd() {
    if (this.siege) { if (!this.house.dead || this.house.deadT < 2.5 || this.state !== 'playing') return; }
    else if (this.toSpawn > 0 || this.bossPending || this.zombies.length > 0 || this.state !== 'playing') return;
    if (this.event) this.endEvent();
    const bonus = 10 + this.wave * 5; this.coins += bonus; this.score += this.wave * 50;
    this.floatText(this.player.x, this.player.y - 20, `WAVE CLEAR +${bonus} coins`, '#f5c518');
    if (this.wave % CONFIG.WAVES_PER_LEVEL === 0) { this.coins += 50; this.ui.showBanner('LEVEL ' + (this.wave / CONFIG.WAVES_PER_LEVEL) + ' COMPLETE', '+50 bonus coins · the city gets darker'); }
    this.pendingLevelUps += 1; // one choice after each wave
    this.state = 'levelup'; this.ui.setState('levelup'); this.ui.showLevelUp();
    Audio8.play('levelup');
  }
  /* ---- Research Lab BLACKOUT ---- */
  startEvent() {
    const p = this.player;
    this.event = { name: 'BLACKOUT' }; this.eventFlicker = 1.4;
    this.map.cfg.dark = true; this.map.lamps.forEach((l, i) => l.broken = i % 3 !== 1);
    Audio8.stopMusic(); Audio8.startMusic(true); Audio8.play('scream'); Audio8.play('thud'); this.shake(8);
    p.giant = true; p.r = 12; p.gleapCd = 0;
    PICKABLE_WEAPONS.forEach(w => { if (!p.weapons[w]) p.addWeapon(w, true); else { p.weapons[w].reserve = p.weapons[w].maxReserve; } });
    this.ui.refreshWeapons();
    setTimeout(() => { if (this.event) this.ui.showBanner('BLACKOUT', 'Power failure · everything is BIG · you have every gun · SPACE to leap'); }, 1500);
  }
  endEvent(silent) {
    const p = this.player;
    this.event = null; this.eventFlicker = 0; this.map.cfg.dark = false; this.map.lamps.forEach(l => l.broken = false);
    p.giant = false; p.gjump = null; p.height = 0; p.r = p.beast ? 10 : 6;
    if (!silent) { Audio8.stopMusic(); Audio8.startMusic(false); Audio8.play('reloaded'); this.ui.showBanner('POWER RESTORED', 'The lights are back. You keep the guns.'); }
  }
  queueLevelUp() { this.pendingLevelUps++; this.floatText(this.player.x, this.player.y - 24, 'LEVEL UP!', '#8bc46e'); Audio8.play('xp'); }
  chooseUpgrade(id) {
    if (this.state !== 'levelup') return;
    this.player.applyUpgrade(id); this.pendingLevelUps--; Audio8.play('levelup');
    this.ui.refreshAll();
    if (this.pendingLevelUps > 0) { this.ui.showLevelUp(); return; }
    this.ui.hideLevelUp(); this.state = 'wavebreak'; this.breakTimer = 3; this.ui.setState('playing');
  }
  gameOver() {
    this.state = 'gameover'; this.hideJumpscare(); Audio8.play('gameover'); Audio8.stopMusic(); Audio8.stopTrack(); this.shake(10);
    this.blood(this.player.x, this.player.y, 30, '#b3221a'); this.map.splat(this.player.x, this.player.y, 14, '#7a1810');
    const isNew = !this.admin && this.score > (this.save.highScore || 0);
    if (!this.admin) { this.save.highScore = Math.max(this.save.highScore || 0, this.score); this.save.bestWave = Math.max(this.save.bestWave || 0, this.wave); this.save.runs = (this.save.runs || 0) + 1; this.ui.saveGame(); }
    else this.ui.toast('Admin run — score not saved');
    this.ui.showGameOver(this.wave, this.score, isNew);
  }

  /* ------------------------------------------------------------ events */
  onZombieDeath(z) {
    this.kills[z.type]++; this.score += z.cfg.score; Audio8.play('zdie'); this.player.onBeastKill();
    if (z.bk && z.bk.bona) { this.bonaGone(); this.shake(14); this.whiteFlash = 0.4; Audio8.play('roar'); Audio8.play('explode'); this.floatText(z.x, z.y - 60, 'BONA FALLS', '#ffb060'); }
    if ((z.sunk || 0) > 0.4) { // drowned: it slips under with a last gasp of bubbles — no blood, and an exploder's fuse just fizzles
      this.sinkers.push({ z, t: 0, dur: z.cfg.boss ? 1.4 : 0.9 });
      for (let i = 0; i < (z.cfg.boss ? 26 : 12); i++) this.particles.push(new Particle(z.x + (Math.random() - 0.5) * 12 * z.scale, z.y, (Math.random() - 0.5) * 16, -10 - Math.random() * 20, 0.7 + Math.random() * 0.6, Math.random() < 0.5 ? '#e6f3ff' : '#9cc8f2', 2 + (Math.random() < 0.3 ? 1 : 0), 'smoke'));
      this.floatText(z.x, z.y - 12 * z.scale, 'GLUG', '#9cc8f2');
    } else {
      if (this.settings.blood) this.map.splat(z.x, z.y, z.cfg.boss ? 22 : 7 * z.scale, z.type === 'exploder' ? '#6b2a08' : '#6b1410');
      this.blood(z.x, z.y, z.cfg.boss ? 30 : 8, z.type === 'exploder' ? '#ff8a20' : '#b3221a');
      if (z.type === 'exploder') this.explode(z.x, z.y, z.cfg.explodes, z.cfg.damage, false);
    }
    if (z.cfg.boss) {
      const bonus = 200 + this.wave * 60; this.score += bonus;
      this.boss = this.zombies.find(o => o !== z && o.cfg.boss && !o.dead) || null;
      for (let i = 0; i < 6 + Math.min(14, this.wave); i++) this.dropAt('coin', z.x, z.y); for (let i = 0; i < 3 + Math.floor(this.wave / 4); i++) this.dropAt('xp', z.x, z.y); this.dropAt('health', z.x, z.y); if (Math.random() < 0.5) this.dropAt('ammo', z.x, z.y);
      this.shake(12); this.ui.showBanner((z.bk ? z.bk.name : 'BOSS') + ' DOWN', `+${z.cfg.score + bonus} score`);
      this.armScare();
    }
    else this.dropLoot(z);
    this.player.addXp(Math.round(z.cfg.xp * 0.5));
  }
  dropLoot(z) {
    const lucky = 1; const p = this.player;
    const noAmmo = Object.values(p.weapons).every(w => w.reserve <= 0 && w.mag <= 0);
    if (Math.random() < z.cfg.coin * lucky) this.dropAt('coin', z.x, z.y);
    if (Math.random() < 0.22 * lucky) this.dropAt('xp', z.x, z.y);
    if (Math.random() < (noAmmo ? 0.5 : 0.09) * lucky) this.dropAt('ammo', z.x, z.y);
    if (Math.random() < (p.hp < p.maxHp * 0.4 ? 0.14 : 0.045) * lucky) this.dropAt('health', z.x, z.y);
  }
  dropAt(type, x, y) { this.pickups.push(new Pickup(this, type, x, y)); }
  collect(pk) {
    const p = this.player;
    switch (pk.type) {
      case 'health': p.heal(PICKUPS.health.value); Audio8.play('health'); this.floatText(pk.x, pk.y - 8, '+25 HP', '#ff6a5a'); break;
      case 'ammo': p.addAmmo(); Audio8.play('ammo'); this.floatText(pk.x, pk.y - 8, '+AMMO', '#f5c518'); this.ui.refreshWeapons(); break;
      case 'coin': this.coins += PICKUPS.coin.value; this.score += PICKUPS.coin.score; Audio8.play('coin'); this.floatText(pk.x, pk.y - 8, '+5', '#f5c518'); break;
      case 'xp': p.addXp(PICKUPS.xp.value); Audio8.play('xp'); this.floatText(pk.x, pk.y - 8, '+XP', '#8bc46e'); break;
      case 'crate': { const isNew = p.addWeapon(pk.data); this.floatText(pk.x, pk.y - 12, (isNew ? 'NEW: ' : 'AMMO: ') + WEAPONS[pk.data].name, '#fff'); if (!isNew) Audio8.play('ammo'); this.ui.refreshWeapons(); return; }
    }
    this.picked[pk.type]++;
  }
  explode(x, y, radius, dmg, fromPlayer, exclude) {
    Audio8.play('explode'); this.shake(fromPlayer ? 7 : 5); this.lights.push({ x, y, r: radius * 3, life: 0.45, max: 0.45 });
    for (let i = 0; i < 26; i++) { const a = Math.random() * TAU, s = 30 + Math.random() * 120; this.particles.push(new Particle(x, y, Math.cos(a) * s, Math.sin(a) * s, 0.3 + Math.random() * 0.4, '#ff6a2a', 2 + Math.random() * 3, 'fire')); }
    for (let i = 0; i < 10; i++) { const a = Math.random() * TAU, s = 10 + Math.random() * 40; this.particles.push(new Particle(x, y, Math.cos(a) * s, Math.sin(a) * s, 0.8 + Math.random() * 0.6, '#555', 3, 'smoke')); }
    this.map.dctx.fillStyle = 'rgba(20,15,10,0.28)'; this.map.dctx.beginPath(); this.map.dctx.arc(x, y, radius * 0.45, 0, TAU); this.map.dctx.fill();
    if (this.siege && fromPlayer) { const h = this.map.house; if (this.house && !this.house.dead) { const ex = Math.max(Math.abs(x - h.x) - h.w / 2, 0), ey = Math.max(Math.abs(y - h.y) - h.h / 2, 0); if (Math.hypot(ex, ey) < radius) this.damageHouse(dmg * 0.8, x, y); } this.turrets.forEach(t => { if (!t.dead && t !== exclude && dist(x, y, t.x, t.y) < radius + t.r) this.damageTurret(t, dmg * 0.8); }); }
    this.map.cars.forEach(pr => { if (!pr.taken && pr.type !== 'car_wreck' && Math.abs(x - pr.x) < radius + 16 && Math.abs(y - pr.y) < radius + 8) this.damageCar(pr, dmg * 0.6, x, y); });
    this.zombies.forEach(z => { if (z === exclude) return; const d = dist(x, y, z.x, z.y); if (d < radius + z.r) { const f = 1 - clamp((d - z.r) / radius, 0, 0.7); z.takeDamage(dmg * f, Math.atan2(z.y - y, z.x - x), undefined, 2); } });
    this.targets().forEach(tg => { const pd = dist(x, y, tg.x, tg.y); if (pd < radius) tg.hurt(Math.round(fromPlayer ? dmg * 0.25 : dmg), x, y); });
  }

  /* ------------------------------------------------------------ fx */
  shake(v) { if (this.settings.shake) this.shakeAmt = Math.min(14, this.shakeAmt + v); }
  blood(x, y, n, color) { if (!this.settings.blood) n = Math.ceil(n / 3); for (let i = 0; i < n; i++) { const a = Math.random() * TAU, s = 20 + Math.random() * 90; this.particles.push(new Particle(x, y, Math.cos(a) * s, Math.sin(a) * s - 40, 0.3 + Math.random() * 0.4, color, 1 + Math.random() * 2, 'blood')); } }
  spark(x, y, n) { for (let i = 0; i < n; i++) { const a = Math.random() * TAU, s = 30 + Math.random() * 60; this.particles.push(new Particle(x, y, Math.cos(a) * s, Math.sin(a) * s, 0.15, '#ffe08a', 1, 'dot')); } }
  muzzle(x, y, angle, size) {
    for (let i = 0; i < 3 * size; i++) { const a = angle + (Math.random() - 0.5) * 0.8, s = 80 + Math.random() * 120; this.particles.push(new Particle(x, y, Math.cos(a) * s, Math.sin(a) * s, 0.06 + Math.random() * 0.06, '#ffd23a', 2, 'dot')); }
    const sa = angle + Math.PI / 2 * (this.player.flip ? -1 : 1);
    this.particles.push(new Particle(x, y, Math.cos(sa) * 40 + (Math.random() - 0.5) * 20, Math.sin(sa) * 40 - 30, 0.6, '#d9a441', 1.5, 'shell'));
    this.flash = 0.05; this.lights.push({ x, y, r: 130, life: 0.08, max: 0.08 });
  }
  showAbilityBanner(name, sub) { this.ui.showBanner(name, sub); }

  /* drowned zombies sinking out of sight: the body slides down under a fixed waterline and fades */
  updateSinkers(dt) {
    for (const S of this.sinkers) { S.t += dt; if (Math.random() < 0.4) this.particles.push(new Particle(S.z.x + (Math.random() - 0.5) * 8, S.z.y, (Math.random() - 0.5) * 6, -12, 0.6, '#e6f3ff', 2, 'smoke')); }
    this.sinkers = this.sinkers.filter(S => S.t < S.dur);
  }
  drawSinkers(ctx) {
    for (const S of this.sinkers) {
      const z = S.z, s = z.scale || 1, k = S.t / S.dur, wl = z.y + 2.8 * s;
      z.drawSubmerged(ctx, wl, 3 * s + k * 14 * s, 1 - k * 0.5);   // same waterline as when it was alive, the body slides under it
      const w = (9 - k * 3) * s;   // the surface closing over it
      ctx.strokeStyle = `rgba(232,246,255,${0.8 * (1 - k)})`; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(z.x, wl, w, w * 0.38, 0, 0, TAU); ctx.stroke();
      const rw = (9 + k * 16) * s; ctx.strokeStyle = `rgba(220,240,255,${0.55 * (1 - k)})`; ctx.beginPath(); ctx.ellipse(z.x, wl, rw, rw * 0.38, 0, 0, TAU); ctx.stroke();
    }
  }

  /* ---- Cry XD's flood: a pool of tears around him, ripples rolling out, foam at the edge ---- */
  drawFlood(ctx) {
    const p = this.player; if (!p || !(p.floodR > 0)) return;
    const R = p.floodR, t = this.time;
    const g = ctx.createRadialGradient(p.x, p.y, 4, p.x, p.y, R);
    g.addColorStop(0, 'rgba(70,150,230,0.42)'); g.addColorStop(0.75, 'rgba(60,135,215,0.5)'); g.addColorStop(1, 'rgba(120,185,245,0.62)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, R, 0, TAU); ctx.fill();
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) { const k = ((t * 0.55 + i / 3) % 1), rr = R * k;   // ripples rolling outward
      ctx.strokeStyle = `rgba(210,235,255,${0.45 * (1 - k)})`; ctx.beginPath(); ctx.arc(p.x, p.y, rr, 0, TAU); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(235,245,255,0.85)'; ctx.lineWidth = 3; ctx.beginPath();   // foam along the edge
    for (let a = 0; a <= TAU + 0.01; a += 0.12) { const w = R + Math.sin(a * 7 + t * 5) * 2.5, x = p.x + Math.cos(a) * w, y = p.y + Math.sin(a) * w; a ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    for (let i = 0; i < 10; i++) { const a = i * 2.4 + t * 0.4, rr = R * (0.25 + 0.6 * ((i * 0.37 + t * 0.1) % 1)); if (Math.sin(t * 6 + i) > 0.6) ctx.fillRect(Math.round(p.x + Math.cos(a) * rr), Math.round(p.y + Math.sin(a) * rr), 2, 1); }   // glints
  }

  /* ---- Jonny's milk quake: a white flood rolling out from the punch, leaving the ground soaked ---- */
  milkWave(x, y, radius, dur) {
    this.milk.push({ x, y, r: 10, max: radius, t: 0, dur, splat: 0 });
    for (let i = 0; i < 40; i++) { const a = Math.random() * TAU, sp = 60 + Math.random() * 220; this.particles.push(new Particle(x, y, Math.cos(a) * sp, Math.sin(a) * sp * 0.6 - 40, 0.5 + Math.random() * 0.5, Math.random() < 0.75 ? '#f4f2ea' : '#dcd8cc', 3, 'blood')); }
    this.map.splat(x, y, 24, '#fbfaf6');
  }
  updateMilk(dt) {
    for (const M of this.milk) {
      const was = M.r; M.t += dt;
      M.r = M.max * Math.min(1, M.t / M.dur);
      // soak the ground behind the front as it passes
      M.splat -= dt;
      if (M.splat <= 0 && M.r < M.max) { M.splat = 0.06;
        for (let i = 0; i < 2; i++) { const a = Math.random() * TAU, rr = was + (M.r - was) * Math.random(); this.map.splat(M.x + Math.cos(a) * rr, M.y + Math.sin(a) * rr, 8 + Math.random() * 10, '#fbfaf6'); }
      }
      if (Math.random() < 0.7) { const a = Math.random() * TAU; this.particles.push(new Particle(M.x + Math.cos(a) * M.r, M.y + Math.sin(a) * M.r, Math.cos(a) * 40, Math.sin(a) * 40 - 30, 0.5, '#f4f2ea', 2, 'blood')); }
    }
    this.milk = this.milk.filter(M => M.t < M.dur + 0.45);
  }
  drawMilk(ctx) {
    for (const M of this.milk) {
      const k = Math.min(1, M.t / M.dur), fade = Math.max(0, 1 - Math.max(0, M.t - M.dur) / 0.45);
      const g = ctx.createRadialGradient(M.x, M.y, Math.max(1, M.r * 0.55), M.x, M.y, M.r);
      g.addColorStop(0, `rgba(252,251,247,${0.30 * fade})`); g.addColorStop(0.7, `rgba(254,253,250,${0.62 * fade})`); g.addColorStop(1, `rgba(255,255,255,${0.97 * fade})`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(M.x, M.y, M.r, 0, TAU); ctx.fill();
      ctx.strokeStyle = `rgba(255,255,255,${fade})`; ctx.lineWidth = 7 - k * 3; ctx.beginPath(); ctx.arc(M.x, M.y, M.r, 0, TAU); ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${0.6 * fade})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(M.x, M.y, Math.max(1, M.r - 9), 0, TAU); ctx.stroke();
    }
  }

  /* ---- Jeffry's money bags: a thrown bag arcs to where you aimed, bursts, and holds the horde while it lasts ---- */
  throwBag(x, y, tx, ty) {
    const B = this.player.char.money.bag;
    this.lures.push({ sx: x, sy: y, x, y, tx, ty, t: 0, h: 0, fly: Math.max(0.25, Math.min(0.55, dist(x, y, tx, ty) / 800)), life: B.life, max: B.life, r: B.radius, landed: false, notes: [] });
    Audio8.play('swap');
  }
  updateLures(dt) {
    for (const L of this.lures) {
      if (!L.landed) { // in the air
        L.t += dt; const k = Math.min(1, L.t / L.fly);
        L.x = L.sx + (L.tx - L.sx) * k; L.y = L.sy + (L.ty - L.sy) * k; L.h = Math.sin(k * Math.PI) * 34;
        if (k >= 1) { // it bursts
          L.landed = true; L.h = 0; Audio8.play('coin'); this.shake(1.5);
          for (let i = 0; i < 14; i++) { const a = Math.random() * TAU, sp = 30 + Math.random() * 70; L.notes.push({ x: 0, y: 0, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30, r: Math.random() * TAU, sp: (Math.random() - 0.5) * 6 }); }
          for (let i = 0; i < 10; i++) this.particles.push(new Particle(L.x, L.y, (Math.random() - 0.5) * 90, -40 - Math.random() * 60, 0.7, i % 2 ? '#6ec46a' : '#d8d4c8', 2, 'blood'));
          this.floatText(L.x, L.y - 14, 'CASH!', '#6ec46a');
        }
      } else {
        L.life -= dt;
        for (const n of L.notes) { n.x += n.vx * dt; n.y += n.vy * dt; n.vy += 60 * dt; n.vx *= 0.94; n.r += n.sp * dt; if (n.y > 4) { n.y = 4; n.vy = 0; n.vx *= 0.7; } }
        if (Math.random() < 0.3) this.particles.push(new Particle(L.x + (Math.random() - 0.5) * 26, L.y + (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, -14, 0.8, '#6ec46a', 2, 'smoke'));
      }
    }
    this.lures = this.lures.filter(L => L.life > 0);
  }
  /* the bag a zombie should be running at: the closest landed one whose pull reaches it */
  nearestLure(x, y) {
    let best = null, bd = 1e9;
    for (const L of this.lures) { if (!L.landed) continue; const d = dist(x, y, L.x, L.y); if (d < L.r && d < bd) { bd = d; best = L; } }
    return best;
  }
  drawLures(ctx) {
    const t = this.time;
    for (const L of this.lures) {
      const fade = Math.min(1, L.life / 1.2);
      if (L.landed) { // show what the bag is holding
        ctx.strokeStyle = `rgba(110,196,106,${0.35 * fade})`; ctx.lineWidth = 1.5; ctx.setLineDash([5, 8]); ctx.lineDashOffset = -t * 18;
        ctx.beginPath(); ctx.arc(L.x, L.y, L.r * (0.35 + 0.65 * Math.min(1, (L.max - L.life) * 3)), 0, TAU); ctx.stroke(); ctx.setLineDash([]);
        for (const n of L.notes) { ctx.save(); ctx.translate(L.x + n.x, L.y + n.y); ctx.rotate(n.r); ctx.globalAlpha = fade; ctx.fillStyle = '#4f8c4a'; ctx.fillRect(-4, -2, 8, 4); ctx.fillStyle = '#8fd48a'; ctx.fillRect(-3, -1, 6, 2); ctx.fillStyle = '#e8e6dc'; ctx.fillRect(-1, -1, 2, 2); ctx.restore(); ctx.globalAlpha = 1; }
      }
      const by = L.y - (L.h || 0);
      ctx.fillStyle = `rgba(0,0,0,${0.3 * fade})`; ctx.beginPath(); ctx.ellipse(L.x, L.y + 3, 7, 3, 0, 0, TAU); ctx.fill();
      ctx.globalAlpha = fade;
      ctx.fillStyle = '#2a1a10'; ctx.fillRect(Math.round(L.x - 6), Math.round(by - 8), 12, 11);   // the bag
      ctx.fillStyle = '#c8b06a'; ctx.fillRect(Math.round(L.x - 5), Math.round(by - 7), 10, 9);
      ctx.fillStyle = '#9a7f42'; ctx.fillRect(Math.round(L.x - 5), Math.round(by - 7), 10, 2);
      ctx.fillStyle = '#2a1a10'; ctx.fillRect(Math.round(L.x - 1), Math.round(by - 5), 2, 5); ctx.fillRect(Math.round(L.x - 3), Math.round(by - 4), 6, 2);
      ctx.globalAlpha = 1;
    }
  }
  /* the last boss of the dread wave is gone — killed or dragged off by Genom. Either way, something comes through. */
  armScare() {
    if (!this.dread || !this.dread.armed || this.boss) return;
    this.dread.armed = false;
    setTimeout(() => { if (this.state === 'playing' || this.state === 'wavebreak' || this.state === 'levelup') this.jumpscare(); }, 700);
  }
  /* wave 5: the power dies everywhere, and killing the boss lets something through */
  startDread() {
    if (this.dread) return;
    this.dread = { armed: true }; this.dreadDark = !this.map.cfg.dark; Audio8.preloadClip(DREAD.sound); this.preloadScareImg();
    if (this.dreadDark) { this.map.cfg.dark = true; this.map.lamps.forEach((l, i) => l.broken = i % 2 === 0); Audio8.stopMusic(); Audio8.startMusic(true); }
    this.eventFlicker = Math.max(this.eventFlicker, 1.2); this.shake(6); Audio8.play('flicker'); Audio8.play('thud');
    setTimeout(() => { if (this.dread && this.state !== 'menu') this.ui.showBanner('THE LIGHTS DIE', 'Something came in with the dark. Kill the boss.'); }, 900);
  }
  endDread() {
    if (!this.dread) return;
    const wasDark = this.dreadDark; this.dread = null; this.dreadDark = false;
    if (wasDark && !this.event && !this.bonaDark) { this.map.cfg.dark = false; this.map.lamps.forEach(l => l.broken = false); Audio8.stopMusic(); Audio8.startMusic(false); }
  }
  /* the face has to be decoded before the scare, exactly like the sound — otherwise it arrives late on a slow connection */
  preloadScareImg() { const img = document.getElementById('jumpscareImg'); if (img && !img.src) img.src = DREAD.img; }
  /* the face. full screen, loud, then it's over. */
  jumpscare() {
    const el = document.getElementById('jumpscare'), img = document.getElementById('jumpscareImg');
    if (!el || !img) return;
    if (!img.src) img.src = DREAD.img; // normally already loaded by preloadScareImg()
    this.shake(26); this.whiteFlash = 0; this.darkFlash = 0;
    Audio8.stopMusic(); Audio8.stopTrack();
    el.classList.remove('on'); void el.offsetWidth;                      // reset the animation
    Audio8.playClip(DREAD.sound, 1); Audio8.play('scream');              // decoded ahead of time: it hits on this frame
    Audio8.tone(48, 1.6, 'sawtooth', 0.5, -20); Audio8.noise(0.9, 0.35, 260); // sub-bass drop under the scream
    el.classList.add('on');
    clearTimeout(this._jsTimer);
    this._jsTimer = setTimeout(() => { el.classList.remove('on'); if (this.state !== 'menu' && this.state !== 'gameover') { Audio8.startMusic(this.map.cfg.dark); } }, DREAD.hold * 1000);
  }
  hideJumpscare() { const el = document.getElementById('jumpscare'); if (el) el.classList.remove('on'); clearTimeout(this._jsTimer); Audio8.stopClip(); }
  /* Bona rises: the lights go out until it's dead */
  bonaArrive(z) {
    this.shake(16); this.darkFlash = 0.9; Audio8.play('roar'); Audio8.play('scream'); Audio8.play('explode');
    if (!this.map.cfg.dark) { this.bonaDark = true; this.map.cfg.dark = true; this.map.lamps.forEach((l, i) => l.broken = i % 2 === 0); Audio8.stopMusic(); Audio8.startMusic(true); }
    this.ui.showBanner('BONA', 'The ground splits. Something is climbing out.'); this.floatText(z.x, z.y - 80, 'BONA', '#ff7a1a');
    for (let i = 0; i < 40; i++) { const a = i / 40 * TAU, sp = 120 + Math.random() * 120; this.particles.push(new Particle(z.x, z.y, Math.cos(a) * sp, Math.sin(a) * sp * 0.5 - 60, 0.8, i % 3 ? '#3a3a40' : '#ff7a1a', 4, 'blood')); }
    this.map.splat(z.x, z.y, 30, '#0e0e10'); this.lights.push({ x: z.x, y: z.y, r: 260, life: 0.8, max: 0.8 });
  }
  sahurArrive(z) {
    this.shake(8); Audio8.play('thud'); setTimeout(() => Audio8.play('thud'), 350); setTimeout(() => { Audio8.play('thud'); Audio8.play('roar'); }, 700);
    this.ui.showBanner('TUNG TUNG TUNG SAHUR', 'The log has come. Bring earplugs.'); this.floatText(z.x, z.y - 80, 'TUNG', '#ffb060');
    for (let i = 0; i < 24; i++) { const a = i / 24 * TAU; this.particles.push(new Particle(z.x, z.y, Math.cos(a) * 100, Math.sin(a) * 50 - 40, 0.7, i % 2 ? '#8a5a30' : '#e0863a', 3, 'blood')); }
  }
  bonaGone() { if (!this.bonaDark) return; this.bonaDark = false; if (!this.event) { this.map.cfg.dark = false; this.map.lamps.forEach(l => l.broken = false); Audio8.stopMusic(); Audio8.startMusic(false); } }
  floatText(x, y, text, color) { this.particles.push(new Particle(x, y, 0, -28, 0.9, color, 0, 'text', String(text))); }

  /* ------------------------------------------------------------ input */
  bindInput() {
    const k = this.input.keys;
    window.addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT') return;
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key; k[key] = true;
      if (key === 'Escape') { if (this.ui.closeModals()) return; if (this.state === 'shop') { this.closeShop(); return; } if (this.state === 'playing' || this.state === 'wavebreak') this.pause(); else if (this.state === 'paused') this.resume(); }
      if (key === 't') k.t = true;
      if (key === 'b' || key === 'Tab') { if (this.state === 'shop' || this.state === 'playing' || this.state === 'wavebreak') { e.preventDefault(); this.toggleShop(); } }
      if (key === 'f') { if (e.shiftKey || !((this.player.char.pull || this.player.char.wife) && (this.state === 'playing' || this.state === 'wavebreak'))) this.ui.toggleFullscreen(); else k.f = true; } // F = WEB PULL for Spider Mad; Shift+F always = fullscreen
      if (this.state === 'playing' || this.state === 'wavebreak') {
        if (key >= '1' && key <= '9') { const id = this.player.weaponOrder[key - 1]; if (id) this.player.switchTo(id); }
        if (key === 'q') this.player.cycle(1);
      }
      if (this.state === 'levelup' && key >= '1' && key <= '4') this.chooseUpgrade(Object.keys(UPGRADES)[key - 1]);
      if (['w', 'a', 's', 'd', ' ', 'e', 'g', 'f', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) e.preventDefault();
    });
    window.addEventListener('keyup', e => { const key = e.key.length === 1 ? e.key.toLowerCase() : e.key; k[key] = false; });
    window.addEventListener('blur', () => { for (const i in k) k[i] = false; this.input.mouseDown = false; this.input.rightDown = false; if (this.state === 'playing' || this.state === 'wavebreak') this.pause(); }); // never get eaten while you're looking at another window
    const c = this.canvas;
    const toLogical = e => { const r = c.getBoundingClientRect(); this.input.mouseX = clamp((e.clientX - r.left) / r.width * this.vw, 0, this.vw); this.input.mouseY = clamp((e.clientY - r.top) / r.height * this.vh, 0, this.vh); };
    c.addEventListener('mousemove', toLogical);
    c.addEventListener('mousedown', e => { toLogical(e); Audio8.init(); Audio8.resume(); if (e.button === 2) { this.input.rightDown = true; return; } if (e.button !== 0) return;
      const r = this.cartRect; if (r && (this.state === 'playing' || this.state === 'wavebreak') && this.input.mouseX >= r.x && this.input.mouseX <= r.x + r.w && this.input.mouseY >= r.y && this.input.mouseY <= r.y + r.h) { this.openShop(); return; }
      const ar = this.abilityRect; if (ar && (this.state === 'playing' || this.state === 'wavebreak') && this.input.mouseX >= ar.x && this.input.mouseX <= ar.x + ar.w && this.input.mouseY >= ar.y && this.input.mouseY <= ar.y + ar.h) { this.player.useAbility(); return; }
      const cr = this.carRect; if (cr && (this.state === 'playing' || this.state === 'wavebreak') && this.input.mouseX >= cr.x && this.input.mouseX <= cr.x + cr.w && this.input.mouseY >= cr.y && this.input.mouseY <= cr.y + cr.h) { this.player.toggleCar(); return; }
      const tr2 = this.transformRect2; if (tr2 && (this.state === 'playing' || this.state === 'wavebreak') && this.input.mouseX >= tr2.x && this.input.mouseX <= tr2.x + tr2.w && this.input.mouseY >= tr2.y && this.input.mouseY <= tr2.y + tr2.h) { if (this.player.char.wife) this.player.useWife(); else if (this.player.char.frog) this.player.useFrogArmy(); else if (this.player.char.symbiote) this.player.useCapture(); else this.player.usePull(); return; }
      const tr = this.transformRect; if (tr && (this.state === 'playing' || this.state === 'wavebreak') && this.input.mouseX >= tr.x && this.input.mouseX <= tr.x + tr.w && this.input.mouseY >= tr.y && this.input.mouseY <= tr.y + tr.h) { this.player.useCharAbility(); return; }
      this.input.mouseDown = true; });
    window.addEventListener('mouseup', e => { if (e.button === 2) this.input.rightDown = false; else this.input.mouseDown = false; });
    c.addEventListener('contextmenu', e => e.preventDefault());
    c.addEventListener('wheel', e => { e.preventDefault(); if (this.state === 'playing' || this.state === 'wavebreak') this.player.cycle(e.deltaY > 0 ? 1 : -1); }, { passive: false });
  }

  /* ------------------------------------------------------------ loop */
  loop(t) {
    const dt = Math.min(0.05, (t - this.last) / 1000 || 0); this.last = t;
    if (window.innerWidth !== this._lastW || window.innerHeight !== this._lastH) this.resize();
    this._fpsAcc += dt; this._fpsN++; if (this._fpsAcc >= 0.5) { this.fps = Math.round(this._fpsN / this._fpsAcc); this._fpsAcc = 0; this._fpsN = 0; }
    try { // one bad frame must never freeze the whole game
      if (this.state === 'playing' || this.state === 'wavebreak' || this.state === 'gameover') this.update(dt);
      else if (this.state === 'menu') this.updateAmbient(dt);
      this.draw();
    } catch (err) { this._errCount = (this._errCount || 0) + 1; if (this._errCount <= 3) console.error('frame error', err); }
    requestAnimationFrame(tt => this.loop(tt));
  }
  updateAmbient(dt) {
    this.time += dt; this.updateFx(dt); this.menuScene(); this.updateMenuZombies(dt);
    if (this.menuCam) { // a slow drift so the title screen never looks like a still
      const t = this.time * 0.06;
      const tx = this.menuCam.x + Math.cos(t) * 90 - this.vw / 2, ty = this.menuCam.y + Math.sin(t * 0.8) * 60 - this.vh / 2;
      this.cam.x = clamp(tx, 0, Math.max(0, this.map.pw - this.vw)); this.cam.y = clamp(ty, 0, Math.max(0, this.map.ph - this.vh));
    }
  }
  updateFx(dt) {
    this.map.fires.forEach(f => { for (let i = 0; i < 2; i++) this.particles.push(new Particle(f.x + (Math.random() - 0.5) * 10, f.y + (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 12, -20 - Math.random() * 30, 0.5 + Math.random() * 0.5, '#ff6a2a', 2 + Math.random() * 3, 'fire')); if (Math.random() < 0.3) this.particles.push(new Particle(f.x, f.y - 6, (Math.random() - 0.5) * 8, -25, 1.5, '#333', 3, 'smoke')); });
    this.particles.forEach(p => p.update(dt)); this.particles = this.particles.filter(p => !p.dead);
    if (this.particles.length > 900) this.particles.splice(0, this.particles.length - 900);
    this.shakeAmt *= Math.pow(0.02, dt); this.flash = (this.flash || 0) - dt;
    this.lights.forEach(l => l.life -= dt); this.lights = this.lights.filter(l => l.life > 0);
    this.whiteFlash = Math.max(0, (this.whiteFlash || 0) - dt); this.darkFlash = Math.max(0, (this.darkFlash || 0) - dt);
    if (this.eventFlicker > 0) { this.eventFlicker -= dt; if (Math.random() < 0.15) Audio8.play('flicker'); }
    if (this.map.cfg.dark) { this.ambientTimer -= dt; if (this.ambientTimer <= 0) { this.ambientTimer = 7 + Math.random() * 12; Audio8.play(Math.random() < 0.35 ? 'scream' : 'moan'); } }
  }
  update(dt) {
    this.time += dt;
    const p = this.player, inp = this.input;
    inp.worldX = this.cam.x + inp.mouseX; inp.worldY = this.cam.y + inp.mouseY;
    if (this.state !== 'gameover') p.update(dt, inp);
    if (this.state === 'wavebreak') { this.breakTimer -= dt; if (this.breakTimer <= 0) { this.state = 'playing'; this.startWave(this.wave + 1); } }
    if (this.state === 'playing') this.spawnTick(dt);
    this.map.computeFlow(p.x, p.y);
    // spatial grid
    this.grid.clear();
    for (const z of this.zombies) { const key = ((z.x / 32) | 0) + ',' + ((z.y / 32) | 0); (this.grid.get(key) || this.grid.set(key, []).get(key)).push(z); }
    const multi = this.clones.length > 0;
    for (const z of this.zombies) z.update(dt, multi ? this.nearestTarget(z.x, z.y) : p, this.near(z.x, z.y));
    this.zombies = this.zombies.filter(z => !z.dead);
    this.clones.forEach(c => c.update(dt)); this.clones = this.clones.filter(c => !c.dead);
    this.updateLures(dt);
    this.updateMilk(dt);
    this.updateSinkers(dt);
    for (const b of this.bullets) {
      b.update(dt); if (b.dead) continue;
      if (this.siege) {
        const h = this.map.house;
        if (this.house && !this.house.dead && Math.abs(b.x - h.x) < h.w / 2 + 3 && Math.abs(b.y - h.y) < h.h / 2 + 3 && b.y > h.y - h.h / 2 + 30) { if (b.explosive) b.impact(); else { this.damageHouse(b.damage, b.x, b.y); b.dead = true; } continue; }
        let hitT = false; for (const t of this.turrets) { if (!t.dead && dist(b.x, b.y, t.x, t.y) < t.r + 3) { if (b.explosive) b.impact(); else { this.damageTurret(t, b.damage, b.x, b.y); b.dead = true; } hitT = true; break; } } if (hitT) continue;
      }
      if (b.lava) continue; // lava stones sail over the horde and land where they were aimed
      for (const z of this.near(b.x, b.y)) {
        if (z.dead || b.hitSet.has(z)) continue;
        if (dist(b.x, b.y, z.x, z.y) < z.r + (b.giant ? 9 : 2.5)) {
          if (b.explosive) { b.impact(); break; }
          b.hitSet.add(z);
          if (b.flame) { z.takeDamage(b.damage, b.angle, undefined, 0.15, true); z.burn = Math.max(z.burn, 2.5); if (b.pierce-- <= 0) b.dead = true; if (b.dead) break; continue; }
          if (b.venom) { z.takeDamage(b.damage, b.angle, undefined, 0.3, true); z.poison = Math.max(z.poison || 0, 3); for (let i = 0; i < 3; i++) this.particles.push(new Particle(b.x, b.y, (Math.random() - 0.5) * 60, (Math.random() - 0.5) * 60 - 20, 0.35, i ? '#0a0a0e' : '#5fd35a', 2, 'blood')); if (b.pierce-- <= 0) b.dead = true; if (b.dead) break; continue; }
          z.takeDamage(b.damage, b.angle); Audio8.play('hit');
          if (b.pierce-- <= 0) { b.dead = true; break; }
        }
      }
    }
    this.bullets = this.bullets.filter(b => !b.dead);
    this.ebullets.forEach(b => b.update(dt)); this.ebullets = this.ebullets.filter(b => !b.dead);
    if (this.siege) { this.updateTurrets(dt); const h = this.house; h.hitT = (h.hitT || 0) - dt; if (h.dead) h.deadT += dt;
      const H = this.map.house; if (!h.dead && Math.random() < 0.35) this.particles.push(new Particle(H.x + (Math.random() - 0.5) * (H.w + 120), H.y + H.h / 2 + (Math.random() - 0.5) * 40, (Math.random() - 0.5) * 8, -4, 2.5 + Math.random() * 2, '#3a3040', 5, 'smoke')); // fog
      if (!h.dead && h.hp < h.maxHp * 0.35 && Math.random() < 0.4) this.particles.push(new Particle(H.x + (Math.random() - 0.5) * H.w * 0.8, H.y - H.h / 2 + 20 + Math.random() * 20, (Math.random() - 0.5) * 10, -30 - Math.random() * 30, 0.5 + Math.random() * 0.4, '#ff6a2a', 2 + Math.random() * 3, 'fire'));
      this.siegeMoan = (this.siegeMoan || 5) - dt; if (this.siegeMoan <= 0) { this.siegeMoan = 6 + Math.random() * 10; if (dist(p.x, p.y, H.x, H.y) < 420) Audio8.play(Math.random() < 0.4 ? 'scream' : 'moan'); } }
    this.pickups.forEach(k => k.update(dt, p)); this.pickups = this.pickups.filter(k => !k.dead);
    this.updateFx(dt);
    // camera
    const tx = clamp(p.x - this.vw / 2 + Math.cos(p.angle) * 20, 0, this.map.pw - this.vw), ty = clamp(p.y - this.vh / 2 + Math.sin(p.angle) * 12, 0, this.map.ph - this.vh);
    const f = 1 - Math.pow(0.002, dt); this.cam.x += (tx - this.cam.x) * f; this.cam.y += (ty - this.cam.y) * f;
    this.checkWaveEnd();
    this.ui.tick(dt);
  }
  /* everything zombies can attack: the player plus any live clones */
  targets() { if (this.player.invisible && this.clones.length) return this.clones.slice(); return this.clones.length ? [this.player].concat(this.clones) : [this.player]; }
  nearestTarget(x, y) { let best = this.player, bd = Infinity; for (const t of this.targets()) { if (t.dead) continue; const d = Math.hypot(t.x - x, t.y - y); if (d < bd) { bd = d; best = t; } } return best; }
  near(x, y) {
    const cx = (x / 32) | 0, cy = (y / 32) | 0; const out = [];
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const a = this.grid.get((cx + i) + ',' + (cy + j)); if (a) for (const z of a) out.push(z); }
    return out;
  }

  /* ------------------------------------------------------------ draw */
  draw() {
    const ctx = this.ctx, sh = this.shakeAmt, ts = this.time * 60;
    const cx = Math.round(this.cam.x + (Math.sin(ts * 1.7) * 0.6 + (Math.random() - 0.5) * 0.4) * sh * 0.5), cy = Math.round(this.cam.y + (Math.cos(ts * 2.3) * 0.6 + (Math.random() - 0.5) * 0.4) * sh * 0.5);
    const flick = this.eventFlicker > 0 && Math.sin(ts * 0.9) > -0.2 && Math.random() < 0.85;
    const dark = !!this.map.cfg.dark && !flick, inGame = this.state !== 'menu';
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = false;
    this.map.draw(ctx, cx, cy, this.vw, this.vh);
    const inView = e => e.x > cx - 40 && e.x < cx + this.vw + 40 && e.y > cy - 40 && e.y < cy + this.vh + 40;
    const glowP = p => p.type === 'fire' || p.type === 'dot' || p.type === 'text';
    // ---- world layer (gets darkened) ----
    ctx.save(); ctx.translate(-cx, -cy);
    if (this.siege) this.drawHouse(ctx);
    if (this.map.cars.length) this.drawCars(ctx);
    this.drawFlood(ctx);
    this.drawSinkers(ctx);
    this.drawMilk(ctx);
    this.drawLures(ctx);
    this.pickups.forEach(k => inView(k) && k.draw(ctx));
    this.zombies.forEach(z => inView(z) && z.draw(ctx));
    this.clones.forEach(c => inView(c) && c.draw(ctx));
    if (inGame) this.player.draw(ctx);
    this.particles.forEach(p => inView(p) && !glowP(p) && p.draw(ctx));
    ctx.restore();
    if (dark) this.drawDarkness(ctx, cx, cy, inGame);
    // ---- glow layer (visible in the dark) ----
    ctx.save(); ctx.translate(-cx, -cy);
    if (this.menuNight) { // dusk over the city: cool tint first, then the warm lights punched over it
      ctx.save();
      ctx.fillStyle = 'rgba(12,16,38,0.34)'; ctx.fillRect(cx - 10, cy - 10, this.vw + 20, this.vh + 20);
      ctx.globalCompositeOperation = 'lighter';
      for (const l of this.map.lamps) {
        if (Math.abs(l.x - cx - this.vw / 2) > this.vw || Math.abs(l.y - cy - this.vh / 2) > this.vh) continue;
        const r = 92 + Math.sin(this.time * 2 + l.x) * 4, g = ctx.createRadialGradient(l.x, l.y, 2, l.x, l.y, r);
        g.addColorStop(0, 'rgba(255,200,118,0.62)'); g.addColorStop(0.4, 'rgba(255,164,74,0.24)'); g.addColorStop(1, 'rgba(255,150,60,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(l.x, l.y, r, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,225,170,0.85)'; ctx.fillRect(Math.round(l.x) - 1, Math.round(l.y) - 10, 3, 4);   // the bulb itself
      }
      for (const c of this.map.cars) {
        if (Math.abs(c.x - cx - this.vw / 2) > this.vw || Math.abs(c.y - cy - this.vh / 2) > this.vh) continue;
        const dir = c.x < this.map.pw / 2 ? 1 : -1, hx = c.x + dir * 15, hy = c.y + 2;
        ctx.beginPath(); ctx.moveTo(hx, hy - 3); ctx.lineTo(hx + dir * 100, hy - 30); ctx.lineTo(hx + dir * 100, hy + 30); ctx.closePath();
        const gg = ctx.createLinearGradient(hx, hy, hx + dir * 100, hy); gg.addColorStop(0, 'rgba(255,240,200,0.30)'); gg.addColorStop(1, 'rgba(255,230,180,0)');
        ctx.fillStyle = gg; ctx.fill();
        ctx.fillStyle = 'rgba(255,245,215,0.9)'; ctx.fillRect(Math.round(hx), Math.round(hy) - 2, 2, 3);
      }
      ctx.restore();
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 0.5; ctx.drawImage(this.vignette('rgba(0,0,0,1)', 0.45), 0, 0); ctx.restore();
    }
    if (dark) this.drawEyes(ctx, inView);
    this.zombies.forEach(z => z.bk && inView(z) && z.drawFx(ctx));
    this.bullets.forEach(b => b.draw(ctx));
    this.ebullets.forEach(b => b.draw(ctx));
    this.particles.forEach(p => inView(p) && glowP(p) && p.draw(ctx));
    this.map.fires.forEach(f => { const g = ctx.createRadialGradient(f.x, f.y, 2, f.x, f.y, 40 + Math.sin(this.time * 12) * 4); g.addColorStop(0, 'rgba(255,140,40,0.28)'); g.addColorStop(1, 'rgba(255,80,0,0)'); ctx.fillStyle = g; ctx.fillRect(f.x - 50, f.y - 50, 100, 100); });
    if (this.state === 'playing' || this.state === 'wavebreak') {
      const p = this.player;
      if (this.settings.aimLine) { ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.setLineDash([2, 4]); ctx.beginPath(); ctx.moveTo(p.x + Math.cos(p.angle) * 14, p.y + Math.sin(p.angle) * 14); ctx.lineTo(this.input.worldX, this.input.worldY); ctx.stroke(); ctx.setLineDash([]); }
      const mx = this.input.worldX, my = this.input.worldY; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(mx - 6, my); ctx.lineTo(mx - 2, my); ctx.moveTo(mx + 2, my); ctx.lineTo(mx + 6, my); ctx.moveTo(mx, my - 6); ctx.lineTo(mx, my - 2); ctx.moveTo(mx, my + 2); ctx.lineTo(mx, my + 6); ctx.stroke();
    }
    ctx.restore();
    // ---- post ----
    if (!dark) { ctx.fillStyle = this.map.cfg.tint; ctx.fillRect(0, 0, this.vw, this.vh); }
    if (this.flash > 0 && !dark) { ctx.fillStyle = 'rgba(255,230,150,0.06)'; ctx.fillRect(0, 0, this.vw, this.vh); }
    ctx.drawImage(this.vignette(dark ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.55)', 0.45), 0, 0);
    if (this.whiteFlash > 0) { ctx.fillStyle = `rgba(255,240,230,${Math.min(1, this.whiteFlash * 2.2)})`; ctx.fillRect(0, 0, this.vw, this.vh); }
    if (this.darkFlash > 0) { ctx.fillStyle = `rgba(5,0,10,${Math.min(0.92, this.darkFlash * 2)})`; ctx.fillRect(0, 0, this.vw, this.vh); }
    if (dark) { // film grain
      ctx.fillStyle = 'rgba(255,255,255,0.045)'; for (let i = 0; i < 160; i++) ctx.fillRect((Math.random() * this.vw) | 0, (Math.random() * this.vh) | 0, 1, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; for (let i = 0; i < 90; i++) ctx.fillRect((Math.random() * this.vw) | 0, (Math.random() * this.vh) | 0, 1, 1);
    }
    if (inGame) {
      const p = this.player;
      if (p.hp < p.maxHp * 0.3 && !p.dead) { ctx.globalAlpha = 0.25 + Math.sin(this.time * 6) * 0.12; ctx.drawImage(this.vignette('rgba(180,0,0,1)', 0.3), 0, 0); ctx.globalAlpha = 1; }
      this.drawHUD(ctx);
    }
  }

  /* ---- Genom: a captured boss switches sides ---- */
  convertBoss(z) {
    if (z.dead) return; z.dead = true; z.captured = 0;
    this.zombies = this.zombies.filter(o => o !== z); this.boss = this.zombies.find(o => o.cfg.boss && !o.dead) || null;
    const ally = new AllyBoss(this, this.player, z); this.clones.push(ally);
    this.armScare(); // dragging the dread-wave boss off still lets the thing through
    this.darkFlash = 0.35; this.shake(9); Audio8.play('roar'); Audio8.play('scream');
    for (let i = 0; i < 40; i++) { const a = i / 40 * TAU, sp = 60 + Math.random() * 120; this.particles.push(new Particle(z.x, z.y, Math.cos(a) * sp, Math.sin(a) * sp, 0.5 + Math.random() * 0.4, i % 5 ? '#0a0a0e' : '#5fd35a', 3, 'blood')); }
    this.lights.push({ x: z.x, y: z.y, r: 160, life: 0.4, max: 0.4 });
    this.score += 250; this.ui.showBanner(ally.name, 'is one of us now');
    if (this.player.capturing === z) this.player.capturing = null;
  }
  /* ---- parked cars (Urban City): every car has HP, zombies chew through them, explosions wreck them ---- */
  damageCar(pr, dmg, x, y) {
    if (!pr || pr.type === 'car_wreck' || pr.hp <= 0) return;
    pr.hp -= dmg; pr.hitT = 0.15; this.spark(x != null ? x : pr.x, y != null ? y : pr.y, 2);
    if (Math.random() < 0.5) this.particles.push(new Particle(pr.x + (Math.random() - 0.5) * 20, pr.y, (Math.random() - 0.5) * 30, -20, 0.4, '#8ad0ff', 1.5, 'dot')); // glass
    if (pr.hp <= 0) this.wreckCar(pr);
  }
  wreckCar(pr) {
    if (pr.type === 'car_wreck') return;
    if (pr.taken && this.player.car && this.player.car.prop === pr) { this.player.wreckCar(); return; } // the player was inside
    pr.hp = 0; pr.type = 'car_wreck'; this.map.patchProp(pr); this.map.fires.push({ x: pr.x - 4, y: pr.y - 2 });
    this.explode(pr.x, pr.y, 64, 70, true); this.shake(8); this.floatText(pr.x, pr.y - 20, 'CAR WRECKED', '#ff6a5a');
  }
  drawCars(ctx) {
    for (const pr of this.map.cars) {
      if (pr.taken || pr.type === 'car_wreck') continue;
      if (pr.hitT > 0) { pr.hitT -= 1 / 60; ctx.globalAlpha = 0.6; ctx.drawImage(Sprites.tintOf(pr.type, '#ffffff'), pr.x - 16, pr.y - 8); ctx.globalAlpha = 1; }
      if (pr.hp < pr.maxHp) { ctx.fillStyle = '#111'; ctx.fillRect(pr.x - 12, pr.y - 15, 24, 4); ctx.fillStyle = pr.hp / pr.maxHp < 0.3 ? '#ff3a2a' : '#5ec2ff'; ctx.fillRect(pr.x - 11, pr.y - 14, 22 * clamp(pr.hp / pr.maxHp, 0, 1), 2);
        if (pr.hp / pr.maxHp < 0.4 && Math.random() < 0.15) this.particles.push(new Particle(pr.x + 8, pr.y - 4, (Math.random() - 0.5) * 8, -18, 0.9, '#333', 3, 'smoke')); }
    }
  }
  /* ---- the haunted house and its cannons ---- */
  drawHouse(ctx) {
    const H = this.map.house, h = this.house, t = this.time;
    // cursed ground: a dark purple stain that pulses
    const cg = ctx.createRadialGradient(H.x, H.y + 20, 40, H.x, H.y + 20, 300 + Math.sin(t * 1.5) * 12); cg.addColorStop(0, 'rgba(40,0,30,0.55)'); cg.addColorStop(0.6, 'rgba(30,0,25,0.3)'); cg.addColorStop(1, 'rgba(20,0,20,0)'); ctx.fillStyle = cg; ctx.fillRect(H.x - 320, H.y - 300, 640, 640);
    if (h.dead) { // rubble
      ctx.fillStyle = '#17101a'; ctx.fillRect(H.x - H.w / 2 + 6, H.y - H.h / 2 + 30, H.w - 12, H.h - 34); ctx.fillStyle = '#2a1e22';
      for (let i = 0; i < 24; i++) { const rx = H.x - H.w / 2 + 10 + ((i * 37) % (H.w - 20)), ry = H.y - H.h / 2 + 34 + ((i * 53) % (H.h - 40)); ctx.fillRect(rx, ry, 8 + (i % 4) * 3, 4 + (i % 3) * 2); }
      ctx.globalAlpha = 0.5 + Math.sin(t * 3) * 0.2; ctx.fillStyle = '#ff6a2a'; for (let i = 0; i < 5; i++) ctx.fillRect(H.x - 60 + i * 30, H.y + 10 + (i % 2) * 14, 3, 3); ctx.globalAlpha = 1;
    } else {
      const shake = h.hitT > 0 ? (Math.random() - 0.5) * 3 : 0;
      ctx.drawImage(Sprites.get('house'), Math.round(H.x - H.w / 2 + shake), Math.round(H.y - H.h / 2));
      // windows breathe red; faster and brighter as it dies
      const frac = h.hp / h.maxHp, pulse = 0.35 + Math.sin(t * (2 + (1 - frac) * 6)) * 0.25;
      ctx.fillStyle = `rgba(255,40,30,${pulse})`;
      [[26, 60], [56, 60], [116, 60], [146, 60], [26, 92], [146, 92]].forEach(([wx, wy]) => ctx.fillRect(H.x - H.w / 2 + wx, H.y - H.h / 2 + wy, 16, 14));
      ctx.fillStyle = `rgba(255,40,30,${pulse * 0.6})`; ctx.fillRect(H.x - H.w / 2 + 86, H.y - H.h / 2 + 22, 8, 8);
      const dg = ctx.createRadialGradient(H.x, H.y + H.h / 2 - 8, 2, H.x, H.y + H.h / 2 - 8, 60); dg.addColorStop(0, `rgba(200,20,20,${0.3 + pulse * 0.3})`); dg.addColorStop(1, 'rgba(200,20,20,0)'); ctx.fillStyle = dg; ctx.fillRect(H.x - 70, H.y + H.h / 2 - 70, 140, 100);
      // cracks as it takes damage
      if (frac < 0.7) { if (!h.cracks) { h.cracks = []; for (let i = 0; i < 30; i++) h.cracks.push([Math.random() * (H.w - 30) + 15, 44 + Math.random() * (H.h - 60), (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30]); }
        ctx.strokeStyle = '#050305'; ctx.lineWidth = 2; ctx.beginPath(); h.cracks.slice(0, Math.floor((1 - frac) * 40)).forEach(([cx0, cy0, dx, dy]) => { ctx.moveTo(H.x - H.w / 2 + cx0, H.y - H.h / 2 + cy0); ctx.lineTo(H.x - H.w / 2 + cx0 + dx, H.y - H.h / 2 + cy0 + dy); }); ctx.stroke(); }
      // house health, over the roof
      const bw = 120, bx = H.x - bw / 2, by = H.y - H.h / 2 - 16;
      ctx.fillStyle = '#0c0e14'; ctx.fillRect(bx - 2, by - 2, bw + 4, 10); ctx.fillStyle = '#4a0a0a'; ctx.fillRect(bx, by, bw, 6); ctx.fillStyle = frac < 0.35 ? '#ff3a2a' : '#b02a2a'; ctx.fillRect(bx, by, bw * clamp(frac, 0, 1), 6);
      ctx.font = '6px "Press Start 2P", monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#000'; ctx.fillText('HAUNTED HOUSE', H.x + 1, by - 9); ctx.fillStyle = '#ff8a7a'; ctx.fillText('HAUNTED HOUSE', H.x, by - 10); ctx.textAlign = 'left';
    }
    // cannon emplacements
    for (const tr of this.turrets) {
      if (tr.dead) { ctx.fillStyle = '#1a1c22'; ctx.beginPath(); ctx.arc(tr.x, tr.y, 12, 0, TAU); ctx.fill(); ctx.fillStyle = '#3a3d45'; ctx.fillRect(tr.x - 8, tr.y - 3, 16, 5); continue; }
      Sprites.draw(ctx, 'turret', tr.x, tr.y);
      ctx.save(); ctx.translate(tr.x, tr.y); ctx.rotate(tr.angle); ctx.fillStyle = '#0f1014'; ctx.fillRect(-4, -5, 28, 10); ctx.fillStyle = '#3a3d45'; ctx.fillRect(-3, -4, 26, 8); ctx.fillStyle = '#5c616e'; ctx.fillRect(-3, -4, 26, 3); ctx.fillStyle = '#1a1a1e'; ctx.fillRect(21, -3, 3, 6); if (tr.smoke > 0) { ctx.fillStyle = `rgba(255,${170 + Math.random() * 60},50,${tr.smoke * 3})`; ctx.beginPath(); ctx.arc(26, 0, 6 + Math.random() * 4, 0, TAU); ctx.fill(); } ctx.restore();
      if (tr.web > 0) { const wr = 16; ctx.strokeStyle = 'rgba(245,242,234,0.85)'; ctx.lineWidth = 1; ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; ctx.moveTo(tr.x, tr.y); ctx.lineTo(tr.x + Math.cos(a) * wr, tr.y + Math.sin(a) * wr); } ctx.stroke(); ctx.beginPath(); [0.35, 0.65, 0.95].forEach(k => { for (let i = 0; i <= 8; i++) { const a = i / 8 * TAU, px = tr.x + Math.cos(a) * wr * k, py = tr.y + Math.sin(a) * wr * k; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } }); ctx.stroke(); }
      if (tr.hp < tr.maxHp) { ctx.fillStyle = '#111'; ctx.fillRect(tr.x - 14, tr.y - 22, 28, 4); ctx.fillStyle = '#e0b830'; ctx.fillRect(tr.x - 13, tr.y - 21, 26 * clamp(tr.hp / tr.maxHp, 0, 1), 2); }
    }
  }
  /* full-screen radial overlays are pre-rendered once per size instead of rebuilt every frame */
  vignette(color, inner) {
    const key = color + inner + this.vw + 'x' + this.vh; this._vig = this._vig || {};
    if (!this._vig[key]) {
      const c = document.createElement('canvas'); c.width = this.vw; c.height = this.vh; const x = c.getContext('2d');
      const g = x.createRadialGradient(this.vw / 2, this.vh / 2, this.vh * inner, this.vw / 2, this.vh / 2, this.vh * (inner < 0.4 ? 0.8 : 0.95));
      g.addColorStop(0, color.replace(/[\d.]+\)$/, '0)')); g.addColorStop(1, color); x.fillStyle = g; x.fillRect(0, 0, this.vw, this.vh); this._vig[key] = c;
    }
    return this._vig[key];
  }
  /* ---------------------------------------------------------- horror lighting */
  /* march rays through the tile grid; returns a polygon of lit points (shadow casting) */
  castCone(x, y, angle, half, R, rays = 56) {
    const pts = [[x, y]]; const map = this.map;
    for (let i = 0; i <= rays; i++) {
      const a = angle - half + (2 * half) * i / rays, ca = Math.cos(a), sa = Math.sin(a);
      let d = 0, px = x, py = y;
      while (d < R) { d += 3; px = x + ca * d; py = y + sa * d; if (map.solidAt(px, py)) { break; } }
      pts.push([px, py]);
    }
    return pts;
  }
  drawDarkness(ctx, cx, cy, inGame) {
    const L = this.lctx, t = this.time; const p = this.player;
    L.setTransform(1, 0, 0, 1, 0, 0); L.globalCompositeOperation = 'source-over';
    L.fillStyle = this.menuNight ? 'rgba(6,10,26,0.74)' : 'rgba(1,2,6,0.985)'; L.fillRect(0, 0, this.vw, this.vh);   // the title screen is dusk, not a blackout
    L.globalCompositeOperation = 'destination-out';
    L.translate(-cx, -cy);
    const radial = (x, y, r, a, inner = 0) => { const g = L.createRadialGradient(x, y, r * inner, x, y, r); g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(0.55, `rgba(0,0,0,${a * 0.55})`); g.addColorStop(1, 'rgba(0,0,0,0)'); L.fillStyle = g; L.fillRect(x - r, y - r, r * 2, r * 2); };
    /* soft torch beam: one shadow-cast at the widest angle, then nested wedges that fade toward the edges,
       rendered to a scratch layer and blurred so there are no straight polygon edges or seams */
    const beam = (x, y, ang, half, R, a) => {
      const C = this.coneCanvas, K = this.cctx, HS = 0.5; // half-resolution scratch layer: the blur is 4x cheaper and the upscale adds softness
      K.setTransform(1, 0, 0, 1, 0, 0); K.globalCompositeOperation = 'source-over'; K.clearRect(0, 0, C.width, C.height);
      K.setTransform(HS, 0, 0, HS, -cx * HS, -cy * HS);
      const rays = 96, pts = this.castCone(x, y, ang, half, R, rays); // pts[0] = origin, then rays+1 edge points
      const steps = 7;
      for (let i = 0; i < steps; i++) {
        const frac = 1 - i / steps;                                   // 1 = full width ... narrow core
        const h = Math.max(4, Math.round(rays * frac / 2));           // rays kept on each side of centre
        const mid = 1 + rays / 2;
        K.beginPath(); K.moveTo(pts[0][0], pts[0][1]);
        for (let j = mid - h; j <= mid + h; j++) K.lineTo(pts[j][0], pts[j][1]);
        K.closePath();
        const g = K.createRadialGradient(x, y, 4, x, y, R); const aa = a * (0.22 + 0.13 * i);
        g.addColorStop(0, `rgba(0,0,0,${aa})`); g.addColorStop(0.45, `rgba(0,0,0,${aa * 0.85})`); g.addColorStop(0.8, `rgba(0,0,0,${aa * 0.35})`); g.addColorStop(1, 'rgba(0,0,0,0)');
        K.fillStyle = g; K.fill();
      }
      K.setTransform(1, 0, 0, 1, 0, 0);
      // composite only the beam's bounding box, blurred
      const pad = 24, bx = Math.max(0, Math.floor(x - cx - R - pad)), by = Math.max(0, Math.floor(y - cy - R - pad));
      const bw = Math.min(this.vw - bx, Math.ceil(2 * R + 2 * pad)), bh = Math.min(this.vh - by, Math.ceil(2 * R + 2 * pad));
      if (bw > 0 && bh > 0) { L.save(); L.setTransform(1, 0, 0, 1, 0, 0); if (this.canBlur) L.filter = 'blur(5px)'; L.drawImage(C, bx * HS, by * HS, bw * HS, bh * HS, bx, by, bw, bh); L.filter = 'none'; L.restore(); }
      L.translate(-cx, -cy);
    };
    if (inGame && !p.dead) {
      // the torch occasionally stutters — rarely it cuts out for a heartbeat
      this.torchTimer = (this.torchTimer == null ? 20 : this.torchTimer) - (this.state === 'playing' ? 1 / 60 : 0);
      if (this.torchTimer <= 0) { this.torchTimer = 14 + Math.random() * 20; this.torchOut = 0.14 + Math.random() * 0.12; Audio8.play('flicker'); }
      if (this.torchOut > 0) this.torchOut -= 1 / 60;
      const out = this.torchOut > 0 ? 0.12 : 1;
      const flick = (1 + Math.sin(t * 37) * 0.012 + Math.sin(t * 7.3) * 0.02) * out;
      radial(p.x, p.y, p.beast ? 70 : p.giant ? 60 : 34, 1, 0.2); // personal glow (the beast / giant radiates)
      this.clones.forEach(c => radial(c.x, c.y, c.bk ? 50 : 30, 0.9, 0.2));
      if (p.venom) radial(p.x, p.y, 56, 1, 0.2);
      if (p.frog) radial(p.x, p.y, 60, 1, 0.2);
      if (p.demon) radial(p.x, p.y, 70, 1, 0.2);
      if (p.fieldTime > 0) radial(p.x, p.y, p.char.field.radius + 20, 0.9, 0.3);
      if (p.driving) { beam(p.x, p.y, p.car.heading, 0.5, 220 * flick, 1); radial(p.x, p.y, 40, 1, 0.3); } // headlights
      else beam(p.x, p.y, p.angle, 0.6, 260 * flick, 1);
    }
    // static lights: fires, lamps (some broken & flickering)
    this.map.fires.forEach(f => { if (Math.abs(f.x - cx - this.vw / 2) > this.vw && Math.abs(f.y - cy - this.vh / 2) > this.vh) return; radial(f.x, f.y - 4, 60 + Math.sin(t * 14 + f.x) * 5, 1, 0.05); });
    this.map.lamps.forEach(l => {
      let a = 0.75; if (l.broken) { const n = Math.sin(t * 9 + l.seed) + Math.sin(t * 23 + l.seed * 2) + Math.sin(t * 2.3 + l.seed); a = n > 1.2 ? 0.75 : n > 0.6 ? 0.3 : 0; if (a === 0.75 && Math.random() < 0.02 && Math.hypot(l.x - p.x, l.y - p.y) < 260) Audio8.play('flicker'); }
      if (a > 0) radial(l.x, l.y, 44, a, 0.08);
    });
    // exploders glow, crates beacon, transient lights (muzzle / explosions)
    this.zombies.forEach(z => { if (z.type === 'exploder') radial(z.x, z.y + 2, 26 + (z.fuse >= 0 ? Math.sin(t * 40) * 8 : 0), 0.9, 0.1); if (z.burn > 0) radial(z.x, z.y, 34 + Math.sin(t * 30 + z.walk) * 4, 0.9, 0.1); if (z.kind === 'kraken') radial(z.x, z.y, 48, 0.75, 0.2); if (z.kind === 'ravager') radial(z.x, z.y - z.height, 40, 0.7, 0.15); });
    this.zombies.forEach(z => { if (z.bk && z.bk.bona) radial(z.x, z.y - 10, 110 + Math.sin(t * 9) * 8 + (z.enraged ? 30 : 0), 1, 0.15); });
    this.ebullets.forEach(b => { if (b.cannon) radial(b.x, b.y, 30, 0.8); });
    this.bullets.forEach(b => { if (b.flame) radial(b.x, b.y, 16, 0.5); if (b.lava) radial(b.x, b.y, 40, 0.9, 0.1); });
    this.lures.forEach(L => L.landed && radial(L.x, L.y, 46, 0.7, 0.12));
    this.milk.forEach(M => radial(M.x, M.y, M.r + 20, 0.9, 0.3));
    if (this.player && this.player.floodR > 0) radial(this.player.x, this.player.y, this.player.floodR + 18, 0.75, 0.3);
    this.ebullets.forEach(b => radial(b.x, b.y, b.flame ? 16 : 10, 0.6));
    this.pickups.forEach(k => { if (k.type === 'crate' && Math.sin(t * 6) > 0) radial(k.x, k.y, 22, 0.8); });
    this.lights.forEach(l => radial(l.x, l.y, l.r, l.life / l.max));
    L.setTransform(1, 0, 0, 1, 0, 0); L.globalCompositeOperation = 'source-over';
    ctx.drawImage(this.lightCanvas, 0, 0);
  }
  /* glowing eyes: the only thing you see coming */
  drawEyes(ctx, inView) {
    const p = this.player, t = this.time;
    this.zombies.forEach(z => {
      if (!inView(z)) return;
      const d = Math.hypot(z.x - p.x, z.y - p.y); const a = clamp(1 - d / 320, 0, 1) * (0.55 + 0.45 * Math.abs(Math.sin(t * 3 + z.walk)));
      if (a <= 0.02) return;
      const s = z.scale, col = ZOMBIE_VARIANTS[z.type].R, ex = z.x - 2 * s, ey = z.y - 6 * s + Math.sin(z.walk) * 1.2;
      ctx.globalAlpha = a; ctx.fillStyle = col;
      ctx.fillRect(Math.round(ex), Math.round(ey), Math.ceil(s), Math.ceil(s)); ctx.fillRect(Math.round(ex + 3 * s), Math.round(ey), Math.ceil(s), Math.ceil(s));
      ctx.globalAlpha = a * 0.35; ctx.fillRect(Math.round(ex - 1), Math.round(ey - 1), Math.ceil(s) + 2, Math.ceil(s) + 2); ctx.fillRect(Math.round(ex + 3 * s - 1), Math.round(ey - 1), Math.ceil(s) + 2, Math.ceil(s) + 2);
      ctx.globalAlpha = 1;
    });
  }

  drawHUD(ctx) {
    const p = this.player, F = '8px "Press Start 2P", monospace';
    // on dark maps (Industrial, the Lab, the wave-5 blackout, Bona) the panels have to fight a pure-black background
    const dk = !!this.map.cfg.dark, panel = dk ? 'rgba(16,20,30,0.97)' : 'rgba(12,14,20,0.78)', panelHov = dk ? 'rgba(70,84,112,0.97)' : 'rgba(60,70,90,0.9)', panelEdge = dk ? 'rgba(170,205,255,0.55)' : 'rgba(255,255,255,0.15)', dim = dk ? '#cdd6e6' : '#9aa3b5';
    const fit = (text, maxW) => { while (text.length > 1 && ctx.measureText(text).width > maxW) text = text.slice(0, -1); return text; }; // never let a label spill out of its box
    const box = (x, y, w, h) => { if (dk) { ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x - 2, y - 2, w + 4, h + 4); } ctx.fillStyle = panel; ctx.fillRect(x, y, w, h); ctx.strokeStyle = panelEdge; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1); };
    // hearts + ammo (top-left)
    // hearts wrap into rows of 10 so a big heart count never runs off across the screen
    const hearts = Math.ceil(p.maxHp / 25), perRow = 10, maxRows = 2, bigHeap = hearts > perRow * maxRows;
    const rows = bigHeap ? 1 : Math.ceil(hearts / perRow), hw = Math.min(hearts, perRow) * 13 + 12, hh = rows * 13 + (bigHeap ? 10 : 0);
    box(8, 8, Math.max(hw, 96), 30 + hh);
    if (bigHeap) { // too many to draw one by one — ten hearts as a gauge, with the real numbers on a bar under them
      const frac = clamp(p.hp / p.maxHp, 0, 1), bw = Math.max(hw, 96) - 12;
      for (let i = 0; i < perRow; i++) { const v = frac * perRow - i; const name = v >= 1 ? 'heart_full' : v >= 0.5 ? 'heart_half' : 'heart_empty'; Sprites.draw(ctx, name, 14 + i * 13, 14, { ox: 0, oy: 0, scale: 1.5 }); }
      ctx.fillStyle = '#111'; ctx.fillRect(14, 27, bw, 8); ctx.fillStyle = frac > 0.5 ? '#b3221a' : frac > 0.25 ? '#e08a2a' : '#ff5a4a'; ctx.fillRect(15, 28, (bw - 2) * frac, 6);
      ctx.font = '6px "Press Start 2P", monospace'; ctx.fillStyle = '#fff'; ctx.textBaseline = 'top'; ctx.fillText(`${Math.ceil(p.hp)}/${p.maxHp} \u00b7 ${hearts} HEARTS`, 17, 29); ctx.font = F;
    }
    else for (let i = 0; i < hearts; i++) { const v = p.hp - i * 25; const name = v >= 25 ? 'heart_full' : v >= 12 ? 'heart_half' : 'heart_empty'; Sprites.draw(ctx, name, 14 + (i % perRow) * 13, 14 + Math.floor(i / perRow) * 13, { ox: 0, oy: 0, scale: 1.5 }); }
    const ay0 = 17 + hh, off = hh - 13; // everything below the hearts shifts down with extra rows
    Sprites.draw(ctx, 'pickup_ammo', 14, ay0, { ox: 0, oy: 0, scale: 1 });
    ctx.font = F; ctx.fillStyle = '#fff'; ctx.textBaseline = 'top';
    const w = p.wstate; ctx.fillText(p.venom ? 'VENOM' : p.frog ? 'FROG' : p.demon ? 'DEMON' : p.lavaT > 0 ? '∞ LAVA' : p.beast ? `${p.beastAmmo}/${BEAST_GUN.mag}` : (p.overdrive || p.rushing || (p.driving && !p.car.civil)) ? '∞/∞' : `${w.mag}/${w.reserve === Infinity ? '∞' : w.reserve}`, 30, ay0 + 3);
    if (p.beast) { ctx.fillStyle = p.beastAmmo > 0 ? '#c9cfdb' : '#ff6a5a'; ctx.font = '6px "Press Start 2P", monospace'; ctx.fillText(`REFILL ${p.beastKills}/${BEAST_GUN.refillKills} KILLS`, 8, 56 + off); ctx.font = F; }
    if (p.reloading) { ctx.fillStyle = '#f5c518'; ctx.fillText('RELOADING', 8, 56 + off); } else if (w.mag === 0 && w.reserve === 0) { ctx.fillStyle = '#ff6a5a'; ctx.fillText('NO AMMO - [B] BUY', 8, 56 + off); }
    // coins + supply cart button
    Sprites.draw(ctx, 'pickup_coin', 8, 70 + off, { ox: 0, oy: 0, scale: 0.8 }); ctx.fillStyle = '#f5c518'; ctx.fillText(String(this.coins), 22, 72 + off);
    const hover = this.cartRect && this.input.mouseX >= this.cartRect.x && this.input.mouseX <= this.cartRect.x + this.cartRect.w && this.input.mouseY >= this.cartRect.y && this.input.mouseY <= this.cartRect.y + this.cartRect.h;
    const lowAmmo = Object.values(p.weapons).some(ww => ww.reserve !== Infinity && ww.mag + ww.reserve <= WEAPONS[p.current].mag * 0.5);
    const cy0 = 86 + off; this.cartRect = { x: 8, y: cy0, w: 64, h: 22 };
    if (dk) { ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(6, cy0 - 2, 68, 26); } ctx.fillStyle = hover ? panelHov : panel; ctx.fillRect(8, cy0, 64, 22);
    ctx.strokeStyle = lowAmmo && Math.sin(this.time * 6) > 0 ? '#f5c518' : 'rgba(255,255,255,0.25)'; ctx.strokeRect(8.5, cy0 + 0.5, 63, 21);
    Sprites.draw(ctx, 'icon_cart', 12, cy0 + 5, { ox: 0, oy: 0 }); ctx.fillStyle = '#fff'; ctx.font = '6px "Press Start 2P", monospace'; ctx.fillText('CART', 30, cy0 + 5); ctx.fillStyle = '#9aa3b5'; ctx.fillText('[B]', 30, cy0 + 14); ctx.font = F;
    // wave + score (top-right)
    const goal = Math.ceil(Math.max(1, this.wave) / CONFIG.WAVES_PER_LEVEL) * CONFIG.WAVES_PER_LEVEL;
    box(this.vw - 120, 8, 112, 36); ctx.fillStyle = '#fff'; ctx.textAlign = 'left';
    ctx.fillText(this.event ? `BLACKOUT W${this.wave}` : `WAVE ${this.wave}/${goal}`, this.vw - 112, 14); ctx.fillText(`SCORE: ${this.score}`, this.vw - 112, 28);
    // remaining
    const remain = this.zombies.length + this.toSpawn; ctx.fillStyle = '#c9cfdb'; ctx.fillText(this.siege ? `☠ ${this.zombies.length} · ∞` : `☠ ${remain}`, this.vw - 112, 50);
    // weapon (bottom-left)
    box(8, this.vh - 34, 130, 26);
    if (p.frenzy) { ctx.fillStyle = '#8af0ff'; ctx.fillText('JAWS', 14, this.vh - 27); ctx.fillStyle = dim; ctx.font = '6px "Press Start 2P", monospace'; ctx.fillText(fit('LMB LUNGE · EAT TO HEAL', 116), 14, this.vh - 16); }
    else if (p.lavaT > 0) { ctx.fillStyle = '#ff7a1a'; ctx.fillText('LAVA STONES', 14, this.vh - 27); ctx.fillStyle = dim; ctx.font = '6px "Press Start 2P", monospace'; ctx.fillText(fit('LMB THROW · LANDS AT CURSOR', 116), 14, this.vh - 16); }
    else if (p.demon) { ctx.fillStyle = '#ff5aa8'; ctx.fillText('DEMON KATANA', 14, this.vh - 27); ctx.fillStyle = dim; ctx.font = '6px "Press Start 2P", monospace'; ctx.fillText(fit('LMB SLASH · RMB KICK · ♪ CHARM', 116), 14, this.vh - 16); }
    else if (p.frog) { ctx.fillStyle = '#9ccf72'; ctx.fillText('TONGUE', 14, this.vh - 27); ctx.fillStyle = dim; ctx.font = '6px "Press Start 2P", monospace'; ctx.fillText(fit('LMB LASH · SPACE HOP · R ARMY', 116), 14, this.vh - 16); }
    else if (p.venom) { ctx.fillStyle = '#5fd35a'; ctx.fillText('VENOM SPIT', 14, this.vh - 27); ctx.fillStyle = dim; ctx.font = '6px "Press Start 2P", monospace'; ctx.fillText(fit('LMB SPIT · RMB CLAW · R CAPTURE', 116), 14, this.vh - 16); }
    else if (p.driving && !p.car.civil) { ctx.drawImage(Sprites.get('gun_m249'), 10, this.vh - 29, 36, 15); ctx.fillStyle = '#5a8ad8'; ctx.fillText(fit('TWIN M249', 86), 48, this.vh - 27); ctx.fillStyle = dim; ctx.font = '6px "Press Start 2P", monospace'; ctx.fillText(fit('WASD DRIVE · LMB TURRETS', 86), 48, this.vh - 16); }
    else if (p.beast) { ctx.drawImage(Sprites.get('gun_flesh'), 10, this.vh - 31, 36, 15); ctx.fillStyle = p.beastAmmo > 0 ? '#ff8a6a' : '#9aa3b5'; ctx.fillText(fit(p.beastAmmo > 0 ? 'FLESH CANNON' : 'CANNON DRY', 86), 48, this.vh - 27); ctx.fillStyle = dim; ctx.font = '6px "Press Start 2P", monospace'; ctx.fillText(fit(p.beastAmmo > 0 ? 'LMB FIRE · RMB SMASH · SPC LEAP' : 'LMB SMASH · SPACE LEAP', 86), 48, this.vh - 16); }
    else { const img = Sprites.get(p.wcfg.sprite); ctx.drawImage(img, 12, this.vh - 30, 32, 16); ctx.fillStyle = '#fff'; ctx.fillText(fit(p.wcfg.name.toUpperCase(), 130 + 8 - 48 - 4), 48, this.vh - 27);
    ctx.fillStyle = dim; ctx.font = '6px "Press Start 2P", monospace'; ctx.fillText(fit(p.moneyT > 0 ? 'RMB = MONEY BAG' : `[${p.weaponOrder.indexOf(p.current) + 1}/${p.weaponOrder.length}] Q/SCROLL SWAP`, 86), 48, this.vh - 16); }
    // GET IN / GET OUT prompt for parked cars (Urban City)
    this.carRect = null; let slotY = this.vh - 64;
    const nearCar = p.nearbyCar(), inCar = p.car && p.car.civil;
    if (nearCar || inCar) {
      const ax = 8, ay = slotY, aw = 130, ah = 26; this.carRect = { x: ax, y: ay, w: aw, h: ah }; slotY -= 30;
      const hov = this.input.mouseX >= ax && this.input.mouseX <= ax + aw && this.input.mouseY >= ay && this.input.mouseY <= ay + ah;
      if (dk) { ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(ax - 2, ay - 2, aw + 4, ah + 4); } ctx.fillStyle = hov ? panelHov : panel; ctx.fillRect(ax, ay, aw, ah);
      if (inCar) { ctx.fillStyle = 'rgba(94,194,255,0.3)'; ctx.fillRect(ax, ay, aw * clamp(p.car.hp / p.car.maxHp, 0, 1), ah); }
      ctx.strokeStyle = inCar ? '#5ec2ff' : (Math.sin(this.time * 8) > 0 ? '#5ec2ff' : '#ffffff'); ctx.strokeRect(ax + 0.5, ay + 0.5, aw - 1, ah - 1);
      ctx.font = '6px "Press Start 2P", monospace'; ctx.fillStyle = '#5ec2ff'; ctx.fillText(inCar ? 'GET OUT' : 'GET IN', ax + 6, ay + 5);
      ctx.fillStyle = '#c9cfdb'; ctx.fillText(fit(inCar ? `[G] · CAR ${Math.max(0, Math.ceil(p.car.hp))} HP · ${Math.round(Math.abs(p.car.speed))} KM/H` : '[G] · CLICK · PARKED CAR', aw - 12), ax + 6, ay + 15);
      ctx.font = F;
    }
    // character ability button (Drone's TRANSFORM / Runner's RUSH)
    const ca = p.charAbility(); this.transformRect = null;
    if (ca) {
      const ax = 8, ay = slotY, aw = 130, ah = 26; this.transformRect = { x: ax, y: ay, w: aw, h: ah }; slotY -= 30;
      const active = ca.state === 'active', ready = ca.state === 'ready', col = p.char.rush ? '#5ec2ff' : p.char.squad ? '#ffd23a' : p.char.field ? '#7fd35a' : p.char.vehicle ? '#5a8ad8' : p.char.tapri ? '#ff5a4a' : p.char.web ? '#f4f2ea' : p.char.symbiote ? '#5fd35a' : '#8bd35a';
      const hov = this.input.mouseX >= ax && this.input.mouseX <= ax + aw && this.input.mouseY >= ay && this.input.mouseY <= ay + ah;
      if (dk) { ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(ax - 2, ay - 2, aw + 4, ah + 4); } ctx.fillStyle = hov ? panelHov : panel; ctx.fillRect(ax, ay, aw, ah);
      if (active) { ctx.fillStyle = p.char.rush ? 'rgba(94,194,255,0.35)' : p.char.squad ? 'rgba(255,210,58,0.3)' : p.char.vehicle ? 'rgba(90,138,216,0.35)' : p.char.field ? 'rgba(127,211,90,0.3)' : 'rgba(255,60,30,0.35)'; ctx.fillRect(ax, ay, aw * ca.frac, ah); }
      else if (ca.state === 'cd') { ctx.fillStyle = 'rgba(120,130,150,0.25)'; ctx.fillRect(ax, ay, aw * ca.frac, ah); }
      ctx.strokeStyle = ready ? (Math.sin(this.time * 8) > 0 ? col : '#ffffff') : active ? col : 'rgba(255,255,255,0.25)'; ctx.strokeRect(ax + 0.5, ay + 0.5, aw - 1, ah - 1);
      ctx.font = '6px "Press Start 2P", monospace'; ctx.fillStyle = ready ? col : active ? '#fff' : '#9aa3b5';
      ctx.fillText(ca.name, ax + 6, ay + 5);
      ctx.fillStyle = '#c9cfdb'; ctx.fillText(fit(ca.sub, aw - 12), ax + 6, ay + 15);
      ctx.font = F;
    }
    // second character ability (Spider Mad's WEB PULL)
    const ca2 = p.charAbility2(); this.transformRect2 = null;
    if (ca2) {
      const ax = 8, ay = slotY, aw = 130, ah = 26; this.transformRect2 = { x: ax, y: ay, w: aw, h: ah }; slotY -= 30;
      const active = ca2.state === 'busy', ready = ca2.state === 'ready', col = '#8af0ff';
      const hov = this.input.mouseX >= ax && this.input.mouseX <= ax + aw && this.input.mouseY >= ay && this.input.mouseY <= ay + ah;
      if (dk) { ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(ax - 2, ay - 2, aw + 4, ah + 4); } ctx.fillStyle = hov ? panelHov : panel; ctx.fillRect(ax, ay, aw, ah);
      if (ca2.state === 'cd') { ctx.fillStyle = 'rgba(120,130,150,0.25)'; ctx.fillRect(ax, ay, aw * ca2.frac, ah); }
      ctx.strokeStyle = ready ? (Math.sin(this.time * 8) > 0 ? col : '#ffffff') : active ? col : 'rgba(255,255,255,0.25)'; ctx.strokeRect(ax + 0.5, ay + 0.5, aw - 1, ah - 1);
      ctx.font = '6px "Press Start 2P", monospace'; ctx.fillStyle = ready ? col : active ? '#fff' : '#9aa3b5'; ctx.fillText(ca2.name, ax + 6, ay + 5);
      ctx.fillStyle = '#c9cfdb'; ctx.fillText(fit(ca2.sub, aw - 12), ax + 6, ay + 15); ctx.font = F;
    }
    // weapon ability button (only when the current weapon has one)
    const ab = p.wcfg.ability; this.abilityRect = null;
    if (ab && p.form === 'human' && !p.venom && !p.frog && !p.demon && !p.driving) { // hidden whenever the gun itself is put away
      const ax = 8, ay = slotY, aw = 130, ah = 26; this.abilityRect = { x: ax, y: ay, w: aw, h: ah };
      const active = p.overdrive, cd = p.ability.cd, ready = !active && cd <= 0;
      const hov = this.input.mouseX >= ax && this.input.mouseX <= ax + aw && this.input.mouseY >= ay && this.input.mouseY <= ay + ah;
      if (dk) { ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(ax - 2, ay - 2, aw + 4, ah + 4); } ctx.fillStyle = hov ? panelHov : panel; ctx.fillRect(ax, ay, aw, ah);
      if (active) { ctx.fillStyle = 'rgba(255,140,30,0.35)'; ctx.fillRect(ax, ay, aw * (p.ability.active / ab.duration), ah); }
      else if (!ready) { ctx.fillStyle = 'rgba(120,130,150,0.25)'; ctx.fillRect(ax, ay, aw * (1 - cd / ab.cooldown), ah); }
      ctx.strokeStyle = ready ? (Math.sin(this.time * 8) > 0 ? '#ffb02a' : '#ffe08a') : active ? '#ff8a2a' : 'rgba(255,255,255,0.25)'; ctx.strokeRect(ax + 0.5, ay + 0.5, aw - 1, ah - 1);
      ctx.font = '6px "Press Start 2P", monospace'; ctx.fillStyle = ready ? '#ffb02a' : active ? '#fff' : '#9aa3b5';
      ctx.fillText(ab.name, ax + 6, ay + 5);
      ctx.fillStyle = '#c9cfdb'; ctx.fillText(fit(active ? `${Math.ceil(p.ability.active)}s LEFT` : ready ? `[${p.char.wife ? 'F' : ab.key.toUpperCase()}] READY · CLICK` : `RECHARGING ${Math.ceil(cd)}s`, aw - 12), ax + 6, ay + 15);
      ctx.font = F;
    }
    // xp bar (bottom-centre)
    const bx = this.vw / 2 - 90, by = this.vh - 16; ctx.fillStyle = '#0c0e14'; ctx.fillRect(bx - 1, by - 1, 182, 8); ctx.fillStyle = '#3f8f2f'; ctx.fillRect(bx, by, 180 * clamp(p.xp / p.xpNext, 0, 1), 6);
    ctx.font = '6px "Press Start 2P", monospace'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(`LVL ${p.level}`, this.vw / 2, by - 9); ctx.textAlign = 'left';
    // boss bar
    let barTop = 10;
    if (this.siege && this.house) { const bw = 240, bxx = this.vw / 2 - bw / 2, by = 10, frac = clamp(this.house.hp / this.house.maxHp, 0, 1); ctx.fillStyle = '#0c0e14'; ctx.fillRect(bxx - 2, by, bw + 4, 12); ctx.fillStyle = '#3a0a0a'; ctx.fillRect(bxx, by + 2, bw, 8); ctx.fillStyle = this.house.dead ? '#333' : frac < 0.35 ? '#ff3a2a' : '#b02a2a'; ctx.fillRect(bxx, by + 2, bw * frac, 8); ctx.font = '6px "Press Start 2P", monospace'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(this.house.dead ? 'HOUSE DESTROYED' : `HAUNTED HOUSE · ${Math.ceil(this.house.hp)} / ${this.house.maxHp}`, this.vw / 2, by + 15); ctx.textAlign = 'left'; ctx.font = F; barTop = 34; }
    const bosses = this.zombies.filter(z => z.cfg.boss && !z.dead);
    bosses.slice(0, 3).forEach((b, i) => { const bw = 240, bxx = this.vw / 2 - bw / 2, by = barTop + i * 24; ctx.fillStyle = '#0c0e14'; ctx.fillRect(bxx - 2, by, bw + 4, 12); ctx.fillStyle = '#5f2e8a'; ctx.fillRect(bxx, by + 2, bw, 8); ctx.fillStyle = b.aiming > 0 ? '#ff4a3a' : '#c05aff'; ctx.fillRect(bxx, by + 2, bw * clamp(b.hp / b.maxHp, 0, 1), 8); ctx.font = '6px "Press Start 2P", monospace'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(`${b.bk ? b.bk.name : 'BOSS'} LV ${this.wave} · ${Math.ceil(b.hp)}`, this.vw / 2, by + 15); ctx.textAlign = 'left'; ctx.font = F; });
    if (this.state === 'wavebreak') { ctx.font = F; ctx.fillStyle = '#f5c518'; ctx.textAlign = 'center'; ctx.fillText(`NEXT WAVE IN ${Math.ceil(this.breakTimer)}`, this.vw / 2, 60); ctx.textAlign = 'left'; }
    if (this.settings.minimap !== false) { this.map.drawMinimap(this.mini, p, this.zombies, this.pickups); ctx.globalAlpha = 0.85; ctx.drawImage(this.mini, this.vw - this.mini.width - 8, this.vh - this.mini.height - 40); ctx.globalAlpha = 1; ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.strokeRect(this.vw - this.mini.width - 8.5, this.vh - this.mini.height - 40.5, this.mini.width + 1, this.mini.height + 1); }
    if (this.admin) { ctx.font = '6px "Press Start 2P", monospace'; ctx.fillStyle = '#ffd23a'; ctx.textAlign = 'center'; ctx.fillText('ADMIN' + (this.god ? ' · GOD' : '') + (this.infAmmo ? ' · ∞AMMO' : ''), this.vw / 2, 4); ctx.textAlign = 'left'; ctx.font = F; }
    if (this.settings.fps) { ctx.font = '6px "Press Start 2P", monospace'; ctx.fillStyle = '#8bc46e'; ctx.fillText(`${this.fps} FPS  Z:${this.zombies.length} P:${this.particles.length}`, this.vw - 140, this.vh - 10); }
  }
}
