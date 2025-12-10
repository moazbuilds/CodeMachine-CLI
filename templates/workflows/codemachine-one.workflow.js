export default {
  name: 'CodeMachine-One Workflow',
  steps: [
    resolveStep('init', { executeOnce: true }), // Initialize development environment
    resolveStep('principal-analyst', { executeOnce: true }), // Review specifications and identify critical ambiguities
    resolveUI("∴ Planning Phase ∴"),
    resolveStep('blueprint-orchestrator', { executeOnce: true }), // Orchestrate architecture blueprint generation
    resolveStep('plan-agent', { executeOnce: true, notCompletedFallback: 'plan-fallback' }), // Generate comprehensive iterative development plan with architectural artifacts
    resolveStep('task-breakdown', { executeOnce: true }), // Extract and structure tasks from project plan into JSON format
    resolveStep('git-commit', { executeOnce: true }), // Commit the task breakdown to git
    resolveUI("⟲ Development Cycle ⟲"),
    resolveStep('context-manager'), // Gather and prepare relevant context from architecture, plan, and codebase for task execution
    resolveStep('code-generation'), // Generate code implementation based on task specifications and design artifacts
    resolveStep('runtime-prep', { executeOnce: true }), // Generate robust shell scripts for project automation (install, run, lint, test)
    resolveStep('task-sanity-check'), // Verify generated code against task requirements and acceptance criteria
    resolveStep('git-commit'), // Commit the generated and verified code
    resolveUI("◈◈ Iteration Gate ◈◈"),
    resolveModule('check-task', { loopSteps: 6, loopMaxIterations: 20,  loopSkip: ['runtime-prep']  }), // Loop back if tasks are not completed
  ],
  subAgentIds: [
    // architecture sub-agents
    'founder-architect',
    'structural-data-architect',
    'behavior-architect',
    'ui-ux-architect',
    'operational-architect',
    'file-assembler'
  ],
};