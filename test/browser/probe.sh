#!/bin/sh
# Better Canvas — measure the harness at a width and print the answer as text.
#
#   test/browser/probe.sh 2560x1440 'm=plain&n=7' 'JSON.stringify(...)'
#
# Chrome's --dump-dom writes the settled DOM to stdout, so a measurement comes
# back as a string instead of a screenshot somebody has to read. The width is
# the INNER FRAME's, not the window's, so a 2560px measurement does not need a
# 2560px display — which is the whole reason this exists: the three monitors
# this project has to agree on cannot all be plugged in at once.
#
# Chrome does not exit after --dump-dom any more than it does after
# --screenshot, so this redirects to a file and polls, exactly like shoot.sh.
# Piping it directly hangs forever.
#
# No `set -e`: the profile directory is still open when we delete it and that
# routinely fails, which is not a reason to discard a good measurement.
SIZE="${1:-1440x900}"
Q="${2:-m=plain}"
EXPR="${3:-1}"
W=$(echo "$SIZE" | cut -dx -f1)
H=$(echo "$SIZE" | cut -dx -f2)
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
HERE=$(dirname "$0")

urlenc() {
  /usr/bin/python3 -c 'import sys,urllib.parse;print(urllib.parse.quote(sys.argv[1],safe=""))' "$1"
}

URL="http://localhost:8731/test/browser/_probe.html?w=$W&h=$H&q=$(urlenc "$Q")&c=$(urlenc "$EXPR")"
PROFILE=$(mktemp -d /tmp/bcprobe.XXXXXX)
DOM=$(mktemp /tmp/bcdom.XXXXXX)
# The window is deliberately small: the measured width comes from the iframe,
# not the window, so a 2560px measurement costs nothing to render.
"$CHROME" --headless --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
  --virtual-time-budget="${BUDGET:-9000}" --window-size=900,700 \
  --user-data-dir="$PROFILE" --dump-dom "$URL" > "$DOM" 2>/dev/null &
PID=$!
i=0
while [ $i -lt "${POLL:-120}" ]; do
  if [ -s "$DOM" ]; then break; fi
  sleep 0.25
  i=$((i + 1))
done
sleep 0.3
kill $PID 2>/dev/null
/usr/bin/python3 "$HERE/_probe_extract.py" < "$DOM"
rm -f "$DOM" 2>/dev/null
rm -rf "$PROFILE" 2>/dev/null
