/**
 * CodeMachine Metrics Module
 *
 * Provides OpenTelemetry-based metrics for the CodeMachine CLI.
 *
 * Usage:
 *
 * 1. Initialize metrics after tracing in application startup:
 *    ```typescript
 *    import { initMetrics } from './shared/metrics/index.js';
 *    await initMetrics();
 *    ```
 *
 * 2. Use meters to create custom metrics:
 *    ```typescript
 *    import { getEngineMeter } from './shared/metrics/index.js';
 *
 *    const meter = getEngineMeter();
 *    const requestCounter = meter.createCounter('engine.requests');
 *    requestCounter.add(1, { 'engine.name': 'claude' });
 *    ```
 *
 * 3. Configure via environment variables:
 *    - CODEMACHINE_TRACE=1|2 (enables metrics alongside tracing)
 *    - CODEMACHINE_TRACE_EXPORTER=file|otlp (sets exporter)
 *    - CODEMACHINE_METRICS_INTERVAL=60000 (export interval in ms)
 *
 * @module metrics
 */

// Initialization
export { initMetrics, shutdownMetrics, isMetricsEnabled } from './init.js';

// Configuration
export { getMetricsConfig, loadMetricsConfig, resetMetricsConfig } from './config.js';
export type { MetricsConfig } from './config.js';

// Meters
export {
  getProcessMeter,
  getEngineMeter,
  getAgentMeter,
  getMcpMeter,
  getSessionMeter,
  getTuiMeter,
  METER_NAMES,
} from './meters.js';

// Process metrics (for manual registration if needed)
export {
  registerProcessMetrics,
  stopEventLoopLagMeasurement,
} from './instruments/process.js';

// Re-export useful OpenTelemetry types for convenience
export type { Meter, Counter, Histogram, ObservableGauge } from '@opentelemetry/api';
