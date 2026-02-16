# STAGE 07 – Observability Baseline

Phase: 1 – Platform Foundation
Status: Critical
Scope: Logging, tracing, correlation, monitoring & auditability

---

## Objective

Establish a structured, production-grade observability baseline for Zidney:

- Structured logging
- Request IDs
- Attempt tracing
- Workspace-level traceability
- Worker job traceability
- Error standardization
- Monitoring readiness

Zidney is institutional SaaS.
Observability is not optional.

---

## Observability Principles

1. Every request must be traceable.
2. Every attempt must be auditable.
3. Every worker job must be reconstructible.
4. Every error must be structured.
5. Logs must support future monitoring systems.

No free-text logs.

---

## Structured Logging Standard

All services must use structured JSON logging.

Required fields:

Common fields:

- timestamp
- level
- service (api | worker)
- environment (dev | prod)
- request_id (must be globally unique per HTTP request)
- workspace_id (if applicable)
- user_id (if authenticated)

Optional contextual fields:

- attempt_id
- job_id
- route
- method
- status_code
- duration_ms

No console.log allowed.

---

TODO:
Replace any temporary console-based JSON logging with a structured logger abstraction (Pino).
All services must migrate to Pino before production release.
Console-based logging is allowed only as a transitional mechanism during early foundation stages.

---

Example log structure:

{
"timestamp": "ISO-8601",
"level": "info",
"service": "api",
"environment": "prod",
"request_id": "uuid",
"workspace_id": "uuid",
"user_id": "uuid",
"event": "attempt_started",
"attempt_id": "uuid",
"duration_ms": 34
}

---

## Log Levels

Allowed levels:

- debug (development only)
- info (normal operations)
- warn (recoverable issue)
- error (failure)
- fatal (system-level crash)

Production must not log debug unless explicitly enabled.

Log level must be consistent across services.

---

## Sensitive Data Protection

Logs must never include:

- passwords
- JWT tokens
- refresh tokens
- database credentials
- full exam answers (student responses)
- payment data

If logging user context:

- Use user_id only
- Never log email or personal identifiers

Sensitive fields must be redacted at logger middleware level.

---

## Correlation ID Rules

Every HTTP request must:

1. Generate request_id (UUID)
2. Attach to request context
3. Include in all logs
4. Propagate to worker jobs

Worker jobs must:

- Inherit request_id
- Include attempt_id
- Include workspace_id

Request ID chain must allow tracing:

Request → Attempt → Worker → Finalization

---

## Request Lifecycle Logging

Every HTTP request must produce:

- request_received
- request_completed

Both must include:

- request_id
- workspace_id (if applicable)
- route
- method
- status_code
- duration_ms

No request may exit without a completion log entry.

---

## Attempt Traceability

When attempt lifecycle events occur:

Must log:

- attempt_started
- attempt_progress_saved
- attempt_submitted
- attempt_expired
- attempt_finalized
- certificate_generated

Each log must include:

- workspace_id
- attempt_id
- user_id
- exam_type
- mode
- timestamps

No silent transitions allowed.

---

## Error Handling Standard

All API responses must follow:

{
"success": false,
"error": {
"code": "ERROR_CODE",
"message": "Human readable message",
"request_id": "uuid"
}
}

Rules:

- request_id must be returned on every error
- Internal error details must never be exposed
- Database errors must be mapped to domain-safe codes
- Validation errors must use consistent codes
- 4xx errors for client issues
- 5xx errors for system failures

Full stack traces must be logged internally only.

---

## Worker Observability

Worker must log:

- job_received
- job_started
- job_completed
- job_failed
- job_moved_to_dead_letter

Job logs must include:

- job_name
- workspace_id
- attempt_id (if applicable)
- retry_count
- duration_ms

Retry visibility:

- retry_count must increment per attempt
- max_retries must be logged
- dead-letter move must include reason
- job payload hash must be logged (not full payload)

Dead-letter queue must preserve metadata.

---

## Metrics Readiness (Future)

System must be compatible with:

- Prometheus (future)
- External monitoring
- Health check endpoints
- Log aggregation

Even if not implemented now,
log format must support it.

---

## Health Checks

Each service must expose:

/health

Must validate:

- DB connectivity
- Redis connectivity
- Worker readiness (if applicable)

Health endpoint must not expose secrets.

---

## Audit Logging (Critical Actions)

Must log audit events for:

- License state changes
- Tenant provisioning
- Tenant deletion
- Product updates
- Schema upgrades
- User role changes
- Limit changes

Audit logs must be immutable.

Audit logs must:

- Be append-only
- Be stored per workspace
- Include actor_id
- Include previous_state and new_state
- Include timestamp
- Be protected from modification

Audit logs must not be deletable by workspace users.

---

## Validation Criteria

Stage complete when:

- Every API request logs structured JSON
- request_id present everywhere
- attempt lifecycle fully traceable
- Worker logs contain job_id + attempt_id
- Errors follow standardized format
- Health endpoints operational
- No console logs exist
- Log format consistent across services

---

## Not Allowed

- Unstructured logs
- Logging without workspace context
- Silent worker failures
- Error without request_id
- Mixed log formats
- Plain text logs in production

---

## Stability Principle

Observability is institutional trust.

If an institution reports:

"Exam submission failed"

You must be able to trace:

- Request
- Attempt state
- Worker processing
- Finalization

Within minutes.

If not,
Zidney is not production-grade.

---

Next stage:
STAGE_08_RATE_LIMITING_AND_SECURITY
