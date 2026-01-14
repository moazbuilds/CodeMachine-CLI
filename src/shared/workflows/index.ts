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

// Controller functions (consolidated in src/workflows/controller/)
export {
  initControllerAgent,
  getControllerAgents,
  loadControllerConfig,
  saveControllerConfig,
  setAutonomousMode,
  clearControllerConfig,
} from '../../workflows/controller/index.js';

// Controller helper for workflow templates
export {
  controller,
  isControllerDefinition,
  type ControllerDefinition,
  type ControllerOptions,
} from '../../workflows/controller/helper.js';
