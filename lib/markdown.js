/**
 * ChatScribe — Markdown Builder
 * Converts structured conversation data into a clean, readable Markdown document.
 */

export function buildMarkdown(data, options = {}) {
  const { title, url, exportedAt, messages } = data;
  const { includeTimestamp = true, includeMeta = true } = options;

  const lines = [];

  lines.push(`# ${title}`);
  lines.push("");

  if (includeMeta) {
    const date = new Date(exportedAt);
    const formatted = date.toLocaleString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    if (includeTimestamp) lines.push(`*Exported ${formatted}*`);
    if (url) lines.push(`*Source: ${url}*`);
    lines.push("");
  }

  lines.push("---");
  lines.push("");

  messages.forEach((msg, i) => {
    const label = msg.role === "user" ? "You" : "ChatGPT";
    lines.push(`## ${label}`);
    lines.push("");
    lines.push(msg.markdown);
    lines.push("");
    if (i < messages.length - 1) {
      lines.push("---");
      lines.push("");
    }
  });

  return lines.join("\n");
}

export function suggestedFilename(title, ext) {
  const safe = (title || "chatgpt-conversation")
    .replace(/[\\/:*?"<>|]+/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80)
    .toLowerCase();
  const date = new Date().toISOString().slice(0, 10);
  return `${safe}-${date}.${ext}`;
}
