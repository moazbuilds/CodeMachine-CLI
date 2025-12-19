/**
 * Status Bar Component
 *
 * Bottom status bar showing workflow progress and metrics.
 */

import type { JSX } from 'solid-js'
import { Box, Text } from '@anthropic-ai/claude-cli/dist/components/index.js'
import type { WorkflowMode } from '../types'

/**
 * Status bar props
 */
export interface StatusBarProps {
  /** Current mode */
  mode: WorkflowMode
  /** Current step index */
  currentStep: number
  /** Total steps */
  totalSteps: number
  /** Elapsed time in seconds */
  elapsedTime: number
  /** Total cost */
  totalCost?: number
  /** Total tokens */
  totalTokens?: number
  /** Whether workflow is paused */
  isPaused?: boolean
}

/**
 * Format elapsed time
 */
function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }
  return `${minutes}:${String(secs).padStart(2, '0')}`
}

/**
 * Status bar component
 *
 * @example
 * ```tsx
 * <StatusBar
 *   mode="manual"
 *   currentStep={2}
 *   totalSteps={5}
 *   elapsedTime={120}
 *   totalCost={0.0123}
 * />
 * ```
 */
export function StatusBar(props: StatusBarProps): JSX.Element {
  const modeLabel = () => (props.mode === 'autopilot' ? 'AUTO' : 'MANUAL')
  const modeColor = () => (props.mode === 'autopilot' ? 'green' : 'cyan')
  const progress = () =>
    props.totalSteps > 0
      ? Math.round((props.currentStep / props.totalSteps) * 100)
      : 0

  return (
    <Box
      flexDirection="row"
      justifyContent="space-between"
      paddingX={1}
      backgroundColor="gray"
    >
      {/* Left section - Mode and progress */}
      <Box flexDirection="row" gap={2}>
        <Text color={modeColor()} bold>
          [{modeLabel()}]
        </Text>
        {props.isPaused && (
          <Text color="yellow" bold>
            [PAUSED]
          </Text>
        )}
        <Text color="white">
          Step {props.currentStep}/{props.totalSteps} ({progress()}%)
        </Text>
      </Box>

      {/* Right section - Metrics */}
      <Box flexDirection="row" gap={2}>
        <Text color="white">⏱ {formatTime(props.elapsedTime)}</Text>
        {props.totalCost !== undefined && (
          <Text color="yellow">💰 ${props.totalCost.toFixed(4)}</Text>
        )}
        {props.totalTokens !== undefined && (
          <Text color="cyan">🔤 {props.totalTokens.toLocaleString()}</Text>
        )}
      </Box>
    </Box>
  )
}
