/**
 * Metrics Initialization
 *
 * Registers process metrics with the global MeterProvider.
 * Note: The MeterProvider is initialized by the NodeSDK in tracing/init.ts
 * This module only registers the metrics instruments.
 */

import { metrics } from '@opentelemetry/api';

import { getMetricsConfig, type MetricsConfig } from './config.js';
import { getProcessMeter } from './meters.js';
import { registerProcessMetrics, stopEventLoopLagMeasurement } from './instruments/process.js';

/**
 * Whether metrics have been initialized
 */
let initialized = false;

/**
 * Get description of the exporter for logging
 */
function getExporterDescription(config: MetricsConfig): string {
  switch (config.exporter) {
    case 'otlp':
      return `OTLP (${config.otlpEndpoint})`;
    case 'file':
      return `File (${config.tracesDir})`;
    case 'none':
      return 'None';
    case 'zipkin':
      return 'None (Zipkin does not support metrics)';
    default:
      return 'Unknown';
  }
}

/**
 * Initialize metrics instruments
 *
 * This registers process metrics with the global MeterProvider.
 * The MeterProvider is set up by the NodeSDK in tracing/init.ts.
 * This function should be called after tracing initialization.
 *
 * @returns true if metrics were registered, false otherwise
 */
export async function initMetrics(): Promise<boolean> {
  // Only initialize once
  if (initialized) {
    return isMetricsEnabled();
  }

  const config = getMetricsConfig();

  // If metrics are disabled, do nothing
  if (!config.enabled) {
    initialized = true;
    return false;
  }

  // Skip if exporter doesn't support metrics
  if (config.exporter === 'none' || config.exporter === 'zipkin') {
    initialized = true;
    return false;
  }

  try {
    // Register process metrics with the global meter
    const processMeter = getProcessMeter();
    registerProcessMetrics(processMeter);

    initialized = true;

    // Log initialization (only in debug mode)
    if (process.env.DEBUG) {
      const exporterDesc = getExporterDescription(config);
      console.log(
        `[Metrics] Initialized: exporter=${exporterDesc}, interval=${config.exportIntervalMs}ms`
      );
    }

    return true;
  } catch (error) {
    // Don't fail the application if metrics fails to initialize
    if (process.env.DEBUG) {
      console.error('[Metrics] Failed to initialize:', error);
    }
    initialized = true;
    return false;
  }
}

/**
 * Shutdown metrics
 *
 * Should be called during application shutdown.
 * Note: The actual MeterProvider shutdown is handled by the NodeSDK.
 */
export async function shutdownMetrics(): Promise<void> {
  // Stop event loop lag measurement
  stopEventLoopLagMeasurement();

  // Force flush metrics through the global provider
  try {
    const provider = metrics.getMeterProvider();
    if (provider && 'forceFlush' in provider) {
      await (provider as { forceFlush: () => Promise<void> }).forceFlush();
    }
  } catch (error) {
    if (process.env.DEBUG) {
      console.error('[Metrics] Error during shutdown:', error);
    }
  }

  initialized = false;
}

/**
 * Check if metrics are currently enabled
 */
export function isMetricsEnabled(): boolean {
  const config = getMetricsConfig();
  return initialized && config.enabled && config.exporter !== 'none' && config.exporter !== 'zipkin';
}

/**
 * Get the current metrics configuration
 */
export function getMetricsConfigInternal(): MetricsConfig {
  return getMetricsConfig();
}
