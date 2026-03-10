# PLAN – Authentication System Implementation (STAGE_03)

**Phase:** 1 – Platform Foundation  
**Stage:** STAGE_03_AUTHENTICATION_SYSTEM  
**Status:** Implementation Plan  
**Related Spec:** [spec.md](./spec.md)  
**Related Clarifications:** [clarify.md](./clarify.md)  
**Data Model:** [data-model.md](./data-model.md)  
**Related ADRs:** ADR-0001, ADR-0006, ADR-0007, ADR-0008

---

## Stage Alignment

### Phase & Stage Context

- **Phase:** 1 – Platform Foundation
- **Stage:** STAGE_03_AUTHENTICATION_SYSTEM
- **Prerequisites:**
  - STAGE_02A: Master DB schema (mmc_users table structure)
  - STAGE_02B: Tenant baseline schema (users table structure)
  - STAGE_02C: Migration & versioning model (schema versioning workflow)
- **Provides Foundation For:**
  - License enforcement middleware
  - RBAC authorization layer
  - All subsequent user-bound routes
  - Session lifecycle management

### Plan Authority

This plan does NOT introduce new architecture. It operationalizes existing governance:

✅ **ADR-0001:** Database-per-tenant isolation (workspace_id enforcement)  
✅ **ADR-0006:** Server authoritative time (PostgreSQL NOW())  
✅ **ADR-0007:** Product version compatibility (SemVer checks)  
✅ **ADR-0008:** Semantic versioning (schema_version tracking)  
✅ **PROJECT_CONTEXT_PRIMER:** Middleware order, license enforcement

---

## Architectural Scope Confirmation

### Non-Negotiable Boundaries

✓ **No cross-tenant data access** — All auth queries scoped via tenant resolver  
✓ **No middleware bypass** — Router composition enforces full stack  
✓ **No direct DB instantiation** — All DB calls via Drizzle + tenant pool  
✓ **No grading logic outside Worker** — Auth is stateless, not attempt-bound  
✓ **No snapshot integrity weakening** — Auth doesn't touch attempt engine  
✓ **No version enforcement weakening** — schema_version checked every request  
✓ **No layer boundary violation** — API layer only, no frontend business logic

### Architectural Exceptions

**NONE.** This plan respects all constitutional boundaries.

---

## Implementation Layers

### 1. API Layer (apps/api/src)

#### Authentication Routes (New)

**MMC Domain** (`/mmc/auth`):

- `POST /mmc/auth/login` — Platform admin login (master_db.mmc_users)
- `POST /mmc/auth/logout` — Invalidate token (logout)
- `POST /mmc/auth/logout-all` — Invalidate all tokens (increments token_version)

**Backoffice Domain** (`/backoffice/auth`):

- `POST /backoffice/auth/login` — Staff/instructor login (tenant_db.users)
- `POST /backoffice/auth/logout` — Invalidate token
- `POST /backoffice/auth/logout-all` — Force logout all sessions
- `POST /backoffice/auth/refresh` — Placeholder for Phase 2+

**Frontoffice Domain** (`/frontoffice/auth`):

- `POST /frontoffice/auth/student-login` — Student login (tenant_db.users + division_id)
- `POST /frontoffice/auth/logout` — Invalidate token
- `POST /frontoffice/auth/logout-all` — Force logout all sessions

#### Middleware Stack (New)

**Order of Execution** (applies to all protected routes):

```
1. correlationIdMiddleware
   → Extract x-correlation-id header or generate UUID
   → Attach to request object
   → Pass to logging

2. tenantResolverMiddleware (skip for MMC routes)
   → Extract workspace slug from subdomain/path
   → Query master_db.tenants_registry
   → Load tenant connection pool
   → Attach workspace_id to request context
   → STOP if workspace not found (404)

3. licenseEnforcementMiddleware (skip for MMC public routes)
   → Query master_db.licenses where workspace_id = resolved
   → Check status: ACTIVE → allow, SOFT_LOCKED → 423, ARCHIVED → 403
   → Attach license to request context
   → STOP if not ACTIVE

4. schemaValidationMiddleware (skip for MMC routes)
   → Query tenant_db.schema_version
   → Attach to request context
   → (No rejection here, checked in route handler)

5. Route Handler
```

#### Authentication Route Implementation

**POST /backoffice/auth/login** (Example flow):

```typescript
handler: async (c) => {
  const { email, password } = await c.req.json();

  // Validate input
  if (!email || email.length > 256) throw ValidationError();
  if (!password || password.length < 8) throw ValidationError();

  // Resolve workspace & license (from middleware)
  const workspaceId = c.get("workspace_id");
  const license = c.get("license");
  const correlationId = c.get("correlation_id");
  const tenantDb = c.get("tenant_db");

  // Transaction: REPEATABLE READ with row lock
  await tenantDb.transaction("repeatable_read", async (trx) => {
    // 1. Fetch user with row lock
    const user = await trx
      .select()
      .from(users)
      .where(eq(users.email, email))
      .for("update")
      .then((rows) => rows[0]);

    // Check account lock (or hash dummy if user not found)
    if (!user) {
      // Security: Hash dummy password to prevent timing attack
      await hashPassword("");
      // Log failed attempt
      await tenantDb.insert(login_attempts).values({
        email,
        success: false,
        ip_address: c.req.header("x-forwarded-for"),
        user_agent: c.req.header("user-agent"),
        error_reason: "user_not_found",
      });
      throw InvalidCredentialsError();
    }

    if (user.locked_until && user.locked_until > new Date()) {
      // Log attempt while locked
      await tenantDb.insert(login_attempts).values({
        email,
        success: false,
        user_agent: c.req.header("user-agent"),
        error_reason: "account_locked",
        ip_address: c.req.header("x-forwarded-for"),
      });
      throw AccountLockedError(429);
    }

    // 2. Verify password
    const passwordMatch = await verifyPassword(password, user.password_hash);
    if (!passwordMatch) {
      // Log failed attempt
      await tenantDb.insert(login_attempts).values({
        email,
        success: false,
        ip_address: c.req.header("x-forwarded-for"),
        user_agent: c.req.header("user-agent"),
        error_reason: "invalid_password",
      });

      // Check failure count
      const recentFailures = await tenantDb
        .select({ count: sql<number>`count(*)` })
        .from(login_attempts)
        .where(
          and(
            eq(login_attempts.email, email),
            eq(login_attempts.success, false),
            gt(login_attempts.created_at, sql`NOW() - INTERVAL '15 minutes'`),
          ),
        )
        .then((rows) => rows[0].count);

      // Lock account if threshold reached (during same transaction)
      if (recentFailures >= 5) {
        await tenantDb
          .update(users)
          .set({ locked_until: sql`NOW() + INTERVAL '30 minutes'` })
          .where(eq(users.id, user.id));

        await tenantDb.insert(audit_logs).values({
          event_type: "account_locked",
          user_id: null,
          workspace_id: workspaceId,
          correlation_id: correlationId,
          ip_address: c.req.header("x-forwarded-for"),
          user_agent: c.req.header("user-agent"),
          result: "FAILURE",
          details: { attempt_count: recentFailures },
        });
      }

      throw InvalidCredentialsError();
    }

    // 3. Generate JWT
    const schemaVersion = c.get("schema_version");
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutes

    const token = await signJWT({
      scope: "BACKOFFICE",
      workspace_id: workspaceId,
      user_id: user.id,
      role: user.role,
      token_version: user.token_version,
      schema_version: schemaVersion,
      product_version: license.product_version,
      issued_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
    });

    // 4. Update user & log success
    await tenantDb
      .update(users)
      .set({
        last_login: now,
      })
      .where(eq(users.id, user.id));

    await tenantDb.insert(login_attempts).values({
      email,
      success: true,
      ip_address: c.req.header("x-forwarded-for"),
      user_agent: c.req.header("user-agent"),
      created_at: now,
    });

    await tenantDb.insert(audit_logs).values({
      event_type: "login_success",
      user_id: user.id,
      workspace_id: workspaceId,
      correlation_id: correlationId,
      ip_address: c.req.header("x-forwarded-for"),
      user_agent: c.req.header("user-agent"),
      result: "SUCCESS",
      details: {
        token_version: user.token_version,
        schema_version: schemaVersion,
        product_version: license.product_version,
      },
      timestamp: now,
    });

    // 5. Return token
    return c.json(
      {
        success: true,
        data: {
          token,
          expires_in: 900, // seconds
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
          },
        },
        error: null,
      },
      200,
    );
  });
};
```

#### JWT Validation Middleware (New)

Applied to all protected routes (not login/logout):

```typescript
const jwtValidationMiddleware = async (c, next) => {
  const authHeader = c.req.header("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw UnauthorizedError("No token provided");
  }

  const token = authHeader.slice(7);

  // 1. Verify signature
  const claims = await verifyJWT(token, JWT_SECRET);

  // 2. Check expiration
  const expiresAt = new Date(claims.expires_at);
  if (new Date() > expiresAt) {
    await auditLog({
      event_type: "token_invalid",
      reason: "expired",
      correlation_id: c.get("correlation_id"),
    });
    throw UnauthorizedError("Token expired");
  }

  // 3. Validate scope
  const allowedScopes = c.get("allowed_scopes") || [];
  if (!allowedScopes.includes(claims.scope)) {
    throw UnauthorizedError("Scope not allowed");
  }

  // 4. For tenant tokens, validate workspace_id
  if (claims.scope !== "MMC") {
    const resolvedWorkspaceId = c.get("workspace_id");
    if (claims.workspace_id !== resolvedWorkspaceId) {
      await auditLog({
        event_type: "workspace_mismatch",
        correlation_id: c.get("correlation_id"),
        details: {
          token_workspace_id: claims.workspace_id,
          resolved_workspace_id: resolvedWorkspaceId,
        },
      });
      throw UnauthorizedError("Token workspace mismatch");
    }
  }

  // 5. Check token_version
  const tenantDb = c.get("tenant_db");
  const user = await tenantDb
    .select({ token_version: users.token_version })
    .from(users)
    .where(eq(users.id, claims.user_id))
    .then((rows) => rows[0]);

  if (!user || user.token_version !== claims.token_version) {
    await auditLog({
      event_type: "token_version_mismatch",
      correlation_id: c.get("correlation_id"),
      details: {
        token_version: claims.token_version,
        user_token_version: user?.token_version,
      },
    });
    throw UnauthorizedError("Token invalidated");
  }

  // 6. Check schema_version
  const schemaVersion = c.get("schema_version");
  if (claims.schema_version !== schemaVersion) {
    throw UpgradeRequiredError("Schema version mismatch", 426);
  }

  // 7. Check product_version compatibility
  const license = c.get("license");
  if (!isProductVersionCompatible(claims.product_version, license.product_version)) {
    throw UpgradeRequiredError("Product version incompatible", 426);
  }

  // Attach claims to context
  c.set("user_id", claims.user_id);
  c.set("user_scope", claims.scope);
  c.set("user_claims", claims);

  await next();
};
```

#### Error Response Contract (Updated)

```typescript
{
  "success": false,
  "data": null,
  "error": {
    "code": "ERROR_CODE",
    "message": "Descriptive message"
  }
}
```

**Error Codes:**

| HTTP | Code                | Message                      | Scenario                   |
| ---- | ------------------- | ---------------------------- | -------------------------- |
| 200  | -                   | Success                      | Login successful           |
| 400  | VALIDATION_ERROR    | Invalid email format         | Bad input                  |
| 401  | INVALID_CREDENTIALS | Email or password incorrect  | Wrong creds/user not found |
| 401  | TOKEN_INVALID       | Token expired                | Expired JWT                |
| 401  | TOKEN_INVALID       | Token invalidated            | Version mismatch           |
| 401  | WORKSPACE_MISMATCH  | Token workspace mismatch     | Cross-workspace token      |
| 403  | PERMISSION_DENIED   | Insufficient permissions     | RBAC failure               |
| 403  | LICENSE_ARCHIVED    | License archived             | Archived workspace         |
| 423  | ACCOUNT_LOCKED      | Too many login attempts      | Account locked             |
| 423  | LICENSE_SOFT_LOCKED | License soft-locked          | SOFT_LOCKED state          |
| 426  | UPGRADE_REQUIRED    | Schema version mismatch      | Schema drift               |
| 426  | UPGRADE_REQUIRED    | Product version incompatible | Version mismatch           |
| 429  | RATE_LIMIT          | Too many login attempts      | Failed attempts threshold  |
| 500  | INTERNAL_ERROR      | Server error                 | Unexpected error           |

---

### 2. Domain Layer (packages/domain-core/auth)

#### Core Functions

**Password Management:**

```typescript
// packages/domain-core/auth/password.ts

export async function hashPassword(password: string): Promise<string> {
  // bcrypt with 12 rounds
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
```

**JWT Operations:**

```typescript
// packages/domain-core/auth/jwt.ts

export interface JWTClaims {
  scope: "MMC" | "BACKOFFICE" | "FRONTOFFICE";
  workspace_id?: string;
  user_id: string;
  role?: string;
  token_version: number;
  schema_version?: string;
  product_version?: string;
  division_id?: string;
  subscription_status?: string;
  issued_at: string;
  expires_at: string;
}

export async function signJWT(claims: JWTClaims): Promise<string> {
  return jwt.sign(claims, JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: "15m",
  });
}

export async function verifyJWT(token: string, secret: string): Promise<JWTClaims> {
  return jwt.verify(token, secret) as JWTClaims;
}
```

**RBAC Evaluation:**

```typescript
// packages/domain-core/auth/rbac.ts

export async function evaluatePermission(
  userId: string,
  requiredPermission: string,
  tenantDb: Database,
): Promise<boolean> {
  const userWithPermissions = await tenantDb
    .select()
    .from(users)
    .leftJoin(user_roles, eq(users.id, user_roles.user_id))
    .leftJoin(role_permissions, eq(user_roles.role_id, role_permissions.role_id))
    .where(eq(users.id, userId));

  if (!userWithPermissions.length) return false;

  const permissions = userWithPermissions.map((r) => r.role_permission?.permission).filter(Boolean);

  return permissions.includes(requiredPermission);
}
```

#### Domain Types (packages/types/auth.ts)

```typescript
export interface AuthenticatedUser {
  id: string;
  email: string;
  role: "ADMIN" | "STAFF" | "INSTRUCTOR" | "STUDENT";
  workspace_id?: string;
  division_id?: string;
  token_version: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  expires_in: number;
  user: {
    id: string;
    email: string;
    role: string;
  };
}
```

---

### 3. Frontend Layer (apps/frontoffice)

#### Token Handling (No Auth Logic)

```typescript
// apps/frontoffice/src/stores/auth.ts (Pinia store)

export const useAuthStore = defineStore("auth", {
  state: () => ({
    token: null as string | null,
    user: null as AuthUser | null,
    loading: false,
    error: null as string | null,
  }),

  getters: {
    isAuthenticated: (state) => !!state.token,
    hasExpired: (state) => {
      if (!state.token) return false;
      // Note: Only for UX hint, NOT for security
      const claims = jwtDecode(state.token);
      return new Date(claims.expires_at) < new Date();
    },
  },

  actions: {
    async login(email: string, password: string) {
      this.loading = true;
      this.error = null;
      try {
        const response = await fetch("/frontoffice/auth/student-login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email, password }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error.message);
        }

        const data = await response.json();

        // Store token in memory ONLY (not localStorage)
        this.token = data.data.token;
        this.user = data.data.user;
      } catch (err) {
        this.error = err.message;
      } finally {
        this.loading = false;
      }
    },

    async logout() {
      if (!this.token) return;

      try {
        await fetch("/frontoffice/auth/logout", {
          method: "POST",
          headers: { authorization: `Bearer ${this.token}` },
        });
      } finally {
        this.token = null;
        this.user = null;
      }
    },

    getAuthHeader(): Record<string, string> {
      return this.token ? { authorization: `Bearer ${this.token}` } : {};
    },
  },
});
```

#### API Interceptor (Add Token Automatically)

```typescript
// apps/frontoffice/src/api/client.ts

export function createApiClient() {
  const authStore = useAuthStore();

  return new FetchClient({
    baseUrl: import.meta.env.VITE_API_BASE_URL,
    onRequest: (request) => {
      const headers = authStore.getAuthHeader();
      return {
        ...request,
        headers: { ...request.headers, ...headers },
      };
    },
    onResponseError: (response) => {
      if (response.status === 401) {
        // Token invalid/expired
        authStore.logout();
        // Redirect to login
        window.location.href = "/login";
      }
      if (response.status === 426) {
        // Schema version mismatch → force re-login
        authStore.logout();
        window.location.href = "/login?reason=upgrade_required";
      }
    },
  });
}
```

#### NO RBAC Checks in Frontend

✓ Frontend receives permissions from JWT or API  
✗ Frontend does NOT enforce permission checks  
✗ Frontend renders conditional UI based on permissions  
✓ Backend enforces all permissions (returns 403 if denied)

---

### 4. MMC Layer (apps/mmc)

#### MMC-Specific Requirements

MMC authentication operates on master_db only:

- Routes: `/mmc/auth/login`, `/mmc/auth/logout`
- Database: master_db.mmc_users only
- Token scope: "MMC" (no workspace_id)
- Middleware: Skip tenant resolver, license enforcement

**Post Login:**

- MMC admin can access:
  - master_db.licenses (query, update)
  - master_db.tenants_registry (query)
  - master_db.platform_settings (read/write)
  - MMC UI endpoints

**MMC CANNOT:**

- Access any tenant_db directly
- Access tenant user tables
- Override tenant license state without explicit confirmation

---

## Database Impact

### Master DB (PostgreSQL)

#### New Tables

**mmc_users:**

```sql
CREATE TABLE mmc_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('ADMIN', 'OPERATOR')),
  token_version INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_login TIMESTAMP NULL
);

CREATE INDEX idx_mmc_users_email ON mmc_users(email);
```

#### Migration Requirements

- **File:** `apps/api/src/db/master/migrations/0003_create_mmc_users.sql`
- **Version Bump:** Required
- **Direction:** Forward-only (no rollback)

### Tenant DB (PostgreSQL)

#### New Tables

All 6 tables per [data-model.md](./data-model.md):

1. users
2. user_roles
3. roles
4. role_permissions
5. login_attempts
6. audit_logs

#### Migration Requirements

- **File:** `apps/api/src/db/tenant/migrations/0003_create_auth_tables.sql`
- **Version Bump:** YES → schema_version incremented
- **Direction:** Forward-only
- **Transactional:** All tables created in single transaction

#### Schema Version Impact

- **Before:** schema_version = 1.0.0
- **After:** schema_version = 1.1.0 (MINOR bump)
- **Rationale:** New user-scoped tables, not breaking changes

#### Product Version Impact

- **Before:** product_version = 1.0.0
- **After:** product_version = 1.1.0 (MINOR bump)
- **Rationale:** Authentication feature adds capability, maintains compatibility

---

## Transaction Design

### Transaction Type: Login

**Isolation Level:** REPEATABLE READ  
**Lock Type:** Row lock (FOR UPDATE) on users table  
**Atomicity Requirement:** All or nothing

**Operations (in order):**

```sql
BEGIN TRANSACTION (REPEATABLE READ)
  1. SELECT users WHERE email = $1 FOR UPDATE
     -- Acquire row lock, prevent concurrent updates

  2. Verify password hash matches (in application, not SQL)
     -- bcrypt comparison

  3. Check users.locked_until <= NOW()
     -- Check account lock status

  4. Verify license.status == ACTIVE
     -- Check workspace license (cached or queried in middleware)

  5. Generate JWT with current token_version
     -- JWT creation happens INSIDE transaction

  6. UPDATE users SET last_login = NOW()
     -- Mark successful login

  7. INSERT INTO login_attempts (success = true)
     -- Log successful attempt

  8. INSERT INTO audit_logs (event = 'login_success')
     -- Audit trail

COMMIT
```

**Rollback Triggers:**

- Password verification fails → ROLLBACK (no audit log)
- Account locked → ROLLBACK (no success log)
- License not ACTIVE → ROLLBACK (rejected in middleware, transaction not started)
- JWT signing fails → ROLLBACK (rare)

**Concurrency Guarantee:**

- Two concurrent login requests from same email:
  - Thread 1: Acquires row lock
  - Thread 2: Waits for lock release
  - Both succeed (different tokens issued)
  - Both tokens valid independently

---

### Transaction Type: Failed Login Attempt & Account Lock

**Isolation Level:** SERIALIZABLE (stricter than REPEATABLE READ)  
**Lock Type:** Full transaction serialization  
**Atomicity Requirement:** Count + Lock must be atomic

**Operations:**

```sql
BEGIN TRANSACTION (SERIALIZABLE)
  1. INSERT INTO login_attempts (success = false, email = $1)
     -- Record failed attempt

  2. SELECT COUNT(*) FROM login_attempts
     WHERE email = $1
     AND created_at > NOW() - INTERVAL '15 minutes'
     AND success = false
     -- Count failures in sliding window

  3. IF count >= 5:
       UPDATE users SET locked_until = NOW() + INTERVAL '30 minutes'
       WHERE email = $1
       -- Lock account for 30 minutes

  4. INSERT INTO audit_logs (event = 'account_locked' OR 'login_failed')
     -- Audit trail

COMMIT
```

**Concurrency Guarantee (SERIALIZABLE):**

- Thread 1: Inserts attempt (count becomes 5), locks account
- Thread 2: Waits for Thread 1 to commit
- Thread 2: Inserts attempt (count becomes 6), sees lock already set

Result: No race condition on lock threshold.

---

### Transaction Type: Token Version Increment (Logout-All)

**Isolation Level:** REPEATABLE READ  
**Lock Type:** Row lock (FOR UPDATE)  
**Atomicity Requirement:** Increment must be atomic

**Operations:**

```sql
BEGIN TRANSACTION (REPEATABLE READ)
  1. SELECT users WHERE id = $1 FOR UPDATE
     -- Acquire row lock

  2. Get current token_version

  3. UPDATE users SET token_version = token_version + 1
     -- Increment atomically

  4. INSERT INTO audit_logs (event = 'token_invalidation')
     -- Audit trail

COMMIT
```

**Effect:** All tokens with old token_version become invalid (checked on next request).

**Idempotency:** Calling twice increments twice, but outcome is same (all tokens invalid).

---

### Transaction Type: Password Change (Phase 2+)

**NOT IN SCOPE for Phase 1.** Placeholder for future design.

---

## Idempotency Plan

### Login Endpoint

**Idempotent:** NO (by design)

**Reasoning:**

- No idempotency key in request
- Multiple calls generate multiple tokens
- Each token valid independently
- Acceptable for UX (different login → different session)

**Duplicate Handling:**

- First request: Login succeeds, token issued
- Network fails (user doesn't receive response)
- User retries: Second login succeeds, new token issued
- Both tokens valid simultaneously

**Client Responsibility:**

- UI layer prevents double-submit (button disabled after click)
- Frontend shouldn't retry login without user action

---

### Logout Endpoint

**Idempotent:** YES (outcome-idempotent)

**Implementation:**

```
Call 1: token_version: 5 → 6
Call 2: token_version: 6 → 7

Outcome: Both calls result in all old tokens being invalid
Business effect: Same (tokens invalidated)
```

**Replay Safety:**

- Multiple calls are safe (no data loss)
- Each call increments again (mathematically not idempotent)
- Outcome is idempotent (all old tokens always invalid)

---

### Logout-All (Force Invalidation)

**Idempotent:** YES (outcome-idempotent)

**Same as logout:** Increments token_version.

---

### Account Lock

**Idempotent:** YES

**Implementation:**

```
Call 1: locked_until = NOW() + 30 min
Call 2: locked_until = NOW() + 30 min (same value)

Outcome: Account locked for ~30 minutes
Replay: Same result
```

---

## Version Enforcement Strategy

### Schema Version Validation Points

#### Point 1: On Token Issuance (Login)

```typescript
const schemaVersion = workspace.schema_version;
const token = signJWT({
  ...claims,
  schema_version: schemaVersion,
});
```

**Requirement:** Capture current workspace schema_version in token.

---

#### Point 2: On Every Authenticated Request

```typescript
// In JWT validation middleware
if (token.schema_version !== workspace.schema_version) {
  throw UpgradeRequiredError("Schema version mismatch", 426);
}
```

**Requirement:** Compare token schema_version against current workspace schema_version.

**Effect:**

- Workspace upgraded from 1.0.0 → 1.1.0
- Old tokens with version 1.0.0 rejected with 426
- User must re-login to get token with version 1.1.0

---

### Product Version Validation Points

#### Point 1: On Token Issuance (Login)

```typescript
const productVersion = license.product_version;
const token = signJWT({
  ...claims,
  product_version: productVersion,
});
```

#### Point 2: On Every Authenticated Request

```typescript
// In JWT validation middleware
const isCompatible = isProductVersionCompatible(token.product_version, license.product_version);

if (!isCompatible) {
  throw UpgradeRequiredError("Product version incompatible", 426);
}
```

#### Compatibility Algorithm (SemVer)

```typescript
function isProductVersionCompatible(tokenVersion: string, runtimeVersion: string): boolean {
  const [tokenMajor, tokenMinor, tokenPatch] = tokenVersion.split(".").map(Number);
  const [runtimeMajor, runtimeMinor, runtimePatch] = runtimeVersion.split(".").map(Number);

  // Same major version → compatible
  return tokenMajor === runtimeMajor;
}
```

---

### Backward Compatibility Strategy

**Phase 1:** No compatibility concerns (fresh deployment).

**Phase 2+:**

- Maintain previous schema_version support for N versions
- Gradual migration timeline documented
- Forced upgrade threshold set by operator

---

## Authoritative Time Handling

### Server Clock Mandate

**All timestamps use:** PostgreSQL `NOW()`

### Time-Sensitive Operations

#### 1. Token Expiration

```sql
issued_at = NOW()
expires_at = NOW() + INTERVAL '15 minutes'
```

**Validation:**

```typescript
if (new Date() > new Date(token.expires_at)) {
  throw UnauthorizedError("Token expired", 401);
}
```

**Requirement:** Server clock checked via system time.

---

#### 2. Account Lock Duration

```sql
locked_until = NOW() + INTERVAL '30 minutes'
```

**Unlock Check:**

```typescript
if (user.locked_until && user.locked_until > new Date()) {
  throw AccountLockedError("Account locked", 423);
}
```

---

#### 3. Login Attempt Sliding Window

```sql
SELECT COUNT(*) FROM login_attempts
WHERE created_at > NOW() - INTERVAL '15 minutes'
```

**Requirement:** Window calculated from server time (NOW()).

---

### Client Time: NEVER TRUSTED

**Forbidden Patterns:**

- ✗ Client sends expiration time in request
- ✗ Client calculates token lifetime
- ✗ Client decides account lock expiry
- ✗ Frontend checks token expiration for security

**Allowed Patterns:**

- ✓ Frontend checks token expiration for UX hint (advisory)
- ✓ Client stores token received from server
- ✓ Frontend shows "Session expires in X minutes" (UX only)

---

### NTP Synchronization (DevOps)

**Requirement:** All servers must run NTP client.

**Configuration:**

```bash
# All docker containers MUST have:
# - ntpd or chrony running
# - System clock synced to NTP pool
# - Clock drift monitored (alarm if > 1 second)
```

**Monitoring:**

- Alert on NTP sync failure (clock drift > 1 second)
- Alert on unexpected system clock changes
- Log clock adjustments for audit

---

## Observability & Logging

### Structured Logging Format (Pino JSON)

**All auth events must emit:**

```json
{
  "timestamp": "2024-02-17T10:30:00.000Z",
  "level": "info",
  "service": "auth",
  "version": "1.0.0",
  "correlation_id": "req-abc123-def456-ghi789",
  "workspace_slug": "demo-school",
  "workspace_id": "ws-uuid-12345",
  "user_id": "user-uuid-67890",
  "event_type": "login_success",
  "domain": "backoffice",
  "ip_address": "192.168.1.100",
  "user_agent": "Mozilla/5.0 (X11; Linux x86_64)...",
  "result": "SUCCESS",
  "duration_ms": 125,
  "details": {
    "token_version": 3,
    "schema_version": "1.0.0",
    "product_version": "2.1.0"
  }
}
```

### Logging Tags by Event Type

| Event                  | User ID | Workspace | Email | IP  | Status  |
| ---------------------- | ------- | --------- | ----- | --- | ------- |
| login_success          | ✓       | ✓         | ✓     | ✓   | SUCCESS |
| login_failed           | ✗       | ✓         | ✓     | ✓   | FAILURE |
| account_locked         | ✗       | ✓         | ✓     | ✓   | FAILURE |
| token_invalid          | ✓       | ✓         | ✗     | ✓   | FAILURE |
| token_version_mismatch | ✓       | ✓         | ✗     | ✓   | FAILURE |
| workspace_mismatch     | ✓       | ✓         | ✗     | ✓   | FAILURE |
| license_blocked        | ✗       | ✓         | ✗     | ✗   | FAILURE |

### request_id Propagation

**Correlation ID Header:** `x-correlation-id`

```typescript
// Middleware 1: Correlation ID
if (!c.req.header("x-correlation-id")) {
  const correlationId = generateUUID();
  c.set("correlation_id", correlationId);
} else {
  c.set("correlation_id", c.req.header("x-correlation-id"));
}

// Add to response header
c.header("x-correlation-id", c.get("correlation_id"));
```

### Metrics (Prometheus)

Critical path metrics to emit:

```typescript
// Counter: Login attempts
authLoginAttempts.inc({
  result: "success" | "failure",
  workspace: "workspace-id",
});

// Histogram: Login duration
authLoginDuration.observe({ workspace: "workspace-id" }, durationMs / 1000);

// Counter: Token validations
authTokenValidation.inc({
  result: "valid" | "invalid" | "expired",
  workspace: "workspace-id",
});

// Gauge: Locked accounts
authLockedAccounts.set({ workspace: "workspace-id" }, countLockedUsers);
```

### Error Logging (Structured)

```typescript
// On error in login transaction
logger.error({
  event_type: "login_failed",
  error_code: "INVALID_CREDENTIALS",
  workspace_id: workspaceId,
  correlation_id: correlationId,
  email: email,
  ip_address: ipAddress,
  error: {
    message: "Password verification failed",
    stack: error.stack,
  },
});
```

---

## Rate Limiting

### Login Endpoint Rate Limiting

**Requirement:** Prevent brute force attacks

**Thresholds:**

- **Per email:** 5 failed attempts in 15 minutes → lock for 30 minutes
- **Per IP:** Not in Phase 1 (gateway level, not auth layer)

**Implementation:**

```sql
SELECT COUNT(*) FROM login_attempts
WHERE email = $1
AND created_at > NOW() - INTERVAL '15 minutes'
AND success = false
```

**Action on Threshold:**

```sql
UPDATE users SET locked_until = NOW() + INTERVAL '30 minutes'
```

### Logout Endpoint

**Rate Limiting:** NONE (idempotent, safe to call repeatedly)

### Logout-All Endpoint

**Rate Limiting:** NONE (idempotent, safe to call repeatedly)

### Refresh Endpoint (Phase 2+)

**Rate Limiting:** 100 calls/hour per user

---

## Failure Modes & Recovery

### 1. Database Unavailable

**Symptom:** Cannot connect to tenant_db

**Behavior:** Return 503 Service Unavailable

**Recovery:**

- Automatic retry (handled by Drizzle pool)
- Alert to DevOps (monitor uptime)
- Fallback: None (auth requires DB)

**User Impact:** Login unavailable for ~30 seconds (retry timeout)

---

### 2. Tenant Not Found

**Symptom:** workspace_slug doesn't exist in master_db.tenants_registry

**Behavior:** Return 404 Not Found

**Audit:** Log workspace_not_found event

**Recovery:** User must correct workspace slug

**User Impact:** Cannot login (invalid workspace)

---

### 3. License Not ACTIVE

**Symptom:** license.status = SOFT_LOCKED or ARCHIVED

**Behavior on Login:** Return 423 Locked (if SOFT_LOCKED) or 403 Forbidden (if ARCHIVED)

**Behavior on Authenticated Request:** Return 423 or 403

**Recovery:** Admin reactivates license

**User Impact:** Access denied, data preserved

---

### 4. Schema Version Mismatch

**Symptom:** token.schema_version != workspace.schema_version

**Behavior:** Return 426 Upgrade Required

**Recovery:** User re-logs in (gets new token with new schema_version)

**User Impact:** Session lost (expected during upgrade)

---

### 5. Token Expired

**Symptom:** NOW() > token.expires_at

**Behavior:** Return 401 Unauthorized

**Recovery:** User re-logs in (15-minute grace period)

**User Impact:** Session timeout expected

---

### 6. Token Version Mismatch

**Symptom:** token.token_version != user.token_version

**Cause:** Logout-all triggered (admin or user)

**Behavior:** Return 401 Unauthorized

**Recovery:** User re-logs in

**User Impact:** Session invalidated (admin-initiated or user action)

---

### 7. Account Locked

**Symptom:** user.locked_until > NOW()

**Behavior:** Return 429 Too Many Attempts

**Recovery:** Wait 30 minutes OR admin manual unlock

**User Impact:** Cannot login temporarily

---

### 8. Concurrent Failed Attempts (Race)

**Symptom:** Multiple requests with same failed attempt reach threshold simultaneously

**Race Condition (without SERIALIZABLE):**

- Request 1: Reads count = 4
- Request 2: Reads count = 4
- Both think 5 < threshold
- Both commit
- Account doesn't lock until 6th attempt

**Mitigation:** Use SERIALIZABLE isolation for failed login tracking

**Result:** Lock triggered exactly at 5th failure (no race)

---

### 9. JWT Signing Library Failure

**Symptom:** JWT signing crashes (rare)

**Behavior:** Transaction ROLLBACK, return 500 Internal Server Error

**Recovery:** User retries login

**User Impact:** Login fails, no side effects

---

### 10. Partial Transaction Failure

**Symptom:** Update user fails but audit_log insert succeeds (impossible with transactions)

**Mitigation:** All operations in single transaction → all-or-nothing ACID guarantee

**Guarantee:** No partial updates possible

---

## Security Review

### RBAC Enforcement

**Requirement:** Role-based access control enforced server-side ONLY

#### Frontend Security Check

**FORBIDDEN ✗:**

```javascript
// DO NOT DO THIS
if (user.role === "ADMIN") {
  showAdminButton();
}
```

**Reason:** User can forge role claim in token (client-side) or modify DOM.

#### Backend Security Check

**REQUIRED ✓:**

```typescript
// ALWAYS DO THIS (in API route handler)
const permission = await evaluatePermission(userId, "exams.delete", tenantDb);
if (!permission) {
  throw ForbiddenError("Permission denied", 403);
}
```

**Guarantee:** Frontend conditional UI is UX hint only. Backend ALWAYS checks.

---

### Input Validation

**Email Validation:**

- Maximum length: 256 characters
- Format: Valid email regex (RFC 5322 simplified)
- Not verified (Phase 2+)

**Password Validation (Phase 1):**

- Minimum length: 8 characters
- Maximum length: 256 characters
- No complexity requirements (Phase 1)
- No common password blacklist (Phase 2+)

**Validation Timing:** Provisioning API (user creation), NOT auth layer

---

### Token Security

**JWT Secret Requirements:**

- Length: 32+ bytes (256+ bits)
- Randomness: Cryptographically secure
- Storage: Docker secret (prod), environment variable (dev)
- Rotation: Phase 2+ feature

**Current Secret Generation (for deployment):**

```bash
openssl rand -base64 32
# Generate 32 random bytes, base64 encode
```

---

### Timing Attack Prevention

**Email Enumeration Attack**

Attacker tries emails to determine if user exists.

**Without Mitigation:**

- Valid email + wrong password: 1000ms (DB lookup + hash verify)
- Invalid email: 50ms (early return)

**Difference reveals if user exists.**

**Mitigation (Implemented):**

```typescript
if (!user) {
  // Still perform password hash (costs ~100ms)
  await hashPassword("");
  // Return same error
  throw InvalidCredentialsError();
}
```

**Result:** Both paths take ~1000ms. User existence not revealed by timing.

---

### Account Lock Protection

**Defense Against Brute Force:**

- Counter: Failed attempts per email
- Window: 15 minutes sliding
- Threshold: 5 failures
- Lock Duration: 30 minutes
- No exponential backoff needed (35x slow-down at 5 failures)

**Rate of Attack (without lock):**

- 1 attempt/second: 60 attempts/minute
- Time to crack 8-char password: ~3 years at this rate
- With lock: Infinite (30-min wait per 5 attempts)

---

### Cross-Domain Token Rejection

**Route declares allowed scopes:**

```typescript
const studentRoutes = hono.use(validateScope(["FRONTOFFICE"])).post("/login", studentLoginHandler);

const staffRoutes = hono
  .use(validateScope(["BACKOFFICE", "ADMIN"]))
  .post("/login", staffLoginHandler);
```

**Middleware validates scope:**

```typescript
function validateScope(allowedScopes) {
  return (c, next) => {
    const scope = c.get("user_scope");
    if (!allowedScopes.includes(scope)) {
      throw UnauthorizedError("Scope not allowed", 401);
    }
    return next();
  };
}
```

---

### Cross-Workspace Token Rejection

**Every request validates workspace_id:**

```typescript
if (token.workspace_id !== resolvedWorkspaceId) {
  throw UnauthorizedError("Token workspace mismatch", 401);
}
```

**Guarantee:** Token from Workspace A cannot function in Workspace B.

---

### License Enforcement

**On Login:** License status checked before token issuance

**On Every Request:** License status checked via middleware

**States:**

- ACTIVE → Allow
- SOFT_LOCKED → Return 423
- ARCHIVED → Return 403
- DELETED → Return 403

**Guarantee:** Non-ACTIVE workspaces cannot issue or use tokens.

---

## Implementation Phases

### Phase 1: Core Auth (This Plan)

- ✓ Login/logout endpoints (MMC, Backoffice, Frontoffice)
- ✓ JWT generation & validation
- ✓ Account lock on failed attempts
- ✓ Token versioning
- ✓ Schema version enforcement
- ✓ License enforcement
- ✓ RBAC evaluation
- ✓ Audit logging
- ✓ Error contract

### Phase 2: Enhanced Auth

- [ ] Refresh token endpoint (expired token refresh)
- [ ] Secret rotation strategy
- [ ] Password recovery / reset
- [ ] Email verification
- [ ] Enhanced password complexity
- [ ] Common password blacklist
- [ ] Session synchronization (logout from all devices)

### Phase 3: Advanced Auth

- [ ] Multi-factor authentication (TOTP)
- [ ] Social login (OAuth)
- [ ] SSO / SAML
- [ ] API key authentication
- [ ] Geo-fencing (IP restrictions)
- [ ] Device trust

### Phase 4+: Future

- [ ] Passwordless auth
- [ ] Biometric auth
- [ ] WebAuthn/FIDO2

---

## Deployment Checklist

Before deploying this stage:

- [ ] Migration files created and tested (master + tenant)
- [ ] JWT secret generated and stored in Docker secrets
- [ ] NTP sync verified on all servers
- [ ] Master DB contains at least one mmc_user (provisioned)
- [ ] Tenant DB seed data created (default roles)
- [ ] Logging configured (Pino → CloudWatch/ELK)
- [ ] Metrics configured (Prometheus scraping)
- [ ] Error monitoring set up (Sentry/DataDog)
- [ ] Load tests completed (concurrent logins)
- [ ] Security audit completed (RBAC, SQL injection, XSS)
- [ ] Documentation updated (API docs, runbooks)
- [ ] Staging environment verified before production deploy

---

## Compliance Checklist

- ✓ ADR-0001: Database-per-tenant isolation enforced
- ✓ ADR-0006: Server authoritative time (NOW() only)
- ✓ ADR-0007: Product version compatibility (SemVer)
- ✓ ADR-0008: Semantic versioning (schema_version)
- ✓ PROJECT_CONTEXT_PRIMER: Middleware order, license enforcement
- ✓ No cross-tenant access
- ✓ No middleware bypass
- ✓ No direct DB instantiation
- ✓ All mutations transactional
- ✓ Version enforcement mandatory

**Status:** ✅ Plan complies with all architectural constraints

---

## Next Steps

1. **Approve Plan** — Review and confirm no architectural conflicts
2. **Generate Tasks** — Break plan into atomic implementation tasks
3. **Analyze** — Cross-check spec + plan + tasks for drift
4. **Implement** — Execute tasks in dependency order
5. **Validate** — Manual checklist + automated tests
6. **Deploy** — Follow deployment checklist

**Ready for Task Generation:** YES
