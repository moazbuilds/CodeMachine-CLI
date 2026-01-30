// CodeMachine AI Assistant - Event Handlers
import { addMessage, showThinking, hideThinking } from "./messages.js";
import { getResponse } from "./demo-data.js";

export function setupEvents({ panel, trigger, overlay, input, sendBtn, content }) {
  const triggerInput = document.getElementById("cm-trigger-input");
  const triggerBtn = document.getElementById("cm-trigger-btn");
  const triggerShortcut = document.getElementById("cm-trigger-shortcut");

  const openAssistant = (initialMessage = "") => {
    panel.classList.add("open");
    if (window.innerWidth > 768) {
      document.body.classList.add("cm-panel-open");
    } else {
      overlay.classList.add("active");
      setTimeout(() => overlay.classList.add("visible"), 10);
    }
    trigger.classList.add("hidden");

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
    overlay.classList.remove("visible");
    setTimeout(() => overlay.classList.remove("active"), 250);
    trigger.classList.remove("hidden", "expanded");
    if (triggerInput) {
      triggerInput.value = "";
      triggerInput.style.height = "auto";
    }
    if (triggerShortcut) triggerShortcut.style.display = "flex";
  };

  const handleSend = () => {
    const question = input.value.trim();
    if (!question) return;

    addMessage(content, question, "user");
    input.value = "";
    sendBtn.disabled = true;
    showThinking(content);

    setTimeout(() => {
      hideThinking();
      const response = getResponse(question);
      addMessage(content, response.text, "assistant", response.source);
      sendBtn.disabled = false;
    }, 800);
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

  // Suggestion buttons
  document.querySelectorAll(".cm-suggestion").forEach((btn) => {
    btn.addEventListener("click", () => {
      input.value = btn.textContent.trim();
      handleSend();
    });
  });

  // Send button and enter key
  sendBtn.addEventListener("click", handleSend);
  input.addEventListener("keypress", (e) => {
    if (e.key === "Enter") handleSend();
  });

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

  return { openAssistant, closeAssistant };
}
