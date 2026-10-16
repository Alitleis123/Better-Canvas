const vm = require("node:vm");
const { webcrypto } = require("node:crypto");
const { load, copy } = require("./audit-helpers.cjs");
const globals = { crypto: webcrypto, TextEncoder, console, queueMicrotask, structuredClone, setTimeout, clearTimeout,
  setInterval, clearInterval, navigator: { platform: "Win32" } };

// Independent VM contexts use the production message listener and one shared
// persistent database. Only storage and the browser transport are mocked.
function database(seed = {}) {
  const data = { bcLocal: { notes: {}, drafts: {}, cache: {} }, ...copy(seed) };
  const events = [], reads = [], requests = [], tabs = [];
  let failure, beforeSend;
  const runtime = { id: "test" };
  const api = {
    get(keys, callback) {
      requests.push(copy(keys));
      const selected = keys == null ? data : Object.fromEntries((Array.isArray(keys) ? keys : [keys]).filter((key) => Object.hasOwn(data, key)).map((key) => [key, data[key]]));
      const result = copy(selected);
      queueMicrotask(() => callback(result));
    },
    getKeys(callback) { queueMicrotask(() => callback(Object.keys(data))); },
    set(values, callback) {
      queueMicrotask(() => {
        if (failure) { runtime.lastError = { message: failure }; callback(); delete runtime.lastError; return; }
        const changes = {};
        for (const [key, value] of Object.entries(values)) {
          changes[key] = { oldValue: data[key], newValue: copy(value) }; data[key] = copy(value);
        }
        events.push(changes); callback();
      });
    },
    remove(keys, callback) { queueMicrotask(() => { for (const key of Array.isArray(keys) ? keys : [keys]) delete data[key]; callback(); }); },
  };
  let messageListener;
  const noopEvent = { addListener() {} };
  const background = vm.createContext({ ...globals, chrome: {
    runtime: Object.assign(runtime, { onInstalled: noopEvent, onStartup: noopEvent, onMessage: { addListener(fn) { messageListener = fn; } } }),
    permissions: {}, contextMenus: { onClicked: noopEvent }, storage: { local: api },
  } });
  load(background, "src/background/service-worker.js");
  function client() {
    const handlers = [];
    const tab = { holdReads: false };
    tab.chrome = { runtime: { id: runtime.id, get lastError() { return runtime.lastError; }, getURL: (s) => "chrome-extension://test/" + s,
      sendMessage(message, callback) {
        if (beforeSend) beforeSend(message);
        messageListener(copy(message), { id: runtime.id }, (response) => callback(copy(response)));
      } }, storage: { local: { ...api, get(keys, callback) {
        api.get(keys, (value) => { if (tab.holdReads) reads.push(() => callback(value)); else callback(value); });
      } }, onChanged: { addListener: (fn) => handlers.push(fn) } } };
    tab.deliver = (changes) => handlers.forEach((fn) => fn(changes, "local"));
    tabs.push(tab);
    return tab;
  }
  function tab() {
    const t = client();
    t.context = vm.createContext({ ...globals, chrome: t.chrome });
    load(t.context, "src/shared/defaults.js", "src/content/core/util.js", "src/content/core/storage.js");
    t.storage = t.context.BC.storage;
    return t;
  }
  return { data, persisted: data, events, reads, requests, api, runtime, client, tab, globals,
    message: (message, sender, respond) => messageListener(copy(message), sender, respond),
    fail: (value) => { failure = value; }, beforeSend: (fn) => { beforeSend = fn; },
    holdReads: (value) => tabs.forEach((t) => { t.holdReads = value; }),
  };
}
module.exports = { database, globals };
