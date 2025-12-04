/**
 * Registry Sync Hook for OpenTUI/SolidJS
 * Ported from: src/ui/hooks/useRegistrySync.ts
 *
 * Syncs with agent registry in real-time to get agent tree structure
 */

import { createSignal, createEffect, onCleanup } from "solid-js"
import { AgentMonitorService, type AgentTreeNode } from "../../../../../agents/monitoring/index.js"

/**
 * Ultra-lightweight comparison of agent trees
 * Only checks root count and first agent timestamp
 */
function getTreeSignature(tree: AgentTreeNode[]): string {
  if (tree.length === 0) {
    return "0:0"
  }

  const count = tree.length
  const firstAgent = tree[0]?.agent
  const timestamp = firstAgent ? new Date(firstAgent.startTime).getTime() : 0

  return `${count}:${timestamp}`
}

export interface RegistrySyncResult {
  tree: AgentTreeNode[]
  isLoading: boolean
}

/**
 * Hook to sync with agent registry in real-time
 * Polls the registry every 2000ms to get latest agent tree structure
 */
export function useRegistrySync(): RegistrySyncResult {
  const [tree, setTree] = createSignal<AgentTreeNode[]>([])
  const [isLoading, setIsLoading] = createSignal(true)
  let lastSignature = ""

  createEffect(() => {
    const monitor = AgentMonitorService.getInstance()

    const loadTree = () => {
      try {
        const agentTree = monitor.buildAgentTree()
        const currentSignature = getTreeSignature(agentTree)

        if (currentSignature !== lastSignature) {
          lastSignature = currentSignature
          setTree(agentTree)
        }

        setIsLoading(false)
      } catch {
        const emptySignature = "0:0"
        if (lastSignature !== emptySignature) {
          lastSignature = emptySignature
          setTree([])
        }
        setIsLoading(false)
      }
    }

    loadTree()

    // Poll every 2000ms for live updates
    const pollInterval = 2000 + Math.random() * 200
    const interval = setInterval(loadTree, pollInterval)

    onCleanup(() => clearInterval(interval))
  })

  return {
    get tree() {
      return tree()
    },
    get isLoading() {
      return isLoading()
    },
  }
}
