import { debug } from '../../../../shared/logging/logger.js';

interface CapturedTelemetry {
  duration?: number;
  cost?: number;
  tokens?: {
    input: number;
    output: number;
    cached?: number;
  };
}

/**
 * Parse OpenCode telemetry from streaming JSON
 *
 * OpenCode emits telemetry in "step_finish" events with nested tokens in part.tokens
 * We only capture "stop" steps (final steps with complete context), not "tool-calls" (intermediate)
 */
export function parseTelemetry(json: unknown): CapturedTelemetry | null {
  // Type guard to check if json is an object with required properties
  if (
    typeof json === 'object' &&
    json !== null &&
    'type' in json &&
    (json as Record<string, unknown>).type === 'step_finish' &&
    'part' in json
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = json as Record<string, any>;

    // Only capture final "stop" steps, skip intermediate "tool-calls" steps
    // "stop" steps have the complete context size, "tool-calls" are partial
    if (data.part?.reason !== 'stop') {
      debug('[TELEMETRY:1-PARSER] step_finish reason=%s (skipped, not stop)', data.part?.reason);
      return null;
    }

    if (data.part?.tokens) {
      const tokens = data.part.tokens;
      const cache = (tokens.cache?.read || 0) + (tokens.cache?.write || 0);

      debug('[TELEMETRY:1-PARSER] CAPTURED step_finish:stop → input=%d, output=%d, cached=%d, cost=%s',
        tokens.input, tokens.output, cache, data.part.cost);

      return {
        tokens: {
          input: tokens.input,
          output: tokens.output,
          cached: cache > 0 ? cache : undefined,
        },
        cost: data.part.cost,
      };
    }
  }

  return null;
}
