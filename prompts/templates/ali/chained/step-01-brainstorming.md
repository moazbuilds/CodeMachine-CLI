---
name: "Step 01 - Brainstorming"
description: "Optionally brainstorm workflow ideas using structured techniques"
---

# Step 01: Brainstorming

## STEP GOAL

1. Route based on selected track and conditions
2. Offer guidance/brainstorming before proceeding

**Note:** Mode selection, workflow concept, and journey preview are handled in Step 0 (`step-00-setup.md`) before this step loads.

**🎯 GUIDE USER TO CORRECT STEP:** If user asks about something that belongs to a later step (e.g., agents, prompts, workflow generation), guide them to proceed step-by-step. Say: "Great question! We'll cover that in Step {X}. Let's finish this step first, then press **Enter** to continue."

## Track & Condition Routing (EXECUTE FIRST)

**Read `{selected_track}` and `{selected_conditions}` - these are already selected.**

### Step Renumbering

Steps 01-05 load conditionally. Renumber based on selected conditions:

| Condition | Original Step | Your New # |
|-----------|---------------|------------|
| `brainstorming` | Step 01 | Step \{next_available\} |
| `workflow-definition` | Step 02 | Step \{next_available\} |
| `agents` | Step 03 | Step \{next_available\} |
| `prompts` | Step 04 | Step \{next_available\} |
| `workflow-generation` | Step 05 | Step \{next_available\} |

**Example:** If only `agents` + `prompts` selected:
- Step 01 = Agents
- Step 02 = Prompts
- Done (2 steps total)

**Example:** If `brainstorming` + `agents` + `prompts` selected:
- Step 01 = Brainstorming (this step)
- Step 02 = Agents
- Step 03 = Prompts
- Done (3 steps total)

### Track-Specific Behavior

**`create-workflow`:** Full creation flow for selected areas.

**`modify-workflow`:** Ask for existing workflow name, load plan file, then modify selected areas.

**`have-questions`:** Ask for specific question, confirm, then route to relevant step for Q&A only.

---

## Sequence of Instructions

### 1. Offer Brainstorming

Offer brainstorming (mode was already selected in Step 0):

"**Would you like to brainstorm your workflow idea first?**

Brainstorming can help you:
- Clarify what problem your workflow solves
- Discover what agents you'll need
- Explore different approaches
- Generate creative ideas before committing

**Skip if you already have a clear workflow concept in mind!**

Would you like to brainstorm? **[y/n]**"

Wait for clear user response.

### 2. Handle Brainstorming Choice

**If user says YES:**

Facilitate a structured brainstorming session using **4 phases**:

---

#### Phase 1: Basic Discovery (Understand the Use Case)

"Before we dive deep, tell me briefly:

1. **What's the workflow about?** (one sentence)
2. **What's the main goal?** (what should happen at the end)
3. **Who will use it?** (developer, end-user, team, etc.)"

**→ Wait for user answers. Do NOT proceed until you have all 3 answers.**

---

#### Phase 2: Technique Selection (Agent Analyzes & Chooses)

Based on the user's answers, analyze the use case:

**Consider:**
- **Problem type:** Is this creative, analytical, structural, or exploratory?
- **User need:** Does user need clarity, innovation, process mapping, or problem definition?
- **Domain:** Is this technical, business, creative, or operational?

**Select 3 best-fitting techniques** from the brain-methods you have that match the use case.

**Present your selections:**

"Based on what you've shared, I've selected **3 brainstorming techniques** that will help us explore this deeply:

1. **[Technique Name]** - [1 sentence why it fits this use case]
2. **[Technique Name]** - [1 sentence why it fits this use case]
3. **[Technique Name]** - [1 sentence why it fits this use case]

*These brainstorming techniques are inspired by the [BMAD Method](https://github.com/bmad-code-org/BMAD-METHOD), created by Brian.*

Let's begin!"

**Technique Selection Guidelines:**

| Use Case Type | Recommended Technique Categories |
|---------------|----------------------------------|
| Unclear problem, need to find root cause | deep (Five Whys, Question Storming, Assumption Reversal) |
| Need creative/innovative approaches | creative (What If Scenarios, First Principles, Reversal Inversion) |
| Need to explore multiple perspectives | collaborative (Role Playing, Yes And Building) |
| Need structured process mapping | structured (Mind Mapping, Decision Tree Mapping, SCAMPER) |
| Stuck, need fresh angles | theatrical (Alien Anthropologist, Parallel Universe Cafe) |
| Complex system, many variables | deep (Morphological Analysis, Constraint Mapping) |

---

#### Phase 3: Technique Execution (Apply Each Sequentially)

Execute each of the 3 selected techniques one at a time.

**For each technique:**

1. **Announce:** "Let's start with **[Technique Name]**."
2. **Apply:** Use the technique's prompts/questions from the CSV description
3. **Wait:** Do NOT proceed until user responds
4. **Capture:** Note the key insights before moving to next technique

**Example execution:**

**Technique 1:**
> "Let's start with **Five Whys** to uncover the root problem.
>
> You mentioned [reference their answer]. **Why** is that a problem?"
>
> *Wait for response*
>
> "**Why** does that matter?"
>
> *Wait for response*
>
> "**Why** is that painful for users?"
>
> *Wait for response*
>
> "Good - we've uncovered that the root issue is [summarize]. Let's move to the next technique."

**Technique 2:**
> "Now let's try **[Technique Name]**.
>
> [Apply the technique's method from CSV description]"
>
> *Wait for response*
>
> [Continue technique until complete]

**Technique 3:**
> "Finally, let's use **[Technique Name]**.
>
> [Apply the technique's method from CSV description]"
>
> *Wait for response*
>
> [Continue technique until complete]

---

#### Phase 4: Synthesis

After all 3 techniques are complete, synthesize the insights:

"Based on our brainstorming session, here's what emerged:

**Problem:** [synthesized root problem from techniques]
**Agent Ideas:** [synthesized agent concepts - roles, personalities, expertise]
**Flow Concept:** [synthesized flow - steps, branches, output]

**Key Insight:** [the most important discovery from the session]

We'll use these insights as we build your workflow."

---

**If user says NO:**

Acknowledge their choice:
"Got it! We'll dive straight into building. You can always describe your concept as we go."

### 3. Confirm Brainstorming Choice

Confirm the brainstorming selection (mode was already confirmed in Step 0):
- If No brainstorm: "Got it! We'll dive straight into building."
- If Yes brainstorm: "Done! Brainstorming captured. Let's use those ideas as we build."

## Step 1 Data to Store

**Note:** Cannot write to plan file yet (no workflow_name). Store this XML in memory for Step 2 to write.

**XML Template for Step 1:**

```xml
<step-01 completed="true" timestamp="\{ISO timestamp\}">
  <mode>\{quick|expert\}</mode>
  <brainstorming enabled="\{true|false\}">
    <basic-discovery>
      <about>\{workflow about - one sentence\}</about>
      <goal>\{main goal\}</goal>
      <users>\{who will use it\}</users>
    </basic-discovery>
    <techniques-used>
      <technique name="\{technique 1\}" category="\{category\}" />
      <technique name="\{technique 2\}" category="\{category\}" />
      <technique name="\{technique 3\}" category="\{category\}" />
    </techniques-used>
    <synthesis>
      <problem>\{synthesized root problem\}</problem>
      <agent-ideas>\{synthesized agent concepts\}</agent-ideas>
      <flow-concept>\{synthesized flow\}</flow-concept>
      <key-insight>\{most important discovery\}</key-insight>
    </synthesis>
  </brainstorming>
</step-01>
```

**On User Confirmation:**

1. Store the XML data in memory (will be written in Step 2)
2. Use TodoWrite to mark Step 01 completed and Step 02 in_progress:

```javascript
TodoWrite([
  { content: "Step 01: Brainstorming", status: "completed", activeForm: "Brainstorming completed" },
  { content: "Step 02: Workflow Definition", status: "in_progress", activeForm: "Defining workflow" },
  { content: "Step 03: Agents", status: "pending", activeForm: "Defining agents" },
  { content: "Step 04: Prompts", status: "pending", activeForm: "Creating prompts" },
  { content: "Step 05: Workflow Generation", status: "pending", activeForm: "Generating workflow" }
])
```

3. Tell user: "✓ Mode and brainstorming choices recorded. Press **Enter** to proceed."

{ali_step_completion}

## SUCCESS METRICS

- Mode was already selected in Step 0 (available as `mode` variable)
- User has decided on brainstorming (yes/no)
- If brainstorming:
  - Phase 1: All 3 basic discovery questions answered
  - Phase 2: 3 techniques selected from CSV with justification
  - Phase 3: All 3 techniques executed with user responses captured
  - Phase 4: Synthesis completed with problem, agent ideas, flow concept, key insight
- Mode and brainstorming choice stored in XML
- TodoWrite updated with step progress
- User understands the 5-step journey ahead

## FAILURE METRICS

- Proceeding without brainstorming choice
- Skipping any of the 4 brainstorming phases
- Selecting techniques without analyzing user's use case first
- Not waiting for user responses between technique applications
- Selecting techniques that don't fit the use case
- Not capturing insights from each technique
- Pressuring user into brainstorming
- Using file read/search tools (forbidden in step 1)
- Not updating TodoWrite on completion
