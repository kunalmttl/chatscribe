/**
 * ChatScribe — Minimal Markdown → HTML
 * Lightweight converter with zero dependencies.
 * Handles: headings, bold, italic, code (inline + fenced), links, lists,
 * blockquotes, tables, hr, images, line breaks.
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

    // Fenced code block
    const fenceMatch = line.match(/^```(\w+)?\s*$/);
    if (fenceMatch) {
      const lang = fenceMatch[1] || "";
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].match(/^```\s*$/)) {
        codeLines.push(lines[i]);
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
      !/^```/.test(lines[i]) &&
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
    const joined = paraLines.join("\n").replace(/\n/g, "<br>\n");
    out.push(`<p>${inline(joined)}</p>`);
  }

  return out.join("\n");
}

/** Parse a (possibly nested) list starting at index `start`. */
function parseList(lines, start, type) {
  const marker = type === "ul" ? /^(\s*)[-*+]\s+(.*)$/ : /^(\s*)\d+\.\s+(.*)$/;
  const items = [];
  let i = start;
  const baseIndent = (lines[i].match(/^(\s*)/) || [, ""])[1].length;

  while (i < lines.length) {
    const line = lines[i];
    const m = line.match(marker);
    if (m && m[1].length === baseIndent) {
      // New item
      const itemLines = [m[2]];
      i++;
      // Continuation lines (more indented, not a new list item at baseIndent)
      while (i < lines.length) {
        const next = lines[i];
        if (/^\s*$/.test(next)) {
          itemLines.push("");
          i++;
          continue;
        }
        const nextIndent = (next.match(/^(\s*)/) || [, ""])[1].length;
        const isSameLevelItem =
          nextIndent === baseIndent &&
          (/^\s*[-*+]\s+/.test(next) || /^\s*\d+\.\s+/.test(next));
        if (isSameLevelItem) break;
        if (nextIndent <= baseIndent && !/^\s/.test(next)) break;
        itemLines.push(next);
        i++;
      }
      items.push(itemLines.join("\n"));
    } else {
      break;
    }
  }

  const tag = type;
  const html =
    `<${tag}>` +
    items
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
