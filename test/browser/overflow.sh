#!/bin/sh
# Better Canvas — does anything we draw spill, clip or collapse?
#
#   test/browser/overflow.sh [WxH]    # needs test/browser/serve.js running
#
# Sweeps the settings that change SIZE — density and font scale — across the
# dashboard's four layouts and the planner's fifteen view/layout combinations,
# and reports anything that scrolls the page sideways, cuts its own content off,
# or renders text at zero height. The reasons are in _overflow_sweep.js.
HERE=$(dirname "$0")
SIZE="${1:-1440x1000}"
OUT=$(BUDGET="${BUDGET:-120000}" POLL="${POLL:-600}" \
      "$HERE/probe.sh" "$SIZE" 'm=plain&n=7' "$(cat "$HERE/_overflow_sweep.js")")
echo "$SIZE"
echo "$OUT"
echo "$OUT" | grep -q "^PASS" || exit 1
