---
name: "Step 06 - Sub-Agents Configuration"
description: "Fully configure sub-agents defined in step 3"
---

# Step 06: Sub-Agents Configuration

## STEP GOAL

Fully configure the sub-agents that were assigned to main agents in step 3:
- Create prompt content for each sub-agent
- Define mirrorPath for config
- Set up input/output expectations

## Sequence of Instructions

### 1. Check for Sub-Agents

Review sub-agents collected in step 3.

**If no sub-agents were defined:**
"**Sub-Agents Configuration**

No sub-agents were assigned to any main agents in step 3.

Would you like to add sub-agents now? **[y/n]**"

If yes: Go through sub-agent definition (similar to step 3, section 5).
If no: Skip to step completion.

**If sub-agents exist:**
"**Let's fully configure your sub-agents!**

In step 3, you defined these sub-agents:"

| Main Agent | Sub-Agent | Purpose | Trigger |
|------------|-----------|---------|---------|
For each main agent with sub-agents:
"| {mainAgent.name} | {subAgent.name} | {subAgent.description} | {subAgent.trigger} |"

"Now we'll create the full configuration and prompts for each."

### 2. Explain Sub-Agent Architecture

**In Deep mode, explain:**
"**How Sub-Agents Work:**

Sub-agents are defined in `config/sub.agents.js` with a simpler structure than main agents:

```javascript
{
  id: 'sub-agent-id',
  name: 'Sub Agent Name',
  description: 'What this sub-agent does',
  mirrorPath: 'path/to/mirror.md',
}
```

**mirrorPath** - The prompt file that defines this sub-agent's behavior. Unlike main agents, sub-agents use `mirrorPath` instead of `promptPath`.

**How main agents call sub-agents:**

The main agent uses the MCP `run_agents` tool:
```javascript
run_agents({
  script: 'sub-agent-id \"task description\"'
})
```

**Input passing:**
```javascript
run_agents({
  script: 'sub-agent-id[input:file.md] \"analyze this\"'
})
```

Sub-agents receive context from the calling agent and return their output."

### 3. Configure Each Sub-Agent

For each sub-agent defined:

"**Configuring: {subAgent.name}**

Called by: {mainAgent.name}
ID: `{subAgent.id}`
Purpose: {subAgent.description}
Trigger: {subAgent.trigger}

---

**1. Sub-Agent Persona**

What personality/expertise should this sub-agent have?

Example: 'Expert frontend developer specializing in React and accessibility'

Enter persona:"

Wait. Store as `subAgent.persona`.

"**2. Core Instructions**

What are the key things this sub-agent must do?

Enter instructions (one per line, empty line when done):"

Wait. Collect as array. Store as `subAgent.instructions`.

"**3. Input Expectations**

What input will this sub-agent receive from the main agent?

Examples:
- 'Requirements document describing the feature'
- 'Code files that need review'
- 'User story with acceptance criteria'

Enter expected input:"

Wait. Store as `subAgent.expectedInput`.

"**4. Output Format**

What should this sub-agent produce?

Examples:
- 'Generated code files with comments'
- 'Review report with issues and suggestions'
- 'Implementation plan with steps'

Enter expected output:"

Wait. Store as `subAgent.expectedOutput`.

"**5. Completion Criteria**

How does this sub-agent know when it's done?

Enter completion criteria:"

Wait. Store as `subAgent.completionCriteria`.

### 4. Generate Sub-Agent Prompt

"**Generated prompt for '{subAgent.name}':**

```markdown
---
name: '{subAgent.name}'
description: '{subAgent.description}'
---

# {subAgent.name}

## ROLE

{subAgent.persona}

## CONTEXT

You are a sub-agent called by **{mainAgent.name}**.
Trigger: {subAgent.trigger}

## INSTRUCTIONS

{for each instruction}
- {instruction}
{end for}

## INPUT

You will receive: {subAgent.expectedInput}

## OUTPUT

You must produce: {subAgent.expectedOutput}

## COMPLETION

Task is complete when: {subAgent.completionCriteria}

When finished, provide your output clearly so the calling agent can use it.
```

Does this look correct? **[y/n]**"

**If no:** Allow edits, regenerate, ask again.

**If yes:** IMMEDIATELY create the sub-agent file:
1. Create folder (if first sub-agent): `prompts/templates/{workflow_name}/sub-agents/`
2. Write file: `prompts/templates/{workflow_name}/sub-agents/{subAgent.id}.md`
3. Confirm: "✓ Created: `sub-agents/{subAgent.id}.md`"

### 5. Repeat for All Sub-Agents

After each sub-agent file is created:
- If more sub-agents: "Let's configure {next subAgent.name}."
- If last: Proceed to summary

### 6. Workflow subAgentIds

"**Workflow Sub-Agent Registration**

Sub-agents must be registered in the workflow file's `subAgentIds` array for them to be available.

```javascript
// In {workflow_name}.workflow.js
subAgentIds: [
{for each subAgent}
  '{subAgent.id}',
{end for}
],
```

This tells CodeMachine which sub-agents are part of this workflow."

### 7. Summary

"**Sub-Agents - Step 6 Complete!**

**Files Created:**"
For each sub-agent:
"✓ `sub-agents/{subAgent.id}.md`"

"**Total sub-agents:** {count}

| Sub-Agent | Called By | Input | Output |
|-----------|-----------|-------|--------|"
For each:
"| {name} | {mainAgent.name} | {expectedInput} | {expectedOutput} |"

"**Config entries to add in step 8** (for `config/sub.agents.js`):

```javascript
// ========================================
// {workflow_name} Sub-Agents
// ========================================
{for each subAgent}
{
  id: '{subAgent.id}',
  name: '{subAgent.name}',
  description: '{subAgent.description}',
  mirrorPath: path.join(promptsDir, '{workflow_name}', 'sub-agents', '{subAgent.id}.md'),
},
{end for}
```

**Workflow registration to add in step 8:**
```javascript
subAgentIds: [{subAgent IDs comma-separated}],
```

Sub-agent prompt files are ready. Config will be updated in step 8."

{ali_step_completion}

## SUCCESS METRICS

- Sub-agents folder created
- All sub-agent prompt files WRITTEN to disk
- Each sub-agent has persona, instructions, input/output expectations
- User confirmed each file before creation
- Config entries stored for step 8
- subAgentIds list prepared for workflow file

## FAILURE METRICS

- Files not actually written after confirmation
- Missing configuration for any sub-agent
- No persona or instructions defined
- Input/output expectations unclear
- Proceeding without user confirmation
