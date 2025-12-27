/**
 * Onboard Keyboard Hook
 *
 * Handles keyboard navigation and selection for onboarding flow.
 */

import { useKeyboard } from "@opentui/solid"
import type { Accessor, Setter } from "solid-js"
import type { OnboardingService } from "../../../../../workflows/onboarding/service"
import type { OnboardStep } from "../../../../../workflows/events/types"

export interface OnboardKeyboardHandlers {
  /** Legacy handler for project name submit */
  onProjectNameSubmit?: () => void
  /** Legacy handler for track selection */
  onTrackSelect?: (trackId: string) => void
  /** Legacy handler for condition group selection */
  onGroupSelection?: (conditionId: string) => void
  /** Legacy handler for condition group confirm (multi-select) */
  onGroupConfirm?: () => void
  /** Legacy handler for child condition selection */
  onChildSelection?: (conditionId: string) => void
  /** Legacy handler for child condition confirm (multi-select) */
  onChildConfirm?: () => void
  /** Legacy handler for controller selection */
  onControllerSelect?: (controllerId: string) => void
  /** Legacy handler for cancel */
  onCancel?: () => void
}

export interface UseOnboardKeyboardOptions {
  /** Current step accessor */
  currentStep: Accessor<OnboardStep>
  /** Current entries accessor */
  getEntries: () => Array<readonly [string, unknown]>
  /** Selected index accessor */
  selectedIndex: Accessor<number>
  /** Selected index setter */
  setSelectedIndex: Setter<number>
  /** Project name accessor */
  projectName: Accessor<string>
  /** Project name setter */
  setProjectName: Setter<string>
  /** Check if multi-select mode */
  checkMultiSelect: () => boolean
  /** Service instance (if using event-driven flow) */
  service?: OnboardingService
  /** Legacy handlers (if not using service) */
  handlers?: OnboardKeyboardHandlers
}

export function useOnboardKeyboard(options: UseOnboardKeyboardOptions): void {
  const {
    currentStep,
    getEntries,
    selectedIndex,
    setSelectedIndex,
    projectName,
    setProjectName,
    checkMultiSelect,
    service,
    handlers,
  } = options

  const useService = () => !!service

  useKeyboard((evt) => {
    const entries = getEntries()
    const step = currentStep()

    // Handle project_name input step
    if (step === 'project_name') {
      if (evt.name === "return") {
        evt.preventDefault()
        if (useService()) {
          service!.submitProjectName(projectName())
        } else {
          handlers?.onProjectNameSubmit?.()
        }
      } else if (evt.name === "backspace") {
        evt.preventDefault()
        setProjectName((prev) => prev.slice(0, -1))
      } else if (evt.name === "escape") {
        evt.preventDefault()
        if (useService()) {
          service!.cancel()
        } else {
          handlers?.onCancel?.()
        }
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
      const [id] = entries[selectedIndex()] ?? []
      if (!id) return

      if (useService()) {
        if (step === 'tracks') {
          service!.selectTrack(id as string)
        } else if (step === 'controller') {
          service!.selectController(id as string)
        } else if (step === 'condition_group' || step === 'condition_child') {
          service!.selectCondition(id as string)
        }
      } else {
        if (step === 'tracks') {
          handlers?.onTrackSelect?.(id as string)
        } else if (step === 'controller') {
          handlers?.onControllerSelect?.(id as string)
        } else if (step === 'condition_group') {
          handlers?.onGroupSelection?.(id as string)
        } else if (step === 'condition_child') {
          handlers?.onChildSelection?.(id as string)
        }
      }
    } else if (evt.name === "tab") {
      evt.preventDefault()
      if ((step === 'condition_group' || step === 'condition_child') && checkMultiSelect()) {
        if (useService()) {
          service!.confirmSelections()
        } else if (step === 'condition_group') {
          handlers?.onGroupConfirm?.()
        } else {
          handlers?.onChildConfirm?.()
        }
      }
    } else if (evt.name === "escape") {
      evt.preventDefault()
      if (useService()) {
        service!.cancel()
      } else {
        handlers?.onCancel?.()
      }
    } else if (evt.name && /^[1-9]$/.test(evt.name)) {
      const num = parseInt(evt.name, 10)
      if (num >= 1 && num <= entries.length) {
        evt.preventDefault()
        const [id] = entries[num - 1]
        if (!id) return

        if (useService()) {
          if (step === 'tracks') {
            service!.selectTrack(id as string)
          } else if (step === 'controller') {
            service!.selectController(id as string)
          } else if (step === 'condition_group' || step === 'condition_child') {
            service!.selectCondition(id as string)
          }
        } else {
          if (step === 'tracks') {
            handlers?.onTrackSelect?.(id as string)
          } else if (step === 'controller') {
            handlers?.onControllerSelect?.(id as string)
          } else if (step === 'condition_group') {
            handlers?.onGroupSelection?.(id as string)
          } else if (step === 'condition_child') {
            handlers?.onChildSelection?.(id as string)
          }
        }
      }
    }
  })
}
