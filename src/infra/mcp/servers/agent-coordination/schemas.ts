/**
 * Agent Coordination MCP Server - Zod Schemas
 *
 * Runtime validation schemas for MCP tool inputs.
 */

import { z } from 'zod';

// ============================================================================
// INPUT SCHEMAS
// ============================================================================

/**
 * Schema for run_agents tool input
 */
export const RunAgentsSchema = z.object({
  script: z.string().min(1, 'script is required'),
  working_dir: z.string().optional(),
  timeout_ms: z
    .number()
    .int()
    .min(1000)
    .max(3600000)
    .optional()
    .default(600000), // 10 minutes default
});

export type RunAgentsInput = z.infer<typeof RunAgentsSchema>;

/**
 * Schema for get_agent_status tool input
 */
export const GetAgentStatusSchema = z.object({
  agent_id: z.number().int().positive().optional(),
  name: z.string().optional(),
  status: z
    .array(z.enum(['running', 'completed', 'failed', 'paused', 'skipped']))
    .optional(),
  limit: z.number().int().min(1).max(100).optional().default(10),
});

export type GetAgentStatusInput = z.infer<typeof GetAgentStatusSchema>;

/**
 * Schema for list_available_agents tool input
 */
export const ListAvailableAgentsSchema = z.object({
  working_dir: z.string().optional(),
});

export type ListAvailableAgentsInput = z.infer<typeof ListAvailableAgentsSchema>;

// ============================================================================
// RESULT SCHEMAS (for documentation/validation)
// ============================================================================

/**
 * Schema for a single agent execution result
 */
export const AgentResultSchema = z.object({
  name: z.string(),
  agentId: z.number(),
  success: z.boolean(),
  prompt: z.string().optional(),
  input: z.array(z.string()).optional(),
  output: z.string().optional(),
  error: z.string().optional(),
  tailApplied: z.number().optional(),
});

export type AgentResult = z.infer<typeof AgentResultSchema>;

/**
 * Schema for coordination execution result
 */
export const ExecutionResultSchema = z.object({
  success: z.boolean(),
  parentId: z.number().optional(),
  results: z.array(AgentResultSchema),
  duration_ms: z.number(),
});

export type ExecutionResult = z.infer<typeof ExecutionResultSchema>;
