import { OrchestrationParser } from './parser.js';
import { OrchestrationExecutor } from './executor.js';
import type { OrchestrationResult } from './types.js';
import { AgentMonitorService } from '../monitoring/index.js';
import * as logger from '../../shared/logging/logger.js';
import chalk from 'chalk';

export interface OrchestrationOptions {
  /** Working directory for agent execution */
  workingDir: string;

  /** Optional logger for agent output */
  logger?: (agentName: string, chunk: string) => void;
}

/**
 * Main orchestration service
 * Coordinates parsing and execution of multi-agent orchestration
 */
export class OrchestrationService {
  private static instance: OrchestrationService;
  private parser: OrchestrationParser;

  private constructor() {
    this.parser = new OrchestrationParser();
    logger.debug('OrchestrationService initialized');
  }

  /**
   * Get singleton instance
   */
  static getInstance(): OrchestrationService {
    if (!OrchestrationService.instance) {
      OrchestrationService.instance = new OrchestrationService();
    }
    return OrchestrationService.instance;
  }

  /**
   * Execute an orchestration script
   */
  async execute(script: string, options: OrchestrationOptions): Promise<OrchestrationResult> {
    console.log(chalk.bold('\n🎭 Starting orchestration...\n'));
    console.log(chalk.dim(`Script: ${script}\n`));

    // Parse the script
    let plan;
    try {
      plan = this.parser.parse(script);
      logger.debug(`Parsed orchestration plan with ${plan.groups.length} groups`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(chalk.red(`\n✗ Failed to parse orchestration script: ${message}\n`));
      throw error;
    }

    // Detect parent context for proper hierarchy tracking
    const monitor = AgentMonitorService.getInstance();
    let contextParentId: number | undefined;

    // 1. Check environment variable (workflow/agent context propagation)
    const parentIdEnv = process.env.CODEMACHINE_PARENT_AGENT_ID;
    if (parentIdEnv) {
      const parsed = parseInt(parentIdEnv, 10);
      if (!isNaN(parsed)) {
        contextParentId = parsed;
        logger.debug(`Found parent agent ID from environment: ${contextParentId}`);
      }
    }

    // 2. If no env var, check for most recent active agent in monitoring
    if (contextParentId === undefined) {
      const activeAgents = monitor.getActiveAgents();
      if (activeAgents.length > 0) {
        // Get most recently started agent (likely the caller)
        const mostRecent = activeAgents.sort((a, b) =>
          new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
        )[0];
        contextParentId = mostRecent.id;
        logger.debug(`Inferred parent agent from active agents: ${contextParentId} (${mostRecent.name})`);
      }
    }

    // Don't register orchestration session - it's just a coordinator
    // Spawned agents will be registered directly under the parent workflow agent
    if (contextParentId !== undefined) {
      console.log(chalk.dim(`Orchestration under parent agent ID: ${contextParentId}\n`));
    } else {
      console.log(chalk.dim(`Orchestration running as standalone session\n`));
    }

    // Create executor - pass parent ID directly (no orchestration session wrapper)
    const executor = new OrchestrationExecutor({
      workingDir: options.workingDir,
      parentId: contextParentId, // Agents register directly under workflow agent
      logger: options.logger
    });

    // Execute the plan
    let result;
    try {
      result = await executor.execute(plan);

      // No monitoring needed - child agents track themselves
      // Orchestration success = all children succeeded

      // Print summary
      this.printSummary(result);

      return result;
    } catch (error) {
      // Error is already tracked by the failing child agent
      console.error(chalk.red(`\n✗ Orchestration failed: ${error}\n`));
      throw error;
    }
  }

  /**
   * Print execution summary
   */
  private printSummary(result: OrchestrationResult): void {
    console.log('\n' + chalk.bold('═'.repeat(60)));
    console.log(chalk.bold('Orchestration Summary'));
    console.log(chalk.bold('═'.repeat(60)) + '\n');

    const succeeded = result.results.filter(r => r.success).length;
    const failed = result.results.filter(r => !r.success).length;

    console.log(`${chalk.dim('Total agents:')} ${result.results.length}`);
    console.log(`${chalk.green('✓ Succeeded:')} ${succeeded}`);
    if (failed > 0) {
      console.log(`${chalk.red('✗ Failed:')} ${failed}`);
    }

    console.log('\n' + chalk.bold('Agent Results:'));
    result.results.forEach((r, index) => {
      const icon = r.success ? chalk.green('✓') : chalk.red('✗');
      const status = r.success ? chalk.green('Completed') : chalk.red('Failed');
      console.log(`  ${index + 1}. ${icon} ${chalk.bold(r.name)} - ${status} (ID: ${r.agentId})`);
      if (r.error) {
        console.log(`     ${chalk.red('Error:')} ${r.error}`);
      }
    });

    console.log('\n' + chalk.dim('─'.repeat(60)));
    console.log(chalk.dim(`View logs: codemachine agents logs <id>`));
    console.log(chalk.dim(`List all agents: codemachine agents`));
    console.log('');
  }
}
