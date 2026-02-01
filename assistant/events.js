// CodeMachine AI Assistant - Event Handlers
import {
  addMessage,
  showThinking,
  hideThinking,
  showToolUsage,
  updateToolResults,
  completeToolUsage,
  startStreamingMessage,
  appendStreamingText,
  completeStreamingMessage,
  flushStreamingText,
  getStreamingContent,
  resetStreamingState
} from "./messages.js";
import { setAliFace } from "./components.js";
import { config } from "./config.js";

// Chat memory using localStorage
const STORAGE_KEY = 'cm_chat_history';
const UI_STORAGE_KEY = 'cm_chat_ui';
const PANEL_STATE_KEY = 'cm_panel_open';
let conversationHistory = [];

// Load history from localStorage
function loadHistory() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    conversationHistory = saved ? JSON.parse(saved) : [];
  } catch (e) {
    conversationHistory = [];
  }
}

// Save history to localStorage
function saveHistory() {
  try {
    // Keep last 20 messages to avoid storage limits
    const toSave = conversationHistory.slice(-20);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch (e) {
    console.warn('Could not save chat history:', e);
  }
}

// Save UI messages for restoration
function saveUIMessages(messages) {
  try {
    const toSave = messages.slice(-20);
    localStorage.setItem(UI_STORAGE_KEY, JSON.stringify(toSave));
  } catch (e) {
    console.warn('Could not save UI messages:', e);
  }
}

// Load UI messages
function loadUIMessages() {
  try {
    const saved = localStorage.getItem(UI_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch (e) {
    return [];
  }
}

// Clear chat history
function clearHistory() {
  conversationHistory = [];
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(UI_STORAGE_KEY);
}

export function setupEvents({ panel, trigger, overlay, input, sendBtn, content }) {
  const triggerInput = document.getElementById("cm-trigger-input");
  const triggerBtn = document.getElementById("cm-trigger-btn");
  const triggerShortcut = document.getElementById("cm-trigger-shortcut");

  // Track UI messages for persistence
  let uiMessages = [];

  // Load conversation history on init
  loadHistory();

  // Restore UI messages on init
  const savedUI = loadUIMessages();
  if (savedUI.length > 0) {
    uiMessages = savedUI;
    // Re-render saved messages
    savedUI.forEach(msg => {
      addMessage(content, msg.text, msg.type, null, msg.sources || []);
    });
  }

  // Restore panel state on init (only on desktop, not mobile)
  const savedPanelState = localStorage.getItem(PANEL_STATE_KEY);
  if (savedPanelState === 'open' && window.innerWidth > 768) {
    // Delay to let DOM settle
    setTimeout(() => openAssistant('', true), 100);
  }

  const openAssistant = (initialMessage = "", skipSave = false) => {
    panel.classList.add("open");
    if (window.innerWidth > 768) {
      document.body.classList.add("cm-panel-open");
      // Use actual panel width for body margin
      document.body.style.marginRight = panel.offsetWidth + 'px';
    } else {
      overlay.classList.add("active");
      setTimeout(() => overlay.classList.add("visible"), 10);
      // Disable body scroll on mobile
      document.body.style.overflow = 'hidden';
    }
    trigger.classList.add("hidden");

    // Save panel state
    if (!skipSave) {
      try { localStorage.setItem(PANEL_STATE_KEY, 'open'); } catch (e) {}
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
    document.body.style.marginRight = '';
    document.body.style.overflow = '';
    overlay.classList.remove("visible");
    setTimeout(() => overlay.classList.remove("active"), 250);
    trigger.classList.remove("hidden", "expanded");
    if (triggerInput) {
      triggerInput.value = "";
      triggerInput.style.height = "auto";
    }
    if (triggerShortcut) triggerShortcut.style.display = "flex";

    // Save panel state
    try { localStorage.setItem(PANEL_STATE_KEY, 'closed'); } catch (e) {}
  };

  const handleSend = async () => {
    const question = input.value.trim();
    if (!question) return;

    // Reset any previous streaming state before new message
    resetStreamingState(content);

    addMessage(content, question, "user");
    // Track user message for UI persistence
    uiMessages.push({ type: 'user', text: question, sources: [] });
    saveUIMessages(uiMessages);

    input.value = "";
    input.style.height = "auto";
    sendBtn.disabled = true;
    setAliFace('thinking');
    showThinking(content);

    try {
      // Use streaming endpoint
      const response = await fetch(config.streamUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: question,
          history: conversationHistory
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      // Process SSE stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let hasStartedStreaming = false;
      let finalText = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE events
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        let eventType = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7);
          } else if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              // Handle different event types
              switch (eventType) {
                case 'status':
                  // Status updates (thinking, generating, etc.)
                  if (data.type === 'thinking') {
                    setAliFace('thinking');
                  } else if (data.type === 'generating') {
                    setAliFace('tool');
                  }
                  break;

                case 'tool_start':
                  // Tool started - show collapsed indicator
                  hideThinking();
                  setAliFace('tool');
                  showToolUsage(content, data.tool, data.message);
                  break;

                case 'tool_progress':
                  // Tool progress - update with queries
                  showToolUsage(content, data.tool, data.message, data.queries || []);
                  break;

                case 'tool_complete':
                  // Tool complete - show results
                  completeToolUsage(data.message);
                  updateToolResults(data.results || []);
                  break;

                case 'text':
                  // Text chunk - append to streaming message
                  if (!hasStartedStreaming) {
                    hasStartedStreaming = true;
                    hideThinking();
                    startStreamingMessage(content);
                    setAliFace('cool');
                  }
                  appendStreamingText(content, data.content);
                  break;

                case 'done':
                  // Stream complete - will be handled after loop
                  break;

                case 'error':
                  // Error occurred
                  flushStreamingText();
                  throw new Error(data.message);
              }
            } catch (parseErr) {
              // Ignore JSON parse errors for incomplete data
              if (parseErr.message !== 'Unexpected end of JSON input') {
                console.warn('SSE parse error:', parseErr);
              }
            }
          }
        }
      }

      // Wait for typewriter to finish and get final text
      if (hasStartedStreaming) {
        finalText = await completeStreamingMessage(content);
      }

      // Get final text from streaming content if not set
      if (!finalText) {
        finalText = getStreamingContent();
      }

      // Track assistant message for UI persistence
      uiMessages.push({ type: 'assistant', text: finalText, sources: [] });

      // Save to conversation history
      conversationHistory.push(
        { role: 'user', content: question },
        { role: 'assistant', content: finalText }
      );
      saveHistory();
      saveUIMessages(uiMessages);

      // Reset face after a delay
      setTimeout(() => setAliFace('idle'), 2000);

    } catch (err) {
      // Flush any pending streaming text
      flushStreamingText();
      hideThinking();
      setAliFace('error');
      const errorMsg = err.message || 'Sorry, could not connect to the server.';
      addMessage(content, errorMsg, "assistant");
      uiMessages.push({ type: 'assistant', text: errorMsg, sources: [] });
      saveUIMessages(uiMessages);
      // Reset face after a delay
      setTimeout(() => setAliFace('idle'), 2000);
    }

    sendBtn.disabled = false;
  };

  // Close on overlay click (mobile)
  overlay.addEventListener("click", closeAssistant);

  // Handle resize
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

  // Handle mobile keyboard viewport resize
  if (window.visualViewport) {
    const updateViewportHeight = () => {
      if (window.innerWidth <= 768) {
        const vh = window.visualViewport.height;
        panel.style.height = vh + 'px';
      } else {
        panel.style.height = '';
      }
    };

    window.visualViewport.addEventListener('resize', updateViewportHeight);
    window.visualViewport.addEventListener('scroll', updateViewportHeight);
  }

  // Trigger input and button
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

  // Auto-resize and expand trigger when typing
  const resizeTriggerInput = () => {
    triggerInput.style.height = "auto";
    triggerInput.style.height = Math.min(triggerInput.scrollHeight, 120) + "px";

    if (triggerInput.value.trim()) {
      trigger.classList.add("expanded");
      if (triggerShortcut) triggerShortcut.style.display = "none";
    } else {
      trigger.classList.remove("expanded");
    }
  };

  triggerInput.addEventListener("input", resizeTriggerInput);

  // Close button
  const closeBtn = document.getElementById("cm-assistant-close");
  closeBtn.addEventListener("click", closeAssistant);

  // Clear chat button
  const clearBtn = document.getElementById("cm-assistant-clear");
  clearBtn.addEventListener("click", () => {
    clearHistory();
    uiMessages = [];
    setAliFace('idle');
    // Reset content to welcome state
    content.innerHTML = `
      <div class="cm-welcome">
                <h4>How can I help?</h4>
        <p>Ask anything about CodeMachine.</p>
      </div>
    `;
  });

  // Expand/shrink button
  const expandBtn = document.getElementById("cm-assistant-expand");
  const NORMAL_WIDTH = 400;
  const EXPANDED_WIDTH = 600;
  const EXPAND_STATE_KEY = 'cm_panel_expanded';

  // Restore expand state
  const savedExpandState = localStorage.getItem(EXPAND_STATE_KEY);
  if (savedExpandState === 'expanded') {
    panel.style.width = EXPANDED_WIDTH + 'px';
    expandBtn.classList.add('expanded');
    expandBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 14h6v6M14 4h6v6M10 14l-7 7M21 3l-7 7"/></svg>`;
    expandBtn.title = 'Shrink panel';
  }

  expandBtn.addEventListener("click", () => {
    const isExpanded = expandBtn.classList.contains('expanded');

    if (isExpanded) {
      // Shrink
      panel.style.width = NORMAL_WIDTH + 'px';
      expandBtn.classList.remove('expanded');
      expandBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>`;
      expandBtn.title = 'Expand panel';
      localStorage.setItem(EXPAND_STATE_KEY, 'normal');
    } else {
      // Expand
      panel.style.width = EXPANDED_WIDTH + 'px';
      expandBtn.classList.add('expanded');
      expandBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 14h6v6M14 4h6v6M10 14l-7 7M21 3l-7 7"/></svg>`;
      expandBtn.title = 'Shrink panel';
      localStorage.setItem(EXPAND_STATE_KEY, 'expanded');
    }

    // Update body margin if panel is open
    if (panel.classList.contains('open') && window.innerWidth > 768) {
      document.body.style.marginRight = panel.offsetWidth + 'px';
    }

    // Also save to panel width storage
    localStorage.setItem('cm_panel_width', panel.offsetWidth);
  });

  // Send button and enter key
  sendBtn.addEventListener("click", handleSend);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  // Auto-resize panel input
  const resizePanelInput = () => {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 120) + "px";
  };
  input.addEventListener("input", resizePanelInput);

  // Escape key and Ctrl/Cmd + I shortcut
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && panel.classList.contains("open")) {
      closeAssistant();
    }
    // Ctrl+I or Cmd+I to open assistant
    if ((e.ctrlKey || e.metaKey) && e.key === "i") {
      e.preventDefault();
      if (panel.classList.contains("open")) {
        input.focus();
      } else {
        triggerInput.focus();
      }
    }
  });

  // Show/hide shortcut hint on focus
  triggerInput.addEventListener("focus", () => {
    if (triggerShortcut) triggerShortcut.style.display = "none";
  });
  triggerInput.addEventListener("blur", () => {
    if (triggerShortcut && !triggerInput.value.trim()) {
      triggerShortcut.style.display = "flex";
    }
  });

  // Clear chat and reset UI
  const clearChat = () => {
    clearHistory();
    uiMessages = [];
    setAliFace('idle');
    // Reset content to welcome state
    content.innerHTML = `
      <div class="cm-welcome">
                <h4>How can I help?</h4>
        <p>Ask anything about CodeMachine.</p>
      </div>
    `;
  };

  // Handle internal link clicks with client-side navigation
  content.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (!link) return;

    const href = link.getAttribute('href');
    if (!href || href.startsWith('mailto:') || href.startsWith('tel:')) return;

    // Parse the URL to check if it's internal
    let url;
    try {
      url = new URL(href, window.location.origin);
    } catch {
      return; // Invalid URL, let browser handle it
    }

    // Check if it's an internal link (same hostname)
    const isInternal = url.hostname === window.location.hostname;

    if (isInternal) {
      e.preventDefault();
      e.stopPropagation();

      const path = url.pathname + url.search + url.hash;

      // Find and click matching link in the page navigation (Mintlify sidebar)
      const navLink = document.querySelector(`a[href="${path}"], a[href="${href}"]`);
      if (navLink && navLink !== link) {
        navLink.click();
        return;
      }

      // Try Next.js router methods
      if (window.__NEXT_ROUTER_READY__ || window.next?.router) {
        const router = window.next?.router || window.__NEXT_ROUTER__;
        if (router && router.push) {
          router.push(path);
          return;
        }
      }

      // Use History API and dispatch popstate (works with most SPA routers)
      history.pushState({}, '', path);
      window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));

      // Dispatch custom navigation event for frameworks that listen for it
      window.dispatchEvent(new CustomEvent('cm-navigate', {
        detail: { url: url.href, pathname: url.pathname }
      }));
    }
  });

  return { openAssistant, closeAssistant, clearHistory: clearChat };
}
