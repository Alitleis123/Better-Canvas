#!/bin/sh
# Better Canvas — photograph a harness URL at a given viewport.
#
#   test/browser/shoot.sh /tmp/out.png 1440x900 '_shot.html?m=plain'
#
# Chrome does not always exit after writing the file, and --virtual-time-budget
# will happily photograph a half-painted frame, so this polls for the PNG and
# then kills the process rather than waiting on it.
set -e
OUT="${1:?output png}"
SIZE="${2:-1440x900}"
URL="${3:-_shot.html?m=plain}"
W=$(echo "$SIZE" | cut -dx -f1)
H=$(echo "$SIZE" | cut -dx -f2)
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
rm -f "$OUT"
PROFILE=$(mktemp -d /tmp/bcshot.XXXXXX)
"$CHROME" --headless --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
  --virtual-time-budget=4000 --window-size="$W,$H" \
  --screenshot="$OUT" --user-data-dir="$PROFILE" \
  "http://localhost:8731/test/browser/$URL" >/dev/null 2>&1 &
PID=$!
i=0
while [ $i -lt 100 ]; do
  [ -s "$OUT" ] && sleep 0.3 && break
  sleep 0.2; i=$((i+1))
done
kill $PID 2>/dev/null || true
rm -rf "$PROFILE" 2>/dev/null || true
[ -s "$OUT" ] || { echo "no screenshot written: $URL" >&2; exit 1; }
echo "$OUT $(/usr/bin/stat -f%z "$OUT") bytes ${W}x${H}"
