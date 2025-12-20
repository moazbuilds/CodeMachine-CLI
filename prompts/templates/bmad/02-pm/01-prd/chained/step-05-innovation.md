---
name: 'Step 5: Innovation Discovery'
description: 'Detect and explore innovative aspects of the product'
---

# Step 5: Innovation Discovery

**Progress: Step 5 of 10** - Next: Project Type Analysis

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 NEVER generate content without user input

- ✅ ALWAYS treat this as collaborative discovery between PM peers
- 📋 YOU ARE A FACILITATOR, not a content generator
- 💬 FOCUS on detecting and exploring innovative aspects of the product
- 🎯 OPTIONAL STEP: Only proceed if innovation signals are detected

## EXECUTION PROTOCOLS:

- 🎯 Show your analysis before taking any action

## CONTEXT BOUNDARIES:

- Current document and frontmatter from previous steps are available
- Project type from step-01 is available for innovation signal matching
- Project-type CSV data (project-types.csv) already loaded in workflow context
- Focus on detecting genuine innovation, not forced creativity

## OPTIONAL STEP CHECK:

Before proceeding with this step, scan for innovation signals:

- Listen for language like "nothing like this exists", "rethinking how X works"
- Check for project-type innovation signals from CSV
- Look for novel approaches or unique combinations
- If no innovation detected, skip this step and ask user to proceed to next step by pressing Enter

## YOUR TASK:

Detect and explore innovation patterns in the product, focusing on what makes it truly novel and how to validate the innovative aspects.

## INNOVATION DISCOVERY SEQUENCE:

### 0. Save Previous Step Content

**First Action:** Append the confirmed content from Step 4 to the PRD document.

### 1. Use Project-Type Innovation Data

Use innovation signals from workflow context:

- Find the row in project-types data where `project_type` matches detected type from step-01
- Extract `innovation_signals` (semicolon-separated list)
- Extract `web_search_triggers` for potential innovation research

### 2. Listen for Innovation Indicators

Monitor conversation for both general and project-type-specific innovation signals:

#### General Innovation Language:

- "Nothing like this exists"
- "We're rethinking how [X] works"
- "Combining [A] with [B] for the first time"
- "Novel approach to [problem]"
- "No one has done [concept] before"

#### Project-Type-Specific Signals (from CSV):

Match user descriptions against innovation_signals for their project_type:

- **api_backend**: "API composition;New protocol"
- **mobile_app**: "Gesture innovation;AR/VR features"
- **saas_b2b**: "Workflow automation;AI agents"
- **developer_tool**: "New paradigm;DSL creation"

### 3. Initial Innovation Screening

Ask targeted innovation discovery questions:
"As we explore {{project_name}}, I'm listening for what makes it innovative.

**Innovation Indicators:**

- Are you challenging any existing assumptions about how things work?
- Are you combining technologies or approaches in new ways?
- Is there something about this that hasn't been done before?

What aspects of {{project_name}} feel most innovative to you?"

### 4. Deep Innovation Exploration (If Detected)

If innovation signals are found, explore deeply:

#### Innovation Discovery Questions:

- "What makes it unique compared to existing solutions?"
- "What assumption are you challenging?"
- "How do we validate it works?"
- "What's the fallback if it doesn't?"
- "Has anyone tried this before?"

#### Market Context Research:

If relevant innovation detected, consider web search for context:
Use `web_search_triggers` from project-type CSV:
`[web_search_triggers] {concept} innovations {date}`

### 5. Generate Innovation Content (If Innovation Detected)

Prepare the content to append to the document:

#### Content Structure:

When saving to document, append these Level 2 and Level 3 sections:

```markdown
## Innovation & Novel Patterns

### Detected Innovation Areas

[Innovation patterns identified based on conversation]

### Market Context & Competitive Landscape

[Market context and research based on conversation]

### Validation Approach

[Validation methodology based on conversation]

### Risk Mitigation

[Innovation risks and fallbacks based on conversation]
```

{step_completion}

## NO INNOVATION DETECTED:

If no genuine innovation signals are found after exploration:
"After exploring {{project_name}}, I don't see clear innovation signals that warrant a dedicated innovation section. This is perfectly fine - many successful products are excellent executions of existing concepts rather than breakthrough innovations.

**Press Enter to proceed to the next step**, or tell me if you'd like to explore innovation angles anyway."

## SUCCESS METRICS:

✅ Innovation signals properly detected from user conversation
✅ Project-type innovation signals used to guide discovery
✅ Genuine innovation explored (not forced creativity)
✅ Validation approach clearly defined for innovative aspects
✅ Risk mitigation strategies identified
✅ Content properly appended to document when user confirms

## FAILURE MODES:

❌ Forced innovation when none genuinely exists
❌ Not using project-type innovation signals from workflow context
❌ Missing market context research for novel concepts
❌ Not addressing validation approach for innovative features
❌ Creating innovation theater without real innovative aspects
❌ Appending content without user confirmation

## SKIP CONDITIONS:

Skip this step and ask user to proceed to next step by pressing Enter if:

- No innovation signals detected in conversation
- Product is incremental improvement rather than breakthrough
- User confirms innovation exploration is not needed
- Project-type data has no innovation signals for this type
