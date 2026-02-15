# Error Handling Standard

This document defines the mandatory error handling model for Zidney.

All applications (api, worker, mmc, backoffice, frontoffice) must follow this contract.

Error handling must be:

- Structured
- Deterministic
- Traceable
- Tenant-aware
- Safe for production

No raw or inconsistent error responses are allowed.

---

## API Error Response Format

All API errors MUST follow this structure:

{
"success": false,
"error": {
"code": "ERROR_CODE",
"message": "Human readable message",
"correlationId": "uuid",
"details": null
}
}

Rules:

- success must always be false
- code is machine-readable (UPPER_SNAKE_CASE)
- message is safe for client display
- correlationId must match request_id
- details is optional and never exposes sensitive data

No stack traces returned to client.

---

## HTTP Status Mapping

Standard mappings:

400 – Validation error
401 – Unauthorized
403 – Forbidden
404 – Not found
409 – Conflict
423 – License soft-locked
426 – Upgrade required
429 – Rate limit exceeded
500 – Internal server error
503 – Service unavailable

HTTP status and error.code must align logically.

---

## Error Codes Convention

Error codes must:

- Be stable
- Be documented
- Never change silently

Examples:

AUTH_INVALID_CREDENTIALS
AUTH_TOKEN_EXPIRED
TENANT_NOT_FOUND
TENANT_ARCHIVED
LICENSE_SOFT_LOCKED
LICENSE_LIMIT_REACHED
ATTEMPT_ALREADY_SUBMITTED
ATTEMPT_NOT_FOUND
SUBSCRIPTION_REQUIRED
SCHEMA_VERSION_MISMATCH
RATE_LIMIT_EXCEEDED
INTERNAL_ERROR

No dynamic error codes allowed.

---

## Correlation ID Requirement

Every request must include a correlation ID.

Rules:

- Generated at request entry if not provided
- Propagated through services
- Logged in every log entry
- Returned in error response

No request may execute without correlationId.

---

## Tenant-Aware Error Logging

All errors must include structured log fields:

- request_id
- workspace_slug (if tenant request)
- workspace_id
- user_id (if authenticated)
- attempt_id (if runtime request)
- error_code
- http_status

No unstructured logs allowed.

---

## Validation Errors

Validation errors must:

- Return 400
- Include validation-specific code
- Never expose internal schema

Example:

VALIDATION_FAILED
INVALID_INPUT
MISSING_REQUIRED_FIELD

Frontend must not rely on raw DB messages.

---

## Idempotency Errors

Submission endpoints must be idempotent.

If duplicate submission detected:

- Return 409
- code: ATTEMPT_ALREADY_SUBMITTED

No duplicate grading execution allowed.

---

## Worker Error Handling

Worker jobs must implement:

- Retry up to 3 times
- Exponential backoff
- Jitter

If still failing:

- Move job to dead-letter queue
- Log critical error
- Include correlationId and job_id

Worker must never crash process due to unhandled error.

---

## Fatal Errors

Fatal errors include:

- Schema mismatch
- Tenant DB unavailable
- Corrupted snapshot
- Migration inconsistency

Rules:

- Return 503 or 500
- Log as CRITICAL level
- Include tenant context
- Block further unsafe execution

---

## Security Rules

Never expose:

- Stack traces
- SQL queries
- Internal file paths
- Secrets
- Token payloads
- DB connection strings

Sanitize all error messages before response.

---

## Logging Standard

All logs must be structured JSON.

Required fields:

- level
- message
- request_id
- workspace_slug (if applicable)
- error_code (if error)
- timestamp

No console.log allowed in production.

---

## Frontend Error Handling

Frontend must:

- Rely on error.code for logic
- Not parse error.message for logic
- Show user-friendly messages
- Redirect on 401
- Show locked screen on 423
- Show upgrade-required screen on 426

No frontend hardcoded message assumptions.

---

## Enforcement Rule

Any endpoint not following this format:

- Fails review
- Fails Definition of Done
- Cannot be merged

Error handling is a platform-level contract and must be consistent across all services.
