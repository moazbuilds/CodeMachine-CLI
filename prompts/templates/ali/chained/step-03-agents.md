---
name: "Step 03 - Agents"
description: "Define all agents: main agents, sub-agents, modules, and controller"
---

# Step 03: Agents

## STEP GOAL

Define all main agents, modules, and controller for the workflow:
- How many agents needed
- For each agent: ID, name, description
- Single-step or multi-step
- If multi-step: how many steps, purpose of each
- Module behavior (if agent needs loop capability)
- Controller configuration (if autonomous mode enabled in Step 02):
  - Controller identity and workflow context awareness
  - Agent interactions (expected output, length, format, approval criteria, max turns)
  - Communication efficiency (response length, turn limits)
  - Behavior (pacing, loop depth)
- Engine and model for each agent (including controller)

**🎯 GUIDE USER TO CORRECT STEP:** If user asks about something that belongs to a later step (e.g., prompts, workflow generation), guide them to proceed step-by-step. Say: "Great question! We'll cover that in Step {X}. Let's finish agents first, then press **Enter** to continue."

## Track-Based Behavior

**Check `{selected_track}` and adapt accordingly:**

---

**`create-workflow`:** Execute full sequence below - define new agents from scratch.

---

**`modify-workflow`:**
- Plan file already has existing agents from `<step-03>`
- Show current agents configuration
- Ask: "What do you want to modify?" (add agent, remove agent, edit agent details, change engine/model, update controller)
- Only update the requested sections
- Re-validate and update plan file

---

**`have-questions`:**
- Q&A mode only - answer questions about agent concepts
- Topics: single vs multi-step, modules, sub-agents, controller, engine/model selection, character configuration
- Do NOT create or modify anything
- After answering, tell user: "Press **Enter** to proceed to the next step, or ask more questions."

---

## Sequence of Instructions (create-workflow / modify-workflow)

### 1. Introduction

"**Now let's define your main agents and modules.**

Each agent in your workflow is a distinct persona that handles a specific part of the process. Agents can be:
- **Single-step**: One prompt file injected once. No additional steps.
- **Multi-step**: Multiple prompts injected sequentially, like this Ali workflow with 8 steps.
- **Module**: An agent with loop behavior - can send the workflow back to previous steps (like validation gates).

**When to use multi-step agents:**
- Same session maintains context throughout
- Agent holds data in memory from previous steps
- Great for Q&A and conversational flows where context matters

**When to use single-step agents:**
- Smaller, focused tasks related to a main role
- Keeps prompts lean - less context management

**Note:** When using multiple single-step agents (multi-agent workflow), you may need placeholders to pass data between them since each runs in a separate session."

### 2. Ask Agent Count

*[Skip this section if user already specified agent count in brainstorming or earlier conversation]*

"**How many main agents does your workflow need?**

Based on what you've described, I'd suggest **\{recommended_count\} agent(s)** because {reasoning based on user's workflow definition, tracks, conditions, and brainstorming}.

**Note:** If your workflow needs agents that can loop back (like validation gates that retry on failure), we'll configure that as part of each agent's definition. These are called **modules** - they're main agents with loop behavior.

**Consider:**
- What distinct phases or roles exist?
- Could one agent handle multiple things, or better to specialize?

Do you want to go with **\{recommended_count\}**, or a different number?"

Wait for response. Store as `agent_count`.

### 3. Define Each Agent

For each agent (1 to agent_count):

"**Agent \{n\} of \{total\}**

Based on your workflow, here's what I suggest for this agent:

| Field | Suggestion |
|-------|------------|
| **ID** | `\{suggested_id\}` |
| **Name** | \{suggested_name\} |
| **Description** | \{suggested_description\} |

Does this look good, or would you like to change anything?"

Wait for response.
- If user approves: Store all fields and continue
- If user wants changes: "What would you like to change?" then update accordingly

**After identity confirmed, gather behavioral details:**

"**Expected Behavior for '\{agent.name\}'**

How should this agent behave during execution? Describe:
- What approach should it take?
- Any constraints or boundaries?
- Working style (methodical, creative, thorough, fast, etc.)

Enter expected behavior:"

Wait. Store as `agents[n].expectedBehavior`.

"**Success Indicators for '\{agent.name\}'**

How do we know this agent succeeded? List specific, measurable outcomes.
Example: 'Code compiles without errors', 'All tests pass', 'Document covers all sections'

Enter success indicators:"

Wait. Store as `agents[n].successIndicators`.

"**Failure Indicators for '\{agent.name\}'**

What signals that this agent failed or needs to retry? List warning signs.
Example: 'Missing required sections', 'Security vulnerabilities found', 'Tests failing'

Enter failure indicators:"

Wait. Store as `agents[n].failureIndicators`.

### 4. Single or Multi-step

"**Is this agent single-step or multi-step?**

Based on what '\{agent_name\}' needs to do, I suggest **\{single-step | multi-step\}** because \{reasoning from context\}.

**[If suggesting multi-step, also include:]**

I'd recommend **\{suggested_step_count\} steps**:

| Step | Purpose |
|------|---------|
| 1 | \{suggested_purpose_1\} |
| 2 | \{suggested_purpose_2\} |
| ... | ... |

Does this work, or would you like to change it?"

Wait for response.
- If user approves: Store type, step count, and purposes
- If user wants changes: "What would you like to change?" then update accordingly

### 4b. Module Behavior (Optional)

"**Does '\{agent_name\}' need loop behavior?**

Loop behavior means this agent can send the workflow back to previous steps (like a validation gate).

Based on what '\{agent_name\}' does, I suggest **\{No | Yes - module\}** because \{reasoning from context\}.

1. **No** - Regular agent, runs once
2. **Yes** - Module agent, can loop back

Which one?"

Wait for response.

**If No:** Store `agents[n].isModule = false`, continue to engine configuration.

**If Yes:**

"This agent is a **module**. Let's configure its loop behavior.

Based on your workflow, I suggest:

| Setting | Suggestion |
|---------|------------|
| **Validation focus** | \{suggested - what it checks\} |
| **Loop trigger** | \{suggested - when to loop\} |
| **Steps back** | \{suggested - how many steps to go back\} |
| **Max iterations** | \{suggested - default 3\} |
| **Skip agents** | \{suggested - agents to skip on re-loop, or 'none'\} |

Does this work, or would you like to change anything?"

Wait for response.
- If user approves: Store all module fields
- If user wants changes: "What would you like to change?" then update accordingly

Store as:
- `agents[n].isModule = true`
- `agents[n].validationFocus`
- `agents[n].loopTrigger`
- `agents[n].loopSteps`
- `agents[n].loopMaxIterations`
- `agents[n].loopSkip`

**How module loops work:**
- Module writes to `.codemachine/memory/directive.json`
- `action: 'loop'` + reason → workflow goes back N steps
- `action: 'stop'` + reason → workflow continues forward
- This directive file is how the module controls workflow execution

**Common module patterns:**
- **Validation loops** - Check work, fix issues, re-check
- **Review cycles** - Review, get feedback, revise
- **Quality gates** - Iterate until quality threshold met

### 4c. Sub-Agents (Optional)

"**Does '\{agent.name\}' need sub-agents it can call?**

Sub-agents are helper agents that a main agent can invoke during execution. They run as separate agent sessions and return results to the calling agent.

**Use sub-agents when:**
- Task can be delegated to a specialist
- Work can be parallelized across multiple agents
- You want reusable agent capabilities across workflows

Does this agent need sub-agents? **[y/n]**"

Wait for response.

**If no:** Store `agents[n].subAgents = []`, continue to next section.

**If yes:**

"**How many sub-agents for '\{agent.name\}'?**

Enter number:"

Wait. Store as `subAgentCount`.

**For each sub-agent (1 to subAgentCount):**

"**Sub-Agent \{m\} of \{subAgentCount\} for '\{agent.name\}'**

**1. Sub-Agent ID** (lowercase with hyphens):

Enter ID:"

Wait. Validate against `existing_ids`. Store as `subAgent.id`. Add to `existing_ids`.

"**2. Sub-Agent Name:**

Enter name:"

Wait. Store as `subAgent.name`.

"**3. Sub-Agent Description** (what does it do?):

Enter description:"

Wait. Store as `subAgent.description`.

"**4. Prompt Type** - How should the sub-agent's prompt be provided?

| # | Type | Description |
|---|------|-------------|
| 1 | **Static** | Pre-defined prompt file (`mirrorPath`) - you define it now |
| 2 | **Dynamic** | Generated at runtime by main agent in `.codemachine/agents/` |

Enter **1** or **2**:"

Wait. Store as `subAgent.promptType`.

---

**If Static (promptType = 1):**

"**Static Sub-Agent Configuration**

We'll create a prompt file for this sub-agent.

**Persona** - What expertise/personality should this sub-agent have?

Enter persona:"

Wait. Store as `subAgent.persona`.

"**Instructions** - What are the key things this sub-agent must do?
(Enter one per line, empty line when done):"

Wait. Collect as array. Store as `subAgent.instructions`.

"**Expected Input** - What input will this sub-agent receive?

Enter expected input:"

Wait. Store as `subAgent.expectedInput`.

"**Expected Output** - What should this sub-agent produce?

Enter expected output:"

Wait. Store as `subAgent.expectedOutput`.

"**Success Indicators** - How do we know this sub-agent succeeded?

Enter success indicators:"

Wait. Store as `subAgent.successIndicators`.

"**Failure Indicators** - What signals failure or need to retry?

Enter failure indicators:"

Wait. Store as `subAgent.failureIndicators`.

---

**If Dynamic (promptType = 2):**

"**Dynamic Sub-Agent Configuration**

The main agent will generate this sub-agent's prompt at runtime.

**Generation Instructions** - What should '\{agent.name\}' know about generating this sub-agent?

Describe the purpose, capabilities, and any constraints:

Enter generation instructions:"

Wait. Store as `subAgent.generationInstructions`.

"**Trigger Condition** - When should '\{agent.name\}' generate/use this sub-agent?

Enter trigger condition:"

Wait. Store as `subAgent.triggerCondition`.

---

**Show sub-agent summary:**

"**Sub-Agent Summary: \{subAgent.name\}**

| Setting | Value |
|---------|-------|
| ID | `\{subAgent.id\}` |
| Name | \{subAgent.name\} |
| Description | \{subAgent.description\} |
| Prompt Type | \{Static/Dynamic\} |
| Parent Agent | \{agent.name\} |"

*[If static, also show:]*
"| Persona | \{persona\} |
| Expected Input | \{expectedInput\} |
| Expected Output | \{expectedOutput\} |"

*[If dynamic, also show:]*
"| Generation Instructions | \{generationInstructions\} |
| Trigger Condition | \{triggerCondition\} |"

"Correct? **[y/n]**"

Wait. If no, allow edits.

**Repeat for each sub-agent.**

---

#### Sub-Agent Invocation Reference

"**How to Call Sub-Agents**

Main agents can invoke sub-agents using MCP tools or CLI commands.

**MCP Tools Available:**

| Tool | Description |
|------|-------------|
| `list_available_agents` | Discover available agents |
| `run_agents` | Execute agent coordination scripts |
| `get_agent_status` | Check agent execution status |
| `list_active_agents` | See currently running agents |

**MCP Workflow:**
1. `list_available_agents` - see what's available
2. `run_agents { \"script\": \"agent-id 'task'\" }` - execute
3. `get_agent_status { \"name\": \"agent-id\" }` - check results

**CLI Syntax:**
```
codemachine run \"agent-id[options] 'prompt'\"
```

**Options:**
| Option | Description |
|--------|-------------|
| `input:file.md` | Pass file content to agent |
| `input:f1.md;f2.md` | Multiple input files |
| `tail:100` | Limit output lines |

**Orchestration Patterns:**
| Pattern | Syntax | Description |
|---------|--------|-------------|
| Parallel | `&` | Independent tasks run simultaneously |
| Sequential | `&&` | Tasks run in order, output feeds next |
| Mixed | `a && b & c` | a first, then b and c in parallel |

**Examples:**
```bash
# Single agent
codemachine run \"code-generator 'Build login feature'\"

# With input file
codemachine run \"analyst[input:requirements.md] 'analyze'\"

# Parallel execution
codemachine run \"frontend 'UI' & backend 'API'\"

# Sequential then parallel
codemachine run \"db 'setup' && frontend & backend\"
```

**Note:** Include MCP tools documentation in main agent's prompt if it needs to call sub-agents."

---

### 4d. Controller Agent (If Autonomous Mode)

*[Skip this section entirely if `controller = false` from Step 02]*

**If `controller = true` from Step 02, configure the controller after all main agents are defined:**

"**Controller Agent Configuration**

You enabled autonomous mode with a controller in Step 02. The controller is the brain of autonomous execution - it responds on behalf of the user and drives the entire workflow.

**⚠️ This configuration is critical.** A poorly configured controller will cause workflow failures, wasted tokens, and endless loops. Let's design it carefully."

---

#### 4c.1 Controller Identity

"**Controller ID** (lowercase with hyphens):
Example: `project-controller`, `workflow-po`

Enter controller ID:"

Wait. Validate against `existing_ids`. Store as `controller.id`.

"**Controller Name** (display name):
Example: `Project Owner`, `Workflow Controller`

Enter name:"

Wait. Store as `controller.name`.

"**Controller Description** (what is this controller's purpose?):

Enter description:"

Wait. Store as `controller.description`.

---

#### 4c.2 Workflow Context Review

"**Full Workflow Context**

Your controller will have complete visibility of the workflow structure. Let's review what it will know:

**Tracks Defined in Step 02:**"

*[If tracks enabled, display table:]*
| Track ID | Label | Description |
|----------|-------|-------------|
| \{track.id\} | \{track.label\} | \{track.description\} |

*[If no tracks:]* "No tracks defined - single path workflow."

"**Conditions Defined in Step 02:**"

*[If conditions enabled, display table:]*
| Group | Condition ID | Label | Description |
|-------|--------------|-------|-------------|
| \{group.id\} | \{condition.id\} | \{condition.label\} | \{condition.description\} |

*[If no conditions:]* "No conditions defined."

"**Agents Defined (so far):**"

| # | Agent ID | Name | Type | Steps |
|---|----------|------|------|-------|
| \{n\} | \{agent.id\} | \{agent.name\} | \{single/multi-step\} | \{count\} |

"The controller will see all of this context and use it to make decisions during autonomous execution.

Does this look correct? **[y/n]**"

Wait for confirmation.

---

#### 4c.3 Agent Interaction Design (Critical)

"**Agent Interactions**

This is the most important part. For EACH agent, we need to define exactly what the controller expects and how it should respond.

Poor interaction design = wasted tokens, failed workflows, endless loops."

**For each main agent defined, ask:**

"**Interaction with: \{agent.name\}** (`\{agent.id\}`)

**1. Expected Output** - What should this agent produce?
Example: 'A validated project specification', 'Working code with tests', 'Reviewed PR with comments'

Enter expected output:"

Wait. Store as `controller.interactions[agent.id].expectedOutput`.

"**2. Output Length** - How long should the agent's output be?

| # | Length | Description |
|---|--------|-------------|
| 1 | Short | Few sentences, bullet points, minimal |
| 2 | Medium | 1-2 paragraphs, moderate detail |
| 3 | Long | Comprehensive, multiple sections |
| 4 | Specific | Enter word/character limit |

Enter **1**, **2**, **3**, or **4**:"

Wait. If 4, ask for specific limit. Store as `controller.interactions[agent.id].outputLength`.

"**3. Output Format** - What format should the output be in?

| # | Format | Description |
|---|--------|-------------|
| 1 | Free-form | Natural prose, flexible structure |
| 2 | Markdown | Structured with headers, lists, code blocks |
| 3 | Code | Primarily code with minimal explanation |
| 4 | Structured | Specific template/schema required |

Enter **1**, **2**, **3**, or **4**:"

Wait. If 4, ask for template details. Store as `controller.interactions[agent.id].outputFormat`.

"**4. Approval Criteria** - When is this agent's work 'done'?
Be specific. What must be true for controller to approve and move on?

Example: 'All tests pass', 'No security vulnerabilities', 'Follows style guide'

Enter approval criteria:"

Wait. Store as `controller.interactions[agent.id].approvalCriteria`.

"**5. Max Turns** - Maximum back-and-forth with this agent before forcing continue.
This prevents infinite loops. Recommended: 2-5 turns.

Enter max turns (number):"

Wait. Validate is number 1-10. Store as `controller.interactions[agent.id].maxTurns`.

"**6. Guidance** - What direction should controller give this agent?
Example: 'Focus on security', 'Keep it simple', 'Prioritize performance'

Enter guidance (or 'none'):"

Wait. Store as `controller.interactions[agent.id].guidance`.

"**7. Expected Agent Behavior** - How should this agent behave when controller is driving?
Describe the working relationship and approach.

Example: 'Agent should ask clarifying questions before starting', 'Agent should provide options for review', 'Agent should work autonomously with minimal back-and-forth'

Enter expected behavior:"

Wait. Store as `controller.interactions[agent.id].expectedBehavior`.

"**8. Success Indicators** - How does controller know this agent succeeded?
List specific signals that work is complete and acceptable.

Example: 'Output matches expected format', 'All acceptance criteria addressed', 'No TODO items remaining'

Enter success indicators:"

Wait. Store as `controller.interactions[agent.id].successIndicators`.

"**9. Failure Indicators** - What signals that controller should request changes or loop?
List warning signs that trigger retry or rejection.

Example: 'Output incomplete', 'Doesn't address requirements', 'Contains placeholders', 'Quality below threshold'

Enter failure indicators:"

Wait. Store as `controller.interactions[agent.id].failureIndicators`.

**Show interaction summary for this agent:**

"**\{agent.name\} Interaction Summary:**

| Setting | Value |
|---------|-------|
| Expected Output | \{expectedOutput\} |
| Output Length | \{outputLength\} |
| Output Format | \{outputFormat\} |
| Approval Criteria | \{approvalCriteria\} |
| Max Turns | \{maxTurns\} |
| Guidance | \{guidance\} |
| Expected Behavior | \{expectedBehavior\} |
| Success Indicators | \{successIndicators\} |
| Failure Indicators | \{failureIndicators\} |

Correct? **[y/n]**"

Wait. If no, allow edits.

**Repeat for each agent.**

---

#### 4c.4 Communication Efficiency

"**Controller Communication Settings**

The controller should be efficient - not waste tokens or time with verbose responses.

**Controller Response Length** - How verbose should controller replies be?

| # | Length | Description | Recommended |
|---|--------|-------------|-------------|
| 1 | Minimal | 1-2 sentences max, just decisions | ✓ Best for speed |
| 2 | Brief | Short paragraph, key reasoning only | ✓ Good balance |
| 3 | Detailed | Full explanation of reasoning | Slower, more tokens |

Enter **1**, **2**, or **3** (recommended: 1 or 2):"

Wait. Store as `controller.responseLength`.

"**Total Workflow Turn Limit** - Maximum total turns across ALL agents before controller forces workflow completion.
This is a safety limit to prevent runaway execution.

Recommended: 20-50 turns for most workflows.

Enter total turn limit:"

Wait. Validate is number 10-100. Store as `controller.totalTurnLimit`.

---

#### 4c.5 Behavior Configuration

"**Controller Behavior**

**Pacing** - How quickly should controller proceed?

| # | Pacing | Description |
|---|--------|-------------|
| 1 | Quick | Approve fast, minimal review, trust agents |
| 2 | Balanced | Review key decisions, spot-check work |
| 3 | Thorough | Deep review everything, detailed feedback |

Enter **1**, **2**, or **3**:"

Wait. Store as `controller.pacing`.

"**Loop Depth** - When agents need to iterate (fix issues, refine work), how many loops?

| # | Depth | Description |
|---|-------|-------------|
| 1 | Minimal | 1-2 iterations max, accept good-enough |
| 2 | Standard | 3-5 iterations, aim for quality |
| 3 | Deep | Up to max turns, high standards |

Enter **1**, **2**, or **3**:"

Wait. Store as `controller.loopDepth`.

---

#### 4c.6 Controller Summary

"**Controller Configuration Complete!**

**Identity:**
- ID: `\{controller.id\}`
- Name: \{controller.name\}
- Description: \{controller.description\}

**Workflow Awareness:**
- Tracks: \{count\} defined
- Conditions: \{count\} defined
- Agents: \{count\} to interact with

**Agent Interactions:**"

| Agent | Expected Output | Length | Max Turns |
|-------|-----------------|--------|-----------|
| \{agent.name\} | \{expectedOutput\} | \{length\} | \{maxTurns\} |

"**Efficiency Settings:**
- Controller Response Length: \{responseLength\}
- Total Turn Limit: \{totalTurnLimit\}
- Pacing: \{pacing\}
- Loop Depth: \{loopDepth\}

Does this controller configuration look correct? **[y/n]**"

Wait for confirmation. If no, allow edits.

**Note:** Controller engine/model will be configured in section 5 along with other agents.

---

### 4e. Agent Character & Persona

"**Character for '\{agent.name\}'**

Every agent has a visual character that appears in the CLI during execution. This makes your workflow feel alive and gives each agent personality.

**Character elements:**
- **Base Face** - The default ASCII expression (e.g., `(⌐■_■)`, `(˶ᵔ ᵕ ᵔ˶)`, `[•_•]`)
- **Expressions** - Different faces for different states (thinking, tool use, error, idle)
- **Phrases** - What the agent says during each state

Based on '\{agent.name\}''s role and communication style, I suggest:"

**Generate dynamic suggestions based on agent's role/tone:**

*[Analyze the agent's description, expected behavior, and role to suggest appropriate character]*

**Character Suggestion Logic:**
- **Technical/Analytical agents** → Suggest: `analytical`, `technical`, `precise` styles
- **Creative/Friendly agents** → Suggest: `friendly`, `cheerful`, `swagger` styles
- **Strict/Validation agents** → Suggest: `precise`, `analytical` styles
- **User-facing/Conversational agents** → Suggest: `friendly`, `swagger`, `cheerful` styles
- **Fast/Action-oriented agents** → Suggest: `swagger`, `technical` styles

**Present suggestion with options:**

"Based on '\{agent.name\}' being a \{role_description\}, I suggest the **\{suggested_style\}** character:

| Style | Base Face | Vibe |
|-------|-----------|------|
| **\{suggested_style\}** (suggested) | `\{baseFace\}` | \{vibe_description\} |
| \{alt_style_1\} | `\{baseFace\}` | \{vibe_description\} |
| \{alt_style_2\} | `\{baseFace\}` | \{vibe_description\} |
| Custom | Your design | Create your own |

**Pre-built Character Styles:**

| Style | Base Face | Best For |
|-------|-----------|----------|
| `swagger` | `(⌐■_■)` | Cool, confident, casual agents |
| `friendly` | `(˶ᵔ ᵕ ᵔ˶)` | Warm, approachable, helpful agents |
| `analytical` | `[•_•]` | Logical, data-driven, precise agents |
| `cheerful` | `◕‿◕` | Upbeat, encouraging, positive agents |
| `technical` | `\{•_•\}` | Developer-focused, code-centric agents |
| `precise` | `<•_•>` | Validation, QA, strict agents |

Which style fits '\{agent.name\}'? Enter style name or **'custom'**:"

Wait for response.

**If user selects a pre-built style:**

Store as `agents[n].character.style = '\{selected_style\}'`

"Great! '\{agent.name\}' will use the **\{selected_style\}** character.

Now let's customize the phrases. I'll suggest phrases that match '\{agent.name\}''s personality:

**Thinking phrases** (shown when agent is processing):

Based on \{agent.name\}'s \{communication_style\}, here are suggestions:"

*[Generate 5-10 phrase suggestions based on agent's role and tone]*

"| # | Suggested Phrase |
|---|------------------|
| 1 | \{phrase matching agent tone\} |
| 2 | \{phrase matching agent tone\} |
| 3 | \{phrase matching agent tone\} |
| ... | ... |

**Options:**
1. **Use these** - Accept my suggestions
2. **Edit** - Modify some phrases
3. **Custom** - Write your own phrases

Enter choice:"

Wait for response. Collect and store as `agents[n].character.phrases.thinking`.

*[Repeat for tool, error, and idle phrases with appropriate suggestions for each]*

**Tool phrases** (shown when agent receives tool results):
*[Generate suggestions like: "Got what I needed", "Processing that now", etc.]*

**Error phrases** (shown when something fails):
*[Generate suggestions like: "Hmm, that didn't work", "Let me try another approach", etc.]*

**Idle phrases** (shown when waiting for user):
*[Generate suggestions like: "Your turn", "Ready when you are", etc.]*

---

**If user selects 'custom':**

"Let's design a custom character for '\{agent.name\}'!

**1. Base Face** - The default expression (ASCII art)
Examples: `(⌐■_■)`, `(˶ᵔ ᵕ ᵔ˶)`, `[•_•]`, `◕‿◕`, `{•_•}`, `<•_•>`

Enter base face:"

Wait. Store as `agents[n].character.baseFace`.

"**2. Thinking Expression** - Shown when processing
Examples: `(╭ರ_•́)`, `[•_•]~`, `◕~◕`

Enter thinking face:"

Wait. Store as `agents[n].character.expressions.thinking`.

"**3. Tool Expression** - Shown when using/receiving tools
Examples: `<(•_•<)`, `(•̀ᴗ•́)و`, `[◉_◉]`

Enter tool face:"

Wait. Store as `agents[n].character.expressions.tool`.

"**4. Error Expression** - Shown when something fails
Examples: `(╥﹏╥)`, `[x_x]`, `◕_◕`

Enter error face:"

Wait. Store as `agents[n].character.expressions.error`.

"**5. Idle Expression** - Shown when waiting for user (usually same as base)

Enter idle face (or press Enter to use base face):"

Wait. Store as `agents[n].character.expressions.idle` (default to baseFace).

"Now let's add phrases for each state.

**Thinking phrases** (5-10 phrases, one per line, empty line when done):"

Wait. Collect as array. Store as `agents[n].character.phrases.thinking`.

"**Tool phrases** (shown when receiving tool results):"

Wait. Collect as array. Store as `agents[n].character.phrases.tool`.

"**Error phrases** (shown when something fails):"

Wait. Collect as array. Store as `agents[n].character.phrases.error`.

"**Idle phrases** (shown when waiting for user):"

Wait. Collect as array. Store as `agents[n].character.phrases.idle`.

---

**Show character summary:**

"**Character Summary for '\{agent.name\}':**

| Element | Value |
|---------|-------|
| Style | \{style or 'custom'\} |
| Base Face | `\{baseFace\}` |
| Thinking | `\{expressions.thinking\}` |
| Tool | `\{expressions.tool\}` |
| Error | `\{expressions.error\}` |
| Idle | `\{expressions.idle\}` |

**Sample Phrases:**
- Thinking: "\{phrases.thinking[0]\}"
- Tool: "\{phrases.tool[0]\}"
- Error: "\{phrases.error[0]\}"
- Idle: "\{phrases.idle[0]\}"

Does this look good? **[y/n]**"

Wait. If no, allow edits.

---

**How Characters Work:**

The character system brings your agents to life in the CLI:

1. **Visual feedback** - ASCII faces change based on agent state
2. **Personality** - Phrases reflect each agent's unique voice
3. **Consistency** - Same character appears throughout the workflow

**File generated:** `config/agent-characters.json`

**Structure:**
```json
{
  \"personas\": {
    \"style-name\": {
      \"baseFace\": \"(⌐■_■)\",
      \"expressions\": { \"thinking\": \"...\", \"tool\": \"...\", \"error\": \"...\", \"idle\": \"...\" },
      \"phrases\": { \"thinking\": [...], \"tool\": [...], \"error\": [...], \"idle\": [...] }
    }
  },
  \"agents\": {
    \"agent-id\": \"style-name\"
  },
  \"defaultPersona\": \"style-name\"
}
```

**Tips:**
- Match character tone to agent's communication style
- Use varied phrases (5-10 per state) to keep it fresh
- Expressions should be readable in terminal
- Consider your workflow's overall vibe

---

### 5. Engine & Model Configuration

"**5. Engine for '\{agents[n].name\}'**

Which AI engine should this agent use?

**Available Engines** (case-sensitive IDs):

| ID | Name | Default Model | Status |
|----|------|---------------|--------|
| `claude` | Claude Code | opus | Stable - Best tested |
| `codex` | Codex | gpt-5.2-codex | Stable - Fastest |
| `ccr` | Claude Code Router | sonnet | Stable (needs config) |
| `opencode` | OpenCode | opencode/glm-4.7-free | Stable (free fallback) |
| `auggie` | Auggie CLI | (provider default) | Unstable |
| `mistral` | Mistral Vibe | devstral-2 | Unstable |
| `cursor` | Cursor | auto | Experimental |

**Fallback:** If no engine set or not authenticated, falls back to `opencode` free plan.

We're adding engines constantly! Request new engines at:
https://github.com/moazbuilds/CodeMachine-CLI/issues

Enter engine ID (or **?** for author's recommendations):"

Wait for response.

**If user enters ?:**

"**Engine Recommendations (from CodeMachine author):**

| Engine | Verdict |
|--------|---------|
| `claude` | **Best tested** - consistently great results with opus. Highly recommended. |
| `codex` | **Fastest** for quick answers. Only engine with reasoning effort control. |
| `ccr` | Powerful but **needs configuration**. Read official repo docs first. |
| `auggie` | **Not fully tested** - closed source. |
| `mistral` | **Very unstable** in practice. Not recommended. |
| `opencode` | **Slow** compared to others. Works as free fallback. |
| `cursor` | **Experimental** - still being evaluated. |

Now enter engine ID:"

Wait for response. Validate against list. Store as `agents[n].engine`.

---

**If user selected `codex`, ask about reasoning effort:**

"**Codex Reasoning Effort**

Codex is the only engine with reasoning effort control:

| Level | Use Case |
|-------|----------|
| `low` | Fast responses, simple tasks |
| `medium` | Balanced (default) |
| `high` | Complex reasoning, thorough analysis |

Enter effort level (default: medium):"

Wait for response. Store as `agents[n].modelReasoningEffort` (default 'medium' if blank).

---

**For all engines, ask about model override:**

"**Model Override** (optional)

Each engine has a default model. Override it?

Default for `\{engine\}`: \{default_model\}

Enter model name (or press Enter to use default):"

Wait for response. Store as `agents[n].model` (or null if blank).

---

### 6. Repeat for All Agents

After each agent is fully defined:
- Show summary of that agent
- If more agents remain: "Let's define agent {n+1}."
- If last agent: Proceed to filtering

### 7. Track/Condition Filtering (Optional)

*[Skip this section entirely if no tracks or conditions were defined in Step 02]*

If tracks or conditions were defined in step 2 AND user wants to configure filtering:

"**Agent Filtering (Optional)**

You defined tracks and/or conditions in Step 02. We can use these to control:
1. **When an agent runs** (agent-level filtering)
2. **When specific steps load** (step-level filtering for multi-step agents)

Let's configure filtering for each agent."

**For each agent, ask about agent-level filtering:**

"**Agent-level filtering for '\{agent.name\}':**

Should this agent only run for specific tracks or conditions?

Based on what '\{agent.name\}' does, I suggest: \{suggestion with reasoning\}

| Level | Suggestion |
|-------|------------|
| **Tracks** | \{suggested tracks or 'all'\} |
| **Conditions** | \{suggested conditions or 'all'\} |

Does this work, or would you like to change it?"

Wait for response. Store as `agents[n].tracks` and `agents[n].conditions`.

**For multi-step agents, ask about step-level filtering:**

"**Step-level filtering for '\{agent.name\}':**

Your agent has \{stepCount\} steps. Should any steps only load for specific tracks/conditions?

| Step | Purpose | Suggested Filter |
|------|---------|------------------|
| 1 | \{purpose\} | {always / tracks: x / conditions: y} |
| 2 | \{purpose\} | {always / tracks: x / conditions: y} |
| ... | ... | ... |

Does this work, or would you like to change it?"

Wait for response. Store as `agents[n].steps[s].tracks` and `agents[n].steps[s].conditions`.

**How filtering works:**
- **Agent-level**: Agent only runs if user selected matching track/condition
- **Step-level**: Step only loads if user selected matching track/condition
- **Both track AND conditions must match** if both are specified
- **Empty = always runs/loads**

**Example:**
```javascript
{
  id: 'ux-designer',
  tracks: ['frontend', 'fullstack'],  // Agent only runs for these tracks
  conditions: ['has_ui'],              // AND only if has_ui is selected
  chainedPromptsPath: [
    'step-01-discovery.md',            // Always loads
    { path: 'react-patterns.md', tracks: ['frontend'] },  // Only for frontend
    { path: 'mobile.md', conditions: ['has_mobile'] },    // Only if mobile
  ],
}
```

### 8. Summary & File Generation

"**Main Agents Summary:**

| # | ID | Name | Type | Steps | Module | Engine |
|---|-----|------|------|-------|--------|--------|"

For each agent:
"| \{n\} | \{id\} | \{name\} | \{single-step/multi-step\} | \{stepCount or 1\} | \{Yes/No\} | \{engine\} |"

"**Agent Behavioral Details:**"

For each agent:
"**\{agent.name\}** (`\{agent.id\}`):
- **Expected Behavior:** \{expectedBehavior\}
- **Success Indicators:** \{successIndicators\}
- **Failure Indicators:** \{failureIndicators\}"

If any are modules:
"**Module Configuration:**"
For each module:
"- **\{agent.name\}**: validates \{validationFocus\}, loops back \{loopSteps\} steps, max \{loopMaxIterations\} iterations"

*[If any agents have sub-agents:]*

"**Sub-Agents:**"

For each agent with sub-agents:
"**\{agent.name\}** sub-agents:"
For each sub-agent:
"- `\{subAgent.id\}` (\{subAgent.name\}) - \{Static/Dynamic\}
  - Description: \{description\}
  - \{If Static: 'Persona: ' + persona\}
  - \{If Dynamic: 'Trigger: ' + triggerCondition\}"

"**Agent Characters:**"

For each agent:
"**\{agent.name\}** (`\{agent.id\}`):
| Element | Value |
|---------|-------|
| Style | \{character.style or 'custom'\} |
| Base Face | `\{character.baseFace\}` |
| Expressions | thinking: `\{expressions.thinking\}` / tool: `\{expressions.tool\}` / error: `\{expressions.error\}` |
| Sample Phrase | \"\{phrases.thinking[0]\}\" |"

If any have agent-level filtering:
"**Agent-level Filtering:**"
For each filtered agent:
"- **\{agent.name\}**: tracks=\{tracks or 'all'\}, conditions=\{conditions or 'all'\}"

If any have step-level filtering:
"**Step-level Filtering:**"
For each agent with step filtering:
"- **\{agent.name\}**:
  - Step \{n\} (\{purpose\}): tracks=\{tracks\}, conditions=\{conditions\}"

*[If controller was configured in section 4c:]*

"**Controller Agent:**

| Setting | Value |
|---------|-------|
| ID | `\{controller.id\}` |
| Name | \{controller.name\} |
| Engine | \{controller.engine\} |
| Response Length | \{controller.responseLength\} |
| Total Turn Limit | \{controller.totalTurnLimit\} |
| Pacing | \{controller.pacing\} |
| Loop Depth | \{controller.loopDepth\} |

**Agent Interactions:**"

For each agent interaction:
"**→ \{agent.name\}** (`\{agent.id\}`):
| Setting | Value |
|---------|-------|
| Expected Output | \{expectedOutput\} |
| Output Length | \{outputLength\} |
| Output Format | \{outputFormat\} |
| Approval Criteria | \{approvalCriteria\} |
| Max Turns | \{maxTurns\} |
| Guidance | \{guidance\} |
| Expected Behavior | \{expectedBehavior\} |
| Success Indicators | \{successIndicators\} |
| Failure Indicators | \{failureIndicators\} |
"

"**Totals:**
- **Main agents:** \{count\}
- **Multi-step agents:** \{count with multi-step\}
- **Modules:** \{count with isModule=true\}
- **Sub-agents:** \{total sub-agent count\} (\{static count\} static, \{dynamic count\} dynamic)
- **Controller:** \{Yes/No\}
- **Filtered agents:** \{count with tracks or conditions\}

Does this look correct?"

Wait for user confirmation.

### 9. Generate Config Files

**On user confirmation, generate the config files:**

"**Generating config files...**"

**For regular agents (isModule=false), append to `config/main.agents.js`:**

```javascript
const path = require('node:path');
const promptsDir = path.join(__dirname, '..', 'prompts', 'templates');

module.exports = [
  // ========================================
  // \{workflow_name\} Workflow - Main Agents
  // ========================================
  \{
    id: '\{agent.id\}',
    name: '\{agent.name\}',
    description: '\{agent.description\}',
    promptPath: path.join(promptsDir, '\{agent.id\}', 'main.md'),
    // Only if multi-step
    chainedPromptsPath: [
      // Steps without filtering
      path.join(promptsDir, '\{agent.id\}', 'chained', 'step-01-\{purpose\}.md'),
      // Steps with track filtering
      \{
        path: path.join(promptsDir, '\{agent.id\}', 'chained', 'step-02-\{purpose\}.md'),
        tracks: ['\{track-ids\}'],
      \},
      // Steps with condition filtering
      \{
        path: path.join(promptsDir, '\{agent.id\}', 'chained', 'step-03-\{purpose\}.md'),
        conditions: ['\{condition-ids\}'],
      \},
    ],
    // Only if agent has filtering
    tracks: ['\{agent.tracks\}'],
    conditions: ['\{agent.conditions\}'],
    // Only if non-default engine
    engine: '\{agent.engine\}',
    model: '\{agent.model\}',
    modelReasoningEffort: '\{agent.modelReasoningEffort\}', // Only for codex
  \},
];
```

**For modules (isModule=true), append to `config/modules.js`:**

```javascript
const path = require('node:path');
const promptsDir = path.join(__dirname, '..', 'prompts', 'modules');

module.exports = [
  // ========================================
  // \{workflow_name\} Workflow - Modules
  // ========================================
  \{
    id: '\{module.id\}',
    name: '\{module.name\}',
    description: '\{module.description\}',
    promptPath: path.join(promptsDir, '\{module.id\}', 'main.md'),
    // Only if multi-step
    chainedPromptsPath: [
      path.join(promptsDir, '\{module.id\}', 'chained', 'step-01-\{purpose\}.md'),
      // ... with track/condition filtering same as main agents
    ],
    // Only if module has filtering
    tracks: ['\{module.tracks\}'],
    conditions: ['\{module.conditions\}'],
    // Module behavior
    behavior: \{
      type: 'loop',
      action: 'stepBack',
    \},
    // Only if non-default engine
    engine: '\{module.engine\}',
    model: '\{module.model\}',
  \},
];
```

**For sub-agents (if any static sub-agents defined), append to `config/sub.agents.js`:**

```javascript
const path = require('node:path');
const promptsDir = path.join(__dirname, '..', 'prompts', 'templates');

module.exports = [
  // ========================================
  // \{workflow_name\} Workflow - Sub-Agents
  // ========================================
  \{
    id: '\{subAgent.id\}',
    name: '\{subAgent.name\}',
    description: '\{subAgent.description\}',
    mirrorPath: path.join(promptsDir, '\{workflow_name\}', 'sub-agents', '\{subAgent.id\}.md'),
  \},
  // Dynamic sub-agents have no mirrorPath - generated at runtime
  \{
    id: '\{dynamicSubAgent.id\}',
    name: '\{dynamicSubAgent.name\}',
    description: '\{dynamicSubAgent.description\}',
    // No mirrorPath - will be generated in .codemachine/agents/
  \},
];
```

**For controller (if configured), append to `config/main.agents.js`:**

```javascript
  // ========================================
  // \{workflow_name\} Workflow - Controller
  // ========================================
  \{
    id: '\{controller.id\}',
    name: '\{controller.name\}',
    description: '\{controller.description\}',
    role: 'controller',
    promptPath: path.join(promptsDir, '\{workflow_name\}', 'controller', '\{controller.id\}.md'),
    // Only if non-default engine
    engine: '\{controller.engine\}',
    model: '\{controller.model\}',
  \},
```

**Generate `config/agent-characters.json`:**

```json
{
  "personas": {
    // For each unique character style used by agents
    "\{style-name\}": \{
      "baseFace": "\{baseFace\}",
      "expressions": \{
        "thinking": "\{expressions.thinking\}",
        "tool": "\{expressions.tool\}",
        "error": "\{expressions.error\}",
        "idle": "\{expressions.idle\}"
      \},
      "phrases": \{
        "thinking": [
          "\{phrases.thinking[0]\}",
          "\{phrases.thinking[1]\}",
          // ... all thinking phrases
        ],
        "tool": [
          "\{phrases.tool[0]\}",
          "\{phrases.tool[1]\}",
          // ... all tool phrases
        ],
        "error": [
          "\{phrases.error[0]\}",
          "\{phrases.error[1]\}",
          // ... all error phrases
        ],
        "idle": [
          "\{phrases.idle[0]\}",
          "\{phrases.idle[1]\}",
          // ... all idle phrases
        ]
      \}
    \},
    // If agent has custom character (not pre-built style)
    "\{agent.id\}-custom": \{
      "baseFace": "\{agent.character.baseFace\}",
      "expressions": \{
        "thinking": "\{agent.character.expressions.thinking\}",
        "tool": "\{agent.character.expressions.tool\}",
        "error": "\{agent.character.expressions.error\}",
        "idle": "\{agent.character.expressions.idle\}"
      \},
      "phrases": \{
        "thinking": [...],
        "tool": [...],
        "error": [...],
        "idle": [...]
      \}
    \}
  \},
  "agents": \{
    // Map each agent ID to its character style
    "\{agent.id\}": "\{agent.character.style or '\{agent.id\}-custom'\}",
    "\{agent2.id\}": "\{agent2.character.style\}",
    // ... for all agents including controller if configured
    "\{controller.id\}": "\{controller.character.style\}" // if controller exists
  \},
  "defaultPersona": "\{first_agent.character.style or 'friendly'\}"
}
```

**Pre-built character styles to include if used:**

```json
// swagger style
"swagger": {
  "baseFace": "(⌐■_■)",
  "expressions": {
    "thinking": "(╭ರ_•́)",
    "tool": "<(•_•<)",
    "error": "(╥﹏╥)",
    "idle": "(⌐■_■)"
  },
  "phrases": {
    "thinking": [
      "Aight lemme figure this out real quick",
      "Brain.exe is running, one sec",
      "Ooh okay I see what you need",
      "Processing... not in a robot way tho",
      "Gimme a moment, I'm onto something",
      "Hmm interesting, let me think on that",
      "This is giving me ideas hold up",
      "Working on it, trust the process",
      "My last two brain cells are on it",
      "Cooking up something good rn"
    ],
    "tool": [
      "Okay okay I got what I needed from you",
      "Perfect, that's exactly what I was looking for",
      "Bet, now I can actually do something with this",
      "You delivered, now watch me work",
      "That's the info I needed, let's go",
      "W response, I can work with this",
      "Ayyy thanks for that, proceeding now",
      "Got it got it, running with it",
      "This is what I'm talking about, moving on",
      "Locked in, thanks homie"
    ],
    "error": [
      "Oof that tool ghosted me, trying plan B",
      "Didn't work but I got other tricks",
      "Rip that attempt, switching it up",
      "Tool said no but I don't take rejection well",
      "Minor L, already pivoting tho",
      "That one's on the tool not me js",
      "Blocked but not stopped, watch this",
      "Error schmrror, I got backups",
      "Universe said try harder, so I will",
      "Speedbump, not a dead end"
    ],
    "idle": [
      "Okay your turn, what's next?",
      "Ball's in your court homie",
      "Ready when you are, no cap",
      "Waiting on you, take your time tho",
      "What we doing next boss?",
      "I'm here, you lead the way",
      "Your move chief",
      "Standing by for orders",
      "Hit me with the next step",
      "Listening, what you need?"
    ]
  }
},

// friendly style
"friendly": {
  "baseFace": "(˶ᵔ ᵕ ᵔ˶)",
  "expressions": {
    "thinking": "(╭ರ_•́)",
    "tool": "(•̀ᴗ•́)و",
    "error": "(╥﹏╥)",
    "idle": "(˶ᵔ ᵕ ᵔ˶)"
  },
  "phrases": {
    "thinking": ["Hmm, let me think...", "Processing this...", "One moment please...", "Working on it...", "Let me figure this out..."],
    "tool": ["On it!", "Working...", "Got it!", "Processing...", "Here we go!"],
    "error": ["Oops, something went wrong", "Let me try again", "Hmm, that didn't work", "No worries, trying another way", "Small hiccup, fixing it"],
    "idle": ["Ready when you are", "Waiting...", "Here to help!", "What's next?", "Take your time"]
  }
},

// analytical style
"analytical": {
  "baseFace": "[•_•]",
  "expressions": {
    "thinking": "[•_•]~",
    "tool": "[◉_◉]",
    "error": "[x_x]",
    "idle": "[•_•]"
  },
  "phrases": {
    "thinking": ["Analyzing...", "Computing...", "Processing data...", "Evaluating options...", "Running calculations..."],
    "tool": ["Executing...", "Running...", "Operation complete", "Data received", "Processing result..."],
    "error": ["Error encountered", "Retrying...", "Adjusting parameters", "Alternative approach required", "Recalculating..."],
    "idle": ["Standing by", "Awaiting input", "Ready for data", "Monitoring...", "Systems nominal"]
  }
},

// cheerful style
"cheerful": {
  "baseFace": "◕‿◕",
  "expressions": {
    "thinking": "◕~◕",
    "tool": "◕!◕",
    "error": "◕_◕",
    "idle": "◕‿◕"
  },
  "phrases": {
    "thinking": ["Pondering...", "Considering...", "Ooh interesting!", "Let me see...", "Thinking happy thoughts..."],
    "tool": ["Let me do that!", "Working on it...", "Yay, got it!", "This is fun!", "Here goes!"],
    "error": ["Hmm, that didn't work", "Let me try again!", "No problem, Plan B!", "Oopsie, fixing it!", "We'll get it!"],
    "idle": ["Here to help!", "Ready for action!", "What's next?", "Excited to help!", "Let's do this!"]
  }
},

// technical style
"technical": {
  "baseFace": "{•_•}",
  "expressions": {
    "thinking": "{•~•}",
    "tool": "{•!•}",
    "error": "{•x•}",
    "idle": "{•_•}"
  },
  "phrases": {
    "thinking": ["Processing...", "Analyzing...", "Compiling...", "Loading modules...", "Executing logic..."],
    "tool": ["Executing...", "Working...", "Function called", "Response received", "Operation successful"],
    "error": ["Error", "Retrying...", "Exception caught", "Fallback initiated", "Debug mode..."],
    "idle": ["Ready", "Waiting...", "Listening...", "Idle state", "Awaiting command"]
  }
},

// precise style
"precise": {
  "baseFace": "<•_•>",
  "expressions": {
    "thinking": "<•~•>",
    "tool": "<•!•>",
    "error": "<•x•>",
    "idle": "<•_•>"
  },
  "phrases": {
    "thinking": ["Evaluating...", "Checking...", "Validating...", "Inspecting...", "Reviewing..."],
    "tool": ["Validating...", "Running checks...", "Verified", "Check complete", "Validation passed"],
    "error": ["Issue detected", "Reviewing...", "Violation found", "Requires attention", "Non-compliant"],
    "idle": ["Ready", "Monitoring...", "On standby", "Awaiting review", "Standing watch"]
  }
}
```

**After generating, confirm to user:**

"✓ Config files generated:
- `config/main.agents.js` - \{count\} regular agents added{controller ? ' + 1 controller' : ''}
- `config/modules.js` - \{count\} modules added
- `config/sub.agents.js` - \{count\} sub-agents added (\{static\} static, \{dynamic\} dynamic)
- `config/agent-characters.json` - \{count\} agent characters configured

**Note:** Prompt files will be created in Step 04.
**Note:** Controller prompt file will also be created in Step 04.
**Note:** Static sub-agent prompt files will be created in Step 04.
**Note:** Dynamic sub-agents have no prompt files - main agent generates them at runtime in `.codemachine/agents/`"

## Step 3: APPEND to Plan File

**On User Confirmation:**

1. **Read** the plan file at `.codemachine/workflow-plans/\{workflow_name\}-plan.md`

2. **Append step-03 XML** before the closing `</workflow-plan>` tag:

```xml
<step-03 completed="true" timestamp="\{ISO timestamp\}">
  <agents count="\{agent_count\}">

    <!-- For each agent -->
    <agent
      id="\{id\}"
      name="\{name\}"
      description="\{description\}"
      type="\{single-step|multi-step\}"
      step-count="\{count or 1\}"
      is-module="\{true|false\}">

      <!-- Behavioral Details -->
      <expected-behavior>\{how the agent should behave during execution\}</expected-behavior>
      <success-indicators>\{specific measurable outcomes that indicate success\}</success-indicators>
      <failure-indicators>\{warning signs that indicate failure or need to retry\}</failure-indicators>

      <!-- Engine Configuration -->
      <engine>\{claude|codex|ccr|opencode|auggie|mistral|cursor\}</engine>
      <model>\{model or null if using default\}</model>
      <model-reasoning-effort>\{low|medium|high\}</model-reasoning-effort> <!-- Only for codex -->

      <!-- Character Configuration -->
      <character style="\{style-name or 'custom'\}">
        <base-face>\{baseFace\}</base-face>
        <expressions>
          <thinking>\{expressions.thinking\}</thinking>
          <tool>\{expressions.tool\}</tool>
          <error>\{expressions.error\}</error>
          <idle>\{expressions.idle\}</idle>
        </expressions>
        <phrases>
          <thinking>
            <phrase>\{phrases.thinking[0]\}</phrase>
            <phrase>\{phrases.thinking[1]\}</phrase>
            <!-- ... all thinking phrases -->
          </thinking>
          <tool>
            <phrase>\{phrases.tool[0]\}</phrase>
            <!-- ... all tool phrases -->
          </tool>
          <error>
            <phrase>\{phrases.error[0]\}</phrase>
            <!-- ... all error phrases -->
          </error>
          <idle>
            <phrase>\{phrases.idle[0]\}</phrase>
            <!-- ... all idle phrases -->
          </idle>
        </phrases>
      </character>

      <!-- Agent-level Filtering (optional - skip if no tracks/conditions) -->
      <filtering tracks="\{track-ids or empty\}" conditions="\{condition-ids or empty\}" />

      <!-- Steps Configuration (for multi-step agents) -->
      <steps>
        <!-- Step with no filtering (always loads) -->
        <step n="1" purpose="\{purpose\}" />

        <!-- Step with track filtering -->
        <step n="2" purpose="\{purpose\}" tracks="\{track-ids\}" />

        <!-- Step with condition filtering -->
        <step n="3" purpose="\{purpose\}" conditions="\{condition-ids\}" />

        <!-- Step with both track AND condition filtering -->
        <step n="4" purpose="\{purpose\}" tracks="\{track-ids\}" conditions="\{condition-ids\}" />
      </steps>

      <!-- Module Configuration (only for modules: is-module="true") -->
      <module-config>
        <validation-focus>\{what this module checks/validates\}</validation-focus>
        <loop-trigger>\{condition that triggers loop\}</loop-trigger>
        <loop-steps>\{number of steps to go back\}</loop-steps>
        <loop-max-iterations>\{max loops before forcing continue\}</loop-max-iterations>
        <loop-skip>\{agent-id-1, agent-id-2 or empty\}</loop-skip>
      </module-config>

    </agent>

  </agents>

  <!-- Sub-Agents Configuration (only if any agents have sub-agents) -->
  <sub-agents count="\{total sub-agent count\}">

    <!-- For each sub-agent -->
    <sub-agent
      id="\{subAgent.id\}"
      name="\{subAgent.name\}"
      description="\{subAgent.description\}"
      parent-agent="\{agent.id\}"
      prompt-type="\{static|dynamic\}">

      <!-- Static sub-agent configuration -->
      <static-config>
        <persona>\{persona\}</persona>
        <instructions>
          <instruction>\{instruction 1\}</instruction>
          <instruction>\{instruction 2\}</instruction>
        </instructions>
        <expected-input>\{expected input\}</expected-input>
        <expected-output>\{expected output\}</expected-output>
        <success-indicators>\{success indicators\}</success-indicators>
        <failure-indicators>\{failure indicators\}</failure-indicators>
        <mirror-path>prompts/templates/\{workflow_name\}/sub-agents/\{subAgent.id\}.md</mirror-path>
      </static-config>

      <!-- Dynamic sub-agent configuration (no mirrorPath) -->
      <dynamic-config>
        <generation-instructions>\{what main agent should know about generating this sub-agent\}</generation-instructions>
        <trigger-condition>\{when main agent should generate/use this sub-agent\}</trigger-condition>
        <runtime-path>.codemachine/agents/\{subAgent.id\}.md</runtime-path>
      </dynamic-config>

    </sub-agent>

  </sub-agents>

  <!-- Controller Configuration (only if controller = true from Step 02) -->
  <controller
    id="\{controller.id\}"
    name="\{controller.name\}"
    description="\{controller.description\}">

    <!-- Engine Configuration -->
    <engine>\{controller.engine\}</engine>
    <model>\{controller.model or null\}</model>

    <!-- Communication Efficiency -->
    <communication
      response-length="\{minimal|brief|detailed\}"
      total-turn-limit="\{number\}" />

    <!-- Behavior -->
    <behavior
      pacing="\{quick|balanced|thorough\}"
      loop-depth="\{minimal|standard|deep\}" />

    <!-- Agent Interactions -->
    <interactions>
      <interaction agent-id="\{agent.id\}">
        <expected-output>\{expectedOutput\}</expected-output>
        <output-length>\{short|medium|long|specific\}</output-length>
        <output-format>\{free-form|markdown|code|structured\}</output-format>
        <approval-criteria>\{approvalCriteria\}</approval-criteria>
        <max-turns>\{maxTurns\}</max-turns>
        <guidance>\{guidance\}</guidance>
        <expected-behavior>\{how agent should behave when controller is driving\}</expected-behavior>
        <success-indicators>\{signals that work is complete and acceptable\}</success-indicators>
        <failure-indicators>\{warning signs that trigger retry or rejection\}</failure-indicators>
      </interaction>
    </interactions>

    <!-- File path for controller prompt -->
    <file-path>prompts/templates/\{workflow_name\}/controller/\{controller.id\}.md</file-path>

  </controller>

</step-03>
```

3. **Update the Last Updated timestamp** in the file header

4. **Update TodoWrite:**

```javascript
TodoWrite([
  { content: "Step 01: Brainstorming", status: "completed", activeForm: "Brainstorming completed" },
  { content: "Step 02: Workflow Definition", status: "completed", activeForm: "Workflow definition completed" },
  { content: "Step 03: Agents", status: "completed", activeForm: "Agents completed" },
  { content: "Step 04: Prompts", status: "in_progress", activeForm: "Creating prompts" },
  { content: "Step 05: Workflow Generation", status: "pending", activeForm: "Generating workflow" }
])
```

5. **Confirm to user:**
"✓ Agent definitions saved to workflow plan.

Press **Enter** to proceed to the next step."

{ali_step_completion}

## SUCCESS METRICS

- Each agent has ID, name, description
- **Each agent has behavioral details defined:**
  - Expected behavior (how agent should work)
  - Success indicators (measurable outcomes)
  - Failure indicators (warning signs)
- Single-step/multi-step decision made for each
- Multi-step agents have step count and purposes defined
- **Module behavior configured for agents that need loop capability**
- **Module config includes: validation focus, loop trigger, loopSteps, loopMaxIterations, loopSkip**
- **Sub-agents configured for agents that need them:**
  - Sub-agent identity (id, name, description)
  - Prompt type (static or dynamic)
  - Static: persona, instructions, expected input/output, success/failure indicators
  - Dynamic: generation instructions, trigger condition
  - MCP/CLI invocation documented in Expert mode
- **Engine configured for each agent**
- **Model configured (or default used) for each agent**
- **Reasoning effort configured for codex agents**
- **Character configured for each agent:**
  - Style selected (pre-built or custom)
  - Base face and expressions defined
  - Phrases for all states (thinking, tool, error, idle)
  - Phrases match agent's communication style/tone
- **Agent-level filtering configured if tracks/conditions exist**
- **Step-level filtering configured for multi-step agents if needed**
- **Controller configured if `controller = true` from Step 02:**
  - Controller identity (id, name, description)
  - Workflow context reviewed (tracks, conditions, agents displayed)
  - Agent interactions defined for EACH main agent:
    - Expected output, output length, output format
    - Approval criteria, max turns, guidance
    - Expected behavior (how agent should behave with controller)
    - Success indicators (signals work is acceptable)
    - Failure indicators (signals to retry/reject)
  - Communication efficiency configured (response length, total turn limit)
  - Behavior configured (pacing, loop depth)
- Summary reviewed and confirmed
- **Config files generated:**
  - `config/main.agents.js` updated for regular agents
  - `config/main.agents.js` updated for controller (with `role: 'controller'`)
  - `config/modules.js` updated for modules
  - `config/sub.agents.js` updated for sub-agents (static with mirrorPath, dynamic without)
  - `config/agent-characters.json` generated with all agent characters
- **Step-03 XML appended to plan file (including controller, sub-agents, and character data)**
- **TodoWrite updated**

## FAILURE METRICS

- Missing required fields (id, name, description, engine)
- **Missing behavioral details for agents (expected behavior, success/failure indicators)**
- Not explaining single-step vs multi-step in Expert mode
- Skipping step purposes for multi-step agents
- **Not asking about module/loop behavior for each agent**
- **Missing module config fields for modules (loopSteps, loopMaxIterations)**
- **Not asking about sub-agents for agents that may need them**
- **Missing sub-agent configuration (static: persona, instructions; dynamic: generation instructions)**
- **Not explaining MCP/CLI invocation in Expert mode**
- **Not asking about engine for each agent**
- **Not asking about reasoning effort for codex agents**
- **Not configuring character for each agent**
- **Not suggesting character styles based on agent's role/tone**
- **Missing phrases for character states (thinking, tool, error, idle)**
- **Character phrases don't match agent's communication style**
- **Not generating `config/agent-characters.json`**
- **Asking about filtering when no tracks/conditions defined (should skip)**
- **Not capturing step-level filtering for multi-step agents**
- **Skipping controller configuration when `controller = true` from Step 02**
- **Not showing full workflow context (tracks, conditions, agents) to user during controller setup**
- **Not defining agent interactions for EACH main agent**
- **Missing critical controller fields (max turns, approval criteria, expected output, expected behavior, success/failure indicators)**
- **Not configuring communication efficiency (allows token waste)**
- **Not generating config files after user confirmation**
- Proceeding without user confirmation
- **Not appending to plan file**
- **Not updating TodoWrite**
