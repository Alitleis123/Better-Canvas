#!/bin/sh
# Better Canvas — sweep every settings tab at every drawer width, headlessly.
#
#   test/browser/panel.sh            # needs test/browser/serve.js running
#
# 13 tabs x 6 widths is 78 renders, which is why this is a script and not a
# habit. The checks and the reasons for them are in _panel_sweep.js. Exits
# non-zero on any starved label or any hint over two lines.
HERE=$(dirname "$0")
OUT=$(BUDGET="${BUDGET:-90000}" POLL="${POLL:-500}" \
      "$HERE/probe.sh" 1440x1000 'm=panel' "$(cat "$HERE/_panel_sweep.js")")
echo "$OUT"
echo "$OUT" | grep -q "^PASS" || exit 1
