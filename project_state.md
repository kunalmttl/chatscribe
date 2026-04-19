# Project State

Snapshot of the current implementation. Update this whenever a release ships
or a significant architectural change lands. Read `context.md` first for the
*why*; this document is the *what*.

**Last updated:** 2026-04-19
**Current version:** 0.2.0 (+ two patch fixes on `main`)
**Repo:** https://github.com/kunalmttl/chatscribe
**License:** MIT

---

## Status

- ✅ Core extraction via ChatGPT backend API
- ✅ Markdown export
- ✅ PDF export (via styled HTML + `window.print()`)
- ✅ DOM-based fallback extractor
- ✅ Dark, flat popup UI
- ✅ Code fence handling (including ChatGPT's `id="..."` info strings)
- ⏳ Toolbar buttons in generated PDF preview tab (not yet wired up —
  plan documented, not implemented)
- ⏳ Automated tests (none — manual testing only)

## File map

```
chatscribe/
├── manifest.json              MV3 manifest, version 0.2.0
├── background/
│   └── background.js          Service worker; routes downloads and
│                              opens the PDF preview tab
├── content/
│   ├── chatgpt-api.js         Backend API client (primary extractor)
│   │                            - getAccessToken() from /api/auth/session
│   │                            - fetchConversation(id) from /backend-api
│   │                            - walks mapping tree from current_node up
│   │                            - merges consecutive assistant continuations
│   │                            - exposes window.__chatscribeApi
│   └── extractor.js           DOM fallback extractor + message handler;
│                              tries API first, falls back to DOM on error
├── popup/
│   ├── popup.html             Version label, action buttons
│   ├── popup.css              Dark flat theme
│   └── popup.js               Injects content scripts, sends EXTRACT
│                              message, displays result; appends
│                              "(DOM mode)" when fallback was used
├── lib/
│   ├── markdown.js            Builds final .md document from the
│                              canonical conversation object
│   ├── md-to-html.js          Zero-dep Markdown → HTML for PDF render.
│   │                            Recent fixes:
│   │                            - paragraph soft-break <br> escaping
│   │                            - fence regex accepts `id="..."` info
│   └── pdf-template.js        Wraps HTML in a dark minimal page with
│                              Inter + JetBrains Mono; includes toolbar
│                              with Print / Close buttons (currently inert)
├── icons/                     16, 32, 48, 128 px (generated via PIL)
├── README.md
├── CHANGELOG.md
├── LICENSE                    MIT
├── context.md                 Design rationale (see that file)
└── project_state.md           This file
```

## Design tokens

| Token       | Value       | Use                          |
| ----------- | ----------- | ---------------------------- |
| `bg`        | `#0f0f10`   | Page background              |
| `surface`   | `#17171a`   | Cards, code block background |
| `border`    | `#27272a`   | Dividers                     |
| `text`      | `#e4e4e7`   | Body text                    |
| `muted`     | `#71717a`   | Secondary text               |
| `accent`    | `#38bdf8`   | Links, primary button        |
| `user-tag`  | `#38bdf8`   | "User" role label            |
| `ai-tag`    | `#2dd4bf`   | "Assistant" role label       |

Fonts: **Inter** for body, **JetBrains Mono** for code. Both self-hosted
as `.woff2` files inside the extension — no Google Fonts CDN calls.

## Data flow

```
┌─────────────┐   click Export    ┌──────────────┐
│  popup.js   │ ─────────────────>│ content      │
└─────────────┘                   │ scripts      │
      ▲                           │              │
      │                           │ 1. api.js    │ ──fetch──> /api/auth/session
      │                           │    gets tok  │
      │                           │ 2. api.js    │ ──fetch──> /backend-api
      │                           │    pulls msgs│             /conversation/<id>
      │                           │ 3. fallback  │
      │                           │    to DOM if │
      │                           │    API fails │
      │         EXTRACT_RESULT    └──────────────┘
      │◄────────────────────────────────┘
      │
      ├── if .md:  build with lib/markdown.js, download via
      │           chrome.downloads.download() blob URL
      │
      └── if .pdf: md-to-html → pdf-template → open new tab →
                   user hits Ctrl/⌘-P
```

## Known issues / next work

1. **Toolbar buttons inert** in the generated preview tab. Plan:
   give the two `<button>`s IDs, add a small inline `<script>` at end of
   `pdf-template.js` that wires `window.print()` and `window.close()`,
   hide the toolbar with `@media print { .toolbar { display: none } }`.
   Bump to 0.2.1.

2. **Streaming / very long conversations.** Currently we build the whole
   markdown string in memory. Untested past ~500-message chats. Should
   be fine but could blow up on pathological cases.

3. **Share pages (`/share/<id>`).** The API endpoint isn't available on
   share URLs, so we always fall through to DOM mode there. Works, but
   carries the v0.1.x code-block limitations.

4. **No automated tests.** All QA is manual — paste a chat URL, export,
   inspect. Add at least a Node-based unit test for `md-to-html.js`
   covering fences, lists, tables, and soft breaks.

5. **Math rendering.** `$...$` and `$$...$$` pass through as literal
   characters. If users ask, consider shipping KaTeX offline.

## Version history

| Version | Date       | Summary                                              |
| ------- | ---------- | ---------------------------------------------------- |
| 0.1.0   | 2026-04-18 | Initial release. DOM extractor, dark popup, PDF + MD |
| 0.1.1   | 2026-04-18 | List rendering fix; partial code-block newline fix   |
| 0.2.0   | 2026-04-18 | Switch to backend API for extraction                 |
| 0.2.0+  | 2026-04-18 | Fix: literal `<br>` in PDF paragraphs (8013ec2)      |
| 0.2.0+  | 2026-04-18 | Fix: recognize `id="..."` fence info strings (6fcba53) |

A 0.2.1 release should bundle the two post-0.2.0 fixes plus the toolbar
button wiring.

## How to run locally

1. Clone: `git clone https://github.com/kunalmttl/chatscribe`
2. Open `chrome://extensions`, enable Developer mode.
3. "Load unpacked" → select the `chatscribe/` folder.
4. Visit a ChatGPT conversation and click the ChatScribe icon.

## How to release

1. Update `manifest.json` version.
2. Update `popup/popup.html` version label.
3. Update `CHANGELOG.md`.
4. Update the version line at the top of this file.
5. Commit with message `vX.Y.Z: <summary>`.
6. Push to `main`.
7. (Future) tag + GitHub release once we have a Chrome Web Store listing.
