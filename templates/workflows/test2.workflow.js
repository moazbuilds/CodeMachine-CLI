export default {
  name: 'Test2 Workflow',
  controller: true,
  steps: [
    // No filtering - always runs
    resolveStep('test-agent-1', { interactive: false } ),
    resolveStep('test-agent-1', { interactive: true } ),
    resolveStep('test-agent-2', { interactive: false } ),
    resolveStep('test-agent-2', { interactive: true } ),

    // Module with conditions
    resolveModule('auto-loop', { loopSteps: 2 }),
  ],
  subAgentIds: ['frontend-dev'],
};
