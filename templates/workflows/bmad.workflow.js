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
    resolveStep('bmad-analyst', {engine: 'codex'}),
    resolveStep('bmad-pm', {engine: 'codex'}),
    resolveStep('bmad-ux', {engine: 'codex', conditions: ['has_ui']}),
    resolveStep('bmad-architect', {engine: 'codex'}),
    resolveStep('bmad-epics', {engine: 'codex'}),
    resolveStep('bmad-sprints', {engine: 'codex'}),
  ],
};
