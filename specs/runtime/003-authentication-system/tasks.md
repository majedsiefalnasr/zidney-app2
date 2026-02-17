# TASKS – Authentication System Implementation (STAGE_03)

**Phase:** 1 – Platform Foundation  
**Stage:** STAGE_03_AUTHENTICATION_SYSTEM  
**Related Plan:** [plan.md](./plan.md)  
**Related Spec:** [spec.md](./spec.md)  
**Data Model:** [data-model.md](./data-model.md)

---

## Execution Discipline

This task set operationalizes [plan.md](./plan.md) into atomic, sequenced implementation work.

**Compliance Validation:**
✅ Plan complies with Zidney Constitution v1.2.0  
✅ No architectural violations exist  
✅ Stage scope is respected (Phase 1, Auth only)

**Non-Goals Confirmation:**
✗ Does NOT introduce new architecture  
✗ Does NOT bypass middleware  
✗ Does NOT touch unrelated layers  
✗ Does NOT modify unrelated stages

---

## Task Dependencies

```
INFRASTRUCTURE (0) ─→ DOMAIN (1) ─→ API (2) ─→ OBSERVABILITY (3) ─→ TESTING (4)
                          ↓
                    FRONTEND (2b)
```

**Execution Order:** Follow dependency graph strictly

---

---

## INFRASTRUCTURE TASKS (Execute First)

These tasks prepare schema and configuration. **No business logic.**

### INFRA-001: Create Master DB Migration – mmc_users Table

**File:** `apps/api/src/db/master/migrations/0003_create_mmc_users.sql`  
**Layer:** Infrastructure  
**Transactional:** YES (single CREATE TABLE statement is atomic)  
**Idempotency:** N/A (DDL)  
**Version Enforcement:** N/A (master DB)  
**License Middleware:** N/A (infrastructure)

**Description:**
Create the mmc_users table in master_db for platform-level authentication.

**SQL Content:**

```sql
-- Master DB Migration: Create mmc_users table
-- Version: 0003
-- Direction: Up (forward-only)

BEGIN;

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

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON mmc_users TO api_user;

COMMIT;
```

**Acceptance Criteria:**

- [ ] Table created with all columns
- [ ] Constraints enforced (UNIQUE email, CHECK role)
- [ ] Index created on email for login lookup
- [ ] Permissions granted to api_user role
- [ ] Script idempotent (can run twice safely)

---

### INFRA-002: Create Tenant DB Migration – Auth Tables

**File:** `apps/api/src/db/tenant/migrations/0003_create_auth_tables.sql`  
**Layer:** Infrastructure  
**Transactional:** YES (wrap all DDL in single transaction)  
**Idempotency:** N/A (DDL)  
**Version Enforcement:** YES (schema_version incremented)  
**License Middleware:** N/A (infrastructure)

**Description:**
Create 6 auth tables in tenant_db: users, user_roles, roles, role_permissions, login_attempts, audit_logs.

**SQL Content:**

```sql
-- Tenant DB Migration: Create authentication tables
-- Version: 0003
-- Direction: Up (forward-only)

BEGIN;

-- 1. USERS table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('ADMIN', 'STAFF', 'INSTRUCTOR', 'STUDENT')),
  token_version INTEGER NOT NULL DEFAULT 0,
  subscription_status TEXT CHECK (subscription_status IN ('ACTIVE', 'EXPIRED', 'PENDING')),
  division_id UUID NULL REFERENCES divisions(id),
  locked_until TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_login TIMESTAMP NULL,

  CONSTRAINT single_role_per_workspace CHECK (
    (role IN ('ADMIN', 'STAFF', 'INSTRUCTOR') AND division_id IS NULL) OR
    (role = 'STUDENT' AND division_id IS NOT NULL)
  )
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_created_at ON users(created_at);
CREATE INDEX idx_users_division_id ON users(division_id) WHERE role = 'STUDENT';

-- 2. ROLES table
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE CHECK (name IN ('ADMIN', 'INSTRUCTOR', 'STAFF')),
  permissions JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 3. USER_ROLES table (many-to-many, currently one-to-one in Phase 1)
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),

  UNIQUE(user_id, role_id)
);

CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_user_roles_role_id ON user_roles(role_id);

-- 4. ROLE_PERMISSIONS table
CREATE TABLE role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),

  UNIQUE(role_id, permission)
);

CREATE INDEX idx_role_permissions_role_id ON role_permissions(role_id);

-- 5. LOGIN_ATTEMPTS table (no FK to users, logs email)
CREATE TABLE login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  ip_address INET NULL,
  user_agent TEXT NULL,
  error_reason TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_login_attempts_email_created_at ON login_attempts(email, created_at);
CREATE INDEX idx_login_attempts_success_created_at ON login_attempts(success, created_at);

-- 6. AUDIT_LOGS table
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL CHECK (event_type IN (
    'login_success', 'login_failed', 'account_locked',
    'token_invalid', 'token_version_mismatch', 'workspace_mismatch',
    'license_blocked', 'role_changed', 'password_changed'
  )),
  user_id UUID NULL REFERENCES users(id),
  workspace_id UUID NOT NULL,
  correlation_id TEXT NOT NULL,
  ip_address INET NULL,
  user_agent TEXT NULL,
  result TEXT NOT NULL CHECK (result IN ('SUCCESS', 'FAILURE')),
  details JSONB NULL,
  timestamp TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user_id_timestamp ON audit_logs(user_id, timestamp);
CREATE INDEX idx_audit_logs_workspace_id_timestamp ON audit_logs(workspace_id, timestamp);
CREATE INDEX idx_audit_logs_correlation_id ON audit_logs(correlation_id);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON users, roles, user_roles, role_permissions, login_attempts, audit_logs TO api_user;

COMMIT;

-- Update schema_version in metadata table
UPDATE schema_metadata SET schema_version = '1.1.0' WHERE version_type = 'tenant';
```

**Acceptance Criteria:**

- [ ] All 6 tables created
- [ ] All constraints applied (FK, UNIQUE, CHECK)
- [ ] All indexes created
- [ ] Transaction wraps all DDL
- [ ] schema_version updated to 1.1.0
- [ ] Permissions granted
- [ ] Migration is idempotent

---

### INFRA-003: Seed Default Roles in Tenant DB

**File:** `apps/api/src/db/tenant/seeds/0001_default_roles.sql`  
**Layer:** Infrastructure  
**Transactional:** YES  
**Idempotency:** YES (use INSERT ... ON CONFLICT or check)  
**Version Enforcement:** N/A (seed data)  
**License Middleware:** N/A (infrastructure)

**Description:**
Insert default roles (ADMIN, INSTRUCTOR, STAFF) with standard permissions.

**SQL Content:**

```sql
-- Seed default roles into newly provisioned tenant
-- Idempotent: Safe to run multiple times (uses ON CONFLICT)

BEGIN;

INSERT INTO roles (name, permissions, created_at, updated_at) VALUES
  ('ADMIN', '{}', NOW(), NOW()),
  ('INSTRUCTOR', '{}', NOW(), NOW()),
  ('STAFF', '{}', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- Insert permissions for ADMIN
INSERT INTO role_permissions (role_id, permission, created_at)
SELECT id, permission, NOW()
FROM (
  SELECT r.id, p.permission
  FROM roles r
  CROSS JOIN (
    VALUES
      ('exams.view'), ('exams.create'), ('exams.edit'), ('exams.delete'), ('exams.run'),
      ('questions.view'), ('questions.create'), ('questions.edit'),
      ('students.view'), ('students.create'),
      ('reports.view'), ('reports.export'),
      ('audit_logs.view'),
      ('settings.manage')
  ) AS p(permission)
  WHERE r.name = 'ADMIN'
) admin_perms
ON CONFLICT (role_id, permission) DO NOTHING;

-- Insert permissions for INSTRUCTOR
INSERT INTO role_permissions (role_id, permission, created_at)
SELECT id, permission, NOW()
FROM (
  SELECT r.id, p.permission
  FROM roles r
  CROSS JOIN (
    VALUES
      ('exams.view'), ('exams.create'), ('exams.edit'), ('exams.run'),
      ('questions.view'), ('questions.create'), ('questions.edit'),
      ('students.view'),
      ('reports.view')
  ) AS p(permission)
  WHERE r.name = 'INSTRUCTOR'
) instr_perms
ON CONFLICT (role_id, permission) DO NOTHING;

-- Insert permissions for STAFF
INSERT INTO role_permissions (role_id, permission, created_at)
SELECT id, permission, NOW()
FROM (
  SELECT r.id, p.permission
  FROM roles r
  CROSS JOIN (
    VALUES
      ('reports.view'),
      ('audit_logs.view')
  ) AS p(permission)
  WHERE r.name = 'STAFF'
) staff_perms
ON CONFLICT (role_id, permission) DO NOTHING;

COMMIT;
```

**Acceptance Criteria:**

- [ ] 3 default roles inserted
- [ ] Permissions assigned to each role
- [ ] Seed is idempotent
- [ ] ADMIN has full permissions
- [ ] INSTRUCTOR has exam/question/student permissions
- [ ] STAFF has reporting/audit permissions

---

### INFRA-004: Update Migration Metadata – Version Bump

**File:** `apps/api/src/db/tenant/migrations/0003_create_auth_tables.sql` (add to end)  
**Layer:** Infrastructure  
**Transactional:** YES  
**Idempotency:** YES  
**Version Enforcement:** YES  
**License Middleware:** N/A (infrastructure)

**Description:**
Update schema_metadata.schema_version from 1.0.0 to 1.1.0 after migration.

**Content:**  
Already included in INFRA-002. No separate task needed.

---

### INFRA-005: Create environment.example for JWT_SECRET

**File:** `.env.example` (update)  
**Layer:** Infrastructure  
**Transactional:** N/A  
**Idempotency:** N/A  
**Version Enforcement:** N/A  
**License Middleware:** N/A

**Description:**
Add JWT_SECRET to .env.example for developers.

**Content:**

```bash
# Authentication
JWT_SECRET=<generate-with-openssl-rand-base64-32>
JWT_TTL=900  # 15 minutes in seconds

# Password hashing
BCRYPT_ROUNDS=12

# Account lock
FAILED_LOGIN_THRESHOLD=5
FAILED_LOGIN_WINDOW_MINUTES=15
ACCOUNT_LOCK_DURATION_MINUTES=30
```

**Acceptance Criteria:**

- [ ] .env.example updated with all auth vars
- [ ] Comments explain each setting
- [ ] README includes JWT_SECRET generation command

---

---

## DOMAIN LAYER TASKS (Execute Second)

These tasks create pure business logic (no HTTP, no DB instantiation outside of test).

### DOMAIN-001: Implement Password Hashing Package

**File:** `packages/domain-core/auth/password.ts`  
**Layer:** Domain  
**Transactional:** N/A (pure functions)  
**Idempotency:** N/A  
**Version Enforcement:** N/A  
**License Middleware:** N/A

**Description:**
Export `hashPassword()` and `verifyPassword()` functions using bcrypt.

**Pseudo-code:**

```typescript
import bcrypt from 'bcrypt'

export async function hashPassword(password: string): Promise<string> {
  if (!password || password.length < 8 || password.length > 256) {
    throw new Error('Invalid password length')
  }
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash)
}
```

**Acceptance Criteria:**

- [ ] hashPassword validates length (8-256)
- [ ] hashPassword uses 12 bcrypt rounds
- [ ] verifyPassword returns boolean
- [ ] Both functions are exported
- [ ] No DB access
- [ ] Unit tests pass (hash deterministic for same input)

---

### DOMAIN-002: Implement JWT Operations Package

**File:** `packages/domain-core/auth/jwt.ts`  
**Layer:** Domain  
**Transactional:** N/A (pure functions)  
**Idempotency:** N/A  
**Version Enforcement:** N/A  
**License Middleware:** N/A

**Description:**
Export `signJWT()` and `verifyJWT()` functions with JWTClaims interface.

**Interface:**

```typescript
export interface JWTClaims {
  scope: 'MMC' | 'BACKOFFICE' | 'FRONTOFFICE'
  workspace_id?: string
  user_id: string
  role?: string
  token_version: number
  schema_version?: string
  product_version?: string
  division_id?: string
  subscription_status?: string
  issued_at: string
  expires_at: string
}

export async function signJWT(
  claims: JWTClaims,
  secret: string
): Promise<string>
export async function verifyJWT(
  token: string,
  secret: string
): Promise<JWTClaims>
```

**Acceptance Criteria:**

- [ ] Claims interface covers all domains (MMC, Backoffice, Frontoffice)
- [ ] signJWT uses HS256
- [ ] verifyJWT validates signature
- [ ] Both functions imported from jsonwebtoken
- [ ] No DB access
- [ ] Unit tests: sign + verify roundtrip

---

### DOMAIN-003: Implement RBAC Evaluation Package

**File:** `packages/domain-core/auth/rbac.ts`  
**Layer:** Domain  
**Transactional:** N/A (domain layer, no transactions)  
**Idempotency:** N/A  
**Version Enforcement:** N/A  
**License Middleware:** N/A

**Description:**
Export `evaluatePermission()` function for backend endpoints to check user permissions.

**Pseudo-code:**

```typescript
export async function evaluatePermission(
  userId: string,
  requiredPermission: string,
  db: Database
): Promise<boolean> {
  // Must NOT assume user exists
  // Must return false if user/role/permission not found

  const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user.length) return false;

  const permissions = await db.select().from(role_permissions)
    .innerJoin(user_roles, ...)
    .where(eq(user_roles.user_id, userId));

  return permissions.some(p => p.permission === requiredPermission);
}
```

**Acceptance Criteria:**

- [ ] Function accepts userId, permission, database
- [ ] Returns boolean (true if allowed, false otherwise)
- [ ] Handles missing user gracefully (returns false, not error)
- [ ] Queries via passed-in database (no magic DB)
- [ ] No transaction wrapping (caller responsibility)
- [ ] Unit tests: user with permission, without permission, missing user

---

### DOMAIN-004: Create Auth Types Package

**File:** `packages/types/auth.ts`  
**Layer:** Domain  
**Transactional:** N/A  
**Idempotency:** N/A  
**Version Enforcement:** N/A  
**License Middleware:** N/A

**Description:**
Export TypeScript interfaces for auth types.

**Content:**

```typescript
export interface AuthenticatedUser {
  id: string
  email: string
  role: 'ADMIN' | 'STAFF' | 'INSTRUCTOR' | 'STUDENT'
  workspace_id?: string
  division_id?: string
  token_version: number
}

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  token: string
  expires_in: number
  user: {
    id: string
    email: string
    role: string
  }
}

export interface ErrorResponse {
  success: false
  data: null
  error: {
    code: string
    message: string
  }
}

// etc.
```

**Acceptance Criteria:**

- [ ] All auth types defined
- [ ] Exported from packages/types/auth.ts
- [ ] Used by API layer
- [ ] Includes request/response contracts

---

---

## API LAYER TASKS (Execute Third)

These tasks create HTTP routes, middleware, and transaction wrapping.

### API-001: Implement Middleware – Correlation ID

**File:** `apps/api/src/middleware/correlation-id.ts`  
**Layer:** API  
**Transactional:** N/A (middleware)  
**Idempotency:** N/A  
**Version Enforcement:** N/A  
**License Middleware:** N/A

**Description:**
Create middleware that extracts or generates correlation ID.

**Pseudo-code:**

```typescript
export function correlationIdMiddleware() {
  return async (c: Context, next: Next) => {
    const correlationId = c.req.header('x-correlation-id') || generateUUID()
    c.set('correlation_id', correlationId)
    c.header('x-correlation-id', correlationId)
    await next()
  }
}
```

**Acceptance Criteria:**

- [ ] Middleware extracts x-correlation-id header if present
- [ ] Generates UUID if header missing
- [ ] Attaches to context
- [ ] Returns in response header
- [ ] Used by all routes (early in middleware stack)

---

### API-002: Implement Middleware – JWT Validation

**File:** `apps/api/src/middleware/jwt-validation.ts`  
**Layer:** API  
**Transactional:** NO (reads only)  
**Idempotency:** N/A  
**Version Enforcement:** YES (validates schema_version, product_version)  
**License Middleware:** YES (validates license status)

**Description:**
Create middleware that validates JWT on protected routes:

1. Extract token from Authorization header
2. Verify signature
3. Validate expiration
4. Validate workspace_id matches resolver
5. Validate token_version matches user.token_version
6. Validate schema_version
7. Validate product_version compatibility
8. Attach claims to context

**Pseudo-code:**

```typescript
export function jwtValidationMiddleware() {
  return async (c: Context, next: Next) => {
    const authHeader = c.req.header('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      throw UnauthorizedError('No token provided')
    }

    const token = authHeader.slice(7)
    const claims = await verifyJWT(token, JWT_SECRET)

    // Validate expiration
    if (new Date() > new Date(claims.expires_at)) {
      await auditLog({ event_type: 'token_invalid', reason: 'expired' })
      throw UnauthorizedError('Token expired')
    }

    // Validate workspace_id (for tenant tokens)
    if (claims.scope !== 'MMC') {
      if (claims.workspace_id !== c.get('workspace_id')) {
        await auditLog({ event_type: 'workspace_mismatch' })
        throw UnauthorizedError('Token workspace mismatch')
      }
    }

    // Validate token_version
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, claims.user_id))
    if (!user.length || user[0].token_version !== claims.token_version) {
      await auditLog({ event_type: 'token_version_mismatch' })
      throw UnauthorizedError('Token invalidated')
    }

    // Validate schema_version
    if (claims.schema_version !== c.get('schema_version')) {
      throw UpgradeRequiredError('Schema version mismatch')
    }

    // Validate product_version
    if (
      !isProductVersionCompatible(
        claims.product_version,
        license.product_version
      )
    ) {
      throw UpgradeRequiredError('Product version incompatible')
    }

    c.set('user_id', claims.user_id)
    c.set('user_scope', claims.scope)
    c.set('user_claims', claims)

    await next()
  }
}
```

**Acceptance Criteria:**

- [ ] Middleware validates JWT signature
- [ ] Validates expiration (NOW() > expires_at → 401)
- [ ] Validates workspace_id (token != resolved → 401)
- [ ] Queries user.token_version (mismatch → 401)
- [ ] Validates schema_version (mismatch → 426)
- [ ] Validates product_version (incompatible → 426)
- [ ] Logs all validation failures to audit
- [ ] Unit tests cover all validation paths

---

### API-003: Create MMC Login Route

**File:** `apps/api/src/routes/mmc/auth.ts`  
**Layer:** API  
**Transactional:** YES (REPEATABLE READ with row lock)  
**Idempotency:** NO (multiple tokens per login OK)  
**Version Enforcement:** N/A (MMC, master DB only)  
**License Middleware:** N/A (N/A for MMC)

**Description:**
Implement `POST /mmc/auth/login` endpoint for platform admin login.

**Route Handler:**

```typescript
router.post('/mmc/auth/login', async (c) => {
  const { email, password } = await c.req.json()

  // Input validation
  validateEmail(email)
  validatePassword(password)

  // Transaction: REPEATABLE READ, row lock
  return dbMaster.transaction('repeatable_read', async (trx) => {
    // 1. Fetch user with row lock
    const user = await trx
      .select()
      .from(mmc_users)
      .where(eq(mmc_users.email, email))
      .for('update')
      .limit(1)

    if (!user.length) {
      // Security: hash dummy password (constant time)
      await hashPassword('')
      throw InvalidCredentialsError()
    }

    // 2. Verify password
    const match = await verifyPassword(password, user[0].password_hash)
    if (!match) {
      throw InvalidCredentialsError()
    }

    // 3. Generate JWT
    const token = await signJWT({
      scope: 'MMC',
      user_id: user[0].id,
      role: user[0].role,
      token_version: user[0].token_version,
      issued_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    })

    // 4. Update last_login
    await trx
      .update(mmc_users)
      .set({ last_login: new Date() })
      .where(eq(mmc_users.id, user[0].id))

    // 5. Log success
    logger.info({
      event_type: 'login_success',
      user_id: user[0].id,
      correlation_id: c.get('correlation_id'),
      result: 'SUCCESS',
    })

    return c.json(
      {
        success: true,
        data: {
          token,
          expires_in: 900,
          user: { id: user[0].id, email: user[0].email, role: user[0].role },
        },
        error: null,
      },
      200
    )
  })
})
```

**Acceptance Criteria:**

- [ ] Route handles POST /mmc/auth/login
- [ ] Validates email and password input
- [ ] Transaction uses REPEATABLE READ + row lock
- [ ] Hashes dummy password if user not found (timing attack protection)
- [ ] Generates JWT with 15-minute TTL
- [ ] Updates last_login
- [ ] Logs login_success event
- [ ] Returns standard error contract on failure
- [ ] Integration test: successful login + token validation

---

### API-004: Create Backoffice Login Route

**File:** `apps/api/src/routes/backoffice/auth.ts`  
**Layer:** API  
**Transactional:** YES (REPEATABLE READ with row lock)  
**Idempotency:** NO (multiple tokens OK)  
**Version Enforcement:** YES (schema_version, product_version in token)  
**License Middleware:** YES (ACTIVE required)

**Description:**
Implement `POST /backoffice/auth/login` endpoint for staff/instructor login.

**Route Handler:** (See plan.md for detailed implementation)

**Key Differences from MMC:**

- Uses tenant_db (not master_db)
- Includes schema_version and product_version in JWT
- Checks license status before token issuance
- Uses tenant resolver for workspace context

**Acceptance Criteria:**

- [ ] Route handles POST /backoffice/auth/login
- [ ] Includes tenant resolver + license middleware
- [ ] Validates schema_version and product_version
- [ ] Implements failed login attempt tracking
- [ ] Locks account after 5 failures in 15 minutes
- [ ] Transaction wraps login operation
- [ ] Logs login_success or login_failed audit event
- [ ] Integration test: successful login, failed login, account lock

---

### API-005: Create Frontoffice Student Login Route

**File:** `apps/api/src/routes/frontoffice/auth.ts`  
**Layer:** API  
**Transactional:** YES (REPEATABLE READ with row lock)  
**Idempotency:** NO (multiple tokens OK)  
**Version Enforcement:** YES  
**License Middleware:** YES

**Description:**
Implement `POST /frontoffice/auth/student-login` endpoint for student login.

**Key Differences from Backoffice:**

- Includes division_id in JWT (student-specific)
- Includes subscription_status in JWT (student-specific)
- Only logs in STUDENT role users (returns 403 if non-student)

**Pseudo-code:**

```typescript
router.post('/frontoffice/auth/student-login', async (c) => {
  // ... same as backoffice login, but:

  if (user[0].role !== 'STUDENT') {
    throw ForbiddenError('Only students can use this endpoint');
  }

  // Include division_id and subscription_status in JWT
  const token = await signJWT({
    scope: 'FRONTOFFICE',
    workspace_id: workspaceId,
    user_id: user[0].id,
    role: 'STUDENT',
    division_id: user[0].division_id,
    subscription_status: user[0].subscription_status,
    token_version: user[0].token_version,
    schema_version: schemaVersion,
    product_version: productVersion,
    issued_at: ...,
    expires_at: ...
  });

  // ... rest of login flow
});
```

**Acceptance Criteria:**

- [ ] Route handles POST /frontoffice/auth/student-login
- [ ] Enforces STUDENT role check (403 if not student)
- [ ] Includes division_id and subscription_status in JWT
- [ ] Otherwise same flow as backoffice login
- [ ] Integration test: student login succeeds, non-student fails

---

### API-006: Create Logout Routes (All Domains)

**Files:**

- `apps/api/src/routes/mmc/auth.ts` (add POST /mmc/auth/logout)
- `apps/api/src/routes/backoffice/auth.ts` (add POST /backoffice/auth/logout)
- `apps/api/src/routes/frontoffice/auth.ts` (add POST /frontoffice/auth/logout)

**Layer:** API  
**Transactional:** NO (no state changes)  
**Idempotency:** YES (idempotent)  
**Version Enforcement:** N/A  
**License Middleware:** YES (for tenant routes)

**Description:**
Implement logout endpoints that invalidate the current token by incrementing token_version.

**Route Handler:**

```typescript
router.post('/backoffice/auth/logout', jwtValidationMiddleware, async (c) => {
  const userId = c.get('user_id')
  const correlationId = c.get('correlation_id')

  return dbTenant.transaction('repeatable_read', async (trx) => {
    // 1. Fetch user with row lock
    const user = await trx
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .for('update')
      .limit(1)

    if (!user.length) {
      throw UnauthorizedError('User not found')
    }

    // 2. Increment token_version (invalidates all tokens)
    await trx
      .update(users)
      .set({ token_version: sql`token_version + 1` })
      .where(eq(users.id, userId))

    // 3. Log logout
    await trx.insert(audit_logs).values({
      event_type: 'token_invalidation',
      user_id: userId,
      workspace_id: workspaceId,
      correlation_id: correlationId,
      result: 'SUCCESS',
      timestamp: new Date(),
    })
  })

  return c.json(
    {
      success: true,
      data: { message: 'Logged out' },
      error: null,
    },
    200
  )
})
```

**Acceptance Criteria:**

- [ ] JwtValidationMiddleware required (prevents unauthenticated access)
- [ ] Transaction wraps token_version increment
- [ ] Uses FOR UPDATE lock to prevent race conditions
- [ ] Logs token_invalidation audit event
- [ ] Idempotent (calling twice = same result)
- [ ] Integration test: logout invalidates token

---

### API-007: Create Logout-All Routes (All Domains)

**Files:**

- `apps/api/src/routes/mmc/auth.ts` (add POST /mmc/auth/logout-all)
- `apps/api/src/routes/backoffice/auth.ts` (add POST /backoffice/auth/logout-all)
- `apps/api/src/routes/frontoffice/auth.ts` (add POST /frontoffice/auth/logout-all)

**Layer:** API  
**Transactional:** YES (row lock update)  
**Idempotency:** YES (outcome-idempotent)  
**Version Enforcement:** N/A  
**License Middleware:** YES (for tenant routes)

**Description:**
Implement logout-all endpoints that invalidate ALL tokens for a user (admin + self-service).

**Route Handler:** (Same as LOGOUT, but called via admin API or authenticated endpoint)

**Acceptance Criteria:**

- [ ] Requires JwtValidationMiddleware
- [ ] Only admin can call for other users (future task: permission check)
- [ ] User can always call for self
- [ ] Increments token_version atomically
- [ ] All old tokens become invalid
- [ ] Outcome-idempotent

---

### API-008: Implement Error Handler Middleware

**File:** `apps/api/src/middleware/error-handler.ts`  
**Layer:** API  
**Transactional:** N/A  
**Idempotency:** N/A  
**Version Enforcement:** N/A  
**License Middleware:** N/A

**Description:**
Create error handler that converts all thrown errors to standard error contract.

**Error Mapping:**

```
InvalidCredentialsError → 401 + INVALID_CREDENTIALS
UnauthorizedError → 401 + TOKEN_INVALID
ForbiddenError → 403 + PERMISSION_DENIED
AccountLockedError → 423 + ACCOUNT_LOCKED
UpgradeRequiredError → 426 + UPGRADE_REQUIRED
RateLimitError → 429 + RATE_LIMIT
ValidationError → 400 + VALIDATION_ERROR
InternalError → 500 + INTERNAL_ERROR
```

**Response Format:**

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "ERROR_CODE",
    "message": "Descriptive message"
  }
}
```

**Acceptance Criteria:**

- [ ] All error codes mapped to HTTP status
- [ ] Standard error contract applied
- [ ] Error handler catches all exceptions
- [ ] Logs error with correlation_id
- [ ] Does NOT leak stack traces to client
- [ ] Integration test: each error code tested

---

### API-009: Wire Middleware Stack – Protected Routes

**File:** `apps/api/src/routes/index.ts`  
**Layer:** API  
**Transactional:** N/A  
**Idempotency:** N/A  
**Version Enforcement:** N/A  
**License Middleware:** N/A

**Description:**
Create protected router composition that applies full middleware stack in order:

```typescript
// apps/api/src/routes/index.ts

// Create router with full middleware stack
const protectedRouter = new Hono()
  .use(correlationIdMiddleware())
  .use(tenantResolverMiddleware()) // Skip for MMC
  .use(licenseEnforcementMiddleware()) // Skip for MMC login
  .use(schemaValidationMiddleware()) // Skip for MMC

// Add protected routes to routers
function addProtectedRoutes(app: Hono) {
  // Backoffice routes
  app.route('/backoffice', backofficeRouter.bind(protectedRouter))

  // Frontoffice routes
  app.route('/frontoffice', frontofficeRouter.bind(protectedRouter))
}
```

**Acceptance Criteria:**

- [ ] All protected routes use full middleware stack
- [ ] Middleware applied in correct order
- [ ] MMC routes skip tenant resolver
- [ ] Login routes don't require JwtValidationMiddleware
- [ ] Protected routes require JwtValidationMiddleware
- [ ] No route can bypass middleware structurally

---

### API-010: Add Input Validation – Auth Requests

**File:** `packages/validation/auth-schemas.ts`  
**Layer:** API  
**Transactional:** N/A  
**Idempotency:** N/A  
**Version Enforcement:** N/A  
**License Middleware:** N/A

**Description:**
Create Zod schemas for login/logout request validation.

**Schemas:**

```typescript
export const loginSchema = z.object({
  email: z.string().email().max(256),
  password: z.string().min(8).max(256),
})

export const logoutSchema = z.object({}) // No body required
```

**Acceptance Criteria:**

- [ ] Schemas validate email format
- [ ] Schemas validate password length (8-256)
- [ ] Routes use schemas to validate input
- [ ] Invalid input returns 400 VALIDATION_ERROR
- [ ] Unit test: valid/invalid inputs

---

### API-011: Add Rate Limiting Configuration

**File:** `apps/api/src/middleware/rate-limiter.ts`  
**Layer:** API  
**Transactional:** N/A  
**Idempotency:** N/A  
**Version Enforcement:** N/A  
**License Middleware:** N/A

**Description:**
Create rate limiter for login endpoints (prevent brute force).

**Configuration:**

```typescript
export const loginRateLimiter = createRateLimiter({
  key: (c) => c.req.header('x-forwarded-for') || 'unknown',
  limit: 20, // attempts
  window: 15 * 60 * 1000, // 15 minutes
})
```

**Note:** Per-email rate limiting happens in-database (via login_attempts table). IP-based rate limiting is optional (can be at gateway level).

**Acceptance Criteria:**

- [ ] Middleware configurable (limit, window)
- [ ] Applied to login endpoints
- [ ] Returns 429 on limit exceeded
- [ ] Unit test: rate limit enforced

---

---

## FRONTEND LAYER TASKS (Execute in Parallel with API)

These tasks create UI state management and API integration (JS only, no HTML/CSS yet).

### FRONTEND-001: Create Auth Store (Pinia)

**File:** `apps/frontoffice/src/stores/auth.ts` (or similar)  
**Layer:** Frontend  
**Transactional:** N/A  
**Idempotency:** N/A  
**Version Enforcement:** N/A  
**License Middleware:** N/A

**Description:**
Create Pinia store for authentication state management.

**Store Actions:**

```typescript
export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(null)
  const user = ref<AuthN | null>(null)

  const login = async (email: string, password: string) => {
    const response = await fetch('/frontoffice/auth/student-login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })

    if (!response.ok) throw new Error(await response.text())

    const data = await response.json()
    token.value = data.data.token // Store in memory ONLY
    user.value = data.data.user
  }

  const logout = async () => {
    if (!token.value) return
    await fetch('/frontoffice/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token.value}` },
    })
    token.value = null
    user.value = null
  }

  const getAuthHeader = () => {
    return token.value ? { Authorization: `Bearer ${token.value}` } : {}
  }

  return { token, user, login, logout, getAuthHeader }
})
```

**Acceptance Criteria:**

- [ ] Store stores token in memory only (never localStorage)
- [ ] Token and user state management
- [ ] login() action calls API
- [ ] logout() action calls API
- [ ] getAuthHeader() returns auth header for requests
- [ ] No RBAC logic in store (permission checks are advisory UX only)

---

### FRONTEND-002: Create API Client Interceptor

**File:** `apps/frontoffice/src/api/client.ts` (or integrate into HTTP client)  
**Layer:** Frontend  
**Transactional:** N/A  
**Idempotency:** N/A  
**Version Enforcement:** N/A  
**License Middleware:** N/A

**Description:**
Create HTTP client that automatically adds Authorization header and handles auth errors.

**Interceptor Logic:**

```typescript
export function createAuthenticatedClient() {
  const authStore = useAuthStore()

  return new FetchClient({
    baseUrl: import.meta.env.VITE_API_BASE_URL,
    async onRequest(request) {
      const headers = authStore.getAuthHeader()
      return { ...request, headers: { ...request.headers, ...headers } }
    },
    async onResponseError(response) {
      if (response.status === 401) {
        // Token invalid/expired → force logout
        authStore.logout()
        window.location.href = '/login'
      }
      if (response.status === 426) {
        // Schema version mismatch → force logout
        authStore.logout()
        window.location.href = '/login?reason=upgrade_required'
      }
    },
  })
}
```

**Acceptance Criteria:**

- [ ] Interceptor adds Authorization header automatically
- [ ] 401 triggers logout + redirect to login
- [ ] 426 triggers logout + redirect with query param
- [ ] Other errors passed through
- [ ] No business logic in interceptor

---

### FRONTEND-003: Create Login Page Component

**File:** `apps/frontoffice/src/pages/Login.vue`  
**Layer:** Frontend  
**Transactional:** N/A  
**Idempotency:** N/A  
**Version Enforcement:** N/A  
**License Middleware:** N/A

**Description:**
Create login form component using shadcn-vue + Tailwind v4.

**Note:** Logic-free component - only collect email/password, call auth store.

**Component Structure:**

```vue
<template>
  <div class="login-container">
    <form @submit.prevent="handleLogin">
      <input v-model="email" type="email" placeholder="Email" required />
      <input
        v-model="password"
        type="password"
        placeholder="Password"
        required
      />
      <button type="submit" :disabled="loading">Login</button>
      <p v-if="error" class="error">{{ error }}</p>
    </form>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'

const email = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')
const authStore = useAuthStore()

const handleLogin = async () => {
  loading.value = true
  error.value = ''
  try {
    await authStore.login(email.value, password.value)
    // Redirect happens via router guard
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}
</script>
```

**Acceptance Criteria:**

- [ ] Form collects email and password
- [ ] Calls authStore.login()
- [ ] Shows loading state during request
- [ ] Shows error message on failure
- [ ] Navigates to home on success (router guard)
- [ ] Uses shadcn-vue form components
- [ ] Styled with Tailwind v4 utilities

---

### FRONTEND-004: Create Router Guard – Auth Protection

**File:** `apps/frontoffice/src/router/guards.ts`  
**Layer:** Frontend  
**Transactional:** N/A  
**Idempotency:** N/A  
**Version Enforcement:** N/A  
**License Middleware:** N/A

**Description:**
Create router guards to protect routes from unauthenticated access.

**Guard Logic:**

```typescript
export function setupAuthGuard(router: Router) {
  router.beforeEach((to, from, next) => {
    const authStore = useAuthStore()

    // Public routes (login, about, etc.)
    if (['login', 'public'].includes(to.name)) {
      return next()
    }

    // Protected routes require auth
    if (!authStore.token) {
      return next({ name: 'login', query: { redirect: to.fullPath } })
    }

    next()
  })
}
```

**Acceptance Criteria:**

- [ ] Guard checks for token presence
- [ ] Redirects to login if missing
- [ ] Allows public routes without token
- [ ] Preserves redirect path for post-login navigation
- [ ] NO permission checks (advisory only)

---

---

## OBSERVABILITY TASKS (Execute Fourth)

These tasks add logging, metrics, and observability infrastructure.

### OBS-001: Create Structured Logging – Auth Events

**File:** `apps/api/src/utils/auth-logger.ts`  
**Layer:** Observability  
**Transactional:** N/A (logging)  
**Idempotency:** N/A  
**Version Enforcement:** N/A  
**License Middleware:** N/A

**Description:**
Create auth-specific logger that emits structured JSON events with proper schema.

**Logger:**

```typescript
export function logAuthEvent(event: AuthEvent) {
  const log = {
    timestamp: new Date().toISOString(),
    level: event.result === 'SUCCESS' ? 'info' : 'warn',
    service: 'auth',
    version: '1.0.0',
    correlation_id: event.correlation_id,
    workspace_id: event.workspace_id,
    workspace_slug: event.workspace_slug,
    user_id: event.user_id,
    event_type: event.event_type,
    domain: event.domain,
    ip_address: event.ip_address,
    user_agent: event.user_agent,
    result: event.result,
    details: event.details,
    duration_ms: event.duration_ms,
  }

  logger.log(log) // Pino structured logger
}
```

**Acceptance Criteria:**

- [ ] Logger emits Pino JSON format
- [ ] Includes all required fields (correlation_id, workspace_slug, user_id, etc.)
- [ ] Timestamps in UTC ISO format
- [ ] No console.log (Pino only)
- [ ] Called by all auth endpoints
- [ ] Optional fields only included when applicable

---

### OBS-002: Add Prometheus Metrics – Auth

**File:** `apps/api/src/metrics/auth-metrics.ts`  
**Layer:** Observability  
**Transactional:** N/A  
**Idempotency:** N/A  
**Version Enforcement:** N/A  
**License Middleware:** N/A

**Description:**
Create Prometheus metrics for authentication critical path.

**Metrics:**

```typescript
export const authMetrics = {
  loginAttempts: new Counter({
    name: 'auth_login_attempts_total',
    help: 'Total login attempts',
    labelNames: ['result', 'workspace'],
  }),

  loginDuration: new Histogram({
    name: 'auth_login_duration_seconds',
    help: 'Login endpoint duration',
    labelNames: ['workspace'],
    buckets: [0.1, 0.5, 1, 2, 5],
  }),

  tokenValidation: new Counter({
    name: 'auth_token_validation_total',
    help: 'JWT validations',
    labelNames: ['result', 'workspace'],
  }),

  accountLocks: new Counter({
    name: 'auth_account_lock_total',
    help: 'Account locks triggered',
    labelNames: ['workspace'],
  }),
}
```

**Acceptance Criteria:**

- [ ] Metrics exported to Prometheus format
- [ ] Counter for login attempts (success/failure)
- [ ] Histogram for login duration
- [ ] Counter for token validations
- [ ] Counter for account locks
- [ ] Labels include workspace_id for cardinality

---

### OBS-003: Add Request Duration Monitoring

**File:** `apps/api/src/middleware/timing.ts`  
**Layer:** Observability  
**Transactional:** N/A  
**Idempotency:** N/A  
**Version Enforcement:** N/A  
**License Middleware:** N/A

**Description:**
Create middleware that measures request duration and emits metrics/logs.

**Middleware:**

```typescript
export function timingMiddleware() {
  return async (c: Context, next: Next) => {
    const start = performance.now()

    await next()

    const duration = performance.now() - start
    c.header('x-duration-ms', duration.toString())

    authMetrics.loginDuration.observe(
      { workspace: c.get('workspace_id') || 'mmc' },
      duration / 1000
    )
  }
}
```

**Acceptance Criteria:**

- [ ] Middleware measures request duration
- [ ] Emits timing metric
- [ ] Returns duration in response header
- [ ] Included in error logging

---

---

## TESTING TASKS (Execute Fifth)

These tasks create unit and integration tests.

### TEST-001: Unit Tests – Password Hashing

**File:** `packages/domain-core/auth/__tests__/password.test.ts`  
**Layer:** Testing  
**Transactional:** N/A  
**Idempotency:** N/A  
**Version Enforcement:** N/A  
**License Middleware:** N/A

**Description:**
Test password hashing and verification functions.

**Test Cases:**

```
✓ hashPassword: Valid password hashed to 60+ chars
✓ hashPassword: Invalid length (< 8) throws
✓ hashPassword: Invalid length (> 256) throws
✓ verifyPassword: Correct password returns true
✓ verifyPassword: Wrong password returns false
✓ verifyPassword: Dummy hash verification takes ~100ms (timing attack)
```

**Acceptance Criteria:**

- [ ] All test cases pass
- [ ] Password hashing deterministic for same input
- [ ] Timing attack protected (dummy hash verification)

---

### TEST-002: Unit Tests – JWT Operations

**File:** `packages/domain-core/auth/__tests__/jwt.test.ts`  
**Layer:** Testing  
**Transactional:** N/A  
**Idempotency:** N/A  
**Version Enforcement:** N/A  
**License Middleware:** N/A

**Description:**
Test JWT signing and verification.

**Test Cases:**

```
✓ signJWT: Creates valid JWT token
✓ verifyJWT: Verifies valid token
✓ verifyJWT: Rejects invalid signature
✓ verifyJWT: Rejects expired token
✓ signJWT: Token includes all claims
✓ verifyJWT: Token roundtrip (sign → verify)
```

**Acceptance Criteria:**

- [ ] All test cases pass
- [ ] JWT roundtrip verified
- [ ] Invalid tokens rejected

---

### TEST-003: Unit Tests – RBAC Evaluation

**File:** `packages/domain-core/auth/__tests__/rbac.test.ts`  
**Layer:** Testing  
**Transactional:** N/A (mocked DB)  
**Idempotency:** N/A  
**Version Enforcement:** N/A  
**License Middleware:** N/A

**Description:**
Test permission evaluation logic (mocked database).

**Test Cases:**

```
✓ evaluatePermission: User with permission returns true
✓ evaluatePermission: User without permission returns false
✓ evaluatePermission: Missing user returns false
✓ evaluatePermission: ADMIN has all permissions
✓ evaluatePermission: STAFF has limited permissions
```

**Acceptance Criteria:**

- [ ] All test cases pass
- [ ] DB mocked (no real DB access)
- [ ] Permissions correctly evaluated

---

### TEST-004: Integration Tests – Login Flow

**File:** `apps/api/tests/integration/backoffice-login.test.ts`  
**Layer:** Testing  
**Transactional:** YES (tests use real DB in transaction, rollback after)  
**Idempotency:** N/A  
**Version Enforcement:** YES (tests include schema_version)  
**License Middleware:** YES (tests include license status)

**Description:**
Test complete login flow end-to-end.

**Test Scenarios:**

```
✓ Login: Valid email + password → 200 + token
✓ Login: Invalid email → 401
✓ Login: Invalid password → 401
✓ Login: Account locked → 423
✓ Login: License SOFT_LOCKED → 423
✓ Login: License ARCHIVED → 403
✓ Login: Schema version mismatch → 426 on next request with old token
✓ Login: Token includes all claims
✓ Login: Multiple concurrent logins → both succeed (different tokens)
```

**Acceptance Criteria:**

- [ ] All scenarios tested
- [ ] Tests use real DB (transaction rollback)
- [ ] Token validation verified
- [ ] Error responses correct

---

### TEST-005: Integration Tests – Logout Flow

**File:** `apps/api/tests/integration/logout.test.ts`  
**Layer:** Testing  
**Transactional:** YES  
**Idempotency:** N/A  
**Version Enforcement:** N/A  
**License Middleware:** YES

**Description:**
Test logout and logout-all flows.

**Test Scenarios:**

```
✓ Logout: Valid token → 200 + token invalidated
✓ Logout: Subsequent request with old token → 401
✓ Logout-All: Valid token → 200 + all tokens invalidated
✓ Logout-All: Idempotent (call twice, same result)
✓ Logout: Unauthenticated request → 401
```

**Acceptance Criteria:**

- [ ] Logout invalidates token immediately
- [ ] Logout-all invalidates all tokens
- [ ] Idempotency verified
- [ ] Error responses correct

---

### TEST-006: Integration Tests – Concurrency

**File:** `apps/api/tests/integration/concurrency.test.ts`  
**Layer:** Testing  
**Transactional:** YES  
**Idempotency:** N/A  
**Version Enforcement:** N/A  
**License Middleware:** YES

**Description:**
Test concurrent login and account lock race conditions.

**Test Scenarios:**

```
✓ Concurrent Logins: 10 concurrent requests from same email
  → All succeed (10 different tokens issued)
✓ Failed Attempts Race: 10 concurrent failed attempts
  → Lock triggered at exactly 5th attempt (no race)
✓ Token Version Race: Concurrent logout-all requests
  → Both succeed (version incremented atomically)
```

**Acceptance Criteria:**

- [ ] Concurrent operations don't cause race conditions
- [ ] Account lock threshold respected
- [ ] Token version atomic updates
- [ ] All requests succeed or fail correctly

---

### TEST-007: Integration Tests – Error Contract

**File:** `apps/api/tests/integration/error-contract.test.ts`  
**Layer:** Testing  
**Transactional:** YES  
**Idempotency:** N/A  
**Version Enforcement:** N/A  
**License Middleware:** YES

**Description:**
Test error response contract compliance.

**Test Scenarios:**

```
✓ All errors return: { success: false, data: null, error: { code, message } }
✓ 401 errors return INVALID_CREDENTIALS, TOKEN_INVALID, etc.
✓ 403 errors return PERMISSION_DENIED, LICENSE_ARCHIVED
✓ 423 errors return ACCOUNT_LOCKED, LICENSE_SOFT_LOCKED
✓ 426 errors return UPGRADE_REQUIRED
✓ 429 errors return RATE_LIMIT
✓ No stack traces leaked to client
✓ Error codes consistently used
```

**Acceptance Criteria:**

- [ ] All error responses follow contract
- [ ] HTTP status codes correct
- [ ] No stack trace leakage
- [ ] Error codes consistent

---

### TEST-008: Integration Tests – Audit Logging

**File:** `apps/api/tests/integration/audit-logging.test.ts`  
**Layer:** Testing  
**Transactional:** YES  
**Idempotency:** N/A  
**Version Enforcement:** N/A  
**License Middleware:** YES

**Description:**
Test audit log events are generated.

**Test Scenarios:**

```
✓ Login success → audit log event 'login_success' inserted
✓ Login failure → audit log event 'login_failed' inserted
✓ Account locked → audit log event 'account_locked' inserted
✓ Token invalid → audit log event 'token_invalid' inserted
✓ Logout → audit log event 'token_invalidation' inserted
✓ All events include correlation_id
✓ All events include workspace_id
✓ Success events include user_id
✓ Failure events may not include user_id
```

**Acceptance Criteria:**

- [ ] All auth events logged
- [ ] All required fields present
- [ ] Logs queryable by correlation_id
- [ ] Logs structured in Pino format

---

### TEST-009: Integration Tests – Version Enforcement

**File:** `apps/api/tests/integration/version-enforcement.test.ts`  
**Layer:** Testing  
**Transactional:** YES  
**Idempotency:** N/A  
**Version Enforcement:** YES  
**License Middleware:** YES

**Description:**
Test schema and product version enforcement.

**Test Scenarios:**

```
✓ Login: Token includes schema_version = workspace.schema_version
✓ Token Validation: token.schema_version != workspace.schema_version → 426
✓ Token Validation: token.product_version incompatible → 426
✓ Workspace Upgrade: Old tokens from v1.0.0 invalid in v1.1.0 workspace
✓ Product Downgrade: Product version compatibility rules enforced
```

**Acceptance Criteria:**

- [ ] Schema version captured at login
- [ ] Schema version validated on request
- [ ] Product version compatibility checked
- [ ] 426 returned on mismatch

---

### TEST-010: Isolation Tests – Workspace Boundary

**File:** `apps/api/tests/integration/isolation.test.ts`  
**Layer:** Testing  
**Transactional:** YES  
**Idempotency:** N/A  
**Version Enforcement:** N/A  
**License Middleware:** YES

**Description:**
Test workspace isolation enforcement (tokens cannot cross workspaces).

**Test Scenarios:**

```
✓ Login: Workspace A → token issued with workspace_id = A
✓ Cross-Workspace: Token from A used in Workspace B → 401
✓ Domain Mismatch: MMC token used in Backoffice route → 401
✓ Scope Mismatch: Backoffice token used in Frontoffice route → 401
```

**Acceptance Criteria:**

- [ ] Cross-workspace tokens rejected
- [ ] Cross-domain tokens rejected
- [ ] workspace_id validation enforced
- [ ] scope validation enforced

---

### TEST-011: Isolation Tests – Division Boundary

**File:** `apps/api/tests/integration/division-boundary.test.ts`  
**Layer:** Testing  
**Transactional:** YES  
**Idempotency:** N/A  
**Version Enforcement:** N/A  
**License Middleware:** YES

**Description:**
Test student division isolation (students cannot access other divisions).

**Test Scenarios:**

```
✓ Login: Student login → token includes division_id
✓ Same Division: Student accesses exams in own division → 200
✓ Different Division: Student accesses exams in different division → 403
```

**Note:** Actual route handlers implement division check (future task). This tests route-level enforcement exists.

**Acceptance Criteria:**

- [ ] Student login includes division_id
- [ ] Division-scoped routes enforce boundary

---

---

## SECURITY TASKS (Execute Parallel with Testing)

These tasks add security validations and hardening.

### SEC-001: Implement RBAC Middleware Scope Validation

**File:** `apps/api/src/middleware/rbac.ts`  
**Layer:** Security  
**Transactional:** N/A  
**Idempotency:** N/A  
**Version Enforcement:** N/A  
**License Middleware:** N/A

**Description:**
Create middleware that validates user has required permission.

**Middleware:**

```typescript
export function requirePermission(permission: string) {
  return async (c: Context, next: Next) => {
    const userId = c.get('user_id')
    if (!userId) throw UnauthorizedError('Not authenticated')

    const allowed = await evaluatePermission(userId, permission, db)
    if (!allowed) {
      throw ForbiddenError('Permission denied')
    }

    await next()
  }
}
```

**Usage:**

```typescript
router.delete(
  '/exams/:id',
  requirePermission('exams.delete'),
  deleteExamHandler
)
```

**Acceptance Criteria:**

- [ ] Middleware checks permission server-side
- [ ] 403 returned if permission denied
- [ ] Frontend cannot bypass (backend always checks)
- [ ] Logs permission denial

---

### SEC-002: Implement Email Enumeration Protection

**File:** `apps/api/src/middleware/email-enumeration.ts`  
**Layer:** Security  
**Transactional:** N/A  
**Idempotency:** N/A  
**Version Enforcement:** N/A  
**License Middleware:** N/A

**Description:**
Ensure login endpoint doesn't reveal if email exists (timing attack).

**Implementation:**
Already implemented in login route (DOMAIN-001 prerequisite):

- If user not found → hash dummy password (costs ~100ms)
- Return same error message as password mismatch

**Test:** Verify timing is constant (±10ms) for both cases

**Acceptance Criteria:**

- [ ] User exists + wrong password: ~1000ms
- [ ] User not found: ~1000ms (hash dummy password)
- [ ] Same error message returned
- [ ] Timing attack test passes

---

### SEC-003: Implement SQL Injection Protection

**File:** All API routes (already using Drizzle ORM)  
**Layer:** Security  
**Transactional:** N/A (ORM responsibility)  
**Idempotency:** N/A  
**Version Enforcement:** N/A  
**License Middleware:** N/A

**Description:**
Verify all DB queries use parameterized statements (ORM protection).

**Verification:**

- Drizzle ORM used for all queries (no raw SQL in auth layer)
- User input passed as parameters, never as strings
- Review commits to ensure no raw SQL introduced

**Acceptance Criteria:**

- [ ] No string concatenation in SQL
- [ ] All queries use Drizzle ORM
- [ ] Parameter binding used throughout

---

### SEC-004: Implement XSS Protection – Frontend

**File:** All Vue components  
**Layer:** Security  
**Transactional:** N/A  
**Idempotency:** N/A  
**Version Enforcement:** N/A  
**License Middleware:** N/A

**Description:**
Ensure frontend doesn't render user input unsafely.

**Vue Template Safe:**

```vue
<!-- SAFE: Vue auto-escapes -->
<p>{{ errorMessage }}</p>

<!-- UNSAFE: Do NOT use v-html with user input -->
<p v-html="userInput"></p>
```

**Acceptance Criteria:**

- [ ] Never use v-html with untrusted input
- [ ] Error messages escaped
- [ ] User data escaped in templates

---

### SEC-005: Implement CORS Configuration

**File:** `apps/api/src/middleware/cors.ts` or Hono CORS  
**Layer:** Security  
**Transactional:** N/A  
**Idempotency:** N/A  
**Version Enforcement:** N/A  
**License Middleware:** N/A

**Description:**
Configure CORS to allow only trusted origins.

**Configuration:**

```typescript
export function corsMiddleware() {
  return cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['content-type', 'authorization', 'x-correlation-id'],
  })
}
```

**Acceptance Criteria:**

- [ ] Whitelisted origins only
- [ ] Credentials allowed (for cookies/JWT)
- [ ] Configurable via environment
- [ ] Preflight requests handled

---

---

## DEPLOYMENT TASKS (Execute Before Production)

### DEPLOY-001: Generate JWT_SECRET

**File:** DevOps runbook  
**Layer:** Deployment  
**Transactional:** N/A  
**Idempotency:** N/A  
**Version Enforcement:** N/A  
**License Middleware:** N/A

**Description:**
Generate cryptographically secure JWT secret for production.

**Command:**

```bash
openssl rand -base64 32
# Output: 48-character base64 string (32 bytes)
# Store in: Docker secrets or environment variable
```

**Acceptance Criteria:**

- [ ] Secret generated with openssl
- [ ] 32+ bytes (256+ bits)
- [ ] Stored in Docker secrets (prod) or .env (dev)
- [ ] Not committed to version control

---

### DEPLOY-002: Verify NTP Synchronization

**File:** DevOps runbook  
**Layer:** Deployment  
**Transactional:** N/A  
**Idempotency:** N/A  
**Version Enforcement:** N/A  
**License Middleware:** N/A

**Description:**
Ensure all servers have NTP running and clock is synced.

**Check:**

```bash
ntpq -pn  # Verify NTP peers
timedatectl  # Show time sync status (systemd)
```

**Acceptance Criteria:**

- [ ] All servers running ntpd/chrony
- [ ] Clock drift < 1 second
- [ ] Alarm set for NTP failure
- [ ] Documented in runbook

---

### DEPLOY-003: Create Migration Execution Plan

**File:** DevOps runbook  
**Layer:** Deployment  
**Transactional:** YES  
**Idempotency:** YES  
**Version Enforcement:** N/A  
**License Middleware:** N/A

**Description:**
Document migration execution order and rollback procedure.

**Steps:**

```
1. Backup master_db
2. Run master migration (0003_create_mmc_users.sql)
3. Backup tenant_db (all worksheets)
4. For each tenant:
   a. Run tenant migration (0003_create_auth_tables.sql)
   b. Run seed (0001_default_roles.sql)
   c. Update schema_version in metadata
5. Verify schema_version updated in all tenants
6. Test login endpoints
```

**Rollback:**

- Restore from backup only (no schema rollback in Phase 1)

**Acceptance Criteria:**

- [ ] Documented in runbook
- [ ] Backup procedures defined
- [ ] Rollback procedure defined
- [ ] Tested in staging

---

---

## FINAL COMPLIANCE & SUMMARY

### Compliance Checklist

- ✅ **Transactions:** All write operations wrapped (login, logout, account lock)
- ✅ **Idempotency:** Logout/logout-all designed as idempotent (outcome)
- ✅ **Isolation:** workspace_id validation + scope validation implemented
- ✅ **Version Enforcement:** schema_version and product_version checked
- ✅ **License Middleware:** Applied to tenant routes
- ✅ **Error Contract:** Standardized error responses with HTTP codes
- ✅ **Logging:** Structured JSON (Pino) with correlation_id
- ✅ **No Frontend Authority:** RBAC enforced backend-only
- ✅ **No Grading:** Auth is stateless (not attempt-related)
- ✅ **No Direct DB:** All access via Drizzle + resolver
- ✅ **Testing:** Unit + integration + isolation + security tests
- ✅ **Security:** Email enumeration, SQL injection, XSS, CORS protected

### Task Count Summary

| Category       | Count  | Status    |
| -------------- | ------ | --------- |
| Infrastructure | 5      | Ready     |
| Domain Layer   | 4      | Ready     |
| API Layer      | 11     | Ready     |
| Frontend Layer | 4      | Ready     |
| Observability  | 3      | Ready     |
| Testing        | 11     | Ready     |
| Security       | 5      | Ready     |
| Deployment     | 3      | Ready     |
| **TOTAL**      | **46** | **Ready** |

### Execution Flow

```
INFRASTRUCTURE: INFRA-001 → INFRA-002 → INFRA-003 → INFRA-004 → INFRA-005
                    ↓
DOMAIN: DOMAIN-001 → DOMAIN-002 → DOMAIN-003 → DOMAIN-004
                    ↓
API: (Parallel) → API-001 through API-011 (routes, middleware, validation)
     ↓
FRONTEND: (Parallel) → FRONTEND-001 through FRONTEND-004 (store, interceptor, UI)
     ↓
OBS: OBS-001 → OBS-002 → OBS-003 (logging, metrics, monitoring)
     ↓
TESTING: (Parallel) → TEST-001 through TEST-011 (all test suites)
SECURITY: (Parallel) → SEC-001 through SEC-005 (hardening)
     ↓
DEPLOY: DEPLOY-001 → DEPLOY-002 → DEPLOY-003 (pre-production)
```

---

## Task Set Compliance Statement

**Task set compliant with Zidney Constitution v1.2.0 — No violations detected.**

✅ Multi-tenancy: workspace_id isolation enforced  
✅ License enforcement: Middleware mandatory, SOFT_LOCKED blocks  
✅ Isolation boundaries: No cross-tenant access  
✅ Transaction integrity: All writes atomic  
✅ Version enforcement: schema_version + product_version checked  
✅ Authoritative time: Server NOW() only  
✅ Layer separation: No frontend logic, no HTTP in domain  
✅ RBAC: Backend enforced exclusively  
✅ Error contract: Standardized responses  
✅ Audit logging: Structured, complete traceability

**Status:** ✅ Tasks Ready for Implementation

---

## Next Steps

1. **Assign Tasks** — Distribute to development team
2. **Execute in Order** — Follow dependency graph
3. **Run Tests** — All tests must pass before merge
4. **Review Compliance** — Verify each task meets requirements
5. **Deploy** — Follow deployment checklist

**Ready for Implementation:** YES
