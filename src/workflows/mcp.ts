/**
 * Workflow MCP Integration
 *
 * Configures MCP servers for engines before workflow execution.
 * This enables agents to use structured tool calls instead of text-based signals.
 */

import { registry } from '../infra/engines/index.js';
import { debug } from '../shared/logging/logger.js';
import type { WorkflowTemplate } from './templates/types.js';

/**
 * Get unique engine IDs used in a workflow template
 */
export function getWorkflowEngines(template: WorkflowTemplate): string[] {
  const engines = new Set<string>();
  const defaultEngine = registry.getDefault();

  for (const step of template.steps) {
    if (step.type === 'module') {
      const engineId = step.engine ?? defaultEngine?.metadata.id;
      if (engineId) {
        engines.add(engineId);
      }
    }
  }

  return Array.from(engines);
}

/**
 * Configure MCP servers for all engines used in a workflow
 *
 * Call this before running the workflow to ensure agents have access
 * to the workflow-signals MCP tools.
 */
export async function setupWorkflowMCP(
  template: WorkflowTemplate,
  workflowDir: string
): Promise<{ configured: string[]; failed: string[] }> {
  const engineIds = getWorkflowEngines(template);
  const configured: string[] = [];
  const failed: string[] = [];

  debug('[MCP] Setting up MCP for engines: %s', engineIds.join(', '));

  for (const engineId of engineIds) {
    const engine = registry.get(engineId);

    if (!engine) {
      debug('[MCP] Engine not found: %s', engineId);
      failed.push(engineId);
      continue;
    }

    if (!engine.mcp?.supported) {
      debug('[MCP] Engine does not support MCP: %s', engineId);
      continue; // Not a failure, just unsupported
    }

    if (!engine.mcp.configure) {
      debug('[MCP] Engine has no configure method: %s', engineId);
      continue;
    }

    try {
      await engine.mcp.configure(workflowDir);
      configured.push(engineId);
      debug('[MCP] Configured MCP for engine: %s', engineId);
    } catch (error) {
      debug('[MCP] Failed to configure MCP for engine %s: %s', engineId, (error as Error).message);
      failed.push(engineId);
    }
  }

  return { configured, failed };
}

/**
 * Clean up MCP servers after workflow completes
 */
export async function cleanupWorkflowMCP(
  template: WorkflowTemplate,
  workflowDir: string
): Promise<void> {
  const engineIds = getWorkflowEngines(template);

  debug('[MCP] Cleaning up MCP for engines: %s', engineIds.join(', '));

  for (const engineId of engineIds) {
    const engine = registry.get(engineId);

    if (!engine?.mcp?.cleanup) {
      continue;
    }

    try {
      await engine.mcp.cleanup(workflowDir);
      debug('[MCP] Cleaned up MCP for engine: %s', engineId);
    } catch (error) {
      debug('[MCP] Failed to cleanup MCP for engine %s: %s', engineId, (error as Error).message);
      // Ignore cleanup errors
    }
  }
}

/**
 * Check if MCP is configured for all engines in a workflow
 */
export async function isWorkflowMCPConfigured(
  template: WorkflowTemplate,
  workflowDir: string
): Promise<boolean> {
  const engineIds = getWorkflowEngines(template);

  for (const engineId of engineIds) {
    const engine = registry.get(engineId);

    if (!engine?.mcp?.supported) {
      continue; // Skip unsupported engines
    }

    if (!engine.mcp.isConfigured) {
      continue;
    }

    const configured = await engine.mcp.isConfigured(workflowDir);
    if (!configured) {
      return false;
    }
  }

  return true;
}
