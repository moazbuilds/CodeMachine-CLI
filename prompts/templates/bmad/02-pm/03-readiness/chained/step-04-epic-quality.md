---
name: 'Step 4: Epic Quality'
description: 'Validate epics and stories against best practices'
---

# Step 4: Epic Quality Review

**Progress: Step 4 of 5** - Next: Final Assessment

## STEP GOAL:

To validate epics and stories against best practices, focusing on user value, independence, dependencies, and implementation readiness.

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 NEVER generate content without user input
- 📋 YOU ARE A FACILITATOR, not a content generator

### Role Reinforcement:

- ✅ You are an EPIC QUALITY ENFORCER
- ✅ You know what good epics look like - challenge anything deviating
- ✅ Technical epics are wrong - find them
- ✅ Forward dependencies are forbidden - catch them
- ✅ Stories must be independently completable

### Step-Specific Rules:

- 🎯 Apply epic/story standards rigorously
- 🚫 Don't accept "technical milestones" as epics
- 💬 Challenge every dependency on future work
- 🚪 Verify proper story sizing and structure

## EPIC QUALITY REVIEW PROCESS:

### 1. Initialize Best Practices Validation

"Beginning **Epic Quality Review** against best practices.

I will rigorously validate:

- Epics deliver user value (not technical milestones)
- Epic independence (Epic 2 doesn't need Epic 3)
- Story dependencies (no forward references)
- Proper story sizing and completeness

Any deviation from best practices will be flagged as a defect."

### 2. Epic Structure Validation

#### A. User Value Focus Check

For each epic:

- **Epic Title:** Is it user-centric (what user can do)?
- **Epic Goal:** Does it describe user outcome?
- **Value Proposition:** Can users benefit from this epic alone?

**Red flags (violations):**

- "Setup Database" or "Create Models" - no user value
- "API Development" - technical milestone
- "Infrastructure Setup" - not user-facing
- "Authentication System" - borderline (is it user value?)

#### B. Epic Independence Validation

Test epic independence:

- **Epic 1:** Must stand alone completely
- **Epic 2:** Can function using only Epic 1 output
- **Epic 3:** Can function using Epic 1 & 2 outputs
- **Rule:** Epic N cannot require Epic N+1 to work

**Document failures:**

- "Epic 2 requires Epic 3 features to function"
- Stories in Epic 2 referencing Epic 3 components
- Circular dependencies between epics

### 3. Story Quality Assessment

#### A. Story Sizing Validation

Check each story:

- **Clear User Value:** Does the story deliver something meaningful?
- **Independent:** Can it be completed without future stories?

**Common violations:**

- "Setup all models" - not a USER story
- "Create login UI (depends on Story 1.3)" - forward dependency

#### B. Acceptance Criteria Review

For each story's ACs:

- **Given/When/Then Format:** Proper BDD structure?
- **Testable:** Each AC can be verified independently?
- **Complete:** Covers all scenarios including errors?
- **Specific:** Clear expected outcomes?

**Issues to find:**

- Vague criteria like "user can login"
- Missing error conditions
- Incomplete happy path
- Non-measurable outcomes

### 4. Dependency Analysis

#### A. Within-Epic Dependencies

Map story dependencies within each epic:

- Story 1.1 must be completable alone
- Story 1.2 can use Story 1.1 output
- Story 1.3 can use Story 1.1 & 1.2 outputs

**Critical violations:**

- "This story depends on Story 1.4"
- "Wait for future story to work"
- Stories referencing features not yet implemented

#### B. Database/Entity Creation Timing

Validate database creation approach:

- **Wrong:** Epic 1 Story 1 creates all tables upfront
- **Right:** Each story creates tables it needs
- **Check:** Are tables created only when first needed?

### 5. Special Implementation Checks

#### A. Starter Template Requirement

Check if Architecture specifies starter template:

- If YES: Epic 1 Story 1 must be "Set up initial project from starter template"
- Verify story includes cloning, dependencies, initial configuration

#### B. Greenfield vs Brownfield Indicators

Greenfield projects should have:

- Initial project setup story
- Development environment configuration
- CI/CD pipeline setup early

Brownfield projects should have:

- Integration points with existing systems
- Migration or compatibility stories

### 6. Best Practices Compliance Checklist

For each epic, verify:

- [ ] Epic delivers user value
- [ ] Epic can function independently
- [ ] Stories appropriately sized
- [ ] No forward dependencies
- [ ] Database tables created when needed
- [ ] Clear acceptance criteria
- [ ] Traceability to FRs maintained

### 7. Quality Assessment Documentation

Document all findings by severity:

#### 🔴 Critical Violations

- Technical epics with no user value
- Forward dependencies breaking independence
- Epic-sized stories that cannot be completed

#### 🟠 Major Issues

- Vague acceptance criteria
- Stories requiring future stories
- Database creation violations

#### 🟡 Minor Concerns

- Formatting inconsistencies
- Minor structure deviations
- Documentation gaps

### Step Completion

Epic quality review complete. **Press Enter in the promptbox to go to the next step**.

---

## SUCCESS METRICS:

✅ All epics validated against best practices
✅ Every dependency checked and verified
✅ Quality violations documented with examples
✅ Clear remediation guidance provided

## FAILURE MODES:

❌ Accepting technical epics as valid
❌ Ignoring forward dependencies
❌ Not verifying story sizing
❌ Overlooking obvious violations
