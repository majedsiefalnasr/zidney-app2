# OpenAPI 3.0 Specification - Licenses Management API

## Info

- Title: Zidney Licenses Management API
- Version: 1.0.0
- Description: Multi-tenant commercial license management with provisioning, status transitions, and
  audit logging

## Base URL

- Production: `https://api.zidney.io/v1/mmc`
- Staging: `https://staging-api.zidney.io/v1/mmc`

---

## Endpoints

### 1. Create License

**POST** `/licenses`

**Description:** Create a new commercial license bound to a product and workspace

**Authentication:** Bearer token (MMC admin role required)

**Request Body:**

```json
{
  "product_id": "uuid",
  "workspace_slug": "unique-workspace-identifier",
  "student_limit": 100,
  "staff_limit": 10,
  "language_code": "en"
}
```

**Response (201 Created):**

```json
{
  "success": true,
  "data": {
    "id": "license-uuid",
    "product_id": "product-uuid",
    "workspace_slug": "unique-workspace-identifier",
    "status": "PENDING_PROVISION",
    "student_limit": 100,
    "staff_limit": 10,
    "expected_schema_version": "1.0.0",
    "expected_product_version": "2.0.0",
    "created_at": "2026-02-22T10:00:00Z",
    "updated_at": "2026-02-22T10:00:00Z"
  },
  "error": null
}
```

**Error Responses:**

- 400 VALIDATION_ERROR: Invalid slug format, limits, or language
- 403 UNAUTHORIZED: Missing MMC admin role
- 409 WORKSPACE_ALREADY_EXISTS: Duplicate workspace slug

---

### 2. List Licenses

**GET** `/licenses?status=ACTIVE&page=1&limit=20`

**Description:** Retrieve paginated list of licenses with optional filtering

**Authentication:** Bearer token (MMC admin role required)

**Query Parameters:**

- `status`: Filter by status (ACTIVE, SOFT_LOCKED, ARCHIVED, DELETED)
- `product_id`: Filter by product
- `page`: Page number (default: 1)
- `limit`: Results per page (default: 20, max: 100)
- `search`: Search by workspace slug

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "license-uuid",
        "workspace_slug": "workspace-1",
        "status": "ACTIVE",
        "student_limit": 100,
        "created_at": "2026-02-22T10:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "totalPages": 3
    }
  },
  "error": null
}
```

---

### 3. Get License Detail

**GET** `/licenses/{id}`

**Description:** Retrieve full license details by ID

**Authentication:** Bearer token

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "id": "license-uuid",
    "product_id": "product-uuid",
    "workspace_id": "workspace-uuid",
    "workspace_slug": "unique-workspace",
    "status": "ACTIVE",
    "student_limit": 100,
    "staff_limit": 10,
    "soft_lock_until": "2026-04-22T10:00:00Z",
    "archived_at": null,
    "expected_schema_version": "1.0.0",
    "expected_product_version": "2.0.0",
    "created_at": "2026-02-22T10:00:00Z",
    "updated_at": "2026-02-22T10:00:00Z"
  },
  "error": null
}
```

**Error Responses:**

- 404 LICENSE_NOT_FOUND: License ID not found

---

### 4. Edit License (Mutable Fields Only)

**PATCH** `/licenses/{id}`

**Description:** Update editable license fields (student_limit, staff_limit only)

**Authentication:** Bearer token (MMC admin role required)

**Request Body:**

```json
{
  "student_limit": 150,
  "staff_limit": 15
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "id": "license-uuid",
    "student_limit": 150,
    "staff_limit": 15,
    "updated_at": "2026-02-22T11:00:00Z"
  },
  "error": null
}
```

**Error Responses:**

- 409 INVALID_STATE_TRANSITION: Cannot edit archived/soft-locked license
- 422 IMMUTABLE_FIELD: Attempt to modify product_id or workspace_slug

---

### 5. Soft-Lock License

**POST** `/licenses/{id}/soft-lock`

**Description:** Grace-period lock (ACTIVE → SOFT_LOCKED, 90-day grace period)

**Authentication:** Bearer token (MMC admin role required)

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "id": "license-uuid",
    "status": "SOFT_LOCKED",
    "soft_lock_until": "2026-05-22T10:00:00Z",
    "grace_days": 90,
    "updated_at": "2026-02-22T11:30:00Z"
  },
  "error": null
}
```

---

### 6. Unlock License

**POST** `/licenses/{id}/unlock`

**Description:** Restore from grace period (SOFT_LOCKED → ACTIVE)

**Authentication:** Bearer token (MMC admin role required)

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "id": "license-uuid",
    "status": "ACTIVE",
    "soft_lock_until": null,
    "updated_at": "2026-02-22T12:00:00Z"
  },
  "error": null
}
```

---

### 7. Archive License

**POST** `/licenses/{id}/archive`

**Description:** Permanent archive (SOFT_LOCKED → ARCHIVED, read-only)

**Authentication:** Bearer token (MMC admin role required)

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "id": "license-uuid",
    "status": "ARCHIVED",
    "archived_at": "2026-02-22T12:30:00Z",
    "snapshot_location": "s3://archive/license-uuid/snapshot",
    "updated_at": "2026-02-22T12:30:00Z"
  },
  "error": null
}
```

---

### 8. Restore from Archive

**POST** `/licenses/{id}/restore`

**Description:** Restore archived license (ARCHIVED → ACTIVE)

**Authentication:** Bearer token (MMC admin role required)

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "id": "license-uuid",
    "status": "ACTIVE",
    "archived_at": null,
    "updated_at": "2026-02-22T13:00:00Z"
  },
  "error": null
}
```

---

### 9. Delete License

**DELETE** `/licenses/{id}`

**Description:** Permanent deletion (any state → DELETED, non-recoverable)

**Authentication:** Bearer token (MMC admin role required)

**Query Parameters:**

- `confirm`: Must include `confirm=true` to prevent accidental deletion

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "id": "license-uuid",
    "status": "DELETED",
    "deleted_at": "2026-02-22T13:30:00Z"
  },
  "error": null
}
```

---

### 10. Retry Provisioning

**POST** `/licenses/{id}/retry-provisioning`

**Description:** Manual retry of failed provisioning job

**Authentication:** Bearer token (MMC admin role required)

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "id": "license-uuid",
    "status": "PENDING_PROVISION",
    "provisioning_retries": 1,
    "provisioning_last_attempt_at": "2026-02-22T14:00:00Z"
  },
  "error": null
}
```

---

## Error Response Format (RFC 7807)

**Standard Error Structure:**

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "LICENSE_SOFT_LOCKED",
    "message": "License is in grace period and cannot be edited",
    "details": {
      "license_id": "license-uuid",
      "current_status": "SOFT_LOCKED",
      "grace_until": "2026-05-22T10:00:00Z"
    }
  }
}
```

**HTTP Status Mapping:** | Code | Status | Meaning | |------|--------|---------| | VALIDATION_ERROR
| 400 | Invalid input | | INVALID_STATE_TRANSITION | 409 | Cannot transition from current state | |
AUTH_MISSING | 401 | Missing authentication token | | UNAUTHORIZED | 403 | Invalid role/permissions
| | LICENSE_NOT_FOUND | 404 | License ID not found | | LICENSE_SOFT_LOCKED | 423 | In grace period |
| LICENSE_ARCHIVED | 403 | Read-only (archived) | | SERVICE_UNAVAILABLE | 503 | Database/queue
unavailable |

---

## Status Transitions (State Machine)

```
PENDING_PROVISION
    ↓ (manual retry or auto-retry)
ACTIVE ↔ SOFT_LOCKED (90-day grace)
    ↓
ARCHIVED (point-in-time snapshot)
    ↓
DELETED (permanent)
```

**Valid Transitions:**

- PENDING_PROVISION → ACTIVE (successful provisioning)
- ACTIVE → SOFT_LOCKED (soft-lock)
- SOFT_LOCKED → ACTIVE (unlock)
- SOFT_LOCKED → ARCHIVED (automatic or manual after grace expires)
- ARCHIVED → ACTIVE (restore)
- Any → DELETED (hard delete)

---

## Authentication

All endpoints (except health check) require:

**Header:** `Authorization: Bearer <JWT_TOKEN>`

**JWT Claims Required:**

- `sub`: User ID
- `workspace`: MMC (must be "mmc" for all license endpoints)
- `role`: "mmc_admin"
- `exp`: Token expiration timestamp

---

## Rate Limiting

- Create/Edit: 10 req/min per MMC admin
- List: 30 req/min per MMC admin
- Get Detail: 60 req/min per MMC admin
- Status Changes: 5 req/min per license
- Retry Provisioning: 3 req/min per license

---

## Webhooks (Optional)

Subscribe to provisioning events:

```
POST https://your-domain.com/webhook
X-Signature: <HMAC-SHA256 signature>

{
  "event": "provisioning:completed",
  "license_id": "license-uuid",
  "workspace_slug": "workspace-slug",
  "status": "ACTIVE",
  "timestamp": "2026-02-22T10:00:00Z",
  "correlation_id": "corr-abc123"
}
```

---

## Examples

### Create License

```bash
curl -X POST https://api.zidney.io/v1/mmc/licenses \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "product_id": "prod-001",
    "workspace_slug": "acme-corp",
    "student_limit": 500,
    "staff_limit": 25,
    "language_code": "en"
  }'
```

### List Licenses by Status

```bash
curl "https://api.zidney.io/v1/mmc/licenses?status=ACTIVE&limit=50" \
  -H "Authorization: Bearer $TOKEN"
```

### Soft-Lock License

```bash
curl -X POST https://api.zidney.io/v1/mmc/licenses/lic-abc123/soft-lock \
  -H "Authorization: Bearer $TOKEN"
```
