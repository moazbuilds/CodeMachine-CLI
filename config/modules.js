const path = require('node:path');

const promptsDir = path.join(__dirname, '..', 'prompts');

module.exports = [
  // BMAD code review module with loop behavior
  {
    id: 'bmad-review',
    name: 'Amelia [Dev: Review]',
    description: 'BMAD Developer for code review',
    promptPath: [
      path.join(promptsDir, 'templates', 'bmad', 'shared', 'system-files-protection.md'),
      path.join(promptsDir, 'templates', 'bmad', '07-dev', 'amelia.md'),
      path.join(promptsDir, 'templates', 'bmad', '07-dev', '02-code-review', 'instructions.xml'),
      path.join(promptsDir, 'templates', 'bmad', '07-dev', '02-code-review', 'checklist.md'),
    ],
    behavior: {
      type: 'loop',
      action: 'stepBack',
    },
  },
  {
    id: 'check-task',
    name: 'Task Loop Checker',
    description: 'Validates that all tasks are completed and signals whether to repeat workflow steps.',
    promptPath: path.join(promptsDir, 'templates', 'codemachine', 'workflows', 'task-verification-workflow.md'),
    behavior: {
      type: 'loop',
      action: 'stepBack',
    },
  },
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
];
