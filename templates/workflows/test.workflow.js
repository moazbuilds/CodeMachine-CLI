export default {
  name: 'Test Workflow',
  steps: [
    resolveStep('test-agent-1', { engine: 'codex' }),
    resolveStep('test-agent-2', { engine: 'codex' }),
    resolveUI("❚❚ Human Review"),
    resolveStep('test-agent-3', { engine: 'codex' }),
    resolveModule('auto-loop', { engine: 'codex', loopSteps: 3, loopMaxIterations: 5 }),
  ],
  subAgentIds: ['frontend-dev'],
};
