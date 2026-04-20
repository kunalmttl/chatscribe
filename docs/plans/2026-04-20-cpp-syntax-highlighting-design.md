# Design: Subdued Pastel C++ Syntax Highlighting

**Date:** 2026-04-20
**Topic:** C++ Syntax Highlighting for PDF/HTML Exports
**Status:** Approved

## Overview
Add zero-dependency syntax highlighting for C++ code blocks in ChatScribe's PDF output. The style will use a "Subdued Pastel" palette to maintain a premium, minimalistic aesthetic.

## Architecture
Integrating the highlighter directly into `lib/md-to-html.js`.

### Logic
- **Detection**: Check code block language tags for `cpp` or `c++`.
- **Transformation**: A function `highlightCpp(code)` will use regex-based tokenization to wrap:
    - Keywords (`int`, `class`, `if`)
    - Strings/Chars (`"..."`, `'...'`)
    - Comments (`//`, `/*...*/`)
    - Numbers (`0x...`, `123.4`)
    - Types/STL (`std::string`, `vector`)
    - Preprocessors (`#include`, `#define`)
- **Isolation**: Highlighting must occur *before* HTML escaping to prevent class attribute collision.

### Palette (Base16-inspired Flat/Pastel)
- **Keywords**: `#B4A0E5` (Lavender)
- **Strings**: `#A6D189` (Sage)
- **Comments**: `#737994` (Slate)
- **Numbers**: `#EF9F76` (Amber)
- **Types**: `#81C8BE` (Teal)
- **Preprocessors**: `#99D1DB` (Sky Blue)

## Components
- `lib/md-to-html.js`: New `highlightCpp` utility.
- `lib/pdf-template.js`: CSS definitions for `.token-*` classes.
- `tests/unit/md-to-html.test.js`: Regression tests.

## Data Flow
1. `mdToHtml(markdown)`
2. Find ```cpp
3. Call `highlightCpp(blockBody)`
4. Wrap results in `<pre><code class="language-cpp">...</code></pre>`
5. PDF Renderer applies CSS.

## Verification
- **Unit**: Verify regex output in Node tests. 
- **Visual**: Audit colors in generated `preview-test.html`.
