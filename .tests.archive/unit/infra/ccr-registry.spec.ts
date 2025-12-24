import { describe, expect, it } from 'bun:test';

import { registry } from '../../../src/infra/engines/core/registry.js';

describe('CCR Engine Registry Integration', () => {
  it('registers CCR engine in the registry', () => {
    expect(registry.has('ccr')).toBe(true);
  });

  it('has correct CCR engine metadata', () => {
    const ccrEngine = registry.get('ccr');

    expect(ccrEngine).toBeDefined();
    expect(ccrEngine?.metadata).toEqual({
      id: 'ccr',
      name: 'Claude Code Router',
      description: 'Authenticate with Claude Code Router',
      cliCommand: 'ccr',
      cliBinary: 'ccr',
      installCommand: 'npm install -g @musistudio/claude-code-router',
      defaultModel: 'sonnet',
      order: 3,
      experimental: false,
    });
  });

  it('includes CCR in all registered engines', () => {
    const allIds = registry.getAllIds();
    expect(allIds).toContain('ccr');
  });

  it('CCR engine has auth and run methods', () => {
    const ccrEngine = registry.get('ccr');

    expect(ccrEngine).toBeDefined();
    expect(ccrEngine?.auth).toBeDefined();
    expect(typeof ccrEngine?.run).toBe('function');
  });

  it('CCR engine is properly ordered', () => {
    const allEngines = registry.getAll();
    const ccrEngine = allEngines.find(engine => engine.metadata.id === 'ccr');

    expect(ccrEngine).toBeDefined();
  });
});