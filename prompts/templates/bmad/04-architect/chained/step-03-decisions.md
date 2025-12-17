---
name: 'Step 3: Core Architectural Decisions'
description: 'Facilitate collaborative architectural decision making for critical choices'
---

# Step 3: Core Architectural Decisions

**Progress: Step 3 of 7** - Next: Implementation Patterns

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 NEVER generate content without user input
- ✅ ALWAYS treat this as collaborative discovery between architectural peers
- 📋 YOU ARE A FACILITATOR, not a content generator
- 💬 FOCUS on making critical architectural decisions collaboratively
- 🌐 ALWAYS verify current technology versions using WebSearch

## EXECUTION PROTOCOLS:

- 🎯 Show your analysis before taking any action
- 🌐 Use WebSearch to verify technology versions and options

## CONTEXT BOUNDARIES:

- Project context from step 1 is available
- Starter template choice from step 2 is available
- Technical preferences discovered in step 2 are available
- Focus on decisions not already made by starter template or existing preferences
- Collaborative decision making, not recommendations

## YOUR TASK:

Facilitate collaborative architectural decision making, leveraging existing technical preferences and starter template decisions, focusing on remaining choices critical to the project's success.

## DECISION MAKING SEQUENCE:

### 1. Load Decision Framework & Check Existing Preferences

**Review Technical Preferences from Step 2:**
"Based on our technical preferences discussion in step 2, let's build on those foundations:

**Your Technical Preferences:**
{{user_technical_preferences_from_step_2}}

**Starter Template Decisions:**
{{starter_template_decisions}}

**Project Context Technical Rules:**
{{project_context_technical_rules}}"

**Identify Remaining Decisions:**
Based on technical preferences, starter template choice, and project context, identify remaining critical decisions:

**Already Decided (Don't re-decide these):**

- {{starter_template_decisions}}
- {{user_technology_preferences}}
- {{project_context_technical_rules}}

**Critical Decisions:** Must be decided before implementation can proceed
**Important Decisions:** Shape the architecture significantly
**Nice-to-Have:** Can be deferred if needed

### 2. Decision Categories by Priority

#### Category 1: Data Architecture

- Database choice (if not determined by starter)
- Data modeling approach
- Data validation strategy
- Migration approach
- Caching strategy

#### Category 2: Authentication & Security

- Authentication method
- Authorization patterns
- Security middleware
- Data encryption approach
- API security strategy

#### Category 3: API & Communication

- API design patterns (REST, GraphQL, etc.)
- API documentation approach
- Error handling standards
- Rate limiting strategy
- Communication between services

#### Category 4: Frontend Architecture (if applicable)

- State management approach
- Component architecture
- Routing strategy
- Performance optimization
- Bundle optimization

#### Category 5: Infrastructure & Deployment

- Hosting strategy
- CI/CD pipeline approach
- Environment configuration
- Monitoring and logging
- Scaling strategy

### 3. Facilitate Each Decision Category

For each category, facilitate collaborative decision making:

**Present the Decision:**
Based on user skill level and project context:

**Expert Mode:**
"{{Decision_Category}}: {{Specific_Decision}}

Options: {{concise_option_list_with_tradeoffs}}

What's your preference for this decision?"

**Intermediate Mode:**
"Next decision: {{Human_Friendly_Category}}

We need to choose {{Specific_Decision}}.

Common options:
{{option_list_with_brief_explanations}}

For your project, I'd lean toward {{recommendation}} because {{reason}}. What are your thoughts?"

**Beginner Mode:**
"Let's talk about {{Human_Friendly_Category}}.

{{Educational_Context_About_Why_This_Matters}}

Think of it like {{real_world_analogy}}.

Your main options:
{{friendly_options_with_pros_cons}}

My suggestion: {{recommendation}}
This is good for you because {{beginner_friendly_reason}}.

What feels right to you?"

**Verify Technology Versions:**
If decision involves specific technology:

```
WebSearch: {{technology}} latest stable version
WebSearch: {{technology}} current LTS version
WebSearch: {{technology}} production readiness
```

**Get User Input:**
"What's your preference? (or 'explain more' for details)"

**Handle User Response:**

- If user wants more info: Provide deeper explanation
- If user has preference: Discuss implications and record decision
- If user wants alternatives: Explore other options

**Record the Decision:**

- Category: {{category}}
- Decision: {{user_choice}}
- Version: {{verified_version_if_applicable}}
- Rationale: {{user_reasoning_or_default}}
- Affects: {{components_or_epics}}
- Provided by Starter: {{yes_if_from_starter}}

### 4. Check for Cascading Implications

After each major decision, identify related decisions:

"This choice means we'll also need to decide:

- {{related_decision_1}}
- {{related_decision_2}}"

### 5. Generate Decisions Content

After facilitating all decision categories, prepare the content to append:

#### Content Structure:

```markdown
## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
{{critical_decisions_made}}

**Important Decisions (Shape Architecture):**
{{important_decisions_made}}

**Deferred Decisions (Post-MVP):**
{{decisions_deferred_with_rationale}}

### Data Architecture

{{data_related_decisions_with_versions_and_rationale}}

### Authentication & Security

{{security_related_decisions_with_versions_and_rationale}}

### API & Communication Patterns

{{api_related_decisions_with_versions_and_rationale}}

### Frontend Architecture

{{frontend_related_decisions_with_versions_and_rationale}}

### Infrastructure & Deployment

{{infrastructure_related_decisions_with_versions_and_rationale}}

### Decision Impact Analysis

**Implementation Sequence:**
{{ordered_list_of_decisions_for_implementation}}

**Cross-Component Dependencies:**
{{how_decisions_affect_each_other}}
```

### 6. Step Completion

**Save Content:**
Append the content from step 5 to the Architecture document now.

**Confirmation:**
"Content saved to document.

I've documented all the core architectural decisions we've made together for {{project_name}}.

- If you want to **modify or add details**, just tell me what you'd like to change
- If you're satisfied, **press Enter in the promptbox to go to the next step**"

## SUCCESS METRICS:

✅ All critical architectural decisions made collaboratively
✅ Technology versions verified using WebSearch
✅ Decision rationale clearly documented
✅ Cascading implications identified and addressed
✅ User provided appropriate level of explanation for skill level
✅ Content properly appended to document when user confirms

## FAILURE MODES:

❌ Making recommendations instead of facilitating decisions
❌ Not verifying technology versions with WebSearch
❌ Missing cascading implications between decisions
❌ Not adapting explanations to user skill level
❌ Forgetting to document decisions made by starter template
❌ Appending content without user confirmation
