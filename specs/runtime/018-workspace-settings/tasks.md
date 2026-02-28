# Tasks: Workspace Settings

**Branch**: `018-workspace-settings` | **Date**: 2026-02-28  
**Plan**: [plan.md](plan.md) | **Spec**: [spec.md](spec.md) | **Data Model**: [data-model.md](data-model.md)

---

## Stage Context

- **Phase**: Runtime
- **Stage**: 018 — Workspace Settings
- **Related Plan**: `specs/runtime/018-workspace-settings/plan.md`
- **Related Spec**: `specs/runtime/018-workspace-settings/spec.md`
- **Related ADR**: N/A (no new ADR — uses existing patterns)

Tasks must not extend beyond this stage.

---

## Task Summary

| Metric                   | Value    |
| ------------------------ | -------- |
| Total tasks              | 34       |
| Setup tasks              | 3        |
| Foundational tasks       | 6        |
| US7 (Settings Retrieval) | 4        |
| US1 (General Settings)   | 7        |
| US2 (Language Settings)  | 2        |
| US6 (Audit Trail)        | 4        |
| US3 (Branding Settings)  | 2        |
| US4 (Payment Gateway)    | 3        |
| US5 (Security Settings)  | 2        |
| Polish & Integration     | 1        |
| Parallel opportunities   | 10 tasks |

---

## Dependency Graph

```
Phase 1 (Setup)
  │
  v
Phase 2 (Foundational)
  │
  v
Phase 3 (US7: Retrieval) ──────────────────────┐
  │                                              │
  v                                              │
Phase 4 (US1: General + Write Infrastructure) ──┤
  │                                              │
  ├──→ Phase 5 (US2: Language) ─── parallel ─────┤
  │                                              │
  v                                              │
Phase 6 (US6: Audit Retrieval)                   │
  │                                              │
  ├──→ Phase 7 (US3: Branding) ─── parallel ─────┤
  │                                              │
  ├──→ Phase 8 (US4: Payment) ──────────────────┤
  │                                              │
  ├──→ Phase 9 (US5: Security) ─── parallel ─────┤
  │                                              │
  v                                              │
Phase 10 (Polish & Integration) ◄───────────────┘
```

**Parallel Execution Opportunities**:

- Phase 5 (US2) can run in parallel with Phase 7 (US3), Phase 8 (US4), Phase 9 (US5) after Phase 4 completes
- Within phases: tasks marked `[P]` can execute concurrently

---

## Implementation Strategy

1. **MVP Scope**: Phase 1–4 (Setup + Foundational + US7 Retrieval + US1 General Settings with Audit). This delivers a working read/write cycle for one settings group with audit trail.
2. **Incremental Delivery**: Each subsequent phase adds validation coverage and testing for additional settings groups. No new infrastructure files are created after Phase 6.
3. **Risk Mitigation**: Encryption service and migration are completed in Phase 2 (Foundational) to surface any integration issues early.

---

## Phase 1: Setup

**Goal**: Establish module directory structure, TypeScript type definitions, and error hierarchy.

- [ ] T001 Create module directory structure at `apps/api/src/modules/workspace-settings/`

- [ ] T002 [P] Define TypeScript interfaces and type aliases in `apps/api/src/modules/workspace-settings/workspace-settings.types.ts`
  - `GeneralSettings`, `LanguageSettings`, `BrandingSettings`, `PaymentSettings`, `SecuritySettings`
  - `WorkspaceSettings` (aggregate with `config_version`, `updated_at`)
  - `WorkspaceSettingsResponse` (payment credentials replaced with `has_api_key`, `has_secret_key` booleans)
  - `UpdateSettingsRequest` (group settings + `config_version`)
  - `AuditDiffEntry` (`{ field, old_value, new_value }`)
  - `WorkspaceSettingsAuditEntry` (audit record shape)
  - `SettingsGroup` union type: `'general' | 'language' | 'branding' | 'payment' | 'security'`
  - `PasswordPolicy` (future-ready structure)
  - `EmailTemplateBranding`, `CertificateTemplateBranding`, `SeoMetadata` (nested branding types)

- [ ] T003 [P] Define custom error classes in `apps/api/src/modules/workspace-settings/workspace-settings.errors.ts`
  - `SettingsValidationError` → HTTP 422, code `SETTINGS_VALIDATION_FAILED`
  - `SettingsVersionConflictError` → HTTP 409, code `SETTINGS_VERSION_CONFLICT` (includes current `config_version`)
  - `SettingsNotFoundError` → HTTP 404, code `SETTINGS_NOT_FOUND`
  - `EncryptionServiceUnavailableError` → HTTP 503, code `ENCRYPTION_SERVICE_UNAVAILABLE`
  - `InvalidSettingsGroupError` → HTTP 400, code `INVALID_SETTINGS_GROUP`
  - All errors produce `{ success: false, data: null, error: { code, message } }` response shape

---

## Phase 2: Foundational Infrastructure

**Goal**: Build data layer (migration + schema), encryption service, and validation schemas. These are blocking prerequisites for all user stories.

- [ ] T004 Create tenant database migration in `apps/api/src/db/tenant/migrations/20260228_002_workspace_settings_jsonb.ts`
  - ALTER `workspace_settings` table: add `singleton_key VARCHAR(10) NOT NULL DEFAULT 'SETTINGS'` with CHECK (`singleton_key = 'SETTINGS'`) and UNIQUE constraint
  - ADD `config_version INTEGER NOT NULL DEFAULT 1`
  - ADD `general_settings JSONB NOT NULL DEFAULT '{}'::jsonb`
  - ADD `language_settings JSONB NOT NULL DEFAULT '{}'::jsonb`
  - ADD `branding_settings JSONB NOT NULL DEFAULT '{}'::jsonb`
  - ADD `payment_settings JSONB NOT NULL DEFAULT '{}'::jsonb`
  - ADD `security_settings JSONB NOT NULL DEFAULT '{}'::jsonb`
  - Migrate existing flat column values into JSONB structure (organization_name → general_settings.app_name, timezone → general_settings.timezone, default_language → language_settings.default_language, session_timeout_minutes → general_settings.session_timeout_minutes)
  - CREATE TABLE `workspace_settings_audit` with columns: `id UUID`, `workspace_id UUID`, `user_id UUID`, `settings_group VARCHAR(30)`, `config_version INTEGER`, `changes JSONB`, `request_id VARCHAR(50)`, `ip_address INET`, `user_agent TEXT`, `created_at TIMESTAMP`
  - CREATE indexes: `idx_wsa_workspace_id`, `idx_wsa_created_at`, `idx_wsa_settings_group`, `idx_wsa_config_version`
  - DROP old singleton trigger (replaced by CHECK + UNIQUE)
  - Forward-only: no columns dropped from workspace_settings
  - Entire migration wrapped in transaction

- [ ] T005 Create Drizzle ORM schema in `apps/api/src/db/tenant/schemas/workspace-settings.schema.ts`
  - `workspaceSettings` pgTable definition matching migration DDL (JSONB columns typed as `jsonb()`)
  - `workspaceSettingsAudit` pgTable definition for audit table
  - Include `singleton_key`, `config_version`, all 5 JSONB columns, timestamps
  - Export both table definitions
  - Register schema exports in tenant schema barrel file (if one exists)

- [ ] T006 [P] Implement encryption service in `apps/api/src/modules/workspace-settings/encryption.service.ts`
  - `encrypt(plaintext: string): string` — AES-256-GCM, returns `v1:<base64_iv>:<base64_authTag>:<base64_ciphertext>`
  - `decrypt(encryptedValue: string): string` — Parses format string, decrypts with matching key version
  - Key loaded from `process.env.WORKSPACE_SETTINGS_ENCRYPTION_KEY` (32-byte hex string → 256-bit key)
  - 12-byte random IV per encryption (never reused)
  - Key identifier `v1` prefix per CL-005 for future rotation support
  - Throws `EncryptionServiceUnavailableError` if key missing or empty
  - Throws on malformed encrypted value format during decrypt
  - No third-party dependencies — uses Node.js/Bun `crypto` module

- [ ] T007 [P] Create Zod validation schemas in `apps/api/src/modules/workspace-settings/workspace-settings.validation.ts`
  - `generalSettingsSchema`: `app_name` (string, 1–255 chars, required), `timezone` (IANA validated via `Intl.supportedValuesOf('timeZone')`, required), `date_format` (enum: `YYYY-MM-DD | DD/MM/YYYY | MM/DD/YYYY | DD-MM-YYYY | DD.MM.YYYY`, required), `session_timeout_minutes` (integer, 5–480, optional)
  - `languageSettingsSchema`: `default_language` (ISO 639-1, required), `supported_languages` (non-empty string array, required). Cross-field refinement: `default_language` MUST exist in `supported_languages`
  - `brandingSettingsSchema`: `logo_url` (URL or null, optional), `favicon_url` (URL or null, optional), `primary_color` (hex regex `/^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/`, optional), `secondary_color` (hex, optional), `email_template_branding` (nested object, optional), `certificate_template_branding` (nested object, optional), `seo_metadata` (nested: title max 60, description max 160, og_image_url URL, optional)
  - `paymentSettingsSchema`: `use_custom_payment_gateway` (boolean, required), `gateway_provider` (string or null, optional), `api_key` (string or null, optional — sentinel semantics), `secret_key` (string or null, optional — sentinel semantics)
  - `securitySettingsSchema`: `analytics_opt_in` (boolean, optional), `max_login_attempts` (integer 1–20, optional), `lockout_duration_minutes` (integer 1–1440, optional), `password_policy` (future-ready nested object, optional)
  - `updateSettingsRequestSchema`: wraps `config_version` (positive integer, required) + `settings` (validated per group)
  - `settingsGroupSchema`: Zod enum for valid group names
  - `auditQuerySchema`: `group` (optional enum), `limit` (integer 1–100, default 20), `cursor` (optional string)
  - Cache IANA timezone list at module load for performance

- [ ] T008 [P] Write encryption service unit tests in `tests/unit/encryption-service.test.ts`
  - Test scenarios: encrypt/decrypt roundtrip produces original plaintext, different plaintexts produce different ciphertexts, each encryption produces unique IV (encrypt same value twice → different output), output format matches `v1:<iv>:<authTag>:<ciphertext>`, decrypt rejects malformed format strings, encrypt throws `EncryptionServiceUnavailableError` when key is missing, decrypt throws on incorrect key, handles empty string input, handles long string input

- [ ] T009 [P] Write validation schema unit tests in `tests/unit/workspace-settings-validation.test.ts`
  - Test all 5 schemas with valid inputs (happy path)
  - Test required field missing → rejection with field-level error
  - Test invalid timezone string → rejection
  - Test valid IANA timezones (Asia/Riyadh, America/New_York, UTC)
  - Test date_format enum boundaries (valid values pass, invalid rejected)
  - Test session_timeout_minutes bounds (4 rejected, 5 accepted, 480 accepted, 481 rejected)
  - Test app_name length bounds (empty rejected, 255 chars accepted, 256 rejected)
  - Test hex color format (valid #1E40AF and #1E40AF80 accepted, invalid #GGG rejected)
  - Test URL validation for branding URLs
  - Test updateSettingsRequestSchema requires config_version
  - Test settingsGroupSchema accepts valid groups, rejects invalid

---

## Phase 3: US7 — Settings Retrieval with Defaults and Fallback (P1)

**Story Goal**: System retrieves workspace settings with sensible defaults for unconfigured optional fields and never exposes payment credentials.

**Independent Test Criteria**: Load settings from partially configured workspace → verify defaults applied for missing optional fields, payment credentials replaced with boolean sentinels, critical missing fields produce error not silent fallback.

- [ ] T010 [US7] Implement `getSettings` in `apps/api/src/modules/workspace-settings/workspace-settings.repository.ts`
  - SELECT from `workspace_settings` WHERE `singleton_key = 'SETTINGS'`
  - Return raw row or `null` if no settings row exists
  - Uses tenant DB pool from request context (no direct DB instantiation)
  - No transaction needed for read-only operation

- [ ] T011 [US7] Implement `getWorkspaceSettings` in `apps/api/src/modules/workspace-settings/workspace-settings.service.ts`
  - Call `repository.getSettings(db)`
  - If `null`: throw `SettingsNotFoundError`
  - Apply defaults for missing optional fields:
    - `general_settings.session_timeout_minutes` → `30`
    - `security_settings.analytics_opt_in` → `false`
    - `security_settings.max_login_attempts` → `5`
    - `security_settings.lockout_duration_minutes` → `15`
  - Strip payment credentials: replace `encrypted_api_key` / `encrypted_secret_key` with `has_api_key: boolean` and `has_secret_key: boolean`
  - Validate critical fields (timezone, date_format) — if corrupted, throw structured error rather than serving bad data
  - Return `WorkspaceSettingsResponse` shape with `config_version` and `updated_at`
  - Log with structured logger: `workspace_slug`, `correlation_id`

- [ ] T012 [US7] Create GET `/api/v1/backoffice/workspace/settings` route in `apps/api/src/modules/workspace-settings/workspace-settings.routes.ts`
  - Hono route definition
  - Calls `service.getWorkspaceSettings(ctx)`
  - Returns `{ success: true, data: WorkspaceSettingsResponse, error: null }`
  - Error responses follow standard format (404 for not found)
  - Middleware chain: correlation ID → tenant resolver → license enforcement → schema version → rate limiting → auth (JWT) → RBAC (institution admin)

- [ ] T013 [US7] Register workspace-settings routes in `apps/api/src/routes/backoffice/settings.ts`
  - Import workspace-settings route module
  - Mount under backoffice route group
  - Ensure full middleware chain is applied (tenant resolver, license, auth, RBAC)
  - Verify route prefix alignment with API contract base path

---

## Phase 4: US1 — Configure General Workspace Settings (P1)

**Story Goal**: Institution admin can update general settings (app_name, timezone, date_format, session_timeout), with config_version incremented and audit trail created on every update.

**Independent Test Criteria**: Save general settings → verify persistence, config_version increment, audit entry creation. Submit invalid timezone → verify 422 rejection. Submit stale config_version → verify 409 conflict.

- [ ] T014 [US1] Implement `computeSettingsDiff` utility function in `apps/api/src/modules/workspace-settings/workspace-settings.service.ts`
  - Signature: `computeSettingsDiff(group: string, oldValues: Record<string, unknown>, newValues: Record<string, unknown>, redactedFields: string[]): AuditDiffEntry[]`
  - Compare old and new JSONB objects field-by-field (shallow diff, array-aware)
  - Return array of `{ field, old_value, new_value }` for changed fields only
  - Redact fields in `redactedFields` list: record `[REDACTED]` for both old and new values
  - Handle null → value, value → null, and value → value transitions
  - Handle array comparison for `supported_languages` (detect additions/removals)
  - Export function for independent testing

- [ ] T015 [US1] Implement `upsertSettings` in `apps/api/src/modules/workspace-settings/workspace-settings.repository.ts`
  - Conditional UPDATE: `SET <group>_settings = :data, config_version = :expected + 1, updated_at = now() WHERE singleton_key = 'SETTINGS' AND config_version = :expected`
  - Check `rowCount`: if 0 and no row exists → INSERT with `config_version = 1` and defaults for other groups
  - Check `rowCount`: if 0 and row exists → throw `SettingsVersionConflictError` with current version
  - Return `{ config_version: number }` (the new version)
  - All operations within caller-provided transaction
  - Uses Drizzle `and(eq(...), eq(...))` for conditional WHERE

- [ ] T016 [US1] Implement `insertAuditEntry` in `apps/api/src/modules/workspace-settings/workspace-settings.repository.ts`
  - INSERT into `workspace_settings_audit` table
  - Fields: `workspace_id`, `user_id`, `settings_group`, `config_version`, `changes` (JSONB diff), `request_id`, `ip_address`, `user_agent`, `created_at = now()`
  - Immutable: no UPDATE or DELETE operations on audit table
  - Within caller-provided transaction (same transaction as upsert)

- [ ] T017 [US1] Implement `updateSettingsGroup` in `apps/api/src/modules/workspace-settings/workspace-settings.service.ts`
  - Validate input against appropriate Zod schema based on `group` parameter
  - If validation fails → throw `SettingsValidationError` with field-level details
  - If `group === 'payment'` and credentials provided → encrypt via encryption service (FR-017, FR-021)
  - Apply sentinel pattern for payment credentials (CL-003): omit → keep, null → clear, string → encrypt & replace
  - Open database transaction
  - Load current settings within transaction
  - Compute diff (old vs. new) with credential redaction for payment fields
  - Call `repository.upsertSettings(db, group, data, expectedVersion)` — handles optimistic locking
  - Call `repository.insertAuditEntry(db, auditEntry)` — audit within same transaction
  - Commit transaction
  - Log settings update with structured logger: `workspace_slug`, `correlation_id`, `settings_group`, `config_version`
  - Return `{ config_version, updated_group, updated_at }`

- [ ] T018 [US1] Create PUT `/api/v1/backoffice/workspace/settings/:group` route in `apps/api/src/modules/workspace-settings/workspace-settings.routes.ts`
  - Validate `:group` path parameter against `settingsGroupSchema` → 400 `INVALID_SETTINGS_GROUP` if invalid
  - Parse request body with `updateSettingsRequestSchema`
  - Call `service.updateSettingsGroup(ctx, group, settings, configVersion)`
  - Return `{ success: true, data: { config_version, updated_group, updated_at }, error: null }`
  - Error mapping: `SettingsValidationError` → 422, `SettingsVersionConflictError` → 409, `EncryptionServiceUnavailableError` → 503
  - Middleware chain: correlation ID → tenant resolver → license → schema version → rate limiting → auth → RBAC

- [ ] T019 [US1] Write audit diff unit tests in `tests/unit/audit-diff.test.ts`
  - Test: changed fields detected, unchanged excluded
  - Test: payment credential fields redacted to `[REDACTED]`
  - Test: null → value transition recorded
  - Test: value → null transition recorded
  - Test: array changes detected (supported_languages add/remove)
  - Test: nested object changes detected (seo_metadata, email_template_branding)
  - Test: empty diff when old === new
  - Test: only redacted fields changed → diff contains `[REDACTED]` entries

- [ ] T020 [US1] Write service unit tests for general settings in `tests/unit/workspace-settings-service.test.ts`
  - Test: `getWorkspaceSettings` returns settings with defaults applied
  - Test: `getWorkspaceSettings` strips payment credentials, returns `has_api_key`/`has_secret_key` booleans
  - Test: `getWorkspaceSettings` throws `SettingsNotFoundError` when no row exists
  - Test: `updateSettingsGroup('general', ...)` validates, updates, creates audit entry
  - Test: `updateSettingsGroup` increments `config_version`
  - Test: `updateSettingsGroup` throws `SettingsVersionConflictError` on version mismatch
  - Test: `updateSettingsGroup` throws `SettingsValidationError` on invalid input
  - Test: `updateSettingsGroup` wraps upsert + audit in single transaction
  - Test: first-time settings save creates row with `config_version = 1`

---

## Phase 5: US2 — Manage Language Settings (P1)

**Story Goal**: Institution admin configures default language and supported languages. Default language cannot be removed from supported list. Removing a language does not delete existing translations.

**Independent Test Criteria**: Set default_language = "ar", supported = ["ar", "en"] → verify persistence. Attempt to remove "ar" from supported → verify rejection. Remove "fr" → verify existing translations unaffected.

- [ ] T021 [US2] Add language cross-field validation test cases in `tests/unit/workspace-settings-validation.test.ts`
  - Test: `default_language` in `supported_languages` → accepted
  - Test: `default_language` NOT in `supported_languages` → rejected with clear error
  - Test: empty `supported_languages` array → rejected
  - Test: `supported_languages` with duplicates → handled (deduplicated or rejected)
  - Test: valid ISO 639-1 codes accepted ("ar", "en", "fr", "es")
  - Test: adding new language to supported list → accepted

- [ ] T022 [US2] Add service language update test scenarios in `tests/unit/workspace-settings-service.test.ts`
  - Test: update language settings with valid default and supported → succeeds, audit created
  - Test: attempt to remove default_language from supported → 422 validation error
  - Test: removing non-default language does not trigger translation deletion (service does not call translation delete)
  - Test: adding new language to supported triggers config_version increment

---

## Phase 6: US6 — Audit Trail for All Settings Changes (P1)

**Story Goal**: Every settings update creates an immutable audit entry. Audit entries never contain credential data. Audit trail is queryable with cursor-based pagination.

**Independent Test Criteria**: Perform a settings update → verify audit entry contains user_id, workspace_id, changed fields, timestamp, request_id. Update payment credentials → verify audit entry contains `[REDACTED]`. Query audit with cursor → verify pagination.

- [ ] T023 [US6] Implement `getAuditEntries` with cursor-based pagination in `apps/api/src/modules/workspace-settings/workspace-settings.repository.ts`
  - Cursor: composite `(created_at, id)` — decode from opaque base64 cursor string
  - Filters: `settings_group` (optional), workspace scoped
  - Pagination: `limit` (default 20, max 100)
  - Order: `created_at DESC, id DESC`
  - Return `{ items: AuditEntry[], nextCursor: string | null }`
  - `nextCursor` is `null` when no more pages

- [ ] T024 [US6] Implement `getSettingsAudit` in `apps/api/src/modules/workspace-settings/workspace-settings.service.ts`
  - Validate query params with `auditQuerySchema`
  - Call `repository.getAuditEntries(db, filters)`
  - Return paginated audit entries
  - Log with structured logger: `workspace_slug`, `correlation_id`

- [ ] T025 [US6] Create GET `/api/v1/backoffice/workspace/settings/audit` route in `apps/api/src/modules/workspace-settings/workspace-settings.routes.ts`
  - Parse query params: `group` (optional), `limit` (optional, default 20), `cursor` (optional)
  - Call `service.getSettingsAudit(ctx, filters)`
  - Return `{ success: true, data: { items, nextCursor }, error: null }`
  - Middleware chain: correlation ID → tenant resolver → license → schema version → rate limiting → auth → RBAC

- [ ] T026 [US6] Add audit-specific service test cases in `tests/unit/workspace-settings-service.test.ts`
  - Test: every `updateSettingsGroup` call produces exactly one audit entry
  - Test: audit entry contains correct `user_id`, `workspace_id`, `settings_group`, `config_version`, `request_id`
  - Test: audit entry `changes` contains structured diff with field names + old/new values
  - Test: payment credential update audit does NOT contain raw or encrypted values (only `[REDACTED]`)
  - Test: `getSettingsAudit` returns paginated results with valid cursor
  - Test: `getSettingsAudit` with `group` filter returns only matching entries

---

## Phase 7: US3 — Update Branding Settings (P2)

**Story Goal**: Institution admin customizes visual identity (logo, favicon, colors, SEO metadata). Branding is visual-only and never influences business logic.

**Independent Test Criteria**: Save branding settings with valid logo_url and hex colors → verify persistence. Submit invalid hex color → verify 422 rejection. Verify branding values never affect grading, permissions, or licensing behavior.

- [ ] T027 [P] [US3] Add branding validation test cases in `tests/unit/workspace-settings-validation.test.ts`
  - Test: valid hex colors (#1E40AF, #9333EA, #1E40AF80) → accepted
  - Test: invalid color values (#GGG, rgb(1,2,3), "blue") → rejected
  - Test: valid URLs for logo_url, favicon_url → accepted
  - Test: invalid URLs → rejected
  - Test: seo_metadata title > 60 chars → rejected
  - Test: seo_metadata description > 160 chars → rejected
  - Test: nested email_template_branding and certificate_template_branding validated
  - Test: all fields optional (empty branding settings object → accepted)

- [ ] T028 [P] [US3] Add service branding test scenarios in `tests/unit/workspace-settings-service.test.ts`
  - Test: branding update persists values and increments config_version
  - Test: branding update creates audit entry with correct diff
  - Test: partial branding update (only logo_url) → other fields preserved

---

## Phase 8: US4 — Configure Payment Gateway Credentials (P2)

**Story Goal**: Institution admin configures payment gateway with credentials encrypted at rest. Credentials never returned in API responses or logged in audit entries. Encryption failure prevents persistence of plaintext credentials.

**Independent Test Criteria**: Save payment credentials → verify encrypted at rest, never in GET response, never in audit. Disable gateway → verify reflected. Encryption service unavailable → verify 503 error, no plaintext stored.

- [ ] T029 [US4] Add payment sentinel validation test cases in `tests/unit/workspace-settings-validation.test.ts`
  - Test: `use_custom_payment_gateway = true` with provider → accepted
  - Test: `api_key` as string → accepted (will be encrypted by service)
  - Test: `api_key` as null → accepted (clear credential)
  - Test: `api_key` omitted → accepted (keep existing)
  - Test: `secret_key` same sentinel semantics as `api_key`
  - Test: `use_custom_payment_gateway = false` → accepted regardless of credentials

- [ ] T030 [US4] Add service encryption integration tests in `tests/unit/workspace-settings-service.test.ts`
  - Test: `updateSettingsGroup('payment', ...)` with new `api_key` string → encrypt called, encrypted value stored
  - Test: `updateSettingsGroup('payment', ...)` with `api_key = null` → credential cleared in DB
  - Test: `updateSettingsGroup('payment', ...)` with `api_key` omitted → existing encrypted value preserved
  - Test: encryption service unavailable → `EncryptionServiceUnavailableError` thrown, no plaintext persisted
  - Test: `getWorkspaceSettings` NEVER returns `encrypted_api_key` or `encrypted_secret_key` — returns `has_api_key`/`has_secret_key` booleans only

- [ ] T031 [US4] Add credential non-exposure tests in `tests/unit/workspace-settings-service.test.ts`
  - Test: audit entry for payment update contains `[REDACTED]` for credential fields, never actual values
  - Test: structured log output for payment update does NOT contain credential values
  - Test: response from payment update does NOT contain credential values

---

## Phase 9: US5 — Manage Security Settings (P3)

**Story Goal**: Institution admin configures security policies. Analytics opt-in defaults to false. Password policy accepted but not enforced (future-ready).

**Independent Test Criteria**: Load security settings without explicit configuration → verify analytics_opt_in = false by default. Save max_login_attempts and lockout_duration → verify persistence. Submit password_policy → verify accepted and persisted without enforcement.

- [ ] T032 [P] [US5] Add security validation test cases in `tests/unit/workspace-settings-validation.test.ts`
  - Test: `analytics_opt_in` defaults to `false` when not provided
  - Test: `max_login_attempts` bounds (0 rejected, 1 accepted, 20 accepted, 21 rejected)
  - Test: `lockout_duration_minutes` bounds (0 rejected, 1 accepted, 1440 accepted, 1441 rejected)
  - Test: `password_policy` nested object accepted with valid fields
  - Test: `password_policy` as null → accepted
  - Test: empty security settings object → accepted (all fields optional)

- [ ] T033 [P] [US5] Add service security settings test scenarios in `tests/unit/workspace-settings-service.test.ts`
  - Test: `getWorkspaceSettings` applies security defaults (analytics_opt_in = false, max_login_attempts = 5, lockout_duration_minutes = 15)
  - Test: `updateSettingsGroup('security', ...)` persists values and increments config_version
  - Test: explicit `analytics_opt_in = true` → saved and audit records opt-in activation

---

## Phase 10: Polish & Cross-Cutting Concerns

**Goal**: Full integration test coverage validating end-to-end API flow, middleware enforcement, and cross-cutting concerns.

- [ ] T034 Write integration tests for full API flow in `tests/integration/workspace-settings-api.test.ts`
  - Test: GET /settings returns 200 with defaults when settings exist
  - Test: GET /settings returns 404 when no settings row
  - Test: PUT /settings/general with valid data → 200 with incremented config_version
  - Test: PUT /settings/general with stale config_version → 409 conflict with current version
  - Test: PUT /settings/general with invalid timezone → 422 validation error
  - Test: PUT /settings/language with default_language not in supported → 422
  - Test: PUT /settings/payment → credentials never in response body
  - Test: PUT /settings/payment → credentials never in GET response
  - Test: PUT /settings/invalid_group → 400 INVALID_SETTINGS_GROUP
  - Test: GET /settings/audit returns paginated audit entries
  - Test: GET /settings/audit?group=general filters by group
  - Test: GET /settings/audit pagination with cursor works correctly
  - Test: Request without JWT → 401 from auth middleware
  - Test: Request with soft-locked license → 423 from license middleware
  - Test: Request with non-admin role → 403 from RBAC middleware
  - Test: Concurrent updates — one succeeds, other gets 409
  - Test: Tenant isolation — settings from tenant A not accessible to tenant B

---

## Completion Checklist

Before marking this stage complete, verify:

- [ ] All write operations (PUT /settings/:group) wrapped in database transaction
- [ ] Optimistic locking enforced via config_version on every update
- [ ] Tenant isolation preserved — all DB access through tenant resolver context
- [ ] License enforcement middleware active on all routes
- [ ] Authentication (JWT) + RBAC (institution admin) enforced on all routes
- [ ] Encrypted payment credentials never exposed in responses, logs, or audit
- [ ] Encryption service failure prevents plaintext credential storage
- [ ] Audit trail created for every settings update (100% coverage)
- [ ] All validation errors return HTTP 422 with field-level details
- [ ] Version conflicts return HTTP 409 with current config_version
- [ ] Structured logging with correlation_id + workspace_slug on all operations
- [ ] No console.log statements — Pino logger only
- [ ] Forward-only migration — no columns dropped
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] Lint passes
- [ ] Type check passes

---

## Non-Goals Confirmation

This stage does NOT:

- Implement Backoffice UI for workspace settings (separate stage)
- Implement Frontoffice settings consumption (separate stage)
- Implement encryption key rotation (deferred per CL-005)
- Implement per-tenant in-memory caching (future optimization per FR-032)
- Implement translation coverage recalculation worker (separate stage per FR-012)
- Enforce password_policy rules at login (future-ready structure only per FR-024)
- Drop legacy flat columns from workspace_settings (future migration)
- Implement cross-workspace analytics aggregation (depends on analytics_opt_in per FR-023)
