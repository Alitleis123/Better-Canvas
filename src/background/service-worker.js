/*
 * Better Canvas — background service worker.
 * The manifest statically injects on *.instructure.com. For custom school
 * domains the user grants host permission from the popup; this worker then
 * registers the same content scripts on those origins so Better Canvas runs
 * there on every load (and re-registers on startup / permission changes).
 */

const CONTENT_JS = [
  "src/shared/defaults.js",
  "src/content/core/util.js",
  "src/content/core/storage.js",
  "src/content/core/detect.js",
  "src/content/core/injector.js",
  "src/content/core/api.js",
  "src/shared/settings-ui.js",
  "src/content/features/theming.js",
  "src/content/features/cosmetics.js",
  "src/content/features/navigation.js",
  "src/content/features/dashboard.js",
  "src/content/features/todo.js",
  "src/content/features/grades.js",
  "src/content/features/settings-panel.js",
  "src/content/core/observer.js",
  "src/content/content.js",
];

const DYNAMIC_ID = "bc-dynamic";

function customOrigins(origins) {
  // Exclude the statically-matched Instructure pattern; keep user-added ones.
  return (origins || []).filter((o) => !/instructure\.com/.test(o));
}

async function syncRegistration() {
  try {
    const perms = await chrome.permissions.getAll();
    const matches = customOrigins(perms.origins);

    const existing = await chrome.scripting.getRegisteredContentScripts({
      ids: [DYNAMIC_ID],
    });
    if (existing.length) {
      await chrome.scripting.unregisterContentScripts({ ids: [DYNAMIC_ID] });
    }
    if (!matches.length) return;

    await chrome.scripting.registerContentScripts([
      {
        id: DYNAMIC_ID,
        js: CONTENT_JS,
        matches,
        runAt: "document_start",
        allFrames: false,
        persistAcrossSessions: true,
      },
    ]);
  } catch (e) {
    console.warn("[Better Canvas] registration sync failed", e);
  }
}

chrome.runtime.onInstalled.addListener(syncRegistration);
chrome.runtime.onStartup.addListener(syncRegistration);
chrome.permissions.onAdded.addListener(syncRegistration);
chrome.permissions.onRemoved.addListener(syncRegistration);

// Allow the popup to ask for a re-sync immediately after granting permission.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "bc:syncRegistration") {
    syncRegistration().then(() => sendResponse({ ok: true }));
    return true;
  }
});
