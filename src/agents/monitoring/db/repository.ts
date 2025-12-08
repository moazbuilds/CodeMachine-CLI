import type { Database } from 'bun:sqlite';
import type { AgentRecord, RegisterAgentInput } from '../types.js';
type AgentRow = {
  id: number;
  name: string;
  engine: string | null;
  status: string;
  parent_id: number | null;
  pid: number | null;
  start_time: string;
  end_time: string | null;
  duration: number | null;
  prompt: string;
  log_path: string;
  error: string | null;
  engine_provider: string | null;
  model_name: string | null;
  session_id: string | null;
  tokens_in: number | null;
  tokens_out: number | null;
  cached_tokens: number | null;
  cost: number | null;
  cache_creation_tokens: number | null;
  cache_read_tokens: number | null;
};

export class AgentRepository {
  constructor(private db: Database) {}

  register(input: RegisterAgentInput, logPath: string): number {
    const startTime = new Date().toISOString();
    const trimmedPrompt = input.prompt.length > 500
      ? `${input.prompt.substring(0, 500)}...`
      : input.prompt;

    const result = this.db.prepare(`
      INSERT INTO agents (name, prompt, parent_id, engine, status, start_time, log_path, pid, engine_provider, model_name)
      VALUES (?, ?, ?, ?, 'running', ?, ?, ?, ?, ?)
      RETURNING id
    `).get(
      input.name,
      trimmedPrompt,
      input.parentId ?? null,
      input.engine ?? null,
      startTime,
      logPath,
      input.pid ?? null, // null = no PID tracking (in-process agents share parent PID)
      input.engineProvider ?? null,
      input.modelName ?? null
    ) as { id: number };

    return result.id;
  }

  get(id: number): AgentRecord | undefined {
    const row = this.db.prepare(`
      SELECT a.*, t.tokens_in, t.tokens_out, t.cached_tokens, t.cost, t.cache_creation_tokens, t.cache_read_tokens
      FROM agents a
      LEFT JOIN telemetry t ON a.id = t.agent_id
      WHERE a.id = ?
    `).get(id) as AgentRow | undefined;

    return row ? this.toRecord(row) : undefined;
  }

  getAll(): AgentRecord[] {
    const rows = this.db.prepare(`
      SELECT a.*, t.tokens_in, t.tokens_out, t.cached_tokens, t.cost, t.cache_creation_tokens, t.cache_read_tokens
      FROM agents a
      LEFT JOIN telemetry t ON a.id = t.agent_id
      ORDER BY a.id ASC
    `).all() as AgentRow[];

    return rows.map((row: AgentRow) => this.toRecord(row));
  }

  getChildren(parentId: number): AgentRecord[] {
    const rows = this.db.prepare(`
      SELECT a.*, t.tokens_in, t.tokens_out, t.cached_tokens, t.cost, t.cache_creation_tokens, t.cache_read_tokens
      FROM agents a
      LEFT JOIN telemetry t ON a.id = t.agent_id
      WHERE a.parent_id = ?
      ORDER BY a.id ASC
    `).all(parentId) as AgentRow[];

    return rows.map((row: AgentRow) => this.toRecord(row));
  }

  update(id: number, updates: Partial<AgentRecord>): void {
    const fields: string[] = [];
    const values: Array<string | number | null> = [];

    if (updates.status) {
      fields.push('status = ?');
      values.push(updates.status);
    }
    if (updates.endTime) {
      fields.push('end_time = ?');
      values.push(updates.endTime);
    }
    if (updates.duration !== undefined) {
      fields.push('duration = ?');
      values.push(updates.duration);
    }
    if (updates.error) {
      fields.push('error = ?');
      values.push(updates.error);
    }
    if (updates.logPath) {
      fields.push('log_path = ?');
      values.push(updates.logPath);
    }
    if (updates.sessionId) {
      fields.push('session_id = ?');
      values.push(updates.sessionId);
    }

    if (fields.length > 0) {
      fields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(id);

      this.db.prepare(`UPDATE agents SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    }

    if (updates.telemetry) {
      this.db.prepare(`
        INSERT INTO telemetry (agent_id, tokens_in, tokens_out, cached_tokens, cost, cache_creation_tokens, cache_read_tokens)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(agent_id) DO UPDATE SET
          tokens_in = excluded.tokens_in,
          tokens_out = excluded.tokens_out,
          cached_tokens = excluded.cached_tokens,
          cost = excluded.cost,
          cache_creation_tokens = excluded.cache_creation_tokens,
          cache_read_tokens = excluded.cache_read_tokens
      `).run(
        id,
        updates.telemetry.tokensIn ?? 0,
        updates.telemetry.tokensOut ?? 0,
        updates.telemetry.cached ?? 0,
        updates.telemetry.cost ?? null,
        updates.telemetry.cacheCreationTokens ?? null,
        updates.telemetry.cacheReadTokens ?? null
      );
    }
  }

  delete(id: number): void {
    this.db.prepare('DELETE FROM agents WHERE id = ?').run(id);
  }

  clearAll(): number {
    // Delete telemetry first due to foreign key
    this.db.prepare('DELETE FROM telemetry').run();
    const result = this.db.prepare('DELETE FROM agents').run();
    return result.changes;
  }

  getFullSubtree(agentId: number): AgentRecord[] {
    const agent = this.get(agentId);
    if (!agent) return [];

    const result = [agent];
    const children = this.getChildren(agentId);

    for (const child of children) {
      result.push(...this.getFullSubtree(child.id));
    }

    return result;
  }

  clearDescendants(agentId: number): number {
    const children = this.getChildren(agentId);
    let count = 0;

    for (const child of children) {
      count += this.clearDescendants(child.id);
      this.delete(child.id);
      count++;
    }

    return count;
  }

  getMaxId(): number {
    const result = this.db.prepare('SELECT MAX(id) as maxId FROM agents').get() as { maxId: number | null };
    return result.maxId ?? 0;
  }

  private toRecord(row: AgentRow): AgentRecord {
    const childrenRows = this.db.prepare('SELECT id FROM agents WHERE parent_id = ?').all(row.id) as Array<{ id: number }>;
    const children = childrenRows.map((r) => r.id);

    return {
      id: row.id,
      name: row.name,
      engine: row.engine ?? undefined,
      status: row.status as AgentRecord['status'],
      parentId: row.parent_id ?? undefined,
      pid: row.pid ?? undefined,
      startTime: row.start_time,
      endTime: row.end_time ?? undefined,
      duration: row.duration ?? undefined,
      prompt: row.prompt,
      logPath: row.log_path,
      error: row.error ?? undefined,
      engineProvider: row.engine_provider ?? undefined,
      modelName: row.model_name ?? undefined,
      sessionId: row.session_id ?? undefined,
      children,
      telemetry: row.tokens_in !== null && row.tokens_out !== null
        ? {
            tokensIn: row.tokens_in,
            tokensOut: row.tokens_out,
            cached: row.cached_tokens ?? undefined,
            cost: row.cost ?? undefined,
            cacheCreationTokens: row.cache_creation_tokens ?? undefined,
            cacheReadTokens: row.cache_read_tokens ?? undefined,
          }
        : undefined,
    };
  }
}
