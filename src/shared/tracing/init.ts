/**
 * Tracing Initialization
 *
 * Initializes the OpenTelemetry SDK with the configured exporters and samplers.
 * Should be called early in the application startup.
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import {
  BatchSpanProcessor,
  SpanProcessor,
  ReadableSpan,
} from '@opentelemetry/sdk-trace-base';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';

import { getConfig, type TracingConfig } from './config.js';
import { createSampler } from './sampler.js';
import { createExporter, getExporterDescription } from './exporters/factory.js';
import { addSpan } from './storage.js';

/**
 * Global SDK instance
 */
let sdk: NodeSDK | null = null;

/**
 * Whether tracing has been initialized
 */
let initialized = false;

/**
 * Custom SpanProcessor that buffers spans for bug reports
 */
class BufferingSpanProcessor implements SpanProcessor {
  onStart(): void {
    // No-op on start
  }

  onEnd(span: ReadableSpan): void {
    // Add span to in-memory buffer for bug reports
    addSpan(span);
  }

  async shutdown(): Promise<void> {
    // No-op
  }

  async forceFlush(): Promise<void> {
    // No-op
  }
}

/**
 * Initialize the OpenTelemetry SDK
 *
 * This should be called early in the application startup, before any
 * instrumented code runs. It's safe to call multiple times - subsequent
 * calls will be no-ops.
 *
 * @returns The tracing configuration (for logging/debugging)
 */
export async function initTracing(): Promise<TracingConfig | null> {
  // Only initialize once
  if (initialized) {
    return getConfig();
  }

  const config = getConfig();

  // If tracing is disabled, do nothing
  if (!config.enabled) {
    initialized = true;
    return null;
  }

  // Enable diagnostic logging in debug mode
  if (process.env.CODEMACHINE_TRACE_DEBUG === '1') {
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
  }

  try {
    // Create the resource (service metadata)
    const resource = resourceFromAttributes({
      [ATTR_SERVICE_NAME]: config.serviceName,
      [ATTR_SERVICE_VERSION]: process.env.npm_package_version || 'unknown',
      'deployment.environment': process.env.NODE_ENV || 'development',
    });

    // Create the sampler
    const sampler = createSampler(config.level);

    // Create the exporter
    const exporter = createExporter(config);

    // Create span processor (batch for performance)
    const exportProcessor: SpanProcessor = new BatchSpanProcessor(exporter, {
      maxQueueSize: 100,
      maxExportBatchSize: 50,
      scheduledDelayMillis: 1000,
    });

    // Create the buffering processor for bug reports
    const bufferingProcessor = new BufferingSpanProcessor();

    // Initialize the SDK
    sdk = new NodeSDK({
      resource,
      sampler,
      spanProcessors: [bufferingProcessor, exportProcessor],
    });

    // Start the SDK
    await sdk.start();

    initialized = true;

    // Log initialization (only in debug mode)
    if (process.env.DEBUG) {
      const exporterDesc = getExporterDescription(config.exporter, config);
      console.log(`[Tracing] Initialized: level=${config.level}, exporter=${exporterDesc}`);
    }

    return config;
  } catch (error) {
    // Don't fail the application if tracing fails to initialize
    if (process.env.DEBUG) {
      console.error('[Tracing] Failed to initialize:', error);
    }
    initialized = true;
    return null;
  }
}

/**
 * Shutdown the tracing SDK
 *
 * Should be called during application shutdown to flush pending spans.
 */
export async function shutdownTracing(): Promise<void> {
  if (sdk) {
    try {
      await sdk.shutdown();
    } catch (error) {
      if (process.env.DEBUG) {
        console.error('[Tracing] Error during shutdown:', error);
      }
    }
    sdk = null;
  }
  initialized = false;
}

/**
 * Check if tracing is currently enabled
 */
export function isTracingEnabled(): boolean {
  return initialized && getConfig().enabled;
}

/**
 * Get the current tracing configuration
 */
export function getTracingConfig(): TracingConfig {
  return getConfig();
}
