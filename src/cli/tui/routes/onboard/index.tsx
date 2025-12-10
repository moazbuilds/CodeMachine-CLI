/** @jsxImportSource @opentui/solid */
/**
 * Onboard View
 *
 * Pre-workflow onboarding flow: track selection, conditions selection, etc.
 */

import { createSignal, For, onMount, Show, createEffect } from "solid-js"
import { useKeyboard, useTerminalDimensions } from "@opentui/solid"
import { useTheme } from "@tui/shared/context/theme"
import type { TrackConfig, ConditionConfig } from "../../../../workflows/templates/types"

export interface OnboardProps {
  tracks?: Record<string, TrackConfig>
  conditions?: Record<string, ConditionConfig>
  initialProjectName?: string | null // If set, skip project name input
  onComplete: (result: { projectName?: string; trackId?: string; conditions?: string[] }) => void
  onCancel?: () => void
}

type OnboardStep = 'project_name' | 'tracks' | 'conditions'

export function Onboard(props: OnboardProps) {
  const themeCtx = useTheme()
  const dimensions = useTerminalDimensions()
  const [selectedIndex, setSelectedIndex] = createSignal(0)
  const [typedText, setTypedText] = createSignal("")
  const [typingDone, setTypingDone] = createSignal(false)

  // Multi-step state
  const [currentStep, setCurrentStep] = createSignal<OnboardStep>('project_name')
  const [projectName, setProjectName] = createSignal("")
  const [selectedTrackId, setSelectedTrackId] = createSignal<string | undefined>()
  const [selectedConditions, setSelectedConditions] = createSignal<Set<string>>(new Set())

  const hasTracks = () => props.tracks && Object.keys(props.tracks).length > 0
  const hasConditions = () => props.conditions && Object.keys(props.conditions).length > 0

  // Determine initial step - skip project_name if already set
  onMount(() => {
    if (props.initialProjectName) {
      setProjectName(props.initialProjectName)
      if (hasTracks()) {
        setCurrentStep('tracks')
      } else if (hasConditions()) {
        setCurrentStep('conditions')
      } else {
        props.onComplete({ projectName: props.initialProjectName })
      }
    }
  })

  const projectNameQuestion = "What is your project name?"
  const trackQuestion = "What is your project size?"
  const conditionsQuestion = "What features does your project have?"

  const trackEntries = () => props.tracks ? Object.entries(props.tracks) : []
  const conditionEntries = () => props.conditions ? Object.entries(props.conditions) : []

  const currentQuestion = () => {
    switch (currentStep()) {
      case 'project_name': return projectNameQuestion
      case 'tracks': return trackQuestion
      case 'conditions': return conditionsQuestion
    }
  }
  const currentEntries = () => currentStep() === 'tracks' ? trackEntries() : conditionEntries()

  // Typing effect - reset when step changes
  createEffect(() => {
    const step = currentStep()
    const question = currentQuestion()
    setTypedText("")
    setTypingDone(false)
    setSelectedIndex(0)

    let i = 0
    const interval = setInterval(() => {
      if (i <= question.length) {
        setTypedText(question.slice(0, i))
        i++
      } else {
        setTypingDone(true)
        clearInterval(interval)
      }
    }, 50)

    return () => clearInterval(interval)
  })

  const handleProjectNameSubmit = () => {
    const name = projectName().trim()
    if (!name) return // Don't proceed with empty name

    if (hasTracks()) {
      setCurrentStep('tracks')
    } else if (hasConditions()) {
      setCurrentStep('conditions')
    } else {
      props.onComplete({ projectName: name })
    }
  }

  const handleTrackSelect = (trackId: string) => {
    setSelectedTrackId(trackId)
    if (hasConditions()) {
      setCurrentStep('conditions')
    } else {
      props.onComplete({ projectName: projectName(), trackId })
    }
  }

  const handleConditionsComplete = () => {
    props.onComplete({
      projectName: projectName(),
      trackId: selectedTrackId(),
      conditions: Array.from(selectedConditions())
    })
  }

  const toggleCondition = (conditionId: string) => {
    setSelectedConditions((prev) => {
      const next = new Set(prev)
      if (next.has(conditionId)) {
        next.delete(conditionId)
      } else {
        next.add(conditionId)
      }
      return next
    })
  }

  useKeyboard((evt) => {
    const entries = currentEntries()
    const step = currentStep()

    // Handle project_name input step
    if (step === 'project_name') {
      if (evt.name === "return") {
        evt.preventDefault()
        handleProjectNameSubmit()
      } else if (evt.name === "backspace") {
        evt.preventDefault()
        setProjectName((prev) => prev.slice(0, -1))
      } else if (evt.name === "escape") {
        evt.preventDefault()
        props.onCancel?.()
      } else if (evt.sequence && evt.sequence.length === 1 && !evt.ctrl && !evt.meta) {
        // Regular character input
        evt.preventDefault()
        setProjectName((prev) => prev + evt.sequence)
      }
      return
    }

    // Handle tracks and conditions steps
    if (evt.name === "up") {
      evt.preventDefault()
      setSelectedIndex((prev) => Math.max(0, prev - 1))
    } else if (evt.name === "down") {
      evt.preventDefault()
      setSelectedIndex((prev) => Math.min(entries.length - 1, prev + 1))
    } else if (evt.name === "return") {
      evt.preventDefault()
      if (step === 'tracks') {
        const [trackId] = entries[selectedIndex()]
        handleTrackSelect(trackId)
      } else {
        // In conditions step, Enter toggles the checkbox
        const [conditionId] = entries[selectedIndex()]
        toggleCondition(conditionId)
      }
    } else if (evt.name === "tab" && step === 'conditions') {
      evt.preventDefault()
      handleConditionsComplete()
    } else if (evt.name === "escape") {
      evt.preventDefault()
      props.onCancel?.()
    } else if (evt.name && /^[1-9]$/.test(evt.name)) {
      const num = parseInt(evt.name, 10)
      if (num >= 1 && num <= entries.length) {
        evt.preventDefault()
        if (step === 'tracks') {
          const [trackId] = entries[num - 1]
          handleTrackSelect(trackId)
        } else {
          const [conditionId] = entries[num - 1]
          toggleCondition(conditionId)
        }
      }
    }
  })

  const termWidth = () => dimensions()?.width ?? 80
  const termHeight = () => dimensions()?.height ?? 24

  return (
    <box
      width={termWidth()}
      height={termHeight()}
      backgroundColor={themeCtx.theme.background}
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
    >
      <box
        flexDirection="column"
        width={Math.min(60, termWidth() - 4)}
        backgroundColor={themeCtx.theme.backgroundPanel}
        borderColor={themeCtx.theme.primary}
        border={["top", "bottom", "left", "right"]}
        borderStyle="rounded"
        paddingLeft={3}
        paddingRight={3}
        paddingTop={2}
        paddingBottom={2}
        gap={1}
      >
        {/* PO Avatar */}
        <box flexDirection="row" gap={2} marginBottom={1}>
          <box
            backgroundColor={themeCtx.theme.backgroundElement}
            paddingLeft={1}
            paddingRight={1}
          >
            <text fg={themeCtx.theme.text}>[0.0]</text>
          </box>
          <text fg={themeCtx.theme.textMuted}>PO</text>
        </box>

        {/* Typing question */}
        <box marginBottom={1}>
          <text fg={themeCtx.theme.text}>
            "{typedText()}{typingDone() ? "" : "_"}"
          </text>
        </box>

        {/* Options */}
        <box flexDirection="column" gap={1} marginTop={1}>
          <Show when={currentStep() === 'project_name'}>
            <box flexDirection="row" gap={1}>
              <text fg={themeCtx.theme.primary}>{">"}</text>
              <box
                backgroundColor={themeCtx.theme.backgroundElement}
                paddingLeft={1}
                paddingRight={1}
                minWidth={30}
              >
                <text fg={themeCtx.theme.text}>
                  {projectName()}{typingDone() ? "_" : ""}
                </text>
              </box>
            </box>
          </Show>

          <Show when={currentStep() === 'tracks'}>
            <For each={trackEntries()}>
              {([trackId, config], index) => {
                const isSelected = () => index() === selectedIndex()
                return (
                  <box flexDirection="column">
                    <box flexDirection="row" gap={1}>
                      <text fg={isSelected() ? themeCtx.theme.primary : themeCtx.theme.textMuted}>
                        {isSelected() ? ">" : " "}
                      </text>
                      <text fg={isSelected() ? themeCtx.theme.primary : themeCtx.theme.textMuted}>
                        {isSelected() ? "(*)" : "( )"}
                      </text>
                      <text fg={isSelected() ? themeCtx.theme.primary : themeCtx.theme.text}>
                        {config.label}
                      </text>
                    </box>
                    {config.description && (
                      <box marginLeft={6}>
                        <text fg={themeCtx.theme.textMuted}>{config.description}</text>
                      </box>
                    )}
                  </box>
                )
              }}
            </For>
          </Show>

          <Show when={currentStep() === 'conditions'}>
            <For each={conditionEntries()}>
              {([conditionId, config], index) => {
                const isSelected = () => index() === selectedIndex()
                const isChecked = () => selectedConditions().has(conditionId)
                return (
                  <box flexDirection="column">
                    <box flexDirection="row" gap={1}>
                      <text fg={isSelected() ? themeCtx.theme.primary : themeCtx.theme.textMuted}>
                        {isSelected() ? ">" : " "}
                      </text>
                      <text fg={isChecked() ? themeCtx.theme.primary : themeCtx.theme.textMuted}>
                        {isChecked() ? "[x]" : "[ ]"}
                      </text>
                      <text fg={isSelected() ? themeCtx.theme.primary : themeCtx.theme.text}>
                        {config.label}
                      </text>
                    </box>
                    {config.description && (
                      <box marginLeft={6}>
                        <text fg={themeCtx.theme.textMuted}>{config.description}</text>
                      </box>
                    )}
                  </box>
                )
              }}
            </For>
          </Show>
        </box>

        {/* Footer */}
        <box marginTop={2}>
          <Show when={currentStep() === 'project_name'}>
            <text fg={themeCtx.theme.textMuted}>
              [Enter] Confirm  [Esc] Cancel
            </text>
          </Show>
          <Show when={currentStep() === 'tracks'}>
            <text fg={themeCtx.theme.textMuted}>
              [Up/Down] Navigate  [Enter] Select  [Esc] Cancel
            </text>
          </Show>
          <Show when={currentStep() === 'conditions'}>
            <text fg={themeCtx.theme.textMuted}>
              [Up/Down] Navigate  [Enter] Toggle  [Tab] Confirm  [Esc] Cancel
            </text>
          </Show>
        </box>
      </box>
    </box>
  )
}
