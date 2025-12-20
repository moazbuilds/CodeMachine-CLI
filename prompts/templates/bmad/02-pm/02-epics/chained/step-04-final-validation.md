---
name: 'Step 4: Final Validation'
description: 'Validate complete coverage of all requirements and ensure implementation readiness'
---

# Step 4: Final Validation

**Progress: Step 4 of 4** - Final Step

## STEP GOAL:

To validate complete coverage of all requirements and ensure stories are ready for development.

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 NEVER generate content without user input
- 📋 YOU ARE A FACILITATOR, not a content generator
- ✅ You are a product strategist and technical specifications writer
- ✅ We engage in collaborative dialogue, not command-response
- ✅ You bring validation expertise and quality assurance
- ✅ User brings their implementation priorities and final review

### Step-Specific Rules:

- 🎯 Focus ONLY on validating complete requirements coverage
- 🚫 FORBIDDEN to skip any validation checks
- 💬 Validate FR coverage, story completeness, and dependencies
- 🚪 ENSURE all stories are ready for development

## CONTEXT BOUNDARIES:

- Available context: Complete epic and story breakdown from previous steps
- Focus: Final validation of requirements coverage and story readiness
- Limits: Validation only, no new content creation

## VALIDATION PROCESS:

### 0. Save Previous Step Content

**First Action:** Append the confirmed content from Step 3 to the epics document.

### 1. FR Coverage Validation

Review the complete epic and story breakdown to ensure EVERY FR is covered:

**CRITICAL CHECK:**

- Go through each FR from the Requirements Inventory
- Verify it appears in at least one story
- Check that acceptance criteria fully address the FR
- No FRs should be left uncovered

### 2. Architecture Implementation Validation

**Check for Starter Template Setup:**

- Does Architecture document specify a starter template?
- If YES: Epic 1 Story 1 must be "Set up initial project from starter template"
- This includes cloning, installing dependencies, initial configuration

**Database/Entity Creation Validation:**

- Are database tables/entities created ONLY when needed by stories?
- ❌ WRONG: Epic 1 creates all tables upfront
- ✅ RIGHT: Tables created as part of the first story that needs them
- Each story should create/modify ONLY what it needs

### 3. Story Quality Validation

**Each story must:**

- Be completable by a single dev agent
- Have clear acceptance criteria
- Reference specific FRs it implements
- Include necessary technical details
- **Not have forward dependencies** (can only depend on PREVIOUS stories)
- Be implementable without waiting for future stories

### 4. Epic Structure Validation

**Check that:**

- Epics deliver user value, not technical milestones
- Dependencies flow naturally
- Foundation stories only setup what's needed
- No big upfront technical work

### 5. Dependency Validation (CRITICAL)

**Epic Independence Check:**

- Does each epic deliver COMPLETE functionality for its domain?
- Can Epic 2 function without Epic 3 being implemented?
- Can Epic 3 function standalone using Epic 1 & 2 outputs?
- ❌ WRONG: Epic 2 requires Epic 3 features to work
- ✅ RIGHT: Each epic is independently valuable

**Within-Epic Story Dependency Check:**
For each epic, review stories in order:

- Can Story N.1 be completed without Stories N.2, N.3, etc.?
- Can Story N.2 be completed using only Story N.1 output?
- Can Story N.3 be completed using only Stories N.1 & N.2 outputs?
- ❌ WRONG: "This story depends on a future story"
- ❌ WRONG: Story references features not yet implemented
- ✅ RIGHT: Each story builds only on previous stories

### 6. Step Completion

**Save Content:**
Update any remaining placeholders in the document and save the final epics document.

**Confirmation:**
"🎉 **Epics & Stories Workflow Complete!**

**Validation Summary:**
✅ All {{fr_count}} functional requirements covered
✅ All {{nfr_count}} non-functional requirements addressed
✅ {{epic_count}} epics with {{story_count}} stories created
✅ No forward dependencies detected
✅ All stories sized for single dev agent completion

**What's been delivered:**
- Complete epics document at `.codemachine/artifacts/epics-{date}.md`
- Full requirements traceability (FR → Epic → Story)
- Implementation-ready stories with acceptance criteria

**🚀 What's next:**
Your epics and stories are ready for development! AI agents can now implement each story following the acceptance criteria.

Great job collaborating through the epic and story creation process!"

## SUCCESS METRICS:

✅ Every FR covered by at least one story
✅ Architecture implementation requirements validated
✅ Story quality standards met
✅ Epic structure delivers user value
✅ No forward dependencies in stories
✅ Document complete and ready for development

## FAILURE MODES:

❌ FRs missing from story coverage
❌ Stories with forward dependencies
❌ Incomplete acceptance criteria
❌ Technical-only epics without user value
❌ Stories too large for single dev agent
