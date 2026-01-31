// CodeMachine AI Assistant - DOM Components
import { icons } from "./icons.js";

// Ali face expressions - matching the TUI narrator (swagger persona)
export const ALI_FACES = {
  idle: '(⌐■_■)',
  thinking: '(╭ರ_•́)',
  tool: '<(•_•<)',
  error: '(╥﹏╥)',
  excited: '(ノ◕ヮ◕)ノ',
  cool: '(⌐■_■)',
};

// Swagger phrases from agent-characters.json
export const ALI_PHRASES = {
  thinking: [
    "Aight lemme figure this out real quick",
    "Brain.exe is running, one sec",
    "Ooh okay I see what you need",
    "Processing... not in a robot way tho",
    "Gimme a moment, I'm onto something",
    "Hmm interesting, let me think on that",
    "This is giving me ideas hold up",
    "Working on it, trust the process",
    "My last two brain cells are on it",
    "Cooking up something good rn"
  ],
  tool: [
    "Okay okay I got what I needed from you",
    "Perfect, that's exactly what I was looking for",
    "Bet, now I can actually do something with this",
    "You delivered, now watch me work",
    "That's the info I needed, let's go",
    "W response, I can work with this",
    "Ayyy thanks for that, proceeding now",
    "Got it got it, running with it",
    "This is what I'm talking about, moving on",
    "Locked in, thanks homie"
  ],
  error: [
    "Oof that tool ghosted me, trying plan B",
    "Didn't work but I got other tricks",
    "Rip that attempt, switching it up",
    "Tool said no but I don't take rejection well",
    "Minor L, already pivoting tho",
    "That one's on the tool not me js",
    "Blocked but not stopped, watch this",
    "Error schmrror, I got backups",
    "Universe said try harder, so I will",
    "Speedbump, not a dead end"
  ],
  idle: [
    "Okay your turn, what's next?",
    "Ball's in your court homie",
    "Ready when you are, no cap",
    "Waiting on you, take your time tho",
    "What we doing next boss?",
    "I'm here, you lead the way",
    "Your move chief",
    "Standing by for orders",
    "Hit me with the next step",
    "Listening, what you need?"
  ]
};

// Get random phrase for expression
export function getRandomPhrase(expression) {
  const phrases = ALI_PHRASES[expression] || ALI_PHRASES.idle;
  return phrases[Math.floor(Math.random() * phrases.length)];
}

// Typewriter state
let typewriterInterval = null;
let typewriterTimeout = null;

/**
 * Update the Ali face and typewrite a phrase in the header frame
 * @param {'idle' | 'thinking' | 'tool' | 'error' | 'excited' | 'cool'} expression
 * @param {string} [customPhrase] - Optional custom phrase instead of random
 */
export function setAliFace(expression, customPhrase = null) {
  const faceEl = document.querySelector('#cm-ali-frame .ali-face');
  const textEl = document.querySelector('#cm-ali-frame .ali-text');
  const cursorEl = document.querySelector('#cm-ali-frame .ali-cursor');

  if (faceEl) {
    faceEl.textContent = ALI_FACES[expression] || ALI_FACES.idle;
    faceEl.dataset.expression = expression;
  }

  if (textEl) {
    // Clear any existing typewriter
    if (typewriterInterval) clearInterval(typewriterInterval);
    if (typewriterTimeout) clearTimeout(typewriterTimeout);

    const phrase = customPhrase || getRandomPhrase(expression);
    let charIndex = 0;
    textEl.textContent = '';

    // Show cursor while typing
    if (cursorEl) {
      cursorEl.style.display = 'inline';
      cursorEl.style.animation = 'blink 1s step-end infinite';
    }

    // Typewriter effect - 30ms per character like the TUI
    typewriterInterval = setInterval(() => {
      if (charIndex < phrase.length) {
        textEl.textContent += phrase[charIndex];
        charIndex++;
      } else {
        clearInterval(typewriterInterval);
        typewriterInterval = null;
        // Hide cursor completely after typing completes
        if (cursorEl) {
          cursorEl.style.animation = 'none';
          cursorEl.style.display = 'none';
        }
      }
    }, 30);
  }
}

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
    <textarea id="cm-trigger-input" placeholder="Ask a question.." rows="1" autocomplete="one-time-code" autocorrect="off" autocapitalize="off" spellcheck="true" enterkeyhint="send" data-form-type="other" data-lpignore="true"></textarea>
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
      <div id="cm-ali-frame">
        <svg class="ali-border-svg" viewBox="0 0 24 60" preserveAspectRatio="none">
          <path d="M24 2 L12 2 Q2 2 2 12 L2 48 Q2 58 12 58 L24 58" fill="none" stroke="currentColor" stroke-width="2"/>
        </svg>
        <div class="ali-frame-content">
          <div class="ali-frame-row">
            <span class="ali-face" data-expression="idle">${ALI_FACES.idle}</span>
            <span class="ali-spacer"></span>
            <span class="ali-name">Ali | The CM Guy</span>
          </div>
          <div class="ali-frame-row">
            <span class="ali-arrow">↳</span><span class="ali-text"></span><span class="ali-cursor">_</span>
          </div>
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
        <h4>How can I help?</h4>
        <p>Ask anything about CodeMachine.</p>
      </div>
    </div>
    <div id="cm-assistant-input-area">
      <div id="cm-assistant-input-wrapper">
        <textarea id="cm-assistant-input" placeholder="Ask a question..." rows="1" autocomplete="one-time-code" autocorrect="off" autocapitalize="off" spellcheck="true" enterkeyhint="send" data-form-type="other" data-lpignore="true"></textarea>
        <button id="cm-assistant-send">${icons.arrow}</button>
      </div>
    </div>
  `;
  document.body.appendChild(panel);

  // Setup resize functionality
  setupPanelResize(panel);

  // Initialize with idle phrase
  setTimeout(() => setAliFace('idle'), 100);

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
  navBtn.innerHTML = `<span class="nav-ali-face">${ALI_FACES.idle}</span><span>Ask Ali</span>`;
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

  // Also inject into mobile overflow menu if it exists
  injectMobileMenuButton(openAssistant);

  return true;
}

function injectMobileMenuButton(openAssistant) {
  if (document.getElementById("cm-mobile-ai-btn")) return;

  // Look for Mintlify's mobile navigation menu (three dots overflow menu)
  const mobileMenuSelectors = [
    '[id*="navigation-items"]',
    '[class*="mobile-menu"]',
    '[class*="overflow-menu"]',
    '[data-testid*="mobile"]',
    'nav[class*="mobile"]'
  ];

  // Also watch for the mobile menu to appear dynamically
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          // Check if this is a mobile menu or dropdown
          const isMenu = node.matches && (
            node.matches('[role="menu"]') ||
            node.matches('[class*="dropdown"]') ||
            node.matches('[class*="popover"]')
          );

          if (isMenu && !document.getElementById("cm-mobile-ai-btn")) {
            const links = node.querySelectorAll('a[href*="discord"], a[href*="github"]');
            if (links.length > 0) {
              const mobileBtn = createMobileButton(openAssistant);
              const lastLink = links[links.length - 1];
              lastLink.parentElement.insertAdjacentElement("afterend", mobileBtn.parentElement || mobileBtn);
            }
          }
        }
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

function createMobileButton(openAssistant) {
  const btn = document.createElement("button");
  btn.id = "cm-mobile-ai-btn";
  btn.className = "cm-mobile-menu-item";
  btn.innerHTML = `<span class="nav-ali-face">${ALI_FACES.idle}</span> Ask Ali`;
  btn.setAttribute("aria-label", "Open AI Assistant");
  btn.style.cssText = `
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    background: transparent;
    border: none;
    cursor: pointer;
    font-size: 14px;
    color: inherit;
    width: 100%;
    text-align: left;
    font-family: inherit;
  `;

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    openAssistant();
  });

  return btn;
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
