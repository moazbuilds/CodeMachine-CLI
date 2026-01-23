import type { EngineMetadata } from '../../core/base.js';

export const metadata: EngineMetadata = {
  id: 'opencode',
  name: 'OpenCode',
  description: 'Authenticate with OpenCode CLI',
  cliCommand: 'opencode',
  cliBinary: 'opencode',
  installCommand: 'npm i -g opencode-ai@latest',
  defaultModel: 'opencode/big-pickle',
  order: 1,
};
