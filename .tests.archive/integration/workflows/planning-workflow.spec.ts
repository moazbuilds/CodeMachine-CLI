import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';

import { validateSpecification } from '../../../src/workflows/index.js';

describe('validateSpecification', () => {
  let tempDir: string;
  let tempSpecPath: string;
  let consoleSpy: ReturnType<typeof spyOn>;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'planning-workflow-'));
    tempSpecPath = join(tempDir, 'spec.md');
    consoleSpy = spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(async () => {
    consoleSpy.mockRestore();
    await rm(tempDir, { recursive: true, force: true });
  });

  it('resolves when specification file has content', async () => {
    await writeFile(tempSpecPath, '# Planning Spec\n- Outline');

    await expect(validateSpecification(tempSpecPath)).resolves.toBeUndefined();
  });

  it('rejects when specification file is empty', async () => {
    await writeFile(tempSpecPath, '');

    await expect(validateSpecification(tempSpecPath)).rejects.toThrow(/Please add your project requirements/);
  });
});
