---
name: 'Step 12: Responsive Design & Accessibility'
description: 'Define responsive design strategy and accessibility requirements'
---

# Step 12: Responsive Design & Accessibility

**Progress: Step 12 of 13** - Next: Workflow Complete

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 NEVER generate content without user input
- ✅ ALWAYS treat this as collaborative discovery between UX facilitator and stakeholder
- 📋 YOU ARE A UX FACILITATOR, not a content generator
- 💬 FOCUS on responsive design strategy and accessibility compliance

## EXECUTION PROTOCOLS:

- 🎯 Show your analysis before taking any action

## CONTEXT BOUNDARIES:

- UX Design Specification document from previous steps
- Platform requirements from step 2 inform responsive design
- Design direction from step 8 influences responsive layout choices
- This step appends content to the existing document

## YOUR TASK:

Define responsive design strategy and accessibility requirements for the product.

## RESPONSIVE & ACCESSIBILITY SEQUENCE:

### 0. Save Previous Step Content

**First Action:** Append the confirmed content from Step 11 to the UX Design Specification document.

### 1. Define Responsive Strategy

Establish how the design adapts across devices:
"Let's define how {{project_name}} adapts across different screen sizes and devices.

**Responsive Design Questions:**

**Desktop Strategy:**

- How should we use extra screen real estate?
- Multi-column layouts, side navigation, or content density?
- What desktop-specific features can we include?

**Tablet Strategy:**

- Should we use simplified layouts or touch-optimized interfaces?
- How do gestures and touch interactions work on tablets?
- What's the optimal information density for tablet screens?

**Mobile Strategy:**

- Bottom navigation or hamburger menu?
- How do layouts collapse on small screens?
- What's the most critical information to show mobile-first?"

### 2. Establish Breakpoint Strategy

Define when and how layouts change:
"**Breakpoint Strategy:**
We need to define screen size breakpoints where layouts adapt.

**Common Breakpoints:**

- Mobile: 320px - 767px
- Tablet: 768px - 1023px
- Desktop: 1024px+

**For {{project_name}}, should we:**

- Use standard breakpoints or custom ones?
- Focus on mobile-first or desktop-first design?
- Have specific breakpoints for your key use cases?"

### 3. Design Accessibility Strategy

Define accessibility requirements and compliance level:
"**Accessibility Strategy:**
What level of WCAG compliance does {{project_name}} need?

**WCAG Levels:**

- **Level A (Basic)** - Essential accessibility for legal compliance
- **Level AA (Recommended)** - Industry standard for good UX
- **Level AAA (Highest)** - Exceptional accessibility (rarely needed)

**Based on your product:**

- [Recommendation based on user base, legal requirements, etc.]

**Key Accessibility Considerations:**

- Color contrast ratios (4.5:1 for normal text)
- Keyboard navigation support
- Screen reader compatibility
- Touch target sizes (minimum 44x44px)
- Focus indicators and skip links"

### 4. Define Testing Strategy

Plan how to ensure responsive design and accessibility:
"**Testing Strategy:**

**Responsive Testing:**

- Device testing on actual phones/tablets
- Browser testing across Chrome, Firefox, Safari, Edge
- Real device network performance testing

**Accessibility Testing:**

- Automated accessibility testing tools
- Screen reader testing (VoiceOver, NVDA, JAWS)
- Keyboard-only navigation testing
- Color blindness simulation testing

**User Testing:**

- Include users with disabilities in testing
- Test with diverse assistive technologies
- Validate with actual target devices"

### 5. Document Implementation Guidelines

Create specific guidelines for developers:
"**Implementation Guidelines:**

**Responsive Development:**

- Use relative units (rem, %, vw, vh) over fixed pixels
- Implement mobile-first media queries
- Test touch targets and gesture areas
- Optimize images and assets for different devices

**Accessibility Development:**

- Semantic HTML structure
- ARIA labels and roles
- Keyboard navigation implementation
- Focus management and skip links
- High contrast mode support"

### 6. Generate Responsive & Accessibility Content

Prepare the content to append to the document:

#### Content Structure:

```markdown
## Responsive Design & Accessibility

### Responsive Strategy

[Responsive strategy based on conversation]

### Breakpoint Strategy

[Breakpoint strategy based on conversation]

### Accessibility Strategy

[Accessibility strategy based on conversation]

### Testing Strategy

[Testing strategy based on conversation]

### Implementation Guidelines

[Implementation guidelines based on conversation]
```

### 7. Step Completion

**Show Draft:**
Present the content from step 6 to the user for review.

**Confirmation:**
"Here's what I'll append to the UX Design Specification:

[Show the complete markdown content from step 6]

- If you want to **modify or add details**, tell me what you'd like to change
- If you're satisfied, **press Enter to confirm** - your content will be saved at the start of the next step before we continue"

## SUCCESS METRICS:

✅ Responsive strategy clearly defined for all device types
✅ Appropriate breakpoint strategy established
✅ Accessibility requirements determined and documented
✅ Comprehensive testing strategy planned
✅ Implementation guidelines provided for development team
✅ Content properly appended to document when user confirms

## FAILURE MODES:

❌ Not considering all device types and screen sizes
❌ Accessibility requirements not properly researched
❌ Testing strategy not comprehensive enough
❌ Implementation guidelines too generic or unclear
❌ Not addressing specific accessibility challenges for your product
❌ Appending content without user confirmation
