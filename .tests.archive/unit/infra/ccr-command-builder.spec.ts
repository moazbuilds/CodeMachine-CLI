import { describe, expect, it } from 'bun:test';

import { buildCcrExecCommand } from '../../../src/infra/engines/providers/ccr/execution/commands.js';

describe('CCR Command Builder', () => {
  it('builds basic CCR command with required args', () => {
    const command = buildCcrExecCommand({
      model: undefined,
    });

    expect(command).toEqual({
      command: 'ccr',
      args: [
        'code',
        '--print',
        '--output-format',
        'stream-json',
        '--verbose',
        '--dangerously-skip-permissions',
        '--permission-mode',
        'bypassPermissions',
      ],
    });
  });

  it('includes model when specified', () => {
    const command = buildCcrExecCommand({
      model: 'sonnet',
    });

    expect(command).toEqual({
      command: 'ccr',
      args: [
        'code',
        '--print',
        '--output-format',
        'stream-json',
        '--verbose',
        '--dangerously-skip-permissions',
        '--permission-mode',
        'bypassPermissions',
        '--model',
        'sonnet',
      ],
    });
  });

  it('includes different models when specified', () => {
    const command = buildCcrExecCommand({
      model: 'opus',
    });

    expect(command).toEqual({
      command: 'ccr',
      args: [
        'code',
        '--print',
        '--output-format',
        'stream-json',
        '--verbose',
        '--dangerously-skip-permissions',
        '--permission-mode',
        'bypassPermissions',
        '--model',
        'opus',
      ],
    });
  });

  it('handles unknown models gracefully', () => {
    const command = buildCcrExecCommand({
      model: 'unknown-model',
    });

    expect(command).toEqual({
      command: 'ccr',
      args: [
        'code',
        '--print',
        '--output-format',
        'stream-json',
        '--verbose',
        '--dangerously-skip-permissions',
        '--permission-mode',
        'bypassPermissions',
      ],
    });
  });

  it('handles undefined model gracefully', () => {
    const command = buildCcrExecCommand({
      model: undefined,
    });

    expect(command).toEqual({
      command: 'ccr',
      args: [
        'code',
        '--print',
        '--output-format',
        'stream-json',
        '--verbose',
        '--dangerously-skip-permissions',
        '--permission-mode',
        'bypassPermissions',
      ],
    });
  });
});