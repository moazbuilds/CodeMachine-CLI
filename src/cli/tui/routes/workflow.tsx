/** @jsxImportSource @opentui/solid */
import { createRequire } from "node:module"
import { homedir } from "node:os"
import { resolvePackageJson } from "../../../shared/runtime/pkg.js"
import { BrandingHeader } from "@tui/component/layout/branding-header"
import { useTheme } from "@tui/context/theme"
import { UIStateProvider, useUIState } from "@tui/context/ui-state"
import { Show } from "solid-js"

export function Workflow() {
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
    <UIStateProvider workflowName="CodeMachine Workflow">
      <WorkflowShell
        version={getVersion()}
        currentDir={getCwd()}
      />
    </UIStateProvider>
  )
}

function WorkflowShell(props: { version: string; currentDir: string }) {
  const themeCtx = useTheme()
  const ui = useUIState()
  const state = ui.state()

  return (
    <box flexDirection="column" gap={1} paddingLeft={1} paddingRight={1} paddingTop={1}>
      <BrandingHeader version={props.version} currentDir={props.currentDir} />

      <box flexDirection="row" gap={1}>
        <box
          flexDirection="column"
          padding={1}
          border
          borderColor={themeCtx.theme.borderSubtle}
          backgroundColor={themeCtx.theme.backgroundPanel}
          width="50%"
        >
          <text fg={themeCtx.theme.text} attributes={1}>Timeline</text>
          <text fg={themeCtx.theme.textMuted}>Agents: {state.agents.length} • Subagents: {Array.from(state.subAgents.values()).reduce((sum, list) => sum + list.length, 0)}</text>
          <text fg={themeCtx.theme.textMuted}>Status: {state.workflowStatus}</text>
          <text fg={themeCtx.theme.textMuted}>Scroll offset: {state.scrollOffset}</text>
          <text fg={themeCtx.theme.textMuted}>Visible rows: {state.visibleItemCount}</text>
          <Show when={state.loopState?.active}>
            <text fg={themeCtx.theme.primary}>Loop {state.loopState?.iteration}/{state.loopState?.maxIterations}</text>
          </Show>
        </box>

        <box
          flexDirection="column"
          padding={1}
          border
          borderColor={themeCtx.theme.borderSubtle}
          backgroundColor={themeCtx.theme.backgroundPanel}
          width="50%"
        >
          <text fg={themeCtx.theme.text} attributes={1}>Output</text>
          <text fg={themeCtx.theme.textMuted}>Awaiting agent output. Hook log stream here.</text>
        </box>
      </box>
    </box>
  )
}
