export default {
  name: 'BMAD Method',
  controller: true,

  steps: [
    resolveStep('bmad-analyst', {model: 'opencode/grok-code'}),
    resolveStep('bmad-pm', {model: 'opencode/grok-code'}),
  ],
};
