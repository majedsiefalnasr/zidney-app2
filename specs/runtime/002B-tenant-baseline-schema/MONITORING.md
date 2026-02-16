# Monitoring & Observability Guide

**Version**: 1.0.0  
**Stage**: STAGE_02B_TENANT_BASELINE_SCHEMA  
**Date**: 2026-02-16

## Table of Contents

1. [Metrics Overview](#metrics-overview)
2. [Key Indicators](#key-indicators)
3. [Dashboards](#dashboards)
4. [Alerting Rules](#alerting-rules)
5. [Troubleshooting](#troubleshooting)

---

## Metrics Overview

### Metric Collection

**Service**: Prometheus time-series database  
**Retention**: 15 days (real-time), 1 year (archived)  
**Scrape Interval**: 15 seconds  
**Resolution**: 1-second precision

### Metric Types

| Type      | Purpose          | Example                             |
| --------- | ---------------- | ----------------------------------- |
| Counter   | Cumulative count | `schema_initialization_total`       |
| Gauge     | Current value    | `migration_in_progress`             |
| Histogram | Distribution     | `schema_initialization_duration_ms` |
| Summary   | Percentiles      | `attempt_submission_latency_p99_ms` |

---

## Key Indicators

### Schema Initialization Metrics

```
schema_initialization_total
  Labels: workspace_id, status (success|failure|retry)
  Example: schema_initialization_total{workspace_id="ws-123", status="success"} 5

schema_initialization_duration_ms
  Type: Histogram
  Buckets: 100ms, 500ms, 1s, 5s, 10s
  Example: schema_initialization_duration_ms_bucket{le="5000"} 45

schema_initialization_failures_total
  Type: Counter
  Labels: workspace_id, reason (timeout|checksum|permission)
  Example: schema_initialization_failures_total{reason="checksum"} 1
```

### Migration Metrics

```
migration_in_progress
  Type: Gauge (0-1)
  Labels: workspace_id
  Example: migration_in_progress{workspace_id="ws-456"} 0

migration_total
  Type: Counter
  Labels: workspace_id, from_version, to_version, status
  Example: migration_total{status="success"} 23

migration_duration_ms
  Type: Histogram
  Buckets: 500ms, 1s, 5s, 10s, 30s, 60s
  Example: migration_duration_ms_bucket{le="30000"} 18

migration_failures_total
  Type: Counter
  Labels: reason (lock_timeout|tampering|statement_timeout)
  Example: migration_failures_total{reason="lock_timeout"} 1
```

### Database Health Metrics

```
db_connections_active
  Type: Gauge
  Labels: workspace_id
  Example: db_connections_active{workspace_id="ws-789"} 6

db_query_duration_ms
  Type: Histogram
  Labels: query_type (SELECT|INSERT|UPDATE)
  Example: db_query_duration_ms{query_type="SELECT", le="100"} 450

db_lock_waits_total
  Type: Counter
  Labels: table_name
  Example: db_lock_waits_total{table_name="schema_version"} 0
```

### Application Metrics

```
api_requests_total
  Type: Counter
  Labels: endpoint, method, status_code
  Example: api_requests_total{endpoint="/schema/initialize", status_code="202"} 100

api_latency_ms
  Type: Histogram
  Labels: endpoint
  Percentiles: p50, p95, p99
  Example: api_latency_ms{endpoint="/schema/initialize", quantile="0.99"} 250

worker_tasks_processed_total
  Type: Counter
  Labels: task_type, status (success|retry|dlq)
  Example: worker_tasks_processed_total{task_type="INIT_TENANT_SCHEMA", status="success"} 500
```

---

## Dashboards

### Grafana Dashboards

#### Dashboard 1: Tenancy Status Overview

**URL**: `http://grafana.local:3000/d/tenancy-status`

**Metrics**:

- Workspaces initialized (gauge)
- Schema versions distribution (pie chart)
- Recent failures (table)
- Initialization success rate (stat)

```
[Workspaces]      [Schema Versions]      [Init Rate]
  1,245            v1.0.0: 1,100          99.8%
                   v1.1.0:   145

[Recent Failures]
workspace_id | reason | time_ago
ws-123       | timeout | 2h
ws-456       | conn    | 24h
```

#### Dashboard 2: Migration Monitoring

**URL**: `http://grafana.local:3000/d/migration-mtg`

**Metrics**:

- Migrations in-flight (gauge)
- Migration success rate (trend)
- Duration (p50/p95/p99 - line graph)
- DLQ items pending (counter)

```
[In-Flight]  [Success Rate]  [Duration (ms)]
    2            99.5%        p50=200, p95=450, p99=800

[DLQ Items]
task_id | reason | age | workspace
mt-001 | lock_timeout | 3h | ws-789
mt-002 | checksum | 1h | ws-101
```

#### Dashboard 3: Database Performance

**URL**: `http://grafana.local:3000/d/db-perf`

**Metrics**:

- Active connections (gauge per workspace)
- Query latency (histogram)
- Lock waits (time series)
- Top slow queries (table)

```
[Active Connections]           [Query Latency (ms)]
ws-acme: 6/10 (yellow)         SELECT: p99=150
ws- demo: 2/10 (green)         INSERT: p99=250
ws-state: 8/10 (red)           UPDATE: p99=400

[Lock Waits]
schema_version wait: 0
attempts wait: 2 (elevated!)
```

---

## Alerting Rules

### Critical Alerts (Page On-Call)

| Alert                            | Condition                            | Action              |
| -------------------------------- | ------------------------------------ | ------------------- |
| **Tampering Detected**           | checksum_mismatch > 0                | Page Security + DBA |
| **Schema Init Failure**          | initialization_failures > 10 in 5min | Page Engineer       |
| **DLQ Exceeds Threshold**        | dlq_pending_items > 50               | Page Engineer       |
| **DB Connection Pool Exhausted** | active_connections >= 10 for 5min    | Page DBA            |

### Example Prometheus Alert Rules

```yaml
groups:
  - name: zidney_schema
    rules:
      # CRITICAL: Tampering detected
      - alert: ChecksumMismatchDetected
        expr: increase(migration_failures_total{reason="tampering"}[5m]) > 0
        for: 1m
        labels:
          severity: critical
          team: security
        annotations:
          summary: 'Migration tampering detected!'
          description: 'Workspace {{ $labels.workspace_id }} failed checksum validation'

      # WARNING: Migration stuck
      - alert: MigrationTimeout
        expr: migration_in_progress{workspace_id!=""} == 1 AND (time() - migration_start_time) > 600
        for: 5m
        labels:
          severity: warning
          team: database
        annotations:
          summary: 'Migration stuck for > 10min'
          description: 'Workspace {{ $labels.workspace_id }} migration timeout'

      # WARNING: High initialization failure rate
      - alert: HighInitFailureRate
        expr: (increase(schema_initialization_failures_total[5m]) / increase(schema_initialization_total[5m])) > 0.1
        for: 5m
        labels:
          severity: warning
          team: platform
        annotations:
          summary: 'Schema initialization failure rate > 10%'

      # INFO: DLQ pending review
      - alert: DLQPendingReview
        expr: dlq_pending_count > 0
        for: 10m
        labels:
          severity: info
          team: platform
        annotations:
          summary: '{{ $value }} items pending in DLQ'
```

---

## Structured Logging

### Log Format (JSON)

All services emit structured logs:

```json
{
  "timestamp": "2026-02-16T10:15:30.123Z",
  "level": "INFO",
  "service": "schema-controller",
  "correlation_id": "req-abc123",
  "workspace_id": "ws-456",
  "workspace_slug": "acme-university",
  "user_id": "user-789",
  "action": "schema_initialize",
  "table": "attempts",
  "rows_affected": 0,
  "duration_ms": 45,
  "status": "success"
}
```

### Log Levels

| Level     | When                 | Example                                   |
| --------- | -------------------- | ----------------------------------------- |
| **ERROR** | Operation failed     | Initialization failed, migration rollback |
| **WARN**  | Degraded performance | Slow query, connection pool near limit    |
| **INFO**  | Normal operations    | Schema initialized, migration started     |
| **DEBUG** | Detailed debugging   | SQL statement executed, lock acquired     |

### Log Routing

```
ELK Stack:
- Elasticsearch: Indexing and retention
- Logstash: Aggregation from all services
- Kibana: Search, dashboards, alerts

Retention:
- Recent logs: 7 days (hot index)
- Archive: 90 days (warm index)
- Long-term: 2 years (cold storage)
```

### Kibana Saved Searches

1. **Recent Errors**

   ```
   level: ERROR AND service: schema-*
   Last 24 hours, sorted by timestamp desc
   ```

2. **Slow Migrations**

   ```
   action: migration AND duration_ms > 10000
   Last 7 days
   ```

3. **Checksum Mismatches**
   ```
   action: migrate AND status: tampering_detected
   All time
   ```

---

## Health Check Endpoints

### API Health

```bash
curl -s http://api.local:3000/health | jq .

{
  "status": "healthy",
  "timestamp": "2026-02-16T10:30:00Z",
  "services": {
    "api": "ok",
    "database_master": "ok",
    "redis": "ok",
    "worker": "ok"
  }
}
```

### Per-Workspace Health

```bash
curl -s http://api.local:3000/api/workspaces/{id}/health | jq .

{
  "workspace_id": "ws-456",
  "schema_version": "1.0.0",
  "connection_pool_usage": "6/10",
  "last_schema_init": "2026-02-16T08:00:00Z",
  "metrics": {
    "attempts_today": 234,
    "migrations_pending": 0,
    "errors_24h": 0
  }
}
```

---

## Troubleshooting

### Symptom: High Database CPU

**Diagnosis**:

```bash
# Top slow queries
SELECT query, calls, mean_time FROM pg_stat_statements
ORDER BY mean_time DESC LIMIT 10;

# Check missing indexes
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes WHERE idx_scan = 0;
```

**Solution**:

- Create index on frequently filtered column
- Scale database instance vertically
- Archive old data

### Symptom: Initializion Timeouts

**Diagnosis**:

```
migration_in_progress gauge stuck at 1
```

**Solution**:

```bash
# 1. Check if lock is held
SELECT pid, usename, query, state_change FROM pg_stat_activity
WHERE state = 'active' AND state_change < NOW() - '5 minutes'::interval;

# 2. Terminate if necessary
SELECT pg_terminate_backend(${pid});

# 3. Retry initialization
curl -X POST http://api.local:3000/api/workspaces/{id}/schema/initialize
```

### Symptom: DLQ Growing

**Diagnosis**:

```bash
redis-cli KEYS "dlq:*" | wc -l
# If > 50, DLQ has backlog
```

**Investigation**:

```bash
# Get most recent DLQ item
redis-cli GET dlq:$(redis-cli KEYS "dlq:*" | sort -r | head -1)

# Check reason field for pattern
cat dlq_items.json | jq '.reason' | sort | uniq -c
```

---

## Performance Baseline

**Target Metrics**:
| Operation | Target | Alert Threshold |
| --- | --- | --- |
| Schema init | < 5s | > 30s |
| Migration | < 10s | > 60s |
| API latency (p99) | < 200ms | > 1000ms |
| DB query (p99) | < 100ms | > 500ms |
| Connection pool usage | < 8/10 | > 9/10 |

**Recommended Scaling**:

- 1-100 workspaces: db.t4.small (2 vCPU, 4GB RAM)
- 100-500 workspaces: db.r5.large (2 vCPU, 16GB RAM)
- 500+ workspaces: db.r5.xlarge+ (4+ vCPU, 32+ GB RAM)

---

## Reference

- **Operations**: See [OPERATIONS_GUIDE.md](./OPERATIONS_GUIDE.md)
- **Backup/Recovery**: See [BACKUP_RECOVERY.md](./BACKUP_RECOVERY.md)
- **Schema**: See [SCHEMA_BASELINE.md](./SCHEMA_BASELINE.md)
