/**
 * Agent Coordination MCP Server - Tool Definitions
 *
 * Defines the MCP tools for agent execution and status queries.
 * These tools use JSON Schema for validation (MCP standard).
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';

/**
 * Tool: run_agents
 *
 * Execute codemachine agents using coordination script syntax.
 * Supports single agents, parallel execution (&), and sequential execution (&&).
 */
export const runAgentsTool: Tool = {
  name: 'run_agents',
  description: `Execute codemachine agent(s) using coordination script syntax.

Script Examples:
- Single agent: "code-generator 'Build login feature'"
- With input files: "system-analyst[input:spec.md,tail:100] 'analyze'"
- Parallel execution: "frontend 'UI' & backend 'API'"
- Sequential execution: "db 'setup' && backend 'models'"
- Mixed: "db 'setup' && frontend 'build' & backend 'build'"

Returns structured results with success/failure status, agent IDs, and outputs.
Long-running agents may take several minutes to complete.`,
  inputSchema: {
    type: 'object',
    properties: {
      script: {
        type: 'string',
        description: 'Agent coordination script to execute',
        minLength: 1,
      },
      working_dir: {
        type: 'string',
        description: 'Working directory for agent execution (defaults to current directory)',
      },
      timeout_ms: {
        type: 'number',
        description: 'Execution timeout in milliseconds (default: 600000 = 10 minutes)',
        minimum: 1000,
        maximum: 3600000,
      },
    },
    required: ['script'],
  },
};

/**
 * Tool: get_agent_status
 *
 * Query status of codemachine agents by ID, name, or status filters.
 */
export const getAgentStatusTool: Tool = {
  name: 'get_agent_status',
  description: `Query status of codemachine agents.

Use to check on specific agents by ID, filter by name/status, or get recent agent history.
Returns agent records including status, timing, telemetry, and error information.`,
  inputSchema: {
    type: 'object',
    properties: {
      agent_id: {
        type: 'number',
        description: 'Specific agent ID to retrieve',
      },
      name: {
        type: 'string',
        description: 'Filter by agent name',
      },
      status: {
        type: 'array',
        items: {
          type: 'string',
          enum: ['running', 'completed', 'failed', 'paused', 'skipped'],
        },
        description: 'Filter by status(es)',
      },
      limit: {
        type: 'number',
        description: 'Maximum results to return (default: 10, max: 100)',
        minimum: 1,
        maximum: 100,
      },
    },
  },
};

/**
 * Tool: list_active_agents
 *
 * Quick check for currently running agents.
 */
export const listActiveAgentsTool: Tool = {
  name: 'list_active_agents',
  description: `List all currently running agents.

Quick way to see what agents are actively executing.
Returns agent records for all agents with status 'running'.`,
  inputSchema: {
    type: 'object',
    properties: {},
    additionalProperties: false,
  },
};

/**
 * Tool: list_available_agents
 *
 * Discover all available agent names that can be executed.
 */
export const listAvailableAgentsTool: Tool = {
  name: 'list_available_agents',
  description: `List all available codemachine agents that can be executed.

Returns the catalog of agent definitions discovered from:
- Main agent configs (main.agents.js)
- Sub-agent configs (sub.agents.js)
- Workflow templates

Use this to discover valid agent names before calling run_agents.
Each agent entry includes: id (the name to use), and optional metadata (model, engine, role).`,
  inputSchema: {
    type: 'object',
    properties: {
      working_dir: {
        type: 'string',
        description: 'Working directory to resolve agents from (defaults to current directory)',
      },
    },
    additionalProperties: false,
  },
};

/**
 * All agent coordination tools
 */
export const agentCoordinationTools: Tool[] = [
  runAgentsTool,
  getAgentStatusTool,
  listActiveAgentsTool,
  listAvailableAgentsTool,
];

/**
 * Get tool by name
 */
export function getToolByName(name: string): Tool | undefined {
  return agentCoordinationTools.find((t) => t.name === name);
}
