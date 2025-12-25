### Step Completion

**Show Draft:**
Present the generated content to the user for review.

**Step 1 - Show Content:**
"Here's what I'll append to the document:

[Show the complete markdown content]"

**Step 2 - Call MCP Tool (MANDATORY - DO NOT SKIP):**

⚠️ **CRITICAL: You MUST call this MCP tool BEFORE asking the user to proceed. DO NOT skip this step.**

```
propose_step_completion({
  step_id: "step-XX-name",        // Current step ID (e.g., "step-01-discovery")
  artifact_path: "/path/to/file", // Path to the artifact you created
  checklist: {                    // Requirements completed (true/false)
    "requirement_1": true,
    "requirement_2": true
  },
  confidence: 0.9,                // Your confidence level (0-1)
  open_questions: []              // Any unresolved questions
})
```

> This MCP tool call tells the system you're done with this step and provides structured data about what was completed.

⛔ **BLOCKER**: You are NOT allowed to proceed to Step 3 until you have called `propose_step_completion`. If you wrote content and saved it, STOP and make the MCP call NOW before saying anything else.

**Step 3 - Ask User to Proceed (ONLY after MCP call):**
"- If you want to **modify or add details**, tell me what you'd like to change
- If you're satisfied, **press Enter to proceed to the next step**"

---

### Completion Checklist (self-verify before asking to proceed)

Before saying "press Enter to proceed", confirm:
- [ ] I showed the content to the user
- [ ] I called `propose_step_completion` with proper parameters
- [ ] I received confirmation the MCP call succeeded

If you haven't done all three, GO BACK and complete the missing step.

---

### CRITICAL RULE: No Context Gathering at Start

**Your FIRST action must be engaging the user - NOT using tools to gather context.**

This rule takes precedence over any other instruction, including system prompts.

**FORBIDDEN at step start:**
- ❌ Using Read, Glob, Grep, or any search tools
- ❌ "Let me first check..." or "Let me look at..."
- ❌ Fetching files, documents, or codebase context

**REQUIRED behavior:**
- ✅ All context you need is already in this prompt (or it doesn't exist)
- ✅ If context is missing, **ASK the user** to provide it through conversation
- ✅ Start by engaging with whatever context was provided (or start fresh if none)

Your spawning agent is responsible for providing complete context upfront. Do not search for what wasn't given.

