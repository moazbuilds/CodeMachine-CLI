export default {
  name: 'Test2 Workflow',
  controller: controller('bmad-po', {}),
  steps: [
    // No filtering - always runs
    resolveStep('test-agent-1', { interactive: false } ),
    resolveStep('test-agent-1', { interactive: true } ),
    resolveStep('test-agent-2', { interactive: false } ),
    resolveStep('test-agent-2', { interactive: true } ),

    // Module with conditions
    resolveModule('auto-loop', { loopSteps: 2 }),

    // Test loop directive respect in Scenario 6
    // This module has chained prompts that set loop directive
    // After chained prompts complete, Scenario 6 should respect the loop directive
    resolveModule('test-loop', { interactive: false, loopSteps: 3 }),
  ],
  subAgentIds: ['frontend-dev'],
};
