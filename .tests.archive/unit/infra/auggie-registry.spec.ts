import { describe, expect, it } from 'vitest';

import { registry } from '../../../src/infra/engines/core/registry.js';

describe('Auggie Engine Registry Integration', () => {
  it('registers Auggie engine in the registry', () => {
    expect(registry.has('auggie')).toBe(true);
  });

  it('has correct Auggie engine metadata', () => {
    const auggieEngine = registry.get('auggie');

    expect(auggieEngine).toBeDefined();
    expect(auggieEngine?.metadata).toEqual({
      id: 'auggie',
      name: 'Auggie CLI',
      description: 'Authenticate with Auggie CLI (Augment Code)',
      cliCommand: 'auggie',
      cliBinary: 'auggie',
      installCommand: 'npm install -g @augmentcode/auggie',
      order: 5,
    });
  });

  it('includes Auggie in all registered engines', () => {
    const allIds = registry.getAllIds();
    expect(allIds).toContain('auggie');
  });

  it('Auggie engine has auth and run methods', () => {
    const auggieEngine = registry.get('auggie');

    expect(auggieEngine).toBeDefined();
    expect(auggieEngine?.auth).toBeDefined();
    expect(typeof auggieEngine?.run).toBe('function');
  });

  it('Auggie engine is properly ordered', () => {
    const allEngines = registry.getAll();
    const auggieEngine = allEngines.find(engine => engine.metadata.id === 'auggie');

    expect(auggieEngine).toBeDefined();
    expect(auggieEngine?.metadata.order).toBe(5);
  });
});

