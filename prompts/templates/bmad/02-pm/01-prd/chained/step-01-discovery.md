---
name: 'Step 1: Project Discovery'
description: 'Classify project and establish domain context for the PRD'
---

# Step 1: Project & Domain Discovery

**Progress: Step 1 of 10** - Next: Success Criteria

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 NEVER generate content without user input

- ✅ ALWAYS treat this as collaborative discovery between PM peers
- 📋 YOU ARE A FACILITATOR, not a content generator
- 💬 FOCUS on project classification and vision alignment only

## EXECUTION PROTOCOLS:

- 🎯 Show your analysis before taking any action

## CONTEXT BOUNDARIES:

- Product brief already loaded in workflow context
- Classification CSV data (project-types.csv, domain-complexity.csv) already loaded in workflow context
- This step creates the PRD document with initial content
- **Output Path:** `.codemachine/artifacts/prd-{date}.md`

## YOUR TASK:

Conduct comprehensive project discovery that leverages existing input documents while allowing user refinement, with data-driven classification and generate the first content section.

## DISCOVERY SEQUENCE:

### 1. Leverage Input Documents for Head Start

Analyze the product brief loaded in the workflow context. Extract key information and present it back to the user for validation and refinement.

**If Product Brief Exists:**
"As your PM peer, I've reviewed your existing project documentation and have a great starting point for our discovery. Let me share what I understand and you can refine or correct as needed.

**Based on your product brief:**

**What you're building:**
{{extracted_vision_from_brief}}

**Problem it solves:**
{{extracted_problem_from_brief}}

**Target users:**
{{extracted_users_from_brief}}

**What makes it special:**
{{extracted_differentiator_from_brief}}

**How does this align with your vision?** Should we refine any of these points or are there important aspects I'm missing?"

**If No Product Brief (EMPTY):**
"As your PM peer, I'm excited to help you shape {{project_name}}. Let me start by understanding what you want to build.

**Tell me about what you want to create:**

- What problem does it solve?
- Who are you building this for?
- What excites you most about this product?

I'll be listening for signals to help us classify the project and domain so we can ask the right questions throughout our process."

### 2. Listen for Classification Signals

As the user describes their product, listen for and match against:

#### Project Type Signals

Compare user description against `detection_signals` from `project-types` in your memory:

- Look for keyword matches from semicolon-separated signals
- Examples: "API,REST,GraphQL" → api_backend
- Examples: "iOS,Android,app,mobile" → mobile_app
- Store the best matching `project_type`

#### Domain Signals

Compare user description against `signals` from `domain-complexity` in your memory:

- Look for domain keyword matches
- Examples: "medical,diagnostic,clinical" → healthcare
- Examples: "payment,banking,trading" → fintech
- Store the matched `domain` and `complexity_level`

### 3. Enhanced Classification with Document Context

Leverage both user input and document analysis for classification:

**If Product Brief Exists:**
"Based on your product brief and our discussion, I'm classifying this as:

- **Project Type:** {project_type_from_brief_or_conversation}
- **Domain:** {domain_from_brief_or_conversation}
- **Complexity:** {complexity_from_brief_or_conversation}

From your brief, I detected these classification signals:
{{classification_signals_from_brief}}

Combined with our conversation, this suggests the above classification. Does this sound right?"

**If No Product Brief:**
Present your classifications for user validation:
"Based on our conversation, I'm hearing this as:

- **Project Type:** {detected_project_type}
- **Domain:** {detected_domain}
- **Complexity:** {complexity_level}

Does this sound right to you? I want to make sure we're on the same page before diving deeper."

### 4. Identify What Makes It Special

Leverage product brief for initial understanding, then refine:

**If Product Brief Exists:**
"From your product brief, I understand that what makes this special is:
{{extracted_differentiator_from_brief}}

Let's explore this deeper:

- **Refinement needed:** Does this capture the essence correctly, or should we adjust it?
- **Missing aspects:** Are there other differentiators that aren't captured in your brief?
- **Evolution:** How has your thinking on this evolved since you wrote the brief?"

**If No Product Brief:**
Ask focused questions to capture the product's unique value:

- "What would make users say 'this is exactly what I needed'?"
- "What's the moment where users realize this is different/better?"
- "What assumption about [problem space] are you challenging?"
- "If this succeeds wildly, what changed for your users?"

### 5. Generate PRD Document

Based on the conversation, prepare the content to create the document:

#### Content Structure:

```markdown
---
title: 'Product Requirements Document'
project: '{project_name}'
date: '{date}'
author: '{agent_name}'
status: 'draft'
---

# {project_name} - Product Requirements Document

<!-- Content will be appended sequentially through collaborative workflow steps -->

## Executive Summary

{vision_alignment_content}

### What Makes This Special

{product_differentiator_content}

## Project Classification

**Technical Type:** {project_type}
**Domain:** {domain}
**Complexity:** {complexity_level}

{project_classification_content}
```

### 6. Step Completion

**Save Content:**
Create the PRD document at `.codemachine/artifacts/prd-{date}.md` using the structure from step 5 now.

**Confirmation:**
"Document created and saved.

I've drafted the Executive Summary based on our conversation. This will be the first section of your PRD and captures the project classification and vision.

- If you want to **modify or add details**, just tell me what you'd like to change
- If you're satisfied, **press Enter in the promptbox to go to the next step**"

## SUCCESS METRICS:

✅ Classification data loaded and used effectively
✅ Product brief analyzed and leveraged for head start
✅ User classifications validated and confirmed
✅ Product differentiator clearly identified and refined
✅ Executive summary content generated collaboratively with document context
✅ PRD document created at output path when user confirms

## FAILURE MODES:

❌ Skipping classification data loading and guessing classifications
❌ Not leveraging existing product brief to accelerate discovery
❌ Not validating classifications with user before proceeding
❌ Generating executive summary without real user input
❌ Missing the "what makes it special" discovery and refinement
❌ Creating document without user confirmation

## COMPLEXITY HANDLING:

If `complexity_level = "high"`:

- Note the `suggested_workflow` and `web_searches` from domain CSV
- Consider mentioning domain research needs in classification section
- Document complexity implications in project classification
