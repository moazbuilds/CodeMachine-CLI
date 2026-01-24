/**
 * Exporter Factory
 *
 * Creates the appropriate SpanExporter based on configuration.
 * Note: Console exporter is intentionally not supported (would corrupt TUI rendering)
 */

import type { SpanExporter } from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { ZipkinExporter } from '@opentelemetry/exporter-zipkin';
import type { ExporterType, TracingConfig } from '../config.js';
import { FileSpanExporter } from './file.js';

/**
 * No-op exporter that discards all spans
 */
class NoopSpanExporter implements SpanExporter {
  export(_spans: unknown[], resultCallback: (result: { code: number }) => void): void {
    resultCallback({ code: 0 }); // SUCCESS
  }

  async shutdown(): Promise<void> {
    // No-op
  }

  async forceFlush(): Promise<void> {
    // No-op
  }
}

/**
 * Create a span exporter based on the exporter type
 */
export function createExporter(config: TracingConfig): SpanExporter {
  const type: ExporterType = config.exporter;

  switch (type) {
    case 'file':
      return new FileSpanExporter(config.tracesDir);

    case 'otlp':
      return new OTLPTraceExporter({
        url: config.otlpEndpoint,
        headers: {},
      });

    case 'zipkin':
      return new ZipkinExporter({
        url: config.zipkinEndpoint,
        serviceName: config.serviceName,
      });

    case 'none':
      return new NoopSpanExporter();

    default:
      // Default to file exporter
      return new FileSpanExporter(config.tracesDir);
  }
}

/**
 * Get a human-readable description of the exporter
 */
export function getExporterDescription(type: ExporterType, config: TracingConfig): string {
  switch (type) {
    case 'file':
      return `File (${config.tracesDir})`;
    case 'otlp':
      return `OTLP (${config.otlpEndpoint})`;
    case 'zipkin':
      return `Zipkin (${config.zipkinEndpoint})`;
    case 'none':
      return 'None (disabled)';
    default:
      return 'Unknown';
  }
}
