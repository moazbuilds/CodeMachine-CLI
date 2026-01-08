import type { EngineMetadata } from '../../core/base.js';

export const metadata: EngineMetadata = {
  id: 'copilot',
  name: 'GitHub Copilot',
  description: 'Use Copilot via GitHub device code authentication',
  cliCommand: 'copilot',
  cliBinary: '', // No CLI binary - uses direct API
  installCommand: 'No installation needed - authenticate with your GitHub account',
  defaultModel: 'gpt-4o',
  order: 2,
  experimental: false,
};
