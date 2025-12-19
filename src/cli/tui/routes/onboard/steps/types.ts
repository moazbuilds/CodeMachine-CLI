/**
 * Shared types for onboard steps
 */

import type { RGBA } from "@opentui/core"
import type { TrackConfig, ConditionConfig } from "../../../../../workflows/templates/types"
import type { AgentDefinition } from "../../../../../shared/agents/config/types"

export type OnboardStep = 'project_name' | 'tracks' | 'conditions' | 'autopilot'

export interface StepTheme {
  primary: RGBA
  text: RGBA
  textMuted: RGBA
  backgroundElement: RGBA
}

export interface ProjectNameStepProps {
  theme: StepTheme
  projectName: string
  typingDone: boolean
}

export interface TracksStepProps {
  theme: StepTheme
  tracks: [string, TrackConfig][]
  selectedIndex: number
}

export interface ConditionsStepProps {
  theme: StepTheme
  conditions: [string, ConditionConfig][]
  selectedIndex: number
  selectedConditions: Set<string>
}

export interface AutopilotStepProps {
  theme: StepTheme
  autopilots: (readonly [string, AgentDefinition])[]
  selectedIndex: number
}
