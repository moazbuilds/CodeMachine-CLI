# CodeMachine-CLI Technical Architecture

This document provides a technical overview of the CodeMachine-CLI internal architecture after the comprehensive rewrite.

## Table of Contents

1. [Layer Diagram](#layer-diagram)
2. [Layer Responsibilities](#layer-responsibilities)
3. [Data Flow](#data-flow)
4. [Event-Driven Communication](#event-driven-communication)
5. [State Management](#state-management)
6. [Key Design Decisions](#key-design-decisions)
7. [Directory Structure](#directory-structure)

---

## Layer Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         PRESENTATION LAYER                          │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  TUI (OpenTUI + SolidJS)                                    │   │
│  │  - Feature-based modules                                     │   │
│  │  - Unified state store                                       │   │
│  │  - Event subscription only (no direct calls to domain)       │   │
│  └─────────────────────────────────────────────────────────────┘   │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ Events
┌──────────────────────────────▼──────────────────────────────────────┐
│                        APPLICATION LAYER                            │
│  ┌────────────────┐  ┌────────────────┐  ┌───────────────────────┐ │
│  │ WorkflowService│  │ AgentService   │  │ TelemetryService      │ │
│  │ - orchestration│  │ - lifecycle    │  │ - metrics aggregation │ │
│  │ - commands     │  │ - coordination │  │ - cost tracking       │ │
│  └────────────────┘  └────────────────┘  └───────────────────────┘ │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────┐
│                          DOMAIN LAYER                               │
│  ┌────────────────┐  ┌────────────────┐  ┌───────────────────────┐ │
│  │ WorkflowEngine │  │ StateMachine   │  │ InputOrchestrator     │ │
│  │ - pure logic   │  │ - transitions  │  │ - provider mgmt       │ │
│  │ - no I/O       │  │ - guards       │  │ - mode switching      │ │
│  └────────────────┘  └────────────────┘  └───────────────────────┘ │
│  ┌────────────────┐  ┌────────────────┐  ┌───────────────────────┐ │
│  │ Agent          │  │ Step           │  │ Prompt                │ │
│  │ (Entity)       │  │ (Entity)       │  │ (Value Object)        │ │
│  └────────────────┘  └────────────────┘  └───────────────────────┘ │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────┐
│                       INFRASTRUCTURE LAYER                          │
│  ┌────────────────┐  ┌────────────────┐  ┌───────────────────────┐ │
│  │ StateStore     │  │ LogStreamer    │  │ EngineAdapter         │ │
│  │ - WAL pattern  │  │ - file watch   │  │ - Claude/Cursor/etc   │ │
│  │ - transactions │  │ - backpressure │  │ - unified interface   │ │
│  └────────────────┘  └────────────────┘  └───────────────────────┘ │
│  ┌────────────────┐  ┌────────────────┐  ┌───────────────────────┐ │
│  │ EventBus       │  │ Cache          │  │ ProcessManager        │ │
│  │ - async queue  │  │ - LRU + TTL    │  │ - spawn/monitor       │ │
│  │ - backpressure │  │ - invalidation │  │ - graceful shutdown   │ │
│  └────────────────┘  └────────────────┘  └───────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Layer Responsibilities

### Presentation Layer

The presentation layer handles all user interface concerns using OpenTUI and SolidJS.

**Key Principles:**
- **Event subscription only**: The TUI subscribes to events from lower layers but never calls domain logic directly
- **Feature-based organization**: Components are grouped by feature (workflow, onboarding, home) rather than by type
- **Unified state store**: A single store manages all UI state with slices for different concerns

**Components:**
- `WorkflowShell` - Main workflow execution view
- `OutputWindow` - Displays agent logs and output
- `Timeline` - Shows step progression
- `PromptLine` - Handles user input

### Application Layer

The application layer orchestrates use cases and coordinates between domain and infrastructure.

**Services:**
- `WorkflowService` - Main orchestration of workflow execution
- `AgentService` - Manages agent lifecycle (spawn, monitor, stop)
- `ResumeService` - Unified resume logic for all scenarios
- `TelemetryService` - Aggregates metrics and tracks costs

**Patterns:**
- CQRS-like separation of commands and queries
- Services are thin orchestrators, not business logic holders
- Dependency injection for testability

### Domain Layer

The domain layer contains pure business logic with no I/O operations.

**Key Components:**
- `StateMachine` - Pure state transitions returning new state + effects
- `InputOrchestrator` - Coordinates input providers and mode switching
- `StepResolver` - Determines next step logic

**Entities:**
- `Workflow` - Aggregate root for workflow execution
- `Agent` - Represents a running AI agent
- `Step` - Individual workflow step
- `Prompt` - Value object for prompt templates

**Design Principles:**
- All functions are pure (same input = same output)
- No side effects - effects are returned as data
- Easily testable without mocking

### Infrastructure Layer

The infrastructure layer handles all external concerns (I/O, persistence, processes).

**Components:**
- `WALStore` - Write-ahead log for crash-safe persistence
- `EventBus` - Async event distribution with backpressure
- `LogStreamer` - File watch-based log streaming
- `LRUCache` - Caching with TTL support
- `ProcessManager` - Spawns and monitors child processes

---

## Data Flow

### Workflow Execution Flow

```
┌──────────────┐     ┌─────────────────┐     ┌──────────────────┐
│   User/TUI   │────▶│ WorkflowService │────▶│   StateMachine   │
└──────────────┘     └─────────────────┘     └──────────────────┘
                              │                       │
                              │                       ▼
                              │              ┌──────────────────┐
                              │              │ Returns: {state, │
                              │              │   effects: [...] │
                              │              │ }                │
                              │              └──────────────────┘
                              │                       │
                              ▼                       ▼
                     ┌─────────────────┐     ┌──────────────────┐
                     │  Effect Runner  │◀────│    Effects       │
                     └─────────────────┘     └──────────────────┘
                              │
           ┌──────────────────┼──────────────────┐
           ▼                  ▼                  ▼
    ┌────────────┐    ┌────────────┐    ┌────────────────┐
    │ WALStore   │    │ EventBus   │    │ ProcessManager │
    │ (persist)  │    │ (notify)   │    │ (execute)      │
    └────────────┘    └────────────┘    └────────────────┘
```

### Event Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        EVENT PRODUCERS                          │
│  StateMachine  │  AgentService  │  LogStreamer  │  User Input  │
└───────┬────────────────┬───────────────┬──────────────┬────────┘
        │                │               │              │
        ▼                ▼               ▼              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         EVENT BUS                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │
│  │ High Pri │  │ Normal   │  │ Low Pri  │  │ Backpressure │   │
│  │ Queue    │  │ Queue    │  │ Queue    │  │ Control      │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────┘   │
└───────┬────────────────┬───────────────┬──────────────┬────────┘
        │                │               │              │
        ▼                ▼               ▼              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       EVENT CONSUMERS                           │
│     TUI      │   Telemetry   │   Logger    │   StateStore      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Event-Driven Communication

The system uses an event-driven architecture for loose coupling between layers.

### Event Categories

| Category | Examples | Priority |
|----------|----------|----------|
| Workflow | `WORKFLOW_STARTED`, `STEP_COMPLETED`, `WORKFLOW_STOPPED` | High |
| Agent | `AGENT_SPAWNED`, `AGENT_OUTPUT`, `AGENT_EXITED` | Normal |
| Input | `MODE_CHANGED`, `INPUT_RECEIVED`, `INPUT_TIMEOUT` | High |
| Telemetry | `METRICS_UPDATED`, `COST_TRACKED` | Low |

### Event Subscription Pattern

```typescript
// Subscribers declare their requirements
eventBus.subscribe('STEP_COMPLETED', async (event) => {
  // Handle step completion
}, {
  maxConcurrent: 1,      // Process one at a time
  bufferSize: 100,       // Queue up to 100 events
  priority: 'high'       // High priority lane
})
```

### Backpressure Handling

When consumers can't keep up:
1. Events queue in priority lanes
2. Buffer limits prevent memory exhaustion
3. Slow consumers don't block fast producers
4. Metrics track queue depth for monitoring

---

## State Management

### Workflow State (Domain)

The workflow state machine is pure and deterministic:

```typescript
type WorkflowState =
  | { status: 'idle' }
  | { status: 'running'; stepIndex: number; startedAt: number }
  | { status: 'waiting'; stepIndex: number; waitingFor: WaitReason }
  | { status: 'completed'; completedAt: number }
  | { status: 'stopped'; stoppedAt: number; reason: string }
  | { status: 'error'; error: WorkflowError }
```

State transitions return both new state and effects:

```typescript
const { state: newState, effects } = transition(currentState, event, context)
// Effects are executed separately by infrastructure layer
```

### UI State (Presentation)

The TUI uses a unified store with slices:

```typescript
interface AppState {
  workflow: WorkflowSlice    // Current workflow state
  agents: AgentsSlice        // Agent list and statuses
  ui: UISlice                // Scroll position, selections
  modals: ModalsSlice        // Modal visibility and data
}
```

### Persistence (Infrastructure)

The WAL store ensures crash-safe persistence:

```
┌─────────────────────────────────────────────────┐
│                  WAL Store                       │
│                                                 │
│  ┌─────────────┐    ┌─────────────────────┐   │
│  │ Write-Ahead │───▶│ Checkpoint (JSON)   │   │
│  │ Log (.wal)  │    │ state.json          │   │
│  └─────────────┘    └─────────────────────┘   │
│        │                     │                 │
│        ▼                     ▼                 │
│  On crash: replay    Normal read: use         │
│  WAL to recover      checkpoint                │
└─────────────────────────────────────────────────┘
```

---

## Key Design Decisions

### 1. Pure State Machine

**Decision**: State machine returns effects as data instead of executing them.

**Rationale**:
- 100% testable without mocks
- Predictable behavior
- Easy to add new effects
- Clear separation of "what" from "how"

### 2. Event-Driven Architecture

**Decision**: Layers communicate through events, not direct calls.

**Rationale**:
- Loose coupling between components
- TUI can't accidentally block workflow execution
- Easy to add new consumers (logging, telemetry)
- Natural async boundaries

### 3. Input Provider Pattern

**Decision**: Abstract input sources behind a provider interface.

**Rationale**:
- Clean switching between user and autopilot modes
- No race conditions during mode transitions
- Easy to add new input sources
- Testable input handling

### 4. Feature-Based TUI Organization

**Decision**: Organize TUI by feature instead of by component type.

**Rationale**:
- Related code lives together
- Easier to understand feature scope
- Better code locality
- Simpler imports

### 5. WAL for Persistence

**Decision**: Use write-ahead logging instead of direct JSON writes.

**Rationale**:
- Crash recovery without data loss
- Atomic multi-key updates
- Better performance for frequent writes
- Transaction support

### 6. Modular Keyboard Handling

**Decision**: Split keyboard handling into composable hooks.

**Rationale**:
- Each hook is focused and testable
- Easy to enable/disable key groups
- No monolithic switch statements
- Context-aware key handling

---

## Directory Structure

```
src/
├── domain/                      # Pure business logic (no I/O)
│   ├── workflow/
│   │   ├── state-machine/       # Pure FSM
│   │   │   ├── machine.ts
│   │   │   ├── states.ts
│   │   │   ├── events.ts
│   │   │   └── guards.ts
│   │   └── services/
│   │       └── step-resolver.ts
│   │
│   ├── agent/
│   │   └── entities/
│   │       └── agent.ts
│   │
│   └── input/
│       ├── input-orchestrator.ts
│       └── providers/
│           ├── provider.interface.ts
│           ├── user-provider.ts
│           └── autopilot-provider.ts
│
├── application/                  # Use cases & orchestration
│   └── services/
│       ├── workflow-service.ts
│       ├── agent-service.ts
│       ├── resume-service.ts
│       └── telemetry-service.ts
│
├── infrastructure/               # External concerns
│   ├── persistence/
│   │   └── state-store/
│   │       ├── wal-store.ts
│   │       └── json-store.ts
│   │
│   ├── streaming/
│   │   └── log-streamer.ts
│   │
│   ├── events/
│   │   └── event-bus.ts
│   │
│   ├── cache/
│   │   └── lru-cache.ts
│   │
│   └── process/
│       └── process-manager.ts
│
├── presentation/                 # TUI layer
│   ├── store/
│   │   ├── index.ts
│   │   └── slices/
│   │       ├── workflow.slice.ts
│   │       ├── agents.slice.ts
│   │       └── ui.slice.ts
│   │
│   ├── features/
│   │   ├── home/
│   │   ├── onboarding/
│   │   └── workflow/
│   │       ├── components/
│   │       ├── hooks/
│   │       └── index.tsx
│   │
│   └── hooks/
│       └── keyboard/
│           ├── useNavigationKeys.ts
│           ├── useActionKeys.ts
│           └── useGlobalShortcuts.ts
│
├── shared/                       # Cross-cutting concerns
│   ├── types/
│   ├── errors/
│   ├── logging/
│   └── utils/
│
└── bootstrap/                    # Application startup
    ├── cli.ts
    └── config.ts
```

---

## Testing Strategy

### Unit Tests (Domain Layer)

Pure functions are tested without mocks:

```typescript
describe('StateMachine', () => {
  it('transitions from idle to running', () => {
    const { state, effects } = transition(
      { status: 'idle' },
      { type: 'START', steps: mockSteps },
      context
    )
    expect(state.status).toBe('running')
    expect(effects).toContainEqual({ type: 'EXECUTE_STEP', stepIndex: 0 })
  })
})
```

### Integration Tests (Application Layer)

Test service orchestration with minimal mocks:

```typescript
describe('WorkflowService', () => {
  it('executes complete workflow', async () => {
    const workflow = await workflowService.start(template)
    await waitFor(() => workflow.status === 'completed')
    expect(workflow.completedSteps).toBe(3)
  })
})
```

### E2E Tests (Full System)

Test CLI commands and TUI flows:

```typescript
describe('CLI', () => {
  it('runs workflow from template', async () => {
    const result = await execCli(['run', 'test-workflow.yaml'])
    expect(result.exitCode).toBe(0)
  })
})
```

---

## Performance Considerations

### Streaming Optimization

- File watch instead of polling (50ms vs 500ms latency)
- Chunk-based reading for large log files
- Backpressure prevents memory exhaustion

### Caching Strategy

- LRU cache with TTL for prompt templates
- Memoized selectors for derived UI state
- Cache invalidation on relevant events

### UI Rendering

- Batched updates (16ms debounce for 60fps)
- Virtual scrolling for long lists
- Selective re-renders using fine-grained reactivity

---

## Related Documentation

- [API Reference](./API.md) - Detailed API documentation
- [Migration Guide](./MIGRATION.md) - Migrating from old architecture
- [Rewrite Progress](./REWRITE_PROGRESS.md) - Implementation status
