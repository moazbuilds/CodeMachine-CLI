/** @jsxImportSource @opentui/solid */
/**
 * Workflow Shell Component
 *
 * Thin router that delegates to view-specific shell components.
 * Handles the transition between controller and executing views.
 */

import { Switch, Match } from "solid-js"
import { useWorkflowShell } from "./hooks/use-workflow-shell"
import { SharedLayout, ControllerShell, ExecutingShell } from "./components/shells"
import type { WorkflowEventBus } from "../../../../workflows/events/index.js"

export interface WorkflowShellProps {
  version: string
  currentDir: string
  eventBus?: WorkflowEventBus | null
  onAdapterReady?: () => void
}

export function WorkflowShell(props: WorkflowShellProps) {
  const shell = useWorkflowShell({
    version: props.version,
    currentDir: props.currentDir,
    eventBus: props.eventBus,
    onAdapterReady: props.onAdapterReady
  })

  return (
    <SharedLayout version={props.version} currentDir={props.currentDir} shell={shell}>
      <Switch>
        <Match when={shell.isControllerView()}>
          <ControllerShell shell={shell} />
        </Match>
        <Match when={shell.isExecutingView()}>
          <ExecutingShell shell={shell} />
        </Match>
      </Switch>
    </SharedLayout>
  )
}
