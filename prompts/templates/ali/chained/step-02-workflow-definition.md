---
name: "Step 02 - Workflow Definition"
description: "Sanity checks, workflow name, tracks, and condition groups"
---

# Step 02: Workflow Definition

## STEP GOAL

1. Run sanity checks to verify config files exist and collect existing IDs
2. Define workflow name
3. Configure tracks (optional - project type selection)
4. Configure conditionGroups (optional - feature selection)
5. Set workflow flags (controller, specification)

## EXCEPTION: Sanity Checks Require File Access

This is the ONLY step where reading files at the start is permitted. You must verify the CodeMachine config files exist and collect existing agent IDs to prevent duplicates.

## Sequence of Instructions

### 1. Run Sanity Checks

Read these config files to verify they exist and collect existing IDs:

**Files to check:**
- `config/main.agents.js` - Main agent configurations
- `config/sub.agents.js` - Sub-agent configurations
- `config/modules.js` - Module configurations
- `config/placeholders.js` - Placeholder registrations

**For each file:**
1. Verify file exists
2. Extract all existing `id` values
3. Store in `existing_ids` array

**Report to user:**
"**Sanity Check Results:**

✓ config/main.agents.js - Found [X] agents
✓ config/sub.agents.js - Found [X] sub-agents
✓ config/modules.js - Found [X] modules
✓ config/placeholders.js - Valid

I've collected all existing IDs to ensure we don't create duplicates."

**If any file is missing:**
"⚠️ Warning: [filename] not found. This may indicate an incomplete CodeMachine installation. Do you want to proceed anyway? [y/n]"

### 2. Ask Workflow Name

"**What would you like to name your workflow?**

This name will be used for:
- Workflow file: `templates/workflows/{name}.workflow.js`
- Prompts folder: `prompts/templates/{name}/`

Tips:
- Use lowercase with hyphens (e.g., `code-review`, `project-setup`)
- Keep it short and descriptive
- Avoid spaces and special characters

Enter workflow name:"

Wait for response. Validate:
- Lowercase letters, numbers, hyphens only
- No spaces or special characters
- Confirm name with user

Store as `workflow_name`.

### 3. Ask About Tracks (Optional)

**In Expert mode, explain first:**
"**Tracks** let users choose their project type at the start of a workflow. Each track can enable different agents or steps.

Example: A code workflow might have tracks for `frontend`, `backend`, `fullstack` - and show different agents based on selection."

**Then ask (both modes):**
"**Do you want to add tracks to your workflow?**

Tracks are useful when:
- Different project types need different steps
- You want to filter agents by user selection
- Your workflow supports multiple use cases

Would you like to add tracks? **[y/n]**"

**If YES:**
"Let's define your tracks.

**Track question:** What question should users answer to select a track?
(Example: 'What type of project are you building?')

Enter the question:"

Wait for response. Store as `tracks.question`.

"**Now define each track option.**

For each track, provide:
- **ID** (lowercase, no spaces): e.g., `frontend`
- **Label**: e.g., `Frontend Application`
- **Description**: e.g., `React, Vue, or Angular projects`

Enter first track (format: `id | label | description`):"

Collect tracks until user says done. Store in `tracks.options`.

**If NO:** Store `tracks: null`.

### 4. Ask About Condition Groups (Optional)

**In Expert mode, explain first:**
"**Condition Groups** let users select features or options that affect which agents run. They can be:
- Multi-select (choose many features)
- Single-select (choose one option)
- Track-specific (only appear for certain tracks)
- Nested (have children conditions)

Example: 'Which features do you need?' with options like `authentication`, `database`, `api` - and `authentication` might have children for `oauth`, `jwt`, `basic`."

**Then ask (both modes):**
"**Do you want to add condition groups to your workflow?**

Condition groups are useful when:
- Agents should only run for certain features
- Users need to configure options upfront
- You want dynamic workflow behavior

Would you like to add condition groups? **[y/n]**"

**If YES:**

For each condition group, collect:

1. **Group ID:** "Enter group ID (lowercase, no spaces):"
2. **Question:** "What question should this group ask?"
3. **Multi-select?:** "Can users select multiple options? [y/n]"
4. **Track-specific?:** "Should this only appear for specific tracks? [y/n]"
   - If yes: "Which tracks? (comma-separated IDs):"

5. **Conditions:** "Now define the condition options for this group.

For each condition:
- **ID** (lowercase): e.g., `auth`
- **Label**: e.g., `Authentication`
- **Description**: e.g., `Add user login and registration`

Enter condition (format: `id | label | description`):"

Collect conditions until user says done.

6. **Children?:** "Does any condition need follow-up options (children)? [y/n]"
   - If yes: "Which condition ID needs children?:"
   - Then collect children conditions same format

7. **More groups?:** "Add another condition group? [y/n]"

Store all in `conditionGroups` array.

**If NO:** Store `conditionGroups: []`.

### 5. Ask About Workflow Flags

"**Two more quick options:**

1. **Controller flag** - Will this workflow support autonomous mode with a controller agent?
   (If yes, we'll create a controller agent in step 5)

2. **Specification flag** - Does this workflow use a specification file as input?
   (Common for workflows that read from a requirements doc)

Set controller flag? **[y/n]**"

Wait for response. Store as `controller: true/false`.

"Set specification flag? **[y/n]**"

Wait for response. Store as `specification: true/false`.

### 6. Ask About Autonomous Mode

**If controller = true:**

"**Autonomous Mode Behavior**

How should autonomous mode (Shift+Tab) behave in this workflow?

| Value | Behavior |
|-------|----------|
| `'never'` | Autonomous mode disabled - user cannot enable it |
| `'always'` | Autonomous mode locked ON - user cannot disable it |
| `false` | Defaults to OFF - user can toggle with Shift+Tab |
| `true` | Defaults to ON - user can toggle with Shift+Tab |

**Choose autonomous mode setting:**

1. **Never** - Disable autonomous mode entirely
2. **Always** - Lock autonomous mode ON (fully automated)
3. **Default OFF** - Start manual, user can enable (most common)
4. **Default ON** - Start autonomous, user can disable

Enter **1**, **2**, **3**, or **4**:"

Wait for response. Store as:
- 1 → `autonomousMode: 'never'`
- 2 → `autonomousMode: 'always'`
- 3 → `autonomousMode: false`
- 4 → `autonomousMode: true`

**If controller = false:**
Skip this section. Store `autonomousMode: null` (won't be included in workflow).

### 7. Ask About Engine & Model

"**Engine Configuration**

CodeMachine supports multiple AI engines. Which engine should your workflow use by default?

**Available Engines** (case-sensitive IDs):

| ID | Name | Default Model | Status |
|----|------|---------------|--------|
| `opencode` | OpenCode | opencode/glm-4.7-free | Stable |
| `claude` | Claude Code | opus | Experimental |
| `codex` | Codex | gpt-5.1-codex-max | Stable |
| `cursor` | Cursor | auto | Experimental |
| `mistral` | Mistral Vibe | devstral-2 | Experimental |
| `auggie` | Auggie CLI | (provider default) | Stable |
| `ccr` | Claude Code Router | sonnet | Stable |

Enter engine ID (or press Enter to skip - agents will use system default):"

Wait for response. If provided, validate against list. Store as `defaultEngine`.

**If engine provided:**
"**Model** - Do you want to specify a model? (Leave blank for engine's default)

Enter model name (case-sensitive, e.g., `opus`, `sonnet`, `gpt-5.1-codex-max`):"

Wait for response. Store as `defaultModel` (or null if blank).

### 8. Ask About Interactive Mode

"**Interactive Mode**

The `interactive` flag controls how agents behave during workflow execution.

**The 8 Scenarios:**

| # | interactive | autoMode | chainedPrompts | Behavior |
|---|-------------|----------|----------------|----------|
| 1 | true | true | yes | Controller drives with prompts |
| 2 | true | true | no | Controller drives single step |
| 3 | true | false | yes | User drives with prompts |
| 4 | true | false | no | User drives each step |
| 5 | false | true | yes | **FULLY AUTONOMOUS** - auto-send ALL prompts |
| 6 | false | true | no | Auto-advance to next step |
| 7 | false | false | yes | ⚠️ INVALID - forces interactive:true |
| 8 | false | false | no | ⚠️ INVALID - forces interactive:true |

**Key Points:**
- `interactive: true` (default) = User or controller provides input
- `interactive: false` = System auto-advances (REQUIRES autoMode/controller to work)
- `autoMode` = Controller takes over when user presses **Shift+Tab**

**IMPORTANT:** `interactive: false` without a controller is INVALID (scenarios 7-8). The system will force `interactive: true` and show a warning.

**Recommended combinations:**
- `interactive: true` + controller = User can toggle autonomous mode (Shift+Tab)
- `interactive: false` + controller = Always autonomous (controller responds)
- `interactive: true` + no controller = Manual mode (user responds)

Should agents be interactive by default? **[y/n]** (default: yes)"

Wait for response. Store as `interactive: true/false` (default true).

**If user chose `interactive: false` AND `controller: false`:**
"⚠️ **Warning:** Setting `interactive: false` without a controller will force interactive mode anyway (scenarios 7-8 are invalid).

Would you like to:
1. Add a controller (recommended for autonomous workflows)
2. Keep interactive: true instead

Enter **1** or **2**:"

Handle response accordingly.

### 9. Summary

Present summary of everything collected:

"**Workflow Definition Summary:**

**Name:** {workflow_name}
**Files will be created:**
- `templates/workflows/{workflow_name}.workflow.js`
- `prompts/templates/{workflow_name}/`

**Tracks:** {show tracks or 'None'}
**Condition Groups:** {show groups or 'None'}
**Controller:** {yes/no}
**Autonomous Mode:** {autonomousMode or 'N/A (no controller)'}
**Specification:** {yes/no}

**Engine:** {defaultEngine or 'System default'}
**Model:** {defaultModel or 'Engine default'}
**Interactive:** {yes/no}

**Existing IDs collected:** {count} (will prevent duplicates)"

{ali_step_completion}

## SUCCESS METRICS

- All config files verified or warnings acknowledged
- Existing IDs collected for duplicate prevention
- Valid workflow name chosen
- Tracks configured or explicitly skipped
- Condition groups configured or explicitly skipped
- Controller and specification flags set
- Autonomous mode configured (if controller enabled)
- Engine and model configured or skipped
- Interactive mode set with proper validation
- Summary shown and confirmed

## FAILURE METRICS

- Skipping sanity checks
- Creating a workflow name that conflicts with existing
- Not collecting existing IDs
- Proceeding without user confirmation on name
- Not explaining tracks/conditions in Expert mode
- Allowing interactive:false without controller (invalid scenario)
- Not showing the 8 scenarios table in Expert mode
