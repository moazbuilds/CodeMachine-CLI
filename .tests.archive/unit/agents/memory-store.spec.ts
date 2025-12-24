import { promises as fs } from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';

import { MemoryAdapter, type MemoryAnalyticsHooks } from '../../../src/infra/fs/memory-adapter.js';
import { MemoryStore, type MemoryEntry } from '../../../src/agents/index.js';

const tempRoot = path.resolve('.tmp/memory-tests');

const sanitizedAgentId = (agentId: string): string => agentId.toLowerCase().replace(/[^\w]+/g, '-');

const readPersistedEntries = async (directory: string, agentId: string): Promise<MemoryEntry[]> => {
  const filePath = path.join(directory, `${sanitizedAgentId(agentId)}.json`);
  const raw = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(raw) as MemoryEntry[];
};

describe('MemoryStore', () => {
  beforeEach(() => {
    // Timer mocking not needed for these tests
  });

  afterEach(async () => {
    mock.restore();
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  const createStore = (testDir: string, hooks?: MemoryAnalyticsHooks) => {
    const baseDir = path.join(tempRoot, testDir);
    const adapter = new MemoryAdapter(baseDir, hooks);
    return {
      adapter,
      store: new MemoryStore(adapter),
      baseDir,
    };
  };

  it('persists appended entries and returns them via list', async () => {
    const { store, baseDir } = createStore('append-list');

    const entry: MemoryEntry = {
      agentId: ' agent-alpha ',
      content: '  remember to hydrate  ',
      timestamp: '2024-05-01T12:00:00Z  ',
    };

    await store.append(entry);

    const entries = await store.list(' agent-alpha ');
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({
      agentId: 'agent-alpha',
      content: 'remember to hydrate',
      timestamp: '2024-05-01T12:00:00Z',
    });

    const persisted = await readPersistedEntries(baseDir, 'agent-alpha');
    expect(persisted).toEqual([
      {
        agentId: 'agent-alpha',
        content: 'remember to hydrate',
        timestamp: '2024-05-01T12:00:00Z',
      },
    ]);
  });

  it('returns the most recent entry via latest', async () => {
    const { store } = createStore('latest');

    const olderEntry: MemoryEntry = {
      agentId: 'agent-beta',
      content: 'first note',
      timestamp: '2024-05-01T10:00:00Z',
    };

    const newerEntry: MemoryEntry = {
      agentId: 'agent-beta',
      content: 'latest note',
      timestamp: '2024-05-01T15:00:00Z',
    };

    await store.append(newerEntry);
    await store.append(olderEntry);

    const entries = await store.list('agent-beta');
    expect(entries).toEqual([olderEntry, newerEntry]);

    const latest = await store.latest('agent-beta');
    expect(latest).toEqual(newerEntry);
  });

  it('builds summary with totals and last timestamp', async () => {
    const { store } = createStore('summary');

    await store.append({
      agentId: 'agent-gamma',
      content: 'alpha note',
      timestamp: '2024-05-01T08:00:00Z',
    });

    await store.append({
      agentId: 'agent-gamma',
      content: 'beta note',
      timestamp: '2024-05-01T09:30:00Z',
    });

    const summary = await store.summary('agent-gamma');
    expect(summary).toEqual({
      totalEntries: 2,
      lastTimestamp: '2024-05-01T09:30:00Z',
    });
  });

  it('invokes analytics hooks around append and list operations', async () => {
    const onAppend = mock();
    const onRead = mock();
    const hooks: MemoryAnalyticsHooks = { onAppend, onRead };

    const { store } = createStore('analytics', hooks);

    const entry: MemoryEntry = {
      agentId: 'agent-delta',
      content: 'hook me',
      timestamp: '2024-05-01T12:00:00Z',
    };

    await store.append(entry);
    await store.list('agent-delta');

    expect(onAppend).toHaveBeenCalledTimes(2);
    expect(onRead).toHaveBeenCalledTimes(2);

    const appendSources = onAppend.mock.calls.map(([payload]) => payload.source);
    expect(appendSources).toContain('adapter');
    expect(appendSources).toContain('store');

    const readSources = onRead.mock.calls.map(([payload]) => payload.source);
    expect(readSources).toContain('adapter');
    expect(readSources).toContain('store');

    const storeAppendCall = onAppend.mock.calls.find(([payload]) => payload.source === 'store');
    expect(storeAppendCall?.[0]).toMatchObject({
      agentId: 'agent-delta',
      entry: {
        agentId: 'agent-delta',
        content: 'hook me',
        timestamp: '2024-05-01T12:00:00Z',
      },
    });
  });
});
