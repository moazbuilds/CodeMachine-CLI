import type { EngineMetadata } from '../../core/base.js';

export const metadata: EngineMetadata = {
  id: 'mistral',
  name: 'Mistral Vibe',
  description: 'Authenticate with Mistral AI',
  cliCommand: 'vibe',
  cliBinary: 'vibe',
  installCommand: 'uv tool install mistral-vibe',
  defaultModel: 'devstral-2',
  order: 0,
  experimental: true,
};

