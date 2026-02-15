# Logging and Trace Standard

Phase: DevOps & Operational Safety  
Scope: Structured logging, correlation propagation, and trace integrity

This document defines mandatory logging and trace rules for Zidney.

Logging is part of institutional trust.  
No runtime execution is allowed without structured logs.

---

## Structured Logging Requirement

All services must use structured JSON logging.

Plain text logs are prohibited.

Required logger:

- Pino (backend and worker)

All logs must be machine-parsable.

---

## Mandatory Log Fields

Every log entry must include:

- timestamp
- level
- service_name (api | worker | mmc | backoffice | frontoffice)
- environment (development | production)
- request_id (if request-bound)
- workspace_slug (if tenant-bound)
- workspace_id (if resolved)
- user_id (if authenticated)
- route (if HTTP-bound)
- method (if HTTP-bound)
- response_status (if HTTP-bound)
- duration_ms (if request-bound)

No sensitive data allowed in logs.

Forbidden fields:

- passwords
- JWT tokens
- DB credentials
- raw student answers
- payment data
- personal identifiers beyond internal user_id

---

## Correlation ID Rules

Every incoming HTTP request must:

- Generate request_id if not present
- Accept external X-Request-ID if provided
- Attach request_id to response header
- Include request_id in all logs

request_id must be propagated to:

- background jobs
- grading operations
- attempt lifecycle logs
- snapshot operations

No orphan log entry allowed.

---

## Tenant Trace Rules

For workspace-bound requests:

Resolver must attach:

- workspace_slug
- workspace_id

All downstream services must log using these values.

No service may log tenant activity without workspace context.

---

## Attempt Trace Rules

All attempt lifecycle events must include:

- workspace_slug
- attempt_id
- user_id
- event_type

Event types include:

- ATTEMPT_STARTED
- ANSWER_SAVED
- ATTEMPT_SUBMITTED
- GRADING_STARTED
- GRADING_COMPLETED
- ATTEMPT_RECONNECTED
- ATTEMPT_TIMEOUT

Attempt logs must allow full reconstruction of attempt history.

---

## Worker Trace Rules

Worker must log:

- job_id
- job_type
- workspace_slug
- attempt_id (if applicable)
- retry_count
- execution_duration_ms
- final_status

Worker failures must:

- Log structured error
- Log retry decision
- Log dead-letter movement

---

## Error Logging Standard

All errors must include:

- error_code
- error_classification (SYSTEM | TENANT | VALIDATION | SECURITY)
- request_id
- workspace_slug (if applicable)

Stack traces:

- Allowed in development
- Sanitized in production

No unclassified error logs allowed.

---

## Log Levels Policy

Allowed levels:

- trace (development only)
- debug (development only)
- info
- warn
- error
- fatal

Production must not emit debug or trace logs.

---

## Performance Logging

Every request must log:

- start timestamp
- end timestamp
- duration_ms

Long-running operations must log:

- operation_type
- threshold_exceeded flag

Threshold policies defined in Monitoring document.

---

## Log Retention Policy

Development:

- Minimum 7 days

Production:

- Minimum 30 days

Snapshot logs:

- Retained until snapshot deleted

Deletion of logs must be auditable.

---

## Compliance Requirements

The logging layer must guarantee:

- Full traceability of tenant activity
- Full traceability of attempt lifecycle
- No cross-tenant ambiguity
- Deterministic debugging capability

If logs cannot reconstruct:

- Who
- What
- When
- Where (workspace)

Then the logging system is insufficient.

---

## Validation Criteria

This stage is complete when:

- request_id is present in all API logs
- workspace_slug is present in tenant logs
- attempt_id is present in attempt logs
- worker logs include job_id and workspace context
- Sensitive data is not logged
- Production logs are structured JSON only
- Trace reconstruction is possible for any attempt

No production deployment allowed without:

- Correlation ID enforcement
- Structured logging validation
- Worker trace validation
- Error classification enforcement
