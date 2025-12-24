import { describe, it, expect, beforeEach } from 'bun:test';
import { createWorkflowEventBus } from '../../../../../../workflows/events/index.js';
import { MockAdapter, createMockAdapter } from '../mock.js';
import { HeadlessAdapter, createHeadlessAdapter } from '../headless.js';
import { createAdapter, createAutoAdapter, type AdapterType } from '../index.js';
import type { WorkflowEventBus } from '../../../../../../workflows/events/index.js';

describe('MockAdapter', () => {
  let adapter: MockAdapter;
  let bus: WorkflowEventBus;

  beforeEach(() => {
    adapter = createMockAdapter();
    bus = createWorkflowEventBus();
  });

  describe('lifecycle', () => {
    it('should track start/stop calls', () => {
      adapter.start();
      adapter.start(); // Should be idempotent
      expect(adapter.startCount).toBe(1);
      expect(adapter.isRunning()).toBe(true);

      adapter.stop();
      adapter.stop(); // Should be idempotent
      expect(adapter.stopCount).toBe(1);
      expect(adapter.isRunning()).toBe(false);
    });

    it('should track connect/disconnect calls', () => {
      adapter.connect(bus);
      expect(adapter.connectCount).toBe(1);
      expect(adapter.isConnected()).toBe(true);

      adapter.disconnect();
      expect(adapter.disconnectCount).toBe(1);
      expect(adapter.isConnected()).toBe(false);
    });
  });

  describe('event recording', () => {
    beforeEach(() => {
      adapter.connect(bus);
      adapter.start();
    });

    it('should record all events', () => {
      bus.emit({ type: 'workflow:started', workflowName: 'Test', totalSteps: 3 });
      bus.emit({ type: 'agent:status', agentId: 'a1', status: 'running' });
      bus.emit({ type: 'agent:status', agentId: 'a1', status: 'completed' });

      expect(adapter.events).toHaveLength(3);
    });

    it('should filter events by type', () => {
      bus.emit({ type: 'workflow:started', workflowName: 'Test', totalSteps: 3 });
      bus.emit({ type: 'agent:status', agentId: 'a1', status: 'running' });
      bus.emit({ type: 'workflow:status', status: 'completed' });

      const statusEvents = adapter.getEventsByType('agent:status');
      expect(statusEvents).toHaveLength(1);
      expect(statusEvents[0].agentId).toBe('a1');
    });

    it('should get last event of type', () => {
      bus.emit({ type: 'agent:status', agentId: 'a1', status: 'running' });
      bus.emit({ type: 'agent:status', agentId: 'a1', status: 'completed' });

      const lastStatus = adapter.getLastEventOfType('agent:status');
      expect(lastStatus?.status).toBe('completed');
    });

    it('should check if event type exists', () => {
      bus.emit({ type: 'workflow:started', workflowName: 'Test', totalSteps: 3 });

      expect(adapter.hasEventOfType('workflow:started')).toBe(true);
      expect(adapter.hasEventOfType('checkpoint:state')).toBe(false);
    });
  });

  describe('state derivation', () => {
    beforeEach(() => {
      adapter.connect(bus);
      adapter.start();
    });

    it('should track workflow state', () => {
      bus.emit({ type: 'workflow:started', workflowName: 'Test Workflow', totalSteps: 3 });
      expect(adapter.state.workflowName).toBe('Test Workflow');
      expect(adapter.state.workflowStatus).toBe('running');

      bus.emit({ type: 'workflow:status', status: 'completed' });
      expect(adapter.state.workflowStatus).toBe('completed');
    });

    it('should track agent state', () => {
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

      expect(adapter.state.agents.get('agent-1')).toEqual({
        name: 'Planner',
        engine: 'claude',
        status: 'pending',
      });

      bus.emit({ type: 'agent:status', agentId: 'agent-1', status: 'running' });
      expect(adapter.getAgentStatus('agent-1')).toBe('running');

      bus.emit({ type: 'agent:status', agentId: 'agent-1', status: 'completed' });
      expect(adapter.getAgentStatus('agent-1')).toBe('completed');
    });

    it('should track sub-agents', () => {
      bus.emit({
        type: 'subagent:added',
        parentId: 'agent-1',
        subAgent: {
          id: 'sub-1',
          parentId: 'agent-1',
          name: 'Sub Agent',
          engine: 'claude',
          status: 'running',
          telemetry: { tokensIn: 0, tokensOut: 0 },
          startTime: Date.now(),
          toolCount: 0,
          thinkingCount: 0,
        },
      });

      const subAgents = adapter.state.subAgents.get('agent-1');
      expect(subAgents).toHaveLength(1);
      expect(subAgents![0].name).toBe('Sub Agent');
    });

    it('should track loop state', () => {
      expect(adapter.state.loopActive).toBe(false);

      bus.emit({
        type: 'loop:state',
        loopState: {
          active: true,
          sourceAgent: 'agent-1',
          backSteps: 2,
          iteration: 1,
          maxIterations: 3,
          skipList: [],
        },
      });

      expect(adapter.state.loopActive).toBe(true);

      bus.emit({ type: 'loop:state', loopState: null });
      expect(adapter.state.loopActive).toBe(false);
    });

    it('should track messages', () => {
      bus.emit({ type: 'message:log', agentId: 'agent-1', message: 'Hello' });
      bus.emit({ type: 'message:log', agentId: 'agent-1', message: 'World' });
      bus.emit({ type: 'message:log', agentId: 'agent-2', message: 'Other' });

      const messages = adapter.getMessagesForAgent('agent-1');
      expect(messages).toEqual(['Hello', 'World']);
    });
  });

  describe('user action simulation', () => {
    it('should simulate skip action', () => {
      let skipCalled = false;
      adapter.onSkip = () => {
        skipCalled = true;
      };

      adapter.simulateSkip();
      expect(skipCalled).toBe(true);
    });

    it('should simulate quit action', () => {
      let quitCalled = false;
      adapter.onQuit = () => {
        quitCalled = true;
      };

      adapter.simulateQuit();
      expect(quitCalled).toBe(true);
    });

    it('should simulate checkpoint continue', () => {
      let continueCalled = false;
      adapter.onCheckpointContinue = () => {
        continueCalled = true;
      };

      adapter.simulateCheckpointContinue();
      expect(continueCalled).toBe(true);
    });

    it('should simulate checkpoint quit', () => {
      let quitCalled = false;
      adapter.onCheckpointQuit = () => {
        quitCalled = true;
      };

      adapter.simulateCheckpointQuit();
      expect(quitCalled).toBe(true);
    });
  });

  describe('reset', () => {
    it('should reset all state', () => {
      adapter.connect(bus);
      adapter.start();
      bus.emit({ type: 'workflow:started', workflowName: 'Test', totalSteps: 3 });

      adapter.reset();

      expect(adapter.events).toHaveLength(0);
      expect(adapter.state.workflowName).toBeNull();
      expect(adapter.startCount).toBe(0);
    });
  });
});

describe('HeadlessAdapter', () => {
  let adapter: HeadlessAdapter;
  let bus: WorkflowEventBus;
  let logs: string[];

  beforeEach(() => {
    logs = [];
    adapter = createHeadlessAdapter({
      workflowName: 'Test Workflow',
      logLevel: 'verbose',
      timestamps: false,
      logger: (msg) => logs.push(msg),
    });
    bus = createWorkflowEventBus();
  });

  it('should log workflow events', () => {
    adapter.connect(bus);
    adapter.start();

    bus.emit({ type: 'workflow:started', workflowName: 'Test', totalSteps: 3 });
    bus.emit({
      type: 'agent:added',
      agent: {
        id: 'a1',
        name: 'Planner',
        engine: 'claude',
        stepIndex: 0,
        totalSteps: 3,
        status: 'pending',
        orderIndex: 0,
      },
    });
    bus.emit({ type: 'agent:status', agentId: 'a1', status: 'running' });
    bus.emit({ type: 'agent:status', agentId: 'a1', status: 'completed' });
    bus.emit({ type: 'workflow:status', status: 'completed' });

    adapter.stop();

    expect(logs.some((l) => l.includes('Workflow "Test" started'))).toBe(true);
    expect(logs.some((l) => l.includes('Planner'))).toBe(true);
    expect(logs.some((l) => l.includes('running'))).toBe(true);
    expect(logs.some((l) => l.includes('completed'))).toBe(true);
  });

  it('should respect log level: minimal', () => {
    adapter = createHeadlessAdapter({
      logLevel: 'minimal',
      timestamps: false,
      logger: (msg) => logs.push(msg),
    });
    adapter.connect(bus);
    adapter.start();

    bus.emit({
      type: 'agent:added',
      agent: {
        id: 'a1',
        name: 'Planner',
        engine: 'claude',
        stepIndex: 0,
        totalSteps: 3,
        status: 'pending',
        orderIndex: 0,
      },
    });
    bus.emit({ type: 'agent:status', agentId: 'a1', status: 'running' });

    // Minimal should not log agent:added, but should log status
    expect(logs.some((l) => l.includes('Agent added'))).toBe(false);
    expect(logs.some((l) => l.includes('Status: running'))).toBe(true);
  });

  it('should log loop state', () => {
    adapter.connect(bus);
    adapter.start();

    // Add agent first so we have the name
    bus.emit({
      type: 'agent:added',
      agent: {
        id: 'a1',
        name: 'Coder',
        engine: 'claude',
        stepIndex: 0,
        totalSteps: 3,
        status: 'pending',
        orderIndex: 0,
      },
    });

    bus.emit({
      type: 'loop:state',
      loopState: {
        active: true,
        sourceAgent: 'a1',
        backSteps: 2,
        iteration: 1,
        maxIterations: 3,
        skipList: [],
      },
    });

    expect(logs.some((l) => l.includes('Loop') && l.includes('Coder'))).toBe(true);
  });
});

describe('createAdapter factory', () => {
  it('should create headless adapter', () => {
    const adapter = createAdapter('headless');
    expect(adapter).toBeInstanceOf(HeadlessAdapter);
  });

  it('should create mock adapter', () => {
    const adapter = createAdapter('mock');
    expect(adapter).toBeInstanceOf(MockAdapter);
  });

  it('should fall back to headless for opentui (not yet implemented)', () => {
    // Suppress the warning
    const originalWarn = console.warn;
    console.warn = () => {};

    const adapter = createAdapter('opentui');
    expect(adapter).toBeInstanceOf(HeadlessAdapter);

    console.warn = originalWarn;
  });

  it('should throw for unknown adapter type', () => {
    expect(() => createAdapter('unknown' as AdapterType)).toThrow('Unknown adapter type');
  });
});

describe('createAutoAdapter', () => {
  it('should return mock adapter in test environment', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';

    const adapter = createAutoAdapter();
    expect(adapter).toBeInstanceOf(MockAdapter);

    process.env.NODE_ENV = originalEnv;
  });
});

describe('Integration: Full workflow simulation', () => {
  it('should handle complete workflow lifecycle', () => {
    const bus = createWorkflowEventBus();
    const adapter = createMockAdapter();

    // Setup
    adapter.connect(bus);
    adapter.onSkip = () => bus.emit({ type: 'workflow:status', status: 'stopped' });
    adapter.start();

    // Simulate workflow
    bus.emit({ type: 'workflow:started', workflowName: 'Integration Test', totalSteps: 2 });

    // Add agents
    bus.emit({
      type: 'agent:added',
      agent: { id: 'a1', name: 'Agent 1', engine: 'claude', stepIndex: 0, totalSteps: 2, status: 'pending', orderIndex: 0 },
    });
    bus.emit({
      type: 'agent:added',
      agent: { id: 'a2', name: 'Agent 2', engine: 'claude', stepIndex: 1, totalSteps: 2, status: 'pending', orderIndex: 1 },
    });

    // Run first agent
    bus.emit({ type: 'agent:status', agentId: 'a1', status: 'running' });
    bus.emit({ type: 'message:log', agentId: 'a1', message: 'Working...' });
    bus.emit({ type: 'agent:telemetry', agentId: 'a1', telemetry: { tokensIn: 500, tokensOut: 200 } });
    bus.emit({ type: 'agent:status', agentId: 'a1', status: 'completed' });

    // Run second agent
    bus.emit({ type: 'agent:status', agentId: 'a2', status: 'running' });
    bus.emit({ type: 'agent:status', agentId: 'a2', status: 'completed' });

    // Complete workflow
    bus.emit({ type: 'workflow:status', status: 'completed' });

    // Cleanup
    adapter.stop();
    adapter.disconnect();

    // Verify
    expect(adapter.state.workflowName).toBe('Integration Test');
    expect(adapter.state.workflowStatus).toBe('completed');
    expect(adapter.state.agents.size).toBe(2);
    expect(adapter.getAgentStatus('a1')).toBe('completed');
    expect(adapter.getAgentStatus('a2')).toBe('completed');
    expect(adapter.getMessagesForAgent('a1')).toEqual(['Working...']);
    expect(adapter.events.length).toBeGreaterThan(5);
  });
});
