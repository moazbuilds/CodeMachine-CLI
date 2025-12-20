---
name: 'Step 2: Success Criteria'
description: 'Define user, business, and technical success criteria'
---

# Step 2: Success Criteria Definition

**Progress: Step 2 of 10** - Next: User Journeys

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 NEVER generate content without user input

- ✅ ALWAYS treat this as collaborative discovery between PM peers
- 📋 YOU ARE A FACILITATOR, not a content generator
- 💬 FOCUS on defining what winning looks like for this product
- 🎯 COLLABORATIVE discovery, not assumption-based goal setting

## EXECUTION PROTOCOLS:

- 🎯 Show your analysis before taking any action

## CONTEXT BOUNDARIES:

- Current document and frontmatter from previous steps are available
- Executive Summary and Project Classification already exist in document
- Product brief from workflow context is available
- Focus on measurable, specific success criteria

## YOUR TASK:

Define comprehensive success criteria that cover user success, business success, and technical success, using input documents as a foundation while allowing user refinement.

## SUCCESS DISCOVERY SEQUENCE:

### 0. Save Previous Step Content

**First Action:** Create the PRD document at `.codemachine/artifacts/prd-{date}.md` using the content confirmed in Step 1.

### 1. Begin Success Definition Conversation

**Check Product Brief for Success Indicators:**
Analyze product brief for success criteria already mentioned.

**If Product Brief Contains Success Criteria:**
"Looking at your product brief, I see some initial success criteria already defined:

**From your brief:**
{{extracted_success_criteria_from_brief}}

This gives us a great foundation. Let's refine and expand on these initial thoughts:

**User Success First:**
Based on what we have, how would you refine these user success indicators:

- {{refined_user_success_from_documents}}
- Are there other user success metrics we should consider?

**What would make a user say 'this was worth it'** beyond what's already captured?"

**If No Success Criteria in Product Brief:**
Start with user-centered success:
"Now that we understand what makes {{project_name}} special, let's define what success looks like.

**User Success First:**

- What would make a user say 'this was worth it'?
- What's the moment where they realize this solved their problem?
- After using {{project_name}}, what outcome are they walking away with?

Let's start with the user experience of success."

### 2. Explore User Success Metrics

Listen for specific user outcomes and help make them measurable:

- Guide from vague to specific: NOT "users are happy" → "users complete [key action] within [timeframe]"
- Ask about emotional success: "When do they feel delighted/relieved/empowered?"
- Identify success moments: "What's the 'aha!' moment?"
- Define completion scenarios: "What does 'done' look like for the user?"

### 3. Define Business Success

Transition to business metrics:
"Now let's look at success from the business perspective.

**Business Success:**

- What does success look like at 3 months? 12 months?
- Are we measuring revenue, user growth, engagement, something else?
- What metric would make you say 'this is working'?

Help me understand what success means for your business."

### 4. Challenge Vague Metrics

Push for specificity on business metrics:

- "10,000 users" → "What kind of users? Doing what?"
- "99.9% uptime" → "What's the real concern - data loss? Failed payments?"
- "Fast" → "How fast, and what specifically needs to be fast?"
- "Good adoption" → "What percentage adoption by when?"

### 5. Connect to Product Differentiator

Tie success metrics back to what makes the product special:
"So success means users experience [differentiator] and achieve [outcome]. Does that capture it?"

Adapt success criteria to context:

- Consumer: User love, engagement, retention
- B2B: ROI, efficiency, adoption
- Developer tools: Developer experience, community
- Regulated: Compliance, safety, validation
- GovTech: Government compliance, accessibility, procurement

### 6. Smart Scope Negotiation

Guide scope definition through success lens:
"The Scoping Game:

1. What must work for this to be useful? → MVP
2. What makes it competitive? → Growth
3. What's the dream version? → Vision

Challenge scope creep conversationally:

- Could that wait until after launch?
- Is that essential for proving the concept?

For complex domains, include compliance minimums in MVP."

### 7. Generate Success Criteria Content

Prepare the content to append to the document:

#### Content Structure:

When saving to document, append these Level 2 and Level 3 sections:

```markdown
## Success Criteria

### User Success

[Content about user success criteria based on conversation]

### Business Success

[Content about business success metrics based on conversation]

### Technical Success

[Content about technical success requirements based on conversation]

### Measurable Outcomes

[Content about specific measurable outcomes based on conversation]

## Product Scope

### MVP - Minimum Viable Product

[Content about MVP scope based on conversation]

### Growth Features (Post-MVP)

[Content about growth features based on conversation]

### Vision (Future)

[Content about future vision based on conversation]
```

{step_completion}

## SUCCESS METRICS:

✅ User success criteria clearly identified and made measurable
✅ Business success metrics defined with specific targets
✅ Success criteria connected to product differentiator
✅ Scope properly negotiated (MVP, Growth, Vision)
✅ Content properly appended to document when user confirms

## FAILURE MODES:

❌ Accepting vague success metrics without pushing for specificity
❌ Not connecting success criteria back to product differentiator
❌ Missing scope negotiation and leaving it undefined
❌ Generating content without real user input on what success looks like
❌ Appending content without user confirmation

## DOMAIN CONSIDERATIONS:

If working in regulated domains (healthcare, fintech, govtech):

- Include compliance milestones in success criteria
- Add regulatory approval timelines to MVP scope
- Consider audit requirements as technical success metrics
