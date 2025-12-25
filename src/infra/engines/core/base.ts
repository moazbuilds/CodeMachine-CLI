/**
 * Base types and interfaces for the engine plugin system
 */

import type { EngineRunOptions, EngineRunResult } from './types.js';

/**
 * Engine metadata - describes the engine for auto-discovery
 */
export interface EngineMetadata {
  /** Unique identifier for the engine (e.g., 'codex', 'claude') */
  id: string;
  /** Display name (e.g., 'Codex', 'Claude') */
  name: string;
  /** Description shown in UI (e.g., 'Authenticate with Claude AI') */
  description: string;
  /** CLI command namespace (e.g., 'codex', 'claude') */
  cliCommand: string;
  /** The actual CLI binary name to check/execute (e.g., 'codex', 'claude') */
  cliBinary: string;
  /** Install command for the CLI (e.g., 'npm install -g @openai/codex') */
  installCommand: string;
  /** Default model to use for this engine (e.g., 'gpt-5-codex', 'claude-sonnet-4.5') */
  defaultModel?: string;
  /** Default reasoning effort for models that support it (only applies to engines like Codex) */
  defaultModelReasoningEffort?: 'low' | 'medium' | 'high';
  /** Display order in UI (lower = first) */
  order?: number;
  /** Whether this engine is experimental */
  experimental?: boolean;
  /** Optional icon for UI */
  icon?: string;
}

/**
 * Authentication module interface - all engines must implement these
 */
export interface EngineAuthModule {
  /** Check if the engine is authenticated */
  isAuthenticated(options?: unknown): Promise<boolean>;
  /** Ensure authentication, prompting user if needed */
  ensureAuth(options?: unknown): Promise<boolean>;
  /** Clear authentication credentials */
  clearAuth(options?: unknown): Promise<void>;
  /** Get the next auth menu action based on current state */
  nextAuthMenuAction(options?: unknown): Promise<'login' | 'logout'>;
}

/**
 * MCP (Model Context Protocol) configuration for an engine
 */
export interface EngineMCPConfig {
  /** Whether this engine supports MCP */
  supported: boolean;
  /** Configure MCP servers for this engine */
  configure?: (workflowDir: string) => Promise<void>;
  /** Remove MCP configuration */
  cleanup?: (workflowDir: string) => Promise<void>;
  /** Check if MCP is configured */
  isConfigured?: (workflowDir: string) => Promise<boolean>;
}

/**
 * Complete engine module interface
 * All engines must export these to be auto-discovered
 */
export interface EngineModule {
  /** Engine metadata */
  metadata: EngineMetadata;
  /** Authentication module */
  auth: EngineAuthModule;
  /** Main execution function */
  run: (options: EngineRunOptions) => Promise<EngineRunResult>;
  /** Optional: Sync engine-specific configuration */
  syncConfig?: (options?: unknown) => Promise<void>;
  /** Optional: Called when engine is registered */
  onRegister?: () => void;
  /** Optional: Called when engine is loaded */
  onLoad?: () => void;
  /** Optional: MCP configuration for workflow signals */
  mcp?: EngineMCPConfig;
}

/**
 * Type guard to check if an object is a valid EngineModule
 */
export function isEngineModule(obj: unknown): obj is EngineModule {
  if (!obj || typeof obj !== 'object') return false;
  const candidate = obj as Partial<EngineModule>;
  return (
    !!candidate.metadata &&
    typeof candidate.metadata === 'object' &&
    !!candidate.auth &&
    typeof candidate.auth === 'object' &&
    typeof candidate.run === 'function'
  );
}
