// Unused import removed

import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';

import * as spawnModule from '../../../src/infra/process/spawn.js';
import { runCodex } from '../../../src/infra/engines/providers/codex/execution/runner.js';

describe('Engine Runner', () => {
  const workingDir = '/tmp/workspace/project';

  beforeEach(() => {
    // Clear all mocks before each test
    mock.restore();
  });

  afterEach(() => {
    mock.restore();
  });

  it('runs the engine CLI and returns stdout', async () => {
    const spawnSpy = spyOn(spawnModule, 'spawnProcess').mockResolvedValue({
      exitCode: 0,
      stdout: 'engine output',
      stderr: '',
    });

    const result = await runCodex({
      prompt: 'Hello Engine',
      workingDir,
      env: { CUSTOM: 'value' },
    });

    expect(result).toEqual({ stdout: 'engine output', stderr: '' });
    expect(spawnSpy).toHaveBeenCalledTimes(1);

    const callOptions = spawnSpy.mock.calls[0]?.[0];
    expect(callOptions?.command).toBe('codex');
    expect(callOptions?.args).toEqual([
      'exec',
      '--json',
      '--skip-git-repo-check',
      '--sandbox',
      'danger-full-access',
      '--dangerously-bypass-approvals-and-sandbox',
      '-C',
      workingDir,
      '-',
    ]);
    expect(callOptions?.cwd).toBe(workingDir);
    expect(callOptions?.env).toMatchObject({ CUSTOM: 'value', CODEX_HOME: expect.any(String) });
    expect(callOptions?.stdinInput).toBe('Hello Engine');
    expect(callOptions?.onStdout).toBeTypeOf('function');
    expect(callOptions?.onStderr).toBeTypeOf('function');
    expect(callOptions?.signal).toBeUndefined();
    expect(callOptions?.stdioMode).toBe('pipe');
    expect(callOptions?.timeout).toBe(1800000);
  });

  it('throws when the engine CLI exits with a non-zero status code', async () => {
    spyOn(spawnModule, 'spawnProcess').mockResolvedValue({
      exitCode: 2,
      stdout: '',
      stderr: 'fatal: unable to launch',
    });

    await expect(
      runCodex({
        prompt: 'Trigger failure',
        workingDir,
      }),
    ).rejects.toThrow(/CLI exited with code 2/);
  });

  it('forwards stdout and stderr chunks through the streaming callbacks', async () => {
    const spawnSpy = spyOn(spawnModule, 'spawnProcess').mockImplementation(async (options) => {
      options.onStdout?.(
        JSON.stringify({
          type: 'item.completed',
          item: { type: 'agent_message', text: 'All tasks done' },
        }) + '\n',
      );
      options.onStderr?.('error-chunk');
      return {
        exitCode: 0,
        stdout: 'final output',
        stderr: 'final error output',
      };
    });

    const handleData = mock();
    const handleError = mock();

    const result = await runCodex({
      prompt: 'Stream please',
      workingDir,
      onData: handleData,
      onErrorData: handleError,
    });

    expect(handleData).toHaveBeenCalledWith('[GRAY]* All tasks done\n');
    expect(handleError).toHaveBeenCalledWith('error-chunk');
    expect(result).toEqual({ stdout: 'final output', stderr: 'final error output' });
    expect(spawnSpy).toHaveBeenCalledTimes(1);
  });
});
