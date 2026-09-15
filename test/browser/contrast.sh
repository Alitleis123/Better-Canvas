#!/bin/sh
# Better Canvas — every palette we ship, against every element carrying text.
#
#   test/browser/contrast.sh         # needs test/browser/serve.js running
#
# 6 dark tones x 4 dashboard layouts, 44 skins, and default light. Anything
# under 4.5:1 fails. The checks and the reasons are in _contrast_sweep.js.
HERE=$(dirname "$0")
OUT=$(BUDGET="${BUDGET:-120000}" POLL="${POLL:-600}" \
      "$HERE/probe.sh" 1440x1000 'm=plain&n=7' "$(cat "$HERE/_contrast_sweep.js")")
echo "$OUT"
echo "$OUT" | grep -q "^PASS" || exit 1
