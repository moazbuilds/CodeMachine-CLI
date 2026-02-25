# Telemetry Migration Movement Plan (Full Codebase)

This plan defines **what to migrate, in what order, and why**, until all code files are covered.

Scope covered in this file:
- All files under `src/` (499 files total)
- File-by-file coverage mapped to phases (Appendix)

## Current Progress (Updated)

### Completed in this branch
- Phase 1 core file (`src/runtime/cli-setup.ts`) updated from reviewer decisions:
  - naming fixes, duplicate merge removals, missing completion logs, async update timing logs
  - legacy/misplaced concerns marked with TODO comments where required
- Shared telemetry noise cleanup completed:
  - removed debug-noise emissions (legacy no-op noise and tracing diag logger setup)
  - retired old `appDebug` file-path behavior
- `appDebug` migration completed end-to-end:
  - all active `appDebug(...)` callsites in `src/` migrated to explicit `otel_debug(..., LOGGER_NAMES.* , ...)`
  - legacy `appDebug`/`otel_appDebug` API removed from `src/shared/logging/logger.ts`

### Not yet complete for full Phase 1 closure
- Reviewer "declaration/API remove" items decision:
  - `src/shared/metrics/meters.ts` (#110-115): **KEEP** (API stability; helper surface, not runtime telemetry event emission)
  - `src/shared/tracing/tracers.ts` (#129-134): **KEEP** (API stability; helper surface, not runtime telemetry event emission)
- Optional follow-up cleanup:
  - remove commented legacy bootstrap block in `src/runtime/cli-setup.ts` after confirming no side effects

### Next actions
1. Run phase gate validation:
   - `bun run typecheck`
   - grep check for legacy logging leftovers in P1 files
   - smoke check: CLI boot + TUI launch + workflow start
2. Mark Phase 1 closed in this document.
3. Start Phase 2 on runtime/import/update surfaces listed below.

### Phase 1 Status
- **Closed** with explicit keep decision on declaration helpers (`get*Meter`, `get*Tracer`) for compatibility/stability.
- Scope moved to Phase 2.

## Objective
Move the codebase from mixed logging to a consistent telemetry model:
- Internal runtime telemetry uses `otel_debug/info/warn/error` + `LOGGER_NAMES.*`
- User-facing CLI/TUI messages remain user-facing (`console.log/error` when that is UX output)
- Spans remain in execution orchestration paths; logs are correlated to active spans

## Migration Rules (Use For Every File)
1. Keep user UX output as UX output.
2. Convert internal diagnostics to OTEL wrappers.
3. Use subsystem logger names consistently:
   - Boot/runtime startup: `LOGGER_NAMES.BOOT`
   - CLI/runtime services/imports: `LOGGER_NAMES.CLI`
   - TUI components/runtime: `LOGGER_NAMES.TUI`
   - Agent execution/coordinator: `LOGGER_NAMES.AGENT`
   - MCP/process infra: `LOGGER_NAMES.MCP` or `LOGGER_NAMES.PROCESS`
   - Engine lifecycle: `LOGGER_NAMES.ENGINE`
4. Add duration logs around network/fs/process boundaries when they matter.
5. Do not refactor architecture while migrating telemetry (separate PR for structural refactors).

## How To Move (Per Phase)
For each file in the current phase:
1. Read file.
2. Classify each log call as `telemetry` vs `user output`.
3. Apply conversion.
4. Add/update duration telemetry where needed.
5. Typecheck and run targeted tests for touched subsystem.
6. Commit phase once all phase files are complete.

## Phase Gates (When To Move)
- Move to next phase only when current phase has:
  - No leftover internal legacy log calls (`appDebug/debug/info/warn/error`) in that phase files
  - No broken imports/types
  - Smoke test of that subsystem passes

---

## Phase 1: Foundation and Boot Correlation
Why first:
- Everything else depends on this layer being correct; correlation and logger naming start here.

When done:
- Logging wrappers and boot tracing/logging paths are consistent and stable.

Primary areas:
- `src/shared/logging/**`
- `src/shared/tracing/**`
- `src/shared/metrics/**`
- `src/shared/telemetry/**`
- `src/shared/runtime/**`
- `src/runtime/cli-setup.ts`

## Phase 2: Runtime Services and Imports Path
Why second:
- This is the immediate execution path after boot and the first high-impact operational telemetry.

When done:
- Workspace init/discovery/import/update lifecycle emits consistent OTEL telemetry.

Primary areas:
- `src/runtime/services/**`
- `src/runtime/version.ts`
- `src/runtime/index.ts`
- `src/shared/imports/**`
- `src/shared/updates/**`

## Phase 3: Infra Layer (Engines, MCP, Process)
Why third:
- Infra failures are common debugging hotspots; instrumentation here unlocks root-cause analysis.

When done:
- Process spawning, engine adapters, MCP plumbing all emit OTEL-consistent logs and timings.

Primary areas:
- `src/infra/**`

## Phase 4: Workflow Engine Core
Why fourth:
- Workflow state and step orchestration is the largest logical execution graph.

When done:
- Workflow control/state/runner/events have coherent telemetry naming and causal timelines.

Primary areas:
- `src/workflows/**`

## Phase 5: Agents Execution and Monitoring
Why fifth:
- Agent lifecycle telemetry should sit on top of stabilized workflow+infra telemetry.

When done:
- Agent runner/execution/monitoring/coordinator logs are correlated and consistent.

Primary areas:
- `src/agents/**`

## Phase 6: CLI Commands Layer
Why sixth:
- Commands are user entrypoints; internal command diagnostics should be standardized after core layers.

When done:
- CLI command internals use OTEL telemetry while preserving user-visible terminal output.

Primary areas:
- `src/cli/commands/**`
- `src/cli/index.ts`
- `src/cli/program.ts`
- `src/cli/utils/**`

## Phase 7: TUI Runtime and UI Surface
Why seventh:
- TUI emits high volume logs; do after core telemetry semantics are stable.

When done:
- TUI internals produce meaningful OTEL logs with minimal noise and preserved UX behavior.

Primary areas:
- `src/cli/tui/**`

## Phase 8: Remaining Shared Libraries
Why last:
- These are cross-cutting helpers; finalize once all major call paths are migrated.

When done:
- Remaining shared modules align with final telemetry conventions.

Primary areas:
- Remaining `src/shared/**` not already included in earlier phases

---

## Execution Cadence
- Recommended PR strategy:
  - 1 PR per phase
  - If phase is large (P3/P4/P7), split by subfolder into stacked PRs
- Recommended validation at each phase:
  - `bun run typecheck` (or project equivalent)
  - Targeted test/smoke for touched subsystem
  - Quick grep check for legacy logging leftovers in phase paths

## Quick Audit Commands
```bash
# Legacy/internal logging hotspots
rg -n "appDebug\(|\bdebug\(|\binfo\(|\bwarn\(|\berror\(" src

# OTEL usage growth
rg -n "otel_(debug|info|warn|error)\(|LOGGER_NAMES" src

# User-facing output (review, do not blindly convert)
rg -n "console\.(log|warn|error|debug)\(" src
```

---

# Appendix A: Full File-to-Phase Map

Total files covered: **499**

## P1 Files (27)
- `src/runtime/cli-setup.ts`
- `src/shared/logging/agent-loggers.ts`
- `src/shared/logging/index.ts`
- `src/shared/logging/logger.ts`
- `src/shared/logging/otel-init.ts`
- `src/shared/logging/otel-logger.ts`
- `src/shared/logging/spinner-logger.ts`
- `src/shared/metrics/config.ts`
- `src/shared/metrics/exporters/file.ts`
- `src/shared/metrics/index.ts`
- `src/shared/metrics/init.ts`
- `src/shared/metrics/instruments/process.ts`
- `src/shared/metrics/meters.ts`
- `src/shared/runtime/dev.ts`
- `src/shared/runtime/suppress-baseline-warning.ts`
- `src/shared/telemetry/capture.ts`
- `src/shared/telemetry/index.ts`
- `src/shared/telemetry/logger.ts`
- `src/shared/telemetry/types.ts`
- `src/shared/tracing/config.ts`
- `src/shared/tracing/exporters/factory.ts`
- `src/shared/tracing/exporters/file.ts`
- `src/shared/tracing/index.ts`
- `src/shared/tracing/init.ts`
- `src/shared/tracing/sampler.ts`
- `src/shared/tracing/storage.ts`
- `src/shared/tracing/tracers.ts`

## P2 Files (21)
- `src/runtime/index.ts`
- `src/runtime/services/index.ts`
- `src/runtime/services/validation.ts`
- `src/runtime/services/workspace/discovery.ts`
- `src/runtime/services/workspace/fs-utils.ts`
- `src/runtime/services/workspace/index.ts`
- `src/runtime/services/workspace/init.ts`
- `src/runtime/version.ts`
- `src/shared/imports/auto-import.ts`
- `src/shared/imports/defaults.ts`
- `src/shared/imports/index.ts`
- `src/shared/imports/installer.ts`
- `src/shared/imports/manifest.ts`
- `src/shared/imports/paths.ts`
- `src/shared/imports/registry.ts`
- `src/shared/imports/resolve.ts`
- `src/shared/imports/resolver.ts`
- `src/shared/imports/types.ts`
- `src/shared/updates/checker.ts`
- `src/shared/updates/index.ts`
- `src/shared/updates/types.ts`

## P3 Files (115)
- `src/infra/engines/core/auth.ts`
- `src/infra/engines/core/base.ts`
- `src/infra/engines/core/factory.ts`
- `src/infra/engines/core/index.ts`
- `src/infra/engines/core/registry.ts`
- `src/infra/engines/core/types.ts`
- `src/infra/engines/index.ts`
- `src/infra/engines/providers/auggie/auth.ts`
- `src/infra/engines/providers/auggie/config.ts`
- `src/infra/engines/providers/auggie/execution/commands.ts`
- `src/infra/engines/providers/auggie/execution/executor.ts`
- `src/infra/engines/providers/auggie/execution/index.ts`
- `src/infra/engines/providers/auggie/execution/runner.ts`
- `src/infra/engines/providers/auggie/index.ts`
- `src/infra/engines/providers/auggie/mcp/adapter.ts`
- `src/infra/engines/providers/auggie/mcp/index.ts`
- `src/infra/engines/providers/auggie/mcp/settings.ts`
- `src/infra/engines/providers/auggie/metadata.ts`
- `src/infra/engines/providers/auggie/telemetryParser.ts`
- `src/infra/engines/providers/ccr/auth.ts`
- `src/infra/engines/providers/ccr/config.ts`
- `src/infra/engines/providers/ccr/execution/commands.ts`
- `src/infra/engines/providers/ccr/execution/executor.ts`
- `src/infra/engines/providers/ccr/execution/index.ts`
- `src/infra/engines/providers/ccr/execution/runner.ts`
- `src/infra/engines/providers/ccr/index.ts`
- `src/infra/engines/providers/ccr/mcp/adapter.ts`
- `src/infra/engines/providers/ccr/mcp/index.ts`
- `src/infra/engines/providers/ccr/mcp/settings.ts`
- `src/infra/engines/providers/ccr/metadata.ts`
- `src/infra/engines/providers/ccr/telemetryParser.ts`
- `src/infra/engines/providers/claude/auth.ts`
- `src/infra/engines/providers/claude/config.ts`
- `src/infra/engines/providers/claude/execution/commands.ts`
- `src/infra/engines/providers/claude/execution/executor.ts`
- `src/infra/engines/providers/claude/execution/index.ts`
- `src/infra/engines/providers/claude/execution/runner.ts`
- `src/infra/engines/providers/claude/index.ts`
- `src/infra/engines/providers/claude/mcp/adapter.ts`
- `src/infra/engines/providers/claude/mcp/index.ts`
- `src/infra/engines/providers/claude/mcp/settings.ts`
- `src/infra/engines/providers/claude/metadata.ts`
- `src/infra/engines/providers/claude/telemetryParser.ts`
- `src/infra/engines/providers/codex/auth.ts`
- `src/infra/engines/providers/codex/config.ts`
- `src/infra/engines/providers/codex/execution/commands.ts`
- `src/infra/engines/providers/codex/execution/executor.ts`
- `src/infra/engines/providers/codex/execution/index.ts`
- `src/infra/engines/providers/codex/execution/runner.ts`
- `src/infra/engines/providers/codex/index.ts`
- `src/infra/engines/providers/codex/mcp/adapter.ts`
- `src/infra/engines/providers/codex/mcp/index.ts`
- `src/infra/engines/providers/codex/mcp/settings.ts`
- `src/infra/engines/providers/codex/metadata.ts`
- `src/infra/engines/providers/codex/telemetryParser.ts`
- `src/infra/engines/providers/cursor/auth.ts`
- `src/infra/engines/providers/cursor/config.ts`
- `src/infra/engines/providers/cursor/execution/commands.ts`
- `src/infra/engines/providers/cursor/execution/executor.ts`
- `src/infra/engines/providers/cursor/execution/index.ts`
- `src/infra/engines/providers/cursor/execution/runner.ts`
- `src/infra/engines/providers/cursor/index.ts`
- `src/infra/engines/providers/cursor/mcp/adapter.ts`
- `src/infra/engines/providers/cursor/mcp/index.ts`
- `src/infra/engines/providers/cursor/mcp/settings.ts`
- `src/infra/engines/providers/cursor/metadata.ts`
- `src/infra/engines/providers/cursor/telemetryParser.ts`
- `src/infra/engines/providers/mistral/auth.ts`
- `src/infra/engines/providers/mistral/config.ts`
- `src/infra/engines/providers/mistral/execution/commands.ts`
- `src/infra/engines/providers/mistral/execution/executor.ts`
- `src/infra/engines/providers/mistral/execution/index.ts`
- `src/infra/engines/providers/mistral/execution/runner.ts`
- `src/infra/engines/providers/mistral/index.ts`
- `src/infra/engines/providers/mistral/mcp/adapter.ts`
- `src/infra/engines/providers/mistral/mcp/index.ts`
- `src/infra/engines/providers/mistral/mcp/settings.ts`
- `src/infra/engines/providers/mistral/metadata.ts`
- `src/infra/engines/providers/mistral/telemetryParser.ts`
- `src/infra/engines/providers/opencode/auth.ts`
- `src/infra/engines/providers/opencode/config.ts`
- `src/infra/engines/providers/opencode/execution/commands.ts`
- `src/infra/engines/providers/opencode/execution/executor.ts`
- `src/infra/engines/providers/opencode/execution/index.ts`
- `src/infra/engines/providers/opencode/execution/runner.ts`
- `src/infra/engines/providers/opencode/index.ts`
- `src/infra/engines/providers/opencode/mcp/adapter.ts`
- `src/infra/engines/providers/opencode/mcp/index.ts`
- `src/infra/engines/providers/opencode/mcp/settings.ts`
- `src/infra/engines/providers/opencode/metadata.ts`
- `src/infra/engines/providers/opencode/telemetryParser.ts`
- `src/infra/mcp/context.ts`
- `src/infra/mcp/errors.ts`
- `src/infra/mcp/index.ts`
- `src/infra/mcp/registry.ts`
- `src/infra/mcp/router/backend.ts`
- `src/infra/mcp/router/config.ts`
- `src/infra/mcp/router/index.ts`
- `src/infra/mcp/servers/agent-coordination/config.ts`
- `src/infra/mcp/servers/agent-coordination/executor.ts`
- `src/infra/mcp/servers/agent-coordination/handler.ts`
- `src/infra/mcp/servers/agent-coordination/index.ts`
- `src/infra/mcp/servers/agent-coordination/schemas.ts`
- `src/infra/mcp/servers/agent-coordination/tools.ts`
- `src/infra/mcp/servers/agent-coordination/validator.ts`
- `src/infra/mcp/servers/workflow-signals/config.ts`
- `src/infra/mcp/servers/workflow-signals/handler.ts`
- `src/infra/mcp/servers/workflow-signals/index.ts`
- `src/infra/mcp/servers/workflow-signals/queue.ts`
- `src/infra/mcp/servers/workflow-signals/schemas.ts`
- `src/infra/mcp/servers/workflow-signals/tools.ts`
- `src/infra/mcp/setup.ts`
- `src/infra/mcp/types.ts`
- `src/infra/mcp/writer.ts`
- `src/infra/process/spawn.ts`

## P4 Files (114)
- `src/workflows/context/index.ts`
- `src/workflows/context/step.ts`
- `src/workflows/context/types.ts`
- `src/workflows/controller/config.ts`
- `src/workflows/controller/helper.ts`
- `src/workflows/controller/index.ts`
- `src/workflows/controller/init.ts`
- `src/workflows/controller/types.ts`
- `src/workflows/controller/view.ts`
- `src/workflows/directives/checkpoint/evaluator.ts`
- `src/workflows/directives/checkpoint/handler.ts`
- `src/workflows/directives/checkpoint/index.ts`
- `src/workflows/directives/error/evaluator.ts`
- `src/workflows/directives/error/handler.ts`
- `src/workflows/directives/error/index.ts`
- `src/workflows/directives/index.ts`
- `src/workflows/directives/loop/evaluator.ts`
- `src/workflows/directives/loop/handler.ts`
- `src/workflows/directives/loop/index.ts`
- `src/workflows/directives/loop/types.ts`
- `src/workflows/directives/onAdvance.ts`
- `src/workflows/directives/pause/evaluator.ts`
- `src/workflows/directives/pause/handler.ts`
- `src/workflows/directives/pause/index.ts`
- `src/workflows/directives/pause/types.ts`
- `src/workflows/directives/reader.ts`
- `src/workflows/directives/trigger/evaluator.ts`
- `src/workflows/directives/trigger/execute.ts`
- `src/workflows/directives/trigger/handler.ts`
- `src/workflows/directives/trigger/index.ts`
- `src/workflows/directives/types.ts`
- `src/workflows/events/emitter.ts`
- `src/workflows/events/event-bus.ts`
- `src/workflows/events/index.ts`
- `src/workflows/events/types.ts`
- `src/workflows/index.ts`
- `src/workflows/indexing/debug.ts`
- `src/workflows/indexing/index.ts`
- `src/workflows/indexing/lifecycle.ts`
- `src/workflows/indexing/manager.ts`
- `src/workflows/indexing/persistence.ts`
- `src/workflows/indexing/types.ts`
- `src/workflows/input/emitter.ts`
- `src/workflows/input/index.ts`
- `src/workflows/input/providers/controller.ts`
- `src/workflows/input/providers/index.ts`
- `src/workflows/input/providers/user.ts`
- `src/workflows/input/types.ts`
- `src/workflows/mcp.ts`
- `src/workflows/mode/index.ts`
- `src/workflows/mode/mode.ts`
- `src/workflows/mode/types.ts`
- `src/workflows/onboarding/emitter.ts`
- `src/workflows/onboarding/index.ts`
- `src/workflows/onboarding/service.ts`
- `src/workflows/preflight.ts`
- `src/workflows/recovery/detect.ts`
- `src/workflows/recovery/index.ts`
- `src/workflows/recovery/restore.ts`
- `src/workflows/recovery/types.ts`
- `src/workflows/run.ts`
- `src/workflows/runner/actions/advance.ts`
- `src/workflows/runner/actions/directives.ts`
- `src/workflows/runner/actions/index.ts`
- `src/workflows/runner/actions/loop.ts`
- `src/workflows/runner/actions/resume.ts`
- `src/workflows/runner/core.ts`
- `src/workflows/runner/index.ts`
- `src/workflows/runner/modes/autonomous.ts`
- `src/workflows/runner/modes/continuous.ts`
- `src/workflows/runner/modes/index.ts`
- `src/workflows/runner/modes/interactive.ts`
- `src/workflows/runner/modes/types.ts`
- `src/workflows/runner/types.ts`
- `src/workflows/session/index.ts`
- `src/workflows/session/session.ts`
- `src/workflows/session/types.ts`
- `src/workflows/signals/handlers/index.ts`
- `src/workflows/signals/handlers/mode.ts`
- `src/workflows/signals/handlers/pause.ts`
- `src/workflows/signals/handlers/return.ts`
- `src/workflows/signals/handlers/skip.ts`
- `src/workflows/signals/handlers/stop.ts`
- `src/workflows/signals/index.ts`
- `src/workflows/signals/manager/index.ts`
- `src/workflows/signals/manager/manager.ts`
- `src/workflows/signals/manager/types.ts`
- `src/workflows/signals/mcp/controller.ts`
- `src/workflows/signals/mcp/detector.ts`
- `src/workflows/signals/mcp/index.ts`
- `src/workflows/state/index.ts`
- `src/workflows/state/machine.ts`
- `src/workflows/state/types.ts`
- `src/workflows/step/engine.ts`
- `src/workflows/step/execute.ts`
- `src/workflows/step/hooks.ts`
- `src/workflows/step/index.ts`
- `src/workflows/step/run.ts`
- `src/workflows/step/scenarios/definitions.ts`
- `src/workflows/step/scenarios/index.ts`
- `src/workflows/step/scenarios/types.ts`
- `src/workflows/step/skip.ts`
- `src/workflows/templates/globals.ts`
- `src/workflows/templates/index.ts`
- `src/workflows/templates/loader.ts`
- `src/workflows/templates/types.ts`
- `src/workflows/templates/validator.ts`
- `src/workflows/utils/config.ts`
- `src/workflows/utils/index.ts`
- `src/workflows/utils/resolvers/folder.ts`
- `src/workflows/utils/resolvers/module.ts`
- `src/workflows/utils/resolvers/step.ts`
- `src/workflows/utils/separator.ts`
- `src/workflows/utils/types.ts`

## P5 Files (33)
- `src/agents/chat/index.ts`
- `src/agents/chat/types.ts`
- `src/agents/coordinator/execution.ts`
- `src/agents/coordinator/index.ts`
- `src/agents/coordinator/parser.ts`
- `src/agents/coordinator/service.ts`
- `src/agents/coordinator/types.ts`
- `src/agents/execution/actions.ts`
- `src/agents/execution/index.ts`
- `src/agents/execution/run.ts`
- `src/agents/execution/telemetry.ts`
- `src/agents/execution/types.ts`
- `src/agents/index.ts`
- `src/agents/monitoring/cleanup.ts`
- `src/agents/monitoring/converters.ts`
- `src/agents/monitoring/db/connection.ts`
- `src/agents/monitoring/db/repository.ts`
- `src/agents/monitoring/db/schema.ts`
- `src/agents/monitoring/index.ts`
- `src/agents/monitoring/logLock.ts`
- `src/agents/monitoring/logger.ts`
- `src/agents/monitoring/monitor.ts`
- `src/agents/monitoring/registry.ts`
- `src/agents/monitoring/status.ts`
- `src/agents/monitoring/types.ts`
- `src/agents/runner/chained.ts`
- `src/agents/runner/config.ts`
- `src/agents/runner/index.ts`
- `src/agents/runner/runner.ts`
- `src/agents/session/capture.ts`
- `src/agents/session/index.ts`
- `src/agents/session/resume.ts`
- `src/agents/session/types.ts`

## P6 Files (16)
- `src/cli/commands/agents/export.ts`
- `src/cli/commands/agents/index.ts`
- `src/cli/commands/agents/list.ts`
- `src/cli/commands/agents/logs.ts`
- `src/cli/commands/agents/register.ts`
- `src/cli/commands/auth.command.ts`
- `src/cli/commands/export.command.ts`
- `src/cli/commands/import.command.ts`
- `src/cli/commands/index.ts`
- `src/cli/commands/mcp.command.ts`
- `src/cli/commands/run.command.ts`
- `src/cli/commands/step.command.ts`
- `src/cli/commands/templates.command.ts`
- `src/cli/index.ts`
- `src/cli/program.ts`
- `src/cli/utils/selection-menu.ts`

## P7 Files (147)
- `src/cli/tui/app-shell.tsx`
- `src/cli/tui/app.tsx`
- `src/cli/tui/components/error-boundary.tsx`
- `src/cli/tui/exit.ts`
- `src/cli/tui/launcher.ts`
- `src/cli/tui/routes/home/components/command-input.tsx`
- `src/cli/tui/routes/home/components/help-row.tsx`
- `src/cli/tui/routes/home/components/welcome-section.tsx`
- `src/cli/tui/routes/home/config/commands.ts`
- `src/cli/tui/routes/home/dialogs/import-dialog.tsx`
- `src/cli/tui/routes/home/home-view.tsx`
- `src/cli/tui/routes/home/hooks/use-home-commands.tsx`
- `src/cli/tui/routes/home/index.tsx`
- `src/cli/tui/routes/onboard/components/footer-hints.tsx`
- `src/cli/tui/routes/onboard/components/option-list.tsx`
- `src/cli/tui/routes/onboard/components/project-name-input.tsx`
- `src/cli/tui/routes/onboard/components/question-display.tsx`
- `src/cli/tui/routes/onboard/hooks/use-onboard-keyboard.ts`
- `src/cli/tui/routes/onboard/index.tsx`
- `src/cli/tui/routes/onboard/onboard-view.tsx`
- `src/cli/tui/routes/workflow/adapters/base.ts`
- `src/cli/tui/routes/workflow/adapters/headless.ts`
- `src/cli/tui/routes/workflow/adapters/index.ts`
- `src/cli/tui/routes/workflow/adapters/mock.ts`
- `src/cli/tui/routes/workflow/adapters/opentui.ts`
- `src/cli/tui/routes/workflow/adapters/types.ts`
- `src/cli/tui/routes/workflow/components/modals/checkpoint-modal.tsx`
- `src/cli/tui/routes/workflow/components/modals/checkpoint/checkpoint-actions.tsx`
- `src/cli/tui/routes/workflow/components/modals/checkpoint/checkpoint-content.tsx`
- `src/cli/tui/routes/workflow/components/modals/checkpoint/index.tsx`
- `src/cli/tui/routes/workflow/components/modals/controller-continue-modal.tsx`
- `src/cli/tui/routes/workflow/components/modals/error-modal.tsx`
- `src/cli/tui/routes/workflow/components/modals/history-view.tsx`
- `src/cli/tui/routes/workflow/components/modals/history/history-row.tsx`
- `src/cli/tui/routes/workflow/components/modals/history/history-tree.ts`
- `src/cli/tui/routes/workflow/components/modals/history/index.tsx`
- `src/cli/tui/routes/workflow/components/modals/history/use-history-navigation.ts`
- `src/cli/tui/routes/workflow/components/modals/index.ts`
- `src/cli/tui/routes/workflow/components/modals/log-viewer.tsx`
- `src/cli/tui/routes/workflow/components/modals/log-viewer/index.tsx`
- `src/cli/tui/routes/workflow/components/modals/log-viewer/log-content.tsx`
- `src/cli/tui/routes/workflow/components/modals/log-viewer/log-footer.tsx`
- `src/cli/tui/routes/workflow/components/modals/log-viewer/log-header.tsx`
- `src/cli/tui/routes/workflow/components/modals/stop-modal.tsx`
- `src/cli/tui/routes/workflow/components/output/index.ts`
- `src/cli/tui/routes/workflow/components/output/output-window.tsx`
- `src/cli/tui/routes/workflow/components/output/prompt-line/chain-confirm-modal.tsx`
- `src/cli/tui/routes/workflow/components/output/prompt-line/index.tsx`
- `src/cli/tui/routes/workflow/components/output/prompt-line/prompt-line-hint.tsx`
- `src/cli/tui/routes/workflow/components/output/prompt-line/prompt-line-symbol.tsx`
- `src/cli/tui/routes/workflow/components/output/prompt-line/types.ts`
- `src/cli/tui/routes/workflow/components/output/prompt-line/use-typing-effect.ts`
- `src/cli/tui/routes/workflow/components/output/shimmer-text.tsx`
- `src/cli/tui/routes/workflow/components/output/status-footer.tsx`
- `src/cli/tui/routes/workflow/components/output/telemetry-bar.tsx`
- `src/cli/tui/routes/workflow/components/output/typing-text.tsx`
- `src/cli/tui/routes/workflow/components/shared/log-line.tsx`
- `src/cli/tui/routes/workflow/components/shared/log-table.tsx`
- `src/cli/tui/routes/workflow/components/shared/markdown-table.ts`
- `src/cli/tui/routes/workflow/components/shells/controller-shell.tsx`
- `src/cli/tui/routes/workflow/components/shells/executing-shell.tsx`
- `src/cli/tui/routes/workflow/components/shells/index.ts`
- `src/cli/tui/routes/workflow/components/shells/shared-layout.tsx`
- `src/cli/tui/routes/workflow/components/timeline/agent-timeline.tsx`
- `src/cli/tui/routes/workflow/components/timeline/index.ts`
- `src/cli/tui/routes/workflow/components/timeline/main-agent-node.tsx`
- `src/cli/tui/routes/workflow/components/timeline/separator-node.tsx`
- `src/cli/tui/routes/workflow/components/timeline/status-utils.ts`
- `src/cli/tui/routes/workflow/components/timeline/sub-agent-node.tsx`
- `src/cli/tui/routes/workflow/components/timeline/sub-agent-summary.tsx`
- `src/cli/tui/routes/workflow/constants.ts`
- `src/cli/tui/routes/workflow/context/ui-state.tsx`
- `src/cli/tui/routes/workflow/context/ui-state/actions/agent-actions.ts`
- `src/cli/tui/routes/workflow/context/ui-state/actions/history-actions.ts`
- `src/cli/tui/routes/workflow/context/ui-state/actions/index.ts`
- `src/cli/tui/routes/workflow/context/ui-state/actions/navigation-actions.ts`
- `src/cli/tui/routes/workflow/context/ui-state/actions/subagent-actions.ts`
- `src/cli/tui/routes/workflow/context/ui-state/actions/workflow-actions.ts`
- `src/cli/tui/routes/workflow/context/ui-state/index.ts`
- `src/cli/tui/routes/workflow/context/ui-state/initial-state.ts`
- `src/cli/tui/routes/workflow/context/ui-state/provider.tsx`
- `src/cli/tui/routes/workflow/context/ui-state/store.ts`
- `src/cli/tui/routes/workflow/context/ui-state/types.ts`
- `src/cli/tui/routes/workflow/context/ui-state/utils.ts`
- `src/cli/tui/routes/workflow/hooks/use-workflow-computed.ts`
- `src/cli/tui/routes/workflow/hooks/use-workflow-events.ts`
- `src/cli/tui/routes/workflow/hooks/use-workflow-handlers.ts`
- `src/cli/tui/routes/workflow/hooks/use-workflow-keyboard.ts`
- `src/cli/tui/routes/workflow/hooks/use-workflow-modals.ts`
- `src/cli/tui/routes/workflow/hooks/use-workflow-shell.ts`
- `src/cli/tui/routes/workflow/hooks/useLogStream.ts`
- `src/cli/tui/routes/workflow/hooks/useRegistrySync.ts`
- `src/cli/tui/routes/workflow/hooks/useSubAgentSync.ts`
- `src/cli/tui/routes/workflow/index.tsx`
- `src/cli/tui/routes/workflow/state/formatters.ts`
- `src/cli/tui/routes/workflow/state/navigation.ts`
- `src/cli/tui/routes/workflow/state/output.ts`
- `src/cli/tui/routes/workflow/state/performance.ts`
- `src/cli/tui/routes/workflow/state/telemetry.ts`
- `src/cli/tui/routes/workflow/state/types.ts`
- `src/cli/tui/routes/workflow/state/utils.ts`
- `src/cli/tui/routes/workflow/workflow-shell.tsx`
- `src/cli/tui/shared/components/fade-in.tsx`
- `src/cli/tui/shared/components/index.ts`
- `src/cli/tui/shared/components/layout/branding-header.tsx`
- `src/cli/tui/shared/components/logo.tsx`
- `src/cli/tui/shared/components/modal/index.ts`
- `src/cli/tui/shared/components/modal/modal-base.tsx`
- `src/cli/tui/shared/components/modal/modal-content.tsx`
- `src/cli/tui/shared/components/modal/modal-footer.tsx`
- `src/cli/tui/shared/components/modal/modal-header.tsx`
- `src/cli/tui/shared/components/prompt-input.tsx`
- `src/cli/tui/shared/components/prompt/index.tsx`
- `src/cli/tui/shared/components/prompt/types.ts`
- `src/cli/tui/shared/components/select-menu/index.tsx`
- `src/cli/tui/shared/components/select-menu/types.ts`
- `src/cli/tui/shared/components/spinner.tsx`
- `src/cli/tui/shared/config/agent-characters.ts`
- `src/cli/tui/shared/config/agent-characters.types.ts`
- `src/cli/tui/shared/context/dialog.tsx`
- `src/cli/tui/shared/context/helper.tsx`
- `src/cli/tui/shared/context/kv.tsx`
- `src/cli/tui/shared/context/session.tsx`
- `src/cli/tui/shared/context/theme.tsx`
- `src/cli/tui/shared/context/theme/codemachine.json`
- `src/cli/tui/shared/context/toast.tsx`
- `src/cli/tui/shared/context/update-notifier.tsx`
- `src/cli/tui/shared/hooks/index.ts`
- `src/cli/tui/shared/hooks/use-modal-keyboard.ts`
- `src/cli/tui/shared/services/index.ts`
- `src/cli/tui/shared/services/timer.ts`
- `src/cli/tui/shared/ui/dialog-select/index.tsx`
- `src/cli/tui/shared/ui/dialog-select/types.ts`
- `src/cli/tui/shared/ui/dialog-wrapper.tsx`
- `src/cli/tui/shared/ui/index.ts`
- `src/cli/tui/shared/ui/progress-step.tsx`
- `src/cli/tui/shared/ui/status-badge.tsx`
- `src/cli/tui/shared/ui/terminal-link.tsx`
- `src/cli/tui/shared/ui/toast.tsx`
- `src/cli/tui/shared/utils/clipboard.ts`
- `src/cli/tui/shared/utils/format-bytes.ts`
- `src/cli/tui/shared/utils/index.ts`
- `src/cli/tui/shared/utils/text.ts`
- `src/cli/tui/shared/utils/tui-logger.ts`
- `src/cli/tui/utils/index.ts`
- `src/cli/tui/utils/terminal-detection.ts`
- `src/cli/tui/utils/theme-storage.ts`

## P8 Files (26)
- `src/shared/agents/config/paths.ts`
- `src/shared/agents/config/types.ts`
- `src/shared/agents/discovery/catalog.ts`
- `src/shared/agents/discovery/steps.ts`
- `src/shared/agents/index.ts`
- `src/shared/formatters/logFileFormatter.ts`
- `src/shared/formatters/outputMarkers.ts`
- `src/shared/prompts/config/index.ts`
- `src/shared/prompts/config/loader.ts`
- `src/shared/prompts/config/types.ts`
- `src/shared/prompts/content/glob.ts`
- `src/shared/prompts/content/index.ts`
- `src/shared/prompts/content/loader.ts`
- `src/shared/prompts/index.ts`
- `src/shared/prompts/injected.ts`
- `src/shared/prompts/replacement/builtins.ts`
- `src/shared/prompts/replacement/errors.ts`
- `src/shared/prompts/replacement/index.ts`
- `src/shared/prompts/replacement/parser.ts`
- `src/shared/prompts/replacement/processor.ts`
- `src/shared/utils/errors.ts`
- `src/shared/utils/index.ts`
- `src/shared/utils/path.ts`
- `src/shared/utils/terminal.ts`
- `src/shared/workflows/index.ts`
- `src/shared/workflows/template.ts`


AFTER DONE WITH EACH FILE, do a commit.. commits are file based max per commit 1-3 files very related.. must commit after done of files to be easy track what is going 
