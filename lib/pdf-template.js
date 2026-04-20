/**
 * ChatScribe — PDF Template
 * Produces a self-contained HTML document styled for print-to-PDF.
 * Dark mode, flat palette, minimal, copy-pasteable.
 */

import { mdToHtml } from "./md-to-html.js";

// Flat dark palette — easy on eyes, prints cleanly
const THEME = {
  light: {
    bg: "#fafaf9",
    surface: "#ffffff",
    border: "#e7e5e4",
    text: "#1c1917",
    muted: "#78716c",
    accent: "#0ea5e9",
    codeBg: "#f5f5f4",
    codeBorder: "#e7e5e4",
    codeText: "#1c1917",
    userTag: "#0ea5e9",
    aiTag: "#14b8a6",
    divider: "#e7e5e4",
  },
  dark: {
    bg: "#0f0f10",
    surface: "#17171a",
    border: "#27272a",
    text: "#e4e4e7",
    muted: "#71717a",
    accent: "#38bdf8",
    codeBg: "#141416",
    codeBorder: "#27272a",
    codeText: "#e4e4e7",
    userTag: "#38bdf8",
    aiTag: "#2dd4bf",
    divider: "#27272a",
  },
};

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function buildPdfHtml(data, options = {}) {
  const { title, url, exportedAt, messages } = data;
  const {
    theme = "dark",
    includeMeta = true,
    fontBody = "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif",
    fontMono = "'JetBrains Mono', 'SF Mono', 'Menlo', 'Consolas', monospace",
  } = options;

  const c = THEME[theme] || THEME.dark;

  const date = new Date(exportedAt);
  const formattedDate = date.toLocaleString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const messageHtml = messages
    .map((m) => {
      const isUser = m.role === "user";
      const label = isUser ? "You" : "ChatGPT";
      const tagClass = isUser ? "tag-user" : "tag-ai";
      const body = mdToHtml(m.markdown);
      return `
        <section class="message ${isUser ? "msg-user" : "msg-ai"}">
          <div class="msg-header">
            <span class="tag ${tagClass}">${label}</span>
          </div>
          <div class="msg-body">
            ${body}
          </div>
        </section>
      `;
    })
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  :root {
    --bg: ${c.bg};
    --surface: ${c.surface};
    --border: ${c.border};
    --text: ${c.text};
    --muted: ${c.muted};
    --accent: ${c.accent};
    --code-bg: ${c.codeBg};
    --code-border: ${c.codeBorder};
    --code-text: ${c.codeText};
    --user-tag: ${c.userTag};
    --ai-tag: ${c.aiTag};
    --divider: ${c.divider};
  }

  * { box-sizing: border-box; }

  html, body {
    margin: 0;
    padding: 0;
    background: var(--bg);
    color: var(--text);
    font-family: ${fontBody};
    font-size: 11pt;
    line-height: 1.65;
    -webkit-font-smoothing: antialiased;
    overflow-wrap: break-word;
    word-wrap: break-word;
    word-break: break-word;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .page {
    max-width: 700px;
    margin: 0 auto;
    padding: 48px 40px 64px;
    width: 100%;
  }

  header.doc-header {
    margin-bottom: 40px;
    padding-bottom: 24px;
    border-bottom: 1px solid var(--divider);
  }

  .doc-title {
    font-size: 22pt;
    font-weight: 700;
    letter-spacing: -0.02em;
    margin: 0 0 12px;
    color: var(--text);
  }

  .doc-meta {
    font-size: 9pt;
    color: var(--muted);
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
  }

  .doc-meta .meta-item { display: inline-flex; align-items: center; gap: 6px; }

  .brand {
    font-size: 8.5pt;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--muted);
    font-weight: 500;
    margin-bottom: 8px;
  }

  /* Messages */
  .message {
    margin: 0 0 28px;
    display: block;
    break-inside: auto;
  }

  .msg-header { margin-bottom: 8px; }

  .tag {
    display: inline-block;
    font-size: 8.5pt;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 3px 10px;
    border-radius: 4px;
    background: transparent;
    border: 1px solid currentColor;
  }
  .tag-user { color: var(--user-tag); }
  .tag-ai   { color: var(--ai-tag); }

  .msg-body {
    padding-left: 2px;
  }

  .msg-body > *:first-child { margin-top: 0; }
  .msg-body > *:last-child  { margin-bottom: 0; }

  /* Typography */
  h1, h2, h3, h4, h5, h6 {
    font-weight: 600;
    letter-spacing: -0.01em;
    line-height: 1.3;
    margin: 1.2em 0 0.5em;
    color: var(--text);
    page-break-after: avoid;
    break-after: avoid;
  }
  h1 { font-size: 16pt; }
  h2 { font-size: 14pt; }
  h3 { font-size: 12.5pt; }
  h4 { font-size: 11.5pt; }
  h5, h6 { font-size: 11pt; color: var(--muted); }

  p { margin: 0 0 0.9em; }

  a { color: var(--accent); text-decoration: none; border-bottom: 1px solid rgba(56,189,248,0.35); }

  ul, ol { margin: 0 0 1em; padding-left: 22px; }
  li { margin: 0.25em 0; }
  li > p { margin: 0.25em 0; }

  blockquote {
    margin: 1em 0;
    padding: 4px 16px;
    border-left: 3px solid var(--border);
    color: var(--muted);
    break-inside: auto;
  }

  hr {
    border: 0;
    border-top: 1px solid var(--divider);
    margin: 20px 0;
  }

  /* Inline code */
  code {
    font-family: ${fontMono};
    font-size: 0.9em;
    background: var(--code-bg);
    border: 1px solid var(--code-border);
    color: var(--code-text);
    padding: 1px 5px;
    border-radius: 4px;
    overflow-wrap: anywhere;
  }

  /* Code blocks */
  pre {
    margin: 1em 0;
    padding: 14px 16px;
    background: var(--code-bg);
    border: 1px solid var(--code-border);
    border-radius: 6px;
    position: relative;
    break-inside: auto;
    overflow: visible; /* Prevent clipping */
  }
  pre code {
    background: transparent;
    border: 0;
    padding: 0;
    display: block;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    word-break: break-all; /* Final safety fallback */
    font-size: 9.5pt;
    line-height: 1.55;
    color: var(--code-text);
  }
  pre[data-lang]::before {
    content: attr(data-lang);
    position: absolute;
    top: 6px;
    right: 10px;
    font-family: ${fontMono};
    font-size: 7.5pt;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--muted);
  }

  /* Syntax Highlighting (Subdued Pastel) */
  .token-kw   { color: #B4A0E5; font-weight: 600; }
  .token-str  { color: #A6D189; }
  .token-com  { color: #737994; font-style: italic; }
  .token-num  { color: #EF9F76; }
  .token-type { color: #81C8BE; }
  .token-prep { color: #99D1DB; }

  /* Tables */
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 1em 0;
    font-size: 10pt;
    table-layout: auto;
    break-inside: auto;
  }
  th, td {
    text-align: left;
    padding: 8px 10px;
    border-bottom: 1px solid var(--divider);
    vertical-align: top;
    overflow-wrap: break-word;
  }
  th {
    font-weight: 600;
    color: var(--text);
    border-bottom: 1.5px solid var(--border);
  }
  td { color: var(--text); }

  /* Images */
  img {
    max-width: 100%;
    border-radius: 4px;
    border: 1px solid var(--border);
  }

  /* Footer */
  footer.doc-footer {
    margin-top: 48px;
    padding-top: 20px;
    border-top: 1px solid var(--divider);
    font-size: 8.5pt;
    color: var(--muted);
    display: flex;
    justify-content: space-between;
  }

  /* Print Specifics */
  @page {
    size: auto;
    margin: 0; /* Handled by .page padding for robustness */
  }

  @media print {
    body { background: var(--surface) !important; }
    .page {
      max-width: 100% !important;
      padding: 15mm 20mm !important;
      margin: 0 !important;
      width: 100% !important;
    }
    .doc-meta, .doc-footer {
      display: block !important;
    }
    .meta-item {
      display: block !important;
      margin-bottom: 4px;
    }
    .no-print { display: none !important; }
    
    /* Ensure no loops */
    * { break-inside: auto !important; }
    h1, h2, h3, h4, h5, h6 { break-after: avoid !important; }
  }

  /* Screen-only toolbar */
  .toolbar {
    position: fixed;
    top: 16px;
    right: 16px;
    display: flex;
    gap: 8px;
    z-index: 1000;
  }
  .toolbar button {
    font-family: inherit;
    font-size: 9.5pt;
    font-weight: 500;
    padding: 8px 14px;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text);
    cursor: pointer;
  }
  .toolbar button.primary {
    background: var(--accent);
    color: #0a0a0a;
    border-color: var(--accent);
  }
</style>
</head>
<body>
   <div class="toolbar no-print">
     <button id="btn-print" class="primary">Save as PDF</button>
     <button id="btn-close">Close</button>
   </div>
  <main class="page">
    <header class="doc-header">
      <div class="brand">ChatScribe</div>
      <h1 class="doc-title">${escapeHtml(title)}</h1>
      ${
        includeMeta
          ? `<div class="doc-meta">
              <span class="meta-item">Exported ${escapeHtml(formattedDate)}</span>
              <span class="meta-item">${messages.length} messages</span>
            </div>`
          : ""
      }
    </header>

    ${messageHtml}

    <footer class="doc-footer">
      <span>Generated with ChatScribe</span>
      <span>${escapeHtml(formattedDate)}</span>
    </footer>
  </main>
   <script>
     // Auto-open print dialog after fonts load
     window.addEventListener('load', () => {
       if (document.fonts && document.fonts.ready) {
         document.fonts.ready.then(() => {
           // Small delay so the user sees the preview before print dialog
           setTimeout(() => window.print(), 400);
         });
       } else {
         setTimeout(() => window.print(), 600);
       }
     });
   </script>
   <script>
     // Button click handlers
     document.getElementById('btn-print').addEventListener('click', () => window.print());
     document.getElementById('btn-close').addEventListener('click', async () => {
       try {
         window.close();
       } catch (e) {
         // Fallback for when window.close() is not allowed
         try {
           chrome.runtime.sendMessage({type: 'CLOSE_TAB'});
         } catch (e2) {
           // Last resort: just remove the toolbar and let user close manually
           document.querySelector('.toolbar').style.display = 'none';
         }
       }
     });
   </script>
 </body>
</html>`;
}
