/**
 * ChatScribe — Content Script
 * Extracts the current conversation into structured JSON.
 * Listens for messages from popup and responds with conversation data.
 * Supports both ChatGPT and Gemini platforms.
 */

(function () {
  "use strict";

  // --- Platform Detection ---------------------------------------------------

  function getPlatform() {
    const hostname = location.hostname;
    if (hostname === 'chatgpt.com' || hostname === 'chat.openai.com') {
      return 'chatgpt';
    }
    if (hostname === 'gemini.google.com') {
      return 'gemini';
    }
    return 'unknown';
  }

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

/** Scroll the Gemini chat container up to force lazy-loaded messages to hydrate. */
async function autoScrollToTopGemini() {
  // Find the scrollable container — Gemini uses chat-window-content > div.chat-history-scroll-container
  const scroller =
    document.querySelector('chat-window-content > div.chat-history-scroll-container') ||
    document.querySelector('div#chat-history');

  if (!scroller) {
    console.log("[ChatScribe Gemini] Could not find scroll container");
    return;
  }

  console.log(`[ChatScribe Gemini] Found scroll container: ${scroller.outerHTML.substring(0, 100)}`);
  
  let lastTop = -1;
  let stable = 0;
  let previousUserCount = 0;
  let previousModelCount = 0;
  
  for (let i = 0; i < 120; i++) { // Increased iterations
    scroller.scrollTop = 0;
    await sleep(150); // Slightly longer delay
    
    // Check if we've loaded more messages
    const currentUserCount = document.querySelectorAll('user-query').length;
    const currentModelCount = document.querySelectorAll('model-response').length;
    
    if (currentUserCount > previousUserCount || currentModelCount > previousModelCount) {
      console.log(`[ChatScribe Gemini] Loaded more messages: ${currentUserCount} user, ${currentModelCount} model (was ${previousUserCount} user, ${previousModelCount} model)`);
      previousUserCount = currentUserCount;
      previousModelCount = currentModelCount;
      stable = 0; // Reset stability counter since we got new content
    } else if (scroller.scrollTop === lastTop) {
      stable++;
      if (stable > 5) { // Need more stability before stopping
        console.log(`[ChatScribe Gemini] Scroll position stable for ${stable} cycles, stopping`);
        break;
      }
    } else {
      stable = 0;
    }
    lastTop = scroller.scrollTop;
    
    // Progress indicator every 10 iterations
    if (i % 10 === 0) {
      console.log(`[ChatScribe Gemini] Scroll attempt ${i}/120`);
    }
  }
  
  // Final count
  const finalUserCount = document.querySelectorAll('user-query').length;
  const finalModelCount = document.querySelectorAll('model-response').length;
  console.log(`[ChatScribe Gemini] Final message count: ${finalUserCount} user, ${finalModelCount} model`);
  
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
          // Prefer a <code> with a language-* class; fall back to last <code>.
          const codes = node.querySelectorAll("code");
          let codeEl = null;
          for (const c of codes) {
            if (/(?:^|\s)(?:language-|hljs\s+language-|!whitespace)/i.test(c.className) ||
                c.closest("pre") === node && (c.textContent || "").length > 20) {
              codeEl = c;
            }
          }
          if (!codeEl && codes.length) codeEl = codes[codes.length - 1];
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
              if (headerText && headerText.length < 20 && /^[\w+#.+-]+$/.test(headerText)) {
                lang = headerText.toLowerCase().replace(/\+\+/g, "pp");
              }
            }
          }
          const codeText = extractCodeText(codeEl || node);
          out.push(`\n\n\`\`\`${lang}\n${codeText.replace(/\n+$/, "")}\n\`\`\`\n\n`);
          break;
        }

        case "ul": {
          out.push("\n\n");
          const childDepth = ctx.listDepth + 1;
          const indent = "  ".repeat(childDepth - 1);
          for (const child of node.children) {
            if (child.tagName.toLowerCase() === "li") {
              const itemMd = renderListItem(child, childDepth);
              out.push(indent + "- " + itemMd + "\n");
            }
          }
          out.push("\n");
          break;
        }

        case "ol": {
          out.push("\n\n");
          const childDepth = ctx.listDepth + 1;
          const indent = "  ".repeat(childDepth - 1);
          let i = 1;
          for (const child of node.children) {
            if (child.tagName.toLowerCase() === "li") {
              const itemMd = renderListItem(child, childDepth);
              out.push(indent + `${i}. ` + itemMd + "\n");
              i++;
            }
          }
          out.push("\n");
          break;
        }

        case "li":
          // Handled by parent ul/ol; if we hit an orphan li, walk normally
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

    /**
     * Render a single <li>'s content into a single-string, trimmed Markdown
     * fragment. Continuation lines are indented so they stay inside the item.
     */
    function renderListItem(liNode, depth) {
      // Render children into a temporary buffer
      const savedOut = out.slice();
      out.length = 0;
      const childCtx = { listDepth: depth, listType: null, listIndex: 0 };
      for (const child of liNode.childNodes) walk(child, childCtx);
      let itemText = out.join("");
      out.length = 0;
      out.push(...savedOut);

      // Trim leading/trailing whitespace and collapse double-newlines inside
      // simple items so the marker sits on the same line as the content.
      itemText = itemText.replace(/^[\s\n]+|[\s\n]+$/g, "");

      // If the item contains block content (code, sub-list, multiple paras),
      // preserve internal newlines but indent continuation lines.
      const hasBlock = /\n{2,}/.test(itemText) || /```/.test(itemText) || /^\s{2,}[-*+]\s/m.test(itemText);
      if (hasBlock) {
        const indent = "  ".repeat(depth);
        const [first, ...rest] = itemText.split("\n");
        return first + (rest.length ? "\n" + rest.map((l) => (l ? indent + l : l)).join("\n") : "");
      }
      // Simple item: fold any internal newlines into spaces
      return itemText.replace(/\s*\n\s*/g, " ");
    }

    /**
     * Extract code text from a <code> (or <pre>) element while correctly
     * handling ChatGPT's syntax-highlighted markup where each line lives in
     * a <span class="line"> / <span class="token-line"> with display:block
     * (no literal \n between spans).
     */
    function extractCodeText(el) {
      if (!el) return "";

      // Strategy 1: if the element has literal newline characters, use
      // textContent directly — this is the simple case.
      const raw = el.textContent || "";
      if (raw.includes("\n")) return raw;

      // Strategy 2: ChatGPT's highlighter uses per-line spans. Walk children
      // and insert \n between block-level or class="line"-style spans.
      const lineSelectors = [
        ":scope > span.line",
        ":scope > span.token-line",
        ":scope > div.line",
        ":scope > span[class*='line']",
      ];
      for (const sel of lineSelectors) {
        const lineNodes = el.querySelectorAll(sel);
        if (lineNodes.length > 1) {
          return [...lineNodes].map((n) => n.textContent.replace(/\n$/, "")).join("\n");
        }
      }

      // Strategy 3: use innerText if available — the browser computes it from
      // rendered CSS, so display:block spans give us real line breaks.
      if (typeof el.innerText === "string" && el.innerText.includes("\n")) {
        return el.innerText;
      }

      // Fallback
      return raw;
    }

    walk(root);
    return out
      .join("")
      .replace(/[ \t]+\n/g, "\n")
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

  // --- Gemini Extraction ---------------------------------------------------

/**
 * Extract messages from Gemini's DOM structure.
 * Gemini uses custom web components: <user-query> and <model-response>
 */
function extractGeminiMessages() {
  // Use the more stable selector first, with fallback
  const chatHistory =
    document.querySelector('chat-window-content > div.chat-history-scroll-container') ||
    document.querySelector('div#chat-history');
    
  if (!chatHistory) {
    throw new Error("Could not find chat history container");
  }

  console.log(`[ChatScribe Gemini] Using chatHistory selector: ${chatHistory ? chatHistory.outerHTML.substring(0, 100) : 'null'}`);

  const messages = [];
  const userQueries = chatHistory.querySelectorAll("user-query");
  const modelResponses = chatHistory.querySelectorAll("model-response");

  console.log(`[ChatScribe Gemini] Found ${userQueries.length} user-query elements and ${modelResponses.length} model-response elements`);

  // Interleave user and assistant messages
  const totalPairs = Math.max(userQueries.length, modelResponses.length);

  for (let i = 0; i < totalPairs; i++) {
    // User message
    if (i < userQueries.length) {
      let userContent = extractTextContent(userQueries[i]);
      // Remove unwanted "You said" prefix if present
      if (userContent.startsWith("You said")) {
        userContent = userContent.substring(8).trim();
      }
      if (userContent) {
        messages.push({ role: "user", markdown: userContent });
      }
    }

    // Assistant message
    if (i < modelResponses.length) {
      let assistantContent = extractGeminiResponse(modelResponses[i]);
      // Remove any unwanted prefixes if present
      if (assistantContent.startsWith("You said")) {
        assistantContent = assistantContent.substring(8).trim();
      }
      if (assistantContent) {
        messages.push({ role: "assistant", markdown: assistantContent });
      }
    }
  }

  console.log(`[ChatScribe Gemini] Extracted ${messages.length} total messages`);
  return messages;
}

/**
 * Extract clean text from an element, preserving line breaks from <br> tags
 */
function extractTextContent(element) {
  if (!element) return "";
  const clone = element.cloneNode(true);
  
  // Convert <br> tags to newlines before getting textContent
  clone.querySelectorAll("br").forEach(br => {
    br.replaceWith(document.createTextNode("\n"));
  });
  
  // Remove script, style, and .code-language elements
  clone.querySelectorAll("script, style, .code-language").forEach((el) => el.remove());
  
  return clone.textContent
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\s+|\s+$/g, "")
    .trim();
}

  /**
   * Extract markdown content from a Gemini model response element
   */
  function extractGeminiResponse(element) {
    const contentContainer = element.querySelector("message-content.model-response-text");
    if (!contentContainer) return "";

    const markdown = htmlToMarkdown(contentContainer);
    return markdown.trim();
  }

  /**
   * Get Gemini conversation title
   */
  function getGeminiTitle() {
    const titleEl = document.querySelector("h1, [role='heading']");
    if (titleEl) return titleEl.textContent.trim();
    return "Gemini Conversation";
  }

  // --- Message handler ----------------------------------------------------

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg?.type === "CHATSCRIBE_PING") {
      sendResponse({ ok: true, platform: getPlatform() });
      return true;
    }

    if (msg?.type === "CHATSCRIBE_EXTRACT") {
      (async () => {
        const platform = getPlatform();

        // Gemini: Use DOM extraction (no clean API available)
        if (platform === "gemini") {
          try {
            console.log("[ChatScribe] Starting Gemini extraction with lazy loading fix");
            // Scroll to load all messages before extraction
            await autoScrollToTopGemini();
            await sleep(300); // Additional wait for content to settle
            
            const messages = extractGeminiMessages();
            const title = getGeminiTitle();
            console.log(`[ChatScribe] Gemini extraction complete: ${messages.length} messages extracted`);
            sendResponse({
              ok: true,
              source: "gemini-dom",
              platform: "gemini",
              data: {
                title,
                url: location.href,
                exportedAt: new Date().toISOString(),
                messages,
              },
            });
          } catch (err) {
            console.error("[ChatScribe] Gemini extraction failed:", err);
            sendResponse({ ok: false, error: String(err?.message || err), platform: "gemini" });
          }
          return;
        }

        // ChatGPT: Try API first, then DOM fallback
        try {
          if (window.__chatscribeApi?.available?.()) {
            const data = await window.__chatscribeApi.extract();
            if (data?.messages?.length) {
              sendResponse({ ok: true, data, source: "api", platform: "chatgpt" });
              return;
            }
          }
        } catch (apiErr) {
          console.warn("[ChatScribe] API extraction failed, falling back to DOM:", apiErr);
        }

        // DOM extraction fallback for ChatGPT
        try {
          await autoScrollToTop();
          await sleep(300);
          const messages = extractMessages();
          const title = getChatTitle();
          sendResponse({
            ok: true,
            source: "dom",
            platform: "chatgpt",
            data: {
              title,
              url: location.href,
              exportedAt: new Date().toISOString(),
              messages,
            },
          });
        } catch (err) {
          sendResponse({ ok: false, error: String(err?.message || err), platform: "chatgpt" });
        }
      })();
      return true; // keep channel open for async response
    }
  });

  // Signal readiness
  const platform = getPlatform();
  console.log(`[ChatScribe] Content script loaded (${platform} mode).`);
})();