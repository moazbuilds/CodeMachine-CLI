export interface TelemetryData {
  engine: string;
  model?: string;
  cost?: number;
  duration?: number;
  tokens: {
    input: number;
    output: number;
    cached?: number;
  };
  exitCode: number;
  promptPreview?: string;
  workingDir: string;
}

/**
 * No-op function: Telemetry is now stored in registry.json instead of a separate log file
 * This function is kept for backwards compatibility but does nothing
 */
export function logTelemetry(_data: TelemetryData): void {
  // Telemetry data is captured and stored in .codemachine/logs/registry.json
  // No need for a separate telemetry.log file
  // TODO: Legacy - debug no-op notice is retired telemetry noise. Remove this function after legacy callers are deleted.
  // if (process.env.LOG_LEVEL === 'debug') {
  //   console.error('[DEBUG] logTelemetry called (no-op - telemetry stored in registry.json)');
  // }
}
