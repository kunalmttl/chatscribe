/**
 * Gemini API Client for ChatScribe
 * 
 * Extracts conversation data from gemini.google.com using DOM scraping.
 * Unlike ChatGPT's API-based approach, Gemini requires DOM extraction due to
 * its internal RPC (batchexecute) endpoint being highly obfuscated.
 * 
 * DOM Structure:
 * - Container: #chat-history
 * - User messages: <user-query> elements
 * - Assistant messages: <model-response> with <message-content.model-response-text>
 * - Code blocks: .code-block or code-immersive-panel with .code-language + <code>
 * - Images: <img> tags within message content
 */

(function() {
  'use strict';

  /**
   * Check if current page is Gemini
   */
  function isGeminiPage() {
    return location.hostname === 'gemini.google.com';
  }

/**
 * Extract text content from an element, handling nested structures and preserving line breaks
 */
function extractTextContent(element) {
  if (!element) return '';
  
  // Clone the element to avoid modifying the live DOM
  const clone = element.cloneNode(true);
  
  // Convert <br> tags to newlines before getting textContent
  clone.querySelectorAll('br').forEach(br => {
    br.replaceWith(document.createTextNode('\n'));
  });
  
  // Remove script and style elements
  clone.querySelectorAll('script, style, .code-language').forEach(el => el.remove());
  
  // Get clean text content
  return clone.textContent
    .replace(/\n{3,}/g, '\n\n')  // Collapse excessive newlines
    .replace(/^\s+|\s+$/g, '')    // Trim whitespace
    .trim();
}

  /**
   * Extract code block from Gemini's code panel structure
   */
  function extractCodeBlock(codeContainer) {
    if (!codeContainer) return null;

    // Try different selectors for code blocks
    const wrapper = codeContainer.closest('.code-block') || 
                    codeContainer.closest('code-immersive-panel') ||
                    codeContainer;
    
    // Extract language identifier
    let language = '';
    const langElement = wrapper.querySelector('.code-language');
    if (langElement) {
      language = langElement.textContent.trim().toLowerCase();
    }
    
    // Extract code content from <code> tag
    let code = '';
    const codeElement = wrapper.querySelector('code');
    if (codeElement) {
      code = codeElement.textContent;
    } else {
      // Fallback: use direct text content of the wrapper
      code = wrapper.textContent;
    }

    return {
      language: language || 'text',
      code: code.trim()
    };
  }

  /**
   * Process message content, converting HTML elements to Markdown
   */
  function processMessageContent(container) {
    if (!container) return '';

    const clone = container.cloneNode(true);
    let markdown = '';

    // Process child nodes in order
    Array.from(clone.childNodes).forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) {
        markdown += node.textContent;
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const tagName = node.tagName.toLowerCase();
        
        switch (tagName) {
          case 'br':
            markdown += '\n';
            break;
          case 'p':
            markdown += extractTextContent(node) + '\n\n';
            break;
          case 'div':
          case 'span':
            // Check if this is a code block
            if (node.classList?.contains('code-block') || tagName === 'code-immersive-panel') {
              const codeBlock = extractCodeBlock(node);
              if (codeBlock) {
                markdown += '\n```' + codeBlock.language + '\n' + codeBlock.code + '\n```\n\n';
              }
            } else {
              // Recursively process nested elements
              markdown += processMessageContent(node);
            }
            break;
          case 'img':
            // Convert images to Markdown image syntax
            const alt = node.getAttribute('alt') || node.getAttribute('aria-label') || 'image';
            const src = node.getAttribute('src') || node.getAttribute('data-src') || '';
            if (src) {
              markdown += '![' + alt + '](' + src + ')\n\n';
            }
            break;
          case 'pre':
            // Handle pre > code structure
            const codeEl = node.querySelector('code');
            const code = codeEl ? codeEl.textContent : node.textContent;
            const langEl = node.querySelector('.code-language');
            const lang = langEl ? langEl.textContent.trim() : '';
            markdown += '\n```' + lang + '\n' + code.trim() + '\n```\n\n';
            break;
          case 'code':
            // Inline code
            markdown += '`' + node.textContent + '`';
            break;
          case 'ul':
          case 'ol':
            Array.from(node.children).forEach((li, i) => {
              const prefix = tagName === 'ol' ? (i + 1) + '.' : '-';
              markdown += prefix + ' ' + extractTextContent(li) + '\n';
            });
            markdown += '\n';
            break;
          case 'li':
            markdown += '- ' + extractTextContent(node) + '\n';
            break;
          case 'a':
            const href = node.getAttribute('href') || '';
            const linkText = node.textContent.trim();
            markdown += '[' + linkText + '](' + href + ')';
            break;
          case 'h1':
          case 'h2':
          case 'h3':
          case 'h4':
          case 'h5':
          case 'h6':
            const level = tagName[1];
            markdown += '\n' + '#'.repeat(parseInt(level)) + ' ' + node.textContent.trim() + '\n\n';
            break;
          case 'blockquote':
            markdown += '> ' + node.textContent.trim().replace(/\n/g, '\n> ') + '\n\n';
            break;
          case 'table':
            markdown += processTable(node);
            break;
          case 'hr':
            markdown += '\n---\n\n';
            break;
          case 'strong':
          case 'b':
            markdown += '**' + node.textContent + '**';
            break;
          case 'em':
          case 'i':
            markdown += '*' + node.textContent + '*';
            break;
          default:
            // Default: recurse into element
            markdown += processMessageContent(node);
        }
      }
    });

    return markdown;
  }

  /**
   * Process a table element to Markdown table format
   */
  function processTable(table) {
    const rows = table.querySelectorAll('tr');
    if (rows.length === 0) return '';

    let markdown = '';
    
    rows.forEach((row, rowIndex) => {
      const cells = row.querySelectorAll('td, th');
      const cellContents = Array.from(cells).map(cell => {
        return cell.textContent.trim().replace(/\|/g, '\\|');
      });
      
      markdown += '| ' + cellContents.join(' | ') + ' |\n';
      
      // Add separator row after header
      if (rowIndex === 0) {
        markdown += '| ' + cellContents.map(() => '---').join(' | ') + ' |\n';
      }
    });

    return markdown + '\n';
  }

  /**
   * Extract user query from user-query element
   */
  function extractUserQuery(element) {
    return extractTextContent(element);
  }

  /**
   * Extract model response from model-response element
   */
  function extractModelResponse(element) {
    const contentContainer = element.querySelector('message-content.model-response-text');
    if (!contentContainer) {
      return '';
    }
    
    return processMessageContent(contentContainer);
  }

  /**
   * Main extraction function - fetches all messages from the conversation
   */
  function extractConversation() {
    if (!isGeminiPage()) {
      return { error: 'Not a Gemini page' };
    }

    const messages = [];
    const chatHistory = document.querySelector('#chat-history');
    
    if (!chatHistory) {
      return { error: 'Could not find chat history container (#chat-history)' };
    }

    // Get all user queries and model responses in order
    const userQueries = chatHistory.querySelectorAll('user-query');
    const modelResponses = chatHistory.querySelectorAll('model-response');

    // Interleave user and assistant messages
    const totalPairs = Math.max(userQueries.length, modelResponses.length);
    
    for (let i = 0; i < totalPairs; i++) {
      // User message (if exists)
      if (i < userQueries.length) {
        const userContent = extractUserQuery(userQueries[i]);
        if (userContent) {
          messages.push({
            role: 'user',
            content: userContent
          });
        }
      }

      // Assistant message (if exists)
      if (i < modelResponses.length) {
        const assistantContent = extractModelResponse(modelResponses[i]);
        if (assistantContent) {
          messages.push({
            role: 'assistant',
            content: assistantContent
          });
        }
      }
    }

    if (messages.length === 0) {
      return { error: 'No messages found in conversation' };
    }

    return {
      messages: messages,
      source: 'gemini',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get conversation metadata
   */
  function getMetadata() {
    const titleEl = document.querySelector('h1, [role="heading"]');
    const title = titleEl ? titleEl.textContent.trim() : 'Untitled Conversation';
    
    return {
      title: title,
      url: location.href,
      source: 'gemini'
    };
  }

  // Expose API globally
  window.__geminiApi = {
    extract: extractConversation,
    isGeminiPage: isGeminiPage,
    getMetadata: getMetadata
  };
})();