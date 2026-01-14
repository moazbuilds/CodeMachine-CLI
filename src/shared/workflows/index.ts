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
  getControllerView,
  setControllerView,
} from './template.js';

// Types
export type { StepData, ControllerConfig } from './template.js';

// Controller initialization (config functions moved to src/workflows/controller/config.ts)
export {
  initControllerAgent,
  parseControllerAction,
  extractInputText,
} from './controller.js';

// Re-export config functions from new location for backward compatibility
export {
  getControllerAgents,
  loadControllerConfig,
  saveControllerConfig,
  setAutonomousMode,
  clearControllerConfig,
} from '../../workflows/controller/config.js';

// Note: Step tracking functions have been moved to src/workflows/indexing/
// Import from 'src/workflows/indexing/index.js' for StepIndexManager

// Controller helper for workflow templates
export {
  controller,
  isControllerDefinition,
  type ControllerDefinition,
  type ControllerOptions,
} from './controller-helper.js';
