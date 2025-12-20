---
name: 'Step 5: Completion'
description: 'Complete the product brief workflow and suggest next steps for the project'
---

# Step 5: Product Brief Completion

## STEP GOAL:

Complete the product brief workflow, update status files, and provide guidance on logical next steps for continued product development.

## MANDATORY EXECUTION RULES (READ FIRST):

{bmad_analyst_rules}

### Step-Specific Rules:

- 🎯 Focus only on completion, next steps, and project guidance
- 🚫 FORBIDDEN to generate new content for the product brief
- 💬 Approach: Systematic completion with quality validation and next step recommendations
- 📋 FINALIZE document and update workflow status appropriately

## EXECUTION PROTOCOLS:

- 🎯 Show your analysis before taking any action
- 💾 Update the main workflow status file with completion information
- 📖 Suggest potential next workflow steps for the user
- 🚫 DO NOT load additional steps after this one (this is final)

## CONTEXT BOUNDARIES:

- Available context: Complete product brief document from all previous steps, workflow frontmatter shows all completed steps
- Focus: Completion validation, status updates, and next step guidance
- Limits: No new content generation, only completion and wrap-up activities
- Dependencies: All previous steps must be completed with content saved to document

## Sequence of Instructions (Do not deviate, skip, or optimize)

### 0. Save Previous Step Content

**First Action:** Append the confirmed content from Step 4 to the product brief document.

### 1. Announce Workflow Completion

**Completion Announcement:**
"🎉 **Product Brief Complete, {{user_name}}!**

I've successfully collaborated with you to create a comprehensive Product Brief for {{project_name}}.

**What we've accomplished:**

- ✅ Executive Summary with clear vision and problem statement
- ✅ Core Vision with solution definition and unique differentiators
- ✅ Target Users with rich personas and user journeys
- ✅ Success Metrics with measurable outcomes and business objectives
- ✅ MVP Scope with focused feature set and clear boundaries
- ✅ Future Vision that inspires while maintaining current focus

**The complete Product Brief is now available at:** `outputFile`

This brief serves as the foundation for all subsequent product development activities and strategic decisions."

### 3. Document Quality Check

**Completeness Validation:**
Perform final validation of the product brief:

- Does the executive summary clearly communicate the vision and problem?
- Are target users well-defined with compelling personas?
- Do success metrics connect user value to business objectives?
- Is MVP scope focused and realistic?
- Does the brief provide clear direction for next steps?

**Consistency Validation:**

- Do all sections align with the core problem statement?
- Is user value consistently emphasized throughout?
- Are success criteria traceable to user needs and business goals?
- Does MVP scope align with the problem and solution?

**Strategic Considerations:**

- The PRD workflow builds directly on this brief for detailed planning
- Consider team capacity and immediate priorities
- Use brief to validate concept before committing to detailed work
- Brief can guide early technical feasibility discussions

### 5. Step Completion

**Save Content:**
Finalize the document and ensure all content is saved now.

**Completion Confirmation:**
"Document finalized and saved.

**Your Product Brief for {{project_name}} is now complete and ready for the next phase!**

The brief captures everything needed to guide subsequent product development:

- Clear vision and problem definition
- Deep understanding of target users
- Measurable success criteria
- Focused MVP scope with realistic boundaries
- Inspiring long-term vision

- If you want to **modify or review any section**, just tell me what you'd like to change
- If you're satisfied, **press Enter in the promptbox to go to the next agent**"

---

## 🚨 SYSTEM SUCCESS/FAILURE METRICS

### ✅ SUCCESS:

- Product brief contains all essential sections with collaborative content
- All collaborative content properly saved to document with proper frontmatter
- Workflow status file updated with completion information and timestamp
- Clear next step guidance provided to user with specific workflow recommendations
- Document quality validation completed with completeness and consistency checks
- User acknowledges completion and understands next available options

### ❌ SYSTEM FAILURE:

- Missing clear next step guidance for user
- Not confirming document completeness with user
- User unclear about what happens next or available options
- Document quality issues not identified or addressed

**Master Rule:** Skipping steps, optimizing sequences, or not following exact instructions is FORBIDDEN and constitutes SYSTEM FAILURE.

## FINAL WORKFLOW COMPLETION

This product brief is now complete and serves as the strategic foundation for the entire product lifecycle. All subsequent design, architecture, and development work should trace back to the vision, user needs, and success criteria documented in this brief.

**Congratulations on completing the Product Brief for {{project_name}}!** 🎉
