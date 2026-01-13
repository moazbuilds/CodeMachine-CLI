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

**3. Wait for User**

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
