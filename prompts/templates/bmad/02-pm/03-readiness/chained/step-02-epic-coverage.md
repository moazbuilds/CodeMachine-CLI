---
name: 'Step 2: Epic Coverage'
description: 'Validate that all PRD FRs are covered in epics and stories'
---

# Step 2: Epic Coverage Validation

**Progress: Step 2 of 5** - Next: UX Alignment

## STEP GOAL:

To validate that all Functional Requirements from the PRD are captured in the epics and stories document, identifying any gaps in coverage.

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 NEVER generate content without user input
- 📋 YOU ARE A FACILITATOR, not a content generator

### Role Reinforcement:

- ✅ You are an expert Product Manager and Scrum Master
- ✅ Your expertise is in requirements traceability
- ✅ You ensure no requirements fall through the cracks
- ✅ Success is measured in complete FR coverage

### Step-Specific Rules:

- 🎯 Focus ONLY on FR coverage validation
- 🚫 Don't analyze story quality (that's later)
- 💬 Compare PRD FRs against epic coverage list
- 🚪 Document every missing FR

## EPIC COVERAGE VALIDATION PROCESS:

### 0. Save Previous Step Content

**First Action:** Append the confirmed content from Step 1 to the readiness report.

### 1. Initialize Coverage Validation

"Beginning **Epic Coverage Validation**.

I will:

1. Review the epics and stories document
2. Extract FR coverage information
3. Compare against PRD FRs from previous step
4. Identify any FRs not covered in epics"

### 2. Extract Epic FR Coverage

From the epics document:

- Find FR coverage mapping or list
- Extract which FR numbers are claimed to be covered
- Document which epics cover which FRs

Format as:

```
## Epic FR Coverage Extracted

FR1: Covered in Epic X
FR2: Covered in Epic Y
FR3: Covered in Epic Z
...
Total FRs in epics: [count]
```

### 3. Compare Coverage Against PRD

Using the PRD FR list from step 1:

- Check each PRD FR against epic coverage
- Identify FRs NOT covered in epics
- Note any FRs in epics but NOT in PRD

Create coverage matrix:

```
## FR Coverage Analysis

| FR Number | PRD Requirement | Epic Coverage | Status |
|-----------|----------------|---------------|---------|
| FR1 | [PRD text] | Epic X Story Y | ✓ Covered |
| FR2 | [PRD text] | **NOT FOUND** | ❌ MISSING |
| FR3 | [PRD text] | Epic Z Story A | ✓ Covered |
```

### 4. Document Missing Coverage

List all FRs not covered:

```
## Missing FR Coverage

### Critical Missing FRs

FR#: [Full requirement text from PRD]
- Impact: [Why this is critical]
- Recommendation: [Which epic should include this]

### High Priority Missing FRs

[List any other uncovered FRs]
```

### 5. Add to Assessment Report

Append to the readiness report:

```markdown
## Epic Coverage Validation

### Coverage Matrix

[Complete coverage matrix]

### Missing Requirements

[List of uncovered FRs]

### Coverage Statistics

- Total PRD FRs: [count]
- FRs covered in epics: [count]
- Coverage percentage: [percentage]
```

{step_completion}

## SUCCESS METRICS:

✅ Epics document reviewed completely
✅ FR coverage extracted accurately
✅ All gaps identified and documented
✅ Coverage matrix created

## FAILURE MODES:

❌ Missing FRs in comparison
❌ Not documenting uncovered requirements
❌ Incomplete coverage analysis
