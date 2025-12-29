const path = require('node:path');

const promptsDir = path.join(__dirname, '..', 'prompts', 'templates');

module.exports = [
  // Codemachine main agents
  {
    id: 'init',
    name: 'Init',
    description: 'Initializes codemachine development environment (creates branch and updates .gitignore)',
    promptPath: path.join(promptsDir, 'codemachine', 'main-agents', '00-init.md'),
  },
  {
    id: 'principal-analyst',
    name: 'Analyst Checkpoint',
    description: 'Reviews project specifications and identifies critical ambiguities requiring clarification',
    promptPath: path.join(promptsDir, 'codemachine', 'main-agents', '01-principal-analyst.md'),
  },
  {
    id: 'blueprint-orchestrator',
    name: 'Blueprint Orchestrator',
    description: 'Orchestrates the execution of Foundation, Structural-Data, Behavior, and Ops-Docs architects with resilience and resumability',
    promptPath: path.join(promptsDir, 'codemachine', 'main-agents', '02-blueprint-orchestrator.md'),
  },
  {
    id: 'plan-agent',
    name: 'Plan Agent',
    description: 'Analyzes requirements and generates comprehensive iterative development plans with architectural artifacts',
    promptPath: path.join(promptsDir, 'codemachine', 'main-agents', '03-planning-agent.md'),
  },
  {
    id: 'task-breakdown',
    name: 'Task Breakdown Agent',
    description: 'Extracts and structures tasks from project plans into JSON format',
    promptPath: path.join(promptsDir, 'codemachine', 'main-agents', '04-task-breakdown-agent.md'),
  },
  {
    id: 'context-manager',
    name: 'Context Manager Agent',
    description: 'Gathers and prepares relevant context from architecture, plan, and codebase for task execution',
    promptPath: path.join(promptsDir, 'codemachine', 'main-agents', '05-context-manager-agent.md'),
  },
  {
    id: 'code-generation',
    name: 'Code Generation Agent',
    description: 'Generates code implementation based on task specifications and design artifacts',
    promptPath: path.join(promptsDir, 'codemachine', 'main-agents', '06-code-generation-agent.md'),
  },
  {
    id: 'task-sanity-check',
    name: 'Task Reviewer',
    description: 'Verifies generated code against task requirements and acceptance criteria',
    promptPath: path.join(promptsDir, 'codemachine', 'main-agents', '07-task-validation-agent.md'),
  },
  {
    id: 'runtime-prep',
    name: 'Runtime Prep',
    description: 'Generates robust shell scripts for project automation (install, run, lint, test)',
    promptPath: path.join(promptsDir, 'codemachine', 'main-agents', '08-runtime-preparation-agent.md'),
  },
  {
    id: 'git-commit',
    name: 'Git Commit Agent',
    description: 'Handles git commit operations and commit message generation',
    promptPath: path.join(promptsDir, 'codemachine', 'workflows', 'git-commit-workflow.md'),
  },
  {
    id: 'plan-fallback',
    name: 'Plan Fallback Agent',
    description: 'Fixes and validates plan generation issues when plan-agent fails',
    promptPath: path.join(promptsDir, 'codemachine', 'fallback-agents', 'planning-fallback.md'),
  },

  // BMAD controller (Product Owner)
  {
    id: 'bmad-po',
    name: 'Hakem [PO]',
    description: 'BMAD product owner controller for autonomous mode',
    role: 'controller',
    promptPath: [
      path.join(promptsDir, 'bmad', 'shared', 'system-files-protection.md'),
      path.join(promptsDir, 'bmad', 'controller', 'PO.md'),
    ],
  },

  // BMAD agents
  {
    id: 'bmad-analyst',
    name: 'Mary [Analyst]',
    description: 'BMAD business analyst for collaborative product discovery',
    promptPath: [
      path.join(promptsDir, 'bmad', 'shared', 'system-files-protection.md'),
      path.join(promptsDir, 'bmad', '01-analyst', 'mary.md'),
      path.join(promptsDir, 'bmad', '01-analyst', 'workflow.md'),
      path.join(promptsDir, 'bmad', '01-analyst', 'chained', 'step-01-vision.md'),
    ],
    chainedPromptsPath: [
      path.join(promptsDir, 'bmad', '01-analyst', 'chained', 'step-02-users.md'),
      path.join(promptsDir, 'bmad', '01-analyst', 'chained', 'step-03-metrics.md'),
      path.join(promptsDir, 'bmad', '01-analyst', 'chained', 'step-04-scope.md'),
      path.join(promptsDir, 'bmad', '01-analyst', 'chained', 'step-05-complete.md'),
    ],
  },
  {
    id: 'bmad-pm',
    name: 'John [PM: PRD]',
    description: 'BMAD product manager for PRD creation workflow',
    promptPath: [
      path.join(promptsDir, 'bmad', 'shared', 'system-files-protection.md'),
      path.join(promptsDir, 'bmad', '02-pm', 'john.md'),
      path.join(promptsDir, 'bmad', '02-pm', '01-prd', 'workflow.md'),
      path.join(promptsDir, 'bmad', '02-pm', '01-prd', 'chained', 'step-01-discovery.md'),
    ],
    chainedPromptsPath: [
      path.join(promptsDir, 'bmad', '02-pm', '01-prd', 'chained', 'step-02-success.md'),
      path.join(promptsDir, 'bmad', '02-pm', '01-prd', 'chained', 'step-03-journeys.md'),
      path.join(promptsDir, 'bmad', '02-pm', '01-prd', 'chained', 'step-04-domain.md'),
      path.join(promptsDir, 'bmad', '02-pm', '01-prd', 'chained', 'step-05-innovation.md'),
      path.join(promptsDir, 'bmad', '02-pm', '01-prd', 'chained', 'step-06-project-type.md'),
      path.join(promptsDir, 'bmad', '02-pm', '01-prd', 'chained', 'step-07-scoping.md'),
      path.join(promptsDir, 'bmad', '02-pm', '01-prd', 'chained', 'step-08-functional.md'),
      path.join(promptsDir, 'bmad', '02-pm', '01-prd', 'chained', 'step-09-nonfunctional.md'),
      path.join(promptsDir, 'bmad', '02-pm', '01-prd', 'chained', 'step-10-complete.md'),
    ],
  },
  {
    id: 'bmad-ux',
    name: 'Sally [UX]',
    description: 'BMAD UX designer for UX design specification workflow',
    promptPath: [
      path.join(promptsDir, 'bmad', 'shared', 'system-files-protection.md'),
      path.join(promptsDir, 'bmad', '03-ux-designer', 'sally.md'),
      path.join(promptsDir, 'bmad', '03-ux-designer', 'workflow.md'),
      path.join(promptsDir, 'bmad', '03-ux-designer', 'chained', 'step-01-discovery.md'),
    ],
    chainedPromptsPath: [
      path.join(promptsDir, 'bmad', '03-ux-designer', 'chained', 'step-02-core-experience.md'),
      path.join(promptsDir, 'bmad', '03-ux-designer', 'chained', 'step-03-emotional-response.md'),
      path.join(promptsDir, 'bmad', '03-ux-designer', 'chained', 'step-04-inspiration.md'),
      path.join(promptsDir, 'bmad', '03-ux-designer', 'chained', 'step-05-design-system.md'),
      path.join(promptsDir, 'bmad', '03-ux-designer', 'chained', 'step-06-defining-experience.md'),
      path.join(promptsDir, 'bmad', '03-ux-designer', 'chained', 'step-07-visual-foundation.md'),
      path.join(promptsDir, 'bmad', '03-ux-designer', 'chained', 'step-08-design-directions.md'),
      path.join(promptsDir, 'bmad', '03-ux-designer', 'chained', 'step-09-user-journeys.md'),
      path.join(promptsDir, 'bmad', '03-ux-designer', 'chained', 'step-10-component-strategy.md'),
      path.join(promptsDir, 'bmad', '03-ux-designer', 'chained', 'step-11-ux-patterns.md'),
      path.join(promptsDir, 'bmad', '03-ux-designer', 'chained', 'step-12-responsive-accessibility.md'),
      path.join(promptsDir, 'bmad', '03-ux-designer', 'chained', 'step-13-complete.md'),
    ],
  },
  {
    id: 'bmad-architect',
    name: 'Winston [Arch]',
    description: 'BMAD architect for architecture decision workflow',
    promptPath: [
      path.join(promptsDir, 'bmad', 'shared', 'system-files-protection.md'),
      path.join(promptsDir, 'bmad', '04-architect', 'winston.md'),
      path.join(promptsDir, 'bmad', '04-architect', 'workflow.md'),
      path.join(promptsDir, 'bmad', '04-architect', 'chained', 'step-01-context.md'),
    ],
    chainedPromptsPath: [
      path.join(promptsDir, 'bmad', '04-architect', 'chained', 'step-02-starter.md'),
      path.join(promptsDir, 'bmad', '04-architect', 'chained', 'step-03-decisions.md'),
      path.join(promptsDir, 'bmad', '04-architect', 'chained', 'step-04-patterns.md'),
      path.join(promptsDir, 'bmad', '04-architect', 'chained', 'step-05-structure.md'),
      path.join(promptsDir, 'bmad', '04-architect', 'chained', 'step-06-validation.md'),
      path.join(promptsDir, 'bmad', '04-architect', 'chained', 'step-07-complete.md'),
    ],
  },
  {
    id: 'bmad-epics',
    name: 'John [PM: Epics]',
    description: 'BMAD PM for epics and stories creation workflow',
    promptPath: [
      path.join(promptsDir, 'bmad', 'shared', 'system-files-protection.md'),
      path.join(promptsDir, 'bmad', '02-pm', 'john.md'),
      path.join(promptsDir, 'bmad', '02-pm', '02-epics', 'workflow.md'),
      path.join(promptsDir, 'bmad', '02-pm', '02-epics', 'chained', 'step-01-validate-prerequisites.md'),
    ],
    chainedPromptsPath: [
      path.join(promptsDir, 'bmad', '02-pm', '02-epics', 'chained', 'step-02-design-epics.md'),
      path.join(promptsDir, 'bmad', '02-pm', '02-epics', 'chained', 'step-03-create-stories.md'),
      path.join(promptsDir, 'bmad', '02-pm', '02-epics', 'chained', 'step-04-final-validation.md'),
    ],
  },
  {
    id: 'bmad-tea',
    name: 'Murat [Test Arch]',
    description: 'BMAD test architect for test design and risk assessment workflow',
    promptPath: [
      path.join(promptsDir, 'bmad', 'shared', 'system-files-protection.md'),
      path.join(promptsDir, 'bmad', '05-tea', 'murat.md'),
      path.join(promptsDir, 'bmad', '05-tea', '01-test-design', 'instructions.md'),
    ],
  },
  {
    id: 'bmad-readiness',
    name: 'John [PM: Readiness]',
    description: 'BMAD PM for implementation readiness validation workflow',
    promptPath: [
      path.join(promptsDir, 'bmad', 'shared', 'system-files-protection.md'),
      path.join(promptsDir, 'bmad', '02-pm', 'john.md'),
      path.join(promptsDir, 'bmad', '02-pm', '03-readiness', 'workflow.md'),
      path.join(promptsDir, 'bmad', '02-pm', '03-readiness', 'chained', 'step-01-prd-analysis.md'),
    ],
    chainedPromptsPath: [
      path.join(promptsDir, 'bmad', '02-pm', '03-readiness', 'chained', 'step-02-epic-coverage.md'),
      path.join(promptsDir, 'bmad', '02-pm', '03-readiness', 'chained', 'step-03-ux-alignment.md'),
      path.join(promptsDir, 'bmad', '02-pm', '03-readiness', 'chained', 'step-04-epic-quality.md'),
      path.join(promptsDir, 'bmad', '02-pm', '03-readiness', 'chained', 'step-05-complete.md'),
    ],
  },
  {
    id: 'bmad-sprints',
    name: 'Bob [SM: Sprints]',
    description: 'BMAD SM for sprint status generation from epics',
    promptPath: [
      path.join(promptsDir, 'bmad', 'shared', 'system-files-protection.md'),
      path.join(promptsDir, 'bmad', '06-sm', 'bob.md'),
      path.join(promptsDir, 'bmad', '06-sm', '01-sprint-planning', 'instructions.md'),
    ],
  },
  {
    id: 'bmad-stories',
    name: 'Bob [SM: Create Story]',
    description: 'BMAD SM for creating developer-ready story files',
    promptPath: [
      path.join(promptsDir, 'bmad', 'shared', 'system-files-protection.md'),
      path.join(promptsDir, 'bmad', '06-sm', 'bob.md'),
      path.join(promptsDir, 'bmad', '06-sm', '02-create-story', 'instructions.xml'),
    ],
  },
  {
    id: 'bmad-dev',
    name: 'Amelia [Dev: Build]',
    description: 'BMAD Developer for story implementation',
    promptPath: [
      path.join(promptsDir, 'bmad', 'shared', 'system-files-protection.md'),
      path.join(promptsDir, 'bmad', '07-dev', 'amelia.md'),
      path.join(promptsDir, 'bmad', '07-dev', '01-dev-story', 'instructions.xml'),
      path.join(promptsDir, 'bmad', '07-dev', '01-dev-story', 'checklist.md'),
    ],
  },
  {
    id: 'bmad-review',
    name: 'Amelia [Dev: Review]',
    description: 'BMAD Developer for code review',
    promptPath: [
      path.join(promptsDir, 'bmad', 'shared', 'system-files-protection.md'),
      path.join(promptsDir, 'bmad', '07-dev', 'amelia.md'),
      path.join(promptsDir, 'bmad', '07-dev', '02-code-review', 'instructions.xml'),
      path.join(promptsDir, 'bmad', '07-dev', '02-code-review', 'checklist.md'),
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
