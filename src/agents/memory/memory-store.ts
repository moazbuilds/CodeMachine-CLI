import { MemoryAdapter, MemoryAnalyticsSource } from '../../infra/fs/memory-adapter.js';

export interface MemoryEntry {
  agentId: string;
  content: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface MemorySummary {
  totalEntries: number;
  lastTimestamp: string | null;
}

export class MemoryStore {
  constructor(private readonly adapter: MemoryAdapter) {}

  async append(entry: MemoryEntry): Promise<void> {
    const normalized = this.normalizeEntry(entry);
    // Skip empty content silently - allows real errors to propagate
    if (!normalized.content.trim()) {
      return;
    }
    this.ensureRequiredFields(normalized);
    await this.adapter.append(normalized);
    this.adapter.analytics?.onAppend?.({ agentId: normalized.agentId, entry: normalized, source: this.storeSource });
  }

  async list(agentId: string): Promise<MemoryEntry[]> {
    const normalizedAgentId = this.normalizeAgentId(agentId);
    this.ensureAgentId(normalizedAgentId);
    const entries = await this.adapter.read(normalizedAgentId);
    const sorted = [...entries].sort((a, b) => this.parseTimestamp(a.timestamp) - this.parseTimestamp(b.timestamp));
    this.adapter.analytics?.onRead?.({ agentId: normalizedAgentId, entries: sorted, source: this.storeSource });
    return sorted;
  }

  async latest(agentId: string): Promise<MemoryEntry | null> {
    const entries = await this.list(agentId);
    return entries.length > 0 ? entries[entries.length - 1] : null;
  }

  async summary(agentId: string): Promise<MemorySummary> {
    const entries = await this.list(agentId);
    const lastTimestamp = entries.length > 0 ? entries[entries.length - 1].timestamp : null;
    return {
      totalEntries: entries.length,
      lastTimestamp,
    };
  }

  private get storeSource(): MemoryAnalyticsSource {
    return 'store';
  }

  private ensureRequiredFields(entry: MemoryEntry): void {
    if (!entry.agentId.trim()) {
      throw new Error('Memory entry requires a non-empty agentId');
    }
    if (!entry.content.trim()) {
      throw new Error('Memory entry requires non-empty content');
    }
    if (!entry.timestamp.trim()) {
      throw new Error('Memory entry requires a timestamp');
    }
  }

  private ensureAgentId(agentId: string): void {
    if (!agentId.trim()) {
      throw new Error('Agent id is required');
    }
  }

  private normalizeEntry(entry: MemoryEntry): MemoryEntry {
    return {
      ...entry,
      agentId: this.normalizeAgentId(entry.agentId),
      content: entry.content.trim(),
      timestamp: this.normalizeTimestamp(entry.timestamp),
    };
  }

  private normalizeAgentId(agentId: string): string {
    return agentId.trim();
  }

  private normalizeTimestamp(timestamp: string): string {
    return timestamp.trim();
  }

  private parseTimestamp(timestamp: string): number {
    const value = Date.parse(timestamp);
    return Number.isNaN(value) ? 0 : value;
  }
}
