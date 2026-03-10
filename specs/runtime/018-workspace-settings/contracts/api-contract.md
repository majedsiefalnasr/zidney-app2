# API Contract: Workspace Settings

**Branch**: `018-workspace-settings` | **Date**: 2026-02-28

---

## Base Path

```
/api/v1/backoffice/workspace/settings
```

All routes require (in order):

1. Correlation ID middleware (global)
2. Tenant resolver middleware (database-per-tenant)
3. License enforcement middleware
4. Schema version enforcement middleware
5. Rate limiting middleware (60 req/min per tenant, key prefix: backoffice)
6. Authentication middleware (JWT)
7. Authorization middleware (institution admin role)

### RBAC Matrix

| Endpoint             | `super_admin` | `org_admin` | `instructor` | `student` |
| -------------------- | ------------- | ----------- | ------------ | --------- |
| GET /settings        | Allowed       | Allowed     | Forbidden    | Forbidden |
| PUT /settings/:group | Allowed       | Allowed     | Forbidden    | Forbidden |
| GET /settings/audit  | Allowed       | Allowed     | Forbidden    | Forbidden |

---

## GET /api/v1/backoffice/workspace/settings

**Purpose**: Retrieve all workspace settings with defaults applied for unconfigured optional fields.

### Request

- **Method**: GET
- **Headers**: `Authorization: Bearer <jwt>`
- **Query Parameters**: None

### Response: 200 OK

```json
{
  "success": true,
  "data": {
    "config_version": 3,
    "general_settings": {
      "app_name": "Riyadh University",
      "timezone": "Asia/Riyadh",
      "date_format": "DD/MM/YYYY",
      "session_timeout_minutes": 30
    },
    "language_settings": {
      "default_language": "ar",
      "supported_languages": ["ar", "en"]
    },
    "branding_settings": {
      "logo_url": "https://cdn.example.com/logo.png",
      "favicon_url": null,
      "primary_color": "#1E40AF",
      "secondary_color": "#9333EA",
      "email_template_branding": null,
      "certificate_template_branding": null,
      "seo_metadata": null
    },
    "payment_settings": {
      "use_custom_payment_gateway": false,
      "gateway_provider": null,
      "has_api_key": false,
      "has_secret_key": false
    },
    "security_settings": {
      "analytics_opt_in": false,
      "max_login_attempts": 5,
      "lockout_duration_minutes": 15,
      "password_policy": null
    },
    "updated_at": "2026-02-28T10:30:00.000Z"
  },
  "error": null
}
```

### Payment Settings Response Notes

- `encrypted_api_key` and `encrypted_secret_key` are **NEVER** returned.
- Instead, boolean sentinel fields `has_api_key` and `has_secret_key` indicate whether credentials
  exist.

### Response: 404 Not Found (no settings row)

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "SETTINGS_NOT_FOUND",
    "message": "Workspace settings have not been initialized."
  }
}
```

---

## PUT /api/v1/backoffice/workspace/settings/:group

**Purpose**: Update a specific settings group with optimistic locking.

**Supported groups**: `general`, `language`, `branding`, `payment`, `security`

### Request

- **Method**: PUT
- **Headers**: `Authorization: Bearer <jwt>`, `Content-Type: application/json`
- **Path Parameter**: `group` — one of `general | language | branding | payment | security`

### Request Body (General)

```json
{
  "config_version": 3,
  "settings": {
    "app_name": "Riyadh University",
    "timezone": "Asia/Riyadh",
    "date_format": "DD/MM/YYYY",
    "session_timeout_minutes": 45
  }
}
```

### Request Body (Language)

```json
{
  "config_version": 3,
  "settings": {
    "default_language": "ar",
    "supported_languages": ["ar", "en", "fr"]
  }
}
```

### Request Body (Branding)

```json
{
  "config_version": 3,
  "settings": {
    "logo_url": "https://cdn.example.com/new-logo.png",
    "primary_color": "#1E40AF",
    "secondary_color": "#9333EA"
  }
}
```

### Request Body (Payment — Sentinel Pattern)

```json
{
  "config_version": 3,
  "settings": {
    "use_custom_payment_gateway": true,
    "gateway_provider": "moyasar",
    "api_key": "pk_live_abc123",
    "secret_key": "sk_live_xyz789"
  }
}
```

**Sentinel semantics** (CL-003):

- **Omit** `api_key` → keep existing value
- **Send `null`** → clear credential
- **Send new string** → encrypt and replace

**Note:** Request fields are named `api_key` / `secret_key` (plaintext from client). The server
encrypts before persistence as `encrypted_api_key` / `encrypted_secret_key` in the database.

### Response: 200 OK

```json
{
  "success": true,
  "data": {
    "config_version": 4,
    "updated_group": "general",
    "updated_at": "2026-02-28T10:35:00.000Z"
  },
  "error": null
}
```

### Response: 422 Unprocessable Entity (Validation Error)

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "SETTINGS_VALIDATION_FAILED",
    "message": "Validation failed: timezone must be a valid IANA timezone identifier. Received: 'Invalid/Zone'."
  }
}
```

### Response: 409 Conflict (Version Mismatch)

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "SETTINGS_VERSION_CONFLICT",
    "message": "Settings have been modified by another user. Current version: 5. Please refresh and retry."
  }
}
```

### Response: 503 Service Unavailable (Encryption Failure)

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "ENCRYPTION_SERVICE_UNAVAILABLE",
    "message": "Unable to process payment credentials. Please try again later."
  }
}
```

---

## GET /api/v1/backoffice/workspace/settings/audit

**Purpose**: Retrieve audit trail for workspace settings changes.

### Request

- **Method**: GET
- **Headers**: `Authorization: Bearer <jwt>`
- **Query Parameters**:
  - `group` (optional) — filter by settings group
  - `limit` (optional, default 20, max 100)
  - `cursor` (optional) — opaque cursor from previous response for pagination

### Response: 200 OK

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "user_id": "uuid",
        "settings_group": "general",
        "config_version": 4,
        "changes": [
          {
            "field": "app_name",
            "old_value": "Old Name",
            "new_value": "New Name"
          }
        ],
        "request_id": "correlation-id",
        "created_at": "2026-02-28T10:35:00.000Z"
      }
    ],
    "nextCursor": "eyJjcmVhdGVkX2F0IjoiMjAyNi0wMi0yOCIsImlkIjoiYWJjMTIzIn0="
  },
  "error": null
}
```

---

## Error Code Reference

| HTTP Status | Error Code                       | When                                              |
| ----------- | -------------------------------- | ------------------------------------------------- |
| 404         | `SETTINGS_NOT_FOUND`             | No settings row exists                            |
| 409         | `SETTINGS_VERSION_CONFLICT`      | `config_version` mismatch (CL-001)                |
| 422         | `SETTINGS_VALIDATION_FAILED`     | Zod validation failure (CL-004)                   |
| 503         | `ENCRYPTION_SERVICE_UNAVAILABLE` | Encryption key missing or crypto failure (FR-021) |
| 400         | `INVALID_SETTINGS_GROUP`         | Unknown group in path parameter                   |

### Middleware Error Responses

These status codes are generated by upstream middleware before reaching the route handler:

| HTTP Status | Source                         | When                                           |
| ----------- | ------------------------------ | ---------------------------------------------- |
| 401         | Authentication middleware      | Missing, invalid, or expired JWT               |
| 403         | License enforcement middleware | Workspace status is ARCHIVED                   |
| 423         | License enforcement middleware | Workspace status is SOFT_LOCKED                |
| 426         | Schema version middleware      | Schema version incompatible — upgrade required |
| 429         | Rate limiting middleware       | Request rate exceeded (60 req/min per tenant)  |
| 503         | Schema version middleware      | Schema migration pending                       |

All errors follow the standard Zidney format:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description"
  }
}
```
