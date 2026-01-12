/**
 * Onboarding Service
 *
 * Backend state machine for the onboarding flow.
 * Manages state transitions and emits events through the OnboardingEmitter.
 * All state changes are logged via the debug logger.
 *
 * Note: Controller selection has been removed. Controllers are now specified
 * directly in the workflow template via controller(). After onboarding,
 * if a controller is configured, the conversation step begins automatically.
 */

import { debug } from '../../shared/logging/logger.js';
import type { WorkflowEventBus } from '../events/event-bus.js';
import type { OnboardConfig, OnboardResult, OnboardStep } from '../events/types.js';
import type { TracksConfig, ConditionGroup, ModuleStep } from '../templates/types.js';
import { OnboardingEmitter } from './emitter.js';
import { initControllerAgent } from '../../shared/workflows/controller.js';

/**
 * Internal state for the onboarding service
 */
interface OnboardingState {
  currentStep: OnboardStep;
  projectName: string;
  selectedTrackId?: string;
  selectedConditions: Set<string>;
  currentGroupIndex: number;
  currentGroupSelections: Set<string>;
  pendingChildQuestions: ChildQuestionContext[];
  currentChildContext: ChildQuestionContext | null;
}

/**
 * Context for nested child questions
 */
interface ChildQuestionContext {
  parentConditionId: string;
  question: string;
  multiSelect: boolean;
  conditions: Record<string, { label: string; description?: string }>;
}

/**
 * Configuration for the onboarding service
 */
export interface OnboardingServiceConfig {
  tracks?: TracksConfig;
  conditionGroups?: ConditionGroup[];
  /**
   * Controller from the workflow template (via controller() function).
   * If provided, controller_conversation step will be added after conditions.
   * @deprecated Use controller from template directly
   */
  controllerAgents?: { id: string; name?: unknown; description?: unknown; promptPath?: unknown }[];
  /**
   * Controller step from the workflow template.
   * If provided, a conversation step will be shown after onboarding where
   * users can interact with the controller before the workflow starts.
   */
  controller?: ModuleStep;
  initialProjectName?: string | null;
  /** Working directory for controller initialization */
  cwd?: string;
  /** .codemachine root directory */
  cmRoot?: string;
}

/**
 * OnboardingService - Manages onboarding flow state and events
 *
 * Usage:
 * ```typescript
 * const bus = new WorkflowEventBus();
 * const service = new OnboardingService(bus, {
 *   tracks: { question: 'Select track:', options: { bmad: { label: 'BMAD' } } },
 *   conditionGroups: [...],
 *   controllerAgents: [...],
 * });
 *
 * // Subscribe to completion
 * bus.on('onboard:completed', (event) => {
 *   console.log('Onboarding complete:', event.result);
 * });
 *
 * // Start the flow
 * service.start();
 *
 * // Handle user input
 * service.submitProjectName('my-project');
 * service.selectTrack('bmad');
 * ```
 */
export class OnboardingService {
  private bus: WorkflowEventBus;
  private emitter: OnboardingEmitter;
  private config: OnboardingServiceConfig;
  private state: OnboardingState;

  constructor(bus: WorkflowEventBus, config: OnboardingServiceConfig) {
    debug('[OnboardingService] initialized config=%o', {
      hasTracks: !!config.tracks,
      trackCount: config.tracks ? Object.keys(config.tracks.options).length : 0,
      conditionGroupCount: config.conditionGroups?.length ?? 0,
      controllerAgentCount: config.controllerAgents?.length ?? 0,
      initialProjectName: config.initialProjectName ?? '(none)',
    });

    this.bus = bus;
    this.emitter = new OnboardingEmitter(bus);
    this.config = config;
    this.state = {
      currentStep: 'project_name',
      projectName: config.initialProjectName ?? '',
      selectedConditions: new Set(),
      currentGroupIndex: 0,
      currentGroupSelections: new Set(),
      pendingChildQuestions: [],
      currentChildContext: null,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────────────────────────

  /**
   * Start the onboarding flow
   */
  start(): void {
    debug('[OnboardingService] starting onboarding flow');

    const onboardConfig: OnboardConfig = {
      hasTracks: this.hasTracks(),
      hasConditions: this.hasConditionGroups(),
      hasController: this.hasController(),
      initialProjectName: this.config.initialProjectName,
    };

    this.emitter.started(onboardConfig);

    // Determine initial step
    if (this.config.initialProjectName) {
      debug('[OnboardingService] skipping project_name step (already set)');
      this.state.projectName = this.config.initialProjectName;
      this.advanceToNextStep();
    } else {
      this.setStep('project_name', 'What is your project name?');
    }
  }

  /**
   * Submit project name and advance
   */
  submitProjectName(name: string): void {
    const trimmed = name.trim();
    if (!trimmed) {
      debug('[OnboardingService] project name empty, ignoring');
      return;
    }

    debug('[OnboardingService] project name submitted: "%s"', trimmed);
    this.state.projectName = trimmed;
    this.emitter.projectNameEntered(trimmed);
    this.advanceToNextStep();
  }

  /**
   * Select a track and advance
   */
  selectTrack(trackId: string): void {
    debug('[OnboardingService] track selected: "%s"', trackId);
    this.state.selectedTrackId = trackId;
    this.state.currentGroupIndex = 0; // Reset group index for new track
    this.emitter.trackSelected(trackId);
    this.advanceToNextStep();
  }

  /**
   * Handle condition selection (single-select: immediate advance, multi-select: toggle)
   */
  selectCondition(conditionId: string): void {
    const step = this.state.currentStep;
    const _isChild = step === 'condition_child';
    const groupIndex = this.state.currentGroupIndex;

    if (step === 'condition_group') {
      const group = this.getCurrentGroup();
      if (!group) return;

      if (group.multiSelect) {
        // Toggle selection
        this.toggleGroupSelection(conditionId);
        this.emitter.conditionSelected(conditionId, groupIndex, false);
      } else {
        // Single select: add and advance
        debug('[OnboardingService] condition selected (single): "%s"', conditionId);
        this.state.selectedConditions.add(conditionId);
        this.emitter.conditionSelected(conditionId, groupIndex, false);
        this.queueChildQuestionsAndAdvance([conditionId]);
      }
    } else if (step === 'condition_child') {
      const ctx = this.state.currentChildContext;
      if (!ctx) return;

      if (ctx.multiSelect) {
        // Toggle selection
        this.toggleGroupSelection(conditionId);
        this.emitter.conditionSelected(conditionId, groupIndex, true);
      } else {
        // Single select: add and advance
        debug('[OnboardingService] child condition selected (single): "%s"', conditionId);
        this.state.selectedConditions.add(conditionId);
        this.emitter.conditionSelected(conditionId, groupIndex, true);
        this.processNextChildQuestion();
      }
    }
  }

  /**
   * Confirm multi-select selections and advance
   */
  confirmSelections(): void {
    const step = this.state.currentStep;
    const selections = Array.from(this.state.currentGroupSelections);
    const groupIndex = this.state.currentGroupIndex;

    debug('[OnboardingService] confirming selections: %o', selections);

    // Add all selections to global set
    for (const id of selections) {
      this.state.selectedConditions.add(id);
    }

    this.emitter.conditionsConfirmed(selections, groupIndex);

    if (step === 'condition_group') {
      this.queueChildQuestionsAndAdvance(selections);
    } else if (step === 'condition_child') {
      this.processNextChildQuestion();
    }
  }

  /**
   * Start the controller conversation step.
   * This transitions to launching -> controller_conversation.
   * Called after onboarding when template has a controller.
   */
  async startControllerConversation(): Promise<void> {
    // Controller conversation is now handled as the first step in the workflow runner
    debug('[OnboardingService] skipping controller conversation (handled by runner)');
    this.complete();
  }

  /**
   * Complete the controller conversation and start the workflow.
   * Called when user presses Ctrl+Enter during conversation.
   */
  completeControllerConversation(): void {
    debug('[OnboardingService] controller conversation completed');
    this.complete();
  }

  /**
   * Get the controller from the template config.
   */
  getController(): ModuleStep | undefined {
    return this.config.controller;
  }

  /**
   * Cancel onboarding
   */
  cancel(): void {
    debug('[OnboardingService] cancelled by user');
    this.emitter.cancelled();
  }

  /**
   * Get current state (for UI binding)
   */
  getState(): Readonly<OnboardingState> {
    return this.state;
  }

  /**
   * Check if a condition is currently selected (for checkboxes)
   */
  isConditionSelected(conditionId: string): boolean {
    return this.state.currentGroupSelections.has(conditionId);
  }

  /**
   * Check if current step is multi-select
   */
  isMultiSelect(): boolean {
    const step = this.state.currentStep;
    if (step === 'condition_group') {
      return this.getCurrentGroup()?.multiSelect ?? false;
    }
    if (step === 'condition_child') {
      return this.state.currentChildContext?.multiSelect ?? false;
    }
    return false;
  }

  /**
   * Get current question text
   */
  getCurrentQuestion(): string {
    const step = this.state.currentStep;
    switch (step) {
      case 'project_name':
        return 'What is your project name?';
      case 'tracks':
        return this.config.tracks?.question ?? 'Select a track:';
      case 'condition_group':
        return this.getCurrentGroup()?.question ?? '';
      case 'condition_child':
        return this.state.currentChildContext?.question ?? '';
      case 'controller_conversation':
        return `Chat with ${this.config.controller?.agentName ?? 'controller'} to prepare for the workflow`;
      case 'launching':
        return 'Initializing controller agent...';
      default:
        return '';
    }
  }

  /**
   * Get current options for selection steps
   */
  getCurrentOptions(): Array<[string, { label: string; description?: string }]> {
    const step = this.state.currentStep;
    switch (step) {
      case 'tracks':
        return this.config.tracks ? Object.entries(this.config.tracks.options) : [];
      case 'condition_group': {
        const group = this.getCurrentGroup();
        return group ? Object.entries(group.conditions) : [];
      }
      case 'condition_child': {
        const ctx = this.state.currentChildContext;
        return ctx ? Object.entries(ctx.conditions) : [];
      }
      case 'controller_conversation':
        // Controller conversation doesn't have selectable options
        return [];
      default:
        return [];
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // Private Helpers
  // ─────────────────────────────────────────────────────────────────

  private hasTracks(): boolean {
    return !!this.config.tracks && Object.keys(this.config.tracks.options).length > 0;
  }

  private hasConditionGroups(): boolean {
    return (this.getApplicableGroups().length > 0);
  }

  private hasController(): boolean {
    return !!this.config.controller;
  }

  private getApplicableGroups(): ConditionGroup[] {
    if (!this.config.conditionGroups) return [];
    const trackId = this.state.selectedTrackId;
    return this.config.conditionGroups.filter((group) => {
      if (!group.tracks || group.tracks.length === 0) return true;
      return trackId ? group.tracks.includes(trackId) : true;
    });
  }

  private getCurrentGroup(): ConditionGroup | null {
    const groups = this.getApplicableGroups();
    const idx = this.state.currentGroupIndex;
    return idx < groups.length ? groups[idx] : null;
  }

  private setStep(step: OnboardStep, question: string): void {
    debug('[OnboardingService] setStep step=%s', step);
    this.state.currentStep = step;
    this.state.currentGroupSelections = new Set();
    this.emitter.stepChanged(step, question);
  }

  private toggleGroupSelection(conditionId: string): void {
    if (this.state.currentGroupSelections.has(conditionId)) {
      this.state.currentGroupSelections.delete(conditionId);
      debug('[OnboardingService] deselected: "%s"', conditionId);
    } else {
      this.state.currentGroupSelections.add(conditionId);
      debug('[OnboardingService] selected: "%s"', conditionId);
    }
  }

  private advanceToNextStep(): void {
    const current = this.state.currentStep;
    debug('[OnboardingService] advanceToNextStep from=%s', current);

    if (current === 'project_name') {
      if (this.hasTracks()) {
        this.setStep('tracks', this.config.tracks!.question);
      } else if (this.hasConditionGroups()) {
        this.setStep('condition_group', this.getCurrentGroup()!.question);
      } else if (this.hasController()) {
        // Controller is specified in template, go to conversation after launch
        void this.startControllerConversation();
      } else {
        this.complete();
      }
    } else if (current === 'tracks') {
      if (this.hasConditionGroups()) {
        this.setStep('condition_group', this.getCurrentGroup()!.question);
      } else if (this.hasController()) {
        void this.startControllerConversation();
      } else {
        this.complete();
      }
    } else if (current === 'condition_group' || current === 'condition_child') {
      this.advanceToNextGroupOrComplete();
    } else if (current === 'controller_conversation') {
      this.complete();
    }
  }

  private queueChildQuestionsAndAdvance(conditionIds: string[]): void {
    const group = this.getCurrentGroup();
    if (!group?.children) {
      this.advanceToNextGroupOrComplete();
      return;
    }

    const childQuestions: ChildQuestionContext[] = [];
    for (const condId of conditionIds) {
      const childGroup = group.children[condId];
      if (childGroup) {
        childQuestions.push({
          parentConditionId: condId,
          question: childGroup.question,
          multiSelect: childGroup.multiSelect ?? false,
          conditions: childGroup.conditions,
        });
      }
    }

    if (childQuestions.length > 0) {
      debug('[OnboardingService] queued %d child questions', childQuestions.length);
      this.state.pendingChildQuestions = childQuestions;
      this.processNextChildQuestion();
    } else {
      this.advanceToNextGroupOrComplete();
    }
  }

  private processNextChildQuestion(): void {
    const pending = this.state.pendingChildQuestions;
    if (pending.length > 0) {
      const [next, ...rest] = pending;
      this.state.pendingChildQuestions = rest;
      this.state.currentChildContext = next;
      debug('[OnboardingService] processing child question: "%s"', next.question);
      this.setStep('condition_child', next.question);
    } else {
      this.state.currentChildContext = null;
      this.advanceToNextGroupOrComplete();
    }
  }

  private advanceToNextGroupOrComplete(): void {
    const groups = this.getApplicableGroups();
    const nextIdx = this.state.currentGroupIndex + 1;

    if (nextIdx < groups.length) {
      this.state.currentGroupIndex = nextIdx;
      debug('[OnboardingService] advancing to group %d of %d', nextIdx + 1, groups.length);
      this.setStep('condition_group', groups[nextIdx].question);
    } else if (this.hasController()) {
      void this.startControllerConversation();
    } else {
      this.complete();
    }
  }

  private complete(): void {
    const result: OnboardResult = {
      projectName: this.state.projectName,
      trackId: this.state.selectedTrackId,
      conditions: Array.from(this.state.selectedConditions),
      controllerAgentId: this.config.controller?.agentId,
    };

    debug('[OnboardingService] completing with result=%o', result);
    this.emitter.completed(result);
  }
}

/**
 * Create a new OnboardingService
 */
export function createOnboardingService(
  bus: WorkflowEventBus,
  config: OnboardingServiceConfig
): OnboardingService {
  return new OnboardingService(bus, config);
}
