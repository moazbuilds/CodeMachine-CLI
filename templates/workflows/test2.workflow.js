export default {
  name: 'Test2 Workflow',
  steps: [
    // No filtering - always runs
    resolveStep('test-agent-1'),

    // Human review checkpoint
    separator("❚❚ Human Review"),

    // Module with conditions
    resolveModule('auto-loop', { loopSteps: 2, loopMaxIterations: 5 }),
  ],
  subAgentIds: ['frontend-dev'],
};
