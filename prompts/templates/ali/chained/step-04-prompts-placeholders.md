---
name: "Step 04 - Prompts & Placeholders"
description: "Create prompt files and register placeholders"
---

# Step 04: Prompts & Placeholders

## STEP GOAL

Create the actual prompt files for all agents:
- Create folder structure
- Generate prompt files for each agent
- Create shared files
- Register NEW placeholders in config

## Sequence of Instructions

### 1. Introduction

"**Now let's create the prompt files for your agents.**

We'll create:
- Folder structure: `prompts/templates/{workflow_name}/`
- Main prompt file for each agent
- Chained step files for agents with multiple steps
- Shared files that can be reused across prompts
- Placeholder registrations for shared content"

### 2. Create Folder Structure

"**Creating folder structure...**"

Actually create these folders NOW:
```
prompts/templates/{workflow_name}/
├── {agent-1-id}/
│   └── chained/                  (if chained agent)
├── {agent-2-id}/
│   └── chained/                  (if chained)
└── shared/
```

After creating:
"✓ Created: `prompts/templates/{workflow_name}/`
✓ Created agent folders: {list each}
✓ Created: `prompts/templates/{workflow_name}/shared/`"

### 3. Create Main Prompt Files

For each agent defined in step 3:

"**Creating prompt for '{agent.name}'**

Let's design the prompt content. I need to understand:

**1. What is the agent's goal?**
(What should this agent accomplish?)

Enter the main goal:"

Wait. Store as `agent.goal`.

"**2. What persona/tone should this agent have?**
Examples: Professional expert, friendly guide, meticulous reviewer

Enter persona description:"

Wait. Store as `agent.persona`.

"**3. What are the key instructions this agent must follow?**
(List the main rules or behaviors)

Enter key instructions (one per line, empty line when done):"

Wait. Collect instructions as array.

**If agent has sub-agents (from step 3):**

"**4. Sub-agent Instructions**

This agent uses sub-agents. I'll include MCP `run_agents` instructions.

For each sub-agent, how should the main agent decide to call it?

**Sub-agent: {subAgent.name}**
Trigger: {subAgent.trigger}

What specific instruction should tell the agent when/how to call '{subAgent.name}'?

Enter instruction:"

Wait for each sub-agent. Store instructions.

"**5. What output should this agent produce?**
(Files, responses, artifacts?)

Enter expected output:"

Wait. Store as `agent.output`.

**Generate the prompt file:**

"**Generated prompt for '{agent.name}':**

```markdown
---
name: '{agent.name}'
description: '{agent.description}'
---

# {agent.name}

## GOAL

{agent.goal}

## PERSONA

{agent.persona}

## INSTRUCTIONS

{for each instruction}
- {instruction}
{end for}

{if has sub-agents}
## SUB-AGENT COORDINATION

You have access to the following sub-agents via MCP `run_agents` tool:

{for each subAgent}
### {subAgent.name}
- **ID**: `{subAgent.id}`
- **When to use**: {subAgent.trigger}
- **How to call**: `run_agents({ script: '{subAgent.id} \"your task description\"' })`

{end for}

**Execution patterns:**
- Sequential: `agent1 'task' && agent2 'task'` (wait for each)
- Parallel: `agent1 'task' & agent2 'task'` (run simultaneously)
{end if}

## OUTPUT

{agent.output}

{if chained}
{workflow_step_completion}
{end if}
```

Does this look correct? **[y/n]**"

**If no:** Allow edits, regenerate, ask again.

**If yes:** IMMEDIATELY write the file:
- Write to: `prompts/templates/{workflow_name}/{agent.id}/{agent.id}.md`
- Confirm: "✓ Created: `prompts/templates/{workflow_name}/{agent.id}/{agent.id}.md`"

Then proceed to next agent or chained steps.

### 4. Create Chained Step Files

For each chained agent:

"**Creating chained steps for '{agent.name}'**

This agent has {stepCount} steps. Let's create each one."

For each step (1 to stepCount):

"**Step {s}: {step.purpose}**

**What is the specific goal of this step?**

Enter step goal:"

Wait. Store as `step.goal`.

"**What instructions are specific to this step?**

Enter step instructions (one per line, empty line when done):"

Wait. Collect as array.

"**What should be completed before moving to next step?**

Enter completion criteria:"

Wait. Store as `step.completionCriteria`.

**Generate step file:**

"**Generated step-{s} for '{agent.name}':**

```markdown
---
name: 'Step {s} - {step.purpose}'
description: '{step.purpose}'
---

# Step {s}: {step.purpose}

## STEP GOAL

{step.goal}

## INSTRUCTIONS

{for each instruction}
- {instruction}
{end for}

## COMPLETION CRITERIA

{step.completionCriteria}

{workflow_step_completion}
```

Confirm? **[y/n]**"

**If no:** Allow edits, regenerate, ask again.

**If yes:** IMMEDIATELY write the file:
- Write to: `prompts/templates/{workflow_name}/{agent.id}/chained/step-{n}-{purpose}.md`
- Confirm: "✓ Created: `step-{n}-{purpose}.md`"

Repeat for each step, then proceed to next agent.

### 5. Shared Files & Placeholders

"**Shared Files**

Do you need any shared content that multiple prompts will use?

Common examples:
- Step completion instructions (like pressing Enter to proceed)
- Output format templates
- Common rules all agents follow
- Reference documentation

Would you like to create shared files? **[y/n]**"

**If YES:**

"**How many shared files do you need?**

Enter count:"

Wait. Store as `sharedFileCount`.

For each shared file:

"**Shared file {n}:**

**File name** (without .md):
Example: `step-completion`, `output-format`

Enter name:"

Wait. Store as `shared[n].name`.

"**What content should this shared file contain?**

Enter content (multiple lines, empty line when done):"

Wait. Store as `shared[n].content`.

"**Placeholder name** (how prompts will reference it):
Must be unique, lowercase with underscores.
Example: `{workflow_name}_step_completion`

Enter placeholder name:"

Wait. Validate not in existing placeholders. Store as `shared[n].placeholder`.

**Generate shared file and placeholder:**

"**Shared file: shared/{shared.name}.md**

Content:
```markdown
{shared.content}
```

**Placeholder registration** (will be added to `config/placeholders.js`):
```javascript
packageDir: {
  {shared.placeholder}: path.join('prompts', 'templates', '{workflow_name}', 'shared', '{shared.name}.md'),
}
```

Prompts can now use `{{shared.placeholder}}` to include this content.

Confirm? **[y/n]**"

**If no:** Allow edits, regenerate, ask again.

**If yes:** IMMEDIATELY write the file:
- Write to: `prompts/templates/{workflow_name}/shared/{shared.name}.md`
- Confirm: "✓ Created: `shared/{shared.name}.md`"
- Store placeholder info for config update in step 8

Repeat for each shared file.

**If user said NO to shared files:** Skip this section.

### 6. Summary

"**Prompts & Placeholders - Step 4 Complete!**

**Files Created:**"

For each agent:
"✓ `{agent.id}/{agent.id}.md`"
If chained:
"  ✓ `{agent.id}/chained/step-01-{purpose}.md`"
"  ✓ `{agent.id}/chained/step-02-{purpose}.md`"
etc.

If shared files:
"**Shared files created:**"
For each shared:
"✓ `shared/{shared.name}.md` → placeholder: `{shared.placeholder}`"

"**Total files created this step:** {count}
**Placeholders to register in step 8:** {count}

Main agent prompts are ready. Next steps will create controller, sub-agents, and modules if needed."

{ali_step_completion}

## SUCCESS METRICS

- Folder structure created
- All main agent prompt files WRITTEN to disk
- All chained step files WRITTEN to disk
- All shared files WRITTEN to disk
- Sub-agent instructions included where needed
- Placeholders stored for config update in step 8
- User confirmed each file before creation

## FAILURE METRICS

- Files not actually written after confirmation
- Missing prompt files for any agent
- Chained agents missing step files
- Sub-agent instructions not included
- Duplicate placeholder names
- Using existing placeholder names (must create NEW)
- Proceeding without confirmation
