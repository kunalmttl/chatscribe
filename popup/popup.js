/**
 * ChatScribe — Popup Controller
 * Orchestrates: extract → build → download.
 */

import { buildMarkdown, suggestedFilename } from "../lib/markdown.js";
import { buildPdfHtml } from "../lib/pdf-template.js";

const $ = (sel) => document.querySelector(sel);

const els = {
  status: $("#status"),
  statusText: $(".status-text"),
  filename: $("#filename"),
  exportBtn: $("#export-btn"),
  message: $("#message"),
  optMeta: $("#opt-meta"),
  optDark: $("#opt-dark"),
  segBtns: document.querySelectorAll(".seg-btn"),
};

let state = {
  format: "pdf",
  chatTitle: "",
  isChatGpt: false,
  tabId: null,
};

// --- State helpers ------------------------------------------------------

function setStatus(kind, text) {
  els.status.classList.remove("status--ok", "status--bad", "status--checking");
  els.status.classList.add(`status--${kind}`);
  els.statusText.textContent = text;
}

function setMessage(text, kind = "") {
  els.message.className = "message" + (kind ? " " + kind : "");
  els.message.textContent = text;
}

function updateFilenamePlaceholder() {
  const ext = state.format === "pdf" ? "pdf" : "md";
  const suggested = suggestedFilename(state.chatTitle || "chatgpt-conversation", ext);
  els.filename.placeholder = suggested;
}

// --- Format toggle ------------------------------------------------------

els.segBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    els.segBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    state.format = btn.dataset.format;
    updateFilenamePlaceholder();
  });
});

// --- Page detection -----------------------------------------------------

async function detectChatGptTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  state.tabId = tab?.id ?? null;
  const url = tab?.url || "";
  state.isChatGpt =
    url.startsWith("https://chatgpt.com/") || url.startsWith("https://chat.openai.com/");

  if (!state.isChatGpt) {
    setStatus("bad", "Open a ChatGPT chat to export");
    els.exportBtn.disabled = true;
    return;
  }

  // Ping content script
  try {
    const pong = await chrome.tabs.sendMessage(state.tabId, { type: "CHATSCRIBE_PING" });
    if (pong?.ok) {
      setStatus("ok", "ChatGPT detected · Ready");
      els.exportBtn.disabled = false;
    } else {
      throw new Error("no-response");
    }
  } catch {
    // Content script might not be injected yet — try programmatic injection
    try {
      await chrome.scripting.executeScript({
        target: { tabId: state.tabId },
        files: ["content/extractor.js"],
      });
      setStatus("ok", "ChatGPT detected · Ready");
      els.exportBtn.disabled = false;
    } catch (err) {
      setStatus("bad", "Reload the ChatGPT page and try again");
      els.exportBtn.disabled = true;
    }
  }

  // Pre-fill filename suggestion from tab title
  const title = (tab?.title || "").replace(/^ChatGPT[\s\-–—]*/i, "").trim();
  state.chatTitle = title || "ChatGPT Conversation";
  updateFilenamePlaceholder();
}

// --- Export flow --------------------------------------------------------

async function extract() {
  const response = await chrome.tabs.sendMessage(state.tabId, { type: "CHATSCRIBE_EXTRACT" });
  if (!response?.ok) throw new Error(response?.error || "Extraction failed");
  return response.data;
}

async function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  try {
    await chrome.downloads.download({ url, filename, saveAs: true });
  } finally {
    // Revoke after a delay so the download can start
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}

async function exportMarkdown(data) {
  const md = buildMarkdown(data, { includeMeta: els.optMeta.checked });
  const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
  const name =
    (els.filename.value.trim() || suggestedFilename(data.title, "md")).replace(/\.md$/i, "") + ".md";
  await downloadBlob(blob, name);
}

async function exportPdf(data) {
  const theme = els.optDark.checked ? "dark" : "light";
  const html = buildPdfHtml(data, { theme, includeMeta: els.optMeta.checked });

  // Open a new tab with the rendered document — user saves as PDF via print dialog
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  await chrome.tabs.create({ url, active: true });
  // Keep URL alive long enough for the tab to load
  setTimeout(() => URL.revokeObjectURL(url), 120_000);
}

els.exportBtn.addEventListener("click", async () => {
  els.exportBtn.classList.add("loading");
  els.exportBtn.disabled = true;
  setMessage("Extracting conversation…");

  try {
    const data = await extract();
    if (!data.messages || data.messages.length === 0) {
      throw new Error("No messages found on this page");
    }

    // Use user-entered title if provided (strip extension if they added one)
    if (els.filename.value.trim()) {
      data.title = els.filename.value.trim().replace(/\.(pdf|md|markdown)$/i, "");
    }

    setMessage("Building document…");
    if (state.format === "md") {
      await exportMarkdown(data);
      setMessage(`Exported ${data.messages.length} messages to Markdown`, "success");
    } else {
      await exportPdf(data);
      setMessage("PDF preview opened — use the print dialog to save", "success");
    }
  } catch (err) {
    setMessage(`Error: ${err.message || err}`, "error");
  } finally {
    els.exportBtn.classList.remove("loading");
    els.exportBtn.disabled = false;
  }
});

// Enter key in filename input triggers export
els.filename.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !els.exportBtn.disabled) els.exportBtn.click();
});

// Init
detectChatGptTab();
