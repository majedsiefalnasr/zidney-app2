# STAGE 08: Rate Limiting & Security — Technical Design Plan

**Phase:** 01_PLATFORM_FOUNDATION  
**Stage:** STAGE_08_RATE_LIMITING_AND_SECURITY  
**Date:** 2026-02-19  
**Branch:** `008-rate-limiting-and-security`  
**Status:** PLANNING PHASE — Ready for implementation

---

## Executive Summary

This technical design plan provides the complete architectural blueprint for implementing Rate
Limiting & Security across Zidney. It details:

- **Database schema changes** required for idempotent submission
- **API layer middleware stack** with enforcement order
- **Redis key structure** for rate limiting
- **Transaction boundaries** for all critical operations
- **Error code mapping** for all scenarios
- **Security headers** and CORS rules
- **Worker integration** for dead-letter queue handling
- **Testing strategy** with load, concurrency, and security scenarios
- **Logging and observability** implementation

All sections are **constitutional compliant** (Zidney Constitution v1.2.0).

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Schema Changes](#schema-changes)
3. [RBAC Documentation](#rbac-documentation-role-based-access-control)
4. [API Layer Design](#api-layer-design)
5. [Redis Schema](#redis-schema)
6. [Middleware Stack](#middleware-stack)
7. [Transaction Boundaries](#transaction-boundaries)
8. [Worker Integration](#worker-integration)
9. [Error Code Mapping](#error-code-mapping)
10. [Security Headers](#security-headers)
11. [Logging Strategy](#logging-strategy)
12. [Testing Strategy](#testing-strategy)
13. [Non-Goals](#non-goals)
14. [Constitutional Compliance](#constitutional-compliance)

---

## 1. Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                      Client (Browser/SDK)                   │
└──────────────────────────────────────────────────────────────┘
                            │
                   HTTP/WebSocket
                            │
┌──────────────────────────────────────────────────────────────┐
│                     API Gateway (Hono)                       │
├──────────────────────────────────────────────────────────────┤
│  Middleware Stack (Order-Critical):                          │
│  1. Correlation ID (UUID generation)                         │
│  2. Tenant Resolver (subdomain/path → workspace_id)         │
│  3. License Enforcement (validate status + version)         │
│  4. Schema Version Check (426 if incompatible)              │
│  5. Rate Limiting (429 if exceeded)                         │
│  6. Route Handler                                            │
└──────────────────────────────────────────────────────────────┘
             │                          │
             │                          │
             v                          v
    ┌─────────────────┐      ┌──────────────────┐
    │   PostgreSQL    │      │     Redis        │
    │   Master DB     │      │  Rate Limiter    │
    │   Tenant DB     │      │  Idempotency     │
    │                 │      │  Cache           │
    └─────────────────┘      └──────────────────┘
             │
             │ (enqueue)
             v
    ┌─────────────────────────┐
    │  Job Queue (Redis)      │
    │  grade_attempt jobs     │
    └─────────────────────────┘
             │
             │ (spawn)
             v
    ┌─────────────────────────┐
    │  Worker Process         │
    │  - Dequeue jobs         │
    │  - Grade attempts       │
    │  - Retry on failure     │
    │  - Move to DLQ if fatal │
    └─────────────────────────┘
```

### Data Flow

**Authentication Flow:**

```
1. Client sends credentials → POST /auth/login
2. Correlation ID middleware assigns request UUID
3. Tenant resolver determines workspace from subdomain
4. License middleware validates ACTIVE status
5. Rate limiting middleware checks:
   - rate:auth:ip:{ip} (5 attempts/60s)
   - rate:auth:user:{user_id}:{workspace_slug} (5 attempts/60s)
6. If limits exceeded → 429 (Too Many Requests)
7. If limits OK → Route handler processes login
8. On success → issue JWT with workspace_id claim
9. On failure → increment counters, lock if needed
```

**Attempt Submission Flow:**

```
1. Client sends answers → POST /attempt/{id}/submit
2. Correlation ID assigned
3. Tenant resolver validates workspace
4. License middleware checks ACTIVE
5. Schema version check (idempotent columns required)
6. Rate limiting middleware checks:
   - rate:attempt:submit:{attempt_id} (1 per attempt)
7. Check Redis cache for idempotency_key (24h TTL)
   - Hit → Return cached result (< 100ms)
   - Miss → Continue to DB transaction
8. DB Transaction (SERIALIZABLE):
   - SELECT * FROM attempts WHERE id = ? FOR UPDATE
   - Verify status = 'IN_PROGRESS'
   - Execute grading logic
   - INSERT result into submission_cached_result
   - COMMIT
9. Cache result in Redis (24h TTL)
10. Return grading result to client
```

**WebSocket Flow:**

```
1. Client connects → GET /ws/attempt/{id}
2. Authorization header contains JWT
3. Tenant resolver validates workspace
4. JWT validation:
   - Signature check
   - Expiration check
   - workspace_id claim check
   - attempt_id claim check
5. Verify user has access to this attempt
6. Accept connection
7. Track in rate:ws:{user_id}:connections
8. Enforce message rate: 100 msgs/60s + 10 burst
9. Close on heartbeat timeout (30s)
```

---

## 2. Schema Changes

### New Tables (None Required)

All rate limiting state is ephemeral (Redis). No new tables needed for rate limits themselves.

### Modified Tables

#### `attempts` Table (Tenant DB)

**New columns to add:**

```sql
-- Idempotent submission tracking
ALTER TABLE attempts ADD COLUMN (
  idempotent_submission_key UUID NOT NULL DEFAULT gen_random_uuid(),
  submission_cached_result JSONB,           -- stores grading response from first submission
  submission_cached_at TIMESTAMP WITH TIME ZONE,  -- when result was cached
  CONSTRAINT unique_idempotent_key UNIQUE (id, idempotent_submission_key)
);
```

**Rationale:**

- `idempotent_submission_key`: Client-provided (or auto-generated) identifier for deduplication
- `submission_cached_result`: Stores the full grading response (to replay on duplicate submission)
- `submission_cached_at`: Timestamp for audit trail and cache expiration logic
- UNIQUE constraint: Prevents duplicate processing at DB level

**Backward Compatibility:**

- On migration: Populate existing attempts with gen_random_uuid()
- Constraint is NOT added retroactively to existing rows
- Only NEW submissions enforce UNIQUE constraint
- API rejects requests without `idempotent_submission_key` with 400 Bad Request

### Migration Files

#### File: `apps/api/src/db/tenant/migrations/0008_add_idempotent_submission.ts`

```typescript
import { sql } from "drizzle-orm";
import type { Migration } from "../migration.types";

export const migration: Migration = {
  id: "0008_add_idempotent_submission",
  version: "1.1.0", // MINOR bump (backward compatible)
  description: "Add idempotent submission support to attempts table",

  up: async (db) => {
    // Add new columns
    await db.schema
      .alterTable("attempts")
      .addColumn("idempotent_submission_key", "uuid", (col) =>
        col.defaultTo(sql`gen_random_uuid()`),
      )
      .addColumn("submission_cached_result", "jsonb")
      .addColumn("submission_cached_at", "timestamp with time zone")
      .execute();

    // Create index for lookups
    await db.schema
      .createIndex("idx_attempt_idempotent_key")
      .on("attempts")
      .column("id")
      .column("idempotent_submission_key")
      .unique()
      .execute();

    // Create index for submission audit
    await db.schema
      .createIndex("idx_attempt_cached_result")
      .on("attempts")
      .column("workspace_id")
      .column("created_at")
      .where(sql`submission_cached_at IS NOT NULL`)
      .execute();
  },

  down: async (db) => {
    // Drop indexes
    await db.schema.dropIndex("idx_attempt_cached_result").execute();
    await db.schema.dropIndex("idx_attempt_idempotent_key").execute();

    // Drop columns
    await db.schema
      .alterTable("attempts")
      .dropColumn("submission_cached_at")
      .dropColumn("submission_cached_result")
      .dropColumn("idempotent_submission_key")
      .execute();
  },

  checksum: "sha256:...", // Generated during migration validation
  createdAt: "2026-02-19T00:00:00Z",
};
```

#### File: `apps/api/src/db/master/migrations/0005_schema_version_increment.ts`

```typescript
import type { Migration } from "../migration.types";

export const migration: Migration = {
  id: "0005_schema_version_increment",
  version: "1.1.0",
  description: "Increment schema version for rate limiting feature",

  up: async (db) => {
    // Update schema_version on each tenant DB
    // This runs during platform initialization
    await db
      .update("schema_versions")
      .set({ version: "1.1.0", updated_at: new Date() })
      .where(sql`version < '1.1.0'`)
      .execute();
  },

  down: async () => {
    // Downgrade handled by provision service
    throw new Error("Cannot downgrade schema version");
  },

  checksum: "sha256:...",
  createdAt: "2026-02-19T00:00:00Z",
};
```

### Indexes Required

```sql
-- Primary lookup for duplicate detection
CREATE UNIQUE INDEX idx_attempt_idempotent_key
  ON attempts(id, idempotent_submission_key)
  WHERE submission_cached_at IS NOT NULL;

-- Audit queries for cached submissions
CREATE INDEX idx_attempt_cached_result_time
  ON attempts(workspace_id, created_at DESC)
  WHERE submission_cached_at IS NOT NULL;

-- Query all completed attempts (for grading audit)
CREATE INDEX idx_attempt_completed_time
  ON attempts(workspace_id, created_at DESC)
  WHERE status = 'COMPLETED';
```

---

## 3. RBAC Documentation (Role-Based Access Control)

### Endpoint RBAC Matrix

Every API endpoint enforces role-based access control according to the following matrix:

| Endpoint                | HTTP Method | Allowed Roles          | Forbidden Roles                    | Permission Rule                                | Notes                              |
| ----------------------- | ----------- | ---------------------- | ---------------------------------- | ---------------------------------------------- | ---------------------------------- |
| `/auth/login`           | POST        | NONE (public)          | N/A                                | No authentication required                     | Rate limited per IP/user/workspace |
| `/auth/logout`          | POST        | authenticated          | N/A                                | User owns current session                      | WebSocket closed post-logout       |
| `/attempt/{id}`         | GET         | student, instructor    | admin                              | User must have access to workspace and attempt | Read-only                          |
| `/attempt/{id}/submit`  | POST        | student                | super_admin, org_admin, instructor | User owns the attempt and status=IN_PROGRESS   | Idempotent with UNIQUE constraint  |
| `/ws/attempt/{id}`      | WS          | student, instructor    | super_admin                        | User must have access to workspace and attempt | JWT validation in handshake        |
| `/admin/workspace/{id}` | GET         | org_admin, super_admin | student, instructor                | User must have admin role for workspace        | Backoffice admin endpoint          |
| `/admin/license/{id}`   | PUT         | super_admin            | all others                         | Only super_admin can update licenses           | MMC endpoint (not in this stage)   |
| `/admin/dlq`            | GET         | org_admin, super_admin | all others                         | View dead-letter queue for workspace           | Ops team inspection                |

### RBAC Enforcement Rules

1. **User Roles are Defined in JWT Claims:**
   - JWT contains `roles` array: `["student"]`, `["instructor"]`, `["org_admin"]`, `["super_admin"]`
   - Roles are resolved from master database at login
   - Role changes require new JWT (no dynamic role updates mid-session)

2. **RBAC Validation Middleware:**
   - Executes after JWT validation
   - Extracts user roles from JWT
   - Checks against endpoint's `allowed_roles`
   - Rejects if user role not in allowed list (403 Forbidden)

3. **Workspace Scope Validation:**
   - After role check, verify user has access to requested workspace
   - Cross-check `workspace_id` from JWT against resource's workspace_id
   - Reject if mismatch (403 Forbidden)

4. **Resource Ownership Validation (for student-owned resources):**
   - For `/attempt/{id}`, verify `user_id` from JWT matches `attempt.user_id`
   - For `/ws/attempt/{id}`, same ownership check
   - Reject if user doesn't own resource (403 Forbidden)

### RBAC Middleware Implementation

```typescript
export const rbacMiddleware = (allowedRoles: string[]) => {
  return async (c: Context, next: Next) => {
    const requestId = c.state.requestId;
    const decoded = c.state.jwtDecoded; // From JWT auth middleware

    if (!decoded) {
      return c.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication required",
            details: null,
            correlationId: requestId,
          },
        },
        401,
      );
    }

    const userRoles = decoded.roles || [];
    const hasRequiredRole = allowedRoles.some((role) => userRoles.includes(role));

    if (!hasRequiredRole) {
      logger.warn({
        event: "rbac_denied",
        correlation_id: requestId,
        user_id: decoded.sub,
        user_roles: userRoles,
        required_roles: allowedRoles,
        endpoint: c.req.path,
      });

      return c.json(
        {
          error: {
            code: "FORBIDDEN",
            message: `This action requires one of: ${allowedRoles.join(", ")}`,
            details: { required_roles: allowedRoles, user_roles: userRoles },
            correlationId: requestId,
          },
        },
        403,
      );
    }

    c.state.jwtDecoded = decoded;
    await next();
  };
};
```

### RBAC Enforcement Order

Middleware must execute in this order:

1. Correlation ID middleware
2. Tenant resolver middleware
3. License enforcement middleware
4. Schema version middleware
5. Rate limiting middleware
6. **JWT validation middleware** ← Role extracted from JWT
7. **RBAC middleware** ← Role checked against endpoint requirements
8. Route handler

---

## 4. API Layer Design

### Route Modifications

#### Authentication Endpoints

**Endpoint:** `POST /auth/login`

```typescript
// Handler signature
handler: async (c: Context) => {
  const body = await c.req.json();

  // Middleware has already:
  // 1. Assigned correlation_id to c.state.requestId
  // 2. Resolved workspace_id to c.state.workspace
  // 3. Validated license status
  // 4. Enforced schema version
  // 5. Checked rate limits (would return 429 here if exceeded)

  const { email, password } = body;

  // Proceed with authentication logic
  // ... login logic ...

  return c.json({ success: true, data: { token } });
};

// Middleware chain
route.post(
  "/auth/login",
  correlationIdMiddleware(),
  tenantResolverMiddleware(),
  licenseEnforcementMiddleware(),
  schemaVersionMiddleware(),
  rateLimitMiddleware({
    endpoints: ["auth:login"],
    limits: {
      "auth:ip": { rate: 5, window: 60_000 },
      "auth:user": { rate: 5, window: 60_000 },
      "auth:workspace": { rate: 10, window: 60_000 },
    },
  }),
  loginHandler,
);
```

**Rate Limit Keys:**

- `rate:auth:ip:{client_ip}` (5 attempts / 60s)
- `rate:auth:user:{user_id}:{workspace_slug}` (5 attempts / 60s)
- `rate:auth:workspace:{workspace_slug}` (10 attempts / 60s)

**Error Response (429):**

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many login attempts. Please try again after 45 seconds.",
    "details": {
      "limit": 5,
      "window_seconds": 60,
      "retry_after_seconds": 45
    },
    "correlationId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

**HTTP Headers:**

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 45
X-Rate-Limit-Limit: 5
X-Rate-Limit-Remaining: 0
X-Rate-Limit-Reset: 1645215600
Content-Type: application/json
```

#### Attempt Endpoints

**Endpoint:** `POST /attempt/{id}/submit`

```typescript
handler: async (c: Context) => {
  const requestId = c.state.requestId;
  const workspace = c.state.workspace;
  const userId = c.state.userId;

  const { attemptId } = c.req.param();
  const body = await c.req.json();
  const { answers, idempotency_key } = body;

  // Validate attempt exists and belongs to user
  const attempt = await db.attempts.findOne({
    where: { id: attemptId, workspace_id: workspace.id, user_id: userId },
  });

  if (!attempt) return c.json({ error: "ATTEMPT_NOT_FOUND" }, 404);
  if (attempt.status !== "IN_PROGRESS") return c.json({ error: "ATTEMPT_NOT_IN_PROGRESS" }, 409);

  // Fast path: Check Redis cache
  const cacheKey = `idempotent:attempt:${attemptId}:${idempotency_key}`;
  const cached = await redis.get(cacheKey);

  if (cached) {
    logger.info({
      event: "idempotent_submission_cache_hit",
      correlation_id: requestId,
      workspace_id: workspace.id,
      attempt_id: attemptId,
      cache_age_ms: Date.now() - JSON.parse(cached).cached_at,
    });
    return c.json({ success: true, data: JSON.parse(cached) });
  }

  // DB transaction: Safe path
  const result = await db.transaction(async (trx) => {
    // Acquire row lock
    const lockedAttempt = await trx.attempts.findOne({ where: { id: attemptId } }).forUpdate();

    // Verify still in progress
    if (lockedAttempt.status !== "IN_PROGRESS") {
      throw new Error("ATTEMPT_STATE_CHANGED");
    }

    // Check if idempotency key already processed
    const existing = await trx.raw(sql`
      SELECT submission_cached_result
      FROM attempts
      WHERE id = ${attemptId}
        AND idempotent_submission_key = ${idempotency_key}
      LIMIT 1
    `);

    if (existing.length > 0) {
      logger.info({
        event: "idempotent_submission_db_hit",
        correlation_id: requestId,
        workspace_id: workspace.id,
        attempt_id: attemptId,
      });
      return existing[0].submission_cached_result;
    }

    // Step 4: Enqueue grading job to Worker (asynchronous)
    // WORKER-ONLY AUTHORITY: Worker is sole grading executor
    const jobId = crypto.randomUUID();
    await jobQueue.enqueue({
      job_id: jobId,
      type: "grade_attempt",
      workspace_id: workspace.id,
      workspace_slug: workspace.slug,
      attempt_id: attemptId,
      user_id: userId,
      correlation_id: requestId,
      payload: {
        attempt_id: attemptId,
        answers: answers,
        idempotency_key: idempotency_key,
      },
      created_at: new Date(),
      scheduled_for: new Date(), // Execute immediately
    });

    logger.info({
      event: "grading_job_enqueued",
      correlation_id: requestId,
      workspace_id: workspace.id,
      attempt_id: attemptId,
      job_id: jobId,
    });

    // Step 5: Wait for worker to complete (with timeout)
    // API does NOT grade; only orchestrates the worker job
    const gradingResult = await jobQueue.waitForCompletion(jobId, {
      timeout: 30_000, // 30 second max wait
      pollInterval: 500, // Check every 500ms
    });

    if (!gradingResult) {
      // Worker timeout: return 504 Gateway Timeout
      logger.warn({
        event: "grading_job_timeout",
        correlation_id: requestId,
        attempt_id: attemptId,
        job_id: jobId,
      });

      // Worker will continue processing; result will appear later
      // For now, return error to client
      return c.json(
        {
          error: {
            code: "GRADING_TIMEOUT",
            message: "Grading took too long. Please refresh to check status.",
            details: { estimated_wait_ms: 30000 },
            correlationId: requestId,
          },
        },
        504,
      );
    }

    // Step 6: Store result (worker has processed; API just persists)
    await trx.attempts.update(
      { id: attemptId },
      {
        status: "COMPLETED",
        submission_cached_result: gradingResult,
        submission_cached_at: new Date(),
        idempotent_submission_key: idempotency_key,
      },
    );

    return gradingResult;
  });

  // Cache in Redis (24h TTL)
  await redis.setex(
    cacheKey,
    24 * 60 * 60,
    JSON.stringify({
      ...result,
      cached_at: Date.now(),
    }),
  );

  logger.info({
    event: "attempt_submission_successful",
    correlation_id: requestId,
    workspace_id: workspace.id,
    attempt_id: attemptId,
    user_id: userId,
    duration_ms: Date.now() - startTime,
  });

  return c.json({ success: true, data: result });
};

route.post(
  "/attempt/:id/submit",
  correlationIdMiddleware(),
  tenantResolverMiddleware(),
  licenseEnforcementMiddleware(),
  schemaVersionMiddleware(),
  rateLimitMiddleware({
    endpoints: ["attempt:submit"],
    limits: { "attempt:submit": { rate: 1, window: 60_000 } },
  }),
  submitHandler,
);
```

**Request Validation:**

```typescript
const submitSchema = z.object({
  answers: z.array(
    z.object({
      question_id: z.string().uuid(),
      answer: z.unknown(),
    }),
  ),
  idempotency_key: z
    .string()
    .uuid()
    .optional()
    .transform((v) => v || crypto.randomUUID()),
});

// Reject if missing idempotency_key
if (!idempotency_key) {
  return c.json(
    {
      error: {
        code: "MISSING_IDEMPOTENCY_KEY",
        message: "idempotency_key is required for attempt submission (UUID v4)",
        details: null,
        correlationId: requestId,
      },
    },
    400,
  );
}
```

#### WebSocket Endpoint

**Endpoint:** `GET /ws/attempt/{id}`

```typescript
handler: async (c: Context) => {
  const workspace = c.state.workspace;
  const userId = c.state.userId;
  const { attemptId } = c.req.param();

  // Extract JWT from Authorization header
  const authHeader = c.req.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "");

  if (!token) {
    return c.websocket({
      onOpen: (ws) => ws.close(1008, "No authorization token"),
    });
  }

  // Validate JWT
  let decoded;
  try {
    decoded = await verifyJWT(token);
  } catch (e) {
    return c.websocket({
      onOpen: (ws) => ws.close(1008, "Invalid token"),
    });
  }

  // Cross-check workspace and attempt
  if (decoded.workspace_id !== workspace.id) {
    return c.websocket({
      onOpen: (ws) => ws.close(1008, "Workspace mismatch"),
    });
  }

  if (decoded.attempt_id !== attemptId) {
    return c.websocket({
      onOpen: (ws) => ws.close(1008, "Attempt ID mismatch"),
    });
  }

  // Check rate limiting: max 1 connection per user per attempt
  const connectionKey = `rate:ws:${userId}:${attemptId}`;
  const existingConnection = await redis.get(connectionKey);

  if (existingConnection) {
    return c.websocket({
      onOpen: (ws) => ws.close(4029, "Only one connection per attempt allowed"),
    });
  }

  // Accept connection
  return c.websocket({
    onOpen: (ws) => {
      logger.info({
        event: "ws_connection_opened",
        attempt_id: attemptId,
        user_id: userId,
      });

      // Mark connection in Redis
      redis.setex(connectionKey, 30 * 60, "1"); // 30 minute max session

      // Start heartbeat
      const heartbeatInterval = setInterval(() => {
        ws.send(JSON.stringify({ type: "pong" }));
      }, 30_000);

      // Store references for cleanup
      ws._heartbeatInterval = heartbeatInterval;
      ws._connectionKey = connectionKey;
    },

    onMessage: (ws, message) => {
      const msg = JSON.parse(message);

      // Rate limit: 100 messages/60s
      const rateLimitKey = `rate:ws:msg:${userId}:${attemptId}`;
      // Implement sliding window (details in Redis Schema section)

      if (msg.type === "ping") {
        ws.send(JSON.stringify({ type: "pong" }));
      } else if (msg.type === "answer_change") {
        // Broadcast to client (no persistence needed)
        logger.debug({ event: "ws_answer_change", attempt_id: attemptId });
      }
    },

    onClose: (ws) => {
      logger.info({ event: "ws_connection_closed", attempt_id: attemptId });

      // Cleanup
      clearInterval(ws._heartbeatInterval);
      redis.del(ws._connectionKey);

      // Auto-finalize if connection lost for 30+ seconds
      // (Handled by scheduler, not here)
    },

    onError: (ws, error) => {
      logger.error({
        event: "ws_error",
        attempt_id: attemptId,
        error: error.message,
      });
      ws.close(1011, "Internal error");
    },
  });
};

route.get(
  "/ws/attempt/:id",
  correlationIdMiddleware(),
  tenantResolverMiddleware(),
  licenseEnforcementMiddleware(),
  // Note: Rate limiting applied INSIDE the WebSocket handler
  wsHandler,
);
```

**WebSocket Close Codes:**

- `1008`: Policy violation (unauthorized, workspace mismatch)
- `4000`: Going away (old connection replaced by new one)
- `4001`: Token expired
- `4029`: Rate limit exceeded
- `1011`: Internal error

---

## 5. Redis Schema

### Key Structure & Patterns

All Redis keys follow the pattern: `{prefix}:{endpoint}:{identifier}`

### Authentication Rate Limiting

**Key:** `rate:auth:ip:{client_ip}`

- Type: Integer counter
- TTL: 86,400 seconds (24 hours)
- Increment: 1 per failed login
- Reset: On successful login or TTL expiration
- Example: `rate:auth:ip:192.168.1.1` → `5`

**Key:** `rate:auth:user:{user_id}:{workspace_slug}`

- Type: Integer counter
- TTL: 86,400 seconds (24 hours)
- Increment: 1 per failed login attempt
- Reset: On successful login or TTL expiration
- Example: `rate:auth:user:f47ac10b-58cc-4372:example-workspace` → `3`

**Key:** `rate:auth:workspace:{workspace_slug}`

- Type: Integer counter
- TTL: 86,400 seconds
- Increment: 1 per failed login attempt in workspace
- Purpose: Detect distributed brute force across user accounts
- Example: `rate:auth:workspace:example-workspace` → `15`

**Key:** `lock:user:account:{user_id}`

- Type: String (lock reason)
- TTL: 60/300/900 seconds (1min/5min/15min exponential backoff)
- Value: `"locked_until_2026-02-19T10:15:00Z"`
- Purpose: Account lockout after 5 failed attempts
- Example: `lock:user:account:f47ac10b-58cc-4372` → `"locked_until_2026-02-19T10:15:00Z"`

### Attempt Submission Rate Limiting

**Key:** `rate:attempt:start:user:{user_id}`

- Type: Integer counter
- TTL: 86,400 seconds
- Increment: 1 per attempt start
- Limit: 5 per user per 60 seconds
- Example: `rate:attempt:start:user:f47ac10b-58cc-4372` → `4`

**Key:** `rate:attempt:submit:{attempt_id}`

- Type: Integer counter
- TTL: Attempt lifetime (validity of exam)
- Increment: 1 per submission attempt
- Limit: 1 per attempt (enforced by DB transaction + constraint)
- Example: `rate:attempt:submit:a1b2c3d4-e5f6-7890-abcd-ef1234567890` → `1`

### Idempotent Submission Caching

**Key:** `idempotent:attempt:{attempt_id}:{idempotency_key}`

- Type: JSON string
- TTL: 86,400 seconds (24 hours)
- Value: `{ "score": 85, "feedback": "...", "cached_at": timestamp }`
- Purpose: Fast replay of duplicate submissions
- Example: `idempotent:attempt:a1b2c3d4:uuid-v4` → `{"score":85,"cached_at":1645215600000}`

**Storage Size:** ~500 bytes per cached result **Expected Volume:** 1M cached submissions × 500
bytes = 500MB per day (reasonable for typical workload)

### WebSocket Connection Tracking

**Key:** `rate:ws:{user_id}:{attempt_id}`

- Type: String (sentinal value)
- TTL: 1,800 seconds (30 minutes, session lifetime)
- Value: `"1"` (arbitrary)
- Purpose: Prevent duplicate WebSocket connections
- Example: `rate:ws:f47ac10b-58cc-4372:a1b2c3d4` → `"1"`

**Key:** `rate:ws:msg:{user_id}:{attempt_id}`

- Type: ZSET (sorted set for sliding window)
- TTL: 61 seconds (window + 1 second buffer)
- Entries: `{ timestamp: 1, timestamp: 1, ... }` (up to 10 latest messages)
- Purpose: Track message rate (100 msgs/60s)
- Example: `rate:ws:msg:user-id:attempt-id` → `{ 1645215600000: 1, 1645215601000: 1 }`

**Sliding Window Algorithm:**

```
current_time = now()
window_start = current_time - 60_000  // 60 seconds ago

// Remove messages outside window
ZREMRANGEBYSCORE key 0 window_start

// Get message count
count = ZCARD key

// If count >= 100 → reject message (rate limit exceeded)
if count >= 100:
  return 429_RATE_LIMIT_EXCEEDED

// Add current message
ZADD key current_time 1

// Set expiration (sliding window + buffer)
EXPIRE key 61
```

### Admin Action Rate Limiting

**Key:** `rate:admin:{user_id}:{workspace_slug}`

- Type: Integer counter
- TTL: 86,400 seconds
- Increment: 1 per admin request
- Limit: 20 per user per 60 seconds per workspace
- Example: `rate:admin:f47ac10b:example-workspace` → `8`

### Prefix Isolation (Multi-Tenancy)

**Global Key Prefix:** `zidney:tenant:{workspace_slug}`

Example full key: `zidney:tenant:example-workspace:rate:auth:ip:192.168.1.1`

This ensures:

- Different workspaces don't conflict
- Easy scanning by workspace for analytics
- Clean Redis key namespace

### Redis Memory Management

**Expected Memory Usage (per workspace):**

| Component               | Count          | Size      | Total          |
| ----------------------- | -------------- | --------- | -------------- |
| Auth rate limit keys    | 1,000/day      | 50 bytes  | 50 KB          |
| Attempt submission keys | 10,000/day     | 50 bytes  | 500 KB         |
| Idempotent cache        | 5,000/day      | 500 bytes | 2.5 MB         |
| WebSocket connections   | 100 concurrent | 100 bytes | 10 KB          |
| Message rate keys       | 100 concurrent | 1 KB      | 100 KB         |
| **Daily Total**         |                |           | **3.2 MB/day** |
| **Peak (30 days)**      |                |           | **96 MB**      |

**Redis Configuration:**

```conf
# Eviction policy: Least Recently Used (LRU)
maxmemory 1gb
maxmemory-policy allkeys-lru

# Persistence (optional, for audit)
appendonly no

# Keyspace notifications (for monitoring)
notify-keyspace-events Ex
```

### Key Expiration Strategy

- **24-hour keys** (auth, admin): Refresh on activity
- **Session keys** (WebSocket): Manually cleaned on disconnect
- **Idempotent cache**: Expires after 24 hours (or attempt deadline, whichever is sooner)
- **Sliding window keys**: Auto-expire after 61 seconds

**Cleanup Task (optional):**

```typescript
// Runs hourly to clean stale keys
async function cleanupStaleKeys() {
  const keys = await redis.keys("zidney:tenant:*:rate:*:lock:*");
  for (const key of keys) {
    const ttl = await redis.ttl(key);
    if (ttl === -1) {
      // No expiration set
      await redis.del(key);
    }
  }
  logger.info({ event: "redis_cleanup_complete", keys_checked: keys.length });
}
```

---

## 6. Middleware Stack

### Middleware Execution Order (Authoritative)

```
Request
  ↓
[1] Correlation ID Middleware
    → Generates request UUID or uses X-Request-ID header
    → Sets c.state.requestId
  ↓
[2] Tenant Resolver Middleware
    → Extracts workspace from subdomain/path
    → Sets c.state.workspace (workspace_id, workspace_slug)
    → Returns 404 if workspace not found
  ↓
[3] License Enforcement Middleware
    → Validates license status (ACTIVE/SOFT_LOCKED/ARCHIVED)
    → Returns 423 (Soft Locked) or 403 (Archived)
    → Sets c.state.license
  ↓
[4] Schema Version Middleware
    → Validates tenant schema >= app schema version
    → Returns 426 if schema outdated
    → Prevents use of missing columns
  ↓
[5] Rate Limiting Middleware
    → Checks Redis rate limit counters
    → Returns 429 if limit exceeded
    → Increments counters on pass
  ↓
[6] Route Handler
    → Executes business logic
    → Access to c.state.requestId, c.state.workspace, etc.
  ↓
Response
```

**No exceptions allowed:** Every authenticated route MUST execute all 5 middleware in order.

### Implementation (Pseudocode)

```typescript
// Middleware 1: Correlation ID
export const correlationIdMiddleware = () => {
  return async (c: Context, next: Next) => {
    let requestId = c.req.headers.get("X-Request-ID");
    if (!requestId) {
      requestId = crypto.randomUUID();
    }

    c.state.requestId = requestId;
    c.state.startTime = Date.now();

    await next();

    // Add to response headers
    c.header("X-Request-ID", requestId);
  };
};

// Middleware 2: Tenant Resolver
export const tenantResolverMiddleware = () => {
  return async (c: Context, next: Next) => {
    const requestId = c.state.requestId;

    // Extract workspace from subdomain or path
    const host = c.req.headers.get("Host");
    const subdomain = host?.split(".")[0];
    const path = c.req.path.split("/")[1];

    const workspaceSlug = subdomain || path;

    // Resolve workspace
    const workspace = await db.workspaces.findOne({
      where: { slug: workspaceSlug },
    });

    if (!workspace) {
      logger.warn({
        event: "workspace_not_found",
        correlation_id: requestId,
        workspace_slug: workspaceSlug,
      });
      return c.json({ error: "WORKSPACE_NOT_FOUND" }, 404);
    }

    c.state.workspace = workspace;

    await next();
  };
};

// Middleware 3: License Enforcement
export const licenseEnforcementMiddleware = () => {
  return async (c: Context, next: Next) => {
    const requestId = c.state.requestId;
    const workspace = c.state.workspace;

    // Fetch license
    const license = await db.licenses.findOne({
      where: { workspace_id: workspace.id },
    });

    if (!license) {
      logger.warn({
        event: "license_not_found",
        correlation_id: requestId,
        workspace_id: workspace.id,
      });
      return c.json({ error: "WORKSPACE_ARCHIVED" }, 403);
    }

    // Check status
    if (license.status === "SOFT_LOCKED") {
      logger.info({
        event: "license_soft_locked",
        correlation_id: requestId,
        workspace_id: workspace.id,
      });
      return c.json(
        {
          error: {
            code: "SOFT_LOCKED",
            message: "Workspace maintenance in progress",
            details: { status: "SOFT_LOCKED", next_check_seconds: 300 },
            correlationId: requestId,
          },
        },
        423,
      );
    }

    if (license.status === "ARCHIVED") {
      return c.json(
        {
          error: {
            code: "ARCHIVED",
            message: "Workspace is archived",
            details: null,
            correlationId: requestId,
          },
        },
        403,
      );
    }

    c.state.license = license;

    await next();
  };
};

// Middleware 4: Schema Version
export const schemaVersionMiddleware = () => {
  return async (c: Context, next: Next) => {
    const workspace = c.state.workspace;
    const requestId = c.state.requestId;

    // Get schema version for this tenant
    const schema = await db.tenantDb(workspace.id).query.schemaVersion.findFirst();

    const appVersion = "1.1.0"; // App supports this version
    const tenantVersion = schema?.version || "1.0.0";

    if (!isCompatible(tenantVersion, appVersion)) {
      logger.warn({
        event: "schema_version_incompatible",
        correlation_id: requestId,
        workspace_id: workspace.id,
        tenant_version: tenantVersion,
        app_version: appVersion,
      });
      return c.json(
        {
          error: {
            code: "SCHEMA_INCOMPATIBLE",
            message: "Workspace needs upgrade",
            details: {
              tenant_version: tenantVersion,
              app_version: appVersion,
              action: "contact_administrator",
            },
            correlationId: requestId,
          },
        },
        426,
      );
    }

    c.state.schemaVersion = tenantVersion;

    await next();
  };
};

// Middleware 5: Rate Limiting
export const rateLimitMiddleware = (config: RateLimitConfig) => {
  return async (c: Context, next: Next) => {
    const requestId = c.state.requestId;
    const workspace = c.state.workspace;
    const route = c.req.path;

    // Determine which rate limit applies to this route
    const limitKey = config.endpoints.find((ep) => route.includes(ep.split(":")[0]));

    if (!limitKey) {
      // Route has no rate limit, proceed
      await next();
      return;
    }

    const limit = config.limits[limitKey];
    const identifiers = getIdentifiers(c, workspace); // IP, user_id, workspace_id

    // Check rate limits
    for (const [type, id] of Object.entries(identifiers)) {
      const counter = await redis.get(`rate:${limitKey}:${type}:${id}`);
      const count = parseInt(counter || "0");

      if (count >= limit.rate) {
        logger.warn({
          event: "rate_limit_exceeded",
          correlation_id: requestId,
          workspace_id: workspace.id,
          endpoint: limitKey,
          count,
          limit: limit.rate,
        });
        return c.json(
          {
            error: {
              code: "RATE_LIMIT_EXCEEDED",
              message: `Too many requests (${limit.rate}/${limit.window}ms)`,
              details: {
                limit: limit.rate,
                window_ms: limit.window,
                current_count: count,
                retry_after_seconds: Math.ceil(limit.window / 1000),
              },
              correlationId: requestId,
            },
          },
          429,
        );
      }
    }

    // Increment counters
    for (const [type, id] of Object.entries(identifiers)) {
      const key = `rate:${limitKey}:${type}:${id}`;
      await redis.incr(key);
      await redis.expire(key, Math.ceil(limit.window / 1000));
    }

    await next();
  };
};
```

---

## 7. Transaction Boundaries

### Critical Operations Requiring Transactions

#### Operation 1: Attempt Submission

**Transaction Type:** SERIALIZABLE  
**Isolation Level:** SERIALIZABLE (strictest)  
**Concurrency Control:** FOR UPDATE lock

```typescript
async function submitAttempt(
  db: Database,
  attemptId: string,
  answers: Answer[],
  idempotencyKey: string,
): Promise<GradingResult> {
  const startTime = Date.now();

  return await db.transaction(
    async (trx) => {
      // Step 1: Acquire exclusive lock on attempt row
      const attempt = await trx.attempts.findOne({ where: { id: attemptId } }).forUpdate(); // SQL: SELECT ... FOR UPDATE

      // Step 2: Verify state hasn't changed
      if (attempt.status !== "IN_PROGRESS") {
        throw new Error(`ATTEMPT_STATE_CHANGED: status=${attempt.status}`);
      }

      // Step 3: Check if idempotency key already processed
      if (
        attempt.idempotent_submission_key === idempotencyKey &&
        attempt.submission_cached_at !== null
      ) {
        // Duplicate detected—return cached result
        logger.info({
          event: "duplicate_submission_detected",
          attempt_id: attemptId,
          duplicate_age_ms: Date.now() - attempt.submission_cached_at.getTime(),
        });
        return attempt.submission_cached_result;
      }

      // Step 4: Execute grading logic
      const gradingResult = await gradeAttempt(attemptId, answers, trx);

      // Step 5: Update attempt with result
      await trx.attempts.update(
        { id: attemptId },
        {
          status: "COMPLETED",
          submission_cached_result: gradingResult,
          submission_cached_at: new Date(),
          idempotent_submission_key: idempotencyKey,
          final_score: gradingResult.score,
        },
      );

      // Step 6: Insert audit record
      await trx.attemptAudit.insert({
        attempt_id: attemptId,
        event_type: "SUBMISSION",
        details: { score: gradingResult.score },
        created_at: new Date(),
      });

      // Transaction commits here (implicit)
      return gradingResult;
    },
    {
      isolationLevel: "SERIALIZABLE",
      timeout: 5000, // 5 second timeout
    },
  );
}
```

**Rollback Scenario:**

- If grading fails → DB rolls back submission
- If attempt state changed during transaction → Rolls back and returns error
- If idempotency key constraint violated → DB prevents duplicate insert

**Lock Timeout Behavior:**

- If lock cannot be acquired within 3 seconds → Throw error
- Client receives 500 with `ATTEMPT_LOCK_TIMEOUT`
- Client should retry with exponential backoff

#### Operation 2: User Account Lock

**Transaction Type:** Simple  
**Isolation Level:** READ_COMMITTED  
**Concurrency Control:** UNIQUE constraint

```typescript
async function lockUserAccount(
  db: Database,
  userId: string,
  workspaceId: string,
  reason: string,
): Promise<void> {
  // No transaction needed—Redis lock is atomic
  const lockKey = `lock:user:account:${userId}:${workspaceId}`;
  const lockUntil = new Date(Date.now() + 60_000); // 1 minute

  const result = await redis.set(
    lockKey,
    JSON.stringify({ reason, locked_until: lockUntil.toISOString() }),
    {
      EX: 60, // 60 second TTL
      NX: true, // Only if doesn't exist
    },
  );

  if (result === null) {
    logger.info({
      event: "user_already_locked",
      user_id: userId,
      workspace_id: workspaceId,
    });
    return; // Already locked by another process
  }

  // Also update DB audit log (non-critical, may lose if failure)
  await db.auditLog
    .insert({
      user_id: userId,
      workspace_id: workspaceId,
      event: "ACCOUNT_LOCKED",
      details: { reason, locked_until: lockUntil },
      created_at: new Date(),
    })
    .catch((err) => {
      logger.error({ event: "audit_log_insert_failed", error: err.message });
      // Continue—audit log is not critical
    });
}
```

**Rollback Scenario:**

- Lock expires automatically after 60 seconds
- No explicit rollback needed (idempotent operation)

#### Operation 3: License Status Update

**Transaction Type:** Full  
**Isolation Level:** SERIALIZABLE  
**Concurrency Control:** Single writer (MMC only)

```typescript
async function updateLicenseStatus(
  db: Database,
  licenseId: string,
  newStatus: LicenseStatus,
  meta: object,
): Promise<void> {
  return await db.transaction(
    async (trx) => {
      // Step 1: Acquire lock on license row
      const license = await trx.licenses.findOne({ where: { id: licenseId } }).forUpdate();

      // Step 2: Validate state transition
      if (!isValidTransition(license.status, newStatus)) {
        throw new Error(`INVALID_STATUS_TRANSITION: ${license.status}→${newStatus}`);
      }

      // Step 3: Update license
      await trx.licenses.update(
        { id: licenseId },
        { status: newStatus, updated_at: new Date(), meta },
      );

      // Step 4: Insert audit record
      await trx.licenseAudit.insert({
        license_id: licenseId,
        old_status: license.status,
        new_status: newStatus,
        changed_at: new Date(),
      });

      // Step 5: Update schema version if needed
      if (newStatus === "ACTIVE") {
        const workspace = await trx.workspaces.findOne({
          where: { id: license.workspace_id },
        });

        await trx.tenantDb(workspace.id).raw(sql`
          UPDATE schema_versions SET version = '1.1.0' WHERE version < '1.1.0'
        `);
      }

      return;
    },
    {
      isolationLevel: "SERIALIZABLE",
      timeout: 10000,
    },
  );
}
```

**Rollback Scenario:**

- If validation fails → Rolls back immediately
- If audit insert fails → Rolls back entire operation
- Ensures license state never changes without audit record

### Transaction Isolation Levels

| Operation          | Isolation Level | Rationale                                     |
| ------------------ | --------------- | --------------------------------------------- |
| Attempt Submission | SERIALIZABLE    | Prevent concurrent submissions from same user |
| User Lock          | READ_COMMITTED  | Lock is in Redis, not DB                      |
| License Update     | SERIALIZABLE    | Prevent concurrent license changes            |
| Report Generation  | READ_COMMITTED  | Read-only, no consistency risk                |
| Grading            | REPEATABLE_READ | Prevent phantom reads of new questions        |

### Lock Acquisition Strategy

```
IF lock acquired immediately:
  → Execute transaction (fast path)
  → Expected: < 100ms

IF lock blocked:
  → Retry 1: wait 100ms
  → Retry 2: wait 200ms
  → Retry 3: wait 400ms
  → Max retries: 3 (total wait: 700ms)
  → If still blocked → return 500 with ATTEMPT_LOCK_TIMEOUT

Client behavior on timeout:
  → Exponential backoff
  → Recommend retry after 1-5 seconds
```

---

## 8. Worker Integration

### Grading Job Processing (Worker-Only Authority)

**CRITICAL:** Worker is the SOLE authority for grading execution. API is orchestrator only.

### Job Enqueueing Pattern

When a client submits answers:

1. API validates request and acquires attempt lock
2. API checks idempotency key (Redis cache)
3. **API does NOT grade** ← This is the key constraint
4. API enqueues `grade_attempt` job to Redis job queue
5. API waits for job completion (with timeout)
6. Worker dequeues job and executes grading logic
7. Worker stores result in database (or via callback to API)
8. API receives result and returns to client
9. If worker timeout → API returns 504, continues processing in background

### Job Schema

```typescript
interface GradeAttemptJob {
  job_id: string; // UUID
  type: "grade_attempt";
  workspace_id: string;
  workspace_slug: string;
  attempt_id: string;
  user_id: string;
  correlation_id: string; // Propagate from API request
  payload: {
    attempt_id: string;
    answers: Answer[];
    idempotency_key: string;
    config?: ExamConfig; // Optional overrides
  };
  created_at: Date;
  scheduled_for: Date; // When to execute
  retry_count?: number;
  max_retries?: number;
}
```

### Job Enqueueing (API Layer)

```typescript
// Inside POST /attempt/{id}/submit handler
// After acquiring lock but BEFORE grading

const jobId = crypto.randomUUID();
const job: GradeAttemptJob = {
  job_id: jobId,
  type: "grade_attempt",
  workspace_id: workspace.id,
  workspace_slug: workspace.slug,
  attempt_id: attemptId,
  user_id: userId,
  correlation_id: requestId,
  payload: {
    attempt_id: attemptId,
    answers: answers,
    idempotency_key: idempotencyKey,
  },
  created_at: new Date(),
  scheduled_for: new Date(),
  max_retries: 3,
};

// Enqueue to Redis (job queue)
await jobQueue.enqueue(job);

logger.info({
  event: "grading_job_enqueued",
  correlation_id: requestId,
  job_id: jobId,
  workspace_id: workspace.id,
  attempt_id: attemptId,
});

// Wait for completion or timeout
const gradingResult = await jobQueue.waitForCompletion(jobId, {
  timeout: 30_000, // 30 seconds max
  pollInterval: 500,
});
```

### Job Processing (Worker Layer)

```typescript
// In worker process

async function processGradeAttemptJob(job: GradeAttemptJob): Promise<GradingResult> {
  const { job_id, workspace_id, attempt_id, user_id, correlation_id, payload } = job;

  const startTime = Date.now();

  try {
    logger.info({
      event: "grading_job_started",
      correlation_id,
      job_id,
      workspace_id,
      attempt_id,
    });

    // Step 1: Acquire tenant DB connection
    const tenantDb = getOrCreateTenantDb(workspace_id);

    // Step 2: Load exam configuration and questions
    const exam = await tenantDb.exams.findOne({
      where: { id: attempt_id },
      // Use SNAPSHOT from attempt, not live config
    });

    // Step 3: Execute grading logic
    const gradingResult = await gradeAttempt(
      tenantDb,
      attempt_id,
      payload.answers,
      exam.grading_config,
    );

    // Step 4: Store graded result in DB
    await tenantDb.attempts.update(
      { id: attempt_id },
      {
        status: "COMPLETED",
        final_score: gradingResult.score,
        grading_result: gradingResult,
        graded_at: new Date(),
      },
    );

    // Step 5: Insert audit log
    await tenantDb.attemptAudit.insert({
      attempt_id,
      event: "GRADING_COMPLETE",
      details: { score: gradingResult.score },
      created_at: new Date(),
    });

    logger.info({
      event: "grading_job_completed",
      correlation_id,
      job_id,
      workspace_id,
      attempt_id,
      score: gradingResult.score,
      duration_ms: Date.now() - startTime,
    });

    // Step 6: Store result in Redis for API to retrieve
    const resultKey = `job:result:${job_id}`;
    await redis.setex(
      resultKey,
      3600, // 1 hour TTL
      JSON.stringify(gradingResult),
    );

    return gradingResult;
  } catch (error) {
    logger.error({
      event: "grading_job_failed",
      correlation_id,
      job_id,
      workspace_id,
      attempt_id,
      error_message: error.message,
      error_code: error.code,
      duration_ms: Date.now() - startTime,
    });

    throw error; // Let retry handler catch this
  }
}
```

### Job Completion Callback (Optional)

For long-running grading, worker can notify API via callback:

```typescript
// After grading completes, worker POSTs result back to API
await fetch("https://api.example.com/internal/jobs/" + jobId + "/complete", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Internal-Token": process.env.INTERNAL_API_KEY,
  },
  body: JSON.stringify({
    job_id: jobId,
    result: gradingResult,
    completed_at: new Date(),
  }),
});

logger.info({
  event: "job_completion_callback_sent",
  job_id: jobId,
});
```

API endpoint to receive callback:

```typescript
route.post("/internal/jobs/:jobId/complete", async (c) => {
  const jobId = c.req.param("jobId");
  const { result, completed_at } = await c.req.json();

  // Store result in Redis for waiting requests
  await redis.setex(`job:result:${jobId}`, 3600, JSON.stringify(result));

  logger.info({
    event: "job_completion_received",
    job_id: jobId,
  });

  return c.json({ success: true });
});
```

#### Schema

```sql
-- Table for jobs that fail permanently
CREATE TABLE dead_letter_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL,
  job_type VARCHAR(100) NOT NULL,
  workspace_id UUID NOT NULL,
  workspace_slug VARCHAR(255) NOT NULL,
  attempt_id UUID,
  user_id UUID,
  correlation_id UUID,

  -- Job metadata
  original_payload JSONB NOT NULL,
  error_message TEXT,
  error_stack TEXT,
  retry_count INT DEFAULT 0,
  max_retries INT DEFAULT 3,

  -- Timing
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  first_attempted_at TIMESTAMP WITH TIME ZONE,
  last_attempted_at TIMESTAMP WITH TIME ZONE,
  moved_to_dlq_at TIMESTAMP WITH TIME ZONE NOT NULL,

  -- Indexes
  CONSTRAINT fk_workspace FOREIGN KEY (workspace_id)
    REFERENCES workspaces(id),

  INDEX idx_dlq_workspace_time (workspace_id, created_at DESC),
  INDEX idx_dlq_job_type (job_type),
  INDEX idx_dlq_attempt (attempt_id),
  INDEX idx_dlq_moved_time (moved_to_dlq_at DESC)
);

-- Table for DLQ inspection/resolution audit
CREATE TABLE dlq_resolutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dlq_id UUID NOT NULL,
  resolved_by UUID,  -- User/process that resolved
  resolution_action VARCHAR(50),  -- 'retry', 'discard', 'manual_intervention'
  notes TEXT,
  resolved_at TIMESTAMP WITH TIME ZONE NOT NULL,

  CONSTRAINT fk_dlq FOREIGN KEY (dlq_id)
    REFERENCES dead_letter_queue(id)
);
```

#### Job Retry Logic (Pseudocode)

```typescript
async function processJob(job: Job): Promise<void> {
  const { job_id, type, workspace_id, data, retry_count = 0 } = job;
  const maxRetries = 3;

  try {
    // Execute job
    await executeJob(type, data);

    logger.info({
      event: "job_completed",
      job_id,
      job_type: type,
      workspace_id,
      retry_count,
      duration_ms: Date.now() - job.created_at.getTime(),
    });
  } catch (error) {
    retry_count++;

    logger.error({
      event: "job_failed",
      job_id,
      job_type: type,
      workspace_id,
      retry_count,
      error_message: error.message,
      error_code: error.code,
    });

    if (retry_count >= maxRetries) {
      // Move to DLQ
      await moveToDLQ(job, error, retry_count);

      // Alert ops team
      await sendAlert({
        level: "high",
        message: `Job ${job_id} moved to DLQ after ${maxRetries} retries`,
        workspace_id,
      });

      return;
    }

    // Calculate exponential backoff
    const backoffMs = Math.pow(2, retry_count - 1) * 1000; // 1s, 2s, 4s

    // Re-enqueue with backoff
    await jobQueue.enqueue(
      {
        ...job,
        retry_count,
        scheduled_for: new Date(Date.now() + backoffMs),
      },
      { delay: backoffMs },
    );

    logger.info({
      event: "job_requeued",
      job_id,
      retry_count,
      backoff_ms: backoffMs,
    });
  }
}

async function moveToDLQ(job: Job, error: Error, finalRetryCount: number): Promise<void> {
  await db.deadLetterQueue.insert({
    job_id: job.job_id,
    job_type: job.type,
    workspace_id: job.workspace_id,
    workspace_slug: job.workspace_slug,
    attempt_id: job.attempt_id,
    user_id: job.user_id,
    correlation_id: job.correlation_id,

    original_payload: job,
    error_message: error.message,
    error_stack: error.stack,
    retry_count: finalRetryCount,
    max_retries: 3,

    created_at: job.created_at,
    first_attempted_at: new Date(),
    last_attempted_at: new Date(),
    moved_to_dlq_at: new Date(),
  });
}
```

#### DLQ Monitoring and Alerts

```typescript
// Cron job: Every 5 minutes, check DLQ health
async function monitorDLQ() {
  const dlqCount = await db.deadLetterQueue
    .count()
    .where({ moved_to_dlq_at: '>': new Date(Date.now() - 3600_000) });
    // Count in last hour

  if (dlqCount > 10) {
    logger.error({
      event: 'dlq_threshold_exceeded',
      dlq_count: dlqCount,
      severity: 'high',
      action: 'alert_ops_team'
    });

    // Send Slack/PagerDuty alert
    await alertOpsTeam({
      channel: 'incident-alerts',
      message: `⚠️ DLQ has ${dlqCount} jobs (>10 threshold)`,
      severity: 'high',
      link: '/admin/dlq'
    });
  }
}

// DLQ Inspection endpoint
handler: async (c: Context) => {
  const workspace = c.state.workspace;

  const dlqJobs = await db.deadLetterQueue
    .findMany({
      where: { workspace_id: workspace.id },
      orderBy: { moved_to_dlq_at: 'desc' },
      limit: 100
    });

  return c.json({
    success: true,
    data: {
      total: dlqJobs.length,
      jobs: dlqJobs.map(job => ({
        id: job.id,
        job_type: job.job_type,
        attempt_id: job.attempt_id,
        error_message: job.error_message,
        retry_count: job.retry_count,
        moved_at: job.moved_to_dlq_at,
      }))
    }
  });
};
```

---

## 9. Error Code Mapping

### HTTP Status Codes

#### 429 Too Many Requests

**Trigger:** Rate limit exceeded

**Response:**

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please try again after 45 seconds.",
    "details": {
      "limit": 5,
      "window_seconds": 60,
      "retry_after_seconds": 45
    },
    "correlationId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

**Headers:**

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 45
X-Rate-Limit-Limit: 5
X-Rate-Limit-Remaining: 0
X-Rate-Limit-Reset: 1645215600
Content-Type: application/json
```

**Client Action:** Exponential backoff retry

---

#### 423 Locked

**Trigger:** License status is SOFT_LOCKED

**Response:**

```json
{
  "error": {
    "code": "WORKSPACE_SOFT_LOCKED",
    "message": "Workspace is temporarily locked for maintenance. Please try again in a few minutes.",
    "details": { "status": "SOFT_LOCKED", "next_check_seconds": 300 },
    "correlationId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

**Client Action:** Retry after 5 minutes

---

#### 426 Upgrade Required

**Trigger:** Schema version incompatible

**Response:**

```json
{
  "error": {
    "code": "SCHEMA_VERSION_INCOMPATIBLE",
    "message": "This workspace requires a schema upgrade. Contact your administrator.",
    "details": {
      "tenant_version": "1.0.0",
      "app_version": "1.1.0",
      "action": "contact_administrator"
    },
    "correlationId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

**Client Action:** Notify user; forward to admin panel for upgrade

---

#### 400 Bad Request

**Triggers:**

- Missing idempotency_key on attempt submission
- Invalid request body
- Payload size exceeds limit

**Response (Missing idempotency_key):**

```json
{
  "error": {
    "code": "MISSING_IDEMPOTENCY_KEY",
    "message": "idempotency_key is required for attempt submission (UUID v4)",
    "details": null,
    "correlationId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

**Response (Payload too large):**

```json
{
  "error": {
    "code": "PAYLOAD_TOO_LARGE",
    "message": "Request body exceeds 1 MB limit",
    "details": {
      "limit_bytes": 1048576,
      "received_bytes": 1258291
    },
    "correlationId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

---

#### 403 Forbidden

**Triggers:**

- Cross-workspace token mismatch
- User lacks permission
- Workspace archived

**Response (Cross-workspace):**

```json
{
  "error": {
    "code": "WORKSPACE_MISMATCH",
    "message": "Your token is not valid for this workspace",
    "details": {
      "workspace_mismatch_reason": "JWT workspace_id != requested workspace_id"
    },
    "correlationId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

---

#### 404 Not Found

**Triggers:**

- Attempt not found
- Workspace not found
- User not found

**Response:**

```json
{
  "error": {
    "code": "ATTEMPT_NOT_FOUND",
    "message": "Attempt does not exist",
    "details": null,
    "correlationId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

---

#### 409 Conflict

**Triggers:**

- Attempt already started
- Attempt already completed
- Attempt state changed unexpectedly

**Response:**

```json
{
  "error": {
    "code": "ATTEMPT_ALREADY_COMPLETED",
    "message": "This attempt has already been submitted",
    "details": {
      "current_status": "COMPLETED",
      "allowed_status": "IN_PROGRESS"
    },
    "correlationId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

---

#### 410 Gone

**Triggers:**

- Attempt deadline exceeded
- WebSocket connection expired
- Server time past attempt end time + grace period

**Response:**

```json
{
  "error": {
    "code": "ATTEMPT_EXPIRED",
    "message": "This attempt has expired",
    "details": {
      "deadline": "2026-02-19T14:30:00Z",
      "grace_period_seconds": 300,
      "expired_seconds_ago": 45
    },
    "correlationId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

---

#### 500 Internal Server Error

**Triggers:**

- Unhandled exception
- Database error
- Lock acquisition timeout

**Response:**

```json
{
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "An unexpected error occurred. Please contact support.",
    "details": null,
    "correlationId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

**Logging:** Full stack trace logged with correlation_id

---

#### 503 Service Unavailable

**Triggers:**

- Redis unavailable (required for rate limiting)
- Database unavailable
- Worker queue backed up

**Response:**

```json
{
  "error": {
    "code": "SERVICE_UNAVAILABLE",
    "message": "Service temporarily unavailable. Please try again in a few seconds.",
    "details": { "unavailable_service": "worker_queue" },
    "correlationId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

---

### WebSocket Close Codes

| Code | Meaning                | Action                             |
| ---- | ---------------------- | ---------------------------------- |
| 1000 | Normal Closure         | Client disconnected normally       |
| 1001 | Going Away             | Server shutting down               |
| 1008 | Policy Violation       | Unauthorized, workspace mismatch   |
| 1011 | Internal Error         | Unhandled server error             |
| 4000 | Going Away (Custom)    | Old connection replaced by new one |
| 4001 | Token Expired (Custom) | JWT expired during session         |
| 4029 | Rate Limit (Custom)    | Message rate limit exceeded        |

---

## 9. Security Headers

### Mandatory HTTP Headers (All Responses)

```http
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Content-Security-Policy: default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'
X-Request-ID: {correlation-id}
```

### Middleware Implementation

```typescript
export const securityHeadersMiddleware = () => {
  return async (c: Context, next: Next) => {
    await next();

    // Always set security headers
    c.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
    c.header("X-Content-Type-Options", "nosniff");
    c.header("X-Frame-Options", "DENY");
    c.header("Referrer-Policy", "strict-origin-when-cross-origin");
    c.header(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'",
    );
    c.header("X-Request-ID", c.state.requestId);
  };
};
```

### CORS Configuration

#### Development

```typescript
const corsConfig =
  process.env.NODE_ENV === "development"
    ? {
        origin: ["http://localhost:3000", "http://localhost:3001"],
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token"],
      }
    : {
        origin: "https://app.example.com",
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token"],
      };

app.use(cors(corsConfig));
```

**Rule:** Never allow `Access-Control-Allow-Origin: *` with credentials.

### CSRF Protection

#### Enabling CSRF

```typescript
// On login, issue CSRF token
POST /auth/login
Response:
{
  "success": true,
  "data": {
    "access_token": "...",
    "csrf_token": "..."
  }
}

// Set cookie
Set-Cookie: __csrf_token={token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=3600
```

#### CSRF Validation Middleware

```typescript
export const csrfMiddleware = () => {
  return async (c: Context, next: Next) => {
    // Only validate for state-changing requests (POST, PUT, DELETE)
    if (!["POST", "PUT", "DELETE"].includes(c.req.method)) {
      await next();
      return;
    }

    // Skip for pure API routes (JWT-only)
    if (c.req.path.startsWith("/api/")) {
      await next();
      return;
    }

    const headerToken = c.req.headers.get("X-CSRF-Token");
    const cookieToken = c.cookies.get("__csrf_token");

    if (!headerToken || !cookieToken || headerToken !== cookieToken) {
      logger.warn({
        event: "csrf_validation_failed",
        correlation_id: c.state.requestId,
        has_header: !!headerToken,
        has_cookie: !!cookieToken,
        match: headerToken === cookieToken,
      });
      return c.json(
        {
          error: {
            code: "CSRF_VALIDATION_FAILED",
            message: "CSRF token invalid",
          },
        },
        403,
      );
    }

    await next();
  };
};
```

---

## 10. Logging Strategy

### Structured Logging Format

Every log entry must follow this schema:

```json
{
  "timestamp": "2026-02-19T10:15:30.123Z",
  "level": "info|warn|error|debug|critical",
  "service": "api|worker|auth",
  "correlation_id": "uuid-v4",
  "workspace_id": "uuid",
  "workspace_slug": "example-workspace",
  "user_id": "uuid (if authenticated)",
  "attempt_id": "uuid (if applicable)",
  "request_path": "/attempt/123/submit",
  "request_method": "POST",
  "http_status": 200,
  "event": "attempt_submission_successful",
  "message": "Attempt submitted and graded successfully",
  "duration_ms": 245,
  "details": {
    "score": 85,
    "question_count": 20,
    "cache_hit": false
  }
}
```

### What to Log

#### Rate Limit Events

```json
{
  "event": "rate_limit_exceeded",
  "level": "warn",
  "endpoint": "auth:login",
  "limit_type": "per_ip",
  "limit_count": 5,
  "current_count": 6,
  "identifier": "192.168.1.1",
  "action": "rejected"
}
```

#### Attempt Submission Events

```json
{
  "event": "attempt_submission_successful",
  "level": "info",
  "attempt_id": "...",
  "user_id": "...",
  "score": 85,
  "duration_ms": 245,
  "cache_hit": false,
  "idempotent_key": "uuid"
}
```

#### WebSocket Events

```json
{
  "event": "ws_connection_opened",
  "level": "info",
  "attempt_id": "...",
  "user_id": "...",
  "connection_id": "uuid"
}

{
  "event": "ws_message_rate_limit",
  "level": "warn",
  "attempt_id": "...",
  "message_count": 100,
  "limit": 100,
  "window_seconds": 60,
  "action": "rejected"
}
```

#### Security Events

```json
{
  "event": "cross_workspace_access_attempt",
  "level": "critical",
  "user_id": "...",
  "requested_workspace_id": "...",
  "actual_workspace_id": "...",
  "action": "rejected"
}

{
  "event": "jwt_validation_failed",
  "level": "warn",
  "reason": "expired",
  "workspace_id": "...",
  "user_id": "..."
}
```

#### Worker Events

```json
{
  "event": "job_failed",
  "level": "error",
  "job_id": "...",
  "job_type": "grade_attempt",
  "retry_count": 3,
  "error_message": "...",
  "action": "moved_to_dlq"
}
```

### What NOT to Log

❌ **Never log:**

- Passwords
- JWT tokens or secrets
- Database credentials
- API keys
- Credit card numbers
- Personal identification numbers
- Complete email addresses (mask: user+\*\*\*@domain)
- Answer content from exams (privacy)
- IP addresses (unless explicitly needed for security investigation)

### Correlation ID Propagation

```typescript
// Middleware 1: Generate correlation ID
const correlationId = ctx.request.headers.get('X-Request-ID') || crypto.randomUUID();
ctx.state.requestId = correlationId;

// Middleware 2-N: Include in all logs
logger.info({
  event: 'some_event',
  correlation_id: ctx.state.requestId,
  ...otherFields
});

// Worker: If enqueuing job from API
await queue.enqueue({
  ...jobPayload,
  correlation_id: ctx.state.requestId  // Propagate to worker
});

// Worker: Include when logging job
logger.info({
  event: 'job_completed',
  correlation_id: job.correlation_id,
  ...
});

// Response: Echo correlation ID
response.header('X-Request-ID', correlationId);
```

---

## 11. Testing Strategy

### Unit Tests

**File:** `apps/api/tests/unit/rate-limiter.test.ts`

```typescript
describe("Rate Limiter", () => {
  describe("sliding window counter", () => {
    test("increments counter on first request", async () => {
      const counter = await getRateLimitCounter("test:key");
      expect(counter).toBe(1);
    });

    test("expires after TTL", async () => {
      await setRateLimitCounter("test:key", 5, 1000); // 1 sec TTL
      await sleep(1100);
      const counter = await getRateLimitCounter("test:key");
      expect(counter).toBe(0);
    });

    test("multiple keys independent", async () => {
      await incrementRateLimit("key1", 5);
      await incrementRateLimit("key2", 3);
      expect(await getRateLimit("key1")).toBe(5);
      expect(await getRateLimit("key2")).toBe(3);
    });
  });

  describe("limit enforcement", () => {
    test("allows requests within limit", async () => {
      for (let i = 0; i < 5; i++) {
        const result = await checkRateLimit("auth:ip:192.168.1.1", {
          rate: 5,
          window: 60_000,
        });
        expect(result.allowed).toBe(true);
      }
    });

    test("rejects request over limit", async () => {
      for (let i = 0; i < 5; i++) {
        await checkRateLimit("auth:ip:192.168.1.1", { rate: 5, window: 60_000 });
      }
      const result = await checkRateLimit("auth:ip:192.168.1.1", {
        rate: 5,
        window: 60_000,
      });
      expect(result.allowed).toBe(false);
      expect(result.retryAfterMs).toBeCloseTo(60_000, -3);
    });
  });
});
```

**File:** `apps/api/tests/unit/idempotency.test.ts`

```typescript
describe("Idempotent Submission", () => {
  test("duplicate submission returns cached result", async () => {
    const attemptId = "test-attempt";
    const idempotencyKey = "uuid-v4";
    const answers = [{ question_id: "q1", answer: "A" }];

    const result1 = await submitAttempt(attemptId, idempotencyKey, answers);
    const result2 = await submitAttempt(attemptId, idempotencyKey, answers);

    expect(result1).toEqual(result2);
    expect(result1.score).toBe(result2.score);
  });

  test("different idempotency key processes normally", async () => {
    const attemptId = "test-attempt";
    const key1 = "key-1";
    const key2 = "key-2";
    const answers = [{ question_id: "q1", answer: "A" }];

    const result1 = await submitAttempt(attemptId, key1, answers);
    const result2 = await submitAttempt(attemptId, key2, answers);

    // Different keys should not interfere
    expect(result1.attempt_id).not.toEqual(result2.attempt_id);
  });

  test("duplicate submission with different answers returns original", async () => {
    const attemptId = "test-attempt";
    const key = "dedup-key";

    const result1 = await submitAttempt(attemptId, key, [{ question_id: "q1", answer: "A" }]);
    const result2 = await submitAttempt(attemptId, key, [{ question_id: "q1", answer: "B" }]);

    // Should return original grading, not re-grade
    expect(result1.score).toBe(result2.score);
  });
});
```

### Integration Tests

**File:** `apps/api/tests/integration/auth-rate-limit.test.ts`

```typescript
describe("Authentication Rate Limiting (E2E)", () => {
  test("locks account after 5 failed attempts", async () => {
    const email = "user@example.com";

    // 5 failed attempts
    for (let i = 0; i < 5; i++) {
      const response = await fetch("/auth/login", {
        method: "POST",
        body: { email, password: "wrong" },
      });
      expect(response.status).toBe(401);
    }

    // 6th attempt should be rejected
    const response = await fetch("/auth/login", {
      method: "POST",
      body: { email, password: "correct" },
    });
    expect(response.status).toBe(429);
    expect(response.body.error.code).toBe("RATE_LIMIT_EXCEEDED");
  });

  test("different IP not limited by same user lock", async () => {
    const email = "user@example.com";

    // 5 failed attempts from IP1
    for (let i = 0; i < 5; i++) {
      await fetch("/auth/login", {
        method: "POST",
        body: { email, password: "wrong" },
        headers: { "X-Forwarded-For": "192.168.1.1" },
      });
    }

    // IP2 should not be limited by IP1's attempts
    const response = await fetch("/auth/login", {
      method: "POST",
      body: { email, password: "wrong" },
      headers: { "X-Forwarded-For": "192.168.1.2" },
    });
    expect(response.status).toBe(401);
  });
});
```

**File:** `apps/api/tests/integration/attempt-submission.test.ts`

```typescript
describe('Attempt Submission Idempotency (E2E)', () => {
  test('duplicate submission returns cached result sub-100ms', async () => {
    const attemptId = 'test-attempt';
    const key = 'dedup-key';
    const answers = [{ question_id: 'q1', answer: 'A' }];

    const start1 = Date.now();
    const result1 = await submitAttempt(attemptId, key, answers);
    const duration1 = Date.now() - start1;

    const start2 = Date.now();
    const result2 = await submitAttempt(attemptId, key, answers);
    const duration2 = Date.now() - start2;

    expect(result1).toEqual(result2);
    expect(duration2).toBeLessThan(100);  // Cache hit sub-100ms
  });

  test('cross-workspace token rejected', async () => {
    const tokenForWorkspace1 = generateToken('workspace1');

    const response = await fetch(
      'https://workspace2.example.com/attempt/123/submit',
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${tokenForWorkspace1}` },
        body: { answers: [...] }
      }
    );

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('WORKSPACE_MISMATCH');
  });
});
```

**File:** `apps/api/tests/integration/websocket.test.ts`

```typescript
describe("WebSocket Security (E2E)", () => {
  test("unauthorized connection rejected", async () => {
    const ws = new WebSocket("ws://localhost:3000/ws/attempt/123");

    await new Promise((resolve) => {
      ws.addEventListener("close", (event) => {
        expect(event.code).toBe(1008); // Policy violation
        resolve(undefined);
      });
    });
  });

  test("one connection per attempt enforced", async () => {
    const token = generateToken();
    const ws1 = await connectWebSocket("ws://localhost:3000/ws/attempt/123", token);
    const ws2 = await connectWebSocket("ws://localhost:3000/ws/attempt/123", token);

    await new Promise((resolve) => {
      ws1.addEventListener("close", resolve);
    });

    expect(ws1.readyState).toBe(WebSocket.CLOSED);
    expect(ws2.readyState).toBe(WebSocket.OPEN);
  });

  test("message rate limit enforced", async () => {
    const ws = await connectWebSocket("ws://localhost:3000/ws/attempt/123", generateToken());

    // Send 110 messages rapidly
    for (let i = 0; i < 110; i++) {
      ws.send(JSON.stringify({ type: "ping" }));
    }

    await new Promise((resolve) => {
      ws.addEventListener("close", (event) => {
        expect(event.code).toBe(4029); // Rate limit
        resolve(undefined);
      });
    });
  });

  test("heartbeat timeout disconnects", async () => {
    const ws = await connectWebSocket("ws://localhost:3000/ws/attempt/123", generateToken());

    // Wait 31+ seconds without heartbeat
    await sleep(31_000);

    await new Promise((resolve) => {
      ws.addEventListener("close", resolve);
    });

    expect(ws.readyState).toBe(WebSocket.CLOSED);
  });
});
```

### Load Testing

**File:** `apps/api/tests/load/rate-limiter-load.ts`

```typescript
import { performance } from "perf_hooks";

async function loadTestRateLimiter() {
  const concurrency = 100;
  const duration = 60_000; // 60 seconds
  const startTime = Date.now();

  const results = {
    totalRequests: 0,
    successfulRequests: 0,
    rateLimitedRequests: 0,
    avgLatencyMs: 0,
    latencies: <number[]>[],
  };

  const makeRequest = async () => {
    const start = performance.now();
    const response = await fetch("/auth/login", {
      method: "POST",
      body: { email: `user-${Math.random()}@example.com`, password: "test" },
    });
    const latency = performance.now() - start;

    results.latencies.push(latency);
    results.totalRequests++;

    if (response.status === 429) {
      results.rateLimitedRequests++;
    } else if (response.status === 401) {
      results.successfulRequests++;
    }
  };

  // Run concurrent requests
  while (Date.now() - startTime < duration) {
    const batch = [];
    for (let i = 0; i < concurrency; i++) {
      batch.push(makeRequest());
    }
    await Promise.all(batch);
  }

  results.avgLatencyMs = results.latencies.reduce((a, b) => a + b) / results.latencies.length;

  console.log("Load Test Results:");
  console.log(`Total Requests: ${results.totalRequests}`);
  console.log(`Successful: ${results.successfulRequests}`);
  console.log(`Rate Limited: ${results.rateLimitedRequests}`);
  console.log(`Avg Latency: ${results.avgLatencyMs.toFixed(2)}ms`);
  console.log(`P95 Latency: ${percentile(results.latencies, 95)}ms`);
  console.log(`P99 Latency: ${percentile(results.latencies, 99)}ms`);
}
```

### Concurrency Testing

**File:** `apps/api/tests/concurrency/concurrent-submission.test.ts`

```typescript
describe("Concurrent Submission Safety", () => {
  test("concurrent submissions from same user handled safely", async () => {
    const attemptId = "test-attempt";
    const userId = "test-user";

    // Start 10 concurrent submissions
    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(submitAttempt(attemptId, `key-${i}`, [{ question_id: "q1", answer: "A" }]));
    }

    const results = await Promise.all(promises);

    // All should succeed without deadlock
    expect(results).toHaveLength(10);

    // All should have same score (same grading)
    const scores = results.map((r) => r.score);
    expect(new Set(scores).size).toBe(1); // All identical scores
  });

  test("concurrent duplicate submissions handled correctly", async () => {
    const attemptId = "test-attempt";
    const key = "dedup-key"; // Same key

    // Start 5 concurrent submissions with same idempotency key
    const promises = [];
    for (let i = 0; i < 5; i++) {
      promises.push(submitAttempt(attemptId, key, [{ question_id: "q1", answer: "A" }]));
    }

    const results = await Promise.all(promises);

    // All should return same result
    expect(results).toHaveLength(5);
    const firstResult = results[0];
    for (const result of results) {
      expect(result).toEqual(firstResult);
    }
  });
});
```

### Security Testing

**File:** `apps/api/tests/security/rate-limit-bypass.test.ts`

```typescript
describe("Rate Limit Bypass Attempts", () => {
  test("timing attack cannot bypass rate limit", async () => {
    // Attempt to bypass by changing request timing
    const timedRequests = [];
    for (let i = 0; i < 6; i++) {
      timedRequests.push(
        fetch("/auth/login", {
          method: "POST",
          body: { email: "user@example.com", password: "wrong" },
          headers: {
            "X-Forwarded-For": `192.168.${Math.floor(Math.random() * 255)}.1`,
          },
        }),
      );
    }

    const responses = await Promise.all(timedRequests);
    const rateLimitedCount = responses.filter((r) => r.status === 429).length;

    // At least one should be rate limited (depending on IP distribution)
    expect(rateLimitedCount).toBeGreaterThan(0);
  });
});
```

---

## 12. Non-Goals

This technical design does NOT cover:

- ❌ OAuth2 / SAML authentication
- ❌ IP geolocation blocking
- ❌ User behavior analytics
- ❌ DDoS mitigation at network level (WAF/CDN)
- ❌ Biometric authentication
- ❌ Multi-factor authentication (out of scope for Phase 1)
- ❌ API key management
- ❌ End-to-end encryption of answers
- ❌ Offline mode for attempted submissions

---

## 13. Constitutional Compliance

### Compliance Checklist

✅ **Isolation:** No cross-tenant rate limit state sharing. Each workspace has separate Redis keys
with tenant-aware naming.

✅ **License Enforcement:** Rate limiting middleware executes AFTER license validation. Soft-locked
workspaces receive 423 before rate checks.

✅ **Grading Authority:** Worker remains sole authority. Idempotency prevents duplicate submissions
but doesn't change grading logic.

✅ **Direct DB Instantiation:** Rate limiter uses centralized Redis pool (initialized at boot), not
tenant-specific connections.

✅ **Snapshot Integrity:** Idempotent submission mechanism protects attempt snapshots via FOR UPDATE
lock + UNIQUE constraint.

✅ **Transaction Boundaries:** All critical writes use SERIALIZABLE isolation with clear lock
strategy.

✅ **Version Enforcement:** Schema version check happens before rate limiting. Idempotent columns
required at schema_version 1.1.0+.

✅ **Versioning Backward Compatibility:** Old attempts without idempotent columns handled
gracefully. Feature flag tied to schema version.

✅ **Attempt Engine Immutability:** Rate limiting doesn't modify attempt configuration. Snapshot
integrity preserved.

✅ **Server-Authoritative Time:** All deadline checks use server time. Client time ignored for
authority.

✅ **No Secrets Exposed:** Passwords, tokens, and credentials never logged. Mask sensitive data in
all outputs.

✅ **Audit Trail:** All security events logged with correlation ID, workspace context, and
timestamp.

✅ **Multi-Tenancy Database Isolation:** Each tenant's rate limit state in separate Redis keys. No
shared buckets across tenants.

✅ **Middleware Order Immutable:** Correlation ID → Tenant Resolver → License → Schema Version →
Rate Limit. No exceptions.

✅ **Worker Resilience:** Dead-letter queue captures failures. Retry strategy prevents cascade
failures. Max 3 retries with exponential backoff.

✅ **Error Responses Consistent:** All errors follow standardized JSON structure with error code and
human-readable message.

---

## Implementation Plan Summary

### Phase 1: Database

- [ ] Create migration: `0008_add_idempotent_submission.ts`
- [ ] Add columns: `idempotent_submission_key`, `submission_cached_result`, `submission_cached_at`
- [ ] Create indexes: `idx_attempt_idempotent_key`, `idx_attempt_cached_result_time`
- [ ] Update schema_version to 1.1.0

### Phase 2: API Layer

- [ ] Implement rate limiting middleware (Redis-based sliding window)
- [ ] Add request validation for idempotency_key
- [ ] Implement attempt submission with DB transaction (SERIALIZABLE)
- [ ] Implement WebSocket rate limiting and connection management
- [ ] Add security headers middleware
- [ ] Implement CSRF protection for MMC/Backoffice

### Phase 3: Worker Integration

- [ ] Create dead_letter_queue table
- [ ] Implement job retry logic (exponential backoff)
- [ ] Implement DLQ monitoring and alerts
- [ ] Add job metadata tracking

### Phase 4: Testing

- [ ] Unit tests: Rate limiter, idempotency logic
- [ ] Integration tests: End-to-end flows
- [ ] Load tests: 10x concurrent requests
- [ ] Concurrency tests: Race condition detection
- [ ] Security tests: Bypass attempt detection

### Phase 5: Deployment

- [ ] Feature flag: Rate limiting (tied to schema version)
- [ ] Gradual rollout: 10% → 50% → 100%
- [ ] Monitoring: DLQ size, rate limit violations, cache hit rate
- [ ] Documentation: Rate limit thresholds, error codes, troubleshooting

---

## Design Quality Validation

### Sections Present: ✅ All Required

✅ Schema Changes  
✅ API Layer Design  
✅ Redis Schema  
✅ Middleware Stack  
✅ Transaction Boundaries  
✅ Worker Integration  
✅ Error Code Mapping  
✅ Security Headers  
✅ Logging Strategy  
✅ Testing Strategy  
✅ Non-Goals  
✅ Constitutional Compliance

### Completeness: ✅ READY FOR PLANNING PHASE

- All 10 technical sections requested by user are present and detailed
- Database schema changes fully specified with migration code
- API endpoints documented with request/response examples
- Redis key structure defined with TTL and data types
- Middleware execution order confirmed authoritative
- Transaction boundaries specified with isolation levels
- Worker integration with DLQ fully designed
- HTTP error codes mapped to specific scenarios
- Security headers specified per environment
- Logging schema with correlation ID propagation defined
- Testing strategy covers unit, integration, load, concurrency, and security
- Constitutional compliance verified against Zidney Constitution v1.2.0

---

## Approval & Sign-Off

**Plan Phase Completion:** YES ✅  
**Constitutional Compliance:** YES ✅  
**Ready for Implementation Phase:** YES ✅

This technical design plan is **COMPLETE** and **READY FOR IMPLEMENTATION**.

Next step: `generate-tasks` phase to create detailed implementation tasks.

---

**Date:** 2026-02-19  
**Phase:** 01_PLATFORM_FOUNDATION  
**Stage:** STAGE_08_RATE_LIMITING_AND_SECURITY  
**Status:** PLANNING PHASE COMPLETE ✅
