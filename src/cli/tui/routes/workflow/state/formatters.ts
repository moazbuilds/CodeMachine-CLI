/**
 * Formatting utilities for workflow display
 *
 * Note: Time/duration formatting has been moved to the unified TimerService
 * at @tui/shared/services/timer.ts
 */

export function formatNumber(num: number): string {
  return num.toLocaleString()
}

export function formatTokens(total: number): string {
  if (total >= 1000000) return `${(total / 1000000).toFixed(1)}M`
  if (total >= 1000) return `${(total / 1000).toFixed(1)}K`
  return `${total}`
}

export function formatCost(cost: number): string {
  return `$${cost.toFixed(4)}`
}

export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString()
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str
  return str.substring(0, maxLength - 3) + "..."
}
