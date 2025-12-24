import type { EngineMetadata } from '../../core/base.js';

export const metadata: EngineMetadata = {
  id: 'ccr',
  name: 'Claude Code Router',
  description: 'Authenticate with Claude Code Router',
  cliCommand: 'ccr',
  cliBinary: 'ccr',
  installCommand: 'npm install -g @musistudio/claude-code-router',
  defaultModel: 'sonnet',
  order: 7,
  experimental: false,
};