/* ==========================================================================
   entities.js — Player, Zombie, Bullet, Pickup, Particle
   ========================================================================== */
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);

/* white silhouette variant of a sprite (for hit flash) */
Sprites.whiteOf = function (name) {
  const key = name + '_white';
  if (this.cache[key]) return this.cache[key];
  const src = this.cache[name]; const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
  const x = c.getContext('2d'); x.drawImage(src, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
  this.cache[key] = c; return c;
};

/* colour-tinted silhouette of a sprite (transformation flashes) */
Sprites.tintOf = function (name, color) {
  const key = name + '_tint_' + color;
  if (this.cache[key]) return this.cache[key];
  const src = this.cache[name]; const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
  const x = c.getContext('2d'); x.drawImage(src, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = color; x.fillRect(0, 0, c.width, c.height);
  this.cache[key] = c; return c;
};

/* build every animation variant up front — generating them mid-transformation caused a visible hitch */
Sprites.prewarm = function () {
  for (const id in CHARACTERS) { const n = 'player_' + id; this.tintOf(n, '#ff3a2a'); this.tintOf(n, '#5ec2ff'); this.tintOf(n, '#8bd35a'); this.whiteOf(n); }
  ['beast', 'beast_rage'].forEach(n => { this.tintOf(n, '#ffffff'); this.tintOf(n, '#ff8a7a'); this.whiteOf(n); });
  ['venom'].forEach(n => { this.tintOf(n, '#f4f2ea'); this.tintOf(n, '#ff8a7a'); this.tintOf(n, '#0a0a0e'); });
  for (const id in CHARACTERS) this.tintOf('player_' + id, '#0a0a0e');
  for (const k in BOSSES) { this.tintOf('boss_' + k, '#0a0a0e'); this.tintOf('boss_' + k, '#3a1a3a'); }
  for (const w in WEAPONS) this.tintOf(WEAPONS[w].sprite, '#141418'); this.tintOf('gun_cannon', '#141418');
  this.tintOf('truck', '#ff8a7a');
  for (const t in ENEMIES) { this.whiteOf(ENEMIES[t].sprite); if (this.cache[ENEMIES[t].sprite + '_lab']) this.whiteOf(ENEMIES[t].sprite + '_lab'); }
  for (const k in BOSSES) this.whiteOf('boss_' + k);
};

/* ---------------------------------------------------------------- PLAYER */
class Player {
  constructor(game, x, y, charId = 'rookie', weaponIds = ['shotgun']) {
    this.game = game; this.x = x; this.y = y; this.r = 6;
    this.charId = charId; this.char = CHARACTERS[charId]; this.sprite = 'player_' + charId;
    this.baseSpeed = 112 * this.char.speed; this.angle = 0; this.flip = false; this.walk = 0; this.moving = false;
    this.upgrades = { damage: 0, firerate: 0, maxhp: 0, speed: 0 };
    this.maxHp = this.char.hp; this.hp = this.maxHp;
    this.weapons = {}; this.weaponOrder = [];
    this.current = 'pistol'; this.fireTimer = 0; this.reloading = false; this.reloadTimer = 0;
    this.invuln = 0; this.hurtFlash = 0; this.dead = false; this.sinceHurt = 99;
    this.xp = 0; this.level = 1; this.xpNext = CONFIG.XP_BASE;
    this.recoil = 0;
    this.ability = { active: 0, cd: 0, weapon: null };   // weapon special (minigun OVERDRIVE)
    this.form = 'human'; this.morphT = 0; this.formTime = 0; this.formCd = 0; this.jump = null; this.height = 0; this.leapCd = 0; this.smashCd = 0; this.swipe = 0; this.swipeAngle = 0;
    this.beastAmmo = BEAST_GUN.mag; this.beastKills = 0; this.beastMuzzle = 0;
    this.rush = 0; this.rushCd = 0; this.trail = [];
    this.squadTime = 0; this.squadCd = 0;
    this.fieldTime = 0; this.fieldCd = 0;
    this.car = null; this.carCd = 0;
    this.giant = false; this.gjump = null; this.gleapCd = 0;
    this.tapriTime = 0; this.tapriCd = 0;
    this.webZip = null; this.webCd = 0; this.pullCd = 0; this.pulling = null;
    this.sym = 'human'; this.symT = 0; this.clawCd = 0; this.captureCd = 0; this.capturing = null;
    this.frogState = 'human'; this.frogT = 0; this.frogTime = 0; this.frogCd = 0; this.hop = null; this.hopCd = 0; this.tongue = null; this.tongueCd = 0; this.armyCd = 0; this.armyTime = 0;
    this.demonState = 'human'; this.demonT = 0; this.demonTime = 0; this.demonCd = 0; this.kick = null; this.kickCd = 0; this.slash = 0; this.slashAngle = 0; this.slashCd = 0;
    this.addWeapon('pistol', true);
    weaponIds.forEach(id => { if (WEAPONS[id] && id !== 'pistol') this.addWeapon(id, true); });
    this.current = weaponIds[0] && WEAPONS[weaponIds[0]] ? weaponIds[0] : 'pistol';
  }
  addWeapon(id, silent) {
    const cfg = WEAPONS[id];
    if (this.weapons[id]) { this.weapons[id].reserve = Math.min(this.weapons[id].reserve + cfg.reserve, cfg.reserve * 2); return false; }
    this.weapons[id] = { mag: cfg.mag, reserve: cfg.reserve, maxReserve: cfg.reserve * 2 };
    this.weaponOrder = WEAPON_ORDER.filter(w => this.weapons[w]);
    if (!silent) { this.switchTo(id); Audio8.play('weapon'); }
    return true;
  }
  get wcfg() { return WEAPONS[this.current]; }
  /* is the current weapon firing for free right now? */
  get overdrive() { return this.ability.active > 0 && this.ability.weapon === this.current; }
  useAbility() {
    const ab = this.wcfg.ability; if (!ab || this.venom || this.frog || this.demon || this.driving || this.form !== 'human') return false;
    if (this.ability.active > 0) return false;
    if (this.ability.cd > 0) { Audio8.play('empty'); this.game.floatText(this.x, this.y - 16, `${ab.name} IN ${Math.ceil(this.ability.cd)}s`, '#9aa3b5'); return false; }
    this.ability.active = ab.duration; this.ability.weapon = this.current; this.reloading = false; this.wstate.mag = this.wcfg.mag;
    Audio8.play('levelup'); this.game.shake(4); this.game.floatText(this.x, this.y - 18, ab.name + '!', '#ffb02a'); this.game.showAbilityBanner(ab.name, `${ab.duration}s of infinite fire`);
    return true;
  }
  get wstate() { return this.weapons[this.current]; }
  get damageMult() { return (1 + 0.15 * this.upgrades.damage) * this.char.damage; }
  get fireMult() { return (1 + 0.12 * this.upgrades.firerate) * this.char.firerate; }
  get speed() { return this.baseSpeed * (1 + 0.08 * this.upgrades.speed) * (this.beast ? this.tf.speed : 1) * (this.venom ? this.sb.speed : 1) * (this.frog ? this.fr.speed : 1) * (this.demon ? this.dm.speed : 1) * (this.rushing ? this.char.rush.speed : 1); }

  get tf() { return this.char.transform; }
  get rushing() { return this.rush > 0; }
  /* ---- Runner: RUSH — speed, infinite ammo, every gun at max fire rate ---- */
  useRush() {
    const r = this.char.rush; if (!r) return false;
    if (this.rush > 0) return false;
    if (this.rushCd > 0) { Audio8.play('empty'); this.game.floatText(this.x, this.y - 16, `RUSH IN ${Math.ceil(this.rushCd)}s`, '#9aa3b5'); return false; }
    this.rush = r.duration; this.reloading = false; this.wstate.mag = this.wcfg.mag;
    Audio8.play('levelup'); Audio8.play('weapon'); this.game.shake(5); this.game.whiteFlash = 0.15;
    this.game.showAbilityBanner('RUSH', `${r.duration}s · run like hell · ∞ ammo · max fire rate on every gun`);
    for (let i = 0; i < 24; i++) { const a = i / 24 * TAU; this.game.particles.push(new Particle(this.x, this.y, Math.cos(a) * 140, Math.sin(a) * 140, 0.35, '#5ec2ff', 2, 'dot')); }
    return true;
  }
  /* ---- Heavy: SQUAD — six clones fight at his side ---- */
  useSquad() {
    const sq = this.char.squad, g = this.game; if (!sq) return false;
    if (this.squadTime > 0) return false;
    if (this.squadCd > 0) { Audio8.play('empty'); g.floatText(this.x, this.y - 16, `SQUAD IN ${Math.ceil(this.squadCd)}s`, '#9aa3b5'); return false; }
    this.squadTime = sq.duration;
    for (let i = 0; i < sq.count; i++) { const a = i / sq.count * TAU; const pos = g.map.resolve(this.x + Math.cos(a) * 34, this.y + Math.sin(a) * 34, 6); g.clones.push(new Clone(g, this, pos.x, pos.y, i)); for (let k = 0; k < 8; k++) g.particles.push(new Particle(pos.x, pos.y + 4, (Math.random() - 0.5) * 40, -20 - Math.random() * 30, 0.6, '#8bd35a', 2, 'smoke')); }
    Audio8.play('levelup'); Audio8.play('weapon'); g.shake(4); g.whiteFlash = 0.12; g.lights.push({ x: this.x, y: this.y, r: 120, life: 0.3, max: 0.3 });
    g.showAbilityBanner('SQUAD', `${sq.count} clones · ${sq.duration}s · they draw fire and shoot back`);
    return true;
  }
  /* ---- Medic: MED FIELD — a green aura that heals steadily for 20 s ---- */
  useField() {
    const f = this.char.field, g = this.game; if (!f) return false;
    if (this.fieldTime > 0) return false;
    if (this.fieldCd > 0) { Audio8.play('empty'); g.floatText(this.x, this.y - 16, `MED FIELD IN ${Math.ceil(this.fieldCd)}s`, '#9aa3b5'); return false; }
    this.fieldTime = f.duration; Audio8.play('health'); Audio8.play('levelup'); g.shake(2); g.lights.push({ x: this.x, y: this.y, r: 120, life: 0.3, max: 0.3 });
    for (let i = 0; i < 20; i++) { const a = i / 20 * TAU; g.particles.push(new Particle(this.x, this.y, Math.cos(a) * 90, Math.sin(a) * 90, 0.4, '#7fd35a', 2, 'dot')); }
    g.showAbilityBanner('MED FIELD', `${f.duration}s of steady healing · stay in the circle`);
    return true;
  }
  /* BLACKOUT giant mode: leap toward the cursor and crush everything where you land */
  giantLeap() {
    if (!this.giant || this.gjump) return false;
    if (this.gleapCd > 0) { Audio8.play('empty'); this.game.floatText(this.x, this.y - 30, `LEAP IN ${this.gleapCd.toFixed(1)}s`, '#9aa3b5'); return false; }
    const inp = this.game.input, a = Math.atan2(inp.worldY - this.y, inp.worldX - this.x), d = Math.min(BLACKOUT.leap, dist(this.x, this.y, inp.worldX, inp.worldY));
    this.gjump = { t: 0, dur: 0.5, sx: this.x, sy: this.y, tx: this.x + Math.cos(a) * d, ty: this.y + Math.sin(a) * d }; this.invuln = 0.6; Audio8.play('growl'); this.game.shake(2); return true;
  }
  /* ---- Spider Mad: WEB ZIP — thwip a web at the cursor and get pulled there ---- */
  useWeb() {
    const wb = this.char.web, g = this.game; if (!wb || this.webZip || this.webCd > 0 || this.car) return false;
    const inp = g.input; let a = Math.atan2(inp.worldY - this.y, inp.worldX - this.x), d = Math.min(wb.range, dist(this.x, this.y, inp.worldX, inp.worldY));
    if (d < 12) return false;
    // march the web out until it hits a wall or a zombie; that's the anchor
    let ax = this.x, ay = this.y, hitZ = null;
    for (let s = 6; s <= d; s += 4) { const px = this.x + Math.cos(a) * s, py = this.y + Math.sin(a) * s; if (g.map.solidAt(px, py)) break; ax = px; ay = py; hitZ = g.zombies.find(z => !z.dead && dist(px, py, z.x, z.y) < z.r + 4) || null; if (hitZ) break; }
    if (dist(this.x, this.y, ax, ay) < 10) { Audio8.play('empty'); return false; }
    this.webZip = { ax, ay, t: 0, hitZ }; this.invuln = Math.max(this.invuln, 0.25);
    Audio8.play('swap'); Audio8.play('flame'); g.floatText(this.x, this.y - 16, 'THWIP', '#f4f2ea');
    return true;
  }
  updateWeb(dt) {
    const wb = this.char.web, g = this.game, z = this.webZip; if (!z) { this.webCd -= dt; return false; }
    const dx = z.ax - this.x, dy = z.ay - this.y, d = Math.hypot(dx, dy), step = wb.speed * dt;
    if (d <= step + 2) { this.x = z.ax; this.y = z.ay; const p = g.map.resolve(this.x, this.y, this.r); this.x = p.x; this.y = p.y; this.land(); return true; }
    const nx = this.x + dx / d * step, ny = this.y + dy / d * step; const p = g.map.resolve(nx, ny, this.r);
    if (Math.hypot(p.x - nx, p.y - ny) > 1) { this.x = p.x; this.y = p.y; this.land(); return true; }
    this.x = p.x; this.y = p.y; this.walk += dt * 14;
    if (Math.random() < 0.5) g.particles.push(new Particle(this.x, this.y + 4, (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20, 0.25, '#f4f2ea', 1.5, 'dot'));
    return true;
  }
  land() {
    const wb = this.char.web, g = this.game, z = this.webZip; this.webZip = null; this.webCd = wb.cd;
    let hits = 0; g.zombies.forEach(zz => { if (!zz.dead && dist(this.x, this.y, zz.x, zz.y) < 34 + zz.r) { zz.takeDamage(wb.kick * this.damageMult, Math.atan2(zz.y - this.y, zz.x - this.x), undefined, 3); hits++; } });
    if (hits) { g.shake(3); Audio8.play('thud'); g.floatText(this.x, this.y - 20, 'KICK!', '#f4f2ea'); } else Audio8.play('click');
    for (let i = 0; i < 6; i++) g.particles.push(new Particle(this.x, this.y + 6, (Math.random() - 0.5) * 50, -10 - Math.random() * 20, 0.35, '#8a8d96', 2, 'smoke'));
  }
  /* ---- Genom: the symbiote. T to bond, T to shed. No timer. ---- */
  get sb() { return this.char.symbiote; }
  get venom() { return this.sym === 'venom'; }
  toggleSymbiote() {
    const sb = this.sb, g = this.game; if (!sb || this.car) return false;
    if (this.sym === 'human') { this.sym = 'morphing'; this.symT = 0; this.reloading = false; this.invuln = sb.morph + 0.3; Audio8.play('growl'); Audio8.play('hurt'); g.showAbilityBanner('SYMBIOTE', 'It found a host.'); return true; }
    if (this.sym === 'venom') { this.sym = 'reverting'; this.symT = 0; this.invuln = sb.revert + 0.2; Audio8.play('flame'); g.floatText(this.x, this.y - 30, 'SHEDDING...', '#c9cfdb'); return true; }
    return false;
  }
  updateSymbiote(dt, input) {
    const sb = this.sb, g = this.game;
    if (this.sym === 'human') { this.captureCd -= dt; return false; }
    if (this.sym === 'morphing') {
      const prev = this.symT; this.symT += dt; const k = this.symT / sb.morph; g.shakeAmt = Math.max(g.shakeAmt, 1 + k * 6); this.invuln = 0.5;
      if (Math.random() < 0.8) { const a = Math.random() * TAU; g.particles.push(new Particle(this.x + Math.cos(a) * 16, this.y + 8, Math.cos(a) * 20, -30 - Math.random() * 60, 0.5, '#0a0a0e', 2 + Math.random() * 2, 'blood')); }
      if (Math.floor(this.symT * 6) !== Math.floor(prev * 6)) Audio8.play(Math.random() < 0.5 ? 'growl' : 'flicker');
      const burstAt = sb.morph * 0.6;
      if (prev < burstAt && this.symT >= burstAt) { // the symbiote takes over
        g.darkFlash = 0.5; g.shakeAmt = 12; Audio8.play('scream'); Audio8.play('roar'); Audio8.play('explode');
        g.zombies.forEach(z => { const d = dist(this.x, this.y, z.x, z.y); if (d < 100) z.takeDamage(40 * this.damageMult, Math.atan2(z.y - this.y, z.x - this.x), undefined, 4); });
        for (let i = 0; i < 48; i++) { const a = i / 48 * TAU, sp = 90 + Math.random() * 120; g.particles.push(new Particle(this.x, this.y, Math.cos(a) * sp, Math.sin(a) * sp, 0.5 + Math.random() * 0.4, i % 4 ? '#0a0a0e' : '#f4f2ea', 3, 'blood')); }
        g.lights.push({ x: this.x, y: this.y, r: 160, life: 0.4, max: 0.4 }); g.map.splat(this.x, this.y, 14, '#050508');
        g.showAbilityBanner('WE ARE GENOM', 'LMB spit venom · RMB claws · R capture a boss · T to shed');
      }
      if (this.symT >= sb.morph) { this.sym = 'venom'; this.r = 9; this.humanMaxHp = this.maxHp; this.maxHp = Math.max(this.maxHp, sb.hearts * 25); this.hp = this.maxHp; this.clawCd = 0; }
      return true;
    }
    if (this.sym === 'reverting') {
      this.symT += dt; this.invuln = 0.3;
      if (Math.random() < 0.8) g.particles.push(new Particle(this.x + (Math.random() - 0.5) * 24, this.y - 10 + Math.random() * 16, (Math.random() - 0.5) * 10, 20 + Math.random() * 40, 0.6, '#0a0a0e', 2 + Math.random() * 2, 'blood'));
      if (this.symT >= sb.revert) { this.sym = 'human'; this.r = 6; const ratio = this.hp / this.maxHp; this.maxHp = this.humanMaxHp || this.char.hp; this.hp = Math.max(Math.round(this.maxHp * 0.25), Math.round(ratio * this.maxHp)); g.floatText(this.x, this.y - 18, 'host', '#c9cfdb'); Audio8.play('reloaded'); }
      return true;
    }
    // ---- venom form: free movement; LMB spit, RMB claws ----
    this.clawCd -= dt; this.swipe -= dt; this.captureCd -= dt;
    if (this.capturing && (this.capturing.dead || !(this.capturing.captured > 0))) this.capturing = null;
    return false;
  }
  venomAttacks(input) {
    const sb = this.sb, g = this.game;
    if (input.mouseDown && !input.rightDown && this.fireTimer <= 0) { // spit
      const cfg = sb.spit; this.fireTimer = cfg.interval / this.fireMult; this.recoil = cfg.kick;
      const gx = this.x + Math.cos(this.angle) * 14, gy = this.y - 6 + Math.sin(this.angle) * 14;
      for (let i = 0; i < cfg.pellets; i++) { const b = new Bullet(g, gx, gy, this.angle + (Math.random() - 0.5) * cfg.spread * 2, cfg, this.damageMult); b.venom = true; b.size = 2 + Math.random() * 3; b.range = cfg.range * (0.7 + Math.random() * 0.6); g.bullets.push(b); }
      g.particles.push(new Particle(gx, gy, Math.cos(this.angle) * 40 + (Math.random() - 0.5) * 60, Math.sin(this.angle) * 40 + (Math.random() - 0.5) * 60, 0.35, '#0a0a0e', 2 + Math.random() * 2, 'blood'));
      if (Math.random() < 0.15) Audio8.play('flame');
      g.shake(0.4);
    }
    if (input.rightDown && this.clawCd <= 0) { // claws
      this.clawCd = sb.clawCd; this.swipe = 0.18; this.swipeAngle = this.angle; let hits = 0;
      g.zombies.forEach(z => { const d = dist(this.x, this.y, z.x, z.y); if (d > 56 + z.r) return; let da = Math.atan2(z.y - this.y, z.x - this.x) - this.angle; da = Math.atan2(Math.sin(da), Math.cos(da)); if (Math.abs(da) < 1.25) { z.takeDamage(sb.claw * this.damageMult, this.angle, undefined, 3.5); hits++; } });
      if (g.house && !g.house.dead) { const h = g.map.house, px = this.x + Math.cos(this.angle) * 40, py = this.y + Math.sin(this.angle) * 40; if (Math.abs(px - h.x) < h.w / 2 + 10 && Math.abs(py - h.y) < h.h / 2 + 10) g.damageHouse(sb.claw * this.damageMult, px, py); }
      g.shake(hits ? 4 : 1.5); Audio8.play(hits ? 'thud' : 'flame'); if (hits) g.blood(this.x + Math.cos(this.angle) * 30, this.y + Math.sin(this.angle) * 30, 6, '#b3221a');
    }
  }
  /* ---- Frogepepe: FROG OUT (human -> giant frog for 30 s), TONGUE and HOP while a frog ---- */
  get fr() { return this.char.frog; }
  get frog() { return this.frogState === 'frog'; }
  useFrog() {
    const fr = this.fr, g = this.game; if (!fr || this.car) return false;
    if (this.frogState === 'frog') return this.frogHop();
    if (this.frogState !== 'human') return false;
    if (this.frogCd > 0) { Audio8.play('empty'); g.floatText(this.x, this.y - 16, `FROG OUT IN ${Math.ceil(this.frogCd)}s`, '#9aa3b5'); return false; }
    this.frogState = 'morphing'; this.frogT = 0; this.reloading = false; this.invuln = fr.morph + 0.3; this.hop = null; this.tongue = null;
    g.showAbilityBanner('FROG OUT', 'Feels good man.'); Audio8.play('moan'); Audio8.play('growl');
    return true;
  }
  frogHop() {
    const hp = this.fr.hop; if (this.hop) return false;
    if (this.hopCd > 0) { Audio8.play('empty'); this.game.floatText(this.x, this.y - 30, `HOP IN ${this.hopCd.toFixed(1)}s`, '#9aa3b5'); return false; }
    const inp = this.game.input, a = Math.atan2(inp.worldY - this.y, inp.worldX - this.x), d = Math.min(hp.range, dist(this.x, this.y, inp.worldX, inp.worldY));
    this.hop = { t: 0, dur: hp.dur, sx: this.x, sy: this.y, tx: this.x + Math.cos(a) * d, ty: this.y + Math.sin(a) * d }; this.tongue = null;
    this.invuln = hp.dur + 0.1; Audio8.play('moan'); this.game.shake(1.5); return true;
  }
  /* returns true while locked in an animation (morphing / reverting / mid-hop) */
  updateFrog(dt, input) {
    const fr = this.fr, g = this.game;
    this.armyCd -= dt; if (this.armyTime > 0) { this.armyTime -= dt; if (this.armyTime <= 0 || !this.frog) { this.armyTime = 0; g.clones.forEach(c => c.frogling && c.vanish(false)); } }
    if (this.frogState === 'human') { if (this.frogCd > 0) { this.frogCd -= dt; if (this.frogCd <= 0) { this.frogCd = 0; g.floatText(this.x, this.y - 18, 'FROG OUT READY', '#8bd35a'); Audio8.play('xp'); } } return false; }
    if (this.frogState === 'morphing') {
      const prev = this.frogT; this.frogT += dt; const k = this.frogT / fr.morph; g.shakeAmt = Math.max(g.shakeAmt, 1 + k * 4); this.invuln = 0.5;
      if (Math.random() < 0.6) { const a = Math.random() * TAU; g.particles.push(new Particle(this.x + Math.cos(a) * 12, this.y + 6, Math.cos(a) * 30, -30 - Math.random() * 40, 0.5, Math.random() < 0.5 ? '#4f9a3e' : '#9ccf72', 2 + Math.random() * 2, 'dot')); }
      if (Math.floor(this.frogT * 5) !== Math.floor(prev * 5)) Audio8.play('moan');
      const burstAt = fr.morph * 0.65;
      if (prev < burstAt && this.frogT >= burstAt) { // POP: he balloons into the frog and everything nearby gets shoved
        g.whiteFlash = 0.3; g.shakeAmt = 9; Audio8.play('roar'); Audio8.play('explode');
        g.zombies.forEach(z => { const d = dist(this.x, this.y, z.x, z.y); if (d < 100) z.takeDamage(35 * this.damageMult, Math.atan2(z.y - this.y, z.x - this.x), undefined, 6); });
        for (let i = 0; i < 36; i++) { const a = i / 36 * TAU, sp = 100 + Math.random() * 90; g.particles.push(new Particle(this.x, this.y, Math.cos(a) * sp, Math.sin(a) * sp, 0.45, i % 3 ? '#4f9a3e' : '#c8f08a', 3, 'dot')); }
        g.lights.push({ x: this.x, y: this.y, r: 160, life: 0.4, max: 0.4 });
        g.showAbilityBanner('FEELS GOOD MAN', `${fr.duration}s as the frog · LMB tongue · SPACE hop`);
      }
      if (this.frogT >= fr.morph) { this.frogState = 'frog'; this.frogTime = fr.duration; this.hopCd = 0; this.tongueCd = 0; this.r = 9; this.humanMaxHp = this.maxHp; this.maxHp = Math.max(this.maxHp, fr.hearts * 25); this.hp = this.maxHp; }
      return true;
    }
    if (this.frogState === 'reverting') {
      this.frogT += dt; this.invuln = 0.3;
      if (Math.random() < 0.5) g.particles.push(new Particle(this.x + (Math.random() - 0.5) * 24, this.y - 6 + Math.random() * 14, (Math.random() - 0.5) * 10, -20, 0.6, '#9ccf72', 2 + Math.random() * 2, 'smoke'));
      if (this.frogT >= fr.revert) { this.frogState = 'human'; this.frogCd = fr.cooldown; this.r = 6; this.height = 0; const ratio = this.hp / this.maxHp; this.maxHp = this.humanMaxHp || this.char.hp; this.hp = Math.max(Math.round(this.maxHp * 0.25), Math.round(ratio * this.maxHp)); g.floatText(this.x, this.y - 18, 'feels bad man', '#c9cfdb'); Audio8.play('reloaded'); }
      return true;
    }
    // ---- frog form ----
    const wasTime = this.frogTime; this.frogTime -= dt; this.hopCd -= dt; this.tongueCd -= dt;
    for (const w of [5, 3, 2, 1]) if (wasTime > w && this.frogTime <= w) g.floatText(this.x, this.y - 40, `${w}...`, '#9ccf72');
    if (this.frogTime <= 0) { this.frogState = 'reverting'; this.frogT = 0; this.hop = null; this.tongue = null; this.height = 0; g.shake(3); Audio8.play('hurt'); return true; }
    if (this.tongue) { const T = this.tongue; T.t += dt; if (T.t >= T.dur) this.tongue = null; }
    if (this.hop) { // airborne: arc to the target, squash whatever is under the landing
      const H = this.hop, hp = fr.hop; H.t += dt; const k = Math.min(1, H.t / H.dur); this.height = Math.sin(k * Math.PI) * 60; this.invuln = 0.2;
      const pos = g.map.resolve(H.sx + (H.tx - H.sx) * k, H.sy + (H.ty - H.sy) * k, this.r); this.x = pos.x; this.y = pos.y;
      if (k >= 1) {
        this.hop = null; this.height = 0; this.hopCd = hp.cd; let hits = 0;
        g.zombies.forEach(z => { const d = dist(this.x, this.y, z.x, z.y); if (d < hp.radius + z.r) { z.takeDamage(hp.smash * this.damageMult * (1 - d / (hp.radius * 2.6)), Math.atan2(z.y - this.y, z.x - this.x), undefined, 4); hits++; } });
        if (g.house && !g.house.dead) { const h = g.map.house; if (Math.abs(this.x - h.x) < h.w / 2 + hp.radius && Math.abs(this.y - h.y) < h.h / 2 + hp.radius) g.damageHouse(hp.smash * this.damageMult, this.x, this.y); }
        g.shake(8); Audio8.play('thud'); if (hits) Audio8.play('explode'); g.map.splat(this.x, this.y, 6, '#2f5a26');
        for (let i = 0; i < 20; i++) { const a = i / 20 * TAU; g.particles.push(new Particle(this.x + Math.cos(a) * 14, this.y + 8 + Math.sin(a) * 5, Math.cos(a) * 100, Math.sin(a) * 45, 0.4, i % 2 ? '#9ccf72' : '#4f9a3e', 3, 'dot')); }
        g.lights.push({ x: this.x, y: this.y, r: 100, life: 0.2, max: 0.2 });
      }
      return true;
    }
    return false;
  }
  /* ---- Bezuko: AWAKEN (girl -> demon for 30 s), Exploding Blood and DEMON KICK while awakened ---- */
  get dm() { return this.char.demon; }
  get demon() { return this.demonState === 'demon'; }
  useDemon() {
    const dm = this.dm, g = this.game; if (!dm || this.car) return false;
    if (this.demonState === 'demon') return this.demonKick();
    if (this.demonState !== 'human') return false;
    if (this.demonCd > 0) { Audio8.play('empty'); g.floatText(this.x, this.y - 16, `AWAKEN IN ${Math.ceil(this.demonCd)}s`, '#9aa3b5'); return false; }
    this.demonState = 'morphing'; this.demonT = 0; this.reloading = false; this.invuln = dm.morph + 0.3; this.kick = null;
    g.showAbilityBanner('AWAKEN', 'Sus...'); Audio8.play('growl'); Audio8.play('flicker');
    return true;
  }
  demonKick() {
    const kk = this.dm.kick; if (this.kick) return false;
    if (this.kickCd > 0) { Audio8.play('empty'); this.game.floatText(this.x, this.y - 30, `KICK IN ${this.kickCd.toFixed(1)}s`, '#9aa3b5'); return false; }
    const a = this.angle; this.kick = { t: 0, dur: kk.dur, sx: this.x, sy: this.y, tx: this.x + Math.cos(a) * kk.dash, ty: this.y + Math.sin(a) * kk.dash, ang: a, hit: new Set() };
    this.kickCd = kk.cd; this.invuln = kk.dur + 0.1; Audio8.play('roar'); this.game.shake(2); return true;
  }
  /* returns true while locked in an animation (morphing / reverting / mid-kick) */
  updateDemon(dt, input) {
    const dm = this.dm, g = this.game;
    if (this.demonState === 'human') { if (this.demonCd > 0) { this.demonCd -= dt; if (this.demonCd <= 0) { this.demonCd = 0; g.floatText(this.x, this.y - 18, 'AWAKEN READY', '#ff5aa8'); Audio8.play('xp'); } } return false; }
    if (this.demonState === 'morphing') {
      const prev = this.demonT; this.demonT += dt; const k = this.demonT / dm.morph; g.shakeAmt = Math.max(g.shakeAmt, 1 + k * 5); this.invuln = 0.5;
      if (Math.random() < 0.7) { const a = Math.random() * TAU; g.particles.push(new Particle(this.x + Math.cos(a) * 12, this.y + 6, Math.cos(a) * 20, -40 - Math.random() * 50, 0.5, Math.random() < 0.5 ? '#ff5aa8' : '#c0206a', 2 + Math.random() * 2, 'fire')); }
      if (Math.floor(this.demonT * 5) !== Math.floor(prev * 5)) Audio8.play(Math.random() < 0.5 ? 'growl' : 'flicker');
      const burstAt = dm.morph * 0.62;
      if (prev < burstAt && this.demonT >= burstAt) { // the demon blood boils over: a ring of pink fire
        g.whiteFlash = 0.35; g.shakeAmt = 10; Audio8.play('scream'); Audio8.play('roar'); Audio8.play('explode');
        g.zombies.forEach(z => { const d = dist(this.x, this.y, z.x, z.y); if (d < 110) { z.takeDamage(40 * this.damageMult, Math.atan2(z.y - this.y, z.x - this.x), undefined, 5); z.burn = Math.max(z.burn, 3); } });
        for (let i = 0; i < 48; i++) { const a = i / 48 * TAU, sp = 100 + Math.random() * 110; g.particles.push(new Particle(this.x, this.y, Math.cos(a) * sp, Math.sin(a) * sp, 0.5 + Math.random() * 0.3, i % 3 ? '#ff5aa8' : '#ffd0e8', 3, 'fire')); }
        g.lights.push({ x: this.x, y: this.y, r: 200, life: 0.5, max: 0.5 }); g.map.splat(this.x, this.y, 10, '#5a1030');
        g.showAbilityBanner('DEMON AWAKENED', `${dm.duration}s · her song charms the zombies · LMB katana · RMB kick`);
      }
      if (this.demonT >= dm.morph) { this.demonState = 'demon'; this.demonTime = dm.duration; this.kickCd = 0; this.slashCd = 0; this.r = 9; Audio8.playTrack(dm.track, dm.duration); this.humanMaxHp = this.maxHp; this.maxHp = Math.max(this.maxHp, dm.hearts * 25); this.hp = this.maxHp; }
      return true;
    }
    if (this.demonState === 'reverting') {
      this.demonT += dt; this.invuln = 0.3;
      if (Math.random() < 0.6) g.particles.push(new Particle(this.x + (Math.random() - 0.5) * 24, this.y - 8 + Math.random() * 16, (Math.random() - 0.5) * 10, -30, 0.6, '#ff5aa8', 2, 'fire'));
      if (this.demonT >= dm.revert) { this.demonState = 'human'; this.demonCd = dm.cooldown; this.r = 6; this.height = 0; const ratio = this.hp / this.maxHp; this.maxHp = this.humanMaxHp || this.char.hp; this.hp = Math.max(Math.round(this.maxHp * 0.25), Math.round(ratio * this.maxHp)); g.floatText(this.x, this.y - 18, 'hehe...', '#c9cfdb'); Audio8.play('reloaded'); }
      return true;
    }
    // ---- demon form ----
    const wasTime = this.demonTime; this.demonTime -= dt; this.kickCd -= dt; this.slashCd -= dt; this.slash -= dt;
    if (this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + dm.regen * dt); // demon regeneration
    for (const w of [5, 3, 2, 1]) if (wasTime > w && this.demonTime <= w) g.floatText(this.x, this.y - 40, `${w}...`, '#ff5aa8');
    if (this.demonTime <= 0) { this.demonState = 'reverting'; this.demonT = 0; this.kick = null; Audio8.stopTrack(); g.shake(3); Audio8.play('hurt'); return true; }
    if (this.kick) { // the dash kick: everything along the path gets booted
      const K = this.kick, kk = dm.kick; K.t += dt; const k = Math.min(1, K.t / K.dur); this.invuln = 0.15;
      const pos = g.map.resolve(K.sx + (K.tx - K.sx) * k, K.sy + (K.ty - K.sy) * k, this.r); this.x = pos.x; this.y = pos.y;
      g.particles.push(new Particle(this.x - Math.cos(K.ang) * 10, this.y + 6, -Math.cos(K.ang) * 40, -10, 0.3, '#ff5aa8', 2, 'fire'));
      for (const z of g.zombies) { if (z.dead || K.hit.has(z)) continue; const d = dist(this.x, this.y, z.x, z.y); if (d < kk.width + z.r) { K.hit.add(z); z.takeDamage(kk.damage * this.damageMult, K.ang, undefined, z.cfg.boss ? 3 : 9); z.burn = Math.max(z.burn, 2); g.blood(z.x, z.y, 5, '#b3221a'); Audio8.play('thud'); g.shake(4); } }
      if (g.house && !g.house.dead && k >= 1) { const h = g.map.house, px = this.x + Math.cos(K.ang) * 24, py = this.y + Math.sin(K.ang) * 24; if (Math.abs(px - h.x) < h.w / 2 + 10 && Math.abs(py - h.y) < h.h / 2 + 10) g.damageHouse(kk.damage * this.damageMult, px, py); }
      if (k >= 1) { this.kick = null; if (K.hit.size) g.floatText(this.x, this.y - 30, `${K.hit.size} KICKED`, '#ff5aa8'); }
      return true;
    }
    return false;
  }
  demonAttacks(input) {
    const dm = this.dm, g = this.game;
    if (input.mouseDown && !input.rightDown && this.slashCd <= 0 && !this.kick) this.demonSlash();
    if (input.rightDown && !this.kick && this.kickCd <= 0) this.demonKick();
  }
  /* LMB as the demon: one swing of the katana. Everything in the arc is cut for incredible damage and the wound burns pink. */
  demonSlash() {
    const sw = this.dm.sword, g = this.game; this.slashCd = sw.cd; this.slash = 0.16; this.slashAngle = this.angle; this.slashDir = (this.slashDir || 1) * -1; let hits = 0;
    for (const z of g.zombies) {
      if (z.dead) continue; const d = dist(this.x, this.y, z.x, z.y); if (d > sw.range + z.r) continue;
      let da = Math.atan2(z.y - this.y, z.x - this.x) - this.angle; da = Math.atan2(Math.sin(da), Math.cos(da)); if (Math.abs(da) > sw.arc) continue;
      z.takeDamage(sw.damage * this.damageMult, this.angle, undefined, z.cfg.boss ? 1.5 : 4); z.burn = Math.max(z.burn, sw.burn); hits++;
      for (let i = 0; i < 4; i++) g.particles.push(new Particle(z.x, z.y - 6, (Math.random() - 0.5) * 80, -30 - Math.random() * 50, 0.45, i % 2 ? '#ff5aa8' : '#b3221a', 2, 'blood'));
    }
    for (const t of g.turrets || []) { if (t.dead) continue; const d = dist(this.x, this.y, t.x, t.y); if (d < sw.range + t.r) { let da = Math.atan2(t.y - this.y, t.x - this.x) - this.angle; da = Math.atan2(Math.sin(da), Math.cos(da)); if (Math.abs(da) <= sw.arc) { g.damageTurret(t, sw.damage * this.damageMult, t.x, t.y); hits++; } } }
    if (g.house && !g.house.dead) { const h = g.map.house, px = this.x + Math.cos(this.angle) * 50, py = this.y + Math.sin(this.angle) * 50; if (Math.abs(px - h.x) < h.w / 2 + 10 && Math.abs(py - h.y) < h.h / 2 + 10) { g.damageHouse(sw.damage * this.damageMult, px, py); hits++; } }
    Audio8.play('swap'); if (hits) { Audio8.play('thud'); g.shake(hits > 2 ? 6 : 3); g.blood(this.x + Math.cos(this.angle) * 40, this.y + Math.sin(this.angle) * 40, 4, '#b3221a'); }
    g.lights.push({ x: this.x + Math.cos(this.angle) * 30, y: this.y + Math.sin(this.angle) * 30, r: 90, life: 0.12, max: 0.12 });
  }
  /* R as the frog: ten froglings. They hop onto zombies, rip the head off and rush the next one. */
  useFrogArmy() {
    const fr = this.fr, g = this.game; if (!fr || !this.frog) return false; const ar = fr.army;
    if (this.armyTime > 0) { Audio8.play('empty'); g.floatText(this.x, this.y - 44, 'ARMY ALREADY OUT', '#9aa3b5'); return false; }
    if (this.armyCd > 0) { Audio8.play('empty'); g.floatText(this.x, this.y - 44, `FROG ARMY IN ${Math.ceil(this.armyCd)}s`, '#9aa3b5'); return false; }
    this.armyTime = ar.duration; this.armyCd = ar.cd;
    for (let i = 0; i < ar.count; i++) { const a = i / ar.count * TAU, pos = g.map.resolve(this.x + Math.cos(a) * 26, this.y + Math.sin(a) * 26, 5); const f = new FrogClone(g, this, pos.x, pos.y, i); f.hop = { t: 0, dur: 0.3, sx: this.x, sy: this.y, tx: pos.x + Math.cos(a) * 40, ty: pos.y + Math.sin(a) * 40, target: null }; g.clones.push(f); }
    for (let k = 0; k < 24; k++) { const a = Math.random() * TAU; g.particles.push(new Particle(this.x + Math.cos(a) * 10, this.y + 4, Math.cos(a) * 60, -40 - Math.random() * 50, 0.5, k % 2 ? '#9ccf72' : '#4f9a3e', 2, 'dot')); }
    Audio8.play('levelup'); Audio8.play('moan'); g.shake(3); g.whiteFlash = 0.1; g.lights.push({ x: this.x, y: this.y, r: 120, life: 0.3, max: 0.3 });
    g.showAbilityBanner('FROG ARMY', `${ar.count} froglings · ${ar.duration}s · they hop on zombies and take the head`);
    return true;
  }
  /* LMB as the frog: a hitscan tongue lash. The first zombie on the aim line takes the hit and is yanked in; if it dies, it's lunch. */
  frogAttacks(input) {
    const tg = this.fr.tongue, g = this.game;
    if (!(input.mouseDown && this.tongueCd <= 0 && !this.hop)) return;
    this.tongueCd = tg.cd; const a = this.angle, ca = Math.cos(a), sa = Math.sin(a);
    let best = null, bd = 1e9;
    for (const z of g.zombies) {
      if (z.dead) continue; const dx = z.x - this.x, dy = z.y - this.y, along = dx * ca + dy * sa, perp = Math.abs(-dx * sa + dy * ca);
      if (along < 0 || along > tg.range || perp > z.r + 10 || along >= bd || !g.map.los(this.x, this.y, z.x, z.y)) continue; bd = along; best = z;
    }
    let len = best ? bd : tg.range, hit = !!best;
    if (!best && g.house && !g.house.dead) { const h = g.map.house; for (let d = 20; d < tg.range; d += 8) { const px = this.x + ca * d, py = this.y + sa * d; if (Math.abs(px - h.x) < h.w / 2 && Math.abs(py - h.y) < h.h / 2) { len = d; hit = true; g.damageHouse(tg.damage * this.damageMult, px, py); break; } } }
    if (!best) { for (let d = 16; d < len; d += 8) if (g.map.solidAt && g.map.solidAt(this.x + ca * d, this.y + sa * d)) { len = d; break; } }
    this.tongue = { t: 0, dur: 0.22, ang: a, len, hit };
    if (best) {
      best.takeDamage(tg.damage * this.damageMult, Math.atan2(this.y - best.y, this.x - best.x), undefined, best.cfg.boss ? 2 : tg.yank); // knocked toward the frog, not away
      if (best.dead) { this.hp = Math.min(this.maxHp, this.hp + tg.eatHeal); g.floatText(this.x, this.y - 44, 'NOM', '#9ccf72'); Audio8.play('health'); for (let i = 0; i < 6; i++) g.particles.push(new Particle(best.x, best.y, (Math.random() - 0.5) * 60, -40 - Math.random() * 40, 0.5, '#9ccf72', 2, 'dot')); }
      else Audio8.play('thud');
      g.shake(2);
    } else Audio8.play(hit ? 'thud' : 'flame');
  }
  /* F in venom form: pick a boss, drown it in liquid symbiote for 10 s — then it's ours */
  useCapture() {
    const sb = this.sb, g = this.game; if (!sb) return false; const cp = sb.capture;
    if (!this.venom) { Audio8.play('empty'); g.floatText(this.x, this.y - 16, 'BOND FIRST [T]', '#9aa3b5'); return false; }
    if (this.capturing) { Audio8.play('empty'); g.floatText(this.x, this.y - 16, 'ALREADY CAPTURING', '#9aa3b5'); return false; }
    if (this.captureCd > 0) { Audio8.play('empty'); g.floatText(this.x, this.y - 16, `CAPTURE IN ${Math.ceil(this.captureCd)}s`, '#9aa3b5'); return false; }
    const inp = g.input; let best = null, bd = 1e9;
    for (const z of g.zombies) { if (z.dead || !z.cfg.boss || z.captured > 0) continue; const d = dist(z.x, z.y, this.x, this.y); if (d > cp.range) continue; const dc = dist(z.x, z.y, inp.worldX, inp.worldY); const sc = Math.min(dc, d + 60); if (sc < bd) { bd = sc; best = z; } }
    if (!best) { Audio8.play('empty'); g.floatText(this.x, this.y - 16, 'NO BOSS IN RANGE', '#9aa3b5'); return false; }
    best.captured = cp.duration; best.capturedBy = this; best.web = 0; best.pullT = 0; best.kx = best.ky = 0; this.capturing = best; this.captureCd = cp.cd;
    Audio8.play('scream'); Audio8.play('flame'); g.shake(4); g.showAbilityBanner('CAPTURING ' + best.bk.name, `${cp.duration}s of liquid symbiote · keep it alive`);
    return true;
  }
  /* ---- Spider Mad: WEB PULL — reel a zombie in and leave it frozen in web ---- */
  usePull() {
    const pl = this.char.pull, g = this.game; if (!pl) return false;
    if (this.pullCd > 0) { Audio8.play('empty'); g.floatText(this.x, this.y - 16, `PULL IN ${this.pullCd.toFixed(1)}s`, '#9aa3b5'); return false; }
    const inp = g.input; let best = null, bd = 1e9;
    for (const z of g.zombies) { // the zombie nearest the cursor, else the nearest one along the aim line
      if (z.dead || dist(z.x, z.y, this.x, this.y) > pl.range) continue;
      const dc = dist(z.x, z.y, inp.worldX, inp.worldY); let score = dc < 40 ? dc : 1e9;
      if (score === 1e9) { let da = Math.atan2(z.y - this.y, z.x - this.x) - this.angle; da = Math.atan2(Math.sin(da), Math.cos(da)); if (Math.abs(da) < 0.25) score = 100 + dist(z.x, z.y, this.x, this.y); }
      if (score < bd && g.map.los(this.x, this.y, z.x, z.y)) { bd = score; best = z; }
    }
    if (!best) { Audio8.play('empty'); g.floatText(this.x, this.y - 16, 'NO TARGET', '#9aa3b5'); return false; }
    this.pullCd = pl.cd; Audio8.play('swap'); Audio8.play('flame'); g.floatText(this.x, this.y - 16, 'GET OVER HERE', '#f4f2ea');
    if (best.cfg.boss) { best.web = pl.bossFreeze; best.kx = best.ky = 0; g.floatText(best.x, best.y - 14 * best.scale, 'TOO HEAVY · WEBBED', '#f4f2ea'); return true; }
    best.pullT = 0.6; best.pullBy = this; best.kx = best.ky = 0; best.burn = best.burn; this.pulling = best;
    return true;
  }
  /* ---- Samay: CHAI TAPRI — the song plays and his circle webs every zombie that steps in ---- */
  useTapri() {
    const tp = this.char.tapri, g = this.game; if (!tp) return false;
    if (this.tapriTime > 0) return false;
    if (this.tapriCd > 0) { Audio8.play('empty'); g.floatText(this.x, this.y - 16, `CHAI TAPRI IN ${Math.ceil(this.tapriCd)}s`, '#9aa3b5'); return false; }
    this.tapriTime = tp.duration; Audio8.playTrack(tp.track, tp.duration); Audio8.play('levelup'); g.shake(3); g.lights.push({ x: this.x, y: this.y, r: 140, life: 0.3, max: 0.3 });
    for (let i = 0; i < 24; i++) { const a = i / 24 * TAU; g.particles.push(new Particle(this.x, this.y, Math.cos(a) * 100, Math.sin(a) * 100, 0.4, '#ff5a4a', 2, 'dot')); }
    g.showAbilityBanner('CHAI TAPRI', `${tp.duration}s · step in and get webbed`);
    return true;
  }
  /* one button for whatever the character can do (transform / vehicle / rush / squad / field / tapri), else the weapon ability */
  useCharAbility() { if (this.giant) return this.giantLeap(); if (this.char.demon) return this.useDemon(); if (this.char.frog) return this.useFrog(); if (this.char.symbiote) return this.toggleSymbiote(); if (this.char.web) return this.useWeb(); if (this.char.tapri) return this.useTapri(); if (this.tf) return this.useTransform(); if (this.char.vehicle) return this.useVehicle(); if (this.char.rush) return this.useRush(); if (this.char.squad) return this.useSquad(); if (this.char.field) return this.useField(); return this.useAbility(); }
  /* ---- Canimal: ROLL OUT — transforms into an armoured truck with twin 360° turrets ---- */
  get driving() { return !!this.car && this.car.phase === 'drive'; }
  useVehicle() {
    const v = this.char.vehicle, g = this.game; if (!v) return false;
    if (this.car) return false;
    if (this.carCd > 0) { Audio8.play('empty'); g.floatText(this.x, this.y - 16, `ROLL OUT IN ${Math.ceil(this.carCd)}s`, '#9aa3b5'); return false; }
    this.vcfg = v; this.car = { phase: 'morph', t: 0, heading: this.angle, speed: 0, time: v.duration, gunSide: 0, muzzle: [0, 0], sprite: 'truck', scale: 2 };
    this.reloading = false; this.invuln = v.morph + 0.2;
    Audio8.play('reload'); Audio8.play('thud'); g.shake(5);
    g.showAbilityBanner('ROLL OUT!', 'WASD = where to go · LMB twin turrets · ram them');
    return true;
  }
  /* ---- civilian cars (Urban City) ---- */
  nearbyCar() {
    if (!this.game.map.cfg.cars || this.car || this.form !== 'human') return null;
    let best = null, bd = CIVIL_CAR.enterRange;
    for (const pr of this.game.map.props) { if (!pr.type.startsWith('car_') || pr.type === 'car_wreck' || pr.taken) continue; const d = dist(this.x, this.y, pr.x, pr.y); if (d < bd) { bd = d; best = pr; } }
    return best;
  }
  enterCar(pr) {
    const g = this.game, m = g.map; if (!pr) return false;
    pr.taken = true; m.setPropSolid(pr, false); m.patchProp(pr);
    const maxHp = (pr.maxHp || CIVIL_CAR.hp) + CIVIL_CAR.hpPerWave * g.wave;
    this.vcfg = CIVIL_CAR; this.car = { phase: 'drive', t: 0, heading: 0, speed: 0, time: Infinity, civil: true, prop: pr, sprite: pr.type, scale: 1.4, hp: Math.min(maxHp, (pr.hp != null ? pr.hp : CIVIL_CAR.hp) + CIVIL_CAR.hpPerWave * g.wave), maxHp, gunSide: 0, muzzle: [0, 0] };
    this.x = pr.x; this.y = pr.y; this.r = 10; this.reloading = false; this.invuln = 0.3;
    Audio8.play('click'); Audio8.play('reload'); g.floatText(this.x, this.y - 20, 'GET IN', '#5ec2ff'); g.ui.showBanner('IN THE CAR', 'WASD = where to go · shoot out the window · G to get out');
    return true;
  }
  exitCar(wrecked) {
    const g = this.game, m = g.map, c = this.car; if (!c || !c.civil) return false;
    const pr = c.prop; pr.taken = false; pr.type = wrecked ? 'car_wreck' : pr.type; pr.hp = wrecked ? 0 : Math.max(1, Math.min(pr.maxHp || CIVIL_CAR.hp, c.hp));
    // park the car where it stopped, then step out beside it
    const tx = Math.round(this.x / 16 - 1), ty = Math.floor(this.y / 16); pr.x = (tx + 1) * 16; pr.y = ty * 16 + 8; m.setPropSolid(pr, true); m.patchProp(pr);
    const side = Math.cos(c.heading + Math.PI / 2), out = m.resolve(this.x + side * 0 + Math.cos(c.heading + Math.PI / 2) * 26, this.y + Math.sin(c.heading + Math.PI / 2) * 26, 6);
    this.car = null; this.r = 6; this.x = out.x; this.y = out.y; this.invuln = 0.3;
    if (!wrecked) { Audio8.play('click'); g.floatText(this.x, this.y - 18, 'GET OUT', '#c9cfdb'); }
    return true;
  }
  wreckCar() {
    const g = this.game, c = this.car; if (!c || !c.civil) return;
    const cx = this.x, cy = this.y; c.hp = 0;
    this.exitCar(true);
    g.explode(cx, cy, 64, 70, true); g.map.fires.push({ x: cx - 4, y: cy - 2 }); g.shake(9); Audio8.play('explode');
    this.invuln = 0; this.hurt(20); this.invuln = 0.8; g.floatText(cx, cy - 30, 'CAR WRECKED!', '#ff6a5a');
  }
  toggleCar() { if (this.car && this.car.civil) return this.exitCar(false); const pr = this.nearbyCar(); return pr ? this.enterCar(pr) : false; }
  /* turret mounts sit on the truck's two window sides */
  turretPos(side) { const c = this.car, sgn = side ? 1 : -1, a = c.heading; return { x: this.x + Math.cos(a) * 4 + Math.cos(a + Math.PI / 2) * 14 * sgn, y: this.y + Math.sin(a) * 4 + Math.sin(a + Math.PI / 2) * 14 * sgn }; }
  fireTurret() {
    const v = this.vcfg, gun = v.gun, g = this.game, c = this.car;
    c.gunSide = 1 - c.gunSide; const t = this.turretPos(c.gunSide); c.muzzle[c.gunSide] = 0.05;
    const gx = t.x + Math.cos(this.angle) * 14, gy = t.y + Math.sin(this.angle) * 14;
    const b = new Bullet(g, gx, gy, this.angle + (Math.random() - 0.5) * gun.spread * 2, gun, this.damageMult); b.hot = true; g.bullets.push(b);
    this.fireTimer = gun.interval / this.fireMult; g.lights.push({ x: gx, y: gy, r: 60, life: 0.05, max: 0.05 });
    if (Math.random() < 0.5) Audio8.play('smg'); g.shake(0.6);
  }
  /* returns true when the vehicle handled this frame entirely (morph / revert / drive) */
  updateVehicle(dt, input) {
    const v = this.vcfg, g = this.game, c = this.car; c.t += dt;
    this.fireTimer -= dt; this.invuln -= dt; this.hurtFlash -= dt; this.recoil *= Math.pow(0.001, dt);
    if (c.phase === 'morph' || c.phase === 'revert') {
      g.shakeAmt = Math.max(g.shakeAmt, 2); this.invuln = 0.3;
      if (Math.random() < 0.4) { const a = Math.random() * TAU; g.particles.push(new Particle(this.x + Math.cos(a) * 12, this.y + Math.sin(a) * 8, Math.cos(a) * 60, Math.sin(a) * 60, 0.25, Math.random() < 0.5 ? '#ffe08a' : '#5a8ad8', 1.5, 'dot')); }
      if (Math.floor(c.t * 8) !== Math.floor((c.t - dt) * 8)) Audio8.play('click');
      if (c.t >= v.morph) {
        if (c.phase === 'morph') { c.phase = 'drive'; c.t = 0; this.r = 13; Audio8.play('rocket'); g.shake(6); g.whiteFlash = 0.12; g.floatText(this.x, this.y - 24, 'ROLL OUT!', '#5a8ad8'); }
        else { this.car = null; this.carCd = v.cooldown; this.r = 6; Audio8.play('reloaded'); g.floatText(this.x, this.y - 18, '...robot mode', '#c9cfdb'); }
      }
      return true;
    }
    // ---- driving ----
    if (!c.civil) { c.time -= dt; if (c.time <= 0) { c.phase = 'revert'; c.t = 0; c.speed = 0; g.shake(3); return true; } }
    // arcade steering: WASD = the direction on screen you want to go; the car swings its nose toward it
    const k = input.keys; let ix = 0, iy = 0;
    if (k.w || k.ArrowUp) iy -= 1; if (k.s || k.ArrowDown) iy += 1; if (k.a || k.ArrowLeft) ix -= 1; if (k.d || k.ArrowRight) ix += 1;
    const pushing = ix !== 0 || iy !== 0;
    let left = false, right = false;
    if (pushing) {
      const want = Math.atan2(iy, ix); let diff = want - c.heading; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      if (Math.abs(diff) > 2.2 && c.speed > 80) c.speed = Math.max(0, c.speed - v.accel * 1.4 * dt);              // pushing the opposite way at speed = brake first
      else { c.speed = Math.min(v.maxSpeed, c.speed + v.accel * dt); const turn = v.turn * dt * (0.55 + 0.45 * clamp(c.speed / 120, 0, 1)); c.heading += clamp(diff, -turn, turn); left = diff < -0.3; right = diff > 0.3; }
      if (c.speed < 0) c.speed = Math.min(0, c.speed + v.accel * dt);
    } else c.speed *= Math.pow(0.35, dt);
    // move along the heading; walls bounce you back
    const nx = this.x + Math.cos(c.heading) * c.speed * dt, ny = this.y + Math.sin(c.heading) * c.speed * dt;
    const p = g.map.resolve(nx, ny, this.r); const blocked = Math.hypot(p.x - nx, p.y - ny) > 0.5;
    this.x = p.x; this.y = p.y;
    if (blocked && Math.abs(c.speed) > 40) { if (Math.abs(c.speed) > 140) { g.shake(5); Audio8.play('thud'); g.spark(this.x + Math.cos(c.heading) * 12, this.y + Math.sin(c.heading) * 12, 6); } c.speed *= -0.3; }
    this.moving = Math.abs(c.speed) > 10;
    if ((left || right) && Math.abs(c.speed) > 150 && Math.random() < 0.8) g.particles.push(new Particle(this.x - Math.cos(c.heading) * 10, this.y - Math.sin(c.heading) * 10 + 6, (Math.random() - 0.5) * 20, -5, 0.5, '#777', 3, 'smoke'));
    else if (Math.abs(c.speed) > 60 && Math.random() < 0.3) g.particles.push(new Particle(this.x - Math.cos(c.heading) * 14, this.y - Math.sin(c.heading) * 14 + 5, (Math.random() - 0.5) * 10, -8, 0.6, '#555', 2, 'smoke'));
    // ramming: anything in front of the bumper at speed gets flattened
    if (Math.abs(c.speed) > 70) {
      const dmg = Math.abs(c.speed) * v.ram * this.damageMult;
      for (const z of g.near(this.x, this.y)) { if (z.dead) continue; const d = dist(this.x, this.y, z.x, z.y); if (d < this.r + z.r + 4 && (z.rammedAt || -9) < g.time - 0.45) { z.rammedAt = g.time; z.takeDamage(dmg, c.heading, undefined, 4); g.blood(z.x, z.y, 6, '#b3221a'); g.shake(3); Audio8.play('thud'); if (z.cfg.boss) c.speed *= 0.5; else c.speed *= 0.9; } }
    }
    if (g.house && !g.house.dead && Math.abs(c.speed) > 120) { const h = g.map.house; if (Math.abs(this.x - h.x) < h.w / 2 + 14 && Math.abs(this.y - h.y) < h.h / 2 + 14) { g.damageHouse(Math.abs(c.speed) * 0.5 * this.damageMult, this.x, this.y); c.speed *= -0.4; g.shake(8); Audio8.play('thud'); } }
    if (c.civil) { // drive-by: your own gun out the window
      this.tickReload(dt);
      if (input.keys.r) this.startReload();
      if (input.mouseDown && this.fireTimer <= 0 && !this.reloading) this.shoot();
      return true;
    }
    // twin turrets track the mouse and fire alternately
    if (input.mouseDown && this.fireTimer <= 0) this.fireTurret();
    c.muzzle[0] -= dt; c.muzzle[1] -= dt;
    return true;
  }
  charAbility2() {
    const fr = this.char.frog;
    if (fr) { const ar = fr.army; if (!this.frog) return { name: ar.name, state: 'cd', frac: 0, sub: 'NEEDS FROG FORM' }; if (this.armyTime > 0) return { name: ar.name, state: 'active', frac: this.armyTime / ar.duration, sub: `${Math.ceil(this.armyTime)}s · ${this.game.clones.filter(c => c.frogling).length} FROGS` }; if (this.armyCd > 0) return { name: ar.name, state: 'cd', frac: 1 - this.armyCd / ar.cd, sub: `RECHARGING ${Math.ceil(this.armyCd)}s` }; return { name: ar.name, state: 'ready', frac: 1, sub: '[R] RELEASE THE FROGS' }; }
    const sb = this.char.symbiote;
    if (sb) { const cp = sb.capture; if (!this.venom) return { name: cp.name, state: 'cd', frac: 0, sub: 'NEEDS THE SYMBIOTE' }; if (this.capturing) return { name: cp.name, state: 'busy', frac: this.capturing.captured / cp.duration, sub: `${Math.ceil(this.capturing.captured)}s · ${this.capturing.bk.name}` }; if (this.captureCd > 0) return { name: cp.name, state: 'cd', frac: 1 - this.captureCd / cp.cd, sub: `RECHARGING ${Math.ceil(this.captureCd)}s` }; return { name: cp.name, state: 'ready', frac: 1, sub: '[R] AIM AT A BOSS' }; }
    const pl = this.char.pull; if (!pl) return null;
    if (this.pulling) return { name: pl.name, state: 'busy', frac: 0, sub: 'GET OVER HERE' };
    if (this.pullCd > 0) return { name: pl.name, state: 'cd', frac: 1 - this.pullCd / pl.cd, sub: `RECHARGING ${this.pullCd.toFixed(1)}s` };
    return { name: pl.name, state: 'ready', frac: 1, sub: '[F] AIM AT A ZOMBIE' };
  }
  charAbility() {
    if (this.giant) { if (this.gjump) return { name: 'GIANT LEAP', state: 'busy', frac: 0, sub: 'AIRBORNE' }; if (this.gleapCd > 0) return { name: 'GIANT LEAP', state: 'cd', frac: 1 - this.gleapCd / BLACKOUT.leapCd, sub: `LEAP IN ${this.gleapCd.toFixed(1)}s` }; return { name: 'GIANT LEAP', state: 'ready', frac: 1, sub: '[SPACE] LEAP · CLICK' }; }
    if (this.tf) {
      const tf = this.tf;
      if (this.form === 'beast') return { name: 'BEAST FORM', state: 'active', frac: this.formTime / tf.duration, sub: this.leapCd > 0 ? `${Math.ceil(this.formTime)}s · LEAP IN ${this.leapCd.toFixed(1)}s` : `${Math.ceil(this.formTime)}s · [SPACE] LEAP` };
      if (this.form !== 'human') return { name: tf.name, state: 'busy', frac: 0, sub: '...' };
      if (this.formCd > 0) return { name: tf.name, state: 'cd', frac: 1 - this.formCd / tf.cooldown, sub: `RECHARGING ${Math.ceil(this.formCd)}s` };
      return { name: tf.name, state: 'ready', frac: 1, sub: '[SPACE] READY · CLICK' };
    }
    const dm = this.char.demon;
    if (dm) {
      if (this.demonState === 'demon') return { name: 'DEMON FORM', state: 'active', frac: this.demonTime / dm.duration, sub: this.kickCd > 0 ? `${Math.ceil(this.demonTime)}s · KICK IN ${this.kickCd.toFixed(1)}s` : `${Math.ceil(this.demonTime)}s · [SPACE] KICK` };
      if (this.demonState !== 'human') return { name: dm.name, state: 'busy', frac: 0, sub: '...' };
      if (this.demonCd > 0) return { name: dm.name, state: 'cd', frac: 1 - this.demonCd / dm.cooldown, sub: `RECHARGING ${Math.ceil(this.demonCd)}s` };
      return { name: dm.name, state: 'ready', frac: 1, sub: '[SPACE] READY · CLICK' };
    }
    const fr = this.char.frog;
    if (fr) {
      if (this.frogState === 'frog') return { name: 'FROG FORM', state: 'active', frac: this.frogTime / fr.duration, sub: this.hopCd > 0 ? `${Math.ceil(this.frogTime)}s · HOP IN ${this.hopCd.toFixed(1)}s` : `${Math.ceil(this.frogTime)}s · [SPACE] HOP` };
      if (this.frogState !== 'human') return { name: fr.name, state: 'busy', frac: 0, sub: '...' };
      if (this.frogCd > 0) return { name: fr.name, state: 'cd', frac: 1 - this.frogCd / fr.cooldown, sub: `RECHARGING ${Math.ceil(this.frogCd)}s` };
      return { name: fr.name, state: 'ready', frac: 1, sub: '[SPACE] READY · CLICK' };
    }
    const sb = this.char.symbiote;
    if (sb) { if (this.sym === 'venom') return { name: 'SYMBIOTE', state: 'active', frac: 1, sub: '[T] SHED · LMB SPIT · RMB CLAW' }; if (this.sym !== 'human') return { name: 'SYMBIOTE', state: 'busy', frac: 0, sub: '...' }; return { name: 'SYMBIOTE', state: 'ready', frac: 1, sub: '[T] BOND · NO TIME LIMIT' }; }
    const wb = this.char.web;
    if (wb) { if (this.webZip) return { name: wb.name, state: 'busy', frac: 0, sub: 'THWIP!' }; return { name: wb.name, state: 'ready', frac: 1, sub: 'INFINITE · [SPACE] AT CURSOR' }; }
    const tp = this.char.tapri;
    if (tp) {
      if (this.tapriTime > 0) return { name: tp.name, state: 'active', frac: this.tapriTime / tp.duration, sub: `${Math.ceil(this.tapriTime)}s · SONG ON · WEBBING` };
      if (this.tapriCd > 0) return { name: tp.name, state: 'cd', frac: 1 - this.tapriCd / tp.cooldown, sub: `RECHARGING ${Math.ceil(this.tapriCd)}s` };
      return { name: tp.name, state: 'ready', frac: 1, sub: '[SPACE] READY · CLICK' };
    }
    const vh = this.char.vehicle;
    if (vh) {
      if (this.car && !this.car.civil && this.car.phase === 'drive') return { name: 'TRUCK MODE', state: 'active', frac: this.car.time / vh.duration, sub: `${Math.ceil(this.car.time)}s · ${Math.round(Math.abs(this.car.speed))} KM/H` };
      if (this.car && !this.car.civil) return { name: vh.name, state: 'busy', frac: 0, sub: 'TRANSFORMING...' };
      if (this.car) return { name: vh.name, state: 'cd', frac: 0, sub: 'GET OUT OF THE CAR FIRST' };
      if (this.carCd > 0) return { name: vh.name, state: 'cd', frac: 1 - this.carCd / vh.cooldown, sub: `RECHARGING ${Math.ceil(this.carCd)}s` };
      return { name: vh.name, state: 'ready', frac: 1, sub: '[SPACE] READY · CLICK' };
    }
    const fd = this.char.field;
    if (fd) {
      if (this.fieldTime > 0) return { name: fd.name, state: 'active', frac: this.fieldTime / fd.duration, sub: `${Math.ceil(this.fieldTime)}s · +${fd.heal} HP/s` };
      if (this.fieldCd > 0) return { name: fd.name, state: 'cd', frac: 1 - this.fieldCd / fd.cooldown, sub: `RECHARGING ${Math.ceil(this.fieldCd)}s` };
      return { name: fd.name, state: 'ready', frac: 1, sub: '[SPACE] READY · CLICK' };
    }
    const sq = this.char.squad;
    if (sq) {
      if (this.squadTime > 0) return { name: sq.name, state: 'active', frac: this.squadTime / sq.duration, sub: `${Math.ceil(this.squadTime)}s · ${this.game.clones.length} CLONES UP` };
      if (this.squadCd > 0) return { name: sq.name, state: 'cd', frac: 1 - this.squadCd / sq.cooldown, sub: `RECHARGING ${Math.ceil(this.squadCd)}s` };
      return { name: sq.name, state: 'ready', frac: 1, sub: '[SPACE] READY · CLICK' };
    }
    const r = this.char.rush;
    if (r) {
      if (this.rush > 0) return { name: r.name, state: 'active', frac: this.rush / r.duration, sub: `${Math.ceil(this.rush)}s · INF AMMO · MAX ROF` };
      if (this.rushCd > 0) return { name: r.name, state: 'cd', frac: 1 - this.rushCd / r.cooldown, sub: `RECHARGING ${Math.ceil(this.rushCd)}s` };
      return { name: r.name, state: 'ready', frac: 1, sub: '[SPACE] READY · CLICK' };
    }
    return null;
  }
  get beast() { return this.form === 'beast'; }
  /* ---- Drone: TRANSFORM (human -> brute), and LEAP while transformed ---- */
  useTransform() {
    const tf = this.tf; if (!tf) return false;
    if (this.form === 'beast') return this.beastLeap();
    if (this.form !== 'human') return false;
    if (this.formCd > 0) { Audio8.play('empty'); this.game.floatText(this.x, this.y - 16, `TRANSFORM IN ${Math.ceil(this.formCd)}s`, '#9aa3b5'); return false; }
    this.form = 'morphing'; this.morphT = 0; this.reloading = false; this.invuln = tf.morph + 0.3; this.jump = null;
    this.game.showAbilityBanner('TRANSFORM', 'Something is happening to him...'); Audio8.play('growl'); Audio8.play('hurt');
    return true;
  }
  beastLeap() {
    const tf = this.tf;
    if (this.jump) return false;
    if (this.leapCd > 0) { Audio8.play('empty'); this.game.floatText(this.x, this.y - 30, `LEAP IN ${this.leapCd.toFixed(1)}s`, '#9aa3b5'); return false; }
    const inp = this.game.input, a = Math.atan2(inp.worldY - this.y, inp.worldX - this.x), d = Math.min(tf.leap, dist(this.x, this.y, inp.worldX, inp.worldY));
    this.jump = { t: 0, dur: 0.5, sx: this.x, sy: this.y, tx: this.x + Math.cos(a) * d, ty: this.y + Math.sin(a) * d };
    this.invuln = 0.6; Audio8.play('growl'); this.game.shake(2); return true;
  }
  /* returns true while the player is locked in an animation (morphing / reverting / airborne) */
  updateForm(dt, input) {
    const tf = this.tf, g = this.game;
    if (this.form === 'human') { if (this.formCd > 0) { this.formCd -= dt; if (this.formCd <= 0) { this.formCd = 0; g.floatText(this.x, this.y - 18, 'TRANSFORM READY', '#8bd35a'); Audio8.play('xp'); } } return false; }
    if (this.form === 'morphing') {
      const prev = this.morphT; this.morphT += dt; const k = this.morphT / tf.morph;
      g.shakeAmt = Math.max(g.shakeAmt, 1 + k * 5); this.invuln = 0.5;
      if (Math.random() < 0.35) { const a = Math.random() * TAU; g.particles.push(new Particle(this.x + Math.cos(a) * 14, this.y + 8, Math.cos(a) * 30, -20 - Math.random() * 30, 0.5, '#6b4b26', 2, 'smoke')); }
      if (Math.floor(this.morphT * 5) !== Math.floor(prev * 5)) Audio8.play('growl');
      const burstAt = tf.morph * 0.62;
      if (prev < burstAt && this.morphT >= burstAt) { // the moment he bursts out of his skin
        g.whiteFlash = 0.45; g.shakeAmt = 11; Audio8.play('roar'); Audio8.play('explode'); Audio8.play('scream');
        g.zombies.forEach(z => { const d = dist(this.x, this.y, z.x, z.y); if (d < 110) z.takeDamage(45 * this.damageMult, Math.atan2(z.y - this.y, z.x - this.x), undefined, 5); });
        for (let i = 0; i < 40; i++) { const a = i / 40 * TAU, sp = 120 + Math.random() * 80; g.particles.push(new Particle(this.x, this.y, Math.cos(a) * sp, Math.sin(a) * sp, 0.45, i % 2 ? '#ff6a2a' : '#ffd23a', 3, 'dot')); }
        for (let i = 0; i < 16; i++) { const a = Math.random() * TAU; g.particles.push(new Particle(this.x, this.y, Math.cos(a) * 40, Math.sin(a) * 40 - 30, 1.2, '#444', 4, 'smoke')); }
        g.lights.push({ x: this.x, y: this.y, r: 200, life: 0.5, max: 0.5 }); g.map.splat(this.x, this.y, 10, '#5a1a10');
        g.showAbilityBanner('UNLEASHED', `${tf.duration}s of pure rage · CLICK smash · SPACE leap`);
      }
      if (this.morphT >= tf.morph) { // fully transformed: the brute has 9 hearts, healed to full
        this.form = 'beast'; this.formTime = tf.duration; this.leapCd = 0; this.smashCd = 0; this.r = 10;
        this.humanMaxHp = this.maxHp; this.maxHp = Math.max(this.maxHp, tf.hearts * 25); this.hp = this.maxHp;
      }
      return true;
    }
    if (this.form === 'reverting') {
      this.morphT += dt; this.invuln = 0.3;
      if (Math.random() < 0.5) g.particles.push(new Particle(this.x + (Math.random() - 0.5) * 20, this.y + (Math.random() - 0.5) * 20, 0, -20, 0.8, '#666', 3, 'smoke'));
      if (this.morphT >= 0.7) { // back to the boy: hearts shrink back, keeping the same fraction (never below a quarter)
        this.form = 'human'; this.formCd = tf.cooldown; this.r = 6; this.height = 0;
        const ratio = this.hp / this.maxHp; this.maxHp = this.humanMaxHp || this.char.hp; this.hp = Math.max(Math.round(this.maxHp * 0.25), Math.round(ratio * this.maxHp));
        g.floatText(this.x, this.y - 18, '...back to normal', '#c9cfdb'); Audio8.play('reloaded');
      }
      return true;
    }
    // ---- beast form ----
    const wasTime = this.formTime; this.formTime -= dt; this.leapCd -= dt; this.smashCd -= dt; this.swipe -= dt;
    for (const w of [5, 3, 2, 1]) if (wasTime > w && this.formTime <= w) g.floatText(this.x, this.y - 40, `${w}...`, '#ffb02a');
    if (this.formTime <= 0) { this.form = 'reverting'; this.morphT = 0; this.jump = null; this.height = 0; g.shake(4); Audio8.play('hurt'); return true; }
    if (this.jump) { // airborne: fly to the target, crush what's there
      const J = this.jump; J.t += dt; const k = Math.min(1, J.t / J.dur); this.height = Math.sin(k * Math.PI) * 52; this.invuln = 0.2;
      const pos = g.map.resolve(J.sx + (J.tx - J.sx) * k, J.sy + (J.ty - J.sy) * k, this.r); this.x = pos.x; this.y = pos.y;
      if (k >= 1) {
        this.jump = null; this.height = 0; this.leapCd = tf.leapCd; let hits = 0;
        g.zombies.forEach(z => { const d = dist(this.x, this.y, z.x, z.y); if (d < 84 + z.r) { z.takeDamage(tf.smash * 1.4 * this.damageMult * (1 - d / 220), Math.atan2(z.y - this.y, z.x - this.x), undefined, 4); hits++; } });
        g.shake(11); Audio8.play('thud'); if (hits) Audio8.play('explode'); g.map.splat(this.x, this.y, 8, '#3a2418');
        for (let i = 0; i < 24; i++) { const a = i / 24 * TAU; g.particles.push(new Particle(this.x + Math.cos(a) * 16, this.y + 8 + Math.sin(a) * 6, Math.cos(a) * 110, Math.sin(a) * 50, 0.4, '#6b4b26', 3, 'dot')); }
        g.lights.push({ x: this.x, y: this.y, r: 110, life: 0.2, max: 0.2 });
      }
      return true;
    }
    if (input.mouseDown && !input.rightDown && this.beastAmmo > 0 && this.fireTimer <= 0) this.shootBeast();
    if ((input.rightDown || (input.mouseDown && this.beastAmmo <= 0)) && this.smashCd <= 0) { // SMASH: a wide swipe in the aim direction
      this.smashCd = 0.42; this.swipe = 0.18; this.swipeAngle = this.angle; let hits = 0;
      g.zombies.forEach(z => { const d = dist(this.x, this.y, z.x, z.y); if (d > 56 + z.r) return; let da = Math.atan2(z.y - this.y, z.x - this.x) - this.angle; da = Math.atan2(Math.sin(da), Math.cos(da)); if (Math.abs(da) < 1.25) { z.takeDamage(tf.smash * this.damageMult, this.angle, undefined, 3.5); hits++; } });
      g.shake(hits ? 5 : 1.5); Audio8.play(hits ? 'thud' : 'flame'); if (hits) g.blood(this.x + Math.cos(this.angle) * 30, this.y + Math.sin(this.angle) * 30, 6, '#b3221a');
      if (g.house && !g.house.dead) { const h = g.map.house, px = this.x + Math.cos(this.angle) * 40, py = this.y + Math.sin(this.angle) * 40; if (Math.abs(px - h.x) < h.w / 2 + 10 && Math.abs(py - h.y) < h.h / 2 + 10) g.damageHouse(tf.smash * this.damageMult, px, py); }
    }
    return false;
  }
  /* the Flesh Cannon: three-shot bursts as fast as a minigun, 420 rounds, refilled by 20 beast kills */
  shootBeast() {
    const cfg = BEAST_GUN, g = this.game;
    this.beastAmmo--; this.fireTimer = cfg.interval / this.fireMult; this.recoil = cfg.kick; this.beastMuzzle = 0.06;
    const m = this.beastGunTip().L(38, -4), gx = m.x, gy = m.y; // from the end of the barrel
    for (let i = 0; i < cfg.pellets; i++) { const a = this.angle + (i - 1) * 0.09 + (Math.random() - 0.5) * cfg.spread; const b = new Bullet(g, gx, gy, a, cfg, this.damageMult); b.hot = true; g.bullets.push(b); }
    g.muzzle(gx, gy, this.angle, 2); g.shake(1.2); Audio8.play(Math.random() < 0.5 ? 'smg' : 'shotgun');
    if (this.beastAmmo <= 0) g.floatText(this.x, this.y - 50, 'CANNON DRY — KILL 20 TO REFILL', '#ff6a5a');
  }
  beastGunTip() { const h = this.height, bob = this.moving && !this.jump ? Math.sin(this.walk * 0.7) * 2 : 0, a = this.angle, f = this.flip ? -1 : 1; const px = this.x + Math.cos(a) * (6 - this.recoil), py = this.y - h + bob - 6 + Math.sin(a) * (6 - this.recoil);
    // local gun space -> world (the sprite is flipped vertically when aiming left)
    const L = (lx, ly) => ({ x: px + Math.cos(a) * lx - Math.sin(a) * ly * f, y: py + Math.sin(a) * lx + Math.cos(a) * ly * f });
    return { x: px, y: py, L }; }
  onBeastKill() {
    if (this.form !== 'beast') return;
    this.beastKills++;
    if (this.beastKills >= BEAST_GUN.refillKills) { this.beastKills = 0; this.beastAmmo = BEAST_GUN.mag; this.game.floatText(this.x, this.y - 50, 'FLESH CANNON REFILLED', '#8bd35a'); Audio8.play('weapon'); }
  }
  switchTo(id) {
    if (!this.weapons[id] || id === this.current) return;
    this.current = id; this.reloading = false; this.fireTimer = Math.max(this.fireTimer, 0.15); Audio8.play('swap');
    this.game.ui.refreshWeapons();
  }
  cycle(dir) {
    const i = this.weaponOrder.indexOf(this.current);
    this.switchTo(this.weaponOrder[(i + dir + this.weaponOrder.length) % this.weaponOrder.length]);
  }
  tickReload(dt) {
    if (!this.reloading) return;
    this.reloadTimer -= dt;
    if (this.reloadTimer <= 0) { const w = this.wstate, cfg = this.wcfg; const need = cfg.mag - w.mag; const take = Math.min(need, w.reserve); w.mag += take; if (w.reserve !== Infinity) w.reserve -= take; this.reloading = false; Audio8.play('reloaded'); this.game.ui.refreshWeapons(); }
  }
  startReload() {
    const w = this.wstate, cfg = this.wcfg;
    if (this.reloading || w.mag >= cfg.mag || w.reserve <= 0 || this.overdrive || this.rushing) return;
    this.reloading = true; this.reloadTimer = cfg.reload * this.char.reload; Audio8.play('reload');
  }
  addAmmo() {
    // ammo pickup: refill a chunk of reserve for every owned weapon
    for (const id in this.weapons) { const w = this.weapons[id], cfg = WEAPONS[id]; if (w.reserve !== Infinity) w.reserve = Math.min(w.maxReserve, w.reserve + Math.max(1, Math.ceil(cfg.mag * 1.5))); }
    if (this.wstate.mag === 0 && !this.reloading) this.startReload();
  }
  heal(v) { if (this.char.regen > 0) v *= 2; this.hp = Math.min(this.maxHp, this.hp + v); }
  addXp(v) {
    this.xp += v;
    while (this.xp >= this.xpNext) { this.xp -= this.xpNext; this.level++; this.xpNext = Math.round(this.xpNext * CONFIG.XP_GROWTH); this.game.queueLevelUp(); }
  }
  applyUpgrade(id) {
    this.upgrades[id]++;
    if (id === 'maxhp') { this.maxHp += 25; this.hp = this.maxHp; if ((this.form !== 'human' || this.sym !== 'human') && this.humanMaxHp) this.humanMaxHp += 25; }
  }
  hurt(dmg, fromX, fromY, invuln = 0.5) {
    if (this.invuln > 0 || this.dead || this.game.god) return;
    if (this.beast) dmg = Math.round(dmg * this.tf.armor);
    if (this.venom) dmg = Math.round(dmg * this.sb.armor);
    if (this.frog) dmg = Math.round(dmg * this.fr.armor);
    if (this.demon) dmg = Math.round(dmg * this.dm.armor);
    if (this.driving && this.car.civil) { // the car takes the hit — and a swarm can all chew on it at once
      this.car.hp -= dmg; this.hurtFlash = 0.2; this.invuln = 0.06; this.game.spark(this.x + (Math.random() - 0.5) * 30, this.y + (Math.random() - 0.5) * 16, 2);
      if (this.car.hp <= 0) this.wreckCar(); return;
    }
    if (this.driving) dmg = Math.round(dmg * this.vcfg.armor);
    this.hp -= dmg; this.invuln = invuln; this.hurtFlash = 0.25; this.sinceHurt = 0; Audio8.play('hurt');
    this.game.shake(4); this.game.blood(this.x, this.y, 5, '#b3221a');
    if (fromX != null) { const a = Math.atan2(this.y - fromY, this.x - fromX); const p = this.game.map.resolve(this.x + Math.cos(a) * 6, this.y + Math.sin(a) * 6, this.r); this.x = p.x; this.y = p.y; }
    if (this.hp <= 0) { this.hp = 0; this.dead = true; this.game.gameOver(); }
  }

  update(dt, input) {
    if (this.dead) return;
    // aim first so animations face the cursor
    this.angle = Math.atan2(input.worldY - this.y, input.worldX - this.x); this.flip = Math.cos(this.angle) < 0;
    if (input.keys[' ']) { input.keys[' '] = false; this.useCharAbility(); }
    if (input.keys.e) { input.keys.e = false; if (this.beast) this.beastLeap(); else this.useAbility(); }
    if (input.keys.f) { input.keys.f = false; if (this.char.pull) this.usePull(); }
    if (input.keys.r && this.venom) { input.keys.r = false; this.useCapture(); }
    if (input.keys.r && this.frog) { input.keys.r = false; this.useFrogArmy(); } // R = FROG ARMY as the frog (no guns to reload) // R = CAPTURE in venom form (no guns to reload)
    if (input.keys.t) { input.keys.t = false; if (this.char.symbiote) this.toggleSymbiote(); }
    if (input.keys.g) { input.keys.g = false; this.toggleCar(); }
    if (this.tf && this.updateForm(dt, input)) { this.invuln = Math.max(this.invuln, 0.1); this.walk += dt * 10; return; }
    if (this.char.symbiote && this.updateSymbiote(dt, input)) { this.walk += dt * 10; return; }
    if (this.char.frog && this.updateFrog(dt, input)) { this.walk += dt * 10; return; }
    if (this.char.demon && this.updateDemon(dt, input)) { this.walk += dt * 10; return; }
    if (this.carCd > 0 && !this.car) { this.carCd -= dt; if (this.carCd <= 0) { this.carCd = 0; this.game.floatText(this.x, this.y - 18, 'ROLL OUT READY', '#5a8ad8'); Audio8.play('xp'); } }
    if (this.car) { this.updateVehicle(dt, input); return; }
    const zipping = this.char.web ? this.updateWeb(dt) : false;
    if (this.char.pull) { this.pullCd -= dt; if (this.pulling && (this.pulling.dead || !(this.pulling.pullT > 0))) this.pulling = null; }
    if (this.giant) {
      this.gleapCd -= dt;
      if (this.gjump) { const J = this.gjump; J.t += dt; const k = Math.min(1, J.t / J.dur); this.height = Math.sin(k * Math.PI) * 56; this.invuln = 0.2;
        const pos = this.game.map.resolve(J.sx + (J.tx - J.sx) * k, J.sy + (J.ty - J.sy) * k, this.r); this.x = pos.x; this.y = pos.y; this.fireTimer -= dt; this.hurtFlash -= dt;
        if (k >= 1) { this.gjump = null; this.height = 0; this.gleapCd = BLACKOUT.leapCd; const g = this.game; let hits = 0;
          g.zombies.forEach(z => { const d = dist(this.x, this.y, z.x, z.y); if (d < 90 + z.r) { z.takeDamage(BLACKOUT.leapDmg * this.damageMult * (1 - d / 260), Math.atan2(z.y - this.y, z.x - this.x), undefined, 4); hits++; } });
          g.shake(11); Audio8.play('thud'); if (hits) Audio8.play('explode'); g.map.splat(this.x, this.y, 8, '#3a2418');
          for (let i = 0; i < 24; i++) { const a = i / 24 * TAU; g.particles.push(new Particle(this.x + Math.cos(a) * 16, this.y + 8 + Math.sin(a) * 6, Math.cos(a) * 110, Math.sin(a) * 50, 0.4, '#6b4b26', 3, 'dot')); }
          g.lights.push({ x: this.x, y: this.y, r: 120, life: 0.2, max: 0.2 }); }
        return; }
    }
    let dx = 0, dy = 0;
    if (zipping) { this.moving = true; this.fireTimer -= dt; this.invuln -= dt; this.hurtFlash -= dt; this.tickReload(dt); if (input.keys.r) this.startReload(); if (input.mouseDown && this.fireTimer <= 0 && !this.reloading) this.shoot(); return; }
    if (input.keys.w || input.keys.ArrowUp) dy -= 1; if (input.keys.s || input.keys.ArrowDown) dy += 1;
    if (input.keys.a || input.keys.ArrowLeft) dx -= 1; if (input.keys.d || input.keys.ArrowRight) dx += 1;
    this.moving = dx !== 0 || dy !== 0;
    if (this.moving) {
      const l = Math.hypot(dx, dy); dx /= l; dy /= l;
      const sp = this.speed * (this.reloading ? 0.85 : 1);
      this.x += dx * sp * dt; let p = this.game.map.resolve(this.x, this.y, this.r); this.x = p.x;
      this.y += dy * sp * dt; p = this.game.map.resolve(this.x, this.y, this.r); this.x = p.x; this.y = p.y;
      this.walk += dt * 10;
    }
    // aim
    this.angle = Math.atan2(input.worldY - this.y, input.worldX - this.x);
    this.flip = Math.cos(this.angle) < 0;
    this.fireTimer -= dt; this.invuln -= dt; this.hurtFlash -= dt; this.recoil *= Math.pow(0.001, dt); this.sinceHurt += dt;
    if (this.tapriTime > 0) { const tp = this.char.tapri, g = this.game; this.tapriTime -= dt;
      for (const z of g.zombies) { if (z.dead || z.web > 0 || z.webImmune > 0) continue; if (dist(z.x, z.y, this.x, this.y) < tp.radius + z.r) { z.web = z.cfg.boss ? tp.bossWeb : tp.web; z.kx = z.ky = 0; g.floatText(z.x, z.y - 12 * z.scale, 'WEBBED', '#f4f2ea'); if (Math.random() < 0.5) Audio8.play('flame'); } }
      for (const t of g.turrets) { if (t.dead || t.web > 0 || (t.webImmune || 0) > 0) continue; if (dist(t.x, t.y, this.x, this.y) < tp.radius + t.r) { t.web = tp.web; g.floatText(t.x, t.y - 20, 'WEBBED', '#f4f2ea'); } }
      if (Math.random() < 0.25) g.particles.push(new Particle(this.x + (Math.random() - 0.5) * tp.radius * 1.6, this.y + (Math.random() - 0.5) * tp.radius * 1.6, (Math.random() - 0.5) * 10, -24, 1.1, Math.random() < 0.5 ? '#ff5a4a' : '#ffd0c0', 2, 'text', Math.random() < 0.5 ? '♪' : '♫'));
      if (this.tapriTime <= 0) { this.tapriTime = 0; this.tapriCd = tp.cooldown; Audio8.stopTrack(); g.floatText(this.x, this.y - 18, 'SHOW\'S OVER', '#9aa3b5'); Audio8.play('reloaded'); } }
    else if (this.tapriCd > 0) { this.tapriCd -= dt; if (this.tapriCd <= 0) { this.tapriCd = 0; this.game.floatText(this.x, this.y - 18, 'CHAI TAPRI READY', '#ff5a4a'); Audio8.play('xp'); } }
    if (this.fieldTime > 0) { const f = this.char.field; this.fieldTime -= dt;
      if (this.hp < this.maxHp) { this.hp = Math.min(this.maxHp, this.hp + f.heal * dt); if (Math.random() < 0.25) this.game.particles.push(new Particle(this.x + (Math.random() - 0.5) * f.radius * 1.6, this.y + (Math.random() - 0.5) * f.radius * 1.6, 0, -22, 0.9, '#7fd35a', 2, 'text', '+')); }
      this.game.clones.forEach(c => { if (dist(c.x, c.y, this.x, this.y) < f.radius) c.hp = Math.min(c.maxHp, c.hp + f.heal * dt); });
      if (this.fieldTime <= 0) { this.fieldTime = 0; this.fieldCd = f.cooldown; this.game.floatText(this.x, this.y - 18, 'FIELD FADED', '#9aa3b5'); Audio8.play('reloaded'); } }
    else if (this.fieldCd > 0) { this.fieldCd -= dt; if (this.fieldCd <= 0) { this.fieldCd = 0; this.game.floatText(this.x, this.y - 18, 'MED FIELD READY', '#7fd35a'); Audio8.play('xp'); } }
    if (this.squadTime > 0) { this.squadTime -= dt; if (this.squadTime <= 0) { this.squadTime = 0; this.squadCd = this.char.squad.cooldown; this.game.clones.forEach(c => c.vanish()); this.game.floatText(this.x, this.y - 18, 'SQUAD OUT', '#9aa3b5'); Audio8.play('reloaded'); } }
    else if (this.squadCd > 0) { this.squadCd -= dt; if (this.squadCd <= 0) { this.squadCd = 0; this.game.floatText(this.x, this.y - 18, 'SQUAD READY', '#8bd35a'); Audio8.play('xp'); } }
    if (this.rush > 0) { this.rush -= dt; this.trail.unshift({ x: this.x, y: this.y, flip: this.flip }); if (this.trail.length > 8) this.trail.pop(); if (this.moving && Math.random() < 0.7) this.game.particles.push(new Particle(this.x + (Math.random() - 0.5) * 8, this.y + 6, (Math.random() - 0.5) * 20, -10, 0.3, '#5ec2ff', 1.5, 'dot'));
      if (this.rush <= 0) { this.rush = 0; this.rushCd = this.char.rush.cooldown; this.trail = []; this.game.floatText(this.x, this.y - 18, 'RUSH OVER', '#9aa3b5'); Audio8.play('reloaded'); } }
    else if (this.rushCd > 0) { this.rushCd -= dt; if (this.rushCd <= 0) { this.rushCd = 0; this.game.floatText(this.x, this.y - 18, 'RUSH READY', '#5ec2ff'); Audio8.play('xp'); } }
    if (this.ability.active > 0) { this.ability.active -= dt; if (this.ability.active <= 0) { this.ability.active = 0; this.ability.cd = WEAPONS[this.ability.weapon].ability.cooldown; this.game.floatText(this.x, this.y - 18, 'OVERDRIVE OVER', '#9aa3b5'); Audio8.play('reloaded'); } }
    else if (this.ability.cd > 0) { this.ability.cd -= dt; if (this.ability.cd <= 0) { this.ability.cd = 0; if (this.wcfg.ability) { this.game.floatText(this.x, this.y - 18, this.wcfg.ability.name + ' READY', '#ffb02a'); Audio8.play('xp'); } } }
    if (this.char.regen > 0 && this.sinceHurt > 3 && this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + this.char.regen * dt);
    this.tickReload(dt);
    if (this.venom) { this.venomAttacks(input); return; }
    if (this.frog) { this.frogAttacks(input); return; }
    if (this.demon) { this.demonAttacks(input); return; }
    if (this.beast) return; // no guns in beast form — the Flesh Cannon / smash are handled in updateForm
    if (input.keys.r) this.startReload();
    if (input.mouseDown && this.fireTimer <= 0 && !this.reloading) this.shoot();
  }
  shoot() {
    const w = this.wstate, cfg = this.wcfg;
    const free = this.overdrive || this.rushing || this.game.infAmmo;
    if (free) { w.mag = Math.max(w.mag, cfg.mag); } // infinite fire: the mag never empties
    if (w.mag <= 0) {
      if (w.reserve > 0) this.startReload();
      else { // out of ammo: fall back to a weapon that still has some
        const alt = this.weaponOrder.find(id => id !== this.current && (this.weapons[id].mag > 0 || this.weapons[id].reserve > 0));
        if (alt) { this.switchTo(alt); this.game.floatText(this.x, this.y - 16, 'OUT OF AMMO', '#ff6a5a'); } else { Audio8.play('empty'); this.fireTimer = 0.25; }
      }
      return;
    }
    if (!free) w.mag--; this.fireTimer = (this.rushing ? Math.min(cfg.interval, this.char.rush.interval) : cfg.interval) / this.fireMult; this.recoil = cfg.kick;
    const gs = this.giant ? BLACKOUT.playerScale : 1;
    const gx = this.x + Math.cos(this.angle) * 12 * gs, gy = this.y + Math.sin(this.angle) * 12 * gs + 2 * gs;
    for (let i = 0; i < cfg.pellets; i++) {
      const a = this.angle + (Math.random() - 0.5) * cfg.spread * 2;
      const b = new Bullet(this.game, gx, gy, a, cfg, this.damageMult); if (this.overdrive || this.rushing) b.hot = true; if (this.giant) { b.giant = true; b.damage *= BLACKOUT.shotDmg; } this.game.bullets.push(b);
    }
    if (cfg.flame) { if (Math.random() < 0.3) { Audio8.play(cfg.sound); this.game.lights.push({ x: gx, y: gy, r: 60, life: 0.1, max: 0.1 }); } }
    else { this.game.muzzle(gx, gy, this.angle, cfg.pellets > 1 ? 2 : cfg.explosive ? 3 : 1); Audio8.play(cfg.sound); }
    this.game.shake(cfg.kick * 0.5);
    if (w.mag === 0 && w.reserve > 0) this.startReload();
    this.game.ui.refreshWeapons();
  }
  draw(ctx) {
    if (this.tf && this.form !== 'human') { this.drawForm(ctx); return; }
    if (this.car) { this.drawVehicle(ctx); return; }
    if (this.sym !== 'human') { this.drawSymbiote(ctx); return; }
    if (this.frogState !== 'human') { this.drawFrog(ctx); return; }
    if (this.demonState !== 'human') { this.drawDemon(ctx); return; }
    if (this.giant) { this.drawGiant(ctx); return; }
    const bob = this.moving ? Math.sin(this.walk) * 1.2 : 0;
    if (this.tapriTime > 0) { // Chai Tapri: a red stage-light circle with web strands at the edge
      const tp = this.char.tapri, t = performance.now() / 1000, R = tp.radius + Math.sin(t * 4) * 3, fade = Math.min(1, this.tapriTime / 1.5);
      const g = ctx.createRadialGradient(this.x, this.y, 4, this.x, this.y, R); g.addColorStop(0, `rgba(255,70,50,${0.22 * fade})`); g.addColorStop(0.8, `rgba(220,40,40,${0.12 * fade})`); g.addColorStop(1, 'rgba(220,40,40,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(this.x, this.y, R, 0, TAU); ctx.fill();
      ctx.strokeStyle = `rgba(255,120,110,${0.75 * fade})`; ctx.lineWidth = 1.5; ctx.setLineDash([5, 6]); ctx.lineDashOffset = t * 22; ctx.beginPath(); ctx.arc(this.x, this.y, R, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = `rgba(255,255,255,${0.25 * fade})`; ctx.lineWidth = 1; ctx.beginPath(); for (let i = 0; i < 12; i++) { const a = i / 12 * TAU + t * 0.3; ctx.moveTo(this.x + Math.cos(a) * R * 0.55, this.y + Math.sin(a) * R * 0.55); ctx.lineTo(this.x + Math.cos(a) * R, this.y + Math.sin(a) * R); } ctx.stroke();
      ctx.beginPath(); ctx.arc(this.x, this.y, R * 0.55 + Math.sin(t * 6) * 2, 0, TAU); ctx.stroke();
      ctx.font = '6px "Press Start 2P", monospace'; ctx.textAlign = 'center'; ctx.fillStyle = `rgba(255,255,255,${0.8 * fade})`; ctx.fillText('♪', this.x, this.y - R + 8); ctx.textAlign = 'left';
    }
    if (this.fieldTime > 0) { // healing aura: soft green disc, pulsing ring, slowly turning dashes
      const f = this.char.field, t = performance.now() / 1000, R = f.radius + Math.sin(t * 3) * 3, fade = Math.min(1, this.fieldTime / 1.5);
      const g = ctx.createRadialGradient(this.x, this.y, 4, this.x, this.y, R); g.addColorStop(0, `rgba(80,220,110,${0.22 * fade})`); g.addColorStop(0.8, `rgba(60,200,90,${0.12 * fade})`); g.addColorStop(1, 'rgba(60,200,90,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(this.x, this.y, R, 0, TAU); ctx.fill();
      ctx.strokeStyle = `rgba(140,240,150,${0.7 * fade})`; ctx.lineWidth = 1.5; ctx.setLineDash([6, 5]); ctx.lineDashOffset = -t * 18; ctx.beginPath(); ctx.arc(this.x, this.y, R, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = `rgba(200,255,200,${0.35 * fade})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(this.x, this.y, R * 0.55 + Math.sin(t * 5) * 2, 0, TAU); ctx.stroke();
      ctx.fillStyle = `rgba(255,255,255,${0.8 * fade})`; ctx.fillRect(this.x - 1, this.y - R + 4, 2, 6); ctx.fillRect(this.x - 3, this.y - R + 6, 6, 2); // little cross at the top of the ring
    }
    if (this.rushing) { // speed afterimages
      this.trail.forEach((t, i) => { if (i % 2) return; ctx.globalAlpha = 0.35 * (1 - i / this.trail.length); ctx.save(); ctx.translate(Math.round(t.x), Math.round(t.y)); if (t.flip) ctx.scale(-1, 1); ctx.drawImage(Sprites.tintOf(this.sprite, '#5ec2ff'), -8, -9, 16, 16); ctx.restore(); });
      ctx.globalAlpha = 1; const g = ctx.createRadialGradient(this.x, this.y, 2, this.x, this.y, 26); g.addColorStop(0, 'rgba(94,194,255,0.3)'); g.addColorStop(1, 'rgba(94,194,255,0)'); ctx.fillStyle = g; ctx.fillRect(this.x - 30, this.y - 30, 60, 60);
    }
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(this.x, this.y + 7, 6, 3, 0, 0, TAU); ctx.fill();
    const blink = this.invuln > 0 && Math.floor(this.invuln * 20) % 2 === 0;
    if (!blink || this.dead) Sprites.draw(ctx, this.hurtFlash > 0 ? 'player_hurt' : this.sprite, this.x, this.y + bob, { flip: this.flip, ox: -8, oy: -9 });
    // gun
    const rec = this.recoil;
    const gx = this.x + Math.cos(this.angle) * (6 - rec), gy = this.y + 2 + Math.sin(this.angle) * (6 - rec) + bob;
    ctx.save(); ctx.translate(gx, gy); ctx.rotate(this.angle); if (this.flip) ctx.scale(1, -1);
    const img = Sprites.get(this.wcfg.sprite); ctx.drawImage(img, -3, -4, 16, 8); ctx.restore();
    if (this.overdrive) { const t = performance.now() / 1000; ctx.fillStyle = `rgba(255,170,40,${0.18 + Math.sin(t * 20) * 0.08})`; ctx.beginPath(); ctx.arc(this.x, this.y + 2, 14 + Math.sin(t * 20) * 2, 0, TAU); ctx.fill(); ctx.font = '6px "Press Start 2P", monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#ffb02a'; ctx.fillText('OVERDRIVE', this.x, this.y - 20); ctx.textAlign = 'left'; }
    if (this.pulling && this.pulling.pullT > 0) { const z = this.pulling, hx = this.x + Math.cos(this.angle) * 6, hy = this.y - 2; ctx.strokeStyle = 'rgba(244,242,234,0.9)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(z.x, z.y); ctx.stroke(); ctx.strokeStyle = 'rgba(244,242,234,0.3)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(z.x, z.y); ctx.stroke(); }
    if (this.webZip) { const z = this.webZip, hx = this.x + Math.cos(this.angle) * 6, hy = this.y - 2; ctx.strokeStyle = 'rgba(244,242,234,0.9)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(z.ax, z.ay); ctx.stroke(); ctx.strokeStyle = 'rgba(244,242,234,0.35)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(z.ax, z.ay); ctx.stroke(); ctx.fillStyle = '#f4f2ea'; ctx.beginPath(); ctx.arc(z.ax, z.ay, 3, 0, TAU); ctx.fill(); }
    if (this.rushing) { ctx.font = '6px "Press Start 2P", monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#5ec2ff'; ctx.fillText('RUSH', this.x, this.y - 20); ctx.textAlign = 'left'; }
    if (this.tf && this.formCd <= 0 && this.form === 'human') { ctx.fillStyle = `rgba(139,211,90,${0.5 + Math.sin(performance.now() / 150) * 0.4})`; ctx.fillRect(this.x - 1, this.y - 16, 2, 2); }
    // reload ring
    if (this.reloading) { const p = 1 - this.reloadTimer / (this.wcfg.reload * this.char.reload); ctx.strokeStyle = '#111'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(this.x, this.y - 14, 5, -Math.PI / 2, -Math.PI / 2 + TAU * p); ctx.stroke(); ctx.strokeStyle = '#f5c518'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(this.x, this.y - 14, 5, -Math.PI / 2, -Math.PI / 2 + TAU * p); ctx.stroke(); }
  }
}

/* Genom: the symbiote crawling over the host, and the venom form */
Player.prototype.drawSymbiote = function (ctx) {
  const sb = this.sb, g = this.game, t = g.time, S = sb.scale;
  const venomAt = (x, y, sc, alpha = 1) => { ctx.globalAlpha = alpha; Sprites.draw(ctx, 'venom', x, y, { flip: this.flip, scale: sc, ox: -12 * sc, oy: 8 - 24 * sc }); ctx.globalAlpha = 1; };
  const tendrils = (k, n, len) => { // black symbiote strands whipping up from the ground around him
    ctx.strokeStyle = '#0a0a0e'; ctx.lineWidth = 2.5; ctx.beginPath();
    for (let i = 0; i < n; i++) { const a = i / n * TAU + t * 1.7, r0 = 10 + (i % 3) * 4, L = len * k * (0.6 + 0.4 * Math.abs(Math.sin(t * 5 + i))); const x0 = this.x + Math.cos(a) * r0, y0 = this.y + 8; const cx = x0 + Math.cos(a) * L * 0.5 + Math.sin(t * 9 + i) * 8, cy = y0 - L * 0.5; ctx.moveTo(x0, y0); ctx.quadraticCurveTo(cx, cy, x0 + Math.cos(a) * L * 0.6, y0 - L); }
    ctx.stroke(); ctx.fillStyle = '#0a0a0e'; for (let i = 0; i < n; i++) { const a = i / n * TAU + t * 1.7, L = len * k; ctx.beginPath(); ctx.arc(this.x + Math.cos(a) * (10 + L * 0.6), this.y + 8 - L, 2, 0, TAU); ctx.fill(); }
  };
  if (this.sym === 'morphing') {
    const k = this.symT / sb.morph, jx = (Math.random() - 0.5) * 4 * k, jy = (Math.random() - 0.5) * 4 * k;
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.ellipse(this.x, this.y + 7, 6 + k * 16, 3 + k * 6, 0, 0, TAU); ctx.fill();
    const glow = ctx.createRadialGradient(this.x, this.y, 2, this.x, this.y, 30 + k * 50); glow.addColorStop(0, `rgba(20,0,40,${0.3 + k * 0.4})`); glow.addColorStop(1, 'rgba(20,0,40,0)'); ctx.fillStyle = glow; ctx.fillRect(this.x - 90, this.y - 90, 180, 180);
    tendrils(Math.min(1, k * 1.6), 10, 40);
    if (k < 0.6) { // the black creeps up the host from the feet
      const kk = k / 0.6; Sprites.draw(ctx, this.sprite, this.x + jx, this.y + jy, { flip: this.flip, ox: -8, oy: -9 });
      ctx.save(); ctx.beginPath(); ctx.rect(this.x - 12, this.y + 7 - 16 * kk, 24, 16 * kk + 2); ctx.clip(); ctx.translate(Math.round(this.x + jx), Math.round(this.y + jy)); if (this.flip) ctx.scale(-1, 1); ctx.drawImage(Sprites.tintOf(this.sprite, '#0a0a0e'), -8, -9, 16, 16); ctx.restore();
      if (kk > 0.5 && Math.sin(t * 30) > 0) { ctx.fillStyle = '#f4f2ea'; ctx.fillRect(this.x - 3, this.y - 6, 2, 2); ctx.fillRect(this.x + 1, this.y - 6, 2, 2); }
    } else { const kk = (k - 0.6) / 0.4, sc = 1.2 + kk * (S - 1.2); venomAt(this.x + jx, this.y + jy, sc); ctx.globalAlpha = (1 - kk) * 0.9; ctx.save(); ctx.translate(Math.round(this.x + jx), Math.round(this.y + jy)); if (this.flip) ctx.scale(-1, 1); ctx.drawImage(Sprites.tintOf('venom', '#f4f2ea'), -12 * sc, 8 - 24 * sc, 24 * sc, 24 * sc); ctx.restore(); ctx.globalAlpha = 1; }
    return;
  }
  if (this.sym === 'reverting') { const k = this.symT / sb.revert, sc = S - k * (S - 1); ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(this.x, this.y + 7, 6 + (1 - k) * 16, 3 + (1 - k) * 6, 0, 0, TAU); ctx.fill(); tendrils(1 - k, 8, 30); venomAt(this.x, this.y, sc, 1 - k * 0.6); Sprites.draw(ctx, this.sprite, this.x, this.y, { flip: this.flip, alpha: k, ox: -8, oy: -9 }); return; }
  // ---- venom form ----
  const bob = this.moving ? Math.sin(this.walk * 0.8) * 2 : 0;
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.ellipse(this.x, this.y + 9, 20, 7, 0, 0, TAU); ctx.fill();
  const aura = ctx.createRadialGradient(this.x, this.y - 8, 4, this.x, this.y - 8, 40); aura.addColorStop(0, 'rgba(60,0,80,0.22)'); aura.addColorStop(1, 'rgba(60,0,80,0)'); ctx.fillStyle = aura; ctx.fillRect(this.x - 44, this.y - 52, 88, 88);
  if (this.moving && Math.random() < 0.3) g.particles.push(new Particle(this.x + (Math.random() - 0.5) * 16, this.y + 6, (Math.random() - 0.5) * 10, -10, 0.4, '#0a0a0e', 2, 'blood'));
  venomAt(this.x, this.y + bob, S);
  if (this.hurtFlash > 0) { ctx.globalAlpha = 0.6; ctx.save(); ctx.translate(Math.round(this.x), Math.round(this.y + bob)); if (this.flip) ctx.scale(-1, 1); ctx.drawImage(Sprites.tintOf('venom', '#ff8a7a'), -12 * S, 8 - 24 * S, 24 * S, 24 * S); ctx.restore(); ctx.globalAlpha = 1; }
  if (this.swipe > 0) { const k = this.swipe / 0.18; ctx.strokeStyle = `rgba(244,242,234,${k})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(this.x, this.y, 46, this.swipeAngle - 1.1, this.swipeAngle + 1.1); ctx.stroke(); ctx.strokeStyle = `rgba(0,0,0,${k * 0.7})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(this.x, this.y, 52, this.swipeAngle - 1.25, this.swipeAngle + 1.25); ctx.stroke(); }
  if (this.capturing && this.capturing.captured > 0) { // liquid symbiote tether to the boss: black rope with black ooze flowing along it
    const b = this.capturing, x0 = this.x, y0 = this.y - 6, mx = (x0 + b.x) / 2 + Math.sin(t * 6) * 18, my = (y0 + b.y) / 2 + Math.cos(t * 5) * 18;
    const at = (q) => ({ x: (1 - q) * (1 - q) * x0 + 2 * (1 - q) * q * mx + q * q * b.x, y: (1 - q) * (1 - q) * y0 + 2 * (1 - q) * q * my + q * q * b.y });
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000'; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(mx, my, b.x, b.y); ctx.stroke();
    ctx.strokeStyle = '#1a1a22'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(mx, my, b.x, b.y); ctx.stroke();
    for (let i = 0; i < 2; i++) { // thin writhing tendrils wrapped around the main rope
      ctx.strokeStyle = i ? '#050508' : '#26262f'; ctx.lineWidth = 2; ctx.beginPath();
      for (let k = 0; k <= 16; k++) { const q = k / 16, pt = at(q), w = Math.sin(q * 14 + t * 9 + i * 2.1) * 5; const dx = b.x - x0, dy = b.y - y0, L = Math.hypot(dx, dy) || 1; const px = pt.x - dy / L * w, py = pt.y + dx / L * w; k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
      ctx.stroke();
    }
    ctx.fillStyle = '#000'; // blobs of symbiote pumping along the rope toward the boss, with a glossy highlight
    for (let i = 0; i < 6; i++) { const q = ((t * 0.55 + i / 6) % 1), pt = at(q), r = 3 + Math.sin(t * 10 + i) * 1.2; ctx.beginPath(); ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#3a3a48'; ctx.fillRect(Math.round(pt.x - 1), Math.round(pt.y - r + 1), 1, 1); ctx.fillStyle = '#000'; }
    ctx.lineCap = 'butt';
    if (Math.random() < 0.8) { const pt = at(Math.random()); g.particles.push(new Particle(pt.x, pt.y + 2, (Math.random() - 0.5) * 8, 10 + Math.random() * 25, 0.5 + Math.random() * 0.4, Math.random() < 0.7 ? '#000' : '#1a1a22', 2 + (Math.random() < 0.3 ? 1 : 0), 'blood')); }
  }
};

/* Frogepepe: the boy swelling into the frog, and the frog itself with its tongue */
Player.prototype.drawFrog = function (ctx) {
  const fr = this.fr, g = this.game, t = g.time, S = fr.scale;
  const frogAt = (x, y, sc, alpha = 1) => { ctx.globalAlpha = alpha; Sprites.draw(ctx, 'frog', x, y, { flip: this.flip, scale: sc, ox: -12 * sc, oy: 8 - 24 * sc }); ctx.globalAlpha = 1; };
  if (this.frogState === 'morphing') {
    const k = this.frogT / fr.morph, jx = (Math.random() - 0.5) * 4 * k, jy = (Math.random() - 0.5) * 4 * k;
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(this.x, this.y + 7, 6 + k * 16, 3 + k * 6, 0, 0, TAU); ctx.fill();
    const glow = ctx.createRadialGradient(this.x, this.y, 2, this.x, this.y, 30 + k * 40); glow.addColorStop(0, `rgba(80,200,80,${0.15 + k * 0.3})`); glow.addColorStop(1, 'rgba(80,200,80,0)'); ctx.fillStyle = glow; ctx.fillRect(this.x - 80, this.y - 80, 160, 160);
    if (k < 0.65) { // the boy puffs up, flashing greener and greener
      const kk = k / 0.65, sc = 1 + kk * 0.8; ctx.save(); ctx.translate(Math.round(this.x + jx), Math.round(this.y + jy + 7)); if (this.flip) ctx.scale(-1, 1);
      ctx.drawImage(Sprites.get(this.sprite), -8 * sc, -16 * sc, 16 * sc, 16 * sc);
      if (Math.sin(t * (10 + kk * 30)) > 0.2) { ctx.globalAlpha = 0.5 * kk; ctx.drawImage(Sprites.tintOf(this.sprite, '#9ccf72'), -8 * sc, -16 * sc, 16 * sc, 16 * sc); ctx.globalAlpha = 1; }
      ctx.restore();
    } else { const kk = (k - 0.65) / 0.35, sc = 1.3 + kk * (S - 1.3); frogAt(this.x + jx, this.y + jy, sc); ctx.globalAlpha = (1 - kk) * 0.9; ctx.save(); ctx.translate(Math.round(this.x + jx), Math.round(this.y + jy)); if (this.flip) ctx.scale(-1, 1); ctx.drawImage(Sprites.tintOf('frog', '#f4f2ea'), -12 * sc, 8 - 24 * sc, 24 * sc, 24 * sc); ctx.restore(); ctx.globalAlpha = 1; }
    return;
  }
  if (this.frogState === 'reverting') { const k = this.frogT / fr.revert, sc = S - k * (S - 1); ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(this.x, this.y + 7, 6 + (1 - k) * 16, 3 + (1 - k) * 6, 0, 0, TAU); ctx.fill(); frogAt(this.x, this.y, sc, 1 - k * 0.6); Sprites.draw(ctx, this.sprite, this.x, this.y, { flip: this.flip, alpha: k, ox: -8, oy: -9 }); return; }
  // ---- frog form ----
  const h = this.height, bob = this.moving && !this.hop ? Math.abs(Math.sin(this.walk * 0.6)) * 4 : 0, squash = this.hop ? 1 + Math.sin(Math.min(1, this.hop.t / this.hop.dur) * Math.PI) * 0.15 : 1;
  ctx.fillStyle = `rgba(0,0,0,${0.45 - h / 200})`; ctx.beginPath(); ctx.ellipse(this.x, this.y + 9, 20 - h * 0.12, 7 - h * 0.04, 0, 0, TAU); ctx.fill();
  if (this.tongue) { // pink tongue shooting out of the mouth and snapping back
    const T = this.tongue, k = T.t / T.dur, len = T.len * (k < 0.5 ? Math.min(1, k * 2.6) : Math.max(0, 1 - (k - 0.5) * 2)), mx = this.x + Math.cos(T.ang) * 10, my = this.y - h - 10 + Math.sin(T.ang) * 10, ex = mx + Math.cos(T.ang) * len, ey = my + Math.sin(T.ang) * len;
    ctx.lineCap = 'round'; ctx.strokeStyle = '#7a1f3a'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.strokeStyle = '#e2506e'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(ex, ey); ctx.stroke(); ctx.lineCap = 'butt';
    ctx.fillStyle = '#e2506e'; ctx.beginPath(); ctx.arc(ex, ey, 5, 0, TAU); ctx.fill(); ctx.fillStyle = '#7a1f3a'; ctx.beginPath(); ctx.arc(ex, ey, 5, 0, TAU); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(Math.round(ex - 2), Math.round(ey - 3), 2, 2);
  }
  ctx.save(); ctx.translate(Math.round(this.x), Math.round(this.y - h + 8)); ctx.scale(2 - squash, squash); ctx.translate(-Math.round(this.x), -Math.round(this.y - h + 8));
  frogAt(this.x, this.y - h - bob, S);
  if (this.hurtFlash > 0) { ctx.globalAlpha = 0.6; ctx.save(); ctx.translate(Math.round(this.x), Math.round(this.y - h - bob)); if (this.flip) ctx.scale(-1, 1); ctx.drawImage(Sprites.tintOf('frog', '#ff8a7a'), -12 * S, 8 - 24 * S, 24 * S, 24 * S); ctx.restore(); ctx.globalAlpha = 1; }
  ctx.restore();
  if (this.moving && !this.hop && Math.random() < 0.15) g.particles.push(new Particle(this.x + (Math.random() - 0.5) * 20, this.y + 8, (Math.random() - 0.5) * 20, -15, 0.35, '#2f5a26', 2, 'dot'));
};

/* Bezuko: the girl burning into the demon, and the awakened demon herself */
Player.prototype.drawDemon = function (ctx) {
  const dm = this.dm, g = this.game, t = g.time, S = dm.scale;
  const demonAt = (x, y, sc, alpha = 1) => { ctx.globalAlpha = alpha; Sprites.draw(ctx, 'demon', x, y, { flip: this.flip, scale: sc, ox: -12 * sc, oy: 8 - 24 * sc }); ctx.globalAlpha = 1; };
  const aura = (r, a) => { const gr = ctx.createRadialGradient(this.x, this.y - 6, 2, this.x, this.y - 6, r); gr.addColorStop(0, `rgba(255,60,140,${a})`); gr.addColorStop(1, 'rgba(255,60,140,0)'); ctx.fillStyle = gr; ctx.fillRect(this.x - r, this.y - 6 - r, r * 2, r * 2); };
  if (this.demonState === 'morphing') {
    const k = this.demonT / dm.morph, jx = (Math.random() - 0.5) * 4 * k, jy = (Math.random() - 0.5) * 4 * k;
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(this.x, this.y + 7, 6 + k * 14, 3 + k * 5, 0, 0, TAU); ctx.fill();
    aura(30 + k * 50, 0.15 + k * 0.35);
    if (k < 0.62) { // vines crawl over her, the eyes start to glow
      const kk = k / 0.62; Sprites.draw(ctx, this.sprite, this.x + jx, this.y + jy, { flip: this.flip, ox: -8, oy: -9 });
      ctx.save(); ctx.beginPath(); ctx.rect(this.x - 12, this.y + 7 - 16 * kk, 24, 16 * kk + 2); ctx.clip(); ctx.translate(Math.round(this.x + jx), Math.round(this.y + jy)); if (this.flip) ctx.scale(-1, 1); ctx.globalAlpha = 0.55; ctx.drawImage(Sprites.tintOf(this.sprite, '#2f5a3a'), -8, -9, 16, 16); ctx.globalAlpha = 1; ctx.restore();
      if (kk > 0.4 && Math.sin(t * 25) > -0.3) { ctx.fillStyle = '#ff3d8a'; ctx.fillRect(this.x - 3, this.y - 5, 2, 1); ctx.fillRect(this.x + 1, this.y - 5, 2, 1); }
    } else { const kk = (k - 0.62) / 0.38, sc = 1.2 + kk * (S - 1.2); demonAt(this.x + jx, this.y + jy, sc); ctx.globalAlpha = (1 - kk) * 0.9; ctx.save(); ctx.translate(Math.round(this.x + jx), Math.round(this.y + jy)); if (this.flip) ctx.scale(-1, 1); ctx.drawImage(Sprites.tintOf('demon', '#ffd0e8'), -12 * sc, 8 - 24 * sc, 24 * sc, 24 * sc); ctx.restore(); ctx.globalAlpha = 1; }
    return;
  }
  if (this.demonState === 'reverting') { const k = this.demonT / dm.revert, sc = S - k * (S - 1); ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(this.x, this.y + 7, 6 + (1 - k) * 14, 3 + (1 - k) * 5, 0, 0, TAU); ctx.fill(); aura(40, 0.3 * (1 - k)); demonAt(this.x, this.y, sc, 1 - k * 0.6); Sprites.draw(ctx, this.sprite, this.x, this.y, { flip: this.flip, alpha: k, ox: -8, oy: -9 }); return; }
  // ---- demon form ----
  const bob = this.moving && !this.kick ? Math.sin(this.walk * 0.8) * 2 : 0;
  { // the circle of music: a soft pink disc, a rotating dashed ring, a pulsing inner ring and notes drifting around the edge
    const R = dm.song.radius + Math.sin(t * 3) * 3, fade = Math.min(1, this.demonTime / 1.2, (dm.duration - this.demonTime + 0.2) * 2);
    const gr = ctx.createRadialGradient(this.x, this.y, 10, this.x, this.y, R); gr.addColorStop(0, `rgba(255,90,170,${0.06 * fade})`); gr.addColorStop(0.75, `rgba(255,90,170,${0.16 * fade})`); gr.addColorStop(1, 'rgba(255,90,170,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(this.x, this.y, R, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(255,150,210,${0.85 * fade})`; ctx.lineWidth = 2; ctx.setLineDash([8, 7]); ctx.lineDashOffset = -t * 30; ctx.beginPath(); ctx.arc(this.x, this.y, R, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = `rgba(255,255,255,${0.35 * fade})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(this.x, this.y, R * (0.55 + 0.1 * Math.abs(Math.sin(t * 4))), 0, TAU); ctx.stroke();
    ctx.strokeStyle = `rgba(255,120,190,${0.25 * fade})`; ctx.beginPath(); for (let i = 0; i < 12; i++) { const a = i / 12 * TAU - t * 0.4, w = Math.sin(t * 6 + i) * 6; ctx.moveTo(this.x + Math.cos(a) * (R * 0.35), this.y + Math.sin(a) * (R * 0.35)); ctx.lineTo(this.x + Math.cos(a) * (R - 6 + w), this.y + Math.sin(a) * (R - 6 + w)); } ctx.stroke();
    ctx.font = '8px "Press Start 2P", monospace'; ctx.textAlign = 'center';
    for (let i = 0; i < 10; i++) { const a = i / 10 * TAU + t * 0.6, rr = R - 10 + Math.sin(t * 3 + i * 1.7) * 6; ctx.fillStyle = `rgba(255,${170 + (i % 2) * 60},${220},${(0.7 + Math.sin(t * 5 + i) * 0.3) * fade})`; ctx.fillText(i % 3 ? '♪' : '♫', this.x + Math.cos(a) * rr, this.y + Math.sin(a) * rr + Math.sin(t * 7 + i) * 3); }
    ctx.textAlign = 'left';
    if (Math.random() < 0.5) { const a = Math.random() * TAU; g.particles.push(new Particle(this.x + Math.cos(a) * R, this.y + Math.sin(a) * R, -Math.cos(a) * 25, -Math.sin(a) * 25 - 12, 0.8, Math.random() < 0.5 ? '#ffb0dc' : '#ff5aa8', 2, 'smoke')); }
  }
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.ellipse(this.x, this.y + 9, 18, 6, 0, 0, TAU); ctx.fill();
  aura(44 + Math.sin(t * 6) * 3, 0.16);
  if (this.kick) { // afterimages along the dash
    const K = this.kick; for (let i = 1; i <= 3; i++) { const q = Math.max(0, Math.min(1, K.t / K.dur) - i * 0.12); demonAt(K.sx + (K.tx - K.sx) * q, K.sy + (K.ty - K.sy) * q, S, 0.25 - i * 0.06); }
  }
  if (Math.random() < 0.35) g.particles.push(new Particle(this.x + (Math.random() - 0.5) * 20, this.y - 10 + (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 12, -25 - Math.random() * 20, 0.5, Math.random() < 0.5 ? '#ff5aa8' : '#c0206a', 2, 'fire'));
  demonAt(this.x, this.y + bob, S);
  if (this.hurtFlash > 0) { ctx.globalAlpha = 0.6; ctx.save(); ctx.translate(Math.round(this.x), Math.round(this.y + bob)); if (this.flip) ctx.scale(-1, 1); ctx.drawImage(Sprites.tintOf('demon', '#ff8a7a'), -12 * S, 8 - 24 * S, 24 * S, 24 * S); ctx.restore(); ctx.globalAlpha = 1; }
  { // the demon katana in her hand; during a slash it sweeps through the arc and leaves a pink-white trail
    const sw = dm.sword, k = this.slash > 0 ? 1 - this.slash / 0.16 : -1, dir = this.slashDir || 1;
    const ang = k >= 0 ? this.slashAngle + dir * (-sw.arc + k * sw.arc * 2) : this.angle + (this.flip ? 0.35 : -0.35);
    if (k >= 0) { const r0 = 28, r1 = sw.range + 2, a0 = this.slashAngle - dir * sw.arc, a1 = this.slashAngle + dir * (-sw.arc + k * sw.arc * 2);
      ctx.save(); ctx.beginPath(); ctx.arc(this.x, this.y - 6, r1, Math.min(a0, a1), Math.max(a0, a1)); ctx.arc(this.x, this.y - 6, r0, Math.max(a0, a1), Math.min(a0, a1), true); ctx.closePath();
      const gr = ctx.createRadialGradient(this.x, this.y - 6, r0, this.x, this.y - 6, r1); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.7, `rgba(255,120,190,${0.35 * (1 - k)})`); gr.addColorStop(1, `rgba(255,255,255,${0.7 * (1 - k)})`); ctx.fillStyle = gr; ctx.fill(); ctx.restore();
      ctx.strokeStyle = `rgba(255,255,255,${0.9 * (1 - k)})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(this.x, this.y - 6, r1, Math.min(a0, a1), Math.max(a0, a1)); ctx.stroke(); }
    const hx = this.x + Math.cos(ang) * 10, hy = this.y - 6 + bob + Math.sin(ang) * 10;
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(ang); if (Math.cos(ang) < 0) ctx.scale(1, -1); ctx.drawImage(Sprites.get('katana'), -6, -4, 44, 8); ctx.restore();
  }
  // glowing eyes on top of the sprite (they flicker)
  if (Math.sin(t * 9) > -0.6) { ctx.fillStyle = `rgba(255,80,160,${0.5 + Math.sin(t * 9) * 0.3})`; const ex = this.x + (this.flip ? -1 : 1) * 0, ey = this.y + bob + 8 - 24 * S + 7 * S; ctx.fillRect(Math.round(ex - 5 * S + 1), Math.round(ey), Math.round(3 * S), Math.round(2 * S)); ctx.fillRect(Math.round(ex + 2 * S + 1), Math.round(ey), Math.round(3 * S), Math.round(2 * S)); }
};

/* BLACKOUT giant form: the normal character sprite and gun, just huge, with a leap arc */
Player.prototype.drawGiant = function (ctx) {
  const S = BLACKOUT.playerScale, h = this.height || 0, bob = this.moving && !this.gjump ? Math.sin(this.walk) * 2 : 0, t = this.game.time;
  ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(this.x, this.y + 7 * S, (6 - h * 0.03) * S, 3 * S, 0, 0, TAU); ctx.fill();
  if (this.gjump) { ctx.strokeStyle = 'rgba(255,200,60,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(this.gjump.tx, this.gjump.ty, 90, 0, TAU); ctx.stroke(); }
  const g = ctx.createRadialGradient(this.x, this.y - h, 4, this.x, this.y - h, 40); g.addColorStop(0, 'rgba(255,200,60,0.2)'); g.addColorStop(1, 'rgba(255,200,60,0)'); ctx.fillStyle = g; ctx.fillRect(this.x - 44, this.y - h - 44, 88, 88);
  Sprites.draw(ctx, this.hurtFlash > 0 ? 'player_hurt' : this.sprite, this.x, this.y - h + bob, { flip: this.flip, scale: S, ox: -8 * S, oy: -9 * S });
  const rec = this.recoil, gx = this.x + Math.cos(this.angle) * (6 - rec) * S, gy = this.y - h + 2 * S + Math.sin(this.angle) * (6 - rec) * S + bob;
  ctx.save(); ctx.translate(gx, gy); ctx.rotate(this.angle); if (this.flip) ctx.scale(1, -1); ctx.drawImage(Sprites.get(this.wcfg.sprite), -3 * S, -4 * S, 16 * S, 8 * S); ctx.restore();
  if (this.reloading) { const p = 1 - this.reloadTimer / (this.wcfg.reload * this.char.reload); ctx.strokeStyle = '#111'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(this.x, this.y - h - 14 * S, 6, -Math.PI / 2, -Math.PI / 2 + TAU * p); ctx.stroke(); ctx.strokeStyle = '#f5c518'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(this.x, this.y - h - 14 * S, 6, -Math.PI / 2, -Math.PI / 2 + TAU * p); ctx.stroke(); }
  ctx.font = '6px "Press Start 2P", monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#ffb02a'; ctx.fillText('GIANT', this.x, this.y - h - 12 * S - 4 + Math.sin(t * 6)); ctx.textAlign = 'left';
};

/* Canimal: transformation + truck rendering */
Player.prototype.drawVehicle = function (ctx) {
  const c = this.car, v = this.vcfg, g = this.game, t = g.time;
  const truck = Sprites.get(c.sprite || 'truck'), TS = c.scale || 2, SW = truck.width, SH = truck.height;
  if (c.phase !== 'drive') { // robot folds into the truck (or unfolds): squash one, stretch the other, spin to the heading
    const k = clamp(c.t / v.morph, 0, 1), m = c.phase === 'morph' ? k : 1 - k; // m: 0 = robot, 1 = truck
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(this.x, this.y + 8, 6 + m * 18, 3 + m * 6, 0, 0, TAU); ctx.fill();
    const jx = (Math.random() - 0.5) * 3, jy = (Math.random() - 0.5) * 3;
    if (m < 0.5) { const q = m / 0.5; ctx.save(); ctx.translate(this.x + jx, this.y + jy); ctx.rotate(c.heading * q); ctx.scale((1 + q * 0.8) * (this.flip ? -1 : 1), 1 - q * 0.55); ctx.drawImage(Sprites.get(this.sprite), -8, -9, 16, 16); ctx.restore(); }
    else { const q = (m - 0.5) / 0.5; ctx.save(); ctx.translate(this.x + jx, this.y + jy); ctx.rotate(c.heading); ctx.scale(TS * (0.5 + q * 0.5), TS * (0.5 + q * 0.5)); ctx.drawImage(truck, -SW / 2, -SH / 2, SW, SH); ctx.restore(); }
    ctx.globalAlpha = 0.5 + Math.sin(t * 40) * 0.3; ctx.fillStyle = '#5a8ad8'; ctx.fillRect(this.x - 1, this.y - 1, 2, 2); ctx.globalAlpha = 1;
    return;
  }
  // ---- truck ----
  ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.save(); ctx.translate(this.x, this.y + 6); ctx.rotate(c.heading); ctx.beginPath(); ctx.ellipse(0, 0, SW * TS * 0.52, SH * TS * 0.5, 0, 0, TAU); ctx.fill(); ctx.restore();
  ctx.save(); ctx.translate(Math.round(this.x), Math.round(this.y)); ctx.rotate(c.heading); ctx.drawImage(truck, -SW / 2 * TS, -SH / 2 * TS, SW * TS, SH * TS); ctx.restore();
  if (c.civil) { // your gun out the window + car health
    const gx = this.x + Math.cos(this.angle) * 12, gy = this.y + Math.sin(this.angle) * 12; ctx.save(); ctx.translate(gx, gy); ctx.rotate(this.angle); if (this.flip) ctx.scale(1, -1); ctx.drawImage(Sprites.get(this.wcfg.sprite), -2, -4, 16, 8); ctx.restore();
    if (this.hurtFlash > 0) { ctx.globalAlpha = 0.5; ctx.save(); ctx.translate(Math.round(this.x), Math.round(this.y)); ctx.rotate(c.heading); ctx.drawImage(Sprites.tintOf(c.sprite, '#ff8a7a'), -SW / 2 * TS, -SH / 2 * TS, SW * TS, SH * TS); ctx.restore(); ctx.globalAlpha = 1; }
    const w = 40, yy = this.y - 26; ctx.fillStyle = '#111'; ctx.fillRect(this.x - w / 2 - 1, yy - 1, w + 2, 5); ctx.fillStyle = c.hp / c.maxHp < 0.3 ? '#ff3a2a' : '#5ec2ff'; ctx.fillRect(this.x - w / 2, yy, w * clamp(c.hp / c.maxHp, 0, 1), 3);
    if (c.hp / c.maxHp < 0.4 && Math.random() < 0.3) g.particles.push(new Particle(this.x - Math.cos(c.heading) * 10, this.y - Math.sin(c.heading) * 10, (Math.random() - 0.5) * 10, -20, 0.8, '#333', 3, 'smoke'));
    return;
  }
  // twin M249 turrets: dark mounts on the window sides, guns spin to follow the mouse
  [0, 1].forEach(side => {
    const tp = this.turretPos(side), flipV = Math.cos(this.angle) < 0;
    ctx.fillStyle = '#0f1014'; ctx.beginPath(); ctx.arc(tp.x, tp.y, 5, 0, TAU); ctx.fill(); ctx.fillStyle = '#4a4f58'; ctx.beginPath(); ctx.arc(tp.x, tp.y, 3.5, 0, TAU); ctx.fill();
    ctx.save(); ctx.translate(Math.round(tp.x), Math.round(tp.y)); ctx.rotate(this.angle); if (flipV) ctx.scale(1, -1);
    ctx.drawImage(Sprites.get('gun_m249'), -6, -5, 24, 10);
    if (c.muzzle[side] > 0) { ctx.fillStyle = `rgba(255,${200 + Math.random() * 55},120,0.95)`; ctx.beginPath(); ctx.arc(19, -1, 3 + Math.random() * 3, 0, TAU); ctx.fill(); }
    ctx.restore();
  });
  if (this.hurtFlash > 0) { ctx.globalAlpha = 0.5; ctx.save(); ctx.translate(Math.round(this.x), Math.round(this.y)); ctx.rotate(c.heading); ctx.drawImage(Sprites.tintOf('truck', '#ff8a7a'), -15 * TS, -8 * TS, 30 * TS, 16 * TS); ctx.restore(); ctx.globalAlpha = 1; }
  ctx.font = '6px "Press Start 2P", monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#000'; ctx.fillText(`${Math.ceil(c.time)}s`, this.x + 1, this.y - 33); ctx.fillStyle = c.time < 5 ? '#ff6a5a' : '#5a8ad8'; ctx.fillText(`${Math.ceil(c.time)}s`, this.x, this.y - 34); ctx.textAlign = 'left';
};

/* transformation + beast rendering for Drone */
Player.prototype.drawForm = function (ctx) {
  const tf = this.tf, g = this.game, t = g.time, SC = 2.4;
  const beastAt = (x, y, sc, name, alpha = 1) => { ctx.globalAlpha = alpha; Sprites.draw(ctx, name, x, y, { flip: this.flip, scale: sc, ox: -12 * sc, oy: 8 - 24 * sc }); ctx.globalAlpha = 1; };
  if (this.form === 'morphing') {
    const k = this.morphT / tf.morph, jx = (Math.random() - 0.5) * 5 * k, jy = (Math.random() - 0.5) * 5 * k;
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(this.x, this.y + 7, 6 + k * 14, 3 + k * 5, 0, 0, TAU); ctx.fill();
    // red energy building under the skin
    const glow = ctx.createRadialGradient(this.x, this.y, 2, this.x, this.y, 30 + k * 40); glow.addColorStop(0, `rgba(255,60,30,${0.25 + k * 0.35})`); glow.addColorStop(1, 'rgba(255,60,30,0)'); ctx.fillStyle = glow; ctx.fillRect(this.x - 80, this.y - 80, 160, 160);
    if (k < 0.62) { // the boy swells, shakes and flashes red
      const kk = k / 0.62, sc = 1 + kk * 1.3;
      Sprites.draw(ctx, this.sprite, this.x + jx, this.y + jy - (sc - 1) * 5, { flip: this.flip, scale: sc, ox: -8 * sc, oy: -9 * sc });
      ctx.globalAlpha = Math.max(0, Math.sin(t * (20 + kk * 40))) * (0.3 + kk * 0.6);
      ctx.save(); ctx.translate(Math.round(this.x + jx), Math.round(this.y + jy - (sc - 1) * 5)); if (this.flip) ctx.scale(-1, 1); ctx.drawImage(Sprites.tintOf(this.sprite, '#ff3a2a'), -8 * sc, -9 * sc, 16 * sc, 16 * sc); ctx.restore(); ctx.globalAlpha = 1;
      if (kk > 0.5) { ctx.font = '6px "Press Start 2P", monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#ff6a5a'; ctx.fillText(['RRR...', 'GRAAH', 'RRRAAAGH'][Math.floor(t * 8) % 3], this.x, this.y - 22 - kk * 10); ctx.textAlign = 'left'; }
    } else { // the brute bursts out and grows to full size
      const kk = (k - 0.62) / 0.38, sc = 1.4 + kk * (SC - 1.4);
      beastAt(this.x + jx, this.y + jy, sc, 'beast_rage');
      ctx.globalAlpha = (1 - kk) * 0.8; ctx.save(); ctx.translate(Math.round(this.x + jx), Math.round(this.y + jy)); if (this.flip) ctx.scale(-1, 1); ctx.drawImage(Sprites.tintOf('beast', '#ffffff'), -12 * sc, 8 - 24 * sc, 24 * sc, 24 * sc); ctx.restore(); ctx.globalAlpha = 1;
    }
    return;
  }
  if (this.form === 'reverting') { const k = this.morphT / 0.7, sc = SC - k * (SC - 1); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(this.x, this.y + 7, 6 + (1 - k) * 14, 3 + (1 - k) * 5, 0, 0, TAU); ctx.fill(); beastAt(this.x, this.y, sc, 'beast', 1 - k * 0.5); Sprites.draw(ctx, this.sprite, this.x, this.y, { flip: this.flip, alpha: k, ox: -8, oy: -9 }); return; }
  // ---- beast ----
  const h = this.height, bob = this.moving && !this.jump ? Math.sin(this.walk * 0.7) * 2 : 0, low = this.formTime < 5 && Math.floor(t * 6) % 2 === 0;
  ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(this.x, this.y + 9, 22 - h * 0.2, 8 - h * 0.07, 0, 0, TAU); ctx.fill();
  if (this.jump) { ctx.strokeStyle = 'rgba(255,120,60,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(this.jump.tx, this.jump.ty, 84, 0, TAU); ctx.stroke(); }
  const rage = ctx.createRadialGradient(this.x, this.y - h, 4, this.x, this.y - h, 44); rage.addColorStop(0, 'rgba(255,60,30,0.18)'); rage.addColorStop(1, 'rgba(255,60,30,0)'); ctx.fillStyle = rage; ctx.fillRect(this.x - 50, this.y - h - 50, 100, 100);
  beastAt(this.x, this.y - h + bob, SC, low ? 'beast_rage' : 'beast'); // the brute never blinks out — hits show as a red flash instead
  { // the Flesh Cannon: shouldered at chest height, one fist on the grip, one on the foregrip
    this.beastMuzzle -= 1 / 60; const tip = this.beastGunTip();
    ctx.save(); ctx.translate(Math.round(tip.x), Math.round(tip.y)); ctx.rotate(this.angle); if (this.flip) ctx.scale(1, -1);
    // rear arm + fist (grip)
    ctx.fillStyle = '#1a0c08'; ctx.fillRect(-6, 1, 12, 9); ctx.fillStyle = '#b8684a'; ctx.fillRect(-5, 2, 10, 7); ctx.fillStyle = '#7a3a28'; ctx.fillRect(-5, 8, 10, 1);
    ctx.drawImage(Sprites.get('gun_flesh'), -12, -10, 48, 20);
    // front arm + fist (under the barrel)
    ctx.fillStyle = '#1a0c08'; ctx.fillRect(14, -1, 13, 10); ctx.fillStyle = '#b8684a'; ctx.fillRect(15, 0, 11, 8); ctx.fillStyle = '#7a3a28'; ctx.fillRect(15, 7, 11, 1); ctx.fillStyle = '#e8dcc0'; ctx.fillRect(17, 2, 2, 1); ctx.fillRect(21, 2, 2, 1);
    if (this.beastMuzzle > 0) { ctx.fillStyle = `rgba(255,${180 + Math.random() * 60},60,0.9)`; ctx.beginPath(); ctx.arc(38, -4, 5 + Math.random() * 4, 0, TAU); ctx.fill(); }
    ctx.restore();
  }
  if (this.hurtFlash > 0) { ctx.globalAlpha = 0.6; ctx.save(); ctx.translate(Math.round(this.x), Math.round(this.y - h + bob)); if (this.flip) ctx.scale(-1, 1); ctx.drawImage(Sprites.tintOf('beast', '#ff8a7a'), -12 * SC, 8 - 24 * SC, 24 * SC, 24 * SC); ctx.restore(); ctx.globalAlpha = 1; }
  if (this.swipe > 0) { const k = this.swipe / 0.18; ctx.strokeStyle = `rgba(255,220,180,${k})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(this.x, this.y, 46, this.swipeAngle - 1.1, this.swipeAngle + 1.1); ctx.stroke(); ctx.strokeStyle = `rgba(255,80,40,${k * 0.7})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(this.x, this.y, 52, this.swipeAngle - 1.25, this.swipeAngle + 1.25); ctx.stroke(); }
  ctx.font = '6px "Press Start 2P", monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#000'; ctx.fillText(`${Math.ceil(this.formTime)}s`, this.x + 1, this.y - h - 56); ctx.fillStyle = this.formTime < 5 ? '#ff6a5a' : '#ffb02a'; ctx.fillText(`${Math.ceil(this.formTime)}s`, this.x, this.y - h - 57); ctx.textAlign = 'left';
};

/* ---------------------------------------------------------------- ZOMBIE */
class Zombie {
  constructor(game, type, x, y, wave, kind) {
    this.game = game; this.type = type; this.cfg = ENEMIES[type];
    this.x = x; this.y = y; this.r = this.cfg.radius;
    this.maxHp = Math.round(this.cfg.hp * enemyHpScale(wave)); this.hp = this.maxHp;
    this.speed = this.cfg.speed * (0.85 + Math.random() * 0.3);
    if (kind) { // armed / scaled boss
      const bk = BOSSES[kind], sc = bossScale(wave); this.bk = bk; this.kind = kind; this.wave = wave;
      this.maxHp = Math.round(bk.hp * sc.hp); this.hp = this.maxHp; this.speed = bk.speed * sc.speed; this.damage = Math.round(bk.damage * sc.dmg);
      this.cdMult = sc.cd; this.dmgMult = sc.dmg; this.sprite = 'boss_' + kind; this.r = Math.round(7 * bk.scale);
      this.gunCd = 2.5; this.burstLeft = 0; this.burstTimer = 0; this.aiming = 0; this.strafeDir = Math.random() < 0.5 ? -1 : 1; this.strafeT = 2; this.los = false;
      if (bk.ravager) { this.r = 24; this.gunSide = 0; this.shots = 0; this.leap = null; this.leapCd = 5; this.enraged = false; this.height = 0; this.muzzle = [0, 0]; }
      if (bk.bona) { this.r = 28; this.slam = 0; this.slamCd = 4; this.chargeCd = 3.5; this.rush = null; this.spitCd = 2; this.enraged = false; this.height = 0; this.ember = 0; this.cracks = Array.from({ length: 9 }, (_, i) => ({ x: -20 + (i * 37) % 44, y: -18 + (i * 23) % 26, l: 4 + (i * 7) % 6, v: (i % 3) - 1, ph: i * 1.3 })); game.bonaArrive(this); }
      if (bk.sahur) { this.r = 22; this.drum = null; this.drumCd = 4; this.swing = 0; this.swingCd = 1; this.bat = null; this.batCd = 3; this.rings = []; this.enraged = false; this.summonCd = 8; this.height = 0; game.sahurArrive(this); }
      if (bk.kraken) { this.r = 26; this.gunSide = 0; this.spiral = false; this.spiralAngle = 0; this.slam = 0; this.slamCd = 3; this.enraged = false; this.summonCd = 5; }
    }
    this.flip = false; this.walk = Math.random() * 10; this.hit = 0; this.attackCd = Math.random() * 0.5; this.dead = false;
    this.kx = 0; this.ky = 0; this.growl = 2 + Math.random() * 6;
    this.charge = 0; this.chargeCd = 5; this.summonCd = 7; this.scale = this.bk ? this.bk.scale : this.cfg.scale;
    this.fuse = -1; this.avoid = 0; this.avoidDir = 1; this.stuck = 0; this.burn = 0; this.burnTick = 0; this.web = 0; this.webImmune = 0;
    if (this.cfg.guard) { // zombie soldier: holds a post around the house, chases when alerted, fires a hand cannon
      this.zgun = Object.assign({}, HOUSE.guardGun); this.gunCd = 1 + Math.random() * 2; this.dmgMult = 1 + wave * 0.03; this.gunSprite = 'gun_cannon';
      this.maxHp = Math.round(HOUSE.guardHp * enemyHpScale(wave)); this.hp = this.maxHp; this.post = null; this.alert = false; this.alertT = 0;
    }
    if (kind && game.map.cfg.house) { this.scale *= HOUSE.bossScale; this.r = Math.round(this.r * HOUSE.bossScale); this.maxHp = Math.round(this.maxHp * HOUSE.bossHp); this.hp = this.maxHp; }
    if (game.event && !kind) { // BLACKOUT: giant, tougher, and packing a random gun
      this.scale *= BLACKOUT.zombieScale; this.r = Math.round(this.r * 1.8); this.maxHp = Math.round(this.maxHp * BLACKOUT.zombieHp); this.hp = this.maxHp;
      this.gunId = PICKABLE_WEAPONS[Math.floor(Math.random() * PICKABLE_WEAPONS.length)]; const w = WEAPONS[this.gunId];
      this.zgun = { speed: w.speed * 0.8, dmg: Math.max(3, Math.round(w.damage * BLACKOUT.gunDmg)), range: w.range * 0.9, pellets: w.pellets > 1 ? 4 : 1, spread: w.spread + 0.05, explosive: w.explosive ? 30 : 0, flame: !!w.flame, cd: Math.max(0.35, w.interval * 5) + w.reload * 0.35 };
      this.gunCd = 1 + Math.random() * 2; this.dmgMult = 1 + wave * 0.03; this.damage = Math.round(this.cfg.damage * BLACKOUT.zombieDmg);
    }
  }
  takeDamage(dmg, ax, ay, kb = 1, quiet = false) {
    if (this.dead) return;
    if (this.web > 0) { const tp = this.game.player.char.tapri; dmg *= tp ? tp.vuln : 2; } // tangled = helpless
    this.hp -= dmg; this.hit = quiet ? this.hit : 0.08;
    if (quiet) { if (this.hp <= 0) this.die(); return; }
    const kbm = this.cfg.boss ? 0.15 : this.type === 'tank' ? 0.4 : 1;
    this.kx += Math.cos(ax) * 90 * kb * kbm; this.ky += Math.sin(ay === undefined ? ax : ax) * 90 * kb * kbm;
    this.game.blood(this.x, this.y, 3, this.type === 'exploder' ? '#ff8a20' : '#b3221a');
    this.game.floatText(this.x, this.y - 10, Math.round(dmg), '#fff');
    if (this.hp <= 0) this.die();
  }
  die() {
    if (this.dead) return; this.dead = true;
    this.game.onZombieDeath(this);
  }
  update(dt, player, neighbors) {
    if (this.dead) return;
    this.target = player; // whoever is closest: the player or one of his clones
    this.webImmune -= dt;
    if (this.pullT > 0) { // reeled in by Spider Mad's web, then frozen
      this.pullT -= dt; const pb = this.pullBy, pl = pb.char.pull, ddx = pb.x - this.x, ddy = pb.y - this.y, dd = Math.hypot(ddx, ddy) || 1, step = pl.speed * dt;
      if (dd - step <= this.r + pb.r + 6) { const p = this.game.map.resolve(pb.x - ddx / dd * (this.r + pb.r + 8), pb.y - ddy / dd * (this.r + pb.r + 8), this.r); this.x = p.x; this.y = p.y; this.pullT = 0; }
      else { const p = this.game.map.resolve(this.x + ddx / dd * step, this.y + ddy / dd * step, Math.min(this.r, 7)); this.x = p.x; this.y = p.y; if (Math.random() < 0.5) this.game.particles.push(new Particle(this.x, this.y, (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30, 0.25, '#f4f2ea', 1.5, 'dot')); }
      if (this.pullT <= 0) { this.pullT = 0; this.web = pl.freeze; this.webImmune = 0; this.attackCd = 1; this.game.floatText(this.x, this.y - 12 * this.scale, 'FROZEN', '#8af0ff'); Audio8.play('thud'); this.game.shake(2); }
      this.flip = ddx < 0; this.walk += dt * 20; return;
    }
    if (this.poison > 0) { this.poison -= dt; this.poisonTick = (this.poisonTick || 0) + dt; if (this.poisonTick > 0.25) { this.poisonTick = 0; this.takeDamage(1.5 + this.maxHp * 0.012, 0, undefined, 0, true); if (this.dead) return; if (Math.random() < 0.6) this.game.particles.push(new Particle(this.x + (Math.random() - 0.5) * 8 * this.scale, this.y, (Math.random() - 0.5) * 6, 12, 0.5, '#5fd35a', 2, 'blood')); } }
    if (this.captured > 0) { // drowning in liquid symbiote: frozen, then it's ours
      this.captured -= dt; this.hit -= dt; this.attackCd = 1; this.burstLeft = 0; this.aiming = 0; this.charge = 0; this.leap = null; this.height = 0;
      if (Math.random() < 0.7) this.game.particles.push(new Particle(this.x + (Math.random() - 0.5) * 16 * this.scale, this.y - 6 * this.scale + Math.random() * 12 * this.scale, (Math.random() - 0.5) * 8, 18, 0.5, '#0a0a0e', 2 + Math.random() * 2, 'blood'));
      if (this.captured <= 0) { this.captured = 0; this.game.convertBoss(this); }
      return;
    }
    if (this.web > 0) { // stuck in Samay's web: can't move, shoot or bite
      this.web -= dt; this.hit -= dt; this.attackCd = Math.max(this.attackCd, 0.5); this.flip = player.x < this.x; this.walk += dt * 2;
      if (this.burn > 0) { this.burn -= dt; this.burnTick += dt; if (this.burnTick > 0.25) { this.burnTick = 0; this.takeDamage(2.5 + this.maxHp * 0.01, 0, undefined, 0, true); } }
      if (this.web <= 0) { this.web = 0; this.webImmune = this.game.player.char.tapri ? this.game.player.char.tapri.immune : 1.5; }
      return;
    }
    const dx = player.x - this.x, dy = player.y - this.y, d = Math.hypot(dx, dy) || 1;
    const P = this.game.player, song = P.demon && player === P ? P.dm.song : null; // Bezuko's circle of music: charmed zombies walk to her and forget to bite
    if (song && d < song.radius + this.r) { if (!(this.charm > 0)) this.charmT = 0; this.charm = 0.5; }
    const charmed = this.charm > 0; if (charmed) { this.charm -= dt; this.charmT = (this.charmT || 0) + dt; }
    let sp = this.speed;
    let steer = null;
    if (this.bk && !charmed) { const r = this.bossAI(dt, player, d, dx, dy); sp *= r.speedMult; steer = r.steer; }
    if (this.cfg.guard && this.post) {
      const hs = this.game.map.house, nearHouse = Math.hypot(player.x - hs.x, player.y - hs.y) < HOUSE.alertRadius + 120;
      if (nearHouse || d < 200 || this.hit > -1) { this.alert = true; this.alertT = 6; } else { this.alertT -= dt; if (this.alertT <= 0) this.alert = false; }
      if (!this.alert) { // walk back to the post and stand guard
        const pdx = this.post.x - this.x, pdy = this.post.y - this.y, pd = Math.hypot(pdx, pdy);
        if (pd > 6) steer = { x: pdx / pd, y: pdy / pd }; else { steer = { x: 0, y: 0 }; sp = 0; }
        sp *= 0.8;
      }
    }
    if (charmed) { steer = { x: dx / d, y: dy / d }; sp = Math.max(sp, this.cfg.speed) * 1.15; this.leap = null; this.charge = 0; this.aiming = 0; this.burstLeft = 0; if (!this.cfg.boss) this.attackCd = Math.max(this.attackCd, 0.6); this.gunCd = Math.max(this.gunCd || 0, 0.5); }
    if (this.type === 'exploder' && d < 22 && this.fuse < 0 && !charmed) { this.fuse = 0.45; }
    if (this.fuse >= 0) { this.fuse -= dt; sp *= 0.3; if (this.fuse <= 0) { this.die(); return; } }
    if (this.burn > 0) {
      this.burn -= dt; this.burnTick += dt;
      if (this.burnTick > 0.25) { this.burnTick = 0; this.takeDamage(2.5 + this.maxHp * 0.01, 0, undefined, 0, true); if (this.dead) return; this.game.particles.push(new Particle(this.x + (Math.random() - 0.5) * 8 * this.scale, this.y - 4 * this.scale, (Math.random() - 0.5) * 10, -30, 0.4, '#ff6a2a', 2 + Math.random() * 2, 'fire')); }
      if (this.type !== 'boss' && Math.random() < 0.02) this.game.particles.push(new Particle(this.x, this.y - 8 * this.scale, (Math.random() - 0.5) * 8, -25, 1.2, '#333', 3, 'smoke'));
    }
    // separation from neighbours
    let sx = 0, sy = 0;
    for (const o of neighbors) { if (o === this || o.dead) continue; const ox = this.x - o.x, oy = this.y - o.y; const od = Math.hypot(ox, oy); const min = this.r + o.r; if (od < min && od > 0.01) { sx += ox / od * (min - od); sy += oy / od * (min - od); } }
    // navigation: follow the BFS flow field unless close to the player
    let ux = dx / d, uy = dy / d;
    const fd = d > 40 && player === this.game.player ? this.game.map.flowDir(this.x, this.y) : null;
    if (fd) { ux = fd.x; uy = fd.y; }
    if (steer) { ux = steer.x; uy = steer.y; }
    if (this.avoid > 0) { this.avoid -= dt; const px = -uy * this.avoidDir, py = ux * this.avoidDir; ux = px; uy = py; }
    let mx = ux * sp + sx * 6 + this.kx, my = uy * sp + sy * 6 + this.ky;
    this.kx *= Math.pow(0.0005, dt); this.ky *= Math.pow(0.0005, dt);
    const ox = this.x, oy = this.y, mr = Math.min(this.r, 7);
    this.x += mx * dt; let p = this.game.map.resolve(this.x, this.y, mr); this.x = p.x;
    this.y += my * dt; p = this.game.map.resolve(this.x, this.y, mr); this.x = p.x; this.y = p.y;
    // stuck detection -> sidestep for a moment
    const moved = Math.hypot(this.x - ox, this.y - oy), expect = sp * dt;
    if (moved < expect * 0.25 && d > 30) { this.stuck = (this.stuck || 0) + dt; if (this.stuck > 0.4) { this.stuck = 0; this.avoid = 0.6 + Math.random() * 0.5; this.avoidDir = Math.random() < 0.5 ? -1 : 1; } } else this.stuck = 0;
    this.flip = dx < 0; this.walk += dt * (sp / 12); this.hit -= dt; this.attackCd -= dt;
    this.growl -= dt; if (this.growl <= 0) { const dark = this.game.map.cfg.dark; this.growl = dark ? 2 + Math.random() * 4 : 4 + Math.random() * 8; if (d < (dark ? 170 : 220)) Audio8.play(dark && Math.random() < 0.3 ? 'moan' : 'growl'); }
    if (this.zgun && (!this.cfg.guard || this.alert)) { // armed zombie: shoot when it can see you
      this.gunCd -= dt;
      if (this.gunCd <= 0 && d < this.zgun.range && d > 24 && this.game.map.los(this.x, this.y, player.x, player.y)) {
        this.gunCd = this.zgun.cd; const base = Math.atan2(player.y - this.y, player.x - this.x), s2 = this.scale;
        const gx = this.x + Math.cos(base) * 8 * s2, gy = this.y + 2 * s2 + Math.sin(base) * 8 * s2;
        for (let i = 0; i < this.zgun.pellets; i++) this.game.ebullets.push(new EnemyBullet(this.game, gx, gy, base + (Math.random() - 0.5) * this.zgun.spread * 2, this.zgun, this));
        this.game.lights.push({ x: gx, y: gy, r: 70, life: 0.06, max: 0.06 }); if (Math.random() < 0.5) Audio8.play(this.zgun.explosive ? 'rocket' : this.zgun.pellets > 1 ? 'shotgun' : 'smg');
      }
    }
    // a parked car in the way gets chewed through
    if (this.attackCd <= 0 && this.type !== 'exploder' && this.game.map.cars.length && d > this.r + player.r + 3) {
      for (const pr of this.game.map.cars) {
        if (pr.taken || pr.type === 'car_wreck') continue;
        if (Math.abs(this.x - pr.x) > 20 + this.r || Math.abs(this.y - pr.y) > 11 + this.r) continue;
        let da = Math.atan2(pr.y - this.y, pr.x - this.x) - Math.atan2(player.y - this.y, player.x - this.x); da = Math.atan2(Math.sin(da), Math.cos(da));
        if (Math.abs(da) < 1.1) { this.attackCd = 0.9; this.game.damageCar(pr, this.damage || this.cfg.damage, this.x + (pr.x - this.x) * 0.5, this.y + (pr.y - this.y) * 0.5); break; }
      }
    }
    // attack (a driven car is a big target: anything touching its body bites it)
    const reach = player.car ? 24 : player.r;
    if (d < this.r + reach + 3 && this.attackCd <= 0 && this.type !== 'exploder') {
      this.attackCd = 0.9; player.hurt(this.damage || this.cfg.damage, this.x, this.y);
    }
  }
  /* ---- boss behaviour: charges / summons / keeps range and shoots ---- */
  bossAI(dt, player, d, dx, dy) {
    const bk = this.bk, g = this.game; let speedMult = 1, steer = null;
    this.chargeCd -= dt; this.summonCd -= dt; this.strafeT -= dt;
    if (bk.charge && this.chargeCd <= 0 && this.aiming <= 0 && this.burstLeft <= 0) { this.charge = 1.1; this.chargeCd = 6 * this.cdMult + 2; Audio8.play('wave'); g.shake(3); g.floatText(this.x, this.y - 30 * this.scale / 2, 'CHARGE!', '#ff6a5a'); }
    if (this.charge > 0) { this.charge -= dt; speedMult *= 3.2; }
    if (bk.summon && !bk.sahur && this.summonCd <= 0) { this.summonCd = 9; for (let i = 0; i < 3; i++) g.spawnZombie(this.wave >= 10 ? 'fast' : 'normal', this.x + (Math.random() - 0.5) * 40, this.y + (Math.random() - 0.5) * 40); g.floatText(this.x, this.y - 30, 'SUMMON!', '#c05aff'); }
    if (bk.ravager) {
      if (!this.enraged && this.hp < this.maxHp * 0.5) { this.enraged = true; this.cdMult *= 0.6; this.speed *= 1.3; g.shake(9); g.floatText(this.x, this.y - 50, 'ROAR!', '#ff2a2a'); Audio8.play('roar'); for (let i = 0; i < 4; i++) g.spawnZombie('fast', this.x + (Math.random() - 0.5) * 60, this.y + (Math.random() - 0.5) * 60); }
      this.leapCd -= dt;
      if (this.leap) { // crouch, then fly at the player and land with a shockwave
        const L = this.leap; L.t += dt;
        if (L.phase === 'crouch') { speedMult = 0; steer = { x: 0, y: 0 }; if (L.t >= 0.35) { L.phase = 'air'; L.t = 0; L.sx = this.x; L.sy = this.y; const a = Math.atan2(player.y - this.y, player.x - this.x), dd = Math.min(d, 260); L.tx = this.x + Math.cos(a) * dd; L.ty = this.y + Math.sin(a) * dd; Audio8.play('growl'); } }
        else { const k = Math.min(1, L.t / 0.55); speedMult = 0; steer = { x: 0, y: 0 }; this.height = Math.sin(k * Math.PI) * 46; this.x = L.sx + (L.tx - L.sx) * k; this.y = L.sy + (L.ty - L.sy) * k;
          if (k >= 1) { this.height = 0; this.leap = null; this.leapCd = 7 * this.cdMult; const dl = Math.hypot(player.x - this.x, player.y - this.y); if (dl < 72) player.hurt(this.damage, this.x, this.y); g.shake(9); Audio8.play('thud'); g.map.splat(this.x, this.y, 12, '#3a0d0e'); for (let i = 0; i < 20; i++) { const a = i / 20 * TAU; g.particles.push(new Particle(this.x + Math.cos(a) * 20, this.y + 6 + Math.sin(a) * 8, Math.cos(a) * 90, Math.sin(a) * 40, 0.35, '#6b4b26', 3, 'dot')); } g.lights.push({ x: this.x, y: this.y, r: 90, life: 0.2, max: 0.2 }); } }
        return { speedMult, steer };
      } else if (this.leapCd <= 0 && d > 120 && d < 420 && this.los) { this.leap = { phase: 'crouch', t: 0 }; g.floatText(this.x, this.y - 50, 'LEAP!', '#ff6a5a'); }
    }
    if (bk.sahur) { // the log: bat swings up close, drum shockwaves, a boomerang bat, and it calls the horde
      this.drumCd -= dt; this.swingCd -= dt; this.batCd -= dt; this.swing -= dt; this.los = g.map.los(this.x, this.y, player.x, player.y);
      if (!this.enraged && this.hp < this.maxHp * 0.5) { this.enraged = true; this.cdMult *= 0.6; this.speed *= 1.4; g.shake(10); g.floatText(this.x, this.y - 70, 'SAHUR!!!', '#ffb060'); Audio8.play('roar'); Audio8.play('wave'); for (let i = 0; i < 5; i++) g.spawnZombie('fast', this.x + (Math.random() - 0.5) * 80, this.y + (Math.random() - 0.5) * 80); }
      // shockwave rings from the drumming: a ring that sweeps over you hits once
      for (const ring of this.rings) { ring.r += 360 * dt; const dr = Math.hypot(player.x - ring.x, player.y - ring.y); if (!ring.hit && Math.abs(dr - ring.r) < 16 + player.r) { ring.hit = true; player.hurt(Math.round(this.damage * 0.8), ring.x, ring.y, 0.35); g.shake(6); } }
      this.rings = this.rings.filter(r => r.r < 240);
      // the thrown bat: flies to where you were, then comes back to the hand
      if (this.bat) { const B = this.bat; B.t += dt; B.spin += dt * 22;
        if (B.phase === 'out') { B.x += B.vx * dt; B.y += B.vy * dt; if (B.t >= B.dur) { B.phase = 'back'; B.hit = false; } }
        else { const bx = this.x - B.x, by = this.y - 10 - B.y, bd = Math.hypot(bx, by) || 1; B.x += bx / bd * 380 * dt; B.y += by / bd * 380 * dt; if (bd < 14) { this.bat = null; this.batCd = 6 * this.cdMult; } }
        if (B && !B.hit && Math.hypot(player.x - B.x, player.y - B.y) < 18 + player.r) { B.hit = true; player.hurt(this.damage, B.x, B.y); g.shake(7); Audio8.play('thud'); }
        for (const z of g.zombies) { if (z === this || z.dead || z.cfg.boss) continue; if (Math.hypot(z.x - B.x, z.y - B.y) < 16 + z.r) z.takeDamage(40, Math.atan2(z.y - B.y, z.x - B.x), undefined, 5); }
      }
      if (this.drum) { // TUNG TUNG TUNG: three pounds of the bat on the ground, each one a shockwave
        const D = this.drum; D.t += dt; speedMult = 0; steer = { x: 0, y: 0 }; this.height = D.t % 0.5 < 0.25 ? (D.t % 0.5) / 0.25 * 10 : (1 - (D.t % 0.5 - 0.25) / 0.25) * 10;
        if (D.t >= 0.5) { D.t = 0; D.count++; this.height = 0; this.rings.push({ x: this.x, y: this.y + 6, r: 10, hit: false }); g.shake(9); Audio8.play('thud'); g.floatText(this.x + (Math.random() - 0.5) * 40, this.y - 70 - Math.random() * 20, 'TUNG', '#ffb060'); g.map.splat(this.x, this.y + 6, 5, '#5a3010');
          for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; g.particles.push(new Particle(this.x + Math.cos(a) * 16, this.y + 8 + Math.sin(a) * 6, Math.cos(a) * 90, Math.sin(a) * 40 - 20, 0.4, '#8a5a30', 3, 'dot')); }
          if (D.count >= 3) { this.drum = null; this.drumCd = 7 * this.cdMult; g.floatText(this.x, this.y - 78, 'SAHUR', '#f4f2ea'); }
        }
        return { speedMult, steer };
      }
      if (this.swing > 0) { speedMult = 0.1; steer = null; if (!this.swung && this.swing <= 0.22) { this.swung = true; if (d < 70 + player.r) { player.hurt(Math.round(this.damage * 1.5), this.x, this.y, 0.5); g.shake(10); Audio8.play('thud'); } else Audio8.play('swap'); } return { speedMult, steer }; }
      if (this.swingCd <= 0 && d < 62) { this.swing = 0.5; this.swung = false; this.swingCd = 1.6 * this.cdMult; Audio8.play('growl'); }
      else if (this.drumCd <= 0 && d < 200) { this.drum = { t: 0, count: 0 }; g.floatText(this.x, this.y - 70, 'TUNG TUNG TUNG!', '#ffb060'); Audio8.play('wave'); }
      else if (this.batCd <= 0 && !this.bat && d > 120 && d < 420 && this.los) { const a = Math.atan2(player.y - this.y, player.x - this.x), dd = Math.min(d + 30, 380); this.bat = { x: this.x, y: this.y - 10, vx: Math.cos(a) * 340, vy: Math.sin(a) * 340, dur: dd / 340, t: 0, phase: 'out', spin: 0, hit: false }; g.floatText(this.x, this.y - 70, 'BAT!', '#ffb060'); Audio8.play('rocket'); }
      if (bk.summon && this.summonCd <= 0) { this.summonCd = 12 * this.cdMult; for (let i = 0; i < 4; i++) g.spawnZombie(this.wave >= 10 ? 'fast' : 'normal', this.x + (Math.random() - 0.5) * 60, this.y + (Math.random() - 0.5) * 60); g.floatText(this.x, this.y - 70, 'SAHUR CALL!', '#c05aff'); Audio8.play('wave'); }
      if (d < 40) speedMult = 0.2;
      return { speedMult, steer };
    }
    if (bk.bona) { // a brawler: no ranged kiting — it walks you down, charges, slams the ground and spits magma
      this.slamCd -= dt; this.chargeCd -= dt; this.spitCd -= dt; this.los = g.map.los(this.x, this.y, player.x, player.y);
      if (!this.enraged && this.hp < this.maxHp * 0.4) { this.enraged = true; this.cdMult *= 0.6; this.speed *= 1.3; g.shake(12); g.darkFlash = 0.5; g.floatText(this.x, this.y - 70, 'THE ROCK CRACKS OPEN', '#ff7a1a'); Audio8.play('roar'); Audio8.play('explode'); for (let i = 0; i < 4; i++) g.spawnZombie('fast', this.x + (Math.random() - 0.5) * 80, this.y + (Math.random() - 0.5) * 80); }
      if (this.rush) { // charge: a roar wind-up, then a straight sprint through everything
        const R = this.rush; R.t += dt;
        if (R.phase === 'roar') { speedMult = 0; steer = { x: 0, y: 0 }; g.shakeAmt = Math.max(g.shakeAmt, 1.5); if (R.t >= 0.7) { R.phase = 'go'; R.t = 0; const a = Math.atan2(player.y - this.y, player.x - this.x); R.ax = Math.cos(a); R.ay = Math.sin(a); Audio8.play('roar'); g.shake(6); } }
        else {
          speedMult = 4.4; steer = { x: R.ax, y: R.ay }; g.shakeAmt = Math.max(g.shakeAmt, 2.5);
          for (let i = 0; i < 2; i++) g.particles.push(new Particle(this.x - R.ax * 20 + (Math.random() - 0.5) * 24, this.y + 14, -R.ax * 40 + (Math.random() - 0.5) * 30, -20 - Math.random() * 30, 0.6, '#3a3a40', 3, 'smoke'));
          if (!R.hit && d < this.r + player.r + 8) { R.hit = true; player.hurt(Math.round(this.damage * 1.4), this.x, this.y); g.shake(12); Audio8.play('thud'); }
          for (const pr of g.map.cars) { if (pr.taken || pr.type === 'car_wreck') continue; if (Math.abs(this.x - pr.x) < 30 && Math.abs(this.y - pr.y) < 18) g.damageCar(pr, 600, pr.x, pr.y); }
          for (const z of g.zombies) { if (z === this || z.dead || z.cfg.boss) continue; if (dist(this.x, this.y, z.x, z.y) < this.r + z.r) z.takeDamage(60, Math.atan2(z.y - this.y, z.x - this.x), undefined, 6); } // it doesn't care what's in the way
          if (R.t >= 1.0 || R.hit) { this.rush = null; this.chargeCd = 6.5 * this.cdMult; }
        }
        return { speedMult, steer };
      }
      if (this.slam > 0) { // ground slam: rears up, then the ground itself hits you
        this.slam -= dt; speedMult = 0; steer = { x: 0, y: 0 }; this.height = Math.sin(Math.min(1, (0.6 - this.slam) / 0.6) * Math.PI) * 26;
        if (this.slam <= 0) {
          this.height = 0; this.slamCd = 4.5 * this.cdMult; const dl = Math.hypot(player.x - this.x, player.y - this.y); if (dl < 125) player.hurt(this.damage, this.x, this.y);
          g.shake(16); Audio8.play('thud'); Audio8.play('explode'); g.map.splat(this.x, this.y, 16, '#0e0e10'); g.lights.push({ x: this.x, y: this.y, r: 180, life: 0.35, max: 0.35 });
          for (let i = 0; i < 28; i++) { const a = i / 28 * TAU, sp = 140 + Math.random() * 60; g.particles.push(new Particle(this.x + Math.cos(a) * 24, this.y + 10 + Math.sin(a) * 10, Math.cos(a) * sp, Math.sin(a) * sp * 0.5 - 40, 0.55, i % 3 ? '#3a3a40' : '#ff7a1a', 3, 'blood')); }
          for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; g.particles.push(new Particle(this.x + Math.cos(a) * 60, this.y + 6 + Math.sin(a) * 30, Math.cos(a) * 120, Math.sin(a) * 60, 0.3, '#ffb060', 3, 'fire')); }
        }
        return { speedMult, steer };
      }
      if (this.slamCd <= 0 && d < 105) { this.slam = 0.6; Audio8.play('growl'); g.floatText(this.x, this.y - 70, 'SLAM!', '#ff7a1a'); }
      else if (this.chargeCd <= 0 && d > 140 && d < 460 && this.los) { this.rush = { phase: 'roar', t: 0, hit: false }; g.floatText(this.x, this.y - 70, 'ROAR!', '#ff2a2a'); Audio8.play('roar'); g.shake(4); }
      else if (this.spitCd <= 0 && d > 90 && d < 330 && this.los) { // a fan of burning rock from the mouth
        this.spitCd = bk.gun.cd * this.cdMult; const base = Math.atan2(player.y - this.y, player.x - this.x), mx = this.x + Math.cos(base) * 34, my = this.y - 12 + Math.sin(base) * 34;
        for (let i = 0; i < bk.gun.pellets; i++) g.ebullets.push(new EnemyBullet(g, mx, my, base + (i - (bk.gun.pellets - 1) / 2) * 0.14 + (Math.random() - 0.5) * bk.gun.spread, bk.gun, this));
        g.lights.push({ x: mx, y: my, r: 110, life: 0.25, max: 0.25 }); Audio8.play('flame'); Audio8.play('growl'); g.shake(3);
      }
      if (d > 30) speedMult *= this.enraged ? 1.15 : 1; else { speedMult = 0.2; }
      return { speedMult, steer };
    }
    if (bk.kraken) {
      if (!this.enraged && this.hp < this.maxHp * 0.5) { this.enraged = true; this.cdMult *= 0.65; this.speed *= 1.35; g.shake(8); g.floatText(this.x, this.y - 40, 'ENRAGED!', '#ff2a2a'); Audio8.play('scream'); }
      this.slamCd -= dt;
      if (this.slam > 0) { // tentacle slam: telegraph, then crush everything nearby
        this.slam -= dt; speedMult *= 0.15;
        if (this.slam <= 0) { if (d < 80) player.hurt(this.damage, this.x, this.y); g.shake(7); g.blood(this.x, this.y, 10, '#3a1a5c'); for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; g.particles.push(new Particle(this.x + Math.cos(a) * 30, this.y + Math.sin(a) * 30, Math.cos(a) * 60, Math.sin(a) * 60, 0.3, '#8a5ac8', 3, 'dot')); } Audio8.play('explode'); this.slamCd = 3.2 * this.cdMult; }
      } else if (this.slamCd <= 0 && d < 74 && this.burstLeft <= 0) { this.slam = 0.55; Audio8.play('growl'); }
    }
    if (!bk.gun) return { speedMult, steer };
    this.los = g.map.los(this.x, this.y, player.x, player.y);
    const keep = bk.keep;
    // positioning: retreat when too close, approach when far or no line of sight, otherwise strafe
    if (this.charge <= 0) {
      const ux = dx / d, uy = dy / d;
      if (!this.los || d > keep * 1.35) steer = null;
      else if (d < keep * 0.6) { steer = { x: -ux, y: -uy }; speedMult *= 0.8; }
      else { if (this.strafeT <= 0) { this.strafeDir *= -1; this.strafeT = 1.5 + Math.random() * 2; } steer = { x: -uy * this.strafeDir, y: ux * this.strafeDir }; speedMult *= 0.7; }
      if (this.aiming > 0 || this.burstLeft > 0) speedMult *= bk.gun.flame ? 0.6 : 0.35;
    }
    // firing
    const gun = bk.gun; this.gunCd -= dt;
    if (this.aiming > 0) { this.aiming -= dt; if (this.aiming <= 0) { this.fire(player); this.gunCd = gun.cd * this.cdMult; } }
    else if (this.burstLeft > 0) { this.burstTimer -= dt; if (this.burstTimer <= 0) { this.fire(player); this.burstLeft--; this.burstTimer = gun.burstGap; if (this.burstLeft <= 0) this.gunCd = gun.cd * this.cdMult; } }
    else if (this.gunCd <= 0 && this.los && d < gun.range * 0.9) {
      if (gun.aim) { this.aiming = gun.aim; Audio8.play('reload'); }
      else if (gun.burst) { this.burstLeft = gun.burst; this.burstTimer = 0; if (bk.kraken) { this.spiral = !this.spiral; this.spiralAngle = Math.atan2(player.y - this.y, player.x - this.x); if (this.spiral) g.floatText(this.x, this.y - 44, 'SPIRAL!', '#f5c518'); } }
      else { this.fire(player); this.gunCd = gun.cd * this.cdMult; }
    }
    return { speedMult, steer };
  }
  /* where the kraken's two guns sit: on the front-left / front-right tentacle tips */
  gunTip(side) {
    const p = this.target || this.game.player, a = Math.atan2(p.y - this.y, p.x - this.x), sgn = side ? 1 : -1;
    if (this.bk.ravager) { const bob = Math.sin(this.walk) * 1.5; return { x: this.x + Math.cos(a) * 20 + Math.cos(a + Math.PI / 2) * 19 * sgn, y: this.y - 6 - this.height + bob + Math.sin(a) * 20 + Math.sin(a + Math.PI / 2) * 19 * sgn, angle: a }; }
    const wig = Math.sin(this.game.time * 5 + side * 2) * 3;
    return { x: this.x + Math.cos(a) * 24 + Math.cos(a + Math.PI / 2) * (22 * sgn + wig), y: this.y + Math.sin(a) * 24 + Math.sin(a + Math.PI / 2) * (22 * sgn + wig), angle: a };
  }
  fire(player) {
    const gun = this.bk.gun, g = this.game, s = this.scale;
    let base = Math.atan2(player.y - this.y, player.x - this.x);
    let gx = this.x + Math.cos(base) * 9 * s, gy = this.y + 2 * s + Math.sin(base) * 9 * s;
    if (gun.dual) { // twin miniguns alternate; spiral mode sweeps both barrels around
      this.gunSide = 1 - this.gunSide; const tip = this.gunTip(this.gunSide); gx = tip.x; gy = tip.y;
      if (this.spiral) { this.spiralAngle += 0.42; base = this.spiralAngle + this.gunSide * Math.PI; }
    }
    if (gun.cannon) {
      this.shots++; this.muzzle[this.gunSide] = 0.15;
      if (this.shots % 4 === 0) { // SALVO: both cannons fan five shells each
        g.floatText(this.x, this.y - 54, 'SALVO!', '#ffb02a');
        [0, 1].forEach(side => { const tip = this.gunTip(side); for (let i = -2; i <= 2; i++) g.ebullets.push(new EnemyBullet(g, tip.x, tip.y, base + i * 0.22, gun, this)); this.muzzle[side] = 0.2; });
      } else g.ebullets.push(new EnemyBullet(g, gx, gy, base + (Math.random() - 0.5) * gun.spread * 2, gun, this));
      g.lights.push({ x: gx, y: gy, r: 110, life: 0.1, max: 0.1 }); g.shake(2); Audio8.play('cannon'); this.aimAngle = base; return;
    }
    const n = gun.pellets || 1;
    for (let i = 0; i < n; i++) { const a = base + (this.spiral ? 0 : (Math.random() - 0.5) * gun.spread * 2); g.ebullets.push(new EnemyBullet(g, gx, gy, a, gun, this)); }
    if (!gun.flame) { g.lights.push({ x: gx, y: gy, r: 90, life: 0.07, max: 0.07 }); Audio8.play(gun.explosive ? 'rocket' : gun.pellets ? 'shotgun' : gun.aim ? 'rifle' : 'smg'); }
    else if (Math.random() < 0.3) Audio8.play('flame');
    this.aimAngle = base;
  }
  draw(ctx) {
    const s = this.scale, bob = Math.sin(this.walk) * 1.2;
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(this.x, this.y + 7 * s, 6 * s, 3 * s, 0, 0, TAU); ctx.fill();
    if (this.bk && this.bk.kraken) { this.drawKraken(ctx); return; }
    if (this.bk && this.bk.ravager) { this.drawRavager(ctx); return; }
    if (this.bk && this.bk.bona) { this.drawBona(ctx); return; }
    if (this.bk && this.bk.sahur) { this.drawSahur(ctx); return; }
    const spriteName = this.sprite || (this.game.map.id === 'lab' && !this.cfg.boss && Sprites.get(this.cfg.sprite + '_lab') ? this.cfg.sprite + '_lab' : this.cfg.sprite);
    const name = this.hit > 0 ? null : spriteName;
    if (name) Sprites.draw(ctx, name, this.x, this.y + bob, { flip: this.flip, scale: s, ox: -8 * s, oy: -9 * s });
    else { ctx.save(); ctx.translate(Math.round(this.x), Math.round(this.y + bob)); if (this.flip) ctx.scale(-1, 1); ctx.drawImage(Sprites.whiteOf(spriteName), -8 * s, -9 * s, 16 * s, 16 * s); ctx.restore(); }
    const wid = this.bk ? this.bk.weapon : (this.gunId || (this.gunSprite ? 'pistol' : null));
    if (wid) { // gun in hand, pointed at the player
      const p = this.target || this.game.player, a = Math.atan2(p.y - this.y, p.x - this.x), gs = s * 0.9;
      ctx.save(); ctx.translate(this.x + Math.cos(a) * 4 * s, this.y + 1 * s + Math.sin(a) * 4 * s + bob); ctx.rotate(a); if (Math.cos(a) < 0) ctx.scale(1, -1);
      ctx.drawImage(Sprites.get(this.gunSprite || WEAPONS[wid].sprite), -2 * gs, -4 * gs, 16 * gs, 8 * gs); ctx.restore();
    }
    if (this.bk) { ctx.font = '6px "Press Start 2P", monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#000'; ctx.fillText(this.bk.name, this.x + 1, this.y - 14 * s + 1); ctx.fillStyle = this.aiming > 0 ? '#ff4a3a' : '#e8e6dc'; ctx.fillText(this.bk.name, this.x, this.y - 14 * s); ctx.textAlign = 'left'; }
    if (this.captured > 0 && this.capturedBy) { // black symbiote engulfing it, rising over the capture time
      const cp = this.capturedBy.sb.capture, k = 1 - this.captured / cp.duration; ctx.save(); ctx.beginPath(); ctx.rect(this.x - 20 * s, this.y + 8 * s - 18 * s * k, 40 * s, 18 * s * k + 4); ctx.clip(); ctx.globalAlpha = 0.9; ctx.translate(Math.round(this.x), Math.round(this.y + bob)); if (this.flip) ctx.scale(-1, 1); ctx.drawImage(Sprites.tintOf(spriteName, '#0a0a0e'), -8 * s, -9 * s, 16 * s, 16 * s); ctx.restore(); ctx.globalAlpha = 1;
      if (k > 0.4) { ctx.fillStyle = '#f4f2ea'; ctx.fillRect(Math.round(this.x - 2 * s), Math.round(this.y - 6 * s), Math.ceil(s), Math.ceil(s)); ctx.fillRect(Math.round(this.x + 1 * s), Math.round(this.y - 6 * s), Math.ceil(s), Math.ceil(s)); }
      ctx.font = '6px "Press Start 2P", monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#e6e6f0'; ctx.fillText(`CAPTURING ${Math.ceil(this.captured)}s`, this.x, this.y - 16 * s - 8); ctx.textAlign = 'left';
    }
    if (this.poison > 0 && Math.random() < 0.5) { ctx.fillStyle = '#5fd35a'; ctx.fillRect(Math.round(this.x + (Math.random() - 0.5) * 10 * s), Math.round(this.y + (Math.random() - 0.5) * 10 * s), 2, 2); }
    if (this.burn > 0) { for (let i = 0; i < 3; i++) { ctx.fillStyle = i % 2 ? '#ffd23a' : '#ff6a2a'; ctx.fillRect(Math.round(this.x + (Math.random() - 0.5) * 10 * s), Math.round(this.y + (Math.random() - 0.7) * 12 * s), 2, 2); } }
    if (this.charm > 0) { const tt = this.charmT || 0; ctx.font = '7px "Press Start 2P", monospace'; ctx.textAlign = 'center'; ctx.fillStyle = `rgba(255,120,190,${0.6 + Math.sin(tt * 8) * 0.3})`; ctx.fillText(tt % 1 < 0.5 ? '♪' : '♫', this.x + Math.sin(tt * 5) * 3, this.y - 12 * s - 6 + Math.sin(tt * 6) * 2); ctx.textAlign = 'left'; }
    if (this.web > 0) { // spider web wrapped around it
      const wr = 9 * s, wx = this.x, wy = this.y - 2 * s; ctx.strokeStyle = 'rgba(245,242,234,0.85)'; ctx.lineWidth = 1;
      ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; ctx.moveTo(wx, wy); ctx.lineTo(wx + Math.cos(a) * wr, wy + Math.sin(a) * wr); } ctx.stroke();
      ctx.beginPath(); [0.35, 0.65, 0.95].forEach(k => { for (let i = 0; i <= 8; i++) { const a = i / 8 * TAU, px = wx + Math.cos(a) * wr * k, py = wy + Math.sin(a) * wr * k; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } }); ctx.stroke();
      ctx.fillStyle = 'rgba(245,242,234,0.6)'; ctx.fillRect(Math.round(wx) - 1, Math.round(wy) - 1, 2, 2);
    }
    if (this.type === 'exploder') { const pulse = this.fuse >= 0 ? 0.6 + Math.sin(performance.now() / 30) * 0.4 : 0.25 + Math.sin(performance.now() / 200) * 0.15; ctx.fillStyle = `rgba(255,120,20,${pulse})`; ctx.beginPath(); ctx.arc(this.x, this.y + 2, 5, 0, TAU); ctx.fill(); }
    if (this.cfg.boss && (!this.bk || this.kind === 'warlord' || this.kind === 'brute')) { Sprites.draw(ctx, 'crown', this.x, this.y - 18 * s + 2, { scale: 2 }); }
    if (this.hp < this.maxHp && (this.type === 'tank' || this.cfg.boss || this.hit > -0.5)) {
      const w = this.cfg.boss ? 40 : 14, h = this.cfg.boss ? 4 : 2, yy = this.y - 12 * s;
      ctx.fillStyle = '#111'; ctx.fillRect(this.x - w / 2 - 1, yy - 1, w + 2, h + 2);
      ctx.fillStyle = this.cfg.boss ? '#c05aff' : '#d3372b'; ctx.fillRect(this.x - w / 2, yy, w * clamp(this.hp / this.maxHp, 0, 1), h);
    }
  }
  /* ---- the Ravager: hunched red demon, spines, spiked tail, a cannon in each hand ---- */
  drawRavager(ctx) {
    const g = this.game, t = g.time, p = this.target || g.player, white = this.hit > 0, en = this.enraged;
    this.muzzle[0] -= 1 / 60; this.muzzle[1] -= 1 / 60;
    const flip = p.x < this.x, h = this.height, crouch = this.leap && this.leap.phase === 'crouch' ? 1 - this.leap.t / 0.35 * 0.35 : 1;
    const vs = this.venomSkin;
    const body = white ? '#fff' : vs ? '#101014' : en ? '#a8231f' : '#8a1f1f', dark = white ? '#e8e8e8' : vs ? '#000000' : '#4a0f10', light = white ? '#fff' : vs ? '#26262e' : en ? '#e04a38' : '#c23a30', bone = white ? '#fff' : vs ? '#f4f2ea' : '#d9b8a8', eye = white ? '#fff' : vs ? '#f4f2ea' : en ? '#ff3a2a' : '#ffd23a';
    const R = (x, y, w, hh, col) => { ctx.fillStyle = col; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(hh)); };
    // shadow (smaller while airborne)
    const S = 1.45;
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(this.x, this.y + 20, 30 - h * 0.25, 9 - h * 0.08, 0, 0, TAU); ctx.fill();
    ctx.save(); ctx.translate(this.x, this.y + 4 - h); ctx.scale(flip ? -S : S, S * crouch); ctx.translate(0, 16 * (1 - crouch));
    const bob = this.moving !== false ? Math.sin(this.walk) * 1.5 : 0, step = Math.sin(this.walk);
    // spiked tail curling behind (left)
    for (let k = 0; k < 10; k++) { const tx = -12 - k * 5, ty = 6 + Math.sin(t * 2.5 + k * 0.6) * (k * 1.1) - k * 0.8; const sz = 6 - k * 0.45; R(tx - sz / 2, ty - sz / 2, sz, sz, k % 2 ? dark : body); if (k % 2 === 0 && k < 8) R(tx - 1, ty - sz / 2 - 3, 2, 3, bone); }
    // legs (digitigrade) with claws
    [[-4, step], [6, -step]].forEach(([lx, ph]) => { R(lx - 3, 4, 7, 8, dark); R(lx - 2 + ph * 2, 10, 5, 7, body); R(lx - 3 + ph * 3, 16, 9, 3, dark); [0, 3, 6].forEach(c => R(lx - 3 + ph * 3 + c, 18, 2, 2, bone)); });
    // torso, hunched forward, with ribs
    R(-9, -14 + bob, 20, 22, body); R(-7, -12 + bob, 16, 18, light); R(-9, -14 + bob, 20, 3, dark);
    [-6, -2, 2].forEach(ry => R(-6, ry + bob, 14, 1, dark));
    R(-2, 0 + bob, 8, 6, dark); // gut
    // back spines
    for (let i = 0; i < 6; i++) { const sx = -9 + i * 3, sh = 7 + Math.sin(t * 6 + i) * 1.5 + (i === 2 || i === 3 ? 4 : 0); R(sx, -14 + bob - sh, 2, sh, bone); }
    // head jutting forward, jaw open, crest
    R(6, -18 + bob, 14, 9, body); R(8, -16 + bob, 12, 5, light); R(14, -11 + bob, 8, 4, dark); R(14, -9 + bob, 8, 2, body);
    [15, 18, 21].forEach(tx => R(tx, -11 + bob, 1, 2, bone)); [16, 19].forEach(tx => R(tx, -8 + bob, 1, 2, bone));
    [0, 3, 6].forEach((cx, i) => R(8 + cx, -18 + bob - 5 - i, 2, 5 + i, bone));
    R(13, -16 + bob, 3, 2, eye); if (en) { ctx.fillStyle = 'rgba(255,60,40,0.35)'; ctx.fillRect(11, -18 + bob, 7, 6); }
    ctx.restore();
    // arms + cannons (world space so they aim at the player)
    [0, 1].forEach(side => {
      const tip = this.gunTip(side), sh = { x: this.x + (side ? 9 : -9), y: this.y - 10 - h + bob };
      ctx.strokeStyle = dark; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(sh.x, sh.y); ctx.lineTo(tip.x, tip.y); ctx.stroke();
      ctx.strokeStyle = body; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(sh.x, sh.y); ctx.lineTo(tip.x, tip.y); ctx.stroke();
      ctx.save(); ctx.translate(tip.x, tip.y); ctx.rotate(tip.angle);
      R(-8, -5, 24, 10, '#0f1014'); R(-7, -4, 22, 8, white ? '#fff' : '#3a3d45'); R(-7, -4, 22, 3, '#5c616e'); R(6, -3, 3, 6, '#1a1a1e'); R(-12, -4, 6, 8, dark); // barrel + hand
      if (this.muzzle[side] > 0) { ctx.fillStyle = `rgba(255,${160 + Math.random() * 60},40,${this.muzzle[side] * 5})`; ctx.beginPath(); ctx.arc(18, 0, 8 + Math.random() * 4, 0, TAU); ctx.fill(); }
      ctx.restore();
    });
    // name + hp
    if (vs) return; // the ally draws its own label and bar
    ctx.font = '6px "Press Start 2P", monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#000'; ctx.fillText('RAVAGER', this.x + 1, this.y - 61 - h); ctx.fillStyle = en ? '#ff4a3a' : '#e8e6dc'; ctx.fillText(en ? 'RAVAGER ★' : 'RAVAGER', this.x, this.y - 62 - h); ctx.textAlign = 'left';
    if (this.hp < this.maxHp) { const w = 70, hh = 4, yy = this.y - 54 - h; ctx.fillStyle = '#111'; ctx.fillRect(this.x - w / 2 - 1, yy - 1, w + 2, hh + 2); ctx.fillStyle = en ? '#ff3a2a' : '#c05aff'; ctx.fillRect(this.x - w / 2, yy, w * clamp(this.hp / this.maxHp, 0, 1), hh); }
  }
  /* ---- Bona: a mountain of black rock on four limbs, fire glowing through the cracks, a jaw full of teeth ---- */
  drawBona(ctx) {
    const g = this.game, t = g.time, p = this.target || g.player, white = this.hit > 0, en = this.enraged, h = this.height;
    const flip = p.x < this.x, rushing = this.rush && this.rush.phase === 'go', roaring = this.rush && this.rush.phase === 'roar';
    const rock = white ? '#fff' : '#26262a', dark = white ? '#e8e8e8' : '#0e0e10', light = white ? '#fff' : '#3d3d44', edge = white ? '#fff' : '#55555e';
    const glowC = en ? '#ff3a1a' : '#ff7a1a', glowB = en ? '#ffb060' : '#ffd080', tooth = '#f4f2ea', mouth = en ? '#ff4a1a' : '#e85a10';
    const R = (x, y, w, hh, col) => { ctx.fillStyle = col; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(hh)); };
    const S = 1.7, flick = 0.65 + Math.sin(t * 9) * 0.15 + Math.sin(t * 23) * 0.1 + (en ? 0.2 : 0);
    // heat glow on the ground and embers rising off the body
    const gr = ctx.createRadialGradient(this.x, this.y, 6, this.x, this.y, 70 + (en ? 20 : 0)); gr.addColorStop(0, `rgba(255,110,30,${0.22 * flick})`); gr.addColorStop(1, 'rgba(255,110,30,0)'); ctx.fillStyle = gr; ctx.fillRect(this.x - 100, this.y - 100, 200, 200);
    this.ember -= 1 / 60; if (this.ember <= 0) { this.ember = en ? 0.05 : 0.12; g.particles.push(new Particle(this.x + (Math.random() - 0.5) * 50, this.y - 10 - h + (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 20, -30 - Math.random() * 40, 0.8 + Math.random() * 0.6, Math.random() < 0.6 ? glowC : glowB, 2, 'fire')); }
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.ellipse(this.x, this.y + 22, 42 - h * 0.3, 12 - h * 0.1, 0, 0, TAU); ctx.fill();
    ctx.save(); ctx.translate(this.x, this.y + 6 - h); ctx.scale(flip ? -S : S, S * (roaring ? 1 + Math.sin(t * 40) * 0.02 : 1)); if (rushing) ctx.transform(1, 0, 0.25, 1, 0, 0);
    const step = Math.sin(this.walk * 1.4), bob = this.moving !== false && !this.slam ? Math.abs(Math.sin(this.walk * 1.4)) * 1.5 : 0;
    // rear leg (far side) and rear leg (near side)
    R(-24 + step * 2, -2, 9, 12, dark); R(-26 + step * 2, 8, 12, 5, dark);
    R(-18 - step * 2, 0, 10, 12, rock); R(-21 - step * 2, 9, 14, 5, dark); [0, 4, 8].forEach(c => R(-21 - step * 2 + c, 13, 2, 2, edge));
    // body: a boulder, hunched high at the shoulders
    R(-26, -20 + bob, 46, 26, rock); R(-24, -24 + bob, 34, 8, rock); R(-22, -18 + bob, 30, 8, light); R(-26, 2 + bob, 46, 4, dark);
    // plates / scales
    for (let i = 0; i < 6; i++) R(-22 + i * 7, -8 + bob + (i % 2) * 3, 5, 2, dark);
    // spikes on the back and shoulders
    for (let i = 0; i < 7; i++) { const sx = -24 + i * 6, sh = 6 + ((i * 5) % 7) + (i === 3 ? 5 : 0); R(sx, -24 + bob - sh, 3, sh, i % 2 ? dark : edge); R(sx + 1, -24 + bob - sh, 1, 2, edge); }
    [[-4, -30], [4, -34], [12, -30]].forEach(([sx, sy]) => { R(sx, sy + bob, 3, 8, edge); R(sx, sy + bob, 1, 8, dark); });
    // glowing cracks in the rock (they pulse; brighter when enraged)
    ctx.globalAlpha = Math.min(1, flick); this.cracks.forEach((c, i) => { const cy = c.y + bob; R(c.x, cy, c.l, 1, glowC); R(c.x + c.l - 1, cy + c.v, 1, 3, glowC); if (i % 2) R(c.x + 1, cy - 1, 2, 1, glowB); }); ctx.globalAlpha = 1;
    R(-10, -12 + bob, 12, 3, glowB); R(-8, -11 + bob, 8, 1, '#fff'); // the bright chest fissure
    // near-side forearm: enormous, knuckles on the ground
    R(4, -10 + bob, 14, 22, rock); R(2, -12 + bob, 18, 6, light); R(2, 10, 22, 9, dark); R(4, 12, 18, 5, rock); [2, 7, 12, 17].forEach(c => R(2 + c, 17, 3, 3, edge));
    R(6, -2 + bob, 4, 1, glowC); R(9, 4 + bob, 5, 1, glowC);
    // far-side forearm
    R(-8, -6 + bob, 10, 20, dark); R(-10, 12, 14, 6, dark);
    // head: low, jutting forward; the jaw hangs open
    const jaw = roaring ? 7 + Math.sin(t * 30) * 1.5 : this.slam > 0 ? 6 : 4 + Math.sin(t * 2) * 1;
    R(12, -30 + bob, 24, 16, rock); R(14, -32 + bob, 18, 4, light); R(30, -26 + bob, 8, 10, rock);
    R(14, -36 + bob, 3, 7, edge); R(22, -38 + bob, 3, 9, edge); // brow horns
    R(26, -26 + bob, 5, 3, glowC); R(27, -26 + bob, 2, 1, '#fff'); R(19, -25 + bob, 3, 2, glowC); // eyes: one glaring, one half hidden
    ctx.fillStyle = `rgba(255,120,40,${0.35 * flick})`; ctx.fillRect(24, -28 + bob, 10, 7);
    // mouth: upper teeth, glowing throat, lower jaw with teeth
    R(16, -16 + bob, 22, 3 + jaw, mouth); R(18, -15 + bob, 18, 1 + jaw, glowC);
    [16, 20, 24, 28, 32, 35].forEach((tx, i) => R(tx, -16 + bob, 2, i % 2 ? 4 : 3, tooth));
    R(14, -13 + jaw + bob, 24, 5, rock); R(14, -13 + jaw + bob, 24, 1, dark); [17, 22, 27, 32].forEach(tx => R(tx, -16 + jaw + bob, 2, 3, tooth));
    ctx.restore();
    if (this.slam > 0) { const k = 1 - this.slam / 0.6; ctx.strokeStyle = `rgba(255,120,40,${0.5 * k})`; ctx.lineWidth = 2; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.arc(this.x, this.y + 6, 125, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
    if (roaring) { ctx.font = '7px "Press Start 2P", monospace'; ctx.textAlign = 'center'; ctx.fillStyle = `rgba(255,60,40,${0.6 + Math.sin(t * 30) * 0.4})`; ctx.fillText('RRAAAAAGH', this.x, this.y - 80 - h); ctx.textAlign = 'left'; }
    // name + hp
    ctx.font = '7px "Press Start 2P", monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#000'; ctx.fillText('BONA', this.x + 1, this.y - 69 - h); ctx.fillStyle = en ? '#ff4a3a' : '#ffb060'; ctx.fillText(en ? 'BONA ★' : 'BONA', this.x, this.y - 70 - h); ctx.textAlign = 'left';
    if (this.hp < this.maxHp) { const w = 84, hh = 5, yy = this.y - 62 - h; ctx.fillStyle = '#111'; ctx.fillRect(this.x - w / 2 - 1, yy - 1, w + 2, hh + 2); ctx.fillStyle = en ? '#ff3a2a' : '#ff7a1a'; ctx.fillRect(this.x - w / 2, yy, w * clamp(this.hp / this.maxHp, 0, 1), hh); }
  }
  /* ---- Tung Tung Sahur: a wooden log with a face, thin arms and legs, and a bat ---- */
  drawBat(ctx, x, y, ang, len = 30) { ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.fillStyle = '#5a3010'; ctx.fillRect(-2, -3, len, 6); ctx.fillStyle = '#c86a22'; ctx.fillRect(-1, -2, len - 2, 4); ctx.fillStyle = '#e0863a'; ctx.fillRect(len * 0.4, -3, len * 0.55, 3); ctx.beginPath(); ctx.arc(len - 2, 0, 4.5, 0, TAU); ctx.fillStyle = '#c86a22'; ctx.fill(); ctx.fillStyle = '#5a3010'; ctx.fillRect(-3, -3, 3, 6); ctx.restore(); }
  drawSahur(ctx) {
    const g = this.game, t = g.time, p = this.target || g.player, white = this.hit > 0, en = this.enraged, h = this.height;
    const flip = p.x < this.x, S = 1.5;
    const wood = white ? '#fff' : en ? '#c8501e' : '#b8632a', woodD = white ? '#e8e8e8' : en ? '#7a2a10' : '#7a3d16', woodL = white ? '#fff' : en ? '#e8823a' : '#d4823a', top = white ? '#fff' : '#e8b060', skin = white ? '#fff' : '#e08a3a', skinD = white ? '#eee' : '#a85a20';
    const R = (x, y, w, hh, col) => { ctx.fillStyle = col; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(hh)); };
    // shockwave rings on the ground
    for (const ring of this.rings) { const k = ring.r / 240; ctx.strokeStyle = `rgba(255,190,110,${0.9 * (1 - k)})`; ctx.lineWidth = 4 - k * 2; ctx.beginPath(); ctx.ellipse(ring.x, ring.y, ring.r, ring.r * 0.55, 0, 0, TAU); ctx.stroke(); ctx.strokeStyle = `rgba(120,70,30,${0.5 * (1 - k)})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(ring.x, ring.y, ring.r - 5, (ring.r - 5) * 0.55, 0, 0, TAU); ctx.stroke(); }
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(this.x, this.y + 20, 24 - h * 0.3, 8 - h * 0.1, 0, 0, TAU); ctx.fill();
    ctx.save(); ctx.translate(this.x, this.y + 6 - h); ctx.scale(flip ? -S : S, S);
    const step = Math.sin(this.walk * 1.6), walking = this.moving !== false && !this.drum && this.swing <= 0;
    // legs: thin, bare feet
    [[-5, step], [4, -step]].forEach(([lx, ph]) => { const s2 = walking ? ph : 0; R(lx - 1, 6, 3, 9 + s2 * 1, skin); R(lx - 1, 15 + s2, 3, 3, skinD); R(lx - 3 + (flip ? 0 : 1), 17 + s2, 7, 2, skin); [0, 2, 4].forEach(c => R(lx - 3 + c + 1, 19 + s2, 1, 1, skinD)); });
    // the log body
    R(-11, -36, 22, 44, wood); R(-9, -38, 18, 3, top); R(-11, -36, 22, 2, woodL); R(-11, -36, 3, 44, woodD); R(8, -36, 3, 44, woodD);
    [-28, -22, -6, 0, 3].forEach((gy, i) => R(-8 + (i % 2) * 4, gy, 10 - (i % 3) * 3, 1, woodD)); // grain
    R(-7, -4, 14, 12, woodL); R(-6, 2, 12, 1, woodD);
    // face: thick brows, big round eyes, a grin
    R(-8, -30, 6, 2, '#2a1408'); R(2, -31, 6, 2, '#2a1408');
    R(-8, -27, 6, 6, '#f4f2ea'); R(2, -27, 6, 6, '#f4f2ea'); R(-6, -26, 3, 4, '#5a3010'); R(4, -26, 3, 4, '#5a3010'); R(-5, -26, 1, 1, '#000'); R(5, -26, 1, 1, '#000'); R(-6, -25, 1, 1, '#fff'); R(4, -25, 1, 1, '#fff');
    if (en) { R(-8, -27, 6, 1, '#c0201a'); R(2, -27, 6, 1, '#c0201a'); }
    R(-1, -21, 2, 3, skinD); // nose
    const grin = this.swing > 0 || this.drum ? 3 : 2; R(-5, -16, 10, grin, '#3a1408'); R(-4, -16, 8, 1, '#f4f2ea'); R(-6, -17, 1, 1, '#3a1408'); R(5, -17, 1, 1, '#3a1408');
    // arms: thin; the far arm hangs, the near arm holds the bat
    R(-13, -22, 3, 16, skin); R(-14, -7, 4, 3, skinD);
    ctx.restore();
    // near arm + bat in world space so it swings toward the player
    const dir = flip ? -1 : 1, sx = this.x + dir * 12 * S, sy = this.y + 6 - h - 22 * S;
    let hand, batAng;
    if (this.swing > 0) { const k = 1 - this.swing / 0.5; batAng = flip ? Math.PI + 1.6 - k * 3.4 : -1.6 + k * 3.4; hand = { x: sx + Math.cos(batAng) * 10, y: sy + Math.sin(batAng) * 10 }; }
    else if (this.drum) { const k = this.drum.t % 0.5 < 0.25 ? (this.drum.t % 0.5) / 0.25 : 1 - (this.drum.t % 0.5 - 0.25) / 0.25; batAng = dir > 0 ? -1.3 + k * 2.6 : Math.PI + 1.3 - k * 2.6; hand = { x: sx + dir * 6, y: sy + 8 }; }
    else { batAng = dir > 0 ? 1.1 + Math.sin(t * 2) * 0.05 : Math.PI - 1.1 - Math.sin(t * 2) * 0.05; hand = { x: sx + dir * 4, y: sy + 14 }; }
    ctx.strokeStyle = skinD; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(hand.x, hand.y); ctx.stroke(); ctx.strokeStyle = skin; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(hand.x, hand.y); ctx.stroke();
    if (!this.bat) this.drawBat(ctx, hand.x, hand.y, batAng, 34); else this.drawBat(ctx, this.bat.x, this.bat.y, this.bat.spin, 34);
    if (this.swing > 0 && this.swing < 0.3) { const k = this.swing / 0.3, a0 = Math.atan2(p.y - this.y, p.x - this.x); ctx.strokeStyle = `rgba(255,220,160,${k})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(this.x, this.y - 6, 60, a0 - 1.2, a0 + 1.2); ctx.stroke(); }
    // name + hp
    ctx.font = '6px "Press Start 2P", monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#000'; ctx.fillText('TUNG TUNG SAHUR', this.x + 1, this.y - 69 - h); ctx.fillStyle = en ? '#ff4a3a' : '#ffb060'; ctx.fillText(en ? 'TUNG TUNG SAHUR ★' : 'TUNG TUNG SAHUR', this.x, this.y - 70 - h); ctx.textAlign = 'left';
    if (this.hp < this.maxHp) { const w = 84, hh = 5, yy = this.y - 62 - h; ctx.fillStyle = '#111'; ctx.fillRect(this.x - w / 2 - 1, yy - 1, w + 2, hh + 2); ctx.fillStyle = en ? '#ff3a2a' : '#e08a3a'; ctx.fillRect(this.x - w / 2, yy, w * clamp(this.hp / this.maxHp, 0, 1), hh); }
  }
  /* ---- the Kraken: procedural octopus with two miniguns ---- */
  drawKraken(ctx) {
    const t = this.game.time, p = this.target || this.game.player, white = this.hit > 0, en = this.enraged;
    const aim = Math.atan2(p.y - this.y, p.x - this.x), S = 1.35;
    const vs = this.venomSkin;
    const body = white ? '#ffffff' : vs ? '#101014' : en ? '#7a2d6a' : '#5a2d8a', dark = white ? '#e0e0e0' : vs ? '#000000' : en ? '#4a1a40' : '#3a1a5c', light = white ? '#ffffff' : vs ? '#26262e' : en ? '#b04a90' : '#8a5ac8', sucker = white ? '#fff' : vs ? '#f4f2ea' : '#e08ad0';
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(this.x, this.y + 14 * S, 26 * S, 10 * S, 0, 0, TAU); ctx.fill();
    // eight tentacles, each a chain of shrinking squares that wiggles
    for (let i = 0; i < 8; i++) {
      const ba = i / 8 * TAU + Math.sin(t * 1.3 + i) * 0.25, holdsGun = i === 1 || i === 6;
      for (let k = 0; k < 7; k++) {
        const len = (12 + k * 5.5) * S, wig = Math.sin(t * 4.5 + i * 1.7 + k * 0.9) * (k * 1.6 * S);
        const px = this.x + Math.cos(ba) * len + Math.cos(ba + Math.PI / 2) * wig, py = this.y + 4 * S + Math.sin(ba) * len + Math.sin(ba + Math.PI / 2) * wig;
        const sz = (7 - k * 0.7) * S;
        ctx.fillStyle = k % 2 ? dark : body; ctx.fillRect(Math.round(px - sz / 2), Math.round(py - sz / 2), Math.ceil(sz), Math.ceil(sz));
        if (k % 2 === 0 && k > 1) { ctx.fillStyle = sucker; ctx.fillRect(Math.round(px), Math.round(py), 1, 1); }
      }
      void holdsGun;
    }
    // head
    ctx.fillStyle = '#0f1014'; ctx.beginPath(); ctx.arc(this.x, this.y - 2 * S, 19 * S, 0, TAU); ctx.fill();
    ctx.fillStyle = body; ctx.beginPath(); ctx.arc(this.x, this.y - 2 * S, 17 * S, 0, TAU); ctx.fill();
    ctx.fillStyle = light; ctx.beginPath(); ctx.arc(this.x - 5 * S, this.y - 9 * S, 8 * S, 0, TAU); ctx.fill();
    ctx.fillStyle = dark; [[-10, 2], [8, 4], [2, -12]].forEach(([ox, oy]) => ctx.fillRect(this.x + ox * S, this.y + oy * S, 4, 4));
    // eyes track the player; red when enraged
    const ex = Math.cos(aim) * 2, ey = Math.sin(aim) * 2;
    [-6 * S, 6 * S].forEach(ox => {
      ctx.fillStyle = '#0f1014'; ctx.beginPath(); ctx.ellipse(this.x + ox, this.y - 3 * S, 5 * S, 6 * S, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = white ? '#fff' : vs ? '#f4f2ea' : en ? '#ff3a2a' : '#f5c518'; ctx.beginPath(); ctx.ellipse(this.x + ox, this.y - 3 * S, 4 * S, 5 * S, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#0f1014'; ctx.fillRect(Math.round(this.x + ox + ex * S) - 1, Math.round(this.y - 3 * S + ey * S) - 3, 3, 6);
    });
    ctx.fillStyle = '#0f1014'; ctx.fillRect(this.x - 5, this.y + 6 * S, 10, 3); // mouth
    // twin miniguns on the front tentacles
    [0, 1].forEach(side => { const g = this.gunTip(side); ctx.save(); ctx.translate(g.x, g.y); ctx.rotate(g.angle); if (Math.cos(g.angle) < 0) ctx.scale(1, -1); ctx.drawImage(Sprites.get('gun_minigun'), -8, -8, 32, 16); ctx.restore(); });
    // name + hp
    if (vs) return;
    ctx.font = '6px "Press Start 2P", monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#000'; ctx.fillText('KRAKEN', this.x + 1, this.y - 55); ctx.fillStyle = en ? '#ff4a3a' : '#e8e6dc'; ctx.fillText(en ? 'KRAKEN ★' : 'KRAKEN', this.x, this.y - 56); ctx.textAlign = 'left';
    if (this.hp < this.maxHp) { const w = 70, h = 4, yy = this.y - 47; ctx.fillStyle = '#111'; ctx.fillRect(this.x - w / 2 - 1, yy - 1, w + 2, h + 2); ctx.fillStyle = en ? '#ff3a2a' : '#c05aff'; ctx.fillRect(this.x - w / 2, yy, w * clamp(this.hp / this.maxHp, 0, 1), h); }
  }
  /* rifleman laser sight + charge telegraph — drawn in the glow layer so it shows in the dark */
  drawFx(ctx) {
    if (!this.bk) return;
    const p = this.target || this.game.player;
    if (this.aiming > 0) { const t = 1 - this.aiming / this.bk.gun.aim; ctx.strokeStyle = `rgba(255,40,40,${0.35 + t * 0.6})`; ctx.lineWidth = t > 0.8 ? 2 : 1; ctx.beginPath(); ctx.moveTo(this.x, this.y + 2 * this.scale); ctx.lineTo(p.x, p.y); ctx.stroke(); ctx.fillStyle = 'rgba(255,40,40,0.8)'; ctx.fillRect(p.x - 1, p.y - 1, 3, 3); }
    if (this.charge > 0) { ctx.fillStyle = `rgba(255,80,60,${0.15 + Math.sin(this.game.time * 30) * 0.1})`; ctx.beginPath(); ctx.arc(this.x, this.y, this.r + 6, 0, TAU); ctx.fill(); }
    if (this.leap) { const k = this.leap.phase === 'air' ? Math.min(1, this.leap.t / 0.55) : 0; const lx = this.leap.tx != null ? this.leap.tx : this.x, ly = this.leap.ty != null ? this.leap.ty : this.y; if (this.leap.phase === 'air') { ctx.strokeStyle = `rgba(255,60,60,${0.3 + k * 0.6})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(lx, ly, 72, 0, TAU); ctx.stroke(); } else { ctx.fillStyle = `rgba(255,120,60,${0.15 + Math.sin(this.game.time * 40) * 0.1})`; ctx.beginPath(); ctx.arc(this.x, this.y, this.r + 8, 0, TAU); ctx.fill(); } }
    if (this.slam > 0) { const k = 1 - this.slam / 0.55; ctx.strokeStyle = `rgba(255,60,60,${0.4 + k * 0.5})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(this.x, this.y, 80, 0, TAU); ctx.stroke(); ctx.fillStyle = `rgba(255,60,60,${k * 0.25})`; ctx.fill(); }
  }
}

/* ---------------------------------------------------------------- BULLET */
class Bullet {
  constructor(game, x, y, angle, cfg, dmgMult) {
    this.game = game; this.x = x; this.y = y; this.sx = x; this.sy = y; this.angle = angle;
    this.vx = Math.cos(angle) * cfg.speed; this.vy = Math.sin(angle) * cfg.speed;
    this.damage = cfg.damage * dmgMult; this.range = cfg.range * (cfg.pellets > 1 ? 0.8 + Math.random() * 0.4 : 1);
    this.pierce = cfg.pierce; this.hitSet = new Set(); this.explosive = cfg.explosive || 0; this.dead = false;
    this.rocket = !!cfg.explosive; this.big = cfg.damage > 30; this.smoke = 0; this.flame = !!cfg.flame;
    if (this.flame) { this.range = cfg.range * (0.6 + Math.random() * 0.6); this.vx *= 0.8 + Math.random() * 0.4; this.vy *= 0.8 + Math.random() * 0.4; }
  }
  update(dt) {
    if (this.dead) return;
    const nx = this.x + this.vx * dt, ny = this.y + this.vy * dt, g = this.game;
    if (g.siege && g.house && !g.house.dead) { // the haunted house soaks up bullets before its solid tiles do
      const h = g.map.house; if (Math.abs(nx - h.x) < h.w / 2 + 2 && Math.abs(ny - h.y) < h.h / 2 + 2 && ny > h.y - h.h / 2 + 24) { if (this.explosive) this.impact(); else { g.damageHouse(this.damage, nx, ny); this.dead = true; } return; }
    }
    if (this.game.map.solidAt(nx, ny) || nx < 0 || ny < 0 || nx > this.game.map.pw || ny > this.game.map.ph) { this.impact(); return; }
    this.x = nx; this.y = ny;
    if (this.rocket) { this.smoke -= dt; if (this.smoke <= 0) { this.smoke = 0.02; this.game.particles.push(new Particle(this.x, this.y, (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20, 0.5, '#9a9a9a', 2, 'smoke')); } }
    if (dist(this.sx, this.sy, this.x, this.y) > this.range) { if (this.rocket) this.impact(); else this.dead = true; }
  }
  impact() { this.dead = true; if (this.explosive) this.game.explode(this.x, this.y, this.explosive, this.damage, true); else if (this.venom) this.game.map.splat(this.x, this.y, 5, '#0a0a0e'); else if (!this.flame) this.game.spark(this.x, this.y, 3); }
  draw(ctx) {
    if (this.venom) { const sz = this.size || 3, t = dist(this.sx, this.sy, this.x, this.y) / this.range; ctx.fillStyle = 'rgba(80,20,110,0.35)'; ctx.beginPath(); ctx.arc(this.x, this.y, sz + 2.5, 0, TAU); ctx.fill(); ctx.fillStyle = '#0a0a0e'; ctx.beginPath(); ctx.arc(this.x, this.y, sz, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(this.x - this.vx * 0.012, this.y - this.vy * 0.012, sz * 0.7, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(95,211,90,0.55)'; ctx.fillRect(Math.round(this.x - 1), Math.round(this.y - 1), 1, 1); if (t > 0.85 && Math.random() < 0.1) this.game.map.splat(this.x, this.y, 4, '#0a0a0e'); return; }
    if (this.flame) { const t = dist(this.sx, this.sy, this.x, this.y) / this.range; const sz = 3 + t * 6; ctx.globalAlpha = 0.85 - t * 0.55; ctx.fillStyle = this.pink ? (t < 0.3 ? '#ffd0e8' : t < 0.6 ? '#ff5aa8' : '#c0206a') : t < 0.3 ? '#fff2a0' : t < 0.6 ? '#ffb02a' : '#e0451a'; ctx.fillRect(Math.round(this.x - sz / 2), Math.round(this.y - sz / 2), Math.ceil(sz), Math.ceil(sz)); ctx.globalAlpha = 1; return; }
    if (this.rocket) { Sprites.draw(ctx, 'gun_rocket', this.x, this.y, { angle: this.angle, scale: 0.5, ox: -4, oy: -2 }); ctx.fillStyle = '#ff6a2a'; ctx.beginPath(); ctx.arc(this.x - Math.cos(this.angle) * 5, this.y - Math.sin(this.angle) * 5, 2.5, 0, TAU); ctx.fill(); return; }
    if (this.giant) { ctx.fillStyle = 'rgba(255,200,60,0.35)'; ctx.beginPath(); ctx.arc(this.x, this.y, 7, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff3b0'; ctx.beginPath(); ctx.arc(this.x, this.y, 4, 0, TAU); ctx.fill(); ctx.strokeStyle = '#ffb02a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(this.x, this.y); ctx.lineTo(this.x - this.vx * 0.03, this.y - this.vy * 0.03); ctx.stroke(); return; }
    ctx.strokeStyle = this.hot ? '#ff8a2a' : this.big ? '#fff3b0' : '#f5c518'; ctx.lineWidth = this.hot ? 2.5 : this.big ? 2 : 1.5;
    ctx.beginPath(); ctx.moveTo(this.x, this.y); ctx.lineTo(this.x - this.vx * 0.02, this.y - this.vy * 0.02); ctx.stroke();
  }
}

/* ------------------------------------------------------------------ CLONE */
class Clone {
  constructor(game, owner, x, y, idx) {
    this.game = game; this.owner = owner; this.x = x; this.y = y; this.r = 6; this.idx = idx; this.dead = false;
    this.maxHp = owner.char.squad.hp; this.hp = this.maxHp; this.angle = 0; this.flip = false; this.walk = Math.random() * 10; this.moving = false;
    this.fireTimer = 0.3 + Math.random() * 0.3; this.invuln = 0; this.hurtFlash = 0; this.sprite = owner.sprite; this.spawnT = 0; this.shadow = 1;
  }
  hurt(dmg, fromX, fromY, invuln = 0.35) {
    if (this.invuln > 0 || this.dead) return;
    this.hp -= dmg; this.invuln = invuln; this.hurtFlash = 0.2; this.game.blood(this.x, this.y, 3, '#7fd35a');
    if (fromX != null) { const a = Math.atan2(this.y - fromY, this.x - fromX); const p = this.game.map.resolve(this.x + Math.cos(a) * 5, this.y + Math.sin(a) * 5, this.r); this.x = p.x; this.y = p.y; }
    if (this.hp <= 0) this.vanish(true);
  }
  vanish(killed) {
    if (this.dead) return; this.dead = true;
    for (let k = 0; k < 10; k++) this.game.particles.push(new Particle(this.x, this.y, (Math.random() - 0.5) * 50, -10 - Math.random() * 40, 0.6, killed ? '#4a5d3a' : '#8bd35a', 2, 'smoke'));
    if (killed) { this.game.floatText(this.x, this.y - 12, 'CLONE DOWN', '#9aa3b5'); Audio8.play('hurt'); }
  }
  update(dt) {
    if (this.dead) return;
    const g = this.game, o = this.owner, sq = o.char.squad; this.spawnT += dt; this.invuln -= dt; this.hurtFlash -= dt; this.fireTimer -= dt;
    // formation: a ring around the heavy; hustle back when out of place
    const fa = this.idx / sq.count * TAU + g.time * 0.25, tx = o.x + Math.cos(fa) * 38, ty = o.y + Math.sin(fa) * 38;
    const dd = dist(this.x, this.y, tx, ty); this.moving = dd > 8;
    if (this.moving) { const sp = Math.min(o.baseSpeed * 1.4, dd * 4); const a = Math.atan2(ty - this.y, tx - this.x); this.x += Math.cos(a) * sp * dt; let p = g.map.resolve(this.x, this.y, this.r); this.x = p.x; this.y += Math.sin(a) * sp * dt; p = g.map.resolve(this.x, this.y, this.r); this.x = p.x; this.y = p.y; this.walk += dt * 10; }
    // pick a zombie to shoot: nearest with line of sight
    let best = null, bd = 1e9;
    for (const z of g.near(this.x, this.y).concat(g.zombies.length < 60 ? g.zombies : [])) { if (z.dead) continue; const d = dist(this.x, this.y, z.x, z.y); if (d < bd && d < sq.gun.range) { bd = d; best = z; } }
    if (!best) { let bd2 = 1e9; for (const z of g.zombies) { const d = dist(this.x, this.y, z.x, z.y); if (d < bd2 && d < sq.gun.range) { bd2 = d; best = z; } } }
    if (best) { this.angle = Math.atan2(best.y - this.y, best.x - this.x); this.flip = Math.cos(this.angle) < 0;
      if (this.fireTimer <= 0 && g.map.los(this.x, this.y, best.x, best.y)) { this.fireTimer = sq.gun.interval; const gx = this.x + Math.cos(this.angle) * 12, gy = this.y + 2 + Math.sin(this.angle) * 12; const b = new Bullet(g, gx, gy, this.angle + (Math.random() - 0.5) * sq.gun.spread * 2, sq.gun, o.damageMult * 0.8); g.bullets.push(b); if (Math.random() < 0.25) Audio8.play('smg'); if (Math.random() < 0.3) g.muzzle(gx, gy, this.angle, 1); } }
    else { this.angle = o.angle; this.flip = o.flip; }
  }
  draw(ctx) {
    const bob = this.moving ? Math.sin(this.walk) * 1.2 : 0, fade = Math.min(1, this.spawnT * 3);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(this.x, this.y + 7, 6, 3, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.85 * fade;
    Sprites.draw(ctx, this.hurtFlash > 0 ? 'player_hurt' : this.sprite, this.x, this.y + bob, { flip: this.flip, ox: -8, oy: -9 });
    ctx.globalAlpha = 0.35 * fade; ctx.save(); ctx.translate(Math.round(this.x), Math.round(this.y + bob)); if (this.flip) ctx.scale(-1, 1); ctx.drawImage(Sprites.tintOf(this.sprite, '#8bd35a'), -8, -9, 16, 16); ctx.restore(); // green holo tint marks them as clones
    ctx.globalAlpha = 0.85 * fade;
    ctx.save(); ctx.translate(this.x + Math.cos(this.angle) * 6, this.y + 2 + Math.sin(this.angle) * 6 + bob); ctx.rotate(this.angle); if (this.flip) ctx.scale(1, -1); ctx.drawImage(Sprites.get('gun_smg'), -3, -4, 16, 8); ctx.restore();
    ctx.globalAlpha = 1;
    if (this.hp < this.maxHp) { ctx.fillStyle = '#111'; ctx.fillRect(this.x - 7, this.y - 14, 14, 3); ctx.fillStyle = '#8bd35a'; ctx.fillRect(this.x - 6, this.y - 13, 12 * clamp(this.hp / this.maxHp, 0, 1), 1); }
  }
}

/* ----------------------------------------------------------- FROG CLONE */
/* Frogepepe's froglings: small frogs that hop straight onto the nearest zombie, rip its head off on landing and bounce to the next */
class FrogClone {
  constructor(game, owner, x, y, idx) {
    this.game = game; this.owner = owner; this.x = x; this.y = y; this.r = 5; this.idx = idx; this.dead = false; this.frogling = true;
    const ar = owner.fr.army; this.maxHp = ar.hp; this.hp = this.maxHp; this.angle = 0; this.flip = false; this.walk = Math.random() * 10; this.moving = false;
    this.invuln = 0; this.hurtFlash = 0; this.spawnT = 0; this.hop = null; this.hopCd = 0.1 + idx * 0.03; this.height = 0; this.kills = 0;
  }
  hurt(dmg, fromX, fromY, invuln = 0.3) {
    if (this.invuln > 0 || this.dead || this.hop) return;
    this.hp -= dmg; this.invuln = invuln; this.hurtFlash = 0.2; this.game.blood(this.x, this.y, 3, '#7fd35a');
    if (this.hp <= 0) this.vanish(true);
  }
  vanish(killed) {
    if (this.dead) return; this.dead = true;
    for (let k = 0; k < 8; k++) this.game.particles.push(new Particle(this.x, this.y - this.height, (Math.random() - 0.5) * 50, -10 - Math.random() * 40, 0.5, killed ? '#4a5d3a' : '#9ccf72', 2, 'smoke'));
    if (killed) Audio8.play('hurt');
  }
  pickTarget() {
    const g = this.game, ar = this.owner.fr.army; let best = null, bd = 1e9;
    for (const z of g.zombies) { if (z.dead || z.captured > 0) continue; let d = dist(this.x, this.y, z.x, z.y); if (z.claimed && z.claimed !== this && g.time - z.claimedAt < 0.4) d += 60; if (d < bd && d < ar.seek) { bd = d; best = z; } } // spread out: a zombie another frogling just jumped at costs extra
    return best;
  }
  update(dt) {
    if (this.dead) return;
    const g = this.game, o = this.owner, ar = o.fr.army; this.spawnT += dt; this.invuln -= dt; this.hurtFlash -= dt; this.hopCd -= dt; this.walk += dt * 8;
    if (this.hop) { // airborne
      const H = this.hop; H.t += dt; const k = Math.min(1, H.t / H.dur); this.height = Math.sin(k * Math.PI) * 26;
      if (H.target && !H.target.dead) { H.tx = H.target.x; H.ty = H.target.y; } // home in mid-air
      const pos = g.map.resolve(H.sx + (H.tx - H.sx) * k, H.sy + (H.ty - H.sy) * k, this.r); this.x = pos.x; this.y = pos.y; this.moving = true;
      if (k >= 1) {
        this.hop = null; this.height = 0; this.hopCd = 0.12; const z = H.target;
        if (z && !z.dead && dist(this.x, this.y, z.x, z.y) < z.r + 14) this.bite(z);
      }
      return;
    }
    this.moving = false;
    if (this.hopCd > 0) return;
    const z = this.pickTarget();
    if (z) { // hop straight at it, in bounds of one hop; several hops for far ones
      const d = dist(this.x, this.y, z.x, z.y), L = Math.min(ar.hop, d), a = Math.atan2(z.y - this.y, z.x - this.x);
      this.angle = a; this.flip = Math.cos(a) < 0; z.claimed = this; z.claimedAt = g.time;
      this.hop = { t: 0, dur: ar.hopDur * (0.6 + 0.4 * L / ar.hop), sx: this.x, sy: this.y, tx: this.x + Math.cos(a) * L, ty: this.y + Math.sin(a) * L, target: d <= ar.hop + 10 ? z : null };
    } else { // nothing to hunt: bounce around the big frog
      const fa = this.idx / ar.count * TAU + g.time * 0.5, tx = o.x + Math.cos(fa) * 44, ty = o.y + Math.sin(fa) * 44, d = dist(this.x, this.y, tx, ty);
      if (d > 14) { const L = Math.min(ar.hop, d), a = Math.atan2(ty - this.y, tx - this.x); this.angle = a; this.flip = Math.cos(a) < 0; this.hop = { t: 0, dur: ar.hopDur, sx: this.x, sy: this.y, tx: this.x + Math.cos(a) * L, ty: this.y + Math.sin(a) * L, target: null }; }
      else this.hopCd = 0.3;
    }
  }
  bite(z) { // the head comes off: non-bosses die outright, bosses take a chunk
    const g = this.game, o = this.owner, ar = o.fr.army, boss = z.cfg.boss, dmg = (boss ? ar.bossDamage : Math.max(ar.damage, z.hp + 1)) * o.damageMult;
    z.takeDamage(dmg, Math.atan2(z.y - this.y, z.x - this.x), undefined, boss ? 1 : 0.5);
    const hx = z.x, hy = z.y - 8 * (z.scale || 1); // the head flying off
    g.particles.push(new Particle(hx, hy, (Math.random() - 0.5) * 120, -120 - Math.random() * 60, 0.7, boss ? '#c9cfdb' : '#7fa35a', 4, 'blood'));
    for (let k = 0; k < 8; k++) g.particles.push(new Particle(hx, hy, (Math.random() - 0.5) * 90, -30 - Math.random() * 70, 0.5, '#b3221a', 2, 'blood'));
    g.blood(z.x, z.y, 8, '#b3221a'); g.map.splat(z.x, z.y, 6, '#4a0e0a'); Audio8.play('thud'); if (z.dead) { this.kills++; Audio8.play('zdie'); }
    g.floatText(z.x, hy - 10, z.dead ? 'HEAD OFF' : 'CHOMP', '#9ccf72');
  }
  draw(ctx) {
    const ar = this.owner.fr.army, S = ar.scale, h = this.height, fade = Math.min(1, this.spawnT * 4), sq = this.hop ? 1 + Math.sin(Math.min(1, this.hop.t / this.hop.dur) * Math.PI) * 0.2 : 1;
    ctx.fillStyle = `rgba(0,0,0,${0.3 - h / 150})`; ctx.beginPath(); ctx.ellipse(this.x, this.y + 4, 8 - h * 0.1, 3 - h * 0.04, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = fade;
    ctx.save(); ctx.translate(Math.round(this.x), Math.round(this.y - h + 4)); ctx.scale(2 - sq, sq); if (this.flip) ctx.scale(-1, 1);
    ctx.drawImage(Sprites.get('frog'), -12 * S, -20 * S, 24 * S, 24 * S);
    if (this.hurtFlash > 0) { ctx.globalAlpha = 0.6 * fade; ctx.drawImage(Sprites.tintOf('frog', '#ff8a7a'), -12 * S, -20 * S, 24 * S, 24 * S); }
    ctx.restore(); ctx.globalAlpha = 1;
    if (this.hp < this.maxHp) { ctx.fillStyle = '#111'; ctx.fillRect(this.x - 6, this.y - 18, 12, 3); ctx.fillStyle = '#8bd35a'; ctx.fillRect(this.x - 5, this.y - 17, 10 * clamp(this.hp / this.maxHp, 0, 1), 1); }
  }
}

/* ------------------------------------------------------------- ALLY BOSS */
/* a boss the symbiote took: black, white-eyed, and on our side for good */
class AllyBoss {
  constructor(game, owner, boss) {
    this.game = game; this.owner = owner; this.x = boss.x; this.y = boss.y; this.r = boss.r; this.kind = boss.kind; this.bk = boss.bk; this.scale = boss.scale;
    this.sprite = boss.sprite || boss.cfg.sprite; this.maxHp = Math.round(boss.maxHp * 0.9); this.hp = this.maxHp; this.dead = false; this.name = 'VENOM ' + this.bk.name;
    this.angle = 0; this.flip = false; this.walk = 0; this.moving = false; this.fireTimer = 1; this.attackCd = 0.5; this.hurtFlash = 0; this.invuln = 0; this.spawnT = 0; this.speed = this.bk.speed * 1.3; this.dmgMult = 1 + game.wave * 0.05;
    // fields the procedural boss drawings (Ravager / Kraken) read
    this.venomSkin = true; this.hit = 0; this.enraged = false; this.height = 0; this.leap = null; this.slam = 0; this.charge = 0; this.aiming = 0; this.burstLeft = 0; this.spiral = false; this.gunSide = 0; this.muzzle = [0, 0]; this.target = null; this.fuse = -1; this.rush = null; this.ember = 0; this.cracks = boss.cracks || []; this.rings = []; this.bat = null; this.drum = null; this.swing = 0;
  }
  gunTip(side) { return Zombie.prototype.gunTip.call(this, side); }
  hurt(dmg, fromX, fromY, invuln = 0.3) {
    if (this.invuln > 0 || this.dead) return; this.hp -= dmg; this.invuln = invuln; this.hurtFlash = 0.15; this.game.blood(this.x, this.y, 3, '#0a0a0e');
    if (this.hp <= 0) { this.dead = true; for (let i = 0; i < 16; i++) this.game.particles.push(new Particle(this.x, this.y, (Math.random() - 0.5) * 80, -20 - Math.random() * 40, 0.7, '#0a0a0e', 3, 'blood')); this.game.floatText(this.x, this.y - 20, this.name + ' FELL', '#9aa3b5'); Audio8.play('zdie'); }
  }
  /* what to go after: the nearest zombie, else the haunted house / cannons on the siege map, else stick with the boss */
  pickTarget() {
    const g = this.game; let best = null, bd = 1e9;
    for (const z of g.zombies) { if (z.dead || z.captured > 0) continue; const d = dist(this.x, this.y, z.x, z.y); if (d < bd && d < 520) { bd = d; best = { x: z.x, y: z.y, r: z.r, kind: 'zombie', ref: z, d }; } }
    if (g.siege) { // the house and its cannons compete on distance too — whatever is closest gets hit
      for (const t of g.turrets) { if (t.dead) continue; const d = dist(this.x, this.y, t.x, t.y); if (d < bd && d < 600) { bd = d; best = { x: t.x, y: t.y, r: t.r, kind: 'turret', ref: t, d }; } }
      if (g.house && !g.house.dead) { const h = g.map.house; const ex = Math.max(Math.abs(this.x - h.x) - h.w / 2, 0), ey = Math.max(Math.abs(this.y - h.y) - h.h / 2, 0); const d = Math.hypot(ex, ey) + 20; if (d < bd || !best) { bd = d; best = { x: h.x, y: h.y + h.h / 2 - 8, r: 12, kind: 'house', ref: h, d, edge: d }; } }
    }
    return best;
  }
  update(dt) {
    if (this.dead) return; const g = this.game, o = this.owner; this.spawnT += dt; this.invuln -= dt; this.hurtFlash -= dt; this.fireTimer -= dt; this.attackCd -= dt;
    const tg = this.pickTarget();
    let tx, ty; if (tg) { tx = tg.x; ty = tg.y; } else { tx = o.x; ty = o.y; }
    const dd = dist(this.x, this.y, tx, ty), stop = tg ? (tg.kind === 'house' ? this.r + 14 : this.r + tg.r + 6) : 70; this.moving = dd > stop;
    if (this.moving) { const a = Math.atan2(ty - this.y, tx - this.x); const p = g.map.resolve(this.x + Math.cos(a) * this.speed * dt, this.y + Math.sin(a) * this.speed * dt, Math.min(this.r, 7)); this.x = p.x; this.y = p.y; this.walk += dt * 6; }
    this.target = tg ? tg : o; this.hit -= dt; this.muzzle[0] -= dt; this.muzzle[1] -= dt;
    if (tg) {
      this.angle = Math.atan2(ty - this.y, tx - this.x); this.flip = Math.cos(this.angle) < 0;
      const melee = this.bk.damage * 3 * this.dmgMult;
      if (this.attackCd <= 0) {
        if (tg.kind === 'zombie' && dd <= stop + 2) { this.attackCd = 0.7; tg.ref.takeDamage(melee, this.angle, undefined, 3); g.blood(tg.x, tg.y, 4, '#b3221a'); Audio8.play('thud'); }
        else if (tg.kind === 'turret' && dd <= stop + 4) { this.attackCd = 0.7; g.damageTurret(tg.ref, melee, tg.x, tg.y); Audio8.play('thud'); }
        else if (tg.kind === 'house') { const h = tg.ref; const ex = Math.max(Math.abs(this.x - h.x) - h.w / 2, 0), ey = Math.max(Math.abs(this.y - h.y) - h.h / 2, 0); if (Math.hypot(ex, ey) < this.r + 16) { this.attackCd = 0.7; g.damageHouse(melee, this.x + Math.cos(this.angle) * 12, this.y + Math.sin(this.angle) * 12); Audio8.play('thud'); g.shake(1); } }
      }
      const gun = this.bk.gun;
      if (gun && this.fireTimer <= 0 && dd < gun.range * 0.9 && dd > 26 && (tg.kind !== 'zombie' || g.map.los(this.x, this.y, tx, ty))) {
        this.fireTimer = Math.max(0.25, (gun.cd || 1) * (gun.burst ? 0.1 : 0.5));
        const cfg = { damage: gun.dmg * 3 * this.dmgMult, speed: gun.speed, range: gun.range, pellets: gun.pellets || 1, spread: gun.spread || 0.05, pierce: 0, kick: 0, explosive: gun.explosive ? Math.min(gun.explosive, 36) : 0, flame: !!gun.flame };
        const gx = this.x + Math.cos(this.angle) * 10 * this.scale, gy = this.y + Math.sin(this.angle) * 10 * this.scale;
        if (this.bk.ravager || this.bk.kraken) { this.gunSide = 1 - this.gunSide; this.muzzle[this.gunSide] = 0.15; }
        for (let i = 0; i < cfg.pellets; i++) { const b = new Bullet(g, gx, gy, this.angle + (Math.random() - 0.5) * cfg.spread * 2, cfg, 1); b.hot = true; b.ally = true; g.bullets.push(b); }
        if (Math.random() < 0.5) Audio8.play(gun.explosive ? 'rocket' : gun.pellets ? 'shotgun' : 'smg');
      }
    } else { this.angle = o.angle; this.flip = o.flip; }
  }
  draw(ctx) {
    const s = this.scale, bob = this.moving ? Math.sin(this.walk) * 1.2 : 0;
    if (this.bk.sahur) { this.hit = this.hurtFlash > 0 ? 0.1 : 0; Zombie.prototype.drawSahur.call(this, ctx); ctx.fillStyle = 'rgba(95,211,90,0.25)'; ctx.fillRect(this.x - 30, this.y - 60, 60, 90); return; }
    if (this.bk.bona) { this.hit = this.hurtFlash > 0 ? 0.1 : 0; Zombie.prototype.drawBona.call(this, ctx); ctx.fillStyle = 'rgba(95,211,90,0.25)'; ctx.fillRect(this.x - 40, this.y - 60, 80, 90); return; } // Bona in venom green haze; the label is its own
    if (this.bk.ravager || this.bk.kraken) { // keep the boss's real body, just in symbiote black
      this.hit = this.hurtFlash > 0 ? 0.1 : 0;
      if (this.bk.ravager) Zombie.prototype.drawRavager.call(this, ctx); else Zombie.prototype.drawKraken.call(this, ctx);
      const labelY = this.bk.ravager ? this.y - 62 - this.height : this.y - 56;
      ctx.font = '6px "Press Start 2P", monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#000'; ctx.fillText(this.name, this.x + 1, labelY + 1); ctx.fillStyle = '#5fd35a'; ctx.fillText(this.name, this.x, labelY); ctx.textAlign = 'left';
      const w = 60, yy = labelY + 8; ctx.fillStyle = '#111'; ctx.fillRect(this.x - w / 2 - 1, yy - 1, w + 2, 5); ctx.fillStyle = '#5fd35a'; ctx.fillRect(this.x - w / 2, yy, w * clamp(this.hp / this.maxHp, 0, 1), 3);
      return;
    }
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(this.x, this.y + 7 * s, 6 * s, 3 * s, 0, 0, TAU); ctx.fill();
    Sprites.draw(ctx, this.sprite, this.x, this.y + bob, { flip: this.flip, scale: s, ox: -8 * s, oy: -9 * s });
    ctx.globalAlpha = 0.82; ctx.save(); ctx.translate(Math.round(this.x), Math.round(this.y + bob)); if (this.flip) ctx.scale(-1, 1); ctx.drawImage(Sprites.tintOf(this.sprite, this.hurtFlash > 0 ? '#3a1a3a' : '#0a0a0e'), -8 * s, -9 * s, 16 * s, 16 * s); ctx.restore(); ctx.globalAlpha = 1;
    ctx.fillStyle = '#f4f2ea'; ctx.fillRect(Math.round(this.x - 2.5 * s), Math.round(this.y - 6 * s + bob), Math.ceil(1.5 * s), Math.ceil(s)); ctx.fillRect(Math.round(this.x + 1 * s), Math.round(this.y - 6 * s + bob), Math.ceil(1.5 * s), Math.ceil(s)); // white eyes
    ctx.fillRect(Math.round(this.x - 0.5 * s), Math.round(this.y - 1 * s + bob), Math.ceil(s), Math.ceil(3 * s)); ctx.fillRect(Math.round(this.x - 2 * s), Math.round(this.y + bob), Math.ceil(4 * s), Math.ceil(s)); // spider emblem
    const gunSprite = this.bk.weapon ? (WEAPONS[this.bk.weapon] ? WEAPONS[this.bk.weapon].sprite : 'gun_cannon') : null;
    if (gunSprite && Sprites.get(gunSprite)) { const a = this.angle, gs = s * 0.9; ctx.save(); ctx.translate(this.x + Math.cos(a) * 4 * s, this.y + 1 * s + Math.sin(a) * 4 * s + bob); ctx.rotate(a); if (Math.cos(a) < 0) ctx.scale(1, -1); ctx.drawImage(Sprites.tintOf(gunSprite, '#141418'), -2 * gs, -4 * gs, 16 * gs, 8 * gs); ctx.restore(); }
    ctx.font = '6px "Press Start 2P", monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#000'; ctx.fillText(this.name, this.x + 1, this.y - 14 * s + 1); ctx.fillStyle = '#5fd35a'; ctx.fillText(this.name, this.x, this.y - 14 * s); ctx.textAlign = 'left';
    const w = 30, yy = this.y - 12 * s; ctx.fillStyle = '#111'; ctx.fillRect(this.x - w / 2 - 1, yy - 1, w + 2, 4); ctx.fillStyle = '#5fd35a'; ctx.fillRect(this.x - w / 2, yy, w * clamp(this.hp / this.maxHp, 0, 1), 2);
  }
}

/* ---------------------------------------------------------- ENEMY BULLET */
class EnemyBullet {
  constructor(game, x, y, angle, gun, owner) {
    this.game = game; this.x = x; this.y = y; this.sx = x; this.sy = y; this.angle = angle; this.owner = owner;
    const sp = gun.speed * (gun.flame ? 0.8 + Math.random() * 0.4 : 1);
    this.vx = Math.cos(angle) * sp; this.vy = Math.sin(angle) * sp;
    this.damage = Math.round(gun.dmg * (owner.dmgMult || 1)); this.range = gun.range * (gun.flame ? 0.6 + Math.random() * 0.6 : gun.pellets ? 0.8 + Math.random() * 0.4 : 1);
    this.explosive = gun.explosive || 0; this.flame = !!gun.flame; this.rocket = !!gun.explosive; this.cannon = !!gun.cannon; this.dead = false; this.smoke = 0;
  }
  update(dt) {
    if (this.dead) return;
    const nx = this.x + this.vx * dt, ny = this.y + this.vy * dt, map = this.game.map;
    if (map.solidAt(nx, ny) || nx < 0 || ny < 0 || nx > map.pw || ny > map.ph) { this.impact(); return; }
    this.x = nx; this.y = ny;
    if (this.rocket) { this.smoke -= dt; if (this.smoke <= 0) { this.smoke = 0.03; this.game.particles.push(new Particle(this.x, this.y, (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20, 0.5, '#9a9a9a', 2, 'smoke')); } }
    for (const p of this.game.targets()) {
      if (p.dead || dist(this.x, this.y, p.x, p.y) >= p.r + 3) continue;
      if (this.explosive) { this.impact(); return; }
      p.hurt(this.damage, this.x - this.vx * 0.05, this.y - this.vy * 0.05, this.flame ? 0.2 : 0.28); this.dead = true; if (!this.flame) this.game.spark(this.x, this.y, 2); return;
    }
    if (dist(this.sx, this.sy, this.x, this.y) > this.range) { if (this.rocket) this.impact(); else this.dead = true; }
  }
  impact() { this.dead = true; if (this.explosive) this.game.explode(this.x, this.y, this.explosive, this.damage, false, this.owner); else if (!this.flame) this.game.spark(this.x, this.y, 2); }
  draw(ctx) {
    if (this.venom) { const sz = this.size || 3, t = dist(this.sx, this.sy, this.x, this.y) / this.range; ctx.fillStyle = 'rgba(80,20,110,0.35)'; ctx.beginPath(); ctx.arc(this.x, this.y, sz + 2.5, 0, TAU); ctx.fill(); ctx.fillStyle = '#0a0a0e'; ctx.beginPath(); ctx.arc(this.x, this.y, sz, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(this.x - this.vx * 0.012, this.y - this.vy * 0.012, sz * 0.7, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(95,211,90,0.55)'; ctx.fillRect(Math.round(this.x - 1), Math.round(this.y - 1), 1, 1); if (t > 0.85 && Math.random() < 0.1) this.game.map.splat(this.x, this.y, 4, '#0a0a0e'); return; }
    if (this.flame) { const t = dist(this.sx, this.sy, this.x, this.y) / this.range; const sz = 3 + t * 6; ctx.globalAlpha = 0.85 - t * 0.55; ctx.fillStyle = t < 0.3 ? '#fff2a0' : t < 0.6 ? '#ffb02a' : '#e0451a'; ctx.fillRect(Math.round(this.x - sz / 2), Math.round(this.y - sz / 2), Math.ceil(sz), Math.ceil(sz)); ctx.globalAlpha = 1; return; }
    if (this.cannon) { const pulse = 4 + Math.sin(this.game.time * 40) * 0.8; ctx.fillStyle = 'rgba(255,120,30,0.35)'; ctx.beginPath(); ctx.arc(this.x, this.y, pulse + 4, 0, TAU); ctx.fill(); ctx.fillStyle = '#ffb02a'; ctx.beginPath(); ctx.arc(this.x, this.y, pulse, 0, TAU); ctx.fill(); ctx.fillStyle = '#3a0d0e'; ctx.beginPath(); ctx.arc(this.x, this.y, pulse - 2, 0, TAU); ctx.fill(); ctx.fillStyle = '#ff5a2a'; ctx.beginPath(); ctx.arc(this.x, this.y, 1.5, 0, TAU); ctx.fill(); return; }
    if (this.rocket) { Sprites.draw(ctx, 'gun_rocket', this.x, this.y, { angle: this.angle, scale: 0.5, ox: -4, oy: -2 }); ctx.fillStyle = '#ff6a2a'; ctx.beginPath(); ctx.arc(this.x - Math.cos(this.angle) * 5, this.y - Math.sin(this.angle) * 5, 2.5, 0, TAU); ctx.fill(); return; }
    ctx.strokeStyle = '#ff5a4a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(this.x, this.y); ctx.lineTo(this.x - this.vx * 0.025, this.y - this.vy * 0.025); ctx.stroke();
    ctx.fillStyle = '#ffd0c0'; ctx.fillRect(Math.round(this.x) - 1, Math.round(this.y) - 1, 2, 2);
  }
}

/* ---------------------------------------------------------------- PICKUP */
class Pickup {
  constructor(game, type, x, y, data) {
    this.game = game; this.type = type; this.x = x; this.y = y; this.data = data; this.life = type === 'crate' ? 999 : 28; this.bob = Math.random() * 6; this.dead = false;
    this.vx = (Math.random() - 0.5) * 60; this.vy = (Math.random() - 0.5) * 60;
  }
  update(dt, player) {
    this.life -= dt; this.bob += dt * 4;
    this.x += this.vx * dt; this.y += this.vy * dt; this.vx *= 0.9; this.vy *= 0.9;
    const p = this.game.map.resolve(this.x, this.y, 4); this.x = p.x; this.y = p.y;
    const d = dist(this.x, this.y, player.x, player.y);
    if (d < 46 && this.type !== 'crate') { const a = Math.atan2(player.y - this.y, player.x - this.x); const sp = 90 + (46 - d) * 5; this.x += Math.cos(a) * sp * dt; this.y += Math.sin(a) * sp * dt; }
    if (d < 10) { this.dead = true; this.game.collect(this); }
    if (this.life <= 0) this.dead = true;
  }
  draw(ctx) {
    if (this.life < 5 && Math.floor(this.life * 8) % 2 === 0) return;
    const bob = Math.sin(this.bob) * 1.5;
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(this.x, this.y + 6, 5, 2, 0, 0, TAU); ctx.fill();
    Sprites.draw(ctx, PICKUPS[this.type].sprite, this.x, this.y + bob - 2, { scale: this.type === 'crate' ? 1.2 : 1 });
    if (this.type === 'crate') { const img = Sprites.get(WEAPONS[this.data].sprite); ctx.drawImage(img, this.x - 8, this.y - 20 + bob, 16, 8); }
  }
}

/* -------------------------------------------------------------- PARTICLE */
class Particle {
  constructor(x, y, vx, vy, life, color, size, type = 'dot', text) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy; this.life = life; this.max = life; this.color = color; this.size = size; this.type = type; this.text = text; this.dead = false;
  }
  update(dt) {
    this.life -= dt; if (this.life <= 0) { this.dead = true; return; }
    this.x += this.vx * dt; this.y += this.vy * dt;
    if (this.type === 'blood' || this.type === 'shell') { this.vy += 220 * dt; this.vx *= 0.96; }
    if (this.type === 'smoke' || this.type === 'fire') { this.vy -= 30 * dt; this.vx *= 0.97; }
    if (this.type === 'text') { this.vy *= 0.92; }
  }
  draw(ctx) {
    const t = this.life / this.max;
    if (this.type === 'text') { ctx.globalAlpha = Math.min(1, t * 2); ctx.fillStyle = '#000'; ctx.font = 'bold 8px monospace'; ctx.fillText(this.text, this.x + 1, this.y + 1); ctx.fillStyle = this.color; ctx.fillText(this.text, this.x, this.y); ctx.globalAlpha = 1; return; }
    ctx.globalAlpha = this.type === 'smoke' ? t * 0.5 : this.type === 'fire' ? t : 1;
    ctx.fillStyle = this.type === 'fire' ? (t > 0.5 ? '#ffd23a' : t > 0.25 ? '#ff6a2a' : '#7a2a10') : this.color;
    const s = this.type === 'smoke' ? this.size * (2 - t) : this.type === 'fire' ? this.size * t : this.size;
    ctx.fillRect(Math.round(this.x - s / 2), Math.round(this.y - s / 2), Math.ceil(s), Math.ceil(s));
    ctx.globalAlpha = 1;
  }
}
