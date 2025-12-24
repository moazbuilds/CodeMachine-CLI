import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';

// Mock the runner module to avoid calling the actual CCR CLI
mock.module('../../../src/infra/engines/providers/ccr/execution/runner.js', () => {
  return {
    runCcr: mock(() => Promise.resolve({ stdout: 'mocked output', stderr: '' })),
  };
});

import { runCcrPrompt } from '../../../src/infra/engines/providers/ccr/execution/executor.js';
import { runCcr } from '../../../src/infra/engines/providers/ccr/execution/runner.js';

describe('CCR Executor', () => {
  const mockAgentId = 'test-agent';
  const mockPrompt = 'test prompt for CCR';
  const mockCwd = '/tmp/test-dir';

  beforeEach(() => {
    // Clear any environment variables that might affect the tests
    delete process.env.CODEMACHINE_SKIP_CCR;
    // Clear mock call counts
    if (runCcr.mockClear) {
      runCcr.mockClear();
    }
  });

  afterEach(() => {
    // Bun automatically restores mocks
  });

  it('executes CCR prompt successfully', async () => {
    await runCcrPrompt({
      agentId: mockAgentId,
      prompt: mockPrompt,
      cwd: mockCwd,
    });

    expect(runCcr).toHaveBeenCalledTimes(1);
    expect(runCcr).toHaveBeenCalledWith({
      prompt: mockPrompt,
      workingDir: mockCwd,
      onData: expect.any(Function),
      onErrorData: expect.any(Function),
    });
  });

  it('executes CCR prompt with model parameter', async () => {
    await runCcrPrompt({
      agentId: mockAgentId,
      prompt: mockPrompt,
      cwd: mockCwd,
      model: 'sonnet',
    });

    expect(runCcr).toHaveBeenCalledTimes(1);
    expect(runCcr).toHaveBeenCalledWith({
      prompt: mockPrompt,
      workingDir: mockCwd,
      model: 'sonnet',
      onData: expect.any(Function),
      onErrorData: expect.any(Function),
    });
  });

  it('handles dry run mode', async () => {
    // Set dry run environment variable
    process.env.CODEMACHINE_SKIP_CCR = '1';

    // Spy on console.log to verify it's called with the dry run message
    const consoleSpy = spyOn(console, 'log').mockImplementation(() => {});

    await runCcrPrompt({
      agentId: mockAgentId,
      prompt: mockPrompt,
      cwd: mockCwd,
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[dry-run] test-agent: test prompt for CCR')
    );
  });

  it('handles stdout write errors gracefully', async () => {
    // Mock stdout write to throw an error
    const stdoutSpy = spyOn(process.stdout, 'write').mockImplementation(() => {
      throw new Error('stdout write error');
    });

    // Should not throw even if stdout write fails
    await runCcrPrompt({
      agentId: mockAgentId,
      prompt: mockPrompt,
      cwd: mockCwd,
    });

    expect(runCcr).toHaveBeenCalledTimes(1);
    stdoutSpy.mockRestore();
  });

  it('handles stderr write errors gracefully', async () => {
    // Mock stderr write to throw an error
    const stderrSpy = spyOn(process.stderr, 'write').mockImplementation(() => {
      throw new Error('stderr write error');
    });

    // Should not throw even if stderr write fails
    await runCcrPrompt({
      agentId: mockAgentId,
      prompt: mockPrompt,
      cwd: mockCwd,
    });

    expect(runCcr).toHaveBeenCalledTimes(1);
    stderrSpy.mockRestore();
  });
});