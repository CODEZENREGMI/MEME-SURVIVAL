/* ==========================================================================
   ui.js — title, loadout setup (survivor / weapon / map), overlays, settings
   ========================================================================== */
const SAVE_KEY = 'zombie-survival-save-v2';
const $ = s => document.querySelector(s);
/* the same yellow pixel coin you pick up in-game, as an inline <img> */
let _coinSrc = null;
const coinImg = () => { if (!_coinSrc) _coinSrc = Sprites.get('pickup_coin').toDataURL(); return `<img class="coin" src="${_coinSrc}" alt="coins">`; };
const $$ = s => Array.from(document.querySelectorAll(s));

class UI {
  constructor() {
    this.save = this.load();
    this.game = null; this.bannerTimer = 0;
    this.step = 0; this.sel = null;
  }
  load() {
    const def = { highScore: 0, bestWave: 0, runs: 0, loadout: { char: 'rookie', weapons: ['shotgun', 'smg', 'rifle'], map: 'city' }, settings: { sfx: 0.7, music: 0.4, shake: true, blood: true, fps: false, aimLine: true, minimap: true } };
    try {
      const s = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (s && typeof s === 'object') {
        const out = Object.assign(def, s, { settings: Object.assign(def.settings, s.settings || {}), loadout: Object.assign(def.loadout, s.loadout || {}) });
        // sanitise: only known ids / sane numbers survive
        const lo = out.loadout;
        if (!CHARACTERS[lo.char]) lo.char = 'rookie';
        if (!MAPS[lo.map]) lo.map = 'city';
        lo.weapons = (Array.isArray(lo.weapons) ? lo.weapons : []).filter(w => PICKABLE_WEAPONS.includes(w)).slice(0, LOADOUT_SIZE);
        if (!lo.weapons.length) lo.weapons = ['shotgun', 'smg', 'rifle'];
        ['highScore', 'bestWave', 'runs'].forEach(k => { out[k] = Number.isFinite(+out[k]) ? Math.max(0, Math.floor(+out[k])) : 0; });
        ['sfx', 'music'].forEach(k => { out.settings[k] = Number.isFinite(+out.settings[k]) ? Math.min(1, Math.max(0, +out.settings[k])) : def.settings[k]; });
        return out;
      }
    } catch (e) { }
    return def;
  }
  saveGame() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.save)); } catch (e) { } }

  init(game) {
    this.game = game;
    document.addEventListener('click', e => {
      const b = e.target.closest('[data-action]'); if (!b) return;
      Audio8.init(); Audio8.resume(); Audio8.play('click');
      this.action(b.dataset.action);
    });
    $$('[data-close]').forEach(b => b.addEventListener('click', () => b.closest('.modal').classList.remove('show')));
    $$('.modal').forEach(m => m.addEventListener('click', e => { if (e.target === m) m.classList.remove('show'); }));
    // level-up cards
    const cards = $('#levelupCards'); cards.innerHTML = '';
    Object.entries(UPGRADES).forEach(([id, u], i) => {
      const d = document.createElement('button'); d.className = 'upgrade-card'; d.dataset.upgrade = id;
      d.innerHTML = `<canvas width="12" height="12"></canvas><span>${u.name}</span><small>${u.desc}</small><span class="lvl"></span><kbd>[${i + 1}]</kbd>`;
      Sprites.renderTo(d.querySelector('canvas'), u.icon); d.addEventListener('click', () => this.game.chooseUpgrade(id)); cards.appendChild(d);
    });
    // setup wizard
    $('#setupBack').addEventListener('click', () => { Audio8.play('click'); this.stepTo(this.step - 1); });
    $('#setupNext').addEventListener('click', () => { Audio8.play('click'); this.stepTo(this.step + 1); });
    window.addEventListener('keydown', e => {
      if (!$('#ov-setup').classList.contains('show')) return;
      if (this.step === 1) {
        const i = PICKABLE_WEAPONS.indexOf(this.cursor); if (e.key === 'ArrowRight' || e.key === 'd') this.setCursor(PICKABLE_WEAPONS[(i + 1) % PICKABLE_WEAPONS.length]);
        if (e.key === 'ArrowLeft' || e.key === 'a') this.setCursor(PICKABLE_WEAPONS[(i - 1 + PICKABLE_WEAPONS.length) % PICKABLE_WEAPONS.length]);
        if (e.key === ' ') { e.preventDefault(); this.toggleWeapon(this.cursor); }
      } else {
        const list = [CHARACTER_ORDER, null, MAP_ORDER][this.step], key = ['char', null, 'map'][this.step];
        const i = list.indexOf(this.sel[key]);
        if (e.key === 'ArrowRight' || e.key === 'd') this.select(key, list[(i + 1) % list.length]);
        if (e.key === 'ArrowLeft' || e.key === 'a') this.select(key, list[(i - 1 + list.length) % list.length]);
      }
      if (e.key === 'Enter') this.stepTo(this.step + 1);
      if (e.key === 'Escape') this.stepTo(this.step - 1);
    });
    this.initSettings();
    this.initAdmin();
    this.refreshTitle();
  }
  /* ------------------------------------------------------- admin panel (Ctrl+Shift+A) */
  initAdmin() {
    const g = () => this.game, m = $('#modal-admin');
    window.addEventListener('keydown', e => {
      if (e.target && e.target.tagName === 'INPUT' && e.key !== 'Escape') return;
      const isA = e.code === 'KeyA' || (e.key || '').toLowerCase() === 'a';
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && isA) { e.preventDefault(); e.stopPropagation(); this.toggleAdmin(); }   // Ctrl+Shift+A or Cmd+Shift+A
      else if (e.key === '`' || e.code === 'Backquote') { e.preventDefault(); this.toggleAdmin(); }                          // backtick fallback
    }, true);
    const mark = () => { g().admin = true; };
    const inRun = () => { const s = g().state; return s !== 'menu' && s !== 'gameover'; };
    $('#admGo').addEventListener('click', () => { const w = Math.max(1, Math.min(999, +$('#admWave').value || 1)); mark(); m.classList.remove('show'); g().adminJump(w); });
    $$('#modal-admin [data-wave]').forEach(b => b.addEventListener('click', () => { $('#admWave').value = b.dataset.wave; mark(); m.classList.remove('show'); g().adminJump(+b.dataset.wave); }));
    const bl = $('#admBosses'); BOSS_ORDER.forEach(k => { const b = document.createElement('button'); b.className = 'btn small'; b.textContent = BOSSES[k].name; b.addEventListener('click', () => { if (!inRun()) return this.toast('Start a run first'); mark(); const p = g().player; const sp = g().map.resolve(p.x + 160, p.y, 16); g().spawnZombie('boss', sp.x, sp.y, k); this.toast('Spawned ' + BOSSES[k].name); }); bl.appendChild(b); });
    $('#admSpawn').addEventListener('click', () => { if (!inRun()) return this.toast('Start a run first'); mark(); const n = Math.max(1, Math.min(200, +$('#admCount').value || 1)), t = $('#admType').value, p = g().player; for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, d = 120 + Math.random() * 120; const sp = g().map.resolve(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 6); g().spawnZombie(t, sp.x, sp.y); } this.toast(`Spawned ${n} ${t}`); });
    $('#admClear').addEventListener('click', () => { if (!inRun()) return; mark(); g().zombies.forEach(z => z.hp = 0); g().zombies.forEach(z => z.die()); this.toast('All zombies killed'); });
    $('#admGod').addEventListener('change', e => { mark(); g().god = e.target.checked; });
    $('#admAmmo').addEventListener('change', e => { mark(); g().infAmmo = e.target.checked; });
    $('#admCoins').addEventListener('click', () => { mark(); g().coins += 500; this.toast('+500 coins'); });
    $('#admHeal').addEventListener('click', () => { mark(); const p = g().player; p.hp = p.maxHp; this.toast('Healed'); });
    $('#admGuns').addEventListener('click', () => { mark(); const p = g().player; PICKABLE_WEAPONS.forEach(w => { if (!p.weapons[w]) p.addWeapon(w, true); p.weapons[w].reserve = p.weapons[w].maxReserve; }); this.refreshWeapons(); this.toast('All guns, full ammo'); });
    $('#admReady').addEventListener('click', () => { mark(); const p = g().player; p.formCd = 0; p.carCd = 0; p.rushCd = 0; p.squadCd = 0; p.fieldCd = 0; p.gleapCd = 0; p.ability.cd = 0; this.toast('Abilities ready'); });
    $('#admLevel').addEventListener('click', () => { if (!inRun()) return this.toast('Start a run first'); mark(); m.classList.remove('show'); g().pendingLevelUps += 1; g().state = 'levelup'; this.setState('levelup'); this.showLevelUp(); });
  }
  toggleAdmin() {
    const m = $('#modal-admin');
    if (m.classList.contains('show')) { m.classList.remove('show'); return; }
    this.closeModals(); $('#admGod').checked = !!this.game.god; $('#admAmmo').checked = !!this.game.infAmmo; $('#admWave').value = Math.max(1, this.game.wave || 1);
    if (this.game.state === 'playing' || this.game.state === 'wavebreak') this.game.pause();
    m.classList.add('show');
  }
  refreshTitle() { $('#titleBest').textContent = `High score: ${this.save.highScore.toLocaleString()}  ·  Best wave: ${this.save.bestWave}`; }
  action(a) {
    const g = this.game;
    switch (a) {
      case 'play': this.openSetup(); break;
      case 'retry': this.closeModals(); g.start(); break;
      case 'resume': g.resume(); break;
      case 'menu': this.closeModals(); g.toMenu(); break;
      case 'loadout': this.closeModals(); g.toMenu(); this.openSetup(); break;
      case 'settings': g.pause(); $('#modal-settings').classList.add('show'); break;
      case 'closeshop': g.closeShop(); break;
    }
  }
  closeModals() { let any = false; $$('.modal.show').forEach(m => { m.classList.remove('show'); any = true; }); return any; }
  toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(this._tt); this._tt = setTimeout(() => t.classList.remove('show'), 2400); }
  toggleFullscreen() { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen && document.documentElement.requestFullscreen(); }

  /* ------------------------------------------------------- setup wizard */
  openSetup() {
    this.sel = Object.assign({}, this.game.loadout, { weapons: this.game.loadout.weapons.slice(0, LOADOUT_SIZE) });
    this.cursor = PICKABLE_WEAPONS[0];
    this.buildCards();
    this.setState('setup'); this.stepTo(0);
  }
  stepTo(n) {
    if (n < 0) { this.setState('menu'); return; }
    if (n > 2) { this.game.setLoadout(this.sel); this.closeModals(); this.game.start(); return; }
    if (n === 2 && this.step === 1 && this.sel.weapons.length < LOADOUT_SIZE) { this.toast(`Pick ${LOADOUT_SIZE} weapons first`); Audio8.play('empty'); return; }
    this.step = n;
    $$('.setup-page').forEach(p => p.classList.toggle('show', +p.dataset.page === n));
    $$('.step').forEach(s => { const i = +s.dataset.step; s.classList.toggle('active', i === n); s.classList.toggle('done', i < n); });
    $('#setupBack').textContent = n === 0 ? '◀ MENU' : '◀ BACK';
    $('#setupNext').textContent = n === 2 ? '▶ START GAME' : 'NEXT ▶';
    this.refreshWeaponStep();
    if (n === 2) this.renderMapPreviews();
    this.updateLoadoutSummary();
    // background: show the chosen map behind the overlay
    if (n === 2) this.game.setLoadout({ map: this.sel.map });
  }
  select(key, id) {
    this.sel[key] = id; Audio8.play('swap');
    const wrap = { char: '#charCards', weapon: '#weaponCards', map: '#mapCards' }[key];
    $$(wrap + ' .card').forEach(c => c.classList.toggle('selected', c.dataset.id === id));
    if (key === 'map') this.game.setLoadout({ map: id });
    this.updateLoadoutSummary();
  }
  toggleWeapon(id) {
    const w = this.sel.weapons, i = w.indexOf(id);
    if (i >= 0) w.splice(i, 1);
    else if (w.length >= LOADOUT_SIZE) { this.toast(`Only ${LOADOUT_SIZE} weapons — deselect one first`); Audio8.play('empty'); return; }
    else w.push(id);
    Audio8.play('swap'); this.cursor = id; this.refreshWeaponStep(); this.updateLoadoutSummary();
  }
  setCursor(id) { this.cursor = id; $$('#weaponCards .card').forEach(c => c.classList.toggle('cursor', c.dataset.id === id)); }
  refreshWeaponStep() {
    const w = this.sel.weapons;
    $$('#weaponCards .card:not(.fixed)').forEach(c => { const i = w.indexOf(c.dataset.id); c.classList.toggle('selected', i >= 0); c.classList.toggle('cursor', c.dataset.id === this.cursor); c.classList.toggle('dim', i < 0 && w.length >= LOADOUT_SIZE); const slot = c.querySelector('.slot'); if (slot) slot.textContent = i >= 0 ? `SLOT ${i + 2}` : ''; });
    const count = $('#weaponCount'); if (count) count.textContent = `${w.length} / ${LOADOUT_SIZE} selected`;
    if (this.step === 1) $('#setupNext').disabled = w.length < LOADOUT_SIZE;
    else $('#setupNext').disabled = false;
  }
  updateLoadoutSummary() {
    $('#loadoutSummary').innerHTML = `<b>${CHARACTERS[this.sel.char].name}</b> · <b>${this.sel.weapons.map(w => WEAPONS[w].name).join(' + ') || '—'}</b> · <b>${MAPS[this.sel.map].name}</b>`;
  }
  buildCards() {
    const bar = (label, v, cls = '') => `<div class="stat ${cls}"><span>${label}</span><i style="--v:${Math.round(v * 100)}%"></i></div>`;
    const cc = $('#charCards'); cc.innerHTML = '';
    CHARACTER_ORDER.forEach(id => {
      const ch = CHARACTERS[id]; const d = document.createElement('div'); d.className = 'card'; d.dataset.id = id;
      d.innerHTML = `<canvas width="64" height="64"></canvas><b>${ch.name.toUpperCase()}</b><span class="tag">${ch.tag.toUpperCase()}</span><small>${ch.desc}</small>
        <div class="stats">${bar('HEALTH', ch.hp / 160)}${bar('SPEED', ch.speed / 1.3, 'blue')}${bar('DAMAGE', ch.damage / 1.2, 'red')}${bar('FIRE RATE', ch.firerate / 1.1, 'yellow')}</div>`;
      Sprites.renderTo(d.querySelector('canvas'), ch.portrait ? 'portrait_' + id : 'player_' + id); d.addEventListener('click', () => this.select('char', id)); cc.appendChild(d);
    });
    const wc = $('#weaponCards'); wc.innerHTML = '';
    const weaponCard = (id, fixed) => {
      const w = WEAPONS[id]; const d = document.createElement('div'); d.className = 'card' + (fixed ? ' fixed' : ''); d.dataset.id = id;
      const dps = w.damage * w.pellets / w.interval;
      d.innerHTML = `<canvas class="gun" width="64" height="32"></canvas><b>${w.name.toUpperCase()}</b><span class="tag">${fixed ? 'SIDEARM · ALWAYS EQUIPPED' : w.desc.replace(/[()]/g, '').toUpperCase()}</span><small>${w.shopDesc || 'Reliable sidearm with unlimited reserve ammo.'}</small>
        <div class="stats">${bar('DAMAGE', Math.min(1, w.damage * w.pellets / 130), 'red')}${bar('FIRE RATE', Math.min(1, (1 / w.interval) / 22), 'yellow')}${bar('RANGE', w.range / 640, 'blue')}${bar('MAG', Math.min(1, w.mag / 120))}</div>
        <small>MAG ${w.mag} · RESERVE ${w.reserve === Infinity ? '∞' : w.reserve} · ${Math.round(dps)} DPS${w.flame ? ' + burn' : ''}</small><span class="slot">${fixed ? 'SLOT 1' : ''}</span>`;
      Sprites.renderTo(d.querySelector('canvas'), w.sprite);
      if (!fixed) d.addEventListener('click', () => this.toggleWeapon(id));
      return d;
    };
    wc.appendChild(weaponCard('pistol', true));
    PICKABLE_WEAPONS.forEach(id => wc.appendChild(weaponCard(id, false)));
    const mc = $('#mapCards'); mc.innerHTML = '';
    MAP_ORDER.forEach(id => {
      const m = MAPS[id]; const d = document.createElement('div'); d.className = 'card'; d.dataset.id = id;
      d.innerHTML = `<canvas class="map" width="480" height="300"></canvas><b>${m.name.toUpperCase()}</b>${m.tag ? `<span class="tag horror">${m.tag}</span>` : ''}<small>${m.desc}</small>`;
      d.addEventListener('click', () => this.select('map', id)); mc.appendChild(d);
    });
    ['char', 'map'].forEach(k => this.select(k, this.sel[k]));
    this.refreshWeaponStep(); this.updateLoadoutSummary();
  }
  renderMapPreviews() { $$('#mapCards .card').forEach(c => this.game.getMap(c.dataset.id).drawPreview(c.querySelector('canvas'))); }

  /* ------------------------------------------------------- states / overlays */
  setState(s) {
    $$('.overlay').forEach(o => { if (!o.classList.contains('banner')) o.classList.remove('show'); });
    if (s === 'menu' || s === 'setup') { this.bannerTimer = 0; $('#ov-wave').classList.remove('show'); }   // wave banners belong to a run — never let one outlive it onto the menus
    if (s === 'menu') { $('#ov-title').classList.add('show'); this.refreshTitle(); }
    if (s === 'setup') $('#ov-setup').classList.add('show');
    if (s === 'paused') $('#ov-pause').classList.add('show');
    if (s === 'levelup') $('#ov-levelup').classList.add('show');
    if (s === 'gameover') $('#ov-gameover').classList.add('show');
  }
  /* ------------------------------------------------------- supply cart */
  showShop() { Sprites.renderTo($('#cartIcon'), 'icon_cart'); $('#cartCoinIcon').innerHTML = coinImg(); this.buildShop(); $('#ov-shop').classList.add('show'); }
  hideShop() { $('#ov-shop').classList.remove('show'); }
  buildShop() {
    const g = this.game, p = g.player; $('#cartCoins').textContent = g.coins;
    const item = (sprite, sq, title, sub, price, enabled, onBuy, warn) => {
      const d = document.createElement('div'); d.className = 'cart-item' + (warn ? ' empty' : '');
      d.innerHTML = `<canvas class="${sq ? 'sq' : ''}" width="${sq ? 12 : 32}" height="${sq ? 12 : 16}"></canvas><div class="info"><b>${title}</b><small class="${warn ? 'warn' : ''}">${sub}</small></div><button class="btn ${enabled && g.coins >= price ? 'ok' : ''}" ${enabled ? '' : 'disabled'}>${coinImg()} ${price}</button>`;
      Sprites.renderTo(d.querySelector('canvas'), sprite);
      d.querySelector('button').addEventListener('click', () => { if (onBuy()) this.buildShop(); });
      return d;
    };
    const ammo = $('#cartAmmo'); ammo.innerHTML = '';
    p.weaponOrder.filter(id => id !== 'pistol').forEach(id => {
      const w = p.weapons[id], cfg = WEAPONS[id], empty = w.mag + w.reserve === 0, full = w.reserve >= w.maxReserve;
      ammo.appendChild(item(cfg.sprite, false, cfg.name, empty ? 'OUT OF AMMO' : full ? `Reserve full (${w.reserve})` : `${w.mag} / ${w.reserve} → refill to ${w.maxReserve}`, CART.ammo[id], !full, () => g.buy('ammo', id), empty));
    });
    if (!ammo.childElementCount) ammo.innerHTML = '<div class="none">Only the pistol — it never runs dry.</div>';
    const hp = $('#cartHealth'); hp.innerHTML = '';
    const fullHp = p.hp >= p.maxHp;
    hp.appendChild(item('pickup_health', true, 'Health Pack', fullHp ? 'Health is full' : `+25 HP (${Math.round(p.hp)} / ${p.maxHp})`, CART.health, !fullHp, () => g.buy('health'), p.hp < p.maxHp * 0.3));
    hp.appendChild(item('icon_maxhp', true, 'Full Heal', fullHp ? 'Health is full' : `Restore to ${p.maxHp} HP`, CART.fullHeal, !fullHp, () => g.buy('fullheal')));
    hp.appendChild(item('heart_full', true, '+1 Heart', `Max hearts: ${Math.ceil(p.maxHp / 25)} → ${Math.ceil(p.maxHp / 25) + 1} (permanent this run)`, CART.heart, true, () => g.buy('heart')));
    const wp = $('#cartWeapons'); wp.innerHTML = '';
    PICKABLE_WEAPONS.filter(id => !p.weapons[id]).forEach(id => { const cfg = WEAPONS[id]; wp.appendChild(item(cfg.sprite, false, cfg.name, cfg.desc.replace(/[()]/g, ''), CART.weapon[id], true, () => g.buy('weapon', id))); });
    if (!wp.childElementCount) wp.innerHTML = '<div class="none">You carry every weapon there is.</div>';
  }
  showBanner(text, sub) { $('#waveBannerText').textContent = text; $('#waveBannerSub').textContent = sub || ''; const b = $('#ov-wave'); b.classList.remove('show'); void b.offsetWidth; b.classList.add('show'); this.bannerTimer = 2.6; }
  showLevelUp() {
    $('#ov-levelup').classList.add('show');
    $('#ov-levelup .hint').textContent = this.game.pendingLevelUps > 1 ? `Choose one upgrade (${this.game.pendingLevelUps} remaining)` : 'Choose one upgrade';
    $$('#levelupCards .upgrade-card').forEach(c => { const l = this.game.player.upgrades[c.dataset.upgrade]; c.querySelector('.lvl').textContent = l ? `current: LV ${l}` : ''; });
  }
  hideLevelUp() { $('#ov-levelup').classList.remove('show'); }
  showGameOver(waves, score, isNew) {
    const g = this.game, k = g.kills, total = Object.values(k).reduce((a, b) => a + b, 0);
    $('#goWaves').textContent = `You survived ${waves} wave${waves === 1 ? '' : 's'}`; $('#goScore').textContent = score.toLocaleString();
    $('#goNew').classList.toggle('show', isNew);
    $('#goGrid').innerHTML = [['KILLS', total], ['COINS', g.coins], ['LEVEL', g.player.level], ['BOSSES', k.boss], ['SURVIVOR', CHARACTERS[g.loadout.char].name], ['WEAPONS', g.loadout.weapons.map(w => WEAPONS[w].name).join(', ')], ['MAP', MAPS[g.loadout.map].name], ['BEST', this.save.highScore.toLocaleString()]]
      .map(([l, v]) => `<div>${l}<b>${v}</b></div>`).join('');
    setTimeout(() => { if (g.state === 'gameover') this.setState('gameover'); }, 1200);
  }
  tick(dt) { if (this.bannerTimer > 0) { this.bannerTimer -= dt; if (this.bannerTimer <= 0) $('#ov-wave').classList.remove('show'); } }
  refreshAll() { }
  refreshWeapons() { }

  /* ------------------------------------------------------- settings */
  initSettings() {
    const s = this.save.settings;
    const bind = (id, key, isRange) => { const el = $(id); el[isRange ? 'value' : 'checked'] = isRange ? s[key] * 100 : s[key]; el.addEventListener('input', () => { s[key] = isRange ? el.value / 100 : el.checked; this.applySettings(); this.saveGame(); }); };
    bind('#setSfx', 'sfx', true); bind('#setMusic', 'music', true); bind('#setShake', 'shake'); bind('#setBlood', 'blood'); bind('#setFps', 'fps'); bind('#setAimLine', 'aimLine'); bind('#setMinimap', 'minimap');
    $('#resetProgress').addEventListener('click', () => { if (confirm('Reset high score and best wave?')) { this.save.highScore = 0; this.save.bestWave = 0; this.saveGame(); this.refreshTitle(); this.toast('Progress reset.'); } });
    this.applySettings();
  }
  applySettings() { const s = this.save.settings; Audio8.setSfx(s.sfx); Audio8.setMusic(s.music); if (this.game) this.game.settings = s; }
}
