/**
 * Action Parsing for Agent Execution
 *
 * Universal action parsing that any agent can use.
 * Actions are special commands that agents can emit to control workflow flow.
 */

import type { AgentAction, ActionParseResult } from './types.js';

/**
 * Action markers that can appear in agent output
 */
const ACTION_PATTERNS = {
  NEXT: 'ACTION: NEXT',
  SKIP: 'ACTION: SKIP',
  STOP: 'ACTION: STOP',
} as const;

/**
 * Parse agent output for action commands
 *
 * Actions are special commands that agents can emit to control workflow:
 * - ACTION: NEXT - Continue to next step/prompt
 * - ACTION: SKIP - Skip remaining prompts in queue
 * - ACTION: STOP - Stop the workflow
 *
 * @param output - Agent output to parse
 * @returns Detected action or null
 */
export function parseAction(output: string): AgentAction | null {
  if (output.includes(ACTION_PATTERNS.NEXT)) return 'NEXT';
  if (output.includes(ACTION_PATTERNS.SKIP)) return 'SKIP';
  if (output.includes(ACTION_PATTERNS.STOP)) return 'STOP';
  return null;
}

/**
 * Extract clean text from agent output, removing:
 * - ACTION: commands
 * - Color markers like [CYAN], [GREEN:BOLD], [GRAY], etc.
 * - Thinking prefixes (* )
 * - Status lines
 *
 * @param output - Raw agent output
 * @returns Cleaned text suitable for use as input
 */
export function extractCleanText(output: string): string {
  return output
    // Remove ACTION commands
    .replace(/ACTION:\s*(NEXT|SKIP|STOP)/g, '')
    // Remove color markers like [CYAN], [GREEN:BOLD], [GRAY], [RUNNING], etc.
    .replace(/\[(CYAN|GREEN|GRAY|RED|YELLOW|MAGENTA|BLUE|WHITE|BLACK|RUNNING|DIM|BOLD|RESET)(:[A-Z]+)?\]/gi, '')
    // Remove "* " thinking prefix from streaming
    .replace(/^\s*\*\s*/gm, '')
    // Remove status lines
    .replace(/>\s*OpenCode is analyzing[^\n]*/gi, '')
    // Clean up multiple newlines
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Parse agent output for both action and clean text
 *
 * Combines parseAction and extractCleanText into a single call.
 *
 * @param output - Agent output to parse
 * @returns Action (if any) and cleaned output text
 */
export function parseOutput(output: string): ActionParseResult {
  return {
    action: parseAction(output),
    cleanedOutput: extractCleanText(output),
  };
}

/**
 * Check if output contains any action command
 */
export function hasAction(output: string): boolean {
  return parseAction(output) !== null;
}
