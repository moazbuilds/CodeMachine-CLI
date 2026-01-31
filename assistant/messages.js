// CodeMachine AI Assistant - Message Handling
import { highlightCode } from "./highlight.js";

// Store reference to current streaming message for updates
let currentStreamingMessage = null;
let currentStreamingContent = '';
let pendingText = '';
let typewriterInterval = null;
let contentContainer = null;
let userHasScrolledUp = false;
const TYPEWRITER_SPEED = 3; // ms per tick (lower = faster)
const CHARS_PER_TICK = 5; // characters to type per tick

/**
 * Reset all streaming state - call before starting new conversation turn
 */
export function resetStreamingState(content) {
  // Clear typewriter interval
  if (typewriterInterval) {
    clearInterval(typewriterInterval);
    typewriterInterval = null;
  }

  // Remove scroll handler
  if (content && content._scrollHandler) {
    content.removeEventListener('scroll', content._scrollHandler);
    delete content._scrollHandler;
  }

  // Remove any existing streaming message
  const existingStream = document.getElementById("cm-streaming-message");
  if (existingStream) existingStream.remove();

  // Remove tool usage from previous turn
  const toolDiv = document.getElementById("cm-tool-usage");
  if (toolDiv) toolDiv.remove();

  // Reset state variables
  currentStreamingMessage = null;
  currentStreamingContent = '';
  pendingText = '';
  userHasScrolledUp = false;
}

/**
 * Parse markdown-like text to HTML
 * @param {string} text - Raw text from AI
 */
function parseMarkdown(text) {
  let html = text;

  // Store code blocks temporarily to protect them from other transformations
  const codeBlocks = [];
  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (match, lang, code) => {
    const index = codeBlocks.length;
    codeBlocks.push({ lang, code: code.trim() });
    return `%%CODEBLOCK_${index}%%`;
  });

  // Store tables temporarily
  const tables = [];
  html = html.replace(/(?:^|\n)((?:\|[^\n]+\|\n?)+)/g, (match, tableContent) => {
    const index = tables.length;
    tables.push(tableContent.trim());
    return `\n%%TABLE_${index}%%\n`;
  });

  // Escape HTML (security) - after extracting code blocks and tables
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Inline code (`code`)
  html = html.replace(/`([^`]+)`/g, '<code class="cm-inline-code">$1</code>');

  // Bold (**text**)
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // Italic (*text* but not in lists)
  html = html.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '<em>$1</em>');

  // Regular links [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Horizontal rules (---, ***, ___)
  html = html.replace(/^([-*_]){3,}$/gm, '<hr class="cm-hr">');

  // Blockquotes (> text)
  html = html.replace(/^&gt;\s*(.+)$/gm, '<blockquote class="cm-blockquote">$1</blockquote>');
  // Merge consecutive blockquotes
  html = html.replace(/<\/blockquote>\n<blockquote class="cm-blockquote">/g, '<br>');

  // Headers (## Header)
  html = html.replace(/^#### (.+)$/gm, '<h5 class="cm-header cm-h4">$1</h5>');
  html = html.replace(/^### (.+)$/gm, '<h4 class="cm-header cm-h3">$1</h4>');
  html = html.replace(/^## (.+)$/gm, '<h3 class="cm-header cm-h2">$1</h3>');
  html = html.replace(/^# (.+)$/gm, '<h3 class="cm-header cm-h1">$1</h3>');

  // Numbered lists (1. item)
  html = html.replace(/^(\d+)\.\s+(.+)$/gm, '<li class="cm-list-item cm-numbered">$2</li>');

  // Bullet lists (-, *, •)
  html = html.replace(/^[\-\*•]\s+(.+)$/gm, '<li class="cm-list-item">$1</li>');

  // Wrap consecutive list items
  html = html.replace(/((?:<li class="cm-list-item cm-numbered">.*?<\/li>[\n\r]*)+)/g, '<ol class="cm-list">$1</ol>');
  html = html.replace(/((?:<li class="cm-list-item">.*?<\/li>[\n\r]*)+)/g, '<ul class="cm-list">$1</ul>');

  // Line breaks (outside code blocks)
  html = html.replace(/\n/g, '<br>');

  // Clean up extra <br> after/before block elements
  html = html.replace(/<\/(pre|ol|ul|h[1-5]|blockquote|hr)><br>/g, '</$1>');
  html = html.replace(/<br><(pre|ol|ul|h[1-5]|blockquote)/g, '<$1');
  html = html.replace(/<br><li/g, '<li');
  html = html.replace(/<\/li><br>/g, '</li>');
  html = html.replace(/<hr class="cm-hr"><br>/g, '<hr class="cm-hr">');
  html = html.replace(/<br><hr class="cm-hr">/g, '<hr class="cm-hr">');

  // Restore tables with proper formatting
  html = html.replace(/%%TABLE_(\d+)%%/g, (match, index) => {
    const tableContent = tables[parseInt(index, 10)];
    return parseTable(tableContent);
  });

  // Restore code blocks with proper formatting
  html = html.replace(/%%CODEBLOCK_(\d+)%%/g, (match, index) => {
    const block = codeBlocks[parseInt(index, 10)];
    const langAttr = block.lang ? ` data-lang="${block.lang}"` : '';
    // Escape HTML in code and preserve newlines
    const escapedCode = block.code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return `<pre class="cm-code-block"${langAttr}><code>${escapedCode}</code></pre>`;
  });

  return html;
}

/**
 * Parse inline markdown formatting (bold, italic, code, links)
 */
function parseInlineMarkdown(text) {
  let html = text.trim();

  // Escape HTML first
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Inline code (`code`)
  html = html.replace(/`([^`]+)`/g, '<code class="cm-inline-code">$1</code>');

  // Bold (**text**)
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // Italic (*text*)
  html = html.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '<em>$1</em>');

  // Links [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  return html;
}

/**
 * Parse markdown table to HTML
 */
function parseTable(tableContent) {
  const rows = tableContent.split('\n').filter(row => row.trim());
  if (rows.length < 2) return tableContent;

  let html = '<table class="cm-table"><thead><tr>';

  // Header row
  const headerCells = rows[0].split('|').filter(cell => cell.trim() !== '');
  headerCells.forEach(cell => {
    html += `<th>${parseInlineMarkdown(cell)}</th>`;
  });
  html += '</tr></thead><tbody>';

  // Skip separator row (row with ---)
  const startRow = rows[1].includes('---') ? 2 : 1;

  // Body rows
  for (let i = startRow; i < rows.length; i++) {
    const cells = rows[i].split('|').filter(cell => cell.trim() !== '');
    if (cells.length > 0) {
      html += '<tr>';
      cells.forEach(cell => {
        html += `<td>${parseInlineMarkdown(cell)}</td>`;
      });
      html += '</tr>';
    }
  }

  html += '</tbody></table>';
  return html;
}


export function addMessage(content, text, type, source = null, sources = []) {
  const welcome = content.querySelector(".cm-welcome");
  if (welcome) welcome.remove();

  const msg = document.createElement("div");
  msg.className = `cm-message ${type}`;

  if (type === "user") {
    // User messages - simple text, escape HTML
    const safeText = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    msg.innerHTML = `<div class="bubble">${safeText}</div>`;
  } else {
    // Assistant messages - parse markdown (handles bold links for references)
    const formattedText = parseMarkdown(text);

    msg.innerHTML = `<div class="content">${formattedText}</div>`;

    // Apply syntax highlighting to code blocks
    setTimeout(() => highlightCode(msg), 0);
  }

  content.appendChild(msg);
  content.scrollTop = content.scrollHeight;
}

export function showThinking(content) {
  const thinking = document.createElement("div");
  thinking.className = "cm-thinking";
  thinking.id = "cm-thinking";
  thinking.innerHTML = `
    <div class="dots"><span></span><span></span><span></span></div>
  `;
  content.appendChild(thinking);
  content.scrollTop = content.scrollHeight;
}

export function hideThinking() {
  const thinking = document.getElementById("cm-thinking");
  if (thinking) thinking.remove();
}

/**
 * Show tool usage indicator (collapsible)
 */
export function showToolUsage(content, tool, message, queries = []) {
  // Check if tool usage already exists - update it instead of recreating
  let toolDiv = document.getElementById("cm-tool-usage");

  if (!toolDiv) {
    toolDiv = document.createElement("div");
    toolDiv.className = "cm-tool-usage"; // Start collapsed
    toolDiv.id = "cm-tool-usage";
    content.appendChild(toolDiv);
  }

  const icon = tool === 'search' ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>` : '';

  toolDiv.innerHTML = `
    <div class="cm-tool-header" onclick="this.parentElement.classList.toggle('expanded')">
      <div class="cm-tool-icon">${icon}</div>
      <span class="cm-tool-message">${message}</span>
      <svg class="cm-tool-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
    </div>
    <div class="cm-tool-details">
      ${queries.length > 0 ? `
        <div class="cm-tool-queries">
          ${queries.map(q => `<div class="cm-tool-query">${q}</div>`).join('')}
        </div>
      ` : ''}
      <div class="cm-tool-pages" id="cm-tool-pages"></div>
    </div>
  `;

  content.scrollTop = content.scrollHeight;
}

/**
 * Update tool usage with search results
 */
export function updateToolResults(results) {
  const toolDiv = document.getElementById("cm-tool-usage");
  const pagesDiv = document.getElementById("cm-tool-pages");

  if (!pagesDiv) {
    console.warn('[AI Assistant] cm-tool-pages not found');
    return;
  }

  // Debug: log what we received
  console.log('[AI Assistant] Tool results:', results);

  if (!results || !Array.isArray(results) || results.length === 0) {
    pagesDiv.innerHTML = '<div class="cm-tool-no-results">No results found</div>';
    return;
  }

  // Handle different result formats (url/link/href, title/name/label)
  pagesDiv.innerHTML = results.map(r => {
    const url = r.url || r.link || r.href || '#';
    const title = r.title || r.name || r.label || r.text || url;
    return `
      <a href="${url}" class="cm-tool-page">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>
        <span>${title}</span>
      </a>
    `;
  }).join('');

}

/**
 * Complete tool usage (show final state)
 */
export function completeToolUsage(message) {
  const toolDiv = document.getElementById("cm-tool-usage");
  if (!toolDiv) return;

  const messageSpan = toolDiv.querySelector('.cm-tool-message');
  if (messageSpan) {
    messageSpan.textContent = message;
  }

  // Add completed class for styling
  toolDiv.classList.add('completed');
}

/**
 * Hide tool usage indicator
 */
export function hideToolUsage() {
  const toolDiv = document.getElementById("cm-tool-usage");
  if (toolDiv) toolDiv.remove();
}

/**
 * Check if user is near the bottom of scroll
 */
function isNearBottom(container) {
  const threshold = 100; // pixels from bottom
  return container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
}

/**
 * Start a streaming message (creates placeholder)
 */
export function startStreamingMessage(content) {
  const welcome = content.querySelector(".cm-welcome");
  if (welcome) welcome.remove();

  // Remove any existing streaming message
  const existingStream = document.getElementById("cm-streaming-message");
  if (existingStream) existingStream.remove();

  // Reset streaming state
  currentStreamingContent = '';
  pendingText = '';
  contentContainer = content;
  userHasScrolledUp = false;

  // Clear any existing typewriter interval
  if (typewriterInterval) {
    clearInterval(typewriterInterval);
    typewriterInterval = null;
  }

  const msg = document.createElement("div");
  msg.className = "cm-message assistant streaming";
  msg.id = "cm-streaming-message";
  msg.innerHTML = `<div class="content"><span class="cm-cursor">▋</span></div>`;

  currentStreamingMessage = msg;

  // Track user scroll
  const scrollHandler = () => {
    if (!isNearBottom(content)) {
      userHasScrolledUp = true;
    } else {
      userHasScrolledUp = false;
    }
  };
  content.addEventListener('scroll', scrollHandler);
  content._scrollHandler = scrollHandler;

  // Always append at the end of content (after tool usage if present)
  content.appendChild(msg);
  content.scrollTop = content.scrollHeight;

  // Start typewriter loop
  typewriterInterval = setInterval(() => {
    typewriterTick(content);
  }, TYPEWRITER_SPEED);
}

/**
 * Typewriter tick - render multiple characters at a time
 */
function typewriterTick(content) {
  if (!currentStreamingMessage || pendingText.length === 0) return;

  // Take multiple characters from pending for faster typing
  const charsToTake = Math.min(CHARS_PER_TICK, pendingText.length);
  const chars = pendingText.slice(0, charsToTake);
  pendingText = pendingText.slice(charsToTake);
  currentStreamingContent += chars;

  // Render the current content (already parsed/formatted)
  renderStreamingContent();

  // Only scroll to bottom if user hasn't scrolled up
  if (content && !userHasScrolledUp) {
    content.scrollTop = content.scrollHeight;
  }
}

// Track last highlight time to avoid excessive highlighting
let lastHighlightTime = 0;
const HIGHLIGHT_DEBOUNCE = 200; // ms between highlight calls

/**
 * Render the current streaming content with cursor and live highlighting
 */
function renderStreamingContent() {
  if (!currentStreamingMessage) return;

  const contentDiv = currentStreamingMessage.querySelector('.content');
  if (contentDiv) {
    // Parse markdown BEFORE rendering (formats are applied as text arrives)
    const formattedText = parseMarkdown(currentStreamingContent);
    contentDiv.innerHTML = formattedText + '<span class="cm-cursor">▋</span>';

    // Apply syntax highlighting during streaming (debounced)
    const now = Date.now();
    if (now - lastHighlightTime > HIGHLIGHT_DEBOUNCE) {
      lastHighlightTime = now;
      highlightCode(currentStreamingMessage);
    }
  }
}

/**
 * Append text chunk to streaming message (adds to pending queue)
 */
export function appendStreamingText(content, text) {
  if (!currentStreamingMessage) return;

  // Add to pending text queue for typewriter effect
  pendingText += text;
}

/**
 * Complete streaming message (flush remaining text, remove cursor)
 */
export function completeStreamingMessage(content) {
  return new Promise((resolve) => {
    if (!currentStreamingMessage) {
      resolve(currentStreamingContent);
      return;
    }

    // Remove scroll handler
    if (content._scrollHandler) {
      content.removeEventListener('scroll', content._scrollHandler);
      delete content._scrollHandler;
    }

    // Wait for pending text to be typed out
    const checkComplete = () => {
      if (pendingText.length === 0) {
        // Clear interval
        if (typewriterInterval) {
          clearInterval(typewriterInterval);
          typewriterInterval = null;
        }

        // Final render without cursor
        const contentDiv = currentStreamingMessage.querySelector('.content');
        if (contentDiv) {
          const formattedText = parseMarkdown(currentStreamingContent);
          contentDiv.innerHTML = formattedText;
        }

        // Store reference before nulling
        const messageToHighlight = currentStreamingMessage;

        currentStreamingMessage.classList.remove('streaming');
        currentStreamingMessage.removeAttribute('id'); // Remove ID so it won't be deleted on next message
        currentStreamingMessage = null;
        userHasScrolledUp = false;

        // Only scroll to bottom if user was following along
        if (!userHasScrolledUp) {
          content.scrollTop = content.scrollHeight;
        }

        // Apply final syntax highlighting
        setTimeout(() => {
          if (messageToHighlight) {
            highlightCode(messageToHighlight);
          }
        }, 50);

        resolve(currentStreamingContent);
      } else {
        // Check again after a short delay
        setTimeout(checkComplete, 30);
      }
    };

    checkComplete();
  });
}

/**
 * Force flush all pending text immediately (for errors/interrupts)
 */
export function flushStreamingText() {
  if (pendingText.length > 0) {
    currentStreamingContent += pendingText;
    pendingText = '';
    renderStreamingContent();
  }
}

/**
 * Get current streaming content (for history)
 */
export function getStreamingContent() {
  return currentStreamingContent + pendingText;
}
