# CodeMachine-CLI API Reference

This document provides a comprehensive API reference for the new architecture components.

## Table of Contents

- [Domain Layer](#domain-layer)
  - [State Machine](#state-machine)
  - [Input Orchestrator](#input-orchestrator)
  - [Entities](#entities)
- [Application Services](#application-services)
  - [WorkflowService](#workflowservice)
  - [AgentService](#agentservice)
  - [ResumeService](#resumeservice)
  - [TelemetryService](#telemetryservice)
- [Infrastructure](#infrastructure)
  - [Event Bus](#event-bus)
  - [LRU Cache](#lru-cache)
  - [Log Streamer](#log-streamer)
  - [WAL Store](#wal-store)
- [Presentation Hooks](#presentation-hooks)
  - [Keyboard Hooks](#keyboard-hooks)
  - [Feature Hooks](#feature-hooks)

---

## Domain Layer

### State Machine

**Location:** `src/domain/workflow/state-machine/`

The state machine is a pure function that handles workflow state transitions without side effects.

#### States

```typescript
type WorkflowState =
  | { status: 'idle' }
  | { status: 'running'; stepIndex: number; mode: WorkflowMode; startedAt: number }
  | { status: 'waiting'; stepIndex: number; waitingFor: WaitReason }
  | { status: 'paused'; stepIndex: number; pausedAt: number }
  | { status: 'completed'; stepIndex: number; completedAt: number }
  | { status: 'stopped'; stepIndex: number; stoppedAt: number; reason: string }
  | { status: 'error'; stepIndex: number; error: WorkflowError }
```

#### Events

```typescript
type WorkflowEvent =
  | { type: 'START'; totalSteps: number; mode?: WorkflowMode; startIndex?: number }
  | { type: 'STEP_COMPLETE'; output?: string }
  | { type: 'STEP_ERROR'; error: WorkflowError }
  | { type: 'INPUT_RECEIVED'; input: string }
  | { type: 'SKIP' }
  | { type: 'STOP'; reason?: string }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'SET_MODE'; mode: WorkflowMode }
  | { type: 'START_LOOP'; iterations?: number }
  | { type: 'END_LOOP' }
```

#### Transition Function

```typescript
function transition(
  state: WorkflowState,
  event: WorkflowEvent,
  context: WorkflowContext
): TransitionResult

interface TransitionResult {
  state: WorkflowState
  effects: Effect[]
}
```

#### Effects

```typescript
type Effect =
  | { type: 'PERSIST_STATE'; state: WorkflowState }
  | { type: 'EXECUTE_STEP'; stepIndex: number }
  | { type: 'EMIT_EVENT'; event: DomainEvent }
  | { type: 'REQUEST_INPUT'; prompt?: string }
  | { type: 'LOG'; message: string; level: LogLevel }
```

#### Usage Example

```typescript
import { createIdleState, transition } from '@/domain/workflow/state-machine'

const state = createIdleState()
const event = { type: 'START', totalSteps: 5, mode: 'manual' }
const context = { totalSteps: 5 }

const { state: newState, effects } = transition(state, event, context)
// newState.status === 'running'
// effects contains PERSIST_STATE, EXECUTE_STEP, EMIT_EVENT
```

---

### Input Orchestrator

**Location:** `src/domain/input/`

Manages input providers and mode switching between user and autopilot modes.

#### InputOrchestrator

```typescript
class InputOrchestrator {
  constructor(eventBus: AsyncEventBus)

  // Get current mode
  getMode(): InputMode

  // Switch between modes (handles cleanup of current provider)
  async switchMode(mode: InputMode): Promise<void>

  // Request input from current provider
  async requestInput(prompt: InputPrompt): Promise<InputResult>

  // Abort current input request
  async abort(): Promise<void>

  // Clean up all resources
  async dispose(): Promise<void>
}
```

#### Input Providers

**UserInputProvider:**
```typescript
class UserInputProvider implements InputProvider {
  // Initialize provider
  async initialize(): Promise<void>

  // Request input from user
  async requestInput(prompt: InputPrompt): Promise<InputResult>

  // Submit input programmatically
  submitInput(input: string): void

  // Submit action (skip, stop, etc.)
  submitAction(action: InputAction): void

  // Abort current request
  async abort(): Promise<void>

  // Clean up
  async dispose(): Promise<void>
}
```

**AutopilotInputProvider:**
```typescript
class AutopilotInputProvider implements InputProvider {
  constructor(options?: AutopilotOptions)

  // Same interface as UserInputProvider
  // Automatically generates input based on previous output
}

interface AutopilotOptions {
  maxConsecutiveSteps?: number  // Default: 50
  stepDelay?: number            // Default: 100ms
  errorPatterns?: RegExp[]      // Patterns to detect errors
}
```

---

### Entities

#### Workflow Entity

**Location:** `src/domain/workflow/entities/workflow.ts`

```typescript
interface Workflow {
  id: WorkflowId
  name: string
  steps: Step[]
  status: WorkflowStatus
  mode: WorkflowMode
  currentStepIndex: number
  startedAt?: number
  completedAt?: number
  metadata: WorkflowMetadata
}

// Operations (return new Workflow instance)
function startWorkflow(workflow: Workflow, mode?: WorkflowMode): Workflow
function completeStep(workflow: Workflow, output?: string): Workflow
function pauseWorkflow(workflow: Workflow): Workflow
function resumeWorkflow(workflow: Workflow): Workflow
function stopWorkflow(workflow: Workflow, reason?: string): Workflow
function setWorkflowError(workflow: Workflow, error: WorkflowError): Workflow

// Queries
function getCurrentStep(workflow: Workflow): Step | undefined
function hasMoreSteps(workflow: Workflow): boolean
function isWorkflowComplete(workflow: Workflow): boolean
function getWorkflowProgress(workflow: Workflow): number
```

#### Step Entity

**Location:** `src/domain/workflow/entities/step.ts`

```typescript
interface Step {
  id: StepId
  index: number
  name: string
  type: StepType
  config: StepConfig
  state: StepState
}

interface StepState {
  status: StepStatus
  output?: string
  error?: StepError
  startedAt?: number
  completedAt?: number
  chainedPrompts?: ChainedPrompt[]
}
```

#### Agent Entity

**Location:** `src/domain/agent/entities/agent.ts`

```typescript
interface Agent {
  id: AgentId
  name: string
  type: AgentType
  status: AgentStatus
  sessionId?: string
  telemetry: AgentTelemetry
  subAgents: SubAgent[]
  startedAt?: number
  completedAt?: number
}

// Operations
function createAgent(config: AgentConfig): Agent
function startAgent(agent: Agent, sessionId: string): Agent
function updateAgentStatus(agent: Agent, status: AgentStatus): Agent
function addSubAgent(agent: Agent, subAgent: SubAgent): Agent
function updateTelemetry(agent: Agent, telemetry: Partial<AgentTelemetry>): Agent
function completeAgent(agent: Agent): Agent
```

---

## Application Services

### WorkflowService

**Location:** `src/application/services/workflow-service.ts`

Main orchestration service for workflow execution.

```typescript
class WorkflowService {
  constructor(
    stateMachine: StateMachine,
    inputOrchestrator: InputOrchestrator,
    stateStore: StateStore,
    eventBus: AsyncEventBus
  )

  // Lifecycle
  async start(workflow: Workflow, options?: StartOptions): Promise<void>
  async pause(): Promise<void>
  async resume(): Promise<void>
  async stop(reason?: string): Promise<void>
  async skip(): Promise<void>

  // Mode control
  async setMode(mode: WorkflowMode): Promise<void>
  getMode(): WorkflowMode

  // State queries
  getState(): WorkflowState
  getCurrentStep(): Step | undefined
  isRunning(): boolean
  isPaused(): boolean

  // Event subscription
  on<T extends DomainEvent>(type: string, handler: (event: T) => void): Unsubscribe

  // Cleanup
  async dispose(): Promise<void>
}

interface StartOptions {
  mode?: WorkflowMode
  startIndex?: number
  resumeStrategy?: ResumeStrategy
}
```

---

### AgentService

**Location:** `src/application/services/agent-service.ts`

Manages agent lifecycle and tracking.

```typescript
class AgentService {
  constructor(eventBus: AsyncEventBus)

  // Agent management
  createAgent(config: AgentConfig): Agent
  getAgent(id: AgentId): Agent | undefined
  getAllAgents(): Agent[]
  getActiveAgents(): Agent[]

  // Lifecycle
  startAgent(id: AgentId, sessionId: string): void
  updateStatus(id: AgentId, status: AgentStatus): void
  completeAgent(id: AgentId): void
  failAgent(id: AgentId, error: AgentError): void

  // Sub-agent management
  addSubAgent(agentId: AgentId, subAgent: SubAgent): void
  updateSubAgentStatus(agentId: AgentId, subAgentId: string, status: AgentStatus): void

  // Telemetry
  updateTelemetry(id: AgentId, telemetry: Partial<AgentTelemetry>): void
  getAggregateTelemetry(): AggregateTelemetry

  // Cleanup
  clearAll(): void
  dispose(): void
}
```

---

### ResumeService

**Location:** `src/application/services/resume-service.ts`

Determines the appropriate resume strategy for workflows.

```typescript
class ResumeService {
  // Determine how to resume a workflow
  determineStrategy(
    workflow: Workflow,
    stepIndex: number,
    persistedState?: PersistedState
  ): ResumeStrategy
}

type ResumeStrategy =
  | { type: 'fresh' }
  | { type: 'chain-resume'; chainIndex: number; sessionId: string }
  | { type: 'pause-resume'; sessionId: string; pausedAt: number }
  | { type: 'crash-recovery'; lastKnownState: StepState }
  | { type: 'fallback-first'; fallbackAgent: string; then: ResumeStrategy }

// Strategy precedence (highest to lowest):
// 1. pause-resume - Explicit pause state
// 2. chain-resume - Incomplete chained prompts
// 3. crash-recovery - Unexpected termination
// 4. fallback-first - Fallback agent configured
// 5. fresh - No resume needed
```

---

### TelemetryService

**Location:** `src/application/services/telemetry-service.ts`

Tracks metrics, costs, and token usage.

```typescript
class TelemetryService {
  constructor()

  // Recording
  recordTokenUsage(stepId: StepId, usage: TokenUsage): void
  recordCost(stepId: StepId, cost: number): void
  recordCacheHit(stepId: StepId): void
  recordCacheMiss(stepId: StepId): void
  startDuration(stepId: StepId): void
  endDuration(stepId: StepId): void

  // Queries
  getStepTelemetry(stepId: StepId): StepTelemetry | undefined
  getAggregateTelemetry(): AggregateTelemetry
  getTotalCost(): number
  getTotalTokens(): number
  getCacheHitRate(): number

  // Cleanup
  clear(): void
}

interface AggregateTelemetry {
  totalTokens: number
  totalCost: number
  totalDuration: number
  cacheHits: number
  cacheMisses: number
  stepCount: number
}
```

---

## Infrastructure

### Event Bus

**Location:** `src/infrastructure/events/event-bus.ts`

Async event bus with backpressure support.

```typescript
class AsyncEventBus {
  constructor(options?: EventBusOptions)

  // Publishing
  emit<T extends DomainEvent>(event: T): void

  // Subscribing
  subscribe<T extends DomainEvent>(
    type: T['type'],
    handler: (event: T) => Promise<void> | void,
    options?: SubscribeOptions
  ): Unsubscribe

  // Subscribe to all events
  subscribeAll(
    handler: (event: DomainEvent) => Promise<void> | void,
    options?: SubscribeOptions
  ): Unsubscribe

  // Graceful shutdown
  async drain(timeout?: number): Promise<void>

  // Metrics
  getMetrics(): EventBusMetrics

  // Cleanup
  clear(): void
}

interface SubscribeOptions {
  maxConcurrent?: number   // Default: 1
  bufferSize?: number      // Default: 100
  priority?: 'high' | 'normal' | 'low'
}

interface EventBusMetrics {
  totalEmitted: number
  totalProcessed: number
  totalDropped: number
  queueDepths: Map<string, number>
}
```

#### Event Types

```typescript
type DomainEvent =
  // Workflow events
  | { type: 'WORKFLOW_STARTED'; workflowId: string; mode: WorkflowMode }
  | { type: 'WORKFLOW_PAUSED'; workflowId: string }
  | { type: 'WORKFLOW_RESUMED'; workflowId: string }
  | { type: 'WORKFLOW_STOPPED'; workflowId: string; reason?: string }
  | { type: 'WORKFLOW_COMPLETED'; workflowId: string }
  | { type: 'WORKFLOW_ERROR'; workflowId: string; error: WorkflowError }

  // Step events
  | { type: 'STEP_STARTED'; stepId: string; stepIndex: number }
  | { type: 'STEP_COMPLETED'; stepId: string; output?: string }
  | { type: 'STEP_SKIPPED'; stepId: string }
  | { type: 'STEP_ERROR'; stepId: string; error: StepError }

  // Agent events
  | { type: 'AGENT_CREATED'; agentId: string; agentType: string }
  | { type: 'AGENT_STARTED'; agentId: string; sessionId: string }
  | { type: 'AGENT_STATUS_CHANGED'; agentId: string; status: AgentStatus }
  | { type: 'AGENT_COMPLETED'; agentId: string }

  // Input events
  | { type: 'MODE_CHANGED'; mode: InputMode }
  | { type: 'INPUT_REQUESTED'; prompt: string }
  | { type: 'INPUT_RECEIVED'; input: string }
```

---

### LRU Cache

**Location:** `src/infrastructure/cache/lru-cache.ts`

LRU cache with TTL support and memoization helpers.

```typescript
class LRUCache<T> {
  constructor(options: CacheOptions)

  // Basic operations
  get(key: string): T | undefined
  set(key: string, value: T, ttl?: number): void
  has(key: string): boolean
  delete(key: string): boolean

  // Bulk operations
  clear(): void
  invalidatePattern(pattern: RegExp): number

  // Metrics
  getMetrics(): CacheMetrics
  getSize(): number
}

interface CacheOptions {
  maxSize: number           // Maximum entries
  defaultTtl?: number       // Default TTL in ms
  onEvict?: (key: string, value: T) => void
}

interface CacheMetrics {
  hits: number
  misses: number
  evictions: number
  size: number
  hitRate: number
}
```

#### Memoization Helpers

```typescript
// Sync memoization
function memoize<T extends (...args: any[]) => any>(
  fn: T,
  options?: MemoizeOptions
): T

// Async memoization with deduplication
function memoizeAsync<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options?: MemoizeOptions
): T

interface MemoizeOptions {
  maxSize?: number
  ttl?: number
  keyFn?: (...args: any[]) => string
}
```

---

### Log Streamer

**Location:** `src/infrastructure/streaming/log-streamer.ts`

File-based log streaming with backpressure.

```typescript
class LogStreamer {
  constructor(options?: StreamerOptions)

  // Start streaming a log file
  stream(logPath: string): AsyncGenerator<LogChunk>

  // Stop streaming
  stop(): void

  // Check if streaming
  isStreaming(): boolean

  // Get current position
  getPosition(): number
}

interface StreamerOptions {
  pollInterval?: number    // Fallback poll interval (ms)
  chunkSize?: number       // Max bytes per chunk
}

interface LogChunk {
  data: string
  position: number
  timestamp: number
}
```

#### Usage Example

```typescript
const streamer = new LogStreamer()

for await (const chunk of streamer.stream('/path/to/log')) {
  console.log(chunk.data)
  // Natural backpressure - waits for processing
}
```

---

### WAL Store

**Location:** `src/infrastructure/persistence/state-store/wal-store.ts`

Write-ahead log based state store for crash-safe persistence.

```typescript
class WALStore implements StateStore {
  constructor(options: WALStoreOptions)

  // Transactions
  async transaction<T>(fn: (tx: Transaction) => T): Promise<T>

  // Direct access
  async get<T>(key: string): Promise<T | null>
  async getSnapshot(): Promise<Record<string, unknown>>

  // Recovery
  async recover(): Promise<void>
  async compact(): Promise<void>

  // Lifecycle
  async close(): Promise<void>
}

interface Transaction {
  get<T>(key: string): T | null
  set(key: string, value: unknown): void
  delete(key: string): void
}

interface WALStoreOptions {
  directory: string         // Storage directory
  fsync?: boolean          // Sync to disk (default: true)
  compactThreshold?: number // Entries before compaction
}
```

---

## Presentation Hooks

### Keyboard Hooks

**Location:** `src/presentation/hooks/keyboard/`

Composable keyboard handling system.

#### useKeyBindings

```typescript
function useKeyBindings(manager?: KeyBindingManager): UseKeyBindingsResult

interface UseKeyBindingsResult {
  addBinding: (binding: KeyBinding) => Unsubscribe
  removeBinding: (key: KeyName, modifiers?: Modifiers) => void
  setEnabled: (key: KeyName, enabled: boolean) => void
  getBindings: () => KeyBinding[]
}

interface KeyBinding {
  key: KeyName
  handler: (event: KeyEvent) => void | boolean
  modifiers?: { ctrl?: boolean; shift?: boolean; meta?: boolean; alt?: boolean }
  description?: string
  enabled?: boolean | (() => boolean)
  priority?: number
}
```

#### useNavigationKeys

```typescript
function useNavigationKeys(options: UseNavigationKeysOptions): Unsubscribe[]

interface UseNavigationKeysOptions {
  actions: {
    navigateUp: () => void
    navigateDown: () => void
    navigateLeft?: () => void
    navigateRight?: () => void
    jumpToFirst?: () => void
    jumpToLast?: () => void
    pageUp?: () => void
    pageDown?: () => void
  }
  enabled?: boolean | (() => boolean)
}
```

#### useActionKeys

```typescript
function useActionKeys(options: UseActionKeysOptions): Unsubscribe[]

interface UseActionKeysOptions {
  handlers: {
    onEnter?: () => void
    onEscape?: () => void
    onSpace?: () => void
    onBackspace?: () => void
    onDelete?: () => void
  }
  enabled?: boolean | (() => boolean)
}
```

#### useGlobalShortcuts

```typescript
function useGlobalShortcuts(options: UseGlobalShortcutsOptions): Unsubscribe[]

interface UseGlobalShortcutsOptions {
  handlers: {
    onCtrlS?: () => void      // Skip/Save
    onCtrlC?: () => void      // Copy/Cancel
    onCtrlP?: () => void      // Pause
    onCtrlQ?: () => void      // Quit
    onShiftTab?: () => void   // Toggle mode
    onTab?: () => void        // Toggle panel
  }
}
```

#### useModalKeys

```typescript
function useModalKeys(options: UseModalKeysOptions): Unsubscribe[]

interface UseModalKeysOptions {
  handlers: {
    onClose?: () => void
    onConfirm?: () => void
    onYes?: () => void
    onNo?: () => void
  }
  isOpen: boolean | (() => boolean)
}
```

---

### Feature Hooks

#### Home Feature

**Location:** `src/presentation/features/home/hooks/`

```typescript
// State management
function useHomeState(options?: UseHomeStateOptions): UseHomeStateResult

interface UseHomeStateResult {
  state: HomeState
  actions: HomeActions
  commands: HomeCommand[]
}

// Keyboard handling
function useHomeKeyboard(options: UseHomeKeyboardOptions): Unsubscribe[]
```

#### Workflow Feature

**Location:** `src/presentation/features/workflow/hooks/`

```typescript
// State management
function useWorkflowState(options?: UseWorkflowStateOptions): UseWorkflowStateResult

interface UseWorkflowStateResult {
  state: WorkflowScreenState
  actions: WorkflowScreenActions
}

// Keyboard handling
function useWorkflowKeyboard(options: UseWorkflowKeyboardOptions): Unsubscribe[]
```

#### Onboarding Feature

**Location:** `src/presentation/features/onboarding/hooks/`

```typescript
// State management
function useOnboardingState(options?: UseOnboardingStateOptions): UseOnboardingStateResult

interface UseOnboardingStateResult {
  state: OnboardingState
  actions: OnboardingActions
  currentStep: OnboardingStep
  canGoBack: boolean
  canGoForward: boolean
}

// Keyboard handling
function useOnboardingKeyboard(options: UseOnboardingKeyboardOptions): Unsubscribe[]
```

---

### Shared Hooks

**Location:** `src/presentation/features/shared/hooks/`

```typescript
// Modal state management
function useModal(initialOpen?: boolean): ModalState
function useModalWithData<T>(initialOpen?: boolean): ModalStateWithData<T>

// List navigation
function useListNavigation(options: UseListNavigationOptions): ListNavigationState

// Interval management
function useInterval(options: UseIntervalOptions): IntervalState
function useTick(callback: () => void, delay: number): void
```
