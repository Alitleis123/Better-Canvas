#!/bin/sh
# Better Canvas -- build loadable extension folders for each browser.
# Output: dist/chrome and dist/firefox (each has manifest.json + src + icons).
# Usage:  ./build.sh
#
# Same steps as build.ps1, for machines without PowerShell. The two must stay in
# step: syntax-check, test, then copy. Nothing is compiled or bundled, so a build
# is a copy and the only thing that can go wrong is copying something broken.
set -e
root=$(cd "$(dirname "$0")" && pwd)
cd "$root"

if command -v node >/dev/null 2>&1; then
  printf 'Syntax-checking JavaScript files...\n'
  failed=0
  count=0
  for f in $(find src -name '*.js'); do
    count=$((count + 1))
    if ! node --check "$f" >/dev/null 2>&1; then
      printf '  FAIL %s\n' "$f"
      node --check "$f" || true
      failed=$((failed + 1))
    fi
  done
  [ "$failed" -gt 0 ] && { printf '%s file(s) failed syntax check.\n' "$failed"; exit 1; }
  printf '  OK %s files\n' "$count"

  printf 'Running test suite...\n'
  node test/run.js || { printf 'Test suite failed; not building.\n'; exit 1; }
else
  printf 'node not found; skipping syntax check and tests.\n'
fi

build_target() {
  name=$1; manifest=$2
  out="$root/dist/$name"
  rm -rf "$out"
  mkdir -p "$out"
  cp -R "$root/src"   "$out/src"
  cp -R "$root/icons" "$out/icons"
  cp "$root/$manifest" "$out/manifest.json"
  printf 'Built %s -> %s\n' "$name" "$out"
}

build_target chrome  manifest.json
build_target firefox manifest.firefox.json

printf '\n'
printf 'Chrome:  chrome://extensions -> Load unpacked -> dist/chrome\n'
printf 'Firefox: about:debugging#/runtime/this-firefox -> Load Temporary Add-on -> dist/firefox/manifest.json\n'
