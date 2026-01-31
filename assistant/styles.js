// CodeMachine AI Assistant - Styles
export const styles = `
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
    --cm-accent: #32bde3;
    --cm-accent-bg: rgba(50, 189, 227, 0.08);
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
    margin-right: 400px;
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
    border-color: var(--cm-accent);
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
    border-bottom: 1px solid var(--cm-border);
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
  #cm-assistant-header .subtitle {
    font-size: 12px;
    color: var(--cm-text-tertiary);
    font-family: Inter, -apple-system, BlinkMacSystemFont, sans-serif;
    word-break: normal;
    overflow-wrap: normal;
    white-space: nowrap;
  }
  #cm-assistant-close {
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
  #cm-assistant-close:hover {
    background: var(--cm-bg-secondary);
    color: var(--cm-text-primary);
  }
  #cm-assistant-close svg {
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
    display: flex;
    gap: 10px;
    align-items: flex-start;
  }
  .cm-message.assistant .avatar {
    width: 28px;
    height: 28px;
    border-radius: 8px;
    background: var(--cm-accent-bg);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .cm-message.assistant .avatar svg {
    width: 14px;
    height: 14px;
    color: var(--cm-accent);
  }
  .cm-message.assistant .content {
    flex: 1;
    min-width: 100px;
  }
  .cm-message.assistant .bubble {
    background: var(--cm-bg-secondary);
    border: 1px solid var(--cm-border-light);
    color: var(--cm-text-primary);
    padding: 10px 14px;
    border-radius: 4px 12px 12px 12px;
    font-size: 13px;
    line-height: 1.6;
    font-family: Inter, -apple-system, BlinkMacSystemFont, sans-serif;
    text-wrap: pretty;
    word-break: normal;
    overflow-wrap: normal;
  }
  .cm-message.assistant .source {
    margin-top: 8px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    background: var(--cm-bg-secondary);
    border: 1px solid var(--cm-border);
    border-radius: 6px;
    font-size: 12px;
    color: var(--cm-text-secondary);
    text-decoration: none;
    transition: all 0.15s ease;
    font-family: Inter, -apple-system, BlinkMacSystemFont, sans-serif;
  }
  .cm-message.assistant .source:hover {
    border-color: var(--cm-accent);
    color: var(--cm-accent);
  }
  .cm-message.assistant .source svg {
    width: 12px;
    height: 12px;
  }

  /* Markdown content styles */
  .cm-message.assistant .bubble .cm-code-block {
    background: var(--cm-bg-tertiary);
    border: 1px solid var(--cm-border);
    border-radius: 6px;
    padding: 10px 12px;
    margin: 8px 0;
    overflow-x: auto;
    font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
    font-size: 12px;
    line-height: 1.5;
  }
  .cm-message.assistant .bubble .cm-code-block code {
    background: none;
    padding: 0;
    color: var(--cm-text-primary);
  }
  .cm-message.assistant .bubble .cm-inline-code {
    background: var(--cm-bg-tertiary);
    border: 1px solid var(--cm-border-light);
    border-radius: 4px;
    padding: 1px 5px;
    font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
    font-size: 12px;
    color: var(--cm-accent);
  }
  .cm-message.assistant .bubble .cm-list {
    margin: 8px 0;
    padding-left: 20px;
  }
  .cm-message.assistant .bubble .cm-list-item {
    margin: 4px 0;
    line-height: 1.5;
  }
  .cm-message.assistant .bubble .cm-header {
    margin: 12px 0 6px;
    font-weight: 600;
    color: var(--cm-text-primary);
  }
  .cm-message.assistant .bubble h3.cm-header {
    font-size: 14px;
  }
  .cm-message.assistant .bubble h4.cm-header {
    font-size: 13px;
  }
  .cm-message.assistant .bubble a {
    color: var(--cm-accent);
    text-decoration: none;
  }
  .cm-message.assistant .bubble a:hover {
    text-decoration: underline;
  }
  .cm-message.assistant .bubble .cm-ref-link {
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
  .cm-message.assistant .bubble .cm-ref-link:hover {
    background: var(--cm-accent);
    color: white;
    text-decoration: none;
  }
  .cm-message.assistant .bubble strong {
    font-weight: 600;
    color: var(--cm-text-primary);
  }
  .cm-message.assistant .bubble em {
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
    border-top: 1px solid var(--cm-border);
    flex-shrink: 0;
  }
  #cm-assistant-input-wrapper {
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--cm-bg-secondary);
    border: 1px solid var(--cm-border);
    border-radius: 10px;
    padding: 4px 4px 4px 14px;
    transition: all 0.15s ease;
  }
  #cm-assistant-input-wrapper:focus-within {
    border-color: var(--cm-accent);
  }
  #cm-assistant-input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    font-size: 13px;
    color: var(--cm-text-primary);
    padding: 8px 0;
    font-family: Inter, -apple-system, BlinkMacSystemFont, sans-serif;
  }
  #cm-assistant-input::placeholder {
    color: var(--cm-text-tertiary);
  }
  #cm-assistant-send {
    width: 32px;
    height: 32px;
    background: var(--cm-text-primary);
    border: none;
    border-radius: 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
    flex-shrink: 0;
  }
  #cm-assistant-send:hover {
    opacity: 0.85;
  }
  #cm-assistant-send:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  #cm-assistant-send svg {
    width: 14px;
    height: 14px;
    color: var(--cm-bg-primary);
  }

  /* Footer */
  #cm-assistant-footer {
    padding: 0 16px 12px;
    text-align: center;
    flex-shrink: 0;
  }
  #cm-assistant-footer span {
    font-size: 11px;
    color: var(--cm-text-tertiary);
    font-family: Inter, -apple-system, BlinkMacSystemFont, sans-serif;
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

export function injectStyles() {
  const styleEl = document.createElement("style");
  styleEl.textContent = styles;
  document.head.appendChild(styleEl);
}
