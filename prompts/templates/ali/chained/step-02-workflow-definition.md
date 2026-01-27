---
name: "Step 02 - Workflow Definition"
description: "Setup check, workflow name, tracks, and condition groups"
---

# Step 02: Workflow Definition

## STEP GOAL

1. Run setup check to verify imports folder and registry exist
2. Gather workflow concept (from Step 1 brainstorming or ask user)
3. Suggest workflow names with descriptions, let user pick or provide own
4. Confirm name and description
5. Configure tracks (optional - project type selection)
6. Configure conditionGroups (optional - feature selection)
7. Set workflow flags (controller, specification, engine, model)

**🎯 GUIDE USER TO CORRECT STEP:** If user asks about something that belongs to a later step (e.g., agents, prompts, workflow generation), guide them to proceed step-by-step. Say: "Great question! We'll cover that in Step {X}. Let's finish this step first, then press **Enter** to continue."

## Track-Based Behavior

**Check `{selected_track}` and adapt accordingly:**

---

**`create-workflow`:** Execute full sequence below - create new workflow definition from scratch.

---

**`modify-workflow`:**
- Plan file already loaded from Step 01
- Show current workflow definition from plan
- Ask: "What do you want to modify?" (name, description, tracks, conditions, workflow mode)
- Only update the requested sections
- Re-validate and update plan file

---

**`have-questions`:**
- Q&A mode only - answer questions about workflow definition concepts
- Topics: workflow naming, tracks, conditions, workflow modes (manual/continuous/autonomous)
- Do NOT create or modify anything
- After answering, tell user: "Press **Enter** to proceed to the next step, or ask more questions."

---

## Sequence of Instructions (create-workflow / modify-workflow)

### 1. Setup Check

Check the CodeMachine imports folder and registry file.

**Location:** `~/.codemachine/imports/`

**Registry file:** `~/.codemachine/imports/registry.json`

**Registry structure:**
```json
{
  "schemaVersion": 1,
  "imports": {
    "workflow-name": {
      "name": "workflow-name",
      "version": "1.0.0",
      "source": "workflow-name-codemachine",
      "path": "/home/user/.codemachine/imports/workflow-name-codemachine",
      "installedAt": "ISO-timestamp",
      "resolvedPaths": { ... }
    }
  }
}
```

---

**Scenario A: Imports folder doesn't exist**

Actions:
1. Create `~/.codemachine/imports/` directory
2. Create `registry.json` with: `{ "schemaVersion": 1, "imports": {} }`

Display:
"Setting up your CodeMachine imports folder...

✓ Created ~/.codemachine/imports/
✓ Created registry.json

You're all set! Let's create your first workflow."

Store `existing_workflows: []` and proceed to Section 2.

---

**Scenario B: Imports folder exists, registry has workflows**

Actions:
1. Read `~/.codemachine/imports/registry.json`
2. Parse and extract workflow names from the `imports` object keys
3. Store in `existing_workflows` array

Display:
"**Existing Imported Workflows:**

| Name | Installed |
|------|-----------|
| \{name\} | \{formatted date from installedAt\} |
| ... | ... |

Awesome! You already have \{count\} workflow(s). Let's add a new one."

Proceed to Section 2.

---

**Scenario C: Imports folder exists but registry.json is missing or empty/invalid**

Actions:
1. Create/fix `registry.json` with: `{ "schemaVersion": 1, "imports": {} }`

Display:
"✓ Registry file initialized.

Let's create your first workflow!"

Store `existing_workflows: []` and proceed to Section 2.

### 2. Gather Workflow Concept

**Check if brainstorming was completed in Step 1:**

**If brainstorming WAS done (step-01 has synthesis data):**

Use the stored data from Step 1:
- `<about>` - what the workflow is about
- `<goal>` - main goal
- `<problem>` - synthesized problem
- `<flow-concept>` - synthesized flow

Skip to "Generate Name Suggestions" below.

---

**If brainstorming was NOT done:**

Ask the user to briefly describe their workflow:

"**Before we name your workflow, tell me briefly:**

1. What will this workflow do? (one sentence)
2. What's the end goal?

This helps me suggest good names and descriptions."

Wait for response. Store as `workflow_concept`.

---

### 3. Generate Name Suggestions

Based on the workflow concept (from brainstorming or user's brief description), generate **3-4 workflow name suggestions** with descriptions.

**Name generation rules:**
- Lowercase with hyphens only
- 2-4 words maximum
- Action-oriented or domain-specific
- NOT in `existing_workflows` array

**Present suggestions:**

"**Suggested Workflow Names:**

Based on your concept, here are some options:

| # | Name | Description |
|---|------|-------------|
| 1 | `\{suggested-name-1\}` | \{one-line description of what it does\} |
| 2 | `\{suggested-name-2\}` | \{one-line description of what it does\} |
| 3 | `\{suggested-name-3\}` | \{one-line description of what it does\} |
| 4 | `\{suggested-name-4\}` | \{one-line description of what it does\} |

**Your workflow will be created at:**
`~/.codemachine/imports/\{name\}-codemachine/`

Enter **1-4** to select, or type your own name:"

Wait for response.

**If user selects a number (1-4):**
- Store the selected name as `workflow_name`
- Store the corresponding description as `workflow_description`
- Proceed to "Confirm Name & Description"

**If user types their own name:**
- Validate: lowercase letters, numbers, hyphens only
- Validate: **NOT in `existing_workflows` array**
- If invalid format: "⚠️ Please use lowercase letters, numbers, and hyphens only (e.g., `my-workflow`)."
- If already exists: "⚠️ A workflow named **\{name\}** already exists. Please choose a different name."
- Store as `workflow_name`
- Proceed to "Ask for Description"

---

### 4. Confirm Name & Description

**If user selected a suggested option:**

"You selected: **\{workflow_name\}**

Description: *\{workflow_description\}*

Is this correct? **[y/n]** (or type a new description to customize)"

Wait for response:
- If "y" or "yes": Proceed to Section 5 (Tracks)
- If "n" or "no": Go back to name suggestions
- If user types text: Store as custom `workflow_description`, then proceed

---

**If user provided their own name (Ask for Description):**

"Great! Your workflow will be called **\{workflow_name\}**.

**Now describe it in one sentence:**

Example: *'Guides developers through setting up a new microservice with tests and documentation'*

Enter description:"

Wait for response. Store as `workflow_description`.

---

**Final confirmation:**

"**Confirmed:**
- **Name:** `\{workflow_name\}`
- **Description:** \{workflow_description\}
- **Location:** `~/.codemachine/imports/\{workflow_name\}-codemachine/`

Let's continue!"

### 5. Ask About Tracks (Optional)

"**Quick question:** Will your workflow need different paths for different situations?

For example:
- Same workflow but for **JavaScript vs Python** projects
- Same workflow but for **creating new** vs **modifying existing**

If your workflow is straightforward with one path, you probably don't need this.

**Does your workflow need different paths?**
1. **No** - One path, keep it simple
2. **Maybe** - Tell me more about tracks first
3. **Yes** - I know what I need

Enter **1**, **2**, or **3**:"

Wait for response.

---

**If user chose 1 (No):**
"Perfect! Keeping it simple. We'll skip tracks.

Since your workflow has one straightforward path, I'll assume you don't need optional features (conditions) either - skipping those too."

Store `tracks: null` and `conditionGroups: []`.
Proceed directly to **Section 7 (Workflow Mode)** - skip Section 6 entirely.

---

**If user chose 2 (Maybe - explain tracks):**

"Let me explain **Tracks** with real examples:

---

**What are Tracks?**

Tracks let you create **different paths through the same workflow**. Before the workflow starts, a modal appears asking the user to choose a track - they MUST select one to proceed.

---

**Real Example 1: Code Generator Workflow**

Imagine a workflow that generates boilerplate code. You want it to work for both JavaScript and Python:

| Track | What's Different |
|-------|------------------|
| `javascript` | Uses JS-specific agents, npm commands, JS templates |
| `python` | Uses Python-specific agents, pip commands, Python templates |

**Shared steps:** Planning, brainstorming, architecture design
**Different steps:** Code generation, testing, deployment

The workflow has 5 agents:
```
1. Planner Agent      → runs for BOTH tracks (shared)
2. Architect Agent    → runs for BOTH tracks (shared)
3. JS Dev Agent       → runs ONLY for javascript track
4. Python Dev Agent   → runs ONLY for python track
5. Reviewer Agent     → runs for BOTH tracks (shared)
```

---

**Real Example 2: This Workflow (Ali)**

Ali currently helps **create** new workflows. But what if we added a track for **modifying** existing workflows?

| Track | Path |
|-------|------|
| `create` | Full 8-step creation process |
| `modify` | Load existing → Show what can be changed → Apply edits |

Same Ali persona, but completely different steps based on track selection.

---

**Real Example 3: Partial vs Full Differences**

Tracks can be:
- **Partially different** - Share most steps, swap a few agents
- **Fully different** - Completely separate paths under one workflow

You control which agents run for which tracks.

---

**Nested Questions with Conditions**

Tracks can have **conditions** nested under them for follow-up questions:

```
Track: modify (Modify Existing Workflow)
  └── Condition Group: "What do you want to modify?"
        ├── main-agents
        ├── sub-agents
        ├── modules
        └── prompts
```

The user selects the `modify` track, then gets asked which parts to modify.

---

**Now that you understand tracks, do you need them?**
1. **No** - My workflow has one path
2. **Yes** - I want to set up tracks

Enter **1** or **2**:"

Wait for response.

**If 1:**
"Got it! Keeping it simple.

Since your workflow has one path, I'll assume you don't need optional features (conditions) either - skipping those too."

Store `tracks: null` and `conditionGroups: []`.
Proceed directly to **Section 7 (Workflow Mode)** - skip Section 6 entirely.

**If 2:** Continue to "Define Tracks" below.

---

**If user chose 3 (Yes - knows what they need) OR chose Yes after explanation:**

"Great! Let's define your tracks.

**Track Selection Question**
What question should appear in the modal when users start the workflow?

Examples:
- 'Which language are you using?'
- 'What do you want to do?'
- 'Select your project type:'

Enter the question:"

Wait for response. Store as `tracks.question`.

"**Now define each track option.**

For each track, provide:
- **ID** (lowercase, hyphens ok): e.g., `javascript`, `create-new`
- **Label**: e.g., `JavaScript Project`, `Create New Workflow`
- **Description**: e.g., `For Node.js, React, or vanilla JS projects`

Enter first track (format: `id | label | description`):"

Collect tracks. After each: "Add another track? [y/n]"

Store in `tracks.options`.

"**Tracks defined:**
\{list tracks\}

You'll assign agents to tracks in Step 3 (Main Agents).

**Quick tip:** Your agents can know which track was selected at runtime using the `\{selected_track\}` placeholder in their prompts. I'll remind you about this when we create prompts in Step 4."

---

### 6. Ask About Condition Groups (Optional)

**IMPORTANT - Built-in Placeholders for Agent Awareness:**

When tracks and/or conditions are configured, Ali must remember these built-in placeholders for Step 4 (Prompts):

| Placeholder | What It Contains | Example Value |
|-------------|------------------|---------------|
| `\{selected_track\}` | The track ID selected by user at workflow start | `javascript`, `python`, `create` |
| `\{selected_conditions\}` | Comma-separated list of selected condition IDs | `auth, database`, `oauth` |
| `\{project_name\}` | The project name from CodeMachine | `my-app` |

**Why this matters:**
1. **Controller agents** need to know what track/conditions were selected to respond appropriately
2. **Regular agents** can adapt their behavior based on the selected track
3. **Prompts can include** these placeholders for runtime injection

**Example prompt usage:**
```markdown
You are working on a \{selected_track\} project.
The user has enabled these features: \{selected_conditions\}

Adapt your code generation accordingly.
```

Ali will inform users about these placeholders when creating prompts in Step 4.

---

"**Quick question:** Will some parts of your workflow be optional based on user choices?

For example:
- 'Do you want authentication?' → Only run auth agents if yes
- 'Which features?' → Run different agents based on selection

**Do you need optional features or choices?**
1. **No** - All steps run every time
2. **Maybe** - Tell me more first
3. **Yes** - I want to set up conditions

Enter **1**, **2**, or **3**:"

Wait for response.

---

**If user chose 1 (No):**
"Got it! All agents will run every time."
Store `conditionGroups: []` and proceed to Section 7.

---

**If user chose 2 (Maybe - explain conditions):**

"Let me explain **Condition Groups**:

---

**What are Condition Groups?**

Conditions let users toggle features ON/OFF before the workflow runs. Based on their choices, certain agents are included or skipped.

---

**Real Example: Project Setup Workflow**

A workflow that sets up new projects might ask:

**Condition Group 1:** 'Which features do you need?' (multi-select)
- `auth` - Authentication (login, signup)
- `database` - Database setup
- `api` - REST API endpoints
- `testing` - Test framework

User selects: auth + database

Result: Auth Agent and Database Agent run. API Agent and Testing Agent are skipped.

---

**Nested Conditions (Children)**

Conditions can have follow-up questions:

```
'Which features?' (multi-select)
  ├── auth ──→ 'What type of auth?' (single-select)
  │              ├── oauth
  │              ├── jwt
  │              └── basic
  ├── database
  └── api
```

If user selects `auth`, they get a follow-up asking which auth type.

---

**Track-Specific Conditions**

Conditions can appear only for certain tracks:

```
Track: javascript
  └── 'Which JS framework?' → react | vue | vanilla

Track: python
  └── 'Which Python framework?' → django | flask | fastapi
```

---

**Now do you need conditions?**
1. **No** - All agents run every time
2. **Yes** - I want optional features

Enter **1** or **2**:"

Wait for response.

**If 1:** Store `conditionGroups: []` and proceed to Section 7.
**If 2:** Continue to "Define Condition Groups" below.

---

**If user chose 3 (Yes) OR chose Yes after explanation:**

"Let's define your condition groups.

**For each group, I'll ask:**
1. Group ID (lowercase)
2. Question to display
3. Multi-select or single-select?
4. Track-specific? (only for certain tracks)
5. The condition options
6. Any nested children?

---

**Group 1:**

**Group ID** (lowercase, no spaces):"

Wait for response. Store as group `id`.

"**Question to display:**"

Wait for response. Store as `question`.

"**Can users select multiple options?** [y/n]"

Wait for response. Store as `multiSelect: true/false`.

"**Should this only appear for specific tracks?** [y/n]"

If yes: "Which tracks? (comma-separated IDs):"
Store as `tracks` array or null.

"**Now define the options.**

Format: `id | label | description`

Enter first option:"

Collect options. After each: "Add another option? [y/n]"

"**Do any options need follow-up questions (children)?** [y/n]"

If yes:
"Which option ID needs children?:"
Then collect children using same format.

"**Add another condition group?** [y/n]"

Repeat if yes. Store all in `conditionGroups` array.

"**Conditions defined!**

**Quick tip:** Your agents can know which conditions were selected at runtime using the `\{selected_conditions\}` placeholder. Combined with `\{selected_track\}`, your agents will have full context of user choices. I'll remind you about this in Step 4."

---

### 7. Ask About Workflow Mode

"**Workflow Execution Mode**

How should your workflow run?

| Mode | Description |
|------|-------------|
| **Manual** | You control the flow - agents wait for your input after each step |
| **Continuous** | Runs automatically from start to finish, no waiting |
| **Hybrid** | Mix auto and interactive agents - you decide per-agent which ones pause |
| **Autonomous** (Beta) | A controller agent responds to other agents on your behalf |

**Important:** The `interactive` setting is **per-agent**, not workflow-wide. This means you can mix approaches - some agents run automatically while others pause for your input.

**Do you want me to explain these in depth with real examples?**
1. **No** - I understand, let me choose
2. **Yes** - Explain each mode first

Enter **1** or **2**:"

Wait for response.

---

**If user chose 1 (No - let me choose):**

"Which mode do you want?

1. **Manual** - You control the flow, agents wait for your input
2. **Continuous** - Runs start to finish automatically
3. **Hybrid** - Mix of auto and interactive agents (you decide per-agent)
4. **Autonomous with Controller** (Beta) - Controller responds to agents

Enter **1**, **2**, **3**, or **4**:"

Skip to "Handle Mode Selection" below.

---

**If user chose 2 (Yes - explain modes):**

"Let me explain each **Workflow Execution Mode** with real examples:

---

## Option 1: Manual Mode (Human as Orchestrator)

**What is it?**

In Manual Mode, **YOU are the orchestrator**. The agent talks, then waits for your response. You press Enter to proceed to the next step or next agent. This gives you full control over the workflow.

```
Agent talks → ⏸️ WAITING FOR YOU → You respond → Press Enter →
Agent continues or next agent starts → ⏸️ WAITING → You respond → ...
```

---

**Why use Manual Mode?**

Manual mode is perfect for **repetitive workflows** - tasks you do regularly that follow a similar pattern each time. Instead of starting from scratch with a general-purpose AI, you have a specialized workflow that:

- Asks the right questions every time
- Guides you through a proven process
- Gathers your insights step by step
- Produces consistent, quality output

It's **more effective than general-purpose agents** for specific objectives because the workflow is designed for that exact task. It also saves a huge amount of time.

---

**💡 Real Example: This Workflow (Ali)**

I'm Ali, and I'm running in **Manual Mode** right now!

- **1 agent** (me) with **8 chained steps**
- No controller - I talk directly to YOU
- After each step, I wait for your response
- You press Enter to proceed to the next step
- The workflow pipeline sidebar is hidden (because it's just one agent)

This workflow is used by all CodeMachine users to create workflows. It might be used once or many times, but it handles the same task in a repeatable, guided way.

**The flow:**
```
Ali Step 1 (Mode Selection) → ⏸️ You respond → Enter →
Ali Step 2 (Workflow Definition) → ⏸️ You respond → Enter →
Ali Step 3 (Main Agents) → ⏸️ You respond → Enter →
... through all 8 steps → Workflow Complete!
```

---

**When to use Manual Mode:**

✅ Workflows you'll use repeatedly (like Ali for creating workflows)
✅ When you want to brainstorm or explore with guidance
✅ When agents need YOUR specific insights and decisions
✅ When you want full control over every step
✅ Training/learning workflows where you guide the process
✅ Quality-critical workflows where you review each output

---

**Technical details:**

- Uses flag: `autonomousMode: 'never'`
- Usually **no specification file needed** - you provide insights through conversation
- Can be **1 agent with chained steps** or **multiple agents**
- Agents connect through **prompt placeholders** (data flows between steps)

---

## Option 2: Continuous Mode (Fully Automated)

**What is it?**

In Continuous Mode, the workflow runs **automatically from start to finish**. Agents don't wait for your input - they complete their task and the system advances to the next agent automatically.

```
Agent 1 → completes → auto-advance →
Agent 2 → completes → auto-advance →
Agent 3 → completes → Workflow Done!
```

If an agent has **chained prompts**, those also auto-advance:
```
Agent 1 - Step 1 → auto-advance →
Agent 1 - Step 2 → auto-advance →
Agent 1 - Step 3 → completes → Next Agent...
```

---

**Why use Continuous Mode?**

Continuous mode is perfect for **tasks that don't need human input** - you already know exactly what needs to happen, and the workflow just executes it.

Use cases:
- Collecting context and generating reports
- Repetitive tasks that run the same way every time
- Batch processing or automated pipelines
- Tasks where all information is provided upfront (via specification file)

---

**How does it work technically?**

- All agents have `interactive: false` (normally defaults to true)
- `autonomousMode: 'always'` - the workflow never pauses
- Or `autonomousMode: true` - starts in auto mode, but user can press **Shift+Tab** to pause and take manual control

**Shift+Tab behavior:** When you toggle off autonomous mode, the workflow will pause after each agent (and between chained prompts) to wait for your input. This gives you emergency control if needed.

---

**Important: Specification File**

Since there's no human in the loop, how do agents know what to do?

You provide a **specification file** - a document (PRD, brief, requirements) that agents read at the start. This is typically the only way to give agents context in continuous mode.

We'll configure the spec flag next if you choose this mode.

---

**When to use Continuous Mode:**

✅ Tasks you've done before and know exactly what's needed
✅ Generating reports, documentation, or structured output
✅ When all information can be provided in a spec file
✅ Batch operations (e.g., process 10 files the same way)
✅ When you want hands-off execution

---

**Technical details:**

- All agents: `interactive: false`
- Workflow: `autonomousMode: 'always'` (or `true` for toggle control)
- Usually **requires a specification file** (agents need input somehow)
- Use **chained prompts** to break complex tasks into steps without overwhelming the agent

---

## Option 3: Hybrid Mode (Mix Auto & Interactive)

**What is it?**

Hybrid Mode gives you **per-agent control** over interactivity. Some agents run automatically (no waiting), while others pause for your input. You design the workflow to stop exactly where human judgment matters.

```
Agent 1 (Analyzer) [interactive: false]
  → Scans codebase automatically → auto-advance →

Agent 2 (Planner) [interactive: true]
  → Proposes plan → ⏸️ WAITS for your feedback →
  → You refine the plan → Enter →

Agent 3 (Generator) [interactive: false]
  → Generates output automatically → auto-advance →

Agent 4 (Reviewer) [interactive: true]
  → Shows results → ⏸️ WAITS for approval →
  → You approve or request changes → Done!
```

---

**Why use Hybrid Mode?**

Hybrid mode is the **best of both worlds**. You get:

- **Efficiency:** Let agents that gather context, analyze, or generate run without interruption
- **Control:** Pause at key decision points where you want to review, redirect, or provide input
- **Flexibility:** Design your workflow to match how YOU want to work

It's ideal when some steps need human judgment but others are pure automation.

---

**💡 Real Example: Documentation Generator**

Imagine a workflow that documents your codebase:

| Agent | interactive | Why |
|-------|-------------|-----|
| Codebase Scanner | `false` | Just reads files - no input needed |
| Structure Analyzer | `false` | Determines architecture - automatic |
| Doc Planner | `true` | **Proposes outline - you review/adjust** |
| Doc Writer | `false` | Writes docs based on approved plan |
| Final Reviewer | `true` | **Shows final docs - you approve** |

**The flow:**
```
Scanner → auto → Analyzer → auto →
Planner → ⏸️ You approve outline → Enter →
Writer → auto →
Reviewer → ⏸️ You approve final docs → Done!
```

You only interact twice, but at the most important decision points.

---

**💡 Real Example: Code Review Workflow**

| Agent | interactive | Why |
|-------|-------------|-----|
| Diff Collector | `false` | Gathers code changes automatically |
| Issue Detector | `false` | Finds potential problems |
| Reviewer | `true` | **Shows issues - you decide severity** |
| Fix Suggester | `false` | Generates fix suggestions |
| Approver | `true` | **Final review - you approve/reject** |

---

**When to use Hybrid Mode:**

✅ Workflows with clear "review points" where human judgment matters
✅ When some agents just gather/process data (no input needed)
✅ When you want efficiency BUT also control at key moments
✅ Documentation, code review, analysis workflows
✅ Any workflow where you'd otherwise be clicking "Enter" through steps that don't need you

---

**Technical details:**

- Set `interactive: true` or `interactive: false` **per agent** in Step 3
- No workflow-level `autonomousMode` needed (defaults to `'never'`)
- Agents with `interactive: false` auto-advance to next step
- Agents with `interactive: true` pause and wait for user input
- You can still use **Shift+Tab** to toggle autonomous mode at runtime

---

## Option 4: Autonomous Mode with Controller (Beta)

**What is it?**

A **Controller Agent** acts on your behalf. Instead of you responding to agents, the controller responds for you. You brief the controller once at the start, and it handles all agent interactions automatically.

```
You → Brief the Controller about the project →

Agent (PM): What's our project scope?
Controller: We're building a dashboard for analytics...

Agent (Architect): REST or GraphQL?
Controller: Use GraphQL for our flexible query needs...

Agent (Dev): Which testing framework?
Controller: Jest with React Testing Library...
```

---

**How does it work?**

1. **Before workflow starts:** You talk to the controller, explain the project, goals, constraints
2. **Controller knows each agent:** You tell it who will talk to it and what they expect
3. **During workflow:** Controller responds to agents automatically
4. **R shortcut:** Press R anytime to talk to the controller directly
5. **Shift+Tab:** Toggle between autonomous (controller responds) and manual (you respond)

---

**How does the controller know who's talking?**

The controller sees pre-injected names:
- When YOU talk: `USER (YourName): message`
- When an AGENT talks: `AGENT_NAME: message`

So the controller prompt MUST explain:
- It will receive messages from both USER and AGENTs
- How to distinguish between them
- How to respond appropriately to each

We'll configure all of this in **Step 5 (Controller Agent)**.

---

**When to use Autonomous Mode:**

✅ Complex workflows with many agent interactions
✅ When you want a PO/PM-like agent making consistent decisions
✅ When agents need answers but you don't want to babysit
✅ Reproducible execution with documented decision-making

---

**Technical details:**

- Requires a **Controller Agent** (created in Step 5)
- `controller: true` in workflow file
- `autonomousMode: true | false | 'always' | 'never'` - controls toggle behavior
- Higher token consumption (controller sees all agent messages)
- More complex to engineer (controller prompt is critical)

⚠️ **Beta feature** - still being refined

---

**Which mode do you want?**

1. **Manual Mode** - You control the flow, agents wait for your input
2. **Continuous Mode** - Runs start to finish automatically
3. **Hybrid Mode** - Mix of auto and interactive agents (you decide per-agent)
4. **Autonomous Mode with Controller** (Beta) - Controller responds to agents

Enter **1**, **2**, **3**, or **4**:"

---

### Handle Mode Selection

Wait for response.

**If user chose 1 (Manual Mode):**
Store `controller: false`, `interactive: true`, `autonomousMode: 'never'`.

"**Manual Mode selected!**

You'll be the orchestrator. Each agent will wait for your input before proceeding.

Since you're in full manual mode, you probably don't need a specification file - you'll provide insights through conversation. We'll skip that question."

Store `specification: false` and proceed to Section 9 (Engine & Model).

**If user chose 2 (Continuous Mode):**

"**Continuous Mode selected!**

Your workflow will run automatically from start to finish. All agents will have `interactive: false`.

**One more question:** Do you want users to be able to pause the workflow with Shift+Tab?

1. **No** - Fully automatic, no pausing (`autonomousMode: 'always'`)
2. **Yes** - Starts automatic, but user can pause if needed (`autonomousMode: true`)

Enter **1** or **2**:"

Wait for response.
- If 1: Store `autonomousMode: 'always'`
- If 2: Store `autonomousMode: true`

Store `controller: false`, `interactive: false` (will set all agents to `interactive: false` in Step 3).

"**Important:** Since this is a hands-off workflow, you'll likely need a **specification file** so agents know what to do. Let's configure that next."

Proceed to Section 8 (Specification Flag).

**If user chose 3 (Hybrid Mode):**
Store `controller: false`, `interactiveMode: 'hybrid'`.

"**Hybrid Mode selected!**

You'll decide which agents are interactive and which run automatically. In Step 3 (Agents), I'll ask you for each agent:
- `interactive: true` → Agent pauses and waits for your input
- `interactive: false` → Agent runs automatically and advances to next step

**Quick tip:** Think about where you want **decision points** vs **automation**:
- Agents that gather/analyze data → usually `interactive: false`
- Agents that propose plans or show results for approval → usually `interactive: true`

Do you want a specification file for initial context?

1. **No** - I'll provide context through conversation at interactive steps
2. **Yes** - I want to provide a spec file upfront

Enter **1** or **2**:"

Wait for response.
- If 1: Store `specification: false`, proceed to Section 9
- If 2: Store `specification: true`, proceed to Section 8 (Specification Flag)

**If user chose 4 (Autonomous Mode with Controller):**
Store `controller: true`, `interactive: true`.

"Got it! We'll create a Controller Agent in Step 5. Now let's configure autonomous mode behavior.

**Autonomous Mode Toggle (Shift+Tab)**

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

Proceed to Section 8 (Specification Flag).

### 8. Ask About Specification Flag

**Determine likely need based on workflow mode:**

- If `autonomousMode: 'never'` (Manual Mode) OR `interactive: true` without controller → User will provide input through conversation. Specs likely NOT needed.
- If `autonomousMode: 'always'` or `autonomousMode: true` (Continuous/Autonomous) → Agents need upfront context. Specs likely needed.

---

**If specs likely NOT needed (interactive/manual):**

"**Specification File**

Since your workflow is interactive, I assume you don't need a specification file - you'll provide context through conversation.

However, you CAN use a spec file to give agents context BEFORE you start. This is useful if you want to:
- Pre-load a PRD, requirements doc, or project brief
- Avoid repeating the same context every time you run the workflow

**Skip specification file?** [y/n]"

Wait for response.
- If y: Store `specification: false`, proceed to Section 9
- If n: Continue to "Explain Specification" below

---

**If specs likely needed (continuous/autonomous):**

"**Specification File**

Since your workflow runs without human input, I assume you'll need a specification file so agents know what to do.

**Enable specification file?** [y/n]"

Wait for response.
- If y: Continue to "Explain Specification" below
- If n: Store `specification: false`, proceed to Section 9

---

**Explain Specification (when user wants specs):**

"**How Specification Files Work:**

1. **Before workflow starts:** User MUST fill the spec file - workflow won't start without it
2. **Default location:** `./.codemachine/inputs/specification.md` (created when workflow runs)
3. **CLI override:** You can specify a different file when running:
   ```
   codemachine --spec ./docs/my-requirements.md
   ```

**To use the spec content in your agents:**

1. Register a placeholder in `config/placeholders.js`:
   ```javascript
   specification: path.join('.codemachine', 'inputs', 'specification.md'),
   ```

2. Use `\{specification\}` anywhere in your agent prompts to inject the file content

**Example prompt usage:**
```markdown
## Project Context

\{specification\}

## Your Task

Based on the above requirements, ...
```

The entire spec file content gets injected where you place `\{specification\}`.

---

✓ Specification file enabled. We'll set up the placeholder in Step 4."

Store `specification: true` and proceed to Section 9.

---

### 9. Summary

Present summary of everything collected:

"**Workflow Definition Summary:**

**Name:** \{workflow_name\}
**Description:** \{workflow_description\}
**Location:** `~/.codemachine/imports/\{workflow_name\}-codemachine/`

**Files will be created:**
- `templates/workflows/\{workflow_name\}.workflow.js`
- `prompts/templates/\{workflow_name\}/`

**Workflow Mode:** \{Manual | Continuous | Hybrid | Autonomous with Controller (Beta)\}
**Interactive:** \{true/false/per-agent (hybrid)\}
**Controller:** \{yes/no - if yes, will be created in step 5\}
**Autonomous Mode:** \{only shown if controller enabled: never|always|true|false\}

**Tracks:** \{show tracks or 'None'\}
**Condition Groups:** \{show groups or 'None'\}
**Specification:** \{yes/no\}

**Engine/Model:** Configured per-agent in Step 3"

## Step 2: CREATE Plan File

**CRITICAL: This step CREATES the workflow plan file!**

**On User Confirmation:**

1. **Create directory** (if needed): `.codemachine/workflow-plans/`

2. **Create the plan file** at `.codemachine/workflow-plans/\{workflow_name\}-plan.md`:

```markdown
# Workflow Plan: \{workflow_name\}

Created: \{ISO timestamp\}
Last Updated: \{ISO timestamp\}

<workflow-plan>
  <!-- Step 1 data from memory -->
  <step-01 completed="true" timestamp="\{timestamp\}">
    <mode>\{mode\}</mode>
    <brainstorming enabled="\{true|false\}">
      <problem>\{problem\}</problem>
      <agent-ideas>\{agent_ideas\}</agent-ideas>
      <flow-concept>\{flow_concept\}</flow-concept>
    </brainstorming>
  </step-01>

  <!-- Step 2 data -->
  <step-02 completed="true" timestamp="\{ISO timestamp\}">
    <workflow-name>\{workflow_name\}</workflow-name>
    <workflow-description>\{workflow_description\}</workflow-description>
    <workflow-location>~/.codemachine/imports/\{workflow_name\}-codemachine/</workflow-location>
    <existing-workflows count="\{count\}">\{comma-separated list from registry\}</existing-workflows>
    <workflow-mode>
      <type>\{manual|continuous|hybrid|autonomous\}</type>
      <interactive>\{true|false|per-agent\}</interactive>
      <controller enabled="\{true|false\}" beta="true">\{only if autonomous\}</controller>
      <!-- autonomous-mode ONLY included if controller enabled -->
      <autonomous-mode>\{never|always|true|false\}</autonomous-mode>
    </workflow-mode>
    <tracks enabled="\{true|false\}">
      <question>\{tracks.question or empty\}</question>
      <options>
        <!-- For each track -->
        <track id="\{id\}" label="\{label\}" description="\{description\}" />
      </options>
    </tracks>
    <condition-groups>
      <!-- For each group -->
      <group id="\{id\}" question="\{question\}" multi-select="\{true|false\}" tracks="\{track-ids or empty\}">
        <condition id="\{id\}" label="\{label\}" description="\{description\}" />
        <!-- children if any -->
      </group>
    </condition-groups>
    <specification>\{true|false\}</specification>
  </step-02>

</workflow-plan>
```

3. **Update TodoWrite:**

```javascript
TodoWrite([
  { content: "Step 01: Brainstorming", status: "completed", activeForm: "Brainstorming completed" },
  { content: "Step 02: Workflow Definition", status: "completed", activeForm: "Workflow definition completed" },
  { content: "Step 03: Agents", status: "in_progress", activeForm: "Defining agents" },
  { content: "Step 04: Prompts", status: "pending", activeForm: "Creating prompts" },
  { content: "Step 05: Workflow Generation", status: "pending", activeForm: "Generating workflow" }
])
```

4. **Confirm to user:**
"✓ Workflow plan created at `.codemachine/workflow-plans/\{workflow_name\}-plan.md`

Press **Enter** to proceed to the next step."

{ali_step_completion}

## SUCCESS METRICS

- Setup check completed (imports folder + registry verified/created)
- Existing workflows listed from registry (if any)
- Workflow concept gathered (from Step 1 brainstorming OR asked user directly)
- **3-4 workflow name suggestions generated with descriptions**
- **User selected a suggestion OR provided their own name**
- Valid workflow name chosen (not conflicting with existing)
- **Workflow description confirmed**
- Tracks configured or explicitly skipped
- Condition groups configured or explicitly skipped
- **All 4 workflow modes explained clearly with examples**
- **Manual mode: controller=false, interactive=true, NO autonomousMode**
- **OR Continuous mode: controller=false, interactive=false, autonomousMode='always'|true**
- **OR Hybrid mode: controller=false, interactiveMode='hybrid' (per-agent interactive setting)**
- **OR Autonomous mode: controller=true, interactive=true, autonomousMode=true|false|'never'|'always'**
- Specification flag set
- Summary shown and confirmed (includes name AND description)
- **Plan file CREATED with step-01 and step-02 data (including description)**
- **TodoWrite updated**

## FAILURE METRICS

- Skipping setup check
- **Not generating name suggestions (just asking user to type a name)**
- **Not providing descriptions with name suggestions**
- Creating a workflow name that conflicts with existing workflows in registry
- Not checking registry for existing workflow names
- Proceeding without user confirmation on name
- **Not capturing workflow description**
- Not explaining tracks/conditions in Expert mode
- **Not explaining all 4 modes (Manual, Continuous, Hybrid, Autonomous) upfront**
- **Not presenting Hybrid mode as a first-class option**
- **Not marking Controller as Beta**
- **Not explaining trade-offs (token consumption, engineering complexity)**
- **Not creating the plan file**
- **Not updating TodoWrite**
