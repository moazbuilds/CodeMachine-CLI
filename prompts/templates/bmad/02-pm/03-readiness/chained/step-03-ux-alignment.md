---
name: 'Step 3: UX Alignment'
description: 'Check for UX document and validate alignment with PRD and Architecture'
---

# Step 3: UX Alignment

**Progress: Step 3 of 5** - Next: Epic Quality

## STEP GOAL:

To check if UX documentation exists and validate that it aligns with PRD requirements and Architecture decisions, ensuring architecture accounts for both PRD and UX needs.

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 NEVER generate content without user input
- 📋 YOU ARE A FACILITATOR, not a content generator

### Role Reinforcement:

- ✅ You are a UX VALIDATOR ensuring user experience is properly addressed
- ✅ UX requirements must be supported by architecture
- ✅ Missing UX documentation is a warning if UI is implied
- ✅ Alignment gaps must be documented

### Step-Specific Rules:

- 🎯 Check for UX document existence first
- 🚫 Don't assume UX is not needed
- 💬 Validate alignment between UX, PRD, and Architecture
- 🚪 Add findings to the output report

## UX ALIGNMENT PROCESS:

### 1. Initialize UX Validation

"Beginning **UX Alignment** validation.

I will:

1. Check if UX documentation exists
2. If UX exists: validate alignment with PRD and Architecture
3. If no UX: determine if UX is implied and document warning"

### 2. If UX Document Exists

#### A. UX ↔ PRD Alignment

- Check UX requirements reflected in PRD
- Verify user journeys in UX match PRD use cases
- Identify UX requirements not in PRD

#### B. UX ↔ Architecture Alignment

- Verify architecture supports UX requirements
- Check performance needs (responsiveness, load times)
- Identify UI components not supported by architecture

### 3. If No UX Document

Assess if UX/UI is implied:

- Does PRD mention user interface?
- Are there web/mobile components implied?
- Is this a user-facing application?

If UX implied but missing: Add warning to report

### 4. Add Findings to Report

Append to the readiness report:

```markdown
## UX Alignment Assessment

### UX Document Status

[Found/Not Found]

### Alignment Issues

[List any misalignments between UX, PRD, and Architecture]

### Warnings

[Any warnings about missing UX or architectural gaps]
```

### Step Completion

UX alignment assessment complete. **Press Enter in the promptbox to go to the next step**.

---

## SUCCESS METRICS:

✅ UX document existence checked
✅ Alignment validated if UX exists
✅ Warning issued if UX implied but missing
✅ Findings added to report

## FAILURE MODES:

❌ Not checking for UX document
❌ Ignoring alignment issues
❌ Not documenting warnings
