/**
 * ChatScribe — Content Script
 * Extracts the current ChatGPT conversation into structured JSON.
 * Listens for messages from popup and responds with conversation data.
 */

(function () {
  "use strict";

  // --- Utilities ----------------------------------------------------------

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /** Scroll the chat container up to force lazy-loaded messages to hydrate. */
  async function autoScrollToTop() {
    // Find the scrollable container — ChatGPT uses a main scroll area
    const scroller =
      document.querySelector("main div.overflow-y-auto") ||
      document.querySelector("[class*='overflow-y-auto']") ||
      document.scrollingElement;

    if (!scroller) return;

    let lastTop = -1;
    let stable = 0;
    for (let i = 0; i < 80; i++) {
      scroller.scrollTop = 0;
      await sleep(120);
      if (scroller.scrollTop === lastTop) {
        stable++;
        if (stable > 3) break;
      } else {
        stable = 0;
      }
      lastTop = scroller.scrollTop;
    }
    // Scroll back to bottom so the user isn't disoriented
    scroller.scrollTop = scroller.scrollHeight;
  }

  /** Get the chat title from the page. */
  function getChatTitle() {
    // Try page title
    const t = document.title.replace(/^ChatGPT[\s\-–—]*/i, "").trim();
    if (t && t.toLowerCase() !== "chatgpt") return t;

    // Try active sidebar item
    const active = document.querySelector('a[data-active="true"], nav a.active, nav li.active a');
    if (active && active.textContent.trim()) return active.textContent.trim();

    return "ChatGPT Conversation";
  }

  // --- HTML → Markdown ----------------------------------------------------

  /** Minimal, robust HTML → Markdown converter tuned for ChatGPT output. */
  function htmlToMarkdown(root) {
    const out = [];

    function walk(node, ctx = { listDepth: 0, listType: null, listIndex: 0 }) {
      if (node.nodeType === Node.TEXT_NODE) {
        out.push(node.textContent);
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;

      const tag = node.tagName.toLowerCase();

      // Skip copy buttons, toolbars, etc.
      if (
        node.matches?.(
          "button, .sr-only, [role='button'], [data-testid='copy-button'], .absolute.right-0"
        )
      ) {
        return;
      }

      switch (tag) {
        case "h1":
          out.push("\n\n# ");
          walkChildren(node, ctx);
          out.push("\n\n");
          break;
        case "h2":
          out.push("\n\n## ");
          walkChildren(node, ctx);
          out.push("\n\n");
          break;
        case "h3":
          out.push("\n\n### ");
          walkChildren(node, ctx);
          out.push("\n\n");
          break;
        case "h4":
          out.push("\n\n#### ");
          walkChildren(node, ctx);
          out.push("\n\n");
          break;
        case "h5":
        case "h6":
          out.push("\n\n##### ");
          walkChildren(node, ctx);
          out.push("\n\n");
          break;

        case "p":
          out.push("\n\n");
          walkChildren(node, ctx);
          out.push("\n\n");
          break;

        case "br":
          out.push("  \n");
          break;

        case "hr":
          out.push("\n\n---\n\n");
          break;

        case "strong":
        case "b":
          out.push("**");
          walkChildren(node, ctx);
          out.push("**");
          break;

        case "em":
        case "i":
          out.push("*");
          walkChildren(node, ctx);
          out.push("*");
          break;

        case "del":
        case "s":
          out.push("~~");
          walkChildren(node, ctx);
          out.push("~~");
          break;

        case "a": {
          const href = node.getAttribute("href") || "";
          out.push("[");
          walkChildren(node, ctx);
          out.push(`](${href})`);
          break;
        }

        case "code": {
          // Inline code only — pre > code is handled in 'pre'
          if (node.parentElement && node.parentElement.tagName.toLowerCase() === "pre") {
            walkChildren(node, ctx);
          } else {
            out.push("`");
            out.push(node.textContent);
            out.push("`");
          }
          break;
        }

        case "pre": {
          const codeEl = node.querySelector("code");
          let lang = "";
          if (codeEl) {
            const cls = codeEl.className || "";
            const m = cls.match(/language-([\w+-]+)/i);
            if (m) lang = m[1];
          }
          // ChatGPT often has a header div above the code with the language name
          if (!lang) {
            const header = node.querySelector("div");
            if (header) {
              const headerText = header.textContent.trim().split("\n")[0].trim();
              if (headerText && headerText.length < 20 && /^[\w+-]+$/.test(headerText)) {
                lang = headerText.toLowerCase();
              }
            }
          }
          const codeText = codeEl ? codeEl.textContent : node.textContent;
          out.push(`\n\n\`\`\`${lang}\n${codeText.replace(/\n$/, "")}\n\`\`\`\n\n`);
          break;
        }

        case "ul": {
          out.push("\n");
          const childCtx = { ...ctx, listDepth: ctx.listDepth + 1, listType: "ul" };
          for (const child of node.children) {
            if (child.tagName.toLowerCase() === "li") {
              out.push("  ".repeat(childCtx.listDepth - 1) + "- ");
              walkChildren(child, childCtx);
              out.push("\n");
            }
          }
          out.push("\n");
          break;
        }

        case "ol": {
          out.push("\n");
          const childCtx = { ...ctx, listDepth: ctx.listDepth + 1, listType: "ol" };
          let i = 1;
          for (const child of node.children) {
            if (child.tagName.toLowerCase() === "li") {
              out.push("  ".repeat(childCtx.listDepth - 1) + `${i}. `);
              walkChildren(child, childCtx);
              out.push("\n");
              i++;
            }
          }
          out.push("\n");
          break;
        }

        case "li":
          walkChildren(node, ctx);
          break;

        case "blockquote": {
          const inner = [];
          const save = out.length;
          walkChildren(node, ctx);
          const text = out.splice(save).join("");
          const quoted = text
            .trim()
            .split("\n")
            .map((l) => `> ${l}`)
            .join("\n");
          out.push("\n\n" + quoted + "\n\n");
          break;
        }

        case "table": {
          out.push("\n\n");
          const rows = [...node.querySelectorAll("tr")];
          if (rows.length) {
            const headerCells = [...rows[0].querySelectorAll("th,td")].map((c) =>
              c.textContent.trim().replace(/\|/g, "\\|")
            );
            out.push("| " + headerCells.join(" | ") + " |\n");
            out.push("| " + headerCells.map(() => "---").join(" | ") + " |\n");
            for (let i = 1; i < rows.length; i++) {
              const cells = [...rows[i].querySelectorAll("th,td")].map((c) =>
                c.textContent.trim().replace(/\|/g, "\\|").replace(/\n/g, " ")
              );
              out.push("| " + cells.join(" | ") + " |\n");
            }
          }
          out.push("\n\n");
          break;
        }

        case "img": {
          const src = node.getAttribute("src") || "";
          const alt = node.getAttribute("alt") || "image";
          out.push(`\n\n![${alt}](${src})\n\n`);
          break;
        }

        case "math":
        case "span": {
          // KaTeX math: look for annotation with TeX source
          const texAnnot = node.querySelector?.('annotation[encoding="application/x-tex"]');
          if (texAnnot) {
            const tex = texAnnot.textContent;
            // Display vs inline: display math usually in its own block
            const isDisplay = node.closest(".katex-display") || node.classList.contains("katex-display");
            out.push(isDisplay ? `\n\n$$${tex}$$\n\n` : `$${tex}$`);
            return;
          }
          walkChildren(node, ctx);
          break;
        }

        default:
          walkChildren(node, ctx);
      }
    }

    function walkChildren(node, ctx) {
      for (const child of node.childNodes) walk(child, ctx);
    }

    walk(root);
    return out
      .join("")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  // --- Message extraction -------------------------------------------------

  function extractMessages() {
    const nodes = document.querySelectorAll("[data-message-author-role]");
    const messages = [];

    nodes.forEach((node) => {
      const role = node.getAttribute("data-message-author-role");
      if (role !== "user" && role !== "assistant") return;

      // Content typically lives in a child with class 'markdown' or inside .whitespace-pre-wrap
      let contentRoot =
        node.querySelector(".markdown") ||
        node.querySelector(".whitespace-pre-wrap") ||
        node.querySelector("[data-message-text]") ||
        node;

      // Fallback: use the node itself
      const markdown = htmlToMarkdown(contentRoot);

      if (markdown.trim()) {
        messages.push({ role, markdown });
      }
    });

    return messages;
  }

  // --- Message handler ----------------------------------------------------

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg?.type === "CHATSCRIBE_PING") {
      sendResponse({ ok: true });
      return true;
    }

    if (msg?.type === "CHATSCRIBE_EXTRACT") {
      (async () => {
        try {
          await autoScrollToTop();
          await sleep(300);
          const messages = extractMessages();
          const title = getChatTitle();
          sendResponse({
            ok: true,
            data: {
              title,
              url: location.href,
              exportedAt: new Date().toISOString(),
              messages,
            },
          });
        } catch (err) {
          sendResponse({ ok: false, error: String(err?.message || err) });
        }
      })();
      return true; // keep channel open for async response
    }
  });

  // Signal readiness
  console.log("[ChatScribe] Content script loaded.");
})();
