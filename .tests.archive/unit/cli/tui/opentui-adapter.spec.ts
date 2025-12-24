import { describe, expect, it } from "bun:test"

import { createOpenTUIAdapter, type UIActions, type OpenTUIAdapter } from "../../../../src/cli/tui/routes/workflow/adapters/opentui.js"
import type { WorkflowEvent } from "../../../../src/workflows/events/types.js"

// Helper type to expose protected handleEvent for testing
type TestableAdapter = OpenTUIAdapter & {
  handleEvent(event: WorkflowEvent): void
}

type RecordedActions = {
  workflowStatus: Array<Parameters<UIActions["setWorkflowStatus"]>[0]>
  addAgent: Array<Parameters<UIActions["addAgent"]>[0]>
  logMessages: Array<{ agentId: string; message: string }>
}

function createAdapterUnderTest() {
  const { actions, recorded } = createTestActions()
  return { adapter: createOpenTUIAdapter(actions), recorded }
}

function createTestActions() {
  const recorded: RecordedActions = {
    workflowStatus: [],
    addAgent: [],
    logMessages: [],
  }

  const noop = () => {}

  const actions: UIActions = {
    addAgent: (agent) => recorded.addAgent.push(agent),
    updateAgentStatus: noop,
    updateAgentStartTime: noop,
    updateAgentDuration: noop,
    updateAgentEngine: noop,
    updateAgentModel: noop,
    updateAgentTelemetry: noop,
    setLoopState: noop,
    clearLoopRound: noop,
    addSubAgent: noop,
    batchAddSubAgents: noop,
    updateSubAgentStatus: noop,
    updateSubAgentStartTime: noop,
    updateSubAgentDuration: noop,
    clearSubAgents: noop,
    setWorkflowName: noop,
    setWorkflowStatus: (status) => recorded.workflowStatus.push(status),
    setCheckpointState: noop,
    setInputState: noop,
    setChainedState: noop,
    registerMonitoringId: noop,
    addTriggeredAgent: noop,
    resetAgentForLoop: noop,
    addUIElement: noop,
    logMessage: (agentId, message) => recorded.logMessages.push({ agentId, message }),
  }

  return { actions, recorded }
}

describe("OpenTUIAdapter", () => {
  it("routes workflow status events to the matching action", () => {
    const { adapter, recorded } = createAdapterUnderTest()

    ;(adapter as TestableAdapter).handleEvent({ type: "workflow:status", status: "stopping" })

    expect(recorded.workflowStatus).toEqual(["stopping"])
  })

  it("adds a fully initialized agent when the workflow emits agent:added", () => {
    const { adapter, recorded } = createAdapterUnderTest()
    const now = 123456
    const originalNow = Date.now

    Date.now = () => now
    try {
      ;(adapter as TestableAdapter).handleEvent({
        type: "agent:added",
        agent: {
          id: "agent-1",
          name: "Primary",
          engine: "gpt-4o",
          status: "running",
          stepIndex: 1,
          totalSteps: 3,
        },
      })
    } finally {
      Date.now = originalNow
    }

    expect(recorded.addAgent).toHaveLength(1)
    expect(recorded.addAgent[0]).toMatchObject({
      id: "agent-1",
      name: "Primary",
      engine: "gpt-4o",
      status: "running",
      telemetry: { tokensIn: 0, tokensOut: 0 },
      toolCount: 0,
      thinkingCount: 0,
      startTime: now,
      stepIndex: 1,
      totalSteps: 3,
    })
  })

  it("forwards log events to logMessage", () => {
    const { adapter, recorded } = createAdapterUnderTest()

    ;(adapter as TestableAdapter).handleEvent({ type: "message:log", agentId: "agent-1", message: "done" })

    expect(recorded.logMessages).toEqual([{ agentId: "agent-1", message: "done" }])
  })
})
