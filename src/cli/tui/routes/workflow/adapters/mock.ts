/**
 * Mock UI Adapter
 *
 * A test adapter that records events without any side effects.
 * Perfect for unit tests and integration tests.
 */

import { BaseUIAdapter } from './base.js';
import type { UIAdapterOptions } from './types.js';
import type { WorkflowEvent, WorkflowEventType } from '../../../../../workflows/events/index.js';
import type { AgentStatus, WorkflowStatus } from '../state/types.js';

/**
 * Recorded state from events
 */
export interface MockUIState {
  workflowName: string | null;
  workflowStatus: WorkflowStatus | null;
  agents: Map<string, { name: string; engine: string; status: AgentStatus }>;
  subAgents: Map<string, { name: string; parentId: string; status: AgentStatus }[]>;
  loopActive: boolean;
  checkpointActive: boolean;
  messages: { agentId: string; message: string }[];
}

/**
 * MockAdapter - Records events for testing
 *
 * Usage in tests:
 * ```typescript
 * const adapter = new MockAdapter();
 * adapter.connect(eventBus);
 * adapter.start();
 *
 * // ... run workflow ...
 *
 * // Assert on recorded events
 * expect(adapter.events).toHaveLength(10);
 * expect(adapter.getEventsByType('agent:status')).toHaveLength(4);
 * expect(adapter.state.agents.get('agent-1')?.status).toBe('completed');
 * ```
 */
export class MockAdapter extends BaseUIAdapter {
  /** All recorded events */
  events: WorkflowEvent[] = [];

  /** Derived state from events */
  state: MockUIState = this.createInitialState();

  /** Lifecycle tracking */
  startCount = 0;
  stopCount = 0;
  connectCount = 0;
  disconnectCount = 0;

  constructor(options: UIAdapterOptions = {}) {
    super(options);
  }

  private createInitialState(): MockUIState {
    return {
      workflowName: null,
      workflowStatus: null,
      agents: new Map(),
      subAgents: new Map(),
      loopActive: false,
      checkpointActive: false,
      messages: [],
    };
  }

  protected onStart(): void {
    this.startCount++;
  }

  protected onStop(): void {
    this.stopCount++;
  }

  connect(eventBus: import('../../../../../workflows/events/index.js').WorkflowEventBus): void {
    this.connectCount++;
    super.connect(eventBus);
  }

  disconnect(): void {
    this.disconnectCount++;
    super.disconnect();
  }

  protected handleEvent(event: WorkflowEvent): void {
    // Record event
    this.events.push(event);

    // Update derived state
    switch (event.type) {
      case 'workflow:started':
        this.state.workflowName = event.workflowName;
        this.state.workflowStatus = 'running';
        break;

      case 'workflow:status':
        this.state.workflowStatus = event.status;
        break;

      case 'agent:added':
        this.state.agents.set(event.agent.id, {
          name: event.agent.name,
          engine: event.agent.engine,
          status: event.agent.status,
        });
        break;

      case 'agent:status':
        const agent = this.state.agents.get(event.agentId);
        if (agent) {
          agent.status = event.status;
        }
        break;

      case 'subagent:added':
        if (!this.state.subAgents.has(event.parentId)) {
          this.state.subAgents.set(event.parentId, []);
        }
        this.state.subAgents.get(event.parentId)!.push({
          name: event.subAgent.name,
          parentId: event.parentId,
          status: event.subAgent.status,
        });
        break;

      case 'subagent:batch':
        if (!this.state.subAgents.has(event.parentId)) {
          this.state.subAgents.set(event.parentId, []);
        }
        for (const sa of event.subAgents) {
          this.state.subAgents.get(event.parentId)!.push({
            name: sa.name,
            parentId: event.parentId,
            status: sa.status,
          });
        }
        break;

      case 'loop:state':
        this.state.loopActive = event.loopState?.active ?? false;
        break;

      case 'checkpoint:state':
        this.state.checkpointActive = event.checkpoint?.active ?? false;
        break;

      case 'message:log':
        this.state.messages.push({
          agentId: event.agentId,
          message: event.message,
        });
        break;
    }
  }

  /**
   * Get all events of a specific type
   */
  getEventsByType<T extends WorkflowEventType>(
    eventType: T
  ): Extract<WorkflowEvent, { type: T }>[] {
    return this.events.filter(
      (e): e is Extract<WorkflowEvent, { type: T }> => e.type === eventType
    );
  }

  /**
   * Get last event of a specific type
   */
  getLastEventOfType<T extends WorkflowEventType>(
    eventType: T
  ): Extract<WorkflowEvent, { type: T }> | undefined {
    const events = this.getEventsByType(eventType);
    return events[events.length - 1];
  }

  /**
   * Check if any event of type exists
   */
  hasEventOfType(eventType: WorkflowEventType): boolean {
    return this.events.some((e) => e.type === eventType);
  }

  /**
   * Get agent status by ID
   */
  getAgentStatus(agentId: string): AgentStatus | undefined {
    return this.state.agents.get(agentId)?.status;
  }

  /**
   * Get all messages for an agent
   */
  getMessagesForAgent(agentId: string): string[] {
    return this.state.messages
      .filter((m) => m.agentId === agentId)
      .map((m) => m.message);
  }

  /**
   * Reset all recorded data
   */
  reset(): void {
    this.events = [];
    this.state = this.createInitialState();
    this.startCount = 0;
    this.stopCount = 0;
    this.connectCount = 0;
    this.disconnectCount = 0;
  }

  /**
   * Simulate user pressing skip (for testing user actions)
   */
  simulateSkip(): void {
    this.emitSkip();
  }

  /**
   * Simulate user pressing quit (for testing user actions)
   */
  simulateQuit(): void {
    this.emitQuit();
  }

  /**
   * Simulate user continuing from checkpoint
   */
  simulateCheckpointContinue(): void {
    this.emitCheckpointContinue();
  }

  /**
   * Simulate user quitting from checkpoint
   */
  simulateCheckpointQuit(): void {
    this.emitCheckpointQuit();
  }
}

/**
 * Factory function to create a mock adapter
 */
export function createMockAdapter(options?: UIAdapterOptions): MockAdapter {
  return new MockAdapter(options);
}
