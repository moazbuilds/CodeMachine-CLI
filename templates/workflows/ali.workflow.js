export default {
  name: 'Ali | The CM Guy',
  autonomousMode: 'never',
  steps: [
    resolveStep('cm-workflow-builder', {engine: 'claude'}),
  ],
};
