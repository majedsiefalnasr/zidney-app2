# Testing Guide — Tags

**Stage:** Tags  
**Phase:** 03_BACKOFFICE_CORE / 03_CONTENT_CLASSIFICATION  
**Stage Directory:** 032-tags  
**Generated On:** 2026-03-23

---

## Purpose

This guide explains how to validate the Tags feature implementation end-to-end. The Tags system provides a lightweight, flat, non-hierarchical tagging mechanism for supplementary content classification within Zidney workspaces.

---

## Summary of Delivered Behavior

The implementation introduces:

- A **`tags` table per tenant** with normalized deduplication, lifecycle states (ENABLED/DISABLED), and audit timestamps
- A **`tag_relations` polymorphic join table** linking tags to supported entity types (MCQ_QUESTION, TRADITIONAL_QUESTION, LIBRARY_FILE)
- **CRUD API endpoints** for tag management (create, list, get, update, delete), protected by tenant resolver → license middleware
- **Tag assignment API** to attach/remove tags from entities and query entity-tag relationships
- **Tag-based filtering API** with AND logic, pagination, and index-backed search

Key outcomes:

- Tags enable flexible content organization without disrupting existing classification hierarchies
- All tag operations scoped to tenant workspace; no cross-workspace access possible
- License enforcement mandatory on all Backoffice Tag routes
- Attempt engine unaffected; no grading logic impact
- Worker not involved; all operations synchronous

---

## Prerequisites

| Requirement                      | Validation Command / Check                               |
| -------------------------------- | -------------------------------------------------------- |
| Node.js installed                | `node --version` (expect v20+)                           |
| Bun installed                    | `bun --version` (expect v1+)                             |
| Docker running                   | `docker ps` (should list containers without error)       |
| Environment file present         | Verify `.env` or `.env.local` exists with DB credentials |
| spec/032-tags branch checked out | `git branch \| grep spec/032-tags`                       |
| Dependencies installed           | `bun install` (or verify `node_modules/` exists)         |

---

## Files in Scope

```text
Database Layer:
  apps/api/src/db/tenant/schemas/tags.schema.ts
  apps/api/src/db/tenant/schemas/tag-relations.schema.ts
  apps/api/src/db/tenant/migrations/20260323_010_tags.ts

Domain Package:
  packages/domain-core/src/tags/tags.errors.ts
  packages/domain-core/src/tags/tags.types.ts
  packages/domain-core/src/tags/tags.repository.ts
  packages/domain-core/src/tags/tags.service.ts
  packages/domain-core/src/tags/tags.dependency-registry.ts
  packages/domain-core/src/tags/index.ts
  packages/domain-core/src/index.ts (updated exports)

Validation:
  packages/validation/src/backoffice/tags.schemas.ts

API Routes:
  apps/api/src/routes/backoffice/tags/helpers.ts
  apps/api/src/routes/backoffice/tags/create-tag.ts
  apps/api/src/routes/backoffice/tags/list-tags.ts
  apps/api/src/routes/backoffice/tags/get-tag.ts
  apps/api/src/routes/backoffice/tags/update-tag.ts
  apps/api/src/routes/backoffice/tags/delete-tag.ts
  apps/api/src/routes/backoffice/tags/create-tag-relation.ts
  apps/api/src/routes/backoffice/tags/delete-tag-relation.ts
  apps/api/src/routes/backoffice/tags/list-entity-tags.ts
  apps/api/src/routes/backoffice/tags/list-tag-entities.ts
  apps/api/src/routes/backoffice/tags/index.ts
  apps/api/src/app.ts (router mount)
```

---

## Local Run Commands

```bash
# Install all dependencies (root + workspaces)
bun install

# Apply all migrations (master + tenant DBs)
bun run db:migrate

# Start development API server
bun run dev:api

# Start worker (if running independently)
bun run dev:worker

# Start backoffice frontend (if validating UI integration)
bun run dev:back
```

---

## Automated Validation Commands

```bash
# Run all unit + integration tests in monorepo
bun test

# Run tests with coverage report
bun test --coverage

# Run tests matching "tags" pattern only (faster targeted run)
bun test --grep "tags"

# Lint all files (Biome)
bun run lint

# Type-check all files (TypeScript)
bun run typecheck

# Full pre-commit check (lint + typecheck + tests)
bun run validate

```

**Expected outcome:** All commands exit with code 0 (success). No lint errors, no type errors, all tests pass.

---

## Manual Test Scenarios

### Scenario 1 — Create a Tag (Happy Path)

**Purpose:** Verify that users can create a new tag in their workspace and that the tag appears as ENABLED by default.

1. Start the API: `bun run dev:api`
2. Authenticate with a valid workspace token (use Postman or curl)
3. Make a POST request:

   ```bash
   POST http://localhost:3000/api/v1/backoffice/workspace/acme-corp/tags
   Authorization: Bearer <token>
   Content-Type: application/json

   {
     "name": "Important"
   }
   ```

4. Verify response (201 Created):
   ```json
   {
     "success": true,
     "data": {
       "id": "<uuid>",
       "name": "Important",
       "status": "ENABLED",
       "created_at": "2026-03-23T12:00:00Z",
       "created_by": "<user-id>"
     },
     "error": null
   }
   ```

**Expected:** HTTP 201, tag created with ENABLED status, normalized_name computed correctly.

**Troubleshooting:**

- If 401: token invalid or expired
- If 403: license not active for workspace
- If 422: validation error — check name is non-empty string
- If 409: duplicate tag name (normalized_name already exists)

---

### Scenario 2 — Duplicate Tag Prevention

**Purpose:** Verify that creating a tag with a name that normalizes to an existing tag fails.

1. Create tag "Important" (from Scenario 1)
2. Attempt to create tag "important" or " IMPORTANT " (different case/whitespace, same normalization)
3. Expected response (409 Conflict):
   ```json
   {
     "success": false,
     "data": null,
     "error": {
       "code": "TAG_DUPLICATE",
       "message": "A tag with this normalized name already exists"
     }
   }
   ```

**Expected:** HTTP 409, TAG_DUPLICATE error code.

**Troubleshooting:** If 201 succeeds, normalization logic may not be implemented or normalized_name unique index failed to apply.

---

### Scenario 3 — Create Tag Relation (Assign Tag to Question)

**Purpose:** Verify that tags can be attached to MCQ questions.

1. From Scenario 1, have a tag ID: `<tag-id>`
2. Have an existing MCQ question ID in the workspace: `<question-id>`
3. Make a POST request:

   ```bash
   POST http://localhost:3000/api/v1/backoffice/workspace/acme-corp/tag-relations
   Authorization: Bearer <token>
   Content-Type: application/json

   {
     "tagId": "<tag-id>",
     "entityType": "MCQ_QUESTION",
     "entityId": "<question-id>"
   }
   ```

4. Verify response (201 Created):
   ```json
   {
     "success": true,
     "data": {
       "id": "<relation-uuid>",
       "tag_id": "<tag-id>",
       "entity_type": "MCQ_QUESTION",
       "entity_id": "<question-id>",
       "created_at": "2026-03-23T12:00:00Z"
     },
     "error": null
   }
   ```

**Expected:** HTTP 201, relation created.

**Troubleshooting:**

- If 404: tag not found or question not found
- If 409: relation already exists (tag already assigned to this question)
- If 422: tag is DISABLED or entityType is invalid

---

### Scenario 4 — Disabled Tag Cannot Be Assigned

**Purpose:** Verify that tags in DISABLED state cannot be assigned to entities.

1. Create a tag "Archive" (ENABLED by default)
2. Update tag to DISABLED: PATCH `/tags/<tag-id>` with body `{ "status": "DISABLED" }`
3. Attempt to create tag relation with this disabled tag
4. Expected response (422 Unprocessable Entity):
   ```json
   {
     "success": false,
     "data": null,
     "error": {
       "code": "TAG_DISABLED",
       "message": "Cannot assign a disabled tag"
     }
   }
   ```

**Expected:** HTTP 422, TAG_DISABLED error code.

**Troubleshooting:** If 201 succeeds, disabled tag check not implemented.

---

### Scenario 5 — List Entities by Tag

**Purpose:** Verify paginated listing of entities tagged with a specific tag.

1. Create 2 tags and assign them to different MCQ questions (from Scenario 3)
2. Make a GET request:
   ```bash
   GET http://localhost:3000/api/v1/backoffice/workspace/acme-corp/tags/<tag-id>/entities?entityType=MCQ_QUESTION&page=1&per_page=20
   Authorization: Bearer <token>
   ```
3. Verify response (200 OK):
   ```json
   {
     "success": true,
     "data": {
       "items": [
         {
           "id": "<entity-id>",
           "entity_type": "MCQ_QUESTION",
           "created_at": "2026-03-23T10:00:00Z"
         }
       ],
       "meta": {
         "page": 1,
         "per_page": 20,
         "total": 1
       }
     },
     "error": null
   }
   ```

**Expected:** HTTP 200, paginated list of entities.

**Troubleshooting:**

- If 404: tag not found
- If empty items: check that tag relations were created (Scenario 3)
- If pagination meta missing: meta construction may be incomplete

---

### Scenario 6 — Delete Tag with Active Relations (Error Path)

**Purpose:** Verify that deleting a tag that has relations fails with TAG_HAS_RELATIONS error.

1. Create tag "High Priority" and assign it to 2 questions
2. Attempt DELETE `/api/v1/backoffice/workspace/acme-corp/tags/<tag-id>`
3. Expected response (422 Unprocessable Entity):
   ```json
   {
     "success": false,
     "data": null,
     "error": {
       "code": "TAG_HAS_RELATIONS",
       "message": "Cannot delete a tag that has active relations"
     }
   }
   ```

**Expected:** HTTP 422, TAG_HAS_RELATIONS error code.

**Troubleshooting:** If 200 succeeds, the relation count check was not performed.

---

### Scenario 7 — Delete Tag After Removing All Relations

**Purpose:** Verify that deleting a tag succeeds once all relations are removed.

1. From Scenario 6, have a tag with relations still assigned
2. Delete all tag relations: DELETE `/tag-relations/<relation-id>` (repeat for each)
3. Now retry: DELETE `/api/v1/backoffice/workspace/acme-corp/tags/<tag-id>`
4. Expected response (200 OK):
   ```json
   {
     "success": true,
     "data": {
       "deleted": true
     },
     "error": null
   }
   ```

**Expected:** HTTP 200, tag deleted.

**Troubleshooting:** If 422 still returns, verify all relations were deleted before retrying.

---

### Scenario 8 — Tenant Isolation Assertion

**Purpose:** Verify that tags from one workspace are not accessible in another workspace.

1. Authenticate with **Workspace A** and create tag "Private"
2. Obtain the tag ID
3. Authenticate with **Workspace B** (using a different workspace token)
4. Attempt to GET `/api/v1/backoffice/workspace/workspace-b/tags/<tag-id-from-workspace-a>`
5. Expected response (404 Not Found):
   ```json
   {
     "success": false,
     "data": null,
     "error": {
       "code": "TAG_NOT_FOUND",
       "message": "Tag not found"
     }
   }
   ```

**Expected:** HTTP 404 (tag from Workspace A is invisible to Workspace B).

**Troubleshooting:**

- If 200: tag was somehow accessible — tenant resolver may have failed
- If error differs: check that tenant resolver is executing before the handler

---

### Scenario 9 — License Enforcement

**Purpose:** Verify that workspace without active license cannot access tag APIs.

1. Authenticate with a workspace that has `SOFT_LOCKED` or `ARCHIVED` license state
2. Attempt any tag operation (GET, POST, PATCH, DELETE)
3. Expected response (423 Locked or 403 Forbidden):
   ```json
   {
     "success": false,
     "data": null,
     "error": {
       "code": "WORKSPACE_LOCKED",
       "message": "Workspace is locked"
     }
   }
   ```

**Expected:** HTTP 423 or 403 based on license state.

**Troubleshooting:** If 200 succeeds, license middleware not enforced on routes.

---

### Scenario 10 — Permission Guard (Non-Admin User)

**Purpose:** Verify that users without `question_manage` or `content_manage` permissions cannot modify tags.

1. Authenticate as a user with `view_only` permission (no write permissions)
2. Attempt: POST `/api/v1/backoffice/workspace/acme-corp/tags` with tag creation body
3. Expected response (403 Forbidden):
   ```json
   {
     "success": false,
     "data": null,
     "error": {
       "code": "INSUFFICIENT_PERMISSION",
       "message": "User does not have required permissions"
     }
   }
   ```

**Expected:** HTTP 403, permission error.

**Troubleshooting:** If 201 succeeds, permission guard not checking required capabilities.

---

## Structured Logging Validation

All write operations (create, update, delete tag; assign/remove relations) should produce structured log entries with:

```json
{
  "timestamp": "2026-03-23T12:00:00Z",
  "level": "info",
  "service": "tags-service",
  "operation": "createTag",
  "workspace_id": "<workspace-uuid>",
  "user_id": "<user-uuid>",
  "correlation_id": "<correlation-uuid>",
  "status": "success",
  "data": {
    "tag_id": "<tag-uuid>",
    "action": "create"
  }
}
```

Check logs: `tail -f /var/log/zidney/api.log | grep correlation_id`

---

## Integration Test Coverage

Run integration tests to verify:

```bash
bun test --grep "tags"
```

Expected test suites:

- ✅ Tag CRUD operations (create, read, update, delete)
- ✅ Duplicate prevention (normalized_name uniqueness)
- ✅ Disabled tag restrictions
- ✅ Tag relation lifecycle (assign, list, remove)
- ✅ Tenant isolation (workspace A cannot see workspace B tags)
- ✅ License enforcement (locked workspace forbidden)
- ✅ Permission guards (insufficient permission → 403)
- ✅ Error paths (TAG_NOT_FOUND, TAG_HAS_RELATIONS, etc.)
- ✅ Pagination (list endpoints with limit/offset)

---

## Performance Validation (Optional)

For load testing:

```bash
# 100 concurrent requests to create tags
ab -n 100 -c 10 -p create-tag.json http://localhost:3000/api/v1/backoffice/workspace/acme-corp/tags

# Expected: response time < 200ms p95, no connection timeouts
```

---

## Rollback Test (Safety)

1. Note current schema version: `SELECT schema_version FROM schema_version LIMIT 1`
2. Rollback migration: `bun run db:migrate:down -- 1`
3. Verify schema version decreased and tables dropped
4. Re-apply migration: `bun run db:migrate`
5. Verify schema version restored and tables recreated

---

## Deployment Readiness Checklist

Before merging to `develop`:

- [ ] All manual test scenarios passed
- [ ] `bun test` passes (all test suites green)
- [ ] `bun run lint` passes (no Biome errors)
- [ ] `bun run typecheck` passes (no TypeScript errors)
- [ ] Structured logging verified in dev logs
- [ ] Tenant isolation test passed (Scenario 8)
- [ ] License enforcement test passed (Scenario 9)
- [ ] Permission guard test passed (Scenario 10)
- [ ] Migration tested for idempotency and rollback
- [ ] PR summary reviewed by code reviewers

---

## Support & Troubleshooting

| Issue                            | Likely Cause                                | Fix                                            |
| -------------------------------- | ------------------------------------------- | ---------------------------------------------- |
| 401 Unauthorized                 | Invalid or expired token                    | Re-authenticate and obtain fresh token         |
| 403 Forbidden                    | Missing permission or license locked        | Check user roles and workspace license state   |
| 409 Conflict                     | Duplicate tag name                          | Try unique tag name with different characters  |
| 422 Unprocessable                | Validation error or business rule violation | Check error message for specific rule violated |
| 500 Internal Server Error        | Unhandled exception                         | Check API server logs for stack trace          |
| Tags not persisted after restart | Migration not applied                       | Run `bun run db:migrate`                       |

---

**Share this guide with QA, reviewers, and deployment team before merging.**
