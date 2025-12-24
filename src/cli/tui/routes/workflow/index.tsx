/** @jsxImportSource @opentui/solid */
/**
 * Workflow Route
 *
 * Entry point for the workflow view with UI state provider.
 */

import { createRequire } from "node:module"
import { homedir } from "node:os"
import { resolvePackageJson } from "../../../../shared/runtime/root.js"
import { UIStateProvider } from "./context/ui-state"
import { WorkflowShell } from "./workflow-shell"
import type { WorkflowEventBus } from "../../../../workflows/events/index.js"

interface WorkflowProps {
  eventBus?: WorkflowEventBus | null
  onAdapterReady?: () => void
}

export function Workflow(props: WorkflowProps) {
  const getVersion = () => {
    const require = createRequire(import.meta.url)
    const packageJsonPath = resolvePackageJson(import.meta.url, "workflow route")
    const pkg = require(packageJsonPath) as { version: string }
    return pkg.version
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
