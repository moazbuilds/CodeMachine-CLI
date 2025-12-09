const path = require('node:path');

const promptsDir = path.join(__dirname, '..', 'prompts', 'templates');

module.exports = [
  // Codemachine agents
  {
    id: 'arch-agent',
    name: 'Architecture Agent',
    description: 'Defines system architecture and technical design decisions',
    promptPath: path.join(promptsDir, 'codemachine', 'agents', '01-architecture-agent.md'),
  },
  {
    id: 'plan-agent',
    name: 'Plan Agent',
    description: 'Analyzes requirements and generates comprehensive iterative development plans with architectural artifacts',
    promptPath: path.join(promptsDir, 'codemachine', 'agents', '02-planning-agent.md'),
  },
  {
    id: 'task-breakdown',
    name: 'Task Breakdown Agent',
    description: 'Extracts and structures tasks from project plans into JSON format',
    promptPath: path.join(promptsDir, 'codemachine', 'agents', '03-task-breakdown-agent.md'),
  },
  {
    id: 'context-manager',
    name: 'Context Manager Agent',
    description: 'Gathers and prepares relevant context from architecture, plan, and codebase for task execution',
    promptPath: path.join(promptsDir, 'codemachine', 'agents', '04-context-manager-agent.md'),
  },
  {
    id: 'code-generation',
    name: 'Code Generation Agent',
    description: 'Generates code implementation based on task specifications and design artifacts',
    promptPath: path.join(promptsDir, 'codemachine', 'agents', '05-code-generation-agent.md'),
  },
  {
    id: 'task-sanity-check',
    name: 'Task Verification Agent',
    description: 'Verifies generated code against task requirements and acceptance criteria',
    promptPath: path.join(promptsDir, 'codemachine', 'agents', '06-task-validation-agent.md'),
  },
  {
    id: 'runtime-prep',
    name: 'Runtime Preparation Agent',
    description: 'Generates robust shell scripts for project automation (install, run, lint, test)',
    promptPath: path.join(promptsDir, 'codemachine', 'agents', '07-runtime-preparation-agent.md'),
  },
  {
    id: 'git-commit',
    name: 'Git Commit Agent',
    description: 'Handles git commit operations and commit message generation',
    promptPath: path.join(promptsDir, 'codemachine', 'workflows', 'git-commit-workflow.md'),
  },
  {
    id: 'cleanup-code-fallback',
    name: 'Cleanup Code Fallback File',
    description: 'Deletes .codemachine/prompts/code_fallback.md if it exists',
    promptPath: path.join(promptsDir, 'codemachine', 'workflows', 'cleanup-code-fallback-workflow.md'),
  },
  {
    id: 'plan-fallback',
    name: 'Plan Fallback Agent',
    description: 'Fixes and validates plan generation issues when plan-agent fails',
    promptPath: path.join(promptsDir, 'codemachine', 'fallback-agents', 'planning-fallback.md'),
  },
  {
    id: 'task-fallback',
    name: 'Task Fallback Agent',
    description: 'Fixes and validates task breakdown issues when task-breakdown fails',
    promptPath: path.join(promptsDir, 'codemachine', 'fallback-agents', 'task-breakdown-fallback.md'),
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

  // Dev codemachine agents
  {
    id: 'init',
    name: 'Init',
    description: 'Initializes codemachine development environment (creates branch and updates .gitignore)',
    promptPath: path.join(promptsDir, 'dev-codemachine', 'main-agents', '00-init.md'),
  },
  {
    id: 'principal-analyst',
    name: 'Principal Analyst - Checkpoint',
    description: 'Reviews project specifications and identifies critical ambiguities requiring clarification',
    promptPath: path.join(promptsDir, 'dev-codemachine', 'main-agents', '01-principal-analyst.md'),
  },
  {
    id: 'specifications-indexer',
    name: 'Specifications Indexer',
    description: 'Indexes and structures project specifications for efficient access and reference',
    promptPath: path.join(promptsDir, 'dev-codemachine', 'main-agents', '02-specifications-indexer.md'),
  },
  {
    id: 'blueprint-orchestrator',
    name: 'Blueprint Orchestrator',
    description: 'Orchestrates the execution of Foundation, Structural-Data, Behavior, and Ops-Docs architects with resilience and resumability',
    promptPath: path.join(promptsDir, 'dev-codemachine', 'main-agents', '04-blueprint-orchestrator.md'),
  },

  // Folder configurations - applies settings to all agents in the folder
  //{
  //  type: 'folder',
  //  id: 'codemachine',
  //  name: 'Codemachine',
  //  description: 'Core codemachine workflow agents',
  //  folderPath: path.join(promptsDir, 'codemachine'),
  //},
];
