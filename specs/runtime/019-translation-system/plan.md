# Implementation Plan: Translation System

**Branch**: `019-translation-system` | **Date**: 2026-03-01 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/runtime/019-translation-system/spec.md`

---

## Summary

Implement a tenant-scoped, entity-level translation system that stores translated field values for
non-default languages, resolves entity content with deterministic fallback to the default language,
tracks coverage per entity type and language, and provides a full audit trail for all translation
changes. The implementation introduces two new tenant DB tables (`translations`,
`translation_audit_logs`), a domain-core translation service package, four new API endpoints under
the backoffice route group, and one new worker job for async language drainage. Schema bumps from
`1.1.0` to `1.2.0` (MINOR, additive per ADR-0008).

## Technical Context

**Language/Version**: TypeScript 5.x (Bun runtime for API and Worker) **Primary Dependencies**:
Drizzle ORM (pg adapter), Hono (API routing), ioredis (coverage cache), @zidney/domain-core,
@zidney/logger, @zidney/types **Storage**: PostgreSQL (tenant DB per workspace), Redis (optional
coverage cache, tenant-scoped keys) **Testing**: Vitest (unit + integration), existing test
infrastructure in `/tests/` **Target Platform**: Linux server (Bun runtime) **Project Type**: SaaS
multi-tenant web service **Performance Goals**: Translation resolution ≤ 50ms p95 per entity; batch
load in single DB round-trip (SC-002, SC-003); 5M rows per tenant within indexed 50ms target
(SC-007) **Constraints**: No cross-tenant access; all writes transactional; audit log in same tx as
write; server-authoritative timestamps; no FK cascades; no business logic in route handlers
**Scale/Scope**: Up to 5M translation rows per tenant; up to 100 entities per batch load; up to 50
items per batch upsert

## Constitution Check

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design._

| Rule                         | Status | Notes                                                                                                           |
| ---------------------------- | ------ | --------------------------------------------------------------------------------------------------------------- |
| Database-per-tenant          | PASS   | translations and translation_audit_logs created in tenant DB only; no master DB writes                          |
| License middleware mandatory | PASS   | All translation routes inherit backoffice middleware chain: tenantResolver → licenseEnforcement → schemaVersion |
| No cross-tenant joins        | PASS   | All DB access via tenant pool from resolver context; Redis cache keys include workspace_id                      |
| No global DB singleton       | PASS   | Tenant pool retrieved from request context; no module-level pool instantiation                                  |
| Server-authoritative time    | PASS   | updated_at = NOW() in upsert; created_at set at service layer with server time                                  |
| All writes transactional     | PASS   | Upsert + audit log in one transaction; language removal + translation delete in one transaction below threshold |
| Idempotency                  | PASS   | Composite key is the idempotency key; upsert always safe to retry                                               |
| No FK cascade                | PASS   | Entity deletion cleanup is application-layer explicit delete per Q1 clarification                               |
| Import boundary              | PASS   | apps/api to packages/domain-core; no app-to-app imports; no UI-to-DB imports                                    |
| Error response format        | PASS   | All errors: { success: false, data: null, error: { code, message } }                                            |
| Structured logging           | PASS   | @zidney/logger used; includes correlation_id, workspace_id, entity_type, entity_id                              |
| Audit immutability           | PASS   | translation_audit_logs has immutability trigger; append-only                                                    |
| Migration forward-only       | PASS   | down() throws; one migration file for this feature                                                              |
| Stage lifecycle              | PASS   | Spec Status is Draft with all clarifications resolved; requirements.md checklist 100% green                     |

**Post-Design Re-check**: Constitution check passes after Phase 1 data model review. No violations
found.

---

## Project Structure

### Documentation (this feature)

```text
specs/runtime/019-translation-system/
├── plan.md              # This file
├── research.md          # Phase 0 complete
├── data-model.md        # Phase 1 complete
├── contracts/
│   ├── api-endpoints.md
│   └── worker-job-schema.md
└── tasks.md             # Phase 2 output (NOT created by speckit.plan)
```

### Source Code

```text
apps/api/src/
├── db/tenant/
│   ├── schemas/
│   │   ├── translations.schema.ts                  [NEW]
│   │   └── translation-audit-logs.schema.ts        [NEW]
│   └── migrations/
│       └── 20260301_001_translation_system.ts      [NEW]
├── modules/translation/
│   ├── translation.routes.ts                       [NEW]
│   ├── translation.repository.ts                   [NEW]
│   └── translation.validation.ts                   [NEW]
├── routes/backoffice/
│   └── translations.ts                             [NEW]
└── modules/workspace-settings/
    ├── workspace-settings.types.ts                 [MODIFY - add language_status to LanguageSettings]
    └── workspace-settings.validation.ts            [MODIFY - add language_status to languageSettingsSchema]

packages/domain-core/src/translation/
├── translatable-fields.ts                          [NEW]
├── translation.types.ts                            [NEW]
├── translation.errors.ts                           [NEW]
├── translation.service.ts                          [NEW]
└── coverage.service.ts                             [NEW]

apps/worker/src/jobs/
└── drain-language-translations.ts                  [NEW]

packages/types/
└── job-envelope.ts                                 [MODIFY - add DrainLanguageTranslationsJob]

tests/
├── unit/
│   ├── translation-service.test.ts                 [NEW]
│   ├── coverage-service.test.ts                    [NEW]
│   └── translatable-fields.test.ts                 [NEW]
├── integration/
│   ├── translation-upsert.test.ts                  [NEW]
│   ├── translation-coverage.test.ts                [NEW]
│   ├── translation-language-removal.test.ts        [NEW]
│   └── translation-audit.test.ts                   [NEW]
└── contract/
    └── translation-api.contract.test.ts            [NEW]
```

**Structure Decision**: Multi-app monorepo layout. Domain logic in
`packages/domain-core/src/translation/`. API integration in `apps/api/src/modules/translation/`.
Worker job in `apps/worker/src/jobs/`. Matches existing platform conventions.

---

## Phase 1: Tenant DB Migration

**File**: `apps/api/src/db/tenant/migrations/20260301_001_translation_system.ts`

**Schema Version Bump**: `1.1.0` to `1.2.0` (MINOR per ADR-0008: additive new tables and indexes)

**Transaction Boundary**: Single BEGIN/COMMIT wrapping all DDL. Any statement failure rolls back the
entire migration.

### Up Migration Steps (in order)

1. `CREATE TABLE IF NOT EXISTS translations` — all columns per data-model.md Section 1
2. `ADD CONSTRAINT translations_composite_unique UNIQUE (entity_type, entity_id, field_name, language_code)`
3. `CREATE INDEX IF NOT EXISTS idx_translations_entity ON translations (entity_type, entity_id)`
4. `CREATE INDEX IF NOT EXISTS idx_translations_coverage ON translations (entity_type, language_code)`
5. `CREATE INDEX IF NOT EXISTS idx_translations_language ON translations (language_code)`
6. `COMMENT ON TABLE translations` — Stage: 019_TRANSLATION_SYSTEM
7. `CREATE TABLE IF NOT EXISTS translation_audit_logs` — all columns per data-model.md Section 2
8. `CREATE INDEX IF NOT EXISTS idx_tal_entity_created ON translation_audit_logs (workspace_id, entity_type, entity_id, created_at DESC, id DESC)`
9. `CREATE INDEX IF NOT EXISTS idx_tal_language_created ON translation_audit_logs (workspace_id, language_code, created_at DESC)`
10. `CREATE TRIGGER prevent_translation_audit_modification` — reuses existing
    `prevent_audit_modification()` function from v1.0.0/triggers.sql
11. `COMMENT ON TABLE translation_audit_logs` — Stage: 019_TRANSLATION_SYSTEM
12. `UPDATE schema_version SET version = '1.2.0', applied_at = NOW() WHERE version = '1.1.0'`

### Down Migration

```typescript
down: async () => {
  throw new Error(
    "Translation system migration (1.1.0 to 1.2.0) is not reversible. Restore from snapshot.",
  );
};
```

### Migration Compliance Checklist

- [ ] Forward-only: `down()` throws
- [ ] Transactional: all DDL in one `BEGIN`/`COMMIT`
- [ ] Idempotent: all `CREATE ... IF NOT EXISTS`
- [ ] No existing table modification (additive only)
- [ ] schema_version bumped: `1.1.0` to `1.2.0`
- [ ] Stage tag in file header: `Stage: 019_TRANSLATION_SYSTEM`

---

## Phase 2: Domain Package — packages/domain-core/src/translation/

### 2a. translation.types.ts

Defines: `Translation`, `TranslationUpsert`, `TranslationCoverage`, `TranslationAuditEntry`,
`TranslationOperationContext`, `ResolvedEntityTranslations`. Full definitions in data-model.md
Section 3.

### 2b. translation.errors.ts

Error constants and `TranslationError` class:

| Error Code                        | HTTP Status | Trigger                                                                      |
| --------------------------------- | ----------- | ---------------------------------------------------------------------------- |
| `UNSUPPORTED_LANGUAGE`            | 422         | `language_code` not in `supported_languages` OR `language_status='removing'` |
| `DEFAULT_LANGUAGE_WRITE`          | 422         | `language_code` equals `default_language`                                    |
| `ENTITY_NOT_FOUND`                | 404         | `entity_type + entity_id` does not exist in tenant DB                        |
| `INVALID_FIELD_NAME`              | 422         | `field_name` not in `TRANSLATABLE_FIELDS[entity_type]`                       |
| `UNKNOWN_ENTITY_TYPE`             | 422         | `entity_type` not registered in `TRANSLATABLE_FIELDS`                        |
| `BATCH_VALIDATION_FAILED`         | 422         | Any batch item fails Zod validation                                          |
| `LANGUAGE_REMOVAL_REQUIRES_ASYNC` | 409         | Row count exceeds 10,000 threshold                                           |

All errors produce: `{ success: false, data: null, error: { code, message } }`

### 2c. translatable-fields.ts

Defines `TRANSLATABLE_FIELDS` constant map. Initial entries:

```typescript
export const TRANSLATABLE_FIELDS = {
  subject: ["title", "description"],
  category: ["name", "description"],
  question: ["text", "explanation"],
  exam: ["title", "description", "instructions"],
} as const satisfies Record<string, readonly string[]>;
```

Helper functions: `getTranslatableFields(entityType)`, `isTranslatableEntityType(entityType)`.

Coverage denominator = `TRANSLATABLE_FIELDS[entity_type].length` (pure function, zero DB overhead
per Q5 clarification). To add a new entity type: update constant, bump domain-core minor version, no
migration required.

### 2d. translation.service.ts

Key methods and transaction boundaries:

| Method                                                                                         | FR Coverage      | Transaction Boundary                                                        |
| ---------------------------------------------------------------------------------------------- | ---------------- | --------------------------------------------------------------------------- |
| `upsertTranslations(db, upserts, context, entityValidator, redis?)`                            | FR-024 to FR-032 | Caller opens tx; service executes all upserts + all audit inserts within it |
| `resolveEntityTranslations(db, entityType, entityId, languageCode, baseEntityFields, context)` | FR-007 to FR-013 | Read-only                                                                   |
| `batchLoadTranslations(db, entityType, entityIds, languageCode)`                               | FR-037           | Read-only; single indexed query                                             |
| `listEntityTranslations(db, entityType, entityId, languageCode?, cursor?, pageSize)`           | FR-038           | Read-only; paginated; max page size 50                                      |
| `deleteEntityTranslations(db, entityType, entityId, context)`                                  | Q1 clarification | Caller's entity deletion transaction                                        |
| `deleteLanguageTranslations(db, languageCode, context)`                                        | FR-016           | Caller's settings update transaction                                        |

**Fallback resolution algorithm**:

1. If `languageCode === context.default_language`: return `baseEntityFields` directly, no DB query
2. Load translations for `(entity_type, entity_id, language_code)` from tenant DB
3. For each field in `TRANSLATABLE_FIELDS[entity_type]`:
   - Translation row exists: return `translated_value`
   - Row absent: return `baseEntityFields[field_name]`
   - Base entity value also absent: return `''` and emit structured warning log (FR-012)
4. Return `ResolvedEntityTranslations` with `fallback_fields` populated

**Entity validator**: injected callback from caller. Avoids direct entity table coupling in domain
package.

### 2e. coverage.service.ts

Key methods:

| Method                                                                            | Purpose                                                     |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `getCoverage(db, entityType, languageCode, defaultLanguage, workspaceId, redis?)` | Returns coverage % or null for default language             |
| `invalidateCoverage(workspaceId, entityType, languageCode, redis?)`               | Deletes specific per-(entity_type, language_code) cache key |
| `invalidateWorkspaceCoverage(workspaceId, redis?)`                                | Deletes all coverage cache keys for workspace               |

Redis cache key: `coverage:{workspace_id}:{entity_type}:{language_code}`. Cache TTL: 300s with hard
invalidation on any write within scope.

---

## Phase 3: API Layer — apps/api

### Middleware Chain (inherited from backoffice group)

```
correlationId → tenantResolver → licenseEnforcement → schemaVersion
  → rateLimit(max:60) → authentication → rbacGuard(staff)
```

All translation routes inherit this chain. No new middleware types required.

### Endpoints

#### POST /api/workspaces/:slug/translations

- Auth: Staff permission
- Body: Single `TranslationUpsert` OR `{ translations: TranslationUpsert[] }` (max 50 items)
- Response: HTTP 200 for both create and update (idempotent per Q4 clarification; never 201)
- Transaction: service layer opens transaction; all upserts + all audit log inserts committed
  atomically (FR-029)
- Cache invalidation: `CoverageService.invalidateCoverage()` per `(entity_type, language_code)`
  after commit

#### GET /api/workspaces/:slug/translations

- Auth: Staff permission (inherited from backoffice middleware chain; note: if student-facing
  translation resolution is needed in the future, it must use a separate frontoffice route — not
  this endpoint)
- Query: `entity_type` (req), `entity_id` (req), `language_code` (opt), `cursor` (opt), `page_size`
  (opt, max 50)
- Mode A (language_code present): `resolveEntityTranslations()` — fields with fallback applied
- Mode B (language_code absent): `listEntityTranslations()` — paginated raw rows for management
  panel

#### GET /api/workspaces/:slug/translations/coverage

- Auth: Staff permission
- Query: `entity_type` (req), `language_code` (opt)
- Returns coverage % per `(entity_type, language_code)`; excludes default_language (FR-020)
- Uses `idx_translations_coverage`; no full-table scans (FR-022)

#### Language Removal Integration (existing PATCH /api/workspaces/:slug/settings/language)

Modify `workspace-settings.service.ts`:

1. `COUNT(*) FROM translations WHERE language_code = X`
2. If count ≤ 10,000: sync delete in same tx + audit log entries + HTTP 200
3. If count > 10,000: set `language_status[X]='removing'`, enqueue `DRAIN_LANGUAGE_TRANSLATIONS`
   job, return HTTP 409 with `LANGUAGE_REMOVAL_REQUIRES_ASYNC`

---

## Phase 4: Worker — apps/worker

### Job: DRAIN_LANGUAGE_TRANSLATIONS

**File**: `apps/worker/src/jobs/drain-language-translations.ts`

**Payload** (added to `packages/types/job-envelope.ts`):

```typescript
interface DrainLanguageTranslationsJob {
  job_type: "DRAIN_LANGUAGE_TRANSLATIONS";
  workspace_id: string;
  workspace_slug: string;
  language_code: string;
  batch_size: number; // default: 1000; configurable by operator
  correlation_id: string;
  initiated_by_user_id: string;
  attempt?: number;
  created_at: string; // ISO8601
}
```

**Algorithm**:

1. Get tenant DB pool from workspace_slug
2. Loop until batch_deleted === 0:
   - `DELETE FROM translations WHERE id IN (SELECT id FROM translations WHERE language_code = $1 LIMIT $batchSize)`
   - Insert audit log entries for deleted rows (action='deleted', reason='language_removed')
   - Log `drain_batch` event
3. Remove `language_status[language_code]` from `workspace_settings`
4. Call `CoverageService.invalidateWorkspaceCoverage()` to clear Redis coverage cache
5. Log `drain_complete` event

**Idempotency**: Retry after crash continues from remaining rows. Final cleanup is idempotent
(deleting absent JSONB key is a no-op).

**Concurrency guard**: `language_status[X]='removing'` prevents new translations to that language.
`job-hash.ts` deduplication prevents duplicate drain jobs.

---

## Phase 5: workspace_settings Modifications

**`workspace-settings.types.ts`**: Add `language_status?: Record<string, 'active' | 'removing'>` to
`LanguageSettings` interface.

**`workspace-settings.validation.ts`**: Add
`language_status: z.record(z.enum(['active', 'removing'])).optional()` to `languageSettingsSchema`.

**Write guard**: The public settings update API must NOT allow callers to set `language_status`
directly. Written only by the language removal endpoint and the drain job completion handler.

---

## Transaction Boundaries Summary

| Operation                             | Boundary                                                      |
| ------------------------------------- | ------------------------------------------------------------- |
| Single translation upsert             | One tx: upsert row + audit log insert                         |
| Batch upsert (max 50)                 | One tx: all N upserts + all N audit log inserts               |
| Language removal sync (≤10,000 rows)  | One tx: settings update + DELETE all rows + audit log inserts |
| Language removal async (>10,000 rows) | One tx: settings update only (language_status to 'removing')  |
| Entity deletion cleanup               | Caller's entity deletion tx: DELETE translations + audit log  |
| DRAIN batch                           | One tx per N-row batch: DELETE LIMIT N + audit log inserts    |

---

## Idempotency Approach

| Operation               | Key                                                   | Behavior                                                                                  |
| ----------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Translation upsert      | `(entity_type, entity_id, field_name, language_code)` | Always safe to retry; updates value and `updated_at`; HTTP 200 for both create and update |
| Language removal (sync) | language_code absent from settings                    | Returns 200 no-op if already removed                                                      |
| DRAIN job               | language_code                                         | Loop exits when 0 rows remain; re-run is a no-op                                          |

---

## Concurrency Guards

| Scenario                                          | Guard                                                                  |
| ------------------------------------------------- | ---------------------------------------------------------------------- |
| Two writes to same translation key simultaneously | PostgreSQL ON CONFLICT serialization; last writer wins; both audited   |
| Two language removal requests for same language   | Check `language_status[X]` before removal; 409 if already `'removing'` |
| DRAIN job re-queued while running                 | `job-hash.ts` deduplication; `language_status` guard                   |

---

## Error Codes and HTTP Status Codes

| Error Code                        | HTTP Status | Trigger                                                             |
| --------------------------------- | ----------- | ------------------------------------------------------------------- |
| `UNSUPPORTED_LANGUAGE`            | 422         | `language_code` not in `supported_languages` OR `status='removing'` |
| `DEFAULT_LANGUAGE_WRITE`          | 422         | `language_code` equals `default_language`                           |
| `ENTITY_NOT_FOUND`                | 404         | `entity_type + entity_id` does not exist                            |
| `INVALID_FIELD_NAME`              | 422         | `field_name` not in `TRANSLATABLE_FIELDS[entity_type]`              |
| `UNKNOWN_ENTITY_TYPE`             | 422         | `entity_type` not in `TRANSLATABLE_FIELDS`                          |
| `BATCH_VALIDATION_FAILED`         | 422         | Any batch item fails Zod validation                                 |
| `LANGUAGE_REMOVAL_REQUIRES_ASYNC` | 409         | Row count > 10,000 threshold                                        |

---

## Logging Requirements

All log entries from translation and coverage service must include: `timestamp`, `level`,
`service='translation'`, `workspace_slug`, `workspace_id`, `correlation_id`, `user_id` (undefined
for worker), `entity_type`, `entity_id`, `field_name`, `language_code` (where applicable), `event`.

**Warning events**:

- `translation_fallback_missing_default`: FR-012 — missing base entity default value during fallback
- `coverage_unknown_entity_type`: entity_type not in `TRANSLATABLE_FIELDS`

`console.log` is forbidden (AGENTS.md). Use `@zidney/logger` exclusively.

**Prohibited in logs**: `translated_value`, `previous_value`, and `new_value` MUST NOT appear in any
structured log entry. These fields are persisted exclusively in the database
(`translation_audit_logs`) and must not propagate to the logging layer.

---

## Worker Interaction Specification

```
Trigger:
  PATCH /settings/language (remove language, count > 10,000)
    → UPDATE workspace_settings: set language_status[X]='removing', remove from supported_languages
    → Enqueue DRAIN_LANGUAGE_TRANSLATIONS job
    → Return HTTP 409 LANGUAGE_REMOVAL_REQUIRES_ASYNC

Worker execution:
  DRAIN_LANGUAGE_TRANSLATIONS handler
    → Batch delete loop (1,000 rows/batch default)
    → Write audit log per batch (reason='language_removed')
    → After drain: remove language_status[X] key from workspace_settings
    → Invalidate Redis coverage cache
    → Log drain_complete

Client polling:
  GET /api/workspaces/:slug/settings
    → language_status[X] = 'removing': drain in progress
    → language_status[X] absent: drain complete
```

---

## Testing Requirements

No feature is complete unless all test categories pass (AGENTS.md).

### Unit Tests

**`translation-service.test.ts`**:

- `UNSUPPORTED_LANGUAGE` rejection (language not in supported_languages)
- `DEFAULT_LANGUAGE_WRITE` rejection (language_code = default_language)
- `ENTITY_NOT_FOUND` rejection (entityValidator returns empty set)
- `INVALID_FIELD_NAME` rejection (field not in TRANSLATABLE_FIELDS)
- Batch atomicity: one invalid item causes entire batch to be rejected
- Fallback: translated value returned when row exists
- Fallback: base entity value returned when translation absent
- Fallback: empty string + warning log when base entity value also absent (FR-012)
- Default language path: base entity values returned directly without DB query

**`coverage-service.test.ts`**:

- 50% coverage for 15/30 translated slots
- 0% for zero translations
- Null returned for default_language query
- Warning for unknown entity_type
- Cache hit path returns cached value without DB query
- Cache miss path writes to cache after DB query
- Cache invalidation deletes cache key

**`translatable-fields.test.ts`**:

- `getTranslatableFields` returns correct fields for known entity_type
- `getTranslatableFields` returns `[]` for unknown entity_type
- `isTranslatableEntityType` returns true/false correctly

### Integration Tests

**`translation-upsert.test.ts`**:

- Single upsert: row created + audit log entry in same transaction
- Duplicate upsert: row updated, no duplicate created
- Idempotency: same composite key submitted twice → HTTP 200, single row, no error (FR-030)
- Batch: 5 items → 5 rows + 5 audit entries committed atomically
- Batch atomicity: 4 valid + 1 invalid → 0 rows committed, 422 returned (FR-029)
- Default language write → 422 `DEFAULT_LANGUAGE_WRITE`
- Unsupported language write → 422 `UNSUPPORTED_LANGUAGE`
- Missing entity → 404 `ENTITY_NOT_FOUND`
- Tenant isolation: translations not visible cross-tenant (SC-008)

**`translation-language-removal.test.ts`**:

- Sync removal (≤10,000): all rows deleted, zero orphaned rows, HTTP 200 (SC-005)
- Default language removal rejected
- Async removal (>10,000): HTTP 409, language_status='removing', rows remain
- DRAIN job: all rows drained in batches, language_status key removed after completion

**`translation-coverage.test.ts`**:

- 50% coverage for 15/30 translated slots
- 0% for zero translations
- Coverage reflects new translation automatically (FR-021)
- Default language excluded from coverage results (FR-020)

**`translation-audit.test.ts`**:

- Audit entry created for every upsert (action=created or updated)
- Audit entry for language removal (action=deleted, reason=language_removed) — FR-035
- Trigger prevents UPDATE on audit table
- Trigger prevents DELETE on audit table
- Entries include `correlation_id`, `user_id`, `workspace_id` (FR-032, FR-033)

### Contract Tests

**`translation-api.contract.test.ts`**:

- POST /translations: request and response shapes for single + batch
- GET /translations (resolution mode): response shape with `fields` + `fallback_fields`
- GET /translations (list mode): paginated response shape
- GET /translations/coverage: coverage response shape
- All error responses match `{ success: false, data: null, error: { code, message } }`

---

## Files to Create / Modify

### New Files

| File                                                                   | Purpose                   | Phase   |
| ---------------------------------------------------------------------- | ------------------------- | ------- |
| `apps/api/src/db/tenant/migrations/20260301_001_translation_system.ts` | DB migration              | 1       |
| `apps/api/src/db/tenant/schemas/translations.schema.ts`                | Drizzle schema            | 1       |
| `apps/api/src/db/tenant/schemas/translation-audit-logs.schema.ts`      | Drizzle schema            | 1       |
| `packages/domain-core/src/translation/translation.types.ts`            | Types                     | 2       |
| `packages/domain-core/src/translation/translation.errors.ts`           | Error constants + classes | 2       |
| `packages/domain-core/src/translation/translatable-fields.ts`          | Domain constant           | 2       |
| `packages/domain-core/src/translation/translation.service.ts`          | Domain service            | 2       |
| `packages/domain-core/src/translation/coverage.service.ts`             | Coverage service          | 2       |
| `apps/api/src/modules/translation/translation.routes.ts`               | Route handlers            | 3       |
| `apps/api/src/modules/translation/translation.repository.ts`           | Data access layer         | 3       |
| `apps/api/src/modules/translation/translation.validation.ts`           | Zod schemas               | 3       |
| `apps/api/src/routes/backoffice/translations.ts`                       | Route registration        | 3       |
| `apps/worker/src/jobs/drain-language-translations.ts`                  | Worker job handler        | 4       |
| `specs/runtime/019-translation-system/contracts/api-endpoints.md`      | Contract doc              | Phase 2 |
| `specs/runtime/019-translation-system/contracts/worker-job-schema.md`  | Contract doc              | Phase 2 |
| `tests/unit/translation-service.test.ts`                               | Unit tests                | All     |
| `tests/unit/coverage-service.test.ts`                                  | Unit tests                | All     |
| `tests/unit/translatable-fields.test.ts`                               | Unit tests                | All     |
| `tests/integration/translation-upsert.test.ts`                         | Integration tests         | All     |
| `tests/integration/translation-language-removal.test.ts`               | Integration tests         | All     |
| `tests/integration/translation-coverage.test.ts`                       | Integration tests         | All     |
| `tests/integration/translation-audit.test.ts`                          | Integration tests         | All     |
| `tests/contract/translation-api.contract.test.ts`                      | Contract tests            | All     |

### Modified Files

| File                                                                       | Change                                                                            |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `apps/api/src/modules/workspace-settings/workspace-settings.types.ts`      | Add `language_status?` to `LanguageSettings`                                      |
| `apps/api/src/modules/workspace-settings/workspace-settings.validation.ts` | Add `language_status` optional field to `languageSettingsSchema`                  |
| `apps/api/src/modules/workspace-settings/workspace-settings.service.ts`    | Add threshold check + async drain enqueue + sync delete path for language removal |
| `packages/types/job-envelope.ts`                                           | Add `DrainLanguageTranslationsJob` to job union type                              |
| `packages/domain-core/src/index.ts`                                        | Export translation module if barrel exports are maintained                        |

---

## BLOCKED Items

**None.** All clarifications are resolved. All architectural dependencies are available.
Implementation may proceed immediately.

---

## Key Architectural Decisions

1. **Drizzle `onConflictDoUpdate` for upsert**: Targets `translations_composite_unique` constraint.
   Composite key `(entity_type, entity_id, field_name, language_code)` is the sole idempotency
   mechanism. No client-provided idempotency headers (Q4 clarification).

2. **Audit log in same transaction**: Upsert row and audit entry committed atomically. 100% write
   auditability guaranteed (SC-004). No separate audit flush step.

3. **No FK cascade**: `translations` has no FK to entity tables. Entity deletions call
   `deleteEntityTranslations()` explicitly within the entity deletion transaction (Q1
   clarification). Architecturally correct for multi-parent-table design.

4. **Threshold-based async drain at 10,000 rows**: Language removal with >10,000 rows is rejected
   synchronously and delegated to the DRAIN worker job. Below threshold, synchronous in-transaction
   deletion proceeds (Q3 clarification).

5. **Coverage denominator is a pure constant**: `TRANSLATABLE_FIELDS[entity_type].length` — zero DB
   overhead. Adding translatable fields requires a domain package code change, enforcing deliberate
   governance (Q5 clarification).

6. **Tenant-scoped coverage cache**: Redis key format
   `coverage:{workspace_id}:{entity_type}:{language_code}` — workspace_id is a mandatory prefix.
   Cross-tenant cache access is architecturally impossible (FR-023).

7. **`language_status` in workspace_settings JSONB**: No new DB column or table. Existing JSONB
   column absorbs the optional `language_status` field. Fully backward-compatible — absent key means
   active (Q3 clarification).

8. **HTTP 200 for both create and update**: Idempotent upsert never returns 201. The API does not
   distinguish first write from repeat write (Q4 clarification).

9. **schema_version 1.1.0 to 1.2.0**: MINOR bump per ADR-0008. Single forward-only migration file
   `20260301_001_translation_system.ts`.

10. **Route registration under backoffice group**: Inherits established middleware chain
    (correlationId → tenantResolver → licenseEnforcement → schemaVersion → rateLimit →
    authentication). No new middleware types needed.
