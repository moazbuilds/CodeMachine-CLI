/**
 * Metrics Configuration
 *
 * Reads environment variables to configure the metrics system.
 * Reuses tracing configuration patterns for consistency.
 */

import { getConfig as getTracingConfig, type ExporterType } from '../tracing/config.js';

/**
 * Metrics configuration
 */
export interface MetricsConfig {
  /** Whether metrics are enabled (piggybacks on tracing config) */
  enabled: boolean;
  /** Exporter type (derived from tracing config) */
  exporter: ExporterType;
  /** OTLP endpoint for metrics (derived from trace endpoint) */
  otlpEndpoint: string;
  /** Directory for file exporter */
  tracesDir: string;
  /** Export interval in milliseconds (default: 60000) */
  exportIntervalMs: number;
  /** Service name for metrics */
  serviceName: string;
}

/**
 * Default configuration values
 */
const DEFAULTS = {
  exportIntervalMs: 500,
} as const;

/**
 * Derive metrics OTLP endpoint from trace endpoint
 * /v1/traces -> /v1/metrics
 */
function deriveMetricsEndpoint(traceEndpoint: string): string {
  return traceEndpoint.replace('/v1/traces', '/v1/metrics');
}

/**
 * Load metrics configuration from environment variables and tracing config
 *
 * Environment variables:
 * - CODEMACHINE_METRICS_INTERVAL: Export interval in ms (default: 60000)
 *
 * Derived from tracing config:
 * - enabled: Same as tracing enabled
 * - exporter: Same as trace exporter
 * - otlpEndpoint: Trace endpoint with /v1/traces -> /v1/metrics
 * - tracesDir: Same directory as traces
 * - serviceName: Same service name
 */
export function loadMetricsConfig(): MetricsConfig {
  const tracingConfig = getTracingConfig();

  return {
    enabled: tracingConfig.enabled,
    exporter: tracingConfig.exporter,
    otlpEndpoint: deriveMetricsEndpoint(tracingConfig.otlpEndpoint),
    tracesDir: tracingConfig.tracesDir,
    exportIntervalMs:
      parseInt(process.env.CODEMACHINE_METRICS_INTERVAL || '', 10) || DEFAULTS.exportIntervalMs,
    serviceName: tracingConfig.serviceName,
  };
}

/**
 * Cached configuration (loaded once)
 */
let cachedConfig: MetricsConfig | null = null;

/**
 * Get the current metrics configuration
 * Loads from environment on first call, returns cached value afterwards
 */
export function getMetricsConfig(): MetricsConfig {
  if (!cachedConfig) {
    cachedConfig = loadMetricsConfig();
  }
  return cachedConfig;
}

/**
 * Reset the cached configuration (useful for testing)
 */
export function resetMetricsConfig(): void {
  cachedConfig = null;
}
