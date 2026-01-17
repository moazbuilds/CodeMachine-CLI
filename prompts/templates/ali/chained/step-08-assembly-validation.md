---
name: "Step 08 - Assembly & Validation"
description: "Create workflow.js, update configs, verify and fix anything missing"
---

# Step 08: Assembly & Validation

## STEP GOAL

Final step - complete the workflow:
1. Create workflow.js file
2. Update all config files (main.agents.js, sub.agents.js, modules.js, placeholders.js)
3. Verify all files exist - fix anything missing
4. Educate user about running the workflow

## Sequence of Instructions

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
For each: "✓ `prompts/templates/{workflow_name}/{agent.id}/{agent.id}.md`"
If chained: list step files

If controller (Step 5):
"**Controller (Step 5):**
✓ `prompts/templates/{workflow_name}/controller/{controller.id}.md`"

If sub-agents (Step 6):
"**Sub-Agent Prompts (Step 6):**"
For each: "✓ `prompts/templates/{workflow_name}/sub-agents/{subAgent.id}.md`"

If modules (Step 7):
"**Module Prompts (Step 7):**"
For each: "✓ `prompts/templates/{workflow_name}/modules/{module.id}.md`"

If shared files:
"**Shared Files (Step 4):**"
For each: "✓ `prompts/templates/{workflow_name}/shared/{shared.name}.md`"

### 3. Verify All Files Exist

"**Verifying files...**"

Actually check each file exists on disk. For each file:
- If exists: "✓ {path}"
- If missing: "⚠️ MISSING: {path}"

**If any files are missing:**
"**Missing Files Detected:**"
List missing files.

"I'll recreate these now. Please confirm the content for each:"

For each missing file:
- Show the content that was approved earlier
- Ask user to confirm
- Create the file
- Confirm: "✓ Fixed: {path}"

**If all files exist:**
"✓ All {count} prompt files verified!"

### 4. Create Workflow File

"**Creating workflow file...**"

Generate and write `templates/workflows/{workflow_name}.workflow.js`:

```javascript
export default {
  name: '{workflow_name}',
  {if controller}controller: controller('{controller.id}'{if controller.engine || controller.model}, { {if controller.engine}engine: '{controller.engine}'{end if}{if controller.engine && controller.model}, {end if}{if controller.model}model: '{controller.model}'{end if} }{end if}),{end if}
  {if autonomousMode !== null}autonomousMode: {autonomousMode},  // 'never' | 'always' | false | true{end if}
  {if specification}specification: true,{end if}

  {if tracks}
  tracks: {
    question: '{tracks.question}',
    options: {
      {for each track}
      '{track.id}': {
        label: '{track.label}',
        description: '{track.description}',
      },
      {end for}
    },
  },
  {end if}

  {if conditionGroups}
  conditionGroups: [
    {for each group}
    {
      id: '{group.id}',
      question: '{group.question}',
      multiSelect: {group.multiSelect},
      {if group.tracks}tracks: [{group.tracks}],{end if}
      conditions: {
        {for each condition}
        '{condition.id}': {
          label: '{condition.label}',
          description: '{condition.description}',
        },
        {end for}
      },
    },
    {end for}
  ],
  {end if}

  steps: [
    {for each agent}
    resolveStep('{agent.id}', {
      {if agent.tracks}tracks: [{agent.tracks}],{end if}
      {if agent.conditions}conditions: [{agent.conditions}],{end if}
      {if defaultEngine}engine: '{defaultEngine}',{end if}
      {if defaultModel}model: '{defaultModel}',{end if}
      {if interactive === false}interactive: false,{end if}
    }),
    {end for}

    {for each module}
    resolveModule('{module.id}', {
      loopSteps: {module.loopSteps},
      loopMaxIterations: {module.loopMaxIterations},
      {if module.loopSkip}loopSkip: [{module.loopSkip}],{end if}
      {if defaultEngine}engine: '{defaultEngine}',{end if}
      {if defaultModel}model: '{defaultModel}',{end if}
      {if interactive === false}interactive: false,{end if}
    }),
    {end for}
  ],

  {if subAgents}
  subAgentIds: [
    {for each subAgent}'{subAgent.id}',{end for}
  ],
  {end if}
};
```

**Note on step options:**
- `engine`: AI engine to use (case-sensitive: `opencode`, `claude`, `codex`, `cursor`, `mistral`, `auggie`, `ccr`)
- `model`: Model for the engine (case-sensitive, e.g., `opus`, `sonnet`, `gpt-5.1-codex-max`)
- `interactive`: Set to `false` for autonomous/continuous mode (requires controller for valid operation)

After writing:
"✓ Created: `templates/workflows/{workflow_name}.workflow.js`"

### 5. Update Config Files

"**Updating config files...**"

**Append to `config/main.agents.js`:**

```javascript
// ========================================
// {workflow_name} Workflow
// ========================================
{for each main agent}
{
  id: '{agent.id}',
  name: '{agent.name}',
  description: '{agent.description}',
  promptPath: {promptPath or array},
  {if chained}chainedPromptsPath: [{chainedPaths}],{end if}
},
{end for}

{if controller}
{
  id: '{controller.id}',
  name: '{controller.name}',
  description: '{controller.description}',
  role: 'controller',
  promptPath: path.join(promptsDir, '{workflow_name}', 'controller', '{controller.id}.md'),
},
{end if}
```

After appending:
"✓ Updated: `config/main.agents.js` (+{count} agents)"

**If sub-agents, append to `config/sub.agents.js`:**

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

After appending:
"✓ Updated: `config/sub.agents.js` (+{count} sub-agents)"

**If modules, append to `config/modules.js`:**

```javascript
// ========================================
// {workflow_name} Modules
// ========================================
{for each module}
{
  id: '{module.id}',
  name: '{module.name}',
  description: '{module.description}',
  promptPath: path.join(promptsDir, '{workflow_name}', 'modules', '{module.id}.md'),
  {if chained}chainedPromptsPath: [{chainedPaths}],{end if}
  behavior: {
    type: 'loop',
    action: 'stepBack',
  },
},
{end for}
```

After appending:
"✓ Updated: `config/modules.js` (+{count} modules)"

**If shared files, append to `config/placeholders.js` packageDir:**

```javascript
// {workflow_name} placeholders
{for each shared}
{shared.placeholder}: path.join('prompts', 'templates', '{workflow_name}', 'shared', '{shared.name}.md'),
{end for}
```

After appending:
"✓ Updated: `config/placeholders.js` (+{count} placeholders)"

### 6. Final Validation

"**Running final validation...**"

**Check 1: ID Uniqueness**
- Verify no duplicate IDs across all configs
- Result: "✓ All IDs unique" or "⚠️ Duplicate found: {id}"

**Check 2: File References**
- Verify all promptPath files exist
- Verify all chainedPromptsPath files exist
- Verify all mirrorPath files exist
- Result: "✓ All file references valid" or "⚠️ Missing: {path}"

**Check 3: Workflow Integrity**
- Verify all agents in steps exist in main.agents.js
- Verify all modules in steps exist in modules.js
- Verify all subAgentIds exist in sub.agents.js
- Result: "✓ Workflow integrity verified" or "⚠️ Missing agent: {id}"

**Check 4: Placeholder Registration**
- Verify all used placeholders are registered
- Result: "✓ All placeholders registered" or "⚠️ Unregistered: {name}"

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

{if controller}
"**Autonomous Mode:**
Your workflow has a controller agent ({controller.name}). Press **Shift+Tab** to enable autonomous mode - the controller will respond on behalf of the user."
{end if}

### 8. Final Summary

"**Workflow Creation Complete!**

**Workflow:** {workflow_name}

**Configuration:**
- Controller: {yes/no}
- Autonomous Mode: {autonomousMode or 'N/A'}
- Engine: {defaultEngine or 'System default'}
- Model: {defaultModel or 'Engine default'}
- Interactive: {yes/no}

**Files Created:**
- Workflow: `templates/workflows/{workflow_name}.workflow.js`
- Prompts: {total prompt file count} files in `prompts/templates/{workflow_name}/`

**Configs Updated:**
- `config/main.agents.js` (+{count} agents)
{if sub-agents}- `config/sub.agents.js` (+{count} sub-agents){end if}
{if modules}- `config/modules.js` (+{count} modules){end if}
{if placeholders}- `config/placeholders.js` (+{count} placeholders){end if}

**To run your workflow:**
```bash
codemachine workflow {workflow_name}
```

**Congratulations! Your '{workflow_name}' workflow is ready to use.**"

## Step 8: FINAL APPEND to Plan File

**On Completion:**

1. **Read** the plan file at `.codemachine/workflow-plans/{workflow_name}-plan.md`

2. **Append step-08 XML** before the closing `</workflow-plan>` tag:

```xml
<step-08 completed="true" timestamp="{ISO timestamp}">
  <validation>
    <ids-unique>{true|false}</ids-unique>
    <files-exist>{true|false}</files-exist>
    <workflow-integrity>{true|false}</workflow-integrity>
    <placeholders-registered>{true|false}</placeholders-registered>
    <issues-fixed count="{count}">
      <!-- If any issues were fixed -->
      <issue type="{type}" path="{path}" action="{action taken}" />
    </issues-fixed>
  </validation>
  <files-created>
    <file type="workflow" path="templates/workflows/{workflow_name}.workflow.js" />
    <file type="main-agents-config" path="config/main.agents.js" entries-added="{count}" />
    <file type="sub-agents-config" path="config/sub.agents.js" entries-added="{count or 0}" />
    <file type="modules-config" path="config/modules.js" entries-added="{count or 0}" />
    <file type="placeholders-config" path="config/placeholders.js" entries-added="{count or 0}" />
  </files-created>
  <summary>
    <total-prompt-files>{count}</total-prompt-files>
    <total-agents>{count}</total-agents>
    <total-sub-agents>{count}</total-sub-agents>
    <total-modules>{count}</total-modules>
    <has-controller>{true|false}</has-controller>
  </summary>
</step-08>
```

3. **Update the Last Updated timestamp** in the file header

4. **Update TodoWrite - ALL COMPLETED:**

```javascript
TodoWrite([
  { content: "Step 01: Mode Selection", status: "completed", activeForm: "Mode selection completed" },
  { content: "Step 02: Workflow Definition", status: "completed", activeForm: "Workflow definition completed" },
  { content: "Step 03: Main Agents", status: "completed", activeForm: "Main agents completed" },
  { content: "Step 04: Prompts & Placeholders", status: "completed", activeForm: "Prompts created" },
  { content: "Step 05: Controller Agent", status: "completed", activeForm: "Controller completed" },
  { content: "Step 06: Sub-Agents", status: "completed", activeForm: "Sub-agents completed" },
  { content: "Step 07: Modules", status: "completed", activeForm: "Modules completed" },
  { content: "Step 08: Assembly & Validation", status: "completed", activeForm: "Workflow complete!" }
])
```

5. **Confirm to user:**
"✓ Workflow plan finalized at `.codemachine/workflow-plans/{workflow_name}-plan.md`

**Your workflow is ready!**

Run: `codemachine workflow {workflow_name}`"

{ali_step_completion}

## SUCCESS METRICS

- All files from previous steps verified to exist
- Missing files recreated if any
- Workflow.js file created
- All config files updated (main.agents.js, sub.agents.js, modules.js, placeholders.js)
- Final validation passed (IDs, files, integrity, placeholders)
- User educated about keyboard shortcuts
- Run command provided
- **Step-08 XML appended to plan file**
- **All TodoWrite items marked completed**

## FAILURE METRICS

- Missing files not detected or fixed
- Workflow.js not created
- Config files not updated
- Validation failures not addressed
- Not showing how to run the workflow
- Skipping keyboard shortcuts education
- **Not appending to plan file**
- **Not updating TodoWrite**
