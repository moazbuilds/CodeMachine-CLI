/**
 * Conditional chained prompt path entry
 */
export type ConditionalChainedPath = {
  path: string;
  conditions?: string[];
};

/**
 * Single chained prompt path entry - string or conditional object
 */
export type ChainedPathEntry = string | ConditionalChainedPath;

export type AgentDefinition = {
  id: string;
  model?: unknown;
  modelReasoningEffort?: unknown;
  model_reasoning_effort?: unknown;
  engine?: string; // Engine to use for this agent (dynamically determined from registry)
  chainedPromptsPath?: ChainedPathEntry | ChainedPathEntry[]; // Path(s) to folder(s) containing chained prompt .md files
  role?: 'controller'; // Agent role - 'controller' agents can drive autonomous mode
  [key: string]: unknown;
};

export const AGENT_MODULE_FILENAMES = ['main.agents.js', 'sub.agents.js', 'modules.js', 'agents.js'];
