/**
 * History Tree Utilities
 *
 * Flatten tree structure for rendering and navigation.
 */

import type { AgentRecord } from "../../../../../../../agents/monitoring/types.js"
import type { AgentTreeNode } from "../../../../../../../agents/monitoring/index.js"

/**
 * Flattened agent item with nesting metadata
 */
export interface FlattenedAgent {
  agent: AgentRecord
  depth: number
  isLast: boolean
  parentIsLast: boolean[]
}

/**
 * Flatten tree structure for rendering and navigation
 */
export function flattenTree(tree: AgentTreeNode[]): FlattenedAgent[] {
  const result: FlattenedAgent[] = []

  function traverse(nodes: AgentTreeNode[], depth: number, parentIsLast: boolean[]) {
    // Reverse nodes so latest appears first
    const reversedNodes = [...nodes].reverse()
    reversedNodes.forEach((node, index) => {
      const isLast = index === reversedNodes.length - 1

      result.push({
        agent: node.agent,
        depth,
        isLast,
        parentIsLast,
      })

      if (node.children.length > 0) {
        traverse(node.children, depth + 1, [...parentIsLast, isLast])
      }
    })
  }

  traverse(tree, 0, [])
  return result
}

/**
 * Format duration in milliseconds to readable string
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) {
    return `${seconds}s`
  }
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}m ${remainingSeconds}s`
}
