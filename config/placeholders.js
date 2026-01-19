const path = require('node:path');

module.exports = {
  // Paths relative to user's project directory
  userDir: {},

  // Paths relative to codemachine package root
  packageDir: {
    // Ali Workflow Builder shared files
    ali_step_completion: path.join('prompts', 'templates', 'ali', 'shared', 'step-completion.md'),
  }
};
