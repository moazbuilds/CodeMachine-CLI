export default {
  name: 'CodeMachine Workflow Builder',
  autonomousMode: 'never',
  projectName: true,

  tracks: {
    question: 'Choose your workflow building mode:',
    options: {
      'expert': {
        label: 'Expert Mode',
        description: 'For complex or custom workflows'
      },
      'quick': {
        label: 'Quick Mode',
        description: 'Speed over customization'
      },
    },
  },

  conditionGroups: [
    {
      id: 'workflow_action',
      question: 'What do you want to do?',
      multiSelect: false,
      tracks: ['quick', 'expert'],
      conditions: {
        'create-workflow': {
          label: 'Create Workflow',
          description: 'Build a new workflow from scratch'
        },
        'modify-workflow': {
          label: 'Modify Workflow',
          description: 'Edit or update an existing workflow'
        },
        'have-questions': {
          label: 'Have Questions',
          description: 'Ask questions about workflows or get help'
        },
      },
    },
    {
      id: 'workflow_scope',
      question: 'How do you want to build your workflow?',
      multiSelect: false,
      tracks: ['expert'],
      conditions: {
        'full-workflow': {
          label: 'Full Workflow',
          description: 'Complete workflow with all phases'
        },
        'select-parts': {
          label: 'Select Parts',
          description: 'Choose specific phases to focus on'
        },
      },
      children: {
        'select-parts': {
          question: 'What areas do you want to focus on?',
          multiSelect: true,
          conditions: {
            brainstorming: {
              label: 'Brainstorming',
              description: 'Optional creative exploration and idea generation'
            },
            'workflow-definition': {
              label: 'Workflow Definition',
              description: 'Define workflow name, tracks, conditions, and autonomous mode'
            },
            agents: {
              label: 'Agents',
              description: 'Configure main agents, sub-agents, modules, and controller'
            },
            prompts: {
              label: 'Prompts',
              description: 'Create and configure agent prompts and placeholders'
            },
            'workflow-generation': {
              label: 'Workflow Generation',
              description: 'Generate final workflow files and validate configuration'
            },
          },
        },
      },
    },
  ],

  steps: [
    // Quick Mode - one-step build
    resolveStep('cm-workflow-builder-quick', {
      engine: 'claude',
      tracks: ['quick'],
    }),

    // Expert Mode - guided 5-step process
    resolveStep('cm-workflow-builder', {
      engine: 'claude',
      tracks: ['expert'],
    }),
  ],
};
