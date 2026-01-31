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
      width: 100vw !important;
      max-width: 100vw !important;
      min-width: 100vw !important;
      left: 0 !important;
      right: 0 !important;
      bottom: 0;
      top: auto;
      height: 100dvh;
      box-shadow: none;
      box-sizing: border-box;
      transition: transform 0.25s ease, height 0.15s ease;
    }
    #cm-assistant-panel.open {
      transform: translateX(0);
    }
    #cm-panel-resize-handle {
      display: none;
    }
    #cm-assistant-expand {
      display: none !important;
    }
    #cm-assistant-header {
      padding: 12px;
    }
    #cm-assistant-content {
      padding: 12px;
    }
    #cm-assistant-input-area {
      padding: 12px 12px 16px;
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
    padding: 12px 16px;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    flex-shrink: 0;
  }

  /* Ali Frame - TUI narrator style */
  #cm-ali-frame {
    font-family: 'Courier New', Consolas, 'Liberation Mono', monospace;
    font-size: 13px;
    line-height: 1.4;
    display: flex;
    flex-direction: row;
    flex: 1;
    min-width: 0;
    overflow: visible;
    position: relative;
  }
  #cm-ali-frame .ali-border-svg {
    position: absolute;
    left: 0;
    top: 0;
    width: 20px;
    height: 100%;
    color: var(--cm-border);
  }
  #cm-ali-frame .ali-frame-content {
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 8px 0 8px 22px;
    flex: 1;
    min-width: 0;
    overflow: hidden;
  }
  #cm-ali-frame .ali-frame-row {
    display: flex;
    align-items: center;
    overflow: hidden;
    margin: 3px 0;
  }
  #cm-ali-frame .ali-face {
    color: var(--cm-text-primary);
    flex-shrink: 0;
  }
  #cm-ali-frame .ali-spacer {
    display: inline-block;
    width: 12px;
    flex-shrink: 0;
  }
  #cm-ali-frame .ali-name {
    color: var(--cm-text-primary);
    font-weight: 600;
    flex-shrink: 0;
  }
  #cm-ali-frame .ali-arrow {
    color: var(--cm-text-tertiary);
    flex-shrink: 0;
    margin-right: 6px;
  }
  #cm-ali-frame .ali-text {
    color: #a855f7;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    letter-spacing: 0.3px;
  }
  .dark #cm-ali-frame .ali-text,
  html.dark #cm-ali-frame .ali-text {
    color: var(--cm-accent);
  }
  #cm-ali-frame .ali-cursor {
    color: var(--cm-accent);
    font-weight: 600;
    flex-shrink: 0;
  }
  @keyframes blink {
    0%, 50% { opacity: 1; }
    51%, 100% { opacity: 0; }
  }
  .header-actions {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
    margin-left: 8px;
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
  #cm-assistant-content > * {
    flex-shrink: 0;
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
  /* Tables */
  .cm-message.assistant .content .cm-table {
    width: 100%;
    border-collapse: collapse;
    margin: 12px 0;
    font-size: 12px;
    border: 1px solid var(--cm-border);
    border-radius: 6px;
    overflow: hidden;
  }
  .cm-message.assistant .content .cm-table th,
  .cm-message.assistant .content .cm-table td {
    padding: 8px 12px;
    text-align: left;
    border-bottom: 1px solid var(--cm-border-light);
  }
  .cm-message.assistant .content .cm-table th {
    background: var(--cm-bg-tertiary);
    font-weight: 600;
    color: var(--cm-text-primary);
  }
  .cm-message.assistant .content .cm-table tr:last-child td {
    border-bottom: none;
  }
  .cm-message.assistant .content .cm-table tr:hover td {
    background: var(--cm-bg-secondary);
  }
  /* Blockquotes */
  .cm-message.assistant .content .cm-blockquote {
    border-left: 3px solid var(--cm-accent);
    padding: 8px 12px;
    margin: 8px 0;
    background: var(--cm-bg-secondary);
    color: var(--cm-text-secondary);
    border-radius: 0 6px 6px 0;
    font-style: italic;
  }
  /* Horizontal rule */
  .cm-message.assistant .content .cm-hr {
    border: none;
    border-top: 1px solid var(--cm-border);
    margin: 16px 0;
  }
  /* Header levels */
  .cm-message.assistant .content h5.cm-header.cm-h4 {
    font-size: 12px;
  }

  /* Thinking indicator */
  .cm-thinking {
    display: flex;
    gap: 10px;
    align-items: center;
    animation: fadeIn 0.2s ease;
    padding: 8px 0;
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

  /* Streaming cursor */
  .cm-message.streaming .cm-cursor {
    animation: blink 0.7s step-end infinite;
    color: var(--cm-accent);
    font-weight: normal;
  }
  .cm-message.streaming {
    position: relative;
    z-index: 0;
  }

  /* Tool usage indicator */
  .cm-tool-usage {
    animation: fadeIn 0.2s ease;
    margin: 8px 0 12px 0;
    background: var(--cm-bg-secondary);
    border: 1px solid var(--cm-border-light);
    border-radius: 10px;
    overflow: hidden;
    font-family: Inter, -apple-system, BlinkMacSystemFont, sans-serif;
    position: relative;
    z-index: 1;
    flex-shrink: 0;
  }
  .cm-tool-usage.completed {
    opacity: 0.8;
  }
  .cm-tool-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    cursor: pointer;
    transition: background 0.15s ease;
  }
  .cm-tool-header:hover {
    background: var(--cm-bg-tertiary);
  }
  .cm-tool-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    flex-shrink: 0;
  }
  .cm-tool-icon svg {
    width: 14px;
    height: 14px;
    color: var(--cm-accent);
    animation: pulse 1.5s ease-in-out infinite;
  }
  .cm-tool-usage.completed .cm-tool-icon svg {
    animation: none;
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
  .cm-tool-message {
    flex: 1;
    font-size: 12px;
    color: var(--cm-text-secondary);
  }
  .cm-tool-chevron {
    width: 14px;
    height: 14px;
    color: var(--cm-text-tertiary);
    transition: transform 0.2s ease;
    flex-shrink: 0;
  }
  .cm-tool-usage.expanded .cm-tool-chevron {
    transform: rotate(180deg);
  }
  .cm-tool-details {
    display: none;
    padding: 0 12px 12px;
    border-top: 1px solid var(--cm-border-light);
  }
  .cm-tool-usage.expanded .cm-tool-details {
    display: block;
  }
  .cm-tool-queries {
    padding: 8px 0;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .cm-tool-query {
    font-size: 11px;
    color: var(--cm-text-tertiary);
    background: var(--cm-bg-tertiary);
    padding: 4px 8px;
    border-radius: 4px;
  }
  .cm-tool-pages {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding-top: 4px;
  }
  .cm-tool-page {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    background: var(--cm-bg-primary);
    border: 1px solid var(--cm-border-light);
    border-radius: 6px;
    font-size: 12px;
    color: var(--cm-text-primary);
    text-decoration: none;
    transition: all 0.15s ease;
  }
  .cm-tool-page:hover {
    border-color: var(--cm-accent);
    background: var(--cm-accent-bg);
  }
  .cm-tool-page svg {
    width: 14px;
    height: 14px;
    color: var(--cm-text-tertiary);
    flex-shrink: 0;
  }
  .cm-tool-page span {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .cm-tool-no-results {
    font-size: 11px;
    color: var(--cm-text-tertiary);
    padding: 8px 0;
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
  #cm-navbar-ai-btn .nav-ali-face {
    font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
    font-size: 12px;
    letter-spacing: -0.5px;
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
