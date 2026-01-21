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
      path.join(promptsDir, 'ali', 'chained', 'step-01-brainstorming.md'),
    ],
    chainedPromptsPath: [
      {
        path: path.join(promptsDir, 'ali', 'chained', 'step-02-workflow-definition.md'),
        conditions: ['workflow-definition'],
      },
      {
        path: path.join(promptsDir, 'ali', 'chained', 'step-03-agents.md'),
        conditions: ['agents'],
      },
      {
        path: path.join(promptsDir, 'ali', 'chained', 'step-04-prompts.md'),
        conditions: ['prompts'],
      },
      {
        path: path.join(promptsDir, 'ali', 'chained', 'step-05-workflow-generation.md'),
        conditions: ['workflow-generation'],
      },
    ],
  },

  // Test agents
  {
    id: 'test-agent-1',
    name: 'Test Agent 1',
    description: 'First test agent for workflow testing',
    promptPath: path.join(promptsDir, 'test-workflows', 'test-agent-1.md'),
    chainedPromptsPath: path.join(promptsDir, 'test-workflows', 'test-agent-1-chained'),
  },
  {
    id: 'test-agent-2',
    name: 'Test Agent 2',
    description: 'Second test agent for workflow testing',
    promptPath: path.join(promptsDir, 'test-workflows', 'test-agent-2.md'),
  },
  {
    id: 'test-agent-3',
    name: 'Test Agent 3',
    description: 'Third test agent for workflow testing',
    promptPath: path.join(promptsDir, 'test-workflows', 'test-agent-3.md'),
  },
];
