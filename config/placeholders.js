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

    // BMAD workflow artifacts
    product_brief: path.join('.codemachine', 'artifacts', 'product-brief-*.md'),
    prd: path.join('.codemachine', 'artifacts', 'prd-*.md'),
    ux_design_spec: path.join('.codemachine', 'artifacts', 'ux-design-spec-*.md'),
    bmad_architecture: path.join('.codemachine', 'artifacts', 'architecture-*.md'),
    epics: path.join('.codemachine', 'artifacts', 'epics-*.md'),
  },

  // Paths relative to codemachine package root
  packageDir: {
    context_output_format: path.join('prompts', 'templates', 'codemachine', 'output-formats', 'context-output.md'),
    smart_anchor: path.join('prompts', 'templates', 'codemachine', 'shared-instructions', 'smart-anchor.md'),
    command_constraints: path.join('prompts', 'templates', 'codemachine', 'shared-instructions', 'command-constraints.md'),
    atomic_generation: path.join('prompts', 'templates', 'codemachine', 'shared-instructions', 'atomic-generation.md'),
    error_escalation: path.join('prompts', 'templates', 'codemachine', 'shared-instructions', 'error-escalation.md'),

    // BMAD PRD workflow shared files
    domain_complexity: path.join('prompts', 'templates', 'bmad', '02-pm', '01-prd', 'shared', 'domain-complexity.csv'),
    project_types: path.join('prompts', 'templates', 'bmad', '02-pm', '01-prd', 'shared', 'project-types.csv'),
    prd_template: path.join('prompts', 'templates', 'bmad', '02-pm', '01-prd', 'shared', 'prd-template.md'),

    // BMAD TEA workflow shared files
    test_design_template: path.join('prompts', 'templates', 'bmad', '05-tea', '01-test-design', 'test-design-template.md'),

    // BMAD SM workflow shared files
    sprint_status_template: path.join('prompts', 'templates', 'bmad', '06-sm', '01-sprint-planning', 'sprint-status-template.yaml'),
    story_template: path.join('prompts', 'templates', 'bmad', '06-sm', '02-create-story', 'template.md'),
    story_checklist: path.join('prompts', 'templates', 'bmad', '06-sm', '02-create-story', 'checklist.md'),

    // BMAD shared step rules
    step_completion: path.join('prompts', 'templates', 'bmad', 'shared', 'step-completion.md'),

    // BMAD PO controller workflow
    po_workflow: path.join('prompts', 'templates', 'bmad', 'controller', 'workflow.md'),
  }
};
