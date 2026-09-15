#!/bin/sh
# Better Canvas — photograph a harness URL at a given viewport.
#
#   test/browser/shoot.sh /tmp/out.png 1440x900 '_shot.html?m=plain'
#
# Chrome does not always exit after writing the file, and --virtual-time-budget
# will happily photograph a half-painted frame, so this polls for the PNG and
# then kills the process rather than waiting on it. Nothing here may use `set -e`:
# the profile directory is still open when we delete it, so the cleanup rm
# routinely fails and that is not a reason to report no screenshot.
OUT="${1:?output png}"
SIZE="${2:-1440x900}"
URL="${3:-_shot.html?m=plain}"
W=$(echo "$SIZE" | cut -dx -f1)
H=$(echo "$SIZE" | cut -dx -f2)
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
# A previous headless Chrome still holding a --screenshot target makes the next
# run write nothing at all, with no error on stderr. Two failed captures were
# this and not the page under test.
pkill -f "Google Chrome.*--headless.*bcshot" 2>/dev/null
rm -f "$OUT"
PROFILE=$(mktemp -d /tmp/bcshot.XXXXXX)
"$CHROME" --headless --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
  --virtual-time-budget=6000 --window-size="$W,$H" \
  --screenshot="$OUT" --user-data-dir="$PROFILE" \
  "http://localhost:8731/test/browser/$URL" >/dev/null 2>&1 &
PID=$!
i=0
while [ $i -lt 150 ]; do
  if [ -s "$OUT" ]; then sleep 0.4; break; fi
  sleep 0.2
  i=$((i + 1))
done
kill $PID 2>/dev/null
rm -rf "$PROFILE" 2>/dev/null
if [ -s "$OUT" ]; then
  echo "$OUT $(/usr/bin/stat -f%z "$OUT") bytes ${W}x${H}"
else
  echo "no screenshot written: $URL" >&2
  exit 1
fi
