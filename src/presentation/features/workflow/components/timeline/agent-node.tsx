/**
 * Agent Node Component
 *
 * Display node for an agent in the timeline.
 */

import type { JSX } from 'solid-js'
import { Box, Text } from '@anthropic-ai/claude-cli/dist/components/index.js'
import type { AgentDisplayInfo, AgentDisplayStatus } from '../../types'

/**
 * Agent node props
 */
export interface AgentNodeProps {
  /** Agent display info */
  agent: AgentDisplayInfo
  /** Whether the agent is selected */
  isSelected: boolean
  /** Called when agent is selected */
  onSelect?: () => void
}

/**
 * Get status icon
 */
function getStatusIcon(status: AgentDisplayStatus): string {
  switch (status) {
    case 'running':
      return '●'
    case 'paused':
      return '‖'
    case 'completed':
      return '✓'
    case 'failed':
      return '✗'
    case 'waiting':
      return '○'
    default:
      return '○'
  }
}

/**
 * Get status color
 */
function getStatusColor(status: AgentDisplayStatus): string {
  switch (status) {
    case 'running':
      return 'green'
    case 'paused':
      return 'yellow'
    case 'completed':
      return 'cyan'
    case 'failed':
      return 'red'
    case 'waiting':
      return 'yellow'
    default:
      return 'gray'
  }
}

/**
 * Format duration in seconds to human readable
 */
function formatDuration(seconds?: number): string {
  if (seconds === undefined) return ''

  if (seconds < 60) {
    return `${seconds}s`
  }

  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60

  if (minutes < 60) {
    return `${minutes}m ${remainingSeconds}s`
  }

  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60

  return `${hours}h ${remainingMinutes}m`
}

/**
 * Agent node component
 *
 * @example
 * ```tsx
 * <AgentNode
 *   agent={agentInfo}
 *   isSelected={isSelected}
 *   onSelect={handleSelect}
 * />
 * ```
 */
export function AgentNode(props: AgentNodeProps): JSX.Element {
  const statusIcon = () => getStatusIcon(props.agent.status)
  const statusColor = () => getStatusColor(props.agent.status)

  return (
    <Box
      flexDirection="row"
      gap={1}
      paddingX={1}
      backgroundColor={props.isSelected ? 'blue' : undefined}
    >
      {/* Selection indicator */}
      <Text color={props.isSelected ? 'cyan' : 'gray'}>
        {props.isSelected ? '›' : ' '}
      </Text>

      {/* Status icon */}
      <Text color={statusColor()}>{statusIcon()}</Text>

      {/* Agent name */}
      <Text
        color={props.isSelected ? 'white' : 'gray'}
        bold={props.agent.isMain}
      >
        {props.agent.name}
      </Text>

      {/* Duration (if available) */}
      {props.agent.duration !== undefined && (
        <Text color="gray" dimColor>
          {formatDuration(props.agent.duration)}
        </Text>
      )}

      {/* Cost (if available) */}
      {props.agent.cost !== undefined && (
        <Text color="yellow" dimColor>
          ${props.agent.cost.toFixed(4)}
        </Text>
      )}
    </Box>
  )
}
