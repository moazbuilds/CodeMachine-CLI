export default {
  name: 'BMAD Method',
  controller: true,

  conditions: {
    has_ui: {
      label: 'Has UI',
      description: 'Project includes a user interface'
    },
  },

  steps: [
    resolveStep('bmad-analyst', {model: 'opencode/grok-code'}),
    resolveStep('bmad-pm', {model: 'opencode/grok-code'}),
    resolveStep('bmad-ux', {model: 'opencode/grok-code', conditions: ['has_ui']}),
    resolveStep('bmad-architect', {model: 'opencode/grok-code'}),
    resolveStep('bmad-epics', {model: 'opencode/grok-code'}),
  ],
};
