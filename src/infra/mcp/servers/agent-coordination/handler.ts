/**
 * Agent Coordination MCP Server - Tool Handler
 *
 * Extracted tool handling logic for in-process execution.
 * Used by both the standalone MCP server and the embedded router.
 */

import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import { initDebugLogging, debug } from '../../../../shared/logging/logger.js';
import { RunAgentsSchema, GetAgentStatusSchema, ListAvailableAgentsSchema } from './schemas.js';
import type { ExecutionResult } from './schemas.js';
import { executeAgents, queryAgentStatus, getActiveAgents, listAvailableAgents } from './executor.js';
import type { AvailableAgent } from './executor.js';
import type { AgentRecord } from '../../../../agents/monitoring/types.js';
import { validateScriptTargets, filterAgentsByTargets } from './validator.js';

// Initialize debug logging for this handler
initDebugLogging();

// ============================================================================
// TARGET FILTERING HELPERS
// ============================================================================

/**
 * Extract and remove _allowed_targets from args
 *
 * The router injects this field to communicate target restrictions.
 * We extract it and remove it before passing args to tool handlers.
 */
function extractAllowedTargets(args: Record<string, unknown>): {
  allowedTargets: string[] | null;
  cleanArgs: Record<string, unknown>;
} {
  const { _allowed_targets, ...cleanArgs } = args;

  // _allowed_targets can be null (no restrictions) or string[]
  const allowedTargets = Array.isArray(_allowed_targets)
    ? (_allowed_targets as string[])
    : null;

  return { allowedTargets, cleanArgs };
}

// ============================================================================
// FORMATTERS
// ============================================================================

/**
 * Format execution result for MCP response
 */
function formatExecutionResult(result: ExecutionResult): string {
  const lines: string[] = [
    `Coordination ${result.success ? 'SUCCEEDED' : 'FAILED'}`,
    `Duration: ${result.duration_ms}ms`,
    '',
    'Agent Results:',
  ];

  for (const r of result.results) {
    const status = r.success ? '[OK]' : '[FAIL]';
    lines.push(`  ${status} ${r.name} (ID: ${r.agentId})`);
    if (r.prompt) {
      const truncated = r.prompt.length > 80 ? r.prompt.slice(0, 77) + '...' : r.prompt;
      lines.push(`      Prompt: ${truncated}`);
    }
    if (r.error) {
      lines.push(`      Error: ${r.error}`);
    }
    if (r.tailApplied) {
      lines.push(`      Output limited to last ${r.tailApplied} lines`);
    }
  }

  return lines.join('\n');
}

/**
 * Format agent records for MCP response
 */
function formatAgentRecords(agents: AgentRecord[]): string {
  if (agents.length === 0) {
    return 'No matching agents found.';
  }

  const lines: string[] = [`Found ${agents.length} agent(s):`, ''];

  for (const a of agents) {
    const statusIcon: Record<string, string> = {
      running: '[RUN]',
      completed: '[OK]',
      failed: '[FAIL]',
      paused: '[PAUSE]',
      skipped: '[SKIP]',
    };
    lines.push(`${statusIcon[a.status] || '[?]'} ID:${a.id} ${a.name}`);
    lines.push(`    Status: ${a.status}`);
    lines.push(`    Started: ${a.startTime}`);
    if (a.duration !== undefined) {
      lines.push(`    Duration: ${a.duration}ms`);
    }
    if (a.error) {
      lines.push(`    Error: ${a.error}`);
    }
    if (a.parentId) {
      lines.push(`    Parent: ${a.parentId}`);
    }
    if (a.sessionId) {
      lines.push(`    Session: ${a.sessionId}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Format available agents catalog for MCP response
 */
function formatAvailableAgents(agents: AvailableAgent[]): string {
  const lines: string[] = [`Available agents (${agents.length}):`, ''];

  // Group by role for better organization
  const controllers = agents.filter((a) => a.role === 'controller');
  const regular = agents.filter((a) => a.role !== 'controller');

  if (controllers.length > 0) {
    lines.push('Controller agents (autonomous mode):');
    for (const a of controllers) {
      const meta: string[] = [];
      if (a.engine) meta.push(`engine:${a.engine}`);
      if (a.model) meta.push(`model:${a.model}`);
      lines.push(`  - ${a.id}${meta.length ? ` (${meta.join(', ')})` : ''}`);
    }
    lines.push('');
  }

  if (regular.length > 0) {
    lines.push('Standard agents:');
    for (const a of regular) {
      const meta: string[] = [];
      if (a.engine) meta.push(`engine:${a.engine}`);
      if (a.model) meta.push(`model:${a.model}`);
      lines.push(`  - ${a.id}${meta.length ? ` (${meta.join(', ')})` : ''}`);
    }
  }

  return lines.join('\n');
}

// ============================================================================
// TOOL HANDLER
// ============================================================================

/**
 * Handle agent coordination tool calls
 *
 * @param name - Tool name to execute
 * @param args - Tool arguments (may include _allowed_targets from router)
 * @returns Tool result
 */
export async function handleAgentCoordinationTool(
  name: string,
  args: Record<string, unknown>
): Promise<CallToolResult> {
  // Extract target filtering from router-injected args
  const { allowedTargets, cleanArgs } = extractAllowedTargets(args);

  try {
    // ========================================================================
    // RUN_AGENTS
    // ========================================================================
    if (name === 'run_agents') {
      debug('[agent-coordination:handler] run_agents called with script: %s', cleanArgs.script);
      const validated = RunAgentsSchema.parse(cleanArgs);

      // Validate script targets before execution
      validateScriptTargets(validated.script, allowedTargets);

      debug('[agent-coordination:handler] Executing agents...');
      const result = await executeAgents(validated);
      debug('[agent-coordination:handler] Execution complete: success=%s', result.success);

      return {
        content: [
          {
            type: 'text',
            text: formatExecutionResult(result),
          },
        ],
      };
    }

    // ========================================================================
    // GET_AGENT_STATUS
    // ========================================================================
    if (name === 'get_agent_status') {
      const validated = GetAgentStatusSchema.parse(cleanArgs);
      const agents = queryAgentStatus(validated);

      return {
        content: [
          {
            type: 'text',
            text: formatAgentRecords(agents),
          },
        ],
      };
    }

    // ========================================================================
    // LIST_ACTIVE_AGENTS
    // ========================================================================
    if (name === 'list_active_agents') {
      const agents = getActiveAgents();

      return {
        content: [
          {
            type: 'text',
            text:
              agents.length === 0
                ? 'No agents currently running.'
                : formatAgentRecords(agents),
          },
        ],
      };
    }

    // ========================================================================
    // LIST_AVAILABLE_AGENTS
    // ========================================================================
    if (name === 'list_available_agents') {
      const validated = ListAvailableAgentsSchema.parse(cleanArgs);
      const allAgents = await listAvailableAgents(validated);

      // Filter agents by allowed targets
      const agents = filterAgentsByTargets(allAgents, allowedTargets);

      return {
        content: [
          {
            type: 'text',
            text:
              agents.length === 0
                ? allowedTargets
                  ? 'No allowed agents found in catalog.'
                  : 'No agents found in catalog.'
                : formatAvailableAgents(agents),
          },
        ],
      };
    }

    // ========================================================================
    // UNKNOWN TOOL
    // ========================================================================
    return {
      content: [
        {
          type: 'text',
          text: `Unknown tool: ${name}`,
        },
      ],
      isError: true,
    };
  } catch (error) {
    // Handle Zod validation errors
    if (error && typeof error === 'object' && 'errors' in error) {
      const zodError = error as { errors: Array<{ path: string[]; message: string }> };
      return {
        content: [
          {
            type: 'text',
            text: `Validation Error:\n${zodError.errors.map((e) => `- ${e.path.join('.')}: ${e.message}`).join('\n')}`,
          },
        ],
        isError: true,
      };
    }

    // Execution errors
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: 'text',
          text: `Execution Error: ${message}`,
        },
      ],
      isError: true,
    };
  }
}
