/**
 * Mode Registry
 *
 * Registers and retrieves mode handlers.
 */

import type { ModeHandler } from './types.js';
import type { ModeType } from '../../step/scenarios/types.js';
import { interactiveHandler } from './interactive.js';
import { autonomousHandler } from './autonomous.js';
import { continuousHandler } from './continuous.js';

/**
 * Mode handler registry
 */
const handlers: Record<ModeType, ModeHandler> = {
  interactive: interactiveHandler,
  autonomous: autonomousHandler,
  continuous: continuousHandler,
};

/**
 * Get mode handler by type
 *
 * @param modeType The mode type to get handler for
 * @returns The mode handler
 * @throws If mode type is unknown
 */
export function getModeHandler(modeType: ModeType): ModeHandler {
  const handler = handlers[modeType];
  if (!handler) {
    throw new Error(`Unknown mode type: ${modeType}`);
  }
  return handler;
}

// Export handlers
export { interactiveHandler, autonomousHandler, continuousHandler };

// Re-export types
export type {
  ModeHandler,
  ModeHandlerContext,
  ModeHandlerResult,
  ModeHandlerCallbacks,
} from './types.js';
