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
 * Parse Mistral telemetry from streaming JSON
 *
 * Mistral emits telemetry in "result" events with full usage data
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
    // Calculate cached tokens from both cache_read_input_tokens and cache_creation_input_tokens
    const cachedTokens = (data.usage.cache_read_input_tokens || 0) + (data.usage.cache_creation_input_tokens || 0);

    return {
      duration: data.duration_ms,
      cost: data.total_cost_usd,
      tokens: {
        input: data.usage.input_tokens,
        output: data.usage.output_tokens,
        cached: cachedTokens > 0 ? cachedTokens : undefined,
      },
    };
  }

  return null;
}

