/**
 * Process Metrics
 *
 * Collects process-level metrics using observable callbacks:
 * - Memory: heap used, heap total, RSS, external
 * - CPU: user time, system time
 * - Event loop: lag (latency)
 * - Process: uptime
 *
 * Observable callbacks are efficient: metrics computed only at export time.
 */

import type { Meter, ObservableResult } from '@opentelemetry/api';

/**
 * Event loop lag tracking state
 */
let eventLoopLag = 0;
let lastLagCheck = performance.now();
let lagCheckInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Start event loop lag measurement
 *
 * Uses setInterval timing drift to detect event loop blocking.
 * The technique: schedule a callback for N ms from now, then measure
 * how much later it actually fires. The difference is the lag.
 */
function startEventLoopLagMeasurement(): void {
  if (lagCheckInterval) return;

  const checkIntervalMs = 1000; // Check every second

  lagCheckInterval = setInterval(() => {
    const now = performance.now();
    const expected = checkIntervalMs;
    const actual = now - lastLagCheck;
    eventLoopLag = Math.max(0, actual - expected);
    lastLagCheck = now;
  }, checkIntervalMs);

  // Don't keep the process running just for metrics
  lagCheckInterval.unref();
}

/**
 * Stop event loop lag measurement
 */
export function stopEventLoopLagMeasurement(): void {
  if (lagCheckInterval) {
    clearInterval(lagCheckInterval);
    lagCheckInterval = null;
  }
}

/**
 * Register all process metrics on the given meter
 *
 * @param meter - The meter to register metrics on
 */
export function registerProcessMetrics(meter: Meter): void {
  // Start event loop lag measurement
  startEventLoopLagMeasurement();

  // ========================================
  // Memory Metrics
  // ========================================

  meter
    .createObservableGauge('process.memory.heap_used', {
      description: 'Process heap memory used',
      unit: 'bytes',
    })
    .addCallback((result: ObservableResult) => {
      const mem = process.memoryUsage();
      result.observe(mem.heapUsed);
    });

  meter
    .createObservableGauge('process.memory.heap_total', {
      description: 'Process total heap memory allocated',
      unit: 'bytes',
    })
    .addCallback((result: ObservableResult) => {
      const mem = process.memoryUsage();
      result.observe(mem.heapTotal);
    });

  meter
    .createObservableGauge('process.memory.rss', {
      description: 'Process resident set size (total memory allocated)',
      unit: 'bytes',
    })
    .addCallback((result: ObservableResult) => {
      const mem = process.memoryUsage();
      result.observe(mem.rss);
    });

  meter
    .createObservableGauge('process.memory.external', {
      description: 'Memory used by C++ objects bound to JavaScript',
      unit: 'bytes',
    })
    .addCallback((result: ObservableResult) => {
      const mem = process.memoryUsage();
      result.observe(mem.external);
    });

  // ========================================
  // CPU Metrics
  // ========================================

  meter
    .createObservableGauge('process.cpu.user', {
      description: 'User CPU time',
      unit: 'us', // microseconds
    })
    .addCallback((result: ObservableResult) => {
      const cpu = process.cpuUsage();
      result.observe(cpu.user);
    });

  meter
    .createObservableGauge('process.cpu.system', {
      description: 'System CPU time',
      unit: 'us', // microseconds
    })
    .addCallback((result: ObservableResult) => {
      const cpu = process.cpuUsage();
      result.observe(cpu.system);
    });

  // ========================================
  // Event Loop Metrics
  // ========================================

  meter
    .createObservableGauge('process.eventloop.lag', {
      description: 'Event loop lag (delay between scheduled and actual callback execution)',
      unit: 'ms',
    })
    .addCallback((result: ObservableResult) => {
      result.observe(eventLoopLag);
    });

  // ========================================
  // Process Info Metrics
  // ========================================

  meter
    .createObservableGauge('process.uptime', {
      description: 'Process uptime',
      unit: 's', // seconds
    })
    .addCallback((result: ObservableResult) => {
      result.observe(process.uptime());
    });
}
