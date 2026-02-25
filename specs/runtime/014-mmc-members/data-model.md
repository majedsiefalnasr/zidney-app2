# Data Model — STAGE_14_MMC_MEMBERS

## Overview

This document specifies the complete database schema for MMC Members & RBAC. All entities are stored in `master_db` (platform context, not tenant context).

---

## Entity Relationship Diagram

```
mmc_members
├── role_id ──→ roles
├── created_by ──→ mmc_members (self-referential)
└── updated_by ──→ mmc_members (self-referential)

roles
└── role_permissions (one-to-many)

mmc_member_invitations
├── role_id ──→ roles
├── invited_by ──→ mmc_members
└── accepted_by_user_id ──→ mmc_members (self-referential)

mmc_audit_log
└── actor_user_id ──→ mmc_members
```

---

## Table Specifications

### Table 1: `mmc_members`

**Purpose:** Store MMC internal user accounts with role assignments and session tokens.

**Location:** master_db

**Columns:**

| Column        | Type         | Constraint                                                 | Default           | Description                                                     |
| ------------- | ------------ | ---------------------------------------------------------- | ----------------- | --------------------------------------------------------------- |
| id            | UUID         | PRIMARY KEY                                                | gen_random_uuid() | Unique member identifier                                        |
| username      | VARCHAR(255) | UNIQUE, NOT NULL, CHECK (LENGTH > 2)                       | —                 | Immutable after creation; alphanumeric + underscore allowed     |
| email         | VARCHAR(255) | UNIQUE, NOT NULL                                           | —                 | User email; must be valid format                                |
| password_hash | VARCHAR(255) | NOT NULL                                                   | —                 | Bcrypt hash (cost=12); never null, never plaintext              |
| role_id       | UUID         | NOT NULL, FOREIGN KEY → roles(id)                          | —                 | Current role; cannot be null; must reference active role        |
| team_id       | UUID         | NULLABLE                                                   | NULL              | Optional team grouping; no FK constraint (string identifier)    |
| group_id      | UUID         | NULLABLE                                                   | NULL              | Optional group identifier; no FK constraint (string identifier) |
| department_id | UUID         | NULLABLE                                                   | NULL              | Optional department; no FK constraint (string identifier)       |
| token_version | INTEGER      | CHECK (token_version > 0)                                  | 1                 | Incremented on role change or disable; invalidates all sessions |
| status        | VARCHAR(50)  | CHECK (status IN ('ACTIVE', 'DISABLED'))                   | 'ACTIVE'          | Member account status; affects login eligibility                |
| created_at    | TIMESTAMP    | NOT NULL                                                   | NOW()             | Server timestamp of creation; immutable after insert            |
| updated_at    | TIMESTAMP    | NOT NULL                                                   | NOW()             | Server timestamp of last update; updated on any column change   |
| created_by    | UUID         | NULLABLE, FOREIGN KEY → mmc_members(id) ON DELETE SET NULL | NULL              | Which MMC member created this account (audit trail)             |
| updated_by    | UUID         | NULLABLE, FOREIGN KEY → mmc_members(id) ON DELETE SET NULL | NULL              | Which MMC member last updated this account (audit trail)        |

**Indexes:**

```sql
CREATE INDEX idx_mmc_members_role_id ON mmc_members(role_id);
    → Used for: cascade role changes, find members by role

CREATE INDEX idx_mmc_members_status ON mmc_members(status);
    → Used for: filter active users, block disabled users at login

CREATE INDEX idx_mmc_members_email ON mmc_members(email);
    → Used for: invitation lookup by email, uniqueness enforcement

CREATE UNIQUE INDEX idx_mmc_members_username ON mmc_members(username);
    → Enforced at constraint level; index accelerates lookups
```

**Constraints:**

- **PRIMARY KEY (id):** Each member has unique UUID
- **UNIQUE (username):** Prevents duplicate usernames; immutable means no rename
- **UNIQUE (email):** Prevents duplicate emails; email is contact point
- **NOT NULL (username, email, password_hash, role_id, status):** Required fields cannot be omitted
- **NOT NULL (created_at, updated_at):** All records timestamped
- **FOREIGN KEY (role_id):** Members must reference existing role; orphaned members prevented
- **FOREIGN KEY (created_by, updated_by):** Audit trail references must be valid or NULL (creator could leave org)
- **CHECK (status):** Only valid statuses allowed
- **CHECK (token_version > 0):** Prevents invalid version numbers
- **CHECK (LENGTH(username) > 2):** Prevents single-character usernames

**Cascade Behavior:**

- If role is deleted: DELETE would fail (FK constraint prevents orphaning)
- If created_by member is deleted: SET NULL (audit trail preserved; creator no longer needed)
- If updated_by member is deleted: SET NULL (audit trail preserved)

**Migration File:** `apps/api/src/db/master/migrations/001_create_mmc_members.sql`

---

### Table 2: `roles`

**Purpose:** Define MMC role definitions; each role has a set of permissions (domain × ability matrix).

**Location:** master_db

**Columns:**

| Column      | Type         | Constraint                               | Default           | Description                                         |
| ----------- | ------------ | ---------------------------------------- | ----------------- | --------------------------------------------------- |
| id          | UUID         | PRIMARY KEY                              | gen_random_uuid() | Unique role identifier                              |
| name        | VARCHAR(255) | NOT NULL                                 | —                 | Role display name (e.g., "Platform Administrator")  |
| description | TEXT         | NULLABLE                                 | NULL              | Human-readable description of role purpose          |
| status      | VARCHAR(50)  | CHECK (status IN ('ACTIVE', 'INACTIVE')) | 'ACTIVE'          | Lifecycle status; INACTIVE roles cannot be assigned |
| created_at  | TIMESTAMP    | NOT NULL                                 | NOW()             | Server timestamp of creation                        |
| updated_at  | TIMESTAMP    | NOT NULL                                 | NOW()             | Server timestamp of last update                     |

**Indexes:**

```sql
CREATE INDEX idx_roles_status ON roles(status);
    → Used for: filter active roles only at assignment time
```

**Constraints:**

- **PRIMARY KEY (id):** Each role has unique UUID
- **NOT NULL (name, status):** Required fields
- **UNIQUE implied (name):** Recommended (add if duplicates not desired; not in Phase 2 spec)
- **CHECK (status):** Only valid statuses allowed
- **NOT NULL (created_at, updated_at):** All records timestamped

**Cascade Behavior:**

- If role deleted: MUST check no members assigned first (business logic, not FK)
  - Query: `SELECT COUNT(*) FROM mmc_members WHERE role_id = ? HAVING COUNT > 0 → 409 Conflict`
  - DELETE only if count = 0
- role_permissions: ON DELETE CASCADE (if role deleted, its permissions deleted)

**Migration File:** `apps/api/src/db/master/migrations/002_create_roles.sql`

---

### Table 3: `role_permissions`

**Purpose:** Deterministic permission matrix (one row per role × domain). Encodes which abilities each role has for each domain.

**Location:** master_db

**Columns:**

| Column     | Type         | Constraint                                          | Default           | Description                                                     |
| ---------- | ------------ | --------------------------------------------------- | ----------------- | --------------------------------------------------------------- |
| id         | UUID         | PRIMARY KEY                                         | gen_random_uuid() | Unique permission record identifier                             |
| role_id    | UUID         | NOT NULL, FOREIGN KEY → roles(id) ON DELETE CASCADE | —                 | Role this permission belongs to; cascade delete if role deleted |
| domain     | VARCHAR(100) | NOT NULL, CHECK (domain IN list)                    | —                 | Permission domain enum (see enum below)                         |
| can_view   | BOOLEAN      | NOT NULL                                            | FALSE             | Can member view entities in this domain?                        |
| can_create | BOOLEAN      | NOT NULL                                            | FALSE             | Can member create new entities in this domain?                  |
| can_edit   | BOOLEAN      | NOT NULL                                            | FALSE             | Can member modify entities in this domain?                      |
| can_delete | BOOLEAN      | NOT NULL                                            | FALSE             | Can member delete/destroy entities in this domain?              |
| created_at | TIMESTAMP    | NOT NULL                                            | NOW()             | Server timestamp of creation                                    |
| updated_at | TIMESTAMP    | NOT NULL                                            | NOW()             | Server timestamp of last update                                 |

**Permission Domains (Enum):**

```sql
Domain Enum:
  'ORGANIZATION_SETTINGS'    → Org name, branding, contact info
  'PRODUCT_MANAGEMENT'       → Create/edit/delete products, config exams
  'LICENSE_MANAGEMENT'       → View license status, manage activations, renew
  'CLIENT_MANAGEMENT'        → Create/manage institutional clients
  'AFFILIATE_MANAGEMENT'     → Manage affiliate partners, revenue share
  'MEMBERS_MANAGEMENT'       → Create/edit/disable MMC members
  'REPORTING'                → Access audit logs, analytics, compliance reports
```

**Indexes:**

```sql
CREATE INDEX idx_role_permissions_role_id ON role_permissions(role_id);
    → Used for: find all permissions for a role, cascade edits

CREATE UNIQUE INDEX idx_role_permissions_role_domain ON role_permissions(role_id, domain);
    → Enforced at constraint level; accelerates single permission lookup
```

**Constraints:**

- **PRIMARY KEY (id):** Each permission row is unique
- **UNIQUE (role_id, domain):** One row per role × domain guarantees determinism
- **NOT NULL (role_id, domain):** Both are required
- **NOT NULL (can_view, can_create, can_edit, can_delete):** All permission bits required (default FALSE if not specified)
- **FOREIGN KEY (role_id):** Must reference existing role
- **CHECK (domain IN (...)):** Only valid domains allowed
- **NOT NULL (created_at, updated_at):** All records timestamped

**Permission Resolution Logic:**

```
When: User in Role Y attempts action on Domain D
  1. Query: SELECT (can_view, can_create, can_edit, can_delete)
            FROM role_permissions WHERE role_id = Y AND domain = D
  2. If row found:
       - Check relevant bit (can_view for GET, can_create for POST, etc.)
       - If bit = true: allow
       - If bit = false: deny 403
  3. If row NOT found:
       - Default: DENY 403 (fail-safe; missing permission = no access)
       - Log: Permission row missing for role X domain Y (audit trail)
```

**Cascade Behavior:**

- If role deleted: ON DELETE CASCADE (all permissions for that role deleted automatically)

**Migration File:** `apps/api/src/db/master/migrations/003_create_role_permissions.sql`

---

### Table 4: `mmc_member_invitations`

**Purpose:** One-time invitation workflow for member onboarding. Encodes invitation state (pending, accepted, expired) and one-time token.

**Location:** master_db

**Columns:**

| Column              | Type         | Constraint                                                 | Default           | Description                                                              |
| ------------------- | ------------ | ---------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------ |
| id                  | UUID         | PRIMARY KEY                                                | gen_random_uuid() | Unique invitation identifier                                             |
| email               | VARCHAR(255) | NOT NULL                                                   | —                 | Target email for invitation; must be valid format                        |
| role_id             | UUID         | NOT NULL, FOREIGN KEY → roles(id) ON DELETE RESTRICT       | —                 | Role to assign upon acceptance; cannot delete role if invitation pending |
| token_hash          | VARCHAR(255) | UNIQUE, NOT NULL                                           | —                 | SHA256(token); never store plaintext token; uniqueness enforced          |
| status              | VARCHAR(50)  | CHECK (status IN ('PENDING', 'ACCEPTED', 'EXPIRED'))       | 'PENDING'         | Invitation status; initial = PENDING                                     |
| expires_at          | TIMESTAMP    | NOT NULL                                                   | —                 | Expiration time (NOW() + 24 hours at creation); computed server-side     |
| invited_by          | UUID         | NOT NULL, FOREIGN KEY → mmc_members(id) ON DELETE SET NULL | —                 | Which MMC member sent this invitation; NULL if creator left              |
| accepted_at         | TIMESTAMP    | NULLABLE                                                   | NULL              | When invitation was accepted (for audit trail); NULL until accepted      |
| accepted_by_user_id | UUID         | NULLABLE, FOREIGN KEY → mmc_members(id) ON DELETE SET NULL | NULL              | Which MMC member accepted this; self-reference if user clicks link       |
| created_at          | TIMESTAMP    | NOT NULL                                                   | NOW()             | Server timestamp of invitation creation                                  |
| updated_at          | TIMESTAMP    | NOT NULL                                                   | NOW()             | Server timestamp of last update (e.g., status change)                    |

**Indexes:**

```sql
CREATE INDEX idx_invitations_email ON mmc_member_invitations(email);
    → Used for: prevent duplicate invitations to same email

CREATE INDEX idx_invitations_status ON mmc_member_invitations(status);
    → Used for: find pending invitations, cleanup expired

CREATE INDEX idx_invitations_expires_at ON mmc_member_invitations(expires_at);
    → Used for: find expired invitations, cleanup job

CREATE UNIQUE INDEX idx_invitations_token_hash ON mmc_member_invitations(token_hash);
    → Enforced at constraint level; one-time token uniqueness
```

**Constraints:**

- **PRIMARY KEY (id):** Each invitation is unique
- **UNIQUE (token_hash):** One-time token cannot be reused
- **NOT NULL (email, role_id, token_hash, status, expires_at, invited_by):** Required fields
- **FOREIGN KEY (role_id):** Must reference existing role ON DELETE RESTRICT (preventing deletion of role with pending invitations)
- **FOREIGN KEY (invited_by):** MMC member who created invitation; ON DELETE SET NULL
- **FOREIGN KEY (accepted_by_user_id):** Who created account from this invitation; ON DELETE SET NULL
- **CHECK (status):** Only valid statuses allowed
- **NOT NULL (created_at, updated_at):** All records timestamped

**Invitation Workflow State Machine:**

```
PENDING ──[accept + password set]──→ ACCEPTED
  ↓
  └─[expired]──→ [stale in DB, never accepted]

Once ACCEPTED: User created in mmc_members table; invitation usage exhausted.
Once expired (expires_at < NOW()): Cannot accept; invitation is dead end.
Never: DELETE invitation (immutable audit trail).
```

**Token Security:**

- **Generation:** Create 32-byte random token (256 bits)
- **Hashing:** SHA256(token) → 64 hex characters
- **Storage:** Hash only (never plaintext)
- **Transmission:** URL: `/mmc/invitations/accept?token={plaintext_token}`
- **Validation:** Client provides plaintext token; server hashes and compares to DB hash

**Cascade Behavior:**

- If invited_by member deleted: SET NULL (invitation preserved; creator unknown)
- If accepted_by_user_id deleted: SET NULL (invitation accepted; user later removed)
- If role_id deleted: RESTRICT (prevent deletion of role while invitations pending)

**Migration File:** `apps/api/src/db/master/migrations/004_create_mmc_member_invitations.sql`

---

### Table 5: `mmc_audit_log`

**Purpose:** Immutable append-only audit trail of all destructive and administrative actions. Source of regulatory compliance evidence.

**Location:** master_db

**Columns:**

| Column         | Type         | Constraint                                                 | Default           | Description                                                                   |
| -------------- | ------------ | ---------------------------------------------------------- | ----------------- | ----------------------------------------------------------------------------- |
| id             | UUID         | PRIMARY KEY                                                | gen_random_uuid() | Unique audit entry identifier                                                 |
| actor_user_id  | UUID         | NULLABLE, FOREIGN KEY → mmc_members(id) ON DELETE SET NULL | NULL              | Which MMC member performed action; NULL if actor later deleted                |
| action_type    | VARCHAR(100) | NOT NULL                                                   | —                 | Action performed (e.g., MEMBER_CREATED, ROLE_UPDATED, MEMBER_DISABLED) (enum) |
| entity_type    | VARCHAR(100) | NOT NULL                                                   | —                 | Type of entity affected (e.g., MEMBER, ROLE, PERMISSION)                      |
| entity_id      | UUID         | NULLABLE                                                   | NULL              | ID of affected entity; NULL for bulk operations                               |
| previous_state | JSONB        | NULLABLE                                                   | NULL              | Snapshot of state before change (e.g., {status: ACTIVE, role_id: uuid})       |
| new_state      | JSONB        | NULLABLE                                                   | NULL              | Snapshot of state after change (e.g., {status: DISABLED, role_id: uuid})      |
| correlation_id | UUID         | NOT NULL                                                   | —                 | Link to API request; used for tracing related actions                         |
| ip_address     | INET         | NULLABLE                                                   | NULL              | Client IP (for geographic/pattern detection)                                  |
| user_agent     | TEXT         | NULLABLE                                                   | NULL              | Client User-Agent (for device tracking)                                       |
| timestamp      | TIMESTAMP    | NOT NULL                                                   | NOW()             | Server timestamp of action; immutable                                         |

**Indexes:**

```sql
CREATE INDEX idx_audit_actor ON mmc_audit_log(actor_user_id);
    → Used for: find all actions by a user

CREATE INDEX idx_audit_timestamp ON mmc_audit_log(timestamp);
    → Used for: range queries, compliance reports

CREATE INDEX idx_audit_entity ON mmc_audit_log(entity_type, entity_id);
    → Used for: find all changes to specific entity

CREATE INDEX idx_audit_correlation ON mmc_audit_log(correlation_id);
    → Used for: trace all actions within single request
```

**Constraints:**

- **PRIMARY KEY (id):** Each audit entry is unique
- **NOT NULL (action_type, entity_type, correlation_id, timestamp):** Required fields
- **FOREIGN KEY (actor_user_id):** MMC member who performed action; ON DELETE SET NULL
- **CHECK (action_type):** Only valid actions allowed (see action_type enum)
- **CHECK (entity_type):** Only valid entity types allowed
- **NOT NULL (timestamp):** Immutable timestamp

**Immutability Enforcement:**

```sql
-- Prevent updates and deletes on audit log
-- PostgreSQL: table-level constraint (prevent UPDATE/DELETE via trigger)
CREATE TRIGGER audit_log_immutable BEFORE UPDATE OR DELETE ON mmc_audit_log
  FOR EACH ROW EXECUTE FUNCTION raise_immutable_error();

-- Function: raise_immutable_error()
  RAISE EXCEPTION 'Audit log is immutable; no updates or deletes allowed';
```

**Action Type Enum:**

```
MEMBER_CREATED           → New MMC member created (direct invite accepted, or direct add)
MEMBER_UPDATED           → Member info updated (email, team, group, department)
MEMBER_DISABLED          → Member account disabled; blocks login
MEMBER_ENABLED           → Member account re-enabled (if possible)
MEMBER_ROLE_CHANGED      → Member role changed; cascaded token_version bump
MEMBER_DELETED           → Hard delete (if used; otherwise shown as disabled)

ROLE_CREATED             → New role definition created
ROLE_UPDATED             → Role name/description updated
ROLE_DELETED             → Role deleted (only if no members assigned)

PERMISSION_BATCH_UPDATED → Multiple permissions changed for a role in single transaction
PERMISSION_SINGLE_CHANGED → Single permission (can_view/create/edit/delete) changed

INVITATION_SENT          → Invitation email sent to user
INVITATION_ACCEPTED      → User clicked link and created account
INVITATION_EXPIRED       → Invitation past expiration (no action; state transition only)
INVITATION_RESENT        → New invitation sent (replaces old one)

LOGIN_ATTEMPT_SUCCESS    → User logged in successfully
LOGIN_ATTEMPT_FAILED     → Login failed (rate limiting tracked separately)
LOGOUT                   → User logged out (optional; if session tracking added)

PERMISSION_CHECK_DENIED  → User lacked permission for action
PERMISSION_CHECK_ALLOWED → User had permission for action (optional; optional for privacy)

SESSION_INVALIDATED      → User session invalidated (role change, disable, manual reset)
```

**State Snapshot Format:**

When action affects entity state, capture before/after:

```json
// Example: MEMBER_DISABLED
{
  "previous_state": {
    "status": "ACTIVE",
    "role_id": "role-uuid",
    "token_version": 5,
    "email": "user@example.com"
  },
  "new_state": {
    "status": "DISABLED",
    "role_id": "role-uuid",
    "token_version": 6,
    "email": "user@example.com"
  }
}

// Example: PERMISSION_BATCH_UPDATED
{
  "previous_state": {
    "permissions": [
      {"domain": "PRODUCT_MANAGEMENT", "can_view": true, "can_create": false, "can_edit": true, "can_delete": false},
      {"domain": "CLIENT_MANAGEMENT", "can_view": true, "can_create": true, "can_edit": true, "can_delete": false}
    ]
  },
  "new_state": {
    "permissions": [
      {"domain": "PRODUCT_MANAGEMENT", "can_view": true, "can_create": true, "can_edit": true, "can_delete": false},
      {"domain": "CLIENT_MANAGEMENT", "can_view": true, "can_create": true, "can_edit": false, "can_delete": false}
    ]
  }
}
```

**Cascade Behavior:**

- If actor_user_id deleted: SET NULL (audit entry preserved; action still recorded)
- No deletions; only appends allowed

**Migration File:** `apps/api/src/db/master/migrations/005_create_mmc_audit_log.sql`

---

## Supplementary Table (Request Idempotency)

### Table: `request_log`

**Purpose:** Fallback idempotency cache when Redis unavailable; stores responses for duplicate requests.

**Location:** master_db

**Columns:**

| Column          | Type         | Constraint                                                | Default           | Description                                            |
| --------------- | ------------ | --------------------------------------------------------- | ----------------- | ------------------------------------------------------ |
| id              | UUID         | PRIMARY KEY                                               | gen_random_uuid() | Unique request log entry                               |
| user_id         | UUID         | NOT NULL, FOREIGN KEY → mmc_members(id) ON DELETE CASCADE | —                 | Which user made request                                |
| idempotency_key | VARCHAR(255) | NOT NULL                                                  | —                 | Client-provided idempotency key (UUID format expected) |
| http_method     | VARCHAR(10)  | NOT NULL (CHECK IN ('POST', 'PUT', ...))                  | —                 | HTTP method (POST, PUT, PATCH, DELETE)                 |
| http_path       | VARCHAR(500) | NOT NULL                                                  | —                 | API route (e.g., /mmc/members)                         |
| request_body    | JSONB        | NULLABLE                                                  | NULL              | Request payload (for debugging)                        |
| response_status | INTEGER      | NOT NULL (CHECK 200-299)                                  | —                 | HTTP response code (only 2xx stored)                   |
| response_body   | JSONB        | NOT NULL                                                  | —                 | Full API response (serialized)                         |
| created_at      | TIMESTAMP    | NOT NULL                                                  | NOW()             | Server timestamp                                       |

**Indexes:**

```sql
CREATE UNIQUE INDEX idx_request_log_user_key ON request_log(user_id, idempotency_key);
    → Enforced at constraint level; one response per user × idempotency key
```

**Constraints:**

- **PRIMARY KEY (id):** Each entry unique
- **UNIQUE (user_id, idempotency_key):** One response per user × key
- **NOT NULL (user_id, idempotency_key, http_method, http_path, response_status, response_body):** Required
- **FOREIGN KEY (user_id):** MMC member; ON DELETE CASCADE (cleanup when user deleted)
- **CHECK (response_status):** Only 2xx codes (success); failures not cached

**Cleanup Job:**

```sql
-- Daily cleanup (delete entries older than 30 days)
DELETE FROM request_log WHERE created_at < NOW() - INTERVAL '30 days';
```

**Migration File:** `apps/api/src/db/master/migrations/006_create_request_log.sql`

---

## Summary of Migrations

| Migration | File                                    | Purpose                                           |
| --------- | --------------------------------------- | ------------------------------------------------- |
| 001       | `001_create_mmc_members.sql`            | Create mmc_members table with indexes/constraints |
| 002       | `002_create_roles.sql`                  | Create roles table                                |
| 003       | `003_create_role_permissions.sql`       | Create role_permissions matrix table              |
| 004       | `004_create_mmc_member_invitations.sql` | Create invitation workflow table                  |
| 005       | `005_create_mmc_audit_log.sql`          | Create immutable audit trail                      |
| 006       | `006_create_request_log.sql`            | Create idempotency fallback table                 |

---

## Summary Statistics

| Metric                      | Value                    |
| --------------------------- | ------------------------ |
| Total Tables (Core)         | 5                        |
| Total Tables (Support)      | 1                        |
| Total Columns (All)         | 87                       |
| Total Indexes               | 15                       |
| Total Foreign Keys          | 10                       |
| Total Check Constraints     | 8                        |
| Total Unique Constraints    | 5                        |
| Default Schema Version Bump | +1 (e.g., 1.0.0 → 1.1.0) |

---

## Backward Compatibility

**Phase 2 to Phase 3 Migration Path:**

- All tables designed for extensibility (NULLABLE columns for future logical groupings)
- Permission domains enum: adding new domain requires schema migration only
- Audit log: new action types compatible with existing structure (JSONB flexible)
- Invitation TTL: future customization possible via separate config table (no schema change)

---

## References

- ADR-0003: Master DB Schema
- STAGE_14_MMC_MEMBERS.md Specification
- research.md (Decision 4: Idempotency)
