/**
 * Onboarding Module
 *
 * Provides event-driven onboarding flow with debug logging.
 * Uses the shared WorkflowEventBus for event emission.
 */

export { OnboardingEmitter, createOnboardingEmitter } from './emitter.js';
export {
  OnboardingService,
  createOnboardingService,
  type OnboardingServiceConfig,
} from './service.js';
