#!/bin/sh
# Better Canvas — the whole battery, in one command.
#
#   test/browser/all.sh
#
# Starts the harness server if it is not already up, runs the node suite and
# every browser sweep, and exits non-zero if any of them fails. This is the
# release gate: 617 node tests plus roughly 900 rendered states.
HERE=$(dirname "$0")
ROOT=$(cd "$HERE/../.." && pwd)
FAIL=0
started=""

if ! curl -s -o /dev/null "http://localhost:8731/test/browser/page.html" 2>/dev/null; then
  node "$ROOT/test/browser/serve.js" >/dev/null 2>&1 &
  started=$!
  i=0
  while [ $i -lt 40 ]; do
    curl -s -o /dev/null "http://localhost:8731/test/browser/page.html" 2>/dev/null && break
    sleep 0.25
    i=$((i + 1))
  done
fi

run() {
  printf '\n=== %s ===\n' "$1"
  shift
  if "$@"; then :; else FAIL=1; fi
}

run "node suite" node "$ROOT/test/run.js"
run "dashboard measure" "$HERE/measure.sh"
run "settings panel" "$HERE/panel.sh"
run "overflow 1280" "$HERE/overflow.sh" 1280x900
run "overflow 1920" "$HERE/overflow.sh" 1920x1080
run "contrast" "$HERE/contrast.sh"
run "settings take effect" "$HERE/live.sh"

[ -n "$started" ] && kill "$started" 2>/dev/null

printf '\n'
if [ $FAIL -eq 0 ]; then echo "ALL PASS"; else echo "SOMETHING FAILED (see above)"; fi
exit $FAIL
