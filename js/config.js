/* ==========================================================================
   config.js — game balance: weapons, enemies, waves, upgrades, shop
   ========================================================================== */
const CONFIG = {
  TILE: 16,
  MAP_W: 80,           // tiles
  MAP_H: 50,
  VIEW_W: 640,         // logical canvas size
  VIEW_H: 400,
  WAVES_PER_LEVEL: 10,
  XP_BASE: 60,         // xp needed for first level-up
  XP_GROWTH: 1.35,
};

const WEAPONS = {
  pistol: {
    name: 'Pistol', desc: '(default)', key: 1, sprite: 'gun_pistol',
    damage: 14, interval: 0.32, mag: 12, reserve: Infinity, reload: 1.0,
    speed: 420, spread: 0.03, range: 320, pellets: 1, pierce: 0, kick: 1.5,
    sound: 'pistol', cost: 0,
  },
  shotgun: {
    name: 'Shotgun', desc: '(close range)', key: 2, sprite: 'gun_shotgun',
    damage: 9, interval: 0.85, mag: 6, reserve: 30, reload: 1.7,
    speed: 380, spread: 0.32, range: 150, pellets: 7, pierce: 0, kick: 5,
    sound: 'shotgun', cost: 150, shopDesc: '7 pellets per shot. Devastating up close, shreds crowds.',
  },
  smg: {
    name: 'SMG', desc: '(high fire rate)', key: 3, sprite: 'gun_smg',
    damage: 7, interval: 0.075, mag: 32, reserve: 160, reload: 1.4,
    speed: 460, spread: 0.12, range: 280, pellets: 1, pierce: 0, kick: 1,
    sound: 'smg', cost: 300, shopDesc: 'Sprays bullets. Low damage per shot but relentless.',
  },
  rifle: {
    name: 'Rifle', desc: '(long range)', key: 4, sprite: 'gun_rifle',
    damage: 48, interval: 0.55, mag: 8, reserve: 40, reload: 1.6,
    speed: 700, spread: 0.008, range: 640, pellets: 1, pierce: 2, kick: 3,
    sound: 'rifle', cost: 500, shopDesc: 'High damage, pierces through 3 zombies in a line.',
  },
  rocket: {
    name: 'Rocket Launcher', desc: '(explosive)', key: 5, sprite: 'gun_rocket',
    damage: 130, interval: 1.2, mag: 1, reserve: 8, reload: 2.0,
    speed: 240, spread: 0.01, range: 520, pellets: 1, pierce: 0, kick: 8,
    explosive: 52, sound: 'rocket', cost: 800, shopDesc: 'Explodes on impact. Massive area damage — mind the splash.',
  },
  magnum: {
    name: 'Magnum', desc: '(hand cannon)', key: 6, sprite: 'gun_magnum',
    damage: 62, interval: 0.7, mag: 6, reserve: 36, reload: 1.9,
    speed: 640, spread: 0.01, range: 380, pellets: 1, pierce: 1, kick: 5,
    sound: 'magnum', cost: 0, shopDesc: 'Six rounds of pure stopping power. One shot, one zombie.',
  },
  flamer: {
    name: 'Flamethrower', desc: '(burns everything)', key: 7, sprite: 'gun_flamer',
    damage: 1.6, interval: 0.05, mag: 100, reserve: 200, reload: 2.2,
    speed: 170, spread: 0.24, range: 100, pellets: 3, pierce: 2, kick: 0.3,
    flame: true, sound: 'flame', cost: 0, shopDesc: 'Short range stream of fire. Sets zombies ablaze — they keep burning.',
  },
  minigun: {
    name: 'Minigun', desc: '(bullet hose)', key: 8, sprite: 'gun_minigun',
    damage: 6, interval: 0.045, mag: 120, reserve: 240, reload: 3.2,
    speed: 480, spread: 0.16, range: 260, pellets: 1, pierce: 0, kick: 0.6,
    sound: 'smg', cost: 0, shopDesc: '120-round belt. Inaccurate, relentless, glorious. Ability: OVERDRIVE — 15 s of infinite fire.',
    ability: { name: 'OVERDRIVE', duration: 15, cooldown: 35, key: 'e' },
  },
};
const WEAPON_ORDER = ['pistol', 'shotgun', 'smg', 'rifle', 'rocket', 'magnum', 'flamer', 'minigun'];
const PICKABLE_WEAPONS = WEAPON_ORDER.filter(w => w !== 'pistol');
/* Drone's beast-form gun: not buyable, not droppable — refilled by killing 20 zombies while transformed */
const BEAST_GUN = { name: 'Flesh Cannon', desc: '(beast only)', sprite: 'gun_flesh', damage: 9, interval: 0.09, mag: 420, pellets: 3, spread: 0.14, speed: 430, range: 270, pierce: 0, kick: 1.8, sound: 'shotgun', refillKills: 20 };
const LOADOUT_SIZE = 3;

const ENEMIES = {
  normal:   { name: 'Normal Zombie',   hp: 34,   speed: 38,  damage: 10, score: 10,  scale: 1,   radius: 6,  sprite: 'zombie_normal',   xp: 4,  coin: 0.28 },
  fast:     { name: 'Fast Zombie',     hp: 22,   speed: 92,  damage: 8,  score: 15,  scale: 0.95,radius: 5,  sprite: 'zombie_fast',     xp: 5,  coin: 0.28 },
  tank:     { name: 'Tank Zombie',     hp: 190,  speed: 24,  damage: 28, score: 50,  scale: 1.7, radius: 11, sprite: 'zombie_tank',     xp: 15, coin: 0.6 },
  exploder: { name: 'Exploder Zombie', hp: 26,   speed: 58,  damage: 35, score: 30,  scale: 1,   radius: 6,  sprite: 'zombie_exploder', xp: 8,  coin: 0.4, explodes: 44 },
  guard:    { name: 'Zombie Soldier',  hp: 150,  speed: 46,  damage: 22, score: 40,  scale: 1.3, radius: 8,  sprite: 'zombie_guard',    xp: 12, coin: 0.5, guard: true },
  boss:     { name: 'BOSS',            hp: 300,  speed: 38,  damage: 28, score: 300, scale: 2.4, radius: 16, sprite: 'zombie_boss',     xp: 60, coin: 1.0, boss: true },
};

/* Wave composition by tier.  weights = spawn probability per type */
function waveComposition(wave) {
  if (wave <= 5)  return { normal: 1 };
  if (wave <= 10) return { normal: 0.55, fast: 0.45 };
  if (wave <= 15) return { normal: 0.4, fast: 0.35, tank: 0.25 };
  if (wave <= 20) return { normal: 0.3, fast: 0.3, tank: 0.2, exploder: 0.2 };
  return { normal: 0.25, fast: 0.3, tank: 0.22, exploder: 0.23 };
}
function waveCount(wave) { return 6 + Math.floor(wave * 3.2) + Math.floor(wave * wave * 0.12); }
/* ---- bosses: one every wave, escalating kinds, stats scale with the wave ---- */
const BOSSES = {
  brute:      { name: 'BRUTE',      minWave: 1,  hp: 300,  speed: 38, damage: 28, scale: 2.4, charge: true,  summon: false, desc: 'It charges. Keep moving.',
                pal: { G: '#9b4fd6', g: '#5f2e8a', R: '#f5c518', J: '#2a2d36', j: '#1d1f27' } },
  gunner:     { name: 'GUNNER',     minWave: 3,  hp: 280,  speed: 44, damage: 18, scale: 2.2, weapon: 'smg',     keep: 150, desc: 'Fires SMG bursts. Strafe and close in.',
                gun: { burst: 3, burstGap: 0.12, cd: 1.7, spread: 0.09, speed: 230, dmg: 8, range: 340 },
                pal: { G: '#5a6b8a', g: '#3a4660', R: '#f5c518', J: '#2a2d36', j: '#1d1f27' } },
  shotgunner: { name: 'SHOTGUNNER', minWave: 6,  hp: 420,  speed: 40, damage: 22, scale: 2.4, weapon: 'shotgun', keep: 90,  desc: 'Deadly up close. Never let it get near.',
                gun: { pellets: 6, spread: 0.35, cd: 2.2, speed: 210, dmg: 7, range: 160 },
                pal: { G: '#8a6a4a', g: '#5c452e', R: '#f5c518', J: '#4a2e1a', j: '#2e1c10' } },
  rifleman:   { name: 'RIFLEMAN',   minWave: 9,  hp: 380,  speed: 42, damage: 20, scale: 2.2, weapon: 'rifle',   keep: 230, desc: 'Watch the red laser — move when it locks on.',
                gun: { aim: 0.75, cd: 2.8, spread: 0, speed: 440, dmg: 26, range: 520 },
                pal: { G: '#4a7a4a', g: '#2e5030', R: '#ff4a3a', J: '#2a3a2a', j: '#1a261a' } },
  rocketeer:  { name: 'ROCKETEER',  minWave: 12, hp: 520,  speed: 36, damage: 24, scale: 2.4, weapon: 'rocket',  keep: 190, desc: 'Rockets. Its own minions are not safe either.',
                gun: { cd: 3.0, spread: 0.03, speed: 140, dmg: 30, range: 420, explosive: 42 },
                pal: { G: '#b03a2e', g: '#7a2419', R: '#f5c518', J: '#3a1a1a', j: '#241010' } },
  flamer:     { name: 'FLAMER',     minWave: 15, hp: 600,  speed: 46, damage: 24, scale: 2.4, weapon: 'flamer',  keep: 55,  desc: 'A wall of fire. Keep your distance.',
                gun: { flame: true, burst: 22, burstGap: 0.06, cd: 1.6, spread: 0.26, speed: 165, dmg: 3, range: 95 },
                pal: { G: '#e07a2a', g: '#a0501a', R: '#ffffff', J: '#3a2a1a', j: '#241a10' } },
  warlord:    { name: 'WARLORD',    minWave: 18, hp: 900,  speed: 40, damage: 34, scale: 2.8, weapon: 'minigun', keep: 160, charge: true, summon: true, desc: 'Minigun, charges, summons. Good luck.',
                gun: { burst: 22, burstGap: 0.07, cd: 2.6, spread: 0.2, speed: 270, dmg: 6, range: 360 },
                pal: { G: '#2a2a30', g: '#141418', R: '#ff2a2a', J: '#d4a017', j: '#8a6a0e' } },
  ravager:    { name: 'RAVAGER',    minWave: 20, hp: 1600, speed: 44, damage: 38, scale: 3, weapon: 'cannon', keep: 190, summon: false, ravager: true, special: true,
                desc: 'Twin cannons. Leaps. Half-dead, it only gets angrier.',
                gun: { cd: 1.3, spread: 0.02, speed: 200, dmg: 34, range: 480, explosive: 46, dual: true, cannon: true },
                pal: { G: '#8a1f1f', g: '#4a0f10', R: '#ffd23a', J: '#3a0d0e', j: '#240808' } },
  bona:       { name: 'BONA',       minWave: 30, hp: 2600, speed: 42, damage: 46, scale: 3.4, weapon: null, keep: 0, summon: false, bona: true, special: true,
                desc: 'A mountain of black rock with fire inside. The lights go out when it comes. It charges, it slams the ground, it breathes magma.',
                gun: { cd: 3.0, spread: 0.05, speed: 220, dmg: 24, range: 320, pellets: 5, flame: true },
                pal: { G: '#26262a', g: '#0e0e10', R: '#ff7a1a', J: '#3a3a40', j: '#1a1a1e' } },
  sahur:      { name: 'TUNG TUNG SAHUR', minWave: 50, hp: 3200, speed: 50, damage: 52, scale: 3.2, weapon: null, keep: 0, summon: true, sahur: true, special: true,
                desc: 'Tung. Tung. Tung. The log with the bat. Drum shockwaves, a boomerang bat, and a sahur call that brings the horde.',
                pal: { G: '#b8632a', g: '#7a3d16', R: '#f4f2ea', J: '#e08a3a', j: '#a85a20' } },
  kraken:     { name: 'KRAKEN',     minWave: 40, hp: 1400, speed: 34, damage: 40, scale: 3, weapon: 'minigun', keep: 170, summon: true, kraken: true, special: true,
                desc: 'Two miniguns. Eight tentacles. Spiral fire. Run.',
                gun: { burst: 44, burstGap: 0.05, cd: 1.8, spread: 0.16, speed: 280, dmg: 6, range: 420, dual: true },
                pal: { G: '#5a2d8a', g: '#3a1a5c', R: '#f5c518', J: '#2a2d36', j: '#1d1f27' } },
};
const BOSS_ORDER = Object.keys(BOSSES);
function bossKindsForWave(wave) { return BOSS_ORDER.filter(k => BOSSES[k].minWave <= wave && !BOSSES[k].special); }
/* every 10th wave has its own unique boss; unlisted milestones fall back to a random earlier one */
const MILESTONE_BOSSES = { 10: 'warlord', 20: 'ravager', 30: 'bona', 40: 'kraken', 50: 'sahur' };
function milestoneBoss(wave) {
  if (MILESTONE_BOSSES[wave]) return MILESTONE_BOSSES[wave];
  const past = Object.keys(MILESTONE_BOSSES).map(Number).filter(w => w < wave).map(w => MILESTONE_BOSSES[w]);
  return past[Math.floor(Math.random() * past.length)] || 'warlord';
}
function pickBossKind(wave) {
  if (wave % 10 === 0) return milestoneBoss(wave);
  const kinds = bossKindsForWave(wave), newest = kinds[kinds.length - 1];
  if (wave <= BOSSES[newest].minWave + 1) return newest;              // showcase a new kind for 2 waves
  if (wave >= 20 && wave % 5 === 0) return 'warlord';
  return kinds[Math.floor(Math.random() * kinds.length)];
}
function bossCount(wave) { return wave >= 40 ? 3 : wave >= 25 ? 2 : 1; }
function bossScale(wave) {
  return { hp: (1 + 0.22 * (wave - 1)) * (1 + wave * wave * 0.003), dmg: 1 + 0.06 * wave, cd: Math.max(0.45, 1 - 0.025 * wave), speed: 1 + 0.01 * wave };
}
function waveHasBoss(wave) { return true; }
function waveTier(wave) { return wave <= 5 ? 0 : wave <= 10 ? 1 : wave <= 15 ? 2 : wave <= 20 ? 3 : 4; }
/* scale enemy stats gently with wave */
function enemyHpScale(wave) { return 1 + Math.max(0, wave - 1) * 0.07; }

const UPGRADES = {
  damage:   { name: '+ Damage',         desc: '+15% weapon damage',  icon: 'icon_damage',   max: 12 },
  firerate: { name: '+ Fire Rate',      desc: '+12% fire rate',      icon: 'icon_firerate', max: 12 },
  maxhp:    { name: '+ Max Health',     desc: '+1 heart, heal fully', icon: 'icon_maxhp',    max: 8 },
  speed:    { name: '+ Movement Speed', desc: '+8% move speed',      icon: 'icon_speed',    max: 8 },
};

/* playable characters — stat multipliers + sprite palette */
const CHARACTERS = {
  rookie: { name: 'Rookie',   tag: 'Balanced',      hp: 100, speed: 1.0,  damage: 1.0,  firerate: 1.0, reload: 1.0, regen: 0,
            desc: 'Jack of all trades. Solid pick for a first run.',
            pal: { B: '#3159a3', b: '#23407a', D: '#3a2a20', J: '#3d4257' } },
  runner: { name: 'Runner',   tag: 'Fast & fragile', hp: 75,  speed: 1.28, damage: 0.9,  firerate: 1.05, reload: 1.0, regen: 0,
            desc: 'Outruns anything. Can\'t take many hits. Ability: RUSH — 15 s of blazing speed, infinite ammo and max fire rate on any gun.',
            pal: { B: '#c8382a', b: '#8a1f18', D: '#e0b040', J: '#2a2d36' },
            rush: { name: 'RUSH', duration: 15, cooldown: 45, speed: 1.8, interval: 0.06 } },
  heavy:  { name: 'Heavy',    tag: 'Tough & slow',   hp: 160, speed: 0.82, damage: 1.15, firerate: 0.95, reload: 1.15, regen: 0,
            desc: 'Walking wall. Hits hard, moves like a tank. Ability: SQUAD — calls in 6 clones of himself for 20 s.',
            pal: { B: '#4a5d3a', b: '#2f3d25', D: '#1a1a1a', J: '#3b3b3b', S: '#d8a47a' },
            squad: { name: 'SQUAD', duration: 20, cooldown: 35, count: 6, hp: 140, gun: { damage: 9, interval: 0.11, speed: 460, spread: 0.1, range: 280, pellets: 1, pierce: 0, kick: 1, sound: 'smg' } } },
  medic:  { name: 'Medic',    tag: 'Self-healing',   hp: 100, speed: 1.0,  damage: 0.85, firerate: 1.0, reload: 0.9,  regen: 1.5,
            desc: 'Regenerates health over time. Health packs heal double. Ability: MED FIELD — a healing aura for 20 s.',
            pal: { B: '#e8e6dc', b: '#b8b6ae', D: '#7a3a1a', J: '#3d4257' },
            field: { name: 'MED FIELD', duration: 20, cooldown: 45, radius: 64, heal: 12 } },
  drone:  { name: 'Drone',    tag: 'Transforms',     hp: 90,  speed: 1.05, damage: 0.9,  firerate: 1.0, reload: 1.0, regen: 0, sprite: 'drone',
            desc: 'Looks harmless. Hit TRANSFORM and he becomes a hulking brute — smash and leap for 35 s.',
            pal: { D: '#1a1a1a', B: '#3f9a3c', b: '#2a6b28', J: '#2f3f6b', Y: '#f0c419', O: '#ee8b2b', W: '#f4f2ea' },
            transform: { name: 'TRANSFORM', duration: 35, cooldown: 50, morph: 1.5, smash: 150, leap: 220, leapCd: 2.5, armor: 0.4, speed: 1.3, hearts: 9 } },
  canimal: { name: 'Canimal', tag: 'Transforms · vehicle', hp: 110, speed: 0.95, damage: 1.0, firerate: 1.0, reload: 1.0, regen: 0,
            desc: 'A robot in disguise. Transforms into an armoured truck with twin 360° M249 turrets. Ram everything.',
            pal: { S: '#c9ced8', s: '#8a9099', D: '#2b4fb0', B: '#c0281e', b: '#7a1610', J: '#2b4fb0' },
            vehicle: { name: 'ROLL OUT', duration: 25, cooldown: 45, morph: 0.8, maxSpeed: 290, accel: 380, turn: 3.4, armor: 0.6, ram: 0.7,
                       gun: { damage: 11, interval: 0.075, speed: 540, spread: 0.06, range: 340, pellets: 1, pierce: 0, kick: 0.5, sound: 'smg' } } },
  samay:   { name: 'Samay Naina', tag: 'Comedian · streamer', hp: 100, speed: 1.05, damage: 1.0, firerate: 1.0, reload: 1.0, regen: 0, sprite: 'samay', portrait: 'samay_portrait',
            desc: 'Ability: CHAI TAPRI — his song plays, and every zombie that enters his circle gets stuck in a spider web for 5 s. 30 s of chaos.',
            pal: { H: '#1a1210', h: '#3a2a22', S: '#e6b58f', s: '#2a1a14', R: '#d0342c', J: '#2a3350', N: '#e8e6dc', M: '#2a2d33', m: '#8a8f99', W: '#f4f2ea', K: '#2a1c1c' },
            tapri: { name: 'CHAI TAPRI', duration: 30, cooldown: 50, radius: 110, web: 5, bossWeb: 2.5, immune: 1.5, vuln: 2, track: 'assets/audio/chai_tapri.mp3' } },
  spidermad: { name: 'Spider Mad', tag: 'Web-slinger · meme', hp: 90, speed: 1.15, damage: 1.0, firerate: 1.0, reload: 1.0, regen: 0, sprite: 'spidermad', portrait: 'spidermad_portrait',
            desc: 'WEB ZIP (Space, infinite): web anything and get pulled to it; landing on a zombie kicks it. WEB PULL (F): yank a zombie to you and freeze it in web for 3 s.',
            pal: { R: '#e8332a', B: '#1f3fd8', W: '#f4f2ea', K: '#111111' },
            web: { name: 'WEB ZIP', range: 300, speed: 820, cd: 0.3, kick: 70 },
            pull: { name: 'WEB PULL', range: 340, cd: 6, freeze: 3, bossFreeze: 1.5, speed: 900 } },
  genom:   { name: 'Genom', tag: 'Symbiote · meme', hp: 100, speed: 1.0, damage: 1.0, firerate: 1.0, reload: 1.0, regen: 0, sprite: 'genom', portrait: 'genom_portrait',
            desc: 'T to become the symbiote — no time limit, T again to shed it. Venom form: LMB spits venom, RMB claws, R captures a boss and turns it into a venom ally.',
            pal: { D: '#141418', d: '#22222a', W: '#f4f2ea', k: '#6a5aa8', R: '#8a1f2a', K: '#000000' },
            symbiote: { name: 'SYMBIOTE', morph: 1.3, revert: 0.6, scale: 2.2, hearts: 8, armor: 0.55, speed: 1.15,
                        spit: { damage: 12, interval: 0.04, speed: 360, spread: 0.14, range: 220, pellets: 3, pierce: 1, kick: 0.4, venom: true, poison: 3 },  // a continuous stream of black symbiote
                        claw: 110, clawCd: 0.5, capture: { range: 340, duration: 10, cd: 30, name: 'CAPTURE' } } },
  frogepepe: { name: 'Frogepepe', tag: 'Transforms · meme', hp: 95, speed: 1.0, damage: 1.0, firerate: 1.0, reload: 1.0, regen: 0, sprite: 'frogepepe', portrait: 'frogepepe_portrait',
            desc: 'Feels good man. FROG OUT makes him a giant frog for 30 s: LMB lashes a sticky tongue that yanks zombies in and eats them for health, SPACE hops onto the cursor and squashes whatever is under him.',
            pal: { G: '#4f9a3e', g: '#3a7430', l: '#9ccf72', W: '#f4f2ea', K: '#111111', L: '#8b4a2a', B: '#1f3fd0', b: '#162c94' },
            frog: { name: 'FROG OUT', duration: 30, cooldown: 20, morph: 1.2, revert: 0.6, scale: 2.2, hearts: 7, armor: 0.6, speed: 1.35,
                    tongue: { damage: 75, range: 240, cd: 0.4, eatHeal: 6, yank: 5 },   // hitscan lash: first zombie on the line, yanked toward the frog; a kill is a meal
                    hop: { range: 220, cd: 1.3, dur: 0.45, smash: 130, radius: 80 },
                    army: { name: 'FROG ARMY', count: 10, duration: 15, cd: 40, hp: 60, damage: 260, bossDamage: 180, hop: 95, hopDur: 0.26, scale: 0.9, seek: 520 } } },  // R: ten little froglings that hop on zombies and rip their heads off
  bezuko:  { name: 'Bezuko', tag: 'Transforms · meme', hp: 100, speed: 1.05, damage: 1.0, firerate: 1.0, reload: 1.0, regen: 0, sprite: 'bezuko', portrait: 'bezuko_portrait',
            desc: 'Sus... the thug-life demon girl with the bamboo. AWAKEN (Space) unleashes her demon form for 20 s: her song plays and a big pink circle of music draws every zombie inside it to her — then LMB swings her demon katana for insane damage, RMB / Space is a demon kick, and she regenerates fast.',
            pal: { K: '#141018', D: '#000000', H: '#33262e', h: '#453640', O: '#e07a2a', S: '#f6d9c0', s: '#e6b8a0', R: '#f08a9a', P: '#f2a0b8', p: '#d8708c', W: '#f4f2ea', E: '#e8558a', e: '#b8306a', G: '#7aa64a', g: '#4f7a2e', T: '#e2506e', t: '#a02a48', B: '#f6b8cc', Y: '#e8b84a', C: '#efe6d0', V: '#2f5a3a' },
            demon: { name: 'AWAKEN', duration: 20, cooldown: 35, morph: 1.3, revert: 0.6, scale: 2.0, hearts: 8, armor: 0.5, speed: 1.3, regen: 8, track: 'assets/audio/bezuko_song.m4a',
                     song: { radius: 150 },                                                                       // the pink circle of music: zombies inside it are charmed and walk to her
                     sword: { name: 'DEMON KATANA', damage: 320, range: 74, arc: 1.35, cd: 0.28, burn: 2 },       // LMB: a wide slash, incredible damage, the cut burns pink
                     kick: { name: 'DEMON KICK', damage: 160, dash: 120, dur: 0.16, cd: 1.0, width: 30 } } },
  eggreck: { name: 'Eggreck', tag: 'Stealth · meme', hp: 100, speed: 1.05, damage: 1.05, firerate: 1.0, reload: 1.0, regen: 0, sprite: 'eggreck', portrait: 'eggreck_portrait',
            desc: 'Shrek in an egg. VANISH (Space) makes him invisible for 20 s — no zombie, boss or cannon can see him, and he keeps shooting the whole time. Resets 20 s after it ends.',
            pal: { K: '#1e2a10', G: '#9cc23a', g: '#6e9424', L: '#c8dc60', W: '#f4f2ea', E: '#5a3a1a', B: '#3a4a18', T: '#e8e0c8', P: '#c88a70', M: '#3a1a10' },
            stealth: { name: 'VANISH', duration: 20, cooldown: 20 },
            wife: { name: 'MY WIFE', duration: 20, cooldown: 20, radius: 34 } },   // E: she shows up and holds a shield over him — bites and shells bounce off
  videoman: { name: 'Videoman', tag: 'Lava · meme', hp: 100, speed: 1.0, damage: 1.0, firerate: 1.0, reload: 1.0, regen: 0, sprite: 'videoman', portrait: 'videoman_portrait',
            desc: 'Tu video kahe bana raha hai bhai? LAVA STONES (Space): his clip plays and for as long as it runs, LMB hurls burning lava rocks that explode where you aim and set everything ablaze. Resets 50 s later.',
            pal: { K: '#14100c', H: '#2a1c12', S: '#b5733f', s: '#8f5730', M: '#1a1008', W: '#f4f2ea', B: '#3a7ad8', b: '#2a5aa8', E: '#2a1a10', L: '#d9906a' },
            lava: { name: 'LAVA STONES', duration: 11.2, cooldown: 50, track: 'assets/audio/videoman.m4a',
                    stone: { damage: 70, interval: 0.32, speed: 280, spread: 0.03, range: 340, pellets: 1, pierce: 0, kick: 1.2, explosive: 46, burn: 3, lava: true } } },
  kiya:    { name: 'Kiya Mhalifa', tag: 'Crowd control · meme', hp: 105, speed: 1.05, damage: 1.0, firerate: 1.1, reload: 0.9, regen: 0, sprite: 'kiya', portrait: 'kiya_portrait',
            desc: 'Glasses, braids, and far too much attention. GOING VIRAL (Space) freezes every zombie around her — they stop dead to record it, and take double damage while they gawk. 14 s, 32 s recharge.',
            pal: { K: '#14100c', H: '#2b1a12', h: '#432a1c', S: '#e0a982', s: '#c08a62', W: '#f4f2ea', E: '#2a1a10', G: '#1e1e26', N: '#27407a', n: '#1b2c56', L: '#f0c39c', R: '#b04a58' },
            viral: { name: 'GOING VIRAL', duration: 14, cooldown: 32, radius: 165, freeze: 2.5, bossFreeze: 1.2, vuln: 2, sound: 'assets/audio/kiya_viral.mp3', soundLen: 3.5 } },
  jeffry:  { name: 'Jeffry', tag: 'Rich man', hp: 110, speed: 1.0, damage: 1.05, firerate: 1.0, reload: 1.1, regen: 0, sprite: 'jeffry', portrait: 'jeffry_portrait',
            desc: 'An ordinary man in a work jacket. PAYDAY (Space): for 20 s he has an endless supply of money bags — RMB lobs one wherever you aim while LMB keeps shooting. It bursts into cash and every zombie in range drops what it was doing to scramble for it. 30 s recharge.',
            pal: { K: '#14100c', H: '#5a3a22', S: '#e8b892', s: '#c89a76', W: '#f4f2ea', E: '#2a1a10', J: '#3d5a3a', j: '#2a3f28', T: '#d8d4c8', P: '#2f3646', p: '#232836' },
            money: { name: 'PAYDAY', duration: 20, cooldown: 30, interval: 0.4, range: 360,
                     bag: { life: 7, radius: 250, hold: 1.1 } } },   // unlimited bags for the whole window; each one is a lure that pulls the horde off you
  jonny:   { name: 'Sonny Jeans', tag: 'Doctor · plumber · pilot', hp: 125, speed: 0.95, damage: 1.1, firerate: 0.95, reload: 1.0, regen: 0, sprite: 'jonny', portrait: 'jonny_portrait',
            desc: 'Doctor, plumber, pilot — Sonny Jeans has every licence there is and finished none of the shifts. MILK QUAKE (Space): he drives a fist into the ground and a flood of white bursts out of it; every zombie the wave touches is knocked flat and left twitching in the milk, taking double damage until it gets up. 10 s recharge.',
            pal: { K: '#14100c', S: '#edb894', s: '#a8836a', H: '#ffe0c0', W: '#f6f4ec', E: '#4a6a78', L: '#3173c9', l: '#204f92', B: '#1f5aa8', D: '#2b4a80', d: '#1d3560' },   // blue scrubs
            slam: { name: 'MILK QUAKE', cooldown: 10, windup: 0.4, radius: 330, damage: 70, stun: 3, bossStun: 1.2, wave: 0.7, sound: 'assets/audio/milk_quake.mp3' } },
  shark:   { name: 'Sharkjutta', tag: 'Apex predator', hp: 115, speed: 1.15, damage: 1.0, firerate: 1.0, reload: 1.0, regen: 0, sprite: 'shark', portrait: 'shark_portrait',
            desc: 'A shark that grew legs and bought running shoes. FEEDING FRENZY (Space): for 12 s he drops the gun and hunts — LMB lunges forward and whatever is in his jaws is swallowed whole. Every zombie eaten heals him. 30 s recharge.',
            pal: { K: '#12161a', G: '#5c6d79', g: '#3c4a54', W: '#d9dee3', T: '#f6f4ec', E: '#0d1013', B: '#1f9ada', b: '#1573a5', S: '#eef1f4' },
            shark: { name: 'FEEDING FRENZY', duration: 12, cooldown: 30, speed: 1.3, armor: 0.7,
                     bite: { cd: 0.42, lunge: 52, dur: 0.15, reach: 34, arc: 1.15, bossDamage: 240, heal: 8 } } },   // non-bosses go down the hatch whole
  cry:     { name: 'Cry XD', tag: 'Meme', hp: 100, speed: 1.0, damage: 1.0, firerate: 1.0, reload: 1.0, regen: 0, sprite: 'cry', portrait: 'cry_portrait',
            spriteImg: 'assets/img/cry_sprite.png', portraitImg: 'assets/img/cry_portrait.png',   // cut from the real meme, not redrawn
            desc: 'He is not okay. Never has been. CRY FLOOD (Space): he breaks down and the tears flood the street around him for 10 s — zombies caught in it are slowed to a crawl, swept back by the current and drown, while he keeps shooting. Nothing in the water can fire a shot. Bosses can wade in, slowly. 20 s recharge.',
            pal: { K: '#16160f', W: '#f2f0e8', w: '#c9c7bd', B: '#2f7fd8', b: '#7ab2ea', M: '#241a18', R: '#8c3a34', C: '#2c3340', c: '#1c222c' },
            cry: { name: 'CRY FLOOD', duration: 10, cooldown: 20, radius: 135, grow: 0.8, drain: 0.7,
                   slow: 0.3, bossSlow: 0.6, push: 46, bossPush: 12, dps: 14, pct: 0.02 } },   // regular zombies are held at the edge; bosses wade in
};
const CHARACTER_ORDER = ['rookie', 'runner', 'heavy', 'medic', 'drone', 'canimal', 'samay', 'spidermad', 'genom', 'frogepepe', 'bezuko', 'eggreck', 'videoman', 'kiya', 'jeffry', 'jonny', 'shark', 'cry'];

/* maps */
const MAPS = {
  city:       { name: 'Urban City',      desc: 'Wide streets, a central plaza and plenty of cover. Zombies pour in from every road. Parked cars can be driven.', tint: 'rgba(10,14,30,0.22)', cars: true },
  suburbs:    { name: 'Suburbs',         desc: 'Open lawns and scattered houses. Lots of room to run — and nowhere to hide.', tint: 'rgba(20,10,30,0.18)' },
  industrial: { name: 'Industrial Zone', tag: '☠ HORROR · PITCH BLACK', desc: 'The power is out. Your flashlight is all you have — they can see you, but you can\'t see them.', tint: 'rgba(5,10,20,0.3)', dark: true },
  lab:        { name: 'Research Lab',    tag: '⚠ RESTRICTED AREA', desc: 'A sealed underground facility — server halls, specimen tanks and tight corridors. They come in through the doors.', tint: 'rgba(20,40,70,0.16)' },
  race:       { name: 'Race City',       tag: '🏁 SPEEDWAY · BIG MAP', desc: 'A huge racing circuit — wide asphalt, curbs, pit lane and grandstands. Room to run (or drive). Nowhere to hide.', tint: 'rgba(10,14,30,0.18)', size: { w: 120, h: 75 }, house: true },
};
const MAP_ORDER = ['city', 'suburbs', 'industrial', 'lab', 'race'];

/* in-run supply cart — paid with coins collected during the run */
const CART = {
  ammo:   { shotgun: 25, smg: 30, rifle: 35, rocket: 60, magnum: 35, flamer: 35, minigun: 45 },   // full reserve refill
  weapon: { shotgun: 120, smg: 150, rifle: 180, rocket: 250, magnum: 160, flamer: 180, minigun: 220 },
  health: 20,      // +25 HP
  fullHeal: 50,
  heart: 20,       // +1 max heart (25 max HP), filled — still unlimited, but each one costs more than the last
  heartStep: 10,   // every heart bought this run adds this much to the next one's price
};

/* Research Lab BLACKOUT: wave 8 (and every 10 waves after) — lights out, giant armed zombies, giant player */
const BLACKOUT = { firstWave: 8, every: 10, zombieScale: 2, zombieHp: 2.5, zombieDmg: 1.5, playerScale: 2.2, shotDmg: 2.5, leap: 240, leapDmg: 160, leapCd: 2.5, gunDmg: 0.35 };
/* Wave 5 on every map: the lights die, and when the boss goes down something is waiting on the screen */
const DREAD = { wave: 5, img: 'assets/img/jumpscare.png', sound: 'assets/audio/jumpscare.mp3', hold: 2.1 };
function isBlackoutWave(mapId, wave) { return mapId === 'lab' && wave >= BLACKOUT.firstWave && (wave - BLACKOUT.firstWave) % BLACKOUT.every === 0; }

/* Race City siege: a haunted house in the infield is the wave objective */
const HOUSE = {
  hp: 3000, hpPerWave: 500, tw: 12, th: 8,
  spawnInterval: w => Math.max(0.35, 1.1 - w * 0.03), alive: 90,             // endless spawns, capped on screen
  guards: w => Math.min(20, 10 + w), guardHp: 150,
  cannons: 4, cannonHp: 700, cannon: { speed: 180, dmg: 40, range: 440, explosive: 46, cd: 3.4, cannon: true },
  guardGun: { speed: 190, dmg: 24, range: 380, pellets: 1, spread: 0.05, explosive: 34, flame: false, cd: 2.8, cannon: true },
  alertRadius: 230, bossScale: 1.35, bossHp: 1.3,
};

/* civilian cars (Urban City): get in, drive, ram, shoot out the window; they take the hits for you until they blow */
const CIVIL_CAR = { maxSpeed: 250, accel: 330, turn: 3.0, armor: 1, ram: 0.5, hp: 420, hpPerWave: 30, morph: 0, enterRange: 44 };

const PICKUPS = {
  health: { sprite: 'pickup_health', value: 25 },
  ammo:   { sprite: 'pickup_ammo' },
  coin:   { sprite: 'pickup_coin', value: 5, score: 5 },
  xp:     { sprite: 'pickup_xp', value: 12 },
  crate:  { sprite: 'pickup_crate' },
};
