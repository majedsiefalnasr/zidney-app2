# Feature Specification: Tags

**Feature Branch**: `spec/032-tags`  
**Stage**: `STAGE_32_TAGS`  
**Phase**: `03_BACKOFFICE_CORE / 03_CONTENT_CLASSIFICATION`  
**Created**: 2026-03-23  
**Status**: DRAFT  
**Stage File**: `specs/phases/03_BACKOFFICE_CORE/03_CONTENT_CLASSIFICATION/STAGE_32_TAGS.md`

---

## Feature Overview

This stage implements a **lightweight, flat, non-hierarchical tagging system** for supplementary
content classification within Zidney tenant workspaces. Tags provide a flexible, search-oriented
layer on top of existing structured classification entities (Subject, Lesson, Category, Division).
They are purely additive and never authoritative.

**What is being built:**

- A `tags` table per-tenant: flat list of named labels with normalized deduplication and
  `ENABLED` / `DISABLED` lifecycle states.
- A `tag_relations` polymorphic join table linking tags to supported entity types
  (`MCQ_QUESTION`, `TRADITIONAL_QUESTION`, `LIBRARY_FILE`) with uniqueness enforcement.
- CRUD API endpoints for tags (create, list, get, update, delete), all protected by tenant
  resolver → license middleware.
- Tag assignment API: attach a tag to a specific entity; remove a tag from an entity; list tags
  on an entity.
- Tag-based filtering API: search entities by tag (single or multi-tag AND logic) with
  paginated, index-backed results.

**What tags are NOT:**

- Tags do not form hierarchies or parent-child structures.
- Tags do not control access, permissions, or visibility scoping.
- Tags do not replace Subject, Lesson, Category, Category Value, or Division.
- Tags carry no grading logic or attempt-engine impact.

**Affected system areas:**

| Area                | Affected? | Notes                                                                      |
| ------------------- | --------- | -------------------------------------------------------------------------- |
| Tenant Isolation    | Yes       | `tags` and `tag_relations` reside in tenant DB; no shared or global tables |
| License Enforcement | Yes       | License middleware is mandatory for all tag-related workspace routes       |
| Attempt Engine      | No        | Tags do not affect attempt snapshots, timing, or grading in any way        |
| Worker              | No        | All tag CRUD and assignment is synchronous; no background job required     |
| Frontoffice         | No        | Tags are a Backoffice classification tool; no student-facing exposure here |
| Divisions           | No        | Tags do not interact with division-based access rules                      |

---

## Constitutional Compliance Declaration

This specification is validated against **Zidney Constitution v1.2.0**.

| Rule                                   | Compliance                                                                                  |
| -------------------------------------- | ------------------------------------------------------------------------------------------- |
| No cross-tenant access                 | ✓ `tags` and `tag_relations` reside exclusively within the tenant DB                        |
| No middleware bypass                   | ✓ Tenant resolver → license middleware are mandatory before any tag route                   |
| No grading outside worker              | ✓ Feature does not touch attempt or grading logic                                           |
| No direct DB instantiation             | ✓ All DB access originates from tenant resolver context; no global singleton                |
| No weakening of snapshot integrity     | ✓ Feature does not touch attempt snapshots                                                  |
| No weakening of transaction boundaries | ✓ All writes (create, assign, delete) execute inside a transaction                          |
| No weakening of version enforcement    | ✓ Schema version bump required; migration is forward-only                                   |
| Server-authoritative time only         | ✓ All `created_at` / `updated_at` timestamps set server-side; no client-supplied timestamps |
| No console.log allowed                 | ✓ All logging via structured logger with required fields                                    |
| Division boundary preserved            | ✓ Tags have no interaction with division or department isolation rules                      |

No exceptions requiring a new ADR were detected for this stage.

---

## Isolation Impact Analysis

- **Database accessed:** Tenant DB only (resolved per workspace slug / subdomain context).
- **Tenant resolution:** Via existing tenant resolver middleware executed before any route handler.
- **Connection pool:** Obtained from tenant-scoped in-memory connection pool map; no global
  singleton.
- **Resolver middleware:** Mandatory — no route handler may access the DB before tenant and license
  validation.
- **Tables introduced:**
  - `tags` — new table in tenant DB (flat label list)
  - `tag_relations` — new table in tenant DB (polymorphic join)

**Confirmed:** No shared tenant data. No cross-tenant joins. No global tag singleton.

---

## License & Version Enforcement

- **License middleware required:** Yes — all Backoffice Tag API routes require an active
  workspace license.
- **Allowed license states:** `ACTIVE` only.
  - `SOFT_LOCKED` → 423 Locked
  - `ARCHIVED` → 403 Forbidden
  - `NOT_FOUND` → 404 Not Found
- **`schema_version` checked:** Yes — migration increments schema version; runtime rejects
  incompatible tenants.
- **`product_version` checked:** Yes — enforced at request boundary per Constitution.

---

## Data Model

### Table: `tags`

| Column            | Type        | Constraints                                |
| ----------------- | ----------- | ------------------------------------------ |
| `id`              | UUID        | Primary key                                |
| `name`            | VARCHAR     | NOT NULL                                   |
| `normalized_name` | VARCHAR     | NOT NULL, UNIQUE                           |
| `status`          | VARCHAR(20) | NOT NULL, CHECK IN (`ENABLED`, `DISABLED`) |
| `created_at`      | TIMESTAMPTZ | NOT NULL, server-set                       |
| `updated_at`      | TIMESTAMPTZ | NOT NULL, server-set                       |
| `created_by`      | UUID        | Nullable, FK → `users.id`                  |
| `updated_by`      | UUID        | Nullable, FK → `users.id`                  |

**Indexes:**

- `UNIQUE (normalized_name)` — prevents duplicate tags after normalization
- `idx_tags_status` — supports status-filtered list queries

**`normalized_name` rules:**

- Derived server-side from `name`; never supplied by the client.
- Lowercased + trimmed (leading/trailing whitespace removed).
- Used for uniqueness enforcement; the original `name` casing is preserved for display.
- Uniqueness is enforced at the DB layer via the unique index.

---

### Table: `tag_relations`

| Column        | Type        | Constraints                                                                 |
| ------------- | ----------- | --------------------------------------------------------------------------- |
| `id`          | UUID        | Primary key                                                                 |
| `tag_id`      | UUID        | NOT NULL, FK → `tags.id` ON DELETE CASCADE                                  |
| `entity_type` | VARCHAR(40) | NOT NULL, CHECK IN (`MCQ_QUESTION`, `TRADITIONAL_QUESTION`, `LIBRARY_FILE`) |
| `entity_id`   | UUID        | NOT NULL                                                                    |
| `created_at`  | TIMESTAMPTZ | NOT NULL, server-set                                                        |

**Indexes:**

- `UNIQUE (tag_id, entity_type, entity_id)` — prevents duplicate tag assignment to the same entity
- `idx_tag_relations_tag_id` — tag → entity lookups
- `idx_tag_relations_entity` — composite index on `(entity_type, entity_id)` for entity → tag lookups

---

## API Endpoints

All endpoints are prefixed under the workspace-scoped Backoffice route. All requests pass through:
**tenant resolver middleware → license middleware → permission check → handler.**

### Tag Management

#### `POST /workspace/:slug/tags`

Create a new tag.

**Request body:**

```json
{ "name": "string" }
```

**Success:** `201 Created`

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "string",
    "normalizedName": "string",
    "status": "ENABLED",
    "createdAt": "iso8601",
    "updatedAt": "iso8601"
  },
  "error": null
}
```

**Error cases:** `409` name conflict (`TAG_DUPLICATE`), `422` validation failure (`VALIDATION_ERROR`), `403` insufficient permission (`FORBIDDEN`).

---

#### `GET /workspace/:slug/tags`

List all tags with optional filtering and pagination.

**Query params:** `status` (ENABLED | DISABLED), `search` (partial name match), `page`, `per_page`.

**Success:** `200 OK`

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "name": "string",
        "normalizedName": "string",
        "status": "ENABLED",
        "createdAt": "iso8601",
        "updatedAt": "iso8601"
      }
    ],
    "total": 42,
    "page": 1,
    "perPage": 20
  },
  "error": null
}
```

---

#### `GET /workspace/:slug/tags/:id`

Retrieve a single tag by ID.

**Success:** `200 OK` — returns the tag object.  
**Error cases:** `404` tag not found (`TAG_NOT_FOUND`).

---

#### `PATCH /workspace/:slug/tags/:id`

Update a tag's `name` or `status`.

**Request body (partial update):**

```json
{ "name": "string", "status": "DISABLED" }
```

**Success:** `200 OK` — returns the updated tag object.  
**Error cases:** `404` (`TAG_NOT_FOUND`), `409` name conflict (`TAG_DUPLICATE`), `422` (`VALIDATION_ERROR`), `403` (`FORBIDDEN`).

---

#### `DELETE /workspace/:slug/tags/:id`

Hard-delete a tag.

**Precondition:** Tag must have no active `tag_relations`. If relations exist the tag MUST be
disabled via `PATCH` instead.

**Success:** `200 OK`

```json
{ "success": true, "data": { "deleted": true }, "error": null }
```

**Error cases:** `404` (`TAG_NOT_FOUND`), `422` relations exist (`TAG_HAS_RELATIONS`), `403` (`FORBIDDEN`).

---

### Tag Assignment

#### `POST /workspace/:slug/tag-relations`

Assign a tag to an entity.

**Request body:**

```json
{ "tagId": "uuid", "entityType": "MCQ_QUESTION", "entityId": "uuid" }
```

**Preconditions checked:**

1. Tag exists and has `status = ENABLED`.
2. `entityType` is in the allowed set.
3. Target entity exists in the tenant DB.
4. The `(tagId, entityType, entityId)` combination does not already exist.

**Success:** `201 Created`

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "tagId": "uuid",
    "entityType": "MCQ_QUESTION",
    "entityId": "uuid",
    "createdAt": "iso8601"
  },
  "error": null
}
```

**Error cases:** `404` tag not found (`TAG_NOT_FOUND`), `422` tag disabled (`TAG_DISABLED`), `422` entity not found (`TAG_RELATION_ENTITY_NOT_FOUND`), `409` duplicate assignment (`TAG_RELATION_DUPLICATE`), `422` invalid entity type (`TAG_RELATION_INVALID_ENTITY_TYPE`), `403` (`FORBIDDEN`).

---

#### `DELETE /workspace/:slug/tag-relations/:id`

Remove a specific tag-entity relation by relation ID.

**Success:** `200 OK`

```json
{ "success": true, "data": { "deleted": true }, "error": null }
```

**Error cases:** `404` relation not found (`TAG_RELATION_NOT_FOUND`), `403` (`FORBIDDEN`).

---

#### `GET /workspace/:slug/entities/:entityType/:entityId/tags`

List all tags assigned to a specific entity.

**Success:** `200 OK` — returns `{ items: [tag objects...], total: N }`.  
**Error cases:** `422` invalid entity type, `404` entity not found.

---

#### `GET /workspace/:slug/tags/:id/entities`

List all entities associated with a specific tag.

**Query params:** `entityType` (optional filter), `page`, `per_page`.

**Success:** `200 OK` — returns `{ items: [{ entityType, entityId }...], total: N }`.  
**Error cases:** `404` (`TAG_NOT_FOUND`).

---

### Tag Filtering on Entities

Tag-based filtering is performed by passing `tagIds[]` as a query parameter through the existing
entity list endpoints (e.g., MCQ questions, library files). Multi-tag filtering uses AND logic —
the entity must be assigned ALL provided tags.

This endpoint contract is defined here but implemented within each entity domain's list endpoint:

**Query parameter:** `tagIds[]` (array of UUIDs) on any entity list endpoint.  
**Filtering logic:** Return only entities that have ALL specified tags assigned.  
**Performance requirement:** Filtering MUST use indexed joins on `idx_tag_relations_tag_id` and
`idx_tag_relations_entity`; no sequential scans on large result sets.

---

## User Scenarios & Testing

### User Story 1 – Content Manager Creates a Tag (Priority: P1)

A Backoffice content manager creates a new tag to be used for classifying questions or library
files.

**Why this priority:** Tag creation is the prerequisite for all classification and filtering
workflows.

**Independent Test:** Send a create request with `name = "Algebra"`. Verify the response contains
a new tag with `status = ENABLED`, `normalizedName = "algebra"`, and the original `name` casing
preserved.

**Acceptance Scenarios:**

1. **Given** a valid name, **When** a create request is sent, **Then** a tag is created with
   `status = ENABLED` and `normalizedName` derived by lowercasing and trimming the input.
2. **Given** a name that normalizes to the same value as an existing tag (e.g., "ALGEBRA" when
   "algebra" exists), **When** a create request is sent, **Then** the API returns `409 Conflict`
   with error code `TAG_DUPLICATE`.
3. **Given** an empty or whitespace-only name, **When** a create request is sent, **Then** the API
   returns `422 Unprocessable Entity` with `VALIDATION_ERROR`.
4. **Given** a user without `question_manage` or `content_manage` permission, **When** a create
   request is sent, **Then** the API returns `403 Forbidden`.
5. **Given** a valid name with mixed casing and leading/trailing spaces (e.g., " Algebra "),
   **When** submitted, **Then** `name` is stored as provided after trim, `normalizedName` is
   `"algebra"`, and uniqueness is checked against `normalizedName`.

---

### User Story 2 – Content Manager Lists and Searches Tags (Priority: P1)

A Backoffice content manager browses or searches the tag catalog to find tags for assignment.

**Why this priority:** Discovering available tags is necessary for all assignment workflows.

**Independent Test:** Create 5 tags; call the list endpoint; verify all 5 are returned with correct
fields and pagination metadata.

**Acceptance Scenarios:**

1. **Given** multiple tags exist, **When** the list endpoint is called without filters, **Then**
   all tags are returned with `id`, `name`, `normalizedName`, `status`, `createdAt`, and
   `updatedAt`, along with pagination metadata (`total`, `page`, `perPage`).
2. **Given** a `status = DISABLED` filter, **Then** only disabled tags are returned.
3. **Given** a `search` query of "alg", **Then** only tags whose name contains "alg"
   (case-insensitive) are returned.
4. **Given** no tags exist, **Then** the list endpoint returns `{ items: [], total: 0 }`.
5. **Given** pagination parameters (`page=2&per_page=10`), **Then** the correct slice of tags is
   returned.

---

### User Story 3 – Content Manager Assigns a Tag to a Question (Priority: P1)

A Backoffice user assigns an existing enabled tag to an MCQ question.

**Why this priority:** Tag assignment is the core value delivery of the tagging system.

**Independent Test:** Create tag "Algebra"; assign it to MCQ question with known ID; verify the
relation is returned by the entity-tags endpoint.

**Acceptance Scenarios:**

1. **Given** an enabled tag and a valid MCQ question, **When** an assign request is sent, **Then**
   a `tag_relations` row is created and the API returns `201 Created` with the relation object.
2. **Given** the same tag is assigned twice to the same entity, **When** the second assign request
   is sent, **Then** the API returns `409 Conflict` with `TAG_RELATION_DUPLICATE`.
3. **Given** a tag with `status = DISABLED`, **When** an assign request is sent, **Then** the API
   returns `422 Unprocessable Entity` with `TAG_DISABLED`.
4. **Given** a non-existent `tagId`, **When** an assign request is sent, **Then** the API returns
   `404 Not Found` with `TAG_NOT_FOUND`.
5. **Given** a non-existent `entityId`, **When** an assign request is sent, **Then** the API
   returns `422 Unprocessable Entity` with `TAG_RELATION_ENTITY_NOT_FOUND`.
6. **Given** an unsupported `entityType` value (e.g., "EXAM"), **When** an assign request is sent,
   **Then** the API returns `422 Unprocessable Entity` with `TAG_RELATION_INVALID_ENTITY_TYPE`.
7. **Given** a user without edit permission on the target entity, **When** an assign request is
   sent, **Then** the API returns `403 Forbidden`.

---

### User Story 4 – Content Manager Removes a Tag from an Entity (Priority: P2)

A Backoffice user removes a previously assigned tag from an entity.

**Why this priority:** Tag cleanup is required for maintaining accurate classification.

**Independent Test:** Assign a tag; then delete the relation; verify the entity-tags endpoint no
longer includes that tag.

**Acceptance Scenarios:**

1. **Given** a valid relation ID, **When** a delete request is sent, **Then** the relation is
   removed and the API returns `200 OK` with `{ deleted: true }`.
2. **Given** a non-existent relation ID, **When** a delete request is sent, **Then** the API
   returns `404 Not Found` with `TAG_RELATION_NOT_FOUND`.
3. **Given** a disabled tag that has existing relations, **When** a relation is deleted, **Then**
   the deletion succeeds (existing relations are always mutable).
4. **Given** a user without edit permission on the target entity, **When** a delete request is
   sent, **Then** the API returns `403 Forbidden`.

---

### User Story 5 – Content Manager Disables a Tag (Priority: P2)

A Backoffice user disables a tag that is in active use to prevent it from being assigned to new
entities.

**Why this priority:** Lifecycle management is critical for keeping the tag catalog clean while
preserving historical classification.

**Independent Test:** Create and assign tag; disable tag via PATCH; attempt to assign the disabled
tag to another entity — verify `TAG_DISABLED` error is returned.

**Acceptance Scenarios:**

1. **Given** an enabled tag, **When** a PATCH request sets `status = DISABLED`, **Then** the tag
   is persisted with `status = DISABLED` and existing relations remain intact.
2. **Given** a disabled tag, **When** a new assignment is attempted, **Then** the API returns
   `422` with `TAG_DISABLED`.
3. **Given** a disabled tag, **When** a PATCH request sets `status = ENABLED`, **Then** the tag
   is re-enabled and new assignments become permissible.
4. **Given** a disabled tag with existing relations, **When** the entity-tags endpoint is queried,
   **Then** the disabled tag still appears (existing relations are unaffected by status change).

---

### User Story 6 – Content Manager Deletes a Tag (Priority: P2)

A Backoffice user permanently removes a tag with no assigned entities.

**Why this priority:** Stale tags must be removable to prevent catalog clutter.

**Independent Test:** Create a tag with no relations; delete it; verify it no longer appears in the
list endpoint.

**Acceptance Scenarios:**

1. **Given** a tag with no relations, **When** a delete request is sent, **Then** the tag is
   removed and returns `{ deleted: true }`.
2. **Given** a tag with one or more relations, **When** a delete request is sent, **Then** the
   API returns `422` with `TAG_HAS_RELATIONS`.
3. **Given** a disabled tag with no relations, **When** a delete request is sent, **Then** the
   deletion succeeds.
4. **Given** a non-existent tag ID, **When** a delete request is sent, **Then** the API returns
   `404` with `TAG_NOT_FOUND`.

---

### User Story 7 – Content Manager Filters Entities by Tags (Priority: P2)

A Backoffice user filters a list of MCQ questions by one or more tags to narrow search results.

**Why this priority:** Tag-based filtering is the primary value of the tagging system for content
discovery.

**Independent Test:** Create 3 questions: assign tags "Algebra" and "Hard" to Q1, "Algebra" only
to Q2, "Hard" only to Q3. Filter with `tagIds[]=[algebraId, hardId]`; verify only Q1 is returned.

**Acceptance Scenarios:**

1. **Given** entities tagged with various tags, **When** filtering with a single tag ID, **Then**
   all entities assigned that tag are returned.
2. **Given** entities tagged with various tags, **When** filtering with two tag IDs (AND logic),
   **Then** only entities assigned BOTH tags are returned.
3. **Given** an empty `tagIds[]` array, **When** filtering, **Then** the filter is ignored and all
   entities are returned.
4. **Given** a non-existent tag ID in `tagIds[]`, **Then** the API returns an empty result set
   (no entity can have a non-existent tag assignment).
5. **Given** pagination is applied alongside tag filter, **Then** pagination operates correctly on
   the filtered result set.

---

### Edge Cases

- **Normalization collision on update:** Renaming tag "Algebra" to "algebra" should not conflict
  with itself; the uniqueness check must exclude the tag being updated.
- **Cascade delete on tag deletion:** When a tag is deleted (no relations exist), the `tags` row
  is removed. The `ON DELETE CASCADE` on `tag_relations.tag_id` ensures no orphaned relation rows
  if the DB-layer is reached (application layer prevents deletion when relations exist).
- **Disabled tag with cascade:** If a tag is disabled, existing `tag_relations` remain and are
  still returned by entity-tag listing endpoints. Only new assignments are blocked.
- **Entity existence check timing:** An entity may be deleted after a tag is assigned to it. The
  relation remains valid (cascade rules are per tag, not per entity). Entity-level cleanup is the
  responsibility of the entity domain's deletion logic (out of scope for this stage).
- **Multi-tag AND filtering with no matches:** If no entity satisfies all required tags, an empty
  result is returned — not a 404.
- **Large tag counts per entity:** No limit is imposed on the number of tags per entity in this
  stage. Rate limiting at the assignment endpoint is handled by existing infrastructure.
- **Empty name normalization:** A name consisting entirely of whitespace normalizes to an empty
  string; this must be caught at validation before normalization is applied to the DB.
- **Case-insensitive display names:** `name` is stored with original casing. Deduplication is
  enforced only via `normalizedName`.

---

## Functional Requirements

- **FR-001**: The system MUST store tags within the tenant DB in a `tags` table with columns: `id`
  (UUID, PK), `name` (VARCHAR, NOT NULL), `normalized_name` (VARCHAR, NOT NULL, UNIQUE),
  `status` (VARCHAR(20), NOT NULL, CHECK IN (`ENABLED`, `DISABLED`)), `created_at`
  (TIMESTAMPTZ), `updated_at` (TIMESTAMPTZ), `created_by` (UUID, nullable, FK → `users.id`),
  `updated_by` (UUID, nullable, FK → `users.id`).
- **FR-002**: The system MUST store tag-entity relations in a `tag_relations` table with columns:
  `id` (UUID, PK), `tag_id` (UUID, NOT NULL, FK → `tags.id` ON DELETE CASCADE), `entity_type`
  (VARCHAR(40), NOT NULL, CHECK IN (`MCQ_QUESTION`, `TRADITIONAL_QUESTION`, `LIBRARY_FILE`)),
  `entity_id` (UUID, NOT NULL), `created_at` (TIMESTAMPTZ).
- **FR-003**: `normalized_name` MUST be computed server-side from `name` by lowercasing and
  trimming whitespace. The client MUST NOT supply `normalized_name` directly.
- **FR-004**: `normalized_name` MUST be unique across all tags in the tenant DB, enforced at DB
  level via a unique index. Duplicate detection MUST be performed before insert/update.
- **FR-005**: Tag creation with an empty, whitespace-only, or missing `name` MUST be rejected with
  `VALIDATION_ERROR` before normalization is applied to the DB.
- **FR-006**: Tag assignment MUST validate that the target tag exists and has `status = ENABLED`.
  Assignment to a disabled tag MUST be rejected with `TAG_DISABLED`.
- **FR-007**: Tag assignment MUST validate that the `entityType` is one of the three allowed
  values. An invalid `entityType` MUST be rejected with `TAG_RELATION_INVALID_ENTITY_TYPE`.
- **FR-008**: Tag assignment MUST validate that the target entity (`entityType` + `entityId`)
  exists within the tenant DB. Non-existent entity MUST be rejected with
  `TAG_RELATION_ENTITY_NOT_FOUND`.
- **FR-009**: Duplicate tag assignment (same `tag_id`, `entity_type`, `entity_id`) MUST be
  rejected with `TAG_RELATION_DUPLICATE`. The unique constraint on `tag_relations` provides the
  DB-layer backstop; the API MUST return the structured error before the constraint fires.
- **FR-010**: Hard deletion of a tag MUST be allowed only when `tag_relations` count for that
  `tag_id` is zero. If relations exist, the API MUST return `TAG_HAS_RELATIONS`. The user MUST
  disable the tag instead.
- **FR-011**: Tag list endpoint MUST support: optional `status` filter, optional partial `name`
  search (case-insensitive against `normalized_name`), and cursor or offset-based pagination.
- **FR-012**: Tag filtering on entity list endpoints MUST use AND logic for multiple tag IDs: only
  entities assigned ALL provided tags are returned.
- **FR-013**: All tag filtering queries MUST use the indexed columns `idx_tag_relations_tag_id` and
  `idx_tag_relations_entity`. Sequential scans on these tables are not acceptable for production
  data volumes.
- **FR-014**: All tag API endpoints MUST apply tenant resolver middleware and license middleware
  before any business logic executes.
- **FR-015**: Tag management operations (create, update, delete tag) require `question_manage` OR
  `content_manage` permission.
- **FR-016**: Tag assignment operations (assign, remove) require the permission necessary to edit
  the target entity (e.g., `question_manage` for questions, `content_manage` for library files).
- **FR-017**: All write operations (create, assign, delete) MUST execute within a database
  transaction. No partial writes are permitted.
- **FR-018**: All timestamps (`created_at`, `updated_at`) MUST be set server-side. No
  client-supplied timestamps are accepted.
- **FR-019**: Tags MUST be strictly tenant-scoped. No tag or relation from one tenant's DB may
  reference or be visible to another tenant.
- **FR-020**: No global shared `tags` table is allowed. Each tenant DB has its own `tags` table.

---

## Error Code Registry

| Error Code                         | HTTP Status | Description                                            |
| ---------------------------------- | ----------- | ------------------------------------------------------ |
| `TAG_NOT_FOUND`                    | 404         | No tag found for the given ID in this tenant           |
| `TAG_DUPLICATE`                    | 409         | A tag with the same normalized name already exists     |
| `TAG_DISABLED`                     | 422         | Cannot assign a disabled tag to a new entity           |
| `TAG_HAS_RELATIONS`                | 422         | Cannot delete a tag that has active entity relations   |
| `TAG_RELATION_NOT_FOUND`           | 404         | No tag-entity relation found for the given ID          |
| `TAG_RELATION_DUPLICATE`           | 409         | This tag is already assigned to the specified entity   |
| `TAG_RELATION_ENTITY_NOT_FOUND`    | 422         | The target entity does not exist in this tenant DB     |
| `TAG_RELATION_INVALID_ENTITY_TYPE` | 422         | The provided entity type is not in the allowed set     |
| `VALIDATION_ERROR`                 | 422         | Input validation failed (field-level details included) |
| `FORBIDDEN`                        | 403         | Caller lacks the required permission                   |

All error responses MUST conform to the platform envelope:

```json
{ "success": false, "data": null, "error": { "code": "TAG_DUPLICATE", "message": "..." } }
```

---

## Access Control

| Operation              | Required Permission                                 |
| ---------------------- | --------------------------------------------------- |
| Create tag             | `question_manage` OR `content_manage`               |
| Update tag             | `question_manage` OR `content_manage`               |
| Delete tag             | `question_manage` OR `content_manage`               |
| List / get tag         | `question_manage` OR `content_manage`               |
| Assign tag to question | Permission to edit the question (`question_manage`) |
| Assign tag to file     | Permission to edit the file (`content_manage`)      |
| Remove tag from entity | Permission to edit the target entity                |
| List entity tags       | Permission to view the target entity                |

- All routes MUST reject unauthenticated requests with `401 Unauthorized`.
- All routes MUST reject requests from users without the required permission with `403 Forbidden`.
- All routes MUST enforce the tenant scope — cross-tenant data access is forbidden at the resolver
  level before permission checks.

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: A content manager can create, search, assign, and remove a tag in a single
  continuous workflow without encountering errors caused by missing validation or ambiguous error
  messages.
- **SC-002**: Duplicate tags (after normalization) are always rejected — zero duplicate tag names
  exist in the tenant DB after the feature is live.
- **SC-003**: Tag-based filtering returns accurate AND-logic results: zero false positives (entities
  missing any required tag) and zero false negatives (entities having all required tags being
  excluded).
- **SC-004**: Tag list and filter queries return results within acceptable interactive response
  times even at production-scale entity counts, owing to indexed lookups.
- **SC-005**: Disabling a tag immediately blocks all new assignments while preserving full
  historical classification integrity.
- **SC-006**: Cross-tenant tag isolation is verified: no tag or relation created in tenant A is
  visible or accessible from tenant B.
- **SC-007**: Hard deletion is blocked whenever relations exist — zero orphaned or dangling
  `tag_relations` rows after any tag operation.

---

## Test Requirements

### Unit Tests

- `normalized_name` derivation: lowercase, trim, empty string detection.
- Duplicate detection logic with self-exclusion on update.
- Entity existence validation per `entityType`.
- Permission checks for all four entity types.
- Error mapping for all registered error codes.

### Integration Tests (API + Tenant DB)

- **Tag CRUD:** Create → list → get → update name (unique collision) → update status → delete
  (blocked by relations) → disable → delete (success after no relations).
- **Normalization uniqueness:** Create "Algebra"; attempt create "ALGEBRA", " algebra "; both must
  return `TAG_DUPLICATE`. Update "Algebra" to "Algebra" (self-rename) must succeed.
- **Tag assignment:** Assign to MCQ_QUESTION, TRADITIONAL_QUESTION, LIBRARY_FILE; duplicate
  assignment returns `TAG_RELATION_DUPLICATE`; non-existent entity returns
  `TAG_RELATION_ENTITY_NOT_FOUND`; disabled-tag assignment returns `TAG_DISABLED`.
- **Tag removal:** Remove by relation ID; non-existent relation ID returns `TAG_RELATION_NOT_FOUND`.
- **Lifecycle:** Disable tag → verify assignment blocked → re-enable → verify assignment allowed.
- **Deletion guard:** Tag with relations returns `TAG_HAS_RELATIONS`; after all relations removed,
  deletion succeeds.
- **Multi-tag AND filtering:** Entities with all tags match; entities missing any tag are excluded.
- **Cascade:** Deleting `tags` row (when allowed) leaves no orphaned `tag_relations` rows.
- **Permission enforcement:** All management endpoints return `403` without required permissions.
- **Tenant isolation:** Tag created in tenant A not visible when querying via tenant B's resolver.

### Migration Tests

- Migration is forward-only and creates `tags` and `tag_relations` tables correctly.
- Unique index on `normalized_name` is present and enforced.
- Composite unique index on `(tag_id, entity_type, entity_id)` is present.
- `ON DELETE CASCADE` on `tag_relations.tag_id` is enforced.

---

## Assumptions

- `entity_id` values in `tag_relations` are not validated for referential integrity at the DB layer
  (no FK from `entity_id` to the respective entity table) because polymorphic FKs are not
  supported in standard SQL. Validation is performed at the application layer at assignment time.
- If an entity is deleted after tag assignment, the orphaned `tag_relations` row remains. Cleanup
  is the responsibility of the entity domain's deletion logic in a downstream stage.
- Tag name character limits (e.g., maximum length) follow the platform's standard VARCHAR
  constraints. If a specific character limit is required, it must be defined in a follow-up ADR.
- The search parameter on the tag list endpoint performs a case-insensitive prefix or substring
  match; exact match semantics are not required.
- `tag_relations` has no `updated_at` because relations are immutable — they are either created or
  deleted; there is no update path for a relation row.

---

## Out of Scope

The following items are explicitly NOT part of this stage:

- **Hierarchical tags** (parent/child tag structures) — forbidden by architecture.
- **Tags controlling access rules or visibility** — tags are supplementary only.
- **Cross-tenant tag sharing or global tag catalog** — forbidden by multi-tenancy rules.
- **Frontoffice exposure of tags** — tags are a Backoffice classification tool in this phase.
- **Bulk tag assignment** (assign multiple tags at once) — not required in this stage.
- **Tag import / export** — data migration tooling is out of scope.
- **Tag usage statistics / analytics** — observability tooling for tag frequency is a future
  concern.
- **Soft delete for tags** — hard delete is the required strategy; soft delete is not used.
- **Entity-level cleanup of orphaned tag relations on entity deletion** — responsibility of the
  entity domain in downstream stages.
- **Tag ordering / sorting by custom rank** — tags are returned in creation order or alphabetical
  order; custom ranking is not required.
- **Subject, Lesson, Category, Category Value, Division** — these are separate structured
  classification systems; tags must never replace them.
