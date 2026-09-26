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
| Runner | +28% speed, 75 HP. Ability **RUSH** (`Space`): his run sound (`assets/audio/runner_rush.mp3`) loops for the whole rush and fades out when it ends; 15 s of 1.8× speed, infinite ammo, no reloads, and every gun fires at minigun speed — even the Magnum and Rocket Launcher. 45 s recharge |
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
| Kiya Mhalifa | Glasses, braids, navy tee — and far too much attention. **GOING VIRAL** (`Space`, 14 s / 32 s recharge): her clip (`assets/audio/kiya_viral.mp3`) loops for the whole 14 s and a cyan ring of attention (165 px) opens around her with camera flashes popping on the edge; every zombie that steps inside stops dead and pulls out a phone to record (2.5 s frozen, 1.2 s for bosses, cannons jam too) and **takes double damage** while it films. Slightly faster fire rate and reload than most |
| Jeffry | An ordinary man in a green work jacket — 110 HP, slightly harder hitting, faster reload. **PAYDAY** (`Space`, 20 s / 30 s recharge): an endless supply of money bags. **RMB** lobs one wherever you aim while **LMB keeps shooting normally** (up to 360 px, one every 0.4 s, unlimited); it arcs through the air, bursts into scattering banknotes, and for 7 s every non-boss zombie within 250 px drops what it was doing and scrambles for the cash — they stop chasing you, stop biting and stop shooting, and mill around the pile fighting over it. Bosses ignore money |
| Sonny Jeans | Doctor, plumber, pilot — every licence there is and not one finished shift. Bald and grinning, stubbled jaw, blue medical scrubs: the toughest survivor without a transformation at 125 HP and 1.1× damage, 5% slower on his feet. **MILK QUAKE** (`Space`, 10 s recharge): a 0.4 s wind-up, then his fist goes into the ground with his clip (`assets/audio/milk_quake.mp3`) and a wall of white floods out to 330 px — up to 70 damage with falloff, the ground is left soaked in milk, and every zombie caught is knocked flat for 3 s (1.2 s for bosses, cannons jam too) taking **double damage** while it lies there |
| Sharkjutta | A shark that grew legs and bought running shoes. 115 HP, 1.15× speed. **FEEDING FRENZY** (`Space`, 12 s / 30 s recharge): he drops the gun and hunts — 1.3× speed, 30% damage resistance, and **LMB lunges 52 px forward and swallows whatever is in his jaws whole**. Any non-boss zombie in the bite arc dies outright regardless of HP and heals him 8 HP each; bosses are too big to swallow and take 240 instead. Roughly 2.4 bites a second | Looks: the shark-in-sneakers meme — the 60×60 portrait (`assets/img/shark_portrait.png`) is the picture redrawn in pixels (eye repainted), the 16×16 sprite is hand-placed side-on facing right (forked tail, dorsal fin, white belly, legs, blue sneakers) and mirrors when aiming left. | Cry XD | The crying wojak, cut straight from the real meme rather than redrawn: the portrait is the actual face (background removed, 60px) and the in-game sprite is that same face at normal head size on a full pixel body (dark shirt, pale hands, trousers, shoes); the portrait is head and shoulders. Loaded from `assets/img/cry_*.png` over the pixel placeholder once the images arrive. **CRY FLOOD** (`Space`, 20 s / 20 s recharge): he breaks down — his crying clip (`assets/audio/cry_flood.mp3`) loops for the whole 20 s, fades out when the flood ends and goes quiet while paused — and the tears flood the street around him — a 135 px pool that follows him, with ripples and a foaming edge. Zombies in the water are slowed to 30% and swept outward by a 46 px/s current, so regular zombies get pinned at the edge and can't bite; everything within reach of the edge drowns (14 dps + 2% of max HP per second). Bosses wade in at 60% speed against a weak current. **Nothing standing in the water can fire** — guns, boss bursts and aimed shots, Bona's magma, Sahur's bat and drums, and haunted-house cannons are all silenced while submerged. Zombies in the water visibly drown: sunk to the chest behind a ring of water, bobbing, dipping under and coming up, arms thrashing, bubbles rising. Anything that dies in it goes under with a GLUG instead of splattering, and a drowned exploder's fuse fizzles out. He keeps his gun the whole time, the street stays wet afterwards, and the pool drains away over 0.7 s |
| BlackEgg | The egg-man meme redrawn in pixels: an egg with a face, eyes calmly closed, chin resting in white cartoon gloves, on thin legs and brown shoes. The 60×60 portrait (`assets/img/blackegg_portrait.png`) is the meme traced to a hand-drawn egg/glove/arm outline and snapped to a 12-colour palette; the 16×16 sprite is hand-placed in `js/sprites.js`. Balanced stats. **EGG ROLL** (`Space`, 20 s / 25 s recharge): a dubstep saw (`assets/audio/blackegg_roll.mp3`) loops for the whole roll, fades out when it ends and goes quiet while paused; he tucks in (a separate tucked-egg sprite, spinning as it rolls) and launches toward the cursor. WASD steers with momentum; let go and he coasts and slows; he bounces off walls. Above crush speed every regular zombie he touches is crushed flat (silent kill + splat, still pays score/XP/drops); bosses take 70 and knock him back (0.6 s per-boss hit cooldown). No gun while rolling, 60% damage reduction, dust and speed streaks, `EGG ROLL` weapon panel |
| Giga Ballerina | The runway meme redrawn in pixels: flat-top head, eyes glowing like hot coals, a big grin, pastel-blue cardigan, cream silk bow, pink pleated tutu, muscular calves and white knee socks. The 60×60 portrait (`assets/img/giga_portrait.png`) is the meme traced to a hand-drawn head/cardigan outline and snapped to a 16-colour palette, with the eye glow detected in the photo and repainted as hot pixels with an orange halo so it survives the shrink; the 16×16 sprite is hand-placed in `js/sprites.js`. Balanced stats. **PIROUETTE** (`Space`, 10 s / 20 s recharge): his song (`assets/audio/giga_spin.mp3`) plays from the first turn, loops if the spin outlasts it, fades out the moment the spin ends and goes quiet while paused; he spins on the spot (the sprite squashes through its side view and flips at the back, ~2.7 turns/s) inside a 60 px blade ring (three sweeping arcs, pink tutu blur, sparkles). Every 0.15 s everything in the ring is sliced: 24 per cut to regular zombies, 12 to bosses (quiet hits, so the screen isn't buried in numbers), flung outward, blood flying off tangentially (synth whooshes only if there's no song). He can still walk at 90% speed; no gun, 40% damage reduction. `PIROUETTE` weapon panel |
| Doge | The Doge soldier redrawn in pixels: Shiba Inu in "deal with it" pixel shades, camo neck gaiter, tan plate carrier with magazine pouches and a radio on the shoulder. The 60×60 portrait (`assets/img/doge_portrait.png`) is the picture traced to a hand-drawn head/shoulder/antenna outline and snapped to 16 colours, with the shades redrawn pixel by pixel (they don't survive the shrink); the 16×16 sprite is hand-placed in `js/sprites.js`. Balanced stats. **AIRSTRIKE** (`Space`, 25 s recharge): a radio chirp and "BRAVO SIX, GOING IN"; the strike lands on the cursor (clamped to 360 px), marked by a pulsing red ring, crosshairs, red flare smoke and a dashed bomb line while the beeps speed up. 1.5 s later a jet (with its shadow racing across the ground) flies in along your line of sight and drops 7 bombs 26 px apart, 0.09 s between each: 44 px blasts for 160 damage (× his damage multiplier). The bombs are friendly (`explode(..., safe)`): they never hurt him or his allies, and he keeps shooting throughout |
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

  **Scare spots** (`SCARE_SPOTS` in `js/config.js`) are places on a map that something jumps out of. Each fires at
  most once per wave (only on its listed `waves`, if it has them), through the same jumpscare as wave 5 but in colour,
  with its own face, scream, brightness and contrast; face and scream are loaded when a wave it can fire on starts.

  **Urban City — the pool.** A backyard pool sits between the two buildings below the plaza: stone coping, murky water
  going darker toward the deep end, slow caustics, a ladder, and a long pale shape sliding underneath. Wading slows you
  to 60% and splashes, with rings round your legs. Step in on any wave (once per wave) and the fish comes up
  (`assets/img/pool_face.webp`, `assets/audio/pool_scream.m4a`: the first 2.6 s of the clip, turned down and faded).

  **Research Lab — the hole.** A pit is torn into the floor of the bench room (the `hole` spot,
  between the third pair of lab benches): a broken tile lip, cracks running out into the floor, the shaft's far wall
  fading into black, a breath of mist, and every ~7 s two pale eyes blink open down there. It's always there, but only
  on waves **1, 7, 10, 20, 25, 67, 99, 120 and 170** (`LAB_HOLE.waves`) does stepping into it do anything: once in each
  of those waves, the face (`assets/img/lab_hole_face.png`, shown in
  colour) jumps out with a scream (`assets/audio/lab_hole_scream.m4a`, the first 2.6 s of the clip, faded) through the
  same jumpscare as wave 5. Both are loaded when a scare wave starts, so the scare can't stall.

  **Wave 5 — THE LIGHTS DIE.** On every map the power fails for the whole wave (flashlight only, lamps flickering,
  the dark ambient track). When you kill the wave's last boss, the face hits 0.15 s later (`DREAD.delay`; `assets/img/jumpscare.png` +
  `assets/audio/jumpscare.mp3`): it flies at the screen out of the dark, from tiny to past full size in ~0.13 s, and
  the scream lands on the same frame (the clip is decoded into an AudioBuffer and the face image decoded when the
  wave starts, so nothing loads at the moment of the scare), with a sub-bass drop and a static burst. For the 2.1 s
  hold the face jolts violently (a decaying random shake), red and cyan ghost copies of it jitter out of sync, TV
  static crawls over it, red flashes pulse at the edges, and it keeps creeping closer. When it vanishes the game
  itself shakes and flickers. (`DREAD.glimpse` > 0 would first show it standing far off in the dark; it's 0 because
  that pause read as loading.) Then the lights come back on wave 6. Respects `prefers-reduced-motion` (no rush or shake). The face and the sound are both preloaded when the
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

### Horror House (painted map)

The whole map is one hand-painted image (`assets/img/horror_map2.webp`, 1760×880 = 110×55 tiles, WebP q94 ≈ 234 KB; the old lossless file was 1.1 MB) of a
blood-soaked plaza at night: four tree planters, crates, abandoned cop cars, burning wrecks on the corners and
street lamps. It's colour-graded for horror — shadows and midtones sunk and pulled toward a cold blue-teal, colour
drained from everything except lamplight and fire (which stay warm and bright as the only real light), blood kept
red, and a vignette closing in on the edges.
Collision is authored by hand as tile rectangles in `MAPS.horror.layout` — `walk` carves out the roads, sidewalks
and plaza, `block` puts back the planters, crates, parked cars, the flipped car, the barrier and the wrecks — so
you and the zombies path around exactly what's in the picture. The layout also places 7 edge spawns, 3 animated
fire emitters over the painted fires, and 6 lamps (used for lighting during blackouts). The map-select card and
minimap are the painting itself. Any map can do this: give it `image` + `layout` and `GameMap.genImage()` builds it.

## Title screen

The title screen sits over **Horror House** (`MENU_MAP` in `js/config.js`), whatever map you last played:

- The menu shows a lighter grade of the same painting (`menuImage`, `assets/img/horror_menu.webp`), so the plaza
  reads clearly; gameplay keeps the dark grade. Only a soft vignette goes on top. (For a tile-built map like Urban
  City it instead composites a cool tint, warm lamp pools and headlight cones over the lit map.)
- The whole painting is cover-fitted to the window (`resize()` drops the integer pixel scale while the menu is up),
  with the camera drifting gently. The integer scale comes back the moment a run starts.
- Eleven zombies shuffle around the picture for atmosphere, and the painted fires burn and smoke.
- `MEME` is cracked bone-white text with blood splatter: an SVG texture (`assets/img/title_meme_fx.svg`) clipped to
  the glyphs through a `data-text` pseudo-element, laid over the solid extruded text. `SURVIVAL` is painted art
  (`assets/img/title_survival.webp`): the cracked, wet, dripping lettering keyed out of the title mockup.
- `PLAY` is a grungy dark plate (`assets/img/grunge.svg`) inside a flickering red neon frame, `SETTINGS` the same
  plate with a gear. The controls sit along the bottom with every key in its own cap and mouse icons for aim/shoot.

Starting a run hands the map back to whatever you actually chose.

## Image-based characters

A character can point `spriteImg` / `portraitImg` at a PNG in `assets/img/`. `Sprites.loadImageArt()` swaps it into the sprite cache over the pixel-art placeholder when it loads, rebuilds the tint and flash variants from it, and repaints the character card. Cry XD was the first one.

Frogepepe uses it too: the Feels Good Man face redrawn as pixel art rather than pasted in. The 60×60 portrait is the meme
snapped to a fixed 8-colour palette, with the outlines kept and the pupil shine placed by hand. The 16×16 sprite is
hand-placed: heavy lids over the whites, pupils tucked under them, the brown lips and the blue shirt. His FROG OUT
transformation still uses the pixel-map frog in `js/sprites.js`.

## Development

- No build step: edit the files and reload.
- `./bump.sh` bumps the `?v=` cache tag on every script and stylesheet in `index.html`. Run it after any change to `js/` or `css/` so nobody gets a half-stale build.
- The game auto-pauses when the window loses focus mid-run.

## itch.io build

Published at **https://memesurvival.itch.io/meme-survival**. The site links to it (ITCH.IO inside the title screen's ☰ MENU, and
every site page's footer) and lists it as `sameAs` on the `Organization` and `VideoGame` JSON-LD, so Google treats both
as the same game.


`python3 tools/build_itch.py` writes `dist/meme-survival-itch.zip` (git-ignored) for itch.io's "played in the browser"
upload. itch serves the game from a zip inside an iframe on its own domain and in a sub-folder, so the script copies
the game and rewrites `index.html`: root-relative preloads become relative, favicon/manifest links are dropped, and the
title-screen menu links point at memesurvival.com in a new tab. Website-only images are left out. Re-run it and
re-upload after each update. On itch: tick **This file will be played in the browser**, viewport **1280 × 720**,
**Fullscreen button** on.

## Loading: a still first, then it comes alive

The first visit never shows a black screen:

1. **First frame.** A 348-byte blurred copy of the title background is baked into `index.html` (`#still .still-blur`),
   and the logo, PLAY and SETTINGS are plain HTML, so the title is there the moment the page opens.
2. **The still.** `horror_menu.webp` is preloaded in the `<head>` with high priority and shown sharp by CSS
   (`.still-sharp`), sized exactly like the menu's cover-fitted canvas (`max(1760px, 100vw, 200vh)`, centred). PLAY
   and SETTINGS stay dimmed and unclickable until the code is up (`html.ready`).
3. **Alive.** The canvas starts invisible. Once the menu scene has drawn a frame with the real art,
   `Game.comeAlive()` adds `html.alive` and the live scene (wandering zombies, fire, drift) fades in over the still in
   0.45 s. The camera drift is held at dead centre until then, so the live frame lines up with the still to the pixel.
   A 6 s safety net in `main.js` shows the canvas regardless.

Also for speed: map pictures are loaded in order (title art first, the gameplay map after, so it can't slow the
title); map pictures have no `?v=` (they're immutable: a changed picture gets a new file name, which is also what lets
the `<head>` preload be reused); scripts load with `defer` from the `<head>`; fonts are self-hosted in `assets/fonts/`
(Press Start 2P and IBM Plex Mono, both SIL Open Font License, latin subset) instead of Google Fonts; and `vercel.json`
lets browsers keep `js/` and `css/` for a year because every release changes their `?v=` (so **always run
`./bump.sh`** after editing them).

## SEO

The live site is **https://www.memesurvival.com/** (the bare domain 308-redirects there). Everything search engines
and link previews read:

- `index.html` head: title ("Meme Survival Game — …", matching the search), description, canonical URL, Open Graph / Twitter card tags (`assets/img/og-image.jpg`,
  1200×630), favicons, and `VideoGame` JSON-LD structured data. The logo is the page's `<h1>`.
- The game logo (`assets/img/logo-round.png`, from the Doge/Pepe key art) is the favicon at every size (`favicon.ico`,
  `favicon-32/48/96.png`, `apple-touch-icon.png`, `icon-round-192/512.png`) — Google shows it next to the site in results —
  and is the `logo` in the `Organization` JSON-LD.
- `robots.txt` + `sitemap.xml` at the root; `manifest.webmanifest` for install/home-screen.
- **Site pages** — `/characters`, `/bosses`, `/maps`, `/faq` and `/updates` (static `*.html`, served clean by `cleanUrls`)
  give Google real text for "meme survival game" and long-tail searches (every character, boss and map by name). They
  are **generated** by `python3 tools/build_site.py`, which reads the character, boss and map facts live from
  `js/config.js`, so re-run it after adding or changing a character, boss or map. The FAQ answers (`QA`, with matching
  `FAQPage` JSON-LD) and the changelog (`UPDATES`) are edited in that script, never in the HTML. Each page has its own
  title/description, canonical, `ItemList` + `BreadcrumbList` JSON-LD, and the shared menu; the title screen links
  to them (top-right ☰ MENU, a `<details>` dropdown that works before the code loads; `main.js` closes it on an outside click or Esc) and they're all in `sitemap.xml`. Pictures are in `assets/img/site/` (links carry a content fingerprint `?v=`, so a redrawn picture is never stuck in the year-long cache): portraits, boss
  sprites and map previews exported from the game's own renderer (new characters need their portrait exported there too).
- **`/play`** (`www.memesurvival.com/play`) is a Vercel rewrite to the same page; `js/main.js` sees the path and opens
  character select straight away (use `?play` on a local server). Its canonical still points at the homepage, so
  Google doesn't count it as a duplicate. `/play/` redirects to `/play`.
- `vercel.json` 301s `meme-survival.vercel.app` to the real domain; the canonical tag covers the GitHub Pages copy.
- Google Search Console owns `https://www.memesurvival.com/` through the `google-site-verification` meta tag in
  `index.html`. **Don't remove it**, or the site loses verification. The sitemap is submitted there.
- If the title or description changes, update `og:title`/`og:description`/`twitter:*` and the JSON-LD to match, and bump
  `<lastmod>` in `sitemap.xml` after a big update.
