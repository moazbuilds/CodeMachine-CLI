/**
 * Unified Timer Service
 *
 * Single source of truth for all workflow and agent timing.
 * Manages pause/resume, provides formatted durations, and handles subscriptions.
 */

import { createSignal, onCleanup } from "solid-js"

// ============================================================================
// Types
// ============================================================================

export type TimerStatus = "idle" | "running" | "paused" | "stopped"
export type PauseReason = "user" | "awaiting" | "checkpoint"

interface AgentTimer {
  id: string
  startTime: number
  endTime?: number
  // Track pause state per-agent for accurate elapsed calculation
  pausedAt?: number
  totalPausedTime: number
}

// ============================================================================
// Format Utilities
// ============================================================================

/**
 * Format seconds into HH:MM:SS or MM:SS string
 */
function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(s / 3600)
  const minutes = Math.floor((s % 3600) / 60)
  const secs = s % 60

  if (hours > 0) {
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  return `${minutes.toString().padStart(2, "0")}:${secs
    .toString()
    .padStart(2, "0")}`
}

// ============================================================================
// Timer Service Class
// ============================================================================

class TimerService {
  // Workflow timing
  private workflowStartTime: number = 0
  private workflowEndTime?: number
  private workflowPausedAt?: number
  private workflowTotalPausedTime: number = 0

  // Status
  private status: TimerStatus = "idle"
  private pauseReason?: PauseReason

  // Agent timers
  private agents: Map<string, AgentTimer> = new Map()

  // Tick system
  private interval: ReturnType<typeof setInterval> | null = null
  private currentTime: number = Date.now()
  private listeners: Set<() => void> = new Set()

  // ============================================================================
  // Lifecycle Methods
  // ============================================================================

  /**
   * Start the timer (called automatically on first agent registration)
   */
  start(): void {
    if (this.status !== "idle") return

    this.workflowStartTime = Date.now()
    this.workflowEndTime = undefined
    this.workflowPausedAt = undefined
    this.workflowTotalPausedTime = 0
    this.status = "running"

    this.startTicking()
    this.notifyListeners()
  }

  /**
   * Stop the timer (workflow completed/stopped)
   */
  stop(): void {
    if (this.status === "idle" || this.status === "stopped") return

    // If currently paused, add final pause duration
    if (this.workflowPausedAt) {
      this.workflowTotalPausedTime += Date.now() - this.workflowPausedAt
      this.workflowPausedAt = undefined
    }

    this.workflowEndTime = Date.now()
    this.status = "stopped"

    // Clear all running agents
    this.agents.clear()

    this.stopTicking()
    this.notifyListeners()
  }

  /**
   * Pause the timer (checkpoint, awaiting input, etc.)
   */
  pause(reason: PauseReason): void {
    if (this.status !== "running") return

    const now = Date.now()
    this.workflowPausedAt = now
    this.pauseReason = reason
    this.status = "paused"

    // Pause all running agents
    for (const agent of this.agents.values()) {
      if (!agent.endTime && !agent.pausedAt) {
        agent.pausedAt = now
      }
    }

    this.notifyListeners()
  }

  /**
   * Resume the timer
   */
  resume(): void {
    if (this.status !== "paused") return

    const now = Date.now()

    // Add pause duration to workflow total
    if (this.workflowPausedAt) {
      this.workflowTotalPausedTime += now - this.workflowPausedAt
      this.workflowPausedAt = undefined
    }

    this.pauseReason = undefined
    this.status = "running"

    // Resume all paused agents
    for (const agent of this.agents.values()) {
      if (agent.pausedAt && !agent.endTime) {
        agent.totalPausedTime += now - agent.pausedAt
        agent.pausedAt = undefined
      }
    }

    this.notifyListeners()
  }

  /**
   * Reset the timer for a new workflow
   */
  reset(): void {
    this.stopTicking()

    this.workflowStartTime = 0
    this.workflowEndTime = undefined
    this.workflowPausedAt = undefined
    this.workflowTotalPausedTime = 0
    this.status = "idle"
    this.pauseReason = undefined
    this.agents.clear()

    this.notifyListeners()
  }

  // ============================================================================
  // Agent Management
  // ============================================================================

  /**
   * Register an agent when it starts running
   * Auto-starts workflow timer on first agent
   */
  registerAgent(id: string): void {
    // Auto-start workflow on first agent
    if (this.status === "idle") {
      this.start()
    }

    const agent: AgentTimer = {
      id,
      startTime: Date.now(),
      totalPausedTime: 0,
    }

    // If workflow is paused, start agent in paused state
    if (this.status === "paused") {
      agent.pausedAt = Date.now()
    }

    this.agents.set(id, agent)
    this.notifyListeners()
  }

  /**
   * Complete an agent - returns duration in seconds and removes from tracking
   */
  completeAgent(id: string): number {
    const agent = this.agents.get(id)
    if (!agent) return 0

    const now = Date.now()

    // Add any pending pause time
    let pausedTime = agent.totalPausedTime
    if (agent.pausedAt) {
      pausedTime += now - agent.pausedAt
    }

    const durationSeconds = (now - agent.startTime - pausedTime) / 1000

    // Remove from tracking
    this.agents.delete(id)
    this.notifyListeners()

    return Math.max(0, durationSeconds)
  }

  /**
   * Check if an agent is currently running
   */
  hasAgent(id: string): boolean {
    return this.agents.has(id)
  }

  // ============================================================================
  // Getters (Formatted Strings)
  // ============================================================================

  /**
   * Get formatted workflow runtime (e.g., "00:05:23")
   */
  getWorkflowRuntime(): string {
    if (this.status === "idle" || this.workflowStartTime === 0) {
      return "00:00"
    }

    const endTime = this.workflowEndTime ?? this.getEffectiveNow()
    let pausedTime = this.workflowTotalPausedTime

    // Add current pause duration if paused
    if (this.workflowPausedAt) {
      pausedTime += this.getEffectiveNow() - this.workflowPausedAt
    }

    const elapsed = (endTime - this.workflowStartTime - pausedTime) / 1000
    return formatDuration(elapsed)
  }

  /**
   * Get formatted agent duration (e.g., "00:00:45")
   */
  getAgentDuration(id: string): string {
    const agent = this.agents.get(id)
    if (!agent) return ""

    // Completed agent - use fixed duration
    if (agent.endTime) {
      const elapsed = (agent.endTime - agent.startTime - agent.totalPausedTime) / 1000
      return formatDuration(elapsed)
    }

    // Not started yet
    if (agent.startTime <= 0) {
      return ""
    }

    // Running agent - calculate live duration
    let pausedTime = agent.totalPausedTime

    // Add current pause duration if paused
    if (agent.pausedAt) {
      pausedTime += this.getEffectiveNow() - agent.pausedAt
    }

    const elapsed = (this.getEffectiveNow() - agent.startTime - pausedTime) / 1000
    return formatDuration(Math.max(0, elapsed))
  }

  // ============================================================================
  // Status Getters
  // ============================================================================

  getStatus(): TimerStatus {
    return this.status
  }

  isPaused(): boolean {
    return this.status === "paused"
  }

  isRunning(): boolean {
    return this.status === "running"
  }

  isStopped(): boolean {
    return this.status === "stopped"
  }

  getPauseReason(): PauseReason | undefined {
    return this.pauseReason
  }

  /**
   * Get current time (for reactivity)
   */
  getCurrentTime(): number {
    return this.currentTime
  }

  // ============================================================================
  // Subscription System
  // ============================================================================

  /**
   * Subscribe to timer updates
   * @returns unsubscribe function
   */
  subscribe(callback: () => void): () => void {
    this.listeners.add(callback)

    // Start ticking if this is the first subscriber and timer is running
    if (this.listeners.size === 1 && this.status === "running") {
      this.startTicking()
    }

    return () => {
      this.listeners.delete(callback)

      // Stop ticking if no more subscribers
      if (this.listeners.size === 0) {
        this.stopTicking()
      }
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private getEffectiveNow(): number {
    return this.currentTime
  }

  private startTicking(): void {
    if (this.interval) return

    this.currentTime = Date.now()
    this.interval = setInterval(() => {
      this.currentTime = Date.now()
      this.notifyListeners()
    }, 1000)
  }

  private stopTicking(): void {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener()
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const timerService = new TimerService()

// ============================================================================
// SolidJS Hook
// ============================================================================

/**
 * Hook to use the timer service in SolidJS components.
 * Automatically subscribes to updates and triggers re-renders.
 */
export function useTimer() {
  const [tick, setTick] = createSignal(0)

  // Subscribe immediately (not in onMount) to catch early updates
  const unsubscribe = timerService.subscribe(() => {
    setTick((t) => t + 1)
  })

  // Clean up on component unmount
  onCleanup(unsubscribe)

  return {
    // Formatted strings - include tick() to create reactive dependency
    workflowRuntime: () => {
      tick() // Create reactive dependency
      return timerService.getWorkflowRuntime()
    },
    agentDuration: (id: string) => {
      tick() // Create reactive dependency
      return timerService.getAgentDuration(id)
    },

    // Status
    status: () => {
      tick()
      return timerService.getStatus()
    },
    isPaused: () => {
      tick()
      return timerService.isPaused()
    },
    isRunning: () => {
      tick()
      return timerService.isRunning()
    },
    isStopped: () => {
      tick()
      return timerService.isStopped()
    },
    pauseReason: () => {
      tick()
      return timerService.getPauseReason()
    },

    // Direct service access for imperative calls
    service: timerService,
  }
}

// ============================================================================
// Exports
// ============================================================================

export { formatDuration }
