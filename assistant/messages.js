// CodeMachine AI Assistant - Message Handling
import { highlightCode } from "./highlight.js";


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

  // Escape HTML (security) - after extracting code blocks
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

  // Line breaks (outside code blocks)
  html = html.replace(/\n/g, '<br>');

  // Clean up extra <br> after/before block elements
  html = html.replace(/<\/(pre|ol|ul|h[1-4])><br>/g, '</$1>');
  html = html.replace(/<br><(pre|ol|ul|h[1-4])/g, '<$1');
  html = html.replace(/<br><li/g, '<li');
  html = html.replace(/<\/li><br>/g, '</li>');

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
