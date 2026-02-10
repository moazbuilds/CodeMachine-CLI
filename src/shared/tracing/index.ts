/**
 * CodeMachine Tracing Module
 *
 * Provides OpenTelemetry-based distributed tracing for the CodeMachine CLI.
 *
 * Usage:
 *
 * 1. Initialize tracing early in application startup:
 *    ```typescript
 *    import { initTracing } from './shared/tracing/index.js';
 *    await initTracing();
 *    ```
 *
 * 2. Use tracers to instrument code:
 *    ```typescript
 *    import { getEngineTracer, withSpan } from './shared/tracing/index.js';
 *
 *    const tracer = getEngineTracer();
 *    const result = await withSpan(tracer, 'engine.run', async (span) => {
 *      span.setAttribute('engine.name', 'codex');
 *      return await runEngine();
 *    });
 *    ```
 *
 * 3. Configure via environment variables:
 *    - CODEMACHINE_TRACE=0|1|2 (off|minimal|full)
 *    - CODEMACHINE_TRACE_EXPORTER=console|file|otlp|zipkin|none
 *    - CODEMACHINE_TRACE_OTLP_ENDPOINT=http://localhost:4318/v1/traces
 *
 * @module tracing
 */

// Initialization
export { initTracing, shutdownTracing, isTracingEnabled, getTracingConfig } from './init.js';

// Configuration
export { getConfig, loadConfig, resetConfig } from './config.js';
export type { TracingConfig, TraceLevel, ExporterType } from './config.js';

// Tracers
export {
  getEngineTracer,
  getAgentTracer,
  getMcpTracer,
  getTuiTracer,
  getCliTracer,
  getProcessTracer,
  withSpan,
  withSpanSync,
  withRootSpan,
  startManualSpan,
  startManualSpanAsync,
  getCurrentSpan,
  addSpanEvent,
  setSpanAttributes,
  recordSpanError,
  TRACER_NAMES,
} from './tracers.js';

// Storage (for bug reports)
export {
  addSpan,
  getSpans,
  getSerializedSpans,
  clearSpans,
  getSpanCount,
  saveErrorContext,
  getLastError,
  clearLastError,
} from './storage.js';
export type { SerializedSpan } from './storage.js';

// Re-export useful OpenTelemetry types for convenience
export { SpanStatusCode, SpanKind } from '@opentelemetry/api';
export type { Span, Tracer, Attributes } from '@opentelemetry/api';
