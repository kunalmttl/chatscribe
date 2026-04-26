# Changelog

## 0.3.1 — 2026-04-27

### Fixed
- **Gemini Lazy Loading.** Added auto-scrolling to load full conversation history before extraction, targeting `chat-window-content > div.chat-history-scroll-container` with fallback to `div#chat-history`.
- **Missing Assistant Responses.** Fixed extraction of Gemini assistant messages by ensuring proper selection of `<model-response>` elements and content processing.
- **Unwanted Prefixes.** Removed erroneous "You said" prefixes from user messages in Gemini exports.
- **Line Break Preservation.** Fixed conversion of `<br>` tags to newlines in Gemini message content to preserve original formatting.

## 0.3.0 — 2026-04-26

### Added
- **Gemini Support.** ChatScribe now exports Gemini conversations in addition to ChatGPT. Exports are available in both Markdown and PDF formats.
- `content/gemini-api.js` — Gemini DOM extractor that queries `<user-query>` and `<model-response>` custom web components to build the conversation tree.
- Platform detection throughout the extension — the popup shows "ChatGPT" or "Gemini" based on the active tab, and all exports include platform indicators.

### Changed
- **Extension name updated.** Now "ChatScribe — ChatGPT & Gemini Exporter" to reflect dual-platform support.
- `content/extractor.js` — Added Gemini extraction functions and platform-based routing in the message handler.
- `popup/popup.js` — Updated to detect Gemini tabs, show appropriate platform labels, and handle Gemini exports.
- `manifest.json` — Added `https://gemini.google.com/*` to host permissions and content scripts.
- `tests/unit/gemini-extractor.test.js` — New test suite for Gemini extraction logic.

### Technical Notes
- Gemini uses DOM extraction (not API) due to its obfuscated `batchexecute` RPC endpoint. The extension iterates over custom web components (`#chat-history`, `<user-query>`, `<model-response>`) rather than relying on the brittle internal API.
- Images are exported as markdown image links (`![alt](src)`) rather than embedded base64 to keep file sizes manageable.
- Code blocks are extracted from `.code-block` or `code-immersive-panel` elements with language from `.code-language`.

## 0.2.4 — 2026-04-20

### Added
- **C++ Syntax Highlighting.** Implemented a lightweight, zero-dependency 
  syntax highlighter for C++ using a "Subdued Pastel" palette (Lavender keywords, 
  Sage strings, Teal types). This ensures code snippets in PDF exports are 
  beautifully color-coded without adding external bloat to the extension.

### Fixed
- **Windows PowerShell separator support in development scripts.** Fixed an issue 
  where command chaining (`&&`) would fail on Windows systems; added compatibility 
  for PowerShell/CMD execution environments.

## 0.2.3 — 2026-04-20

### Fixed
- **Major PDF Export Reliability Update.** Solved the infinite page-break loop 
  (e.g., 200+ pages) by removing `page-break-inside: avoid` from large 
  containers like tables and code blocks.
- **Side Cropping in PDF.** Fixed content being cut off on the right edge by 
  implementing a 15mm safety padding buffer in print mode. This ensures 
  compatibility even when the user selects "Margins: None" in the browser 
  print dialog.
- **Flexbox Print Stability.** Replaced `display: flex` with more primitive 
  print-safe layouts for headers, footers, and metadata to ensure better 
  rendering in virtual PDF printers (like Adobe PDF).

## 0.2.2 — 2026-04-20

### Added
- **Automated test suite.** Introduced a comprehensive `node:test` suite for core logic
  (markdown-to-HTML, filename building, metadata) and a UI verification script
  that generates a preview tab to audit the recently added toolbar functionality.
- `package.json` for managing test scripts and package configuration.


## 0.2.1 — 2026-04-19

### Fixed
- **Toolbar buttons in PDF preview now functional.** Added proper click
  handlers to the "Save as PDF" and "Close" buttons in the generated PDF
  preview toolbar. The toolbar is properly hidden in print output via
  `@media print` rules.

### Changed
- **Switched from DOM extraction to ChatGPT's backend API.** ChatScribe now
  calls `/backend-api/conversation/<id>` directly (authenticated with the
  bearer token from `/api/auth/session`) to fetch the original conversation
  as raw Markdown strings. This is how we always should have done it.

### Fixed
- **Code block newlines — for real this time.** The DOM approach fundamentally
  can't recover newlines reliably because ChatGPT's syntax highlighter uses
  `<span class="line">` blocks with no literal `\n` characters, and
  `innerText` behaves inconsistently in content-script isolated worlds. By
  reading the original markdown from ChatGPT's database, every `\n` is
  preserved perfectly.
- Also fixes subtle formatting drift in lists, tables, and nested
  blockquotes that were being reconstructed from styled HTML.

### Added
- `content/chatgpt-api.js` — backend API client that walks the conversation
  tree from `current_node` up the parent chain, merges consecutive assistant
  continuations, and handles `text`, `code`, `execution_output`, and
  `multimodal_text` content types.
- Graceful fallback: if the API call fails (e.g. on `/share/<id>` pages,
  when logged out, or if OpenAI changes the endpoint), the old DOM extractor
  runs automatically. The popup shows a `(DOM mode)` suffix when this
  happens so you know what's going on.

## 0.1.1 — 2026-04-18

### Fixed
- **Code blocks: newlines no longer collapsed.** ChatGPT's syntax highlighter
  often renders code with `<span class="line">` children that have no literal
  `\n` characters between them. The extractor now detects this and rebuilds
  newlines from the per-line spans (with `innerText` as a final fallback).
- **Language label leaking into code.** The first `<code>` inside a `<pre>`
  was sometimes the language header (e.g. `<code>C++</code>`). The extractor
  now prefers the `<code>` element with a `language-*` class and ignores
  header labels.
- **Ordered/unordered lists exploding into empty markers + orphan paragraphs.**
  When a `<li>` contained a `<p>` child, the marker was rendered on its own
  line followed by blank lines and then the content as a separate paragraph.
  Now list items are rendered as a single coherent block with proper
  continuation indentation.
- **Fenced code blocks inside list items** are now recognized even when
  indented (e.g. 2 spaces to stay within a list item).
- **C++ language tag normalization** — `C++` correctly becomes `cpp`.

## 0.1.0 — 2026-04-18

Initial release.
