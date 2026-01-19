const path = require('node:path');

const promptsDir = path.join(__dirname, '..', 'prompts');

module.exports = [
  {
    id: 'auto-loop',
    name: 'Auto Loop',
    description: 'Simple auto loop module for testing - always signals to continue looping.',
    promptPath: path.join(promptsDir, 'templates', 'test-workflows', 'auto-loop.md'),
    behavior: {
      type: 'loop',
      action: 'stepBack',
    },
  },
  {
    id: 'test-loop',
    name: 'Test Loop Agent',
    description: 'Test agent with chained prompts that sets loop directive - for testing directive respect in Scenario 6.',
    promptPath: path.join(promptsDir, 'templates', 'test-workflows', 'test-loop-agent.md'),
    chainedPromptsPath: [
      path.join(promptsDir, 'templates', 'test-workflows', 'test-loop-chained', '01-check-state.xml'),
      path.join(promptsDir, 'templates', 'test-workflows', 'test-loop-chained', '02-ensure-loop.xml'),
    ],
    behavior: {
      type: 'loop',
      action: 'stepBack',
    },
  },
];
