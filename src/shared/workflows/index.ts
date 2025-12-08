// Template tracking functions
export {
  getActiveTemplate,
  setActiveTemplate,
  hasTemplateChanged,
  getTemplatePathFromTracking,
  getSelectedTrack,
  setSelectedTrack,
} from './template.js';

// Step tracking functions
export {
  getCompletedSteps,
  markStepCompleted,
  clearCompletedSteps,
  getNotCompletedSteps,
  markStepStarted,
  removeFromNotCompleted,
  clearNotCompletedSteps,
  getResumeStartIndex,
} from './steps.js';
