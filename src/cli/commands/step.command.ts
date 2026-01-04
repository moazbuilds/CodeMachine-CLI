import type { Command } from 'commander';

import { loadAgentTemplate, loadAgentConfig } from '../../agents/runner/index.js';
import { getEngine } from '../../infra/engines/index.js';
import type { EngineType } from '../../infra/engines/index.js';
import {
  getAgentLoggers,
  formatAgentLog,
  startSpinner,
  stopSpinner,
  createSpinnerLoggers,
} from '../../shared/logging/index.js';
import { info } from '../../shared/logging/logger.js';
import { processPromptString } from '../../shared/prompts/index.js';

type StepCommandOptions = {
  model?: string;
  engine?: string;
  reasoning?: 'low' | 'medium' | 'high';
};

/**
 * Ensures the engine is authenticated
 */
async function ensureEngineAuth(engineType: EngineType): Promise<void> {
  const { registry } = await import('../../infra/engines/index.js');
  const engine = registry.get(engineType);

  if (!engine) {
    const availableEngines = registry.getAllIds().join(', ');
    throw new Error(
      `Unknown engine type: ${engineType}. Available engines: ${availableEngines}`
    );
  }

  const isAuthed = await engine.auth.isAuthenticated();
  if (!isAuthed) {
    console.error(`\n${engine.metadata.name} authentication required`);
    console.error(`\nRun the following command to authenticate:\n`);
    console.error(`  codemachine auth login\n`);
    throw new Error(`${engine.metadata.name} authentication required`);
  }
}

/**
 * Executes a single workflow step (agent from config/main.agents.js)
 * with optional additional prompt appended to the main prompt
 */
async function executeStep(
  agentId: string,
  additionalPrompt: string,
  options: StepCommandOptions,
): Promise<void> {
  const workingDir = process.cwd();

  // Validate reasoning level if provided
  if (options.reasoning && !['low', 'medium', 'high'].includes(options.reasoning)) {
    throw new Error(`Invalid reasoning level: ${options.reasoning}. Must be one of: low, medium, high`);
  }

  // Load agent config and template
  const agentConfig = await loadAgentConfig(agentId, workingDir);
  const rawTemplate = await loadAgentTemplate(agentId, workingDir);
  const agentTemplate = await processPromptString(rawTemplate, workingDir);

  // Determine engine: CLI override > agent config > first authenticated engine
  const { registry } = await import('../../infra/engines/index.js');
  let engineType: EngineType;

  if (options.engine) {
    engineType = options.engine as EngineType;
  } else if (agentConfig.engine) {
    engineType = agentConfig.engine;
  } else {
    // Fallback: find first authenticated engine by order
    const engines = registry.getAll();
    let foundEngine = null;

    for (const engine of engines) {
      const isAuth = await engine.auth.isAuthenticated();
      if (isAuth) {
        foundEngine = engine;
        break;
      }
    }

    if (!foundEngine) {
      // If no authenticated engine, use default (first by order)
      foundEngine = registry.getDefault();
    }

    if (!foundEngine) {
      throw new Error('No engines registered. Please install at least one engine.');
    }

    engineType = foundEngine.metadata.id;
    info(`No engine specified for agent '${agentId}', using ${foundEngine.metadata.name} (${engineType})`);
  }

  // Ensure authentication
  await ensureEngineAuth(engineType);

  // Get engine module for defaults
  const engineModule = registry.get(engineType);
  if (!engineModule) {
    throw new Error(`Engine not found: ${engineType}`);
  }

  // Model resolution: CLI override > agent config > engine default
  const model = options.model ?? (agentConfig.model as string | undefined) ?? engineModule.metadata.defaultModel;
  const modelReasoningEffort = options.reasoning ?? (agentConfig.modelReasoningEffort as 'low' | 'medium' | 'high' | undefined) ?? engineModule.metadata.defaultModelReasoningEffort;

  // Build composite prompt
  let compositePrompt: string;
  if (additionalPrompt) {
    // If additional prompt provided, append it as a REQUEST section
    compositePrompt = `${agentTemplate}\n\n[REQUEST]\n${additionalPrompt}`;
  } else {
    // If no additional prompt, just use the template
    compositePrompt = agentTemplate;
  }

  // Get engine and execute
  const engine = getEngine(engineType);

  console.log('═'.repeat(80));
  console.log(formatAgentLog(agentId, `${agentConfig.name} started to work.`));

  // Get base loggers
  const { stdout: baseStdoutLogger, stderr: baseStderrLogger } = getAgentLoggers(agentId);

  // Start spinner with workflow start time
  const workflowStartTime = Date.now();
  const spinnerState = startSpinner(agentConfig.name, engineType, workflowStartTime, model, modelReasoningEffort);

  // Wrap loggers with spinner control
  const { stdoutLogger, stderrLogger } = createSpinnerLoggers(
    baseStdoutLogger,
    baseStderrLogger,
    spinnerState,
  );

  try {
    let totalStdout = '';
    const result = await engine.run({
      prompt: compositePrompt,
      workingDir,
      model,
      modelReasoningEffort,
      onData: (chunk) => {
        totalStdout += chunk;
        stdoutLogger(chunk);
      },
      onErrorData: (chunk) => {
        stderrLogger(chunk);
      },
    });

    stopSpinner(spinnerState);

    console.log(formatAgentLog(agentId, `${agentConfig.name} has completed their work.`));
    console.log('\n' + '═'.repeat(80) + '\n');
  } catch (error) {
    stopSpinner(spinnerState);
    console.error(
      formatAgentLog(
        agentId,
        `${agentConfig.name} failed: ${error instanceof Error ? error.message : String(error)}`,
      ),
    );
    throw error;
  }
}

/**
 * Registers the step command
 */
export async function registerStepCommand(program: Command): Promise<void> {
  program
    .command('step')
    .description('Execute a single workflow step (agent from config/main.agents.js)')
    .argument('<id>', 'Agent id from config/main.agents.js')
    .argument('[prompt...]', 'Optional additional prompt to append to the agent\'s main prompt')
    .option('--model <model>', 'Model to use (overrides agent config)')
    .option('--engine <engine>', 'Engine to use (overrides agent config and defaults)')
    .option('--reasoning <level>', 'Reasoning effort level: low, medium, or high (overrides agent config)')
    .action(async (id: string, promptParts: string[], options: StepCommandOptions) => {
      const additionalPrompt = promptParts.join(' ').trim();
      await executeStep(id, additionalPrompt, options);
    });
}
