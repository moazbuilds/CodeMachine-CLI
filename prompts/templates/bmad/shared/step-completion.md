### Step Completion

**Show Draft:**
Present the generated content to the user for review.

**Confirmation:**
"Here's what I'll append to the document:

[Show the complete markdown content]

- If you want to **modify or add details**, tell me what you'd like to change
- If you're satisfied, **press Enter to confirm** - your content will be saved at the start of the next step"

**CRITICAL - After user confirms or agrees to skip, you MUST call the MCP tool:**

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
