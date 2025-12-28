/**
 * Headless UI Adapter
 *
 * A minimal UI adapter that logs workflow events to console or file.
 * Used for CI/CD, automation, and non-interactive environments.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { BaseUIAdapter } from './base.js';
import type { UIAdapterOptions } from './types.js';
import type { WorkflowEvent } from '../../../../../workflows/events/index.js';

export interface HeadlessAdapterOptions extends UIAdapterOptions {
  /** Path to log file (if not set, logs to console) */
  logFile?: string;

  /** Log level: 'minimal' | 'normal' | 'verbose' */
  logLevel?: 'minimal' | 'normal' | 'verbose';

  /** Custom log function (for testing) */
  logger?: (message: string) => void;

  /** Show timestamps in logs */
  timestamps?: boolean;
}

/**
 * HeadlessAdapter - Logs workflow events without visual UI
 *
 * Usage:
 * ```typescript
 * const adapter = new HeadlessAdapter({ logLevel: 'normal' });
 * adapter.connect(eventBus);
 * adapter.start();
 * // ... workflow runs, events are logged ...
 * adapter.stop();
 * ```
 */
export class HeadlessAdapter extends BaseUIAdapter {
  private logFile: string | null = null;
  private logStream: fs.WriteStream | null = null;
  private logLevel: 'minimal' | 'normal' | 'verbose';
  private customLogger: ((message: string) => void) | null = null;
  private showTimestamps: boolean;
  private agentNames = new Map<string, string>();

  constructor(options: HeadlessAdapterOptions = {}) {
    super(options);
    this.logFile = options.logFile || null;
    this.logLevel = options.logLevel || 'normal';
    this.customLogger = options.logger || null;
    this.showTimestamps = options.timestamps ?? true;
  }

  protected onStart(): void {
    if (this.logFile) {
      const dir = path.dirname(this.logFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      this.logStream = fs.createWriteStream(this.logFile, { flags: 'a' });
    }

    this.log(`Workflow started: ${this.options.workflowName || 'Unknown'}`);
    if (this.options.totalSteps) {
      this.log(`Total steps: ${this.options.totalSteps}`);
    }
  }

  protected onStop(): void {
    this.log('Workflow UI stopped');

    if (this.logStream) {
      this.logStream.end();
      this.logStream = null;
    }
  }

  protected handleEvent(event: WorkflowEvent): void {
    switch (event.type) {
      case 'workflow:started':
        this.log(`Workflow "${event.workflowName}" started with ${event.totalSteps} steps`);
        break;

      case 'workflow:status':
        this.log(`Workflow status: ${event.status}`);
        break;

      case 'workflow:stopped':
        this.log(`Workflow stopped${event.reason ? `: ${event.reason}` : ''}`);
        break;

      case 'agent:added':
        this.agentNames.set(event.agent.id, event.agent.name);
        if (this.logLevel !== 'minimal') {
          this.log(`[${event.agent.stepIndex + 1}/${event.agent.totalSteps}] Agent added: ${event.agent.name} (${event.agent.engine})`);
        }
        break;

      case 'agent:status': {
        const agentName = this.agentNames.get(event.agentId) || event.agentId;
        this.log(`[${agentName}] Status: ${event.status}`);
        break;
      }

      case 'agent:telemetry':
        if (this.logLevel === 'verbose') {
          const name = this.agentNames.get(event.agentId) || event.agentId;
          const t = event.telemetry;
          const parts: string[] = [];
          if (t.tokensIn !== undefined) parts.push(`in:${t.tokensIn}`);
          if (t.tokensOut !== undefined) parts.push(`out:${t.tokensOut}`);
          if (t.cost !== undefined) parts.push(`cost:$${t.cost.toFixed(4)}`);
          if (parts.length > 0) {
            this.log(`[${name}] Telemetry: ${parts.join(', ')}`);
          }
        }
        break;

      case 'agent:reset':
        if (this.logLevel !== 'minimal') {
          const name = this.agentNames.get(event.agentId) || event.agentId;
          this.log(`[${name}] Reset for loop iteration ${event.cycleNumber || '?'}`);
        }
        break;

      case 'subagent:added':
        if (this.logLevel === 'verbose') {
          const parentName = this.agentNames.get(event.parentId) || event.parentId;
          this.log(`[${parentName}] Sub-agent: ${event.subAgent.name}`);
        }
        break;

      case 'subagent:batch':
        if (this.logLevel === 'verbose') {
          const parentName = this.agentNames.get(event.parentId) || event.parentId;
          this.log(`[${parentName}] ${event.subAgents.length} sub-agents added`);
        }
        break;

      case 'subagent:status':
        if (this.logLevel === 'verbose') {
          this.log(`Sub-agent ${event.subAgentId}: ${event.status}`);
        }
        break;

      case 'loop:state':
        if (event.loopState) {
          const sourceName = this.agentNames.get(event.loopState.sourceAgent) || event.loopState.sourceAgent;
          this.log(`Loop: ${sourceName} → back ${event.loopState.backSteps} steps (iteration ${event.loopState.iteration}/${event.loopState.maxIterations})`);
        } else if (this.logLevel !== 'minimal') {
          this.log('Loop ended');
        }
        break;

      case 'checkpoint:state':
        if (event.checkpoint?.active) {
          this.log(`||  Checkpoint: ${event.checkpoint.reason || 'Manual review required'}`);
        }
        break;

      case 'checkpoint:clear':
        if (this.logLevel !== 'minimal') {
          this.log('Checkpoint cleared, resuming');
        }
        break;

      case 'message:log':
        if (this.logLevel === 'verbose') {
          const name = this.agentNames.get(event.agentId) || event.agentId;
          this.log(`[${name}] ${event.message}`);
        }
        break;

      case 'separator:add':
        if (this.logLevel !== 'minimal') {
          this.log(`─── ${event.separator.text} ───`);
        }
        break;

      case 'monitoring:register':
        // Internal event, only log in verbose mode
        if (this.logLevel === 'verbose') {
          this.log(`Monitoring: ${event.uiAgentId} → ${event.monitoringId}`);
        }
        break;

      default:
        if (this.logLevel === 'verbose') {
          this.log(`Event: ${(event as WorkflowEvent).type}`);
        }
    }
  }

  /**
   * Log a message to console or file
   */
  private log(message: string): void {
    const timestamp = this.showTimestamps
      ? `[${new Date().toISOString()}] `
      : '';
    const fullMessage = `${timestamp}${message}`;

    if (this.customLogger) {
      this.customLogger(fullMessage);
    } else if (this.logStream) {
      this.logStream.write(fullMessage + '\n');
    } else {
      console.log(fullMessage);
    }
  }
}

/**
 * Factory function to create a headless adapter
 */
export function createHeadlessAdapter(options?: HeadlessAdapterOptions): HeadlessAdapter {
  return new HeadlessAdapter(options);
}
