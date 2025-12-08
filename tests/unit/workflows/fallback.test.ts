import { describe, it, expect, vi, afterEach } from 'vitest';
import type { WorkflowStep } from '../../../src/workflows/templates/index.js';

const executeStepMock = vi.fn();

vi.mock('../../../src/workflows/execution/step.js', () => ({
  executeStep: (...args: unknown[]) => executeStepMock(...args),
}));

vi.mock('../../../src/workflows/utils/config.js', () => ({
  mainAgents: [
    {
      id: 'fallback-agent',
      name: 'Fallback Agent',
      promptPath: '/tmp/fallback.prompt',
    },
  ],
}));

import { executeFallbackStep } from '../../../src/workflows/execution/fallback.js';

describe('executeFallbackStep', () => {
  afterEach(() => {
    executeStepMock.mockReset();
  });

  it('passes abort signal through to executeStep', async () => {
    executeStepMock.mockResolvedValueOnce('ok');

    const controller = new AbortController();
    const step: WorkflowStep = {
      type: 'module',
      agentId: 'main-agent',
      agentName: 'Main Agent',
      promptPath: '/tmp/main.prompt',
      notCompletedFallback: 'fallback-agent',
      module: {
        id: ''
      },
    };

    await executeFallbackStep(step, '/tmp', Date.now(), 'claude', undefined, undefined, 'parent-agent', controller.signal);

    expect(executeStepMock).toHaveBeenCalledTimes(1);
    const callArgs = executeStepMock.mock.calls[0] as [
      WorkflowStep,
      string,
      { abortSignal?: AbortSignal; uniqueAgentId?: string }
    ];

    expect(callArgs[2].abortSignal).toBe(controller.signal);
    expect(callArgs[2].uniqueAgentId).toBe('fallback-agent');
  });
});
