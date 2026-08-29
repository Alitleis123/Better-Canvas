/*
 * Better Canvas — background service worker.
 * Registers dynamic content scripts on user-granted custom Canvas domains.
 * Manages toolbar badge count. All content-side features run in the tab.
 */

// Derived from the manifest, never restated. These lists are what gets injected
// on user-granted custom Canvas domains, so a hand-maintained copy that drifts
// from manifest.json makes the extension behave differently there than on
// *.instructure.com -- with no error to notice, because both lists are valid.
function manifestScripts(allFrames) {
  const entry = (chrome.runtime.getManifest().content_scripts || [])
    .find((c) => !!c.all_frames === allFrames);
  return (entry && entry.js) || [];
}

const DYNAMIC_ID = "bc-dynamic";
const DYNAMIC_FRAME_ID = "bc-dynamic-frame";

function customOrigins(origins) {
  return (origins || []).filter((o) => !/instructure\.com/.test(o));
}

async function syncRegistration() {
  try {
    const perms = await chrome.permissions.getAll();
    const matches = customOrigins(perms.origins);
    const ids = [DYNAMIC_ID, DYNAMIC_FRAME_ID];
    const existing = await chrome.scripting.getRegisteredContentScripts({ ids });
    if (existing.length) await chrome.scripting.unregisterContentScripts({ ids: existing.map((s) => s.id) });
    if (!matches.length) return;
    await chrome.scripting.registerContentScripts([
      {
        id: DYNAMIC_ID, js: manifestScripts(false), matches,
        runAt: "document_start", allFrames: false, persistAcrossSessions: true,
      },
      {
        id: DYNAMIC_FRAME_ID, js: manifestScripts(true), matches,
        runAt: "document_start", allFrames: true, matchOriginAsFallback: true, persistAcrossSessions: true,
      },
    ]);
  } catch (e) { console.warn("[Better Canvas] registration sync failed", e); }
}

chrome.runtime.onInstalled.addListener(syncRegistration);
chrome.runtime.onStartup.addListener(syncRegistration);
if (chrome.permissions && chrome.permissions.onAdded) chrome.permissions.onAdded.addListener(syncRegistration);
if (chrome.permissions && chrome.permissions.onRemoved) chrome.permissions.onRemoved.addListener(syncRegistration);

// Popup-triggered re-sync.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.type) return;
  if (msg.type === "bc:syncRegistration") { syncRegistration().then(() => sendResponse({ ok: true })); return true; }
  if (msg.type === "bc:setBadge") {
    try {
      const n = msg.count | 0;
      // Scope to the sending tab. A global badge meant every open Canvas tab
      // overwrote the others, so the count shown belonged to whichever tab
      // happened to scan last rather than the one being looked at.
      const tabId = sender && sender.tab && sender.tab.id;
      const target = tabId == null ? {} : { tabId };
      chrome.action.setBadgeText({ ...target, text: n > 0 ? String(n) : "" });
      chrome.action.setBadgeBackgroundColor({ ...target, color: "#dc2626" });
    } catch (_) {}
    sendResponse({ ok: true }); return;
  }
});

// Right-click context menu: quick-add task
try {
  chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
      id: "bc-add-task",
      title: "Better Canvas: add this as a task",
      contexts: ["page", "selection", "link"],
      documentUrlPatterns: ["*://*.instructure.com/*"],
    }, () => chrome.runtime.lastError);
  });
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId !== "bc-add-task" || !tab || tab.id == null) return;
    // The callback is required: without it, a tab with no content script (the
    // page was never injected, or the extension was just reloaded) raises an
    // unchecked runtime.lastError into the console on every click.
    chrome.tabs.sendMessage(tab.id, { type: "bc:addTaskFromContext", info }, () => void chrome.runtime.lastError);
  });
} catch (_) {}
