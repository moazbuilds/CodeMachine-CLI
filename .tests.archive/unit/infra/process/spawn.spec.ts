import { describe, expect, it } from 'bun:test';
import { spawnProcess } from '../../../../src/infra/process/spawn.js';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixture = path.resolve(__dirname, '../../../fixtures/stdin-echo.js');
const command = process.execPath;

describe('spawnProcess stdin handling', () => {
  it('sends stdinInput to the child process', async () => {
    const message = 'hello spawn';

    const result = await spawnProcess({
      command,
      args: [fixture],
      stdinInput: message,
      stdioMode: 'pipe'
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe(`IN:${message}`);
  });
});
