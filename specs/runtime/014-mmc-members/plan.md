# Technical Plan — STAGE_14_MMC_MEMBERS

## Overview

This document specifies the complete technical design for MMC Members & RBAC implementation. It covers API endpoints, middleware chain, service architecture, transaction boundaries, concurrency patterns, and deployment considerations.

---

## Architecture Layers

```
Frontend Layer (Vue 3 + TypeScript)
    ↓ [API Calls]
API Layer (Hono routing)
    ↓ [Correlation ID → MMC Auth → Permission Check → Route Handler]
Domain Services (packages/domain-core)
    ↓ [Business Logic, Transactions]
Data Access Layer (master_db pool)
    ↓ [SQL Execution]
Master Database (PostgreSQL)
```

### Layer Responsibilities

**Frontend Layer:**

- Display login form, member list, role editor
- NO permission enforcement (UX only)
- NO business logic
- NO DB import statements

**API Layer:**

- Route definition
- Middleware stacking (correlation ID → auth → permission → handler)
- Request validation (schema, format)
- Response formatting (success/error structure)
- Error code mapping

**Domain Services:**

- Member lifecycle (create, edit, disable)
- Permission evaluation
- Token version management
- Audit logging
- No HTTP—only business logic
- No framework dependencies

**Data Access Layer:**

- Connection pooling (master_db)
- Query execution
- Transaction management
- Constraint enforcement

---

## Middleware Chain (Request Flow)

All `/mmc/*` requests follow this middleware stack (in order):

```
1. Correlation ID Middleware
   ├─ Extract correlation_id from header (or generate new UUID)
   ├─ Store in context (request.context.correlation_id)
   └─ Propagate to all logs

2. MMC Authentication Middleware
   ├─ Extract JWT from Authorization header
   ├─ Verify JWT signature (check issuer, expiration)
   ├─ Reject if workspace_id present (cross-context token)
   ├─ Fetch mmc_members record by user_id from token
   ├─ Check status = 'ACTIVE' (reject if DISABLED)
   ├─ Compare token.token_version with db.token_version
   │  ├─ If mismatch: 401 Unauthorized (session invalidated)
   │  └─ If match: continue
   ├─ Store user context in request.context.mmc_user (user_id, role_id, token_version)
   └─ Log: auth_success (level=debug) with user and request details

3. MMC Permission Enforcement Middleware
   ├─ Extract route resource + HTTP method
   ├─ Map to required permission: (DOMAIN, ACTION)
   │  ├─ GET /mmc/members/{id} → (MEMBERS_MANAGEMENT, view)
   │  ├─ POST /mmc/members → (MEMBERS_MANAGEMENT, create)
   │  ├─ PATCH /mmc/members/{id} → (MEMBERS_MANAGEMENT, edit)
   │  ├─ DELETE /mmc/members/{id} → (MEMBERS_MANAGEMENT, delete)
   │  └─ [similar for roles, permissions, etc.]
   ├─ Query: SELECT can_view, can_create, can_edit, can_delete FROM role_permissions WHERE role_id = ? AND domain = ?
   ├─ Check relevant permission bit
   │  ├─ If permission found and bit=true: continue to handler
   │  ├─ If permission found and bit=false: 403 Forbidden (permission denied)
   │  ├─ If permission NOT found: 403 Forbidden (implicit deny)
   ├─ Log: permission_check_result (level=warn if denied)
   └─ Store checked_permission in context

4. Route Handler
   ├─ Execute business logic (now guaranteed authorized)
   └─ Return response and/or side effects
```

### Middleware Implementation Details

#### Correlation ID Middleware

```python
# Pseudocode
def correlation_id_middleware(request):
    correlation_id = request.headers.get('X-Correlation-ID') or uuid.uuid4()
    request.context.correlation_id = correlation_id
    request.context.logger = logger.with_fields({
        'correlation_id': correlation_id
    })
    return next()
```

#### MMC Authentication Middleware

```python
def mmc_auth_middleware(request):
    # 1. Extract JWT
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        log.warn('mmc_auth', 'Missing or invalid auth header', status=401)
        return 401 {'error': 'Unauthorized'}

    token = auth_header[7:]  # Remove 'Bearer '

    # 2. Verify JWT
    try:
        payload = jwt.verify(token, secret=JWT_SECRET, issuer='mmc')
    except jwt.InvalidSignatureError:
        log.warn('mmc_auth', 'Invalid JWT signature', status=401)
        return 401 {'error': 'Unauthorized'}
    except jwt.ExpiredSignatureError:
        log.warn('mmc_auth', 'JWT expired', status=401)
        return 401 {'error': 'Unauthorized'}

    # 3. Reject cross-context tokens (workspace_id present)
    if payload.get('workspace_id'):
        log.warn('mmc_auth', 'Cross-context token rejected', status=401)
        return 401 {'error': 'Unauthorized'}

    # 4. Extract user ID from token
    user_id = payload.get('sub')  # Standard JWT claim
    if not user_id:
        log.warn('mmc_auth', 'Missing sub claim in JWT', status=401)
        return 401 {'error': 'Unauthorized'}

    # 5. Fetch member from DB
    db = get_master_pool()
    member = await db.query_one('''
        SELECT id, status, role_id, token_version FROM mmc_members WHERE id = ?
    ''', [user_id])

    if not member:
        log.warn('mmc_auth', 'Member not found', user_id=user_id, status=401)
        return 401 {'error': 'Unauthorized'}

    # 6. Check status
    if member.status != 'ACTIVE':
        log.warn('mmc_auth', 'Member disabled', user_id=user_id, status=401)
        return 401 {'error': 'Unauthorized'}

    # 7. Check token_version (session invalidation)
    if payload.get('token_version') != member.token_version:
        log.info('mmc_auth', 'Token version mismatch; session invalidated',
                 user_id=user_id, jwt_version=payload.get('token_version'),
                 db_version=member.token_version, status=401)
        return 401 {'error': 'Unauthorized; please re-login'}

    # 8. Store context
    request.context.mmc_user = {
        'user_id': user_id,
        'role_id': member.role_id,
        'token_version': member.token_version
    }

    # 9. Log success
    log.debug('mmc_auth', 'Authentication successful', user_id=user_id)
    return next()
```

#### Permission Enforcement Middleware

```python
def permission_middleware(request):
    # Extract permission requirement from route metadata
    route_permission = extract_permission(request.route)  # e.g., ('MEMBERS_MANAGEMENT', 'create')

    if not route_permission:
        # No permission required (e.g., GET /mmc/health)
        return next()

    domain, action = route_permission
    mmc_user = request.context.mmc_user

    # Query permission matrix
    db = get_master_pool()
    perm = await db.query_one('''
        SELECT can_view, can_create, can_edit, can_delete FROM role_permissions
        WHERE role_id = ? AND domain = ?
    ''', [mmc_user.role_id, domain])

    # Evaluate permission
    can_perform = False
    if perm:
        action_map = {'view': perm.can_view, 'create': perm.can_create,
                      'edit': perm.can_edit, 'delete': perm.can_delete}
        can_perform = action_map.get(action, False)

    if not can_perform:
        log.warn('permission_denied',
                 domain=domain, action=action,
                 user_id=mmc_user.user_id, role_id=mmc_user.role_id,
                 status=403)

        # Optionally: Log to audit table
        await db.execute('''
            INSERT INTO mmc_audit_log (actor_user_id, action_type, entity_type,
                                       correlation_id, timestamp)
            VALUES (?, ?, ?, ?, NOW())
        ''', [mmc_user.user_id, 'PERMISSION_CHECK_DENIED', domain,
              request.context.correlation_id])

        return 403 {'error': f'Permission denied: {domain}.{action}'}

    # Log success (optional)
    request.context.checked_permission = (domain, action)
    return next()
```

---

## API Endpoint Specifications

### Member Management Endpoints

#### `POST /mmc/members`

**Permission Required:** MEMBERS_MANAGEMENT.create

**Request Body:**

```json
{
  "username": "john.doe",
  "email": "john.doe@example.com",
  "password": "SecurePassword123!",
  "role_id": "role-uuid",
  "team_id": null,
  "group_id": null,
  "department_id": null
}
```

**Validation:**

- username: 3-50 alphanumeric + underscore; matches /^[a-zA-Z0-9_]{3,50}$/
- email: valid format; must not exist in mmc_members or pending invitations
- password: min 8 chars, uppercase, lowercase, digit, special char (complexity check)
- role_id: must exist in roles table and status='ACTIVE'

**Response (201 Created):**

```json
{
  "success": true,
  "data": {
    "id": "member-uuid",
    "username": "john.doe",
    "email": "john.doe@example.com",
    "role_id": "role-uuid",
    "status": "ACTIVE",
    "created_at": "2026-02-25T10:30:00.000Z"
  },
  "error": null
}
```

**Error Responses:**

- 400 (Validation failure): Missing field, invalid format, role not found
- 409 (Conflict): Username or email already exists
- 500 (Server error): Database failure, password hash error

**Transaction:**

```sql
BEGIN TRANSACTION SERIALIZABLE
  1. Verify username unique
  2. Verify email unique
  3. Verify role_id exists and status='ACTIVE'
  4. Hash password (bcrypt, cost=12)
  5. INSERT into mmc_members
  6. INSERT into mmc_audit_log (action: MEMBER_CREATED)
END TRANSACTION
```

**Idempotency:**

- Header: `Idempotency-Key: UUID`
- Redis lookup: `mmc:idempotency:{key}`
- DB fallback: `request_log` table
- If duplicate: return cached response (201 with original member data)

---

#### `GET /mmc/members/:id`

**Permission Required:** MEMBERS_MANAGEMENT.view

**Request Parameters:**

- id: member UUID in path

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "id": "member-uuid",
    "username": "john.doe",
    "email": "john.doe@example.com",
    "role_id": "role-uuid",
    "role_name": "Platform Administrator",
    "team_id": null,
    "group_id": null,
    "department_id": null,
    "status": "ACTIVE",
    "token_version": 1,
    "created_at": "2026-02-25T10:30:00.000Z",
    "updated_at": "2026-02-25T10:30:00.000Z",
    "created_by_username": "admin.user"
  },
  "error": null
}
```

**Error Responses:**

- 404 (Not found): Member ID doesn't exist

**Query:**

```sql
SELECT m.*, r.name as role_name, c.username as created_by_username
FROM mmc_members m
LEFT JOIN roles r ON m.role_id = r.id
LEFT JOIN mmc_members c ON m.created_by = c.id
WHERE m.id = ?
```

---

#### `PATCH /mmc/members/:id`

**Permission Required:** MEMBERS_MANAGEMENT.edit

**Request Body:**

```json
{
  "email": "john.newemail@example.com",
  "team_id": "team-123",
  "group_id": "group-456",
  "department_id": "dept-789"
}
```

**Validation:**

- email: valid format; must not exist elsewhere
- team_id, group_id, department_id: optional, no FK check (free-form identifiers)

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "id": "member-uuid",
    "username": "john.doe",
    "email": "john.newemail@example.com",
    "team_id": "team-123",
    "updated_at": "2026-02-25T10:31:00.000Z"
  },
  "error": null
}
```

**Error Responses:**

- 404 (Not found): Member not found
- 409 (Conflict): Email already exists

**Transaction:**

```sql
BEGIN TRANSACTION SERIALIZABLE
  1. Verify member exists
  2. Verify email unique (if changed)
  3. UPDATE mmc_members
  4. INSERT into mmc_audit_log (action: MEMBER_UPDATED, previous/new state)
END TRANSACTION
```

**Idempotency:** No re-execution if called twice with same values (PUT replaces, so idempotent by nature).

---

#### `DELETE /mmc/members/:id`

**Permission Required:** MEMBERS_MANAGEMENT.delete

**Request Parameters:**

- id: member UUID in path

**Response (204 No Content or 200 OK with status update):**

**Logic:** "Delete" means disable (soft delete; no hard removal).

```json
{
  "success": true,
  "data": {
    "id": "member-uuid",
    "status": "DISABLED",
    "token_version": 6
  },
  "error": null
}
```

**Error Responses:**

- 404 (Not found): Member not found
- 409 (Conflict): Member already disabled

**Transaction:**

```sql
BEGIN TRANSACTION SERIALIZABLE
  1. Verify member exists and status='ACTIVE'
  2. UPDATE mmc_members SET status='DISABLED', token_version = token_version + 1
  3. INSERT into mmc_audit_log (action: MEMBER_DISABLED, previous/new state)
END TRANSACTION
```

**Side Effect:** Member's active sessions immediately invalidated (token_version mismatch on next request).

---

### Role Management Endpoints

#### `GET /mmc/roles`

**Permission Required:** MEMBERS_MANAGEMENT.view

**Response (200 OK):**

```json
{
  "success": true,
  "data": [
    {
      "id": "role-uuid",
      "name": "Platform Administrator",
      "description": "Full platform access",
      "status": "ACTIVE",
      "created_at": "2026-02-20T00:00:00.000Z"
    },
    {
      "id": "role-uuid-2",
      "name": "Sales Team",
      "description": "Product and client management",
      "status": "ACTIVE",
      "created_at": "2026-02-20T00:00:00.000Z"
    }
  ],
  "error": null
}
```

**Query:**

```sql
SELECT * FROM roles WHERE status='ACTIVE' ORDER BY created_at DESC
```

---

#### `GET /mmc/roles/:id/permissions`

**Permission Required:** MEMBERS_MANAGEMENT.view

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "role_id": "role-uuid",
    "role_name": "Platform Administrator",
    "permissions": [
      {
        "domain": "ORGANIZATION_SETTINGS",
        "can_view": true,
        "can_create": true,
        "can_edit": true,
        "can_delete": false
      },
      {
        "domain": "PRODUCT_MANAGEMENT",
        "can_view": true,
        "can_create": true,
        "can_edit": true,
        "can_delete": true
      }
      // ... all 7 domains
    ]
  },
  "error": null
}
```

**Query:**

```sql
SELECT * FROM role_permissions WHERE role_id = ?
```

---

#### `PATCH /mmc/roles/:id/permissions`

**Permission Required:** MEMBERS_MANAGEMENT.edit

**Request Body:**

```json
{
  "permissions": [
    {
      "domain": "PRODUCT_MANAGEMENT",
      "can_view": true,
      "can_create": true,
      "can_edit": false,
      "can_delete": false
    }
  ]
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "role_id": "role-uuid",
    "affected_members": 5,
    "token_versions_incremented": true,
    "message": "Permissions updated; 5 active sessions will be invalidated"
  },
  "error": null
}
```

**Error Responses:**

- 404 (Not found): Role not found
- 400 (Validation): Invalid domain

**Transaction:**

```sql
BEGIN TRANSACTION SERIALIZABLE
  1. Verify role exists
  2. Verify all domains valid
  3. UPDATE role_permissions for each domain
  4. SELECT all mmc_members WHERE role_id = ?
  5. UPDATE mmc_members SET token_version = token_version + 1 FOR EACH member (in loop)
  6. INSERT into mmc_audit_log multiple entries (one per affected member or one batch)
END TRANSACTION
```

**Atomicity:** All members incremented in single transaction; if any fails, all rolled back.

---

### Invitation Endpoints

#### `POST /mmc/invitations`

**Permission Required:** MEMBERS_MANAGEMENT.create

**Request Body:**

```json
{
  "email": "newuser@example.com",
  "role_id": "role-uuid"
}
```

**Response (201 Created):**

```json
{
  "success": true,
  "data": {
    "id": "invitation-uuid",
    "email": "newuser@example.com",
    "role_id": "role-uuid",
    "status": "PENDING",
    "expires_at": "2026-02-26T10:30:00.000Z",
    "created_at": "2026-02-25T10:30:00.000Z"
  },
  "error": null
}
```

**Error Responses:**

- 400 (Validation): Invalid email format
- 409 (Conflict): Email already a member or pending invite

**Transaction:**

```sql
BEGIN TRANSACTION SERIALIZABLE
  1. Verify email not in mmc_members
  2. Verify email not pending in mmc_member_invitations (cancel old?)
  3. Verify role_id exists
  4. Generate token (32-byte random)
  5. Hash token (SHA256)
  6. INSERT into mmc_member_invitations
  7. INSERT into mmc_audit_log (action: INVITATION_SENT)
END TRANSACTION
```

**Async Side Effect:**

- Send email to user with link: `/mmc/invitations/accept?token={plaintext_token}`
- If email fails: log error but don't fail transaction (invitation still exists; user can resend)

---

#### `POST /mmc/invitations/:token/accept`

**Permission:** None (public endpoint, but token validation required)

**Request Body:**

```json
{
  "password": "NewPassword123!",
  "confirmation_password": "NewPassword123!"
}
```

**Validation:**

- password: min 8 chars, complexity check
- passwords match

**Response (200 OK or 201 Created):**

```json
{
  "success": true,
  "data": {
    "member_id": "member-uuid",
    "username_temporary": "user_f8a9c2d0",
    "email": "newuser@example.com",
    "status": "ACTIVE",
    "message": "Account created. You can now login."
  },
  "error": null
}
```

**Error Responses:**

- 400 (Validation): Password too weak, passwords don't match
- 401 (Unauthorized): Token invalid, expired, or already used
- 409 (Conflict): Email already registered

**Transaction:**

```sql
BEGIN TRANSACTION SERIALIZABLE
  1. Query: SELECT * FROM mmc_member_invitations WHERE token_hash = SHA256(token)
  2. Validate: status='PENDING' AND expires_at > NOW()
  3. If validation fails: ROLLBACK, return 401
  4. Hash password (bcrypt, cost=12)
  5. Generate username from email prefix + random suffix (e.g., user_f8a9c2d0)
  6. Verify username unique
  7. INSERT into mmc_members
  8. UPDATE mmc_member_invitations SET status='ACCEPTED', accepted_at=NOW()
  9. INSERT into mmc_audit_log (action: INVITATION_ACCEPTED)
END TRANSACTION
```

**Idempotency:**

- Token can only be used once (status='PENDING' check prevents re-use)
- If client retries: token_hash mismatch (different SHA256 if typo) or status already ACCEPTED

---

### Authentication Endpoint

#### `POST /mmc/auth/login`

**Permission:** None (public)

**Rate Limit:** 5 failed attempts per minute per IP (429 Too Many Requests after 5 failures)

**Request Body:**

```json
{
  "username": "john.doe",
  "password": "SecurePassword123!"
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "Bearer",
    "expires_in": 3600,
    "user": {
      "id": "member-uuid",
      "username": "john.doe",
      "email": "john.doe@example.com",
      "role_id": "role-uuid"
    }
  },
  "error": null
}
```

**Error Responses:**

- 400 (Validation): Missing username/password
- 401 (Unauthorized): Invalid credentials, member disabled, rate limit exceeded
- 429 (Too Many Requests): Rate limit exceeded (5 failed attempts / minute / IP)

**Logic:**

```python
def login(username, password):
    # Rate limiting check (not auth check; check first)
    rate_key = f"mmc:login_attempts:{client_ip}"
    attempts = redis.get(rate_key) or 0
    if attempts >= 5:
        log.warn('login_rate_limit_exceeded', ip=client_ip, status=429)
        return 429 'Too many login attempts; try again in 1 hour'

    # Fetch member
    db = get_master_pool()
    member = await db.query_one('''
        SELECT id, password_hash, status, role_id, token_version
        FROM mmc_members WHERE username = ?
    ''', [username])

    if not member:
        redis.incr(rate_key, ex=60)  # Increment and set 1-min expiry
        log.warn('login_failed', username=username, reason='not_found', status=401)
        await db.execute('''
            INSERT INTO mmc_audit_log (action_type, entity_type, correlation_id, timestamp)
            VALUES (?, ?, ?, NOW())
        ''', ['LOGIN_ATTEMPT_FAILED', 'MEMBER', correlation_id])
        return 401 'Invalid credentials'

    if member.status != 'ACTIVE':
        redis.incr(rate_key, ex=60)
        log.warn('login_failed', username=username, reason='disabled', status=401)
        return 401 'Account disabled'

    # Verify password
    if not bcrypt.verify(password, member.password_hash):
        redis.incr(rate_key, ex=60)
        log.warn('login_failed', username=username, reason='wrong_password', status=401)
        await db.execute('''
            INSERT INTO mmc_audit_log (action_type, entity_type, correlation_id, timestamp)
            VALUES (?, ?, ?, NOW())
        ''', ['LOGIN_ATTEMPT_FAILED', 'MEMBER', correlation_id])
        return 401 'Invalid credentials'

    # Issue JWT
    oauth_token = jwt.sign({
        'sub': member.id,
        'issuer': 'mmc',
        'role_id': member.role_id,
        'token_version': member.token_version,
        'exp': time.now() + 3600
    }, secret=JWT_SECRET)

    # Log success
    log.info('login_success', username=username, member_id=member.id)
    await db.execute('''
        INSERT INTO mmc_audit_log (actor_user_id, action_type, entity_type, correlation_id, timestamp)
        VALUES (?, ?, ?, ?, NOW())
    ''', [member.id, 'LOGIN_ATTEMPT_SUCCESS', 'MEMBER', correlation_id])

    return 200 {
        'access_token': oauth_token,
        'token_type': 'Bearer',
        'expires_in': 3600,
        'user': {
            'id': member.id,
            'username': username,
            'email': member.email,
            'role_id': member.role_id
        }
    }
```

---

### Permission Verification Endpoint (Utility)

#### `GET /mmc/permissions/check`

**Permission:** None (authenticated only)

**Query Parameters:**

- domains: comma-separated list of domains to check (e.g., "PRODUCT_MANAGEMENT,CLIENT_MANAGEMENT")

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "user_id": "member-uuid",
    "role_id": "role-uuid",
    "permissions": {
      "PRODUCT_MANAGEMENT": {
        "can_view": true,
        "can_create": true,
        "can_edit": true,
        "can_delete": false
      },
      "CLIENT_MANAGEMENT": {
        "can_view": true,
        "can_create": true,
        "can_edit": false,
        "can_delete": false
      }
    }
  },
  "error": null
}
```

**Query:**

```sql
SELECT role_permissions.*
FROM role_permissions
WHERE role_id = ? AND domain IN (?, ?, ...)
```

**Use Case:** Frontend can call this once after login to cache permissions and hide/show UI elements accordingly (UX optimization only; API still enforces).

---

## Service Architecture

### Domain Services Layer (`packages/domain-core`)

All business logic organized into domain services (no HTTP dependencies):

```
services/
├── MemberService.ts
│   ├── createMember(data) → Member
│   ├── updateMember(id, data) → Member
│   ├── disableMember(id) → Member
│   ├── getMember(id) → Member
│   └── listMembers() → Member[]
│
├── RoleService.ts
│   ├── getRoles() → Role[]
│   ├── getRole(id) → Role
│   ├── getPermissions(roleId) → Permission[]
│   ├── updatePermissions(roleId, permissions) → { affectedMembers, updated }
│   └── cascadeTokenVersion(roleId) → void
│
├── InvitationService.ts
│   ├── sendInvitation(email, roleId) → Invitation
│   ├── acceptInvitation(token, password) → Member
│   └── getInvitation(id) → Invitation
│
├── AuthService.ts
│   ├── issueToken(memberId) → JWT
│   ├── verifyToken(jwt) → payload | null
│   └── authenticateMember(username, password) → Member | null
│
├── PermissionService.ts
│   ├── checkPermission(roleId, domain, action) → boolean
│   ├── getPermissionsForRole(roleId) → Permission[]
│   └── resolvePermissions(memberId) → Permission[]
│
└── AuditService.ts
    ├── logAction(actor, actionType, entity, before, after) → AuditEntry
    └── getAuditLog(filters) → AuditEntry[]
```

### Dependencies

- All services receive `db` (master_db connection pool) as constructor parameter
- Services are stateless (no instance state)
- Services can call other services (dependency injection or direct call)

### Example Service Implementation

```typescript
// MemberService.ts
export class MemberService {
  constructor(
    private db: Pool,
    private auditService: AuditService
  ) {}

  async createMember(data: CreateMemberInput, actor: UUID): Promise<Member> {
    const hashedPassword = await bcrypt.hash(data.password, 12)

    return this.db.transaction(async (tx) => {
      // Validate
      const existingUsername = await tx.queryOne(
        'SELECT id FROM mmc_members WHERE username = ?',
        [data.username]
      )
      if (existingUsername) throw new DuplicateUsernameError()

      // Create
      const member = await tx.queryOne(
        `INSERT INTO mmc_members 
         (username, email, password_hash, role_id, status, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'ACTIVE', ?, NOW(), NOW())
         RETURNING *`,
        [data.username, data.email, hashedPassword, data.role_id, actor]
      )

      // Audit
      await this.auditService.logAction(
        actor,
        'MEMBER_CREATED',
        'MEMBER',
        null,
        { id: member.id, username: member.username }
      )

      return member
    })
  }

  async disableMember(id: UUID, actor: UUID): Promise<Member> {
    return this.db.transaction(async (tx) => {
      // Fetch current state
      const member = await tx.queryOne(
        'SELECT * FROM mmc_members WHERE id = ?',
        [id]
      )
      if (!member) throw new NotFoundError()
      if (member.status === 'DISABLED') throw new AlreadyDisabledError()

      // Update
      const updated = await tx.queryOne(
        `UPDATE mmc_members 
         SET status = 'DISABLED', token_version = token_version + 1, updated_at = NOW()
         WHERE id = ?
         RETURNING *`,
        [id]
      )

      // Audit
      await this.auditService.logAction(
        actor,
        'MEMBER_DISABLED',
        'MEMBER',
        { status: member.status, token_version: member.token_version },
        { status: updated.status, token_version: updated.token_version }
      )

      return updated
    })
  }
}
```

---

## Concurrency Guarantees

### Transaction Isolation Level

All write operations use `SERIALIZABLE` or `REPEATABLE_READ` isolation level.

**Reasoning:**

- `READ_COMMITTED` (PostgreSQL default): allows race conditions in role edits
- `REPEATABLE_READ`: prevents phantom reads; suitable for MMC
- `SERIALIZABLE`: strongest; may reduce throughput; use if needed

**PostgreSQL Configuration:**

```sql
-- In transaction
BEGIN ISOLATION LEVEL REPEATABLE READ;
  UPDATE mmc_members SET token_version = token_version + 1 WHERE role_id = ?;
COMMIT;
```

### Token Version Increment Race Condition (Example)

**Scenario:** Admin1 and Admin2 both edit a role's permissions simultaneously.

**Without serialization:**

```
Admin1 reads member.token_version = 5
Admin2 reads member.token_version = 5
Admin1 updates: SET token_version = 5 + 1 = 6
Admin2 updates: SET token_version = 5 + 1 = 6
Result: token_version = 6 (should be 7; lost update)
```

**With SERIALIZABLE isolation:**

```
Admin1 starts transaction (acquires lock)
Admin2 starts transaction (waits for lock)
Admin1 reads member.token_version = 5
Admin1 updates: SET token_version = 5 + 1 = 6
Admin1 commits (releases lock)
Admin2 acquires lock
Admin2 reads member.token_version = 6 (refreshed)
Admin2 updates: SET token_version = 6 + 1 = 7
Admin2 commits
Result: token_version = 7 (correct)
```

### Long-Running Transactions and Deadlock Prevention

**Strategy:** Keep transactions short (< 100ms).

- Do validation outside transaction
- Hold lock for minimal time
- Retry on DEADLOCK (max 3 retries)

**Example:**

```typescript
async function updateRolePermissions(roleId, newPermissions) {
  // Validate outside transaction
  await validateRole(roleId)
  await validatePermissions(newPermissions)

  // Short transaction for write
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await db.transaction(async (tx) => {
        // All writes here
        await tx.execute('UPDATE roles SET ... WHERE id = ?', [roleId])
        await tx.execute('UPDATE role_permissions SET ... WHERE role_id = ?', [
          roleId,
        ])
        // Cascade
        const members = await tx.query(
          'SELECT id FROM mmc_members WHERE role_id = ?',
          [roleId]
        )
        for (const member of members) {
          await tx.execute(
            'UPDATE mmc_members SET token_version = token_version + 1 WHERE id = ?',
            [member.id]
          )
        }
      })
    } catch (e) {
      if (e.code === 'DEADLOCK' && attempt < 2) {
        // Exponential backoff
        await sleep(Math.random() * 2 ** attempt * 100)
        continue
      }
      throw e
    }
  }
}
```

---

## Error Handling Standard

### Error Response Format

All errors follow standard structure:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message"
  }
}
```

### Error Codes (Partial)

| Code                 | HTTP Status | Meaning                                           |
| -------------------- | ----------- | ------------------------------------------------- |
| UNAUTHORIZED         | 401         | Invalid JWT, session invalidated, member disabled |
| PERMISSION_DENIED    | 403         | User lacks permission; audit logged               |
| NOT_FOUND            | 404         | Resource doesn't exist                            |
| CONFLICT             | 409         | Validation conflict (duplicate, already in state) |
| UNPROCESSABLE_ENTITY | 422         | Validation failure (bad format, constraints)      |
| RATE_LIMITED         | 429         | Too many requests                                 |
| INTERNAL_ERROR       | 500         | Server error; correlation_id logged for debugging |

---

## Observability & Logging

### Structured Logging Format

All logs emitted as JSON (Pino logger):

```json
{
  "timestamp": "2026-02-25T10:30:00.000Z",
  "level": "info",
  "service": "mmc-api",
  "correlation_id": "550e8400-e29b-41d4-a716-446655440000",
  "mmc_user_id": "member-uuid",
  "mmc_username": "admin.user",
  "mmc_role": "Platform Administrator",
  "action": "MEMBER_CREATED",
  "http_method": "POST",
  "http_path": "/mmc/members",
  "http_status": 201,
  "duration_ms": 125,
  "message": "New MMC member created",
  "entity_type": "MEMBER",
  "entity_id": "new-member-uuid"
}
```

### Key Fields Always Included

- `timestamp`: ISO 8601 UTC
- `level`: debug, info, warn, error
- `service`: "mmc-api"
- `correlation_id`: Request-scoped unique identifier
- `mmc_user_id`: MMC user executing action (if authenticated)
- `http_method`, `http_path`, `http_status`, `duration_ms`: HTTP metadata

### Error Logging Example

```json
{
  "timestamp": "2026-02-25T10:31:00.000Z",
  "level": "error",
  "service": "mmc-api",
  "correlation_id": "550e8400-e29b-41d4-a716-446655440000",
  "mmc_user_id": "member-uuid",
  "error_code": "PERMISSION_DENIED",
  "error_message": "Insufficient permissions",
  "requested_permission_domain": "PRODUCT_MANAGEMENT",
  "requested_permission_action": "delete",
  "http_status": 403,
  "message": "Permission denied"
}
```

---

## Performance Considerations

### Query Optimization

**Member Lookup by ID:**

- Index: `idx_mmc_members_role_id`, `idx_mmc_members_status`
- Expected: < 5ms

**Role Permissions Lookup:**

- Index: `idx_role_permissions_role_id`
- Query: `SELECT * FROM role_permissions WHERE role_id = ? AND domain = ?`
- Expected: < 3ms

**Permission Check (Middleware):**

- Single query, indexed
- Expected: < 10ms total

### Database Connection Pooling

- Pool size: 10-20 connections (configurable)
- Min connections: 5
- Max connections: 20
- Idle timeout: 30 seconds
- Connection reuse: Enabled

```typescript
const pool = new Pool({
  host: process.env.MASTER_DB_HOST,
  port: 5432,
  database: 'master',
  user: process.env.MASTER_DB_USER,
  password: process.env.MASTER_DB_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  connectionLimit: 20,
})
```

### Cache Strategy (Redis)

**Purpose:** Idempotency cache (fast path)

**Key Format:** `mmc:idempotency:{idempotency_key}`
**Value:** Full API response (JSON serialized)
**TTL:** 86400 seconds (24 hours)
**Eviction Policy:** LRU

**Lookup Time:** < 5ms (expected; memcached-like performance)

---

## Deployment & Runtime

### Environment Variables

```bash
# Database
MASTER_DB_HOST=localhost
MASTER_DB_PORT=5432
MASTER_DB_NAME=master
MASTER_DB_USER=app_admin
MASTER_DB_PASSWORD=secure_password

# JWT
JWT_SECRET=long_random_secret_minimum_32_chars
JWT_ISSUER=mmc
JWT_EXPIRATION_SECONDS=3600

# Redis (idempotency cache)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0
REDIS_PASSWORD=optional_redis_password

# Logging
LOG_LEVEL=info

# Email (invitation sending)
SMTP_HOST=mail.example.com
SMTP_PORT=587
SMTP_USER=noreply@example.com
SMTP_PASSWORD=email_password
SMTP_FROM_NAME="Zidney Platform"
SMTP_FROM_EMAIL=noreply@example.com
```

### Startup Checklist

1. ✓ Database connection successful (ping master_db)
2. ✓ Redis connection successful (ping cache)
3. ✓ JWT secret configured (length >= 32 chars)
4. ✓ Migrations executed (schema version current)
5. ✓ Email service configured (if invitations enabled)
6. ✓ Logging initialized (structured logger ready)

---

## Summary

| Component  | Technology | Details                                      |
| ---------- | ---------- | -------------------------------------------- |
| Routes     | Hono       | Lightweight; minimal overhead                |
| Middleware | Custom     | Correlation ID → Auth → Permission → Handler |
| Services   | TypeScript | Domain logic; no framework deps              |
| Database   | PostgreSQL | SERIALIZABLE isolation; 6 tables             |
| Cache      | Redis      | Idempotency fast path                        |
| Logging    | Pino       | Structured JSON                              |
| Auth       | JWT        | Bcrypt password hash (cost=12)               |
