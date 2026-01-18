/**
 * Initial State Factory
 */

import type { WorkflowState } from "./types"
import packageJson from "../../../../../../../package.json" with { type: "json" }
import { calculateVisibleItems } from "../../constants"

/**
 * Get initial visible item count based on actual terminal dimensions
 */
function getInitialVisibleItemCount(): number {
  const termHeight = process.stdout.rows ?? 30
  return calculateVisibleItems(termHeight)
}

/**
 * Create initial workflow UI state
 */
export function createInitialState(workflowName: string, totalSteps = 0): WorkflowState {
  return {
    workflowName,
    version: packageJson.version,
    packageName: packageJson.name,
    view: 'executing',
    startTime: Date.now(),
    agents: [],
    subAgents: new Map(),
    triggeredAgents: [],
    separators: [],
    executionHistory: [],
    loopState: null,
    checkpointState: null,
    inputState: null,
    chainedState: null,
    expandedNodes: new Set(),
    showTelemetryView: false,
    timelineCollapsed: false,
    selectedAgentId: null,
    selectedSubAgentId: null,
    selectedItemType: null,
    visibleItemCount: getInitialVisibleItemCount(),
    scrollOffset: 0,
    totalSteps,
    workflowStatus: "running",
    agentIdMapVersion: 0,
    agentLogs: new Map(),
    autonomousMode: "pending",
    controllerState: null,
  }
}
