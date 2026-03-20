---
name: error-handling-patterns
description: Standard error response format, error code registry, HTTP status mapping, and error boundary patterns for Zidney
metadata:
  category: api
  scope: all-services
  capabilities:
    - standard error response format
    - error code registry
    - HTTP status mapping
    - frontend error boundary patterns
    - domain error classes
---

# Error Handling Patterns Skill

All Zidney API responses must follow a standard format. This skill defines the error model from domain layer through API to frontend consumption.

---

## Standard API Response Format

Every API response MUST conform to:

```typescript
// Success
{
  success: true,
  data: { /* typed payload */ },
  error: null
}

// Error
{
  success: false,
  data: null,
  error: {
    code: string,    // Machine-readable error code
    message: string  // Human-readable error description
  }
}
```

No unstructured error responses. No plain text errors. No `{ error: "something went wrong" }`.

---

## HTTP Status Code Mapping

| Status | When to Use |
|--------|-------------|
| 200 | Successful GET, PUT, PATCH |
| 201 | Successful POST (resource created) |
| 204 | Successful DELETE (no content) |
| 400 | Validation error, malformed request |
| 401 | Authentication required |
| 403 | Forbidden — insufficient permissions or ARCHIVED license |
| 404 | Resource not found (or cross-tenant access attempt) |
| 409 | Conflict — duplicate resource, version mismatch |
| 422 | Unprocessable entity — valid syntax but semantic error |
| 423 | Locked — SOFT_LOCKED license |
| 429 | Rate limited |
| 500 | Internal server error (unexpected) |

---

## Error Code Format

Error codes follow: `<DOMAIN>_<ERROR>` pattern.

```
AUTH_INVALID_CREDENTIALS
AUTH_TOKEN_EXPIRED
EXAM_NOT_FOUND
EXAM_ALREADY_STARTED
ATTEMPT_ALREADY_SUBMITTED
ATTEMPT_TIME_EXPIRED
LICENSE_SOFT_LOCKED
LICENSE_ARCHIVED
LICENSE_NOT_FOUND
TENANT_NOT_FOUND
VALIDATION_FAILED
RATE_LIMIT_EXCEEDED
```

---

## Domain Error Classes

```typescript
export class DomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export class NotFoundError extends DomainError {
  constructor(entity: string, id: string) {
    super(`${entity.toUpperCase()}_NOT_FOUND`, `${entity} not found: ${id}`, 404);
  }
}

export class AuthorizationError extends DomainError {
  constructor(message = 'Insufficient permissions') {
    super('AUTH_FORBIDDEN', message, 403);
  }
}
```

Domain errors live in `packages/domain-core`. They carry:
- A machine-readable `code`
- A human-readable `message`
- An HTTP status code hint

---

## API Error Handler (Hono)

```typescript
app.onError((err, c) => {
  if (err instanceof DomainError) {
    return c.json({
      success: false,
      data: null,
      error: { code: err.code, message: err.message },
    }, err.statusCode);
  }

  logger.error({ err }, 'Unhandled error');
  return c.json({
    success: false,
    data: null,
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
  }, 500);
});
```

Rules:
- Never expose stack traces in production responses
- Always log unhandled errors with full context
- Return generic message for 500 errors

---

## Frontend Error Handling

```typescript
// API client error parsing
function handleApiError(response: ApiResponse<unknown>) {
  if (!response.success && response.error) {
    switch (response.error.code) {
      case 'AUTH_TOKEN_EXPIRED':
        return redirectToLogin();
      case 'LICENSE_SOFT_LOCKED':
        return showLicenseWarning();
      default:
        return showToast(response.error.message, 'error');
    }
  }
}
```

Frontend must:
- Handle error codes programmatically (not string matching on messages)
- Show user-friendly messages from the `message` field
- Redirect on auth errors
- Show license warnings on 423 status

---

## Validation Error Format

For 400/422 validation errors with field-level details:

```typescript
{
  success: false,
  data: null,
  error: {
    code: 'VALIDATION_FAILED',
    message: 'Request validation failed',
    details: [
      { field: 'email', message: 'Invalid email format' },
      { field: 'duration_minutes', message: 'Must be positive integer' }
    ]
  }
}
```

---

## Verdict Protocol

```
VERDICT: PASS   — error responses follow standard format with typed codes
VERDICT: BLOCKED — non-standard error format or missing error code
```
