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
export type { StepData } from './template.js';

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
} from './steps.js';
