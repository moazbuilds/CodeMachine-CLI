# Migration Guide

This guide helps developers migrate from the old CodeMachine-CLI architecture to the new rewritten architecture.

## Table of Contents

1. [Overview](#overview)
2. [Key Changes](#key-changes)
3. [File Mapping](#file-mapping)
4. [Pattern Changes](#pattern-changes)
5. [Step-by-Step Migration](#step-by-step-migration)
6. [Common Patterns](#common-patterns)
7. [Testing Migration](#testing-migration)

---

## Overview

The architecture rewrite introduces several fundamental changes:

| Aspect | Old Architecture | New Architecture |
|--------|------------------|------------------|
| State Machine | Mixed logic + side effects | Pure functions + effects |
| Event Handling | Synchronous dispatch | Async event bus with backpressure |
| State Persistence | Direct JSON writes | WAL-based transactional store |
| Log Streaming | Polling-based | File watch with backpressure |
| TUI Organization | By component type | By feature |
| Input Handling | Multiple scattered handlers | Unified input orchestrator |

---

## Key Changes

### 1. State Machine is Now Pure

**Old Pattern:**
```typescript
// Old: Side effects mixed in
class WorkflowStateMachine {
  transition(event: WorkflowEvent) {
    // Direct state mutation
    this.state.status = 'running'

    // Side effect inside transition
    await this.persistState()

    // Another side effect
    this.eventBus.emit('workflow:started')
  }
}
```

**New Pattern:**
```typescript
// New: Pure function returns effects
function transition(
  state: WorkflowState,
  event: WorkflowEvent,
  context: WorkflowContext
): { state: WorkflowState; effects: Effect[] } {
  // Returns new state (no mutation)
  const newState = { ...state, status: 'running' }

  // Returns effects as data (no execution)
  const effects = [
    { type: 'PERSIST_STATE', state: newState },
    { type: 'EMIT_EVENT', event: { type: 'WORKFLOW_STARTED' } }
  ]

  return { state: newState, effects }
}
```

### 2. Event Bus is Async with Backpressure

**Old Pattern:**
```typescript
// Old: Synchronous, no backpressure
eventBus.emit('step:completed', { stepIndex: 0 })
// All handlers executed synchronously
```

**New Pattern:**
```typescript
// New: Async with backpressure control
eventBus.emit({ type: 'STEP_COMPLETED', stepIndex: 0 })

// Subscribers control their own concurrency
eventBus.subscribe('STEP_COMPLETED', handler, {
  maxConcurrent: 1,
  bufferSize: 100,
  priority: 'high'
})
```

### 3. State Persistence is Transactional

**Old Pattern:**
```typescript
// Old: Direct JSON write (can corrupt on crash)
fs.writeFileSync('state.json', JSON.stringify(state))
```

**New Pattern:**
```typescript
// New: Atomic transaction
await store.transaction(async (tx) => {
  tx.set('step.0.completed', true)
  tx.set('step.0.completedAt', Date.now())
  // All or nothing - crash-safe
})
```

### 4. Input Handling is Unified

**Old Pattern:**
```typescript
// Old: Multiple scattered handlers
if (mode === 'user') {
  userInputHandler.handle(input)
} else if (mode === 'autopilot') {
  autopilotHandler.handle(input)
}
// Race conditions during mode switch
```

**New Pattern:**
```typescript
// New: Single orchestrator
inputOrchestrator.switchMode('autopilot')
// Clean transition, no race conditions
```

---

## File Mapping

### Core Files

| Old Location | New Location |
|--------------|--------------|
| `src/workflows/state/machine.ts` | `src/workflows/state/machine.ts` (refactored) |
| `src/workflows/execution/runner.ts` | `src/workflows/execution/runner.ts` (refactored) |
| `src/workflows/execution/resume.ts` | `src/workflows/execution/runner.ts` (merged) |

### TUI Files

| Old Location | New Location |
|--------------|--------------|
| `src/cli/tui/routes/workflow/workflow-shell.tsx` | Same (refactored) |
| `src/cli/tui/routes/workflow/components/*` | Same (refactored) |
| `src/cli/tui/routes/workflow/hooks/*` | Same + new hooks added |

### Infrastructure

| Old Location | New Location |
|--------------|--------------|
| Direct JSON writes | `src/shared/workflows/steps.ts` (state operations) |
| Polling log reader | `src/cli/tui/routes/workflow/hooks/useLogStream.ts` |
| Event emitters | `src/shared/formatters/outputMarkers.ts` |

---

## Pattern Changes

### Resume Logic Consolidation

**Before**: Resume logic spread across 4+ files with different code paths.

**After**: Single `determineResumeStrategy()` function with clear strategy types:

```typescript
type ResumeStrategy =
  | { type: 'fresh' }                    // New workflow
  | { type: 'chain-resume'; ... }        // Continue existing chain
  | { type: 'pause-resume'; ... }        // Resume from pause
  | { type: 'crash-recovery'; ... }      // Recover from crash
```

### Keyboard Handling

**Before**: Large monolithic `useKeyboardNavigation` hook with many responsibilities.

**After**: Composed from smaller focused hooks:

```typescript
// Old
function useKeyboardNavigation() {
  // 200+ lines handling all keys
}

// New
function useWorkflowKeyboard() {
  useNavigationKeys()      // Arrow keys, tab
  useActionKeys()          // Enter, escape
  useGlobalShortcuts()     // Shift+tab, ctrl+c
}
```

### Log Streaming

**Before**: Polling-based with high CPU usage.

**After**: File watch-based with natural backpressure:

```typescript
// Old
setInterval(async () => {
  const content = await fs.readFile(logPath)
  // Parse and display
}, 500)

// New
const watcher = fs.watch(logPath)
watcher.on('change', async () => {
  // Only read new content
  const chunk = await readFromPosition(logPath, lastPosition)
  // Process chunk
})
```

---

## Step-by-Step Migration

### Step 1: Update State Machine Calls

Replace direct state machine calls with the new transition pattern:

```typescript
// Find code like this:
stateMachine.transition({ type: 'START' })

// Replace with:
const { state, effects } = transition(currentState, { type: 'START' }, context)
// Then execute effects
for (const effect of effects) {
  await executeEffect(effect)
}
```

### Step 2: Update Event Subscriptions

Migrate from synchronous to async event handling:

```typescript
// Find:
eventBus.on('step:completed', (data) => {
  // handler
})

// Replace with:
eventBus.subscribe('STEP_COMPLETED', async (event) => {
  // handler
}, { priority: 'normal' })
```

### Step 3: Update State Persistence

Replace direct JSON operations:

```typescript
// Find:
const state = JSON.parse(fs.readFileSync('state.json'))
fs.writeFileSync('state.json', JSON.stringify(newState))

// Replace with:
import { loadWorkflowState, saveWorkflowState } from '../shared/workflows/steps'

const state = await loadWorkflowState(workflowDir)
await saveWorkflowState(workflowDir, newState)
```

### Step 4: Update Input Mode Switching

Use the new input orchestrator:

```typescript
// Find scattered mode checks:
if (this.mode === 'autopilot') { ... }

// Replace with orchestrator:
inputOrchestrator.switchMode('autopilot')
inputOrchestrator.getInput() // Returns input from active provider
```

### Step 5: Update Keyboard Handlers

Split large keyboard hooks:

```typescript
// Find large keyboard hooks and split into:
// - useNavigationKeys.ts
// - useActionKeys.ts
// - useGlobalShortcuts.ts
```

---

## Common Patterns

### Adding a New State Transition

```typescript
// 1. Add event type
type WorkflowEvent =
  | { type: 'MY_NEW_EVENT'; data: MyData }
  | ...

// 2. Add transition handler in machine.ts
case 'MY_NEW_EVENT':
  return {
    state: { ...state, myProperty: event.data },
    effects: [
      { type: 'EMIT_EVENT', event: { type: 'MY_EVENT_PROCESSED' } }
    ]
  }

// 3. Add effect handler if needed
case 'MY_CUSTOM_EFFECT':
  await handleMyEffect(effect)
  break
```

### Adding a New Event Subscriber

```typescript
// In your component or service
eventBus.subscribe('MY_EVENT', async (event) => {
  // Handle event
  console.log('Event received:', event)
}, {
  priority: 'normal',
  maxConcurrent: 1
})
```

### Adding a New Input Provider

```typescript
// 1. Implement the interface
class MyCustomProvider implements InputProvider {
  async getInput(prompt: Prompt): Promise<string> {
    // Custom input logic
  }

  abort(): void {
    // Cleanup
  }
}

// 2. Register with orchestrator
inputOrchestrator.registerProvider('custom', new MyCustomProvider())
```

---

## Testing Migration

### Unit Tests

The new architecture makes unit testing much simpler:

```typescript
// Old: Required mocking
const mockEventBus = { emit: jest.fn() }
const mockStore = { save: jest.fn() }

// New: Pure functions, no mocks needed
describe('transition', () => {
  it('returns correct state and effects', () => {
    const { state, effects } = transition(
      { status: 'idle' },
      { type: 'START' },
      context
    )

    expect(state.status).toBe('running')
    expect(effects).toContainEqual({
      type: 'EXECUTE_STEP',
      stepIndex: 0
    })
  })
})
```

### Integration Tests

Test full workflows with real infrastructure:

```typescript
describe('Workflow Execution', () => {
  it('completes all steps', async () => {
    const workflow = await runner.start(template)

    // Wait for completion
    await waitFor(() => workflow.status === 'completed')

    // Verify all steps completed
    expect(workflow.steps.every(s => s.completed)).toBe(true)
  })
})
```

### E2E Tests

Use the test utilities in `tests/e2e/cli/`:

```typescript
import { execCli, execCliSuccess } from './test-utils'

describe('CLI', () => {
  it('runs workflow', async () => {
    const result = await execCliSuccess(['run', 'workflow.yaml'])
    expect(result).toContain('completed')
  })
})
```

---

## Troubleshooting

### State Machine Not Transitioning

**Problem**: State doesn't change after sending event.

**Solution**: Ensure you're executing the returned effects:

```typescript
const { state, effects } = transition(currentState, event, context)

// Don't forget to execute effects!
for (const effect of effects) {
  await executeEffect(effect)
}

// Update stored state
currentState = state
```

### Events Not Received

**Problem**: Subscribers not receiving events.

**Solution**: Check event type matches exactly (they're typed now):

```typescript
// Wrong: old string format
eventBus.subscribe('step:completed', ...)

// Correct: new typed format
eventBus.subscribe('STEP_COMPLETED', ...)
```

### Race Conditions During Mode Switch

**Problem**: Input received during mode transition causes issues.

**Solution**: Use the orchestrator's `switchMode` which handles transitions atomically:

```typescript
// Don't manually set flags
this.mode = 'autopilot' // Can race

// Use orchestrator
await inputOrchestrator.switchMode('autopilot') // Atomic
```

---

## Related Documentation

- [API Reference](./API.md) - Detailed API documentation
- [Technical Architecture](./TECHNICAL_ARCHITECTURE.md) - System architecture overview
- [Rewrite Progress](./REWRITE_PROGRESS.md) - Implementation status
