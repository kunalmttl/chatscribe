# ChatScribe

> Export ChatGPT conversations to beautifully formatted **PDF** or **Markdown**.
> Minimal · Dark · Flat · Copy-pasteable.

ChatScribe is a lightweight Chrome extension that turns any ChatGPT chat into a clean, archival document — with proper code blocks, tables, math, and typography that actually reads well.

## Features

- **PDF export** with a polished dark theme (flat palette, Inter + JetBrains Mono)
- **Markdown export** — clean, portable, GitHub-friendly
- **Selectable, copy-pasteable text** — including every code block
- **Preserves everything**: code blocks with language tags, tables, lists, math (KaTeX → LaTeX), inline formatting, links
- **Auto-handles lazy loading** — scrolls to hydrate all messages before export
- **No servers, no tracking** — everything runs locally in your browser
- **Dark & light PDF themes** (dark is default — the good one)

## Install (Developer Mode)

1. Download or clone this repo:
   ```bash
   git clone https://github.com/<your-username>/chatscribe.git
   ```
2. Open `chrome://extensions` in Chrome / Brave / Edge.
3. Enable **Developer mode** (top right).
4. Click **Load unpacked** and select the `chatscribe/` folder.
5. Pin the ChatScribe icon to your toolbar.

## Usage

1. Open any conversation on [chatgpt.com](https://chatgpt.com).
2. Click the **ChatScribe** icon in your toolbar.
3. Choose **PDF** or **Markdown**.
4. (Optional) Edit the filename.
5. Click **Export**.

For PDF: a new tab opens with the formatted document and the print dialog. Select **Save as PDF** as the destination.

## Design

ChatScribe is built around a flat, minimal dark palette:

| Token       | Dark       | Light     |
| ----------- | ---------- | --------- |
| Background  | `#0f0f10`  | `#fafaf9` |
| Surface     | `#17171a`  | `#ffffff` |
| Text        | `#e4e4e7`  | `#1c1917` |
| Muted       | `#71717a`  | `#78716c` |
| Accent      | `#38bdf8`  | `#0ea5e9` |
| User tag    | `#38bdf8`  | `#0ea5e9` |
| AI tag      | `#2dd4bf`  | `#14b8a6` |

Typography: **Inter** for body, **JetBrains Mono** for code.

## Project Structure

```
chatscribe/
├── manifest.json           # MV3 manifest
├── background/
│   └── background.js       # Service worker
├── content/
│   └── extractor.js        # DOM → structured JSON (runs on ChatGPT pages)
├── popup/
│   ├── popup.html          # Extension popup UI
│   ├── popup.css           # Dark flat styling
│   └── popup.js            # Popup controller
├── lib/
│   ├── markdown.js         # Build Markdown document
│   ├── md-to-html.js       # Zero-dep Markdown → HTML
│   └── pdf-template.js     # Styled HTML template for PDF
└── icons/
    └── icon16/32/48/128.png
```

## How It Works

1. **Popup** asks the content script to extract the current chat.
2. **Content script** auto-scrolls to hydrate all messages, then walks every `[data-message-author-role]` node and converts HTML → Markdown (preserving code, math, tables, lists, etc.).
3. **Popup** either:
   - writes a `.md` file directly, or
   - renders the conversation into a styled HTML document (using the zero-dependency `md-to-html.js`) and opens it in a new tab with the native print dialog for **Save as PDF**.

Using the browser's own print engine means fonts render correctly, text stays selectable, and the PDF is tiny compared to canvas-rasterized approaches.

## Roadmap

- [ ] One-click PDF save without print dialog (via offscreen canvas pipeline)
- [ ] Syntax highlighting in PDF code blocks (highlight.js)
- [ ] Export multiple chats at once (sidebar → bulk)
- [ ] Custom theme builder
- [ ] Export to DOCX
- [ ] Firefox port

## Contributing

PRs welcome. Keep it minimal.

1. Fork & clone
2. Load unpacked in Chrome
3. Edit, reload the extension, test
4. Submit a PR

## License

MIT © 2026
