/** @jsxImportSource @opentui/solid */
/**
 * Workflow Route
 *
 * Entry point for the workflow view with UI state provider.
 */

import { homedir } from "node:os"
import { VERSION } from "../../../../runtime/version.js"
import { UIStateProvider } from "./context/ui-state"
import { WorkflowShell } from "./workflow-shell"
import type { WorkflowEventBus } from "../../../../workflows/events/index.js"

interface WorkflowProps {
  eventBus?: WorkflowEventBus | null
  onAdapterReady?: () => void
}

export function Workflow(props: WorkflowProps) {
  const getVersion = () => {
    return VERSION
  }

  const getCwd = () => {
    const cwd = process.env.CODEMACHINE_CWD || process.cwd()
    return cwd.replace(homedir(), "~")
  }

  return (
    <UIStateProvider workflowName="Workflow">
      <WorkflowShell
        version={getVersion()}
        currentDir={getCwd()}
        eventBus={props.eventBus}
        onAdapterReady={props.onAdapterReady}
      />
    </UIStateProvider>
  )
}
