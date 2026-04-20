/**
 * ChatScribe — Minimal Markdown → HTML
 * Lightweight converter with zero dependencies.
 * Handles: headings, bold, italic, code (inline + fenced), links, lists,
 * blockquotes, tables, hr, images, line breaks.
 * Optional: syntax highlighting for code blocks.
 */

function esc(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escAttr(s) {
  return esc(s).replace(/"/g, "&quot;");
}

/** Parse inline markdown (bold, italic, code, links, images). */
function inline(text) {
  // Escape HTML first
  let t = esc(text);

  // Images: ![alt](src)
  t = t.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, (_, alt, src, title) => {
    const titleAttr = title ? ` title="${escAttr(title)}"` : "";
    return `<img alt="${escAttr(alt)}" src="${escAttr(src)}"${titleAttr}>`;
  });

  // Links: [text](href)
  t = t.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, (_, text, href, title) => {
    const titleAttr = title ? ` title="${escAttr(title)}"` : "";
    return `<a href="${escAttr(href)}"${titleAttr}>${text}</a>`;
  });

  // Inline code: `code`
  t = t.replace(/`([^`\n]+)`/g, (_, code) => `<code>${code}</code>`);

  // Bold: **text** or __text__
  t = t.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
  t = t.replace(/__([^_\n]+)__/g, "<strong>$1</strong>");

  // Italic: *text* or _text_ (avoid matching inside words)
  t = t.replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,!?;:]|$)/g, "$1<em>$2</em>");
  t = t.replace(/(^|[\s(])_([^_\n]+)_(?=[\s).,!?;:]|$)/g, "$1<em>$2</em>");

  // Strikethrough: ~~text~~
  t = t.replace(/~~([^~\n]+)~~/g, "<del>$1</del>");

  return t;
}

/** Main converter. */
export function mdToHtml(md) {
  if (!md) return "";

  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block (allow leading indent for nested-in-list cases).
    // CommonMark: anything after ``` on the opening line is the "info
    // string". ChatGPT's backend API annotates fences like:
    //   ``` id="c7nqcz"
    //   ```cpp id="c7nqcz"
    // so we accept any trailing text and pull out the language token
    // (the first word) if present.
    const fenceMatch = line.match(/^(\s*)```[ \t]*(.*)$/);
    if (fenceMatch) {
      const fenceIndent = fenceMatch[1].length;
      const info = fenceMatch[2].trim();
      // Language is the first whitespace-separated token, but only if it
      // looks like a language name (not e.g. id="...").
      const langTok = info.split(/\s+/)[0] || "";
      const lang = /^[A-Za-z][\w+#.-]*$/.test(langTok) ? langTok : "";
      const codeLines = [];
      i++;
      const closeRe = /^\s*```\s*$/;
      while (i < lines.length && !closeRe.test(lines[i])) {
        // Strip the fence's indent from continuation lines so code aligns
        const ln = lines[i];
        if (fenceIndent && ln.startsWith(" ".repeat(fenceIndent))) {
          codeLines.push(ln.slice(fenceIndent));
        } else {
          codeLines.push(ln);
        }
        i++;
      }
      i++; // skip closing fence
      const langAttr = lang ? ` data-lang="${escAttr(lang)}"` : "";
      const codeClass = lang ? ` class="language-${escAttr(lang)}"` : "";
      out.push(`<pre${langAttr}><code${codeClass}>${esc(codeLines.join("\n"))}</code></pre>`);
      continue;
    }

    // Horizontal rule
    if (/^\s*---+\s*$/.test(line) || /^\s*\*\*\*+\s*$/.test(line)) {
      out.push("<hr>");
      i++;
      continue;
    }

    // Heading
    const hMatch = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (hMatch) {
      const level = hMatch[1].length;
      out.push(`<h${level}>${inline(hMatch[2])}</h${level}>`);
      i++;
      continue;
    }

    // Blockquote
    if (/^\s*>/.test(line)) {
      const quoteLines = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) {
        quoteLines.push(lines[i].replace(/^\s*>\s?/, ""));
        i++;
      }
      out.push(`<blockquote>${mdToHtml(quoteLines.join("\n"))}</blockquote>`);
      continue;
    }

    // Table
    if (
      /^\s*\|/.test(line) &&
      i + 1 < lines.length &&
      /^\s*\|?\s*:?-{3,}/.test(lines[i + 1])
    ) {
      const headerCells = line
        .trim()
        .replace(/^\||\|$/g, "")
        .split("|")
        .map((c) => c.trim());
      i += 2; // skip header + separator
      const bodyRows = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) {
        const cells = lines[i]
          .trim()
          .replace(/^\||\|$/g, "")
          .split("|")
          .map((c) => c.trim());
        bodyRows.push(cells);
        i++;
      }
      let html = "<table><thead><tr>";
      html += headerCells.map((c) => `<th>${inline(c)}</th>`).join("");
      html += "</tr></thead><tbody>";
      for (const row of bodyRows) {
        html += "<tr>" + row.map((c) => `<td>${inline(c)}</td>`).join("") + "</tr>";
      }
      html += "</tbody></table>";
      out.push(html);
      continue;
    }

    // Unordered list
    if (/^\s*[-*+]\s+/.test(line)) {
      const { html, next } = parseList(lines, i, "ul");
      out.push(html);
      i = next;
      continue;
    }

    // Ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const { html, next } = parseList(lines, i, "ol");
      out.push(html);
      i = next;
      continue;
    }

    // Blank line
    if (/^\s*$/.test(line)) {
      i++;
      continue;
    }

    // Paragraph — collect consecutive non-empty non-special lines
    const paraLines = [line];
    i++;
    while (
      i < lines.length &&
      !/^\s*$/.test(lines[i]) &&
      !/^\s*```/.test(lines[i]) &&
      !/^#{1,6}\s/.test(lines[i]) &&
      !/^\s*>/.test(lines[i]) &&
      !/^\s*[-*+]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !/^\s*---+\s*$/.test(lines[i]) &&
      !/^\s*\|/.test(lines[i])
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    // Process each line through inline() first, then join with <br> — if we
    // inserted <br> before inline(), esc() would turn it into &lt;br&gt;.
    const joined = paraLines.map(inline).join("<br>\n");
    out.push(`<p>${joined}</p>`);
  }

  return out.join("\n");
}

/** Parse a (possibly nested) list starting at index `start`. */
function parseList(lines, start, type) {
  const marker = type === "ul" ? /^(\s*)[-*+]\s+(.*)$/ : /^(\s*)\d+\.\s+(.*)$/;
  const otherMarker = type === "ul" ? /^(\s*)\d+\.\s+/ : /^(\s*)[-*+]\s+/;
  const items = [];
  let i = start;
  const baseIndent = (lines[i].match(/^(\s*)/) || [, ""])[1].length;

  while (i < lines.length) {
    const line = lines[i];
    const m = line.match(marker);
    if (m && m[1].length === baseIndent) {
      // New item — start with the text on the marker line (may be empty)
      const itemLines = [m[2]];
      i++;

      // If marker line is empty, the item content may follow on subsequent
      // lines (possibly after blank lines). Adopt any non-empty, non-marker
      // lines at the same or deeper indent until we hit a real sibling item.
      const markerIsEmpty = m[2].trim() === "";

      while (i < lines.length) {
        const next = lines[i];

        // Blank line
        if (/^\s*$/.test(next)) {
          itemLines.push("");
          i++;
          continue;
        }

        const nextIndent = (next.match(/^(\s*)/) || [, ""])[1].length;
        const isSameLevelItem =
          nextIndent === baseIndent &&
          (marker.test(next) || otherMarker.test(next));
        if (isSameLevelItem) break;

        // Continuation if:
        // - indented deeper than base, OR
        // - marker was empty and this line is the first non-blank content
        //   at <= base indent (orphan paragraph that belongs to this item)
        const isDeeper = nextIndent > baseIndent;
        const isOrphanForEmptyMarker =
          markerIsEmpty &&
          itemLines.every((l) => l.trim() === "") &&
          nextIndent <= baseIndent &&
          !/^#{1,6}\s/.test(next) &&
          !/^```/.test(next) &&
          !/^\s*---+\s*$/.test(next);

        if (isDeeper || isOrphanForEmptyMarker) {
          // Normalize: strip baseIndent from deeper lines so recursion works
          if (isDeeper) {
            itemLines.push(next.slice(baseIndent));
          } else {
            itemLines.push(next);
          }
          i++;
          continue;
        }

        break;
      }
      items.push(itemLines.join("\n").replace(/^\n+|\n+$/g, ""));
    } else {
      break;
    }
  }

  const tag = type;
  const html =
    `<${tag}>` +
    items
      .filter((content) => content.trim().length > 0) // drop genuinely empty items
      .map((content) => {
        // If content has multi-line or nested structures, recurse
        const trimmed = content.trim();
        if (/\n/.test(content) || /^\s*[-*+]\s+/.test(content) || /^\s*\d+\.\s+/.test(content)) {
          return `<li>${mdToHtml(content)}</li>`;
        }
        return `<li>${inline(trimmed)}</li>`;
      })
      .join("") +
    `</${tag}>`;

  return { html, next: i };
}
