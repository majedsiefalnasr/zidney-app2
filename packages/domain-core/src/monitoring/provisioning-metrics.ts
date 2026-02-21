/**
 * Monitoring & Metrics Configuration
 *
 * Defines metrics collection for schema provisioning engine:
 * - Request/response metrics
 * - Worker task metrics
 * - Latency percentiles
 * - Error rates
 * - DLQ metrics
 *
 * Integration points:
 * - Prometheus scraping (/metrics endpoint)
 * - Grafana dashboards (visualization)
 * - CloudWatch/Datadog (ops alerts)
 *
 * Test Coverage: T064-T066 (Monitoring, metrics, dashboard)
 * Stage: STAGE_02B_TENANT_BASELINE_SCHEMA
 */

import { createLogger } from '@zidney/logging'

const logger = createLogger('ProvisioningMetrics')

// ============================================================================
// METRIC DEFINITIONS
// ============================================================================

/**
 * Gauge: Current number of active provisioning requests
 * Unit: count
 * Labels: workspace_id
 */
export const METRIC_ACTIVE_REQUESTS = {
  name: 'schema_provisioning_active_requests_total',
  type: 'gauge',
  help: 'Number of active schema provisioning requests',
  labels: ['workspace_id', 'status'],
}

/**
 * Counter: Total provisioning requests received
 * Unit: count
 * Labels: workspace_id, result (success, conflict, license_error, version_error)
 */
export const METRIC_REQUESTS_TOTAL = {
  name: 'schema_provisioning_requests_total',
  type: 'counter',
  help: 'Total schema provisioning requests',
  labels: ['workspace_id', 'result'],
}

/**
 * Histogram: API endpoint latency (202 Accepted response time)
 * Unit: milliseconds
 * Buckets: 10, 50, 100, 500, 1000, 5000
 */
export const METRIC_API_LATENCY_MS = {
  name: 'schema_provisioning_api_latency_ms',
  type: 'histogram',
  help: 'API endpoint latency (time to 202 Accepted)',
  labels: ['workspace_id'],
  buckets: [10, 50, 100, 500, 1000, 5000],
}

/**
 * Counter: Worker tasks processed
 * Unit: count
 * Labels: result (success, retry, dlq, timeout)
 */
export const METRIC_WORKER_TASKS_TOTAL = {
  name: 'schema_initialization_worker_tasks_total',
  type: 'counter',
  help: 'Total worker tasks processed',
  labels: ['workspace_id', 'result'],
}

/**
 * Histogram: Worker task completion time (transaction execution)
 * Unit: milliseconds
 * Buckets: 100, 500, 1000, 5000, 10000, 30000
 */
export const METRIC_WORKER_DURATION_MS = {
  name: 'schema_initialization_worker_duration_ms',
  type: 'histogram',
  help: 'Worker task execution time',
  labels: ['workspace_id', 'status'],
  buckets: [100, 500, 1000, 5000, 10000, 30000],
}

/**
 * Counter: Idempotency cache hits/misses
 * Unit: count
 * Labels: hit_type (redis_hit, db_hit, cache_miss)
 */
export const METRIC_IDEMPOTENCY_CACHE = {
  name: 'schema_provisioning_idempotency_cache_total',
  type: 'counter',
  help: 'Idempotency cache hit/miss counts',
  labels: ['hit_type'],
}

/**
 * Counter: Retry attempts
 * Unit: count
 * Labels: attempt_number (1, 2, 3), reason (timeout, lock_timeout, etc.)
 */
export const METRIC_RETRIES_TOTAL = {
  name: 'schema_initialization_retries_total',
  type: 'counter',
  help: 'Total retry attempts',
  labels: ['workspace_id', 'attempt_number', 'reason'],
}

/**
 * Counter: DLQ escalations
 * Unit: count
 * Labels: reason (max_retries, tampering_detected, lock_timeout, critical_error)
 */
export const METRIC_DLQ_ESCALATIONS_TOTAL = {
  name: 'schema_initialization_dlq_escalations_total',
  type: 'counter',
  help: 'Tasks escalated to Dead Letter Queue',
  labels: ['workspace_id', 'reason'],
}

/**
 * Gauge: Current DLQ size
 * Unit: count
 */
export const METRIC_DLQ_SIZE = {
  name: 'schema_initialization_dlq_size',
  type: 'gauge',
  help: 'Current number of items in DLQ',
  labels: ['alert_level'],
}

/**
 * Gauge: Database connection pool utilization
 * Unit: percent (0-100)
 * Labels: workspace_id
 */
export const METRIC_POOL_UTILIZATION = {
  name: 'schema_initialization_pool_utilization_percent',
  type: 'gauge',
  help: 'Connection pool utilization percentage',
  labels: ['workspace_id'],
}

/**
 * Counter: Lock timeout events
 * Unit: count
 * Labels: workspace_id
 */
export const METRIC_LOCK_TIMEOUTS = {
  name: 'schema_initialization_lock_timeouts_total',
  type: 'counter',
  help: 'Number of lock timeout events (suspicious activity)',
  labels: ['workspace_id'],
}

/**
 * Counter: Tampering detection events (security)
 * Unit: count
 * Labels: workspace_id
 */
export const METRIC_TAMPERING_DETECTED = {
  name: 'schema_initialization_tampering_detected_total',
  type: 'counter',
  help: 'Number of tampering/corruption detection events',
  labels: ['workspace_id'],
}

/**
 * Histogram: Schema verification time
 * Unit: milliseconds (time to verify all 38+ tables exist)
 */
export const METRIC_SCHEMA_VERIFICATION_MS = {
  name: 'schema_initialization_verification_ms',
  type: 'histogram',
  help: 'Time to verify schema integrity',
  labels: ['workspace_id'],
  buckets: [50, 100, 500, 1000],
}

// ============================================================================
// METRIC COLLECTION HELPERS
// ============================================================================

export interface MetricsCollector {
  recordApiRequest(
    workspace_id: string,
    result:
      | 'success'
      | 'conflict'
      | 'license_error'
      | 'version_error'
      | 'error',
    latency_ms: number
  ): void

  recordWorkerTask(
    workspace_id: string,
    result: 'success' | 'retry' | 'dlq' | 'timeout',
    duration_ms: number,
    attempt_number: number
  ): void

  recordIdempotencyCache(hit_type: 'redis_hit' | 'db_hit' | 'cache_miss'): void

  recordRetry(
    workspace_id: string,
    attempt_number: number,
    reason: string
  ): void

  recordDLQEscalation(
    workspace_id: string,
    reason:
      | 'max_retries'
      | 'tampering_detected'
      | 'lock_timeout'
      | 'critical_error'
  ): void

  recordPoolUtilization(workspace_id: string, utilization_percent: number): void

  recordLockTimeout(workspace_id: string): void

  recordTamperingDetected(workspace_id: string): void

  recordSchemaVerification(workspace_id: string, duration_ms: number): void

  /**
   * Get current metrics snapshot (for testing/debugging)
   */
  getMetricsSnapshot(): Record<string, any>
}

/**
 * In-memory metrics collector (for testing)
 * In production: Use Prometheus client
 */
export class InMemoryMetricsCollector implements MetricsCollector {
  private metrics: Record<string, any> = {
    requests_total: {},
    api_latencies: [],
    worker_tasks: {},
    worker_durations: [],
    idempotency_cache: {},
    retries: {},
    dlq_escalations: {},
    pool_utilization: {},
    lock_timeouts: 0,
    tampering_detected: 0,
    schema_verifications: [],
  }

  recordApiRequest(
    workspace_id: string,
    result: string,
    latency_ms: number
  ): void {
    const key = `${workspace_id}:${result}`
    this.metrics.requests_total[key] =
      (this.metrics.requests_total[key] || 0) + 1
    this.metrics.api_latencies.push(latency_ms)

    logger.debug('API request recorded', {
      workspace_id,
      result,
      latency_ms,
    })
  }

  recordWorkerTask(
    workspace_id: string,
    result: string,
    duration_ms: number,
    attempt_number: number
  ): void {
    const key = `${workspace_id}:${result}`
    this.metrics.worker_tasks[key] = (this.metrics.worker_tasks[key] || 0) + 1
    this.metrics.worker_durations.push(duration_ms)

    logger.debug('Worker task recorded', {
      workspace_id,
      result,
      duration_ms,
      attempt: attempt_number,
    })
  }

  recordIdempotencyCache(hit_type: string): void {
    this.metrics.idempotency_cache[hit_type] =
      (this.metrics.idempotency_cache[hit_type] || 0) + 1

    logger.debug('Idempotency cache event', { hit_type })
  }

  recordRetry(
    workspace_id: string,
    attempt_number: number,
    reason: string
  ): void {
    const key = `${workspace_id}:${attempt_number}:${reason}`
    this.metrics.retries[key] = (this.metrics.retries[key] || 0) + 1

    logger.info('Retry recorded', {
      workspace_id,
      attempt: attempt_number,
      reason,
    })
  }

  recordDLQEscalation(workspace_id: string, reason: string): void {
    const key = `${workspace_id}:${reason}`
    this.metrics.dlq_escalations[key] =
      (this.metrics.dlq_escalations[key] || 0) + 1

    logger.warn('DLQ escalation recorded', {
      workspace_id,
      reason,
    })
  }

  recordPoolUtilization(
    workspace_id: string,
    utilization_percent: number
  ): void {
    this.metrics.pool_utilization[workspace_id] = utilization_percent

    if (utilization_percent > 80) {
      logger.warn('Pool utilization high', {
        workspace_id,
        utilization_percent,
      })
    }
  }

  recordLockTimeout(workspace_id: string): void {
    this.metrics.lock_timeouts++

    logger.error('Lock timeout event (suspicious activity)', {
      workspace_id,
      total_lock_timeouts: this.metrics.lock_timeouts,
    })
  }

  recordTamperingDetected(workspace_id: string): void {
    this.metrics.tampering_detected++

    logger.error('SECURITY: Tampering detected', {
      workspace_id,
      total_tampering_events: this.metrics.tampering_detected,
    })
  }

  recordSchemaVerification(workspace_id: string, duration_ms: number): void {
    this.metrics.schema_verifications.push(duration_ms)

    logger.debug('Schema verification recorded', {
      workspace_id,
      duration_ms,
    })
  }

  getMetricsSnapshot(): Record<string, any> {
    // Calculate percentiles
    const apiLatencies = this.metrics.api_latencies.sort((a, b) => a - b)
    const workerDurations = this.metrics.worker_durations.sort((a, b) => a - b)

    return {
      requests_total: this.metrics.requests_total,
      api_latency_p50: apiLatencies[Math.floor(apiLatencies.length * 0.5)],
      api_latency_p95: apiLatencies[Math.floor(apiLatencies.length * 0.95)],
      api_latency_p99: apiLatencies[Math.floor(apiLatencies.length * 0.99)],
      worker_tasks_total: this.metrics.worker_tasks,
      worker_duration_p95:
        workerDurations[Math.floor(workerDurations.length * 0.95)],
      idempotency_cache: this.metrics.idempotency_cache,
      retries_total: this.metrics.retries,
      dlq_escalations: this.metrics.dlq_escalations,
      lock_timeouts: this.metrics.lock_timeouts,
      tampering_events: this.metrics.tampering_detected,
      pool_utilization: this.metrics.pool_utilization,
    }
  }
}

// ============================================================================
// DASHBOARD CONFIGURATION
// ============================================================================

export const DASHBOARD_DEFINITION = {
  title: 'Schema Provisioning - Performance & Health',

  panels: [
    {
      title: 'Provisioning Success Rate (%)',
      type: 'gauge',
      metric: 'schema_provisioning_requests_total',
      query: `
        (
          sum(rate(schema_provisioning_requests_total{result="success"}[5m]))
          /
          sum(rate(schema_provisioning_requests_total[5m]))
        ) * 100
      `,
      targets: ['localhost:9090'],
      alert: {
        condition: '< 95',
        severity: 'warning',
      },
    },

    {
      title: 'API Latency (P95)',
      type: 'graph',
      metric: 'schema_provisioning_api_latency_ms',
      query: `
        histogram_quantile(0.95, rate(schema_provisioning_api_latency_ms_bucket[5m]))
      `,
      units: 'ms',
      alert: {
        condition: '> 500ms',
        severity: 'warning',
      },
    },

    {
      title: 'Worker Task Duration (P95)',
      type: 'graph',
      metric: 'schema_initialization_worker_duration_ms',
      query: `
        histogram_quantile(0.95, rate(schema_initialization_worker_duration_ms_bucket[5m]))
      `,
      units: 'ms',
      alert: {
        condition: '> 10000ms',
        severity: 'warning',
      },
    },

    {
      title: 'DLQ Escalations (24h)',
      type: 'counter',
      metric: 'schema_initialization_dlq_escalations_total',
      query: `
        sum(increase(schema_initialization_dlq_escalations_total[24h])) by (reason)
      `,
      alert: {
        condition: 'tampering_detected > 0',
        severity: 'critical',
      },
    },

    {
      title: 'Connection Pool Utilization (%)',
      type: 'gauge',
      metric: 'schema_initialization_pool_utilization_percent',
      query: `
        max(schema_initialization_pool_utilization_percent) by (workspace_id)
      `,
      alert: {
        condition: '> 90',
        severity: 'critical',
      },
    },

    {
      title: 'Lock Timeout Events (1h)',
      type: 'counter',
      metric: 'schema_initialization_lock_timeouts_total',
      query: `
        sum(increase(schema_initialization_lock_timeouts_total[1h]))
      `,
      alert: {
        condition: '> 5',
        severity: 'critical',
      },
    },

    {
      title: 'Tampering/Corruption Detection (1h)',
      type: 'counter',
      metric: 'schema_initialization_tampering_detected_total',
      query: `
        sum(increase(schema_initialization_tampering_detected_total[1h]))
      `,
      alert: {
        condition: '> 0',
        severity: 'critical',
      },
    },

    {
      title: 'Active Requests',
      type: 'gauge',
      metric: 'schema_provisioning_active_requests_total',
      query: `
        sum(schema_provisioning_active_requests_total) by (status)
      `,
    },

    {
      title: 'Retry Distribution (5m)',
      type: 'pie',
      metric: 'schema_initialization_retries_total',
      query: `
        sum(rate(schema_initialization_retries_total[5m])) by (attempt_number)
      `,
    },

    {
      title: 'Throughput (requests/sec)',
      type: 'graph',
      metric: 'schema_provisioning_requests_total',
      query: `
        sum(rate(schema_provisioning_requests_total[1m]))
      `,
      units: 'req/s',
    },
  ],

  alerts: [
    {
      name: 'HighDLQEscalations',
      condition:
        'sum(increase(schema_initialization_dlq_escalations_total[5m])) > 10',
      duration: '5m',
      severity: 'critical',
      annotation:
        'Schema initialization failures detected. Check DLQ and investigate root cause.',
    },

    {
      name: 'TamperingDetected',
      condition: 'schema_initialization_tampering_detected_total > 0',
      duration: '1m',
      severity: 'critical',
      annotation:
        'SECURITY: Schema tampering or corruption detected. Immediate investigation required.',
    },

    {
      name: 'PoolExhaustion',
      condition: 'schema_initialization_pool_utilization_percent > 95',
      duration: '2m',
      severity: 'critical',
      annotation:
        'Connection pool near exhaustion. Scale pool or reduce concurrent loads.',
    },

    {
      name: 'HighAPILatency',
      condition:
        'histogram_quantile(0.95, schema_provisioning_api_latency_ms_bucket) > 1000',
      duration: '5m',
      severity: 'warning',
      annotation: 'API latency elevated. Check database performance.',
    },
  ],
}

// ============================================================================
// PROMETHEUS SCRAPE CONFIG
// ============================================================================

export const PROMETHEUS_SCRAPE_CONFIG = {
  job_name: 'schema-provisioning',
  static_configs: [
    {
      targets: ['localhost:9090'],
    },
  ],
  scrape_interval: '15s',
  scrape_timeout: '10s',
  metrics_path: '/metrics',
}

// ============================================================================
// DATADOG/CLOUDWATCH INTEGRATION
// ============================================================================

export const CLOUDWATCH_NAMESPACE = 'Zidney/SchemaProvisioning'

export const CLOUDWATCH_METRICS = [
  {
    name: 'APIRequestsTotal',
    unit: 'Count',
    dimensions: ['WorkspaceId', 'Result'],
  },
  {
    name: 'APILatency',
    unit: 'Milliseconds',
    statistic: ['p50', 'p95', 'p99'],
    dimensions: ['WorkspaceId'],
  },
  {
    name: 'WorkerTasksTotal',
    unit: 'Count',
    dimensions: ['WorkspaceId', 'Result'],
  },
  {
    name: 'DLQEscalations',
    unit: 'Count',
    dimensions: ['WorkspaceId', 'Reason'],
  },
  {
    name: 'PoolUtilization',
    unit: 'Percent',
    dimensions: ['WorkspaceId'],
  },
  {
    name: 'TamperingDetected',
    unit: 'Count',
    dimensions: ['WorkspaceId'],
  },
]

export default {
  DASHBOARD_DEFINITION,
  PROMETHEUS_SCRAPE_CONFIG,
  CLOUDWATCH_NAMESPACE,
  CLOUDWATCH_METRICS,
  InMemoryMetricsCollector,
}
