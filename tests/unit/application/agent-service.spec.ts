import { describe, expect, it, beforeEach, mock } from 'bun:test'

import {
  AgentService,
  createAgentService,
} from '../../../src/application/services/agent-service'
import { createEventBus, type IEventBus } from '../../../src/infrastructure/events/event-bus'
import type { AgentId, AgentStatus } from '../../../src/shared/types'
import type { AllDomainEvents } from '../../../src/infrastructure/events/event-types'

// ============================================================================
// Test Helpers
// ============================================================================

const createTestAgentId = (suffix: string): AgentId => `agent-${suffix}` as AgentId

interface TestContext {
  eventBus: IEventBus
  agentService: AgentService
  events: AllDomainEvents[]
}

const createTestContext = (): TestContext => {
  const eventBus = createEventBus()
  const events: AllDomainEvents[] = []

  // Capture agent events
  const eventTypes: AllDomainEvents['type'][] = [
    'agent:added',
    'agent:status-changed',
    'agent:telemetry',
    'agent:session',
    'subagent:added',
    'subagent:batch',
    'subagent:status-changed',
  ]

  for (const type of eventTypes) {
    eventBus.subscribe(type, (event) => {
      events.push(event as AllDomainEvents)
    })
  }

  const agentService = createAgentService({ eventBus })

  return { eventBus, agentService, events }
}

// ============================================================================
// Tests
// ============================================================================

describe('AgentService', () => {
  let ctx: TestContext

  beforeEach(() => {
    ctx = createTestContext()
  })

  describe('Agent Creation', () => {
    it('creates an agent with correct properties', () => {
      const agent = ctx.agentService.createAgent({
        id: createTestAgentId('1'),
        name: 'Test Agent',
        engine: 'claude',
        stepIndex: 0,
      })

      expect(agent.id).toBe('agent-1')
      expect(agent.name).toBe('Test Agent')
      expect(agent.engine).toBe('claude')
      expect(agent.stepIndex).toBe(0)
      expect(agent.status).toBe('pending')
    })

    it('emits agent:added event on creation', () => {
      ctx.agentService.createAgent({
        id: createTestAgentId('2'),
        name: 'Test Agent 2',
        engine: 'cursor',
        stepIndex: 1,
      })

      const addedEvent = ctx.events.find(e => e.type === 'agent:added')
      expect(addedEvent).toBeDefined()
      if (addedEvent?.type === 'agent:added') {
        expect(addedEvent.agentId).toBe('agent-2')
        expect(addedEvent.name).toBe('Test Agent 2')
      }
    })

    it('creates agent with optional model', () => {
      const agent = ctx.agentService.createAgent({
        id: createTestAgentId('3'),
        name: 'Test Agent',
        engine: 'claude',
        stepIndex: 0,
        model: 'claude-3-opus',
      })

      expect(agent.model).toBe('claude-3-opus')
    })
  })

  describe('Agent Retrieval', () => {
    it('retrieves agent by ID', () => {
      const created = ctx.agentService.createAgent({
        id: createTestAgentId('4'),
        name: 'Retrievable Agent',
        engine: 'claude',
        stepIndex: 0,
      })

      const retrieved = ctx.agentService.getAgent(createTestAgentId('4'))
      expect(retrieved).toBeDefined()
      expect(retrieved?.id).toBe(created.id)
    })

    it('returns undefined for non-existent agent', () => {
      const agent = ctx.agentService.getAgent(createTestAgentId('non-existent'))
      expect(agent).toBeUndefined()
    })

    it('retrieves agent by step index', () => {
      ctx.agentService.createAgent({
        id: createTestAgentId('5'),
        name: 'Step Agent',
        engine: 'claude',
        stepIndex: 3,
      })

      const agent = ctx.agentService.getAgentByStep(3)
      expect(agent).toBeDefined()
      expect(agent?.stepIndex).toBe(3)
    })

    it('gets all agents', () => {
      ctx.agentService.createAgent({
        id: createTestAgentId('6'),
        name: 'Agent 1',
        engine: 'claude',
        stepIndex: 0,
      })

      ctx.agentService.createAgent({
        id: createTestAgentId('7'),
        name: 'Agent 2',
        engine: 'cursor',
        stepIndex: 1,
      })

      const agents = ctx.agentService.getAllAgents()
      expect(agents.length).toBe(2)
    })
  })

  describe('Status Updates', () => {
    it('updates agent status to running', () => {
      ctx.agentService.createAgent({
        id: createTestAgentId('8'),
        name: 'Status Agent',
        engine: 'claude',
        stepIndex: 0,
      })

      const updated = ctx.agentService.updateStatus(createTestAgentId('8'), 'running')
      expect(updated.status).toBe('running')
      expect(updated.startedAt).toBeDefined()
    })

    it('updates agent status to completed', () => {
      ctx.agentService.createAgent({
        id: createTestAgentId('9'),
        name: 'Completing Agent',
        engine: 'claude',
        stepIndex: 0,
      })

      ctx.agentService.updateStatus(createTestAgentId('9'), 'running')
      const updated = ctx.agentService.updateStatus(createTestAgentId('9'), 'completed')

      expect(updated.status).toBe('completed')
      expect(updated.completedAt).toBeDefined()
    })

    it('updates agent status to error', () => {
      ctx.agentService.createAgent({
        id: createTestAgentId('10'),
        name: 'Error Agent',
        engine: 'claude',
        stepIndex: 0,
      })

      const updated = ctx.agentService.updateStatus(createTestAgentId('10'), 'error')
      expect(updated.status).toBe('error')
    })

    it('emits status-changed event', () => {
      ctx.agentService.createAgent({
        id: createTestAgentId('11'),
        name: 'Event Agent',
        engine: 'claude',
        stepIndex: 0,
      })

      ctx.agentService.updateStatus(createTestAgentId('11'), 'running')

      const statusEvent = ctx.events.find(e => e.type === 'agent:status-changed')
      expect(statusEvent).toBeDefined()
      if (statusEvent?.type === 'agent:status-changed') {
        expect(statusEvent.currentStatus).toBe('running')
        expect(statusEvent.previousStatus).toBe('pending')
      }
    })

    it('throws error for non-existent agent', () => {
      expect(() => {
        ctx.agentService.updateStatus(createTestAgentId('non-existent'), 'running')
      }).toThrow()
    })
  })

  describe('Session Management', () => {
    it('sets agent session', () => {
      ctx.agentService.createAgent({
        id: createTestAgentId('12'),
        name: 'Session Agent',
        engine: 'claude',
        stepIndex: 0,
      })

      const updated = ctx.agentService.setSession(
        createTestAgentId('12'),
        'session-123' as any,
        456 as any
      )

      expect(updated.sessionId).toBe('session-123')
      expect(updated.monitoringId).toBe(456)
    })

    it('emits session event', () => {
      ctx.agentService.createAgent({
        id: createTestAgentId('13'),
        name: 'Session Event Agent',
        engine: 'claude',
        stepIndex: 0,
      })

      ctx.agentService.setSession(
        createTestAgentId('13'),
        'session-456' as any,
        789 as any
      )

      const sessionEvent = ctx.events.find(e => e.type === 'agent:session')
      expect(sessionEvent).toBeDefined()
    })
  })

  describe('Telemetry', () => {
    it('adds telemetry to agent', () => {
      ctx.agentService.createAgent({
        id: createTestAgentId('14'),
        name: 'Telemetry Agent',
        engine: 'claude',
        stepIndex: 0,
      })

      const updated = ctx.agentService.addTelemetry(createTestAgentId('14'), {
        tokensIn: 100,
        tokensOut: 50,
        cost: 0.01,
      })

      expect(updated.telemetry.tokensIn).toBe(100)
      expect(updated.telemetry.tokensOut).toBe(50)
      expect(updated.telemetry.cost).toBe(0.01)
    })

    it('accumulates telemetry', () => {
      ctx.agentService.createAgent({
        id: createTestAgentId('15'),
        name: 'Accumulating Agent',
        engine: 'claude',
        stepIndex: 0,
      })

      ctx.agentService.addTelemetry(createTestAgentId('15'), {
        tokensIn: 100,
        tokensOut: 50,
        cost: 0.01,
      })

      const updated = ctx.agentService.addTelemetry(createTestAgentId('15'), {
        tokensIn: 200,
        tokensOut: 100,
        cost: 0.02,
      })

      expect(updated.telemetry.tokensIn).toBe(300)
      expect(updated.telemetry.tokensOut).toBe(150)
      expect(updated.telemetry.cost).toBeCloseTo(0.03, 10)
    })

    it('emits telemetry event', () => {
      ctx.agentService.createAgent({
        id: createTestAgentId('16'),
        name: 'Telemetry Event Agent',
        engine: 'claude',
        stepIndex: 0,
      })

      ctx.agentService.addTelemetry(createTestAgentId('16'), {
        tokensIn: 100,
        tokensOut: 50,
        cost: 0.01,
      })

      const telemetryEvent = ctx.events.find(e => e.type === 'agent:telemetry')
      expect(telemetryEvent).toBeDefined()
    })
  })

  describe('Sub-Agent Management', () => {
    it('adds sub-agent to parent', () => {
      ctx.agentService.createAgent({
        id: createTestAgentId('17'),
        name: 'Parent Agent',
        engine: 'claude',
        stepIndex: 0,
      })

      const subAgent = ctx.agentService.addSubAgent(
        createTestAgentId('17'),
        createTestAgentId('sub-1'),
        'Sub Agent 1',
        'claude-3-haiku'
      )

      expect(subAgent.id).toBe('agent-sub-1')
      expect(subAgent.name).toBe('Sub Agent 1')
      expect(subAgent.parentId).toBe('agent-17')
    })

    it('emits subagent:added event', () => {
      ctx.agentService.createAgent({
        id: createTestAgentId('18'),
        name: 'Parent Agent',
        engine: 'claude',
        stepIndex: 0,
      })

      ctx.agentService.addSubAgent(
        createTestAgentId('18'),
        createTestAgentId('sub-2'),
        'Sub Agent 2'
      )

      const subAgentEvent = ctx.events.find(e => e.type === 'subagent:added')
      expect(subAgentEvent).toBeDefined()
    })

    it('adds batch of sub-agents', () => {
      ctx.agentService.createAgent({
        id: createTestAgentId('19'),
        name: 'Parent Agent',
        engine: 'claude',
        stepIndex: 0,
      })

      ctx.agentService.addSubAgentBatch(createTestAgentId('19'), [
        { id: createTestAgentId('sub-3'), name: 'Sub 3' },
        { id: createTestAgentId('sub-4'), name: 'Sub 4' },
        { id: createTestAgentId('sub-5'), name: 'Sub 5' },
      ])

      const parent = ctx.agentService.getAgent(createTestAgentId('19'))
      expect(parent?.subAgents.length).toBe(3)
    })

    it('emits subagent:batch event', () => {
      ctx.agentService.createAgent({
        id: createTestAgentId('20'),
        name: 'Parent Agent',
        engine: 'claude',
        stepIndex: 0,
      })

      ctx.agentService.addSubAgentBatch(createTestAgentId('20'), [
        { id: createTestAgentId('sub-6'), name: 'Sub 6' },
        { id: createTestAgentId('sub-7'), name: 'Sub 7' },
      ])

      const batchEvent = ctx.events.find(e => e.type === 'subagent:batch')
      expect(batchEvent).toBeDefined()
      if (batchEvent?.type === 'subagent:batch') {
        expect(batchEvent.subAgents.length).toBe(2)
      }
    })

    it('updates sub-agent status', () => {
      ctx.agentService.createAgent({
        id: createTestAgentId('21'),
        name: 'Parent Agent',
        engine: 'claude',
        stepIndex: 0,
      })

      ctx.agentService.addSubAgent(
        createTestAgentId('21'),
        createTestAgentId('sub-8'),
        'Sub Agent 8'
      )

      ctx.agentService.updateSubAgentStatus(
        createTestAgentId('21'),
        createTestAgentId('sub-8'),
        'running'
      )

      const statusEvent = ctx.events.find(e => e.type === 'subagent:status-changed')
      expect(statusEvent).toBeDefined()
    })

    it('clears sub-agents', () => {
      ctx.agentService.createAgent({
        id: createTestAgentId('22'),
        name: 'Parent Agent',
        engine: 'claude',
        stepIndex: 0,
      })

      ctx.agentService.addSubAgentBatch(createTestAgentId('22'), [
        { id: createTestAgentId('sub-9'), name: 'Sub 9' },
        { id: createTestAgentId('sub-10'), name: 'Sub 10' },
      ])

      ctx.agentService.clearSubAgents(createTestAgentId('22'))

      const parent = ctx.agentService.getAgent(createTestAgentId('22'))
      expect(parent?.subAgents.length).toBe(0)
    })
  })

  describe('Queries', () => {
    beforeEach(() => {
      // Create agents with various statuses
      ctx.agentService.createAgent({
        id: createTestAgentId('q1'),
        name: 'Running Agent',
        engine: 'claude',
        stepIndex: 0,
      })
      ctx.agentService.updateStatus(createTestAgentId('q1'), 'running')

      ctx.agentService.createAgent({
        id: createTestAgentId('q2'),
        name: 'Completed Agent',
        engine: 'claude',
        stepIndex: 1,
      })
      ctx.agentService.updateStatus(createTestAgentId('q2'), 'completed')

      ctx.agentService.createAgent({
        id: createTestAgentId('q3'),
        name: 'Error Agent',
        engine: 'claude',
        stepIndex: 2,
      })
      ctx.agentService.updateStatus(createTestAgentId('q3'), 'error')

      ctx.agentService.createAgent({
        id: createTestAgentId('q4'),
        name: 'Pending Agent',
        engine: 'claude',
        stepIndex: 3,
      })
    })

    it('gets running agents', () => {
      const running = ctx.agentService.getRunningAgents()
      expect(running.length).toBe(1)
      expect(running[0].status).toBe('running')
    })

    it('gets completed agents', () => {
      const completed = ctx.agentService.getCompletedAgents()
      expect(completed.length).toBe(1)
      expect(completed[0].status).toBe('completed')
    })

    it('gets error agents', () => {
      const errors = ctx.agentService.getErrorAgents()
      expect(errors.length).toBe(1)
      expect(errors[0].status).toBe('error')
    })

    it('calculates total telemetry', () => {
      ctx.agentService.addTelemetry(createTestAgentId('q1'), {
        tokensIn: 100,
        tokensOut: 50,
        cost: 0.01,
      })

      ctx.agentService.addTelemetry(createTestAgentId('q2'), {
        tokensIn: 200,
        tokensOut: 100,
        cost: 0.02,
      })

      const total = ctx.agentService.getTotalTelemetry()
      expect(total.tokensIn).toBe(300)
      expect(total.tokensOut).toBe(150)
      expect(total.cost).toBeCloseTo(0.03, 10)
    })
  })

  describe('Cleanup', () => {
    it('clears all agents', () => {
      ctx.agentService.createAgent({
        id: createTestAgentId('c1'),
        name: 'Agent 1',
        engine: 'claude',
        stepIndex: 0,
      })

      ctx.agentService.createAgent({
        id: createTestAgentId('c2'),
        name: 'Agent 2',
        engine: 'claude',
        stepIndex: 1,
      })

      ctx.agentService.clear()

      const agents = ctx.agentService.getAllAgents()
      expect(agents.length).toBe(0)
    })

    it('removes specific agent', () => {
      ctx.agentService.createAgent({
        id: createTestAgentId('r1'),
        name: 'Agent 1',
        engine: 'claude',
        stepIndex: 0,
      })

      ctx.agentService.createAgent({
        id: createTestAgentId('r2'),
        name: 'Agent 2',
        engine: 'claude',
        stepIndex: 1,
      })

      ctx.agentService.removeAgent(createTestAgentId('r1'))

      const agents = ctx.agentService.getAllAgents()
      expect(agents.length).toBe(1)
      expect(agents[0].id).toBe('agent-r2')
    })
  })
})
