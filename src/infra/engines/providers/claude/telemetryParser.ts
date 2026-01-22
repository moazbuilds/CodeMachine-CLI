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
 * Parse Claude telemetry from streaming JSON
 *
 * Claude emits telemetry in "result" events with full usage data
 */
export function parseTelemetry(json: unknown): CapturedTelemetry | null {
  // Type guard to check if json is an object with required properties
  if (
    typeof json === 'object' &&
    json !== null &&
    'type' in json &&
    (json as Record<string, unknown>).type === 'result' &&
    'usage' in json
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = json as Record<string, any>;

    debug('[TELEMETRY:1-PARSER] [CLAUDE] Received result event with usage data');
    debug('[TELEMETRY:1-PARSER] [CLAUDE]   RAW: input_tokens=%d, output_tokens=%d, cache_read=%d, cache_creation=%d',
      data.usage.input_tokens,
      data.usage.output_tokens,
      data.usage.cache_read_input_tokens || 0,
      data.usage.cache_creation_input_tokens || 0);

    // Calculate cached tokens from both cache_read_input_tokens and cache_creation_input_tokens
    const cachedTokens = (data.usage.cache_read_input_tokens || 0) + (data.usage.cache_creation_input_tokens || 0);

    const result = {
      duration: data.duration_ms,
      cost: data.total_cost_usd,
      tokens: {
        input: data.usage.input_tokens,
        output: data.usage.output_tokens,
        cached: cachedTokens > 0 ? cachedTokens : undefined,
      },
    };

    debug('[TELEMETRY:1-PARSER] [CLAUDE]   PARSED: input=%d, output=%d, cached=%s, duration=%dms, cost=$%s',
      result.tokens.input,
      result.tokens.output,
      result.tokens.cached ?? 'none',
      result.duration ?? 0,
      result.cost?.toFixed(6) ?? 'N/A');

    return result;
  }

  return null;
}
