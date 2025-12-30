/**
 * MCP Server Setup Utilities
 *
 * Auto-configure AI agents (Claude Code, Codex) to use codemachine's MCP servers.
 * This ensures users don't need to manually configure anything.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ============================================================================
// MCP SERVER PATHS
// ============================================================================

/**
 * Get the path to the workflow-signals MCP server
 *
 * When running from a compiled binary, __dirname resolves to Bun's virtual
 * filesystem (/$bunfs/...) which doesn't exist on disk. In that case, we
 * must use CODEMACHINE_PACKAGE_ROOT to get the real filesystem path.
 */
export function getWorkflowSignalsMCPPath(): string {
  // Check if we're running from a compiled binary (Bun's virtual FS)
  const isCompiledBinary = __dirname.startsWith('/$bunfs');

  if (isCompiledBinary) {
    const packageRoot = process.env.CODEMACHINE_PACKAGE_ROOT;
    if (!packageRoot) {
      throw new Error(
        'CODEMACHINE_PACKAGE_ROOT must be set when running from compiled binary'
      );
    }
    return path.join(packageRoot, 'src', 'infra', 'mcp', 'servers', 'workflow-signals', 'index.ts');
  }

  // Dev mode or bun link - use __dirname which points to real filesystem
  return path.resolve(__dirname, 'servers/workflow-signals/index.ts');
}

/**
 * Get MCP server configuration object for workflow-signals
 */
export function getWorkflowSignalsMCPConfig(workflowDir: string): MCPServerConfig {
  return {
    command: 'bun',
    args: ['run', getWorkflowSignalsMCPPath()],
    env: {
      WORKFLOW_DIR: workflowDir,
    },
  };
}

// ============================================================================
// TYPES
// ============================================================================

interface MCPServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

interface ClaudeSettings {
  mcpServers?: Record<string, MCPServerConfig>;
  [key: string]: unknown;
}

// ============================================================================
// CLAUDE CODE CONFIGURATION
// ============================================================================

/**
 * Get Claude Code settings file path
 *
 * @param scope - 'project' for .claude/settings.json, 'user' for ~/.claude/settings.json
 * @param projectDir - Project directory (only used for 'project' scope)
 */
export function getClaudeSettingsPath(
  scope: 'project' | 'user',
  projectDir?: string
): string {
  if (scope === 'project') {
    if (!projectDir) {
      throw new Error('projectDir required for project scope');
    }
    return path.join(projectDir, '.claude', 'settings.json');
  }
  return path.join(homedir(), '.codemachine', 'claude', 'settings.json');
}

/**
 * Read Claude Code settings
 */
async function readClaudeSettings(settingsPath: string): Promise<ClaudeSettings> {
  try {
    const content = await fs.readFile(settingsPath, 'utf-8');
    return JSON.parse(content) as ClaudeSettings;
  } catch {
    return {};
  }
}

/**
 * Write Claude Code settings
 */
async function writeClaudeSettings(
  settingsPath: string,
  settings: ClaudeSettings
): Promise<void> {
  await fs.mkdir(path.dirname(settingsPath), { recursive: true });
  await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2));
}

/**
 * Configure Claude Code to use workflow-signals MCP server
 *
 * @param workflowDir - The workflow directory
 * @param scope - 'project' (recommended) or 'user'
 */
export async function configureClaudeMCP(
  workflowDir: string,
  scope: 'project' | 'user' = 'project'
): Promise<void> {
  const settingsPath = getClaudeSettingsPath(scope, workflowDir);
  const settings = await readClaudeSettings(settingsPath);

  // Initialize mcpServers if not present
  settings.mcpServers = settings.mcpServers || {};

  // Add/update workflow-signals MCP server
  settings.mcpServers['workflow-signals'] = getWorkflowSignalsMCPConfig(workflowDir);

  await writeClaudeSettings(settingsPath, settings);
}

/**
 * Remove workflow-signals MCP server from Claude Code settings
 */
export async function removeClaudeMCP(
  workflowDir: string,
  scope: 'project' | 'user' = 'project'
): Promise<void> {
  const settingsPath = getClaudeSettingsPath(scope, workflowDir);
  const settings = await readClaudeSettings(settingsPath);

  if (settings.mcpServers && 'workflow-signals' in settings.mcpServers) {
    delete settings.mcpServers['workflow-signals'];
    await writeClaudeSettings(settingsPath, settings);
  }
}

/**
 * Check if Claude Code has workflow-signals MCP configured
 */
export async function isClaudeMCPConfigured(
  workflowDir: string,
  scope: 'project' | 'user' = 'project'
): Promise<boolean> {
  const settingsPath = getClaudeSettingsPath(scope, workflowDir);
  const settings = await readClaudeSettings(settingsPath);

  return !!(settings.mcpServers && 'workflow-signals' in settings.mcpServers);
}

// ============================================================================
// CODEX CONFIGURATION
// ============================================================================

/**
 * Get Codex config file path (config.toml)
 */
export function getCodexSettingsPath(
  scope: 'project' | 'user',
  projectDir?: string
): string {
  if (scope === 'project') {
    if (!projectDir) {
      throw new Error('projectDir required for project scope');
    }
    return path.join(projectDir, '.codex', 'config.toml');
  }
  return path.join(homedir(), '.codemachine', 'codex', 'config.toml');
}

/**
 * Parse simple TOML (enough for our config.toml needs)
 */
function _parseSimpleToml(content: string): string {
  // Just return the content, we'll append to it
  return content;
}

/**
 * Generate TOML section for workflow-signals MCP server
 */
function generateMCPTomlSection(workflowDir: string): string {
  const mcpPath = getWorkflowSignalsMCPPath();
  // Get the directory containing the MCP server for cwd
  const mcpDir = path.dirname(path.dirname(path.dirname(mcpPath)));

  const lines = [
    '[mcp_servers."workflow-signals"]',
    'command = "bun"',
    `args = ["run", "${mcpPath}"]`,
    `cwd = "${mcpDir}"`,
    'startup_timeout_sec = 40',
    '',
    '[mcp_servers."workflow-signals".env]',
    `WORKFLOW_DIR = "${workflowDir}"`,
  ];

  return lines.join('\n');
}

/**
 * Configure Codex to use workflow-signals MCP server
 * Codex uses config.toml format
 */
export async function configureCodexMCP(
  workflowDir: string,
  scope: 'project' | 'user' = 'project'
): Promise<void> {
  const configPath = getCodexSettingsPath(scope, workflowDir);

  let existingContent = '';
  try {
    existingContent = await fs.readFile(configPath, 'utf-8');
  } catch {
    // File doesn't exist
  }

  // Clean approach: filter out any workflow-signals related lines
  const lines = existingContent.split('\n');
  const cleanedLines: string[] = [];
  let skipUntilNextSection = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Check if this is a workflow-signals section (any variant)
    if (trimmed.startsWith('[') && trimmed.includes('workflow-signals')) {
      skipUntilNextSection = true;
      continue;
    }

    // Check if this is a malformed line starting with ["run" (broken args)
    if (trimmed.startsWith('["run"')) {
      skipUntilNextSection = true;
      continue;
    }

    // If we hit a new section that's NOT workflow-signals, stop skipping
    if (skipUntilNextSection && trimmed.startsWith('[') && !trimmed.includes('workflow-signals')) {
      skipUntilNextSection = false;
    }

    // Skip lines while in workflow-signals section
    if (skipUntilNextSection) {
      continue;
    }

    cleanedLines.push(line);
  }

  // Build new content
  const base = cleanedLines.join('\n').trim();
  const section = generateMCPTomlSection(workflowDir);
  const newContent = base ? base + '\n\n' + section : section;

  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, newContent.trim() + '\n');
}

// ============================================================================
// OPENCODE CONFIGURATION
// ============================================================================

interface OpenCodeMCPServer {
  type: 'local' | 'remote';
  command?: string[];
  environment?: Record<string, string>;
  enabled?: boolean;
  timeout?: number;
}

interface OpenCodeSettings {
  $schema?: string;
  mcp?: Record<string, OpenCodeMCPServer>;
  [key: string]: unknown;
}

/**
 * Get OpenCode config file path (opencode.json)
 * OpenCode uses opencode.json format
 */
export function getOpenCodeSettingsPath(
  scope: 'project' | 'user',
  projectDir?: string
): string {
  if (scope === 'project') {
    if (!projectDir) {
      throw new Error('projectDir required for project scope');
    }
    return path.join(projectDir, 'opencode.json');
  }
  return path.join(homedir(), '.codemachine', 'opencode', 'config', 'opencode', 'opencode.json');
}

/**
 * Read OpenCode settings
 */
async function readOpenCodeSettings(settingsPath: string): Promise<OpenCodeSettings> {
  try {
    const content = await fs.readFile(settingsPath, 'utf-8');
    return JSON.parse(content) as OpenCodeSettings;
  } catch {
    return {};
  }
}

/**
 * Write OpenCode settings
 */
async function writeOpenCodeSettings(
  settingsPath: string,
  settings: OpenCodeSettings
): Promise<void> {
  await fs.mkdir(path.dirname(settingsPath), { recursive: true });
  await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2));
}

/**
 * Get MCP server configuration for OpenCode format
 * Uses current working directory automatically (no WORKFLOW_DIR needed)
 */
function getOpenCodeMCPConfig(): OpenCodeMCPServer {
  return {
    type: 'local',
    command: ['bun', 'run', getWorkflowSignalsMCPPath()],
    enabled: true,
  };
}

/**
 * Configure OpenCode to use workflow-signals MCP server
 *
 * @param workflowDir - The workflow directory
 * @param scope - 'project' (recommended) or 'user'
 */
export async function configureOpenCodeMCP(
  workflowDir: string,
  scope: 'project' | 'user' = 'project'
): Promise<void> {
  const settingsPath = getOpenCodeSettingsPath(scope, workflowDir);
  const settings = await readOpenCodeSettings(settingsPath);

  // Initialize mcp if not present
  settings.mcp = settings.mcp || {};

  // Add/update workflow-signals MCP server
  settings.mcp['workflow-signals'] = getOpenCodeMCPConfig();

  await writeOpenCodeSettings(settingsPath, settings);
}

/**
 * Remove workflow-signals MCP server from OpenCode settings
 */
export async function removeOpenCodeMCP(
  workflowDir: string,
  scope: 'project' | 'user' = 'project'
): Promise<void> {
  const settingsPath = getOpenCodeSettingsPath(scope, workflowDir);
  const settings = await readOpenCodeSettings(settingsPath);

  if (settings.mcp && 'workflow-signals' in settings.mcp) {
    delete settings.mcp['workflow-signals'];
    await writeOpenCodeSettings(settingsPath, settings);
  }
}

/**
 * Check if OpenCode has workflow-signals MCP configured
 */
export async function isOpenCodeMCPConfigured(
  workflowDir: string,
  scope: 'project' | 'user' = 'project'
): Promise<boolean> {
  const settingsPath = getOpenCodeSettingsPath(scope, workflowDir);
  const settings = await readOpenCodeSettings(settingsPath);

  return !!(settings.mcp && 'workflow-signals' in settings.mcp);
}

// ============================================================================
// UNIFIED SETUP
// ============================================================================

export interface SetupOptions {
  /** Workflow directory */
  workflowDir: string;
  /** Which agents to configure */
  agents?: ('claude' | 'codex' | 'opencode')[];
  /** Configuration scope */
  scope?: 'project' | 'user';
}

/**
 * Setup MCP servers for all supported agents
 *
 * Call this at the start of a workflow to ensure agents have access to
 * the workflow-signals tools.
 */
export async function setupWorkflowMCP(options: SetupOptions): Promise<void> {
  const { workflowDir, agents = ['claude'], scope = 'project' } = options;

  const results: { agent: string; success: boolean; error?: string }[] = [];

  for (const agent of agents) {
    try {
      if (agent === 'claude') {
        await configureClaudeMCP(workflowDir, scope);
        results.push({ agent: 'claude', success: true });
      } else if (agent === 'codex') {
        await configureCodexMCP(workflowDir, scope);
        results.push({ agent: 'codex', success: true });
      } else if (agent === 'opencode') {
        await configureOpenCodeMCP(workflowDir, scope);
        results.push({ agent: 'opencode', success: true });
      }
    } catch (error) {
      results.push({
        agent,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Log results to stderr
  for (const result of results) {
    if (result.success) {
      console.error(`[MCP Setup] Configured workflow-signals for ${result.agent}`);
    } else {
      console.error(`[MCP Setup] Failed to configure ${result.agent}: ${result.error}`);
    }
  }
}

/**
 * Cleanup MCP servers after workflow completes
 */
export async function cleanupWorkflowMCP(options: SetupOptions): Promise<void> {
  const { workflowDir, agents = ['claude'], scope = 'project' } = options;

  for (const agent of agents) {
    try {
      if (agent === 'claude') {
        await removeClaudeMCP(workflowDir, scope);
      } else if (agent === 'opencode') {
        await removeOpenCodeMCP(workflowDir, scope);
      }
      // Other engines handle cleanup via their own mcp.ts modules
    } catch {
      // Ignore cleanup errors
    }
  }
}
