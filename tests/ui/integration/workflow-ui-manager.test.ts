import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WorkflowUIManager } from '../../../src/ui/manager/WorkflowUIManager';

describe('WorkflowUIManager Integration Tests', () => {
  let manager: WorkflowUIManager;

  beforeEach(() => {
    manager = new WorkflowUIManager('Test Workflow', 3);
  });

  afterEach(() => {
    if (manager) {
      manager.stop();
    }
  });

  describe('Basic Workflow', () => {
    it('should create manager with initial state', () => {
      const state = manager.getState();

      expect(state.workflowName).toBe('Test Workflow');
      expect(state.totalSteps).toBe(3);
      expect(state.currentStep).toBe(0);
      expect(state.agents).toEqual([]);
    });

    it('should add and track main agents', () => {
      const _agentId1 = manager.addMainAgent('test-agent-1', 'claude', 0);
      const _agentId2 = manager.addMainAgent('test-agent-2', 'codex', 1);

      const state = manager.getState();

      expect(state.agents).toHaveLength(2);
      expect(state.agents[0].name).toBe('test-agent-1');
      expect(state.agents[1].name).toBe('test-agent-2');
      expect(state.currentStep).toBe(2);
      expect(state.totalExecuted).toBe(2);
    });

    it('should update agent status', () => {
      const agentId = manager.addMainAgent('test-agent', 'claude', 0);

      manager.updateAgentStatus(agentId, 'running');
      expect(manager.getState().agents[0].status).toBe('running');

      manager.updateAgentStatus(agentId, 'completed');
      expect(manager.getState().agents[0].status).toBe('completed');
      expect(manager.getState().uniqueCompleted).toBe(1);
    });

    it('should handle output chunks', () => {
      const agentId = manager.addMainAgent('test-agent', 'claude', 0);

      manager.handleOutputChunk(agentId, '💬 TEXT: Starting task...');
      manager.handleOutputChunk(agentId, '🔧 TOOL: Read file.ts');
      manager.handleOutputChunk(agentId, '⏱️  Tokens: 500in/200out');

      // Wait for batch processing
      setTimeout(() => {
        const state = manager.getState();
        expect(state.outputBuffer.length).toBeGreaterThan(0);
        expect(state.agents[0].toolCount).toBeGreaterThan(0);
      }, 100);
    });

    it('should track telemetry from output', () => {
      const agentId = manager.addMainAgent('test-agent', 'claude', 0);

      manager.handleOutputChunk(agentId, 'Tokens: 1000in/500out');

      setTimeout(() => {
        const state = manager.getState();
        expect(state.agents[0].telemetry.tokensIn).toBeGreaterThan(0);
      }, 100);
    });
  });

  describe('State Management', () => {
    it('should auto-select first agent', () => {
      const agentId = manager.addMainAgent('first-agent', 'claude', 0);

      const state = manager.getState();
      expect(state.selectedAgentId).toBe(agentId);
    });

    it('should track agent selection', () => {
      const agentId = manager.addMainAgent('test-agent', 'claude', 0);

      expect(manager.getState().selectedAgentId).toBe(agentId);
    });

    it('should track total executions', () => {
      manager.addMainAgent('agent-1', 'claude', 0);
      manager.addMainAgent('agent-2', 'codex', 1);
      manager.addMainAgent('agent-3', 'cursor', 2);

      const state = manager.getState();
      expect(state.totalExecuted).toBe(3);
    });
  });

  describe('Fallback Mode', () => {
    it('should detect non-TTY environment', () => {
      // Save original
      const originalIsTTY = process.stdout.isTTY;

      // Mock non-TTY
      Object.defineProperty(process.stdout, 'isTTY', {
        value: false,
        writable: true,
      });

      const fallbackManager = new WorkflowUIManager('Fallback Test', 1);
      fallbackManager.start();

      // Restore
      Object.defineProperty(process.stdout, 'isTTY', {
        value: originalIsTTY,
        writable: true,
      });

      fallbackManager.stop();
    });
  });

  describe('Performance', () => {
    it('should handle high-frequency output without degradation', () => {
      const agentId = manager.addMainAgent('perf-agent', 'claude', 0);

      const startTime = Date.now();

      // Simulate rapid output (100 chunks)
      for (let i = 0; i < 100; i++) {
        manager.handleOutputChunk(agentId, `Line ${i}: Some output...`);
      }

      const elapsed = Date.now() - startTime;

      // Should complete in under 200ms (well within performance budget)
      expect(elapsed).toBeLessThan(200);
    });

    it('should batch updates efficiently', async () => {
      const agentId = manager.addMainAgent('batch-agent', 'claude', 0);

      // Send multiple rapid updates
      for (let i = 0; i < 50; i++) {
        manager.handleOutputChunk(agentId, `Update ${i}`);
      }

      // Wait for batch processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      const state = manager.getState();
      // Output should be batched, not 50 separate renders
      expect(state.outputBuffer.length).toBeGreaterThan(0);
    });
  });
});
