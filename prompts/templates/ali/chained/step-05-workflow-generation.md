---
name: "Step 05 - Workflow Generation"
description: "Create workflow.js, update configs, verify and fix anything missing"
---

# Step 05: Workflow Generation

## STEP GOAL

Final step - complete the workflow:
1. Create workflow.js file
2. Update all config files (main.agents.js, sub.agents.js, modules.js, placeholders.js)
3. Verify all files exist - fix anything missing
4. Educate user about running the workflow

**🎯 GUIDE USER TO CORRECT STEP:** This is the final step. If user wants to go back and modify something from earlier steps (agents, prompts, workflow definition), guide them: "To modify that, you can delete `./.codemachine/template.json` to reset and reselect tracks/conditions, or we can make adjustments after generation is complete."

## Track-Based Behavior

**Check `{selected_track}` and adapt accordingly:**

---

**`create-workflow`:** Execute full sequence below - generate workflow.js and update all configs.

---

**`modify-workflow`:**
- Plan file already has existing workflow from `<step-05>`
- Show current workflow.js configuration
- Ask: "What needs to be regenerated?" (workflow.js only, specific configs, full regeneration)
- Only update the requested files
- Re-validate everything and update plan file

---

**`have-questions`:**
- Q&A mode only - answer questions about workflow generation
- Topics: workflow.js structure, config files, validation, running workflows, debugging
- Do NOT create or modify anything
- After answering, tell user: "That's all the steps! Press **Enter** to complete, or ask more questions."

---

## Sequence of Instructions (create-workflow / modify-workflow)

### 1. Assembly Overview

"**Final Step: Assembly & Validation**

All prompt files have been created in previous steps. Now I'll:

1. Create the workflow.js file
2. Update config files with new entries
3. Verify everything is connected
4. Fix anything missing

Let's complete your workflow!"

### 2. Review What Was Created

"**Files Created in Previous Steps:**"

List all files created:
"**Main Agent Prompts (Step 4):**"
For each: "✓ `prompts/templates/\{workflow_name\}/\{agent.id\}/\{agent.id\}.md`"
If chained: list step files

If controller (Step 5):
"**Controller (Step 5):**
✓ `prompts/templates/\{workflow_name\}/controller/\{controller.id\}.md`"

If sub-agents (Step 6):
"**Sub-Agent Prompts (Step 6):**"
For each: "✓ `prompts/templates/\{workflow_name\}/sub-agents/\{subAgent.id\}.md`"

If modules (Step 7):
"**Module Prompts (Step 7):**"
For each: "✓ `prompts/templates/\{workflow_name\}/modules/\{module.id\}.md`"

If shared files:
"**Shared Files (Step 4):**"
For each: "✓ `prompts/templates/\{workflow_name\}/shared/\{shared.name\}.md`"

### 3. Verify All Files Exist

"**Verifying files...**"

Actually check each file exists on disk. For each file:
- If exists: "✓ \{path\}"
- If missing: "⚠️ MISSING: \{path\}"

**If any files are missing:**
"**Missing Files Detected:**"
List missing files.

"I'll recreate these now. Please confirm the content for each:"

For each missing file:
- Show the content that was approved earlier
- Ask user to confirm
- Create the file
- Confirm: "✓ Fixed: \{path\}"

**If all files exist:**
"✓ All \{count\} prompt files verified!"

### 4. Create Workflow File

"**Creating workflow file...**"

Generate and write `templates/workflows/\{workflow_id\}.workflow.js`:

**IMPORTANT NAMING:**
- `\{workflow_id\}` = kebab-case for file names and IDs (e.g., `demo-workflow`)
- `\{workflow_display_name\}` = Normal casing with spaces for the `name` property (e.g., `Demo Workflow`)

---

## Workflow Template Reference

Use this reference to generate correct workflow files. Engine/model are optional in workflow steps since they're already configured in agent config files.

### Top-Level Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | string | Yes | Workflow display name (normal casing with spaces) |
| `steps` | WorkflowStep[] | Yes | Array of step objects |
| `autonomousMode` | `true` \| `false` \| `'never'` \| `'always'` | No | Initial autonomous mode (default: `true`) |
| `specification` | boolean | No | Requires specification file before workflow starts |
| `subAgentIds` | string[] | No | Sub-agents for orchestration |
| `tracks` | TracksConfig | No | Track selection configuration |
| `conditionGroups` | ConditionGroup[] | No | Conditional step groups |
| `controller` | ControllerDefinition | No | Controller agent for pre-workflow conversation |

### Step Types

**Agent Step (via resolveStep):**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `agentId` | string | Yes | Agent identifier |
| `agentName` | string | Yes | Display name |
| `promptPath` | string \| string[] | Yes | Path(s) to prompt file(s) |
| `model` | string | No | Model override (e.g., `'gpt-5'`, `'opus'`) |
| `modelReasoningEffort` | `'low'` \| `'medium'` \| `'high'` | No | Reasoning effort level |
| `engine` | string | No | Engine override (`'claude'`, `'codex'`, `'gemini'`) |
| `executeOnce` | boolean | No | Skip if already executed |
| `interactive` | boolean | No | `true` = wait for input, `false` = auto-advance |
| `tracks` | string[] | No | Track names this step belongs to |
| `conditions` | string[] | No | Conditions required for this step |

**Module Step (via resolveModule):**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `type` | `'module'` | Yes | Step type |
| `agentId` | string | Yes | Agent identifier |
| `module` | ModuleMetadata | Yes | Module metadata with behavior |
| `loopSteps` | number | Yes | How many steps to go back |
| `loopMaxIterations` | number | Yes | Maximum loop iterations |
| `loopSkip` | string[] | No | Agent IDs to skip in loop |

**Separator Step:**

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `type` | `'separator'` | Yes | Step type |
| `text` | string | Yes | Divider text |

### Module Behavior Types

**Loop Behavior:**
```javascript
module: {
  id: 'check-task',
  behavior: {
    type: 'loop',
    action: 'stepBack',
    steps: 3,              // Go back N steps
    trigger: 'continue',   // Optional trigger string
    maxIterations: 20,     // Optional max loops
    skip: ['plan-agent'],  // Optional: steps to skip in loop
  }
}
```

**Trigger Behavior:**
```javascript
module: {
  id: 'trigger-agent',
  behavior: {
    type: 'trigger',
    action: 'mainAgentCall',
    triggerAgentId: 'sub-agent-id',
  }
}
```

**Checkpoint Behavior:**
```javascript
module: {
  id: 'checkpoint',
  behavior: {
    type: 'checkpoint',
    action: 'evaluate',
  }
}
```

### Tracks Configuration

```javascript
tracks: {
  question: 'What type of project?',
  options: {
    quick: { label: 'Small Project', description: 'Fast iteration' },
    bmad: { label: 'Enterprise', description: 'Full BMAD methodology' },
  }
}
```

### Condition Groups

```javascript
conditionGroups: [
  {
    id: 'features',
    question: 'What features does your project have?',
    multiSelect: true,              // Checkboxes vs radio buttons
    tracks: ['bmad'],               // Optional: only show for these tracks
    conditions: {
      has_ui: { label: 'Has UI', description: '...' },
      has_api: { label: 'Has API', description: '...' },
    },
    children: {                     // Optional nested conditions
      has_ui: {
        question: 'Which UI framework?',
        multiSelect: false,
        conditions: {
          react: { label: 'React', description: '...' },
          vue: { label: 'Vue', description: '...' },
        }
      }
    }
  }
]
```

### Controller Definition

```javascript
import { controller } from './helpers.js';

export default {
  name: 'My Workflow',
  controller: controller('my-controller-agent', {
    engine: 'codex',   // Optional engine
    model: 'gpt-5',    // Optional model
  }),
  steps: [...]
}
```

### Helper Functions

```javascript
// Basic step (engine/model from agent config)
resolveStep('agent-id')

// Step with overrides
resolveStep('agent-id', {
  engine: 'claude',
  model: 'opus',
  modelReasoningEffort: 'high',
  agentName: 'Custom Name',
  promptPath: './custom/prompt.md',
  executeOnce: true,
  interactive: false,
  tracks: ['track-id'],
  conditions: ['condition-id'],
})

// Module with loop behavior
resolveModule('check-task', {
  loopSteps: 3,
  loopMaxIterations: 20,
  loopSkip: ['plan-agent'],
})

// Folder (loads all numbered files)
...resolveFolder('folder-name', { engine: 'codex' })

// Separator
separator('Phase Name')
```

---

## Generate Workflow File

Using the plan data and reference above, generate `templates/workflows/\{workflow_id\}.workflow.js`:

```javascript
export default {
  name: '\{workflow_display_name\}',
  \{if controller\}controller: controller('\{controller.id\}'\{if controller.engine || controller.model\}, { \{if controller.engine\}engine: '\{controller.engine\}'\{end if\}\{if controller.engine && controller.model\}, \{end if\}\{if controller.model\}model: '\{controller.model\}'\{end if\} }\{end if\}),\{end if\}
  \{if autonomousMode !== null\}autonomousMode: \{autonomousMode\},\{end if\}
  \{if specification\}specification: true,\{end if\}

  \{if tracks\}
  tracks: {
    question: '\{tracks.question\}',
    options: {
      \{for each track\}
      '\{track.id\}': {
        label: '\{track.label\}',
        description: '\{track.description\}',
      },
      \{end for\}
    },
  },
  \{end if\}

  \{if conditionGroups\}
  conditionGroups: [
    \{for each group\}
    {
      id: '\{group.id\}',
      question: '\{group.question\}',
      multiSelect: \{group.multiSelect\},
      \{if group.tracks\}tracks: [\{group.tracks\}],\{end if\}
      conditions: {
        \{for each condition\}
        '\{condition.id\}': {
          label: '\{condition.label\}',
          description: '\{condition.description\}',
        },
        \{end for\}
      },
      \{if group.children\}
      children: {
        \{for each child\}
        '\{child.parentConditionId\}': {
          question: '\{child.question\}',
          multiSelect: \{child.multiSelect\},
          conditions: {
            \{for each childCondition\}
            '\{childCondition.id\}': {
              label: '\{childCondition.label\}',
              description: '\{childCondition.description\}',
            },
            \{end for\}
          },
        },
        \{end for\}
      },
      \{end if\}
    },
    \{end for\}
  ],
  \{end if\}

  steps: [
    \{for each agent\}
    resolveStep('\{agent.id\}'\{if agent.tracks || agent.conditions || agent.interactive === false\}, {
      \{if agent.tracks\}tracks: [\{agent.tracks\}],\{end if\}
      \{if agent.conditions\}conditions: [\{agent.conditions\}],\{end if\}
      \{if agent.interactive === false\}interactive: false,\{end if\}
    }\{end if\}),
    \{end for\}

    \{for each module\}
    resolveModule('\{module.id\}', {
      loopSteps: \{module.loopSteps\},
      loopMaxIterations: \{module.loopMaxIterations\},
      \{if module.loopSkip\}loopSkip: [\{module.loopSkip\}],\{end if\}
    }),
    \{end for\}
  ],

  \{if subAgents\}
  subAgentIds: [
    \{for each subAgent\}'\{subAgent.id\}',\{end for\}
  ],
  \{end if\}
};
```

**Note:** Engine and model are typically configured in the agent config files (`main.agents.js`, `modules.js`), so they're usually omitted from workflow steps unless you need to override them.

After writing:
"✓ Created: `templates/workflows/\{workflow_id\}.workflow.js`"

### 5. Update Config Files

"**Updating config files...**"

**Append to `config/main.agents.js`:**

```javascript
// ========================================
// \{workflow_name\} Workflow
// ========================================
\{for each main agent\}
{
  id: '\{agent.id\}',
  name: '\{agent.name\}',
  description: '\{agent.description\}',
  promptPath: \{promptPath or array\},
  \{if chained\}chainedPromptsPath: [\{chainedPaths\}],\{end if\}
},
\{end for\}

\{if controller\}
{
  id: '\{controller.id\}',
  name: '\{controller.name\}',
  description: '\{controller.description\}',
  role: 'controller',
  promptPath: path.join(promptsDir, '\{workflow_name\}', 'controller', '\{controller.id\}.md'),
},
\{end if\}
```

After appending:
"✓ Updated: `config/main.agents.js` (+\{count\} agents)"

**If sub-agents, append to `config/sub.agents.js`:**

```javascript
// ========================================
// \{workflow_name\} Sub-Agents
// ========================================
\{for each subAgent\}
{
  id: '\{subAgent.id\}',
  name: '\{subAgent.name\}',
  description: '\{subAgent.description\}',
  mirrorPath: path.join(promptsDir, '\{workflow_name\}', 'sub-agents', '\{subAgent.id\}.md'),
},
\{end for\}
```

After appending:
"✓ Updated: `config/sub.agents.js` (+\{count\} sub-agents)"

**If modules, append to `config/modules.js`:**

```javascript
// ========================================
// \{workflow_name\} Modules
// ========================================
\{for each module\}
{
  id: '\{module.id\}',
  name: '\{module.name\}',
  description: '\{module.description\}',
  promptPath: path.join(promptsDir, '\{workflow_name\}', 'modules', '\{module.id\}.md'),
  \{if chained\}chainedPromptsPath: [\{chainedPaths\}],\{end if\}
  behavior: {
    type: 'loop',
    action: 'stepBack',
  },
},
\{end for\}
```

After appending:
"✓ Updated: `config/modules.js` (+\{count\} modules)"

**If shared files, append to `config/placeholders.js` packageDir:**

```javascript
// \{workflow_name\} placeholders
\{for each shared\}
\{shared.placeholder\}: path.join('prompts', 'templates', '\{workflow_name\}', 'shared', '\{shared.name\}.md'),
\{end for\}
```

After appending:
"✓ Updated: `config/placeholders.js` (+\{count\} placeholders)"

### 6. Final Validation

"**Running final validation...**"

**Check 1: ID Uniqueness**
- Verify no duplicate IDs across all configs
- Result: "✓ All IDs unique" or "⚠️ Duplicate found: \{id\}"

**Check 2: File References**
- Verify all promptPath files exist
- Verify all chainedPromptsPath files exist
- Verify all mirrorPath files exist
- Result: "✓ All file references valid" or "⚠️ Missing: \{path\}"

**Check 3: Workflow Integrity**
- Verify all agents in steps exist in main.agents.js
- Verify all modules in steps exist in modules.js
- Verify all subAgentIds exist in sub.agents.js
- Result: "✓ Workflow integrity verified" or "⚠️ Missing agent: \{id\}"

**Check 4: Placeholder Registration**
- Verify all used placeholders are registered
- Result: "✓ All placeholders registered" or "⚠️ Unregistered: \{name\}"

**Check 5: Agent Input/Output Chain** (for multi-agent workflows)
- For workflows with 2+ agents, verify each agent has defined input/output
- Verify agent outputs are registered as placeholders for subsequent agents
- Verify each non-first agent has input defined (placeholder from previous agent, codebase read, or user Q&A)
- Exception: Q&A/interactive agents that only collect user input don't need file output
- Result: "✓ Agent chain properly connected" or "⚠️ Agent '\{id\}' has no input defined - it won't receive context from previous agents"

*[If Check 5 fails:]*
"**Agent chain incomplete.**

The following agents have no defined input - they won't know what previous agents produced:
\{list agents without input\}

Options:
1. Go back to Step 04 and define input/output for these agents
2. Confirm these are standalone agents that don't need previous context

How would you like to proceed?"

Wait for response. Do not generate workflow until resolved.

**If any issues found:**
"**Issues Found:**"
List each issue.
"Would you like me to fix these? **[y/n]**"

Fix each issue and re-verify.

**If all checks pass:**
"**All Validations Passed!**

✓ ID Uniqueness
✓ File References
✓ Workflow Integrity
✓ Placeholder Registration"

### 7. Keyboard Shortcuts Reference

"**Keyboard Shortcuts for Running Your Workflow:**

| Key | Action |
|-----|--------|
| **Shift+Tab** | Toggle Autonomous Mode |
| **Tab** | Toggle Timeline Panel |
| **P** | Pause Workflow |
| **Ctrl+S** | Skip (prompts or agent) |
| **Escape** | Stop Confirmation |
| **H** | History View |
| **Enter** | Toggle Expand / Open Log |
| **Space** | Toggle Expand |
| **↑ / ↓** | Navigate |
| **→** | Focus Prompt Box |"

\{if controller\}
"**Autonomous Mode:**
Your workflow has a controller agent (\{controller.name\}). Press **Shift+Tab** to enable autonomous mode - the controller will respond on behalf of the user."
\{end if\}

### 8. Final Summary

"**Workflow Creation Complete!**

**Workflow:** \{workflow_name\}

**Configuration:**
- Controller: \{yes/no\}
- Autonomous Mode: \{autonomousMode or 'N/A'\}
- Engine: \{defaultEngine or 'System default'\}
- Model: \{defaultModel or 'Engine default'\}
- Interactive: \{yes/no\}

**Files Created:**
- Workflow: `templates/workflows/\{workflow_name\}.workflow.js`
- Prompts: \{total prompt file count\} files in `prompts/templates/\{workflow_name\}/`

**Configs Updated:**
- `config/main.agents.js` (+\{count\} agents)
\{if sub-agents\}- `config/sub.agents.js` (+\{count\} sub-agents)\{end if\}
\{if modules\}- `config/modules.js` (+\{count\} modules)\{end if\}
\{if placeholders\}- `config/placeholders.js` (+\{count\} placeholders)\{end if\}

**To run your workflow:**
```bash
codemachine workflow \{workflow_name\}
```

**Congratulations! Your '\{workflow_name\}' workflow is ready to use.**"

## Step 5: FINAL APPEND to Plan File

**On Completion:**

1. **Read** the plan file at `.codemachine/workflow-plans/\{workflow_name\}-plan.md`

2. **Append step-05 XML** before the closing `</workflow-plan>` tag:

```xml
<step-05 completed="true" timestamp="\{ISO timestamp\}">
  <validation>
    <ids-unique>\{true|false\}</ids-unique>
    <files-exist>\{true|false\}</files-exist>
    <workflow-integrity>\{true|false\}</workflow-integrity>
    <placeholders-registered>\{true|false\}</placeholders-registered>
    <agent-chain-connected>\{true|false\}</agent-chain-connected>
    <issues-fixed count="\{count\}">
      <!-- If any issues were fixed -->
      <issue type="\{type\}" path="\{path\}" action="\{action taken\}" />
    </issues-fixed>
  </validation>
  <files-created>
    <file type="workflow" path="templates/workflows/\{workflow_name\}.workflow.js" />
    <file type="main-agents-config" path="config/main.agents.js" entries-added="\{count\}" />
    <file type="sub-agents-config" path="config/sub.agents.js" entries-added="\{count or 0\}" />
    <file type="modules-config" path="config/modules.js" entries-added="\{count or 0\}" />
    <file type="placeholders-config" path="config/placeholders.js" entries-added="\{count or 0\}" />
  </files-created>
  <summary>
    <total-prompt-files>\{count\}</total-prompt-files>
    <total-agents>\{count\}</total-agents>
    <total-sub-agents>\{count\}</total-sub-agents>
    <total-modules>\{count\}</total-modules>
    <has-controller>\{true|false\}</has-controller>
  </summary>
</step-05>
```

3. **Update the Last Updated timestamp** in the file header

4. **Update TodoWrite - ALL COMPLETED:**

```javascript
TodoWrite([
  { content: "Step 01: Brainstorming", status: "completed", activeForm: "Brainstorming completed" },
  { content: "Step 02: Workflow Definition", status: "completed", activeForm: "Workflow definition completed" },
  { content: "Step 03: Agents", status: "completed", activeForm: "Agents completed" },
  { content: "Step 04: Prompts", status: "completed", activeForm: "Prompts created" },
  { content: "Step 05: Workflow Generation", status: "completed", activeForm: "Workflow complete!" }
])
```

5. **Confirm to user:**
"✓ Workflow plan finalized at `.codemachine/workflow-plans/\{workflow_name\}-plan.md`

**Your workflow is ready!**

Run: `codemachine workflow \{workflow_name\}`"

{ali_step_completion}

## SUCCESS METRICS

- All files from previous steps verified to exist
- Missing files recreated if any
- Workflow.js file created
- All config files updated (main.agents.js, sub.agents.js, modules.js, placeholders.js)
- Final validation passed (IDs, files, integrity, placeholders, agent chain)
- Agent input/output chain validated for multi-agent workflows
- User educated about keyboard shortcuts
- Run command provided
- **Step-05 XML appended to plan file**
- **All TodoWrite items marked completed**

## FAILURE METRICS

- Missing files not detected or fixed
- Workflow.js not created
- Config files not updated
- Validation failures not addressed
- Proceeding with multi-agent workflow where agents have no input defined (they won't receive context)
- Not showing how to run the workflow
- Skipping keyboard shortcuts education
- **Not appending to plan file**
- **Not updating TodoWrite**
