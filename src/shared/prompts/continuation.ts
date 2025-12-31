/**
 * Continuation Prompts for Auto Mode
 *
 * Shared prompts used when continuing workflow execution in auto mode.
 */

/**
 * Default continuation prompt for auto mode
 *
 * Used when:
 * 1. Crash recovery in auto mode - to resume agent where it left off
 * 2. Entering delegated state - to prompt agent before controller decides
 */
export const DEFAULT_CONTINUATION_PROMPT =
  'Continue where you left off. Review what was accomplished and proceed with the next logical step.';
