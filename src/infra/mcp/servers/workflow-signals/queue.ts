/**
 * Workflow Signals MCP Server - Signal Queue
 *
 * File-based IPC for communicating between MCP server and workflow engine.
 * Signals are written as JSON files that the workflow controller watches.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { watch, type FSWatcher } from 'fs';

import type { SignalMessage, ProposeStepCompletion, ApproveStepTransition } from './schemas.js';

export class SignalQueue {
  private signalDir: string;

  constructor(workflowDir: string) {
    this.signalDir = path.join(workflowDir, '.codemachine', 'signals');
  }

  /**
   * Initialize the signal directory
   */
  async init(): Promise<void> {
    await fs.mkdir(this.signalDir, { recursive: true });
  }

  /**
   * Clear all signals (call at workflow start)
   */
  async clear(): Promise<void> {
    try {
      const files = await fs.readdir(this.signalDir);
      await Promise.all(files.map((f) => fs.unlink(path.join(this.signalDir, f))));
    } catch {
      // Directory might not exist yet
    }
  }

  /**
   * Emit a signal to the queue
   */
  async emit(signal: SignalMessage): Promise<string> {
    await this.init();

    const filename = `${signal.type}-${signal.timestamp}.json`;
    const filepath = path.join(this.signalDir, filename);

    await fs.writeFile(filepath, JSON.stringify(signal, null, 2));

    return filepath;
  }

  /**
   * Emit a step completion proposal
   */
  async emitProposal(payload: ProposeStepCompletion): Promise<string> {
    return this.emit({
      type: 'proposal',
      timestamp: Date.now(),
      payload,
    });
  }

  /**
   * Emit a step transition approval
   */
  async emitApproval(payload: ApproveStepTransition): Promise<string> {
    return this.emit({
      type: 'approval',
      timestamp: Date.now(),
      payload,
    });
  }

  /**
   * Get the latest proposal signal
   */
  async getLatestProposal(): Promise<SignalMessage | null> {
    try {
      const files = await fs.readdir(this.signalDir);
      const proposals = files.filter((f) => f.startsWith('proposal-')).sort().reverse();

      if (proposals.length === 0) return null;

      const content = await fs.readFile(path.join(this.signalDir, proposals[0]), 'utf-8');
      return JSON.parse(content) as SignalMessage;
    } catch {
      return null;
    }
  }

  /**
   * Get the latest approval signal
   */
  async getLatestApproval(): Promise<SignalMessage | null> {
    try {
      const files = await fs.readdir(this.signalDir);
      const approvals = files.filter((f) => f.startsWith('approval-')).sort().reverse();

      if (approvals.length === 0) return null;

      const content = await fs.readFile(path.join(this.signalDir, approvals[0]), 'utf-8');
      return JSON.parse(content) as SignalMessage;
    } catch {
      return null;
    }
  }

  /**
   * Watch for new signals of a specific type
   */
  watchForSignal(
    type: 'proposal' | 'approval',
    callback: (signal: SignalMessage) => void,
    options: { timeout?: number } = {}
  ): { watcher: FSWatcher; cancel: () => void } {
    const { timeout = 300000 } = options;
    let resolved = false;

    const watcher = watch(this.signalDir, async (event, filename) => {
      if (resolved) return;
      if (!filename?.startsWith(`${type}-`)) return;

      try {
        const filepath = path.join(this.signalDir, filename);
        const content = await fs.readFile(filepath, 'utf-8');
        const signal = JSON.parse(content) as SignalMessage;

        if (signal.type === type) {
          resolved = true;
          callback(signal);
        }
      } catch {
        // Ignore read errors (file might be partially written)
      }
    });

    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        watcher.close();
      }
    }, timeout);

    const cancel = () => {
      resolved = true;
      clearTimeout(timeoutId);
      watcher.close();
    };

    return { watcher, cancel };
  }

  /**
   * Wait for a proposal signal (Promise-based)
   */
  waitForProposal(stepId: string, timeout: number = 300000): Promise<ProposeStepCompletion> {
    return new Promise((resolve, reject) => {
      const { cancel } = this.watchForSignal(
        'proposal',
        (signal) => {
          const proposal = signal.payload as ProposeStepCompletion;
          if (proposal.step_id === stepId) {
            cancel();
            resolve(proposal);
          }
        },
        { timeout }
      );

      setTimeout(() => {
        cancel();
        reject(new Error(`Timeout waiting for proposal on ${stepId}`));
      }, timeout);
    });
  }

  /**
   * Wait for an approval signal (Promise-based)
   */
  waitForApproval(stepId: string, timeout: number = 60000): Promise<ApproveStepTransition> {
    return new Promise((resolve, reject) => {
      const { cancel } = this.watchForSignal(
        'approval',
        (signal) => {
          const approval = signal.payload as ApproveStepTransition;
          if (approval.step_id === stepId) {
            cancel();
            resolve(approval);
          }
        },
        { timeout }
      );

      setTimeout(() => {
        cancel();
        reject(new Error(`Timeout waiting for approval on ${stepId}`));
      }, timeout);
    });
  }

  /**
   * Get the signal directory path
   */
  getSignalDir(): string {
    return this.signalDir;
  }
}
