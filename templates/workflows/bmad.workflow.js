export default {
  name: 'BMAD Method',
  controller: true,
  specification: true,

  tracks: {
    question: 'What is your project size?',
    options: {
      medium: {
        label: 'Medium Project',
        description: 'Balanced approach for greenfield projects'
      },
    },
  },

  conditionGroups: [
    {
      id: 'features',
      question: 'What features does your project have?',
      multiSelect: true,
      conditions: {
        has_ui: {
          label: 'Has UI',
          description: 'Project includes a user interface'
        },
      },
    },
  ],

  steps: [
    separator("∴ Planning Phase ∴"),
    resolveStep('bmad-pm', {}),
    resolveStep('bmad-ux', {conditions: ['has_ui']}),
    separator("∴ Solutioning Phase ∴"),
    resolveStep('bmad-architect', {}),
    resolveStep('bmad-epics', {}),
    separator("∴ Implementation Phase ∴"),
    resolveStep('bmad-sprints', {}),
    separator("⟲ Story Loop ⟲"),
    resolveStep('bmad-stories', {interactive: false}),
    resolveStep('bmad-dev', {interactive: false}),
    resolveModule('bmad-review', {interactive: false, loopSteps: 2 }),
  ],
};
