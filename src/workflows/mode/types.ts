/**
 * WorkflowMode Types
 *
 * Single source of truth for mode state.
 * Eliminates sync issues between autoMode and activeProvider.
 */

import type { InputProvider } from '../input/types.js';

/**
 * Mode state - tracks auto mode and pause state
 */
export interface WorkflowModeState {
  /** Whether auto (controller) mode is enabled */
  autoMode: boolean;

  /** Whether workflow is paused */
  paused: boolean;
}

/**
 * Input providers required by WorkflowMode
 */
export interface ModeProviders {
  /** User input provider (terminal input) */
  userInput: InputProvider;

  /** Controller input provider (autonomous mode) */
  controllerInput: InputProvider;
}

/**
 * Events emitted by WorkflowMode
 */
export type ModeEventType = 'mode-changed' | 'paused' | 'resumed';

export interface ModeChangedEvent {
  type: 'mode-changed';
  autoMode: boolean;
}

export interface PausedEvent {
  type: 'paused';
}

export interface ResumedEvent {
  type: 'resumed';
}

export type ModeEvent = ModeChangedEvent | PausedEvent | ResumedEvent;

/**
 * Listener for mode events
 */
export type ModeEventListener = (event: ModeEvent) => void;
