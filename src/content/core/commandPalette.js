/* Better Canvas — command palette (⌘K). */
(function () {
  "use strict";
  const BC = (globalThis.BC = globalThis.BC || {});

  const CSS = `
    .bc-cp-back {
      position: fixed; inset: 0; background: rgba(0,0,0,.35);
      z-index: 2147482900; display: flex; align-items: flex-start; justify-content: center;
      padding-top: 12vh; font: 15px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .bc-cp {
      width: min(640px, 92vw); background: #fff; color: #1f2937; border-radius: 12px;
      box-shadow: 0 30px 80px rgba(0,0,0,.35); overflow: hidden;
    }
    .bc-cp input {
      width: 100%; padding: 14px 16px; border: 0; outline: none; font-size: 15px;
      border-bottom: 1px solid #eef1f4; background: transparent; color: inherit;
    }
    .bc-cp-list { max-height: 60vh; overflow: auto; }
    .bc-cp-item {
      display: flex; align-items: center; gap: 10px;
      padding: 10px 14px; cursor: pointer;
    }
    .bc-cp-item.active { background: #eef2ff; }
    .bc-cp-item .bc-cp-title { flex: 1; }
    .bc-cp-item .bc-cp-hint  { font-size: 12px; opacity: .55; }
    .bc-cp-empty { padding: 20px; opacity: .6; text-align: center; }
    .bc-cp-group { padding: 6px 14px; font-size: 11px; text-transform: uppercase;
                   letter-spacing: .04em; opacity: .5; }
    html.bc-dark .bc-cp { background: #1a1d24; color: #e5e7eb; }
    html.bc-dark .bc-cp input { border-bottom-color: #2a2f3a; }
    html.bc-dark .bc-cp-item.active { background: #232a36; }
  `;

  let open = false;
  let commands = [];
  let selected = 0;
  let backEl = null;
  let inputEl = null;
  let listEl = null;

  function register(cmd) {
    // {id, title, hint, group, run(), when()}
    commands = commands.filter((c) => c.id !== cmd.id).concat(cmd);
  }

  function unregister(id) { commands = commands.filter((c) => c.id !== id); }

  function score(cmd, q) {
    if (!q) return 1;
    const t = (cmd.title + " " + (cmd.group || "")).toLowerCase();
    q = q.toLowerCase();
    if (t === q) return 100;
    if (t.startsWith(q)) return 80;
    let idx = 0, hits = 0;
    for (const ch of q) { const p = t.indexOf(ch, idx); if (p < 0) return 0; hits += 1 / (p - idx + 1); idx = p + 1; }
    return hits;
  }

  function render(filter) {
    const s = BC.storage && BC.storage.current;
    const visible = commands.filter((c) => !c.when || c.when(s)).map((c) => ({ c, s: score(c, filter) }))
      .filter((x) => x.s > 0).sort((a, b) => b.s - a.s);
    listEl.innerHTML = "";
    if (!visible.length) {
      const e = document.createElement("div");
      e.className = "bc-cp-empty";
      e.textContent = "No results";
      listEl.appendChild(e);
      return;
    }
    let lastGroup = "";
    visible.forEach(({ c }, i) => {
      if ((c.group || "") !== lastGroup) {
        lastGroup = c.group || "";
        if (lastGroup) {
          const g = document.createElement("div");
          g.className = "bc-cp-group";
          g.textContent = lastGroup;
          listEl.appendChild(g);
        }
      }
      const el = document.createElement("div");
      el.className = "bc-cp-item" + (i === selected ? " active" : "");
      el.addEventListener("mouseenter", () => { selected = i; render(filter); });
      el.addEventListener("click", () => { pick(i, filter); });
      const t = document.createElement("div"); t.className = "bc-cp-title"; t.textContent = c.title;
      const h = document.createElement("div"); h.className = "bc-cp-hint"; h.textContent = c.hint || "";
      el.appendChild(t); el.appendChild(h);
      listEl.appendChild(el);
    });
  }

  function pick(i, filter) {
    const s = BC.storage && BC.storage.current;
    const visible = commands.filter((c) => !c.when || c.when(s)).map((c) => ({ c, s: score(c, filter) }))
      .filter((x) => x.s > 0).sort((a, b) => b.s - a.s);
    const target = visible[i];
    close();
    if (target) { try { target.c.run(); } catch (e) { BC.util.warn("cp run", e); } }
  }

  function openPalette() {
    if (open) return;
    open = true;
    BC.injector && BC.injector.setStyle("bc-cp-css", CSS);
    backEl = document.createElement("div");
    backEl.className = "bc-cp-back";
    backEl.setAttribute("data-bc-node", "bc-cp");
    backEl.addEventListener("click", (e) => { if (e.target === backEl) close(); });
    const cp = document.createElement("div"); cp.className = "bc-cp";
    inputEl = document.createElement("input");
    inputEl.type = "search";
    inputEl.placeholder = "Type a command or search…";
    inputEl.setAttribute("aria-label", "Command palette");
    listEl = document.createElement("div"); listEl.className = "bc-cp-list";
    cp.appendChild(inputEl); cp.appendChild(listEl);
    backEl.appendChild(cp);
    document.body.appendChild(backEl);
    selected = 0;
    inputEl.addEventListener("input", () => { selected = 0; render(inputEl.value); });
    inputEl.addEventListener("keydown", (e) => {
      const filter = inputEl.value;
      const s = BC.storage && BC.storage.current;
      const count = commands.filter((c) => !c.when || c.when(s)).map((c) => ({ c, s: score(c, filter) })).filter((x) => x.s > 0).length;
      if (e.key === "ArrowDown") { e.preventDefault(); selected = Math.min(count - 1, selected + 1); render(filter); }
      else if (e.key === "ArrowUp") { e.preventDefault(); selected = Math.max(0, selected - 1); render(filter); }
      else if (e.key === "Enter") { e.preventDefault(); pick(selected, filter); }
      else if (e.key === "Escape") { e.preventDefault(); close(); }
    });
    render("");
    setTimeout(() => inputEl.focus(), 0);
  }

  function close() {
    open = false;
    if (backEl && backEl.parentNode) backEl.parentNode.removeChild(backEl);
    backEl = null; inputEl = null; listEl = null;
  }

  BC.palette = {
    register, unregister, open: openPalette, close,
    isOpen() { return open; },
  };
})();
