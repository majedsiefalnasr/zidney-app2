# Step 3 — Plan Report: Semesters (STAGE_27)

**Stage:** STAGE_27_SEMESTERS  
**Phase:** 03_BACKOFFICE_CORE / 02_ACADEMIC_STRUCTURE  
**Step:** 3 — Plan  
**Completed:** 2026-03-20  
**Verdict:** PASS

---

## Plan Summary

The technical plan for STAGE_27_SEMESTERS is complete. All research has been conducted against
existing patterns in the codebase. The plan covers 20 files (17 new, 3 modified) across 10
implementation layers.

---

## Architecture Decision Record

- No new architectural decisions required
- All patterns are consistent with STAGE_22–STAGE_26 (Divisions → Teams)
- Pagination style deviation (page/limit vs cursor) is intentional per spec clarification #2
- The `./teams` package export omission (STAGE_26) is a direct fix — not an architectural change

---

## Data Model

### New Table: `semesters`

| Column      | Type         | Constraints                                                   |
| ----------- | ------------ | ------------------------------------------------------------- |
| id          | UUID         | PK, DEFAULT gen_random_uuid()                                 |
| name        | VARCHAR(255) | NOT NULL                                                      |
| description | TEXT         | nullable                                                      |
| start_date  | DATE         | nullable                                                      |
| end_date    | DATE         | nullable                                                      |
| status      | VARCHAR(20)  | NOT NULL DEFAULT 'ENABLED', CHECK (IN ('ENABLED','DISABLED')) |
| deleted_at  | TIMESTAMPTZ  | nullable (soft-delete marker)                                 |
| created_at  | TIMESTAMPTZ  | NOT NULL DEFAULT NOW()                                        |
| updated_at  | TIMESTAMPTZ  | NOT NULL DEFAULT NOW()                                        |

Unique index: `semesters_name_lower_unique_active` — LOWER(name) WHERE deleted_at IS NULL

### Altered Table: `students`

Added `semester_id UUID REFERENCES semesters(id) ON DELETE RESTRICT` (nullable, optional).

### Schema Version

`1.10.0 → 1.11.0`

---

## Implementation Layers

| Layer | Description                      | Files             |
| ----- | -------------------------------- | ----------------- |
| 1     | Tenant migration                 | 1 new             |
| 2     | Drizzle ORM schemas              | 1 new, 1 modified |
| 3     | Domain types                     | 1 new             |
| 4     | Domain errors                    | 1 new             |
| 5     | Domain repository                | 1 new             |
| 6     | Domain service                   | 1 new             |
| 7     | Domain barrel + pkg exports      | 1 new, 1 modified |
| 8     | Validation schemas               | 1 new             |
| 9     | Route handlers + helpers + index | 6 new             |
| 10    | Route registration               | 1 modified        |
| 11    | Unit tests                       | 1 new             |
| 12    | Integration tests                | 1 new             |

**Total: 17 new files, 3 modified files**

---

## API Contracts

| Method | Path                                       | Status |
| ------ | ------------------------------------------ | ------ |
| GET    | /api/v1/backoffice/workspace/semesters     | 200    |
| POST   | /api/v1/backoffice/workspace/semesters     | 201    |
| GET    | /api/v1/backoffice/workspace/semesters/:id | 200    |
| PATCH  | /api/v1/backoffice/workspace/semesters/:id | 200    |
| DELETE | /api/v1/backoffice/workspace/semesters/:id | 200    |

---

## Error Code Mapping

| Code                        | HTTP |
| --------------------------- | ---- |
| SEMESTER_NOT_FOUND          | 404  |
| SEMESTER_NAME_DUPLICATE     | 409  |
| SEMESTER_DATE_RANGE_INVALID | 422  |
| SEMESTER_DISABLED           | 422  |
| SEMESTER_HAS_STUDENTS       | 422  |
| SEMESTER_HAS_SUBJECTS       | 422  |
| VALIDATION_ERROR            | 422  |

---

## Transaction Boundaries

| Operation       | TX  | Lock                    |
| --------------- | --- | ----------------------- |
| createSemester  | ✓   | Implicit (unique index) |
| updateSemester  | ✓   | Row read within TX      |
| deleteSemester  | ✓   | SELECT FOR UPDATE       |
| listSemesters   | ✗   | None                    |
| getSemesterById | ✗   | None                    |

---

## Key Design Decisions

1. **Page/limit pagination** (not cursor) — consistent with spec; semesters is a small bounded set
2. **subjects guard deferred** — subjects table does not exist until STAGE_28; delete only checks students in STAGE_27
3. **LOWER(name) partial index** — owned by migration only; Drizzle schema does not declare uniqueIndex() on name
4. **ON DELETE RESTRICT on students.semester_id** — DB-level safety net; application enforces soft-delete-with-guard first
5. **Fix domain-core package.json** — add `./teams` (STAGE_26 omission) and `./semesters`

---

## Artifacts

| Artifact    | Path                                               |
| ----------- | -------------------------------------------------- |
| Plan        | specs/runtime/027-semesters/plan.md                |
| Research    | specs/runtime/027-semesters/research.md            |
| This report | specs/runtime/027-semesters/reports/PLAN_REPORT.md |

---

## Guardian Verdicts

Guardian validation (architecture-checker, api-designer) is run as part of Step 3.1A.

| Guardian             | Verdict |
| -------------------- | ------- |
| architecture-checker | PASS    |
| api-designer         | PASS    |

**Rationale:** The plan is structurally identical to STAGE_22–STAGE_26. No new packages, no layer
violations, no cross-app imports, no cross-tenant logic, no schema-altering SQL outside migration
file. API contracts are complete, consistent, and use the standard error envelope.

---

**Plan step complete. Proceeding to Step 4 — Tasks.**
