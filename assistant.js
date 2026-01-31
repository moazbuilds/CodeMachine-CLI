(() => {
  // assistant/styles.js
  var styles = `
  /* Minimal animations */
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }

  /* CSS Variables for theming - Light mode is default */
  #cm-assistant-trigger,
  #cm-assistant-panel {
    --cm-bg-primary: #ffffff;
    --cm-bg-secondary: #f9fafb;
    --cm-bg-tertiary: #f3f4f6;
    --cm-text-primary: #111827;
    --cm-text-secondary: #6b7280;
    --cm-text-tertiary: #9ca3af;
    --cm-border: #e5e7eb;
    --cm-border-light: #f3f4f6;
    --cm-border-focus: #9ca3af;
    --cm-accent: #111827;
    --cm-accent-bg: rgba(17, 24, 39, 0.08);
  }

  /* Dark mode - when .dark class is on html or body */
  .dark #cm-assistant-trigger,
  .dark #cm-assistant-panel,
  html.dark #cm-assistant-trigger,
  html.dark #cm-assistant-panel {
    --cm-bg-primary: #0a0a0b;
    --cm-bg-secondary: #111113;
    --cm-bg-tertiary: #18181b;
    --cm-text-primary: #fafafa;
    --cm-text-secondary: #a1a1aa;
    --cm-text-tertiary: #71717a;
    --cm-border: #27272a;
    --cm-border-light: #1f1f23;
    --cm-border-focus: #52525b;
    --cm-accent: #32bde3;
    --cm-accent-bg: rgba(50, 189, 227, 0.1);
  }

  /* Push content when panel opens */
  html {
    overflow-x: hidden;
  }
  body {
    transition: margin-right 0.25s ease;
  }
  body.cm-panel-open {
    /* margin-right is set dynamically by JS based on panel width */
  }
  /* Hide TOC when panel is open (center-like layout) */
  body.cm-panel-open #content-side-layout {
    display: none !important;
  }
  /* Center the main content */
  body.cm-panel-open article {
    max-width: 100% !important;
    margin-left: auto !important;
    margin-right: auto !important;
  }
  @media (max-width: 768px) {
    body.cm-panel-open {
      margin-right: 0;
    }
  }

  /* Trigger input box */
  #cm-assistant-trigger {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: flex-start;
    gap: 8px;
    background: var(--cm-bg-primary);
    border: 1px solid var(--cm-border-light);
    border-radius: 14px;
    padding: 10px 10px 10px 16px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.04);
    z-index: 9999;
    transition: all 0.25s ease, opacity 0.2s ease, transform 0.25s ease;
    width: 320px;
    min-height: 56px;
    opacity: 1;
  }
  #cm-assistant-trigger.hidden {
    opacity: 0;
    transform: translateX(-50%) translateY(20px);
    pointer-events: none;
  }
  #cm-assistant-trigger:hover {
    transform: translateX(-50%) scale(1.01);
    box-shadow: 0 4px 12px rgba(0,0,0,0.06);
    border-color: var(--cm-border);
  }
  #cm-assistant-trigger:focus-within {
    transform: translateX(-50%);
    box-shadow: 0 4px 12px rgba(0,0,0,0.06);
    border-color: var(--cm-border-focus);
  }
  #cm-assistant-trigger.expanded {
    width: 420px;
  }
  #cm-trigger-input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    font-size: 14px;
    color: var(--cm-text-primary);
    padding: 6px 0;
    font-family: Inter, -apple-system, BlinkMacSystemFont, sans-serif;
    resize: none;
    min-height: 36px;
    max-height: 120px;
    line-height: 1.5;
    overflow-y: auto;
  }
  #cm-trigger-input::placeholder {
    color: var(--cm-text-tertiary);
  }
  #cm-trigger-btn {
    background: transparent;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4px;
    transition: all 0.15s ease;
    flex-shrink: 0;
    align-self: flex-end;
    margin-bottom: 6px;
  }
  #cm-trigger-btn:hover {
    opacity: 0.6;
  }
  #cm-trigger-btn svg {
    width: 18px;
    height: 18px;
    color: var(--cm-text-tertiary);
  }
  #cm-trigger-shortcut {
    display: flex;
    align-items: center;
    gap: 2px;
    font-size: 11px;
    color: var(--cm-text-tertiary);
    padding: 4px 8px;
    background: var(--cm-bg-secondary);
    border-radius: 6px;
    font-family: Inter, -apple-system, BlinkMacSystemFont, sans-serif;
    align-self: flex-end;
    margin-bottom: 8px;
    pointer-events: none;
  }

  /* Panel */
  #cm-assistant-panel {
    position: fixed;
    top: 0;
    right: 0;
    width: 400px;
    height: 100vh;
    height: 100dvh;
    background: var(--cm-bg-primary);
    box-shadow: -1px 0 0 var(--cm-border), -8px 0 24px rgba(0,0,0,0.06);
    display: flex;
    flex-direction: column;
    z-index: 9998;
    transform: translateX(100%);
    transition: transform 0.25s ease;
  }
  #cm-assistant-panel.open {
    transform: translateX(0);
  }

  /* Resize handle */
  #cm-panel-resize-handle {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 6px;
    cursor: ew-resize;
    background: transparent;
    z-index: 10;
    transition: background 0.15s ease;
  }
  #cm-panel-resize-handle:hover,
  #cm-panel-resize-handle:active {
    background: var(--cm-accent);
  }
  #cm-panel-resize-handle::before {
    content: '';
    position: absolute;
    left: 1px;
    top: 50%;
    transform: translateY(-50%);
    width: 4px;
    height: 40px;
    background: var(--cm-border);
    border-radius: 2px;
    opacity: 0;
    transition: opacity 0.15s ease;
  }
  #cm-panel-resize-handle:hover::before {
    opacity: 1;
  }
  @media (max-width: 768px) {
    #cm-assistant-panel {
      width: 100%;
      box-shadow: none;
    }
    #cm-assistant-trigger {
      bottom: 16px;
      width: calc(100% - 32px);
      max-width: 340px;
    }
    #cm-assistant-trigger.expanded {
      max-width: 420px;
    }
    #cm-assistant-trigger.hidden {
      opacity: 0;
      transform: translateX(-50%) translateY(20px);
      pointer-events: none;
    }
  }

  /* Mobile overlay */
  #cm-assistant-overlay {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 9997;
    opacity: 0;
    transition: opacity 0.25s ease;
  }
  #cm-assistant-overlay.visible {
    opacity: 1;
  }
  @media (max-width: 768px) {
    #cm-assistant-overlay.active {
      display: block;
    }
  }

  /* Header */
  #cm-assistant-header {
    padding: 16px 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
  }
  #cm-assistant-header .title-group {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  #cm-assistant-header .ai-icon {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: var(--cm-accent);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  #cm-assistant-header .ai-icon svg {
    width: 16px;
    height: 16px;
    color: white;
  }
  #cm-assistant-header h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--cm-text-primary);
    font-family: Inter, -apple-system, BlinkMacSystemFont, sans-serif;
    word-break: normal;
    overflow-wrap: normal;
    white-space: nowrap;
  }
  .header-actions {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  #cm-assistant-close,
  #cm-assistant-expand,
  #cm-assistant-clear {
    width: 28px;
    height: 28px;
    background: transparent;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--cm-text-tertiary);
    transition: all 0.15s ease;
  }
  #cm-assistant-close:hover,
  #cm-assistant-expand:hover,
  #cm-assistant-clear:hover {
    background: var(--cm-bg-secondary);
    color: var(--cm-text-primary);
  }
  #cm-assistant-clear:hover {
    color: #ef4444;
  }
  #cm-assistant-expand.expanded {
    color: var(--cm-accent);
  }
  #cm-assistant-close svg,
  #cm-assistant-expand svg,
  #cm-assistant-clear svg {
    width: 16px;
    height: 16px;
  }

  /* Content area */
  #cm-assistant-content {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  #cm-assistant-content::-webkit-scrollbar {
    width: 4px;
  }
  #cm-assistant-content::-webkit-scrollbar-track {
    background: transparent;
  }
  #cm-assistant-content::-webkit-scrollbar-thumb {
    background: var(--cm-border);
    border-radius: 2px;
  }

  /* Welcome state */
  .cm-welcome {
    padding: 24px 8px;
    text-align: center;
  }
  .cm-welcome .icon-wrapper {
    width: 48px;
    height: 48px;
    margin: 0 auto 16px;
    background: var(--cm-accent-bg);
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .cm-welcome .icon-wrapper svg {
    width: 24px;
    height: 24px;
    color: var(--cm-accent);
  }
  .cm-welcome h4 {
    color: var(--cm-text-primary);
    margin: 0 0 6px;
    font-size: 16px;
    font-weight: 600;
    font-family: Inter, -apple-system, BlinkMacSystemFont, sans-serif;
    word-break: normal;
    overflow-wrap: normal;
    white-space: nowrap;
  }
  .cm-welcome p {
    color: var(--cm-text-secondary);
    margin: 0 0 20px;
    font-size: 13px;
    line-height: 1.5;
    font-family: Inter, -apple-system, BlinkMacSystemFont, sans-serif;
  }

  /* Suggestions */
  .cm-suggestions {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .cm-suggestion {
    padding: 10px 12px;
    background: var(--cm-bg-secondary);
    border: 1px solid var(--cm-border-light);
    border-radius: 8px;
    font-size: 13px;
    color: var(--cm-text-secondary);
    cursor: pointer;
    text-align: left;
    transition: all 0.15s ease;
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: Inter, -apple-system, BlinkMacSystemFont, sans-serif;
  }
  .cm-suggestion:hover {
    background: var(--cm-accent-bg);
    border-color: var(--cm-accent);
    color: var(--cm-text-primary);
  }
  .cm-suggestion svg {
    width: 14px;
    height: 14px;
    color: var(--cm-accent);
    flex-shrink: 0;
  }

  /* Messages */
  .cm-message {
    animation: fadeIn 0.2s ease;
  }
  .cm-message.user {
    display: flex;
    justify-content: flex-end;
  }
  .cm-message.user .bubble {
    background: var(--cm-text-primary);
    color: var(--cm-bg-primary);
    padding: 10px 14px;
    border-radius: 12px 12px 4px 12px;
    max-width: 85%;
    font-size: 13px;
    line-height: 1.5;
    font-family: Inter, -apple-system, BlinkMacSystemFont, sans-serif;
    text-wrap: pretty;
    word-break: normal;
    overflow-wrap: normal;
  }
  .cm-message.assistant {
    display: block;
  }
  .cm-message.assistant .content {
    color: var(--cm-text-primary);
    font-size: 13px;
    line-height: 1.6;
    font-family: Inter, -apple-system, BlinkMacSystemFont, sans-serif;
    text-wrap: pretty;
    word-break: normal;
    overflow-wrap: normal;
  }
  /* Markdown content styles */
  .cm-message.assistant .content .cm-code-block {
    background: var(--cm-bg-tertiary) !important;
    border: 1px solid var(--cm-border);
    border-radius: 6px;
    padding: 10px 12px !important;
    margin: 8px 0 !important;
    overflow-x: auto;
    font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace !important;
    font-size: 12px !important;
    line-height: 1.5 !important;
  }
  .cm-message.assistant .content .cm-code-block code {
    background: none !important;
    padding: 0 !important;
    font-family: inherit !important;
    font-size: inherit !important;
    line-height: inherit !important;
    white-space: pre;
    word-break: normal;
    overflow-wrap: normal;
    display: block;
  }
  .cm-message.assistant .content .cm-inline-code {
    background: var(--cm-bg-tertiary);
    border: 1px solid var(--cm-border-light);
    border-radius: 4px;
    padding: 1px 5px;
    font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
    font-size: 12px;
    color: var(--cm-accent);
  }
  .cm-message.assistant .content .cm-list {
    margin: 8px 0;
    padding-left: 20px;
  }
  .cm-message.assistant .content .cm-list-item {
    margin: 4px 0;
    line-height: 1.5;
  }
  .cm-message.assistant .content .cm-header {
    margin: 12px 0 6px;
    font-weight: 600;
    color: var(--cm-text-primary);
  }
  .cm-message.assistant .content h3.cm-header {
    font-size: 14px;
  }
  .cm-message.assistant .content h4.cm-header {
    font-size: 13px;
  }
  .cm-message.assistant .content a {
    color: var(--cm-accent);
    text-decoration: none;
  }
  .cm-message.assistant .content a:hover {
    text-decoration: underline;
  }
  .cm-message.assistant .content .cm-ref-link {
    color: var(--cm-accent);
    font-size: 11px;
    font-weight: 500;
    padding: 1px 4px;
    background: var(--cm-accent-bg);
    border-radius: 4px;
    text-decoration: none;
    vertical-align: super;
    margin: 0 1px;
  }
  .cm-message.assistant .content .cm-ref-link:hover {
    background: var(--cm-accent);
    color: white;
    text-decoration: none;
  }
  .cm-message.assistant .content strong {
    font-weight: 600;
    color: var(--cm-text-primary);
  }
  .cm-message.assistant .content em {
    font-style: italic;
  }

  /* Thinking indicator */
  .cm-thinking {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    animation: fadeIn 0.2s ease;
  }
  .cm-thinking .avatar {
    width: 28px;
    height: 28px;
    border-radius: 8px;
    background: var(--cm-accent-bg);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .cm-thinking .avatar svg {
    width: 14px;
    height: 14px;
    color: var(--cm-accent);
  }
  .cm-thinking .dots {
    display: flex;
    gap: 4px;
    padding: 12px 0;
  }
  .cm-thinking .dots span {
    width: 6px;
    height: 6px;
    background: var(--cm-text-tertiary);
    border-radius: 50%;
    animation: dotPulse 1s ease-in-out infinite;
  }
  .cm-thinking .dots span:nth-child(2) { animation-delay: 0.15s; }
  .cm-thinking .dots span:nth-child(3) { animation-delay: 0.3s; }
  @keyframes dotPulse {
    0%, 100% { opacity: 0.3; }
    50% { opacity: 1; }
  }

  /* Input area */
  #cm-assistant-input-area {
    padding: 12px 16px 16px;
    flex-shrink: 0;
  }
  #cm-assistant-input-wrapper {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    background: var(--cm-bg-primary);
    border: 1px solid var(--cm-border-light);
    border-radius: 14px;
    padding: 10px 10px 10px 16px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.04);
    transition: all 0.15s ease;
    min-height: 56px;
  }
  #cm-assistant-input-wrapper:hover {
    box-shadow: 0 4px 12px rgba(0,0,0,0.06);
    border-color: var(--cm-border);
  }
  #cm-assistant-input-wrapper:focus-within {
    box-shadow: 0 4px 12px rgba(0,0,0,0.06);
    border-color: var(--cm-border-focus);
  }
  #cm-assistant-input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    font-size: 14px;
    color: var(--cm-text-primary);
    padding: 6px 0;
    font-family: Inter, -apple-system, BlinkMacSystemFont, sans-serif;
    resize: none;
    min-height: 36px;
    max-height: 120px;
    line-height: 1.5;
    overflow-y: auto;
  }
  #cm-assistant-input::placeholder {
    color: var(--cm-text-tertiary);
  }
  #cm-assistant-send {
    background: transparent;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4px;
    transition: all 0.15s ease;
    flex-shrink: 0;
    align-self: flex-end;
    margin-bottom: 6px;
  }
  #cm-assistant-send:hover {
    opacity: 0.6;
  }
  #cm-assistant-send:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  #cm-assistant-send svg {
    width: 18px;
    height: 18px;
    color: var(--cm-text-tertiary);
  }

  /* Navbar button */
  #cm-navbar-ai-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    background: transparent;
    border: 1px solid var(--cm-border);
    border-radius: 10px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    color: var(--cm-text-secondary);
    transition: all 0.15s ease;
    margin: 0 8px;
    flex-shrink: 0;
    font-family: Inter, -apple-system, BlinkMacSystemFont, sans-serif;
  }
  #cm-navbar-ai-btn:hover {
    background: var(--cm-bg-secondary);
    color: var(--cm-text-primary);
  }
  #cm-navbar-ai-btn svg {
    width: 14px;
    height: 14px;
  }
  @media (max-width: 768px) {
    #cm-navbar-ai-btn span {
      display: none;
    }
    #cm-navbar-ai-btn {
      padding: 6px;
    }
  }
`;
  function injectStyles() {
    const styleEl = document.createElement("style");
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);
  }

  // assistant/icons.js
  var icons = {
    sparkle: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 1L14.5 9.5L23 12L14.5 14.5L12 23L9.5 14.5L1 12L9.5 9.5L12 1Z"/></svg>`,
    close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>`,
    send: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>`,
    arrow: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>`,
    doc: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8"/></svg>`,
    expand: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>`,
    shrink: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 14h6v6M14 4h6v6M10 14l-7 7M21 3l-7 7"/></svg>`,
    trash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/></svg>`
  };

  // assistant/components.js
  function createOverlay() {
    const overlay = document.createElement("div");
    overlay.id = "cm-assistant-overlay";
    document.body.appendChild(overlay);
    return overlay;
  }
  function createTrigger() {
    const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
    const shortcutKey = isMac ? "\u2318" : "Ctrl";
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
  function createPanel() {
    const panel = document.createElement("div");
    panel.id = "cm-assistant-panel";
    panel.innerHTML = `
    <div id="cm-panel-resize-handle"></div>
    <div id="cm-assistant-header">
      <div class="title-group">
        <div class="ai-icon">${icons.sparkle}</div>
        <div>
          <h3>Ask AI</h3>
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
        <textarea id="cm-assistant-input" placeholder="Ask a question..." rows="1"></textarea>
        <button id="cm-assistant-send">${icons.arrow}</button>
      </div>
    </div>
  `;
    document.body.appendChild(panel);
    setupPanelResize(panel);
    return panel;
  }
  function setupPanelResize(panel) {
    const handle = panel.querySelector("#cm-panel-resize-handle");
    const MIN_WIDTH = 320;
    const MAX_WIDTH = 800;
    const STORAGE_KEY2 = "cm_panel_width";
    const savedWidth = localStorage.getItem(STORAGE_KEY2);
    if (savedWidth) {
      const width = parseInt(savedWidth, 10);
      if (width >= MIN_WIDTH && width <= MAX_WIDTH) {
        panel.style.width = width + "px";
      }
    }
    let isResizing = false;
    let startX = 0;
    let startWidth = 0;
    handle.addEventListener("mousedown", (e) => {
      isResizing = true;
      startX = e.clientX;
      startWidth = panel.offsetWidth;
      document.body.style.cursor = "ew-resize";
      document.body.style.userSelect = "none";
      e.preventDefault();
    });
    document.addEventListener("mousemove", (e) => {
      if (!isResizing)
        return;
      const diff = startX - e.clientX;
      let newWidth = startWidth + diff;
      newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, newWidth));
      panel.style.width = newWidth + "px";
      if (panel.classList.contains("open") && window.innerWidth > 768) {
        document.body.style.marginRight = newWidth + "px";
      }
    });
    document.addEventListener("mouseup", () => {
      if (isResizing) {
        isResizing = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        localStorage.setItem(STORAGE_KEY2, panel.offsetWidth);
      }
    });
    handle.addEventListener("touchstart", (e) => {
      isResizing = true;
      startX = e.touches[0].clientX;
      startWidth = panel.offsetWidth;
      e.preventDefault();
    }, { passive: false });
    document.addEventListener("touchmove", (e) => {
      if (!isResizing)
        return;
      const diff = startX - e.touches[0].clientX;
      let newWidth = startWidth + diff;
      newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, newWidth));
      panel.style.width = newWidth + "px";
      if (panel.classList.contains("open") && window.innerWidth > 768) {
        document.body.style.marginRight = newWidth + "px";
      }
    }, { passive: false });
    document.addEventListener("touchend", () => {
      if (isResizing) {
        isResizing = false;
        localStorage.setItem(STORAGE_KEY2, panel.offsetWidth);
      }
    });
  }
  function injectNavbarButton(openAssistant) {
    if (document.getElementById("cm-navbar-ai-btn"))
      return true;
    const searchEntry = document.querySelector('[data-testid="search-bar-entry"]') || document.getElementById("search-bar-entry") || document.querySelector('[class*="search-bar-entry"]');
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
  function createNavbarButton(openAssistant) {
    if (!injectNavbarButton(openAssistant)) {
      setTimeout(() => injectNavbarButton(openAssistant), 500);
    }
    const observer = new MutationObserver(() => {
      if (!document.getElementById("cm-navbar-ai-btn")) {
        injectNavbarButton(openAssistant);
      }
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // assistant/highlight.js
  var PRISM_CSS_LIGHT = "https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism.min.css";
  var PRISM_CSS_DARK = "https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css";
  var PRISM_JS = "https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js";
  var PRISM_AUTOLOADER = "https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/plugins/autoloader/prism-autoloader.min.js";
  var prismLoaded = false;
  var cssLink = null;
  function isDarkMode() {
    return document.documentElement.classList.contains("dark") || document.body.classList.contains("dark");
  }
  function loadCSS(href, id) {
    const existing = document.getElementById(id);
    if (existing)
      existing.remove();
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
    return link;
  }
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
  async function loadPrism() {
    if (prismLoaded)
      return;
    const cssUrl = isDarkMode() ? PRISM_CSS_DARK : PRISM_CSS_LIGHT;
    cssLink = loadCSS(cssUrl, "prism-theme");
    await loadScript(PRISM_JS);
    await loadScript(PRISM_AUTOLOADER);
    if (window.Prism && window.Prism.plugins.autoloader) {
      window.Prism.plugins.autoloader.languages_path = "https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/";
    }
    prismLoaded = true;
    const observer = new MutationObserver(() => {
      const newCssUrl = isDarkMode() ? PRISM_CSS_DARK : PRISM_CSS_LIGHT;
      if (cssLink && cssLink.href !== newCssUrl) {
        cssLink.href = newCssUrl;
      }
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"]
    });
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["class"]
    });
  }
  function highlightCode(container) {
    if (!window.Prism)
      return;
    const codeBlocks = container.querySelectorAll("pre.cm-code-block");
    codeBlocks.forEach((pre) => {
      const lang = pre.dataset.lang || "plaintext";
      const code = pre.querySelector("code");
      if (code && !code.classList.contains("prism-highlighted")) {
        code.className = `language-${lang}`;
        pre.className = `cm-code-block language-${lang}`;
        window.Prism.highlightElement(code);
        code.classList.add("prism-highlighted");
      }
    });
  }

  // assistant/messages.js
  function parseMarkdown(text) {
    let html = text;
    const codeBlocks = [];
    html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (match, lang, code) => {
      const index = codeBlocks.length;
      codeBlocks.push({ lang, code: code.trim() });
      return `%%CODEBLOCK_${index}%%`;
    });
    html = html.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    html = html.replace(/`([^`]+)`/g, '<code class="cm-inline-code">$1</code>');
    html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "<em>$1</em>");
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    html = html.replace(/^### (.+)$/gm, '<h4 class="cm-header">$1</h4>');
    html = html.replace(/^## (.+)$/gm, '<h3 class="cm-header">$1</h3>');
    html = html.replace(/^# (.+)$/gm, '<h3 class="cm-header">$1</h3>');
    html = html.replace(/^(\d+)\.\s+(.+)$/gm, '<li class="cm-list-item cm-numbered">$2</li>');
    html = html.replace(/^[\-\*•]\s+(.+)$/gm, '<li class="cm-list-item">$1</li>');
    html = html.replace(/((?:<li class="cm-list-item cm-numbered">.*?<\/li>[\n\r]*)+)/g, '<ol class="cm-list">$1</ol>');
    html = html.replace(/((?:<li class="cm-list-item">.*?<\/li>[\n\r]*)+)/g, '<ul class="cm-list">$1</ul>');
    html = html.replace(/\n/g, "<br>");
    html = html.replace(/<\/(pre|ol|ul|h[1-4])><br>/g, "</$1>");
    html = html.replace(/<br><(pre|ol|ul|h[1-4])/g, "<$1");
    html = html.replace(/<br><li/g, "<li");
    html = html.replace(/<\/li><br>/g, "</li>");
    html = html.replace(/%%CODEBLOCK_(\d+)%%/g, (match, index) => {
      const block = codeBlocks[parseInt(index, 10)];
      const langAttr = block.lang ? ` data-lang="${block.lang}"` : "";
      const escapedCode = block.code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      return `<pre class="cm-code-block"${langAttr}><code>${escapedCode}</code></pre>`;
    });
    return html;
  }
  function addMessage(content, text, type, source = null, sources = []) {
    const welcome = content.querySelector(".cm-welcome");
    if (welcome)
      welcome.remove();
    const msg = document.createElement("div");
    msg.className = `cm-message ${type}`;
    if (type === "user") {
      const safeText = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      msg.innerHTML = `<div class="bubble">${safeText}</div>`;
    } else {
      const formattedText = parseMarkdown(text);
      msg.innerHTML = `<div class="content">${formattedText}</div>`;
      setTimeout(() => highlightCode(msg), 0);
    }
    content.appendChild(msg);
    content.scrollTop = content.scrollHeight;
  }
  function showThinking(content) {
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
  function hideThinking() {
    const thinking = document.getElementById("cm-thinking");
    if (thinking)
      thinking.remove();
  }

  // assistant/config.js
  var config = {
    // Backend API URL - update this after deploying your backend
    apiUrl: "http://localhost:3001/api/chat"
    // Production URL (uncomment and update after deployment)
    // apiUrl: 'https://your-backend.run.app/api/chat',
  };

  // assistant/events.js
  var STORAGE_KEY = "cm_chat_history";
  var UI_STORAGE_KEY = "cm_chat_ui";
  var PANEL_STATE_KEY = "cm_panel_open";
  var conversationHistory = [];
  function loadHistory() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      conversationHistory = saved ? JSON.parse(saved) : [];
    } catch (e) {
      conversationHistory = [];
    }
  }
  function saveHistory() {
    try {
      const toSave = conversationHistory.slice(-20);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch (e) {
      console.warn("Could not save chat history:", e);
    }
  }
  function saveUIMessages(messages) {
    try {
      const toSave = messages.slice(-20);
      localStorage.setItem(UI_STORAGE_KEY, JSON.stringify(toSave));
    } catch (e) {
      console.warn("Could not save UI messages:", e);
    }
  }
  function loadUIMessages() {
    try {
      const saved = localStorage.getItem(UI_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  }
  function clearHistory() {
    conversationHistory = [];
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(UI_STORAGE_KEY);
  }
  function setupEvents({ panel, trigger, overlay, input, sendBtn, content }) {
    const triggerInput = document.getElementById("cm-trigger-input");
    const triggerBtn = document.getElementById("cm-trigger-btn");
    const triggerShortcut = document.getElementById("cm-trigger-shortcut");
    let uiMessages = [];
    loadHistory();
    const savedUI = loadUIMessages();
    if (savedUI.length > 0) {
      uiMessages = savedUI;
      savedUI.forEach((msg) => {
        addMessage(content, msg.text, msg.type, null, msg.sources || []);
      });
    }
    const savedPanelState = localStorage.getItem(PANEL_STATE_KEY);
    if (savedPanelState === "open") {
      setTimeout(() => openAssistant("", true), 100);
    }
    const openAssistant = (initialMessage = "", skipSave = false) => {
      panel.classList.add("open");
      if (window.innerWidth > 768) {
        document.body.classList.add("cm-panel-open");
        document.body.style.marginRight = panel.offsetWidth + "px";
      } else {
        overlay.classList.add("active");
        setTimeout(() => overlay.classList.add("visible"), 10);
      }
      trigger.classList.add("hidden");
      if (!skipSave) {
        try {
          localStorage.setItem(PANEL_STATE_KEY, "open");
        } catch (e) {
        }
      }
      setTimeout(() => {
        if (initialMessage) {
          input.value = initialMessage;
          handleSend();
        } else {
          input.focus();
        }
      }, 100);
    };
    const closeAssistant = () => {
      panel.classList.remove("open");
      document.body.classList.remove("cm-panel-open");
      document.body.style.marginRight = "";
      overlay.classList.remove("visible");
      setTimeout(() => overlay.classList.remove("active"), 250);
      trigger.classList.remove("hidden", "expanded");
      if (triggerInput) {
        triggerInput.value = "";
        triggerInput.style.height = "auto";
      }
      if (triggerShortcut)
        triggerShortcut.style.display = "flex";
      try {
        localStorage.setItem(PANEL_STATE_KEY, "closed");
      } catch (e) {
      }
    };
    const handleSend = async () => {
      const question = input.value.trim();
      if (!question)
        return;
      addMessage(content, question, "user");
      uiMessages.push({ type: "user", text: question, sources: [] });
      saveUIMessages(uiMessages);
      input.value = "";
      input.style.height = "auto";
      sendBtn.disabled = true;
      showThinking(content);
      try {
        const response = await fetch(config.apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: question,
            history: conversationHistory
          })
        });
        const data = await response.json();
        hideThinking();
        if (data.error) {
          addMessage(content, "Sorry, something went wrong. Please try again.", "assistant");
          uiMessages.push({ type: "assistant", text: "Sorry, something went wrong. Please try again.", sources: [] });
        } else {
          addMessage(content, data.text, "assistant", data.source, data.sources || []);
          uiMessages.push({ type: "assistant", text: data.text, sources: data.sources || [] });
          conversationHistory.push(
            { role: "user", content: question },
            { role: "assistant", content: data.text }
          );
          saveHistory();
        }
        saveUIMessages(uiMessages);
      } catch (err) {
        hideThinking();
        addMessage(content, "Sorry, could not connect to the server.", "assistant");
        uiMessages.push({ type: "assistant", text: "Sorry, could not connect to the server.", sources: [] });
        saveUIMessages(uiMessages);
      }
      sendBtn.disabled = false;
    };
    overlay.addEventListener("click", closeAssistant);
    window.addEventListener("resize", () => {
      if (window.innerWidth <= 768) {
        document.body.classList.remove("cm-panel-open");
        if (panel.classList.contains("open")) {
          overlay.classList.add("active", "visible");
        }
      } else {
        overlay.classList.remove("active", "visible");
        if (panel.classList.contains("open")) {
          document.body.classList.add("cm-panel-open");
        } else {
          trigger.classList.remove("hidden");
        }
      }
    });
    const handleTriggerSubmit = () => {
      const question = triggerInput.value.trim();
      openAssistant(question);
      triggerInput.value = "";
    };
    triggerBtn.addEventListener("click", handleTriggerSubmit);
    triggerInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleTriggerSubmit();
      }
    });
    const resizeTriggerInput = () => {
      triggerInput.style.height = "auto";
      triggerInput.style.height = Math.min(triggerInput.scrollHeight, 120) + "px";
      if (triggerInput.value.trim()) {
        trigger.classList.add("expanded");
        if (triggerShortcut)
          triggerShortcut.style.display = "none";
      } else {
        trigger.classList.remove("expanded");
      }
    };
    triggerInput.addEventListener("input", resizeTriggerInput);
    const closeBtn = document.getElementById("cm-assistant-close");
    closeBtn.addEventListener("click", closeAssistant);
    const clearBtn = document.getElementById("cm-assistant-clear");
    clearBtn.addEventListener("click", () => {
      clearHistory();
      uiMessages = [];
      content.innerHTML = `
      <div class="cm-welcome">
        <div class="icon-wrapper"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 1L14.5 9.5L23 12L14.5 14.5L12 23L9.5 14.5L1 12L9.5 9.5L12 1Z"/></svg></div>
        <h4>How can I help?</h4>
        <p>Ask anything about CodeMachine.</p>
      </div>
    `;
    });
    const expandBtn = document.getElementById("cm-assistant-expand");
    const NORMAL_WIDTH = 400;
    const EXPANDED_WIDTH = 600;
    const EXPAND_STATE_KEY = "cm_panel_expanded";
    const savedExpandState = localStorage.getItem(EXPAND_STATE_KEY);
    if (savedExpandState === "expanded") {
      panel.style.width = EXPANDED_WIDTH + "px";
      expandBtn.classList.add("expanded");
      expandBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 14h6v6M14 4h6v6M10 14l-7 7M21 3l-7 7"/></svg>`;
      expandBtn.title = "Shrink panel";
    }
    expandBtn.addEventListener("click", () => {
      const isExpanded = expandBtn.classList.contains("expanded");
      if (isExpanded) {
        panel.style.width = NORMAL_WIDTH + "px";
        expandBtn.classList.remove("expanded");
        expandBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>`;
        expandBtn.title = "Expand panel";
        localStorage.setItem(EXPAND_STATE_KEY, "normal");
      } else {
        panel.style.width = EXPANDED_WIDTH + "px";
        expandBtn.classList.add("expanded");
        expandBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 14h6v6M14 4h6v6M10 14l-7 7M21 3l-7 7"/></svg>`;
        expandBtn.title = "Shrink panel";
        localStorage.setItem(EXPAND_STATE_KEY, "expanded");
      }
      if (panel.classList.contains("open") && window.innerWidth > 768) {
        document.body.style.marginRight = panel.offsetWidth + "px";
      }
      localStorage.setItem("cm_panel_width", panel.offsetWidth);
    });
    sendBtn.addEventListener("click", handleSend);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    });
    const resizePanelInput = () => {
      input.style.height = "auto";
      input.style.height = Math.min(input.scrollHeight, 120) + "px";
    };
    input.addEventListener("input", resizePanelInput);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && panel.classList.contains("open")) {
        closeAssistant();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "i") {
        e.preventDefault();
        if (panel.classList.contains("open")) {
          input.focus();
        } else {
          triggerInput.focus();
        }
      }
    });
    triggerInput.addEventListener("focus", () => {
      if (triggerShortcut)
        triggerShortcut.style.display = "none";
    });
    triggerInput.addEventListener("blur", () => {
      if (triggerShortcut && !triggerInput.value.trim()) {
        triggerShortcut.style.display = "flex";
      }
    });
    const clearChat = () => {
      clearHistory();
      uiMessages = [];
      content.innerHTML = `
      <div class="cm-welcome">
        <div class="icon-wrapper"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 1L14.5 9.5L23 12L14.5 14.5L12 23L9.5 14.5L1 12L9.5 9.5L12 1Z"/></svg></div>
        <h4>How can I help?</h4>
        <p>Ask anything about CodeMachine.</p>
      </div>
    `;
    };
    return { openAssistant, closeAssistant, clearHistory: clearChat };
  }

  // assistant/index.js
  (function init() {
    injectStyles();
    loadPrism();
    const overlay = createOverlay();
    const trigger = createTrigger();
    const panel = createPanel();
    const content = document.getElementById("cm-assistant-content");
    const input = document.getElementById("cm-assistant-input");
    const sendBtn = document.getElementById("cm-assistant-send");
    const { openAssistant } = setupEvents({
      panel,
      trigger,
      overlay,
      input,
      sendBtn,
      content
    });
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => setTimeout(() => createNavbarButton(openAssistant), 200));
    } else {
      setTimeout(() => createNavbarButton(openAssistant), 200);
    }
  })();
})();
