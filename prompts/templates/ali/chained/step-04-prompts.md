---
name: "Step 04 - Prompts"
description: "Create prompt files and register placeholders"
---

# Step 04: Prompts

## STEP GOAL

Create the actual prompt files for all agents:
- Create folder structure
- Generate prompt files for each agent
- Define input and output for each agent
- Create shared files
- Register NEW placeholders in config

**🎯 GUIDE USER TO CORRECT STEP:** If user asks about something that belongs to a later step (e.g., workflow generation), guide them to proceed step-by-step. Say: "Great question! We'll cover that in Step {X}. Let's finish prompts first, then press **Enter** to continue."

## Track-Based Behavior

**Check `{selected_track}` and adapt accordingly:**

---

**`create-workflow`:** Execute full sequence below - create all prompt files from scratch.

---

**`modify-workflow`:**
- Plan file already has existing prompts from `<step-04>`
- Show current prompts configuration
- Ask: "What do you want to modify?" (edit specific prompt, add new prompt, update placeholders, modify shared files)
- Only update the requested files
- Re-validate and update plan file

---

**`have-questions`:**
- Q&A mode only - answer questions about prompt concepts
- Topics: persona vs workflow vs chained prompts, placeholders, shared files, prompt engineering best practices
- Do NOT create or modify anything
- After answering, tell user: "Press **Enter** to proceed to the next step, or ask more questions."

---

## Sequence of Instructions (create-workflow / modify-workflow)

### 1. Introduction

"**Now let's create the prompt files for your agents.**

**File Structure per Agent:**

| Agent Type | Files Created |
|------------|---------------|
| **Single-step** | `persona.md` + `prompt.md` |
| **Multi-step** | `persona.md` + `workflow.md` + `chained/step-01.md`, `step-02.md`, ... |

---

**Main Agent Prompts:**"

| Agent | Type | Steps | Files |
|-------|------|-------|-------|
| \{agent.name\} | \{type\} | \{N\} | \{files list\} |

*[If modules exist in context:]*
"**Module Prompts:**"

| Module | Validation Focus | Steps | Files |
|--------|------------------|-------|-------|
| \{module.name\} | \{module.validationFocus\} | \{N\} | \{files list\} |

*[If controller exists in context:]*
"**Controller Prompt:**
- \{controller.name\} - persona + prompt"

*[If static sub-agents exist in context:]*
"**Static Sub-Agent Prompts:**"

| Sub-Agent | Parent | Files |
|-----------|--------|-------|
| \{subAgent.name\} | \{agent.name\} | mirror.md |

"**Total: \{count\} files.**

Do you have any questions, or shall we start?"

Wait for user response. If questions, answer them.

**On user confirmation ("start" / "ready" / "yes"):**

Create folder structure and empty files:

```
prompts/templates/\{workflow_name\}/
├── shared/
│   └── system-rules.md           ← REQUIRED: Always created first
├── \{agent-id\}/
│   ├── persona.md
│   ├── prompt.md                 (if single-step)
│   ├── workflow.md               (if multi-step)
│   └── chained/                  (if multi-step)
│       ├── step-01-\{purpose\}.md
│       └── step-02-\{purpose\}.md
```

*[If modules exist:]*
```
├── \{module-id\}/
│   ├── persona.md
│   ├── workflow.md
│   └── chained/
│       └── step-XX-\{purpose\}.md
```

*[If controller exists:]*
```
├── controller/
│   ├── persona.md
│   └── prompt.md
```

*[If static sub-agents exist:]*
```
└── sub-agents/
    └── \{subAgent-id\}.md
```

After creating, confirm:

"✓ Folders and empty files created:
- `prompts/templates/\{workflow_name\}/`
- \{list all folders and files created\}

Now let's fill in the content for each file."

### 2. Agent Context & Placeholders

For each agent (starting with agent 1):

---

**Agent 1 (First Agent):**

"**Context for '\{agent.name\}':**

Based on what this agent does:
- **Description:** \{agent.description\}
- **Expected Behavior:** \{agent.expectedBehavior\}

**My recommendation:**

I think because '\{agent.name\}' is \{summarize role from description/behavior\}, it will need:

\{generate recommendations based on agent type, e.g.:\}

*[If agent does planning/discovery:]*
- **\{project_name\}** - valuable to know the project context
- **\{selected_track\}** and **\{selected_conditions\}** - to tailor output to user's choices

*[If agent does code generation:]*
- **specification** - to understand requirements
- A shared **output-template** - to ensure consistent code structure

*[If agent does review/validation:]*
- **success criteria reference** - to know what to check against
- Previous agent's output - to have something to review

*[If agent is first in workflow with spec enabled:]*
- **specification** - since this is the first agent, injecting the spec file gives full context upfront

You might also inject:
- \{suggest relevant shared file based on agent purpose\}

---

**Does this recommendation look right, or do you want to adjust?**

1. Accept recommendation
2. Add more context
3. Remove some context
4. Start fresh (I'll ask questions)

Enter choice:"

Wait for response.

**If 1 (accept):** Store recommended placeholders, proceed to split question.

**If 2 (add more):**
"What additional context should this agent have?"
Wait. Add to list.

**If 3 (remove):**
"Which items should I remove?"
Wait. Remove from list.

**If 4 (start fresh):**
"**What context does this agent need?**

| Source | Description |
|--------|-------------|
| Built-in | \{date\}, \{project_name\}, \{selected_track\}, \{selected_conditions\} |
| Spec file | \{specification\} (if enabled) |
| Shared files | Templates, rules, reference docs |

Enter sources (e.g., 'project_name, specification'):"

Wait. Store selections.

---

**Agent 2+ (Non-First Agents):**

"**Context for '\{agent.name\}':**

Based on what this agent does:
- **Description:** \{agent.description\}
- **Expected Behavior:** \{agent.expectedBehavior\}

**Previous agent:** \{prev.name\} - \{prev.description\}

**My recommendation:**

I think because '\{agent.name\}' is \{summarize role\}, it will need:

- **\{prev.id\}_output** - output from '\{prev.name\}' so it can \{reason why it needs previous output\}

\{additional recommendations based on agent type\}

*[If agent builds on previous work:]*
It's valuable for '\{agent.name\}' to know what '\{prev.name\}' produced, so I recommend chaining their outputs.

*[If agent does validation/review:]*
Since this agent validates/reviews, it definitely needs the previous agent's output to check.

*[If agent is independent:]*
This agent seems independent from '\{prev.name\}'. You might not need to chain them, but let me know if you want to.

You might also inject:
- \{suggest relevant shared files or built-ins\}

---

**Does this recommendation look right?**

1. Accept recommendation
2. Add more context
3. Remove some context
4. Don't chain from previous agent
5. Start fresh

Enter choice:"

Wait for response. Handle same as agent 1, plus:

**If 4 (don't chain):**
"Understood. '\{agent.name\}' won't receive output from previous agents."
Remove previous agent output from list.

---

**For all agents, after context decided:**

"**What output does '\{agent.name\}' produce?**

Since agents are isolated and can't see each other's work, we need to define what this agent outputs so the next agent can receive it.

*[If agent produces artifacts/plans/code:]*
I recommend: `.codemachine/artifacts/\{agent.id\}-output.md`

*[If Q&A/interactive agent that only collects info:]*
This agent collects user input - it may not need a file output if the next agent can access conversation context.

**Output filename** (or 'none' for Q&A agents):"

Wait. Store as `agent.outputFile`.

*[If output file specified, confirm placeholder:]*
"This will be registered as placeholder `\{agent_id\}_output` for the next agent to receive."

---

"**Should this agent's prompt be split into smaller files?**

Based on '\{agent.name\}', I \{recommend/don't recommend\} splitting because \{reasoning\}.

*[If complex agent with many responsibilities:]*
I recommend splitting into:
- **instructions** - core task instructions
- **output-format** - expected output structure

*[If simple focused agent:]*
A single file should be fine for this agent.

**Split prompt?** [y/n]"

Wait for response. If yes and no recommendation given:

"What parts? (e.g., instructions, output-format, examples, rules):"

Wait. Store as `agent.promptParts[]`.

---

**After configuring this agent:**

"**'\{agent.name\}' context configured:**

| Setting | Value |
|---------|-------|
| Receives from | \{prev agent or 'none (first agent)'\} |
| Placeholders | \{list\} |
| Shared files | \{list or 'none'\} |
| Split parts | \{list or 'single file'\} |

*[If more agents:]*
Moving to '\{next_agent.name\}'..."

---

*[Repeat for each agent]*

---

**After all agents configured:**

"**Context Summary:**"

| Agent | Input Type | Input Source | Output File | Output Placeholder |
|-------|------------|--------------|-------------|-------------------|
| \{agent1\} | \{type\} | \{source or '-'\} | \{file\} | \{placeholder\} |
| \{agent2\} | placeholder | \{agent1_output\} | \{file\} | \{placeholder\} |

*[Show data flow visually:]*

"**Data Flow:**
```
\{agent1\} → writes \{output-file\} → registered as \{placeholder\}
     ↓
\{agent2\} → receives \{placeholder\} → writes \{output-file\} → registered as \{placeholder\}
     ↓
\{agent3\} → receives \{placeholder\} → ...
```"

*[If any agent has no input defined (except first agent):]*
"**Note:** The following agents have no input defined - they won't receive context from previous agents:
- \{list\}

Is this intentional? (Q&A agents may not need input from previous agents)"

"**Shared files to create:**"
- \{deduplicated list\}

"**Placeholders to register:**"
- userDir: \{agent output chains\}
- packageDir: \{shared files\}

"Now let's create the prompt content."

Proceed to section 3.

### 3. Create Prompt Files

For each agent (continuing from Part 2 context configuration):

---

**"Now let's create the prompt files for '\{agent.name\}'."**

---

#### 3.1 Persona

"**First, let's define the persona.**

Based on Step 03:
- **Description:** \{agent.description\}
- **Expected Behavior:** \{agent.expectedBehavior\}

I'll draft a persona. Here's what I'm thinking:

**Role:** \{suggest role from description\}
**Identity:** \{suggest identity from expectedBehavior\}
**Communication Style:** \{suggest style from expectedBehavior\}
**Principles:** \{suggest from failureIndicators - what to avoid\}

Does this direction sound right, or should I adjust before drafting? **[y/n/adjust]**"

Wait for response.

**If adjust:** "What should I change?" Wait. Update direction.

**If y or ready:**

"**Generated persona.md:**

```markdown
---
name: '\{agent.name\}'
description: '\{agent.description\}'
---

# \{agent.name\}

<persona>

## Role

\{role description\}

## Identity

\{identity description\}

## Communication Style

\{communication style\}

## Principles

\{list of principles derived from failureIndicators\}

</persona>
```

**Does this look good?** [y/n]"

Wait for response.

**If no:** "What should I change?" Wait. Regenerate. Ask again.

**If yes:** Write to `prompts/templates/\{workflow_name\}/\{agent.id\}/persona.md`
"✓ Created: `\{agent.id\}/persona.md`"

---

#### 3.2 Main Prompt (Single-Step) OR Workflow (Multi-Step)

*[If single-step agent:]*

"**Now let's create the main prompt.**

**What specific instructions should '\{agent.name\}' follow?**

These are actionable rules. I'll suggest some based on the role:
\{generate suggestions based on agent type\}

Add, remove, or modify these instructions:"

Wait. Collect final instructions.

"**What output should this agent produce?**

Based on the role, I suggest: \{suggestion\}

Adjust or confirm:"

Wait. Store output.

"**Generated prompt.md:**

```markdown
---
name: '\{agent.name\} Prompt'
description: '\{agent.description\}'
---

# \{agent.name\}

\{if receives from previous agent\}
## CONTEXT

\{\{\{prev_agent\}_output\}\}
\{end if\}

\{if has other placeholders\}
\{for each placeholder\}
\{\{\{placeholder_name\}\}\}
\{end for\}
\{end if\}

## GOAL

\{goal from description/expectedBehavior\}

## INSTRUCTIONS

\{for each instruction\}
- \{instruction\}
\{end for\}

\{if has sub-agents\}
## SUB-AGENT COORDINATION

You can invoke the following sub-agents during execution:

\{for each subAgent of this agent\}
### \{subAgent.name\} (`\{subAgent.id\}`)

**Description:** \{subAgent.description\}
**Type:** \{Static (pre-defined prompt) | Dynamic (you generate at runtime)\}
\{if static\}
**Trigger:** When you need \{subAgent.expectedOutput\}
\{end if\}
\{if dynamic\}
**Trigger Condition:** \{subAgent.triggerCondition\}
**Generation Instructions:** \{subAgent.generationInstructions\}
\{end if\}

\{end for\}

### How to Invoke Sub-Agents

**Option 1: MCP Tools (Recommended)**
```
1. list_available_agents - See available agents
2. run_agents { "script": "\{subAgent.id\} 'your task'" } - Execute
3. get_agent_status { "name": "\{subAgent.id\}" } - Check results
```

**Option 2: CLI Syntax**
```bash
codemachine run "\{subAgent.id\}[options] 'your task'"
```

**Options:**
- `input:file.md` - Pass file content to sub-agent
- `input:f1.md;f2.md` - Multiple input files
- `tail:100` - Limit output lines

**Orchestration Patterns:**
- `&` - Run sub-agents in parallel (independent tasks)
- `&&` - Run sequentially (output feeds next)
- `a && b & c` - a first, then b and c in parallel

\{if has dynamic subAgents\}
### Dynamic Sub-Agent Generation

For dynamic sub-agents, create the prompt file at runtime:
1. Write prompt to `.codemachine/agents/\{subAgent.id\}.md`
2. Then invoke the sub-agent using MCP or CLI
\{end if\}

\{end if\}

## OUTPUT

\{agent.output\}

\{if outputs to next agent\}
**Write output to:** `.codemachine/artifacts/\{agent.id\}-output-*.md`
\{end if\}

## SUCCESS CRITERIA

\{agent.successIndicators\}

## AVOID (Failure Indicators)

\{agent.failureIndicators\}
```

**Does this look good?** [y/n]"

Wait for response.

**If no:** "What should I change?" Wait. Regenerate. Ask again.

**If yes:** Write to `prompts/templates/\{workflow_name\}/\{agent.id\}/prompt.md`
"✓ Created: `\{agent.id\}/prompt.md`

'\{agent.name\}' complete! Moving to next agent..."

---

*[If multi-step agent:]*

"**Now let's create the workflow file.**

This provides context that persists across all \{stepCount\} steps.

**What instructions should apply to ALL steps?**

I'll suggest some based on the role:
\{generate suggestions\}

Add, remove, or modify:"

Wait. Collect final instructions.

"**Generated workflow.md:**

**CRITICAL: workflow.md is loaded at agent start via `promptPath` array (alongside persona.md). It is NOT a chained step. NEVER put workflow.md in `chainedPromptsPath`.**

```markdown
---
name: '\{agent.name\} Workflow'
description: '\{agent.description\}'
---

\{system_rules\}

# \{agent.name\} Workflow

## YOUR MISSION

\{agent's mission in the pipeline\}

\{if receives from previous agent\}
## INPUT

You receive output from the previous agent:

\{\{\{prev_agent\}_output\}\}
\{end if\}

\{if has other placeholders\}
\{for each placeholder\}
\{\{\{placeholder_name\}\}\}
\{end for\}
\{end if\}

## STEP 0: GREET AND WAIT

This is your Step 0. You have NOT received your first working step yet.

**DISPLAY THIS MESSAGE:**

"\{greeting - introduce yourself, explain your role in the pipeline, list your steps in a table\}

Press **Enter** to start."

**THEN STOP. Do not start working. Wait for Enter.**

## WORKFLOW OVERVIEW

| Step | Name | Purpose |
|------|------|---------|
\{for each step\}
| \{n\} | \{step.name\} | \{step.purpose\} |
\{end for\}

## OUTPUT

\{if outputs to next agent\}
At the end of Step \{lastStep\}, write output to `.codemachine/artifacts/\{agent.id\}-output.md`
\{end if\}

## RULES

\{for each instruction\}
- \{instruction\}
\{end for\}

\{if has sub-agents\}
## SUB-AGENT COORDINATION

\{sub-agent details from step 03\}
\{end if\}
```

**Does this look good?** [y/n]"

Wait for response.

**If no:** "What should I change?" Wait. Regenerate. Ask again.

**If yes:** Write to `prompts/templates/\{workflow_name\}/\{agent.id\}/workflow.md`
"✓ Created: `\{agent.id\}/workflow.md`

Now let's create each step file."

---

#### 3.3 Chained Steps (Multi-Step Agents Only)

**YAML Frontmatter**

Every step file must begin with YAML frontmatter. It's used by the TUI and all prompts:

```yaml
---
name: "Step 01 - Mode Selection & Brainstorming"
description: "Choose mode (Deep/MVP) and optionally brainstorm workflow ideas"
---
```

- **name**: The step title displayed in the TUI (format: "Step XX - Purpose")
- **description**: Brief description of what the step does

---

*[For each step (1 to stepCount):]*

"**Step \{n\} of \{stepCount\}: \{step.purpose\}**

From Step 03, this step's purpose is: **\{step.purpose\}**

**What is the specific goal of this step?**

I suggest: \{generate suggestion based on purpose\}

Adjust or confirm:"

Wait. Store step goal.

"**What instructions are specific to THIS step only?**

(Don't repeat workflow-level instructions)

Enter step-specific instructions:"

Wait. Collect as array.

"**What must be completed before moving to next step?**

I suggest based on the purpose: \{suggestion\}

Adjust or confirm:"

Wait. Store completion criteria.

"**Generated step-\{nn\}-\{purpose\}.md:**

**CRITICAL: Every step must have scripted messages (exact text to display) and end with "Press Enter to continue" + STOP, except the last step of the agent.**

```markdown
---
name: 'Step \{n\} - \{step.purpose\}'
description: '\{step.purpose\}'
---

# Step \{n\}: \{step.purpose\}

## STEP GOAL

\{step.goal\}

## DISPLAY THIS MESSAGE FIRST:

"\{exact scripted message to show the user - not generic, specific to this step\}"

## AFTER USER RESPONDS:

\{exact logic for processing user response\}
\{validation rules - when to push back, when to accept\}
\{follow-up question rules - exact questions to ask in specific situations\}

## WHEN STEP IS COMPLETE:

\{if not last step\}
DISPLAY: "\{transition message summarizing what was captured\}

Press **Enter** to continue."

**THEN STOP COMPLETELY. Do not continue. Do not start next step's work. Wait for the system to inject the next step.**
\{end if\}

\{if last step and outputs to next agent\}
\{write output file instructions\}

DISPLAY: "\{completion summary\}

\{agent.name\} complete. Handing off to the next phase."
\{end if\}

\{if last step and last agent\}
\{deliver final output to user\}
\{end if\}

## DO NOT:

\{step-specific forbidden behaviors\}
```

**Does this look good?** [y/n]"

Wait for response.

**If no:** "What should I change?" Wait. Regenerate. Ask again.

**If yes:** Write to `prompts/templates/\{workflow_name\}/\{agent.id\}/chained/step-\{nn\}-\{purpose\}.md`
"✓ Created: `\{agent.id\}/chained/step-\{nn\}-\{purpose\}.md`"

*[If more steps:]*
"Moving to step \{n+1\}..."

*[If last step:]*
"✓ All \{stepCount\} steps created for '\{agent.name\}'!

'\{agent.name\}' complete! Moving to next agent..."

---

*[Repeat Part 2 + Part 3 for each agent]*

---

**After all main agents complete:**

"**All main agent prompts created!**

| Agent | Files Created |
|-------|---------------|
\{for each agent\}
| \{agent.name\} | persona.md, \{prompt.md or workflow.md + N steps\} |
\{end for\}

*[If modules exist in context:]* Proceeding to module prompts..."

*[If no modules:]* "Proceeding to sub-agents (if any)..."

---

### 3.4 Module Prompts (If Modules Exist)

*[Skip this entire section if no modules were defined in Step 03]*

"**Now let's create prompts for your modules.**

Modules are special agents that can **loop the workflow back** to previous steps. This requires careful directive writing."

**For each module defined in Step 03:**

---

"**Module: '\{module.name\}'**

From Step 03:
- **Validation Focus:** \{module.validationFocus\}
- **Loop Trigger:** \{module.loopTrigger\}
- **Steps Back:** \{module.loopSteps\}
- **Max Iterations:** \{module.loopMaxIterations\}
- **Skip Agents:** \{module.loopSkip or 'none'\}

**⚠️ CRITICAL: Directive Writing**

Modules control workflow execution by writing to `.codemachine/memory/directive.json`. This is how the module tells the system what to do next.

**The directive file format:**
```json
{
  "action": "loop" | "stop",
  "reason": "explanation of why this action was chosen",
  "target": "agent-id to loop back to (only for loop action)"
}
```

**Actions:**
- `loop` - Go back to a previous agent and re-run from there
- `stop` - Continue forward in the workflow (validation passed)

I'll create prompts that include these directive instructions."

---

#### 3.4.1 Module Persona

"**Module Persona for '\{module.name\}':**

Based on its validation focus (\{module.validationFocus\}), I'll draft a persona:

**Role:** \{suggest validator/reviewer role\}
**Identity:** \{suggest identity focused on quality/validation\}
**Communication Style:** \{suggest style - typically precise, critical\}
**Principles:** \{suggest from loopTrigger - what triggers failure\}

Does this direction sound right? **[y/n/adjust]**"

Wait for response.

**If adjust:** "What should I change?" Wait. Update direction.

**If y or ready:**

"**Generated persona.md for module:**

```markdown
---
name: '\{module.name\}'
description: '\{module.description\}'
type: 'module'
---

# \{module.name\}

<persona>

## Role

\{role description - focused on validation/review\}

## Identity

\{identity description - quality gatekeeper\}

## Communication Style

\{communication style - precise, critical\}

## Principles

\{list of principles from loopTrigger and failureIndicators\}

</persona>
```

**Does this look good?** [y/n]"

Wait for response.

**If no:** "What should I change?" Wait. Regenerate.

**If yes:** Write to `prompts/templates/\{workflow_name\}/\{module.id\}/persona.md`
"✓ Created: `\{module.id\}/persona.md`"

---

#### 3.4.2 Module Workflow/Prompt

*[If module is multi-step, create workflow.md. If single-step, create prompt.md]*

"**Module \{type\} for '\{module.name\}':**

This is the critical part - the module needs clear instructions on:
1. What to validate
2. When to loop vs continue
3. How to write the directive file

**Generated \{workflow.md or prompt.md\}:**

```markdown
---
name: '\{module.name\} \{Workflow or Prompt\}'
description: '\{module.description\}'
type: 'module'
---

# \{module.name\}

## CONTEXT

\{if receives from previous agent\}
\{\{\{prev_agent\}_output\}\}
\{end if\}

## GOAL

\{module.validationFocus\}

Validate the work from previous agents and decide whether to:
- **LOOP** - Send workflow back \{module.loopSteps\} step(s) if issues found
- **CONTINUE** - Proceed forward if validation passes

## VALIDATION CRITERIA

**Pass Conditions (continue forward):**
\{generate from successIndicators\}

**Fail Conditions (loop back):**
\{generate from loopTrigger and failureIndicators\}

## INSTRUCTIONS

1. Review the output from previous agent(s)
2. Check against validation criteria
3. Make a clear PASS or FAIL decision
4. Write the directive file with your decision

\{if has additional instructions\}
\{additional module-specific instructions\}
\{end if\}

## ⚠️ DIRECTIVE WRITING (CRITICAL)

**You MUST write to `.codemachine/memory/directive.json` at the end of your execution.**

**If validation PASSES:**
```json
{
  "action": "stop",
  "reason": "Validation passed: [specific reasons why work is acceptable]"
}
```

**If validation FAILS:**
```json
{
  "action": "loop",
  "reason": "Validation failed: [specific issues found]",
  "target": "\{target_agent_id\}"
}
```

**Rules:**
- ALWAYS write the directive file - the workflow cannot proceed without it
- Be specific in your reason - it helps the looped agent understand what to fix
- Maximum \{module.loopMaxIterations\} iterations allowed - after that, workflow continues regardless
\{if module.loopSkip\}
- When looping, these agents will be SKIPPED: \{module.loopSkip\}
\{end if\}

## OUTPUT FORMAT

1. **Analysis:** Brief summary of what you reviewed
2. **Findings:** Specific issues found (if any)
3. **Decision:** PASS or FAIL with clear reasoning
4. **Directive:** The JSON directive you wrote

\{if module.successIndicators\}
## SUCCESS INDICATORS

\{module.successIndicators\}
\{end if\}

\{if module.failureIndicators\}
## FAILURE INDICATORS

\{module.failureIndicators\}
\{end if\}
```

**Does this look good?** [y/n]"

Wait for response.

**If no:** "What should I change?" Wait. Regenerate.

**If yes:** Write to `prompts/templates/\{workflow_name\}/\{module.id\}/\{workflow.md or prompt.md\}`
"✓ Created: `\{module.id\}/\{workflow.md or prompt.md\}`"

---

#### 3.4.3 Module Chained Steps (If Multi-Step Module)

*[Same process as section 3.3, but ensure each step includes context about the module's validation purpose]*

*[For the LAST step of a multi-step module, include the directive writing instructions]*

---

*[Repeat 3.4.1-3.4.3 for each module]*

**After all modules complete:**

"**All module prompts created!**

| Module | Validation Focus | Files |
|--------|------------------|-------|
\{for each module\}
| \{module.name\} | \{module.validationFocus\} | persona.md, \{prompt.md or workflow.md + steps\} |
\{end for\}

Proceeding to sub-agents (if any)..."

---

### 3.5 Static Sub-Agent Prompts (If Static Sub-Agents Exist)

*[Skip this entire section if no static sub-agents were defined in Step 03]*

"**Now let's create prompts for your static sub-agents.**

Static sub-agents have pre-defined prompt files (mirror files) that are used when the parent agent invokes them."

**For each static sub-agent defined in Step 03:**

---

"**Static Sub-Agent: '\{subAgent.name\}'**

From Step 03:
- **Parent Agent:** \{subAgent.parentAgent\}
- **Description:** \{subAgent.description\}
- **Persona:** \{subAgent.persona\}
- **Expected Input:** \{subAgent.expectedInput\}
- **Expected Output:** \{subAgent.expectedOutput\}

**Generated mirror file: sub-agents/\{subAgent.id\}.md**

```markdown
---
name: '\{subAgent.name\}'
description: '\{subAgent.description\}'
parent: '\{subAgent.parentAgent\}'
type: 'sub-agent'
---

# \{subAgent.name\}

## PERSONA

\{subAgent.persona\}

## EXPECTED INPUT

\{subAgent.expectedInput\}

## INSTRUCTIONS

\{for each instruction in subAgent.instructions\}
- \{instruction\}
\{end for\}

## EXPECTED OUTPUT

\{subAgent.expectedOutput\}

## SUCCESS INDICATORS

\{subAgent.successIndicators\}

## FAILURE INDICATORS

\{subAgent.failureIndicators\}
```

**Does this look good?** [y/n]"

Wait for response.

**If no:** "What should I change?" Wait. Regenerate.

**If yes:** Write to `prompts/templates/\{workflow_name\}/sub-agents/\{subAgent.id\}.md`
"✓ Created: `sub-agents/\{subAgent.id\}.md`"

---

*[Repeat for each static sub-agent]*

**After all static sub-agents complete:**

"**All static sub-agent prompts created!**

| Sub-Agent | Parent | Mirror File |
|-----------|--------|-------------|
\{for each static subAgent\}
| \{subAgent.name\} | \{subAgent.parentAgent\} | sub-agents/\{subAgent.id\}.md |
\{end for\}

**Note:** Dynamic sub-agents do not have pre-defined prompts - they are generated at runtime by their parent agent in `.codemachine/agents/`."

---

### 3.6 Controller Prompt (If Controller Exists)

*[Skip this entire section if no controller was defined in Step 03]*

"**Now let's create the controller prompt.**

The controller is the brain of autonomous execution - it responds on behalf of the user and drives the entire workflow."

---

"**Controller: '\{controller.name\}'**

From Step 03:
- **Description:** \{controller.description\}
- **Response Length:** \{controller.responseLength\}
- **Pacing:** \{controller.pacing\}
- **Loop Depth:** \{controller.loopDepth\}
- **Total Turn Limit:** \{controller.totalTurnLimit\}

**Agent Interactions:**"

| Agent | Expected Output | Max Turns | Approval Criteria |
|-------|-----------------|-----------|-------------------|
\{for each interaction\}
| \{agent.name\} | \{interaction.expectedOutput\} | \{interaction.maxTurns\} | \{interaction.approvalCriteria\} |
\{end for\}

---

#### 3.6.1 Controller Persona

"**Generated persona.md for controller:**

```markdown
---
name: '\{controller.name\}'
description: '\{controller.description\}'
role: 'controller'
---

# \{controller.name\}

<persona>

## Role

Autonomous workflow controller that responds on behalf of the user and drives agent execution.

## Identity

\{identity based on controller.description\}

## Communication Style

\{based on controller.responseLength\}
- \{if minimal\} Concise, decision-focused. 1-2 sentences max.
- \{if brief\} Brief explanations with key reasoning only.
- \{if detailed\} Full explanation of reasoning and decisions.

## Principles

- Drive the workflow efficiently within \{controller.totalTurnLimit\} total turns
- Apply \{controller.pacing\} review approach
- Allow up to \{controller.loopDepth\} iterations for quality
- Approve work that meets criteria, request changes otherwise
- Never waste tokens on unnecessary back-and-forth

</persona>
```

**Does this look good?** [y/n]"

Wait for response.

**If no:** "What should I change?" Wait. Regenerate.

**If yes:** Write to `prompts/templates/\{workflow_name\}/controller/persona.md`
"✓ Created: `controller/persona.md`"

---

#### 3.6.2 Controller Prompt

"**Generated prompt.md for controller:**

```markdown
---
name: '\{controller.name\} Prompt'
description: 'Autonomous controller for \{workflow_name\} workflow'
role: 'controller'
---

# \{controller.name\}

## ROLE

You are the autonomous controller for the **\{workflow_name\}** workflow. You respond on behalf of the user, driving agents through the workflow until completion.

## WORKFLOW CONTEXT

**Tracks Available:**
\{if tracks\}
\{for each track\}
- `\{track.id\}`: \{track.description\}
\{end for\}
\{else\}
No tracks defined - single path workflow.
\{end if\}

**Conditions Available:**
\{if conditions\}
\{for each condition\}
- `\{condition.id\}`: \{condition.description\}
\{end for\}
\{else\}
No conditions defined.
\{end if\}

## AGENT INTERACTIONS

\{for each interaction\}
### \{agent.name\} (`\{agent.id\}`)

**Expected Output:** \{interaction.expectedOutput\}
**Output Length:** \{interaction.outputLength\}
**Output Format:** \{interaction.outputFormat\}
**Max Turns:** \{interaction.maxTurns\}

**Approval Criteria:**
\{interaction.approvalCriteria\}

**Guidance:**
\{interaction.guidance\}

**Expected Behavior:**
\{interaction.expectedBehavior\}

**Success Indicators:**
\{interaction.successIndicators\}

**Failure Indicators:**
\{interaction.failureIndicators\}

---
\{end for\}

## BEHAVIOR RULES

1. **Pacing:** \{controller.pacing\}
   \{if quick\} Approve fast, minimal review, trust agents
   \{if balanced\} Review key decisions, spot-check work
   \{if thorough\} Deep review everything, detailed feedback

2. **Loop Depth:** \{controller.loopDepth\}
   \{if minimal\} 1-2 iterations max, accept good-enough
   \{if standard\} 3-5 iterations, aim for quality
   \{if deep\} Up to max turns, high standards

3. **Turn Limit:** \{controller.totalTurnLimit\} total turns across all agents

## RESPONSE FORMAT

Keep responses \{controller.responseLength\}:
\{if minimal\} 1-2 sentences. Just the decision and next action.
\{if brief\} Short paragraph. Key reasoning only.
\{if detailed\} Full explanation of reasoning.

## DECISION MAKING

For each agent interaction:
1. Review agent output against success indicators
2. Check for failure indicators
3. If success → approve and continue
4. If failure → request specific changes (up to max turns)
5. Track total turns across workflow
```

**Does this look good?** [y/n]"

Wait for response.

**If no:** "What should I change?" Wait. Regenerate.

**If yes:** Write to `prompts/templates/\{workflow_name\}/controller/prompt.md`
"✓ Created: `controller/prompt.md`

Controller prompts complete!"

---

**After all prompt types complete:**

Proceed to section 4.

### 4. Shared Files & Placeholders

"**System Rules File (Required)**

Every workflow needs a `system-rules.md` that teaches agents how the workflow system works. I'm generating this automatically."

**ALWAYS generate `shared/system-rules.md` - this is NOT optional:**

Write to `prompts/templates/\{workflow_name\}/shared/system-rules.md`:

```markdown
---
name: 'System Rules'
description: 'Mandatory system rules for all agents in the \{Workflow Name\} workflow.'
---

# SYSTEM RULES (READ BEFORE ANYTHING ELSE)

You are an agent inside the **CodeMachine Workflow System**. You do NOT control the flow. The system does.

## HOW THE SYSTEM WORKS

1. You are **one agent** in a pipeline of \{N\} agents: **\{Agent1\} → \{Agent2\} → ... → \{AgentN\}**
2. Each agent has **multiple steps** (chained prompts). You receive them one at a time
3. **You do NOT advance steps yourself.** The system injects the next step when the user presses Enter
4. **You do NOT decide when to move on.** You complete your current step, tell the user to press Enter, and STOP

## YOUR STEPS

When you start, you are on **Step 0** (this prompt). You have NOT received your first step yet.

| What You See | What It Means |
|-------------|---------------|
| This prompt (persona + workflow) | **Step 0** - You just arrived. Greet the user and explain what you'll do |
| A new prompt injected after user presses Enter | **Step 1, 2, 3...** - The system gave you your next step. Execute it |

## STEP 0: WHAT TO DO RIGHT NOW

Your first action is to introduce yourself and explain your role in the pipeline.
Then say "Press **Enter** to start." and STOP. Do not do anything else.

## CRITICAL RULES FOR EVERY STEP

### Rule 1: One Step at a Time
- Complete ONLY what that step asks for
- Do NOT do work from future steps
- Do NOT combine steps

### Rule 2: You Do NOT Control Step Transitions
- When a step is complete, tell the user: **"Press Enter to continue."**
- Then **STOP COMPLETELY**
- The system will inject the next step's prompt

### Rule 3: Stay In Your Lane
- You are ONE agent. Do not do another agent's job
\{list each agent and their lane\}

### Rule 4: The Prompt IS Your Instructions
- Follow the prompt's instructions exactly as written
- Display the exact messages it tells you to display
- Do NOT improvise or add your own messages

### Rule 5: Output Files Are Sacred
- Write output files EXACTLY as specified in the step
- Use the EXACT file path and format given
- Do NOT write output before the step tells you to

## FORBIDDEN BEHAVIORS
- Starting work before your first step prompt arrives
- Doing multiple steps in one response
- Skipping the "press Enter" instruction at the end of a step
- Working on things outside your agent's scope
- Improvising messages instead of following the script
```

Register placeholder in `config/placeholders.js`:
```javascript
packageDir: \{
  system_rules: path.join('prompts', 'templates', '\{workflow_name\}', 'shared', 'system-rules.md'),
\}
```

Confirm: "✓ Created: `shared/system-rules.md` → placeholder: `\{system_rules\}`

All agents will receive this via `\{system_rules\}` in their workflow.md or prompt.md."

---

"**Additional Shared Files**

Do you need any OTHER shared content that multiple prompts will use?

Common examples:
- Output format templates
- Reference documentation
- Domain-specific knowledge

Would you like to create additional shared files? **[y/n]**"

**If YES:**

"**How many shared files do you need?**

Enter count:"

Wait. Store as `sharedFileCount`.

For each shared file:

"**Shared file \{n\}:**

**File name** (without .md):
Example: `step-completion`, `output-format`

Enter name:"

Wait. Store as `shared[n].name`.

"**What content should this shared file contain?**

Enter content (multiple lines, empty line when done):"

Wait. Store as `shared[n].content`.

"**Placeholder name** (how prompts will reference it):
Must be unique, lowercase with underscores.
Example: `\{workflow_name\}_step_completion`

Enter placeholder name:"

Wait. Validate not in existing placeholders. Store as `shared[n].placeholder`.

**Generate shared file and placeholder:**

"**Shared file: shared/\{shared.name\}.md**

Content:
```markdown
\{shared.content\}
```

**Placeholder registration** (will be added to `config/placeholders.js`):
```javascript
packageDir: \{
  \{shared.placeholder\}: path.join('prompts', 'templates', '\{workflow_name\}', 'shared', '\{shared.name\}.md'),
\}
```

Prompts can now use `\{\{shared.placeholder\}\}` to include this content.

Confirm? **[y/n]**"

**If no:** Allow edits, regenerate, ask again.

**If yes:** IMMEDIATELY write the file:
- Write to: `prompts/templates/\{workflow_name\}/shared/\{shared.name\}.md`
- Confirm: "✓ Created: `shared/\{shared.name\}.md`"
- Store placeholder info for config update in step 8

Repeat for each shared file.

**If user said NO to shared files:** Skip this section.

### 5. Summary

"**Prompts & Placeholders - Step 4 Complete!**

**Main Agent Files Created:**"

For each agent:
"✓ `\{agent.id\}/persona.md`
✓ `\{agent.id\}/\{prompt.md or workflow.md\}`"
If chained:
"  ✓ `\{agent.id\}/chained/step-01-\{purpose\}.md`"
"  ✓ `\{agent.id\}/chained/step-02-\{purpose\}.md`"
etc.

*[If modules exist:]*
"**Module Files Created:**"

For each module:
"✓ `\{module.id\}/persona.md`
✓ `\{module.id\}/\{prompt.md or workflow.md\}` (with directive writing instructions)"
If chained:
"  ✓ `\{module.id\}/chained/step-XX-\{purpose\}.md`"

*[If static sub-agents exist:]*
"**Static Sub-Agent Files Created:**"

For each static subAgent:
"✓ `sub-agents/\{subAgent.id\}.md` (mirror file for parent: \{subAgent.parentAgent\})"

*[If controller exists:]*
"**Controller Files Created:**"
"✓ `controller/persona.md`
✓ `controller/prompt.md`"

If shared files:
"**Shared files created:**"
For each shared:
"✓ `shared/\{shared.name\}.md` → placeholder: `\{shared.placeholder\}`"

"**Summary:**
- **Main agents:** \{count\} agents, \{total files\} files
- **Modules:** \{count\} modules, \{total files\} files (with loop directives)
- **Static sub-agents:** \{count\} mirror files
- **Controller:** \{Yes/No\}
- **Shared files:** \{count\}
- **Total files created:** \{total count\}
- **Placeholders to register:** \{count\}"

## Step 4: APPEND to Plan File

**On User Confirmation:**

1. **Read** the plan file at `.codemachine/workflow-plans/\{workflow_name\}-plan.md`

2. **Append step-04 XML** before the closing `</workflow-plan>` tag:

```xml
<step-04 completed="true" timestamp="\{ISO timestamp\}">
  <folders-created>
    <folder path="prompts/templates/\{workflow_name\}/" />
    <!-- For each agent folder -->
    <folder path="prompts/templates/\{workflow_name\}/\{agent-id\}/" />
    <folder path="prompts/templates/\{workflow_name\}/\{agent-id\}/chained/" />
    <!-- For modules (if any) -->
    <folder path="prompts/templates/\{workflow_name\}/\{module-id\}/" />
    <folder path="prompts/templates/\{workflow_name\}/\{module-id\}/chained/" />
    <!-- For static sub-agents (if any) -->
    <folder path="prompts/templates/\{workflow_name\}/sub-agents/" />
    <!-- For controller (if any) -->
    <folder path="prompts/templates/\{workflow_name\}/controller/" />
    <folder path="prompts/templates/\{workflow_name\}/shared/" />
  </folders-created>

  <!-- Main Agent Prompts -->
  <main-agent-prompts>
    <!-- For each main agent -->
    <agent id="\{agent-id\}">
      <persona path="prompts/templates/\{workflow_name\}/\{agent-id\}/persona.md" created="true" />
      <prompt path="prompts/templates/\{workflow_name\}/\{agent-id\}/\{prompt.md or workflow.md\}" created="true">
        <goal>\{agent goal\}</goal>
        <input-type>\{placeholder|codebase-read|user-qa|specification\}</input-type>
        <input-source>\{placeholder name or description\}</input-source>
        <output-file>\{output filename or 'none'\}</output-file>
        <output-placeholder>\{placeholder name for next agent\}</output-placeholder>
        <has-sub-agent-coordination>\{true/false\}</has-sub-agent-coordination>
      </prompt>
      <!-- For each chained step (if multi-step) -->
      <chained-steps>
        <step n="\{n\}" path="prompts/templates/\{workflow_name\}/\{agent-id\}/chained/step-\{n\}-\{purpose\}.md" created="true">
          <purpose>\{step purpose\}</purpose>
          <goal>\{step goal\}</goal>
        </step>
      </chained-steps>
    </agent>
  </main-agent-prompts>

  <!-- Module Prompts (only if modules exist) -->
  <module-prompts count="\{module_count\}">
    <!-- For each module -->
    <module id="\{module-id\}">
      <persona path="prompts/templates/\{workflow_name\}/\{module-id\}/persona.md" created="true" />
      <prompt path="prompts/templates/\{workflow_name\}/\{module-id\}/\{prompt.md or workflow.md\}" created="true">
        <validation-focus>\{module.validationFocus\}</validation-focus>
        <directive-instructions-included>true</directive-instructions-included>
        <loop-config>
          <steps-back>\{module.loopSteps\}</steps-back>
          <max-iterations>\{module.loopMaxIterations\}</max-iterations>
          <skip-agents>\{module.loopSkip or 'none'\}</skip-agents>
        </loop-config>
      </prompt>
      <!-- For each chained step (if multi-step module) -->
      <chained-steps>
        <step n="\{n\}" path="..." created="true">
          <purpose>\{step purpose\}</purpose>
          <has-directive-writing>\{true if last step\}</has-directive-writing>
        </step>
      </chained-steps>
    </module>
  </module-prompts>

  <!-- Static Sub-Agent Prompts (only if static sub-agents exist) -->
  <sub-agent-prompts count="\{static_subagent_count\}">
    <!-- For each static sub-agent -->
    <sub-agent id="\{subAgent-id\}" parent="\{parent-agent-id\}">
      <mirror-path>prompts/templates/\{workflow_name\}/sub-agents/\{subAgent-id\}.md</mirror-path>
      <created>true</created>
      <persona>\{subAgent.persona\}</persona>
      <expected-input>\{subAgent.expectedInput\}</expected-input>
      <expected-output>\{subAgent.expectedOutput\}</expected-output>
    </sub-agent>
  </sub-agent-prompts>

  <!-- Controller Prompts (only if controller exists) -->
  <controller-prompts enabled="\{true/false\}">
    <controller id="\{controller-id\}">
      <persona path="prompts/templates/\{workflow_name\}/controller/persona.md" created="true" />
      <prompt path="prompts/templates/\{workflow_name\}/controller/prompt.md" created="true">
        <response-length>\{controller.responseLength\}</response-length>
        <pacing>\{controller.pacing\}</pacing>
        <loop-depth>\{controller.loopDepth\}</loop-depth>
        <interactions-count>\{number of agent interactions\}</interactions-count>
      </prompt>
    </controller>
  </controller-prompts>

  <shared-files>
    <!-- For each shared file -->
    <shared name="\{name\}" placeholder="\{placeholder_name\}" path="prompts/templates/\{workflow_name\}/shared/\{name\}.md" created="true">
      <content-summary>\{brief summary of content\}</content-summary>
    </shared>
  </shared-files>

  <placeholders-to-register>
    <!-- For each placeholder -->
    <placeholder name="\{placeholder_name\}" path="prompts/templates/\{workflow_name\}/shared/\{name\}.md" />
  </placeholders-to-register>

  <summary>
    <main-agents>\{count\}</main-agents>
    <modules>\{count\}</modules>
    <static-sub-agents>\{count\}</static-sub-agents>
    <controller>\{Yes/No\}</controller>
    <shared-files>\{count\}</shared-files>
    <total-files>\{count\}</total-files>
    <agent-chain>
      <agents-with-input>\{count\}</agents-with-input>
      <agents-with-output>\{count\}</agents-with-output>
      <placeholder-chains>\{count\}</placeholder-chains>
    </agent-chain>
  </summary>
</step-04>
```

3. **Update the Last Updated timestamp** in the file header

4. **Update TodoWrite:**

```javascript
TodoWrite([
  { content: "Step 01: Brainstorming", status: "completed", activeForm: "Brainstorming completed" },
  { content: "Step 02: Workflow Definition", status: "completed", activeForm: "Workflow definition completed" },
  { content: "Step 03: Agents", status: "completed", activeForm: "Agents completed" },
  { content: "Step 04: Prompts", status: "completed", activeForm: "Prompts created" },
  { content: "Step 05: Workflow Generation", status: "in_progress", activeForm: "Generating workflow" }
])
```

5. **Confirm to user:**
"✓ Prompt files created and saved to workflow plan.

Press **Enter** to proceed to the next step."

{ali_step_completion}

## SUCCESS METRICS

**Main Agent Prompts:**
- Folder structure created for all agents
- All main agent persona files WRITTEN to disk
- All main agent prompt/workflow files WRITTEN to disk
- All chained step files WRITTEN to disk (for multi-step agents)
- Sub-agent coordination section included in prompts (if agent has sub-agents)

**Module Prompts (if modules exist):**
- All module persona files WRITTEN to disk
- All module prompt/workflow files WRITTEN with directive writing instructions
- Directive JSON format documented (action: loop/stop, reason, target)
- Loop configuration included (steps back, max iterations, skip agents)
- Last step of multi-step modules includes directive writing section

**Static Sub-Agent Prompts (if static sub-agents exist):**
- All mirror files WRITTEN to `sub-agents/` folder
- Each mirror file includes: persona, expected input/output, instructions, success/failure indicators
- Parent agent relationship documented

**Controller Prompts (if controller exists):**
- Controller persona file WRITTEN to disk
- Controller prompt file WRITTEN with all agent interactions
- Response length, pacing, loop depth configured
- Each agent interaction documented (expected output, max turns, approval criteria)

**General:**
- All shared files WRITTEN to disk
- Placeholders stored for config update in step 5
- User confirmed each file before creation
- **Step-04 XML appended to plan file (including modules, sub-agents, controller)**
- **TodoWrite updated**

## FAILURE METRICS

**Main Agent Prompts:**
- Files not actually written after confirmation
- Missing prompt files for any main agent
- Chained agents missing step files
- Sub-agent coordination NOT included when agent has sub-agents
- MCP/CLI invocation instructions missing for agents with sub-agents

**Module Prompts:**
- Module prompts missing directive writing instructions
- Directive JSON format not documented
- Loop configuration (steps back, max iterations) not included
- Multi-step module last step missing directive writing section
- Validation focus not clear in module prompt

**Static Sub-Agent Prompts:**
- Mirror files not created for static sub-agents
- Missing required fields (persona, expected input/output, instructions)
- Parent agent relationship not documented

**Controller Prompts:**
- Controller persona/prompt files not created
- Agent interactions not documented
- Missing response length or pacing configuration
- Approval criteria not specified for each agent

**General:**
- Duplicate placeholder names
- Using existing placeholder names (must create NEW)
- Proceeding without user confirmation
- **Not appending to plan file**
- **Not updating TodoWrite**
- **Skipping optional sections when they SHOULD be included (modules exist but skipped, etc.)**
