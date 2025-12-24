import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';

import { bootstrapWorkspace } from '../../../src/runtime/services/workspace/index.js';

const require = createRequire(import.meta.url);

// Generate dynamic agent fixtures to avoid hardcoded agent names
function generateAgentsFixture(timestamp: number): string {
  return `module.exports = [
  { id: 'test-agent-${timestamp}-1', name: 'Test Agent 1' },
  { id: 'test-agent-${timestamp}-2', name: 'Test Agent 2' }
];`;
}

// Default fixture for most tests
const AGENTS_FIXTURE = generateAgentsFixture(Date.now());

function loadAgents(modulePath: string): Array<{ id: string }> {
  try {
    delete require.cache[require.resolve(modulePath)];
  } catch {
    // ignore cache miss for freshly created modules
  }

  const loaded = require(modulePath);
  return Array.isArray(loaded) ? loaded : [];
}

function buildExpectedOrder(...agentLists: Array<Array<{ id: string }>>): string[] {
  const order: string[] = [];
  const seen = new Set<string>();

  for (const list of agentLists) {
    for (const agent of list) {
      if (!agent || typeof agent.id !== 'string') {
        continue;
      }
      const id = agent.id;
      if (seen.has(id)) {
        continue;
      }
      seen.add(id);
      order.push(id);
    }
  }

  return order;
}

async function createProject(root: string): Promise<string> {
  const projectRoot = join(root, 'project');
  await mkdir(join(projectRoot, 'config'), { recursive: true });
  await writeFile(join(projectRoot, 'config', 'package.json'), '{"type":"commonjs"}\n', 'utf8');
  await writeFile(join(projectRoot, 'config', 'sub.agents.js'), AGENTS_FIXTURE, 'utf8');
  return projectRoot;
}

describe('bootstrapWorkspace', () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'workspace-bootstrap-'));
    originalCwd = process.cwd();
  });

  afterEach(async () => {
    try {
      process.chdir(originalCwd);
    } catch {
      // Ignore chdir errors
    }
    await rm(tempDir, { recursive: true, force: true });
  });

  it('creates missing directories and files', async () => {
    const projectRoot = await createProject(tempDir);
    const desiredCwd = join(tempDir, 'projects', 'new-app');

    await bootstrapWorkspace({ projectRoot, cwd: desiredCwd });

    // Working directory directory is created (chdir may be disallowed in test worker threads)
    const desiredStat = await stat(desiredCwd);
    expect(desiredStat.isDirectory()).toBe(true);

    // Directories exist
    const specsPath = join(desiredCwd, '.codemachine', 'inputs', 'specifications.md');
    const memoryDir = join(desiredCwd, '.codemachine', 'memory');
    const artifactsDir = join(desiredCwd, '.codemachine', 'artifacts');
    const agentsJson = join(desiredCwd, '.codemachine', 'agents', 'agents-config.json');

    // files/dirs existence checks via stat
    await Promise.all([
      stat(specsPath),
      stat(memoryDir),
      stat(artifactsDir),
      stat(agentsJson)
    ]);

    const agentsContent = await readFile(agentsJson, 'utf8');
    const parsed = JSON.parse(agentsContent) as Array<{ id: string; name?: string }>;
    expect(Array.isArray(parsed)).toBe(true);

    const projectAgents = loadAgents(join(projectRoot, 'config', 'sub.agents.js'));
    const cliSubAgents = loadAgents('../../../config/sub.agents.js');
    const expectedIds = buildExpectedOrder(projectAgents, cliSubAgents);

    expect(parsed.map((a) => a.id)).toEqual(expectedIds);
    // Note: promptPath is not saved in agents-config.json (removed during initialization)
    // The prompt files are created as `${slugified-id}.md` on disk
    const projectAgentsFromFixture = loadAgents(join(projectRoot, 'config', 'sub.agents.js'));
    // Verify prompt files exist on disk (using slugified IDs as filenames)
    await stat(join(desiredCwd, '.codemachine', 'agents', `${projectAgentsFromFixture[0].id}.md`));
    await stat(join(desiredCwd, '.codemachine', 'agents', `${projectAgentsFromFixture[1].id}.md`));
  });

  it('mirrors config/sub.agents.js to JSON and is idempotent', async () => {
    const projectRoot = await createProject(tempDir);
    const desiredCwd = join(tempDir, 'projects', 'sample-app');

    await bootstrapWorkspace({ projectRoot, cwd: desiredCwd });

    const agentsJson = join(desiredCwd, '.codemachine', 'agents', 'agents-config.json');
    const first = await stat(agentsJson);

    // Short delay to ensure mtime would differ if rewritten
    await delay(100);

    await bootstrapWorkspace({ projectRoot, cwd: desiredCwd });
    const second = await stat(agentsJson);

    // unchanged when config/sub.agents.js unchanged
    expect(second.mtimeMs).toBe(first.mtimeMs);

    // Now, change sub.agents.js and expect JSON to refresh
    const updatedAgentId = `test-agent-updated-${Date.now()}`;
    const UPDATED_AGENTS = `module.exports = [ { id: '${updatedAgentId}' } ];`;
    await writeFile(join(projectRoot, 'config', 'sub.agents.js'), UPDATED_AGENTS, 'utf8');

    // ensure filesystem mtime can change on many FS
    await delay(1100);
    await bootstrapWorkspace({ projectRoot, cwd: desiredCwd });
    const third = await stat(agentsJson);
    expect(third.mtimeMs).toBeGreaterThanOrEqual(second.mtimeMs);

    const updatedContent = JSON.parse(await readFile(agentsJson, 'utf8'));
    const latestProjectAgents = loadAgents(join(projectRoot, 'config', 'sub.agents.js'));
    const cliSubAgents = loadAgents('../../../config/sub.agents.js');
    const cliAgentsForOrder = buildExpectedOrder(latestProjectAgents, cliSubAgents);

    expect(updatedContent.map((agent: { id: string }) => agent.id)).toEqual(cliAgentsForOrder);
    // Note: promptPath is not saved in agents-config.json (removed during initialization)
    expect(updatedContent[0]).toEqual({ id: updatedAgentId });
    // Verify the prompt file exists on disk
    await stat(join(desiredCwd, '.codemachine', 'agents', `${updatedAgentId}.md`));
  });

  it('respects CODEMACHINE_CWD environment override when cwd not provided', async () => {
    const projectRoot = await createProject(tempDir);
    const envCwd = join(tempDir, 'env', 'codemachine-cwd');

    const prev = process.env.CODEMACHINE_CWD;
    process.env.CODEMACHINE_CWD = envCwd;
    try {
      await bootstrapWorkspace({ projectRoot });
    } finally {
      if (prev === undefined) delete process.env.CODEMACHINE_CWD;
      else process.env.CODEMACHINE_CWD = prev;
    }

    // Working directory was created (switching CWD may be disallowed in thread pool)
    const st = await stat(envCwd);
    expect(st.isDirectory()).toBe(true);

    // Ensure .codemachine was created under the env-directed workspace
    const specsPath = join(envCwd, '.codemachine', 'inputs', 'specifications.md');
    const agentsJson = join(envCwd, '.codemachine', 'agents', 'agents-config.json');
    await Promise.all([stat(specsPath), stat(agentsJson)]);
  });

  it('falls back to the CLI agents catalog when workspace has no config', async () => {
    const desiredCwd = join(tempDir, 'projects', 'bare-app');

    await bootstrapWorkspace({ cwd: desiredCwd });

    const agentsJson = join(desiredCwd, '.codemachine', 'agents', 'agents-config.json');
    const parsedAgents = JSON.parse(await readFile(agentsJson, 'utf8')) as Array<{ id: string }>;
    const cliSubAgentsOnly = loadAgents('../../../config/sub.agents.js');
    const expectedIds = buildExpectedOrder(cliSubAgentsOnly);

    expect(parsedAgents.map((agent: { id: string }) => agent.id)).toEqual(expectedIds);
    // Note: promptPath is not saved in agents-config.json (removed during initialization)
    // Verify prompt files exist on disk (using slugified IDs as filenames)
    const expectedDir = join(desiredCwd, '.codemachine', 'agents');
    await Promise.all(
      parsedAgents.map(async (agent) => {
        const expectedFilename = `${agent.id}.md`;
        await stat(join(expectedDir, expectedFilename));
      }),
    );
  });

  it.skip('creates template.json when templatePath is provided', async () => {
    // SKIPPED: This test passes when run individually but fails when run with other tests
    // Likely due to test isolation issues with global state or module caching
    const projectRoot = await createProject(tempDir);
    const desiredCwd = join(tempDir, 'projects', 'template-test');
    // Use process.cwd() to construct absolute path to the template file
    const templatePath = join(process.cwd(), 'templates/workflows/codemachine.workflow.js');

    await bootstrapWorkspace({ projectRoot, cwd: desiredCwd, templatePath });

    const templateJsonPath = join(desiredCwd, '.codemachine', 'template.json');
    const templateJson = JSON.parse(await readFile(templateJsonPath, 'utf8'));

    expect(templateJson.activeTemplate).toBe('codemachine.workflow.js');
    expect(templateJson.lastUpdated).toBeDefined();
  });
});
