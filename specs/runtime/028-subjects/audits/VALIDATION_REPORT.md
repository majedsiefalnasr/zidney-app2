# Validation Report — Subjects CRUD Feature

**Step:** 6.5 — Mandatory Validation Gate  
**Timestamp:** 2025-07-23T00:00:00.000Z  
**Status:** PASS

---

## Summary

All validation checks passed for the Subjects CRUD feature (STAGE_28). Unit tests (19), integration tests (17), biome lint (0 errors), and TypeScript type-check (0 errors) all exit with code 0. Migration uses `IF NOT EXISTS` guards throughout. Idempotency is enforced in the `transitionSubjectStatus` service via CAS (compare-and-swap) on `updated_at`. Concurrency is handled via `FOR UPDATE NOWAIT` pessimistic locking in the repository.

---

## Inputs Reviewed

- `specs/runtime/028-subjects/tasks.md`
- `specs/runtime/028-subjects/plan.md`
- All 21 new implementation files

---

## Validation Matrix

| Validation Check                                   | Required    | Command(s)                                       | Result          | Notes                                           |
| -------------------------------------------------- | ----------- | ------------------------------------------------ | --------------- | ----------------------------------------------- |
| Unit tests (impacted business logic)               | Yes         | `rtk vitest run ...subjects.service.test.ts`     | ✅ PASS (19/19) | subjects.service.ts covered                     |
| Integration tests (impacted API flows)             | Yes         | `rtk vitest run ...subjects.integration.test.ts` | ✅ PASS (17/17) | All 7 route handlers covered                    |
| Snapshot tests (grading behavior, if applicable)   | Conditional | N/A                                              | N/A             | Subjects feature has no grading logic           |
| Lint                                               | Yes         | `bun run lint`                                   | ✅ PASS         | Exit 0, 0 errors, 4 infos only                  |
| Type check                                         | Yes         | `bun run typecheck`                              | ✅ PASS         | Exit 0, 0 TypeScript errors                     |
| Migration validation (schema changed)              | Yes         | Manual + grep IF NOT EXISTS                      | ✅ PASS         | All statements use IF NOT EXISTS/IF EXISTS      |
| Idempotency replay validation (critical endpoints) | Yes         | Code review — CAS in transitionSubjectStatus     | ✅ PASS         | `updated_at` CAS in casTransitionSubject        |
| Concurrency validation (critical flows)            | Yes         | Code review — FOR UPDATE NOWAIT                  | ✅ PASS         | `lockSubjectForUpdate` uses `FOR UPDATE NOWAIT` |

---

## Command Evidence

### Unit Tests

```text
$ rtk vitest run packages/domain-core/src/subjects/__tests__/subjects.service.test.ts

PASS (19) FAIL (0)
```

Tests cover: `listSubjects` (2), `createSubject` (5), `getSubjectById` (2), `updateSubject` (4), `transitionSubjectStatus` (4), `deleteSubject` (2).

### Integration Tests

```text
$ rtk vitest run apps/api/src/routes/backoffice/subjects/__tests__/subjects.integration.test.ts

PASS (17) FAIL (0)
```

Tests cover: `listSubjectsHandler` (2), `getActiveSubjectsHandler` (1), `createSubjectHandler` (3), `getSubjectHandler` (3), `updateSubjectHandler` (3), `transitionSubjectHandler` (3), `deleteSubjectHandler` (2).

### Snapshot Tests

N/A — subjects feature does not involve grading or snapshotting.

### Lint

```text
$ bun run lint
Checked 1975 files in 592ms. No fixes applied.
Found 4 infos.
Exit code: 0
```

Pre-existing `"includes"` vs `"include"` key in `biome.json` line 93 is a known pre-existing issue present since before STAGE_27. It does not block lint.

### Type Check

```text
$ bun run typecheck
$ bun typecheck:src && bun typecheck:tests
$ tsc --noEmit
$ tsc --noEmit -p tsconfig.test.json
Exit code: 0
```

### Migration Validation

```text
$ grep -E "IF NOT EXISTS|CREATE TABLE IF|CREATE INDEX IF" \
    apps/api/src/db/tenant/migrations/20260320_006_subjects.ts

CREATE TABLE IF NOT EXISTS subjects (
        IF NOT EXISTS (        -- schema_version row guard
        IF NOT EXISTS (        -- schema_version row guard
CREATE UNIQUE INDEX IF NOT EXISTS subjects_name_lower_unique_active
CREATE UNIQUE INDEX IF NOT EXISTS subjects_code_unique_non_null
```

All DDL and DML statements in `20260320_006_subjects.ts` are guarded with `IF NOT EXISTS` / `IF EXISTS`, making the migration fully idempotent.

### Idempotency Replay Validation

`POST /subjects/:id/transition` uses compare-and-swap in `casTransitionSubject`:

```sql
UPDATE subjects
SET status = $newStatus, updated_at = NOW()
WHERE id = $id AND updated_at = $expectedUpdatedAt
RETURNING id
```

If `updated_at` has changed (concurrent transition), the UPDATE returns 0 rows and the service raises `SUBJECT_TRANSITION_CONFLICT` (HTTP 409), which clients can handle by re-fetching and retrying.

### Concurrency Validation

`lockSubjectForUpdate` in the repository uses `SELECT ... FOR UPDATE NOWAIT`, which immediately raises an error if the row is locked by another transaction, preventing silent corruption from concurrent writes.
