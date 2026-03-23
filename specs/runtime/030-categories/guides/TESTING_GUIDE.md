# Testing Guide — Categories (Classification Dimensions)

**Stage:** STAGE_30_CATEGORIES — Categories (Classification Dimensions)  
**Phase:** 03_BACKOFFICE_CORE / 03_CONTENT_CLASSIFICATION  
**Stage Directory:** specs/runtime/030-categories  
**Generated On:** 2026-03-22

---

## Purpose

This guide explains how to validate the categories implementation end-to-end — covering automated tests, migration verification, and manual API scenarios for QA engineers and reviewing developers.

---

## Summary of Delivered Behavior

Categories are classification dimensions used to tag and organize exam questions. Examples include "Difficulty", "Bloom Level", "Topic Type", "Cognitive Skill", and "Question Source".

Key outcomes:

- Tenant-isolated CRUD for categories within one PostgreSQL schema per tenant
- Hierarchical categories with a maximum depth of 4 levels (root + 3 levels of children)
- Soft-delete semantics — categories are disabled, never hard-deleted
- Subject and division scope associations on each category
- O(N) tree assembly for nested category views
- Permission enforcement: `classification:manage` or `question:manage` required for write operations
- Schema version enforcement: requires tenant schema ≥ `1.14.0`
- Platform rate limiting: 30 req/min writes, 120 req/min reads

---

## Prerequisites

| Requirement                | Validation Command / Check                             |
| -------------------------- | ------------------------------------------------------ |
| Bun installed              | `bun --version` (v1+)                                  |
| Docker running             | `docker ps` — PostgreSQL container must be up          |
| Environment file present   | `.env` or `.env.test` exists at repo root              |
| Correct branch checked out | `git branch` shows `spec/030-categories`               |
| Migrations applied         | `bun run db:migrate` (or migration runs in test setup) |

---

## Files in Scope

```text
apps/api/src/db/tenant/migrations/20260322_008_categories.ts
apps/api/src/db/tenant/schemas/categories.schema.ts
apps/api/src/db/tenant/schemas/category-subjects.schema.ts
apps/api/src/db/tenant/schemas/category-divisions.schema.ts
apps/api/src/db/tenant/schemas/index.ts
packages/domain-core/src/categories/categories.types.ts
packages/domain-core/src/categories/categories.errors.ts
packages/domain-core/src/categories/categories.repository.ts
packages/domain-core/src/categories/categories.tree.ts
packages/domain-core/src/categories/categories.dependency-registry.ts
packages/domain-core/src/categories/categories.service.ts
packages/domain-core/src/categories/index.ts
packages/validation/src/backoffice/categories.schemas.ts
apps/api/src/routes/backoffice/categories/helpers.ts
apps/api/src/routes/backoffice/categories/list-categories.ts
apps/api/src/routes/backoffice/categories/get-category-tree.ts
apps/api/src/routes/backoffice/categories/get-category.ts
apps/api/src/routes/backoffice/categories/create-category.ts
apps/api/src/routes/backoffice/categories/update-category.ts
apps/api/src/routes/backoffice/categories/delete-category.ts
apps/api/src/routes/backoffice/categories/index.ts
apps/api/src/app.ts
packages/domain-core/src/categories/__tests__/categories.service.test.ts
apps/api/src/routes/backoffice/categories/__tests__/categories.integration.test.ts
```

---

## Local Run Commands

```bash
# Install dependencies
bun install

# Start API in dev mode
bun run dev:api

# Apply tenant migration (if not auto-applied)
bun run db:migrate
```

---

## Automated Validation Commands

```bash
# Unit tests (26 cases — service layer)
bun run test packages/domain-core/src/categories/__tests__/categories.service.test.ts

# Integration tests (28 cases — HTTP API layer)
bun run test apps/api/src/routes/backoffice/categories/__tests__/categories.integration.test.ts

# Both together
bun run test \
  packages/domain-core/src/categories/__tests__/categories.service.test.ts \
  apps/api/src/routes/backoffice/categories/__tests__/categories.integration.test.ts

# Lint check
bun run lint

# TypeScript type check
bun run typecheck
```

Expected outcome: **54 tests pass, 0 failures, 0 lint errors, 0 type errors.**

---

## Migration Verification

Check the migration ran cleanly and phase ordering is correct:

```bash
# Confirm tables exist in tenant DB
psql $TENANT_DB_URL -c "\dt categories"
psql $TENANT_DB_URL -c "\dt category_subjects"
psql $TENANT_DB_URL -c "\dt category_divisions"

# Confirm schema version was bumped
psql $TENANT_DB_URL -c "SELECT version FROM _schema_versions ORDER BY applied_at DESC LIMIT 1;"
# Expected: 1.14.0

# Confirm CONCURRENT indexes exist (created outside transaction)
psql $TENANT_DB_URL -c "\di unique_categories_name"
psql $TENANT_DB_URL -c "\di unique_categories_code"

# Confirm permission seeds exist
psql $MASTER_DB_URL -c "SELECT code FROM permissions WHERE code IN ('classification:manage', 'question:manage');"
```

---

## Manual Test Scenarios

### Scenario 1 — Create a root category with subject and division scope

**Purpose:** Verify that `POST /categories` creates a category, associates subject and division IDs, and returns the full scoped row.

1. Authenticate as a user with `classification:manage` permission.
2. Call `POST /api/backoffice/{workspace}/categories` with body:
   ```json
   {
     "name": "Difficulty",
     "code": "DIFFICULTY",
     "description": "Bloom-based difficulty axis",
     "subject_ids": ["<valid-subject-uuid>"],
     "division_ids": ["<valid-division-uuid>"]
   }
   ```
3. Expect HTTP 201 with response body:
   ```json
   {
     "success": true,
     "data": {
       "id": "<uuid>",
       "name": "Difficulty",
       "code": "DIFFICULTY",
       "status": "ENABLED",
       "parent_id": null,
       "subject_ids": ["<valid-subject-uuid>"],
       "division_ids": ["<valid-division-uuid>"]
     },
     "error": null
   }
   ```

**Troubleshooting:** If 404 on subject/division UUID → use a UUID from your tenant's `subjects`/`divisions` tables. If 409 `CATEGORY_NAME_DUPLICATE` → use a unique name.

---

### Scenario 2 — List categories filtered by parent_id=null (root categories only)

**Purpose:** Verify the `parent_id=null` query string filter returns only root-level categories.

1. Authenticate as any workspace user.
2. Create at least one root category and one child category (use the create endpoint).
3. Call `GET /api/backoffice/{workspace}/categories?parent_id=null&page=1&limit=20`.
4. Expect HTTP 200 with response:
   ```json
   {
     "success": true,
     "data": {
       "items": [ ... ],
       "total": <root_count>,
       "page": 1,
       "limit": 20
     },
     "error": null
   }
   ```
5. Confirm no item in `items` has a non-null `parent_id`.

**Troubleshooting:** If all categories appear — verify the `parent_id` query param is the literal string `"null"` (not URL-encoded `%22null%22`).

---

### Scenario 3 — Get category tree

**Purpose:** Verify hierarchical tree assembly with nested children.

1. Create a root category (depth 0).
2. Create a child under it with `parent_id: <root-id>` (depth 1).
3. Create a grandchild under the child (depth 2).
4. Call `GET /api/backoffice/{workspace}/categories/tree`.
5. Expect HTTP 200 with nested structure:
   ```json
   {
     "success": true,
     "data": [
       {
         "id": "<root-id>",
         "name": "...",
         "children": [
           {
             "id": "<child-id>",
             "children": [{ "id": "<grandchild-id>", "children": [] }]
           }
         ]
       }
     ],
     "error": null
   }
   ```
6. Optionally call `GET /api/backoffice/{workspace}/categories/tree?root_id=<child-id>` to verify subtree fetching starts from the child.

**Troubleshooting:** If DISABLED categories appear in tree — only ENABLED categories are returned by `getCategoriesTree`. Disable a category and confirm it disappears from the tree.

---

### Scenario 4 — Circular reference and max depth enforcement (edge cases)

**Purpose:** Verify the safety guards for category hierarchies.

**Max depth test:**

1. Create a 4-level chain: A → B → C → D (each is a child of the previous).
2. Attempt to create E as a child of D.
3. Expect HTTP 422 with `"code": "CATEGORY_MAX_DEPTH_EXCEEDED"`.

**Circular reference test:**

1. Create root category A.
2. Create child B with `parent_id: A.id`.
3. Attempt to update A with `parent_id: B.id`.
4. Expect HTTP 422 with `"code": "CATEGORY_CIRCULAR_REFERENCE"`.

**Troubleshooting:** If depth error not triggered — verify the chain has exactly 4 levels (depth 0, 1, 2, 3). The fifth level (depth 4) triggers the error.

---

### Scenario 5 — RBAC enforcement (403 without permission)

**Purpose:** Verify that write endpoints require `classification:manage` or `question:manage`.

1. Authenticate as a staff user who has neither `classification:manage` nor `question:manage`.
2. Call `POST /api/backoffice/{workspace}/categories` with a valid body.
3. Expect HTTP 403 with `"code": "FORBIDDEN"`.
4. Call `PATCH /api/backoffice/{workspace}/categories/<uuid>` — also expect 403.
5. Call `DELETE /api/backoffice/{workspace}/categories/<uuid>` — also expect 403.
6. Confirm `GET /api/backoffice/{workspace}/categories` (read) returns 200 without the permission (read is open to all workspace users).

---

### Scenario 6 — Soft delete and re-enable

**Purpose:** Verify `DELETE` soft-deletes (sets `DISABLED`) and category can be re-enabled via PATCH.

1. Create a root category.
2. Call `DELETE /api/backoffice/{workspace}/categories/<id>`.
3. Expect HTTP 200 with `{ "deleted": true }`.
4. Call `GET /api/backoffice/{workspace}/categories/<id>`.
5. Expect the category's `status` is `"DISABLED"`.
6. Call `PATCH /api/backoffice/{workspace}/categories/<id>` with `{ "status": "ENABLED" }`.
7. Expect HTTP 200 with `status: "ENABLED"`.
8. Call `DELETE` again → expect HTTP 422 `CATEGORY_ALREADY_DISABLED` if you try to delete a DISABLED category again via a second `PATCH { "status": "DISABLED" }`.

**Troubleshooting:** Calling DELETE twice → second call returns 422 `CATEGORY_ALREADY_DISABLED` (correct). Calling `PATCH { "status": "DISABLED" }` on already-disabled → 422 `CATEGORY_ALREADY_DISABLED`.

---

### Scenario 7 — Tenant isolation (cross-tenant 404)

**Purpose:** Verify categories created in Tenant A are not visible from Tenant B.

1. Create a category in workspace-A (slug: `workspace-a`).
2. Authenticate as a user in workspace-B (slug: `workspace-b`).
3. Call `GET /api/backoffice/workspace-b/categories/<category-id-from-A>`.
4. Expect HTTP 404 `CATEGORY_NOT_FOUND` — not 403.

**Reason:** Tenant isolation is enforced by database pool separation; querying the category ID against the wrong tenant DB simply returns no row.

---

### Scenario 8 — Schema version mismatch enforcement

**Purpose:** Verify the API rejects requests if the tenant schema version is below `1.14.0`.

1. Manually downgrade `_schema_versions.version` to `1.13.0` in a test tenant DB.
2. Call any categories endpoint.
3. Expect HTTP 409 with `"code": "SCHEMA_VERSION_MISMATCH"`.

**Important:** Restore the schema version after this test.
