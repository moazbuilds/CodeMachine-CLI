/**
 * WorkflowMode
 *
 * Single source of truth for workflow mode state.
 * Owns autoMode and paused state, derives which provider to use.
 * Eliminates sync issues between autoMode and activeProvider.
 */

import { debug } from '../../shared/logging/logger.js';
import type { InputProvider } from '../input/types.js';
import type { ModeProviders, ModeEvent, ModeEventListener } from './types.js';

export class WorkflowMode {
  private _autoMode: boolean = false;
  private _paused: boolean = false;
  private readonly providers: ModeProviders;
  private readonly listeners: Set<ModeEventListener> = new Set();

  constructor(providers: ModeProviders) {
    this.providers = providers;
  }

  /**
   * Whether auto (controller) mode is enabled
   */
  get autoMode(): boolean {
    return this._autoMode;
  }

  /**
   * Whether workflow is paused
   */
  get paused(): boolean {
    return this._paused;
  }

  /**
   * Whether user input should be used (derived from autoMode and paused)
   */
  get shouldUseUserInput(): boolean {
    // Use user input if paused OR if not in auto mode
    return this._paused || !this._autoMode;
  }

  /**
   * Get the active input provider (derived from state)
   * This is the key improvement - no separate activeProvider state to sync
   */
  getActiveProvider(): InputProvider {
    return this.shouldUseUserInput
      ? this.providers.userInput
      : this.providers.controllerInput;
  }

  /**
   * Get the user input provider directly
   */
  getUserInput(): InputProvider {
    return this.providers.userInput;
  }

  /**
   * Get the controller input provider directly
   */
  getControllerInput(): InputProvider {
    return this.providers.controllerInput;
  }

  /**
   * Enable auto (controller) mode
   */
  enableAutoMode(): void {
    if (this._autoMode && !this._paused) {
      return;
    }

    // Clear paused state when enabling auto mode
    const wasPaused = this._paused;
    if (wasPaused) {
      debug('[WorkflowMode] Clearing paused state (enabling auto mode)');
      this._paused = false;
      this.emit({ type: 'resumed' });
    }

    // Already in auto mode, just needed to clear pause
    if (this._autoMode) {
      return;
    }

    debug('[WorkflowMode] Enabling auto mode');

    // Deactivate old provider
    const oldProvider = this.getActiveProvider();
    oldProvider.deactivate?.();

    this._autoMode = true;

    // Activate new provider
    const newProvider = this.getActiveProvider();
    newProvider.activate?.();

    this.emit({ type: 'mode-changed', autoMode: true });

    // Emit process event so UI updates
    (process as NodeJS.EventEmitter).emit('workflow:mode-change', { autonomousMode: true });
  }

  /**
   * Disable auto mode (switch to manual/user mode)
   */
  disableAutoMode(): void {
    if (!this._autoMode) {
      return;
    }

    debug('[WorkflowMode] Disabling auto mode');

    // Deactivate old provider
    const oldProvider = this.getActiveProvider();
    oldProvider.deactivate?.();

    this._autoMode = false;

    // Activate new provider
    const newProvider = this.getActiveProvider();
    newProvider.activate?.();

    this.emit({ type: 'mode-changed', autoMode: false });

    // Emit process event so UI updates
    (process as NodeJS.EventEmitter).emit('workflow:mode-change', { autonomousMode: false });
  }

  /**
   * Set auto mode on/off
   */
  setAutoMode(enabled: boolean): void {
    if (enabled) {
      this.enableAutoMode();
    } else {
      this.disableAutoMode();
    }
  }

  /**
   * Pause the workflow (disables auto mode and switches to user input)
   */
  pause(): void {
    if (this._paused) {
      return;
    }

    debug('[WorkflowMode] Pausing (disabling auto mode)');

    // Disable auto mode - this properly deactivates controller and activates user
    if (this._autoMode) {
      this.disableAutoMode();
    }

    this._paused = true;
    this.emit({ type: 'paused' });
  }

  /**
   * Resume from pause
   */
  resume(): void {
    if (!this._paused) {
      return;
    }

    debug('[WorkflowMode] Resuming');

    // If in auto mode, switch back to controller
    if (this._autoMode) {
      this.providers.userInput.deactivate?.();
      this.providers.controllerInput.activate?.();
    }

    this._paused = false;
    this.emit({ type: 'resumed' });
  }

  /**
   * Subscribe to mode events
   */
  subscribe(listener: ModeEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: ModeEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}
