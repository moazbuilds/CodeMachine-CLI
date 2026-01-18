---
name: "Step 03 - Main Agents Definition"
description: "Define the main agents for the workflow"
---

# Step 03: Main Agents Definition

## STEP GOAL

Define all main agents for the workflow:
- How many agents needed
- For each agent: ID, name, description
- Single step or chained prompts
- If chained: how many steps, purpose of each

## Sequence of Instructions

### 1. Introduction

"**Now let's define your main agents.**

Each agent in your workflow is a distinct persona that handles a specific part of the process. Agents can be:
- **Single-step**: One prompt file, completes in one interaction
- **Chained**: Multiple steps that build on each other, user advances with Enter"

**In Expert mode, add:**
"Think about your workflow as a journey. Each agent is a guide for part of that journey. For example:
- A 'discovery' agent that gathers requirements
- A 'builder' agent that creates output
- A 'reviewer' agent that validates results"

### 2. Ask Agent Count

"**How many main agents does your workflow need?**

Consider:
- What distinct phases or roles exist?
- Could one agent handle multiple things, or better to specialize?
- Reference your brainstorming if you did one

Enter the number of agents:"

Wait for response. Store as `agent_count`.

### 3. Define Each Agent

For each agent (1 to agent_count):

"**Agent {n} of {total}**

Let's define this agent:

**1. Agent ID** (lowercase with hyphens, must be unique)
Example: `code-reviewer`, `project-planner`

Enter agent ID:"

Wait. Validate against `existing_ids` from step 2.
- If duplicate: "⚠️ That ID already exists. Please choose a different one."
- Store as `agents[n].id`

"**2. Agent Name** (display name)
Example: `Code Reviewer`, `Project Planner`

Enter agent name:"

Wait. Store as `agents[n].name`.

"**3. Description** (what this agent does)
Example: `Reviews code for quality, security, and best practices`

Enter description:"

Wait. Store as `agents[n].description`.

### 4. Single or Chained

"**4. Is this agent single-step or chained?**"

**In Expert mode, explain:**
"- **Single-step**: Agent has one prompt. User interacts, agent completes task, done.
- **Chained**: Agent has multiple steps (prompts). Each step builds on previous. User presses Enter to advance. Great for complex multi-phase tasks.

Example chained flow:
Step 1: Gather requirements → Step 2: Generate plan → Step 3: Create output"

**Both modes:**
"Is agent '{agents[n].name}' single-step or chained?

1. **Single-step** - One prompt, one interaction
2. **Chained** - Multiple sequential steps

Enter **1** or **2**:"

Wait for response.

**If Single-step:**
Store `agents[n].hasChainedPrompts = false`.

**If Chained:**
Store `agents[n].hasChainedPrompts = true`.

"**How many steps will this agent have?**

Consider each distinct phase of what this agent does.

Enter number of steps:"

Wait. Store as `agents[n].stepCount`.

"**Describe each step briefly:**"

For each step (1 to stepCount):
"Step {s}: What is the purpose of this step?

Enter step {s} purpose:"

Wait. Store as `agents[n].steps[s].purpose`.

### 5. Sub-Agents Assignment

"**5. Will this agent use sub-agents?**"

**In Expert mode, explain:**
"**Sub-agents** are helper agents that a main agent can call via the MCP `run_agents` tool. They're useful when:
- Your agent needs to delegate specialized tasks
- You want to run multiple operations in parallel
- Complex tasks should be broken into smaller pieces

**How it works:** Your main agent's prompt will include instructions to call sub-agents using the MCP server:
```
run_agents({ script: 'sub-agent-id \"task description\"' })
```

Sub-agents can run:
- **Sequentially**: `agent1 'task' && agent2 'task'`
- **In parallel**: `agent1 'task' & agent2 'task'`

Example: A 'code-generator' main agent might use sub-agents:
- `frontend-dev` - Handles React/Vue components
- `backend-dev` - Handles API endpoints
- `db-dev` - Handles database schemas"

**Both modes:**
"Will '{agents[n].name}' use sub-agents?

**[y/n]**"

Wait for response.

**If YES:**

"**How many sub-agents will this agent use?**

Enter number of sub-agents:"

Wait. Store as `agents[n].subAgentCount`.

For each sub-agent (1 to subAgentCount):

"**Sub-agent {s} for '{agents[n].name}'**

**Sub-agent ID** (lowercase with hyphens, must be unique):
Example: `frontend-dev`, `api-builder`

Enter sub-agent ID:"

Wait. Validate against `existing_ids`.
Store as `agents[n].subAgents[s].id`.

"**Sub-agent Name** (display name):

Enter name:"

Wait. Store as `agents[n].subAgents[s].name`.

"**What will this sub-agent do?** (brief description)

Enter description:"

Wait. Store as `agents[n].subAgents[s].description`.

"**When should '{agents[n].name}' call this sub-agent?**

Describe the trigger or condition:
Example: 'When user requests frontend work', 'After requirements are gathered'

Enter trigger:"

Wait. Store as `agents[n].subAgents[s].trigger`.

"**Execution mode for this sub-agent:**

1. **Sequential** - Wait for completion before continuing
2. **Parallel** - Can run alongside other sub-agents
3. **Conditional** - Only run based on context

Enter **1**, **2**, or **3**:"

Wait. Store as `agents[n].subAgents[s].executionMode`.

After all sub-agents for this agent:
"**Sub-agents for '{agents[n].name}':**

| Sub-agent | Trigger | Mode |
|-----------|---------|------|"

For each sub-agent:
"| {name} | {trigger} | {mode} |"

**If NO:**
Store `agents[n].subAgents = []`.

### 6. Repeat for All Agents

After each agent is fully defined (including sub-agents):
- Show summary of that agent
- If more agents remain: "Let's define agent {n+1}."
- If last agent: Proceed to filtering

### 7. Track/Condition Filtering (Optional)

If tracks or conditions were defined in step 2:

"**Agent Filtering (Optional)**

You defined tracks and/or conditions. Do you want any agents to only run for specific selections?

For example: 'frontend-agent' only runs when track is 'frontend'."

For each agent, ask:
"Should '{agent.name}' be filtered?

1. **No filtering** - Runs for all tracks/conditions
2. **Filter by track** - Only runs for specific tracks
3. **Filter by condition** - Only runs for specific conditions

Enter **1**, **2**, or **3**:"

If 2: "Which tracks? (comma-separated IDs):"
If 3: "Which conditions? (comma-separated IDs):"

Store as `agents[n].tracks` and/or `agents[n].conditions`.

### 8. Summary

"**Main Agents Summary:**

| # | ID | Name | Type | Steps | Sub-agents |
|---|-----|------|------|-------|------------|"

For each agent:
"| {n} | {id} | {name} | {single/chained} | {stepCount or 1} | {subAgentCount or 0} |"

If any agents have sub-agents:
"**Sub-agent Details:**"

For each agent with sub-agents:
"**{agent.name}** uses:
| Sub-agent | Purpose | Trigger | Mode |
|-----------|---------|---------|------|"
For each sub-agent:
"| {name} | {description} | {trigger} | {mode} |"

If any have filtering:
"**Track/Condition Filtering:**
- {agent.name}: {tracks/conditions}"

"**Totals:**
- **Main agents:** {count}
- **Chained agents:** {count with chained}
- **Sub-agents defined:** {total sub-agent count across all agents}

Main agents will be added to `config/main.agents.js`.
Sub-agents will be added to `config/sub.agents.js`.
Prompts created in `prompts/templates/{workflow_name}/`.

**Note:** Sub-agents defined here will be fully configured in Step 6. The main agent prompts will include MCP `run_agents` instructions for calling them."

## Step 3: APPEND to Plan File

**On User Confirmation:**

1. **Read** the plan file at `.codemachine/workflow-plans/{workflow_name}-plan.md`

2. **Append step-03 XML** before the closing `</workflow-plan>` tag:

```xml
<step-03 completed="true" timestamp="{ISO timestamp}">
  <agents count="{agent_count}">
    <!-- For each agent -->
    <agent id="{id}" name="{name}" description="{description}" type="{single|chained}" step-count="{count or 1}">
      <steps>
        <!-- For chained agents -->
        <step n="{n}" purpose="{purpose}" />
      </steps>
      <sub-agents count="{count or 0}">
        <!-- For each sub-agent -->
        <sub-agent id="{id}" name="{name}" description="{description}" trigger="{trigger}" execution-mode="{sequential|parallel|conditional}" />
      </sub-agents>
      <filtering tracks="{track-ids or empty}" conditions="{condition-ids or empty}" />
    </agent>
  </agents>
</step-03>
```

3. **Update the Last Updated timestamp** in the file header

4. **Update TodoWrite:**

```javascript
TodoWrite([
  { content: "Step 01: Mode Selection", status: "completed", activeForm: "Mode selection completed" },
  { content: "Step 02: Workflow Definition", status: "completed", activeForm: "Workflow definition completed" },
  { content: "Step 03: Main Agents", status: "completed", activeForm: "Main agents completed" },
  { content: "Step 04: Prompts & Placeholders", status: "in_progress", activeForm: "Creating prompts" },
  { content: "Step 05: Controller Agent", status: "pending", activeForm: "Creating controller" },
  { content: "Step 06: Sub-Agents", status: "pending", activeForm: "Configuring sub-agents" },
  { content: "Step 07: Modules", status: "pending", activeForm: "Configuring modules" },
  { content: "Step 08: Assembly & Validation", status: "pending", activeForm: "Assembling workflow" }
])
```

5. **Confirm to user:**
"✓ Agent definitions saved to workflow plan.

Press **Enter** to proceed to the next step."

{ali_step_completion}

## SUCCESS METRICS

- All agents have unique IDs (not in existing_ids)
- Each agent has ID, name, description
- Single/chained decision made for each
- Chained agents have step count and purposes defined
- Sub-agent assignments captured for agents that need them
- Sub-agent triggers and execution modes defined
- Track/condition filtering configured if applicable
- Summary reviewed and confirmed
- **Step-03 XML appended to plan file**
- **TodoWrite updated**

## FAILURE METRICS

- Allowing duplicate agent IDs (main or sub)
- Missing required fields (id, name, description)
- Not explaining single vs chained in Expert mode
- Not explaining sub-agents in Expert mode
- Skipping step purposes for chained agents
- Skipping sub-agent details when user says yes
- Proceeding without user confirmation
- **Not appending to plan file**
- **Not updating TodoWrite**
