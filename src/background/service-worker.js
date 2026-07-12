/*
 * Better Canvas — background service worker.
 * Registers dynamic content scripts on user-granted custom Canvas domains.
 * Manages toolbar badge count. All content-side features run in the tab.
 */

const CONTENT_JS = [
  "src/shared/defaults.js",
  "src/shared/themes.js",
  "src/content/core/util.js",
  "src/content/core/datetime.js",
  "src/content/core/color.js",
  "src/content/core/storage.js",
  "src/content/core/detect.js",
  "src/content/core/injector.js",
  "src/content/core/lifecycle.js",
  "src/content/core/ui.js",
  "src/content/core/cache.js",
  "src/content/core/api.js",
  "src/content/core/alarms.js",
  "src/content/core/toast.js",
  "src/content/core/shortcuts.js",
  "src/content/core/commandPalette.js",
  "src/shared/settings/state.js",
  "src/shared/settings/components.js",
  "src/shared/settings/index.js",
  "src/content/features/theming.js",
  "src/content/features/cosmetics.js",
  "src/content/features/navigation.js",
  "src/content/features/dashboard.js",
  "src/content/features/todo.js",
  "src/content/features/grades.js",
  "src/content/features/notifications.js",
  "src/content/features/files.js",
  "src/content/features/announcements.js",
  "src/content/features/calendar.js",
  "src/content/features/previews.js",
  "src/content/features/productivity.js",
  "src/content/features/accessibility.js",
  "src/content/features/instructor.js",
  "src/content/features/quizsaver.js",
  "src/content/features/modules.js",
  "src/content/features/semester.js",
  "src/content/features/discussions.js",
  "src/content/features/insights.js",
  "src/content/features/syllabus.js",
  "src/content/features/rotation.js",
  "src/content/features/onboarding.js",
  "src/content/features/settings-panel.js",
  "src/content/core/observer.js",
  "src/content/content.js",
];

const FRAME_JS = [
  "src/shared/defaults.js",
  "src/shared/themes.js",
  "src/content/core/datetime.js",
  "src/content/core/color.js",
  "src/content/frame.js",
];

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
        id: DYNAMIC_ID, js: CONTENT_JS, matches,
        runAt: "document_start", allFrames: false, persistAcrossSessions: true,
      },
      {
        id: DYNAMIC_FRAME_ID, js: FRAME_JS, matches,
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
      chrome.action.setBadgeText({ text: n > 0 ? String(n) : "" });
      chrome.action.setBadgeBackgroundColor({ color: "#dc2626" });
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
    chrome.tabs.sendMessage(tab.id, { type: "bc:addTaskFromContext", info });
  });
} catch (_) {}
