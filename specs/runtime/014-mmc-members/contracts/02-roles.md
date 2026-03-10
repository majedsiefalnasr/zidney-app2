# API Contract — Role Management

## Overview

Role management endpoints handle RBAC configuration: role definitions, permission matrices, and
cascading permission updates across all members with session invalidation.

---

## GET /mmc/roles

**List All Roles**

### Permissions

- Required: `MEMBERS_MANAGEMENT.view`
- Denied returns: 403 Forbidden

### Request

```
GET /mmc/roles?status=ACTIVE
Authorization: Bearer {jwt_token}
X-Correlation-ID: {correlation_id}
```

### Query Parameters

| Parameter | Type   | Default | Description                           |
| --------- | ------ | ------- | ------------------------------------- |
| status    | string | ACTIVE  | Filter by status (ACTIVE or INACTIVE) |

### Response: 200 OK

```json
{
  "success": true,
  "data": [
    {
      "id": "role-1-uuid",
      "name": "Platform Administrator",
      "description": "Full platform access; can manage all entities",
      "status": "ACTIVE",
      "created_at": "2026-02-20T00:00:00.000Z",
      "member_count": 5
    },
    {
      "id": "role-2-uuid",
      "name": "Sales Team",
      "description": "Product and client management only",
      "status": "ACTIVE",
      "created_at": "2026-02-20T00:00:00.000Z",
      "member_count": 12
    }
  ],
  "error": null
}
```

---

## GET /mmc/roles/:id

**Retrieve Role Details**

### Permissions

- Required: `MEMBERS_MANAGEMENT.view`

### Request

```
GET /mmc/roles/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer {jwt_token}
X-Correlation-ID: {correlation_id}
```

### Response: 200 OK

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Platform Administrator",
    "description": "Full platform access",
    "status": "ACTIVE",
    "created_at": "2026-02-20T00:00:00.000Z",
    "updated_at": "2026-02-20T00:00:00.000Z"
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
    "message": "Role not found"
  }
}
```

---

## GET /mmc/roles/:id/permissions

**Retrieve Role's Permission Matrix**

### Permissions

- Required: `MEMBERS_MANAGEMENT.view`

### Request

```
GET /mmc/roles/550e8400-e29b-41d4-a716-446655440000/permissions
Authorization: Bearer {jwt_token}
X-Correlation-ID: {correlation_id}
```

### Response: 200 OK

```json
{
  "success": true,
  "data": {
    "role_id": "550e8400-e29b-41d4-a716-446655440000",
    "role_name": "Platform Administrator",
    "permissions": [
      {
        "id": "perm-1-uuid",
        "domain": "ORGANIZATION_SETTINGS",
        "can_view": true,
        "can_create": true,
        "can_edit": true,
        "can_delete": false
      },
      {
        "id": "perm-2-uuid",
        "domain": "PRODUCT_MANAGEMENT",
        "can_view": true,
        "can_create": true,
        "can_edit": true,
        "can_delete": true
      },
      {
        "id": "perm-3-uuid",
        "domain": "LICENSE_MANAGEMENT",
        "can_view": true,
        "can_create": false,
        "can_edit": true,
        "can_delete": false
      },
      {
        "id": "perm-4-uuid",
        "domain": "CLIENT_MANAGEMENT",
        "can_view": true,
        "can_create": true,
        "can_edit": true,
        "can_delete": true
      },
      {
        "id": "perm-5-uuid",
        "domain": "AFFILIATE_MANAGEMENT",
        "can_view": true,
        "can_create": true,
        "can_edit": true,
        "can_delete": true
      },
      {
        "id": "perm-6-uuid",
        "domain": "MEMBERS_MANAGEMENT",
        "can_view": true,
        "can_create": true,
        "can_edit": true,
        "can_delete": true
      },
      {
        "id": "perm-7-uuid",
        "domain": "REPORTING",
        "can_view": true,
        "can_create": false,
        "can_edit": false,
        "can_delete": false
      }
    ]
  },
  "error": null
}
```

### Permission Domains

```
ORGANIZATION_SETTINGS    Organization name, branding, settings
PRODUCT_MANAGEMENT       Create/edit/delete products, exam config
LICENSE_MANAGEMENT       View/manage licenses, activations, renewals
CLIENT_MANAGEMENT        Create/manage client organizations
AFFILIATE_MANAGEMENT     Manage partner affiliates, revenue share
MEMBERS_MANAGEMENT       Create/edit/disable MMC members
REPORTING                Access audit logs, compliance reports, analytics
```

### Permission Bits

Each domain has 4 boolean bits:

| Bit        | Domain | Meaning                                     |
| ---------- | ------ | ------------------------------------------- |
| can_view   | All 7  | User can read/retrieve entities in domain   |
| can_create | All 7  | User can create new entities in domain      |
| can_edit   | All 7  | User can modify existing entities in domain |
| can_delete | All 7  | User can delete/disable entities in domain  |

**Semantics:** Used for fine-grained access control.

- `view=true, edit=false` → read-only access
- `create=true, delete=false` → can create but not destroy

### Error Responses

#### 404 Not Found

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "NOT_FOUND",
    "message": "Role not found"
  }
}
```

---

## PATCH /mmc/roles/:id/permissions

**Update Role's Permission Matrix** — Cascades token version to all members with this role

### Permissions

- Required: `MEMBERS_MANAGEMENT.edit`
- Denied returns: 403 Forbidden

### Request

```
PATCH /mmc/roles/550e8400-e29b-41d4-a716-446655440000/permissions
Authorization: Bearer {jwt_token}
X-Correlation-ID: {correlation_id}
Content-Type: application/json

{
  "permissions": [
    {
      "domain": "PRODUCT_MANAGEMENT",
      "can_view": true,
      "can_create": true,
      "can_edit": false,
      "can_delete": false
    },
    {
      "domain": "CLIENT_MANAGEMENT",
      "can_view": true,
      "can_create": true,
      "can_edit": true,
      "can_delete": false
    }
  ]
}
```

### Request Validation

| Field       | Type    | Constraints                                  |
| ----------- | ------- | -------------------------------------------- |
| permissions | array   | 1-7 objects; each with domain + 4 bit fields |
| domain      | string  | Must be one of 7 valid domains               |
| can_view    | boolean | true or false                                |
| can_create  | boolean | true or false                                |
| can_edit    | boolean | true or false                                |
| can_delete  | boolean | true or false                                |

### Response: 200 OK

```json
{
  "success": true,
  "data": {
    "role_id": "550e8400-e29b-41d4-a716-446655440000",
    "role_name": "Sales Team",
    "permissions_updated": 2,
    "affected_members": 12,
    "token_versions_incremented": true,
    "message": "Permissions updated; 12 active sessions will be invalidated on next request"
  },
  "error": null
}
```

### Session Invalidation Side Effect

- All members with this role get `token_version` incremented
- Active sessions (with old token_version) invalidated
- Next request from any affected member fails 401 (token_version mismatch)
- Members must re-login

### Error Responses

#### 404 Not Found

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "NOT_FOUND",
    "message": "Role not found"
  }
}
```

#### 400 Bad Request

**Invalid domain**

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "UNPROCESSABLE_ENTITY",
    "message": "Invalid domain 'INVALID_DOMAIN'; must be one of 7 valid domains"
  }
}
```

### Transaction Details

```sql
BEGIN TRANSACTION SERIALIZABLE
  1. Verify role exists
  2. Verify all domains are valid
  3. UPDATE role_permissions for each supplied domain
  4. SELECT all mmc_members WHERE role_id = ?
  5. FOR EACH member: UPDATE mmc_members SET token_version = token_version + 1
  6. INSERT into mmc_audit_log (one entry per affected member or batch entry)
COMMIT
```

**Atomicity:** All updates committed together; if any fails, entire transaction rolls back (no
partial permission changes).

---

## POST /mmc/roles

**Create New Role** (optional; may defer to later phase)

### Permissions

- Required: `MEMBERS_MANAGEMENT.edit`

### Request

```
POST /mmc/roles
Authorization: Bearer {jwt_token}
X-Correlation-ID: {correlation_id}
Content-Type: application/json

{
  "name": "Support Team",
  "description": "Support operations; view-only access to client data",
  "permissions": [
    {
      "domain": "CLIENT_MANAGEMENT",
      "can_view": true,
      "can_create": false,
      "can_edit": false,
      "can_delete": false
    },
    {
      "domain": "PRODUCT_MANAGEMENT",
      "can_view": true,
      "can_create": false,
      "can_edit": false,
      "can_delete": false
    }
  ]
}
```

### Response: 201 Created

```json
{
  "success": true,
  "data": {
    "id": "role-new-uuid",
    "name": "Support Team",
    "description": "Support operations; view-only access to client data",
    "status": "ACTIVE",
    "created_at": "2026-02-25T10:32:00.000Z"
  },
  "error": null
}
```

---

## DELETE /mmc/roles/:id

**Delete Role** (Requires no members assigned; safety check)

### Permissions

- Required: `MEMBERS_MANAGEMENT.delete`

### Request

```
DELETE /mmc/roles/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer {jwt_token}
X-Correlation-ID: {correlation_id}
```

### Response: 204 No Content or 200 OK

```json
{
  "success": true,
  "data": {
    "id": "role-uuid",
    "message": "Role deleted"
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
    "message": "Role not found"
  }
}
```

#### 409 Conflict

**Cannot delete; members assigned to this role**

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "CONFLICT",
    "message": "Cannot delete role; 5 members are assigned to this role. Reassign or disable members first."
  }
}
```

### Safety Check

```sql
1. SELECT COUNT(*) FROM mmc_members WHERE role_id = ?
2. IF COUNT > 0: return 409 Conflict (prevent orphaning)
3. ELSE: DELETE FROM role_permissions, DELETE FROM roles (in transaction)
```

---

## Reference: Permission Evaluation at API Layer

When a user attempts an action, the API middleware:

1. Maps HTTP method + route to permission requirement
   - `GET /mmc/members/{id}` → `(MEMBERS_MANAGEMENT, view)`
   - `POST /mmc/members` → `(MEMBERS_MANAGEMENT, create)`
   - `PATCH /mmc/members/{id}` → `(MEMBERS_MANAGEMENT, edit)`
   - `DELETE /mmc/members/{id}` → `(MEMBERS_MANAGEMENT, delete)`

2. Queries permission matrix:

   ```sql
   SELECT (can_view, can_create, can_edit, can_delete) FROM role_permissions
   WHERE role_id = ? AND domain = ?
   ```

3. Checks relevant permission bit:
   - If permission found and bit=true: allow (continue to handler)
   - If permission found and bit=false: deny 403
   - If permission NOT found: deny 403 (implicit deny; fail-safe)

4. Logs decision (warn level if denied)
