# Monitoring and Healthchecks

Phase: DevOps & Operational Safety  
Scope: Runtime health validation, observability baseline, and failure alerting

This document defines the minimum monitoring and health guarantees required before production
deployment.

---

## Health Endpoints

The backend must expose the following endpoints:

### GET /health

Purpose: Basic liveness probe for container orchestration.

Must return:

- HTTP 200 if process is alive
- No external dependency checks
- Response body:
  - status: "ok"
  - uptime_seconds

This endpoint is used by Docker and reverse proxy health checks.

---

### GET /health/ready

Purpose: Readiness probe for infrastructure validation.

Must validate:

- master_db connection
- Redis connection
- ability to resolve at least one tenant
- ability to acquire tenant DB connection
- schema_version compatibility check

If any dependency fails:

- Return HTTP 503
- Include failure reason (non-sensitive)

---

### GET /health/tenant/:slug

Purpose: Tenant-specific runtime validation.

Must validate:

- tenant exists
- license not DELETED
- license not ARCHIVED
- schema_version compatible
- DB connection operational

If tenant invalid:

- Return 404 / 403 / 426 accordingly

---

## Structured Logging Standard

Logging must use structured JSON format (Pino).

All logs must include:

- timestamp
- level
- request_id
- workspace_slug (if workspace-bound)
- workspace_id (if resolved)
- user_id (if authenticated)
- attempt_id (if runtime-bound)
- route
- method
- response_status
- duration_ms

Logs must never include:

- passwords
- tokens
- DB credentials
- raw student answers
- sensitive PII

All logs must be machine-parsable.

---

## Correlation and Trace Rules

Every incoming request must:

- Generate or propagate request_id
- Attach request_id to response headers
- Propagate request_id to worker jobs

Attempt runtime must:

- Attach attempt_id to logs
- Attach attempt_id to grading logs
- Attach attempt_id to submission logs

No anonymous runtime log entries allowed.

---

## Metrics Collection

Minimum metrics required:

- request_count
- request_latency
- error_rate
- active_connections_per_tenant
- redis_queue_depth
- worker_job_failures
- attempt_start_rate
- attempt_submit_rate

Metrics must support Prometheus format (future-ready).

---

## Alert Conditions

Critical alerts:

- master_db unavailable
- Redis unavailable
- tenant DB connection failure
- schema_version mismatch detected
- snapshot operation failure
- worker crash loop

Performance alerts:

- Memory usage > 85%
- CPU usage > 85%
- Request latency > defined threshold
- Error rate spike
- Redis queue backlog growth

Alerts must include:

- workspace_slug (if tenant-specific)
- timestamp
- error classification

---

## Snapshot Monitoring

For archive operations:

System must log:

- snapshot_id
- workspace_slug
- snapshot_timestamp
- snapshot_size
- snapshot_status

Snapshot failures must trigger critical alert.

---

## License State Monitoring

System must detect and log:

- SOFT_LOCK expiration crossing
- Automatic ARCHIVE transition
- Invalid schema_version
- Incompatible product_version

No silent transitions allowed.

---

## Worker Monitoring

Worker must:

- Emit heartbeat logs
- Emit job start/end logs
- Emit retry attempts
- Emit dead-letter movement

Worker failure must:

- Trigger alert if retry threshold exceeded
- Log job payload reference (not full payload)

---

## Log Retention Policy

Development:

- 7 days minimum

Production:

- 30 days minimum

Snapshot logs:

- Retained permanently or until snapshot deleted

---

## Health Validation Criteria

Monitoring stage is complete when:

- /health returns 200
- /health/ready fails correctly when DB down
- Logs include request_id
- Logs include workspace_slug for tenant requests
- Worker logs job lifecycle
- Alert conditions defined
- Schema mismatch triggers readiness failure
- Snapshot failure logged and alerted

No production deployment allowed without:

- Health endpoints functional
- Structured logging active
- Alert conditions defined
- Correlation ID enforcement active
