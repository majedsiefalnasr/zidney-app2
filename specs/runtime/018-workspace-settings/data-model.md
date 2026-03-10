# Data Model: Workspace Settings

**Branch**: `018-workspace-settings` | **Date**: 2026-02-28  
**Spec**: `specs/runtime/018-workspace-settings/spec.md`  
**Research**: `specs/runtime/018-workspace-settings/research.md`

---

## Entity: workspace_settings (Tenant Database)

**Purpose**: Single-row configuration record per tenant workspace. Contains five JSONB setting
groups plus versioning and timestamp metadata.

**Table**: `workspace_settings` (extends existing baseline_004 table)

### Columns (New / Modified)

| Column              | Type        | Nullable | Default             | Description                                              |
| ------------------- | ----------- | -------- | ------------------- | -------------------------------------------------------- |
| `id`                | UUID        | NO       | `gen_random_uuid()` | Primary key (exists)                                     |
| `singleton_key`     | VARCHAR(10) | NO       | `'SETTINGS'`        | Singleton enforcement key. CHECK = 'SETTINGS', UNIQUE    |
| `config_version`    | INTEGER     | NO       | `1`                 | Optimistic locking counter. Incremented on every update. |
| `general_settings`  | JSONB       | NO       | `'{}'::jsonb`       | General workspace configuration                          |
| `language_settings` | JSONB       | NO       | `'{}'::jsonb`       | Language and i18n configuration                          |
| `branding_settings` | JSONB       | NO       | `'{}'::jsonb`       | White-label visual identity                              |
| `payment_settings`  | JSONB       | NO       | `'{}'::jsonb`       | Payment gateway configuration (credentials encrypted)    |
| `security_settings` | JSONB       | NO       | `'{}'::jsonb`       | Security policies and analytics                          |
| `created_at`        | TIMESTAMP   | NO       | `now()`             | Row creation timestamp (exists)                          |
| `updated_at`        | TIMESTAMP   | NO       | `now()`             | Last modification timestamp (exists, trigger-maintained) |

### Columns (Preserved from baseline_004 — NOT dropped)

| Column                       | Type         | Description                                            |
| ---------------------------- | ------------ | ------------------------------------------------------ |
| `organization_name`          | VARCHAR(255) | Migrated into general_settings.app_name                |
| `student_limit`              | INTEGER      | Remains for license enforcement                        |
| `staff_limit`                | INTEGER      | Remains for license enforcement                        |
| `uses_divisions`             | BOOLEAN      | Remains for feature flag                               |
| `default_language`           | VARCHAR(10)  | Migrated into language_settings.default_language       |
| `timezone`                   | VARCHAR(50)  | Migrated into general_settings.timezone                |
| `max_concurrent_exams`       | INTEGER      | Remains for capacity                                   |
| `session_timeout_minutes`    | INTEGER      | Migrated into general_settings.session_timeout_minutes |
| `require_email_verification` | BOOLEAN      | Remains for auth                                       |
| `enable_api_access`          | BOOLEAN      | Remains for feature flag                               |

### Constraints

- `PK`: `id` (exists)
- `UNIQUE`: `singleton_key` — enforces at most one row
- `CHECK`: `singleton_key = 'SETTINGS'` — constant value enforcement
- Existing trigger: `workspace_settings_updated_at` — auto-updates `updated_at`

### Indexes

- `idx_workspace_settings_singleton` on `singleton_key` (covers the singleton lookup)

---

## JSONB Schema: general_settings

```typescript
interface GeneralSettings {
  app_name: string; // Required. Workspace display name. Max 255 chars.
  timezone: string; // Required. Valid IANA timezone (e.g., "Asia/Riyadh").
  date_format: string; // Required. Enum: "YYYY-MM-DD" | "DD/MM/YYYY" | "MM/DD/YYYY" | "DD-MM-YYYY" | "DD.MM.YYYY"
  session_timeout_minutes?: number; // Optional. Integer >= 5, <= 480. Default: 30.
}
```

### Defaults (applied at read time for missing optional fields)

| Field                     | Default |
| ------------------------- | ------- |
| `session_timeout_minutes` | `30`    |

---

## JSONB Schema: language_settings

```typescript
interface LanguageSettings {
  default_language: string; // Required. ISO 639-1 code (e.g., "ar", "en").
  supported_languages: string[]; // Required. Non-empty array of ISO 639-1 codes. Must contain default_language.
}
```

### Validation Rules

- `default_language` MUST exist in `supported_languages`.
- `supported_languages` must contain at least one entry.
- Removing a language marks it as inactive — does NOT delete translations (enforced at service
  layer).

---

## JSONB Schema: branding_settings

```typescript
interface BrandingSettings {
  logo_url?: string; // Optional. Valid URL or null.
  favicon_url?: string; // Optional. Valid URL or null.
  primary_color?: string; // Optional. Hex color: /^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/
  secondary_color?: string; // Optional. Hex color format.
  email_template_branding?: {
    header_logo_url?: string;
    footer_text?: string;
  };
  certificate_template_branding?: {
    logo_url?: string;
    signature_url?: string;
    institution_name?: string;
  };
  seo_metadata?: {
    title?: string; // Max 60 chars
    description?: string; // Max 160 chars
    og_image_url?: string; // Valid URL
  };
}
```

### Validation Rules

- All URLs must pass URL format validation.
- Color values must match hex pattern.
- Branding is visual-only — MUST NOT influence business logic (enforced by architecture, not
  schema).

---

## JSONB Schema: payment_settings

```typescript
interface PaymentSettings {
  use_custom_payment_gateway: boolean; // Required. Default: false.
  gateway_provider?: string | null; // Optional. Provider name (e.g., "stripe", "moyasar").
  encrypted_api_key?: string | null; // Encrypted at rest. Format: "v1:<iv>:<authTag>:<ciphertext>". NEVER returned in API.
  encrypted_secret_key?: string | null; // Encrypted at rest. Same format. NEVER returned in API.
}
```

### Sentinel Pattern (CL-003)

On PUT request payload:

- **Omit** `encrypted_api_key` / `encrypted_secret_key` → keep existing value
- **Send `null`** → clear the credential
- **Send new string** → encrypt and replace

### Storage Format (CL-005)

Encrypted fields stored as: `v1:<base64_iv>:<base64_authTag>:<base64_ciphertext>`

Where `v1` is the key identifier for future rotation support.

### Security Rules

- Raw credentials NEVER stored in database.
- Encrypted values NEVER returned in any API response.
- Encrypted values NEVER appear in audit logs.
- If encryption service unavailable → update MUST fail entirely (FR-021).

---

## JSONB Schema: security_settings

```typescript
interface SecuritySettings {
  analytics_opt_in: boolean; // Default: false. Must be explicit opt-in.
  max_login_attempts?: number; // Optional. Integer >= 1, <= 20. Default: 5.
  lockout_duration_minutes?: number; // Optional. Integer >= 1, <= 1440. Default: 15.
  password_policy?: {
    // Future-ready. Accepted, persisted, NOT enforced.
    min_length?: number;
    require_uppercase?: boolean;
    require_lowercase?: boolean;
    require_numbers?: boolean;
    require_special_chars?: boolean;
  };
}
```

### Defaults (applied at read time)

| Field                      | Default |
| -------------------------- | ------- |
| `analytics_opt_in`         | `false` |
| `max_login_attempts`       | `5`     |
| `lockout_duration_minutes` | `15`    |

---

## Entity: workspace_settings_audit (Tenant Database)

**Purpose**: Immutable audit trail for all workspace settings changes. One entry per settings
update.

**Table**: `workspace_settings_audit`

### Columns

| Column           | Type        | Nullable | Default             | Description                                                                       |
| ---------------- | ----------- | -------- | ------------------- | --------------------------------------------------------------------------------- |
| `id`             | UUID        | NO       | `gen_random_uuid()` | Primary key                                                                       |
| `workspace_id`   | UUID        | NO       | —                   | Workspace identifier (denormalized from context)                                  |
| `user_id`        | UUID        | NO       | —                   | Actor who made the change                                                         |
| `settings_group` | VARCHAR(30) | NO       | —                   | Which group was updated: `general`, `language`, `branding`, `payment`, `security` |
| `config_version` | INTEGER     | NO       | —                   | The config_version AFTER this change                                              |
| `changes`        | JSONB       | NO       | —                   | Structured diff: `[{ field, old_value, new_value }]`                              |
| `request_id`     | VARCHAR(50) | NO       | —                   | Correlation/request ID for tracing                                                |
| `ip_address`     | INET        | YES      | —                   | Client IP address                                                                 |
| `user_agent`     | TEXT        | YES      | —                   | Client user agent                                                                 |
| `created_at`     | TIMESTAMP   | NO       | `now()`             | Server-authoritative timestamp                                                    |

### Constraints

- `PK`: `id`
- `IMMUTABLE`: No UPDATE or DELETE allowed (enforced by application policy + optional trigger)

### Indexes

- `idx_wsa_workspace_id` on `workspace_id` — filter by workspace
- `idx_wsa_created_at` on `created_at` — chronological queries
- `idx_wsa_settings_group` on `settings_group` — filter by settings type
- `idx_wsa_config_version` on `config_version` — version correlation

### Audit Diff Format (changes JSONB)

```json
[
  {
    "field": "app_name",
    "old_value": "Old University Name",
    "new_value": "New University Name"
  },
  {
    "field": "timezone",
    "old_value": "UTC",
    "new_value": "Asia/Riyadh"
  },
  {
    "field": "encrypted_api_key",
    "old_value": "[REDACTED]",
    "new_value": "[REDACTED]"
  }
]
```

### Redaction Rules

For payment credential fields (`encrypted_api_key`, `encrypted_secret_key`):

- If changed: record
  `{ field: "encrypted_api_key", old_value: "[REDACTED]", new_value: "[REDACTED]" }`
- If cleared (null): record
  `{ field: "encrypted_api_key", old_value: "[REDACTED]", new_value: null }`
- If set for first time: record
  `{ field: "encrypted_api_key", old_value: null, new_value: "[REDACTED]" }`

---

## State Transitions

### config_version Lifecycle

```
[Initial] → config_version = 1 (first settings save or baseline)
    │
    v
[Update N] → config_version = N + 1 (each successful update)
    │
    ├── Success: version incremented, audit entry created
    └── Conflict: HTTP 409 returned, no change
```

### Payment Credential States

```
[Not Set] ──(new string)──→ [Encrypted & Stored]
    │                              │
    │                     (null)   │    (new string)
    │                       ↓     │        ↓
    │                  [Cleared]   ←── [Re-encrypted]
    │                       │
    │                  (omit)
    │                       ↓
    └──────────────── [Unchanged]
```

---

## Relationships

```
workspace_settings (1) ──audit──→ (N) workspace_settings_audit

workspace_settings_audit.workspace_id references tenant context (denormalized, no FK)
workspace_settings_audit.user_id references users table (no FK to preserve audit after user deletion)
```

**No foreign keys on audit table** — audit entries must survive user deletion and schema evolution.

---

## Migration Plan

**Migration file**: `apps/api/src/db/tenant/migrations/20260228_002_workspace_settings_jsonb.ts`

### Steps (within single transaction):

1. **ADD** `singleton_key VARCHAR(10) NOT NULL DEFAULT 'SETTINGS'` with CHECK and UNIQUE
2. **ADD** `config_version INTEGER NOT NULL DEFAULT 1`
3. **ADD** `general_settings JSONB NOT NULL DEFAULT '{}'::jsonb`
4. **ADD** `language_settings JSONB NOT NULL DEFAULT '{}'::jsonb`
5. **ADD** `branding_settings JSONB NOT NULL DEFAULT '{}'::jsonb`
6. **ADD** `payment_settings JSONB NOT NULL DEFAULT '{}'::jsonb`
7. **ADD** `security_settings JSONB NOT NULL DEFAULT '{}'::jsonb`
8. **MIGRATE DATA**: Copy existing flat column values into JSONB columns:
   ```sql
   UPDATE workspace_settings SET
     general_settings = jsonb_build_object(
       'app_name', organization_name,
       'timezone', timezone,
       'date_format', 'YYYY-MM-DD',
       'session_timeout_minutes', session_timeout_minutes
     ),
     language_settings = jsonb_build_object(
       'default_language', default_language,
       'supported_languages', jsonb_build_array(default_language)
     ),
     security_settings = jsonb_build_object(
       'analytics_opt_in', false,
       'max_login_attempts', 5,
       'lockout_duration_minutes', 15
     );
   ```
9. **CREATE TABLE** `workspace_settings_audit` with all columns and indexes
10. **DROP** old singleton trigger (replaced by CHECK + UNIQUE constraint)

### Forward-Only Guarantee

- No columns dropped from workspace_settings
- No existing constraints removed (except trigger replacement)
- Old columns remain readable for backward compatibility
- Rollback = snapshot restore only
