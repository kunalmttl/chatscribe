/**
 * ChatScribe — Background Service Worker
 * Minimal right now — reserved for future features (context menus, shortcuts,
 * download management). Keeps the extension installable cleanly.
 */

chrome.runtime.onInstalled.addListener(() => {
  console.log("[ChatScribe] Installed.");
});

// Handle close tab requests from PDF preview
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CLOSE_TAB') {
    chrome.tabs.remove(sender.tab.id);
  }
});
