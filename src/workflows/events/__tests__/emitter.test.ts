import { describe, it, expect, beforeEach } from 'bun:test';
import { WorkflowEventEmitter, createWorkflowEmitter, createWorkflowEventBus } from '../index.js';
import type { WorkflowEventBus } from '../event-bus.js';

describe('WorkflowEventEmitter', () => {
  let bus: WorkflowEventBus;
  let emitter: WorkflowEventEmitter;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let events: any[];

  beforeEach(() => {
    bus = createWorkflowEventBus();
    emitter = createWorkflowEmitter(bus);
    events = [];
    bus.subscribe((event) => events.push(event));
  });

  describe('workflow lifecycle', () => {
    it('should emit workflow started event', () => {
      emitter.workflowStarted('Test Workflow', 5);

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('workflow:started');
      expect(events[0].workflowName).toBe('Test Workflow');
      expect(events[0].totalSteps).toBe(5);
    });

    it('should emit workflow status event', () => {
      emitter.setWorkflowStatus('completed');

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('workflow:status');
      expect(events[0].status).toBe('completed');
    });

    it('should emit workflow stopped event', () => {
      emitter.workflowStopped('User cancelled');

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('workflow:stopped');
      expect(events[0].reason).toBe('User cancelled');
    });
  });

  describe('main agents', () => {
    it('should emit agent added event', () => {
      emitter.addMainAgent('agent-1', 'Planner', 'claude', 0, 3, 0, 'pending');

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('agent:added');
      expect(events[0].agent).toEqual({
        id: 'agent-1',
        name: 'Planner',
        engine: 'claude',
        stepIndex: 0,
        totalSteps: 3,
        status: 'pending',
        orderIndex: 0,
      });
    });

    it('should emit agent status event', () => {
      emitter.updateAgentStatus('agent-1', 'running');

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('agent:status');
      expect(events[0].agentId).toBe('agent-1');
      expect(events[0].status).toBe('running');
    });

    it('should emit agent telemetry event', () => {
      emitter.updateAgentTelemetry('agent-1', { tokensIn: 500, tokensOut: 200 });

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('agent:telemetry');
      expect(events[0].agentId).toBe('agent-1');
      expect(events[0].telemetry).toEqual({ tokensIn: 500, tokensOut: 200 });
    });

    it('should emit agent reset event', () => {
      emitter.resetAgentForLoop('agent-1', 2);

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('agent:reset');
      expect(events[0].agentId).toBe('agent-1');
      expect(events[0].cycleNumber).toBe(2);
    });
  });

  describe('sub-agents', () => {
    it('should emit subagent added event', () => {
      const subAgent = {
        id: 'sub-1',
        parentId: 'agent-1',
        name: 'Sub Agent',
        engine: 'claude',
        status: 'running' as const,
        telemetry: { tokensIn: 0, tokensOut: 0 },
        startTime: Date.now(),
        toolCount: 0,
        thinkingCount: 0,
      };
      emitter.addSubAgent('agent-1', subAgent);

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('subagent:added');
      expect(events[0].parentId).toBe('agent-1');
      expect(events[0].subAgent.name).toBe('Sub Agent');
    });

    it('should emit batch subagents event', () => {
      const subAgents = [
        { id: 'sub-1', parentId: 'agent-1', name: 'Sub 1', engine: 'claude', status: 'running' as const, telemetry: { tokensIn: 0, tokensOut: 0 }, startTime: Date.now(), toolCount: 0, thinkingCount: 0 },
        { id: 'sub-2', parentId: 'agent-1', name: 'Sub 2', engine: 'claude', status: 'pending' as const, telemetry: { tokensIn: 0, tokensOut: 0 }, startTime: Date.now(), toolCount: 0, thinkingCount: 0 },
      ];
      emitter.batchAddSubAgents('agent-1', subAgents);

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('subagent:batch');
      expect(events[0].subAgents).toHaveLength(2);
    });

    it('should emit subagent status event', () => {
      emitter.updateSubAgentStatus('sub-1', 'completed');

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('subagent:status');
      expect(events[0].subAgentId).toBe('sub-1');
      expect(events[0].status).toBe('completed');
    });

    it('should emit clear subagents event', () => {
      emitter.clearSubAgents('agent-1');

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('subagent:clear');
      expect(events[0].parentId).toBe('agent-1');
    });
  });

  describe('loop state', () => {
    it('should emit loop state event', () => {
      const loopState = {
        active: true,
        sourceAgent: 'agent-1',
        backSteps: 2,
        iteration: 1,
        maxIterations: 3,
        skipList: ['agent-2'],
        reason: 'Test loop',
      };
      emitter.setLoopState(loopState);

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('loop:state');
      expect(events[0].loopState).toEqual(loopState);
    });

    it('should emit loop clear event', () => {
      emitter.clearLoopRound('agent-1');

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('loop:clear');
      expect(events[0].agentId).toBe('agent-1');
    });
  });

  describe('checkpoint state', () => {
    it('should emit checkpoint state event', () => {
      emitter.setCheckpointState({ active: true, reason: 'Review needed' });

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('checkpoint:state');
      expect(events[0].checkpoint).toEqual({ active: true, reason: 'Review needed' });
    });

    it('should emit checkpoint clear event', () => {
      emitter.clearCheckpointState();

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('checkpoint:clear');
    });
  });

  describe('messages and UI elements', () => {
    it('should emit log message event', () => {
      emitter.logMessage('agent-1', 'Hello world');

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('message:log');
      expect(events[0].agentId).toBe('agent-1');
      expect(events[0].message).toBe('Hello world');
    });

    it('should emit UI element event', () => {
      emitter.addUIElement('Step separator', 2);

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('ui:element');
      expect(events[0].element.text).toBe('Step separator');
      expect(events[0].element.stepIndex).toBe(2);
    });
  });

  describe('monitoring registration', () => {
    it('should emit monitoring register event', () => {
      emitter.registerMonitoringId('agent-1', 42);

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('monitoring:register');
      expect(events[0].uiAgentId).toBe('agent-1');
      expect(events[0].monitoringId).toBe(42);
    });
  });

  describe('raw emit', () => {
    it('should allow raw event emission', () => {
      emitter.emit({ type: 'workflow:status', status: 'stopped' });

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('workflow:status');
    });
  });
});

describe('Integration: Emitter with workflow simulation', () => {
  it('should correctly sequence a complete workflow', () => {
    const bus = createWorkflowEventBus();
    const emitter = createWorkflowEmitter(bus);
    bus.enableHistory();

    // Start workflow
    emitter.workflowStarted('Integration Test', 2);

    // Add agents
    emitter.addMainAgent('agent-1', 'Planner', 'claude', 0, 2, 0);
    emitter.addMainAgent('agent-2', 'Coder', 'claude', 1, 2, 1);

    // Execute first agent
    emitter.updateAgentStatus('agent-1', 'running');
    emitter.logMessage('agent-1', 'Planning...');
    emitter.updateAgentTelemetry('agent-1', { tokensIn: 500, tokensOut: 200 });
    emitter.updateAgentStatus('agent-1', 'completed');

    // Execute second agent with sub-agent
    emitter.updateAgentStatus('agent-2', 'running');
    emitter.addSubAgent('agent-2', {
      id: 'sub-1',
      parentId: 'agent-2',
      name: 'Helper',
      engine: 'claude',
      status: 'running',
      telemetry: { tokensIn: 0, tokensOut: 0 },
      startTime: Date.now(),
      toolCount: 0,
      thinkingCount: 0,
    });
    emitter.updateSubAgentStatus('sub-1', 'completed');
    emitter.updateAgentStatus('agent-2', 'completed');

    // Complete workflow
    emitter.setWorkflowStatus('completed');

    // Verify event sequence
    const history = bus.getHistory();
    expect(history[0].type).toBe('workflow:started');
    expect(history[1].type).toBe('agent:added');
    expect(history[2].type).toBe('agent:added');
    expect(history[history.length - 1].type).toBe('workflow:status');

    // Verify agent status progression
    const statusEvents = bus.getHistoryByType('agent:status');
    expect(statusEvents).toHaveLength(4); // 2 running + 2 completed
  });
});
