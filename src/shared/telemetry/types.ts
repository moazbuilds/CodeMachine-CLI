export interface ParsedTelemetry {
  tokensIn: number;
  tokensOut: number;
  cached?: number;
  cost?: number;
  duration?: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
}
