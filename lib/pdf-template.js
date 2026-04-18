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
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .page {
    max-width: 780px;
    margin: 0 auto;
    padding: 48px 56px 64px;
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
    page-break-inside: avoid;
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
  }

  /* Code blocks */
  pre {
    margin: 1em 0;
    padding: 14px 16px;
    background: var(--code-bg);
    border: 1px solid var(--code-border);
    border-radius: 6px;
    overflow: hidden;
    page-break-inside: avoid;
    position: relative;
  }
  pre code {
    background: transparent;
    border: 0;
    padding: 0;
    display: block;
    white-space: pre-wrap;
    word-break: break-word;
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

  /* Tables */
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 1em 0;
    font-size: 10pt;
    page-break-inside: avoid;
  }
  th, td {
    text-align: left;
    padding: 8px 10px;
    border-bottom: 1px solid var(--divider);
    vertical-align: top;
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

  /* Print */
  @page {
    size: A4;
    margin: 14mm 12mm;
  }

  @media print {
    html, body { background: var(--bg); }
    .page { max-width: 100%; padding: 0; }
    .no-print { display: none !important; }
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
    <button class="primary" onclick="window.print()">Save as PDF</button>
    <button onclick="window.close()">Close</button>
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
</body>
</html>`;
}
