/**
 * Agent Coordination MCP Server - Execution Logic
 *
 * Wraps CoordinatorService and AgentMonitorService for MCP tool handlers.
 */

import { CoordinatorService } from '../../../../agents/coordinator/index.js';
import { AgentMonitorService } from '../../../../agents/monitoring/index.js';
import {
  collectAgentDefinitions,
  resolveProjectRoot,
} from '../../../../shared/agents/discovery/catalog.js';
import type { AgentDefinition } from '../../../../shared/agents/config/types.js';
import type { AgentRecord, AgentStatus } from '../../../../agents/monitoring/types.js';
import type {
  RunAgentsInput,
  GetAgentStatusInput,
  ListAvailableAgentsInput,
  ExecutionResult,
} from './schemas.js';

// ============================================================================
// EXECUTION
// ============================================================================

/**
 * Execute agents using CoordinatorService
 *
 * Wraps the coordinator with timeout handling and MCP-friendly result format.
 */
export async function executeAgents(input: RunAgentsInput): Promise<ExecutionResult> {
  const startTime = Date.now();
  const coordinator = CoordinatorService.getInstance();

  const workingDir = input.working_dir || process.cwd();

  // Create timeout promise
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(
      () => reject(new Error(`Execution timeout after ${input.timeout_ms}ms`)),
      input.timeout_ms
    );
  });

  // Execute with timeout race
  const executionPromise = coordinator.execute(input.script, {
    workingDir,
    // Suppress console output in MCP context - output goes to result
    logger: () => {},
  });

  const result = await Promise.race([executionPromise, timeoutPromise]);

  return {
    success: result.success,
    parentId: result.parentId,
    results: result.results.map((r) => ({
      name: r.name,
      agentId: r.agentId,
      success: r.success,
      prompt: r.prompt,
      input: r.input,
      output: r.output,
      error: r.error,
      tailApplied: r.tailApplied,
    })),
    duration_ms: Date.now() - startTime,
  };
}

// ============================================================================
// STATUS QUERIES
// ============================================================================

/**
 * Query agent status from AgentMonitorService
 */
export function queryAgentStatus(input: GetAgentStatusInput): AgentRecord[] {
  const monitor = AgentMonitorService.getInstance();

  // Specific agent lookup by ID
  if (input.agent_id !== undefined) {
    const agent = monitor.getAgent(input.agent_id);
    return agent ? [agent] : [];
  }

  // Query with filters
  let agents = monitor.getAllAgents();

  // Filter by name
  if (input.name) {
    agents = agents.filter((a) => a.name === input.name);
  }

  // Filter by status
  if (input.status && input.status.length > 0) {
    const statusSet = new Set(input.status as AgentStatus[]);
    agents = agents.filter((a) => statusSet.has(a.status));
  }

  // Sort by ID descending (most recent first) and limit
  agents.sort((a, b) => b.id - a.id);
  return agents.slice(0, input.limit ?? 10);
}

/**
 * Get all currently running agents
 */
export function getActiveAgents(): AgentRecord[] {
  const monitor = AgentMonitorService.getInstance();
  return monitor.getActiveAgents();
}

// ============================================================================
// AGENT CATALOG
// ============================================================================

/**
 * Simplified agent info for MCP response
 */
export interface AvailableAgent {
  id: string;
  model?: string;
  engine?: string;
  role?: string;
}

/**
 * List all available agents from the catalog
 */
export async function listAvailableAgents(
  input: ListAvailableAgentsInput
): Promise<AvailableAgent[]> {
  const projectRoot = resolveProjectRoot(input.working_dir);
  const definitions = await collectAgentDefinitions(projectRoot);

  return definitions.map((def: AgentDefinition) => ({
    id: def.id,
    model: typeof def.model === 'string' ? def.model : undefined,
    engine: def.engine,
    role: def.role,
  }));
}
