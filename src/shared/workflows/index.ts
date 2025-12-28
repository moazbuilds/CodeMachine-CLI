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
export type { StepData, ControllerConfig } from './template.js';

// Controller functions
export {
  getControllerAgents,
  initControllerAgent,
  loadControllerConfig,
  saveControllerConfig,
  setAutonomousMode,
  clearControllerConfig,
  parseControllerAction,
  extractInputText,
} from './controller.js';

// Note: Step tracking functions have been moved to src/workflows/indexing/
// Import from 'src/workflows/indexing/index.js' for StepIndexManager
