---
name: 'Step 1: PRD Analysis'
description: 'Read and analyze PRD to extract all FRs and NFRs for coverage validation'
---

# Step 1: PRD Analysis

**Progress: Step 1 of 5** - Next: Epic Coverage

## STEP GOAL:

To fully read and analyze the PRD document to extract all Functional Requirements (FRs) and Non-Functional Requirements (NFRs) for validation against epics coverage.

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 NEVER generate content without user input
- 📋 YOU ARE A FACILITATOR, not a content generator

### Role Reinforcement:

- ✅ You are an expert Product Manager and Scrum Master
- ✅ Your expertise is in requirements analysis and traceability
- ✅ You think critically about requirement completeness
- ✅ Success is measured in thorough requirement extraction

### Step-Specific Rules:

- 🎯 Focus ONLY on reading and extracting from PRD
- 💬 Read PRD completely
- 🚪 Extract every FR and NFR with numbering

## PRD ANALYSIS PROCESS:

### 1. Initialize PRD Analysis

"Beginning **PRD Analysis** to extract all requirements.

I will:

1. Read the PRD document completely and thoroughly
2. Extract ALL Functional Requirements (FRs)
3. Extract ALL Non-Functional Requirements (NFRs)
4. Document findings for coverage validation"

### 2. Extract Functional Requirements (FRs)

Search for and extract:

- Numbered FRs (FR1, FR2, FR3, etc.)
- Requirements labeled "Functional Requirement"
- User stories or use cases that represent functional needs
- Business rules that must be implemented

Format findings as:

```
## Functional Requirements Extracted

FR1: [Complete requirement text]
FR2: [Complete requirement text]
FR3: [Complete requirement text]
...
Total FRs: [count]
```

### 3. Extract Non-Functional Requirements (NFRs)

Search for and extract:

- Performance requirements (response times, throughput)
- Security requirements (authentication, encryption, etc.)
- Usability requirements (accessibility, ease of use)
- Reliability requirements (uptime, error rates)
- Scalability requirements (concurrent users, data growth)
- Compliance requirements (standards, regulations)

Format findings as:

```
## Non-Functional Requirements Extracted

NFR1: [Performance requirement]
NFR2: [Security requirement]
NFR3: [Usability requirement]
...
Total NFRs: [count]
```

### 4. Document Additional Requirements

Look for:

- Constraints or assumptions
- Technical requirements not labeled as FR/NFR
- Business constraints
- Integration requirements

### 5. Add to Assessment Report

Append to the readiness report:

```markdown
## PRD Analysis

### Functional Requirements

[Complete FR list]

### Non-Functional Requirements

[Complete NFR list]

### Additional Requirements

[Any other requirements or constraints found]

### PRD Completeness Assessment

[Initial assessment of PRD completeness and clarity]
```

{step_completion}

## SUCCESS METRICS:

✅ PRD loaded and read completely
✅ All FRs extracted with full text
✅ All NFRs identified and documented
✅ Findings added to assessment report

## FAILURE MODES:

❌ Missing requirements in extraction
❌ Summarizing instead of extracting full text
❌ Not documenting findings in report
