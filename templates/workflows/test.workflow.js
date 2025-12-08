export default {
  name: 'Test Workflow',
  steps: [
    resolveStep('test-agent-1', { engine: 'codex' }),                          // No tracks = runs in ALL
    resolveStep('test-agent-2', { engine: 'codex', tracks: ['bmad'] }),        // Only in bmad track
    resolveUI("❚❚ Human Review"),
    resolveStep('test-agent-3', { engine: 'codex', tracks: ['quick'] }),       // Only in quick track
    resolveModule('auto-loop', { engine: 'codex', loopSteps: 3, loopMaxIterations: 5 }), // No tracks = runs in ALL
  ],
  subAgentIds: ['frontend-dev'],
};
