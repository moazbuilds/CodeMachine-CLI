const path = require('node:path');

const promptsDir = path.join(__dirname, '..', 'prompts', 'templates');

module.exports = [
  // ========================================
  // Ali - CodeMachine Workflow Builder
  // ========================================
  {
    id: 'cm-workflow-builder',
    name: 'Ali | The CM Guy',
    description: 'CodeMachine workflow builder for creating agents, prompts, and workflows',
    promptPath: [
      path.join(promptsDir, 'ali', 'ali.md'),
      path.join(promptsDir, 'ali', 'workflow.md'),
      path.join(promptsDir, 'ali', 'chained', 'step-00-setup.md'),
    ],
    chainedPromptsPath: [
      {
        path: path.join(promptsDir, 'ali', 'chained', 'step-01-brainstorming.md'),
        conditionsAny: ['full-workflow', 'brainstorming'],
      },
      {
        path: path.join(promptsDir, 'ali', 'chained', 'step-02-workflow-definition.md'),
        conditionsAny: ['full-workflow', 'workflow-definition'],
      },
      {
        path: path.join(promptsDir, 'ali', 'chained', 'step-03-agents.md'),
        conditionsAny: ['full-workflow', 'agents'],
      },
      {
        path: path.join(promptsDir, 'ali', 'chained', 'step-04-prompts.md'),
        conditionsAny: ['full-workflow', 'prompts'],
      },
      {
        path: path.join(promptsDir, 'ali', 'chained', 'step-05-workflow-generation.md'),
        conditionsAny: ['full-workflow', 'workflow-generation'],
      },
    ],
  },
];
