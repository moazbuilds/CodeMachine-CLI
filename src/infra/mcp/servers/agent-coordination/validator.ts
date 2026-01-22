/**
 * Agent Coordination MCP Server - Target Validation
 *
 * Validates that coordination scripts only reference allowed agent targets.
 * Used by the MCP server to enforce target filtering from router configuration.
 */

import { CoordinatorParser } from '../../../../agents/coordinator/parser.js';
import type { CoordinationPlan } from '../../../../agents/coordinator/types.js';

/**
 * Extract all agent names from a coordination script
 *
 * Parses the script and returns all unique agent names that would be executed.
 *
 * @param script - Coordination script (e.g., "frontend 'UI' & backend 'API'")
 * @returns Array of unique agent names
 */
export function extractAgentNames(script: string): string[] {
  const parser = new CoordinatorParser();
  const plan = parser.parse(script);
  return extractNamesFromPlan(plan);
}

/**
 * Extract agent names from a parsed coordination plan
 */
function extractNamesFromPlan(plan: CoordinationPlan): string[] {
  const names = new Set<string>();

  for (const group of plan.groups) {
    for (const command of group.commands) {
      names.add(command.name);
    }
  }

  return Array.from(names);
}

/**
 * Validate that a coordination script only uses allowed targets
 *
 * @param script - Coordination script to validate
 * @param allowedTargets - List of allowed agent names, or null for no restrictions
 * @throws Error if script contains disallowed agent names
 */
export function validateScriptTargets(
  script: string,
  allowedTargets: string[] | null
): void {
  // No restrictions - allow all
  if (allowedTargets === null) {
    return;
  }

  // Empty allowed list means no agents can be called
  if (allowedTargets.length === 0) {
    throw new Error('No agents are allowed to be called by current configuration.');
  }

  const requestedAgents = extractAgentNames(script);
  const allowedSet = new Set(allowedTargets);
  const disallowed: string[] = [];

  for (const agent of requestedAgents) {
    if (!allowedSet.has(agent)) {
      disallowed.push(agent);
    }
  }

  if (disallowed.length > 0) {
    throw new Error(
      `Agent(s) not allowed: ${disallowed.join(', ')}. ` +
      `Allowed agents: ${allowedTargets.join(', ')}`
    );
  }
}

/**
 * Filter a list of available agents by allowed targets
 *
 * @param agents - Full list of available agents
 * @param allowedTargets - List of allowed agent IDs, or null for no restrictions
 * @returns Filtered list of agents
 */
export function filterAgentsByTargets<T extends { id: string }>(
  agents: T[],
  allowedTargets: string[] | null
): T[] {
  // No restrictions - return all
  if (allowedTargets === null) {
    return agents;
  }

  // Filter by allowed targets
  const allowedSet = new Set(allowedTargets);
  return agents.filter((agent) => allowedSet.has(agent.id));
}
