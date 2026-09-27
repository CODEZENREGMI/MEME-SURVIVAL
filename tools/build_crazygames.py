"""Builds the CrazyGames upload: dist/meme-survival-crazygames.zip (run from the repo root: python3 tools/build_crazygames.py).

CrazyGames hosts HTML5 games from an uploaded zip (index.html at the top level) inside an iframe on their own domain,
and doesn't allow games to link out to other sites. So, like the itch build, this copies the game and rewrites
index.html, and on top of that:
  - the title-screen MENU (links to the website's pages and itch.io) is removed entirely
  - the canonical link / social tags pointing at memesurvival.com are dropped (their page has its own)
  - website-only images (assets/img/site, the share image, the round logo/icons) are left out
The live site is untouched. Upload the zip on the CrazyGames developer portal as an HTML5 game.
"""
import os, re, shutil, zipfile

OUT = 'dist/crazygames'
ZIP = 'dist/meme-survival-crazygames.zip'
SKIP = ('assets/img/site/', 'assets/img/og-image', 'assets/img/logo-round', 'assets/img/icon-round')

shutil.rmtree(OUT, ignore_errors=True)
os.makedirs(OUT)

html = open('index.html').read()
html = re.sub(r'<link rel="(?:icon|apple-touch-icon|manifest|canonical)"[^>]*>\n', '', html)          # iframe: no favicons, manifest or canonical
html = re.sub(r'<meta (?:property="og:|name="twitter:|name="google-site-verification")[^>]*>\n', '', html)   # their page carries its own share tags
html = re.sub(r'<link rel="preload" href="/(assets/[^"]+)"', r'<link rel="preload" href="\1"', html)   # preloads: relative
html = re.sub(r'\s*<details class="title-menu">.*?</details>', '', html, flags=re.S)                   # no links out of the game
html = re.sub(r'<script type="application/ld\+json">.*?</script>\n?', '', html, flags=re.S)            # structured data is for our own site
leftover = re.findall(r'(?:href|src)="/[^"]*"', html)
assert not leftover, f'root paths left in index.html: {leftover}'
assert 'title-menu' not in html and 'itch.io' not in html, 'a link out of the game survived'
open(os.path.join(OUT, 'index.html'), 'w').write(html)

files = 1
for top in ('css', 'js', 'assets'):
    for root, _, names in os.walk(top):
        for n in names:
            src = os.path.join(root, n).replace(os.sep, '/')
            if n.startswith('.') or src.startswith(SKIP):
                continue
            dst = os.path.join(OUT, src)
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            shutil.copy2(src, dst)
            files += 1

if os.path.exists(ZIP):
    os.remove(ZIP)
with zipfile.ZipFile(ZIP, 'w', zipfile.ZIP_DEFLATED) as z:
    for root, _, names in os.walk(OUT):
        for n in names:
            p = os.path.join(root, n)
            z.write(p, os.path.relpath(p, OUT))
print(f'{ZIP}: {files} files, {os.path.getsize(ZIP) / 1024 / 1024:.1f} MB')
