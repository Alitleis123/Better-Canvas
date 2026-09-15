#!/bin/sh
# Better Canvas — does changing a setting do anything, without a reload?
#
#   test/browser/live.sh             # needs test/browser/serve.js running
#
# Boots the WHOLE extension the way content.js does on Canvas and round-trips
# every setting in _live_cases.js: off, on, off. Anything that reads the same
# all three times is stuck behind a reload. Exits non-zero if anything is.
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
HERE=$(dirname "$0")
PROFILE=$(mktemp -d /tmp/bclive.XXXXXX)
DOM=$(mktemp /tmp/bcldom.XXXXXX)
EXPR=$(/usr/bin/python3 -c 'import sys,urllib.parse;print(urllib.parse.quote(open(sys.argv[1]).read(),safe=""))' "$HERE/_live_run.js")

"$CHROME" --headless --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
  --virtual-time-budget="${BUDGET:-120000}" --window-size=1600,1000 \
  --user-data-dir="$PROFILE" --dump-dom \
  "http://localhost:8731/test/browser/live.html?c=$EXPR" > "$DOM" 2>/dev/null &
PID=$!
i=0
while [ $i -lt "${POLL:-600}" ]; do
  if [ -s "$DOM" ]; then break; fi
  sleep 0.25
  i=$((i + 1))
done
sleep 0.3
kill $PID 2>/dev/null

OUT=$(/usr/bin/python3 "$HERE/_probe_extract.py" bc-out < "$DOM")
rm -f "$DOM" 2>/dev/null
rm -rf "$PROFILE" 2>/dev/null
echo "$OUT"
echo "$OUT" | grep -q '"stuckNodes": \[\]' && echo "$OUT" | grep -q '"stuckStyles": \[\]'
