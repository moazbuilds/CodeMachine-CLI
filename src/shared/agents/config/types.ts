export type AgentDefinition = {
  id: string;
  model?: unknown;
  modelReasoningEffort?: unknown;
  model_reasoning_effort?: unknown;
  engine?: string; // Engine to use for this agent (dynamically determined from registry)
  chainedPromptsPath?: string; // Path to folder containing chained prompt .md files
  [key: string]: unknown;
};

export const AGENT_MODULE_FILENAMES = ['main.agents.js', 'sub.agents.js', 'modules.js', 'agents.js'];
