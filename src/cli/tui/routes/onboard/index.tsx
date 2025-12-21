/** @jsxImportSource @opentui/solid */
/**
 * Onboard View
 *
 * Pre-workflow onboarding flow: track selection, condition groups with nested children, etc.
 */

import { createSignal, For, onMount, Show, createEffect, createMemo } from "solid-js"
import { useKeyboard, useTerminalDimensions } from "@opentui/solid"
import { useTheme } from "@tui/shared/context/theme"
import type { TracksConfig, ConditionGroup, ConditionConfig } from "../../../../workflows/templates/types"
import type { AgentDefinition } from "../../../../shared/agents/config/types"

export interface OnboardProps {
  tracks?: TracksConfig
  conditionGroups?: ConditionGroup[]
  controllerAgents?: AgentDefinition[] // Available controller agents
  initialProjectName?: string | null // If set, skip project name input
  onComplete: (result: { projectName?: string; trackId?: string; conditions?: string[]; controllerAgentId?: string }) => void
  onCancel?: () => void
}

type OnboardStep = 'project_name' | 'tracks' | 'condition_group' | 'condition_child' | 'controller'

interface ChildQuestionContext {
  parentConditionId: string
  question: string
  multiSelect: boolean
  conditions: Record<string, ConditionConfig>
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
  const [_selectedControllerId, setSelectedControllerId] = createSignal<string | undefined>()

  // Condition group wizard state
  const [currentGroupIndex, setCurrentGroupIndex] = createSignal(0)
  const [pendingChildQuestions, setPendingChildQuestions] = createSignal<ChildQuestionContext[]>([])
  const [currentChildContext, setCurrentChildContext] = createSignal<ChildQuestionContext | null>(null)
  // Track selections within current group (for multi-select groups)
  const [currentGroupSelections, setCurrentGroupSelections] = createSignal<Set<string>>(new Set())

  const hasTracks = () => props.tracks && Object.keys(props.tracks.options).length > 0
  const hasControllers = () => props.controllerAgents && props.controllerAgents.length > 0

  // Filter condition groups by selected track
  const applicableGroups = createMemo(() => {
    if (!props.conditionGroups) return []
    const trackId = selectedTrackId()
    return props.conditionGroups.filter(group => {
      // If no tracks specified, show for all tracks
      if (!group.tracks || group.tracks.length === 0) return true
      // If tracks specified, only show if selected track is in the list
      return trackId ? group.tracks.includes(trackId) : true
    })
  })

  const hasConditionGroups = () => applicableGroups().length > 0

  const currentGroup = () => {
    const groups = applicableGroups()
    const idx = currentGroupIndex()
    return idx < groups.length ? groups[idx] : null
  }

  // Determine initial step - skip project_name if already set
  onMount(() => {
    if (props.initialProjectName) {
      setProjectName(props.initialProjectName)
      if (hasTracks()) {
        setCurrentStep('tracks')
      } else if (hasConditionGroups()) {
        setCurrentStep('condition_group')
      } else if (hasControllers()) {
        setCurrentStep('controller')
      } else {
        props.onComplete({ projectName: props.initialProjectName })
      }
    }
  })

  const projectNameQuestion = "What is your project name?"
  const trackQuestion = () => props.tracks?.question ?? "Select a track:"
  const controllerQuestion = "Select a controller agent for autonomous mode:"

  const trackEntries = () => props.tracks ? Object.entries(props.tracks.options) : []
  const controllerEntries = () => props.controllerAgents ? props.controllerAgents.map(a => [a.id, a] as const) : []

  // Current condition entries (for group or child)
  const currentConditionEntries = () => {
    const step = currentStep()
    if (step === 'condition_group') {
      const group = currentGroup()
      return group ? Object.entries(group.conditions) : []
    } else if (step === 'condition_child') {
      const ctx = currentChildContext()
      return ctx ? Object.entries(ctx.conditions) : []
    }
    return []
  }

  const currentQuestion = () => {
    const step = currentStep()
    switch (step) {
      case 'project_name': return projectNameQuestion
      case 'tracks': return trackQuestion()
      case 'condition_group': return currentGroup()?.question ?? ""
      case 'condition_child': return currentChildContext()?.question ?? ""
      case 'controller': return controllerQuestion
    }
  }

  const currentEntries = () => {
    const step = currentStep()
    switch (step) {
      case 'tracks': return trackEntries()
      case 'condition_group':
      case 'condition_child':
        return currentConditionEntries()
      case 'controller': return controllerEntries()
      default: return []
    }
  }

  // Is current step a multi-select?
  const isMultiSelect = () => {
    const step = currentStep()
    if (step === 'condition_group') {
      return currentGroup()?.multiSelect ?? false
    }
    if (step === 'condition_child') {
      return currentChildContext()?.multiSelect ?? false
    }
    return false
  }

  // Typing effect - reset when step changes or question changes
  createEffect(() => {
    const _step = currentStep()
    const question = currentQuestion()
    // Also track group index and child context to trigger on changes
    const _groupIdx = currentGroupIndex()
    const _childCtx = currentChildContext()

    setTypedText("")
    setTypingDone(false)
    setSelectedIndex(0)
    setCurrentGroupSelections(new Set<string>())

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
    } else if (hasConditionGroups()) {
      setCurrentStep('condition_group')
    } else if (hasControllers()) {
      setCurrentStep('controller')
    } else {
      props.onComplete({ projectName: name })
    }
  }

  const handleTrackSelect = (trackId: string) => {
    setSelectedTrackId(trackId)
    // Reset group index since applicable groups may have changed
    setCurrentGroupIndex(0)
    if (hasConditionGroups()) {
      setCurrentStep('condition_group')
    } else if (hasControllers()) {
      setCurrentStep('controller')
    } else {
      props.onComplete({ projectName: projectName(), trackId })
    }
  }

  // Process child questions for selected conditions
  const queueChildQuestions = (conditionIds: string[]) => {
    const group = currentGroup()
    if (!group?.children) return []

    const childQuestions: ChildQuestionContext[] = []
    for (const condId of conditionIds) {
      const childGroup = group.children[condId]
      if (childGroup) {
        childQuestions.push({
          parentConditionId: condId,
          question: childGroup.question,
          multiSelect: childGroup.multiSelect ?? false,
          conditions: childGroup.conditions
        })
      }
    }
    return childQuestions
  }

  const advanceToNextGroupOrComplete = () => {
    const groups = applicableGroups()
    const nextIdx = currentGroupIndex() + 1

    if (nextIdx < groups.length) {
      setCurrentGroupIndex(nextIdx)
      setCurrentStep('condition_group')
    } else if (hasControllers()) {
      setCurrentStep('controller')
    } else {
      props.onComplete({
        projectName: projectName(),
        trackId: selectedTrackId(),
        conditions: Array.from(selectedConditions())
      })
    }
  }

  const processNextChildQuestion = () => {
    const pending = pendingChildQuestions()
    if (pending.length > 0) {
      const [next, ...rest] = pending
      setPendingChildQuestions(rest)
      setCurrentChildContext(next)
      setCurrentStep('condition_child')
    } else {
      // No more child questions, advance to next group
      setCurrentChildContext(null)
      advanceToNextGroupOrComplete()
    }
  }

  // Handle group completion (single-select: Enter selects and advances, multi-select: Tab confirms)
  const handleGroupSelection = (conditionId: string) => {
    const group = currentGroup()
    if (!group) return

    if (group.multiSelect) {
      // Toggle selection in current group
      setCurrentGroupSelections(prev => {
        const next = new Set(prev)
        if (next.has(conditionId)) {
          next.delete(conditionId)
        } else {
          next.add(conditionId)
        }
        return next
      })
    } else {
      // Single select: add to global selections and proceed
      setSelectedConditions(prev => new Set([...prev, conditionId]))

      // Queue child questions if any
      const childQuestions = queueChildQuestions([conditionId])
      if (childQuestions.length > 0) {
        setPendingChildQuestions(childQuestions)
        processNextChildQuestion()
      } else {
        advanceToNextGroupOrComplete()
      }
    }
  }

  const handleGroupConfirm = () => {
    // For multi-select groups, Tab confirms
    const selections = Array.from(currentGroupSelections())

    // Add all selections to global selectedConditions
    setSelectedConditions(prev => new Set([...prev, ...selections]))

    // Queue child questions for all selected conditions
    const childQuestions = queueChildQuestions(selections)
    if (childQuestions.length > 0) {
      setPendingChildQuestions(childQuestions)
      processNextChildQuestion()
    } else {
      advanceToNextGroupOrComplete()
    }
  }

  // Handle child question selection
  const handleChildSelection = (conditionId: string) => {
    const ctx = currentChildContext()
    if (!ctx) return

    if (ctx.multiSelect) {
      // Toggle selection
      setCurrentGroupSelections(prev => {
        const next = new Set(prev)
        if (next.has(conditionId)) {
          next.delete(conditionId)
        } else {
          next.add(conditionId)
        }
        return next
      })
    } else {
      // Single select: add and proceed
      setSelectedConditions(prev => new Set([...prev, conditionId]))
      processNextChildQuestion()
    }
  }

  const handleChildConfirm = () => {
    // For multi-select child questions
    const selections = Array.from(currentGroupSelections())
    setSelectedConditions(prev => new Set([...prev, ...selections]))
    processNextChildQuestion()
  }

  const handleControllerSelect = (controllerId: string) => {
    setSelectedControllerId(controllerId)
    props.onComplete({
      projectName: projectName(),
      trackId: selectedTrackId(),
      conditions: Array.from(selectedConditions()),
      controllerAgentId: controllerId
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
        evt.preventDefault()
        setProjectName((prev) => prev + evt.sequence)
      }
      return
    }

    // Navigation
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
      } else if (step === 'controller') {
        const [controllerId] = entries[selectedIndex()]
        handleControllerSelect(controllerId as string)
      } else if (step === 'condition_group') {
        const [conditionId] = entries[selectedIndex()]
        handleGroupSelection(conditionId as string)
      } else if (step === 'condition_child') {
        const [conditionId] = entries[selectedIndex()]
        handleChildSelection(conditionId as string)
      }
    } else if (evt.name === "tab") {
      evt.preventDefault()
      if (step === 'condition_group' && isMultiSelect()) {
        handleGroupConfirm()
      } else if (step === 'condition_child' && isMultiSelect()) {
        handleChildConfirm()
      }
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
        } else if (step === 'controller') {
          const [controllerId] = entries[num - 1]
          handleControllerSelect(controllerId as string)
        } else if (step === 'condition_group') {
          const [conditionId] = entries[num - 1]
          handleGroupSelection(conditionId as string)
        } else if (step === 'condition_child') {
          const [conditionId] = entries[num - 1]
          handleChildSelection(conditionId as string)
        }
      }
    }
  })

  const termWidth = () => dimensions()?.width ?? 80
  const termHeight = () => dimensions()?.height ?? 24

  // Check if a condition is selected (for checkboxes)
  const isConditionChecked = (conditionId: string) => {
    return currentGroupSelections().has(conditionId)
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
              {([_trackId, config], index) => {
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

          <Show when={currentStep() === 'condition_group' || currentStep() === 'condition_child'}>
            <For each={currentConditionEntries()}>
              {([conditionId, config], index) => {
                const isSelected = () => index() === selectedIndex()
                const isChecked = () => isConditionChecked(conditionId)
                const multiSelect = isMultiSelect()
                return (
                  <box flexDirection="column">
                    <box flexDirection="row" gap={1}>
                      <text fg={isSelected() ? themeCtx.theme.primary : themeCtx.theme.textMuted}>
                        {isSelected() ? ">" : " "}
                      </text>
                      <text fg={multiSelect ? (isChecked() ? themeCtx.theme.primary : themeCtx.theme.textMuted) : (isSelected() ? themeCtx.theme.primary : themeCtx.theme.textMuted)}>
                        {multiSelect ? (isChecked() ? "[x]" : "[ ]") : (isSelected() ? "(*)" : "( )")}
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

          <Show when={currentStep() === 'controller'}>
            <For each={controllerEntries()}>
              {([controllerId, _agent], index) => {
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
                        {controllerId}
                      </text>
                    </box>
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
          <Show when={(currentStep() === 'condition_group' || currentStep() === 'condition_child') && isMultiSelect()}>
            <text fg={themeCtx.theme.textMuted}>
              [Up/Down] Navigate  [Enter] Toggle  [Tab] Confirm  [Esc] Cancel
            </text>
          </Show>
          <Show when={(currentStep() === 'condition_group' || currentStep() === 'condition_child') && !isMultiSelect()}>
            <text fg={themeCtx.theme.textMuted}>
              [Up/Down] Navigate  [Enter] Select  [Esc] Cancel
            </text>
          </Show>
          <Show when={currentStep() === 'controller'}>
            <text fg={themeCtx.theme.textMuted}>
              [Up/Down] Navigate  [Enter] Select  [Esc] Cancel
            </text>
          </Show>
        </box>
      </box>
    </box>
  )
}
