import { AgentMonitorService } from './monitor.js';
import type { AgentStatus } from './types.js';
import type { WorkflowEventEmitter } from '../../workflows/events/emitter.js';
import type { ParsedTelemetry } from '../../shared/telemetry/index.js';

/**
 * Coordinates agent status updates between DB and UI.
 * Singleton - same instance used by runner.ts and cleanup.ts.
 */
export class StatusService {
  private static instance: StatusService;
  private readonly monitor: AgentMonitorService;
  private emitter: WorkflowEventEmitter | null = null;
  private idMap = new Map<number, string>(); // monitoringId → uniqueAgentId

  private constructor() {
    this.monitor = AgentMonitorService.getInstance();
  }

  static getInstance(): StatusService {
    if (!StatusService.instance) {
      StatusService.instance = new StatusService();
    }
    return StatusService.instance;
  }

  // Emitter is optional (cleanup.ts runs without workflow context)
  setEmitter(emitter: WorkflowEventEmitter): void {
    this.emitter = emitter;
  }

  // ID mapping
  register(monitoringId: number, uniqueAgentId: string): void {
    this.idMap.set(monitoringId, uniqueAgentId);
  }

  getAgentId(monitoringId: number): string | undefined {
    return this.idMap.get(monitoringId);
  }

  clear(monitoringId: number): void {
    this.idMap.delete(monitoringId);
  }

  // Status updates (DB + UI)
  async complete(id: number, telemetry?: ParsedTelemetry): Promise<void> {
    await this.monitor.complete(id, telemetry);
    this.emitStatus(id, 'completed');
  }

  async fail(id: number, error: Error | string): Promise<void> {
    await this.monitor.fail(id, error);
    this.emitStatus(id, 'failed');
  }

  async pause(id: number): Promise<void> {
    await this.monitor.markPaused(id);
    this.emitStatus(id, 'paused');
  }

  async run(id: number): Promise<void> {
    await this.monitor.markRunning(id);
    this.emitStatus(id, 'running');
  }

  // UI-only status updates (take uniqueAgentId string, no DB update)
  awaiting(agentId: string): void {
    this.emitter?.updateAgentStatus(agentId, 'awaiting');
  }

  delegated(agentId: string): void {
    this.emitter?.updateAgentStatus(agentId, 'delegated');
  }

  pending(agentId: string): void {
    this.emitter?.updateAgentStatus(agentId, 'pending');
  }

  skipped(agentId: string): void {
    this.emitter?.updateAgentStatus(agentId, 'skipped');
  }

  retrying(agentId: string): void {
    this.emitter?.updateAgentStatus(agentId, 'retrying');
  }

  running(agentId: string): void {
    this.emitter?.updateAgentStatus(agentId, 'running');
  }

  completed(agentId: string): void {
    this.emitter?.updateAgentStatus(agentId, 'completed');
  }

  failed(agentId: string): void {
    this.emitter?.updateAgentStatus(agentId, 'failed');
  }

  // Emit by monitoringId (uses idMap lookup)
  emitStatus(id: number, status: string): void {
    const agentId = this.idMap.get(id);
    if (agentId) {
      this.emitter?.updateAgentStatus(agentId, status as AgentStatus);
    }
  }
}
