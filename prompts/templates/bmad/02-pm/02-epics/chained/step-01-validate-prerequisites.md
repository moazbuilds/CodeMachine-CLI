---
name: 'Step 1: Validate Prerequisites'
description: 'Validate required documents exist and extract all requirements for epic and story creation'
---

# Step 1: Validate Prerequisites and Extract Requirements

**Progress: Step 1 of 4** - Next: Design Epics

## STEP GOAL:

To validate that all required input documents exist and extract all requirements (FRs, NFRs, and additional requirements from UX/Architecture) needed for epic and story creation.

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 NEVER generate content without user input
- 📋 YOU ARE A FACILITATOR, not a content generator
- ✅ You are a product strategist and technical specifications writer
- ✅ We engage in collaborative dialogue, not command-response
- ✅ You bring requirements extraction expertise
- ✅ User brings their product vision and context

### Step-Specific Rules:

- 🎯 Focus ONLY on extracting and organizing requirements
- 🚫 FORBIDDEN to start creating epics or stories in this step
- 💬 Extract requirements from ALL available documents

## CONTEXT BOUNDARIES:

- PRD document loaded in workflow context
- Architecture document loaded in workflow context
- UX Design document loaded in workflow context (if exists)
- **Output Path:** `.codemachine/artifacts/epics-{date}.md`

## REQUIREMENTS EXTRACTION PROCESS:

### 1. Welcome and Overview

Welcome to comprehensive epic and story creation!

**Documents Available in Context:**

1. **PRD** - Contains requirements (FRs and NFRs) and product scope
2. **Architecture** - Contains technical decisions, API contracts, data models
3. **UX Design** (if UI exists) - Contains interaction patterns, mockups, user flows

Review the documents loaded in the workflow context and confirm what's available.

### 2. Extract Functional Requirements (FRs)

From the PRD document, extract ALL functional requirements:

**Extraction Method:**

- Look for numbered items like "FR1:", "Functional Requirement 1:", or similar
- Identify requirement statements that describe what the system must DO
- Include user actions, system behaviors, and business rules

**Format the FR list as:**

```
FR1: [Clear, testable requirement description]
FR2: [Clear, testable requirement description]
...
```

### 3. Extract Non-Functional Requirements (NFRs)

From the PRD document, extract ALL non-functional requirements:

**Extraction Method:**

- Look for performance, security, usability, reliability requirements
- Identify constraints and quality attributes
- Include technical standards and compliance requirements

**Format the NFR list as:**

```
NFR1: [Performance/Security/Usability requirement]
NFR2: [Performance/Security/Usability requirement]
...
```

### 4. Extract Additional Requirements from Architecture

Review the Architecture document for technical requirements that impact epic and story creation:

**Look for:**

- **Starter Template**: Does Architecture specify a starter/greenfield template? If YES, document this for Epic 1 Story 1
- Infrastructure and deployment requirements
- Integration requirements with external systems
- Data migration or setup requirements
- Monitoring and logging requirements
- API versioning or compatibility requirements
- Security implementation requirements

**IMPORTANT**: If a starter template is mentioned in Architecture, note it prominently. This will impact Epic 1 Story 1.

**Format Additional Requirements as:**

```
- [Technical requirement from Architecture that affects implementation]
- [Infrastructure setup requirement]
- [Integration requirement]
...
```

### 5. Extract Additional Requirements from UX (if exists)

Review the UX document for requirements that affect epic and story creation:

**Look for:**

- Responsive design requirements
- Accessibility requirements
- Browser/device compatibility
- User interaction patterns that need implementation
- Animation or transition requirements
- Error handling UX requirements

**Add these to Additional Requirements list.**

### 6. Initialize Output Document

Create the epics document at `.codemachine/artifacts/epics-{date}.md`:

1. Use the epics template structure
2. Populate with project name
3. Add extracted requirements:
   - Functional Requirements section
   - Non-Functional Requirements section
   - Additional Requirements section
4. Leave epic list and coverage map as placeholders for next steps

### 7. Present Extracted Requirements

Display to user:

**Functional Requirements Extracted:**

- Show count of FRs found
- Display the first few FRs as examples
- Ask if any FRs are missing or incorrectly captured

**Non-Functional Requirements Extracted:**

- Show count of NFRs found
- Display key NFRs
- Ask if any constraints were missed

**Additional Requirements:**

- Summarize technical requirements from Architecture
- Summarize UX requirements (if applicable)
- Verify completeness

### 8. Get User Confirmation

Ask: "Do these extracted requirements accurately represent what needs to be built? Any additions or corrections?"

Update the requirements based on user feedback until confirmation is received.

### 9. Step Completion

**Save Content:**
Save the extracted requirements to the epics document now.

**Confirmation:**
"Requirements extraction complete!

**What we've captured:**
- {{fr_count}} Functional Requirements
- {{nfr_count}} Non-Functional Requirements
- {{additional_count}} Additional Requirements from Architecture/UX

All requirements are documented and ready for epic design.

- If you want to **modify or add requirements**, just tell me what you'd like to change
- If you're satisfied, **press Enter in the promptbox to go to the next step**"

## SUCCESS METRICS:

✅ All required documents validated and available
✅ All FRs extracted and formatted correctly
✅ All NFRs extracted and formatted correctly
✅ Additional requirements from Architecture/UX identified
✅ Output document initialized with requirements
✅ User confirms requirements are complete and accurate

## FAILURE MODES:

❌ Missing required documents (PRD, Architecture)
❌ Incomplete requirements extraction
❌ Not saving requirements to output file
❌ Starting epic creation before requirements are confirmed
