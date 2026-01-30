// CodeMachine AI Assistant - Message Handling
import { icons } from "./icons.js";

export function addMessage(content, text, type, source = null) {
  const welcome = content.querySelector(".cm-welcome");
  if (welcome) welcome.remove();

  const msg = document.createElement("div");
  msg.className = `cm-message ${type}`;

  if (type === "user") {
    msg.innerHTML = `<div class="bubble">${text}</div>`;
  } else {
    const formattedText = text
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\n/g, "<br>");

    let sourceHtml = "";
    if (source) {
      sourceHtml = `<a href="${source.url}" class="source">${icons.doc} ${source.title}</a>`;
    }

    msg.innerHTML = `
      <div class="avatar">${icons.sparkle}</div>
      <div class="content">
        <div class="bubble">${formattedText}</div>
        ${sourceHtml}
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
