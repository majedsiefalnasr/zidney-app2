# API Contract — Member Management

## Overview

Member management endpoints handle CRUD operations for MMC internal users with role assignment, status tracking, and token versioning for session invalidation.

---

## POST /mmc/members

**Create MMC Member**

### Permissions

- Required: `MEMBERS_MANAGEMENT.create`
- Denied returns: 403 Forbidden

### Request

```
POST /mmc/members
Authorization: Bearer {jwt_token}
X-Correlation-ID: {correlation_id}
Content-Type: application/json

{
  "username": "john.doe",
  "email": "john.doe@example.com",
  "password": "SecurePass123!",
  "role_id": "550e8400-e29b-41d4-a716-446655440000",
  "team_id": null,
  "group_id": null,
  "department_id": null
}
```

### Request Validation

| Field         | Type         | Constraints                                      | Example            |
| ------------- | ------------ | ------------------------------------------------ | ------------------ |
| username      | string       | 3-50 chars; alphanumeric + underscore; immutable | `john.doe`         |
| email         | string       | Valid email; unique in mmc_members               | `john@example.com` |
| password      | string       | 8+ chars; upper, lower, digit, special           | `SecurePass123!`   |
| role_id       | UUID         | Must exist in roles table; status must be ACTIVE | `550e8400...`      |
| team_id       | UUID or null | Optional; no FK check                            | `team-uuid`        |
| group_id      | UUID or null | Optional; no FK check                            | `group-uuid`       |
| department_id | UUID or null | Optional; no FK check                            | `dept-uuid`        |

### Response: 201 Created

```json
{
  "success": true,
  "data": {
    "id": "member-uuid",
    "username": "john.doe",
    "email": "john.doe@example.com",
    "role_id": "550e8400-e29b-41d4-a716-446655440000",
    "role_name": "Platform Administrator",
    "status": "ACTIVE",
    "token_version": 1,
    "team_id": null,
    "group_id": null,
    "department_id": null,
    "created_at": "2026-02-25T10:30:00.000Z",
    "created_by_username": "admin.user"
  },
  "error": null
}
```

### Error Responses

#### 400 Bad Request

**Validation Error** — Missing field, invalid format, weak password

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "UNPROCESSABLE_ENTITY",
    "message": "Password must contain uppercase, lowercase, digit, and special character"
  }
}
```

#### 409 Conflict

**Duplicate** — Username or email already exists

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "CONFLICT",
    "message": "Username 'john.doe' already exists"
  }
}
```

#### 403 Forbidden

**Permission Denied**

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "PERMISSION_DENIED",
    "message": "You lack permission for MEMBERS_MANAGEMENT.create"
  }
}
```

#### 401 Unauthorized

**Invalid Token**

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or expired token"
  }
}
```

#### 500 Internal Server Error

**System Failure** — DB connection, bcrypt error, etc.

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Internal server error"
  }
}
```

### Idempotency

- Header: `Idempotency-Key: {UUID}`
- Retry with same Idempotency-Key returns cached response (201 with original member)
- Cache TTL: 24 hours
- Fallback: Database request_log table

### Transaction Details

```sql
BEGIN TRANSACTION SERIALIZABLE
  1. Verify username uniqueness
  2. Verify email uniqueness
  3. Verify role_id exists and status='ACTIVE'
  4. Hash password (bcrypt, cost=12)
  5. INSERT into mmc_members
  6. INSERT into mmc_audit_log (action=MEMBER_CREATED)
COMMIT
```

**Rollback on:** Any constraint violation, password hash error, audit insert failure

---

## GET /mmc/members/:id

**Retrieve Member Details**

### Permissions

- Required: `MEMBERS_MANAGEMENT.view`
- Denied returns: 403 Forbidden

### Request

```
GET /mmc/members/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer {jwt_token}
X-Correlation-ID: {correlation_id}
```

### Response: 200 OK

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "username": "john.doe",
    "email": "john.doe@example.com",
    "role_id": "role-uuid",
    "role_name": "Platform Administrator",
    "status": "ACTIVE",
    "token_version": 1,
    "team_id": "team-123",
    "group_id": "group-456",
    "department_id": "dept-789",
    "created_at": "2026-02-25T10:30:00.000Z",
    "updated_at": "2026-02-25T10:30:00.000Z",
    "created_by_username": "admin.user",
    "updated_by_username": "admin.user"
  },
  "error": null
}
```

### Error Responses

#### 404 Not Found

**Member not found**

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "NOT_FOUND",
    "message": "Member not found"
  }
}
```

---

## PATCH /mmc/members/:id

**Update Member Details** (email, team, group, department only; not role)

### Permissions

- Required: `MEMBERS_MANAGEMENT.edit`
- Denied returns: 403 Forbidden

### Request

```
PATCH /mmc/members/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer {jwt_token}
X-Correlation-ID: {correlation_id}
Content-Type: application/json

{
  "email": "john.newemail@example.com",
  "team_id": "team-999",
  "group_id": null,
  "department_id": "dept-new"
}
```

### Request Validation

| Field         | Type         | Constraints                                         |
| ------------- | ------------ | --------------------------------------------------- |
| email         | string       | Valid email format (if provided); unique if changed |
| team_id       | UUID or null | Optional                                            |
| group_id      | UUID or null | Optional                                            |
| department_id | UUID or null | Optional                                            |

**Note:** Role changes handled separately via permission batch update.

### Response: 200 OK

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "username": "john.doe",
    "email": "john.newemail@example.com",
    "team_id": "team-999",
    "group_id": null,
    "department_id": "dept-new",
    "updated_at": "2026-02-25T10:31:00.000Z"
  },
  "error": null
}
```

### Error Responses

#### 404 Not Found

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "NOT_FOUND",
    "message": "Member not found"
  }
}
```

#### 409 Conflict

**Email already used**

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "CONFLICT",
    "message": "Email already in use"
  }
}
```

### Transaction Details

```sql
BEGIN TRANSACTION SERIALIZABLE
  1. Verify member exists
  2. Verify email unique (if changed)
  3. UPDATE mmc_members
  4. INSERT into mmc_audit_log (action=MEMBER_UPDATED, before/after state)
COMMIT
```

---

## DELETE /mmc/members/:id

**Disable (Soft Delete) Member** — Blocks login, invalidates all sessions

### Permissions

- Required: `MEMBERS_MANAGEMENT.delete`
- Denied returns: 403 Forbidden

### Request

```
DELETE /mmc/members/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer {jwt_token}
X-Correlation-ID: {correlation_id}
```

### Response: 200 OK

```json
{
  "success": true,
  "data": {
    "id": "member-uuid",
    "status": "DISABLED",
    "token_version": 6,
    "message": "Member disabled; active sessions invalidated"
  },
  "error": null
}
```

### Error Responses

#### 404 Not Found

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "NOT_FOUND",
    "message": "Member not found"
  }
}
```

#### 409 Conflict

**Member already disabled**

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "CONFLICT",
    "message": "Member is already disabled"
  }
}
```

### Session Invalidation Side Effect

- Member's `token_version` incremented in single transaction
- Active sessions (with old token_version) immediately invalidated
- Next request from member fails with 401 (token_version mismatch)
- Member must re-login

### Transaction Details

```sql
BEGIN TRANSACTION SERIALIZABLE
  1. Verify member exists and status='ACTIVE'
  2. UPDATE mmc_members SET status='DISABLED', token_version = token_version + 1
  3. INSERT into mmc_audit_log (action=MEMBER_DISABLED, before/after state)
COMMIT
```

---

## GET /mmc/members (List)

**List All MMC Members** (optional; may defer to pagination feature)

### Permissions

- Required: `MEMBERS_MANAGEMENT.view`

### Request

```
GET /mmc/members?limit=50&offset=0&status=ACTIVE
Authorization: Bearer {jwt_token}
```

### Query Parameters

| Parameter | Type    | Default | Description                                  |
| --------- | ------- | ------- | -------------------------------------------- |
| limit     | integer | 50      | Max results per page                         |
| offset    | integer | 0       | Pagination offset                            |
| status    | string  | all     | Filter by status (ACTIVE, DISABLED, or both) |

### Response: 200 OK

```json
{
  "success": true,
  "data": {
    "members": [
      {
        "id": "member-1-uuid",
        "username": "john.doe",
        "email": "john@example.com",
        "role_name": "Platform Administrator",
        "status": "ACTIVE",
        "created_at": "2026-02-20T00:00:00.000Z"
      }
    ],
    "total": 42,
    "limit": 50,
    "offset": 0
  },
  "error": null
}
```
