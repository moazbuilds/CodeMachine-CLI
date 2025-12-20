---
name: 'Step 9: Non-Functional Requirements'
description: 'Define quality attributes and system constraints'
---

# Step 9: Non-Functional Requirements

**Progress: Step 9 of 10** - Next: Complete PRD

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 NEVER generate content without user input

- ✅ ALWAYS treat this as collaborative discovery between PM peers
- 📋 YOU ARE A FACILITATOR, not a content generator
- 💬 FOCUS on quality attributes that matter for THIS specific product
- 🎯 SELECTIVE: Only document NFRs that actually apply to the product

## EXECUTION PROTOCOLS:

- 🎯 Show your analysis before taking any action

## CONTEXT BOUNDARIES:

- Current document and frontmatter from previous steps are available
- Functional requirements already defined and will inform NFRs
- Domain and project-type context will guide which NFRs matter
- Focus on specific, measurable quality criteria

## YOUR TASK:

Define non-functional requirements that specify quality attributes for the product, focusing only on what matters for THIS specific product.

## NON-FUNCTIONAL REQUIREMENTS SEQUENCE:

### 0. Save Previous Step Content

**First Action:** Append the confirmed content from Step 8 to the PRD document.

### 1. Explain NFR Purpose and Scope

Start by clarifying what NFRs are and why we're selective:

**NFR Purpose:**
NFRs define HOW WELL the system must perform, not WHAT it must do. They specify quality attributes like performance, security, scalability, etc.

**Selective Approach:**
We only document NFRs that matter for THIS product. If a category doesn't apply, we skip it entirely. This prevents requirement bloat and focuses on what's actually important.

### 2. Assess Product Context for NFR Relevance

Evaluate which NFR categories matter based on product context:

**Quick Assessment Questions:**

- **Performance**: Is there user-facing impact of speed?
- **Security**: Are we handling sensitive data or payments?
- **Scalability**: Do we expect rapid user growth?
- **Accessibility**: Are we serving broad public audiences?
- **Integration**: Do we need to connect with other systems?
- **Reliability**: Would downtime cause significant problems?

### 3. Explore Relevant NFR Categories

For each relevant category, conduct targeted discovery:

#### Performance NFRs (If relevant):

"Let's talk about performance requirements for {{project_name}}.

**Performance Questions:**

- What parts of the system need to be fast for users to be successful?
- Are there specific response time expectations?
- What happens if performance is slower than expected?
- Are there concurrent user scenarios we need to support?"

#### Security NFRs (If relevant):

"Security is critical for products that handle sensitive information.

**Security Questions:**

- What data needs to be protected?
- Who should have access to what?
- What are the security risks we need to mitigate?
- Are there compliance requirements (GDPR, HIPAA, PCI-DSS)?"

#### Scalability NFRs (If relevant):

"Scalability matters if we expect growth or have variable demand.

**Scalability Questions:**

- How many users do we expect initially? Long-term?
- Are there seasonal or event-based traffic spikes?
- What happens if we exceed our capacity?"
- What growth scenarios should we plan for?"

#### Accessibility NFRs (If relevant):

"Accessibility ensures the product works for users with disabilities.

**Accessibility Questions:**

- Are we serving users with visual, hearing, or motor impairments?
- Are there legal accessibility requirements (WCAG, Section 508)?
- What accessibility features are most important for our users?"

#### Integration NFRs (If relevant):

"Integration requirements matter for products that connect to other systems.

**Integration Questions:**

- What external systems do we need to connect with?
- Are there APIs or data formats we must support?
- How reliable do these integrations need to be?"

### 4. Make NFRs Specific and Measurable

For each relevant NFR category, ensure criteria are testable:

**From Vague to Specific:**

- NOT: "The system should be fast" → "User actions complete within 2 seconds"
- NOT: "The system should be secure" → "All data is encrypted at rest and in transit"
- NOT: "The system should scale" → "System supports 10x user growth with <10% performance degradation"

### 5. Generate NFR Content (Only Relevant Categories)

Prepare the content to append to the document:

#### Content Structure (Dynamic based on relevance):

When saving to document, append these Level 2 and Level 3 sections (only include sections that are relevant):

```markdown
## Non-Functional Requirements

### Performance

[Performance requirements based on conversation - only include if relevant]

### Security

[Security requirements based on conversation - only include if relevant]

### Scalability

[Scalability requirements based on conversation - only include if relevant]

### Accessibility

[Accessibility requirements based on conversation - only include if relevant]

### Integration

[Integration requirements based on conversation - only include if relevant]
```

{step_completion}

## SUCCESS METRICS:

✅ Only relevant NFR categories documented (no requirement bloat)
✅ Each NFR is specific and measurable
✅ NFRs connected to actual user needs and business context
✅ Vague requirements converted to testable criteria
✅ Domain-specific compliance requirements included if relevant
✅ Content properly appended to document when user confirms

## FAILURE MODES:

❌ Documenting NFR categories that don't apply to the product
❌ Leaving requirements vague and unmeasurable
❌ Not connecting NFRs to actual user or business needs
❌ Missing domain-specific compliance requirements
❌ Creating overly prescriptive technical requirements
❌ Appending content without user confirmation

## NFR CATEGORY GUIDANCE:

**Include Performance When:**

- User-facing response times impact success
- Real-time interactions are critical
- Performance is a competitive differentiator

**Include Security When:**

- Handling sensitive user data
- Processing payments or financial information
- Subject to compliance regulations
- Protecting intellectual property

**Include Scalability When:**

- Expecting rapid user growth
- Handling variable traffic patterns
- Supporting enterprise-scale usage
- Planning for market expansion

**Include Accessibility When:**

- Serving broad public audiences
- Subject to accessibility regulations
- Targeting users with disabilities
- B2B customers with accessibility requirements
