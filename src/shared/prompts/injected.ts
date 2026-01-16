/**
 * Injected Prompts
 *
 * Centralized prompts and message templates injected during workflow execution.
 * Keeps hardcoded strings in one place for consistency and maintainability.
 *
 * Sections:
 * - STEP AGENT: Prompts sent to step agents
 * - CONTROLLER AGENT: Prompts sent to controller agent
 */

// ============================================================================
// STEP AGENT
// Prompts sent to step agents during execution
// ============================================================================

/**
 * Continue prompt - resumes step agent execution.
 *
 * Used when:
 * - Crash recovery (resume where agent left off)
 * - Delegated state transitions
 */
export const STEP_CONTINUE = 'continue';

/**
 * Default resume prompt - sent when resuming without specific user input.
 *
 * Used when:
 * - Crash recovery (session exists but no user direction)
 * - Automatic session resume
 */
export const STEP_RESUME_DEFAULT = 'Continue from where you left off.';

// ============================================================================
// CONTROLLER AGENT
// Prompts sent to controller agent for orchestration
// ============================================================================

/**
 * Reminder prefix - goes before content.
 *
 * Example:
 *   REMINDER: Always follow...
 *
 *   AGENT (dev):
 *   ---
 *   [content here]
 *   ---
 */
export const CONTROLLER_REMINDER_PREFIX =
  'REMINDER: Always follow your system prompt instructions.';

/**
 * Standalone reminder - sent alone when no content to review.
 *
 * Used when:
 * - Crash recovery (output lost, need to resume)
 * - Pause/resume (no completed output yet)
 *
 * Example:
 *   REMINDER: Always follow... Now continue.
 */
export const CONTROLLER_REMINDER_STANDALONE =
  'REMINDER: Always follow the rules and instructions given in your first message - that is your system prompt. Now continue.';

/**
 * Format user input with source identification.
 *
 * Example: "USER (moaz): hello"
 */
export const controllerPrefixUser = (username: string, prompt: string): string =>
  `USER (${username}): ${prompt}`;

/**
 * Format step agent output header.
 *
 * Example: "AGENT (dev):"
 */
export const controllerPrefixAgent = (agentName: string): string =>
  `AGENT (${agentName}):`;

/**
 * Review template - presents step output for controller review.
 *
 * Example:
 *   REMINDER: Always follow...
 *
 *   AGENT (dev):
 *   ---
 *   [output here]
 *   ---
 *
 *   Review the output above...
 */
export const controllerTemplateReview = (agentName: string, output: string): string =>
  `${CONTROLLER_REMINDER_PREFIX}

${controllerPrefixAgent(agentName)}
---
${output}
---

Review the output above and respond appropriately, or use ACTION: NEXT to proceed.`;

// ============================================================================
// STEP AGENT - USER STEERING
// Prompts for when user interrupts/pauses to give new direction
// ============================================================================

/**
 * User steering prompt - sent when user pauses to redirect the agent.
 *
 * Used when:
 * - User pauses execution to provide new instructions
 * - Agent should continue but prioritize the new user request
 *
 * @param userPrompt - The new direction from the user
 */
export const stepUserSteering = (userPrompt: string): string =>
  `[USER STEERING] The user paused this session to give you new direction. Continue from where you left off, but prioritize the user's request: "${userPrompt}"`;
