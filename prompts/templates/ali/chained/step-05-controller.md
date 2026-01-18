---
name: "Step 05 - Controller Agent"
description: "Optional controller agent for autonomous mode"
---

# Step 05: Controller Agent (Optional)

## STEP GOAL

If user wants autonomous mode, create a powerful controller agent that:
- Responds on behalf of the user
- Has defined tone, language, and behavior
- Knows which agents it talks to and expected outputs
- Uses calibration schema for project complexity

## Sequence of Instructions

### 1. Check Controller Flag

Reference the `controller` flag from step 2.

**If controller = false:**
"**Controller Agent**

In step 2, you indicated this workflow won't use a controller agent. Autonomous mode won't be available.

If you've changed your mind and want autonomous mode, let me know. Otherwise, we'll skip this step.

Continue without controller? **[y/n]**"

If yes: Skip to step completion.
If no: Set `controller = true` and continue.

**If controller = true:**
"**Let's create your Controller Agent!**

A controller agent is a special agent that responds on behalf of the user during autonomous mode. When users press **Shift+Tab** to enable autonomous mode, the controller takes over and drives the workflow."

### 2. Explain Autonomous Mode

**In Expert mode, explain:**
"**How Autonomous Mode Works:**

| Mode | Who Responds | Keyboard |
|------|--------------|----------|
| Manual | User types responses | Default |
| Autonomous | Controller responds for user | Shift+Tab |

**The 8 Scenarios:**

| # | interactive | autoMode | Behavior |
|---|-------------|----------|----------|
| 1 | true | true | Controller drives with prompts |
| 2 | true | true | Controller drives single step |
| 3 | true | false | User drives (manual) |
| 4 | true | false | User drives (manual) |
| 5 | false | true | FULLY AUTONOMOUS |
| 6 | false | true | Auto-advance (no prompts) |

When autonomous mode is ON (Shift+Tab), the controller agent receives each agent's output and responds with guidance, feedback, or approval.

**Controller Operational Modes:**
1. **Conversational** - Answers questions, provides feedback, gives direction
2. **Approval** - Uses MCP tools to approve/reject agent work

The controller calibrates its responses based on project complexity."

### 3. Controller Identity

"**Let's define your controller's identity.**

**1. Controller ID** (lowercase with hyphens):
Example: `project-controller`, `workflow-po`

Enter controller ID:"

Wait. Validate against `existing_ids`. Store as `controller.id`.

"**2. Controller Name** (display name):
Example: `Project Owner`, `Workflow Controller`

Enter name:"

Wait. Store as `controller.name`.

"**3. Controller Description:**

Enter description:"

Wait. Store as `controller.description`.

### 4. Controller Engine & Model (Optional)

"**Engine & Model Configuration**

You can optionally specify which AI engine and model the controller should use.

**Engine** (optional - leave blank for system default):
Available engines: `opencode`, `claude`, `codex`, `cursor`, `mistral`, `auggie`, `ccr`

Enter engine ID (or press Enter to skip):"

Wait. Store as `controller.engine` (or null if blank).

**If engine provided:**
"**Model** (optional - leave blank for engine's default):

Enter model name:"

Wait. Store as `controller.model` (or null if blank).

**If no engine provided:**
Store `controller.engine = null` and `controller.model = null`.

### 5. Communication Style

"**How should your controller communicate?**

**Tone** - How formal or casual?

1. **Casual** - Friendly, relaxed, uses contractions
2. **Professional** - Clear, business-like, balanced
3. **Formal** - Precise, structured, no slang

Enter **1**, **2**, or **3**:"

Wait. Store as `controller.tone`.

"**Language** - What language should controller use?

Enter language (e.g., English, Spanish, Arabic):"

Wait. Store as `controller.language`.

"**Reply Length** - How verbose should responses be?

1. **Short** - Brief, to the point, minimal explanation
2. **Medium** - Balanced detail, explains when needed
3. **Long** - Thorough, comprehensive, detailed reasoning

Enter **1**, **2**, or **3**:"

Wait. Store as `controller.replyLength`.

### 6. Behavior Configuration

"**How should the controller behave during workflow execution?**

**Pacing** - How quickly should controller proceed?

1. **Quick** - Approve fast, minimal review, trust agents
2. **Balanced** - Review key decisions, spot-check work
3. **Thorough** - Deep review everything, detailed feedback

Enter **1**, **2**, or **3**:"

Wait. Store as `controller.pacing`.

"**Loop Depth** - When agents iterate (fix issues, refine work), how many loops?

1. **Minimal** - 1-2 iterations max, accept good-enough
2. **Standard** - 3-5 iterations, aim for quality
3. **Deep** - Unlimited until perfect, high standards

Enter **1**, **2**, or **3**:"

Wait. Store as `controller.loopDepth`.

### 7. Agent Interactions

"**Which agents will the controller interact with?**

Your main agents from step 3:"

List all agents defined:
"| # | Agent | Description |
|---|-------|-------------|"
For each: "| {n} | {agent.name} | {agent.description} |"

"For each agent, define how the controller should interact:

**Agent: {agent.name}**

**What output does the controller expect from this agent?**
Example: 'A validated project specification', 'Working code with tests'

Enter expected output:"

Wait. Store as `controller.agentInteractions[agent.id].expectedOutput`.

"**What guidance should the controller provide to this agent?**
Example: 'Focus on security best practices', 'Keep it simple'

Enter guidance:"

Wait. Store as `controller.agentInteractions[agent.id].guidance`.

"**When should controller approve vs request changes?**

Approval criteria:"

Wait. Store as `controller.agentInteractions[agent.id].approvalCriteria`.

Repeat for each agent.

### 8. Calibration Schema

"**Calibration Schema**

The controller adjusts its behavior based on project complexity. Let's define the calibration levels.

**Project Types** (from simple to complex):

| Type | Description | Controller Behavior |
|------|-------------|---------------------|
| landing-page | Simple static site | Quick approvals, minimal review |
| mvp | Minimum viable product | Balanced review, focus on core features |
| feature | Single feature addition | Standard review, check integration |
| full-product | Complete application | Thorough review, ensure quality |
| enterprise | Large-scale system | Deep review, strict standards |

**Should the controller ask about project type at workflow start?** **[y/n]**"

Wait. Store as `controller.askProjectType`.

"**Default project type** (if not asked or not specified):

Enter default (landing-page/mvp/feature/full-product/enterprise):"

Wait. Store as `controller.defaultProjectType`.

### 9. Controller Prompt Preview

"**Controller Prompt Preview:**

```markdown
---
name: '{controller.name}'
description: '{controller.description}'
---

<agent>
<activation>
  <step n=\"1\">Parse workflow context and determine calibration</step>
  <step n=\"2\">Read agent input and respond according to operational mode</step>
</activation>

<rules>
  - Calibrate response depth based on project type
  - Each agent owns their workflow domain
  - Provide right-sized feedback
  - Communicate naturally, not robotically
</rules>

<persona>
  <role>Workflow Controller - responds on behalf of user in autonomous mode</role>
  <communication_style>
    Tone: {controller.tone}
    Language: {controller.language}
    Length: {controller.replyLength}
  </communication_style>
  <behavior>
    Pacing: {controller.pacing}
    Loop Depth: {controller.loopDepth}
  </behavior>
</persona>

<operational-modes>
  <mode id=\"1\" name=\"Conversational\">
    Answer questions, provide feedback, give direction to agents
  </mode>
  <mode id=\"2\" name=\"Approval\">
    Use MCP tools to approve agent work or request changes
  </mode>
</operational-modes>

<agent-interactions>
{for each agent}
  <agent id=\"{agent.id}\">
    <expected_output>{expectedOutput}</expected_output>
    <guidance>{guidance}</guidance>
    <approval_criteria>{approvalCriteria}</approval_criteria>
  </agent>
{end for}
</agent-interactions>

<calibration-schema>
  <ask_project_type>{controller.askProjectType}</ask_project_type>
  <default_type>{controller.defaultProjectType}</default_type>
  <calibration_levels>
    <level type=\"landing-page\" review=\"minimal\" iterations=\"1-2\" />
    <level type=\"mvp\" review=\"balanced\" iterations=\"2-3\" />
    <level type=\"feature\" review=\"standard\" iterations=\"3-4\" />
    <level type=\"full-product\" review=\"thorough\" iterations=\"4-5\" />
    <level type=\"enterprise\" review=\"deep\" iterations=\"unlimited\" />
  </calibration_levels>
</calibration-schema>
</agent>
```

Does this controller configuration look correct? **[y/n]**"

**If no:** Allow edits, regenerate, ask again.

**If yes:** IMMEDIATELY create the controller:
1. Create folder: `prompts/templates/{workflow_name}/controller/`
2. Write file: `prompts/templates/{workflow_name}/controller/{controller.id}.md`
3. Confirm: "✓ Created: `prompts/templates/{workflow_name}/controller/{controller.id}.md`"

### 10. Summary

"**Controller Agent - Step 5 Complete!**

**File Created:**
✓ `prompts/templates/{workflow_name}/controller/{controller.id}.md`

**Controller Details:**
- ID: `{controller.id}`
- Name: {controller.name}
- Engine: {controller.engine or 'System default'}
- Model: {controller.model or 'Engine default'}
- Tone: {tone} | Language: {language} | Length: {length}
- Pacing: {pacing} | Loop Depth: {loopDepth}
- Agent Interactions: {count} agents configured

**Config entry to add in step 8:**
```javascript
{
  id: '{controller.id}',
  name: '{controller.name}',
  description: '{controller.description}',
  role: 'controller',
  promptPath: path.join(promptsDir, '{workflow_name}', 'controller', '{controller.id}.md'),
}
```

Controller prompt file is ready. Config will be updated in step 8."

## Step 5: APPEND to Plan File

**On User Confirmation:**

1. **Read** the plan file at `.codemachine/workflow-plans/{workflow_name}-plan.md`

2. **Append step-05 XML** before the closing `</workflow-plan>` tag:

**If controller was created:**
```xml
<step-05 completed="true" timestamp="{ISO timestamp}">
  <controller id="{controller.id}" name="{controller.name}" description="{controller.description}">
    <engine>{engine or null}</engine>
    <model>{model or null}</model>
    <communication tone="{casual|professional|formal}" language="{language}" reply-length="{short|medium|long}" />
    <behavior pacing="{quick|balanced|thorough}" loop-depth="{minimal|standard|deep}" />
    <agent-interactions>
      <!-- For each main agent -->
      <interaction agent-id="{agent.id}" expected-output="{expected}" guidance="{guidance}" approval-criteria="{criteria}" />
    </agent-interactions>
    <calibration ask-project-type="{true|false}" default-type="{landing-page|mvp|feature|full-product|enterprise}" />
    <file-path>prompts/templates/{workflow_name}/controller/{controller.id}.md</file-path>
  </controller>
</step-05>
```

**If controller was skipped:**
```xml
<step-05 completed="skipped" timestamp="{ISO timestamp}">
  <reason>Controller not needed - autonomous mode disabled</reason>
</step-05>
```

3. **Update the Last Updated timestamp** in the file header

4. **Update TodoWrite:**

```javascript
TodoWrite([
  { content: "Step 01: Mode Selection", status: "completed", activeForm: "Mode selection completed" },
  { content: "Step 02: Workflow Definition", status: "completed", activeForm: "Workflow definition completed" },
  { content: "Step 03: Main Agents", status: "completed", activeForm: "Main agents completed" },
  { content: "Step 04: Prompts & Placeholders", status: "completed", activeForm: "Prompts created" },
  { content: "Step 05: Controller Agent", status: "completed", activeForm: "Controller completed" },
  { content: "Step 06: Sub-Agents", status: "in_progress", activeForm: "Configuring sub-agents" },
  { content: "Step 07: Modules", status: "pending", activeForm: "Configuring modules" },
  { content: "Step 08: Assembly & Validation", status: "pending", activeForm: "Assembling workflow" }
])
```

5. **Confirm to user:**
"✓ Controller configuration saved to workflow plan.

Press **Enter** to proceed to the next step."

{ali_step_completion}

## SUCCESS METRICS

- Controller flag checked from step 2
- If controller: full identity defined (id, name, description)
- Engine and model configured or explicitly skipped
- Communication style configured (tone, language, length)
- Behavior configured (pacing, loop depth)
- Agent interactions defined for all main agents
- Calibration schema configured
- Controller prompt file WRITTEN to disk
- User confirmed configuration before file creation
- **Step-05 XML appended to plan file**
- **TodoWrite updated**

## FAILURE METRICS

- File not actually written after confirmation
- Creating controller when flag was false without confirmation
- Missing controller identity fields
- Not defining agent interactions
- Skipping calibration schema
- Not explaining autonomous mode in Expert mode
- Proceeding without user confirmation
- **Not appending to plan file**
- **Not updating TodoWrite**
