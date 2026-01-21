## Step Completion

When you have completed this step:

**1. Show Summary**

Present a clear summary of what was decided or created in this step:
- Key decisions made
- Files created (if any)
- Configuration values collected

**2. Confirm with User**

"Here's what we've established in this step:

[Show summary]

- If you want to **modify or add details**, tell me what you'd like to change
- If you're satisfied, **press Enter to proceed to the next step**"

**3. IMMEDIATELY Append to Plan File**

**CRITICAL: Do this BEFORE waiting for user to proceed!**

When user confirms (says yes, looks good, confirms, or similar):

1. **Append the step's XML data** to `.codemachine/workflow-plans/\{workflow_name\}-plan.md`
2. **Update TodoWrite** to mark current step completed and next step in_progress
3. **Confirm to user**: "✓ Saved to workflow plan"

**Plan File Operations:**

- **Step 1**: Cannot append yet (no workflow_name). Store in memory temporarily.
- **Step 2**: CREATE the plan file, then append step-01 and step-02 data
- **Steps 3-8**: APPEND to existing plan file

**Append Pattern:**

```
# Read current plan file
# Find closing </workflow-plan> tag
# Insert new step XML before it
# Write updated file
```

**4. Update Todo List**

Use TodoWrite to update progress:

```javascript
// Mark current step completed, next step in_progress
TodoWrite([
  { content: "Step 01: Mode Selection", status: "completed", activeForm: "..." },
  { content: "Step 02: Workflow Definition", status: "completed", activeForm: "..." },
  { content: "Step 03: Main Agents", status: "in_progress", activeForm: "Defining main agents" },
  // ... remaining steps as pending
])
```

**5. Wait for User**

After saving, tell user:

"✓ Progress saved to workflow plan.

Press **Enter** to proceed to the next step."

Do not proceed until user presses Enter. The next step's prompt will be automatically injected into your context.

---

## CRITICAL: No Context Gathering at Start

**Your FIRST action in each step must be engaging the user - NOT using tools to gather context.**

**FORBIDDEN at step start:**
- Using Read, Glob, Grep, or any search tools
- "Let me first check..." or "Let me look at..."
- Fetching files, documents, or codebase context

**REQUIRED behavior:**
- All context you need is already in this prompt (or previous conversation)
- If context is missing, **ASK the user** to provide it
- Start by engaging with the user based on current step's goal

**Exception:** Step 02 (Workflow Definition) includes sanity checks that require reading config files. This is the ONLY step where initial file reads are permitted.

---

## Step-Specific XML Templates

Each step has its own XML structure to append. See the step file for the exact XML template to use.

**General format:**

```xml
<step-0X completed="true" timestamp="\{ISO timestamp\}">
  <!-- Step-specific data -->
</step-0X>
```

**Important:**
- Always include `completed="true"` and `timestamp`
- Use actual values, not placeholders
- Escape XML special characters in user content (&, <, >, ", ')
