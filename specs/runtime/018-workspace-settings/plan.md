# Implementation Plan: Workspace Settings

**Branch**: `018-workspace-settings` | **Date**: 2026-02-28 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `specs/runtime/018-workspace-settings/spec.md`

---

## Summary

Implement a tenant-level workspace configuration system with a single-row settings table using five JSONB columns (general, language, branding, payment, security), optimistic locking via `config_version`, immutable audit logging with full diff, encrypted payment credentials (AES-256-GCM), and group-level PUT API with standard Zidney middleware enforcement. All data lives exclusively in the tenant database. No worker is needed — all operations are synchronous CRUD.

---

## Technical Context

**Language/Version**: TypeScript (Bun runtime)  
**Primary Dependencies**: Hono (HTTP), Drizzle ORM (PostgreSQL), Zod (validation), Pino (logging), Node.js `crypto` (AES-256-GCM)  
**Storage**: PostgreSQL (tenant database, database-per-tenant model)  
**Testing**: Vitest (unit + integration)  
**Target Platform**: Linux server (Docker)  
**Project Type**: Web service (API layer)  
**Performance Goals**: Settings retrieval < 50ms p95 (SC-005)  
**Constraints**: Single-row table, optimistic locking, encrypted credentials never exposed, full audit trail  
**Scale/Scope**: Per-tenant single-row — negligible storage. Audit log grows linearly with settings changes.

---

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| #   | Constitution Principle               | Status | Evidence                                                                                                                                                    |
| --- | ------------------------------------ | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Database-per-tenant isolation**    | PASS   | All tables in tenant DB only. No master DB access. Tenant resolver middleware required.                                                                     |
| 2   | **Middleware authority**             | PASS   | All routes pass through correlation ID → tenant resolver → license enforcement → schema version enforcement → rate limiting → auth → RBAC middleware chain. |
| 3   | **License enforcement**              | PASS   | License middleware validates status before any settings access (FR-033).                                                                                    |
| 4   | **Snapshot-based attempt integrity** | N/A    | Workspace settings is not attempt-related. No attempt engine interaction.                                                                                   |
| 5   | **Versioned evolution**              | PASS   | Schema change via forward-only migration. `config_version` tracks settings evolution.                                                                       |
| 6   | **Runtime authoritative time**       | PASS   | `updated_at` and audit `created_at` use server time (`now()` in PostgreSQL). No client timestamps trusted.                                                  |
| 7   | **Deterministic worker**             | N/A    | No worker needed for settings CRUD.                                                                                                                         |
| 8   | **Concurrency guarantees**           | PASS   | Optimistic locking via `config_version` (CL-001). HTTP 409 on conflict.                                                                                     |
| 9   | **Strict separation of layers**      | PASS   | Repository → Service → Route layer separation. No framework logic in domain. Validation in shared package.                                                  |
| 10  | **Security baseline**                | PASS   | JWT + RBAC required. Structured logging. Correlation ID. Input validation via Zod. No secrets in code. Credentials encrypted at rest.                       |
| 11  | **Operational integrity**            | PASS   | All writes in transactions. Audit is immutable. Standard error format. correlation_id + workspace_slug in all logs.                                         |
| 12  | **AI behavioral contract**           | PASS   | No cross-tenant access. No middleware bypass. No direct DB instantiation. Transaction boundaries respected.                                                 |
| 13  | **Change governance**                | PASS   | Plan generated via SpecKit workflow. Spec reviewed and clarified.                                                                                           |

### Post-Design Re-Check

| #   | Concern                                          | Status                                                                                                             |
| --- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| 1   | Migration modifies existing table (baseline_004) | PASS — Forward-only ALTERs. No columns dropped. Old trigger replaced with stronger CHECK + UNIQUE.                 |
| 2   | New audit table in tenant DB                     | PASS — Separate from auth audit_logs. Maintains tenant isolation.                                                  |
| 3   | Encryption key management                        | PASS — Key from environment/secrets only. Key ID stored with ciphertext for future rotation (CL-005). Never in DB. |
| 4   | Payment credential sentinel pattern              | PASS — Omit/null/string semantics prevent credential exposure (CL-003).                                            |

---

## Project Structure

### Documentation (this feature)

```text
specs/runtime/018-workspace-settings/
├── plan.md                      # This file
├── spec.md                      # Feature specification
├── research.md                  # Phase 0 research output
├── data-model.md                # Phase 1 data model output
├── contracts/
│   └── api-contract.md          # API contract definition
└── tasks.md                     # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
apps/api/src/
├── db/tenant/migrations/
│   └── 20260228_002_workspace_settings_jsonb.ts    # Migration file
├── db/tenant/schemas/
│   └── workspace-settings.schema.ts                # Drizzle ORM schema
├── modules/workspace-settings/
│   ├── workspace-settings.validation.ts            # Zod schemas (all 5 groups)
│   ├── workspace-settings.repository.ts            # Database access layer
│   ├── workspace-settings.service.ts               # Business logic + audit + encryption
│   ├── workspace-settings.routes.ts                # Hono route definitions
│   ├── workspace-settings.types.ts                 # TypeScript interfaces
│   ├── workspace-settings.errors.ts                # Error code constants
│   └── encryption.service.ts                       # AES-256-GCM encryption/decryption
└── routes/backoffice/
    └── settings.ts                                 # Route registration (imports module routes)

packages/validation/src/
└── workspace-settings/
    └── index.ts                                    # Shared validation schemas (if needed cross-app)

tests/
├── unit/
│   ├── workspace-settings-validation.test.ts       # Zod schema tests
│   ├── workspace-settings-service.test.ts          # Service logic tests
│   ├── encryption-service.test.ts                  # Encryption tests
│   └── audit-diff.test.ts                          # Diff generation tests
├── integration/
│   └── workspace-settings-api.test.ts              # Full API flow tests
└── contract/
    └── workspace-settings-contract.test.ts         # API contract verification
```

**Structure Decision**: Module-based layout inside `apps/api/src/modules/workspace-settings/`. This follows the emerging pattern in the codebase where feature-specific logic is co-located (similar to `modules/attempt/`, `modules/csrf/`, `modules/schema/`). The Drizzle schema goes in `db/tenant/schemas/` alongside other tenant schemas. Migration goes in the standard tenant migrations directory.

---

## Implementation Layers

### Layer 1: Database Migration

**File**: `apps/api/src/db/tenant/migrations/20260228_002_workspace_settings_jsonb.ts`

- ALTERs existing `workspace_settings` table to add JSONB columns + `config_version` + `singleton_key`
- Creates `workspace_settings_audit` table
- Migrates existing flat column values into JSONB structure
- Replaces trigger-based singleton with CHECK + UNIQUE constraint
- Forward-only: no columns dropped
- Full details in [data-model.md](data-model.md)

### Layer 2: Drizzle Schema

**File**: `apps/api/src/db/tenant/schemas/workspace-settings.schema.ts`

- Drizzle `pgTable` definitions for `workspace_settings` and `workspace_settings_audit`
- JSONB columns typed as `jsonb()` with TypeScript generics
- Matches migration DDL exactly

### Layer 3: Validation (Zod)

**File**: `apps/api/src/modules/workspace-settings/workspace-settings.validation.ts`

Five Zod schemas — one per settings group:

- `generalSettingsSchema` — app_name, timezone (IANA validated), date_format (enum), session_timeout_minutes
- `languageSettingsSchema` — default_language, supported_languages (with cross-field validation: default must be in supported)
- `brandingSettingsSchema` — URLs, hex colors, optional nested objects
- `paymentSettingsSchema` — boolean gateway toggle, provider, sentinel credential handling
- `securitySettingsSchema` — analytics opt-in, login limits, password policy (future-ready)

Plus: `updateSettingsRequestSchema` — wraps group settings with `config_version` (integer, required)

### Layer 4: Encryption Service

**File**: `apps/api/src/modules/workspace-settings/encryption.service.ts`

- `encrypt(plaintext: string): string` — AES-256-GCM → `v1:<iv>:<authTag>:<ciphertext>`
- `decrypt(encryptedValue: string): string` — Parses format, decrypts with matching key version
- Key loaded from `process.env.WORKSPACE_SETTINGS_ENCRYPTION_KEY` (32-byte hex string)
- Throws `EncryptionServiceUnavailableError` if key missing
- Key identifier (`v1`) stored per CL-005 for future key rotation
- 12-byte random IV per encryption (never reused)

### Layer 5: Repository

**File**: `apps/api/src/modules/workspace-settings/workspace-settings.repository.ts`

- `getSettings(db): Promise<WorkspaceSettings | null>` — SELECT with defaults merging
- `upsertSettings(db, group, data, expectedVersion): Promise<{ config_version: number }>`
  - Conditional UPDATE with `WHERE config_version = expected`
  - INSERT if no row exists (auto-init)
  - Returns new `config_version` or throws `VersionConflictError`
- `insertAuditEntry(db, entry): Promise<void>` — Append to audit table
- `getAuditEntries(db, filters): Promise<{ items: AuditEntry[], nextCursor: string | null }>` — Cursor-based paginated query using (created_at, id) composite cursor

All DB access uses the tenant pool from request context. No direct DB instantiation.

### Layer 6: Service

**File**: `apps/api/src/modules/workspace-settings/workspace-settings.service.ts`

- `getWorkspaceSettings(ctx)` — Retrieves settings, applies defaults, strips payment credentials
- `updateSettingsGroup(ctx, group, settings, configVersion)`:
  1. Validate input with Zod schema for the group
  2. If payment group: encrypt new credentials, apply sentinel logic
  3. Load current settings within transaction
  4. Compute diff (old vs. new) with credential redaction
  5. Conditional UPDATE with version check
  6. Insert audit entry
  7. Return new config_version
- `getSettingsAudit(ctx, filters)` — Cursor-based paginated audit retrieval (default limit: 20, max: 100)

All operations wrapped in database transactions. Structured logging with correlation_id + workspace_slug.

### Layer 7: Routes

**File**: `apps/api/src/modules/workspace-settings/workspace-settings.routes.ts`

- `GET /api/v1/backoffice/workspace/settings` — Read all settings
- `PUT /api/v1/backoffice/workspace/settings/:group` — Update specific group
- `GET /api/v1/backoffice/workspace/settings/audit` — Read audit trail

Registered under backoffice routes with full middleware chain:
correlation ID → tenant resolver → license enforcement → schema version enforcement → rate limiting → auth (JWT) → RBAC (institution admin)

Path parameter `:group` validated against allowed enum.

### Layer 8: Error Handling

**File**: `apps/api/src/modules/workspace-settings/workspace-settings.errors.ts`

Custom error classes:

- `SettingsValidationError` → HTTP 422, code `SETTINGS_VALIDATION_FAILED`
- `SettingsVersionConflictError` → HTTP 409, code `SETTINGS_VERSION_CONFLICT`
- `SettingsNotFoundError` → HTTP 404, code `SETTINGS_NOT_FOUND`
- `EncryptionServiceUnavailableError` → HTTP 503, code `ENCRYPTION_SERVICE_UNAVAILABLE`
- `InvalidSettingsGroupError` → HTTP 400, code `INVALID_SETTINGS_GROUP`

All follow standard Zidney error format: `{ success: false, data: null, error: { code, message } }`

---

## Testing Strategy

### Unit Tests

| Test File                               | What It Tests                                                                                                                                                                                                           |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `workspace-settings-validation.test.ts` | All 5 Zod schemas: valid inputs, invalid inputs, edge cases (empty strings, missing required fields, invalid timezone, default_language not in supported_languages, malformed hex colors, credential sentinel handling) |
| `workspace-settings-service.test.ts`    | Business logic: defaults merging, credential stripping from response, diff computation, version conflict handling, encryption integration, audit entry creation                                                         |
| `encryption-service.test.ts`            | Encrypt/decrypt roundtrip, key format parsing, missing key error, different key versions, IV uniqueness                                                                                                                 |
| `audit-diff.test.ts`                    | Diff computation: changed fields detected, unchanged fields excluded, payment fields redacted, array changes (supported_languages), nested object changes                                                               |

### Integration Tests

| Test File                        | What It Tests                                                                                                                                                                                                                                    |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `workspace-settings-api.test.ts` | Full HTTP flow: GET returns defaults, PUT updates group, version increments, 409 on conflict, 422 on validation error, credentials never in response, audit entry created, middleware enforcement (401 without auth, 423 on soft-locked license) |

### Contract Tests

| Test File                             | What It Tests                                                                                          |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `workspace-settings-contract.test.ts` | Response shape matches API contract: field names, types, credential exclusion, error format compliance |

---

## Dependency Map

```
workspace-settings.routes.ts
  └─→ workspace-settings.service.ts
        ├─→ workspace-settings.repository.ts
        │     └─→ Drizzle schema (workspace-settings.schema.ts)
        │           └─→ Tenant DB pool (from request context)
        ├─→ workspace-settings.validation.ts (Zod schemas)
        ├─→ encryption.service.ts
        │     └─→ process.env.WORKSPACE_SETTINGS_ENCRYPTION_KEY
        └─→ workspace-settings.errors.ts
```

No circular dependencies. No cross-app imports. Service depends only on packages (logger, validation) and local module files.

---

## Complexity Tracking

> No constitution violations requiring justification.

| Item                         | Decision                                                       | Rationale                                                                                                         |
| ---------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Dedicated audit table        | New `workspace_settings_audit` instead of reusing `audit_logs` | Existing audit_logs has CHECK constraint for auth events only. Separate table avoids breaking existing migration. |
| Module co-location           | All workspace-settings code in `modules/workspace-settings/`   | Follows existing module pattern (attempt, csrf, schema). Clean boundaries.                                        |
| Singleton enforcement change | Replace trigger with CHECK + UNIQUE                            | Trigger-based singleton is race-prone. CHECK + UNIQUE is deterministic at constraint level.                       |

---

## Artifacts Generated

| Artifact     | Path                                                             | Status                     |
| ------------ | ---------------------------------------------------------------- | -------------------------- |
| Plan         | `specs/runtime/018-workspace-settings/plan.md`                   | Complete                   |
| Research     | `specs/runtime/018-workspace-settings/research.md`               | Complete                   |
| Data Model   | `specs/runtime/018-workspace-settings/data-model.md`             | Complete                   |
| API Contract | `specs/runtime/018-workspace-settings/contracts/api-contract.md` | Complete                   |
| Tasks        | `specs/runtime/018-workspace-settings/tasks.md`                  | Pending (`/speckit.tasks`) |
