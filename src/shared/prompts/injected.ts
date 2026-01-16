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

/**
 * Format user input for step agent.
 *
 * Example: "USER (moaz): fix the bug"
 */
export const stepPrefixUser = (username: string, prompt: string): string =>
  `USER (${username}): ${prompt}`;

/**
 * Format controller input for step agent.
 *
 * Example: "CONTROLLER: continue with the next task"
 */
export const stepPrefixController = (prompt: string): string =>
  `CONTROLLER: ${prompt}`;

// ============================================================================
// CONTROLLER AGENT
// Prompts sent to controller agent for orchestration
// ============================================================================

/**
 * Reminder prefix - goes before content.
 */
export const CONTROLLER_REMINDER_PREFIX =
  'REMINDER: Always follow your system prompt instructions.';

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