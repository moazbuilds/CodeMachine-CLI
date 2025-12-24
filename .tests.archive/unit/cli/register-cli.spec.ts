import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';

import { registerCli } from '../../../src/cli/program.js';

describe('registerCli', () => {
  let program: Command;
  let consoleSpy: ReturnType<typeof spyOn>;

  beforeEach(async () => {
    program = new Command();
    consoleSpy = spyOn(console, 'log').mockImplementation(() => {});

    await registerCli(program);
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('registers expected top-level commands', () => {
    const commandNames = program.commands.map((command) => command.name());

    expect(commandNames).toEqual(
      expect.arrayContaining(['start', 'templates', 'auth', 'version', 'mcp']),
    );
  });

  it('attaches login and logout subcommands to auth', () => {
    const authCommand = program.commands.find((command) => command.name() === 'auth');
    expect(authCommand).toBeDefined();

    const subcommandNames = authCommand?.commands.map((command) => command.name()) ?? [];

    expect(subcommandNames).toEqual(expect.arrayContaining(['login', 'logout']));
    expect(subcommandNames).toHaveLength(2);
  });
});
