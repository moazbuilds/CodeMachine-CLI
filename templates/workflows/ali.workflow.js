export default {
  name: 'CodeMachine Workflow Builder',
  autonomousMode: 'never',
  projectName: true,
  
  tracks: {
    question: 'What do you want to do?',
    options: {
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

  conditionGroups: [
    {
      id: 'workflow_scope',
      question: 'How do you want to build your workflow?',
      multiSelect: false,
      tracks: ['create-workflow', 'modify-workflow', 'have-questions'],
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
    resolveStep('cm-workflow-builder', {engine: 'claude'}),
  ],
};
