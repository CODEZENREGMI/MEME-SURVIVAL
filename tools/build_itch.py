"""Builds the itch.io upload: dist/meme-survival-itch.zip (run from the repo root: python3 tools/build_itch.py).

itch.io plays HTML5 games from a zip inside an iframe on its own domain, under a sub-folder, so anything addressed
from the site root ("/assets/...") would break. This copies the game, rewrites index.html for that setting, and zips it
with index.html at the top level:
  - root paths (font/image preloads) become relative; favicon/manifest links are dropped (the iframe doesn't use them)
  - the title-screen menu links point at memesurvival.com and open in a new tab
  - website-only images (assets/img/site, the share image, the round logo/icons) are left out
The live site is untouched. Upload the zip on itch as "This file will be played in the browser".
"""
import os, re, shutil, zipfile

SITE = 'https://www.memesurvival.com/'
OUT = 'dist/itch'
ZIP = 'dist/meme-survival-itch.zip'
SKIP = ('assets/img/site/', 'assets/img/og-image', 'assets/img/logo-round', 'assets/img/icon-round')

shutil.rmtree(OUT, ignore_errors=True)
os.makedirs(OUT)

html = open('index.html').read()
html = re.sub(r'<link rel="(?:icon|apple-touch-icon|manifest)"[^>]*>\n', '', html)            # iframe: no favicons/manifest
html = re.sub(r'<link rel="preload" href="/(assets/[^"]+)"', r'<link rel="preload" href="\1"', html)   # preloads: relative
html = re.sub(r'<a href="/(characters|bosses|maps|faq|updates)">',
              lambda m: f'<a href="{SITE}{m.group(1)}" target="_blank" rel="noopener">', html)  # menu: out to the site
html = re.sub(r'<a href="https://memesurvival\.itch\.io/[^"]*"[^>]*>ITCH\.IO</a>', '', html)   # no link to itch from inside itch
leftover = re.findall(r'(?:href|src)="/[^"]*"', html)
assert not leftover, f'root paths left in index.html: {leftover}'
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
