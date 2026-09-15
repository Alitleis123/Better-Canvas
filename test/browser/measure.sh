#!/bin/sh
# Better Canvas — run the dashboard width sweep headlessly and report a verdict.
#
#   test/browser/measure.sh          # needs test/browser/serve.js running
#
# _measure.html lays the dashboard out at ten viewport widths and checks the
# invariants that have each broken at least once: one card size, one card
# height, metadata that lines up, no ragged gutter, a constant gap to the
# sidebar, equal margins either side, and one shared right edge. Exits non-zero
# on any failure so it can gate a release.
#
# Chrome does not exit after --dump-dom, so this polls a file rather than
# piping, exactly like shoot.sh and probe.sh.
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
HERE=$(dirname "$0")
PROFILE=$(mktemp -d /tmp/bcmeas.XXXXXX)
DOM=$(mktemp /tmp/bcmdom.XXXXXX)

"$CHROME" --headless --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
  --virtual-time-budget="${BUDGET:-30000}" --window-size=1000,800 \
  --user-data-dir="$PROFILE" --dump-dom \
  "http://localhost:8731/test/browser/_measure.html" > "$DOM" 2>/dev/null &
PID=$!
i=0
while [ $i -lt "${POLL:-240}" ]; do
  if [ -s "$DOM" ]; then break; fi
  sleep 0.25
  i=$((i + 1))
done
sleep 0.3
kill $PID 2>/dev/null

OUT=$(/usr/bin/python3 "$HERE/_probe_extract.py" < "$DOM")
rm -f "$DOM" 2>/dev/null
rm -rf "$PROFILE" 2>/dev/null
echo "$OUT"
echo "$OUT" | grep -q "^PASS" || exit 1
