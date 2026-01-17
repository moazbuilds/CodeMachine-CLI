---
name: "Step 07 - Modules Configuration"
description: "Optional modules with loop behavior"
---

# Step 07: Modules Configuration (Optional)

## STEP GOAL

Create optional modules that provide loop behavior:
- Modules can iterate until a condition is met
- Useful for validation, review, or iterative improvement
- Configured with loopSteps, loopMaxIterations, loopSkip

## Sequence of Instructions

### 1. Introduction

"**Modules Configuration**

Modules are special agents with **loop behavior**. They can iterate back through previous steps until a condition is met.

Common uses:
- **Validation loops** - Check work, fix issues, re-check
- **Review cycles** - Review, get feedback, revise
- **Quality gates** - Iterate until quality threshold met"

### 2. Ask About Modules

"**Do you need any modules in your workflow?**

Modules are useful when:
- You need iterative improvement cycles
- Work should be validated and potentially re-done
- Quality gates require multiple passes

Would you like to add modules? **[y/n]**"

Wait for response.

**If NO:** Skip to step completion.

**If YES:** Continue.

### 3. Explain Module Architecture

**In Expert mode, explain:**
"**How Modules Work:**

Modules are defined in `config/modules.js`:

```javascript
{
  id: 'module-id',
  name: 'Module Name',
  description: 'What this module does',
  promptPath: 'path/to/prompt.md',
  chainedPromptsPath: ['array', 'of', 'step', 'paths'], // optional
  behavior: {
    type: 'loop',
    action: 'stepBack',
  },
}
```

**Behavior Configuration:**
- `type: 'loop'` - Module can iterate
- `action: 'stepBack'` - Goes back N steps when looping

**Step Options for Modules:**

When using `resolveModule()` in the workflow, you can configure:

| Option | Type | Description |
|--------|------|-------------|
| `loopSteps` | number | How many steps to go back |
| `loopMaxIterations` | number | Maximum loop count |
| `loopSkip` | string[] | Agent IDs to skip on loop |

**Example:**
```javascript
resolveModule('code-reviewer', {
  loopSteps: 2,           // Go back 2 steps
  loopMaxIterations: 3,   // Max 3 iterations
  loopSkip: ['planner'],  // Skip planner on re-loop
})
```

This creates a validation cycle: if the reviewer finds issues, it loops back 2 steps to fix them, up to 3 times.

**CRITICAL: How Modules Control Loops via Directives**

Modules control loop behavior by writing to `.codemachine/memory/directive.json`. This is how the system knows whether to loop or proceed:

**To trigger a LOOP (go back and re-execute):**
```json
{
  "action": "loop",
  "reason": "Issues found: [specific reason]"
}
```

**To STOP and proceed (validation passed):**
```json
{
  "action": "stop",
  "reason": "All checks passed"
}
```

The module's **only job** at the end is to write this directive file. The system reads it and acts accordingly."

### 4. Define Modules

"**How many modules do you need?**

Enter number of modules:"

Wait. Store as `moduleCount`.

For each module (1 to moduleCount):

"**Module {n} of {total}**

**1. Module ID** (lowercase with hyphens):

Enter module ID:"

Wait. Validate against `existing_ids`. Store as `modules[n].id`.

"**2. Module Name:**

Enter name:"

Wait. Store as `modules[n].name`.

"**3. Module Description:**

Enter description:"

Wait. Store as `modules[n].description`.

"**4. What does this module check or validate?**

Example: 'Code quality and test coverage', 'Requirements completeness'

Enter validation focus:"

Wait. Store as `modules[n].validationFocus`.

"**5. When should this module trigger a loop?**

Example: 'When issues are found', 'When quality score is below threshold'

Enter loop trigger condition:"

Wait. Store as `modules[n].loopTrigger`.

"**6. Loop Configuration**

**How many steps back should it go when looping?**
(Number of previous steps to re-execute)

Enter loopSteps:"

Wait. Store as `modules[n].loopSteps`.

"**Maximum iterations before giving up?**
(Prevents infinite loops)

Enter loopMaxIterations:"

Wait. Store as `modules[n].loopMaxIterations`.

"**Should any agents be skipped on re-loop?**
(Agents that don't need to run again)

Enter agent IDs to skip (comma-separated, or 'none'):"

Wait. Parse and store as `modules[n].loopSkip`.

"**7. Is this module single-step or chained?**

1. **Single-step** - One validation prompt
2. **Chained** - Multiple validation steps

Enter **1** or **2**:"

Wait. Store as `modules[n].hasChainedPrompts`.

If chained:
"**How many steps?**"
Wait. Store as `modules[n].stepCount`.

For each step: collect purpose.

### 5. Generate Module Prompt

"**Generated prompt for module '{modules[n].name}':**

```markdown
---
name: '{modules[n].name}'
description: '{modules[n].description}'
---

# {modules[n].name}

## ROLE

Validation module for: {modules[n].validationFocus}

## LOOP BEHAVIOR

- **Loop trigger**: {modules[n].loopTrigger}
- **Steps back**: {modules[n].loopSteps}
- **Max iterations**: {modules[n].loopMaxIterations}
- **Skip on loop**: {modules[n].loopSkip or 'none'}

## INSTRUCTIONS

1. Review the work from previous steps
2. Evaluate against: {modules[n].validationFocus}
3. Analyze and determine if validation passes or fails
4. Write the directive file based on your determination

## CRITICAL: DIRECTIVE OUTPUT

Your **only output** is to write the file `.codemachine/memory/directive.json`.

**If validation FAILS (issues found):**
```json
{
  "action": "loop",
  "reason": "[Specific issues that need fixing]"
}
```

**If validation PASSES:**
```json
{
  "action": "stop",
  "reason": "[Summary of what was validated]"
}
```

**IMPORTANT:**
- You MUST write this directive file - it controls whether the workflow loops or proceeds
- The system reads this file to determine next action
- Do not output anything else - just write the directive.json file
```

Does this look correct? **[y/n]**"

**If no:** Allow edits, regenerate, ask again.

**If yes:** IMMEDIATELY create the module file:
1. Create folder (if first module): `prompts/templates/{workflow_name}/modules/`
2. If chained: Create subfolder: `prompts/templates/{workflow_name}/modules/{module.id}/`
3. Write main file: `prompts/templates/{workflow_name}/modules/{module.id}.md`
4. If chained: Write each step file
5. Confirm: "✓ Created: `modules/{module.id}.md`" (and step files if chained)

### 6. Repeat for All Modules

After each module file is created:
- If more modules: "Let's define module {n+1}."
- If last: Proceed to summary

### 7. Workflow Integration

"**Using Modules in Your Workflow**

Modules are added to the workflow using `resolveModule()`:

```javascript
steps: [
  separator('Development'),
  resolveStep('code-generator', {}),
  resolveStep('test-writer', {}),

  separator('Validation'),
  resolveModule('{modules[0].id}', {
    loopSteps: {modules[0].loopSteps},
    loopMaxIterations: {modules[0].loopMaxIterations},
    loopSkip: [{modules[0].loopSkip}],
  }),
],
```

When the module triggers a loop:
1. Goes back {loopSteps} steps
2. Re-executes those steps (skipping agents in loopSkip)
3. Returns to module for re-validation
4. Repeats until PASS or max iterations reached"

### 8. Summary

"**Modules - Step 7 Complete!**

**Files Created:**"
For each module:
"✓ `modules/{module.id}.md`"
If chained:
"  ✓ `modules/{module.id}/step-01-{purpose}.md`"
etc.

"**Total modules:** {count}

| Module | Validates | Loop Steps | Max Iterations |
|--------|-----------|------------|----------------|"
For each:
"| {name} | {validationFocus} | {loopSteps} | {loopMaxIterations} |"

"**Config entries to add in step 8** (for `config/modules.js`):

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
  {if chained}chainedPromptsPath: [
    {for each step}path.join(promptsDir, '{workflow_name}', 'modules', '{module.id}', 'step-{n}-{purpose}.md'),{end for}
  ],{end if}
  behavior: {
    type: 'loop',
    action: 'stepBack',
  },
},
{end for}
```

Module prompt files are ready. Config will be updated in step 8."

## Step 7: APPEND to Plan File

**On User Confirmation:**

1. **Read** the plan file at `.codemachine/workflow-plans/{workflow_name}-plan.md`

2. **Append step-07 XML** before the closing `</workflow-plan>` tag:

**If modules were created:**
```xml
<step-07 completed="true" timestamp="{ISO timestamp}">
  <modules count="{count}">
    <!-- For each module -->
    <module id="{id}" name="{name}" description="{description}" type="{single|chained}">
      <validation-focus>{what this module validates}</validation-focus>
      <loop-trigger>{when to trigger a loop}</loop-trigger>
      <loop-steps>{number}</loop-steps>
      <loop-max-iterations>{number}</loop-max-iterations>
      <loop-skip>{comma-separated agent IDs or empty}</loop-skip>
      <file-path>prompts/templates/{workflow_name}/modules/{id}.md</file-path>
      <chained-steps>
        <!-- If chained -->
        <step n="{n}" purpose="{purpose}" path="prompts/templates/{workflow_name}/modules/{id}/step-{n}-{purpose}.md" />
      </chained-steps>
    </module>
  </modules>
</step-07>
```

**If modules were skipped:**
```xml
<step-07 completed="skipped" timestamp="{ISO timestamp}">
  <reason>No modules needed for this workflow</reason>
</step-07>
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
  { content: "Step 06: Sub-Agents", status: "completed", activeForm: "Sub-agents completed" },
  { content: "Step 07: Modules", status: "completed", activeForm: "Modules completed" },
  { content: "Step 08: Assembly & Validation", status: "in_progress", activeForm: "Assembling workflow" }
])
```

5. **Confirm to user:**
"✓ Module configuration saved to workflow plan.

Press **Enter** to proceed to the final step."

{ali_step_completion}

## SUCCESS METRICS

- Modules folder created
- All module prompt files WRITTEN to disk
- Loop behavior defined (loopSteps, loopMaxIterations, loopSkip)
- Directive output pattern included in prompts
- User confirmed each file before creation
- Config entries stored for step 8
- **Step-07 XML appended to plan file**
- **TodoWrite updated**

## FAILURE METRICS

- Files not actually written after confirmation
- Missing loop configuration
- No validation focus defined
- loopMaxIterations not set (could cause infinite loops)
- Directive output pattern not included
- Not explaining module behavior in Expert mode
- Proceeding without user confirmation
- **Not appending to plan file**
- **Not updating TodoWrite**
