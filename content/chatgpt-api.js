/**
 * ChatScribe — ChatGPT Backend API Client (runs in content script isolated world)
 *
 * Uses ChatGPT's own backend API to fetch the raw conversation as clean
 * Markdown strings. This bypasses ALL the DOM-extraction headaches (syntax-
 * highlighter span soup, lazy-loaded messages, virtualized lists, etc.) and
 * gives us perfect code blocks, formatting, and structure.
 *
 * Endpoint: GET /backend-api/conversation/<chatId>
 * Auth:     Bearer token from /api/auth/session (uses session cookies).
 *
 * Returns a tree of messages (mapping). We walk from current_node back to
 * the root to get the active branch, then emit messages in order.
 */

(function () {
  "use strict";

  const ORIGIN = location.origin; // https://chatgpt.com or https://chat.openai.com
  const CONV_API = (id) => `${ORIGIN}/backend-api/conversation/${id}`;
  const SESSION_API = `${ORIGIN}/api/auth/session`;

  /** Pull chat id from the URL (/c/<id> or /g/<gizmo>/c/<id>). */
  function getChatIdFromUrl() {
    const m = location.pathname.match(/\/c\/([0-9a-f-]{36})/i);
    return m ? m[1] : null;
  }

  let _tokenCache = null;
  let _tokenCacheAt = 0;
  async function getAccessToken() {
    // Cache for 60s within a session
    const now = Date.now();
    if (_tokenCache && now - _tokenCacheAt < 60_000) return _tokenCache;

    const res = await fetch(SESSION_API, { credentials: "include" });
    if (!res.ok) throw new Error(`Session fetch failed: ${res.status}`);
    const data = await res.json();
    if (!data?.accessToken) {
      throw new Error("Not signed in to ChatGPT");
    }
    _tokenCache = data.accessToken;
    _tokenCacheAt = now;
    return data.accessToken;
  }

  async function fetchConversation(chatId) {
    const token = await getAccessToken();
    const headers = {
      Authorization: `Bearer ${token}`,
      "X-Authorization": `Bearer ${token}`,
    };

    const res = await fetch(CONV_API(chatId), {
      headers,
      credentials: "include",
    });
    if (!res.ok) {
      throw new Error(`Conversation fetch failed: ${res.status} ${res.statusText}`);
    }
    return res.json();
  }

  // --- Conversation tree walker ------------------------------------------

  /** Walk from current_node up to root, collecting the active branch. */
  function getActiveBranch(conv) {
    const mapping = conv.mapping;
    const result = [];
    let id = conv.current_node;
    const seen = new Set();

    while (id && !seen.has(id)) {
      seen.add(id);
      const node = mapping[id];
      if (!node) break;
      if (node.parent === undefined || node.parent === null) break;

      const msg = node.message;
      if (msg) {
        const role = msg.author?.role;
        const ct = msg.content?.content_type;

        // Skip system noise and internal context blobs
        const skip =
          role === "system" ||
          ct === "model_editable_context" ||
          ct === "user_editable_context" ||
          ct === "tether_quote" ||
          ct === "tether_browsing_code" ||
          ct === "tether_browsing_display";

        if (!skip) result.unshift(node);
      }
      id = node.parent;
    }
    return result;
  }

  /** Merge consecutive assistant continuations into a single message. */
  function mergeContinuations(nodes) {
    const out = [];
    for (const node of nodes) {
      const prev = out[out.length - 1];
      const pm = prev?.message;
      const nm = node.message;
      if (
        pm &&
        nm &&
        pm.author?.role === "assistant" &&
        nm.author?.role === "assistant" &&
        pm.recipient === "all" &&
        nm.recipient === "all" &&
        pm.content?.content_type === "text" &&
        nm.content?.content_type === "text"
      ) {
        const pparts = pm.content.parts;
        const nparts = nm.content.parts;
        if (Array.isArray(pparts) && Array.isArray(nparts) && pparts.length && nparts.length) {
          pparts[pparts.length - 1] += nparts[0];
          for (let i = 1; i < nparts.length; i++) pparts.push(nparts[i]);
          continue;
        }
      }
      out.push(node);
    }
    return out;
  }

  /** Convert a single node's content into Markdown. */
  function nodeToMarkdown(node) {
    const msg = node.message;
    if (!msg) return "";
    const content = msg.content || {};
    const ct = content.content_type;

    switch (ct) {
      case "text": {
        const parts = Array.isArray(content.parts) ? content.parts : [];
        return parts.filter((p) => typeof p === "string").join("\n\n");
      }

      case "code": {
        // Assistant-invoked code tool call
        const text = content.text || "";
        const lang = content.language || "";
        return "```" + lang + "\n" + text + "\n```";
      }

      case "execution_output": {
        const text = content.text || "";
        return "```\n" + text + "\n```";
      }

      case "multimodal_text": {
        const parts = Array.isArray(content.parts) ? content.parts : [];
        const out = [];
        for (const p of parts) {
          if (typeof p === "string") {
            out.push(p);
          } else if (p && typeof p === "object") {
            if (p.content_type === "image_asset_pointer") {
              out.push("*[image]*");
            } else if (p.content_type === "audio_transcription" && p.text) {
              out.push(p.text);
            }
          }
        }
        return out.join("\n\n");
      }

      case "thoughts":
        return ""; // reasoning traces — usually hidden, skip

      default:
        if (Array.isArray(content.parts)) {
          return content.parts.filter((p) => typeof p === "string").join("\n\n");
        }
        if (typeof content.text === "string") return content.text;
        return "";
    }
  }

  /** Turn a fetched conversation into ChatScribe's data shape. */
  function conversationToData(conv) {
    const nodes = mergeContinuations(getActiveBranch(conv));
    const messages = [];

    for (const node of nodes) {
      const msg = node.message;
      const role = msg?.author?.role;
      if (role !== "user" && role !== "assistant") continue;

      const markdown = nodeToMarkdown(node).trim();
      if (!markdown) continue;

      messages.push({ role, markdown });
    }

    return {
      title: conv.title || "ChatGPT Conversation",
      url: location.href,
      exportedAt: new Date().toISOString(),
      messages,
    };
  }

  /** Expose to extractor.js via a global on the content-script world. */
  window.__chatscribeApi = {
    available: () => !!getChatIdFromUrl(),
    getChatId: getChatIdFromUrl,
    async extract() {
      const chatId = getChatIdFromUrl();
      if (!chatId) throw new Error("No chat id in URL (open a specific conversation)");
      const conv = await fetchConversation(chatId);
      return conversationToData(conv);
    },
  };
})();
