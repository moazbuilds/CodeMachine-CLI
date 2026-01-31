// CodeMachine AI Assistant - Message Handling
import { icons } from "./icons.js";

/**
 * Parse markdown-like text to HTML
 * @param {string} text - Raw text from AI
 * @param {Array} sources - Array of source objects with index, title, url
 */
function parseMarkdown(text, sources = []) {
  let html = text;

  // Escape HTML first (security)
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Code blocks (```language\ncode```)
  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (match, lang, code) => {
    const langClass = lang ? ` data-lang="${lang}"` : '';
    return `<pre class="cm-code-block"${langClass}><code>${code.trim()}</code></pre>`;
  });

  // Inline code (`code`)
  html = html.replace(/`([^`]+)`/g, '<code class="cm-inline-code">$1</code>');

  // Bold (**text**)
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // Italic (*text* but not in lists)
  html = html.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '<em>$1</em>');

  // Reference links - handle multiple numbers like [1, 2], [1, 2, 5], (1), etc.
  html = html.replace(/\[(\d+(?:\s*,\s*\d+)*)\]/g, (match, nums) => {
    const numbers = nums.split(/\s*,\s*/);
    const links = numbers.map(num => {
      const index = parseInt(num.trim(), 10);
      const source = sources.find(s => s.index === index);
      if (source && source.url) {
        return `<a href="${source.url}" class="cm-ref-link" target="_blank" rel="noopener" title="${source.title || 'Source'}">[${num.trim()}]</a>`;
      }
      return `[${num.trim()}]`;
    });
    return links.join('');
  });

  // Regular links [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

  // Headers (## Header)
  html = html.replace(/^### (.+)$/gm, '<h4 class="cm-header">$1</h4>');
  html = html.replace(/^## (.+)$/gm, '<h3 class="cm-header">$1</h3>');
  html = html.replace(/^# (.+)$/gm, '<h3 class="cm-header">$1</h3>');

  // Numbered lists (1. item)
  html = html.replace(/^(\d+)\.\s+(.+)$/gm, '<li class="cm-list-item cm-numbered">$2</li>');

  // Bullet lists (-, *, •)
  html = html.replace(/^[\-\*•]\s+(.+)$/gm, '<li class="cm-list-item">$1</li>');

  // Wrap consecutive list items
  html = html.replace(/((?:<li class="cm-list-item cm-numbered">.*?<\/li>[\n\r]*)+)/g, '<ol class="cm-list">$1</ol>');
  html = html.replace(/((?:<li class="cm-list-item">.*?<\/li>[\n\r]*)+)/g, '<ul class="cm-list">$1</ul>');

  // Line breaks
  html = html.replace(/\n/g, '<br>');

  // Clean up extra <br> after/before block elements
  html = html.replace(/<\/(pre|ol|ul|h[1-4])><br>/g, '</$1>');
  html = html.replace(/<br><(pre|ol|ul|h[1-4])/g, '<$1');
  html = html.replace(/<br><li/g, '<li');
  html = html.replace(/<\/li><br>/g, '</li>');

  return html;
}

/**
 * Extract referenced source numbers from text (e.g., [1], [2, 3])
 * @param {string} text - The message text
 * @returns {Set<number>} Set of referenced source numbers
 */
function extractReferencedSources(text) {
  const refs = new Set();
  const matches = text.matchAll(/\[(\d+(?:\s*,\s*\d+)*)\]/g);
  for (const match of matches) {
    const nums = match[1].split(/\s*,\s*/);
    nums.forEach(n => refs.add(parseInt(n.trim(), 10)));
  }
  return refs;
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
    // Assistant messages - parse markdown with sources for reference links
    const formattedText = parseMarkdown(text, sources);

    // Extract which sources were actually referenced in the text
    const referencedNums = extractReferencedSources(text);

    // Build source cards only for referenced sources (max 3)
    let sourcesHtml = "";
    if (sources.length > 0 && referencedNums.size > 0) {
      const referencedSources = sources
        .filter(s => referencedNums.has(s.index))
        .slice(0, 3); // Max 3 cards

      if (referencedSources.length > 0) {
        sourcesHtml = `<div class="cm-source-cards">` +
          referencedSources.map(s =>
            `<a href="${s.url}" class="source" target="_blank" rel="noopener">${icons.doc} ${s.title || 'Source'}</a>`
          ).join('') +
          `</div>`;
      }
    }

    msg.innerHTML = `
      <div class="avatar">${icons.sparkle}</div>
      <div class="content">
        <div class="bubble">${formattedText}</div>
        ${sourcesHtml}
      </div>
    `;
  }

  content.appendChild(msg);
  content.scrollTop = content.scrollHeight;
}

export function showThinking(content) {
  const thinking = document.createElement("div");
  thinking.className = "cm-thinking";
  thinking.id = "cm-thinking";
  thinking.innerHTML = `
    <div class="avatar">${icons.sparkle}</div>
    <div class="dots"><span></span><span></span><span></span></div>
  `;
  content.appendChild(thinking);
  content.scrollTop = content.scrollHeight;
}

export function hideThinking() {
  const thinking = document.getElementById("cm-thinking");
  if (thinking) thinking.remove();
}
