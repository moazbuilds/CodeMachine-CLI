const path = require('node:path');

module.exports = {
  // Paths relative to user's project directory
  userDir: {
    // Project specification document
    specifications: path.join('.codemachine', 'inputs', 'specifications.md'),
    architecture: path.join('.codemachine', 'artifacts', 'architecture', '*.md'),
    architecture_manifest_json: path.join('.codemachine', 'artifacts', 'architecture', 'architecture_manifest.json'),
    foundation: path.join('.codemachine', 'artifacts', 'architecture', '01_Blueprint_Foundation.md'),
    plan: path.join('.codemachine', 'artifacts', 'plan', '*.md'),
    plan_manifest_json: path.join('.codemachine', 'artifacts', 'plan', 'plan_manifest.json'),
    plan_fallback: path.join('.codemachine', 'prompts', 'plan_fallback.md'),
    tasks: path.join('.codemachine', 'artifacts', 'tasks.json'),
    all_tasks_json: path.join('.codemachine', 'artifacts', 'tasks', '*.json'),
    context: path.join('.codemachine', 'prompts', 'context.md'),
  },

  // Paths relative to codemachine package root
  packageDir: {
    context_output_format: path.join('prompts', 'templates', 'codemachine', 'output-formats', 'context-output.md'),
    smart_anchor: path.join('prompts', 'templates', 'codemachine', 'shared-instructions', 'smart-anchor.md'),
    command_constraints: path.join('prompts', 'templates', 'codemachine', 'shared-instructions', 'command-constraints.md'),
    atomic_generation: path.join('prompts', 'templates', 'codemachine', 'shared-instructions', 'atomic-generation.md'),
    error_escalation: path.join('prompts', 'templates', 'codemachine', 'shared-instructions', 'error-escalation.md'),
  }
};
