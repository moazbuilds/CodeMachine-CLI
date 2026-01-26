/**
 * Tracing Configuration
 *
 * Reads environment variables to configure the tracing system.
 * Supports tiered trace levels and multiple exporters.
 */

/**
 * Trace levels for tiered tracing
 * - 0: Off (default) - no tracing
 * - 1: Minimal - only errors and slow operations (>5s)
 * - 2: Full - all spans
 */
export type TraceLevel = 0 | 1 | 2;

/**
 * Supported exporter types
 * Note: Console exporter is intentionally excluded - it would corrupt TUI rendering
 */
export type ExporterType = 'file' | 'otlp' | 'zipkin' | 'none';

/**
 * Tracing configuration
 */
export interface TracingConfig {
  /** Whether tracing is enabled */
  enabled: boolean;
  /** Trace level (0=off, 1=minimal, 2=full) */
  level: TraceLevel;
  /** Exporter type */
  exporter: ExporterType;
  /** OTLP endpoint (for otlp exporter) */
  otlpEndpoint: string;
  /** Zipkin endpoint (for zipkin exporter) */
  zipkinEndpoint: string;
  /** File path for file exporter */
  tracesDir: string;
  /** Service name for traces */
  serviceName: string;
  /** Whether TUI tracing is enabled (separate flag for performance) */
  tuiTracingEnabled: boolean;
  /** Slow operation threshold in milliseconds (for level 1) */
  slowThresholdMs: number;
}

/**
 * Default configuration values
 */
const DEFAULTS: TracingConfig = {
  enabled: false,
  level: 0,
  exporter: 'file',
  otlpEndpoint: 'http://localhost:4318/v1/traces',
  zipkinEndpoint: 'http://localhost:9411/api/v2/spans',
  tracesDir: '', // Will be set dynamically
  serviceName: 'codemachine',
  tuiTracingEnabled: false,
  slowThresholdMs: 5000,
};

/**
 * Parse trace level from environment variable
 */
function parseTraceLevel(value: string | undefined): TraceLevel {
  if (!value) return 0;
  const level = parseInt(value, 10);
  if (level === 1) return 1;
  if (level === 2) return 2;
  // Any truthy non-numeric value defaults to level 1 (minimal)
  if (value.toLowerCase() === 'true' || value === '1') return 1;
  return 0;
}

/**
 * Parse exporter type from environment variable
 * Note: Console exporter is not supported (would corrupt TUI rendering)
 */
function parseExporter(value: string | undefined): ExporterType {
  if (!value) return 'file';
  const normalized = value.toLowerCase();
  if (['file', 'otlp', 'zipkin', 'none'].includes(normalized)) {
    return normalized as ExporterType;
  }
  return 'file';
}

/**
 * Get the traces directory path (in CWD)
 */
function getTracesDir(): string {
  const { join } = require('node:path');
  const cwd = process.env.CODEMACHINE_CWD || process.cwd();
  return join(cwd, '.codemachine', 'traces');
}

/**
 * Load tracing configuration from environment variables
 *
 * Environment variables:
 * - CODEMACHINE_TRACE: Trace level (0=off, 1=minimal, 2=full)
 * - CODEMACHINE_TRACE_EXPORTER: Exporter type (file, otlp, zipkin, none)
 * - CODEMACHINE_TRACE_OTLP_ENDPOINT: OTLP/Jaeger endpoint URL
 * - CODEMACHINE_TRACE_ZIPKIN_ENDPOINT: Zipkin endpoint URL
 * - CODEMACHINE_TRACE_DIR: Directory for trace files
 * - CODEMACHINE_SERVICE_NAME: Service name in traces
 * - CODEMACHINE_TRACE_TUI: Enable TUI tracing (0 or 1)
 * - CODEMACHINE_TRACE_SLOW_THRESHOLD: Slow operation threshold in ms
 */
export function loadConfig(): TracingConfig {
  const level = parseTraceLevel(process.env.CODEMACHINE_TRACE);

  return {
    enabled: level > 0,
    level,
    exporter: parseExporter(process.env.CODEMACHINE_TRACE_EXPORTER),
    otlpEndpoint: process.env.CODEMACHINE_TRACE_OTLP_ENDPOINT || DEFAULTS.otlpEndpoint,
    zipkinEndpoint: process.env.CODEMACHINE_TRACE_ZIPKIN_ENDPOINT || DEFAULTS.zipkinEndpoint,
    tracesDir: process.env.CODEMACHINE_TRACE_DIR || getTracesDir(),
    serviceName: process.env.CODEMACHINE_SERVICE_NAME || DEFAULTS.serviceName,
    tuiTracingEnabled: process.env.CODEMACHINE_TRACE_TUI === '1',
    slowThresholdMs: parseInt(process.env.CODEMACHINE_TRACE_SLOW_THRESHOLD || '', 10) || DEFAULTS.slowThresholdMs,
  };
}

/**
 * Cached configuration (loaded once)
 */
let cachedConfig: TracingConfig | null = null;

/**
 * Get the current tracing configuration
 * Loads from environment on first call, returns cached value afterwards
 */
export function getConfig(): TracingConfig {
  if (!cachedConfig) {
    cachedConfig = loadConfig();
  }
  return cachedConfig;
}

/**
 * Reset the cached configuration (useful for testing)
 */
export function resetConfig(): void {
  cachedConfig = null;
}
