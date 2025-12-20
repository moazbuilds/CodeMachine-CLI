---
name: 'Step 1: Project Context Analysis'
description: 'Analyze project documents to understand architectural scope and requirements'
---

# Step 1: Project Context Analysis

**Progress: Step 1 of 7** - Next: Starter Template

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 NEVER generate content without user input
- ✅ ALWAYS treat this as collaborative discovery between architectural peers
- 📋 YOU ARE A FACILITATOR, not a content generator
- 💬 FOCUS on understanding project scope and requirements for architecture
- 🎯 ANALYZE loaded documents, don't assume or generate requirements

## EXECUTION PROTOCOLS:

- 🎯 Show your analysis before taking any action

## CONTEXT BOUNDARIES:

- PRD and other input documents are available from workflow context
- Focus on architectural implications of requirements
- No technology decisions yet - pure analysis phase

## YOUR TASK:

Analyze the loaded project documents to understand architectural scope, requirements, and constraints before beginning decision making.

## CONTEXT ANALYSIS SEQUENCE:

### 1. Review Project Requirements

**From PRD Analysis:**

- Extract and analyze Functional Requirements (FRs)
- Identify Non-Functional Requirements (NFRs) like performance, security, compliance
- Note any technical constraints or dependencies mentioned
- Count and categorize requirements to understand project scale

**From Epics/Stories (if available):**

- Map epic structure and user stories to architectural components
- Extract acceptance criteria for technical implications
- Identify cross-cutting concerns that span multiple epics
- Estimate story complexity for architectural planning

**From UX Design (if available):**

- Extract architectural implications from UX requirements:
  - Component complexity (simple forms vs rich interactions)
  - Animation/transition requirements
  - Real-time update needs (live data, collaborative features)
  - Platform-specific UI requirements
  - Accessibility standards (WCAG compliance level)
  - Responsive design breakpoints
  - Offline capability requirements
  - Performance expectations (load times, interaction responsiveness)

### 2. Project Scale Assessment

Calculate and present project complexity:

**Complexity Indicators:**

- Real-time features requirements
- Multi-tenancy needs
- Regulatory compliance requirements
- Integration complexity
- User interaction complexity
- Data complexity and volume

### 3. Reflect Understanding

Present your analysis back to user for validation:

"I'm reviewing your project documentation for {{project_name}}.

{if_epics_loaded}I see {{epic_count}} epics with {{story_count}} total stories.{/if_epics_loaded}
{if_no_epics}I found {{fr_count}} functional requirements organized into {{fr_category_list}}.{/if_no_epics}
{if_ux_loaded}I also found your UX specification which defines the user experience requirements.{/if_ux_loaded}

**Key architectural aspects I notice:**

- [Summarize core functionality from FRs]
- [Note critical NFRs that will shape architecture]
- {if_ux_loaded}[Note UX complexity and technical requirements]{/if_ux_loaded}
- [Identify unique technical challenges or constraints]
- [Highlight any regulatory or compliance requirements]

**Scale indicators:**

- Project complexity appears to be: [low/medium/high/enterprise]
- Primary technical domain: [web/mobile/api/backend/full-stack/etc]
- Cross-cutting concerns identified: [list major ones]

This analysis will help me guide you through the architectural decisions needed to ensure AI agents implement this consistently.

Does this match your understanding of the project scope and requirements?"

### 4. Generate Project Context Content

Prepare the content to append to the document:

#### Content Structure:

```markdown
## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
{{analysis of FRs and what they mean architecturally}}

**Non-Functional Requirements:**
{{NFRs that will drive architectural decisions}}

**Scale & Complexity:**
{{project_scale_assessment}}

- Primary domain: {{technical_domain}}
- Complexity level: {{complexity_level}}
- Estimated architectural components: {{component_count}}

### Technical Constraints & Dependencies

{{known_constraints_dependencies}}

### Cross-Cutting Concerns Identified

{{concerns_that_will_affect_multiple_components}}
```

{step_completion}

## SUCCESS METRICS:

✅ All input documents thoroughly analyzed for architectural implications
✅ Project scope and complexity clearly assessed and validated
✅ Technical constraints and dependencies identified
✅ Cross-cutting concerns mapped for architectural planning
✅ User confirmation of project understanding
✅ Content properly appended to document when user confirms

## FAILURE MODES:

❌ Skimming documents without deep architectural analysis
❌ Missing or misinterpreting critical NFRs
❌ Not validating project understanding with user
❌ Underestimating complexity indicators
❌ Generating content without real analysis of loaded documents
❌ Appending content without user confirmation
