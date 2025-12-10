export default {
  name: 'Test Workflow',
  tracks: {
    quick: {
      label: 'Small Project',
      description: 'Fast iteration, minimal documentation'
    },
    bmad: {
      label: 'Enterprise',
      description: 'Full BMAD methodology with all phases'
    },
  },
  conditions: {
    has_ui: {
      label: 'Has UI',
      description: 'Project includes a user interface'
    },
    has_api: {
      label: 'Has API',
      description: 'Project includes backend API'
    },
  },
  steps: [
    resolveStep('test-agent-1'),                                  // No tracks/conditions = runs always
    resolveStep('test-agent-2', { tracks: ['bmad', 'quick'] }),                // Only in bmad track
    resolveUI("❚❚ Human Review"),
    resolveStep('test-agent-3', { tracks: ['quick'], conditions: ['has_ui'] }), // Quick track + has_ui
    resolveModule('auto-loop', { loopSteps: 3, loopMaxIterations: 5, conditions: ['has_api'] }), // Only if has_api
  ],
  subAgentIds: ['frontend-dev'],
};
