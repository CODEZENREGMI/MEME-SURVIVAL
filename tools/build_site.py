"""Builds the static site pages from the game's own data (run from the repo root: python3 tools/build_site.py).

faq.html, characters.html, bosses.html, maps.html and updates.html share one design and one menu. Character, boss and
map facts are read live from js/config.js, so the pages can't drift from the game. Edit the FAQ answers (QA) and the
changelog (UPDATES) here, never the generated HTML. Pictures live in assets/img/site/ (exported from the game's own
renderer: portraits, boss sprites and map previews).
"""
import json, re, html, subprocess
U = 'https://www.memesurvival.com/'
E = html.escape

# ------------------------------------------------------------------ game data, straight from js/config.js
GAME = json.loads(subprocess.check_output(['node', '-e', r"""
global.window = {}; global.document = { querySelector: () => null };
const fs = require('fs'); eval(fs.readFileSync('js/config.js', 'utf8').replace(/^const /gm, 'var ').replace(/^let /gm, 'var '));
const chars = CHARACTER_ORDER.map(id => { const c = CHARACTERS[id];
  const abilities = Object.values(c).filter(v => v && typeof v === 'object' && typeof v.name === 'string').map(v => v.name);
  return { id, name: c.name, tag: c.tag, desc: c.desc, hp: c.hp, speed: c.speed, damage: c.damage, firerate: c.firerate, abilities }; });
const bosses = {}; for (const k in BOSSES) { const b = BOSSES[k]; bosses[k] = { name: b.name, desc: b.desc, hp: b.hp, minWave: b.minWave, special: !!b.special }; }
const maps = MAP_ORDER.map(id => ({ id, name: MAPS[id].name, tag: MAPS[id].tag || '', desc: MAPS[id].desc }));
console.log(JSON.stringify({ chars, bosses, milestones: MILESTONE_BOSSES, maps, dread: DREAD.wave }));
"""]))
N = len(GAME['chars'])

# ------------------------------------------------------------------ FAQ answers (visible text and FAQPage data come from here)
QA = [
 ("What is Meme Survival?", "what-is-meme-survival",
  "<p><strong>Meme Survival</strong> is a free top-down pixel-art zombie survival shooter that you play right in your browser. "
  "You pick a survivor from a cast of meme characters, choose three weapons and a map, then hold out against endless waves of zombies "
  "that get faster, tougher and stranger the longer you last, with a boss waiting every 10 waves.</p>"
  "<p>Every survivor has a special ability, from flooding the street with tears to summoning an army of frog clones, so each run plays differently. "
  "Your goal is simple: survive as many waves as you can and beat your high score.</p>"),
 ("What is the best zombie survival game?", "best-zombie-survival-game",
  "<p>It depends on what you want. If you're after a big PC or console game, fans usually point to classics like <em>Left 4 Dead 2</em>, "
  "<em>Project Zomboid</em>, <em>7 Days to Die</em> and <em>Dying Light</em>, but they cost money, take a big download and a good machine.</p>"
  "<p>If you want a zombie survival game you can play <strong>right now, for free, with no download</strong>, Meme Survival is built for exactly that. "
  "It loads in seconds in your browser, a run takes minutes, and 21 meme survivors with wild abilities keep it fun to replay. "
  "The best way to decide is to try it: <a href=\"/play\">play Meme Survival now</a>.</p>"),
 ("Is Meme Survival free? Do I need to download it?", "free-no-download",
  "<p>Yes, Meme Survival is <strong>completely free</strong>. There's nothing to download or install and you don't need an account. "
  "Open <a href=\"/\">memesurvival.com</a> in Chrome, Edge, Firefox or Safari on a computer and start playing.</p>"),
 ("How do you play Meme Survival? What are the controls?", "how-to-play-controls",
  "<p>Pick a survivor, choose three weapons (the pistol is always there as a backup) and pick a map. Then survive: zombies come in waves, "
  "and between waves you can spend the coins you earn in the shop.</p>"
  "<ul><li><kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd>: move</li>"
  "<li><strong>Mouse</strong>: aim, <strong>click</strong> to shoot</li>"
  "<li><kbd>R</kbd>: reload</li>"
  "<li><kbd>1</kbd>–<kbd>5</kbd> or the scroll wheel: swap weapons</li>"
  "<li><kbd>Space</kbd>: use your survivor's special ability</li>"
  "<li><kbd>Esc</kbd>: pause, <kbd>F</kbd>: fullscreen</li></ul>"),
 ("What characters can I play in Meme Survival?", "characters",
  "<p>There are <strong>21 survivors</strong>, each with their own stats, and most with a special ability. A few favourites:</p>"
  "<ul><li><strong>Cry XD</strong>: cries a flood. Zombies in the water can't shoot, slow down and drown.</li>"
  "<li><strong>Frogepepe</strong>: transforms into a frog and spawns an army of small frog clones.</li>"
  "<li><strong>Sharkjutta</strong>: an apex predator that eats zombies whole.</li>"
  "<li><strong>Sonny Jeans</strong>: doctor, plumber and pilot who punches the ground and sends a milk quake through the horde.</li>"
  "<li><strong>Eggreck</strong>: turns invisible and calls in his wife as a shield.</li>"
  "<li><strong>BlackEgg</strong>: tucks into a rolling egg and crushes every zombie in his path flat.</li>"
  "<li><strong>Giga Ballerina</strong>: spins in a pirouette while a ring of blades slices every zombie around him.</li>"
  "<li><strong>Bezuko</strong>, <strong>Spider Mad</strong>, <strong>Genom</strong>, <strong>Videoman</strong> and more, plus classic soldiers like the Rookie, Runner, Heavy and Medic.</li></ul>"),
 ("What maps and bosses are in Meme Survival?", "maps-and-bosses",
  "<p>There are <strong>6 maps</strong>: Urban City, Suburbs, Industrial Zone, Research Lab, Race City and the hand-painted <strong>Horror House</strong>.</p>"
  "<p>Every 10 waves a boss arrives: <strong>Warlord</strong> at wave 10, <strong>Ravager</strong> at 20, <strong>Bona</strong> at 30, "
  "<strong>Kraken</strong> at 40 and <strong>Tung Tung Sahur</strong> at 50. And watch out for wave 5, when the lights go out.</p>"),
 ("Does Meme Survival save my progress? Can I play on my phone?", "saves-and-devices",
  "<p>Your high score, best wave, loadout and settings are saved automatically in your browser on the device you play on. "
  "Clearing your browser data resets them.</p>"
  "<p>Meme Survival is made for <strong>computers with a keyboard and mouse</strong>. It can open on a phone or tablet, but there are no touch controls, "
  "so for the real experience play it on a laptop or desktop.</p>"),
]


# ------------------------------------------------------------------ changelog, newest first (player-facing wording)
UPDATES = [
 ("2026-09-26", [
   "<strong>New survivor: Doge.</strong> Much soldier, very tactical: a Shiba Inu in a plate carrier and the coolest shades on the battlefield.",
   "<strong>Urban City has a pool.</strong> It's murky, something glides underneath, and stepping in is a mistake.",
   "<strong>The Research Lab floor has a hole in it.</strong> Something down there blinks. On certain waves, it does more than blink.",
   "Sharkjutta redrawn: the shark in blue running shoes, side-on, exactly like the meme.",
   "<strong>New survivor: Giga Ballerina.</strong> PIROUETTE spins him on the spot while a ring of blades slices every zombie around him, to his own song.",
   "<strong>New survivor: BlackEgg.</strong> EGG ROLL tucks him into a rolling egg that crushes zombies flat, steered with WASD, to a dubstep saw.",
   "Runner's RUSH now has its own soundtrack for the whole rush.",
   "The wave 5 scare now hits the instant the boss dies, out of the dark and straight at the screen.",
   "Much faster loading: the title screen appears instantly, then comes alive as the game finishes loading.",
   "Horror House: removed invisible walls, so you can slip between the barrels and the trees again.",
 ]),
 ("2026-09-25", [
   "<strong>New map: Horror House.</strong> A hand-painted, blood-soaked plaza at night, now also the backdrop of the title screen.",
   "<strong>New survivor: Cry XD.</strong> CRY FLOOD drowns the street in tears: zombies in the water can't shoot and go under.",
   "Frogepepe redrawn with the classic Feels Good Man face.",
   "A brand-new title screen, plus <a href=\"/faq\">the FAQ</a> and a <a href=\"/play\">/play</a> link that jumps straight to character select.",
 ]),
 ("2026-09-24", [
   "<strong>New survivor: Sharkjutta.</strong> FEEDING FRENZY: a shark in running shoes that swallows zombies whole.",
 ]),
 ("2026-09-23", [
   "<strong>New survivors: Jeffry and Sonny Jeans.</strong> PAYDAY throws endless money bags that pull the horde away; MILK QUAKE punches the ground and floods it with milk.",
 ]),
 ("2026-09-22", [
   "<strong>Wave 5: the lights die.</strong> The power fails for the whole wave, and killing its boss lets something through.",
   "<strong>New survivors: Kiya Mhalifa, Videoman and Eggreck.</strong> GOING VIRAL freezes the crowd, LAVA STONES rains fire, VANISH and MY WIFE keep Eggreck alive.",
   "<strong>New boss: Tung Tung Sahur</strong> at wave 50.",
 ]),
 ("2026-09-21", [
   "<strong>New boss: Bona</strong> at wave 30, a mountain of black rock that kills the lights.",
   "<strong>New survivors: Frogepepe and Bezuko.</strong> FROG OUT (with a frog army) and AWAKEN, a demon form with a katana and a song.",
 ]),
 ("2026-09-20", [
   "Meme Survival goes live.",
 ]),
]

# ------------------------------------------------------------------ shared page shell
NAV = [('Characters', 'characters'), ('Bosses', 'bosses'), ('Maps', 'maps'), ('FAQ', 'faq'), ('Updates', 'updates')]
CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; media-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'"
CSS = """
@font-face{font-family:'Press Start 2P';font-weight:400;font-display:swap;src:url(/assets/fonts/press-start-2p.woff2) format('woff2')}
@font-face{font-family:'IBM Plex Mono';font-weight:400;font-display:swap;src:url(/assets/fonts/ibm-plex-mono-400.woff2) format('woff2')}
@font-face{font-family:'IBM Plex Mono';font-weight:700;font-display:swap;src:url(/assets/fonts/ibm-plex-mono-700.woff2) format('woff2')}
:root{--bg:#0b0d12;--panel:rgba(21,26,37,.88);--line:#2b3345;--text:#e8e6dc;--muted:#a3abbc;--red:#e0301e;--link:#ff7a5c}
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{background:var(--bg) url(/assets/img/horror_menu.webp) center top/cover fixed;color:var(--text);font:16px/1.7 'IBM Plex Mono',ui-monospace,Menlo,Consolas,monospace}
body::before{content:"";position:fixed;inset:0;background:linear-gradient(rgba(8,10,16,.86),rgba(8,10,16,.94));z-index:-1}
a{color:var(--link)}
.px{font-family:'Press Start 2P',monospace;letter-spacing:1px}
.wrap{max-width:1000px;margin:0 auto;padding:22px 16px 64px}
header{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;margin-bottom:26px}
.home{display:flex;align-items:center;gap:10px;color:var(--text);text-decoration:none;font-size:12px}
.home img{width:40px;height:40px}
.nav{display:flex;gap:6px 16px;flex-wrap:wrap;font-size:10px}
.nav a{color:var(--muted);text-decoration:none;padding:6px 2px;border-bottom:2px solid transparent}
.nav a:hover,.nav a[aria-current]{color:#fff;border-bottom-color:var(--red)}
.play{display:inline-flex;align-items:center;gap:10px;font-size:13px;color:#fff;text-decoration:none;background:linear-gradient(#26303f,#171d28);border:2px solid #dfe2e8;padding:12px 18px;border-radius:2px;box-shadow:0 0 0 3px var(--bg),0 0 0 6px var(--red),0 0 18px rgba(255,40,20,.55)}
.play:hover{background:linear-gradient(#324057,#1e2635)}
.play::before{content:"";border-left:10px solid #fff;border-top:6px solid transparent;border-bottom:6px solid transparent}
.hero{text-align:center;margin-bottom:30px}
.hero img{width:min(200px,50vw);height:auto;filter:drop-shadow(0 8px 24px rgba(0,0,0,.6))}
h1{font-size:clamp(17px,3.6vw,26px);line-height:1.5;margin:16px 0 12px;color:#fff;text-shadow:3px 3px 0 #000}
h1 span{color:var(--red)}
.lede{color:var(--muted);max-width:680px;margin:0 auto}
.panel{background:var(--panel);border:1px solid var(--line);border-radius:4px;padding:18px 20px;margin-bottom:16px;scroll-margin-top:16px}
.panel h2,.card h2{font-size:clamp(12px,2.2vw,15px);line-height:1.6;color:#fff;margin-bottom:10px}
.toc{columns:2 220px;margin:10px 0 0 20px}
.toc li{margin:3px 0}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px}
.card{background:var(--panel);border:1px solid var(--line);border-left:4px solid var(--red);border-radius:4px;padding:18px;scroll-margin-top:16px}
.card .top{display:flex;gap:14px;align-items:center;margin-bottom:10px}
.card .top img{width:96px;height:96px;flex:0 0 96px;image-rendering:pixelated;background:#0e1118;border:1px solid var(--line);border-radius:3px}
.card .top h2{margin:0}
.tag{display:inline-block;font-size:8px;color:#ffd86b;margin-top:6px}
.chips{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0 8px}
.chip{font-size:8px;color:#fff;background:#3a1512;border:1px solid var(--red);padding:5px 7px;border-radius:2px}
.stats{color:var(--muted);font-size:13px;margin-top:8px}
.card p{font-size:14px}
.wide img{width:100%;height:auto;display:block;border:1px solid var(--line);border-radius:3px;margin-bottom:12px}
.card.boss .top img{width:128px;height:128px;flex:0 0 128px;background:transparent;border:0}
table{width:100%;border-collapse:collapse;font-size:14px}
td,th{text-align:left;padding:8px 6px;border-bottom:1px solid var(--line);vertical-align:top}
th{font-size:9px;color:var(--muted);font-weight:400}
.log h2{font-size:12px;color:#ffd86b}
.log ul{margin:8px 0 0 20px}
.log li{margin:6px 0;font-size:14px}
.qa{border-left:4px solid var(--red)}
.qa p+p{margin-top:10px}
.qa ul{margin:10px 0 0 20px}
.qa li{margin:5px 0}
kbd{font:600 12px/1 'IBM Plex Mono',monospace;background:#0e1118;border:1.5px solid #c9ced8;border-radius:4px;padding:3px 6px}
.cta{text-align:center;margin-top:34px}
.cta p{color:var(--muted);margin-bottom:18px}
footer{text-align:center;color:var(--muted);font-size:13px;margin-top:40px}
footer .nav{justify-content:center;margin-bottom:10px}
@media (max-width:640px){header{flex-direction:column}.card .top img{width:80px;height:80px;flex-basis:80px}}
"""


def page(slug, title, desc, h1, lede, body, ld=(), og_type='article'):
    url = U + slug
    label = dict((s, n) for n, s in NAV).get(slug, slug)
    crumbs = {"@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Meme Survival", "item": U},
        {"@type": "ListItem", "position": 2, "name": label, "item": url}]}
    graph = {"@context": "https://schema.org", "@graph": list(ld) + [crumbs]}
    nav = ''.join('<a href="/{0}"{1}>{2}</a>'.format(s, ' aria-current="page"' if s == slug else '', n.upper()) for n, s in NAV)
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{E(title)}</title>
<meta name="description" content="{E(desc)}">
<meta http-equiv="Content-Security-Policy" content="{CSP}">
<link rel="canonical" href="{url}">
<meta name="theme-color" content="#0b0d12">
<meta property="og:type" content="{og_type}">
<meta property="og:site_name" content="Meme Survival">
<meta property="og:url" content="{url}">
<meta property="og:title" content="{E(title)}">
<meta property="og:description" content="{E(desc)}">
<meta property="og:image" content="{U}assets/img/og-image.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{E(title)}">
<meta name="twitter:description" content="{E(desc)}">
<meta name="twitter:image" content="{U}assets/img/og-image.jpg">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
<link rel="icon" type="image/png" sizes="48x48" href="/favicon-48.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="preload" href="/assets/fonts/press-start-2p.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/fonts/ibm-plex-mono-400.woff2" as="font" type="font/woff2" crossorigin>
<style>{CSS}</style>
<script type="application/ld+json">
{json.dumps(graph, indent=1, ensure_ascii=False)}
</script>
</head>
<body>
<div class="wrap">
  <header>
    <a class="home px" href="/"><img src="/assets/img/logo-round-320.webp" alt="" width="40" height="40">MEME SURVIVAL</a>
    <nav class="nav px" aria-label="Site">{nav}</nav>
    <a class="play px" href="/play">PLAY NOW</a>
  </header>
  <main>
    <div class="hero">
      <img src="/assets/img/logo-round-320.webp" alt="Meme Survival logo" width="320" height="320">
      <h1 class="px">{h1}</h1>
      <p class="lede">{lede}</p>
    </div>
{body}
    <div class="cta">
      <p>Enough reading. The horde is waiting.</p>
      <a class="play px" href="/play">PLAY MEME SURVIVAL</a>
    </div>
  </main>
  <footer><nav class="nav px" aria-label="Site">{nav}</nav><a href="/">memesurvival.com</a> · the free meme zombie survival game you play in your browser · also on <a href="https://memesurvival.itch.io/meme-survival" target="_blank" rel="noopener">itch.io</a></footer>
</div>
</body>
</html>
"""


def text(h):
    t = re.sub(r'<li>', ' • ', h); t = re.sub(r'</p>\s*<p>', ' ', t); t = re.sub(r'<[^>]+>', '', t)
    return re.sub(r'\s+', ' ', html.unescape(t)).strip()


def item_list(name, items):
    return {"@type": "ItemList", "name": name, "numberOfItems": len(items),
            "itemListElement": [{"@type": "ListItem", "position": i + 1, "name": n, "url": u} for i, (n, u) in enumerate(items)]}


def mult(v):
    return ('%.2f' % v).rstrip('0').rstrip('.') + '×'


def toc_panel(label, links):
    items = ''.join('<li><a href="#{0}">{1}</a></li>'.format(a, E(n)) for a, n in links)
    return '    <nav class="panel" aria-label="{0}"><strong class="px" style="font-size:10px;color:var(--muted)">{0}</strong><ol class="toc">{1}</ol></nav>\n'.format(label, items)


import hashlib


def img(path):
    """Site images are cached for a year, so each link carries a fingerprint of the file: a redrawn picture gets a new URL."""
    return '/' + path + '?v=' + hashlib.sha1(open(path, 'rb').read()).hexdigest()[:8]


pages = {}

# ------------------------------------------------------------------ FAQ
t = "Meme Survival FAQ: What Is It, How to Play, Characters & Bosses"
d = f"Answers about Meme Survival, the free browser zombie game: what it is, the best zombie survival game, controls, the {N} characters, maps and bosses."
body = toc_panel('QUESTIONS', [(s, q) for q, s, _ in QA])
body += '\n'.join('    <section class="panel qa" id="{0}"><h2 class="px">{1}</h2>{2}</section>'.format(s, E(q), a) for q, s, a in QA)
faq_ld = {"@type": "FAQPage", "@id": U + "faq#faq", "url": U + "faq", "name": t, "isPartOf": {"@id": U + "#website"},
          "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": text(a)}} for q, _, a in QA]}
pages['faq'] = page('faq', t, d, 'Meme Survival <span>FAQ</span>',
                    'Everything you want to know about Meme Survival, the free zombie survival shooter you play in your browser.', body, [faq_ld])

# ------------------------------------------------------------------ characters
cards = []
for c in GAME['chars']:
    chips = ''.join('<span class="chip px">{0}</span>'.format(E(a)) for a in c['abilities'])
    chips = '<div class="chips">{0}</div>'.format(chips) if chips else ''
    stats = 'HP {0} · Speed {1} · Damage {2} · Fire rate {3}'.format(c['hp'], mult(c['speed']), mult(c['damage']), mult(c['firerate']))
    cards.append(
        '    <article class="card" id="{id}">\n'
        '      <div class="top"><img src="{src}" alt="{name}, pixel-art survivor from Meme Survival" width="96" height="96" loading="lazy">\n'
        '        <div><h2 class="px">{name}</h2><span class="tag px">{tag}</span></div></div>\n'
        '      {chips}\n      <p>{desc}</p>\n      <p class="stats">{stats}</p>\n'
        '    </article>'.format(id=c['id'], src=img('assets/img/site/char_' + c['id'] + '.png'), name=E(c['name']), tag=E(c['tag']), chips=chips, desc=E(c['desc']), stats=stats))
body = toc_panel(f'ALL {N} SURVIVORS', [(c['id'], c['name']) for c in GAME['chars']])
body += '    <div class="grid">\n' + '\n'.join(cards) + '\n    </div>'
t = f"Meme Survival Characters: All {N} Survivors and Their Abilities"
d = "Every survivor in Meme Survival, the free meme zombie game: {0} and more, with their special abilities.".format(
    ', '.join(c['name'] for c in reversed(GAME['chars'][-3:])))
pages['characters'] = page('characters', t, d, 'Meme Survival <span>Characters</span>',
    f'All {N} survivors you can play in Meme Survival, from the humble Rookie to meme legends, and the special ability each one brings to the zombie apocalypse.',
    body, [item_list('Meme Survival characters', [(c['name'], U + 'characters#' + c['id']) for c in GAME['chars']])])

# ------------------------------------------------------------------ bosses
B = GAME['bosses']
ms = sorted((int(w), k) for w, k in GAME['milestones'].items())
milestone_ids = {k for _, k in ms}
cards = []
for w, k in ms:
    b = B[k]
    cards.append(
        '    <article class="card boss" id="{k}">\n'
        '      <div class="top"><img src="{src}" alt="{title}, the wave {w} boss in Meme Survival" width="128" height="128" loading="lazy">\n'
        '        <div><h2 class="px">{name}</h2><span class="tag px">WAVE {w} · {hp} HP</span></div></div>\n'
        '      <p>{desc}</p>\n'
        '    </article>'.format(k=k, src=img('assets/img/site/boss_' + k + '.png'), w=w, title=E(b['name'].title()), name=E(b['name']), hp=b['hp'], desc=E(b['desc'])))
rows = ''.join('<tr><td class="px" style="font-size:10px">{0}</td><td>wave {1}+</td><td>{2}</td></tr>'.format(E(b['name']), b['minWave'], E(b['desc']))
               for k, b in sorted(B.items(), key=lambda kv: kv[1]['minWave']) if not b['special'] and k not in milestone_ids)
dw = GAME['dread']
body = (
    '    <section class="panel"><h2 class="px">Every 10 waves, a boss</h2>\n'
    '      <p>Meme Survival throws a unique boss at you on every tenth wave, each with its own attacks, and the wave does not end until it is dead. '
    'In between, regular bosses join the horde more and more often.</p></section>\n'
    '    <div class="grid">\n' + '\n'.join(cards) + '\n    </div>\n'
    f'    <section class="panel" style="margin-top:16px" id="wave-{dw}"><h2 class="px">Wave {dw}: the lights die</h2>\n'
    f'      <p>On wave {dw} the power fails on every map. You fight the whole wave by flashlight, and killing its boss lets something through. Don\'t look away.</p></section>\n'
    '    <section class="panel" id="regular"><h2 class="px">Regular bosses</h2>\n'
    f'      <table><tr><th class="px">BOSS</th><th class="px">APPEARS</th><th class="px">WHAT IT DOES</th></tr>{rows}</table></section>')
names = [B[k]['name'].title() for _, k in ms]
t = "Meme Survival Bosses: Warlord, Bona, Kraken & Tung Tung Sahur"
d = "Every boss in Meme Survival, the free browser zombie game: {0}, plus the wave {1} blackout.".format(', '.join(names), dw)
pages['bosses'] = page('bosses', t, d, 'Meme Survival <span>Bosses</span>',
    'A boss every ten waves, a blackout at wave five, and a growing crowd of armed brutes in between. Here is everything that wants you dead.',
    body, [item_list('Meme Survival bosses', [(B[k]['name'].title(), U + 'bosses#' + k) for _, k in ms])])

# ------------------------------------------------------------------ maps
cards = []
for m in GAME['maps']:
    tag = '<span class="tag px">{0}</span>'.format(E(m['tag'])) if m['tag'] else ''
    cards.append(
        '    <article class="card wide" id="{id}">\n'
        '      <img src="{src}" alt="Overview of the {name} map in Meme Survival" width="640" height="320" loading="lazy">\n'
        '      <h2 class="px">{name}</h2>{tag}\n      <p style="margin-top:8px">{desc}</p>\n'
        '    </article>'.format(id=m['id'], src=img('assets/img/site/map_' + m['id'] + '.webp'), name=E(m['name']), tag=tag, desc=E(m['desc'])))
M = len(GAME['maps'])
body = '    <div class="grid">\n' + '\n'.join(cards) + '\n    </div>'
t = f"Meme Survival Maps: All {M} Maps, Including Horror House"
d = "All {0} maps in Meme Survival, the free meme zombie game: {1}.".format(M, ', '.join(m['name'] for m in GAME['maps']))
pages['maps'] = page('maps', t, d, 'Meme Survival <span>Maps</span>',
    f'{M} places to make your last stand, from wide city streets to a pitch-black factory and the hand-painted Horror House.',
    body, [item_list('Meme Survival maps', [(m['name'], U + 'maps#' + m['id']) for m in GAME['maps']])])

# ------------------------------------------------------------------ updates
body = '\n'.join('    <section class="panel log" id="{0}"><h2 class="px">{0}</h2><ul>{1}</ul></section>'.format(day, ''.join('<li>{0}</li>'.format(x) for x in items))
                 for day, items in UPDATES)
t = "Meme Survival Updates: New Characters, Abilities and Fixes"
d = "What's new in Meme Survival, the free meme zombie game: new survivors like Giga Ballerina and BlackEgg, new bosses, maps, abilities and fixes, newest first."
pages['updates'] = page('updates', t, d, 'Meme Survival <span>Updates</span>',
    'New survivors, bosses, maps and fixes, newest first. Meme Survival keeps growing, and it is always free.', body)

for slug, doc in pages.items():
    with open(slug + '.html', 'w') as f:
        f.write(doc)
for slug, doc in pages.items():
    tt = re.search(r'<title>(.*?)</title>', doc).group(1); dd = re.search(r'name="description" content="(.*?)"', doc).group(1)
    print(f'{slug}.html  title {len(html.unescape(tt))}  desc {len(html.unescape(dd))}')
