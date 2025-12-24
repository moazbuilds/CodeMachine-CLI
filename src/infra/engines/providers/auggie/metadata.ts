import type { EngineMetadata } from '../../core/base.js';

export const metadata: EngineMetadata = {
  id: 'auggie',
  name: 'Auggie CLI',
  description: 'Authenticate with Auggie CLI (Augment Code)',
  cliCommand: 'auggie',
  cliBinary: 'auggie',
  installCommand: 'npm install -g @augmentcode/auggie',
  order: 6,
};

