/**
 * File Metric Exporter
 *
 * Custom PushMetricExporter that writes metrics to JSON files.
 * Used for offline analysis and debugging.
 */

import {
  PushMetricExporter,
  ResourceMetrics,
  AggregationTemporality,
  InstrumentType,
} from '@opentelemetry/sdk-metrics';
import { ExportResult, ExportResultCode } from '@opentelemetry/core';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Serialized metric data point for JSON export
 */
export interface SerializedMetricDataPoint {
  attributes: Record<string, unknown>;
  value: number;
  startTime: string;
  endTime: string;
}

/**
 * Serialized metric for JSON export
 */
export interface SerializedMetric {
  name: string;
  description: string;
  unit: string;
  type: string;
  dataPoints: SerializedMetricDataPoint[];
}

/**
 * Serialized scope metrics for JSON export
 */
export interface SerializedScopeMetrics {
  scope: {
    name: string;
    version?: string;
  };
  metrics: SerializedMetric[];
}

/**
 * Serialized resource metrics for JSON export
 */
export interface SerializedResourceMetrics {
  resource: Record<string, unknown>;
  scopeMetrics: SerializedScopeMetrics[];
}

/**
 * Convert HrTime to ISO string
 */
function hrTimeToISOString(hrTime: [number, number]): string {
  const ms = hrTime[0] * 1000 + hrTime[1] / 1_000_000;
  return new Date(ms).toISOString();
}

/**
 * Get the data point value based on metric type
 */
function getDataPointValue(dataPoint: unknown): number {
  const dp = dataPoint as {
    value?: number;
    sum?: number;
    count?: number;
  };

  // For Gauge and Sum instruments
  if (typeof dp.value === 'number') {
    return dp.value;
  }
  // For Histogram instruments (use sum as representative value)
  if (typeof dp.sum === 'number') {
    return dp.sum;
  }
  return 0;
}

/**
 * FileMetricExporter writes metrics to JSON files in a specified directory.
 *
 * File structure:
 * - metrics/latest-metrics.json - Most recent metrics file (overwritten)
 * - metrics/YYYY-MM-DD/HH-MM-SS-metrics.json - Timestamped files
 */
export class FileMetricExporter implements PushMetricExporter {
  private tracesDir: string;
  private sessionFile: string;
  private metricsHistory: SerializedResourceMetrics[] = [];
  private maxHistorySize = 100;

  constructor(tracesDir: string) {
    this.tracesDir = tracesDir;

    // Ensure traces directory exists
    if (!existsSync(this.tracesDir)) {
      mkdirSync(this.tracesDir, { recursive: true });
    }

    // Create session file path
    const now = new Date();
    const dateDir = join(this.tracesDir, now.toISOString().split('T')[0]); // YYYY-MM-DD

    if (!existsSync(dateDir)) {
      mkdirSync(dateDir, { recursive: true });
    }

    const timeStr = now.toISOString().split('T')[1].replace(/:/g, '-').split('.')[0];
    this.sessionFile = join(dateDir, `${timeStr}-metrics.json`);
  }

  /**
   * Export metrics to file
   */
  export(metrics: ResourceMetrics, resultCallback: (result: ExportResult) => void): void {
    try {
      const serialized = this.serializeResourceMetrics(metrics);
      this.metricsHistory.push(serialized);

      // Trim history if too large
      if (this.metricsHistory.length > this.maxHistorySize) {
        this.metricsHistory = this.metricsHistory.slice(-this.maxHistorySize);
      }

      // Write to session file
      this.writeToFile();

      // Update latest-metrics.json
      this.updateLatest();

      resultCallback({ code: ExportResultCode.SUCCESS });
    } catch (error) {
      resultCallback({
        code: ExportResultCode.FAILED,
        error: error as Error,
      });
    }
  }

  /**
   * Serialize ResourceMetrics to JSON-friendly format
   */
  private serializeResourceMetrics(resourceMetrics: ResourceMetrics): SerializedResourceMetrics {
    return {
      resource: { ...resourceMetrics.resource.attributes },
      scopeMetrics: resourceMetrics.scopeMetrics.map(scopeMetric => ({
        scope: {
          name: scopeMetric.scope.name,
          version: scopeMetric.scope.version,
        },
        metrics: scopeMetric.metrics.map(metric => ({
          name: metric.descriptor.name,
          description: metric.descriptor.description,
          unit: metric.descriptor.unit,
          type: metric.dataPointType.toString(),
          dataPoints: metric.dataPoints.map(dp => ({
            attributes: { ...dp.attributes },
            value: getDataPointValue(dp),
            startTime: hrTimeToISOString(dp.startTime),
            endTime: hrTimeToISOString(dp.endTime),
          })),
        })),
      })),
    };
  }

  /**
   * Write accumulated metrics to the session file
   */
  private writeToFile(): void {
    const data = {
      version: 1,
      service: 'codemachine',
      type: 'metrics',
      exportedAt: new Date().toISOString(),
      exportCount: this.metricsHistory.length,
      metrics: this.metricsHistory,
    };

    writeFileSync(this.sessionFile, JSON.stringify(data, null, 2));
  }

  /**
   * Update the latest-metrics.json file with current session data
   */
  private updateLatest(): void {
    const latestPath = join(this.tracesDir, 'latest-metrics.json');
    const data = {
      version: 1,
      service: 'codemachine',
      type: 'metrics',
      exportedAt: new Date().toISOString(),
      sessionFile: this.sessionFile,
      exportCount: this.metricsHistory.length,
      metrics: this.metricsHistory,
    };

    writeFileSync(latestPath, JSON.stringify(data, null, 2));
  }

  /**
   * Select aggregation temporality for instrument types
   */
  selectAggregationTemporality(instrumentType: InstrumentType): AggregationTemporality {
    // Use cumulative for all instruments (simpler for file export)
    return AggregationTemporality.CUMULATIVE;
  }

  /**
   * Force flush any pending metrics
   */
  async forceFlush(): Promise<void> {
    if (this.metricsHistory.length > 0) {
      this.writeToFile();
      this.updateLatest();
    }
  }

  /**
   * Shutdown the exporter
   */
  async shutdown(): Promise<void> {
    await this.forceFlush();
  }

  /**
   * Get the current session file path
   */
  getSessionFilePath(): string {
    return this.sessionFile;
  }

  /**
   * Get the latest-metrics.json file path
   */
  getLatestFilePath(): string {
    return join(this.tracesDir, 'latest-metrics.json');
  }
}
