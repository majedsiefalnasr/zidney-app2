---
# Pull Request — Zidney Hard Mode

## 1. Stage & Phase

- Phase: 03_BACKOFFICE_CORE / 02_ACADEMIC_STRUCTURE
- Stage: STAGE_27_SEMESTERS — Semesters
- Branch: `spec/027-semesters`
- Stage Directory: `specs/runtime/027-semesters/`
- Stage File: `specs/phases/03_BACKOFFICE_CORE/02_ACADEMIC_STRUCTURE/STAGE_27_SEMESTERS.md`
- Stage Status Before PR: IN PROGRESS
- Stage Status After PR: PRODUCTION READY

---

## 2. PR Type

- [x] Feature
- [ ] Architectural Change
- [ ] Infrastructure / Governance
- [ ] Security Hardening
- [ ] Refactor (No Behavior Change)
- [ ] Documentation
- [ ] Test Coverage
- [ ] Bug Fix

---

## 3. Executive Summary

- Introduces `semesters` as a first-class academic structure entity in the Backoffice — tenants can manage academic calendars with named, dated, status-controlled semesters
- Adds a nullable `semester_id` FK to the `students` table, enabling student-to-semester assignment (full assignment workflow deferred to STAGE_28)
- Delivers five REST endpoints (`GET /semesters`, `POST /semesters`, `GET /semesters/:id`, `PATCH /semesters/:id`, `DELETE /semesters/:id`) with complete domain logic, Zod validation, and structured error codes
- Deletion is guarded by enrolled-student count (transactional `SELECT FOR UPDATE` lock) — safety guard for STAGE_28's subject guard is code-present but dormant until subjects table exists
- All writes use explicit `BEGIN/COMMIT/ROLLBACK` transactions; tenant isolation is enforced via resolver context through the entire stack; no global DB singleton; Zidney Constitution v1.2.0 fully respected

---

## 4. Workflow Completion Evidence

Stage Directory: `specs/runtime/027-semesters/`

| Step      | Status      | Report Link                                             |
| --------- | ----------- | ------------------------------------------------------- |
| Specify   | ✅ Complete | specs/runtime/027-semesters/reports/SPECIFY_REPORT.md   |
| Clarify   | ✅ Complete | specs/runtime/027-semesters/reports/CLARIFY_REPORT.md   |
| Plan      | ✅ Complete | specs/runtime/027-semesters/reports/PLAN_REPORT.md      |
| Tasks     | ✅ Complete | specs/runtime/027-semesters/reports/TASKS_REPORT.md     |
| Analyze   | ✅ Complete | specs/runtime/027-semesters/audits/ANALYZE_REPORT.md    |
| Implement | ✅ Complete | specs/runtime/027-semesters/reports/IMPLEMENT_REPORT.md |
| Closure   | ✅ Complete | specs/runtime/027-semesters/reports/CLOSURE_REPORT.md   |

---

## 5. Constitutional Compliance Checklist

Confirm compliance with Zidney Constitution v1.2.0:

- [x] ADR-0001 — Database-per-tenant isolation preserved
- [x] ADR-0002 — Snapshot immutability enforced (N/A for this stage)
- [x] ADR-0006 — Server-authoritative time only (`NOW()` in all SQL; no client timestamps)
- [x] ADR-0007 — Version compatibility enforced (schema_version 1.10.0 → 1.11.0)
- [x] ADR-0008 — Semantic versioning respected (minor bump for additive schema change)
- [x] No cross-tenant access introduced
- [x] No middleware bypass created
- [x] No shared mutable global state introduced
- [x] ARCHITECTURE_MAP.json rules preserved (`apps/api` imports only from `packages/`)

---

## 6. Isolation & Security Verification

- [x] No cross-workspace joins
- [x] No default DB fallback (`getDb(c)` from `c.get('db')` tenant context only)
- [x] All queries scoped to workspace (tenant resolver context propagated)
- [x] Structured logging (no console.log — `createLogger('semesters-route:<handler>')`)
- [x] Error contract compliance (`{success, data, error}` via `successResponse` / `semestersErrorResponse`)
- [x] Sensitive data not logged (only IDs and non-sensitive fields in log entries)

---

## 7. Transaction & Concurrency Safety

- [x] All write operations wrapped in transactions (`createSemester`, `updateSemester`, `deleteSemester`)
- [x] Proper isolation level declared (default read-committed; explicit `FOR UPDATE` where needed)
- [x] Explicit locking defined where required (`lockSemesterForUpdate` using `SELECT … FOR UPDATE`)
- [x] Idempotency guarantees preserved (partial unique index on `LOWER(name) WHERE deleted_at IS NULL`; locks prevent concurrent double-delete)
- [x] No race conditions introduced

---

## 8. Observability & Monitoring

- [x] Structured logging enforced (`@zidney/logger` in every route handler)
- [x] Correlation IDs propagated (via Hono context `c.get('correlationId')`)
- [ ] Metrics added or updated (out of scope for this stage)
- [ ] Alerts updated (out of scope for this stage)

---

## 9. Testing Coverage

- [x] Unit tests added — `packages/domain-core/src/semesters/__tests__/semesters.service.test.ts` (15 cases)
- [x] Integration tests added — `apps/api/src/routes/backoffice/semesters/__tests__/semesters.integration.test.ts` (13 cases)
- [x] Edge cases covered (NOT_FOUND, NAME_DUPLICATE, DATE_RANGE_INVALID, HAS_STUDENTS, empty list, partial update, soft-delete then not found)
- [x] Concurrency scenarios tested (deleteSemester lock guard via FOR UPDATE)
- [x] Coverage threshold met (all service functions and all route handlers covered)

Test Commands:

```bash
# Unit tests
bun run test run packages/domain-core/src/semesters/__tests__/semesters.service.test.ts

# Integration tests
bun run test run apps/api/src/routes/backoffice/semesters/__tests__/semesters.integration.test.ts
```

---

## 10. Migration Impact

- [x] New migrations included — `apps/api/src/db/tenant/migrations/20260320_005_semesters.ts`
- [x] Backward compatibility verified — `semester_id` on students is nullable; no existing data affected
- [x] Rollback strategy defined — snapshot restore only (forward-only migration policy)
- [x] No untracked schema changes

**Schema changes:**

```sql
CREATE TABLE semesters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'ENABLED' CHECK (status IN ('ENABLED','DISABLED')),
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_semesters_status ON semesters(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_semesters_created_at ON semesters(created_at DESC) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX idx_semesters_name_unique ON semesters(LOWER(name)) WHERE deleted_at IS NULL;

ALTER TABLE students ADD COLUMN semester_id UUID REFERENCES semesters(id) ON DELETE RESTRICT;
CREATE INDEX idx_students_semester_id ON students(semester_id);

-- schema_version bump: 1.10.0 → 1.11.0
```

---

## 11. Drift Analysis

- [x] speckit.analyze executed (STAGE_27 Step 5)
- [x] No architectural violations
- [x] No cross-phase leakage
- [x] No unauthorized stage modification
- [x] ANALYZE_REPORT.md confirms APPROVED

---

## 12. Files Changed Summary

**New files (18):**

```
apps/api/src/db/tenant/migrations/20260320_005_semesters.ts
apps/api/src/db/tenant/schemas/semesters.schema.ts
packages/domain-core/src/semesters/semesters.types.ts
packages/domain-core/src/semesters/semesters.errors.ts
packages/domain-core/src/semesters/semesters.repository.ts
packages/domain-core/src/semesters/semesters.service.ts
packages/domain-core/src/semesters/index.ts
packages/validation/src/backoffice/semesters.schemas.ts
apps/api/src/routes/backoffice/semesters/helpers.ts
apps/api/src/routes/backoffice/semesters/list-semesters.ts
apps/api/src/routes/backoffice/semesters/create-semester.ts
apps/api/src/routes/backoffice/semesters/get-semester.ts
apps/api/src/routes/backoffice/semesters/update-semester.ts
apps/api/src/routes/backoffice/semesters/delete-semester.ts
apps/api/src/routes/backoffice/semesters/index.ts
packages/domain-core/src/semesters/__tests__/semesters.service.test.ts
apps/api/src/routes/backoffice/semesters/__tests__/semesters.integration.test.ts
specs/runtime/027-semesters/  (all workflow artifacts)
```

**Modified files (3):**

```
apps/api/src/db/tenant/schemas/students.schema.ts  ← added semester_id FK
packages/domain-core/package.json                  ← added ./semesters + fixed ./teams exports
apps/api/src/app.ts                                ← semestersRouter import + mount
```

---

## 13. Reviewer Checklist

- [ ] Migration looks safe (nullable FK, no existing data impact)
- [ ] `semesterNameExists` uses `SELECT EXISTS` pattern — returns `{ exists: boolean }`
- [ ] `deleteSemester` uses `SELECT … FOR UPDATE` for concurrency safety
- [ ] All route handlers follow `{success, data, error}` response contract
- [ ] `countSubjectsForSemester` stub returns 0 — acceptable until STAGE_28
- [ ] Unit tests cover all 5 service functions
- [ ] Integration tests cover all 5 handlers
- [ ] TypeScript clean, lint clean

---

## 14. STAGE_28 Dependencies

The following STAGE_28 items are unblocked by this PR:

| STAGE_28 Task                                   | Prerequisite from STAGE_27               |
| ----------------------------------------------- | ---------------------------------------- |
| Subjects table with `semester_id` FK            | `semesters.id` PK exists                 |
| `countSubjectsForSemester` implementation       | Subjects FK linkage                      |
| `SEMESTER_HAS_SUBJECTS` guard                   | `countSubjectsForSemester` returning > 0 |
| Student-to-semester assignment in Backoffice UI | `students.semester_id` FK column exists  |
