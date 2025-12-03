/**
 * Sub-Agent Sync Hook
 *
 * Polls AgentMonitorService to discover tool-spawned sub-agents
 * and syncs them to the UI state.
 */

import { onMount, onCleanup } from "solid-js"
import { AgentMonitorService, convertChildrenToSubAgents } from "../../../../../agents/monitoring/index.js"
import type { UIActions } from "../adapters/opentui"
import type { EngineType } from "../../../../../infra/engines/core/types.js"

interface AgentInfo {
  id: string
  monitoringId?: number
  engine: EngineType | string
}

/**
 * Hook to sync tool-spawned sub-agents from AgentMonitorService to UI state
 *
 * @param getState - Function to get current agents with their monitoring IDs
 * @param actions - UI actions to update state
 * @param pollInterval - How often to poll (default: 1000ms)
 */
export function useSubAgentSync(
  getState: () => { agents: AgentInfo[] },
  actions: Pick<UIActions, "batchAddSubAgents">,
  pollInterval = 1000
) {
  let intervalId: ReturnType<typeof setInterval> | null = null

  onMount(() => {
    const monitor = AgentMonitorService.getInstance()

    const syncSubAgents = () => {
      const agents = getState().agents

      for (const agent of agents) {
        if (!agent.monitoringId) continue

        const children = monitor.getChildren(agent.monitoringId)
        if (children.length === 0) continue

        // Convert monitoring records to UI sub-agent state
        // Pass agent.id as uiParentId to correctly key in subAgents Map
        const subAgents = convertChildrenToSubAgents(
          children,
          agent.id,
          agent.engine as EngineType
        )

        if (subAgents.length > 0) {
          actions.batchAddSubAgents(agent.id, subAgents)
        }
      }
    }

    syncSubAgents() // Initial sync
    intervalId = setInterval(syncSubAgents, pollInterval)
  })

  onCleanup(() => {
    if (intervalId) clearInterval(intervalId)
  })
}
