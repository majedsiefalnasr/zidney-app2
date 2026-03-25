# Testing Guide — Category Values

**Stage:** Category Values (STAGE_31_CATEGORY_VALUES)  
**Phase:** 03_BACKOFFICE_CORE / 03_CONTENT_CLASSIFICATION  
**Stage Directory:** 031-category-values  
**Generated On:** 2026-03-22T17:30:00.000Z

---

## Purpose

This guide explains how to validate the Category Values feature end-to-end — both via automated tests
and manual API calls.

---

## Summary of Delivered Behavior

Category Values are structured classification entries that belong to a Category (e.g. Category
"Difficulty" → Values "Easy", "Medium", "Hard"). They support multi-language translations, optional
subject/division scope constraints, and a governed status lifecycle (COMPLETED → UNDER_REVIEW →
APPROVED → ENABLED/DISABLED).

Key outcomes:

- A backoffice operator can create, list, retrieve, update, and soft-delete Category Values
- Each value can have translations in multiple languages and be scoped to specific subjects or divisions
- Status transitions are enforced server-side (e.g. ENABLED values cannot be re-created)
- Write operations require `question_manage` or `classification_manage` permission
- Soft-delete is idempotent — repeated DELETE calls are always safe

---

## Prerequisites

| Requirement                | Validation Command / Check                                    |
| -------------------------- | ------------------------------------------------------------- |
| Bun installed              | `bun --version` (v1+)                                         |
| Docker running             | `docker ps`                                                   |
| Environment file present   | Verify `.env` or `.env.local` exists                          |
| Migrations applied         | `bun run db:migrate`                                          |
| Correct branch checked out | `git branch` shows `spec/031-category-values`                 |
| Test tenant exists         | Workspace slug configured in test env (`TEST_WORKSPACE_SLUG`) |

---

## Files in Scope

```text
apps/api/src/db/tenant/migrations/20260322_009_category_values.ts
apps/api/src/db/tenant/schemas/category-values.schema.ts
apps/api/src/db/tenant/schemas/category-value-subjects.schema.ts
apps/api/src/db/tenant/schemas/category-value-divisions.schema.ts
apps/api/src/db/tenant/schemas/index.ts
apps/api/src/routes/backoffice/category-values/helpers.ts
apps/api/src/routes/backoffice/category-values/list-category-values.ts
apps/api/src/routes/backoffice/category-values/create-category-value.ts
apps/api/src/routes/backoffice/category-values/get-category-value.ts
apps/api/src/routes/backoffice/category-values/update-category-value.ts
apps/api/src/routes/backoffice/category-values/delete-category-value.ts
apps/api/src/routes/backoffice/category-values/index.ts
apps/api/src/app.ts
packages/domain-core/src/category-values/ (6 source files)
packages/domain-core/src/index.ts
packages/domain-core/package.json
packages/validation/src/backoffice/category-values.schemas.ts
```

---

## Local Run Commands

```bash
# Install dependencies
bun install

# Apply migrations
bun run db:migrate

# Start API
bun run dev:api
```

---

## Automated Validation Commands

```bash
# All 4 test suites for this stage
bun run test \
  packages/domain-core/src/category-values/__tests__/category-values.service.test.ts \
  packages/domain-core/src/category-values/__tests__/category-values.repository.test.ts \
  apps/api/src/routes/backoffice/category-values/__tests__/category-values.integration.test.ts \
  apps/api/src/db/tenant/migrations/__tests__/009_category_values.migration.test.ts

# Expected: 116 passed, 0 failed

# TypeScript check
bun run typecheck

# Expected: TypeScript compilation completed (0 errors)
```

---

## Manual Test Scenarios

### Scenario 1 — Create a Category Value

**Purpose:** Verify a value is created with status COMPLETED, translations stored, and audit fields populated.

1. Obtain a valid Bearer token for a user with `classification_manage` permission.
2. Find or create a Category with status `UNDER_REVIEW` and note its `id` (e.g. `cat-id-123`).
3. Send:

   ```http
   POST /api/v1/backoffice/workspace/{tenant}/category-values
   Authorization: Bearer <token>
   Content-Type: application/json

   {
     "category_id": "cat-id-123",
     "code": "EASY",
     "translations": [
       { "language_code": "en", "field_name": "name", "translated_value": "Easy" },
       { "language_code": "ar", "field_name": "name", "translated_value": "سهل" }
     ]
   }
   ```

4. Verify the response is `201` with `data.status === "COMPLETED"` and both translations present.

Expected:

```json
{
  "success": true,
  "data": {
    "id": "<uuid>",
    "category_id": "cat-id-123",
    "code": "EASY",
    "status": "COMPLETED",
    "translations": [...]
  },
  "error": null
}
```

Troubleshooting: If you get `422 CATEGORY_VALUE_CATEGORY_IMMUTABLE`, the category status is APPROVED/ENABLED/DISABLED. Use a category with status UNDER_REVIEW or COMPLETED instead.

---

### Scenario 2 — Status Transition: COMPLETED → UNDER_REVIEW

**Purpose:** Verify the status lifecycle is enforced and only allowed transitions succeed.

1. Create a value with status COMPLETED (Scenario 1 above).
2. Note the value `id`.
3. Send:

   ```http
   PATCH /api/v1/backoffice/workspace/{tenant}/category-values/{id}
   Authorization: Bearer <token>
   Content-Type: application/json

   { "status": "UNDER_REVIEW" }
   ```

4. Verify response `200` with `data.status === "UNDER_REVIEW"`.
5. Try to transition from UNDER_REVIEW to COMPLETED (invalid):
   ```json
   { "status": "COMPLETED" }
   ```
6. Verify response `422 INVALID_STATUS_TRANSITION`.

Expected: valid transition returns `200`; invalid transition returns `422` with `error.code === "INVALID_STATUS_TRANSITION"`.

Troubleshooting: Check the allowed transition map in `category-values.service.ts` → `ALLOWED_TRANSITIONS`.

---

### Scenario 3 — Idempotent Delete

**Purpose:** Verify that deleting an already-deleted value returns success without error.

1. Create a value (Scenario 1).
2. Send `DELETE /api/v1/backoffice/workspace/{tenant}/category-values/{id}` → expect `200 { deleted: true }`.
3. Send the same `DELETE` again → expect `200 { deleted: true }` (not `404`).

Expected: both calls return `200` with `{ "data": { "deleted": true } }`.

---

### Scenario 4 — Multi-Tenant Isolation

**Purpose:** Verify that values created in tenant A are invisible to tenant B.

1. Create a Category Value under tenant A (using tenant A's workspace slug).
2. Attempt to `GET /api/v1/backoffice/workspace/{tenant-B}/category-values/{id}` using tenant B credentials.
3. Verify the response is `404 CATEGORY_VALUE_NOT_FOUND`.

Expected: Tenant B cannot see Tenant A's data. If cross-tenant data is visible, stop and report immediately.

---

### Scenario 5 — Soft-Deleted Values Excluded by Default

**Purpose:** Verify list endpoint hides deleted values unless `include_deleted=true` with correct permission.

1. Create 3 category values under the same category.
2. Delete one of them.
3. `GET /category-values?category_id={cat-id}` → verify only 2 values returned.
4. `GET /category-values?category_id={cat-id}&include_deleted=true` with `classification_manage` permission → verify all 3 returned (including the deleted one).
5. Repeat step 4 without `classification_manage` permission → verify `403 FORBIDDEN`.

---

## Negative Cases

| Scenario                                      | Trigger                                                              | Expected Response                                               |
| --------------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------- |
| Create without permission                     | POST without `question_manage` or `classification_manage`            | `403 FORBIDDEN`                                                 |
| Create for APPROVED/ENABLED category          | `category_id` of an APPROVED category                                | `422 CATEGORY_VALUE_CATEGORY_IMMUTABLE`                         |
| Create with duplicate code (case-insensitive) | Same code `easy` and `EASY` under same category                      | `409 CATEGORY_VALUE_CODE_DUPLICATE`                             |
| Create with empty translations                | `"translations": []`                                                 | `422 VALIDATION_ERROR` (Zod min(1))                             |
| Create with unsupported language              | Translation with `language_code: "xx"` not in workspace config       | `422 UNSUPPORTED_LANGUAGE`                                      |
| Create without default-language name          | Translations array missing `field_name: "name"` for default language | `422 CATEGORY_VALUE_NAME_REQUIRED`                              |
| Get non-existent value                        | GET with unknown UUID                                                | `404 CATEGORY_VALUE_NOT_FOUND`                                  |
| Get with invalid UUID                         | GET `/category-values/not-a-uuid`                                    | `422 VALIDATION_ERROR`                                          |
| Update with `category_id` in body             | PATCH body includes `category_id`                                    | `422 VALIDATION_ERROR` (Zod strips unknown field, refine fails) |
| Invalid status transition                     | Transition UNDER_REVIEW → COMPLETED                                  | `422 INVALID_STATUS_TRANSITION`                                 |
| Delete in-use value                           | DELETE when downstream MCQ/TQ references exist                       | `422 CATEGORY_VALUE_IN_USE`                                     |
| Include deleted without permission            | `include_deleted=true` without `classification_manage`               | `403 FORBIDDEN`                                                 |

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
2. Create a Category Value under `workspace-a`.
3. Note the value `id`.
4. Attempt the same `GET /category-values/{id}` under `workspace-b` credentials.
5. Expected: `404 CATEGORY_VALUE_NOT_FOUND` from `workspace-b`.

If data leakage is observed stop and report immediately — this is a critical tenant isolation violation.

---

## Structured Log Verification

```bash
# Start API with JSON logging
bun run dev:api | jq .
```

On each request, confirm the presence of:

- `"level"` (`info`, `warn`, `error`)
- `"workspace_slug"` (tenant-bound requests)
- `"correlation_id"` (from `X-Correlation-ID` header or generated)
- `"namespace"` (e.g. `category-values-route:create`)

---

## Database Verification

```bash
# Replace <workspace_slug> with a test workspace slug
bun run db:console --workspace <workspace_slug>
```

| Table                      | Verification                                                                                         |
| -------------------------- | ---------------------------------------------------------------------------------------------------- |
| `category_values`          | Rows with `deleted_at IS NULL` for active values; `deleted_at` populated for soft-deleted            |
| `category_value_subjects`  | Rows linked to `category_values` via `category_value_id`; CASCADE deletes when value is hard-deleted |
| `category_value_divisions` | Same as subjects                                                                                     |
| `translations`             | Rows with `entity_type = 'CATEGORY_VALUE'` and `entity_id` matching value `id`                       |
| `workspace_settings`       | `settings->>'schema_version'` should equal `'1.15.0'` after migration                                |

Verify unique index:

```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'category_values'
  AND indexname = 'unique_category_values_code';
```

Expected:

```
unique_category_values_code | CREATE UNIQUE INDEX CONCURRENTLY ... ON category_values (category_id, lower(code)) WHERE deleted_at IS NULL
```

---

## Sign-Off Checklist

- [ ] All 116 automated tests pass (`vitest run`)
- [ ] TypeScript compilation returns no errors (`bun run typecheck`)
- [ ] Manual Scenario 1 (Create) passes
- [ ] Manual Scenario 2 (Status Transition) passes
- [ ] Manual Scenario 3 (Idempotent Delete) passes
- [ ] Manual Scenario 4 (Multi-Tenant Isolation) passes
- [ ] Manual Scenario 5 (Soft-Deleted Exclusion) passes
- [ ] Negative cases return correct error contract
- [ ] Multi-tenant isolation confirmed
- [ ] No `console.log` or stack traces exposed
- [ ] Logs include `workspace_slug` and `correlation_id`
- [ ] Database tables and unique index verified post-migration

---
