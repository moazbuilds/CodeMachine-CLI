export default {
  name: 'CodeMachine-One Workflow',
  steps: [
    resolveStep('init', { executeOnce: true, engine: 'codex', model: 'gpt-5', modelReasoningEffort: 'low' }), // Initialize development environment
    resolveStep('principal-analyst', { executeOnce: true, engine: 'claude' }), // Review specifications and identify critical ambiguities
    resolveUI("∴ Planning Phase ∴"),
    resolveStep('blueprint-orchestrator', { executeOnce: true }), // Orchestrate architecture blueprint generation
    resolveStep('plan-agent', { executeOnce: true, engine: 'codex', notCompletedFallback: 'plan-fallback' }), // Generate comprehensive iterative development plan with architectural artifacts
    resolveStep('task-breakdown', { executeOnce: true, engine: 'codex' }), // Extract and structure tasks from project plan into JSON format
    resolveStep('git-commit', { executeOnce: true, engine: 'cursor' }), // Commit the task breakdown to git
    resolveUI("⟲ Development Cycle ⟲"),
    resolveStep('context-manager', { engine: 'codex' }), // Gather and prepare relevant context from architecture, plan, and codebase for task execution
    resolveStep('code-generation', { engine: 'claude' }), // Generate code implementation based on task specifications and design artifacts
    resolveStep('runtime-prep', { executeOnce: true, engine: 'claude' }), // Generate robust shell scripts for project automation (install, run, lint, test)
    resolveStep('task-sanity-check', { engine: 'codex' }), // Verify generated code against task requirements and acceptance criteria
    resolveStep('git-commit', { engine: 'cursor' }), // Commit the generated and verified code
    resolveUI("◈◈ Iteration Gate ◈◈"),
    resolveModule('check-task', { engine: 'cursor', loopSteps: 6, loopMaxIterations: 20,  loopSkip: ['runtime-prep']  }), // Loop back if tasks are not completed
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