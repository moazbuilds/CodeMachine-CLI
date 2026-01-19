export default {
  name: 'CodeMachine Workflow Builder',
  autonomousMode: 'never',
  steps: [
    resolveStep('cm-workflow-builder', {engine: 'claude'}),
  ],
};
