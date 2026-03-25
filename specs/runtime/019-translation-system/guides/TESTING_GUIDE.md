# Testing Guide — TRANSLATION_SYSTEM

**Stage:** TRANSLATION_SYSTEM  
**Phase:** 03_BACKOFFICE_CORE/01_FOUNDATION  
**Stage Directory:** 019-translation-system  
**Generated On:** 2026-03-01

---

## Purpose

This guide explains how to validate the translation system implementation end-to-end. Share with QA
engineers and reviewing developers before merge.

---

## Summary of Delivered Behavior

The translation system provides a complete multi-language content layer for Zidney's exam platform.
Staff users can upsert, list, and delete translations for exam entities (questions, exams, choices,
passages) per language. Coverage is tracked and cached in Redis. When a workspace removes a
supported language, translations are either deleted synchronously (≤10,000 rows) or queued for async
batched deletion via the DRAIN_LANGUAGE_TRANSLATIONS worker job.

Key outcomes:

- Staff can upsert translations for any supported language via `POST /translations`
- Staff can list existing translations with pagination via `GET /translations`
- Coverage percentage per entity type is available via `GET /translations/coverage`
- Removing a supported language triggers automatic cleanup (sync or async)
- Audit log tracks all translation creates, updates, and deletes
- Default language cannot be translated (returns 422)

---

## Prerequisites

| Requirement                        | Validation Command / Check                               |
| ---------------------------------- | -------------------------------------------------------- |
| Bun installed                      | `bun --version` (v1+)                                    |
| Docker running                     | `docker ps`                                              |
| `.env` present                     | Check `.env.local` or `.env` at repo root                |
| Migrations applied                 | `bun run db:migrate`                                     |
| Redis running                      | `docker ps` → redis container up                         |
| Correct branch                     | `git branch` shows `019-translation-system`              |
| Workspace with supported_languages | Workspace settings must have `['en', 'ar']` (or similar) |

---

## Files in Scope

```text
packages/domain-core/src/translation/translatable-fields.ts
packages/domain-core/src/translation/translation.types.ts
packages/domain-core/src/translation/translation.errors.ts
packages/domain-core/src/translation/translation.service.ts
packages/domain-core/src/translation/coverage.service.ts
apps/api/src/db/tenant/migrations/20260301_001_translation_system.ts
apps/api/src/db/tenant/schemas/translations.schema.ts
apps/api/src/db/tenant/schemas/translation-audit-logs.schema.ts
apps/api/src/modules/translation/translation.repository.ts
apps/api/src/modules/translation/translation.context.ts
apps/api/src/modules/translation/translation.validation.ts
apps/api/src/routes/backoffice/translations/post-upsert.ts
apps/api/src/routes/backoffice/translations/get-translations.ts
apps/api/src/routes/backoffice/translations/get-coverage.ts
apps/api/src/routes/backoffice/translations/index.ts
apps/api/src/app.ts
apps/api/src/modules/workspace-settings/workspace-settings.service.ts
apps/api/src/modules/workspace-settings/workspace-settings.routes.ts
apps/worker/src/jobs/drain-language-translations.ts
packages/types/src/job-envelope.ts
```

---

## Local Run Commands

```bash
# Install dependencies
bun install

# Apply migrations (tenant DB)
bun run db:migrate

# Start API
bun run dev:api

# Start worker
bun run dev:worker
```

---

## Automated Validation Commands

```bash
# Unit tests (all translation unit tests — no DB required)
bun run test tests/unit/translation/

# Integration tests (requires running DB + Redis)
bun run test tests/integration/translation/

# Full unit suite
bun test:unit
```

Expected outcome: 72 unit tests pass, 4 integration test files execute successfully.

---

## Manual Test Scenarios

### Scenario 1 — Create translations for a question

**Purpose:** Verify that staff can upsert translations in a supported language for a question
entity.

1. Authenticate as staff user on a workspace with `supported_languages: ['en', 'ar']`
2. Send `POST /api/backoffice/translations` with:
   ```json
   {
     "items": [
       {
         "entity_type": "question",
         "entity_id": "q-001",
         "field_name": "title",
         "language_code": "ar",
         "translated_value": "ما هو العاصمة؟"
       }
     ]
   }
   ```
3. Verify response: `HTTP 200`, `"success": true`, `"data": { "saved": 1 }`

Expected:

- Row inserted in `translations` table:
  `(entity_type=question, entity_id=q-001, field_name=title, language_code=ar)`
- Audit log entry with `action='upserted'`

Troubleshooting:

- `422 UNSUPPORTED_LANGUAGE` → `ar` not in workspace `supported_languages`
- `422 DEFAULT_LANGUAGE_WRITE` → you're targeting the workspace's default language (e.g. `en`)
- `422 INVALID_FIELD_NAME` → `title` not in the translatable fields for `question`

---

### Scenario 2 — Read translations with fallback

**Purpose:** Verify that listing translations returns correct values with default-language fallback.

1. Create a question with Arabic translation for `title` only (not `body`)
2. Send `GET /api/backoffice/translations?entity_type=question&entity_id=q-001&language_code=ar`
3. Verify response includes both fields:
   - `title` → from `translations` table (Arabic value, `source: "translated"`)
   - `body` → fallback from original entity (English value, `source: "original"`)

Expected:

- HTTP 200
- All translatable fields for the entity present in response
- Fields with translations show `source: "translated"`
- Fields without translations show `source: "original"` or `source: "fallback"`

Troubleshooting:

- Missing fields → check `TRANSLATABLE_FIELDS` registry in `translatable-fields.ts`
- 404 → entity not found via `EntityValidator` for the entity type

---

### Scenario 3 — Coverage computation (Edge Case)

**Purpose:** Verify that coverage correctly reflects % of translated fields across all entities.

1. Create 5 questions in the workspace
2. Translate `title` for 3 of them into Arabic (total field coverage = 3/5 = 60% for `title` field
   only; full coverage depends on field count)
3. Send `GET /api/backoffice/translations/coverage?entity_type=question&language_code=ar`

Expected:

- HTTP 200, `"success": true`
- `data.coverage_percent` > 0
- `data.entity_type = "question"`, `data.language_code = "ar"`
- Subsequent identical request returns same value from Redis cache (verify `redis.get` within TTL)

Troubleshooting:

- `422 UNSUPPORTED_LANGUAGE` → `ar` is not in `supported_languages`
- `null` result → requesting coverage for the default language (by design, returns null)

---

### Scenario 4 — Language removal sync path (≤10,000 rows)

**Purpose:** Verify that removing a language from supported_languages cleans up translations
synchronously when row count is low.

1. Workspace has `supported_languages: ['en', 'ar']`
2. Less than 10,000 Arabic translations exist
3. Send `PUT /api/backoffice/workspace-settings/language` to remove `ar`
4. Verify response: HTTP 200

Expected:

- Arabic translations deleted from `translations` table
- `supported_languages` updated (no longer contains `ar`)
- Audit log entries with `reason='language_removed'`
- Coverage cache invalidated for the workspace

Troubleshooting:

- `409 LANGUAGE_REMOVAL_REQUIRES_ASYNC` → unexpected (row count > threshold triggers async path;
  only expected if sync threshold is exceeded)
- Default language removal → should return 422

---

### Scenario 5 — Language removal async path (>10,000 rows / DRAIN job)

**Purpose:** Verify that the DRAIN worker correctly batches and completes deletion when row count
exceeds threshold.

1. Workspace has `supported_languages: ['en', 'ar']`
2. More than 10,000 Arabic translations exist (seed via test fixture)
3. Trigger language removal via `PUT /api/backoffice/workspace-settings/language`
4. Verify response: HTTP 202 (async)
5. Monitor worker logs for `drain_batch` and `drain_complete` events

Expected worker behavior:

- `BEGIN` → `DELETE ... WHERE id IN (SELECT id ... LIMIT batch_size)` →
  `INSERT INTO translation_audit_logs` → `COMMIT` (repeated per batch)
- Final: `UPDATE workspace_settings` removes language, coverage SCAN invalidation
- Worker log: `"event": "drain_complete", "total_deleted": N, "batches_processed": M`

Troubleshooting:

- Job not appearing in queue → check worker startup and queue connection
- `drain_failed` log → inspect error field; usually DB connection issue or schema mismatch

---

## Negative Cases

| Scenario                            | Trigger                                                                   | Expected Response            |
| ----------------------------------- | ------------------------------------------------------------------------- | ---------------------------- |
| Translate into default language     | `POST /translations` with `language_code` = workspace default language    | `422 DEFAULT_LANGUAGE_WRITE` |
| Translate into unsupported language | `POST /translations` with `language_code=zh` not in `supported_languages` | `422 UNSUPPORTED_LANGUAGE`   |
| Invalid field name                  | `POST /translations` with `field_name=nonexistent_field`                  | `422 INVALID_FIELD_NAME`     |
| Unknown entity type                 | `POST /translations` with `entity_type=nonexistent`                       | `422 UNKNOWN_ENTITY_TYPE`    |
| Coverage for default language       | `GET /translations/coverage?language_code=en` (default)                   | `200` with `data: null`      |
| Remove default language             | `PUT /workspace-settings/language` removing default language              | `422`                        |

All error responses follow:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "UNSUPPORTED_LANGUAGE",
    "message": "Human-readable message"
  }
}
```

---

## Multi-Tenant Isolation Verification

1. Use two workspaces: `workspace-a` and `workspace-b`.
2. Create translations under `workspace-a` for `question/q-001/title/ar`.
3. Repeat the same `GET /translations?entity_type=question&entity_id=q-001` request using
   `workspace-b` credentials.
4. Expected: `workspace-b` must return only its own translations — never `workspace-a` data.

If any cross-workspace data appears, stop testing and report immediately.

---

## Structured Log Verification

```bash
# API logs (pretty-printed)
bun run dev:api | bunx pino-pretty

# Worker logs
bun run dev:worker | bunx pino-pretty
```

Confirm the presence of:

- `"level"` in every log line
- `"workspace_slug"` on all tenant-bound requests
- `"correlation_id"` propagated from API to worker
- `"event"` field describing the operation

---

## Database Verification

```bash
# Connect to tenant DB
bun run db:console --workspace <workspace_slug>
```

| Table                    | Verification Query                                                                     |
| ------------------------ | -------------------------------------------------------------------------------------- |
| `translations`           | `SELECT COUNT(*) FROM translations WHERE language_code = 'ar';`                        |
| `translation_audit_logs` | `SELECT action, reason, COUNT(*) FROM translation_audit_logs GROUP BY action, reason;` |

---

## Sign-Off Checklist

- [ ] All 72 unit tests pass (`bun run test tests/unit/translation/`)
- [ ] Integration test scenarios pass (DB environment)
- [ ] Manual scenarios 1–5 pass
- [ ] Negative cases return correct error contract
- [ ] Multi-tenant isolation confirmed (no cross-workspace leakage)
- [ ] DRAIN worker completes successfully in worker logs
- [ ] No `console.log` or stack traces exposed in API responses
- [ ] Logs include `workspace_slug` and `correlation_id`

---

## References

- `specs/runtime/019-translation-system/reports/IMPLEMENT_REPORT.md`
- `specs/runtime/019-translation-system/reports/PLAN_REPORT.md`
- `specs/runtime/019-translation-system/audits/VALIDATION_REPORT.md`
- `specs/runtime/019-translation-system/contracts/api-endpoints.md`

---

Generated by Zidney Orchestrator Hard Mode v1.2.0.
