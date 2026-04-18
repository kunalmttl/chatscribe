# Changelog

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
