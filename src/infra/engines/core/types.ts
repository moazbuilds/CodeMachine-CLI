/**
 * Engine abstraction types for Codex and Claude
 */

/**
 * Engine type - now dynamically determined from registry
 * Use registry.getAllIds() to get available engine IDs at runtime
 */
export type EngineType = string;

export interface ParsedTelemetry {
  tokensIn: number;
  tokensOut: number;
  cached?: number;
  cost?: number;
  duration?: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
}

export interface EngineRunOptions {
  prompt: string;
  workingDir: string;
  model?: string;
  modelReasoningEffort?: 'low' | 'medium' | 'high';
  env?: NodeJS.ProcessEnv;
  onData?: (chunk: string) => void;
  onErrorData?: (chunk: string) => void;
  onTelemetry?: (telemetry: ParsedTelemetry) => void;
  onSessionId?: (sessionId: string) => void;
  abortSignal?: AbortSignal;
  timeout?: number;
}

export interface EngineRunResult {
  stdout: string;
  stderr: string;
}

export interface Engine {
  type: EngineType;
  run(options: EngineRunOptions): Promise<EngineRunResult>;
}

/**
 * Validate if a string is a valid engine type
 * Basic validation - registry-specific validation should be done at runtime
 */
export function isValidEngineType(type: string): boolean {
  return typeof type === 'string' && type.length > 0;
}

/**
 * Normalize engine type - returns valid engine ID or throws
 * Note: This basic validation can be enhanced when registry access is needed
 */
export function normalizeEngineType(type: string): string {
  if (isValidEngineType(type)) {
    return type;
  }
  throw new Error(`Invalid engine type "${type}". Engine type must be a non-empty string.`);
}
