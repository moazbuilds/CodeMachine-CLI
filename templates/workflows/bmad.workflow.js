export default {
  name: 'BMAD Method',
  controller: true,

  tracks: {
    question: 'What is your project size? (only greenfield is tested)',
    options: {
      small: {
        label: 'Small Project',
        description: 'Quick start with minimal planning overhead'
      },
      medium: {
        label: 'Medium Project',
        description: 'Balanced approach with optional research phase'
      },
      enterprise: {
        label: 'Enterprise Project',
        description: 'Full methodology with comprehensive analysis'
      },
    },
  },

  conditionGroups: [
    {
      id: 'research_options',
      question: 'What research approach do you prefer?',
      multiSelect: false,
      tracks: ['medium', 'enterprise'], // Only show for medium/enterprise tracks
      conditions: {
        know_project: {
          label: 'I know my project',
          description: 'Skip research phase - I have clear requirements ready'
        },
        use_analyst: {
          label: 'Use Analyst',
          description: 'Let the analyst research and gather requirements'
        },
      },
    },
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
    resolveStep('bmad-analyst', {conditions: ['use_analyst']}),
    separator("∴ Planning Phase ∴"),
    resolveStep('bmad-pm', {}),
    resolveStep('bmad-ux', {conditions: ['has_ui']}),
    separator("∴ Solutioning Phase ∴"),
    resolveStep('bmad-architect', {}),
    resolveStep('bmad-epics', {}),
    separator("∴ Implementation Phase ∴"),
    resolveStep('bmad-sprints', {}),
    separator("⟲ Story Loop ⟲"),
    resolveStep('bmad-stories', {}),
    resolveStep('bmad-dev', {}),
    resolveStep('bmad-review', {}),

  ],
};
