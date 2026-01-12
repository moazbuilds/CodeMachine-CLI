/** @jsxImportSource @opentui/solid */
/**
 * Onboard View Component
 *
 * Main onboarding view that composes question display, inputs, and options.
 */

import { createSignal, createMemo, onMount, onCleanup, Show } from "solid-js"
import { useTerminalDimensions } from "@opentui/solid"
import { useTheme } from "@tui/shared/context/theme"
import type { TracksConfig, ConditionGroup, ConditionConfig } from "../../../../workflows/templates/types"
import type { AgentDefinition } from "../../../../shared/agents/config/types"
import type { WorkflowEventBus } from "../../../../workflows/events/event-bus"
import type { OnboardingService } from "../../../../workflows/onboarding/service"
import type { OnboardStep } from "../../../../workflows/events/types"

import { useOnboardKeyboard } from "./hooks/use-onboard-keyboard"
import { QuestionDisplay } from "./components/question-display"
import { ProjectNameInput } from "./components/project-name-input"
import { OptionList, type OptionItem } from "./components/option-list"
import { FooterHints } from "./components/footer-hints"
import { LaunchingView } from "./components/launching-view"

export interface OnboardViewProps {
  tracks?: TracksConfig
  conditionGroups?: ConditionGroup[]
  controllerAgents?: AgentDefinition[]
  initialProjectName?: string | null
  onComplete: (result: {
    projectName?: string
    trackId?: string
    conditions?: string[]
    controllerAgentId?: string
  }) => void
  onCancel?: () => void
  eventBus?: WorkflowEventBus
  service?: OnboardingService
}

interface ChildQuestionContext {
  parentConditionId: string
  question: string
  multiSelect: boolean
  conditions: Record<string, ConditionConfig>
}

export function OnboardView(props: OnboardViewProps) {
  const themeCtx = useTheme()
  const dimensions = useTerminalDimensions()

  // UI state
  const [selectedIndex, setSelectedIndex] = createSignal(0)
  const [currentStep, setCurrentStep] = createSignal<OnboardStep>('project_name')
  const [projectName, setProjectName] = createSignal("")
  const [currentGroupSelections, setCurrentGroupSelections] = createSignal<Set<string>>(new Set())

  // Legacy state (for backward compatibility without service)
  const [selectedTrackId, setSelectedTrackId] = createSignal<string | undefined>()
  const [selectedConditions, setSelectedConditions] = createSignal<Set<string>>(new Set())
  const [currentGroupIndex, setCurrentGroupIndex] = createSignal(0)
  const [pendingChildQuestions, setPendingChildQuestions] = createSignal<ChildQuestionContext[]>([])
  const [currentChildContext, setCurrentChildContext] = createSignal<ChildQuestionContext | null>(null)

  // Helpers
  const useService = () => !!props.service
  const hasTracks = () => props.tracks && Object.keys(props.tracks.options).length > 0
  const hasControllers = () => props.controllerAgents && props.controllerAgents.length > 0

  const applicableGroups = createMemo(() => {
    if (!props.conditionGroups) return []
    const trackId = selectedTrackId()
    return props.conditionGroups.filter(group => {
      if (!group.tracks || group.tracks.length === 0) return true
      return trackId ? group.tracks.includes(trackId) : true
    })
  })

  const hasConditionGroups = () => applicableGroups().length > 0

  const currentGroup = () => {
    const groups = applicableGroups()
    const idx = currentGroupIndex()
    return idx < groups.length ? groups[idx] : null
  }

  // Question text
  const currentQuestion = createMemo(() => {
    // Always track currentStep to trigger re-evaluation on step changes
    const step = currentStep()
    if (useService()) {
      return props.service!.getCurrentQuestion()
    }
    // Legacy: compute from local state
    switch (step) {
      case 'project_name':
        return "What is your project name?"
      case 'tracks':
        return props.tracks?.question ?? "Select a track:"
      case 'condition_group':
        return currentGroup()?.question ?? ""
      case 'condition_child':
        return currentChildContext()?.question ?? ""
      case 'controller_conversation':
        return "Chat with controller to prepare for the workflow"
      case 'launching':
        return "Initializing controller agent..."
      default:
        return ""
    }
  })


  // Current entries for selection - memoized for reactivity
  const currentOptions = createMemo(() => {
    // Force dependency on currentStep to trigger re-evaluation when step changes
    const step = currentStep()
    if (useService()) {
      return props.service!.getCurrentOptions()
    }
    return getEntriesLegacy(step)
  })

  // Legacy entries computation (when not using service)
  const getEntriesLegacy = (step: OnboardStep): Array<readonly [string, unknown]> => {
    switch (step) {
      case 'tracks':
        return props.tracks ? Object.entries(props.tracks.options) : []
      case 'condition_group': {
        const group = currentGroup()
        return group ? Object.entries(group.conditions) : []
      }
      case 'condition_child': {
        const ctx = currentChildContext()
        return ctx ? Object.entries(ctx.conditions) : []
      }
      case 'controller_conversation':
        // Controller is from template, no selection needed
        return []
      default:
        return []
    }
  }

  // Get entries for keyboard handler (uses the memo)
  const getEntries = () => currentOptions()

  // Convert entries to OptionItem format - memoized for reactivity
  const options = createMemo((): OptionItem[] => {
    const entries = currentOptions()
    return entries.map(([id, config]) => ({
      id: id as string,
      label: (config as { label?: string; name?: string })?.label ?? (config as { name?: string })?.name ?? (id as string),
      description: (config as { description?: string })?.description,
    }))
  })

  // Multi-select check
  const checkMultiSelect = () => {
    if (useService()) {
      return props.service!.isMultiSelect()
    }
    const step = currentStep()
    if (step === 'condition_group') {
      return currentGroup()?.multiSelect ?? false
    }
    if (step === 'condition_child') {
      return currentChildContext()?.multiSelect ?? false
    }
    return false
  }

  // Condition selected check - uses local signal which is synced from service events
  const checkConditionSelected = (conditionId: string) => {
    return currentGroupSelections().has(conditionId)
  }

  // Legacy handlers
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
          conditions: childGroup.conditions,
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
    } else {
      // Note: controller_conversation is handled after onboarding completes,
      // not as a selection step
      props.onComplete({
        projectName: projectName(),
        trackId: selectedTrackId(),
        conditions: Array.from(selectedConditions()),
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
      setCurrentChildContext(null)
      advanceToNextGroupOrComplete()
    }
  }

  // Initialize
  onMount(() => {
    if (props.service && props.eventBus) {
      const unsubStep = props.eventBus.on('onboard:step', (event) => {
        setCurrentStep(event.step)
        setSelectedIndex(0)
        setCurrentGroupSelections(new Set<string>())
      })

      // Subscribe to condition events to sync checkbox state
      const unsubCondition = props.eventBus.on('onboard:condition', () => {
        // Sync the service's selection state to the local signal for reactivity
        const serviceSelections = new Set<string>()
        for (const [id] of props.service!.getCurrentOptions()) {
          if (props.service!.isConditionSelected(id)) {
            serviceSelections.add(id)
          }
        }
        setCurrentGroupSelections(serviceSelections)
      })

      props.service.start()
      onCleanup(() => {
        unsubStep()
        unsubCondition()
      })
      return
    }

    // Legacy initialization
    if (props.initialProjectName) {
      setProjectName(props.initialProjectName)
      if (hasTracks()) {
        setCurrentStep('tracks')
      } else if (hasConditionGroups()) {
        setCurrentStep('condition_group')
      } else {
        // Note: controller_conversation is handled after onboarding completes
        props.onComplete({ projectName: props.initialProjectName })
      }
    }
  })

  // Keyboard handling
  useOnboardKeyboard({
    currentStep,
    getEntries,
    selectedIndex,
    setSelectedIndex,
    projectName,
    setProjectName,
    checkMultiSelect,
    service: props.service,
    handlers: {
      onProjectNameSubmit: () => {
        const name = projectName().trim()
        if (!name) return
        if (hasTracks()) {
          setCurrentStep('tracks')
        } else if (hasConditionGroups()) {
          setCurrentStep('condition_group')
        } else {
          // Note: controller_conversation is handled after onboarding completes
          props.onComplete({ projectName: name })
        }
      },
      onTrackSelect: (trackId) => {
        setSelectedTrackId(trackId)
        setCurrentGroupIndex(0)
        if (hasConditionGroups()) {
          setCurrentStep('condition_group')
        } else {
          // Note: controller_conversation is handled after onboarding completes
          props.onComplete({ projectName: projectName(), trackId })
        }
      },
      onGroupSelection: (conditionId) => {
        const group = currentGroup()
        if (!group) return
        if (group.multiSelect) {
          setCurrentGroupSelections(prev => {
            const next = new Set(prev)
            if (next.has(conditionId)) next.delete(conditionId)
            else next.add(conditionId)
            return next
          })
        } else {
          setSelectedConditions(prev => new Set([...prev, conditionId]))
          const childQuestions = queueChildQuestions([conditionId])
          if (childQuestions.length > 0) {
            setPendingChildQuestions(childQuestions)
            processNextChildQuestion()
          } else {
            advanceToNextGroupOrComplete()
          }
        }
      },
      onGroupConfirm: () => {
        const selections = Array.from(currentGroupSelections())
        setSelectedConditions(prev => new Set([...prev, ...selections]))
        const childQuestions = queueChildQuestions(selections)
        if (childQuestions.length > 0) {
          setPendingChildQuestions(childQuestions)
          processNextChildQuestion()
        } else {
          advanceToNextGroupOrComplete()
        }
      },
      onChildSelection: (conditionId) => {
        const ctx = currentChildContext()
        if (!ctx) return
        if (ctx.multiSelect) {
          setCurrentGroupSelections(prev => {
            const next = new Set(prev)
            if (next.has(conditionId)) next.delete(conditionId)
            else next.add(conditionId)
            return next
          })
        } else {
          setSelectedConditions(prev => new Set([...prev, conditionId]))
          processNextChildQuestion()
        }
      },
      onChildConfirm: () => {
        const selections = Array.from(currentGroupSelections())
        setSelectedConditions(prev => new Set([...prev, ...selections]))
        processNextChildQuestion()
      },
      onControllerSelect: (_controllerId) => {
        // Controller is now specified in template, not selected by user
        // This handler is kept for backward compatibility but shouldn't be called
        props.onComplete({
          projectName: projectName(),
          trackId: selectedTrackId(),
          conditions: Array.from(selectedConditions()),
        })
      },
      onCancel: () => props.onCancel?.(),
    },
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
        <Show when={currentStep() === 'launching' && props.service && props.eventBus}>
          <LaunchingView
            controllerName={(props.service!.getController()?.agentName) ?? 'controller'}
            eventBus={props.eventBus!}
            service={props.service!}
          />
        </Show>

        <Show when={currentStep() !== 'launching'}>
          <QuestionDisplay question={currentQuestion} />

          <box flexDirection="column" gap={1} marginTop={1}>
            <Show when={currentStep() === 'project_name'}>
              <ProjectNameInput value={projectName} />
            </Show>

            <Show when={currentStep() !== 'project_name'}>
              <OptionList
                options={options()}
                selectedIndex={selectedIndex}
                multiSelect={checkMultiSelect()}
                isChecked={checkConditionSelected}
              />
            </Show>
          </box>

          <FooterHints
            currentStep={currentStep}
            isMultiSelect={() => checkMultiSelect()}
          />
        </Show>
      </box>
    </box>
  )
}
