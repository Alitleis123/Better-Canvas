/* Device-local notes and study sets. Each item has its own key so unrelated edits never overwrite each other. */
(function () {
  "use strict";
  const BC = globalThis.BC = globalThis.BC || {};
  const el = (t, a, c) => BC.ui.el(t, a, c);
  const renderers = new Set();
  const plain = (v, n) => typeof v === "string" ? v.slice(0, n) : "";
  function normalize(value) {
    if (!value || typeof value !== "object" || !["note", "set", "link"].includes(value.type)) return null;
    return { id: /^[a-zA-Z0-9-]{1,80}$/.test(value.id || "") ? value.id : crypto.randomUUID(), type: value.type,
      title: plain(value.title, 200), body: plain(value.body, 100000), url: BC.util.isSafeHttpUrl(value.url) ? value.url.slice(0, 4096) : "",
      folder: plain(value.folder, 100), pinned: !!value.pinned, updated: Number(value.updated) || Date.now(),
      cards: (Array.isArray(value.cards) ? value.cards : []).slice(0, 500).filter((c) => c && typeof c === "object").map((c) => ({ front: plain(c.front, 5000), back: plain(c.back, 5000) })) };
  }
  const call = (action, fields = {}) => BC.storage.request({ type: "bc:locker", action, ...fields });
  const writeItem = (action, value) => {
    const item = normalize(value);
    if (!item) return Promise.reject(new Error("Invalid locker item"));
    return call(action, { item });
  };
  const save = (value) => writeItem("update", value);
  const createItem = (value) => writeItem("create", value);
  const list = async () => (await call("list")).items.map(normalize).filter(Boolean);
  async function importBatch(values) {
    if (!Array.isArray(values) || values.length > 1000) throw new Error("Invalid locker export");
    const incoming = values.map(normalize);
    if (incoming.some((item) => !item)) throw new Error("The file contains invalid items");
    for (const item of incoming) item.id = crypto.randomUUID();
    // Submit the batch together. Do not report/append partially imported entries if storage rejects it.
    await call("createBatch", { items: incoming });
    return incoming;
  }
  async function remove(id) {
    if (!/^[a-zA-Z0-9-]{1,80}$/.test(id)) throw new Error("Invalid item");
    // A hidden or recently disposed editor may still have a queued snapshot.
    await Promise.all([...renderers].map((renderer) => renderer.cancelItem(id)));
    await call("remove", { id });
  }
  BC.Locker = { normalize, save, create: createItem, list, importBatch, remove };
  BC.renderLocker = function () {
    const root = el("div", { class: "bcs-locker" }), listPane = el("div", { class: "bcs-locker-list" }), editor = el("div", { class: "bcs-locker-editor" });
    const status = el("span", { class: "bc-caption", role: "status", text: "Saved on this device" });
    const search = el("input", { class: "bc-input", type: "search", placeholder: "Search your locker…", "aria-label": "Search your locker" });
    let items = [], active = null, query = "", filter = "all", timer, pending = Promise.resolve(), disposed = false, dirty = false;
    const renderer = {
      flush: () => persist(),
      cancelItem(id) {
        if (active?.id === id) { clearTimeout(timer); active = null; dirty = false; }
        items = items.filter((item) => item.id !== id);
        if (!disposed) { paintEditor(); paintList(); }
        return pending.catch(() => {});
      },
    };
    renderers.add(renderer);
    root.dispose = () => {
      if (disposed) return pending;
      // Flush the last edit before detaching. Keep tracking the write until it
      // settles so a delete in the next editor waits for it.
      const result = persist(); disposed = true; clearTimeout(timer); active = null;
      result.catch(() => {}).then(() => renderers.delete(renderer));
      return result;
    };
    const report = (e) => { status.textContent = "Could not save. Your changes are still open; try Save again."; BC.toast && BC.toast.error("Locker could not save: " + e.message); };
    function persist() {
      clearTimeout(timer);
      if (disposed || !active || !dirty) return pending;
      const snapshot = normalize(active);
      pending = pending.catch(() => {}).then(() => save(snapshot)).then(() => {
        if (active?.id === snapshot.id && JSON.stringify(normalize(active)) === JSON.stringify(snapshot)) dirty = false;
        status.textContent = "Saved on this device";
      }).catch((e) => { report(e); throw e; });
      pending.catch(() => {}); return pending;
    }
    function change(fn) {
      if (disposed || !active) return;
      fn(active); dirty = true; active.updated = Date.now(); status.textContent = "Saving…";
      clearTimeout(timer); timer = setTimeout(persist, 350); paintList();
    }
    function paintList() {
      const found = items.filter((i) => (filter === "all" || i.type === filter) && [i.title, i.body, i.folder, ...i.cards.map((c) => c.front + " " + c.back)].join(" ").toLowerCase().includes(query))
        .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updated - a.updated);
      listPane.replaceChildren(...found.map((item) => {
        const b = el("button", { type: "button", class: "bcs-locker-item", "aria-pressed": String(active?.id === item.id) }, [
          BC.ui.icon(item.type === "set" ? "layers" : item.type === "link" ? "link" : "file"),
          el("div", null, [el("strong", { text: (item.pinned ? "★ " : "") + (item.title || "Untitled") }), el("span", { text: [item.folder, item.type === "set" ? item.cards.length + " cards" : item.type === "link" ? "Bookmark" : "Note"].filter(Boolean).join(" · ") })]),
        ]);
        b.onclick = () => { if (active) persist().catch(() => {}); active = item; dirty = false; paintEditor(); paintList(); }; return b;
      }));
      if (!found.length) listPane.append(el("p", { class: "bc-caption", text: items.length ? "No items match your search." : "Your ideas belong here. Create a note, bookmark or study set to begin." }));
    }
    function field(label, key, multiline) {
      const input = el(multiline ? "textarea" : "input", { class: "bc-input", value: active[key], "aria-label": label, placeholder: label });
      if (multiline) input.value = active[key];
      input.addEventListener("input", () => change((i) => { i[key] = input.value; }));
      input.addEventListener("blur", () => persist().catch(() => {}));
      return el("label", { class: "bcs-locker-field" }, [el("span", { text: label }), input]);
    }
    function paintEditor() {
      if (!active) { editor.replaceChildren(el("div", { class: "bcs-locker-empty" }, [BC.ui.icon("book"), el("h3", { text: "Your study locker" }), el("p", { text: "Keep notes, useful links and flashcards together. No account needed." })])); return; }
      const item = active;
      const actions = el("div", { class: "bcs-inline" }, [
        BC.ui.button(item.pinned ? "Unpin" : "Pin", { variant: "ghost", size: "sm", onClick: () => { change((i) => { i.pinned = !i.pinned; }); paintEditor(); } }),
        BC.ui.button("Save", { size: "sm", onClick: () => persist().catch(() => {}) }),
        el("span", { class: "bc-spacer" }),
        BC.ui.button("Delete", { size: "sm", variant: "ghost", onClick: async () => {
          if (!confirm("Delete “" + (item.title || "Untitled") + "” from your locker?")) return;
          clearTimeout(timer);
          try { await pending.catch(() => {}); await BC.Locker.remove(item.id); items = items.filter((i) => i.id !== item.id); active = null; paintEditor(); paintList(); } catch (e) { report(e); }
        } }),
      ]);
      editor.replaceChildren(actions, field("Title", "title"), field("Folder or course", "folder"));
      if (item.type === "link") {
        editor.append(field("Web address", "url"));
        const open = BC.ui.button("Open bookmark", { size: "sm", onClick: () => { if (BC.util.isSafeHttpUrl(active.url)) window.open(active.url, "_blank", "noopener,noreferrer"); else { status.textContent = "Enter a complete http:// or https:// address."; } } });
        editor.append(open);
      }
      if (item.type !== "set") editor.append(field(item.type === "note" ? "Your notes" : "Description", "body", true));
      else {
        const cards = el("div", { class: "bcs-locker-cards" });
        for (let n = 0; n < item.cards.length; n++) {
          const c = item.cards[n], front = el("textarea", { class: "bc-input", "aria-label": "Card " + (n + 1) + " question", placeholder: "Question or term" }), back = el("textarea", { class: "bc-input", "aria-label": "Card " + (n + 1) + " answer", placeholder: "Answer or definition" });
          front.value = c.front; back.value = c.back;
          front.oninput = () => change(() => { c.front = front.value; }); back.oninput = () => change(() => { c.back = back.value; });
          cards.append(el("div", { class: "bcs-locker-pair" }, [el("span", { text: String(n + 1) }), front, back, BC.ui.iconButton("x", { label: "Remove card " + (n + 1), onClick: () => { change((i) => i.cards.splice(n, 1)); paintEditor(); } })]));
        }
        editor.append(el("div", { class: "bcs-inline" }, [BC.ui.button("Study this set", { onClick: () => { persist().catch(() => {}); study(item); } }), BC.ui.button("Add card", { variant: "ghost", onClick: () => { if (item.cards.length >= 500) return; change((i) => i.cards.push({ front: "", back: "" })); paintEditor(); editor.querySelector('.bcs-locker-pair:last-child textarea')?.focus(); } })]), cards);
      }
    }
    function study(item) {
      let queue = item.cards.filter((c) => c.front.trim() && c.back.trim()).slice(), shown = false, learned = 0;
      const total = queue.length;
      if (!total) { status.textContent = "Add a question and answer before starting a study session."; return; }
      function paint() {
        const back = BC.ui.button("Back to set", { variant: "ghost", onClick: paintEditor });
        if (!queue.length) { editor.replaceChildren(back, el("div", { class: "bcs-locker-empty" }, [BC.ui.icon("check"), el("h3", { text: "Set complete" }), el("p", { text: "You reviewed all " + total + " cards." }), BC.ui.button("Study again", { onClick: () => study(item) })])); return; }
        const flip = el("button", { type: "button", class: "bcs-study-flip", "aria-label": shown ? "Answer. Flip to question" : "Question. Reveal answer", text: shown ? queue[0].back : queue[0].front });
        flip.onclick = () => { shown = !shown; paint(); };
        editor.replaceChildren(back, el("p", { class: "bc-caption", text: learned + " / " + total + " learned · " + queue.length + " remaining" }), flip,
          el("p", { class: "bc-caption", text: shown ? "How well did you know this?" : "Click the card or press Enter to reveal the answer." }));
        if (shown) editor.append(el("div", { class: "bcs-inline" }, [BC.ui.button("Study again", { variant: "ghost", onClick: () => { queue.push(queue.shift()); shown = false; paint(); } }), BC.ui.button("Got it", { onClick: () => { queue.shift(); learned++; shown = false; paint(); } })]));
        flip.focus();
      } paint();
    }
    async function create(type) {
      if (active) await persist().catch(() => {});
      const item = normalize({ type, title: "", cards: type === "set" ? [{ front: "", back: "" }] : [] });
      try { await createItem(item); } catch (error) { report(error); return; }
      if (disposed) return;
      active = item; items.push(active);
      paintList(); paintEditor(); editor.querySelector('input[aria-label="Title"]')?.focus();
    }
    async function exportItems() {
      try {
        await Promise.all([...renderers].map((renderer) => renderer.flush()));
        const current = await list();
        const url = URL.createObjectURL(new Blob([JSON.stringify({ format: "better-canvas-locker", version: 1, items: current }, null, 2)], { type: "application/json" }));
        const a = el("a", { href: url, download: "better-canvas-locker.json" }); a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch (error) { report(error); }
    }
    function importItems() {
      const input = el("input", { type: "file", accept: ".json,application/json" });
      input.onchange = async () => {
        try {
          const file = input.files[0]; if (!file) return; if (file.size > 5 * 1024 * 1024) throw new Error("Choose a file smaller than 5 MB");
          const data = JSON.parse(await file.text());
          if (data.format !== "better-canvas-locker" || !Array.isArray(data.items) || data.items.length > 1000) throw new Error("This is not a locker export");
          await persist();
          const incoming = await importBatch(data.items);
          items.push(...incoming);
          paintList(); status.textContent = incoming.length + " items imported";
        } catch (e) { report(e); }
      }; input.click();
    }
    search.oninput = () => { query = search.value.trim().toLowerCase(); paintList(); };
    const tabs = BC.ui.segmented({ value: "all", ariaLabel: "Locker item type", options: [{ value: "all", label: "All" }, { value: "note", label: "Notes" }, { value: "set", label: "Study sets" }, { value: "link", label: "Links" }], onChange: (v) => { filter = v; paintList(); } });
    root.append(el("style", null, CSS), el("div", { class: "bcs-locker-toolbar" }, [BC.ui.button("New note", { icon: "plus", onClick: () => create("note") }), BC.ui.button("Study set", { icon: "layers", variant: "ghost", onClick: () => create("set") }), BC.ui.button("Bookmark", { icon: "link", variant: "ghost", onClick: () => create("link") }), el("span", { class: "bc-spacer" }), BC.ui.button("Import", { size: "sm", variant: "ghost", onClick: importItems }), BC.ui.button("Export", { size: "sm", variant: "ghost", onClick: exportItems })]),
      status, el("div", { class: "bcs-locker-layout" }, [el("aside", null, [search, tabs.root, listPane]), editor]));
    list().then((data) => { if (!disposed) { items = data; paintList(); paintEditor(); } }).catch(report);
    return root;
  };
  const CSS = `
  .bcs-locker-toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px}
  .bcs-locker-layout{display:grid;grid-template-columns:250px minmax(0,1fr);gap:24px;margin-top:24px}
  .bcs-locker-layout>aside{min-width:0}.bcs-locker-layout>aside>.bc-input{width:100%;margin-bottom:12px}.bcs-locker-list{margin-top:18px}
  .bcs-locker-item{display:flex;gap:12px;align-items:center;text-align:left;background:none;border:1px solid transparent;border-radius:12px;padding:14px 10px;width:100%;cursor:pointer;margin-bottom:5px}
  .bcs-locker-item[aria-pressed=true]{background:var(--bc-accent-weak);border-color:var(--bc-accent)}.bcs-locker-item>div{min-width:0}.bcs-locker-item strong{display:block;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.bcs-locker-item span{display:block;font-size:11px;color:var(--bc-text-muted);margin-top:5px}
  .bcs-locker-editor{border:1px solid var(--bc-border);border-radius:20px;padding:24px;background:var(--bc-surface-1);min-width:0;min-height:440px}
  .bcs-locker-field{display:flex;flex-direction:column;gap:7px;margin:18px 0;font-size:12px}.bcs-locker-field .bc-input{width:100%}.bcs-locker-field textarea{min-height:270px;resize:vertical;line-height:1.8}
  .bcs-locker-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;min-height:360px;text-align:center;color:var(--bc-text-muted)}.bcs-locker-empty h3{font-size:23px;color:var(--bc-text)}.bcs-locker-empty p{max-width:300px;line-height:1.7}
  .bcs-locker-pair{display:grid;grid-template-columns:18px minmax(0,1fr) minmax(0,1fr) 30px;gap:8px;margin-top:16px;align-items:start}.bcs-locker-pair textarea{min-height:90px;resize:vertical;width:100%}
  .bcs-study-flip{width:100%;min-height:260px;padding:30px;margin:20px 0;border-radius:20px;border:1px solid var(--bc-border);background:var(--bc-surface-2);font-size:24px;white-space:pre-wrap;overflow-wrap:anywhere;cursor:pointer}
  @media(max-width:900px){.bcs-locker-layout{grid-template-columns:190px minmax(0,1fr);gap:14px}.bcs-locker-editor{padding:16px}}
  @media(max-width:600px){.bcs-locker-layout{display:block}.bcs-locker-list{max-height:180px;overflow:auto;margin-bottom:20px}.bcs-locker-pair{grid-template-columns:14px minmax(0,1fr) 30px}.bcs-locker-pair textarea:nth-of-type(2){grid-column:2}.bcs-locker-pair button{grid-column:3;grid-row:1}}
  `;
})();
