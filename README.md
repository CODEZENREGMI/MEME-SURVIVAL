# Meme Survival

A full-screen, top-down pixel-art zombie shooter for the browser. No build step, no dependencies.

## Run it

Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8765
```

then visit <http://localhost:8765>.

## Flow

**Title → Choose Survivor → Choose Weapon → Choose Map → Play.** Your last loadout is remembered.

| Survivor | Trait |
|----------|-------|
| Rookie | Balanced |
| Runner | +28% speed, 75 HP. Ability **RUSH** (`Space`): 15 s of 1.8× speed, infinite ammo, no reloads, and every gun fires at minigun speed — even the Magnum and Rocket Launcher. 45 s recharge |
| Heavy | 160 HP, +15% damage, slow. Ability **SQUAD** (`Space`): calls in 6 clones of himself for 20 s — they follow in formation, shoot zombies with SMGs, and zombies/bosses target them too. 35 s recharge |
| Medic | Regenerates health, health packs heal double. Ability **MED FIELD** (`Space`): a green healing aura around him for 20 s, restoring 12 HP/s steadily (about a heart every 2 s); also heals clones inside it. 45 s recharge |
| Canimal | A robot in disguise. Ability **ROLL OUT** (`Space`): transforms into an armoured red-and-blue truck for 25 s — WASD = the direction you want to go (the truck swings its nose toward it, brakes first if you reverse), momentum and drifting, ram zombies for speed-based damage, and two **M249 turrets** on the window sides that rotate 360° to follow your mouse and fire alternately with infinite ammo. 40% damage resistance, headlights on the horror map. 45 s recharge |
| Samay Naina | Ability **CHAI TAPRI** (`Space`): his song (assets/audio/chai_tapri.mp3) plays and a red circle surrounds him for 30 s — every zombie that steps in gets stuck in a spider web for 5 s (bosses 2.5 s) and takes **double damage** while webbed; Race City's cannons get webbed (jammed) too. 50 s recharge |
| Spider Mad | The meme spider. Ability **WEB ZIP** (`Space`, infinite): fires a web toward the cursor (up to 300 px, stops at walls or the first zombie) and yanks him to it at 820 px/s; landing next to zombies kicks them for 70 dmg. 0.3 s between zips. **WEB PULL** (`F`, 6 s recharge): yanks the zombie under your cursor (or nearest along your aim) to you at 900 px/s and freezes it in web for 3 s (takes double damage); bosses can't be pulled but get webbed for 1.5 s |
| Genom | The Venom meme. **T** bonds with the symbiote (no time limit, **T** again to shed it): a black tendril-wrapped transformation, then 8 hearts, 45% damage resistance, faster, and no guns — **LMB sprays a continuous stream of black symbiote** (infinite, pierces, poisons, stains the ground), **RMB claws** (110 dmg swipe). **R = CAPTURE**: pick a boss within 340 px and drown it in liquid symbiote for 10 s; if it survives, it becomes a black-and-white **Venom ally** that follows you and attacks everything — zombies, the haunted house and its cannons — with heavy melee and its own weapon for the rest of the run. 30 s recharge |
| Frogepepe | The Pepe meme. **FROG OUT** (`Space`, 30 s / 20 s recharge): he balloons into a giant frog with 7 hearts, 40% damage resistance and 1.35× speed. **LMB = TONGUE**: a hitscan lash (240 px) that hits the first zombie on your aim line for 75 dmg and yanks it toward you; a kill is a meal (+6 HP). **Space = HOP** (1.3 s): leaps up to 220 px onto the cursor and squashes everything under the landing (130 dmg in 80 px, also damages the haunted house). **R = FROG ARMY** (15 s, 40 s recharge, frog form only): releases 10 small froglings that hop straight onto the nearest zombies and rip the head off on landing — non-bosses die outright, bosses take 180 per bite — then bounce to the next; they have 60 HP each, dodge while airborne, and circle you when nothing is left |
| Bezuko | The thug-life demon-girl meme (pixel shades on her head, bamboo in her mouth, tongue out). **AWAKEN** (`Space`, 20 s / 35 s recharge): vines crawl over her, her eyes glow and she bursts into her awakened demon form — horn, vine marks, fangs, 2× size — with 8 hearts, 50% damage resistance, 1.3× speed and 8 HP/s regeneration. Her song (`assets/audio/bezuko_song.m4a`) plays for the whole 20 s and a big pink **circle of music** (150 px) surrounds her: every zombie inside it is charmed — it walks straight to her, can't bite or shoot, and bosses drop their special attacks. **LMB = DEMON KATANA**: the red-bladed sword from the figure; one swing cuts everything in a wide arc in front of her for 320 dmg and sets it burning pink (0.28 s between swings; also cuts cannons and the haunted house). **RMB / Space = DEMON KICK** (1 s): a 120 px dash that boots every zombie in the path for 160 dmg with huge knockback |
| Eggreck | Shrek in an egg (the Shrek-Wazowski meme). **VANISH** (`Space`, 20 s / 20 s recharge): he turns invisible — every zombie, boss and haunted-house cannon loses him completely (zombies shuffle around aimlessly, bosses drop their attacks, cannons stop tracking; if he has clones out they target those instead) — while he keeps moving and shooting normally the whole time. Drawn translucent with a dashed outline so *you* can still see him. Shots already in the air can still hit him. **MY WIFE** (`E`, 20 s / 20 s recharge; his weapon ability, e.g. minigun OVERDRIVE, moves to `F`): his ogre wife (green dress, red hair, crown) appears at his side and holds a shield bubble over him — every bite, cannon shell and boss shot is BLOCKED (bullets shatter on the bubble) for the full 20 s while he keeps fighting; the two abilities stack |
| Videoman | The "tu video kahe bana raha hai bhai" meme. **LAVA STONES** (`Space`): his clip (`assets/audio/videoman.m4a`, 11.2 s) plays, and for exactly as long as it runs LMB hurls glowing lava rocks in an arc that sail over the horde and land where you aim (up to 340 px, one every 0.32 s, infinite): each one explodes for 70 dmg in a 46 px blast and sets everything nearby burning for 3 s. Ends when the clip ends; 50 s recharge |
| Kiya Mhalifa | Glasses, braids, navy tee — and far too much attention. **GOING VIRAL** (`Space`, 14 s / 32 s recharge): her clip plays (`assets/audio/kiya_viral.mp3`) and a cyan ring of attention (165 px) opens around her with camera flashes popping on the edge; every zombie that steps inside stops dead and pulls out a phone to record (2.5 s frozen, 1.2 s for bosses, cannons jam too) and **takes double damage** while it films. Slightly faster fire rate and reload than most |
| Jeffry | An ordinary man in a green work jacket — 110 HP, slightly harder hitting, faster reload. **PAYDAY** (`Space`, 20 s / 30 s recharge): an endless supply of money bags. **RMB** lobs one wherever you aim while **LMB keeps shooting normally** (up to 360 px, one every 0.4 s, unlimited); it arcs through the air, bursts into scattering banknotes, and for 7 s every non-boss zombie within 250 px drops what it was doing and scrambles for the cash — they stop chasing you, stop biting and stop shooting, and mill around the pile fighting over it. Bosses ignore money |
| Drone | A boy who **TRANSFORMS** (`Space`) into a hulking brute for 35 s: screen-shaking transformation with a shockwave, then he wields the **Flesh Cannon** (LMB: 3-shot bursts at minigun speed, 420 rounds — refilled by 20 kills while transformed; never sold or dropped), right-click to smash (150 dmg swipes), `Space` to leap onto zombies (area crush). 60% damage resistance, faster. 50 s recharge |

**Weapons:** every survivor picks a **3-weapon loadout** from Shotgun · SMG · Rifle · Rocket Launcher ·
Magnum · Flamethrower (sets zombies on fire) · Minigun. The Pistol (infinite reserve) is always in your
holster as a 4th backup slot. Weapons you didn't bring drop in supply crates during the run.

**Maps:** Urban City (parked cars can be driven: walk up to one and press `G` / click GET IN — WASD = direction to drive, shoot out the window, ram zombies; the car soaks up damage and explodes when wrecked; every parked car has its own HP too — zombies chew through cars in their way and explosions wreck them) · Suburbs · **Research Lab** (a sealed underground facility: server hall, specimen tanks, offices, storage, restrooms, corridors — zombies come in through four doors; on **wave 8** — and every 10 waves after — the lab suffers a **BLACKOUT**: the lights die, zombies come in giant-sized and armed with random guns, and you go giant too with 2.5× shots, a crushing leap and every weapon in the game handed to you) · **Race City** (a 1.5× bigger speedway: a wide oval circuit with red-and-white kerbs, a checkered start line, pit lane and garages, a paddock full of race cars, grandstands, tyre walls on the corners and a parking lot). Race City is a **siege**: a haunted house in the
  infield (3000 HP, +500 per wave) spawns zombies endlessly and the wave only ends when you destroy it.
  10–20 zombie soldiers with hand cannons guard it and chase you when you get close, four cannon
  emplacements (destructible) shell you from range, bosses are 35% bigger, and sandbag / concrete cover
  rings the house — enemy shells can't pass it) · **Industrial Zone (horror)** — the power is out: pitch black except your
flashlight (blocked by walls), burning barrels and a few flickering lamps. Zombies are invisible until
your beam hits them; only their glowing eyes give them away.

## Controls

| Key | Action |
|-----|--------|
| `W A S D` / arrows | Move |
| Mouse | Aim |
| Left click | Shoot |
| `R` | Reload |
| `1`–`4`, `Q`, scroll wheel | Switch weapon slot |
| `B` / `Tab` (or click the cart) | Open the supply cart |
| `E` / `Space` (or click the button) | Weapon ability — Minigun **OVERDRIVE**: 15 s of infinite fire, 35 s recharge |
| `ESC` | Pause |
| `F` (Shift+F as Spider Mad) | Fullscreen |

## Gameplay

- Enemies: Normal, Fast, Tank and Exploder zombies plus a summoning **Boss**.
- Waves: 1–5 normal · 6–10 fast · 11–15 tank · 16–20 explosive · 20+ everything.
- **A boss every wave.** Bosses scale in HP, damage, speed and fire rate with the wave number and
  new kinds unlock as you go: Brute (charges) → Gunner (SMG bursts) → Shotgunner → Rifleman (laser
  sight, then a sniper shot) → Rocketeer → Flamer → Warlord (minigun + charge + summons). Every 10th wave has its own unique milestone boss: **10 – Warlord** (minigun), **20 – Ravager**
  (a hunched red demon with a cannon in each hand: single shells, five-shell salvos, a leap with a landing
  shockwave, and a roar at half HP that summons fast zombies), **30 – Bona** (a mountain of black rock with
  fire glowing through its cracks and a jaw full of teeth; the lights go out on every map while it lives — it walks you
  down, roars and charges through cars and zombies alike, rears up for a ground slam that hits everything within
  125 px, spits a fan of burning rock, and at 40% HP the rock cracks open: faster, meaner, and it calls fast zombies),
  **40 – Kraken** (a giant octopus with twin
  miniguns, spiral sprays and a tentacle slam), **50 – Tung Tung Sahur** (the wooden log with the bat: a 1.5×-damage
  bat swing up close, TUNG TUNG TUNG — three ground pounds that each send out a shockwave ring, a boomerang bat that
  flies out to you and back, a sahur call that summons the horde every 12 s, and at half HP "SAHUR!!!" — 1.4× speed
  and five fast zombies). Unassigned milestones (60 …) reuse an earlier one. Two bosses
  from wave 25, three from wave 40. The wave doesn't end until the boss is dead.

  **Wave 5 — THE LIGHTS DIE.** On every map the power fails for the whole wave (flashlight only, lamps flickering,
  the dark ambient track). When you kill the wave's last boss, the screen is taken over by a full-screen shaking
  face with a scream (`assets/img/jumpscare.png` + `assets/audio/jumpscare.mp3`, ~2 s — the clip is fetched and
  decoded into an AudioBuffer when the wave starts, so it fires on the exact frame the face appears, with a sub-bass
  drop under it), then the lights come back
  on wave 6. Respects `prefers-reduced-motion` (no shake). The face and the sound are both preloaded when the
  wave starts, and the scare fires whether the last boss is killed **or** captured by Genom. On any dark map the HUD panels switch to an opaque
  background with a bright border so hearts, ammo, the cart, the weapon box and the ability slots stay readable
  against pure black.
- Pickups: Health, Ammo, Coins, XP.
- **Supply cart:** coins you collect during the run are spent in the cart (`B`, or click the cart
  icon in the HUD) — refill a weapon's reserve ammo, buy a health pack / full heal, buy extra max hearts (20 coins each, no limit), or buy a weapon
  you didn't bring. The game pauses while the cart is open.
- After every wave (and every XP level-up) choose one upgrade: **+ Damage**, **+ Fire Rate**,
  **+ Max Health**, **+ Movement Speed**.
- High score, best wave, loadout and settings are saved in `localStorage`.

## Admin panel (hidden)

Press **Ctrl+Shift+A** (Cmd+Shift+A on Mac, or the ` backtick key) to open a developer panel: jump to any wave, spawn any boss or a batch of zombies,
god mode, infinite ammo, coins, full heal, all guns, reset ability cooldowns, force a level-up.
Any run that touches it is marked as an admin run and never saves a high score.

## Files

```
index.html      canvas + overlays (title, setup wizard, pause, level-up, game over, settings)
css/style.css
js/sprites.js   pixel-art sprites & procedural props
js/config.js    weapons / enemies / waves / upgrades / characters / maps
js/audio.js     WebAudio synthesized SFX + ambient loop
js/map.js       three map generators, collision, flow-field pathfinding, minimap
js/entities.js  Player, Zombie, Bullet, Pickup, Particle
js/game.js      game loop, waves, spawning, combat, camera, HUD
js/ui.js        title, loadout wizard, overlays, settings, save/load
js/main.js      bootstrap
```

## Development

- No build step: edit the files and reload.
- `./bump.sh` bumps the `?v=` cache tag on every script and stylesheet in `index.html`. Run it after any change to `js/` or `css/` so nobody gets a half-stale build.
- The game auto-pauses when the window loses focus mid-run.
