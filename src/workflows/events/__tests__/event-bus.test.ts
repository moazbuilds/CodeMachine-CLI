import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { WorkflowEventBus, createWorkflowEventBus } from '../event-bus.js';
import type { WorkflowEvent } from '../types.js';

describe('WorkflowEventBus', () => {
  let bus: WorkflowEventBus;

  beforeEach(() => {
    bus = createWorkflowEventBus();
  });

  describe('subscribe', () => {
    it('should notify subscribers of all events', () => {
      const events: WorkflowEvent[] = [];
      bus.subscribe((event) => events.push(event));

      bus.emit({ type: 'agent:status', agentId: 'test-1', status: 'running' });
      bus.emit({ type: 'workflow:status', status: 'completed' });

      expect(events).toHaveLength(2);
      expect(events[0].type).toBe('agent:status');
      expect(events[1].type).toBe('workflow:status');
    });

    it('should return unsubscribe function', () => {
      const events: WorkflowEvent[] = [];
      const unsub = bus.subscribe((event) => events.push(event));

      bus.emit({ type: 'agent:status', agentId: 'test-1', status: 'running' });
      unsub();
      bus.emit({ type: 'agent:status', agentId: 'test-2', status: 'completed' });

      expect(events).toHaveLength(1);
      expect((events[0] as any).agentId).toBe('test-1');
    });
  });

  describe('on (typed listeners)', () => {
    it('should only notify listeners of matching event type', () => {
      const statusEvents: any[] = [];
      const telemetryEvents: any[] = [];

      bus.on('agent:status', (event) => statusEvents.push(event));
      bus.on('agent:telemetry', (event) => telemetryEvents.push(event));

      bus.emit({ type: 'agent:status', agentId: 'test-1', status: 'running' });
      bus.emit({
        type: 'agent:telemetry',
        agentId: 'test-1',
        telemetry: { tokensIn: 100 },
      });
      bus.emit({ type: 'agent:status', agentId: 'test-2', status: 'completed' });

      expect(statusEvents).toHaveLength(2);
      expect(telemetryEvents).toHaveLength(1);
    });

    it('should provide typed event payload', () => {
      bus.on('agent:added', (event) => {
        // TypeScript should infer correct type
        expect(event.agent.name).toBeDefined();
        expect(event.agent.engine).toBeDefined();
      });

      bus.emit({
        type: 'agent:added',
        agent: {
          id: 'test-1',
          name: 'Test Agent',
          engine: 'claude',
          stepIndex: 0,
          totalSteps: 3,
          status: 'pending',
          orderIndex: 0,
        },
      });
    });
  });

  describe('once', () => {
    it('should only fire listener once', () => {
      let count = 0;
      bus.once('agent:status', () => {
        count++;
      });

      bus.emit({ type: 'agent:status', agentId: 'test-1', status: 'running' });
      bus.emit({ type: 'agent:status', agentId: 'test-2', status: 'completed' });

      expect(count).toBe(1);
    });
  });

  describe('event history', () => {
    it('should not record history by default', () => {
      bus.emit({ type: 'agent:status', agentId: 'test-1', status: 'running' });
      expect(bus.getHistory()).toHaveLength(0);
    });

    it('should record history when enabled', () => {
      bus.enableHistory();
      bus.emit({ type: 'agent:status', agentId: 'test-1', status: 'running' });
      bus.emit({ type: 'workflow:status', status: 'completed' });

      expect(bus.getHistory()).toHaveLength(2);
    });

    it('should limit history size', () => {
      bus.enableHistory(2);
      bus.emit({ type: 'agent:status', agentId: 'test-1', status: 'running' });
      bus.emit({ type: 'agent:status', agentId: 'test-2', status: 'running' });
      bus.emit({ type: 'agent:status', agentId: 'test-3', status: 'running' });

      const history = bus.getHistory();
      expect(history).toHaveLength(2);
      expect((history[0] as any).agentId).toBe('test-2');
      expect((history[1] as any).agentId).toBe('test-3');
    });

    it('should filter history by type', () => {
      bus.enableHistory();
      bus.emit({ type: 'agent:status', agentId: 'test-1', status: 'running' });
      bus.emit({ type: 'workflow:status', status: 'running' });
      bus.emit({ type: 'agent:status', agentId: 'test-2', status: 'completed' });

      const statusHistory = bus.getHistoryByType('agent:status');
      expect(statusHistory).toHaveLength(2);
    });

    it('should clear history', () => {
      bus.enableHistory();
      bus.emit({ type: 'agent:status', agentId: 'test-1', status: 'running' });
      bus.clearHistory();
      expect(bus.getHistory()).toHaveLength(0);
    });
  });

  describe('error handling', () => {
    it('should continue notifying other listeners if one throws', () => {
      const events: WorkflowEvent[] = [];

      bus.subscribe(() => {
        throw new Error('Test error');
      });
      bus.subscribe((event) => events.push(event));

      // Should not throw, and second listener should still be called
      bus.emit({ type: 'agent:status', agentId: 'test-1', status: 'running' });

      expect(events).toHaveLength(1);
    });
  });

  describe('removeAllListeners', () => {
    it('should remove all listeners', () => {
      const events: WorkflowEvent[] = [];
      bus.subscribe((event) => events.push(event));
      bus.on('agent:status', (event) => events.push(event));

      bus.removeAllListeners();
      bus.emit({ type: 'agent:status', agentId: 'test-1', status: 'running' });

      expect(events).toHaveLength(0);
    });
  });

  describe('listenerCount', () => {
    it('should return correct listener counts', () => {
      bus.subscribe(() => {});
      bus.subscribe(() => {});
      bus.on('agent:status', () => {});
      bus.on('agent:telemetry', () => {});
      bus.on('agent:telemetry', () => {});

      const counts = bus.listenerCount();
      expect(counts.general).toBe(2);
      expect(counts.typed.get('agent:status')).toBe(1);
      expect(counts.typed.get('agent:telemetry')).toBe(2);
    });
  });
});

describe('Integration: Event Flow', () => {
  it('should simulate a complete workflow execution', () => {
    const bus = createWorkflowEventBus();
    bus.enableHistory();

    // Simulate workflow startup
    bus.emit({
      type: 'workflow:started',
      workflowName: 'Test Workflow',
      totalSteps: 3,
    });

    // Add agents
    bus.emit({
      type: 'agent:added',
      agent: {
        id: 'agent-1',
        name: 'Planner',
        engine: 'claude',
        stepIndex: 0,
        totalSteps: 3,
        status: 'pending',
        orderIndex: 0,
      },
    });

    bus.emit({
      type: 'agent:added',
      agent: {
        id: 'agent-2',
        name: 'Coder',
        engine: 'claude',
        stepIndex: 1,
        totalSteps: 3,
        status: 'pending',
        orderIndex: 1,
      },
    });

    // Run first agent
    bus.emit({ type: 'agent:status', agentId: 'agent-1', status: 'running' });
    bus.emit({ type: 'message:log', agentId: 'agent-1', message: 'Starting planning...' });
    bus.emit({
      type: 'agent:telemetry',
      agentId: 'agent-1',
      telemetry: { tokensIn: 500, tokensOut: 200 },
    });
    bus.emit({ type: 'agent:status', agentId: 'agent-1', status: 'completed' });

    // Run second agent
    bus.emit({ type: 'agent:status', agentId: 'agent-2', status: 'running' });
    bus.emit({ type: 'agent:status', agentId: 'agent-2', status: 'completed' });

    // Workflow complete
    bus.emit({ type: 'workflow:status', status: 'completed' });

    // Verify history
    const history = bus.getHistory();
    expect(history).toHaveLength(10);
    expect(history[0].type).toBe('workflow:started');
    expect(history[history.length - 1].type).toBe('workflow:status');

    // Verify status changes
    const statusEvents = bus.getHistoryByType('agent:status');
    expect(statusEvents).toHaveLength(4); // 2 running + 2 completed
  });
});
