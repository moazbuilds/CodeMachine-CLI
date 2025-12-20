---
name: 'Step 4: Domain Requirements'
description: 'Explore domain-specific requirements and compliance needs'
---

# Step 4: Domain-Specific Exploration

**Progress: Step 4 of 10** - Next: Innovation Discovery

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 NEVER generate content without user input

- ✅ ALWAYS treat this as collaborative discovery between PM peers
- 📋 YOU ARE A FACILITATOR, not a content generator
- 💬 FOCUS on domain-specific requirements and compliance needs
- 🎯 OPTIONAL STEP: Only proceed if complexity_level = "high" from step-02

## EXECUTION PROTOCOLS:

- 🎯 Show your analysis before taking any action

## CONTEXT BOUNDARIES:

- Current document and frontmatter from previous steps are available
- Domain complexity from step-01 should be "high" to justify this step
- Domain-specific CSV data (domain-complexity.csv) already loaded in workflow context
- Focus on compliance, regulations, and domain-specific constraints

## OPTIONAL STEP CHECK:

Before proceeding with this step, verify:

- Is `complexity_level` from step-01 equal to "high" and/or does the domain have specific regulatory/compliance needs?
- Would domain exploration significantly impact the product requirements?

If NO to these questions, skip this step and ask user to proceed to next step by pressing Enter.

## YOUR TASK:

Explore domain-specific requirements for complex domains that need specialized compliance, regulatory, or industry-specific considerations.

## DOMAIN EXPLORATION SEQUENCE:

### 0. Save Previous Step Content

**First Action:** Append the confirmed content from Step 3 to the PRD document.

### 1. Use Domain Configuration Data

Use domain-specific configuration from workflow context:

- Find the row in domain-complexity data where `domain` matches the detected domain from step-01
- Extract these columns:
  - `key_concerns` (semicolon-separated list)
  - `required_knowledge` (domain expertise needed)
  - `web_searches` (suggested research queries)
  - `special_sections` (domain-specific sections to document)

### 2. Present Domain Complexity Context

Start by explaining why this step is needed:
"Since {{project_name}} is in the {domain} domain with high complexity, we need to explore domain-specific requirements.

**Key Concerns for {domain}:**
[List the key_concerns from CSV]

This step will help us understand regulatory requirements, compliance needs, and industry-specific constraints that will shape our product."

### 3. Explore Domain-Specific Requirements

For each concern in `key_concerns` from the CSV:

#### Domain Concern Exploration:

- Ask the user about their approach to this concern
- Discuss implications for the product design and requirements
- Document specific requirements, constraints, and compliance needs

**Example for Healthcare Domain:**
If key_concerns = "FDA approval;Clinical validation;HIPAA compliance;Patient safety;Medical device classification;Liability"

Ask about each:

- "Will this product require FDA approval? What classification?"
- "How will you validate clinical accuracy and safety?"
- "What HIPAA compliance measures are needed?"
- "What patient safety protocols must be in place?"
- "What liability considerations affect the design?"

### 4. Synthesize Domain Requirements

Based on the conversation, synthesize domain requirements that will shape everything:

#### Categories to Document:

- **Regulatory requirements** (from key_concerns)
- **Compliance needs** (from key_concerns)
- **Industry standards** (from required_knowledge)
- **Safety/risk factors** (from key_concerns)
- **Required validations** (from key_concerns)
- **Special expertise needed** (from required_knowledge)

Explain how these inform:

- What features are mandatory
- What NFRs are critical
- How to sequence development
- What validation is required

### 5. Generate Domain-Specific Content

Prepare the content to append to the document:

#### Content Structure:

When saving to document, append these Level 2 and Level 3 sections:

```markdown
## Domain-Specific Requirements

### [Domain Name] Compliance & Regulatory Overview

[Domain context summary based on conversation]

### Key Domain Concerns

[Key concerns addressed based on conversation]

### Compliance Requirements

[Compliance requirements based on conversation]

### Industry Standards & Best Practices

[Industry standards based on conversation]

### Required Expertise & Validation

[Required knowledge and validation based on conversation]

### Implementation Considerations

[Implementation implications based on conversation]
```

### 6. Handle Special Sections

Parse `special_sections` list from the matched CSV row. For each section name, generate corresponding subsections:

**Example mappings from CSV:**

- "clinical_requirements" → Add clinical validation requirements
- "regulatory_pathway" → Document approval pathway timeline
- "safety_measures" → Specify safety protocols and monitoring
- "compliance_matrix" → Create compliance tracking matrix

{step_completion}

## SUCCESS METRICS:

✅ Domain complexity properly validated as high before proceeding
✅ All key concerns from CSV explored with user input
✅ Compliance requirements clearly documented
✅ Domain expertise needs identified and documented
✅ Special sections generated per CSV configuration
✅ Content properly appended to document when user confirms

## FAILURE MODES:

❌ Proceeding with domain exploration when complexity is not high
❌ Not using CSV domain configuration properly from workflow context
❌ Missing critical domain concerns from the key_concerns list
❌ Not connecting domain requirements to product implications
❌ Generating generic content without domain-specific details
❌ Appending content without user confirmation

## SKIP CONDITIONS:

Skip this step and ask user to proceed to next step by pressing Enter if:

- `complexity_level` from step-01 is not "high"
- Domain has no specific regulatory/compliance requirements
- User confirms domain exploration is not needed
