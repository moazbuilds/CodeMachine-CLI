// CodeMachine AI Assistant - DOM Components
import { icons } from "./icons.js";

export function createOverlay() {
  const overlay = document.createElement("div");
  overlay.id = "cm-assistant-overlay";
  document.body.appendChild(overlay);
  return overlay;
}

export function createTrigger() {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const shortcutKey = isMac ? '⌘' : 'Ctrl';

  const trigger = document.createElement("div");
  trigger.id = "cm-assistant-trigger";
  trigger.innerHTML = `
    <textarea id="cm-trigger-input" placeholder="Ask a question.." rows="1"></textarea>
    <span id="cm-trigger-shortcut">${shortcutKey} + I</span>
    <button id="cm-trigger-btn" aria-label="Open AI Assistant">${icons.arrow}</button>
  `;
  document.body.appendChild(trigger);
  return trigger;
}

export function createPanel() {
  const panel = document.createElement("div");
  panel.id = "cm-assistant-panel";
  panel.innerHTML = `
    <div id="cm-assistant-header">
      <div class="title-group">
        <div class="ai-icon">${icons.sparkle}</div>
        <div>
          <h3>Ask AI</h3>
          <div class="subtitle">Search the docs</div>
        </div>
      </div>
      <button id="cm-assistant-close">${icons.close}</button>
    </div>
    <div id="cm-assistant-content">
      <div class="cm-welcome">
        <div class="icon-wrapper">${icons.sparkle}</div>
        <h4>How can I help?</h4>
        <p>Ask anything about CodeMachine.</p>
        <div class="cm-suggestions">
          <button class="cm-suggestion">${icons.arrow} What is CodeMachine?</button>
          <button class="cm-suggestion">${icons.arrow} How do I create my first workflow?</button>
          <button class="cm-suggestion">${icons.arrow} How do agents work?</button>
        </div>
      </div>
    </div>
    <div id="cm-assistant-input-area">
      <div id="cm-assistant-input-wrapper">
        <input type="text" id="cm-assistant-input" placeholder="Ask a question..." />
        <button id="cm-assistant-send">${icons.send}</button>
      </div>
    </div>
    <div id="cm-assistant-footer">
      <span>Powered by your documentation</span>
    </div>
  `;
  document.body.appendChild(panel);
  return panel;
}

export function createNavbarButton(openAssistant) {
  if (document.getElementById("cm-navbar-ai-btn")) return;

  const searchEntry = document.querySelector('[data-testid="search-bar-entry"]') ||
                      document.getElementById('search-bar-entry') ||
                      document.querySelector('[class*="search-bar-entry"]');
  const discordLink = document.querySelector('a[href*="discord.com"]');
  const githubLink = document.querySelector('a[href*="github.com"]');

  let insertTarget = searchEntry || discordLink || githubLink;

  if (!insertTarget) {
    setTimeout(() => createNavbarButton(openAssistant), 500);
    return;
  }

  const navBtn = document.createElement("button");
  navBtn.id = "cm-navbar-ai-btn";
  navBtn.innerHTML = `${icons.sparkle}<span>Ask AI</span>`;
  navBtn.setAttribute("aria-label", "Open AI Assistant");

  navBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    openAssistant();
  });

  const parent = insertTarget.parentElement;
  if (parent) {
    insertTarget.insertAdjacentElement("afterend", navBtn);
  }
}
