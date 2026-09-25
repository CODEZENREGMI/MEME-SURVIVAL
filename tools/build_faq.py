"""Builds faq.html (run from the repo root: python3 tools/build_faq.py). Edit the QA list here, not the HTML."""
import json, re, html
U = 'https://www.memesurvival.com/'
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
  "It loads in seconds in your browser, a run takes minutes, and 18 meme survivors with wild abilities keep it fun to replay. "
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
  "<p>There are <strong>18 survivors</strong>, each with their own stats and a special ability. A few favourites:</p>"
  "<ul><li><strong>Cry XD</strong>: cries a flood. Zombies in the water can't shoot, slow down and drown.</li>"
  "<li><strong>Frogepepe</strong>: transforms into a frog and spawns an army of small frog clones.</li>"
  "<li><strong>Sharkjutta</strong>: an apex predator that eats zombies whole.</li>"
  "<li><strong>Sonny Jeans</strong>: doctor, plumber and pilot who punches the ground and sends a milk quake through the horde.</li>"
  "<li><strong>Eggreck</strong>: turns invisible and calls in his wife as a shield.</li>"
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
def text(h):
    t = re.sub(r'<li>', ' • ', h); t = re.sub(r'</p>\s*<p>', ' ', t); t = re.sub(r'<[^>]+>', '', t)
    return re.sub(r'\s+', ' ', html.unescape(t)).strip()
title = "Meme Survival FAQ: What Is It, How to Play, Characters & Bosses"
desc = "Answers about Meme Survival, the free browser zombie shooter: what it is, the best zombie survival game to play, controls, the 18 meme characters, maps and bosses."
ld = {"@context": "https://schema.org", "@graph": [
  {"@type": "FAQPage", "@id": U + "faq#faq", "url": U + "faq", "name": title, "isPartOf": {"@id": U + "#website"},
   "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": text(a)}} for q, _, a in QA]},
  {"@type": "BreadcrumbList", "itemListElement": [
    {"@type": "ListItem", "position": 1, "name": "Meme Survival", "item": U},
    {"@type": "ListItem", "position": 2, "name": "FAQ", "item": U + "faq"}]}]}
toc = "\n".join(f'      <li><a href="#{slug}">{html.escape(q)}</a></li>' for q, slug, _ in QA)
body = "\n".join(f'    <section class="qa" id="{slug}">\n      <h2>{html.escape(q)}</h2>\n      {a}\n    </section>' for q, slug, a in QA)
page = f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{html.escape(title)}</title>
<meta name="description" content="{html.escape(desc)}">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; media-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'">
<link rel="canonical" href="{U}faq">
<meta name="theme-color" content="#0b0d12">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Meme Survival">
<meta property="og:url" content="{U}faq">
<meta property="og:title" content="{html.escape(title)}">
<meta property="og:description" content="{html.escape(desc)}">
<meta property="og:image" content="{U}assets/img/og-image.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{html.escape(title)}">
<meta name="twitter:description" content="{html.escape(desc)}">
<meta name="twitter:image" content="{U}assets/img/og-image.jpg">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
<link rel="icon" type="image/png" sizes="48x48" href="/favicon-48.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600;700&family=Press+Start+2P&display=swap" rel="stylesheet">
<style>
:root{{--bg:#0b0d12;--panel:#151a25;--line:#2b3345;--text:#e8e6dc;--muted:#a3abbc;--red:#e0301e;--link:#ff7a5c}}
*{{box-sizing:border-box;margin:0;padding:0}}
html{{scroll-behavior:smooth}}
body{{background:var(--bg) url(/assets/img/horror_menu.webp) center top/cover fixed;color:var(--text);font:16px/1.7 'IBM Plex Mono',ui-monospace,Menlo,Consolas,monospace}}
body::before{{content:"";position:fixed;inset:0;background:linear-gradient(rgba(8,10,16,.86),rgba(8,10,16,.94));z-index:-1}}
a{{color:var(--link)}}
.wrap{{max-width:820px;margin:0 auto;padding:28px 16px 64px}}
header{{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:28px}}
.home{{display:flex;align-items:center;gap:10px;color:var(--text);text-decoration:none;font-family:'Press Start 2P',monospace;font-size:12px;letter-spacing:1px}}
.home img{{width:40px;height:40px}}
.play{{display:inline-flex;align-items:center;gap:10px;font-family:'Press Start 2P',monospace;font-size:13px;letter-spacing:1px;color:#fff;text-decoration:none;
  background:linear-gradient(#26303f,#171d28);border:2px solid #dfe2e8;padding:12px 18px;border-radius:2px;position:relative;box-shadow:0 0 0 3px var(--bg),0 0 0 6px var(--red),0 0 18px rgba(255,40,20,.55)}}
.play:hover{{background:linear-gradient(#324057,#1e2635)}}
.play::before{{content:"";border-left:10px solid #fff;border-top:6px solid transparent;border-bottom:6px solid transparent}}
.hero{{text-align:center;margin-bottom:34px}}
.hero img{{width:min(260px,62vw);height:auto;filter:drop-shadow(0 8px 24px rgba(0,0,0,.6))}}
h1{{font-family:'Press Start 2P',monospace;font-size:clamp(18px,4vw,28px);line-height:1.5;margin:18px 0 12px;color:#fff;text-shadow:3px 3px 0 #000}}
h1 span{{color:var(--red)}}
.lede{{color:var(--muted);max-width:620px;margin:0 auto}}
nav.toc{{background:rgba(21,26,37,.85);border:1px solid var(--line);border-radius:4px;padding:16px 20px;margin-bottom:28px}}
nav.toc strong{{font-family:'Press Start 2P',monospace;font-size:11px;letter-spacing:1px;color:var(--muted)}}
nav.toc ol{{margin:10px 0 0 20px}}
nav.toc li{{margin:4px 0}}
.qa{{background:rgba(21,26,37,.85);border:1px solid var(--line);border-left:4px solid var(--red);border-radius:4px;padding:20px 22px;margin-bottom:18px;scroll-margin-top:16px}}
.qa h2{{font-family:'Press Start 2P',monospace;font-size:clamp(12px,2.4vw,15px);line-height:1.6;color:#fff;margin-bottom:12px}}
.qa p+p{{margin-top:10px}}
.qa ul{{margin:10px 0 0 20px}}
.qa li{{margin:5px 0}}
kbd{{font:600 12px/1 'IBM Plex Mono',monospace;background:#0e1118;border:1.5px solid #c9ced8;border-radius:4px;padding:3px 6px}}
.cta{{text-align:center;margin-top:34px}}
.cta p{{color:var(--muted);margin-bottom:18px}}
footer{{text-align:center;color:var(--muted);font-size:13px;margin-top:40px}}
@media (max-width:520px){{header{{flex-direction:column}}.qa{{padding:16px}}}}
</style>
<script type="application/ld+json">
{json.dumps(ld, indent=1, ensure_ascii=False)}
</script>
</head>
<body>
<div class="wrap">
  <header>
    <a class="home" href="/"><img src="/assets/img/logo-round-320.webp" alt="" width="40" height="40">MEME SURVIVAL</a>
    <a class="play" href="/play">PLAY NOW</a>
  </header>
  <main>
    <div class="hero">
      <img src="/assets/img/logo-round-320.webp" alt="Meme Survival logo" width="320" height="320">
      <h1>Meme Survival <span>FAQ</span></h1>
      <p class="lede">Everything you want to know about Meme Survival, the free zombie survival shooter you play in your browser.</p>
    </div>
    <nav class="toc" aria-label="Questions">
      <strong>QUESTIONS</strong>
      <ol>
{toc}
      </ol>
    </nav>
{body}
    <div class="cta">
      <p>Enough reading. The horde is waiting.</p>
      <a class="play" href="/play">PLAY MEME SURVIVAL</a>
    </div>
  </main>
  <footer><a href="/">memesurvival.com</a> · Free browser zombie survival shooter</footer>
</div>
</body>
</html>
'''
open('faq.html', 'w').write(page)
print(len(QA), 'questions;', len(title), 'char title;', len(desc), 'char description')
