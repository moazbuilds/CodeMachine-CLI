const path = require('node:path');

module.exports = {
  // Paths relative to user's project directory
  userDir: {
    // BMAD workflow artifacts
    product_brief: path.join('.codemachine', 'artifacts', 'product-brief-*.md'),
    prd: path.join('.codemachine', 'artifacts', 'prd-*.md'),
    ux_design_spec: path.join('.codemachine', 'artifacts', 'ux-design-spec-*.md'),
    bmad_architecture: path.join('.codemachine', 'artifacts', 'architecture-*.md'),
    epics: path.join('.codemachine', 'artifacts', 'epics-*.md'),
  },

  // Paths relative to codemachine package root
  packageDir: {
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

    // Ali Workflow Builder shared files
    ali_step_completion: path.join('prompts', 'templates', 'ali', 'shared', 'step-completion.md'),
  }
};
