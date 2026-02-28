# Testing Guide — Workspace Settings

**Stage:** WORKSPACE_SETTINGS
**Phase:** 03_BACKOFFICE_CORE/01_FOUNDATION
**Stage Directory:** 018-workspace-settings
**Generated On:** 2026-02-28

---

## Purpose

This guide explains how to validate the Workspace Settings implementation end-to-end. It covers automated tests, manual API testing, edge cases, and multi-tenant isolation verification.

---

## Summary of Delivered Behavior

Workspace Settings provides a tenant-level configuration system allowing institution administrators to manage 5 settings groups (general, language, branding, payment, security) via REST API. Settings are stored as JSONB columns in a single-row-per-tenant table with optimistic locking. Payment credentials are encrypted with AES-256-GCM. All changes produce immutable audit trail entries with field-level diffs.

Key outcomes:

- GET /api/v1/backoffice/workspace/settings — retrieve all settings with defaults applied
- PUT /api/v1/backoffice/workspace/settings/:group — update a single settings group with version checking
- GET /api/v1/backoffice/workspace/settings/audit — query audit trail with cursor pagination and optional group filter

---

## Prerequisites

| Requirement                | Validation Command / Check                                           |
| -------------------------- | -------------------------------------------------------------------- |
| Bun installed              | `bun --version` (v1+)                                                |
| PostgreSQL running         | `docker ps` — check zidney-postgres container                        |
| Redis running              | `docker ps` — check zidney-redis container                           |
| Environment file present   | Verify `.env` exists with `WORKSPACE_SETTINGS_ENCRYPTION_KEY`        |
| Encryption key set         | `echo $WORKSPACE_SETTINGS_ENCRYPTION_KEY` — must be 64 hex chars     |
| Migrations applied         | Tenant migration `20260228_002_workspace_settings_jsonb` must be run |
| Correct branch checked out | `git branch` includes `018-workspace-settings`                       |

---

## Files in Scope

```text
apps/api/src/db/tenant/migrations/20260228_002_workspace_settings_jsonb.ts
apps/api/src/db/tenant/schemas/workspace-settings.schema.ts
apps/api/src/modules/workspace-settings/workspace-settings.types.ts
apps/api/src/modules/workspace-settings/workspace-settings.errors.ts
apps/api/src/modules/workspace-settings/workspace-settings.validation.ts
apps/api/src/modules/workspace-settings/encryption.service.ts
apps/api/src/modules/workspace-settings/workspace-settings.repository.ts
apps/api/src/modules/workspace-settings/workspace-settings.service.ts
apps/api/src/modules/workspace-settings/workspace-settings.routes.ts
apps/api/src/routes/backoffice/settings.ts
apps/api/src/app.ts
docker-compose.yml
.env.example
tests/unit/encryption-service.test.ts
tests/unit/workspace-settings-validation.test.ts
tests/unit/audit-diff.test.ts
tests/unit/workspace-settings-service.test.ts
tests/integration/workspace-settings-api.test.ts
```

---

## Local Run Commands

```bash
# Install dependencies
bun install

# Start database + redis (if not running)
docker compose up -d postgres redis pgbouncer

# Apply tenant migrations (replace <slug> with workspace slug)
bun run db:migrate --workspace <slug>

# Start API
bun run dev:api

# Generate encryption key (if not set)
openssl rand -hex 32
```

---

## Automated Validation Commands

```bash
# Unit tests only (workspace settings)
npx vitest run tests/unit/encryption-service.test.ts tests/unit/workspace-settings-validation.test.ts tests/unit/audit-diff.test.ts tests/unit/workspace-settings-service.test.ts

# Integration tests only (workspace settings)
npx vitest run tests/integration/workspace-settings-api.test.ts

# All workspace settings tests
npx vitest run tests/unit/encryption-service.test.ts tests/unit/workspace-settings-validation.test.ts tests/unit/audit-diff.test.ts tests/unit/workspace-settings-service.test.ts tests/integration/workspace-settings-api.test.ts

# Type check
npx tsc --noEmit -p apps/api/tsconfig.json

# Lint
bunx eslint apps/api/src/modules/workspace-settings/
```

Expected outcome: 140 tests pass, 0 TypeScript errors, 0 lint errors.

---

## Manual Test Scenarios

### Scenario 1 — Retrieve Default Settings

**Purpose:** Verify that GET /settings returns sensible defaults for a workspace with no prior settings.

1. Authenticate as an institution admin (`institution_admin` role) for a test workspace
2. Send `GET /api/v1/backoffice/workspace/settings`
3. Inspect the response body

Expected:

- HTTP 200 with `{ success: true, data: { settings: {...}, config_version: 1 }, error: null }`
- `general` group has `timezone: "UTC"`, `date_format: "YYYY-MM-DD"`
- `language` group has `default_language: "ar"`, `supported_languages: ["ar"]`
- `branding` group has `primary_color: "#1a73e8"`
- `payment` group has `has_api_key: false`, `has_secret_key: false` (no raw credentials)
- `security` group has `max_login_attempts: 5`, `session_timeout_minutes: 30`

Troubleshooting:

- 401 → JWT token missing or expired. Re-authenticate.
- 404 → Workspace not found. Check workspace slug.
- 503 → License check failed. Verify workspace license is active.

### Scenario 2 — Update General Settings with Version Check

**Purpose:** Verify that PUT /:group validates, persists, increments version, and creates audit entry.

1. Send `GET /api/v1/backoffice/workspace/settings` — note `config_version` (e.g., 1)
2. Send `PUT /api/v1/backoffice/workspace/settings/general` with body:
   ```json
   {
     "settings": {
       "institution_name": "Test University",
       "timezone": "Asia/Riyadh",
       "date_format": "DD/MM/YYYY",
       "academic_year_start_month": 9
     },
     "config_version": 1
   }
   ```
3. Verify response has `config_version: 2`
4. Send `GET /api/v1/backoffice/workspace/settings` — verify general settings updated
5. Send `GET /api/v1/backoffice/workspace/settings/audit` — verify audit entry exists

Expected:

- Step 2: HTTP 200, `config_version` incremented
- Step 4: General settings reflect new values
- Step 5: Audit entry shows `group: "general"`, `changes` array with old/new values

Troubleshooting:

- 422 → Validation failed. Check timezone is valid IANA, date_format is allowed enum.
- 409 → Version conflict. Someone else updated settings. Re-fetch and retry.

### Scenario 3 — Version Conflict Detection (Edge Case)

**Purpose:** Verify optimistic locking prevents concurrent overwrites.

1. Send `GET /api/v1/backoffice/workspace/settings` — note `config_version` (e.g., 2)
2. Send `PUT /api/v1/backoffice/workspace/settings/general` with `config_version: 2` (succeeds, version → 3)
3. Send another `PUT /api/v1/backoffice/workspace/settings/language` with `config_version: 2` (stale!)

Expected:

- Step 3: HTTP 409 with `{ success: false, error: { code: "SETTINGS_VERSION_CONFLICT", message: "..." } }`

### Scenario 4 — Payment Credential Encryption

**Purpose:** Verify payment credentials are encrypted at rest and never returned in plaintext.

1. Send `PUT /api/v1/backoffice/workspace/settings/payment` with body:
   ```json
   {
     "settings": {
       "payment_enabled": true,
       "provider": "stripe",
       "api_key": "sk_test_abc123",
       "secret_key": "whsec_xyz789",
       "currency": "SAR"
     },
     "config_version": 3
   }
   ```
2. Send `GET /api/v1/backoffice/workspace/settings` — inspect payment group
3. Query the database directly: `SELECT payment_settings FROM workspace_settings`

Expected:

- Step 1: HTTP 200, response shows `has_api_key: true`, `has_secret_key: true` — NO raw keys
- Step 2: GET response never contains `api_key` or `secret_key` values
- Step 3: Database column contains `encrypted_api_key` with `v1:<iv>:<authTag>:<ciphertext>` format

### Scenario 5 — Audit Trail with Cursor Pagination

**Purpose:** Verify audit pagination works correctly with group filter.

1. Make 3 different settings updates (general, language, branding) to create audit entries
2. Send `GET /api/v1/backoffice/workspace/settings/audit?limit=2`
3. Use the `next_cursor` from the response to paginate: `GET /api/v1/backoffice/workspace/settings/audit?limit=2&cursor=<next_cursor>`
4. Filter by group: `GET /api/v1/backoffice/workspace/settings/audit?group=general`

Expected:

- Step 2: Returns 2 entries + `next_cursor` + `has_more: true`
- Step 3: Returns remaining entry(ies) + `has_more: false`
- Step 4: Returns only entries where `group: "general"`

---

## Negative Cases

| Scenario               | Trigger                                                           | Expected Response                                |
| ---------------------- | ----------------------------------------------------------------- | ------------------------------------------------ |
| Invalid settings group | `PUT /settings/invalid_group`                                     | `400 { code: "INVALID_SETTINGS_GROUP" }`         |
| Validation failure     | `PUT /settings/general` with `timezone: "Invalid/Zone"`           | `422 { code: "SETTINGS_VALIDATION_ERROR" }`      |
| Version conflict       | `PUT /settings/general` with stale `config_version`               | `409 { code: "SETTINGS_VERSION_CONFLICT" }`      |
| Missing encryption key | Unset `WORKSPACE_SETTINGS_ENCRYPTION_KEY`, then update payment    | `503 { code: "ENCRYPTION_SERVICE_UNAVAILABLE" }` |
| Unauthorized role      | Access settings as a non-admin user                               | `403` (RBAC enforcement)                         |
| Language consistency   | `default_language: "fr"` with `supported_languages: ["ar", "en"]` | `422` (default must be in supported list)        |

Error responses must follow:

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

---

## Multi-Tenant Isolation Verification

1. Use two workspaces: `workspace-a` and `workspace-b`.
2. Update general settings for `workspace-a` (e.g., `institution_name: "Workspace A University"`).
3. Send `GET /api/v1/backoffice/workspace/settings` using `workspace-b` credentials.
4. Expected: `workspace-b` must NOT see `workspace-a`'s `institution_name`.

If data leakage is observed, stop and report immediately.

---

## Structured Log Verification

```bash
# API logs (pipe through jq for readability)
bun run dev:api | jq .
```

Confirm the presence of:

- `"level"` — info/warn/error
- `"workspace_slug"` — present on all tenant-bound requests
- `"correlation_id"` — present on all requests
- `"event"` — e.g., `workspace_settings_updated`, `workspace_settings_retrieved`, `audit_trail_queried`
- No `console.log` output
- No raw credentials in log output (verify payment update logs show `[REDACTED]`)

---

## Database Verification (Optional)

```bash
# Connect to a tenant database
bun run db:console --workspace <workspace_slug>
```

| Table                      | Verification                                                                                                                         |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `workspace_settings`       | Single row exists per tenant, `singleton_key = 'SETTINGS'`, JSONB columns populated                                                  |
| `workspace_settings_audit` | Entries exist after updates, `changed_by` populated, `changes` JSONB has old/new values, immutability trigger prevents DELETE/UPDATE |

To test audit immutability:

```sql
-- This should FAIL with an exception
DELETE FROM workspace_settings_audit WHERE id = '<any_id>';
-- Expected: ERROR: Audit records are immutable
```

---

## Sign-Off Checklist

- [ ] All 140 automated tests pass (124 unit + 16 integration)
- [ ] TypeScript type-check passes (0 errors)
- [ ] ESLint passes (0 errors)
- [ ] Manual scenarios 1–5 pass
- [ ] Negative cases return correct error contract
- [ ] Multi-tenant isolation confirmed
- [ ] No `console.log` or stack traces exposed
- [ ] Logs include `workspace_slug` and `correlation_id`
- [ ] Payment credentials never appear in plaintext in responses or logs
- [ ] Audit immutability trigger prevents DELETE/UPDATE

---

## References

- `specs/runtime/018-workspace-settings/reports/IMPLEMENT_REPORT.md`
- `specs/runtime/018-workspace-settings/reports/PLAN_REPORT.md`
- `specs/runtime/018-workspace-settings/audits/VALIDATION_REPORT.md`
- `specs/runtime/018-workspace-settings/audits/ANALYZE_REPORT.md`

---

Generated by Zidney Orchestrator Hard Mode v1.2.0.
