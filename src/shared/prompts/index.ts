export { processPrompt, processPromptString } from './replacement/processor.js';
export {
  // Step agent
  STEP_CONTINUE,
  STEP_CONTINUE as DEFAULT_CONTINUATION_PROMPT, // Legacy alias
  STEP_RESUME_DEFAULT,
  stepPrefixUser,
  stepPrefixController,
  // Controller agent
  CONTROLLER_REMINDER_PREFIX,
  controllerPrefixUser,
  controllerPrefixAgent,
  controllerTemplateReview,
} from './injected.js';
