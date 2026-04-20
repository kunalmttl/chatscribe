# Context

This document captures the *why* behind ChatScribe — what problem it solves,
what design decisions were made, and the constraints that shaped them. Read
this before changing architecture; read `project_state.md` for the current
implementation snapshot.

## Problem

Exporting a ChatGPT conversation to a clean, readable, offline document is
surprisingly hard:

- The built-in "Share" link requires an internet connection and ties the
  artifact to OpenAI's servers.
- Browser "Print to PDF" on the chat page produces a mess — sidebars,
  message action icons, avatars, "Regenerate" buttons, and stylesheet
  artifacts all leak into the output.
- Copy-pasting loses formatting: code blocks become plain paragraphs,
  lists collapse, tables vanish.
- Existing extensions either require a paid account, leak data through
  third-party servers, or produce ugly output.

ChatScribe exists to produce a **beautiful, minimal, fully-local export**
of any ChatGPT conversation as either a PDF or a Markdown file, with
code, lists, tables, and math preserved exactly as ChatGPT rendered them.

## Design principles

1. **Local-only.** No network calls to anything except ChatGPT itself.
   No analytics, no telemetry, no third-party services. Everything runs
   inside the user's browser.
2. **Zero dependencies at runtime.** No bundled npm packages in the
   extension payload. The `lib/` helpers are hand-written. This keeps the
   unpacked extension under ~200 KB and makes security review trivial.
3. **Original markdown, not reconstructed HTML.** We fetch the conversation
   from ChatGPT's own backend API, which returns the exact Markdown string
   stored in OpenAI's database. This avoids the entire class of bugs that
   come from trying to reverse-engineer a syntax-highlighted, virtualized,
   React-rendered DOM.
4. **Dark, flat, minimal aesthetic.** The popup and the generated PDF both
   use the same design tokens: `#0f0f10` background, `#e4e4e7` text,
   `#38bdf8` accent, Inter for prose, JetBrains Mono for code. No
   gradients, no shadows, no rounded-everything.
5. **Graceful degradation.** If the API call fails (share pages,
   logged-out sessions, API shape changes), fall back to DOM extraction
   automatically and label the output so the user knows.

## Key architectural decisions

### Backend API over DOM scraping (v0.2.0)

The original v0.1.x implementation walked the DOM to reconstruct markdown.
This hit a hard wall with code blocks: ChatGPT's syntax highlighter renders
code as a pile of `<span class="line">` elements with `display: block` and
no literal `\n` in `textContent`. `innerText` behaves inconsistently inside
a content script's isolated world, so newlines were routinely lost.

The fix was to stop fighting the DOM and call ChatGPT's own endpoints:

- `GET /api/auth/session` returns `{ accessToken }` using the user's
  existing session cookies (same-origin, so the content script can just
  `fetch()` it).
- `GET /backend-api/conversation/<id>` with a Bearer token returns the
  full conversation tree, including every message's raw markdown string.

We walk the `mapping` tree from `current_node` up the parent chain,
merge consecutive assistant continuations, and handle the four relevant
content types (`text`, `code`, `execution_output`, `multimodal_text`).

This is the same approach pionxzh/chatgpt-exporter uses — it's the only
way to get byte-perfect output.

### MV3, no service worker state

The extension uses Manifest V3. The background service worker is
stateless — the popup sends a message to the content script, which does
all the extraction, formatting, and file generation in the page context.
PDF generation uses the browser's native `window.print()` in a new tab
loaded with a styled HTML template. No puppeteer, no headless Chrome,
no PDF library.

### Two rendering paths, one markdown source

Both the `.md` export and the `.pdf` export start from the same canonical
markdown string:

- `.md`: streamed straight to `chrome.downloads.download()` as a Blob.
- `.pdf`: passed through `lib/md-to-html.js` (a hand-written Markdown →
  HTML converter) and wrapped in `lib/pdf-template.js`, then opened in a
  new tab for the user to print.

Keeping a single source of truth means fixes apply uniformly.

### Automated testing (v0.2.2)

To ensure the hand-written converter (`md-to-html.js`) stays reliable as
we handle more edge cases (like ChatGPT's info strings or nested lists),
we use a zero-dependency `node:test` suite. This allows us to verify
recursive rendering and HTML escaping without needing a full browser
environment. UI-critical components (like the PDF toolbar) are verified
via a generation script that produces an audit artifact.

## Non-goals

- **Not a ChatGPT client.** We don't send messages, manage history, or
  replace the UI.
- **Not a universal LLM exporter.** Scoped to `chatgpt.com` and `chat.openai.com`.
  Claude, Gemini, etc. are out of scope.
- **Not a sync service.** Exports are one-shot downloads; we don't store
  them anywhere.
- **Not a rich editor.** The output is read-only; if the user wants to
  edit, they can open the `.md` in their own tool.

## Constraints that shaped the code

- **Content-script isolated world.** Any code that needs access to the
  page's `window` globals (not applicable right now, but relevant for
  future work) has to be injected into the main world via
  `chrome.scripting.executeScript({ world: "MAIN" })`.
- **MV3 CSP.** No `eval`, no remote scripts, no inline `<script>` in the
  extension's own HTML (popup). The generated PDF-template HTML opens in a
  regular tab, so inline scripts are fine there.
- **No bundler.** We ship plain ES modules and classic scripts. Keep it
  that way — every build step added is a build step that can break.
- **Same-origin for API calls.** `fetch('/api/auth/session')` and
  `fetch('/backend-api/conversation/...')` only work from a content script
  running on `chatgpt.com`. Don't move the API client into the background
...
  worker — it would need host permissions and wouldn't carry cookies the
  same way.

## Error Log

- **2026-04-20**: Encountered `multi_replace_file_content` corruption in `lib/pdf-template.js` due to large/overlapping chunks. Fixed by full-file rewrite using `write_to_file`.
- **2026-04-20**: Infinite page break loop (201 pages) and side cropping in PDF export. Root cause: `page-break-inside: avoid` on large containers and removal of padding in print mode. Fixed by removing `avoid` rules, killed flexbox in print, and added safety buffer padding.

