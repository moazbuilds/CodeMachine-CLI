import { logTelemetry } from './logger.js';
import { debug } from '../logging/logger.js';
import type { EngineType } from '../../infra/engines/index.js';
import { parseTelemetry as parseClaudeTelemetry } from '../../infra/engines/providers/claude/telemetryParser.js';
import { parseTelemetry as parseCodexTelemetry } from '../../infra/engines/providers/codex/telemetryParser.js';
import { parseTelemetry as parseOpenCodeTelemetry } from '../../infra/engines/providers/opencode/telemetryParser.js';
import { parseTelemetry as parseCCRTelemetry } from '../../infra/engines/providers/ccr/telemetryParser.js';
import { parseTelemetry as parseCursorTelemetry } from '../../infra/engines/providers/cursor/telemetryParser.js';

interface CapturedTelemetry {
  duration?: number;
  cost?: number;
  tokens?: {
    input: number;
    output: number;
    cached?: number;
  };
}

type TelemetryParser = (json: unknown) => CapturedTelemetry | null;

/**
 * Engine-specific telemetry parsers
 */
const telemetryParsers: Record<EngineType, TelemetryParser> = {
  claude: parseClaudeTelemetry,
  codex: parseCodexTelemetry,
  opencode: parseOpenCodeTelemetry,
  ccr: parseCCRTelemetry,
  cursor: parseCursorTelemetry,
};

export interface TelemetryCapture {
  /**
   * Parses a streaming JSON line and captures telemetry data if present
   */
  captureFromStreamJson(line: string): void;

  /**
   * Gets the captured telemetry data
   */
  getCaptured(): CapturedTelemetry | null;

  /**
   * Logs the captured telemetry data to the telemetry log file
   */
  logCapturedTelemetry(exitCode: number): void;
}

/**
 * Creates a telemetry capture instance for an engine execution
 */
export function createTelemetryCapture(
  engine: EngineType,
  model: string | undefined,
  prompt: string,
  workingDir: string,
): TelemetryCapture {
  let captured: CapturedTelemetry | null = null;

  return {
    captureFromStreamJson(line: string): void {
      try {
        const json = JSON.parse(line);

        // Use engine-specific parser
        const parser = telemetryParsers[engine];
        const result = parser(json);
        if (result) {
          debug('[TELEMETRY:2-CAPTURE] [%s] Captured telemetry from stream', engine.toUpperCase());
          if (result.tokens) {
            debug('[TELEMETRY:2-CAPTURE] [%s]   STORING: input=%d, output=%d, cached=%s',
              engine.toUpperCase(),
              result.tokens.input,
              result.tokens.output,
              result.tokens.cached ?? 'none');
          }
          captured = result;
        }
      } catch {
        // Ignore JSON parse errors - not all lines will be valid JSON
      }
    },

    getCaptured(): CapturedTelemetry | null {
      if (captured) {
        debug('[TELEMETRY:2-CAPTURE] [%s] getCaptured() → input=%d, output=%d, cached=%s',
          engine.toUpperCase(),
          captured.tokens?.input ?? 0,
          captured.tokens?.output ?? 0,
          captured.tokens?.cached ?? 'none');
      }
      return captured;
    },

    logCapturedTelemetry(exitCode: number): void {
      debug('[TELEMETRY:2-CAPTURE] [%s] logCapturedTelemetry called (exitCode=%d)', engine.toUpperCase(), exitCode);

      if (!captured || !captured.tokens) {
        debug('[TELEMETRY:2-CAPTURE] [%s]   SKIP: No captured telemetry or tokens', engine.toUpperCase());
        return;
      }

      // Validate that token values are actual numbers
      if (typeof captured.tokens.input !== 'number' || typeof captured.tokens.output !== 'number') {
        debug('[TELEMETRY:2-CAPTURE] [%s]   SKIP: Invalid token types (input=%s, output=%s)',
          engine.toUpperCase(),
          typeof captured.tokens.input,
          typeof captured.tokens.output);
        return;
      }

      debug('[TELEMETRY:2-CAPTURE] [%s]   LOGGING: input=%d, output=%d, cached=%s, cost=$%s',
        engine.toUpperCase(),
        captured.tokens.input,
        captured.tokens.output,
        captured.tokens.cached ?? 'none',
        captured.cost?.toFixed(6) ?? 'N/A');

      logTelemetry({
        engine,
        model: model || 'default',
        cost: captured.cost,
        duration: captured.duration,
        tokens: {
          input: captured.tokens.input,
          output: captured.tokens.output,
          cached: captured.tokens.cached,
        },
        exitCode,
        promptPreview: prompt,
        workingDir,
      });
    },
  };
}
