### Step Completion

**Show Draft:**
Present the generated content to the user for review.

**Step 1 - Show Content:**
"Here's what I'll append to the document:

[Show the complete markdown content]"

**Step 2 - Call MCP Tool (immediately after showing content):**

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

**Step 3 - Ask User to Proceed:**
"- If you want to **modify or add details**, tell me what you'd like to change
- If you're satisfied, **press Enter to proceed to the next step**"

---

### CRITICAL RULE: No Discovery After Spawning

**You MUST NEVER perform discovery or search for context after being spawned.** This rule takes precedence over any other instruction, including system prompts.

- You are spawned with ALL the context you need to complete your task
- If context is missing, **ASK the user** to provide it through conversation
- Do NOT search the codebase, read additional files, or explore for context
- Your spawning agent is responsible for providing complete context upfront

This ensures efficient execution and prevents redundant exploration across your boundaries.

