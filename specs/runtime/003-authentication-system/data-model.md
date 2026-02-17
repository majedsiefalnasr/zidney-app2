# Data Model – Authentication System

**Stage:** STAGE_03_AUTHENTICATION_SYSTEM  
**Database Scope:** master_db + tenant_db  
**Version:** 1.0.0 (initial)

---

## Database Scopes

### master_db (Platform Level)

Shared across all tenants and workspaces.

**Tables:**

- mmc_users — Platform administrators and operators

### tenant_db (Workspace Level)

Per-workspace database with its own connection pool.

**Tables:**

- users — Workspace staff (ADMIN, STAFF, INSTRUCTOR) and students (STUDENT)
- user_roles — Role assignments (many-to-many)
- roles — Role definitions (ADMIN, INSTRUCTOR, STAFF)
- role_permissions — Permission assignments per role
- login_attempts — Failed login tracking for brute force prevention
- audit_logs — Complete auth event audit trail

---

## Entity Relationship Diagram

```
master_db:
  ┌─────────────┐
  │ mmc_users   │
  └─────────────┘

tenant_db:
  ┌──────────────┐
  │    users     │
  └──────────────┘
         │
         └─┬─────────────────┐
           │                 │
      (1 user many roles)    (to division_id if STUDENT)
           │                 │
      ┌─────────────┐   [external]
      │ user_roles  │   divisions
      └─────────────┘
           │
           └─ role_id (FK)
              │
         ┌────────────┐
         │   roles    │
         └────────────┘
              │
              └─┬──────────────────┐
                │                  │
           (1 role many perms)     (for display)
                │
        ┌──────────────────┐
        │ role_permissions│
        └──────────────────┘

  ┌────────────────┐
  │ login_attempts │
  └────────────────┘

  ┌────────────┐
  │ audit_logs │
  └────────────┘
```

---

## Table Definitions

### master_db.mmc_users

Platform-level users (administrators, operators).

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

**Columns:**

| Column        | Type      | Constraints            | Purpose                 |
| ------------- | --------- | ---------------------- | ----------------------- |
| id            | UUID      | PK                     | Unique identifier       |
| email         | TEXT      | NOT NULL, UNIQUE       | Login identity          |
| password_hash | TEXT      | NOT NULL               | bcrypt hash (64+ bytes) |
| role          | TEXT      | CHECK(ADMIN\|OPERATOR) | Platform role           |
| token_version | INT       | DEFAULT 0              | Logout-all counter      |
| created_at    | TIMESTAMP | DEFAULT NOW()          | Account creation        |
| updated_at    | TIMESTAMP | DEFAULT NOW()          | Last modification       |
| last_login    | TIMESTAMP | NULL                   | Audit field             |

**Lifecycle:**

- Created: Provisioning API (admin action)
- Deleted: Archival API (mark archived with is_archived flag in Phase 2)
- Updated: Password change, role change

**Isolation:** Global (no workspace isolation)

---

### tenant_db.users

Workspace-scoped users (staff, students).

```sql
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
```

**Columns:**

| Column              | Type      | Constraints                      | Purpose                                          |
| ------------------- | --------- | -------------------------------- | ------------------------------------------------ |
| id                  | UUID      | PK                               | Unique identifier                                |
| email               | TEXT      | NOT NULL, UNIQUE                 | Login identity per workspace                     |
| password_hash       | TEXT      | NOT NULL                         | bcrypt hash                                      |
| role                | TEXT      | CHECK IN 4 values                | Primary role (ADMIN, STAFF, INSTRUCTOR, STUDENT) |
| token_version       | INT       | DEFAULT 0                        | Logout-all counter                               |
| subscription_status | TEXT      | CHECK (ACTIVE\|EXPIRED\|PENDING) | For FRONTOFFICE only                             |
| division_id         | UUID      | FK → divisions                   | For STUDENT only, NULL for staff                 |
| locked_until        | TIMESTAMP | NULL                             | Account lock expiry                              |
| created_at          | TIMESTAMP | DEFAULT NOW()                    | Account creation                                 |
| updated_at          | TIMESTAMP | DEFAULT NOW()                    | Last modification                                |
| last_login          | TIMESTAMP | NULL                             | Audit field                                      |

**Constraint:** `single_role_per_workspace`

- Staff (ADMIN, STAFF, INSTRUCTOR) MUST have division_id = NULL
- Students (STUDENT) MUST have division_id NOT NULL
- Prevents data inconsistency

**Lifecycle:**

- Created: Provisioning API
- Deleted: Deletion API (hard delete or soft-delete in Phase 2)
- Updated: Password change, role change, account lock/unlock

**Isolation:** Workspace-scoped (one users table per tenant_db)

---

### tenant_db.user_roles

Many-to-many relationship between users and roles.

```sql
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),

  UNIQUE(user_id, role_id)
);

CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_user_roles_role_id ON user_roles(role_id);
```

**Purpose:** Allow users to have multiple roles (FUTURE expansion)

**Phase 1 Usage:**

- Each user has exactly one role (stored in users.role)
- user_roles table for future role-per-user flexibility
- Currently: UNIQUE constraint ensures one-to-one

**Columns:**

| Column     | Type      | Constraints          | Purpose             |
| ---------- | --------- | -------------------- | ------------------- |
| id         | UUID      | PK                   | Unique identifier   |
| user_id    | UUID      | FK, NOT NULL, UNIQUE | User reference      |
| role_id    | UUID      | FK, NOT NULL, UNIQUE | Role reference      |
| created_at | TIMESTAMP | DEFAULT NOW()        | Assignment creation |

**Lifecycle:**

- Created: On user creation (one role assigned)
- Deleted: On user deletion (CASCADE)
- Updated: On role change (delete old, insert new)

---

### tenant_db.roles

Role definitions with permissions.

```sql
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE CHECK (name IN ('ADMIN', 'INSTRUCTOR', 'STAFF')),
  permissions JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

**Columns:**

| Column      | Type      | Constraints      | Purpose                   |
| ----------- | --------- | ---------------- | ------------------------- |
| id          | UUID      | PK               | Unique identifier         |
| name        | TEXT      | UNIQUE, NOT NULL | Role name                 |
| permissions | JSONB     | NOT NULL         | Permission flags (future) |
| created_at  | TIMESTAMP | DEFAULT NOW()    | Creation timestamp        |
| updated_at  | TIMESTAMP | DEFAULT NOW()    | Last modification         |

**Standard Roles:**

| Role       | Permissions                    | Use Case                |
| ---------- | ------------------------------ | ----------------------- |
| ADMIN      | All                            | Workspace administrator |
| INSTRUCTOR | exams._, reports._, grading.\* | Exam organizer          |
| STAFF      | reports._, audit_logs._        | Support staff           |
| STUDENT    | exam.take, profile.\*          | Student taker           |

**Lifecycle:**

- Created: Workspace provisioning (seed 3 roles)
- Deleted: Never (roles are permanent)
- Updated: Permissions changed by admin

---

### tenant_db.role_permissions

Permissions per role (denormalized in Phase 1, could be normalized later).

```sql
CREATE TABLE role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),

  UNIQUE(role_id, permission)
);

CREATE INDEX idx_role_permissions_role_id ON role_permissions(role_id);
```

**Purpose:** Extensible permission model for RBAC

**Phase 1 Permissions:**

```
exams.view
exams.create
exams.edit
exams.delete
exams.run

questions.view
questions.create
questions.edit
questions.delete

students.view
students.create
students.edit

reports.view
reports.export

audit_logs.view

settings.manage
```

**Columns:**

| Column     | Type      | Constraints               | Purpose            |
| ---------- | --------- | ------------------------- | ------------------ |
| id         | UUID      | PK                        | Unique identifier  |
| role_id    | UUID      | FK, NOT NULL              | Role reference     |
| permission | TEXT      | NOT NULL, UNIQUE per role | Permission string  |
| created_at | TIMESTAMP | DEFAULT NOW()             | Creation timestamp |

**Query Pattern:**

```sql
SELECT permission FROM role_permissions
  WHERE role_id = (SELECT role_id FROM user_roles WHERE user_id = $1)
```

---

### tenant_db.login_attempts

Tracks login attempts for brute force prevention.

```sql
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
```

**Purpose:** Failed login counting for account lock

**Columns:**

| Column       | Type      | Constraints   | Purpose                                          |
| ------------ | --------- | ------------- | ------------------------------------------------ |
| id           | UUID      | PK            | Unique identifier                                |
| email        | TEXT      | NOT NULL      | Login email (audit, not FK)                      |
| success      | BOOLEAN   | NOT NULL      | True if login succeeded                          |
| ip_address   | INET      | NULL          | Source IP for geofencing (Phase 3+)              |
| user_agent   | TEXT      | NULL          | Browser/app user agent                           |
| error_reason | TEXT      | NULL          | Reason for failure (invalid creds, locked, etc.) |
| created_at   | TIMESTAMP | DEFAULT NOW() | Attempt timestamp                                |

**Retention:** Default 30 days (cleanup job in DevOps)

**Query Pattern:**

```sql
SELECT COUNT(*) FROM login_attempts
  WHERE email = $1
  AND created_at > NOW() - INTERVAL '15 minutes'
  AND success = false;
```

---

### tenant_db.audit_logs

Complete audit trail of auth events.

```sql
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
```

**Columns:**

| Column         | Type      | Constraints              | Purpose                                  |
| -------------- | --------- | ------------------------ | ---------------------------------------- |
| id             | UUID      | PK                       | Unique identifier                        |
| event_type     | TEXT      | CHECK (9 values)         | Event classification                     |
| user_id        | UUID      | NULL, FK                 | User reference (NULL if user unknown)    |
| workspace_id   | UUID      | NOT NULL                 | Workspace scope                          |
| correlation_id | TEXT      | NOT NULL                 | Request trace ID                         |
| ip_address     | INET      | NULL                     | Source IP                                |
| user_agent     | TEXT      | NULL                     | Browser/app identifier                   |
| result         | TEXT      | CHECK (SUCCESS\|FAILURE) | Event outcome                            |
| details        | JSONB     | NULL                     | Extra metadata (versions, reasons, etc.) |
| timestamp      | TIMESTAMP | DEFAULT NOW()            | Event time                               |

**Event Types:**

| Event                  | User ID | Purpose                 | Details                               |
| ---------------------- | ------- | ----------------------- | ------------------------------------- |
| login_success          | ✓       | Successful login        | token_version, schema_version         |
| login_failed           | ✗       | Failed login            | reason (invalid creds, locked, etc.)  |
| account_locked         | ✗       | Account locked          | attempt_count, locked_until           |
| token_invalid          | ✓       | Token rejected          | reason (expired, mismatch, etc.)      |
| token_version_mismatch | ✓       | Version conflict        | token_version vs user.token_version   |
| workspace_mismatch     | ✓       | Cross-workspace attempt | token_workspace vs resolved_workspace |
| license_blocked        | N/A     | License state blocked   | license_status                        |
| role_changed           | ✓       | Role updated            | old_role, new_role                    |
| password_changed       | ✓       | Password updated        | ip_address, timestamp                 |

**Retention:** Minimum 90 days (configurable, compliance-dependent)

---

## Data Flow

### Login Flow

```
User submits email + password
  ↓
POST /auth/login (Backoffice) or /auth/student-login (Frontoffice)
  ↓
Query users WHERE email = $1
  ↓
Verify password_hash
  ↓
Check users.locked_until <= NOW()
  ↓
Check license.status == ACTIVE
  ↓
Generate JWT:
  - claims: {scope, workspace_id, user_id, role, token_version, schema_version, product_version, issued_at, expires_at}
  - secret: JWT_SECRET
  - algorithm: HS256
  ↓
UPDATE users SET last_login = NOW()
  ↓
RESET login_attempts counter (if first success)
  ↓
INSERT audit_logs(login_success)
  ↓
COMMIT transaction
  ↓
Return JWT + expiration
```

### Token Validation Flow

```
Incoming request with Authorization: Bearer <JWT>
  ↓
Extract JWT from header
  ↓
Verify JWT signature (HS256)
  ↓
Extract claims (scope, workspace_id, user_id, token_version, schema_version, product_version)
  ↓
Resolve tenant via workspace_id
  ↓
IF token.workspace_id != resolved.workspace_id
  → 401 Unauthorized
  → INSERT audit_logs(workspace_mismatch)
  ↓
Check license.status == ACTIVE
  ↓
Query user.token_version
  ↓
IF token.token_version != user.token_version
  → 401 Unauthorized
  → INSERT audit_logs(token_version_mismatch)
  ↓
IF token.schema_version != tenant.schema_version
  → 426 Upgrade Required
  ↓
IF NOW() > token.expires_at
  → 401 Unauthorized
  ↓
Proceed to route handler
```

### Logout-All Flow

```
User calls POST /auth/logout-all
  ↓
Extract user_id from JWT
  ↓
BEGIN TRANSACTION
  ↓
Query user WHERE id = $1 FOR UPDATE (row lock)
  ↓
Increment user.token_version++
  ↓
UPDATE users SET token_version = token_version + 1
  ↓
INSERT audit_logs(event='token_invalidation')
  ↓
COMMIT
  ↓
Result: All existing tokens with old token_version become invalid
```

---

## Index Strategy

**Write-heavy tables:**

- login_attempts: Index on (email, created_at) for brute force queries
- audit_logs: Indexes on (user_id, timestamp), (workspace_id, timestamp), (correlation_id)

**Read-heavy tables:**

- users: Index on email (login lookup), created_at (sorting)
- user_roles: Indexes on user_id and role_id (joins)
- role_permissions: Index on role_id (permission lookup)

---

## Scaling Notes

**Phase 1 Approach:** Single table per scope (users, audit_logs)

**Phase 2+ Partitioning (future):**

- audit_logs: Partition by timestamp (monthly)
- login_attempts: Partition by email or deleted after 30 days
- users: No partitioning needed (< 1M per workspace)

**Row Count Estimates:**

- users: ~1K - 100K per workspace
- login_attempts: ~100K - 1M per workspace (30-day retention)
- audit_logs: ~1M - 100M per workspace (90-day retention)

---

## Backups & Recovery

**Backup Strategy (DevOps):**

- Full backup: Daily
- Incremental: Hourly
- PITR: 7 days minimum

**Recovery Scenario:**

- Corrupted password: Restore from snapshot, user re-sets password
- Deleted user: Restore from snapshot, user re-created
- Accidental mass update: Restore snapshot to point-in-time

---

## Constraints & Validation

**Email Uniqueness:** Per workspace

```sql
ALTER TABLE users ADD CONSTRAINT email_unique_per_workspace
  UNIQUE(email);
```

**User-Role Uniqueness:** Prevent duplicate assignments

```sql
ALTER TABLE user_roles ADD CONSTRAINT user_role_unique
  UNIQUE(user_id, role_id);
```

**Role-Permission Uniqueness:** Prevent duplicate permissions per role

```sql
ALTER TABLE role_permissions ADD CONSTRAINT role_permission_unique
  UNIQUE(role_id, permission);
```

**Single Division per Student:**

```sql
ALTER TABLE users ADD CONSTRAINT student_single_division
  CHECK ((role = 'STUDENT' AND division_id IS NOT NULL)
    OR (role != 'STUDENT' AND division_id IS NULL));
```

---

## Migration Sequence

1. Create mmc_users (master_db)
2. Create users, user_roles, roles, role_permissions (tenant_db)
3. Create login_attempts (tenant_db)
4. Create audit_logs (tenant_db)
5. Insert default roles (ADMIN, INSTRUCTOR, STAFF)
6. Increment schema_version

**Total Tables:**

- master_db: 1
- tenant_db: 6
- Total: 7

---

## Compliance Checklist

- ✓ No cross-workspace shared tables
- ✓ All tables scoped correctly (master vs tenant)
- ✓ Foreign keys enforce referential integrity
- ✓ Unique constraints prevent duplicates
- ✓ Check constraints validate enum values
- ✓ Indexes optimize query paths
- ✓ Audit logs track all mutations
- ✓ Timestamps on all tables for traceability
