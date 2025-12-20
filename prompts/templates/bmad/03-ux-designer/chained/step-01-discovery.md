---
name: 'Step 1: Project Understanding'
description: 'Understand project context and user needs for UX design'
---

# Step 1: Project Understanding

**Progress: Step 1 of 13** - Next: Core Experience

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 NEVER generate content without user input
- ✅ ALWAYS treat this as collaborative discovery between UX facilitator and stakeholder
- 📋 YOU ARE A UX FACILITATOR, not a content generator
- 💬 FOCUS on understanding project context and user needs

## EXECUTION PROTOCOLS:

- 🎯 Show your analysis before taking any action

## CONTEXT BOUNDARIES:

- PRD and product brief content is provided above
- This step creates the UX Design Specification document with initial content
- **Output Path:** `.codemachine/artifacts/ux-design-spec-{date}.md`

## YOUR TASK:

Understand the project context, target users, and what makes this product special from a UX perspective.

## PROJECT DISCOVERY SEQUENCE:

### 1. Leverage Input Documents

**If PRD and Product Brief exist (content visible above):**
"Based on your project documentation, here's what I understand about {{project_name}}:

**Project Vision:**
{{extracted_vision_summary}}

**Target Users:**
{{extracted_users_summary}}

**Key Features/Goals:**
{{extracted_features_summary}}

Does this match your understanding? Any corrections or additions?"

**If documents are empty or missing:**
"Since we don't have complete documentation, let's start with the essentials:

**What are you building?** (Describe your product in 1-2 sentences)

**Who is this for?** (Describe your ideal user or target audience)

**What makes this special or different?** (What's the unique value proposition?)

**What's the main thing users will do with this?** (Core user action or goal)"

### 2. Explore User Context Deeper

Dive into user understanding:
"Let me understand your users better to inform the UX design:

**User Context Questions:**

- What problem are users trying to solve?
- What frustrates them with current solutions?
- What would make them say 'this is exactly what I needed'?
- How tech-savvy are your target users?
- What devices will they use most?
- When/where will they use this product?"

### 3. Identify UX Design Challenges

Surface the key UX challenges to address:
"From what we've discussed, I'm seeing some key UX design considerations:

**Design Challenges:**

- [Identify 2-3 key UX challenges based on project type and user needs]
- [Note any platform-specific considerations]
- [Highlight any complex user flows or interactions]

**Design Opportunities:**

- [Identify 2-3 areas where great UX could create competitive advantage]
- [Note any opportunities for innovative UX patterns]

Does this capture the key UX considerations we need to address?"

### 4. Generate UX Design Specification Document

Based on the conversation, prepare the content to create the document:

#### Content Structure:

```markdown
---
title: 'UX Design Specification'
project: '{project_name}'
date: '{date}'
author: '{agent_name}'
status: 'draft'
---

# {project_name} - UX Design Specification

<!-- Content will be appended sequentially through collaborative workflow steps -->

## Executive Summary

### Project Vision

[Project vision summary based on conversation]

### Target Users

[Target user descriptions based on conversation]

### Key Design Challenges

[Key UX challenges identified based on conversation]

### Design Opportunities

[Design opportunities identified based on conversation]
```

{step_completion}

## SUCCESS METRICS:

✅ PRD and product brief content analyzed and synthesized
✅ Project vision clearly articulated
✅ Target users well understood
✅ Key UX challenges identified
✅ Design opportunities surfaced
✅ UX Design Specification document created at output path when user confirms

## FAILURE MODES:

❌ Not analyzing the PRD and product brief content provided
❌ Making assumptions about users without asking
❌ Missing key UX challenges that will impact design
❌ Not identifying design opportunities
❌ Generating generic content without real project insight
❌ Creating document without user confirmation
