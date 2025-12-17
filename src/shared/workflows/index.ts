// Template tracking functions
export {
  getActiveTemplate,
  setActiveTemplate,
  hasTemplateChanged,
  getTemplatePathFromTracking,
  getSelectedTrack,
  setSelectedTrack,
  getSelectedConditions,
  hasSelectedConditions,
  setSelectedConditions,
  getProjectName,
  setProjectName,
} from './template.js';

// Types
export type { StepData, AutopilotConfig, ControllerConfig, AccumulatedTelemetry } from './template.js';

// Autopilot functions (primary exports)
export {
  getAutopilotAgents,
  initAutopilotAgent,
  loadAutopilotConfig,
  saveAutopilotConfig,
  setAutonomousMode,
  clearAutopilotConfig,
  parseAutopilotAction,
  extractInputText,
  // Legacy aliases
  getControllerAgents,
  initControllerAgent,
  loadControllerConfig,
  saveControllerConfig,
  clearControllerConfig,
  parseControllerAction,
} from './autopilot.js';

// Export action type
export type { AutopilotAction } from './autopilot.js';

// Step tracking functions
export {
  getCompletedSteps,
  getStepData,
  isStepCompleted,
  markStepStarted,
  initStepSession,
  updateStepSession,
  markChainCompleted,
  markStepCompleted,
  getChainResumeInfo,
  clearCompletedSteps,
  getNotCompletedSteps,
  removeFromNotCompleted,
  clearNotCompletedSteps,
  getResumeStartIndex,
  updateStepDuration,
  updateStepTelemetry,
  getStepDuration,
  getStepTelemetry,
} from './steps.js';
