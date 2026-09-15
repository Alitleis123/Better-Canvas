// Fetch the case list and run both sweeps. Kept out of the shell script because
// bash 3.2 mis-parses a quoted heredoc inside $( ), and out of live.html so the
// cases can be edited without touching the harness.
(async () => {
  const src = await (await fetch("/test/browser/_live_cases.js?t=" + Date.now())).text();
  (0, eval)(src);
  const stuckNodes = await __bcNeedsReload(window.__BC_NODE_CASES);
  const stuckStyles = await __bcStyleSweep(window.__BC_STYLE_CASES);
  return {
    checked: window.__BC_NODE_CASES.length + window.__BC_STYLE_CASES.length,
    stuckNodes,
    stuckStyles,
  };
})()
