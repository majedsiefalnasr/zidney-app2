/**
 * Performance Profiler Utility
 *
 * Purpose: Extract performance measurement and statistics utilities
 * Used by: infra-audit, ai-guard, type-safety-guard, architecture-diff, validate-architecture-brain
 *
 * Provides:
 * - Execution timing measurement
 * - Statistical analysis (percentiles, mean, std-dev)
 * - Performance reporting
 * @library-module
 */

export interface TimeMeasurement {
  name: string
  durationMs: number
  timestamp: number
}

export interface PerformanceStats {
  name: string
  runs: number
  totalMs: number
  meanMs: number
  minMs: number
  maxMs: number
  medianMs: number
  p95Ms: number
  p99Ms: number
  stdDevMs: number
  measurements: TimeMeasurement[]
}

/**
 * Simple performance timer
 */
export class Timer {
  private startTime: number = 0
  private measurements: number[] = []

  constructor(private name: string = 'default') {}

  start(): void {
    this.startTime = performance.now()
  }

  end(): number {
    const elapsed = performance.now() - this.startTime
    this.measurements.push(elapsed)
    return elapsed
  }

  getMeasurements(): number[] {
    return [...this.measurements]
  }

  getStats(): PerformanceStats {
    const measurements = this.measurements.sort((a, b) => a - b)

    return {
      name: this.name,
      runs: measurements.length,
      totalMs: measurements.reduce((a, b) => a + b, 0),
      meanMs: measurements.reduce((a, b) => a + b, 0) / measurements.length,
      minMs: measurements[0] || 0,
      maxMs: measurements[measurements.length - 1] || 0,
      medianMs: calculatePercentile(measurements, 0.5),
      p95Ms: calculatePercentile(measurements, 0.95),
      p99Ms: calculatePercentile(measurements, 0.99),
      stdDevMs: calculateStdDev(measurements),
      measurements: measurements.map((duration, index) => ({
        name: `${this.name}-${index}`,
        durationMs: duration,
        timestamp: Date.now(),
      })),
    }
  }

  reset(): void {
    this.measurements = []
  }
}

/**
 * Calculate percentile from sorted array
 */
export function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0

  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.ceil((percentile * sorted.length) / 100) - 1
  return sorted[Math.max(0, index)]
}

/**
 * Calculate standard deviation
 */
export function calculateStdDev(values: number[]): number {
  if (values.length < 2) return 0

  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance = values.reduce((acc, val) => acc + (val - mean) ** 2, 0) / values.length
  return Math.sqrt(variance)
}

/**
 * Measure function execution time
 */
export async function measureAsync<T>(
  _name: string,
  fn: () => Promise<T>
): Promise<{ result: T; durationMs: number }> {
  const start = performance.now()
  const result = await fn()
  const durationMs = performance.now() - start
  return { result, durationMs }
}

/**
 * Measure synchronous function execution time
 */
export function measureSync<T>(_name: string, fn: () => T): { result: T; durationMs: number } {
  const start = performance.now()
  const result = fn()
  const durationMs = performance.now() - start
  return { result, durationMs }
}

/**
 * Format performance stats for display
 */
export function formatStats(stats: PerformanceStats): string {
  const lines: string[] = [
    `Performance Stats: ${stats.name}`,
    `Runs: ${stats.runs}`,
    `Mean: ${stats.meanMs.toFixed(2)}ms`,
    `Median: ${stats.medianMs.toFixed(2)}ms`,
    `Min: ${stats.minMs.toFixed(2)}ms`,
    `Max: ${stats.maxMs.toFixed(2)}ms`,
    `StdDev: ${stats.stdDevMs.toFixed(2)}ms`,
    `P95: ${stats.p95Ms.toFixed(2)}ms`,
    `P99: ${stats.p99Ms.toFixed(2)}ms`,
  ]

  return lines.join('\n')
}

/**
 * Compare performance stats
 */
export function compareStats(before: PerformanceStats, after: PerformanceStats): string {
  const meanChange = ((after.meanMs - before.meanMs) / before.meanMs) * 100
  const p95Change = ((after.p95Ms - before.p95Ms) / before.p95Ms) * 100

  const lines: string[] = [
    `Performance Comparison: ${before.name} vs ${after.name}`,
    `Mean: ${before.meanMs.toFixed(2)}ms → ${after.meanMs.toFixed(2)}ms (${meanChange > 0 ? '+' : ''}${meanChange.toFixed(1)}%)`,
    `P95: ${before.p95Ms.toFixed(2)}ms → ${after.p95Ms.toFixed(2)}ms (${p95Change > 0 ? '+' : ''}${p95Change.toFixed(1)}%)`,
  ]

  return lines.join('\n')
}

/**
 * Check if performance meets target
 */
export function meetsTarget(
  stats: PerformanceStats,
  targetMs: number,
  percentile: 'mean' | 'p95' | 'p99' = 'p95'
): boolean {
  const value =
    percentile === 'mean' ? stats.meanMs : percentile === 'p95' ? stats.p95Ms : stats.p99Ms

  return value <= targetMs
}

/**
 * Get performance health status
 */
export function getHealthStatus(
  stats: PerformanceStats,
  targetMs: number
): 'PASS' | 'WARN' | 'FAIL' {
  const p95Value = stats.p95Ms
  const tolerance = targetMs * 1.1 // 10% tolerance

  if (p95Value <= targetMs) {
    return 'PASS'
  }
  if (p95Value <= tolerance) {
    return 'WARN'
  }
  return 'FAIL'
}

export interface TimeMeasurement {
  name: string
  durationMs: number
  timestamp: number
}

export interface PerformanceStats {
  name: string
  runs: number
  totalMs: number
  meanMs: number
  minMs: number
  maxMs: number
  medianMs: number
  p95Ms: number
  p99Ms: number
  stdDevMs: number
  measurements: TimeMeasurement[]
}
