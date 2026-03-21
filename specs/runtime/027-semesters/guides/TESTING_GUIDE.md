# Testing Guide — Semesters (STAGE_27)

**Stage:** STAGE_27_SEMESTERS  
**Phase:** 03_BACKOFFICE_CORE / 02_ACADEMIC_STRUCTURE  
**Stage Directory:** 027-semesters  
**Generated On:** 2026-03-20

---

## Purpose

This guide explains how to validate the STAGE_27_SEMESTERS implementation end-to-end. Share it
with any developer or QA engineer who needs to verify the semesters feature after deploying or
checking out this branch.

---

## Summary of Delivered Behavior

STAGE_27 introduces **Semesters** as an academic structure entity within the Backoffice. Institutions
can create, list, retrieve, update, and soft-delete semesters. Students can be assigned a semester.
Deletion is guarded — a semester with enrolled students cannot be deleted. All data is
tenant-isolated.

Key outcomes:

- New `semesters` table with status, date range, and soft-delete support
- Students gain a nullable `semester_id` FK (STAGE_28 will enforce it meaningfully)
- Five REST endpoints: GET list, POST create, GET by-id, PATCH update, DELETE soft-delete
- Seven domain error codes with correct HTTP status codes
- Complete unit + integration test coverage

---

## Prerequisites

| Requirement                | Validation Command / Check                                           |
| -------------------------- | -------------------------------------------------------------------- |
| Bun installed              | `bun --version` (v1+)                                                |
| Docker running             | `docker ps` — Postgres container up                                  |
| Environment file present   | `.env` exists with `DATABASE_URL` pointing to test DB                |
| Migrations applied         | `bun run db:migrate -- --workspace <workspace-slug>` (or equivalent) |
| Correct branch checked out | `git branch` shows `spec/027-semesters`                              |
| Dependencies installed     | `bun install` from repo root                                         |

---

## Files in Scope

```text
apps/api/src/db/tenant/migrations/20260320_005_semesters.ts   ← migration
apps/api/src/db/tenant/schemas/semesters.schema.ts             ← Drizzle schema
apps/api/src/db/tenant/schemas/students.schema.ts              ← modified: semester_id added
packages/domain-core/src/semesters/semesters.types.ts          ← types
packages/domain-core/src/semesters/semesters.errors.ts         ← error codes
packages/domain-core/src/semesters/semesters.repository.ts     ← SQL queries
packages/domain-core/src/semesters/semesters.service.ts        ← business logic
packages/domain-core/src/semesters/index.ts                    ← exports
packages/validation/src/backoffice/semesters.schemas.ts        ← Zod schemas
apps/api/src/routes/backoffice/semesters/helpers.ts            ← route utils
apps/api/src/routes/backoffice/semesters/list-semesters.ts     ← GET /semesters
apps/api/src/routes/backoffice/semesters/create-semester.ts    ← POST /semesters
apps/api/src/routes/backoffice/semesters/get-semester.ts       ← GET /semesters/:id
apps/api/src/routes/backoffice/semesters/update-semester.ts    ← PATCH /semesters/:id
apps/api/src/routes/backoffice/semesters/delete-semester.ts    ← DELETE /semesters/:id
apps/api/src/routes/backoffice/semesters/index.ts              ← router factory
apps/api/src/app.ts                                            ← router mount
packages/domain-core/src/semesters/__tests__/semesters.service.test.ts
apps/api/src/routes/backoffice/semesters/__tests__/semesters.integration.test.ts
```

---

## Local Run Commands

```bash
# Install dependencies (from repo root)
bun install

# Apply migrations (tenant migrations)
bun run db:migrate

# Start API (development mode)
bun run dev:api

# Run only semesters unit tests
bun run test run packages/domain-core/src/semesters/__tests__/semesters.service.test.ts

# Run only semesters integration tests
bun run test run apps/api/src/routes/backoffice/semesters/__tests__/semesters.integration.test.ts

# Run all tests (note: one pre-existing flaky ai-engine timeout may appear — unrelated to semesters)
bun run test
```

---

## Automated Validation Commands

```bash
# Type check (must exit 0)
bun run typecheck

# Lint (must exit 0)
bun run lint

# Unit tests only
bun run test run packages/domain-core/src/semesters/__tests__/semesters.service.test.ts

# Integration tests only
bun run test run apps/api/src/routes/backoffice/semesters/__tests__/semesters.integration.test.ts
```

Expected outcome: all semesters tests pass, typecheck exits 0, lint exits 0.

---

## Manual Test Scenarios

### Scenario 1 — Create and List Semesters

**Purpose:** Verify a semester can be created and appears in the list.

1. Start the API: `bun run dev:api`
2. Send a POST request to create a semester:
   ```bash
   curl -X POST http://localhost:3000/api/v1/backoffice/workspace/semesters \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer <TOKEN>" \
     -d '{
       "name": "Fall 2026",
       "description": "Autumn semester",
       "start_date": "2026-09-01",
       "end_date": "2026-12-31",
       "status": "ENABLED"
     }'
   ```
3. Note the returned `id` from the response.
4. Send a GET request to list semesters:
   ```bash
   curl http://localhost:3000/api/v1/backoffice/workspace/semesters \
     -H "Authorization: Bearer <TOKEN>"
   ```

Expected: POST returns `201` with `success: true` and the created semester object. GET returns `200` with `success: true`, `data.items` contains Fall 2026, `data.total` = 1.

Troubleshooting: If 401, verify the workspace auth token is valid and the workspace slug is correct.

---

### Scenario 2 — Duplicate Name Rejection

**Purpose:** Verify the uniqueness constraint returns 409 on duplicate semester names.

1. Create a semester named "Spring 2027" (POST as in Scenario 1).
2. Immediately attempt to create another semester with the same name "Spring 2027":
   ```bash
   curl -X POST http://localhost:3000/api/v1/backoffice/workspace/semesters \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer <TOKEN>" \
     -d '{"name": "Spring 2027"}'
   ```

Expected: Second POST returns `409 Conflict` with `error.code: "SEMESTER_NAME_DUPLICATE"` and `success: false`.

Troubleshooting: If you get 201 on the second request, verify the partial unique index `idx_semesters_name_unique` was created by the migration.

---

### Scenario 3 — Delete Prevented by Enrolled Students (Edge Case)

**Purpose:** Verify that a semester with assigned students cannot be deleted.

1. Create a semester and note its `id`.
2. Assign a student to that semester (via the students API or direct DB update):
   ```bash
   # Direct DB update (dev only):
   UPDATE students SET semester_id = '<SEMESTER_ID>' WHERE id = '<STUDENT_ID>';
   ```
3. Attempt to delete the semester:
   ```bash
   curl -X DELETE http://localhost:3000/api/v1/backoffice/workspace/semesters/<SEMESTER_ID> \
     -H "Authorization: Bearer <TOKEN>"
   ```

Expected: DELETE returns `422 Unprocessable Entity` with `error.code: "SEMESTER_HAS_STUDENTS"` and `success: false`. The semester row remains intact.

Troubleshooting: If the delete succeeds (returns 200), verify the `countStudentsForSemester` query is selecting from the correct tenant DB and that the student row has `semester_id` set and `deleted_at IS NULL`.

---

### Scenario 4 — Update Semester Fields (Partial Update)

**Purpose:** Verify PATCH accepts partial updates and preserves unchanged fields.

1. Create a semester with `name = "Winter 2026"`, `start_date = "2026-01-01"`, `end_date = "2026-03-31"`.
2. PATCH only the `status` field:
   ```bash
   curl -X PATCH http://localhost:3000/api/v1/backoffice/workspace/semesters/<SEMESTER_ID> \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer <TOKEN>" \
     -d '{"status": "DISABLED"}'
   ```
3. GET the semester to verify:
   ```bash
   curl http://localhost:3000/api/v1/backoffice/workspace/semesters/<SEMESTER_ID> \
     -H "Authorization: Bearer <TOKEN>"
   ```

Expected: PATCH returns `200` with the updated semester. GET confirms `status = DISABLED` while `name`, `start_date`, and `end_date` are unchanged.

Troubleshooting: If the date fields are cleared, verify `updateSemester` in the service merges existing values with the patch payload.

---

### Scenario 5 — Soft Delete and Not Found (Edge Case)

**Purpose:** Verify soft-deleted semesters are excluded from queries and return 404.

1. Create a semester and note its `id`.
2. DELETE the semester:
   ```bash
   curl -X DELETE http://localhost:3000/api/v1/backoffice/workspace/semesters/<SEMESTER_ID> \
     -H "Authorization: Bearer <TOKEN>"
   ```
3. Attempt to GET the deleted semester:
   ```bash
   curl http://localhost:3000/api/v1/backoffice/workspace/semesters/<SEMESTER_ID> \
     -H "Authorization: Bearer <TOKEN>"
   ```
4. Check the list to confirm the semester is excluded:
   ```bash
   curl http://localhost:3000/api/v1/backoffice/workspace/semesters \
     -H "Authorization: Bearer <TOKEN>"
   ```

Expected: DELETE returns `200` with `{deleted: true}`. GET by ID returns `404` with `error.code: "SEMESTER_NOT_FOUND"`. List does not include the deleted semester.

Troubleshooting: If the deleted semester still appears in the list, verify `findSemesters` in the repository filters `WHERE deleted_at IS NULL`.

---

## Known Limitations / STAGE_28 Dependencies

| Limitation                                           | Explanation                                                                                  |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `SEMESTER_HAS_SUBJECTS` guard is dormant             | `countSubjectsForSemester` always returns 0 until STAGE_28 creates the subjects table and FK |
| Students API may not expose `semester_id` assignment | STAGE_27 only adds the FK column; student-to-semester assignment UI is STAGE_28 scope        |
