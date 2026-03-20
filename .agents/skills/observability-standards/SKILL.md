---
name: observability-standards
description: Structured logging, correlation ID propagation, and monitoring standards for all Zidney services
metadata:
  category: monitoring
  scope: all-services
  capabilities:
    - structured logging enforcement
    - correlation ID propagation
    - mandatory log field validation
    - metric definition patterns
    - alert rule templates
---

# Observability Standards Skill

All Zidney services must produce **structured, machine-readable logs** using Pino. This skill codifies the exact logging patterns, required fields, and monitoring standards.

---

## Mandatory Log Fields

Every log entry MUST include:

| Field | Required | Description |
|-------|----------|-------------|
| `timestamp` | Always | ISO 8601 timestamp |
| `level` | Always | Log level (info, warn, error, fatal) |
| `service` | Always | Service name (api, worker, mmc, backoffice, frontoffice) |
| `correlation_id` | Always | Request-scoped unique ID for tracing |
| `workspace_slug` | If tenant-bound | Tenant identifier |
| `workspace_id` | If tenant-bound | Tenant UUID |
| `user_id` | If authenticated | User UUID |
| `attempt_id` | If attempt-bound | Exam attempt UUID |
| `msg` | Always | Human-readable log message |

---

## Forbidden Practices

- **`console.log` is forbidden** — use the structured logger
- **No secrets in logs** — passwords, tokens, API keys, database URLs
- **No PII in debug/info logs** — student emails, names only at warn+ level with justification
- **No full request/response body logging** in production
- **No unstructured string concatenation** for log messages

---

## Logger Creation Pattern

```typescript
import { createLogger } from '@zidney/logger';

// Service-level logger
const logger = createLogger('api');

// Request-scoped child logger (in middleware)
const requestLogger = logger.child({
  correlation_id: req.header('x-correlation-id') ?? generateId(),
  workspace_slug: resolvedTenant.slug,
  workspace_id: resolvedTenant.id,
  user_id: authenticatedUser?.id,
});
```

---

## Correlation ID Propagation

The correlation ID must flow through:

```
Client Request (X-Correlation-Id header)
  → API middleware (extract or generate)
    → Domain function calls (passed via context)
      → Worker jobs (embedded in job payload)
        → Database queries (logged alongside query)
```

Rules:
- Generate correlation ID at API entry point if not provided
- Pass correlation ID in all Worker job payloads
- Include correlation ID in all error responses
- Never generate a new correlation ID mid-request

---

## Log Levels

| Level | When to Use |
|-------|-------------|
| `fatal` | Service cannot continue (DB connection lost, config invalid) |
| `error` | Operation failed but service continues (failed request, bad input) |
| `warn` | Degraded operation (cache miss fallback, retry attempt, rate limit hit) |
| `info` | Business events (user login, exam started, submission received) |
| `debug` | Development detail (query timings, cache hits, middleware execution) |

- Production: `info` level minimum
- Staging: `debug` level allowed
- Development: `debug` level default

---

## Error Logging Pattern

```typescript
try {
  await riskyOperation();
} catch (error) {
  logger.error({
    err: error,
    operation: 'riskyOperation',
    context: { relevant_id: '...' },
  }, 'Operation failed: brief description');
  
  // Re-throw or return error response
}
```

Always include:
- The error object (Pino serializes it)
- The operation name
- Relevant context (IDs, not full payloads)
- A human-readable message

---

## Health Check Logging

Services must log at startup:

```typescript
logger.info({
  version: process.env.APP_VERSION,
  environment: process.env.NODE_ENV,
  port: config.port,
}, 'Service started');
```

---

## Metrics (Future-Ready)

When metrics collection is added, track:

- `http_request_duration_seconds` — histogram by route and status
- `db_query_duration_seconds` — histogram by operation type
- `worker_job_duration_seconds` — histogram by job type
- `active_attempts` — gauge per workspace
- `submission_rate` — counter per workspace
- `cache_hit_ratio` — gauge per cache domain

---

## Verdict Protocol

```
VERDICT: PASS   — all log statements include mandatory fields
VERDICT: BLOCKED — missing mandatory log fields or forbidden practice detected
```
