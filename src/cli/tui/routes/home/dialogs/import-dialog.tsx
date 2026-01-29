/** @jsxImportSource @opentui/solid */
/**
 * Import Dialog Component
 *
 * Minimal smart input for importing workflow packages from GitHub.
 * Features live URL preview, inline validation, and clickable links.
 */

import { createSignal, createMemo, Show, For } from "solid-js"
import { useKeyboard } from "@opentui/solid"
import { useTheme } from "@tui/shared/context/theme"
import { ProgressStep, type StepStatus } from "@tui/shared/ui/progress-step"
import { appDebug } from "../../../../../shared/logging/logger.js"

type ImportStep = {
  label: string
  status: StepStatus
}

type ImportState =
  | { phase: "input" }
  | { phase: "installing"; steps: ImportStep[]; currentStep: number }
  | { phase: "success"; name: string; version: string; location: string }
  | { phase: "error"; reason: string; details?: string }

export interface ImportDialogProps {
  onClose: () => void
  onInstall: (source: string) => Promise<{
    success: boolean
    name?: string
    version?: string
    location?: string
    error?: string
    errorDetails?: string
  }>
}

/**
 * Parse input to extract owner/repo, GitHub URL, or local path
 */
function parseGitHubInput(input: string): { owner?: string; repo: string; url?: string; isLocal?: boolean } | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  // Local path: absolute path starting with /
  if (trimmed.startsWith('/')) {
    const parts = trimmed.split('/')
    const repo = parts[parts.length - 1] || 'local-import'
    return {
      repo,
      url: trimmed,
      isLocal: true,
    }
  }

  // Local path: relative path starting with ./ or ../
  if (trimmed.startsWith('./') || trimmed.startsWith('../')) {
    const parts = trimmed.split('/')
    const repo = parts[parts.length - 1] || 'local-import'
    return {
      repo,
      url: trimmed,
      isLocal: true,
    }
  }

  // Local path: home directory shorthand ~/
  if (trimmed.startsWith('~/')) {
    const parts = trimmed.split('/')
    const repo = parts[parts.length - 1] || 'local-import'
    return {
      repo,
      url: trimmed,
      isLocal: true,
    }
  }

  // Full GitHub URL: https://github.com/owner/repo or https://github.com/owner/repo.git
  const urlMatch = trimmed.match(/^https?:\/\/github\.com\/([^\/]+)\/([^\/\s]+?)(?:\.git)?$/i)
  if (urlMatch) {
    return {
      owner: urlMatch[1],
      repo: urlMatch[2],
      url: `https://github.com/${urlMatch[1]}/${urlMatch[2]}`,
    }
  }

  // Shorthand: owner/repo
  const shortMatch = trimmed.match(/^([^\/\s]+)\/([^\/\s]+)$/)
  if (shortMatch) {
    return {
      owner: shortMatch[1],
      repo: shortMatch[2],
      url: `https://github.com/${shortMatch[1]}/${shortMatch[2]}`,
    }
  }

  // Just repo name (no slashes, no spaces)
  const repoMatch = trimmed.match(/^[a-zA-Z0-9_.-]+$/)
  if (repoMatch) {
    return {
      repo: trimmed,
    }
  }

  return null
}

export function ImportDialog(props: ImportDialogProps) {
  appDebug("[ImportDialog] Component mounting")
  const theme = useTheme()
  const [inputValue, setInputValue] = createSignal("")
  const [state, setState] = createSignal<ImportState>({ phase: "input" })

  // Live parsing of input for preview
  const parsed = createMemo(() => parseGitHubInput(inputValue()))

  // Validation status
  const validation = createMemo(() => {
    const input = inputValue().trim()
    if (!input) return { status: "empty" as const }

    const result = parsed()
    if (result) {
      return { status: "valid" as const, message: "Ready to install" }
    }

    return { status: "invalid" as const, message: "Enter repo name or full URL" }
  })

  const handleSubmit = async () => {
    const source = inputValue().trim()
    appDebug("[ImportDialog] handleSubmit called, source=%s", source)
    if (!source) return

    appDebug("[ImportDialog] Starting install process")
    const isLocalPath = parsed()?.isLocal ?? false
    setState({
      phase: "installing",
      steps: [
        { label: "Resolving source", status: "active" },
        { label: isLocalPath ? "Copying folder" : "Cloning repository", status: "pending" },
        { label: "Validating manifest", status: "pending" },
        { label: "Registering package", status: "pending" },
      ],
      currentStep: 0,
    })

    const updateStep = (index: number, status: StepStatus) => {
      setState((prev) => {
        if (prev.phase !== "installing") return prev
        const newSteps = [...prev.steps]
        newSteps[index] = { ...newSteps[index], status }
        if (status === "done" && index + 1 < newSteps.length) {
          newSteps[index + 1] = { ...newSteps[index + 1], status: "active" }
        }
        return { ...prev, steps: newSteps, currentStep: index }
      })
    }

    try {
      await new Promise((r) => setTimeout(r, 200))
      updateStep(0, "done")

      await new Promise((r) => setTimeout(r, 150))

      appDebug("[ImportDialog] Calling onInstall")
      const result = await props.onInstall(source)
      appDebug("[ImportDialog] onInstall result: success=%s", result.success)

      if (result.success) {
        updateStep(1, "done")
        await new Promise((r) => setTimeout(r, 100))
        updateStep(2, "done")
        await new Promise((r) => setTimeout(r, 100))
        updateStep(3, "done")
        await new Promise((r) => setTimeout(r, 150))

        setState({
          phase: "success",
          name: result.name || "Unknown",
          version: result.version || "0.0.0",
          location: result.location || "",
        })
      } else {
        const currentState = state()
        if (currentState.phase === "installing") {
          updateStep(currentState.currentStep, "error")
        }

        setState({
          phase: "error",
          reason: result.error || "Import failed",
          details: result.errorDetails,
        })
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error"
      appDebug("[ImportDialog] Exception: %s", errorMsg)
      setState({ phase: "error", reason: errorMsg })
    }
  }

  const handlePaste = (evt: { text: string; preventDefault?: () => void }) => {
    if (!evt.text) return

    const normalized = evt.text.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
    const cleanText = normalized.replace(/\n+/g, " ").trim()

    if (!cleanText) return
    evt.preventDefault?.()
    setInputValue(cleanText)
  }

  const handleKeyDown = (evt: { name?: string; ctrl?: boolean }) => {
    const currentState = state()

    if (evt.name === "escape") {
      if (currentState.phase === "installing") return
      props.onClose()
      return
    }

    if (evt.name === "return") {
      if (currentState.phase === "input") {
        handleSubmit()
      } else if (currentState.phase === "success") {
        props.onClose()
      } else if (currentState.phase === "error") {
        setState({ phase: "input" })
      }
    }
  }

  useKeyboard(handleKeyDown)

  return (
    <Show
      when={state().phase === "input"}
      fallback={
        <Show
          when={state().phase === "installing"}
          fallback={
            <Show
              when={state().phase === "success"}
              fallback={
                // Error state
                <>
                  {(() => {
                    const s = state() as { phase: "error"; reason: string; details?: string }
                    return (
                      <box flexDirection="column" width={50}>
                        <box
                          flexDirection="column"
                          backgroundColor={theme.theme.backgroundElement}
                          paddingLeft={1}
                          paddingRight={1}
                          paddingTop={1}
                          paddingBottom={1}
                        >
                          <text fg={theme.theme.text}>{s.reason}</text>
                          <Show when={s.details}>
                            <text fg={theme.theme.textMuted} marginTop={1}>
                              {s.details}
                            </text>
                          </Show>
                        </box>

                        <box marginTop={2}>
                          <text fg={theme.theme.textMuted}>
                            [Enter] Retry  [Esc] Cancel
                          </text>
                        </box>
                      </box>
                    )
                  })()}
                </>
              }
            >
              {/* Success state */}
              <>
                {(() => {
                  const s = state() as { phase: "success"; name: string; version: string; location: string }
                  return (
                    <box flexDirection="column" width={50}>
                      <box flexDirection="column" marginBottom={1}>
                        <text fg={theme.theme.text} attributes={1}>
                          {s.name}
                        </text>
                        <text fg={theme.theme.textMuted}>v{s.version}</text>
                      </box>

                      <text fg={theme.theme.textMuted}>{s.location}</text>

                      <box marginTop={2}>
                        <text fg={theme.theme.textMuted}>[Enter] Close</text>
                      </box>
                    </box>
                  )
                })()}
              </>
            </Show>
          }
        >
          {/* Installing state */}
          <>
            {(() => {
              const s = state() as { phase: "installing"; steps: ImportStep[] }
              const p = parsed()
              return (
                <box flexDirection="column" width={50}>
                  <Show when={p}>
                    <text fg={theme.theme.textMuted} marginBottom={1}>
                      {p!.isLocal ? `📁 ${p!.repo}` : p!.owner ? `${p!.owner}/${p!.repo}` : p!.repo}
                    </text>
                  </Show>

                  <box flexDirection="column" marginTop={1}>
                    <For each={s.steps}>
                      {(step) => <ProgressStep label={step.label} status={step.status} />}
                    </For>
                  </box>
                </box>
              )
            })()}
          </>
        </Show>
      }
    >
      {/* Input state */}
      <>
        <box flexDirection="column" width={50}>
          {/* Title */}
          <text fg={theme.theme.primary} attributes={1} marginBottom={1}>
            ⬇ Add Workflow Package
          </text>

          {/* Input field */}
          <box
            backgroundColor={theme.theme.backgroundElement}
            paddingLeft={1}
            paddingRight={1}
            paddingTop={1}
            paddingBottom={1}
            marginBottom={1}
          >
            <input
              value={inputValue()}
              placeholder="owner/repo or /path/to/folder"
              onInput={setInputValue}
              onPaste={handlePaste}
              focused={true}
              backgroundColor={theme.theme.backgroundElement}
              focusedBackgroundColor={theme.theme.backgroundElement}
            />
          </box>

          {/* Live preview / validation */}
          <box marginBottom={1} minHeight={2}>
            <Show when={validation().status === "empty"}>
              <text fg={theme.theme.textMuted}>
                Enter repo name, GitHub URL, or local path
              </text>
            </Show>

            <Show when={validation().status === "valid" && parsed()}>
              <box flexDirection="column">
                <text fg={theme.theme.success}>
                  {parsed()!.isLocal ? "📁" : "↳"} {parsed()!.url || parsed()!.repo}
                </text>
              </box>
            </Show>

            <Show when={validation().status === "invalid"}>
              <text fg={theme.theme.textMuted}>{validation().message}</text>
            </Show>
          </box>

          {/* Keybinds */}
          <box marginTop={1}>
            <text fg={theme.theme.textMuted}>
              [Enter] Install  [Esc] Cancel
            </text>
          </box>
        </box>
      </>
    </Show>
  )
}
