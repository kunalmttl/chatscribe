/**
 * ChatScribe — Background Service Worker
 * Minimal right now — reserved for future features (context menus, shortcuts,
 * download management). Keeps the extension installable cleanly.
 */

chrome.runtime.onInstalled.addListener(() => {
  console.log("[ChatScribe] Installed.");
});
