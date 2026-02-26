# API Response Contracts: Phase Test 01 Platform Foundation

**Stage**: STAGE_TEST_01_PLATFORM_FOUNDATION  
**Branch**: test-001-platform-foundation  
**Date**: 2026-02-26  
**Format**: RFC 7807 JSON Problem + Custom Extensions

---

## Success Response Contract (2xx)

### Standard Success Response

```json
{
  "success": true,
  "data": {
    // Response-specific data
  },
  "error": null
}
```

### Examples by Endpoint

#### GET /api/workspaces/{wsId}/students (200 OK)

```json
{
  "success": true,
  "data": {
    "students": [
      {
        "id": "stu-1",
        "email": "student@example.com",
        "enrollment_id": "ENR-001",
        "status": "ACTIVE",
        "grade": null,
        "created_at": "2026-02-26T10:00:00Z"
      }
    ],
    "pagination": {
      "total": 1,
      "page": 1,
      "per_page": 50
    }
  },
  "error": null
}
```

#### POST /api/workspaces/{wsId}/attempts/{id}/submissions (202 Accepted)

```json
{
  "success": true,
  "data": {
    "submission_id": "sub-1",
    "attempt_id": "att-1",
    "question_id": "q-1",
    "status": "ACCEPTED",
    "score": null,
    "message": "Submission accepted for grading",
    "retry_after_seconds": null
  },
  "error": null
}
```

**Rationale**: 202 Accepted indicates async processing by Worker.

---

## Error Response Contract (4xx, 5xx)

### RFC 7807 Standard Format

```json
{
  "type": "https://api.zidney.io/errors/[error_category]",
  "title": "[Short Error Title]",
  "status": [HTTP Status Code],
  "detail": "[Detailed, actionable explanation]",
  "instance": "[Request path that failed]",
  "error_code": "[Custom error code]",
  [additional fields per error type]
}
```

### Error Code Reference

| HTTP | Code             | Title                   | Detail Example                                    | Instance  |
| ---- | ---------------- | ----------------------- | ------------------------------------------------- | --------- |
| 400  | VALIDATION_ERROR | Validation Error        | "Email must be valid format"                      | /endpoint |
| 401  | UNAUTHORIZED     | Unauthorized            | "Invalid or expired token"                        | /endpoint |
| 403  | FORBIDDEN        | Insufficient Permission | "User lacks permission to access workspace-b"     | /endpoint |
| 404  | NOT_FOUND        | Resource Not Found      | "Student with ID student-999 not found"           | /endpoint |
| 409  | CONFLICT         | State Machine Violation | "Cannot transition from ARCHIVED to ACTIVE"       | /endpoint |
| 409  | LIMIT_EXCEEDED   | License Limit Exceeded  | "Student limit (100) reached"                     | /endpoint |
| 426  | UPGRADE_REQUIRED | Schema Mismatch         | "Tenant schema v1.9.0 requires upgrade to v2.0.0" | /endpoint |
| 429  | RATE_LIMITED     | Too Many Requests       | "5 login attempts allowed per minute"             | /endpoint |
| 500  | INTERNAL_ERROR   | Server Error            | "Unexpected error; correlation_id: corr-xxx"      | /endpoint |

---

## Error Response Examples

### Test 1.1: Cross-Tenant Access (403 Forbidden)

```json
{
  "type": "https://api.zidney.io/errors/forbidden",
  "title": "Insufficient Permission",
  "status": 403,
  "detail": "User from workspace-a cannot access workspace-b resources. Resolver rejected cross-tenant request.",
  "instance": "/api/workspaces/workspace-b/students",
  "error_code": "FORBIDDEN",
  "workspace_requested": "workspace-b",
  "workspace_authenticated": "workspace-a"
}
```

### Test 2.2: Provisioning Lock Conflict (409 Conflict)

```json
{
  "type": "https://api.zidney.io/errors/conflict",
  "title": "Provisioning In Progress",
  "status": 409,
  "detail": "Workspace provisioning already in progress. Lock held by provision-request-1. Retry after lock expires.",
  "instance": "/api/internal/provision",
  "error_code": "LOCK_CONFLICT",
  "lock_key": "provision:workspace:ws-2",
  "lock_holder": "provision-request-1",
  "retry_after_seconds": 45
}
```

### Test 3.1d: Invalid License Transition (409 Conflict)

```json
{
  "type": "https://api.zidney.io/errors/conflict",
  "title": "Invalid State Transition",
  "status": 409,
  "detail": "Cannot transition license from ARCHIVED to ACTIVE. Only SOFT_LOCKED can transition to ACTIVE.",
  "instance": "/api/licenses/lic-5",
  "error_code": "INVALID_TRANSITION",
  "current_state": "ARCHIVED",
  "requested_state": "ACTIVE",
  "allowed_transitions": ["SOFT_LOCKED"]
}
```

### Test 3.2: Schema Mismatch (426 Upgrade Required)

```json
{
  "type": "https://api.zidney.io/errors/schema_mismatch",
  "title": "Schema Version Mismatch",
  "status": 426,
  "detail": "Tenant schema v1.9.0 requires upgrade to v2.0.0. Run migrations to proceed.",
  "instance": "/api/workspaces/workspace-4/students",
  "error_code": "SCHEMA_MISMATCH",
  "current_schema_version": "1.9.0",
  "required_schema_version": "2.0.0",
  "upgrade_path": "/admin/upgrade"
}
```

### Test 3.3a: Student Limit Exceeded (409 Conflict)

```json
{
  "type": "https://api.zidney.io/errors/limit_exceeded",
  "title": "License Limit Exceeded",
  "status": 409,
  "detail": "Student limit (100) reached for this workspace. Cannot create additional students.",
  "instance": "/api/workspaces/workspace-5/students",
  "error_code": "LIMIT_EXCEEDED",
  "resource_type": "students",
  "limit": 100,
  "current": 100,
  "requested_total": 101
}
```

### Test 5.1a: Rate Limit (429 Too Many Requests)

```json
{
  "type": "https://api.zidney.io/errors/rate_limited",
  "title": "Too Many Requests",
  "status": 429,
  "detail": "5 login attempts allowed per minute per IP address. Limit reset at 2026-02-26T10:31:45Z.",
  "instance": "/api/login",
  "error_code": "RATE_LIMITED",
  "limit": 5,
  "window_seconds": 60,
  "retry_after_seconds": 50,
  "limit_type": "login_per_ip"
}
```

**Response Headers**:

```
Retry-After: 50
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1709021505
```

### Test 6.2: Validation Error (400 Bad Request)

```json
{
  "type": "https://api.zidney.io/errors/validation_error",
  "title": "Validation Error",
  "status": 400,
  "detail": "Request validation failed. See errors array for details.",
  "instance": "/api/workspaces/ws-1/students",
  "error_code": "VALIDATION_ERROR",
  "errors": [
    {
      "field": "email",
      "message": "Invalid email format",
      "value": "not-an-email"
    }
  ]
}
```

### Test 7.3: Attempt Closed (Deadline Exceeded)

```json
{
  "type": "https://api.zidney.io/errors/attempt_closed",
  "title": "Attempt Closed",
  "status": 409,
  "detail": "Attempt A1 deadline passed at 2026-02-26T11:00:00Z. Submissions no longer accepted.",
  "instance": "/api/workspaces/ws-1/attempts/a1/submissions",
  "error_code": "ATTEMPT_CLOSED",
  "attempt_id": "a1",
  "deadline_at": "2026-02-26T11:00:00Z",
  "server_time": "2026-02-26T11:00:05Z",
  "seconds_overdue": 5
}
```

### Test 5.1: Internal Server Error (500)

```json
{
  "type": "https://api.zidney.io/errors/internal_error",
  "title": "Internal Server Error",
  "status": 500,
  "detail": "An unexpected error occurred. Check logs using correlation_id.",
  "instance": "/api/workspaces/ws-1/students",
  "error_code": "INTERNAL_ERROR",
  "correlation_id": "corr-789",
  "support_url": "https://support.zidney.io/errors/corr-789"
}
```

---

## Rate Limit Headers (Test 5.2)

### Header Contract

All responses (success or error) must include:

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 997
X-RateLimit-Reset: 1709021400
```

### Header Semantics

| Header                  | Meaning                                  | Example    |
| ----------------------- | ---------------------------------------- | ---------- |
| `X-RateLimit-Limit`     | Requests allowed in window               | 1000       |
| `X-RateLimit-Remaining` | Requests remaining in window             | 997        |
| `X-RateLimit-Reset`     | Unix timestamp when limit resets         | 1709021400 |
| `Retry-After`           | Seconds to wait before retrying (on 429) | 50         |

### Example Timeline

```
Request 1: Remaining: 1000 → 999, Reset: T+3600
Request 2: Remaining: 999 → 998, Reset: T+3600
...
Request 998: Remaining: 2 → 1, Reset: T+3600
Request 999: Remaining: 1 → 0, Reset: T+3600
Request 1000: Remaining: 0, Status: 429, Retry-After: 3599

[Wait for reset]

Request 1001: Remaining: 1000 → 999, Reset: T+7200
```

---

## Structured Logging Contract (Test 6.1)

### Log Entry Format (JSON)

```json
{
  "timestamp": "2026-02-26T10:30:45.123Z",
  "level": "INFO",
  "service": "api",
  "workspace_slug": "workspace-1",
  "workspace_id": "uuid-123",
  "user_id": "user-456",
  "correlation_id": "corr-789",
  "message": "GET /api/workspaces/workspace-1/students",
  "method": "GET",
  "path": "/api/workspaces/workspace-1/students",
  "status_code": 200,
  "duration_ms": 45
}
```

### Required Fields (Every Log Entry)

| Field          | Type     | Example                  | Purpose         |
| -------------- | -------- | ------------------------ | --------------- |
| timestamp      | ISO 8601 | 2026-02-26T10:30:45Z     | Trace ordering  |
| level          | String   | INFO, WARN, ERROR        | Severity        |
| service        | String   | api, worker              | Service origin  |
| correlation_id | UUID     | corr-789                 | Request tracing |
| message        | String   | "Student list retrieved" | Human-readable  |

### Conditional Fields

| Field          | When Present            | Example                                    |
| -------------- | ----------------------- | ------------------------------------------ |
| workspace_slug | Workspace-bound request | workspace-1                                |
| workspace_id   | Workspace-bound request | uuid-123                                   |
| user_id        | Authenticated request   | user-456                                   |
| error          | Error condition         | `{"code": "NOT_FOUND", "message": "..." }` |
| duration_ms    | Response completed      | 45                                         |
| status_code    | Response returned       | 200, 404, 500                              |

### Error Log Format

```json
{
  "timestamp": "2026-02-26T10:30:46.200Z",
  "level": "ERROR",
  "service": "api",
  "workspace_slug": "workspace-1",
  "workspace_id": "uuid-123",
  "user_id": "user-456",
  "correlation_id": "corr-789",
  "message": "Student not found",
  "error": {
    "code": "NOT_FOUND",
    "message": "Student with ID student-999 not found"
  },
  "status_code": 404,
  "path": "/api/workspaces/workspace-1/students/student-999"
}
```

---

## Snapshot Response Contract (Test 7.1)

### Attempt Start Response (includes snapshot)

```json
{
  "success": true,
  "data": {
    "attempt_id": "a1",
    "student_id": "s1",
    "exam_id": "e1",
    "status": "IN_PROGRESS",
    "started_at": "2026-02-26T10:00:00Z",
    "deadline_at": "2026-02-26T11:00:00Z",
    "snapshot": {
      "exam_id": "e1",
      "exam_title": "Algebra Midterm",
      "total_points": 100,
      "pass_threshold": 60,
      "passing_grade": "D",
      "time_limit_minutes": 90,
      "questions": [
        {
          "question_id": "q1",
          "order": 1,
          "content": "What is 2+2?",
          "points": 20,
          "type": "MCQ"
        },
        {
          "question_id": "q2",
          "order": 2,
          "content": "Solve for x: 2x + 3 = 7",
          "points": 20,
          "type": "SHORT_ANSWER"
        }
      ],
      "grading_rules": {
        "rule_type": "automatic",
        "rules": [
          {
            "question_id": "q1",
            "type": "MCQ",
            "correct_answers": ["4"]
          }
        ]
      },
      "snapshot_created_at": "2026-02-26T10:00:00Z"
    }
  },
  "error": null
}
```

---

## Submission Response Contracts

### Successful Submission (202 Accepted)

```json
{
  "success": true,
  "data": {
    "submission_id": "sub-1",
    "attempt_id": "a1",
    "question_id": "q1",
    "submitted_at": "2026-02-26T10:05:30Z",
    "status": "PROCESSING",
    "score": null,
    "message": "Submission received. Grading in progress (Worker task queued)."
  },
  "error": null
}
```

**Response Headers**:

```
Idempotency-Key: [client-provided ID if request retries]
Retry-After: 0
```

### Duplicate Submission (Idempotent)

```json
{
  "success": true,
  "data": {
    "submission_id": "sub-1",
    "attempt_id": "a1",
    "question_id": "q1",
    "submitted_at": "2026-02-26T10:05:30Z",
    "status": "ALREADY_SUBMITTED",
    "score": null,
    "message": "Duplicate submission detected (same attempt, same question). Idempotent operation — no change made."
  },
  "error": null
}
```

---

## Summary

**Contracts Defined**: ✅

- Success responses (2xx)
- Error responses (4xx, 5xx per RFC 7807)
- Rate limit headers
- Structured logging contract
- Snapshot contract
- Submission contract

**Ready for Phase 1: Implementation Plan** ✅
