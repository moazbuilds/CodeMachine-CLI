/**
 * Action Parsing for Agent Execution
 *
 * Universal action parsing that any agent can use.
 * Actions are special commands that agents can emit to control workflow flow.
 * Supports both text-based signals (ACTION: NEXT) and MCP tool calls (approve_step_transition).
 */

import type { AgentAction, ActionParseResult } from './types.js';
import { detectMCPSignal, isApprovalSignal } from '../../workflows/signals/mcp/index.js';
import { debug } from '../../shared/logging/logger.js';

/**
 * Action markers that can appear in agent output (legacy text-based)
 */
const ACTION_PATTERNS = {
  NEXT: 'ACTION: NEXT',
  SKIP: 'ACTION: SKIP',
  STOP: 'ACTION: STOP',
} as const;

/**
 * Parse a single line for MCP approval action (JSON stream format)
 */
function parseMCPActionLine(line: string): AgentAction | null {
  const signal = detectMCPSignal(line);
  if (!signal || !isApprovalSignal(signal)) return null;

  const decision = signal.arguments.decision;
  switch (decision) {
    case 'approve':
      return 'NEXT';
    case 'reject':
      return 'STOP';
    case 'revise':
      return null; // Stay in current step for revision
    default:
      return null;
  }
}

/**
 * Parse full output for MCP approval action
 * Handles text marker format where tool name and arguments may be on different lines:
 * - << SIGNAL >> workflow-signals:approve_step_transition
 * - Followed by result like: [APPROVED] Step transition APPROVE for step-XX
 */
function parseMCPActionFromOutput(output: string): AgentAction | null {
  // Check if output contains the approval tool call marker
  const hasApprovalTool = output.includes('workflow-signals:approve_step_transition') ||
                          output.includes('approve_step_transition');

  debug('[ActionParser] Checking for MCP approval: hasApprovalTool=%s outputLen=%d',
    hasApprovalTool, output.length);

  if (!hasApprovalTool) {
    return null;
  }

  // Look for decision in the MCP result output
  // Actual format: [APPROVED] Step transition APPROVE for step-XX
  // Or: [REJECTED] Step transition REJECT for step-XX
  const hasApproved = output.includes('[APPROVED]') || output.includes('Step transition APPROVE');
  const hasRejected = output.includes('[REJECTED]') || output.includes('Step transition REJECT');
  const hasRevise = output.includes('[REVISE]') || output.includes('Step transition REVISE');

  debug('[ActionParser] MCP result check: approved=%s rejected=%s revise=%s',
    hasApproved, hasRejected, hasRevise);

  if (hasApproved) {
    debug('[ActionParser] Detected APPROVED -> returning NEXT');
    return 'NEXT';
  }
  if (hasRejected) {
    debug('[ActionParser] Detected REJECTED -> returning STOP');
    return 'STOP';
  }
  if (hasRevise) {
    debug('[ActionParser] Detected REVISE -> returning null (stay in step)');
    return null; // Stay in current step
  }

  // Fallback: Look for JSON-style decision parameter
  const decisionMatch = output.match(/"?decision"?\s*[:=]\s*"?(approve|reject|revise)"?/i);
  if (decisionMatch) {
    const decision = decisionMatch[1].toLowerCase();
    debug('[ActionParser] JSON decision match: %s', decision);
    switch (decision) {
      case 'approve':
        return 'NEXT';
      case 'reject':
        return 'STOP';
      case 'revise':
        return null;
    }
  }

  // If tool was called but no decision found, default to approve
  // (the tool being called at all indicates intent to proceed)
  debug('[ActionParser] No decision found, defaulting to NEXT');
  return 'NEXT';
}

/**
 * Parse agent output for action commands
 *
 * Actions are special commands that agents can emit to control workflow:
 * - ACTION: NEXT or approve_step_transition(decision: "approve") - Continue to next step
 * - ACTION: SKIP - Skip remaining prompts in queue
 * - ACTION: STOP or approve_step_transition(decision: "reject") - Stop the workflow
 *
 * @param output - Agent output to parse
 * @returns Detected action or null
 */
export function parseAction(output: string): AgentAction | null {
  debug('[ActionParser] parseAction called, outputLen=%d', output.length);

  // Check text-based actions first (legacy support)
  if (output.includes(ACTION_PATTERNS.NEXT)) {
    debug('[ActionParser] Found text ACTION: NEXT');
    return 'NEXT';
  }
  if (output.includes(ACTION_PATTERNS.SKIP)) {
    debug('[ActionParser] Found text ACTION: SKIP');
    return 'SKIP';
  }
  if (output.includes(ACTION_PATTERNS.STOP)) {
    debug('[ActionParser] Found text ACTION: STOP');
    return 'STOP';
  }

  // Check MCP tool calls - full output context first (handles << SIGNAL >> format)
  const mcpAction = parseMCPActionFromOutput(output);
  if (mcpAction) {
    debug('[ActionParser] MCP action detected: %s', mcpAction);
    return mcpAction;
  }

  // Fallback: Check JSON stream format line-by-line
  const lines = output.split('\n');
  for (const line of lines) {
    const action = parseMCPActionLine(line.trim());
    if (action) {
      debug('[ActionParser] JSON stream action detected: %s', action);
      return action;
    }
  }

  debug('[ActionParser] No action found');
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
    // Remove MCP signal markers: << SIGNAL >> workflow-signals:tool_name
    .replace(/<<\s*SIGNAL\s*>>\s*workflow-signals:[^\n]*/gi, '')
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
