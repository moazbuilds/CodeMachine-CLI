/**
 * Mode Signal Types
 *
 * Defines types for input mode management (user vs auto/controller).
 */

import type { StateMachine } from '../../state/index.js';
import type { InputProvider } from '../../input/types.js';

/**
 * Input mode - determines where input comes from
 */
export type InputMode = 'user' | 'auto';

/**
 * Context required for mode switching
 * Runner implements this interface
 */
export interface ModeSwitchContext {
  readonly machine: StateMachine;
  getActiveProvider(): InputProvider;
  setActiveProvider(provider: InputProvider): void;
  getUserInput(): InputProvider;
  getControllerInput(): InputProvider;
}
