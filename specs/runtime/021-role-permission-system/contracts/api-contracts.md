# API Contracts: STAGE_21 — Role & Permission System

**Branch**: `021-role-permission-system`  
**Date**: 2026-03-02  
**Phase 1 output of** `/speckit.plan`  
**Base path**: `/api/backoffice` (all routes require active workspace license + auth-jwt)

---

## Authentication & Authorization Requirements

All endpoints in this document:

- Require `Authorization: Bearer <backoffice_jwt>` header
- Require `workspace_id` claim in JWT matching resolved tenant
- Are protected by the permission guard (module + action specified per endpoint)
- Return `{ success, data, error }` on all responses

**Middleware chain applied before every handler**:

```
correlationId → tenantResolver → licenseMiddleware → auth-jwt
             → workspace-id-assertion → permission-guard → handler
```

**Standard error envelope**:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message"
  }
}
```

**Permission denied (all 403 cases)**:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "FORBIDDEN",
    "message": "Access denied"
  }
}
```

> Internal role names, permission flags, and user identifiers MUST NOT appear in error responses.

---

## 1. POST /api/backoffice/roles

**Purpose**: Create a new role and its initial set of module permissions atomically.  
**Permission guard**: `module=settings, action=can_create`  
**Transaction**: Single transaction — roles INSERT + all role_permissions INSERTs + rbac_audit_logs
INSERT. Full rollback on any failure.

### Request

```http
POST /api/backoffice/roles
Content-Type: application/json
Authorization: Bearer <token>
X-Correlation-Id: <uuid>
```

```json
{
  "name": "Exam Viewer",
  "description": "Can view exams only",
  "permissions": [
    {
      "module": "exam_engine",
      "can_view": true,
      "can_create": false,
      "can_edit": false,
      "can_delete": false
    },
    {
      "module": "dashboard",
      "can_view": true,
      "can_create": false,
      "can_edit": false,
      "can_delete": false
    }
  ]
}
```

| Field                      | Type    | Required | Constraints                                        |
| -------------------------- | ------- | -------- | -------------------------------------------------- |
| `name`                     | string  | Yes      | 1–128 chars, unique per tenant                     |
| `description`              | string  | No       | max 500 chars                                      |
| `permissions`              | array   | No       | empty array = role created without any permissions |
| `permissions[].module`     | string  | Yes      | must be a valid module key                         |
| `permissions[].can_view`   | boolean | No       | defaults to false                                  |
| `permissions[].can_create` | boolean | No       | defaults to false                                  |
| `permissions[].can_edit`   | boolean | No       | defaults to false                                  |
| `permissions[].can_delete` | boolean | No       | defaults to false                                  |

### Response: 201 Created

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Exam Viewer",
    "description": "Can view exams only",
    "status": "ACTIVE",
    "permissions": [
      {
        "id": "uuid",
        "module": "exam_engine",
        "can_view": true,
        "can_create": false,
        "can_edit": false,
        "can_delete": false
      }
    ],
    "created_at": "2026-03-02T00:00:00.000Z"
  },
  "error": null
}
```

### Error Responses

| Status | Code                 | Condition                                                  |
| ------ | -------------------- | ---------------------------------------------------------- |
| 409    | `ROLE_NAME_CONFLICT` | A role with this name already exists in this tenant        |
| 422    | `INVALID_MODULE`     | permissions array contains an unrecognized module key      |
| 422    | `VALIDATION_ERROR`   | name is empty, too long, or permissions entry is malformed |
| 403    | `FORBIDDEN`          | Caller lacks `settings.can_create` permission              |

---

## 2. GET /api/backoffice/roles

**Purpose**: List all roles for the workspace with their statuses.  
**Permission guard**: `module=settings, action=can_view`  
**Cache**: No response caching — always reads from DB.

### Request

```http
GET /api/backoffice/roles?status=ACTIVE&page=1&limit=50
Authorization: Bearer <token>
```

| Query Param | Type                   | Required | Default | Constraints            |
| ----------- | ---------------------- | -------- | ------- | ---------------------- |
| `status`    | `ACTIVE` \| `DISABLED` | No       | all     | filters by role status |
| `page`      | integer                | No       | 1       | ≥ 1                    |
| `limit`     | integer                | No       | 50      | 1–100                  |

### Response: 200 OK

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "name": "Exam Viewer",
        "description": "Can view exams only",
        "status": "ACTIVE",
        "created_at": "2026-03-02T00:00:00.000Z",
        "updated_at": "2026-03-02T00:00:00.000Z"
      }
    ],
    "total": 3,
    "page": 1,
    "limit": 50
  },
  "error": null
}
```

> Note: Permissions are NOT included in the list response. Use GET /roles/:id for full permission
> matrix.

---

## 3. GET /api/backoffice/roles/:id

**Purpose**: Retrieve a single role with its full permission matrix across all modules.  
**Permission guard**: `module=settings, action=can_view`

### Request

```http
GET /api/backoffice/roles/:id
Authorization: Bearer <token>
```

| Path Param | Type | Constraints                               |
| ---------- | ---- | ----------------------------------------- |
| `id`       | UUID | must be a valid role UUID for this tenant |

### Response: 200 OK

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Exam Viewer",
    "description": "Can view exams only",
    "status": "ACTIVE",
    "permissions": [
      {
        "id": "uuid",
        "module": "exam_engine",
        "can_view": true,
        "can_create": false,
        "can_edit": false,
        "can_delete": false
      },
      {
        "id": "uuid",
        "module": "dashboard",
        "can_view": true,
        "can_create": false,
        "can_edit": false,
        "can_delete": false
      }
    ],
    "created_at": "2026-03-02T00:00:00.000Z",
    "updated_at": "2026-03-02T00:00:00.000Z"
  },
  "error": null
}
```

> Modules not present in `permissions` array are treated as all-false (full denial) per FR-018.

### Error Responses

| Status | Code             | Condition                           |
| ------ | ---------------- | ----------------------------------- |
| 404    | `ROLE_NOT_FOUND` | No role with this id in this tenant |
| 403    | `FORBIDDEN`      | Caller lacks `settings.can_view`    |

---

## 4. PATCH /api/backoffice/roles/:id

**Purpose**: Update role name, description, or status. Disabling a role takes effect on the very
next request by assigned users.  
**Permission guard**: `module=settings, action=can_edit`  
**Transaction**: Single transaction — UPDATE roles + rbac_audit_logs INSERT + cache invalidation
(synchronous).

### Request

```http
PATCH /api/backoffice/roles/:id
Content-Type: application/json
Authorization: Bearer <token>
```

```json
{
  "name": "Senior Exam Viewer",
  "description": "Updated description",
  "status": "DISABLED"
}
```

All fields are optional. At least one field must be provided.

| Field         | Type                   | Constraints                    |
| ------------- | ---------------------- | ------------------------------ |
| `name`        | string                 | 1–128 chars, unique per tenant |
| `description` | string                 | max 500 chars                  |
| `status`      | `ACTIVE` \| `DISABLED` |                                |

### Response: 200 OK

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Senior Exam Viewer",
    "description": "Updated description",
    "status": "DISABLED",
    "updated_at": "2026-03-02T01:00:00.000Z"
  },
  "error": null
}
```

### Error Responses

| Status | Code                 | Condition                                 |
| ------ | -------------------- | ----------------------------------------- |
| 404    | `ROLE_NOT_FOUND`     | Role does not exist                       |
| 409    | `ROLE_NAME_CONFLICT` | Updated name conflicts with existing role |
| 422    | `VALIDATION_ERROR`   | Invalid status value or empty name        |
| 403    | `FORBIDDEN`          | Caller lacks `settings.can_edit`          |

---

## 5. PUT /api/backoffice/roles/:id/permissions

**Purpose**: Replace the entire permission set for this role. All existing
`backoffice_role_module_permissions` rows for this role are deleted and re-inserted atomically.  
**Permission guard**: `module=settings, action=can_edit`  
**Transaction**: Single transaction — DELETE existing rows + INSERT new rows + rbac_audit_logs
INSERT + cache invalidation (synchronous).  
**Idempotency**: Full replace semantics. Providing the same payload twice is idempotent.

### Request

```http
PUT /api/backoffice/roles/:id/permissions
Content-Type: application/json
Authorization: Bearer <token>
```

```json
{
  "permissions": [
    {
      "module": "exam_engine",
      "can_view": true,
      "can_create": true,
      "can_edit": false,
      "can_delete": false
    },
    {
      "module": "dashboard",
      "can_view": true,
      "can_create": false,
      "can_edit": false,
      "can_delete": false
    }
  ]
}
```

| Field                      | Type    | Required | Constraints                           |
| -------------------------- | ------- | -------- | ------------------------------------- |
| `permissions`              | array   | Yes      | may be empty (clears all permissions) |
| `permissions[].module`     | string  | Yes      | valid module key                      |
| `permissions[].can_view`   | boolean | No       | defaults to false                     |
| `permissions[].can_create` | boolean | No       | defaults to false                     |
| `permissions[].can_edit`   | boolean | No       | defaults to false                     |
| `permissions[].can_delete` | boolean | No       | defaults to false                     |

> Modules not in the array are treated as full denial after the PUT (no row = deny all).

### Response: 200 OK

```json
{
  "success": true,
  "data": {
    "role_id": "uuid",
    "permissions": [
      {
        "id": "uuid",
        "module": "exam_engine",
        "can_view": true,
        "can_create": true,
        "can_edit": false,
        "can_delete": false
      }
    ],
    "updated_at": "2026-03-02T01:00:00.000Z"
  },
  "error": null
}
```

### Error Responses

| Status | Code             | Condition                                                |
| ------ | ---------------- | -------------------------------------------------------- |
| 404    | `ROLE_NOT_FOUND` | Role does not exist                                      |
| 422    | `INVALID_MODULE` | Any permission entry contains an unrecognized module key |
| 403    | `FORBIDDEN`      | Caller lacks `settings.can_edit`                         |

---

## 6. DELETE /api/backoffice/roles/:id

**Purpose**: Permanently delete a role. Rejected if any ACTIVE staff user is assigned to this
role.  
**Permission guard**: `module=settings, action=can_delete`  
**Transaction**: BEGIN → SELECT FOR UPDATE on roles row → count ACTIVE assigned users → DELETE
roles + CASCADE deletes role_permissions + rbac_audit_logs INSERT → COMMIT.  
**Concurrency**: `SELECT ... FOR UPDATE` serializes concurrent delete attempts. Second request sees
either role deleted (404) or blocked until first commits.

### Request

```http
DELETE /api/backoffice/roles/:id
Authorization: Bearer <token>
```

### Response: 204 No Content

Empty body on success.

### Error Responses

| Status | Code                    | Condition                                                |
| ------ | ----------------------- | -------------------------------------------------------- |
| 404    | `ROLE_NOT_FOUND`        | Role does not exist                                      |
| 409    | `ROLE_HAS_ACTIVE_USERS` | One or more ACTIVE staff users are assigned to this role |
| 403    | `FORBIDDEN`             | Caller lacks `settings.can_delete`                       |

> Error responses MUST NOT include user counts or user identifiers.

---

## 7. GET /api/backoffice/roles/:id/users

**Purpose**: List all staff users currently assigned to this role.  
**Permission guard**: `module=settings, action=can_view`

### Request

```http
GET /api/backoffice/roles/:id/users?page=1&limit=50
Authorization: Bearer <token>
```

### Response: 200 OK

```json
{
  "success": true,
  "data": {
    "role_id": "uuid",
    "items": [
      {
        "id": "uuid",
        "email": "staff@tenant.com",
        "name": "Alice Smith",
        "is_active": true,
        "created_at": "2026-03-01T00:00:00.000Z"
      }
    ],
    "total": 1,
    "page": 1,
    "limit": 50
  },
  "error": null
}
```

> Password hashes and token_version are never returned.

### Error Responses

| Status | Code             | Condition                        |
| ------ | ---------------- | -------------------------------- |
| 404    | `ROLE_NOT_FOUND` | Role does not exist              |
| 403    | `FORBIDDEN`      | Caller lacks `settings.can_view` |

---

## 8. PATCH /api/backoffice/staff/:userId/role

**Purpose**: Assign or remove the single role for a staff user.  
**Permission guard**: `module=users, action=can_edit`  
**Transaction**: Single transaction — UPDATE backoffice_staff_users + rbac_audit_logs INSERT + cache
invalidation.  
**Idempotency**: Assigning the same `role_id` twice is a no-op.

### Request

```http
PATCH /api/backoffice/staff/:userId/role
Content-Type: application/json
Authorization: Bearer <token>
```

```json
{
  "role_id": "uuid"
}
```

Pass `"role_id": null` to unassign the role (user reverts to no-access).

| Field     | Type         | Required | Constraints                                            |
| --------- | ------------ | -------- | ------------------------------------------------------ |
| `role_id` | UUID \| null | Yes      | if UUID: must exist in tenant and have status `ACTIVE` |

### Response: 200 OK

```json
{
  "success": true,
  "data": {
    "user_id": "uuid",
    "role_id": "uuid",
    "updated_at": "2026-03-02T01:00:00.000Z"
  },
  "error": null
}
```

### Error Responses

| Status | Code                  | Condition                                |
| ------ | --------------------- | ---------------------------------------- |
| 404    | `USER_NOT_FOUND`      | Staff user does not exist in this tenant |
| 404    | `ROLE_NOT_FOUND`      | Role UUID does not exist                 |
| 422    | `ROLE_NOT_ASSIGNABLE` | Role exists but has status `DISABLED`    |
| 403    | `FORBIDDEN`           | Caller lacks `users.can_edit`            |

---

## 9. GET /api/backoffice/role-permission-modules

**Purpose**: Return the complete list of valid module keys and their display names for this platform
version. Used by the frontend to render the permission matrix UI.  
**Permission guard**: `module=settings, action=can_view`  
**Cache**: Response may be cached aggressively (module list is static per platform version).

### Request

```http
GET /api/backoffice/role-permission-modules
Authorization: Bearer <token>
```

### Response: 200 OK

```json
{
  "success": true,
  "data": {
    "modules": [
      { "key": "academic_structure", "display_name": "Academic Structure" },
      {
        "key": "content_classification",
        "display_name": "Content Classification"
      },
      { "key": "exam_engine", "display_name": "Exam Engine" },
      { "key": "users", "display_name": "Users (Staff & Students)" },
      { "key": "commercial", "display_name": "Commercial Layer" },
      { "key": "media_assets", "display_name": "Media & Assets" },
      { "key": "communication", "display_name": "Communication" },
      { "key": "ads", "display_name": "Ads" },
      { "key": "dashboard", "display_name": "Dashboard" },
      { "key": "settings", "display_name": "Settings" }
    ]
  },
  "error": null
}
```

---

## Common Error Codes Reference

| Code                    | HTTP Status | Description                                                                                                                                        |
| ----------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FORBIDDEN`             | 403         | Permission denied (all guard failures, no internal detail exposed); includes cross-tenant token replay (workspace_id claim mismatch — see spec A2) |
| `UNAUTHORIZED`          | 401         | Missing, expired, or invalid JWT (signature failure or missing claim)                                                                              |
| `ROLE_NOT_FOUND`        | 404         | Role UUID not found in this tenant                                                                                                                 |
| `USER_NOT_FOUND`        | 404         | Staff user UUID not found in this tenant                                                                                                           |
| `ROLE_NAME_CONFLICT`    | 409         | Duplicate role name in this tenant                                                                                                                 |
| `ROLE_HAS_ACTIVE_USERS` | 409         | Delete blocked: active users assigned to role                                                                                                      |
| `ROLE_NOT_ASSIGNABLE`   | 422         | Role is DISABLED and cannot be assigned                                                                                                            |
| `INVALID_MODULE`        | 422         | Unrecognized module key in permissions array                                                                                                       |
| `VALIDATION_ERROR`      | 422         | Request body failed schema validation                                                                                                              |
| `TENANT_NOT_FOUND`      | 404         | Workspace slug not found                                                                                                                           |
| `LICENSE_BLOCKED`       | 423         | Workspace license is SOFT_LOCKED                                                                                                                   |
| `VERSION_MISMATCH`      | 426         | Schema or product version incompatible                                                                                                             |
| `INTERNAL_ERROR`        | 500         | Unexpected server error (generic, no internal state exposed)                                                                                       |
| `SERVICE_UNAVAILABLE`   | 503         | DB unavailable during permission check                                                                                                             |
