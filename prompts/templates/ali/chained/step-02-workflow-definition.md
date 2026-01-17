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

### 5. Ask About Workflow Mode

"**Workflow Execution Mode**

How should your workflow run? This is an important choice that affects how agents interact with users.

---

**Option 1: Continuous Mode (Recommended - Default)**

The workflow runs automatically from start to finish. Each agent completes its task and the system advances to the next agent **without waiting for user input**.

```
Agent 1 (Planner) → completes → auto-advance →
Agent 2 (Builder) → completes → auto-advance →
Agent 3 (Reviewer) → completes → done!
```

✅ **Best for:**
- Simple, straightforward workflows
- When agents have all the information they need
- Predictable tasks with clear outputs
- Batch processing or automated pipelines

✅ **Benefits:**
- Fastest execution - no waiting
- Easy to build and maintain
- Lower token consumption

---

**Option 2: Manual Mode (Interactive)**

The workflow **stops after each agent** and waits for your input. You can review the agent's output, provide feedback, answer questions, or guide the next step.

```
Agent 1 (Planner) → completes → ⏸️ WAITING FOR YOU →
  You: "Looks good, continue"
Agent 2 (Builder) → completes → ⏸️ WAITING FOR YOU →
  You: "Add error handling to the login function"
Agent 3 (Reviewer) → completes → done!
```

If an agent has **chained prompts** (multiple steps), it will also wait after each step:

```
Agent 1 - Step 1 → ⏸️ WAITING → You respond →
Agent 1 - Step 2 → ⏸️ WAITING → You respond →
Agent 1 - Step 3 → completes → next agent...
```

💡 **Real Example - This workflow (Ali) is Manual Mode!**

I'm Ali, and I'm running in manual mode right now:
- No controller - I talk directly to YOU
- No autonomous mode - you can't press Shift+Tab to auto-pilot
- After each step, I wait for you to respond and press Enter

That's why you've been talking to me step by step. If this was Continuous mode, all 8 steps would run automatically without waiting for your input!

✅ **Best for:**
- Workflows where you want to guide each step
- When agents ask questions that need YOUR answers
- Learning/exploring - see what each agent does
- Quality control - review before proceeding

✅ **Benefits:**
- Full control over the workflow
- Can correct course at any point
- See intermediate outputs

---

**Option 3: Autonomous Mode with Controller (Beta)**

A special **Controller Agent** responds on your behalf when agents ask questions. You brief the controller before the workflow starts, and it handles all agent interactions automatically.

```
Agent (John - PM): What is our project type?
Controller: Our project is a React dashboard for analytics...

Agent (Sarah - Architect): Should we use REST or GraphQL?
Controller: Use GraphQL for the flexible queries we need...
```

**How it works:**
1. Before workflow starts, you brief the controller about the project
2. Controller knows each agent by name and their expected output
3. When an agent asks a question, controller responds instead of you
4. You can toggle autonomous mode ON/OFF with **Shift+Tab** during execution

⚠️ **Trade-offs:**
- **Higher token consumption** - Controller receives and responds to every agent
- **Harder to engineer** - You must define controller persona, calibration, and agent interactions
- **Beta feature** - Still being refined

✅ **Best for:**
- Complex workflows with many agent interactions
- When you want a PO/PM-like agent making decisions
- Hands-off execution with smart responses

---

**Which mode do you want?**

1. **Continuous Mode** (Recommended) - Auto-advances, no waiting
2. **Manual Mode** - Stops after each agent/step, waits for your input
3. **Autonomous Mode with Controller** (Beta) - Controller responds to agents

Enter **1**, **2**, or **3**:"

Wait for response.

**If user chose 1 (Continuous Mode):**
Store `controller: false`, `interactive: false`. Do NOT include `autonomousMode` in workflow file.

"Great choice! Continuous mode is the simplest and works well for most workflows."

**If user chose 2 (Manual Mode):**
Store `controller: false`, `interactive: true`. Do NOT include `autonomousMode` in workflow file.

"Got it! Manual mode gives you full control. The workflow will wait for your input after each agent completes (and after each chained step if applicable)."

**If user chose 3 (Autonomous Mode with Controller):**
Store `controller: true`, `interactive: true`.

"Got it! We'll create a Controller Agent in step 5. Now let's configure autonomous mode behavior."

"**Autonomous Mode Toggle (Shift+Tab)**

When running the workflow, you can press **Shift+Tab** to toggle between:
- **Manual** - You respond to agents
- **Autonomous** - Controller responds to agents

How should the workflow START by default?

| Value | Behavior |
|-------|----------|
| `'never'` | Always manual - autonomous mode disabled entirely |
| `'always'` | Always autonomous - cannot switch to manual |
| `false` | Starts in manual mode - you can enable autonomous with Shift+Tab |
| `true` | Starts in autonomous mode - you can switch to manual with Shift+Tab |

**Choose:**

1. **Never** - Always manual, autonomous mode disabled
2. **Always** - Always autonomous, cannot switch to manual
3. **Start Manual** - Begin with you responding, can switch to controller
4. **Start Autonomous** - Begin with controller responding, can switch to manual

Enter **1**, **2**, **3**, or **4**:"

Wait for response. Store as:
- 1 → `autonomousMode: 'never'`
- 2 → `autonomousMode: 'always'`
- 3 → `autonomousMode: false`
- 4 → `autonomousMode: true`

### 6. Ask About Specification Flag

"**Specification File**

Does this workflow use a specification file as input?
(Common for workflows that read from a requirements doc, PRD, or brief)

Use specification file? **[y/n]**"

Wait for response. Store as `specification: true/false`.

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

### 9. Summary

Present summary of everything collected:

"**Workflow Definition Summary:**

**Name:** {workflow_name}
**Files will be created:**
- `templates/workflows/{workflow_name}.workflow.js`
- `prompts/templates/{workflow_name}/`

**Workflow Mode:** {Continuous | Manual | Autonomous with Controller (Beta)}
**Interactive:** {true/false}
**Controller:** {yes/no - if yes, will be created in step 5}
**Autonomous Mode:** {only shown if controller enabled: never|always|true|false}

**Tracks:** {show tracks or 'None'}
**Condition Groups:** {show groups or 'None'}
**Specification:** {yes/no}

**Engine:** {defaultEngine or 'System default'}
**Model:** {defaultModel or 'Engine default'}

**Existing IDs collected:** {count} (will prevent duplicates)"

## Step 2: CREATE Plan File

**CRITICAL: This step CREATES the workflow plan file!**

**On User Confirmation:**

1. **Create directory** (if needed): `.codemachine/workflow-plans/`

2. **Create the plan file** at `.codemachine/workflow-plans/{workflow_name}-plan.md`:

```markdown
# Workflow Plan: {workflow_name}

Created: {ISO timestamp}
Last Updated: {ISO timestamp}

<workflow-plan>
  <!-- Step 1 data from memory -->
  <step-01 completed="true" timestamp="{timestamp}">
    <mode>{mode}</mode>
    <brainstorming enabled="{true|false}">
      <problem>{problem}</problem>
      <agent-ideas>{agent_ideas}</agent-ideas>
      <flow-concept>{flow_concept}</flow-concept>
    </brainstorming>
  </step-01>

  <!-- Step 2 data -->
  <step-02 completed="true" timestamp="{ISO timestamp}">
    <workflow-name>{workflow_name}</workflow-name>
    <existing-ids count="{count}">{comma-separated list}</existing-ids>
    <workflow-mode>
      <type>{continuous|manual|autonomous}</type>
      <interactive>{true|false}</interactive>
      <controller enabled="{true|false}" beta="true">{only if autonomous}</controller>
      <!-- autonomous-mode ONLY included if controller enabled -->
      <autonomous-mode>{never|always|true|false}</autonomous-mode>
    </workflow-mode>
    <tracks enabled="{true|false}">
      <question>{tracks.question or empty}</question>
      <options>
        <!-- For each track -->
        <track id="{id}" label="{label}" description="{description}" />
      </options>
    </tracks>
    <condition-groups>
      <!-- For each group -->
      <group id="{id}" question="{question}" multi-select="{true|false}" tracks="{track-ids or empty}">
        <condition id="{id}" label="{label}" description="{description}" />
        <!-- children if any -->
      </group>
    </condition-groups>
    <specification>{true|false}</specification>
    <engine>{engine or null}</engine>
    <model>{model or null}</model>
  </step-02>

</workflow-plan>
```

3. **Update TodoWrite:**

```javascript
TodoWrite([
  { content: "Step 01: Mode Selection", status: "completed", activeForm: "Mode selection completed" },
  { content: "Step 02: Workflow Definition", status: "completed", activeForm: "Workflow definition completed" },
  { content: "Step 03: Main Agents", status: "in_progress", activeForm: "Defining main agents" },
  { content: "Step 04: Prompts & Placeholders", status: "pending", activeForm: "Creating prompts" },
  { content: "Step 05: Controller Agent", status: "pending", activeForm: "Creating controller" },
  { content: "Step 06: Sub-Agents", status: "pending", activeForm: "Configuring sub-agents" },
  { content: "Step 07: Modules", status: "pending", activeForm: "Configuring modules" },
  { content: "Step 08: Assembly & Validation", status: "pending", activeForm: "Assembling workflow" }
])
```

4. **Confirm to user:**
"✓ Workflow plan created at `.codemachine/workflow-plans/{workflow_name}-plan.md`

Press **Enter** to proceed to the next step."

{ali_step_completion}

## SUCCESS METRICS

- All config files verified or warnings acknowledged
- Existing IDs collected for duplicate prevention
- Valid workflow name chosen
- Tracks configured or explicitly skipped
- Condition groups configured or explicitly skipped
- **All 3 workflow modes explained clearly with examples**
- **Continuous mode: controller=false, interactive=false, NO autonomousMode**
- **OR Manual mode: controller=false, interactive=true, NO autonomousMode**
- **OR Autonomous mode: controller=true, interactive=true, autonomousMode=true|false|'never'|'always'**
- Specification flag set
- Engine and model configured or skipped
- Summary shown and confirmed
- **Plan file CREATED with step-01 and step-02 data**
- **TodoWrite updated**

## FAILURE METRICS

- Skipping sanity checks
- Creating a workflow name that conflicts with existing
- Not collecting existing IDs
- Proceeding without user confirmation on name
- Not explaining tracks/conditions in Expert mode
- **Not explaining the difference between Continuous and Autonomous modes**
- **Not marking Controller as Beta**
- **Not explaining trade-offs (token consumption, engineering complexity)**
- **Not creating the plan file**
- **Not updating TodoWrite**
