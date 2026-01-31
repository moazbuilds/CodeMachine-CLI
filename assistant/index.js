// CodeMachine AI Assistant - Main Entry
import { injectStyles } from "./styles.js";
import { createOverlay, createTrigger, createPanel, createNavbarButton } from "./components.js";
import { setupEvents } from "./events.js";
import { loadPrism } from "./highlight.js";

(function init() {
  // Inject styles
  injectStyles();

  // Load syntax highlighting
  loadPrism();

  // Create DOM elements
  const overlay = createOverlay();
  const trigger = createTrigger();
  const panel = createPanel();

  // Get element references
  const content = document.getElementById("cm-assistant-content");
  const input = document.getElementById("cm-assistant-input");
  const sendBtn = document.getElementById("cm-assistant-send");

  // Setup event handlers
  const { openAssistant } = setupEvents({
    panel,
    trigger,
    overlay,
    input,
    sendBtn,
    content
  });

  // Add navbar button
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => setTimeout(() => createNavbarButton(openAssistant), 200));
  } else {
    setTimeout(() => createNavbarButton(openAssistant), 200);
  }
})();
