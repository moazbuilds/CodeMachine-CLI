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
    <div id="cm-panel-resize-handle"></div>
    <div id="cm-assistant-header">
      <div class="title-group">
        <div class="ai-icon">${icons.sparkle}</div>
        <div>
          <h3>Ask AI</h3>
          <div class="subtitle">Search the docs</div>
        </div>
      </div>
      <div class="header-actions">
        <button id="cm-assistant-clear" title="Clear chat">${icons.trash}</button>
        <button id="cm-assistant-expand" title="Expand panel">${icons.expand}</button>
        <button id="cm-assistant-close" title="Close">${icons.close}</button>
      </div>
    </div>
    <div id="cm-assistant-content">
      <div class="cm-welcome">
        <div class="icon-wrapper">${icons.sparkle}</div>
        <h4>How can I help?</h4>
        <p>Ask anything about CodeMachine.</p>
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

  // Setup resize functionality
  setupPanelResize(panel);

  return panel;
}

function setupPanelResize(panel) {
  const handle = panel.querySelector('#cm-panel-resize-handle');
  const MIN_WIDTH = 320;
  const MAX_WIDTH = 800;
  const STORAGE_KEY = 'cm_panel_width';

  // Restore saved width
  const savedWidth = localStorage.getItem(STORAGE_KEY);
  if (savedWidth) {
    const width = parseInt(savedWidth, 10);
    if (width >= MIN_WIDTH && width <= MAX_WIDTH) {
      panel.style.width = width + 'px';
    }
  }

  let isResizing = false;
  let startX = 0;
  let startWidth = 0;

  handle.addEventListener('mousedown', (e) => {
    isResizing = true;
    startX = e.clientX;
    startWidth = panel.offsetWidth;
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;

    const diff = startX - e.clientX;
    let newWidth = startWidth + diff;

    // Clamp to min/max
    newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, newWidth));

    panel.style.width = newWidth + 'px';

    // Update body margin if panel is open
    if (panel.classList.contains('open') && window.innerWidth > 768) {
      document.body.style.marginRight = newWidth + 'px';
    }
  });

  document.addEventListener('mouseup', () => {
    if (isResizing) {
      isResizing = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';

      // Save width
      localStorage.setItem(STORAGE_KEY, panel.offsetWidth);
    }
  });

  // Touch support for mobile
  handle.addEventListener('touchstart', (e) => {
    isResizing = true;
    startX = e.touches[0].clientX;
    startWidth = panel.offsetWidth;
    e.preventDefault();
  }, { passive: false });

  document.addEventListener('touchmove', (e) => {
    if (!isResizing) return;

    const diff = startX - e.touches[0].clientX;
    let newWidth = startWidth + diff;
    newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, newWidth));

    panel.style.width = newWidth + 'px';

    if (panel.classList.contains('open') && window.innerWidth > 768) {
      document.body.style.marginRight = newWidth + 'px';
    }
  }, { passive: false });

  document.addEventListener('touchend', () => {
    if (isResizing) {
      isResizing = false;
      localStorage.setItem(STORAGE_KEY, panel.offsetWidth);
    }
  });
}

function injectNavbarButton(openAssistant) {
  if (document.getElementById("cm-navbar-ai-btn")) return true;

  const searchEntry = document.querySelector('[data-testid="search-bar-entry"]') ||
                      document.getElementById('search-bar-entry') ||
                      document.querySelector('[class*="search-bar-entry"]');
  const discordLink = document.querySelector('a[href*="discord.com"]');
  const githubLink = document.querySelector('a[href*="github.com"]');

  let insertTarget = searchEntry || discordLink || githubLink;

  if (!insertTarget) {
    return false;
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
    return true;
  }
  return false;
}

export function createNavbarButton(openAssistant) {
  // Initial injection attempt
  if (!injectNavbarButton(openAssistant)) {
    setTimeout(() => injectNavbarButton(openAssistant), 500);
  }

  // Watch for DOM changes (client-side navigation)
  const observer = new MutationObserver(() => {
    // Re-inject if button is missing
    if (!document.getElementById("cm-navbar-ai-btn")) {
      injectNavbarButton(openAssistant);
    }
  });

  // Observe the document for changes
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}
