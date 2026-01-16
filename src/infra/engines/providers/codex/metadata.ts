import type { EngineMetadata } from '../../core/base.js';

export const metadata: EngineMetadata = {
  id: 'codex',
  name: 'Codex',
  description: 'Authenticate with Codex AI',
  cliCommand: 'codex',
  cliBinary: 'codex',
  installCommand: 'npm install -g @openai/codex',
  defaultModel: 'gpt-5.2-codex',
  defaultModelReasoningEffort: 'medium',
  order: 3,
};
