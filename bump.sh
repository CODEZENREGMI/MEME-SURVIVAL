#!/bin/sh
# Bump the ?v= cache-busting tag on every script/style in index.html.
# Run this after changing anything in js/ or css/ so players never get a half-stale build.
set -e
cur=$(grep -o '?v=[0-9]*' index.html | head -1 | cut -d= -f2)
next=$((cur + 1))
sed -i '' "s/?v=$cur/?v=$next/g" index.html
echo "cache version $cur -> $next"
