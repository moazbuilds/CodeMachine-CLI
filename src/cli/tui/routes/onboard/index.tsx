/** @jsxImportSource @opentui/solid */
/**
 * Onboard View
 *
 * Pre-workflow onboarding flow: track selection, conditions selection, etc.
 * Step rendering is delegated to step components in ./steps/
 */

import { createSignal, onMount, Show, createEffect } from "solid-js"
import { useKeyboard, useTerminalDimensions } from "@opentui/solid"
import { useTheme } from "@tui/shared/context/theme"
import { Spinner } from "@tui/shared/components/spinner"
import type { TrackConfig, ConditionConfig } from "../../../../workflows/templates/types"
import type { AgentDefinition } from "../../../../shared/agents/config/types"
import {
  type OnboardStep,
  ProjectNameStep,
  TracksStep,
  ConditionsStep,
  AutopilotStep,
} from "./steps"

export interface OnboardProps {
  tracks?: Record<string, TrackConfig>
  conditions?: Record<string, ConditionConfig>
  autopilotAgents?: AgentDefinition[]
  initialProjectName?: string | null
  onComplete: (result: { projectName?: string; trackId?: string; conditions?: string[]; autopilotAgentId?: string }) => void
  onCancel?: () => void
  isLoading?: boolean
  loadingMessage?: string
}

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
  const hasAutopilots = () => props.autopilotAgents && props.autopilotAgents.length > 0

  // Determine initial step - skip project_name if already set
  onMount(() => {
    if (props.initialProjectName) {
      setProjectName(props.initialProjectName)
      if (hasTracks()) {
        setCurrentStep('tracks')
      } else if (hasConditions()) {
        setCurrentStep('conditions')
      } else if (hasAutopilots()) {
        setCurrentStep('autopilot')
      } else {
        props.onComplete({ projectName: props.initialProjectName })
      }
    }
  })

  const questions: Record<OnboardStep, string> = {
    project_name: "What is your project name?",
    tracks: "What is your project size?",
    conditions: "What features does your project have?",
    autopilot: "Select an autopilot agent for autonomous mode:",
  }

  const trackEntries = () => props.tracks ? Object.entries(props.tracks) : []
  const conditionEntries = () => props.conditions ? Object.entries(props.conditions) : []
  const autopilotEntries = () => props.autopilotAgents ? props.autopilotAgents.map(a => [a.id, a] as const) : []

  const currentQuestion = () => questions[currentStep()]
  const currentEntries = () => {
    switch (currentStep()) {
      case 'tracks': return trackEntries()
      case 'conditions': return conditionEntries()
      case 'autopilot': return autopilotEntries()
      default: return []
    }
  }

  // Typing effect - reset when step changes
  createEffect(() => {
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

  // Step navigation handlers
  const handleProjectNameSubmit = () => {
    const name = projectName().trim()
    if (!name) return

    if (hasTracks()) setCurrentStep('tracks')
    else if (hasConditions()) setCurrentStep('conditions')
    else if (hasAutopilots()) setCurrentStep('autopilot')
    else props.onComplete({ projectName: name })
  }

  const handleTrackSelect = (trackId: string) => {
    setSelectedTrackId(trackId)
    if (hasConditions()) setCurrentStep('conditions')
    else if (hasAutopilots()) setCurrentStep('autopilot')
    else props.onComplete({ projectName: projectName(), trackId })
  }

  const handleConditionsComplete = () => {
    if (hasAutopilots()) {
      setCurrentStep('autopilot')
    } else {
      props.onComplete({
        projectName: projectName(),
        trackId: selectedTrackId(),
        conditions: Array.from(selectedConditions())
      })
    }
  }

  const handleAutopilotSelect = (autopilotId: string) => {
    props.onComplete({
      projectName: projectName(),
      trackId: selectedTrackId(),
      conditions: Array.from(selectedConditions()),
      autopilotAgentId: autopilotId
    })
  }

  const toggleCondition = (conditionId: string) => {
    setSelectedConditions((prev) => {
      const next = new Set(prev)
      if (next.has(conditionId)) next.delete(conditionId)
      else next.add(conditionId)
      return next
    })
  }

  // Keyboard handling
  useKeyboard((evt) => {
    if (props.isLoading) return

    const entries = currentEntries()
    const step = currentStep()

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
        evt.preventDefault()
        setProjectName((prev) => prev + evt.sequence)
      }
      return
    }

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
        handleTrackSelect(trackId as string)
      } else if (step === 'autopilot') {
        const [autopilotId] = entries[selectedIndex()]
        handleAutopilotSelect(autopilotId as string)
      } else {
        const [conditionId] = entries[selectedIndex()]
        toggleCondition(conditionId as string)
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
          handleTrackSelect(trackId as string)
        } else if (step === 'autopilot') {
          const [autopilotId] = entries[num - 1]
          handleAutopilotSelect(autopilotId as string)
        } else {
          const [conditionId] = entries[num - 1]
          toggleCondition(conditionId as string)
        }
      }
    }
  })

  const termWidth = () => dimensions()?.width ?? 80
  const termHeight = () => dimensions()?.height ?? 24

  const stepTheme = () => ({
    primary: themeCtx.theme.primary,
    text: themeCtx.theme.text,
    textMuted: themeCtx.theme.textMuted,
    backgroundElement: themeCtx.theme.backgroundElement,
  })

  const footerText: Record<OnboardStep, string> = {
    project_name: "[Enter] Confirm  [Esc] Cancel",
    tracks: "[Up/Down] Navigate  [Enter] Select  [Esc] Cancel",
    conditions: "[Up/Down] Navigate  [Enter] Toggle  [Tab] Confirm  [Esc] Cancel",
    autopilot: "[Up/Down] Navigate  [Enter] Select  [Esc] Cancel",
  }

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
          <box backgroundColor={themeCtx.theme.backgroundElement} paddingLeft={1} paddingRight={1}>
            <text fg={themeCtx.theme.text}>[0.0]</text>
          </box>
          <text fg={themeCtx.theme.textMuted}>PO</text>
        </box>

        {/* Loading state */}
        <Show when={props.isLoading}>
          <box flexDirection="row" gap={1} marginBottom={1}>
            <Spinner color={themeCtx.theme.primary} />
            <text fg={themeCtx.theme.text}>{props.loadingMessage || "Loading..."}</text>
          </box>
        </Show>

        {/* Typing question */}
        <Show when={!props.isLoading}>
          <box marginBottom={1}>
            <text fg={themeCtx.theme.text}>
              "{typedText()}{typingDone() ? "" : "_"}"
            </text>
          </box>
        </Show>

        {/* Step-specific content */}
        <Show when={!props.isLoading}>
          <box flexDirection="column" gap={1} marginTop={1}>
            <Show when={currentStep() === 'project_name'}>
              <ProjectNameStep
                theme={stepTheme()}
                projectName={projectName()}
                typingDone={typingDone()}
              />
            </Show>

            <Show when={currentStep() === 'tracks'}>
              <TracksStep
                theme={stepTheme()}
                tracks={trackEntries()}
                selectedIndex={selectedIndex()}
              />
            </Show>

            <Show when={currentStep() === 'conditions'}>
              <ConditionsStep
                theme={stepTheme()}
                conditions={conditionEntries()}
                selectedIndex={selectedIndex()}
                selectedConditions={selectedConditions()}
              />
            </Show>

            <Show when={currentStep() === 'autopilot'}>
              <AutopilotStep
                theme={stepTheme()}
                autopilots={autopilotEntries()}
                selectedIndex={selectedIndex()}
              />
            </Show>
          </box>
        </Show>

        {/* Footer */}
        <Show when={!props.isLoading}>
          <box marginTop={2}>
            <text fg={themeCtx.theme.textMuted}>{footerText[currentStep()]}</text>
          </box>
        </Show>
      </box>
    </box>
  )
}
