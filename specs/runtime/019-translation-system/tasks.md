# Tasks: Translation System

**Feature Branch**: `019-translation-system` **Generated**: 2026-03-01 **Input**: spec.md · plan.md
· data-model.md · research.md · contracts/api-endpoints.md · contracts/worker-job-schema.md
**Stage**: `03_BACKOFFICE_CORE/01_FOUNDATION`

---

## Format

```
- [ ] T001 [P] [USn] Description with exact file path
```

- `- [ ]` checkbox (required)
- `T001` sequential ID in execution order (required)
- `[P]` parallelizable — safe to run concurrently with adjacent `[P]` tasks (different files, no
  unmet dependency)
- `[USn]` user story label (required for Domain / API / Worker / Test phases; omitted for Setup and
  Migration)

---

## User Story Index

| Label | Priority | Title                                                  |
| ----- | -------- | ------------------------------------------------------ |
| US1   | P1       | Translate Entity Fields into Supported Languages       |
| US2   | P1       | Retrieve Entity with Language-Aware Fallback           |
| US3   | P1       | Manage Workspace Languages                             |
| US4   | P2       | View Translation Coverage per Language and Entity Type |
| US5   | P2       | Bulk Manage Translations per Entity                    |
| US6   | P1       | Audit Trail for All Translation Changes                |

---

## Phase 1: Setup — Shared Types, Errors, and Constants

**Purpose**: Create the foundational TypeScript types, error constants, and domain constants that
every subsequent phase depends on. All three files are independent of each other and can be written
in parallel.

**⚠️ BLOCKING**: Phase 3 (Domain) and Phase 4 (API) cannot begin until Phase 1 is complete.

- [x] T001 [P] Define `Translation`, `TranslationUpsert`, `TranslationCoverage`,
      `TranslationAuditEntry`, `TranslationOperationContext`, and `ResolvedEntityTranslations`
      TypeScript interfaces in `packages/domain-core/src/translation/translation.types.ts`
- [x] T002 [P] Define `TranslationError` class and export error code constants
      `UNSUPPORTED_LANGUAGE` (422), `DEFAULT_LANGUAGE_WRITE` (422), `ENTITY_NOT_FOUND` (404),
      `INVALID_FIELD_NAME` (422), `UNKNOWN_ENTITY_TYPE` (422), `BATCH_VALIDATION_FAILED` (422),
      `LANGUAGE_REMOVAL_REQUIRES_ASYNC` (409) in
      `packages/domain-core/src/translation/translation.errors.ts`
- [x] T003 [P] Define `TRANSLATABLE_FIELDS` constant map `{ subject, category, question, exam }`
      with helper functions `getTranslatableFields(entityType)` and
      `isTranslatableEntityType(entityType)` in
      `packages/domain-core/src/translation/translatable-fields.ts`

**Checkpoint**: All shared types and constants exist; no TypeScript errors in the three new files.

---

## Phase 2: Migration — Tenant DB Schema

**Purpose**: Introduce the two new tenant DB tables (`translations`, `translation_audit_logs`) and
bump `schema_version` from `1.1.0` to `1.2.0`. The two Drizzle schema files can be written in
parallel; the migration file must come after both.

**⚠️ BLOCKING**: Phase 4 (API — repository) cannot reference Drizzle schemas until T004 and T005 are
complete.

- [x] T004 [P] Create Drizzle table definition for `translations` with all columns, composite unique
      constraint `translations_composite_unique`, and indexes `idx_translations_entity`,
      `idx_translations_coverage`, `idx_translations_language` in
      `apps/api/src/db/tenant/schemas/translations.schema.ts`
- [x] T005 [P] Create Drizzle table definition for `translation_audit_logs` with all columns and
      indexes `idx_tal_entity_created`, `idx_tal_language_created` in
      `apps/api/src/db/tenant/schemas/translation-audit-logs.schema.ts`
- [x] T006 Create forward-only tenant DB migration `20260301_001_translation_system.ts`:
      `CREATE TABLE translations`, composite unique constraint, three indexes,
      `CREATE TABLE translation_audit_logs`, two indexes, immutability trigger
      `prevent_translation_audit_modification` (reuses `prevent_audit_modification()` function from
      v1.0.0), `UPDATE schema_version SET version = '1.2.0'`; `down()` must throw; all DDL in a
      single `BEGIN`/`COMMIT` block in
      `apps/api/src/db/tenant/migrations/20260301_001_translation_system.ts`

**Checkpoint**: Migration runs to completion on a clean test tenant DB; `schema_version` reads
`1.2.0`; both tables and all five indexes exist.

---

## Phase 3: Domain — Domain-Core Services

**Purpose**: Implement the stateless domain service functions that contain all business logic.
`translation.service.ts` serves US1, US2, US3, US5, and US6; `coverage.service.ts` serves US4. Both
files can be implemented in parallel.

**Prerequisites**: Phase 1 (T001–T003) must be complete.

- [x] T007 [P] [US1] Implement `translation.service.ts` with all public methods:
      `upsertTranslations` (validates language, default-language guard, entity existence via
      injected `entityValidator` callback, Drizzle `onConflictDoUpdate` targeting
      `translations_composite_unique`, audit log insert in same transaction, post-commit coverage
      cache invalidation); `resolveEntityTranslations` (default-language short-circuit, per-field
      fallback with FR-012 warning for missing default value, `fallback_fields` enumeration);
      `batchLoadTranslations` (single indexed query for up to 100 entity IDs);
      `listEntityTranslations` (cursor-paginated, max page size 50); `deleteEntityTranslations`
      (entity cleanup, caller's transaction); `deleteLanguageTranslations` (sync language removal
      path, caller's transaction, audit entries with `reason='language_removed'`) in
      `packages/domain-core/src/translation/translation.service.ts`
- [x] T008 [P] [US4] Implement `coverage.service.ts` with: `getCoverage` (aggregation via
      `idx_translations_coverage`, Redis cache key
      `coverage:{workspace_id}:{entity_type}:{language_code}`, TTL 300 s, returns `null` for default
      language per FR-020); `invalidateCoverage` (delete specific cache key);
      `invalidateWorkspaceCoverage` (delete all cache keys for workspace using **Redis `SCAN`-based
      cursor iteration, never `KEYS`** — to avoid blocking the Redis event loop) in
      `packages/domain-core/src/translation/coverage.service.ts`
- [x] T009 Update barrel export to include the translation module in
      `packages/domain-core/src/index.ts`

**Checkpoint**: `tsc --noEmit` passes on domain-core; `upsertTranslations` with a mocked db and
validator rejects `DEFAULT_LANGUAGE_WRITE` and `UNSUPPORTED_LANGUAGE` without DB calls;
`resolveEntityTranslations` returns base entity fields when `languageCode === defaultLanguage`
without DB calls.

---

## Phase 4: API Layer — Route Handlers and Language Removal Integration

**Purpose**: Wire the domain services into Hono route handlers under the backoffice middleware
chain, and extend the workspace-settings service with threshold-gated language removal logic.

**Prerequisites**: Phase 1 (T001–T003), Phase 2 (T004–T005), Phase 3 (T007–T009) must be complete.

### 4a — Foundational API Prerequisites

These four files can be written in parallel; they have no inter-dependencies within this group.

- [x] T010 [P] Add `language_status?: Record<string, 'active' | 'removing'>` to the
      `LanguageSettings` interface in
      `apps/api/src/modules/workspace-settings/workspace-settings.types.ts`
- [x] T011 [P] Create a **client-facing** `LanguageSettingsUpdateSchema` that EXCLUDES
      `language_status` entirely (i.e., the field MUST NOT be parseable from inbound client
      requests); keep `language_status` only in an **internal-only**
      `LanguageSettingsInternalSchema` used by the service layer; update `languageSettingsSchema`
      exports accordingly in
      `apps/api/src/modules/workspace-settings/workspace-settings.validation.ts`
- [x] T012 [P] Create Zod validation schemas: `TranslationUpsertItemSchema`
      (`translated_value: z.string().max(10_000)`), `SingleUpsertSchema` (union detect),
      `BatchUpsertSchema` (max 50), `GetTranslationsQuerySchema` (entity_type, entity_id, optional
      language_code, cursor, page_size), `GetCoverageQuerySchema` (entity_type, optional
      language_code) in `apps/api/src/modules/translation/translation.validation.ts`
- [x] T013 [P] Create translation repository with Drizzle-based data-access functions:
      `insertOrUpdateTranslation`, `insertAuditLogEntry`, `insertAuditLogBatch`,
      `queryTranslationsForEntity`, `queryTranslationsBatch`, `listTranslationRows`
      (cursor-paginated; use keyset pagination anchored on `id ASC` — NOT offset-based; cursor
      encodes the last `id` seen), `countTranslationsForLanguage`, `deleteTranslationsByLanguage`
      (sync, returns deleted rows for audit), `aggregateCoverage` in
      `apps/api/src/modules/translation/translation.repository.ts`

### 4b — Route Handlers (all depend on T012 + T013; can be written in parallel with each other)

- [x] T014 [P] [US1] Implement POST `/api/workspaces/:slug/translations` route handler: accept
      single or batch body (up to 50 items), call `upsertTranslations`, return HTTP 200 with
      `{ saved: [...], count: N }` for both create and update; map `TranslationError` codes to 422 /
      404 per contract in `apps/api/src/routes/backoffice/translations/post-upsert.ts`
- [x] T015 [P] [US2] Implement GET `/api/workspaces/:slug/translations` route handler: Mode A
      (`language_code` present) calls `resolveEntityTranslations` and returns
      `{ entity_type, entity_id, language_code, fields, fallback_fields }`; Mode B (`language_code`
      absent) calls `listEntityTranslations` and returns paginated
      `{ items, next_cursor, page_size }` in
      `apps/api/src/routes/backoffice/translations/get-translations.ts`
- [x] T016 [P] [US4] Implement GET `/api/workspaces/:slug/translations/coverage` route handler:
      validate query params, call `getCoverage`, exclude default language and
      `language_status='removing'` languages, return `{ coverage: [...] }` array in
      `apps/api/src/routes/backoffice/translations/get-coverage.ts`
- [x] T017 Create Hono router that registers the three handlers above on the correct HTTP methods
      and paths, and export `translationsRouter`; mount under the backoffice group so it inherits
      `correlationId → tenantResolver → licenseEnforcement → schemaVersion → rateLimit(60) → authentication → rbacGuard(staff)`
      in `apps/api/src/routes/backoffice/translations/index.ts`

### 4c — Language Removal Integration (depends on T010 + T011; can run in parallel with T014–T017)

- [x] T018 [P] [US3] Modify `workspace-settings.service.ts` language removal path: add
      `COUNT(*) FROM translations WHERE language_code = X` threshold check; if `count ≤ 10,000` →
      synchronous in-transaction delete via `deleteLanguageTranslations` + audit log entries + HTTP
      200; if `count > 10,000` → set `language_status[X]='removing'`, remove from
      `supported_languages`, enqueue `DRAIN_LANGUAGE_TRANSLATIONS` job, return HTTP 409 with
      `LANGUAGE_REMOVAL_REQUIRES_ASYNC`; reject removal of current `default_language` with FR-017
      error in `apps/api/src/modules/workspace-settings/workspace-settings.service.ts`

**Checkpoint**: `POST /translations` with a valid single upsert returns HTTP 200 and a row is
visible in the tenant DB; `GET /translations?entity_type=subject&entity_id=<uuid>&language_code=fr`
returns `fields` + `fallback_fields`; `GET /translations/coverage?entity_type=subject` returns a
coverage array; language removal with a small dataset completes synchronously.

---

## Phase 5: Worker — DRAIN_LANGUAGE_TRANSLATIONS Job

**Purpose**: Implement the async worker job that drains translation rows for a language that was
removed with a row count exceeding the 10,000 synchronous threshold.

**Prerequisites**: Phase 1 (T001–T002), Phase 3 (T007–T008) must be complete for the types and
services used.

- [x] T019 Add `DrainLanguageTranslationsJob` interface (`job_type`, `workspace_id`,
      `workspace_slug`, `language_code`, `batch_size`, `correlation_id`, `initiated_by_user_id`,
      `attempt?`, `created_at`) to the job type union in `packages/types/job-envelope.ts`
- [x] T020 [US3] Implement `DRAIN_LANGUAGE_TRANSLATIONS` worker job handler: resolve tenant pool via
      `workspace_slug`; loop
      `DELETE FROM translations WHERE id IN (SELECT id FROM translations WHERE language_code = $1 LIMIT $batchSize) RETURNING id, entity_type, entity_id, field_name, language_code`;
      **each loop iteration's DELETE and audit INSERT MUST be wrapped in a single database
      transaction per batch** (plan.md Transaction Boundaries: DRAIN batch — not one
      mega-transaction); insert audit batch per loop iteration (`action='deleted'`,
      `reason='language_removed'`, `user_id=initiated_by_user_id`, `correlation_id`); parse job
      payload via `DrainLanguageTranslationsJobSchema.parse(rawPayload)` before any DB operations;
      log `drain_batch` structured event per iteration; after loop exits, remove
      `language_status[language_code]` key from `workspace_settings`; call
      `CoverageService.invalidateWorkspaceCoverage` (use Redis `SCAN`-based cursor iteration, never
      `KEYS`); log `drain_complete` event; log `drain_failed` on error with retry metadata in
      `apps/worker/src/jobs/drain-language-translations.ts`

**Checkpoint**: Running the handler with a seeded 500-row test dataset drains all rows in batches,
produces matching audit entries, clears `language_status`, and logs `drain_complete`.

---

## Phase 6: Tests

**Purpose**: Verify all functional requirements and error contracts. Unit tests cover pure domain
logic; integration tests cover full request-to-DB flows; the contract test enforces API response
shapes.

**Prerequisites**: All preceding phases must be complete.

### Unit Tests (all parallel — different files, mock DB layer)

- [x] T021 [P] Write unit tests for `translatable-fields.ts`: `getTranslatableFields` returns
      correct array for each known entity type; returns `[]` for unknown type;
      `isTranslatableEntityType` returns `true`/`false` correctly in
      `tests/unit/translatable-fields.test.ts`
- [x] T022 [P] [US1] Write unit tests for `translation.service.ts`: `UNSUPPORTED_LANGUAGE` rejection
      (language not in supported_languages); `UNSUPPORTED_LANGUAGE` rejection when
      `language_status='removing'`; `DEFAULT_LANGUAGE_WRITE` rejection; `ENTITY_NOT_FOUND` rejection
      when entityValidator returns no match; `INVALID_FIELD_NAME` rejection; batch atomicity (one
      invalid item rejects entire batch, FR-029); fallback — translated value returned when row
      exists (US2); fallback — base entity value returned when translation absent (US2, FR-011);
      fallback — empty string + warning log when base entity value also absent (FR-012);
      default-language path returns base fields with no DB call (FR-007) in
      `tests/unit/translation-service.test.ts`
- [x] T023 [P] [US4] Write unit tests for `coverage.service.ts`: 50% coverage for 15/30 translated
      slots; 0% for zero translations; `null` returned when `languageCode === defaultLanguage`
      (FR-020); structured warning for unknown entity type; cache hit path returns cached value
      without DB call; cache miss path writes to cache after DB query; `invalidateCoverage` deletes
      specific cache key; `invalidateWorkspaceCoverage` deletes all workspace cache keys in
      `tests/unit/coverage-service.test.ts`

### Integration Tests (T024 is the anchor; T025–T027 can start in parallel after T024 passes)

- [x] T024 [US1] Write integration tests for translation write path: single upsert creates row +
      audit log entry in same transaction; duplicate upsert updates row, no duplicate created
      (idempotency test, FR-030); batch of 5 items commits all 5 rows + 5 audit entries atomically
      (FR-029); batch with 1 invalid item commits zero rows (FR-029); `DEFAULT_LANGUAGE_WRITE` →
      HTTP 422; `UNSUPPORTED_LANGUAGE` → HTTP 422; missing entity → HTTP 404 `ENTITY_NOT_FOUND`;
      tenant isolation — translation saved in workspace A is not visible from workspace B (SC-008)
      in `tests/integration/translation-upsert.test.ts`
- [x] T025 [P] [US3] Write integration tests for language removal: sync removal (≤10,000 rows)
      deletes all rows in same transaction, zero orphaned rows, returns HTTP 200 (SC-005); attempt
      to remove `default_language` is rejected; async removal (>10,000 rows) returns HTTP 409
      `LANGUAGE_REMOVAL_REQUIRES_ASYNC`, `language_status[X]='removing'`, rows remain; DRAIN job
      handler drains all rows in batches, `language_status` key is absent after completion in
      `tests/integration/translation-language-removal.test.ts`
- [x] T026 [P] [US4] Write integration tests for coverage endpoint: 50% coverage for 15/30
      translated slots; 0% for zero translations; default language is excluded from results
      (FR-020); new translation write updates coverage percentage (FR-021); language with
      `language_status='removing'` excluded from results in
      `tests/integration/translation-coverage.test.ts`
- [x] T027 [P] [US6] Write integration tests for audit trail: audit entry created for every upsert
      with correct `action`, `entity_type`, `entity_id`, `field_name`, `language_code`, `user_id`,
      `correlation_id`, `workspace_id` (FR-032, FR-033); language removal cascade produces audit
      entries with `reason='language_removed'` (FR-035); multiple sequential updates to same field
      produce distinct chronological entries; immutability trigger blocks `UPDATE` on
      `translation_audit_logs`; immutability trigger blocks `DELETE` on `translation_audit_logs`
      (FR-034) in `tests/integration/translation-audit.test.ts`
- [x] T028 [US1] Write contract tests validating HTTP request/response shapes for all four API
      surface points: `POST /translations` single + batch request and success response shape;
      `GET /translations` Mode A resolution response (`fields`, `fallback_fields`);
      `GET /translations` Mode B management list response (`items`, `next_cursor`, `page_size`);
      `GET /translations/coverage` coverage array response shape; all error responses match
      `{ success: false, data: null, error: { code, message } }` for each error code (FR-002
      contract) in `tests/contract/translation-api.contract.test.ts`

**Checkpoint**: All 28 tasks complete. `vitest run` passes with zero failures. `tsc --noEmit` passes
across all packages and apps.

---

## Dependencies — Execution Order

```
Phase 1 (T001 T002 T003) — all parallel, no prerequisites
    │
    ├──► Phase 2 (T004 T005 parallel → T006 sequential)
    │
    └──► Phase 3 (T007, T008 parallel → T009 sequential)
              │
              └──► Phase 4a (T010 T011 T012 T013 — all parallel)
                        │
                        ├──► Phase 4b route handlers (T014 T015 T016 — parallel → T017 sequential)
                        │
                        └──► Phase 4c language removal (T018)
                                  │
                                  └──► Phase 5 (T019 sequential → T020)
                                                │
                                                └──► Phase 6 tests (T021 T022 T023 parallel)
                                                              (T024 → T025 T026 T027 T028 parallel)
```

**Strict blockers**:

| Prerequisite                     | Blocked task(s)              |
| -------------------------------- | ---------------------------- |
| T001 (types)                     | T007, T008, T012, all tests  |
| T002 (errors)                    | T007, T014, T015, T016       |
| T003 (translatable-fields)       | T007, T021                   |
| T004 + T005 (schemas)            | T006, T013                   |
| T009 (barrel export)             | T010, T011, T012, T013       |
| T006 (migration)                 | T024–T028 (need real tables) |
| T007 (translation.service)       | T014, T015, T022, T024       |
| T008 (coverage.service)          | T016, T023, T026             |
| T010 + T011 (types + validation) | T018                         |
| T012 + T013 (valid + repo)       | T014, T015, T016             |
| T014–T017 (routes)               | T024–T028                    |
| T018 (ws-settings.service)       | T025                         |
| T019 (job type)                  | T020                         |
| T020 (drain handler)             | T025                         |

---

## Parallel Execution Summary

| Batch | Tasks                  | Can start after                |
| ----- | ---------------------- | ------------------------------ |
| 1     | T001, T002, T003       | —                              |
| 2     | T004, T005             | T001 (for schema import types) |
| 3     | T007, T008             | T001, T002, T003               |
| 4     | T006                   | T004, T005                     |
| 5     | T009                   | T007, T008                     |
| 6     | T010, T011, T012, T013 | T001–T009                      |
| 7     | T014, T015, T016, T018 | T010–T013                      |
| 8     | T017                   | T014, T015, T016               |
| 9     | T019                   | T001, T002                     |
| 10    | T020                   | T007, T008, T019               |
| 11    | T021, T022, T023       | All preceding phases           |
| 12    | T024                   | T021–T023 (and all Phase 4/5)  |
| 13    | T025, T026, T027, T028 | T024                           |

---

## MVP Scope

The minimum viable increment that delivers a fully testable write-read-audit loop consists of:

1. **Phase 1** — T001, T002, T003
2. **Phase 2** — T004, T005, T006
3. **Phase 3** — T007 only (US1, US2, US6 paths in one service)
4. **Phase 4** — T012, T013, T014, T015, T017 (omit coverage and language removal for now)
5. **Phase 6** — T021, T022, T024 (unit + core integration tests)

This delivers User Stories 1, 2, and 6 (write, read, audit) as an independently testable slice
before Coverage (US4) and Language Removal (US3) are built.

---

## Key Implementation Constraints (Reference)

- All DB access via tenant pool from request/job context — no module-level pool instantiation
- `tenantResolver` middleware before any DB access; `licenseEnforcement` before any business logic
- All upserts use Drizzle `onConflictDoUpdate` targeting `translations_composite_unique` composite
  constraint
- Audit log inserted in same transaction as translation upsert (SC-004)
- DRAIN `DELETE` must use `RETURNING id, entity_type, entity_id, field_name, language_code` for
  per-row audit entries
- HTTP 200 for both create and update (idempotent upsert, never 201)
- Batch writes commit or reject as a unit (FR-029) — no partial saves
- Structured logging via `@zidney/logger` with `correlation_id` in all operations — `console.log`
  forbidden
- Server-authoritative timestamps: `created_at = defaultNow()`, `updated_at = sql\`NOW()\`` on every
  upsert
- `translated_value` stores empty string `''` for intentional blanks — `NULL` is never stored
- `language_status` field in `workspace_settings` MUST NOT be settable via the public settings API
