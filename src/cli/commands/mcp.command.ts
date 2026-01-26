/**
 * MCP CLI Commands
 *
 * Commands for running MCP servers as part of the codemachine binary.
 */

import { Command } from 'commander';

export function registerMCPCommand(program: Command): void {
  const mcp = program.command('mcp').description('MCP server commands');

  mcp
    .command('router')
    .description('Start MCP router server (stdio)')
    .action(async () => {
      const { startRouter } = await import('../../infra/mcp/router/index.js');
      await startRouter();
    });
}
