# Spec: Categories (Classification Dimensions)

**Feature Branch**: `spec/030-categories`
**Stage**: `STAGE_30_CATEGORIES`
**Phase**: `03_BACKOFFICE_CORE / 03_CONTENT_CLASSIFICATION`
**Created**: 2026-03-22
**Status**: DRAFT
**Stage File**: `specs/phases/03_BACKOFFICE_CORE/03_CONTENT_CLASSIFICATION/STAGE_30_CATEGORIES.md`

---

## Overview

This stage implements **Category** as a structured, dynamic classification dimension for the Zidney
exam platform. Categories are metadata axes used to annotate questions and content — they are not
content hierarchies, not subject replacements, and not division structures. A category defines a
classification axis (e.g., _Difficulty_, _Topic Type_, _Bloom Level_, _Question Source_, _Cognitive
Skill_); category values define the selectable options on that axis.

**What is being built:**

- A `categories` table (tenant DB) containing: an optional `parent_id` self-reference for
  hierarchical grouping (max depth 3), tenant-wide-unique `name`, optional tenant-wide-unique
  `code`, optional `description`, `status` (`ENABLED | DISABLED`), and full audit columns
  (`created_at`, `updated_at`, `created_by`, `updated_by`).
- A `category_subjects` join table that optionally restricts a category to specific subjects. An
  empty subjects list means the category applies globally to all subjects in the tenant.
- A `category_divisions` join table that optionally restricts a category to specific divisions. An
  empty divisions list means the category applies globally to all divisions.
- A complete Category CRUD API (list, create, read, update, soft-delete) plus a tree-view
  endpoint, accessible to authorized Backoffice staff, protected by tenant resolver and license
  middleware.
- Hierarchy validation enforcing: (1) no circular ancestor chains, (2) maximum depth of 3 levels.
- Status lifecycle: categories are disabled via status change only. No SQL `DELETE` path is exposed
  via the API.
- Permission gating: all writes require `question_manage` OR `classification_manage` permission.

**What Category provides:**

| Use Case                     | How Categories Are Applied                                                            |
| ---------------------------- | ------------------------------------------------------------------------------------- |
| Question annotation          | MCQ and traditional questions tagged with category values for filtering and analytics |
| Auto-selection filtering     | Exam auto-selection engines filter question pools by category                         |
| Exam configuration           | Category constraints embedded in exam snapshots at attempt start                      |
| Analytics breakdown          | Pass rates and content coverage aggregated by category value                          |
| Backoffice UI classification | Category dimensions appear in content-classification panels for content creators      |

**Affected system areas:**

| Area                | Affected? | Notes                                                                           |
| ------------------- | --------- | ------------------------------------------------------------------------------- |
| Tenant Isolation    | Yes       | All three tables reside exclusively in tenant DB; never shared across tenants   |
| License Enforcement | Yes       | License middleware mandatory for all workspace category routes                  |
| Subjects            | Yes       | `category_subjects` creates an FK dependency on `subjects.id`                   |
| Divisions           | Yes       | `category_divisions` creates an FK dependency on `divisions.id`                 |
| Attempt Engine      | No        | Category FK in downstream content is snapshot-captured at attempt start         |
| Worker              | No        | Category CRUD is synchronous; no background processing required                 |
| Frontoffice         | No        | Frontoffice inherits category context via enrolled exam; no direct CRUD         |
| Academic Content    | Yes       | Category is a pre-requisite dependency for MCQ Questions, Traditional Questions |

---

## Constitutional Compliance Declaration

This specification is validated against **Zidney Constitution v1.2.0**.

| Rule                                   | Compliance                                                                                       |
| -------------------------------------- | ------------------------------------------------------------------------------------------------ |
| No cross-tenant access                 | ✓ All three category tables reside exclusively within the tenant DB                              |
| No middleware bypass                   | ✓ Tenant resolver → license middleware mandatory before any category route                       |
| No grading outside worker              | ✓ Feature does not touch attempt or grading logic                                                |
| No direct DB instantiation             | ✓ All DB access via tenant resolver context; no global singleton                                 |
| No weakening of snapshot integrity     | ✓ Category/value FKs in downstream content are immutable after attempt capture                   |
| No weakening of transaction boundaries | ✓ All writes (create, update, soft-delete, scope mutations) are wrapped in explicit transactions |
| No weakening of version enforcement    | ✓ Schema version incremented; migration is forward-only                                          |
| Server-authoritative time only         | ✓ `created_at`/`updated_at` set by server; no client-supplied timestamps accepted                |
| No console.log allowed                 | ✓ All logging via structured logger with required fields                                         |
| Division boundary preserved            | ✓ Division scoping is opt-in via `category_divisions`; no cross-division data leakage            |

---

## Isolation Impact Analysis

| Concern             | Detail                                                                                             |
| ------------------- | -------------------------------------------------------------------------------------------------- |
| Database accessed   | Tenant DB only. Zero master DB access.                                                             |
| Tenant resolution   | Resolved from workspace slug (subdomain or path) before any route handler executes.                |
| Connection pool     | Obtained from `c.get('tenant').pool` — the per-tenant pool injected by tenant resolver middleware. |
| Resolver middleware | Tenant resolver + license middleware run before every category route handler.                      |
| New tables          | `categories`, `category_subjects`, `category_divisions` — all in tenant DB.                        |
| Shared tenant data  | None. Categories are tenant-private. Cross-tenant access is structurally impossible.               |

---

## License & Version Enforcement

| Concern                | Detail                                                                                                      |
| ---------------------- | ----------------------------------------------------------------------------------------------------------- |
| License middleware     | Yes — mandatory on all workspace category routes                                                            |
| Allowed license states | `ACTIVE` only. `SOFT_LOCKED` → 423. `ARCHIVED` → 403.                                                       |
| Limit enforcement      | No category-count license cap introduced in this stage.                                                     |
| Schema version check   | Yes — requests to tenants below `MIN_SCHEMA_VERSION = "1.14.0"` rejected with 409 `SCHEMA_VERSION_MISMATCH` |
| Product version check  | Not applicable to this stage.                                                                               |

---

## User Stories

### US-01 — Create a Category (Priority: P1)

**As a** Backoffice administrator with `question_manage` or `classification_manage` permission,
**I want to** create a new classification category,
**So that** questions can be tagged along this dimension.

**Acceptance Scenarios:**

1. **Given** an active workspace license, **When** a user submits a valid create request with a
   unique name and no parent, **Then** a root category is created with `status = ENABLED`.
2. **Given** a valid `parent_id`, **When** a child category is created, **Then** the category is
   persisted as a child at the correct depth (parent depth + 1), provided depth ≤ 3.
3. **Given** a parent at depth 3, **When** creating a child category, **Then** the API returns 422
   `CATEGORY_MAX_DEPTH_EXCEEDED`.
4. **Given** a `name` already taken by another category in the same tenant, **Then** the API returns
   409 `CATEGORY_NAME_DUPLICATE`.
5. **Given** a `code` already taken by another category in the same tenant, **Then** the API returns
   409 `CATEGORY_CODE_DUPLICATE`.
6. **Given** a `parent_id` that does not exist in the tenant, **Then** the API returns 404
   `CATEGORY_PARENT_NOT_FOUND`.
7. **Given** `subject_ids` in the create payload, **Then** `category_subjects` rows are inserted
   atomically in the same transaction. If any `subject_id` does not exist, the entire operation is
   rolled back and the API returns 404 `CATEGORY_SUBJECT_NOT_FOUND`.
8. **Given** `division_ids` in the create payload, **Then** `category_divisions` rows are inserted
   atomically. If any `division_id` does not exist, the entire operation is rolled back and the API
   returns 404 `CATEGORY_DIVISION_NOT_FOUND`.
9. **Given** a staff member without `question_manage` AND without `classification_manage`, **Then**
   the API returns 403 Forbidden.

---

### US-02 — List Categories (Priority: P1)

**As a** Backoffice content creator,
**I want to** list categories with optional filters,
**So that** I can select the correct classification dimension when tagging a question.

**Acceptance Scenarios:**

1. **Given** multiple categories exist, **When** the list endpoint is called with no filters,
   **Then** all categories for the tenant are returned with pagination metadata.
2. **Given** a `status` filter, **Then** only categories matching that status are returned.
3. **Given** a `parent_id` filter (valid UUID), **Then** only direct children of that parent are
   returned.
4. **Given** `parent_id=null` as a string filter, **Then** only root categories (no parent) are
   returned.
5. **Given** a `search` query, **Then** only categories whose `name` contains the query string
   (case-insensitive partial match) are returned.
6. **Given** invalid `page` or `limit` values, **Then** the API returns 422 `VALIDATION_ERROR`.

---

### US-03 — Get Category Tree (Priority: P2)

**As a** Backoffice UI,
**I want to** retrieve the full hierarchical tree of categories,
**So that** I can render a nested category picker for content creators.

**Acceptance Scenarios:**

1. **Given** categories with parent-child relationships, **When** the tree endpoint is called,
   **Then** a nested structure of all ENABLED categories is returned (max depth 3).
2. **Given** a `root_id` parameter, **Then** only the sub-tree rooted at that category is returned.
3. **Given** no categories exist, **Then** an empty array is returned.

---

### US-04 — Get a Single Category (Priority: P1)

**As a** Backoffice content manager,
**I want to** retrieve the full details of a single category by ID,
**So that** I can view its configuration and current scope restrictions.

**Acceptance Scenarios:**

1. **Given** a valid `id` belonging to the current tenant, **When** the get endpoint is called,
   **Then** the full category row plus its scope lists (`subject_ids`, `division_ids`) is returned.
2. **Given** an `id` that does not exist in the tenant DB, **Then** the API returns 404
   `CATEGORY_NOT_FOUND`.
3. **Given** an `id` belonging to another tenant, **Then** the API returns 404 (no 403 — no
   information leakage).

---

### US-05 — Update a Category (Priority: P1)

**As a** Backoffice administrator,
**I want to** update a category's name, code, description, parent, or scope,
**So that** I can refine the classification structure over time.

**Acceptance Scenarios:**

1. **Given** a valid category ID, **When** an update with a new unique name is submitted, **Then**
   the category is updated and the response contains the updated row.
2. **Given** an update that sets `parent_id` to a descendant of the target category, **Then** the
   API returns 422 `CATEGORY_CIRCULAR_REFERENCE`.
3. **Given** an update that would push any existing descendant beyond depth 3, **Then** the API
   returns 422 `CATEGORY_MAX_DEPTH_EXCEEDED`.
4. **Given** an update on a DISABLED category with non-status fields, **Then** the API returns 422
   `CATEGORY_DISABLED` (re-enable first).
5. **Given** `subject_ids` in the update payload, **Then** the full subject scope is replaced
   atomically (previous scope deleted, new scope inserted) in the same transaction.
6. **Given** `subject_ids: []` in the update payload, **Then** all subject scope is cleared,
   making the category globally available to all subjects.
7. **Given** `division_ids` in the update payload, **Then** the full division scope is replaced
   atomically within the same transaction.

---

### US-06 — Disable (Soft-Delete) a Category (Priority: P1)

**As a** Backoffice administrator,
**I want to** disable a category that is no longer relevant,
**So that** it cannot be used in new content while preserving historical data integrity.

**Acceptance Scenarios:**

1. **Given** an ENABLED category, **When** a delete request is sent, **Then** the category's
   `status` is set to `DISABLED` and the response returns `{ deleted: true }`.
2. **Given** a category that is already `DISABLED`, **When** a delete request is sent, **Then**
   the API returns 422 `CATEGORY_ALREADY_DISABLED`.
3. **Given** a category that is referenced by downstream content, **When** a hard SQL DELETE is
   attempted via internal tooling, **Then** FK constraints prevent deletion at the database level.
4. **Given** a staff member without the required permissions, **Then** the API returns 403
   Forbidden.
5. **Given** an ENABLED category with at least one direct ENABLED child, **When** a delete
   request is sent, **Then** the API returns 422 `CATEGORY_HAS_ENABLED_CHILDREN`. The operator
   must explicitly disable all direct ENABLED children before the parent can be disabled.

---

### US-07 — Re-enable a Category (Priority: P2)

**As a** Backoffice administrator,
**I want to** re-enable a previously disabled category,
**So that** it can be used again in new content creation.

**Acceptance Scenarios:**

1. **Given** a DISABLED category, **When** a PATCH request sets `status = ENABLED`, **Then** the
   category's status is updated and the response contains the updated row.
2. **Given** an ENABLED category, **When** a PATCH request sets `status = ENABLED`, **Then** the
   API returns 422 `CATEGORY_ALREADY_ENABLED`.

---

## Data Model

### Table: `categories` (Tenant DB only)

| Column        | Type           | Constraints                                       | Notes                                |
| ------------- | -------------- | ------------------------------------------------- | ------------------------------------ |
| `id`          | `UUID`         | `PRIMARY KEY DEFAULT gen_random_uuid()`           |                                      |
| `name`        | `VARCHAR(255)` | `NOT NULL`                                        | Unique per tenant (case-insensitive) |
| `code`        | `VARCHAR(100)` | `NULLABLE`                                        | Optional; unique per tenant when set |
| `description` | `TEXT`         | `NULLABLE`                                        |                                      |
| `parent_id`   | `UUID`         | `NULLABLE, FK → categories.id ON DELETE RESTRICT` | Self-reference; NULL = root category |
| `status`      | `VARCHAR(20)`  | `NOT NULL DEFAULT 'ENABLED'`                      | ENUM: `ENABLED \| DISABLED`          |
| `created_at`  | `TIMESTAMPTZ`  | `NOT NULL DEFAULT NOW()`                          | Server-set                           |
| `updated_at`  | `TIMESTAMPTZ`  | `NOT NULL DEFAULT NOW()`                          | Server-set on every write            |
| `created_by`  | `UUID`         | `NULLABLE, FK → users.id ON DELETE SET NULL`      | Audit: creator user ID               |
| `updated_by`  | `UUID`         | `NULLABLE, FK → users.id ON DELETE SET NULL`      | Audit: last modifier user ID         |

**Status CHECK constraint:**

```sql
CONSTRAINT categories_status_check CHECK (status IN ('ENABLED', 'DISABLED'))
```

**Unique name constraint (case-insensitive functional index):**

```sql
CREATE UNIQUE INDEX unique_categories_name ON categories (LOWER(name));
```

**Unique code constraint (case-insensitive, partial — non-null codes only):**

```sql
CREATE UNIQUE INDEX unique_categories_code ON categories (LOWER(code)) WHERE code IS NOT NULL;
```

> A partial unique index allows multiple categories to have `code = NULL` while ensuring
> non-null codes are distinct per tenant. A functional index on `LOWER(code)` prevents
> case-variant duplicates (e.g., "BL1" vs "bl1").

**Hierarchy constraint:** Maximum depth of 3 is enforced at the service layer by traversing the
ancestor chain before any INSERT or parent-changing UPDATE. `ON DELETE RESTRICT` on `parent_id`
prevents hard deletion of a category that has children.

---

### Table: `category_subjects` (Tenant DB only)

| Column        | Type   | Constraints                                      | Notes |
| ------------- | ------ | ------------------------------------------------ | ----- |
| `id`          | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()`          |       |
| `category_id` | `UUID` | `NOT NULL, FK → categories.id ON DELETE CASCADE` |       |
| `subject_id`  | `UUID` | `NOT NULL, FK → subjects.id ON DELETE CASCADE`   |       |

**Unique constraint:**

```sql
CONSTRAINT unique_category_subjects UNIQUE (category_id, subject_id)
```

**Purpose:** Restricts category visibility to specific subjects. If no rows exist for a given
`category_id`, the category applies globally to all subjects. `ON DELETE CASCADE` on both FKs
ensures rows are cleaned up automatically when a category or subject is removed.

---

### Table: `category_divisions` (Tenant DB only)

| Column        | Type   | Constraints                                      | Notes |
| ------------- | ------ | ------------------------------------------------ | ----- |
| `id`          | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()`          |       |
| `category_id` | `UUID` | `NOT NULL, FK → categories.id ON DELETE CASCADE` |       |
| `division_id` | `UUID` | `NOT NULL, FK → divisions.id ON DELETE CASCADE`  |       |

**Unique constraint:**

```sql
CONSTRAINT unique_category_divisions UNIQUE (category_id, division_id)
```

**Purpose:** Restricts category visibility to specific divisions. If no rows exist for a given
`category_id`, the category applies globally to all divisions.

---

### Indexes

| Index Name                           | Table                | Columns                              | Type                | Purpose                                      |
| ------------------------------------ | -------------------- | ------------------------------------ | ------------------- | -------------------------------------------- |
| `unique_categories_name`             | `categories`         | `LOWER(name)`                        | Unique (functional) | Tenant-wide case-insensitive name uniqueness |
| `unique_categories_code`             | `categories`         | `LOWER(code) WHERE code IS NOT NULL` | Unique (partial)    | Tenant-wide code uniqueness (nulls excluded) |
| `idx_categories_parent_id`           | `categories`         | `parent_id`                          | B-tree              | Parent-child hierarchy queries               |
| `idx_categories_status`              | `categories`         | `status`                             | B-tree              | Status-filtered list queries                 |
| `idx_category_subjects_category_id`  | `category_subjects`  | `category_id`                        | B-tree              | Scope lookup by category                     |
| `idx_category_subjects_subject_id`   | `category_subjects`  | `subject_id`                         | B-tree              | Reverse scope lookup by subject              |
| `idx_category_divisions_category_id` | `category_divisions` | `category_id`                        | B-tree              | Scope lookup by category                     |
| `idx_category_divisions_division_id` | `category_divisions` | `division_id`                        | B-tree              | Reverse scope lookup by division             |

### Migration File

Naming follows existing pattern: `YYYYMMDD_NNN_name.ts`

Planned file: `apps/api/src/db/tenant/migrations/20260322_008_categories.ts`

Schema version increment: `1.13.0 → 1.14.0`

All DDL wrapped in `BEGIN / COMMIT`. Down migration not provided (forward-only per ADR-0008).

### Entity Relationships

```
divisions
    └── category_divisions (division_id FK, CASCADE)
subjects
    └── category_subjects (subject_id FK, CASCADE)
categories (self-reference via parent_id → ON DELETE RESTRICT)
    ├── category_subjects (category_id FK, CASCADE)
    ├── category_divisions (category_id FK, CASCADE)
    └── mcq_questions (category_value_id FK — downstream stage)
    └── traditional_questions (category_value_id FK — downstream stage)
```

---

## API Contracts

All category routes are registered under the workspace Backoffice namespace:
`/workspace/:slug/backoffice/` (prefix handled by the outer Hono app and tenant/license
middleware stack).

Route file: `apps/api/src/routes/backoffice/categories/index.ts`

> **Static paths must be declared before parameterised paths** (Hono routing rule).

### Route Table

| Method   | Path               | Handler function           | Description                                      |
| -------- | ------------------ | -------------------------- | ------------------------------------------------ |
| `GET`    | `/categories`      | `listCategoriesHandler`    | Paginated list with optional filters             |
| `POST`   | `/categories`      | `createCategoryHandler`    | Create a new category                            |
| `GET`    | `/categories/tree` | `getCategoriesTreeHandler` | Hierarchical tree view (ENABLED categories only) |
| `GET`    | `/categories/:id`  | `getCategoryHandler`       | Get single category by ID (with scope)           |
| `PATCH`  | `/categories/:id`  | `updateCategoryHandler`    | Update fields and/or scope                       |
| `DELETE` | `/categories/:id`  | `deleteCategoryHandler`    | Soft-delete (set status = DISABLED)              |

> **Routing order:** `/categories/tree` (static) MUST be declared before `/categories/:id`
> (parameterised) to prevent the dynamic route from capturing the literal string `"tree"` as an
> `:id` value.

---

### GET /categories

**Query Parameters:**

| Parameter   | Type             | Required | Description                                                           |
| ----------- | ---------------- | -------- | --------------------------------------------------------------------- |
| `parent_id` | `UUID \| "null"` | No       | Filter by parent. Use string `"null"` to return root categories only. |
| `status`    | `string`         | No       | `ENABLED \| DISABLED`                                                 |
| `search`    | `string`         | No       | Partial case-insensitive name search (max 100 chars)                  |
| `page`      | `number`         | No       | Default `1`, min `1`                                                  |
| `limit`     | `number`         | No       | Default `20`, min `1`, max `100`                                      |

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "name": "string",
        "code": "string | null",
        "description": "string | null",
        "parent_id": "uuid | null",
        "status": "ENABLED | DISABLED",
        "subject_ids": ["uuid"],
        "division_ids": ["uuid"],
        "created_at": "ISO8601",
        "updated_at": "ISO8601",
        "created_by": "uuid | null",
        "updated_by": "uuid | null"
      }
    ],
    "total": 42,
    "page": 1,
    "limit": 20
  },
  "error": null
}
```

---

### POST /categories

**Request Body:**

```json
{
  "name": "string (required, max 255)",
  "code": "string | null (optional, max 100)",
  "description": "string | null (optional)",
  "parent_id": "uuid | null (optional — null creates a root category)",
  "subject_ids": ["uuid"] "(optional — empty array = global scope across all subjects)",
  "division_ids": ["uuid"] "(optional — empty array = global scope across all divisions)"
}
```

**Success Response (201):**

```json
{
  "success": true,
  "data": { "<category row with subject_ids and division_ids>" },
  "error": null
}
```

**Error Responses:**

| HTTP | Error Code                    | Condition                                                        |
| ---- | ----------------------------- | ---------------------------------------------------------------- |
| 409  | `CATEGORY_NAME_DUPLICATE`     | `name` (case-insensitive) already taken in tenant                |
| 409  | `CATEGORY_CODE_DUPLICATE`     | `code` (case-insensitive, non-null) already taken in tenant      |
| 404  | `CATEGORY_PARENT_NOT_FOUND`   | `parent_id` does not exist in tenant DB                          |
| 422  | `CATEGORY_MAX_DEPTH_EXCEEDED` | Parent is at depth 3; adding a child would exceed max depth      |
| 404  | `CATEGORY_SUBJECT_NOT_FOUND`  | Any `subject_id` in `subject_ids` not found in tenant DB         |
| 404  | `CATEGORY_DIVISION_NOT_FOUND` | Any `division_id` in `division_ids` not found in tenant DB       |
| 422  | `VALIDATION_ERROR`            | Missing required fields or invalid field values                  |
| 403  | `FORBIDDEN`                   | Missing `question_manage` AND `classification_manage` permission |
| 423  | `LICENSE_LOCKED`              | Workspace license is `SOFT_LOCKED`                               |

---

### GET /categories/tree

Returns a nested tree of all **ENABLED** categories up to max depth 3.

**Query Parameters:**

| Parameter | Type   | Required | Description                                 |
| --------- | ------ | -------- | ------------------------------------------- |
| `root_id` | `UUID` | No       | Start tree from this specific category node |

**Success Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "string",
      "code": "string | null",
      "children": [
        {
          "id": "uuid",
          "name": "string",
          "code": "string | null",
          "children": [{ "id": "uuid", "name": "string", "code": "string | null", "children": [] }]
        }
      ]
    }
  ],
  "error": null
}
```

> This endpoint is not paginated — it returns the full tree. `children` arrays at depth 3 are
> always empty arrays. Disabled categories are excluded from the tree output.

---

### GET /categories/:id

Returns a single category with its scope lists.

**Path Parameters:** `id` (UUID)

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "string",
    "code": "string | null",
    "description": "string | null",
    "parent_id": "uuid | null",
    "status": "ENABLED | DISABLED",
    "subject_ids": ["uuid"],
    "division_ids": ["uuid"],
    "created_at": "ISO8601",
    "updated_at": "ISO8601",
    "created_by": "uuid | null",
    "updated_by": "uuid | null"
  },
  "error": null
}
```

**Error Responses:**

| HTTP | Error Code           | Condition                                      |
| ---- | -------------------- | ---------------------------------------------- |
| 422  | `VALIDATION_ERROR`   | `id` path parameter is not a valid UUID format |
| 404  | `CATEGORY_NOT_FOUND` | Category does not exist in tenant DB           |

---

### PATCH /categories/:id

**Request Body (all fields optional):**

```json
{
  "name": "string (max 255)",
  "code": "string | null (max 100)",
  "description": "string | null",
  "parent_id": "uuid | null (null promotes category to root)",
  "status": "ENABLED | DISABLED",
  "subject_ids": ["uuid"] "(replaces existing scope; empty array = remove all subject scope)",
  "division_ids": ["uuid"] "(replaces existing scope; empty array = remove all division scope)"
}
```

At least one field must be provided. An absent `subject_ids` key leaves subject scope unchanged.
An absent `division_ids` key leaves division scope unchanged.

**Success Response (200):**

```json
{
  "success": true,
  "data": { "<updated category row with subject_ids and division_ids>" },
  "error": null
}
```

**Error Responses:**

| HTTP | Error Code                      | Condition                                                       |
| ---- | ------------------------------- | --------------------------------------------------------------- |
| 404  | `CATEGORY_NOT_FOUND`            | Category not found                                              |
| 409  | `CATEGORY_NAME_DUPLICATE`       | New `name` already taken in tenant                              |
| 409  | `CATEGORY_CODE_DUPLICATE`       | New `code` already taken in tenant                              |
| 404  | `CATEGORY_PARENT_NOT_FOUND`     | New `parent_id` does not exist in tenant DB                     |
| 422  | `CATEGORY_CIRCULAR_REFERENCE`   | New `parent_id` is a descendant of this category                |
| 422  | `CATEGORY_MAX_DEPTH_EXCEEDED`   | Re-parenting would push descendants beyond depth 3              |
| 422  | `CATEGORY_DISABLED`             | Category is DISABLED; non-status field edits blocked            |
| 422  | `CATEGORY_ALREADY_ENABLED`      | Status → ENABLED on already-ENABLED category                    |
| 422  | `CATEGORY_ALREADY_DISABLED`     | Status → DISABLED on already-DISABLED category                  |
| 422  | `CATEGORY_HAS_ENABLED_CHILDREN` | Status → DISABLED blocked; category has direct ENABLED children |
| 404  | `CATEGORY_SUBJECT_NOT_FOUND`    | Any `subject_id` in new scope not found                         |
| 404  | `CATEGORY_DIVISION_NOT_FOUND`   | Any `division_id` in new scope not found                        |
| 422  | `VALIDATION_ERROR`              | Invalid field values or empty body                              |
| 403  | `FORBIDDEN`                     | Missing required permission                                     |

---

### DELETE /categories/:id

Performs a **soft delete** by setting `status = DISABLED`. No SQL `DELETE` is issued.

**Success Response (200):**

```json
{
  "success": true,
  "data": { "deleted": true },
  "error": null
}
```

**Error Responses:**

| HTTP | Error Code                      | Condition                                                              |
| ---- | ------------------------------- | ---------------------------------------------------------------------- |
| 422  | `VALIDATION_ERROR`              | `id` path parameter is not a valid UUID format                         |
| 404  | `CATEGORY_NOT_FOUND`            | Category not found                                                     |
| 422  | `CATEGORY_ALREADY_DISABLED`     | Category is already DISABLED                                           |
| 422  | `CATEGORY_HAS_ENABLED_CHILDREN` | Category has at least one direct ENABLED child; disable children first |
| 403  | `FORBIDDEN`                     | Missing required permission                                            |

---

## Business Rules

### BR-01: Name Uniqueness is Tenant-Wide

Category names must be unique within the entire tenant regardless of hierarchy position. Two
categories cannot share the same name even if they have different parents. Uniqueness is enforced
at the database level via `unique_categories_name ON categories (LOWER(name))`. The service layer
also performs a pre-check before INSERT/UPDATE to return a clean error before hitting the DB
constraint.

### BR-02: Code Uniqueness is Tenant-Wide (Non-Null Only)

When `code` is provided, it must be unique within the tenant. Multiple categories may have
`code = NULL`. Enforced via a partial unique index `unique_categories_code ON (LOWER(code)) WHERE
code IS NOT NULL`. Code may be cleared (set to null) via PATCH at any time.

### BR-03: Hierarchy Depth is Limited to 3

The maximum allowed tree depth is 3:

- Root category (`parent_id = NULL`) = depth 1
- Direct child of root = depth 2
- Grandchild of root = depth 3 (maximum allowed)
- Great-grandchild → FORBIDDEN → 422 `CATEGORY_MAX_DEPTH_EXCEEDED`

Depth enforcement also applies to re-parenting via PATCH: if moving a non-leaf category to a new
parent would push any existing descendant beyond depth 3, the operation is rejected. Depth is
validated at the service layer using ancestor traversal (maximum 3 hops from the proposed parent).

### BR-04: Circular References are Strictly Forbidden

A category cannot be set as a descendant of itself. When `parent_id` is set or changed, the
service traverses the proposed parent's ancestor chain. If the category's own `id` appears in that
chain, the request is rejected with 422 `CATEGORY_CIRCULAR_REFERENCE`. Since depth is bounded to
3, this traversal is at most 3 hops — no unbounded recursion.

### BR-05: Soft Delete Only

The API never issues a SQL `DELETE` on categories. `DELETE /categories/:id` performs a status
transition to `DISABLED`. The `ON DELETE RESTRICT` constraint on `parent_id` prevents hard
deletion of categories that have children. Downstream content FK constraints (added in later
stages) prevent deletion of categories that have question references.

### BR-06: Disabled Categories are Read-Only for Non-Status Fields

A `DISABLED` category cannot have `name`, `code`, `description`, `parent_id`, `subject_ids`, or
`division_ids` updated. Only the `status` field may be updated on a DISABLED category (to
re-enable it). Any PATCH request containing non-status fields on a DISABLED category returns 422
`CATEGORY_DISABLED`. Clients must first re-enable, then edit.

### BR-07: Scope Semantics — Absent Key vs Empty Array

- `subject_ids` absent from payload → subject scope unchanged.
- `subject_ids: []` in payload → all subject scope cleared; category applies globally to all subjects.
- `subject_ids: [uuid1, uuid2]` in payload → scope fully replaced with exactly these two subjects.
- The same semantics apply to `division_ids`.

This distinction is enforced via Zod: the schema differentiates between `undefined` (absent) and
`[]` (empty array).

### BR-08: Scope Replacement is Atomic

When `subject_ids` or `division_ids` is supplied in create or PATCH, the full scope is replaced
within the same transaction: all previous scope rows are deleted first, then all new scope rows
are inserted. No partial scope state is persisted on failure.

### BR-09: Subject/Division Scope FK Enforcement

If any `subject_id` in `subject_ids` does not exist in the tenant, the entire operation is rolled
back and returns 404 `CATEGORY_SUBJECT_NOT_FOUND`. The same applies to `division_ids`. Validation
is performed at the service layer before any INSERT into scope tables.

### BR-10: All Writes Transactional

Every create, update, and soft-delete operation (including scope mutations) must complete within
a single explicit `BEGIN / COMMIT / ROLLBACK` block. Repository functions do not open
transactions. Scope table mutations are part of the same transaction as the main `categories` row
mutation.

### BR-11: `updated_by` Audit Column

`created_by` is set once at creation and never updated. `updated_by` is set to the acting user ID
on every mutation. Both use `ON DELETE SET NULL` semantics on the FK to `users.id`.

### BR-12: `parent_id` is Mutable

Unlike `subject_id` in the lessons domain, a category's `parent_id` may be changed via PATCH.
Hierarchy reorganizations are permitted subject to depth and circular reference validations
(BR-03, BR-04). Promoting to root (`parent_id: null`) is always safe from a depth perspective —
the category itself drops to depth 1 and all descendants move up accordingly.

### BR-13: Status Lifecycle

```
ENABLED  ←─────────────────────────────────────────────────────────┐
   │                                                                │
   │  DELETE /categories/:id  (soft-delete)    PATCH status=ENABLED │
   ▼                                                                │
DISABLED ──────────────────────────────────────────────────────────┘
```

Initial status on creation: `ENABLED`.

### BR-14: Hierarchy-Mutating Transactions Use SELECT FOR UPDATE

Any service operation that reads a category's parent chain in order to validate or mutate the
hierarchy must acquire a row-level lock (`SELECT ... FOR UPDATE`) on the relevant category row at
transaction open time, before any ancestry traversal or depth/circular-reference check is
performed. This prevents concurrent requests from racing on stale parent-depth data.

| Operation        | Row locked              | Condition                               |
| ---------------- | ----------------------- | --------------------------------------- |
| `createCategory` | The parent category row | Only when `parent_id` is non-null       |
| `updateCategory` | The target category row | Only when `parent_id` is in the payload |
| `deleteCategory` | The target category row | Always (prevents concurrent re-enable)  |

Read-only operations (`listCategories`, `getCategory`, `getCategoriesTree`) do not acquire
row-level locks.

### BR-15: Soft-Delete Requires All Direct ENABLED Children to Be Disabled First

A category cannot be disabled (via `DELETE /categories/:id` or `PATCH` with `status: DISABLED`)
if any of its **direct** children have `status = ENABLED`. The API returns 422
`CATEGORY_HAS_ENABLED_CHILDREN`. The operator must explicitly disable each direct ENABLED child
before the parent can be disabled. This check is scoped to direct children only — grandchildren
at deeper levels are not examined during this guard.

For `PATCH`, this guard is inserted between the already-disabled check (step 3 in Q8 guard
ordering) and the circular-reference check (step 4): if `status` in the payload is `DISABLED`,
the service verifies no direct ENABLED children exist before proceeding.

---

## Access Control

### Permission Requirements

All write endpoints (`POST`, `PATCH`, `DELETE`) require the acting user to hold at least one of:

| Permission              | Description                                                |
| ----------------------- | ---------------------------------------------------------- |
| `question_manage`       | Full access to questions and all classification dimensions |
| `classification_manage` | Dedicated permission for managing classification taxonomy  |

Read endpoints (`GET /categories`, `GET /categories/tree`, `GET /categories/:id`) require any
authenticated Backoffice user with workspace access (standard session + license validation).

### Permission Check Implementation

Permission enforcement uses **middleware**, not in-handler logic:

- `requirePermission('question_manage', 'classification_manage')` is registered as a route-level
  middleware on each write route (`POST`, `PATCH`, `DELETE`) in the router factory
  (`apps/api/src/routes/backoffice/categories/index.ts`).
- The middleware is applied after the tenant resolver and license middleware in the standard
  tenant/license/permission chain — consistent with the existing Backoffice route pattern.
- Read routes (`GET`) do not carry `requirePermission`; they require only authenticated session
  and valid license.
- If the acting user holds neither `question_manage` nor `classification_manage`, the middleware
  short-circuits with 403 `FORBIDDEN` before the handler executes.

### Tenant Isolation

- All category queries use the tenant-scoped DB client from `c.get('tenant').pool`.
- No cross-tenant joins. No global DB singleton.
- Tenant resolved via subdomain or path slug before any route handler executes.

### License Middleware

All workspace category routes must execute after the license middleware:

| License State | HTTP Response | Error Code          |
| ------------- | ------------- | ------------------- |
| `ACTIVE`      | Continue      | —                   |
| `SOFT_LOCKED` | 423 Locked    | `LICENSE_LOCKED`    |
| `ARCHIVED`    | 403 Forbidden | `LICENSE_ARCHIVED`  |
| `NOT_FOUND`   | 404 Not Found | `LICENSE_NOT_FOUND` |

### Schema Version Enforcement

Requests to tenants whose `schema_version < "1.14.0"` are rejected with 409
`SCHEMA_VERSION_MISMATCH` before any category business logic executes. This applies to ALL
category routes, including read endpoints.

---

## Validation Rules

### `POST /categories` — createCategoryBodySchema

| Field          | Rule                                                                |
| -------------- | ------------------------------------------------------------------- |
| `name`         | Required. Non-empty string. Max 255 characters.                     |
| `code`         | Optional. Max 100 characters. `null` allowed.                       |
| `description`  | Optional. `null` allowed. No max length enforced at schema level.   |
| `parent_id`    | Optional. Valid UUID format if provided. `null` allowed (root).     |
| `subject_ids`  | Optional. Array of valid UUIDs. Empty array allowed (global scope). |
| `division_ids` | Optional. Array of valid UUIDs. Empty array allowed (global scope). |

### `PATCH /categories/:id` — updateCategoryBodySchema

| Field          | Rule                                                                     |
| -------------- | ------------------------------------------------------------------------ |
| `name`         | Optional. Non-empty string if provided. Max 255 characters.              |
| `code`         | Optional. Max 100 characters. `null` allowed.                            |
| `description`  | Optional. `null` allowed.                                                |
| `parent_id`    | Optional. Valid UUID if provided. `null` allowed (promote to root).      |
| `status`       | Optional. Must be `ENABLED` or `DISABLED` if provided.                   |
| `subject_ids`  | Optional. Array of valid UUIDs. Empty array = remove all subject scope.  |
| `division_ids` | Optional. Array of valid UUIDs. Empty array = remove all division scope. |

At least one field must be present in the body (zod `.refine()` minimum-one-field check).

### `GET /categories` — listCategoriesQuerySchema

| Field       | Rule                                                                  |
| ----------- | --------------------------------------------------------------------- |
| `parent_id` | Optional. Valid UUID format OR string literal `"null"` (root filter). |
| `status`    | Optional. `ENABLED \| DISABLED`.                                      |
| `search`    | Optional. String. Max 100 characters.                                 |
| `page`      | Optional. Integer ≥ 1. Default `1`.                                   |
| `limit`     | Optional. Integer 1–100. Default `20`.                                |

### `GET /categories/tree` — categoriesTreeQuerySchema

| Field     | Rule                                     |
| --------- | ---------------------------------------- |
| `root_id` | Optional. Valid UUID format if provided. |

### Path Parameter — `categoryParamsSchema`

| Field | Rule                         |
| ----- | ---------------------------- |
| `id`  | Required. Valid UUID format. |

---

## Error Handling

All API responses follow the Zidney error contract:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "CATEGORY_NOT_FOUND",
    "message": "Category not found."
  }
}
```

### Error Code Registry

| Error Code                       | HTTP | Description                                                                                        |
| -------------------------------- | ---- | -------------------------------------------------------------------------------------------------- |
| `CATEGORY_NOT_FOUND`             | 404  | Category ID does not exist in tenant DB                                                            |
| `CATEGORY_NAME_DUPLICATE`        | 409  | `name` (case-insensitive) already taken in tenant                                                  |
| `CATEGORY_CODE_DUPLICATE`        | 409  | `code` (case-insensitive, non-null) already taken in tenant                                        |
| `CATEGORY_PARENT_NOT_FOUND`      | 404  | `parent_id` does not exist in tenant DB                                                            |
| `CATEGORY_MAX_DEPTH_EXCEEDED`    | 422  | Adding or moving the category would exceed max hierarchy depth of 3                                |
| `CATEGORY_CIRCULAR_REFERENCE`    | 422  | New `parent_id` forms a circular ancestor chain                                                    |
| `CATEGORY_DISABLED`              | 422  | Category is DISABLED; non-status field edits blocked                                               |
| `CATEGORY_ALREADY_DISABLED`      | 422  | Status update to DISABLED on already-DISABLED category                                             |
| `CATEGORY_ALREADY_ENABLED`       | 422  | Status update to ENABLED on already-ENABLED category                                               |
| `CATEGORY_HAS_ENABLED_CHILDREN`  | 422  | Category has direct ENABLED children; operator must disable them first before disabling the parent |
| `CATEGORY_HAS_DEPENDENT_CONTENT` | 409  | Hard delete blocked by FK constraint (reserved for future surface)                                 |
| `CATEGORY_SUBJECT_NOT_FOUND`     | 404  | Subject ID in scope list not found in tenant DB                                                    |
| `CATEGORY_DIVISION_NOT_FOUND`    | 404  | Division ID in scope list not found in tenant DB                                                   |
| `VALIDATION_ERROR`               | 422  | Validation failure (field-level messages included in response)                                     |

### Error Logging

All domain errors must be logged via `@zidney/logger` with:

- `correlation_id` — from `c.get('correlation_id')`
- `workspace_id` — from `c.get('workspace_id')`
- `error_code` — from the error instance
- `error_message` — from the error instance

Stack traces must **never** be returned in API responses.

---

## Transaction Boundaries

| Operation           | Transaction Required | Notes                                                                                                       |
| ------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------- |
| `createCategory`    | Yes                  | SELECT FOR UPDATE on parent row (if `parent_id` non-null); INSERT into `categories` + scope tables          |
| `updateCategory`    | Yes                  | SELECT FOR UPDATE on target row (if `parent_id` in payload); UPDATE `categories` + DELETE/INSERT scope rows |
| `deleteCategory`    | Yes                  | SELECT FOR UPDATE on target row; UPDATE `categories.status` to `DISABLED`                                   |
| `listCategories`    | No                   | Read-only                                                                                                   |
| `getCategory`       | No                   | Read-only                                                                                                   |
| `getCategoriesTree` | No                   | Read-only                                                                                                   |

Failure in any step triggers explicit `ROLLBACK` — no partial state is persisted.

---

## Non-Functional Requirements

### Query Requirements

- List endpoint must support server-side filtering for `parent_id`, `status`, and `search` (ILIKE).
- Tree endpoint builds the hierarchy via recursive CTE or in-memory assembly (depth ≤ 3 makes
  in-memory assembly safe and avoids recursive CTE complexity).
- All FK columns must be covered by an index (see Indexes table above).
- Pagination uses offset-based strategy: `offset = (page - 1) * limit`.
- List response includes `subject_ids` and `division_ids` arrays for each item (fetched via
  LEFT JOINs or separate aggregated queries, consistent with tenant pool).

### Structured Logging

Every route handler must emit structured log entries using `@zidney/logger`:

```ts
logger.debug("Create category", {
  correlation_id: c.get("correlation_id"),
  workspace_id: c.get("workspace_id"),
  name: body.name,
  parent_id: body.parent_id ?? null,
});
```

Mutating operations must log at `info` level on success and `warn` level on domain errors.

### Idempotency

`POST /categories` is not idempotent. Duplicate requests with the same `name` or `code` are
rejected at the service layer with `CATEGORY_NAME_DUPLICATE` or `CATEGORY_CODE_DUPLICATE` before
hitting DB constraints, providing a clean error signal.

Scope INSERT operations use `INSERT ... ON CONFLICT DO NOTHING` internally to be safe under
concurrent retries within the same transaction context, but the outer create operation is never
idempotent.

### Migration Safety

- Migration file is forward-only (no `down()` function exposed to the runner).
- All DDL statements use `IF NOT EXISTS` guards.
- FK constraints wrapped in `DO $$ BEGIN / IF NOT EXISTS / END $$` blocks.
- Schema version incremented atomically within the same transaction.

---

## Implementation File Map

Following the domain-core pattern established by subjects and lessons:

```
packages/domain-core/src/categories/
  categories.types.ts               — DbClient, AuditContext, CategoryRow, ScopedCategoryRow, input/result types
  categories.errors.ts              — CategoriesErrorCode, CATEGORIES_ERROR_HTTP_STATUS, CategoriesError
  categories.repository.ts          — Pure SQL query functions (no transactions)
  categories.service.ts             — Business logic: transactions, hierarchy checks, circular-ref checks
  categories.dependency-registry.ts — Downstream reference check (stub for this stage)
  categories.tree.ts                — Tree-assembly helper (in-memory or recursive CTE)
  index.ts                          — Public exports

packages/validation/src/backoffice/
  categories.schemas.ts             — Zod schemas: list query, tree query, create body, update body, params

apps/api/src/routes/backoffice/categories/
  index.ts                          — Router factory (static /tree declared before /:id)
  list-categories.ts                — GET /categories
  create-category.ts                — POST /categories
  get-categories-tree.ts            — GET /categories/tree (static path)
  get-category.ts                   — GET /categories/:id
  update-category.ts                — PATCH /categories/:id
  delete-category.ts                — DELETE /categories/:id
  helpers.ts                        — getDb, buildAuditCtx, successResponse, categoriesErrorResponse

apps/api/src/db/tenant/migrations/
  20260322_008_categories.ts        — Forward-only DDL migration (all three tables + indexes)
```

---

## Idempotency Strategy

| Operation                | Idempotent? | Mechanism                                                               |
| ------------------------ | ----------- | ----------------------------------------------------------------------- |
| `POST /categories`       | No          | `LOWER(name)` unique index + service pre-check enforces single creation |
| `PATCH /categories/:id`  | Partial     | Status-flip guard + name/code uniqueness pre-check                      |
| `DELETE /categories/:id` | No          | Already-disabled guard prevents double-disable                          |
| Scope replace (PATCH)    | Yes         | Full DELETE + INSERT is repeatable within same transaction window       |

---

## Failure Modes & Recovery

| Failure                                       | Handling                                                                     |
| --------------------------------------------- | ---------------------------------------------------------------------------- |
| DB connection failure before transaction      | Returns 503; no state change.                                                |
| Error mid-transaction                         | Explicit `ROLLBACK` issued; 500 returned; no partial state persisted.        |
| `parent_id` FK violation at DB level          | Caught + translated to 404 `CATEGORY_PARENT_NOT_FOUND`.                      |
| Unique constraint violation `23505` (name)    | Caught + translated to 409 `CATEGORY_NAME_DUPLICATE` as DB-level safety net. |
| Unique constraint violation `23505` (code)    | Caught + translated to 409 `CATEGORY_CODE_DUPLICATE` as DB-level safety net. |
| Subject/division FK violation in scope INSERT | Caught + translated to corresponding 404 error; transaction rolled back.     |
| License middleware rejection                  | 423 `LICENSE_LOCKED` or 403 `LICENSE_ARCHIVED` (middleware-owned).           |
| Schema version below `1.14.0`                 | 409 `SCHEMA_VERSION_MISMATCH` (middleware-owned).                            |

---

## Test Strategy

### Unit Tests

Location: `packages/domain-core/src/categories/__tests__/`

- `createCategory` — success (root), success (child), name duplicate, code duplicate, parent not
  found, max depth exceeded (parent at depth 3), subject not found, division not found
- `updateCategory` — success, name duplicate, code duplicate, disabled guard, circular reference
  (direct), circular reference (indirect), max depth exceeded on re-parent, scope replacement,
  PATCH status → DISABLED blocked when direct ENABLED children exist (`CATEGORY_HAS_ENABLED_CHILDREN`)
- `deleteCategory` (soft) — success path, already-disabled guard, blocked when direct ENABLED children exist (`CATEGORY_HAS_ENABLED_CHILDREN`)
- Status lifecycle transitions (`ENABLED → DISABLED → ENABLED`)
- Depth computation: depths 1, 2, 3, and failed attempt at depth 4
- Circular reference detection: direct cycle (A→A), two-hop cycle (A→B→A), three-hop cycle
- Scope semantics: absent key (no change), empty array (global), populated array (restricted)

### Integration Tests

- `POST /categories` creates category and scope rows atomically
- `POST /categories` rolls back entirely if any `subject_id` or `division_id` is invalid
- `PATCH /categories/:id` replaces scope atomically; scope absence leaves existing rows intact
- Tenant isolation: category from tenant A not visible to tenant B
- License middleware enforced: `SOFT_LOCKED` workspace → 423
- Schema version enforcement: tenant below `1.14.0` → 409 `SCHEMA_VERSION_MISMATCH`
- Static route `/categories/tree` resolves before dynamic route `/categories/:id`

### Transaction Rollback Test

- Simulate FK violation mid-transaction (invalid `subject_id`) — verify no partial row committed
  in `categories` or `category_subjects`

### Migration Test

- Migration `20260322_008_categories.ts` applies cleanly on empty tenant DB
- All three tables (`categories`, `category_subjects`, `category_divisions`) and all indexes created
- Schema version incremented to `1.14.0`

---

## Out of Scope

- **Category Values**: The selectable options within a dimension (e.g., "Easy", "Medium", "Hard"
  for Difficulty) are defined in a downstream stage. This stage implements the dimension only.
- **Hard delete endpoint**: No SQL `DELETE` path is exposed for categories via the API.
- **Bulk operations**: Bulk create, update, or disable is not included.
- **Sorting/sequence numbers**: Categories have no explicit order within a parent. UI ordering is
  a downstream concern.
- **Translation / multi-language**: Category names are stored in a single locale per row.
  Multi-language support is deferred to the translation infrastructure stage.
- **Category-level analytics**: Coverage metrics or question counts per category are not computed
  in this stage.
- **Frontoffice category API**: Frontoffice read access (for exam display) is deferred to the
  relevant Frontoffice stage.
- **License count caps**: No category-count license cap is introduced in this stage.
- **Per-category permissions**: No per-category permission granularity. Access is controlled at
  the workspace and permission-role level.

---

## Open Questions

_(none — all decisions resolved at specification time using available context and project
conventions)_

---

## Clarifications

### Session 2026-03-22

**Q1: Depth calculation — how is depth defined?**
Resolution: Depth is 1-indexed from the root. A category with `parent_id = NULL` is at depth 1.
Its direct children are depth 2. Grandchildren are depth 3 (maximum). Any attempt to insert or
re-parent a category such that the resulting node would be at depth 4 or deeper is rejected with
422 `CATEGORY_MAX_DEPTH_EXCEEDED`. Depth is computed entirely at the service layer using ancestor
traversal (at most 3 hops up the tree to determine the proposed parent's depth).

**Q2: Circular reference check — how is it implemented?**
Resolution: When `parent_id` is set or changed, the service walks the proposed parent's ancestor
chain using a loop reading `parent_id` at each hop (at most 3 hops, since depth is bounded).
If the category's own `id` appears in the ancestor chain, the request is rejected with 422
`CATEGORY_CIRCULAR_REFERENCE`. Since the depth bound is 3, no unbounded recursion is needed.

**Q3: PATCH scope semantics — absent key vs empty array.**
Resolution: An absent `subject_ids` key in the PATCH body leaves the current subject scope
unchanged. An explicit `subject_ids: []` clears all subject scope restrictions (global scope).
An explicit `subject_ids: [uuid1]` fully replaces scope with that single subject. The same rule
applies to `division_ids`. This is enforced via Zod by distinguishing `undefined` from `[]`.

**Q4: What is `MIN_SCHEMA_VERSION` for category routes?**
Resolution: `MIN_SCHEMA_VERSION = "1.14.0"` — the version introduced by migration
`20260322_008_categories.ts`. Any tenant below this version receives 409
`SCHEMA_VERSION_MISMATCH` on any category route, including read endpoints.

**Q5: Can `parent_id` be set to `null` via PATCH (promote to root)?**
Resolution: Yes. A PATCH with `parent_id: null` promotes the category to a root node (depth 1).
Since this always decreases or preserves depth for all descendants, no depth violation is
possible from this operation. Circular reference check is skipped when `parent_id: null`.

**Q6: Does the DISABLED guard apply to `parent_id` changes?**
Resolution: Yes. Changing `parent_id` on a DISABLED category is blocked by BR-06 — `parent_id`
is not a status field, so any PATCH with `parent_id` on a DISABLED category returns 422
`CATEGORY_DISABLED`. The client must re-enable first.

**Q7: Scope ON DELETE CASCADE — does deleting a subject remove `category_subjects` rows?**
Resolution: Yes. `category_subjects.subject_id ON DELETE CASCADE` means if a subject is
hard-deleted, all `category_subjects` rows referencing that subject are automatically removed.
The category reverts toward a broader or global scope. The same applies to
`category_divisions.division_id ON DELETE CASCADE`. These are DB-level cascades — no
service-layer logic is required.

**Q8: PATCH guard ordering — in what sequence are guards applied?**
Resolution: The service applies PATCH guards in this strict order:

1. Fetch category by ID → if not found, return `404 CATEGORY_NOT_FOUND`.
2. If any non-status field is present AND `category.status === 'DISABLED'` → return
   `422 CATEGORY_DISABLED`.
3. If `status` in payload equals the current category status → return
   `422 CATEGORY_ALREADY_ENABLED` or `422 CATEGORY_ALREADY_DISABLED`.
4. If `parent_id` is present AND not null → check for circular reference → if found,
   return `422 CATEGORY_CIRCULAR_REFERENCE`.
5. If `parent_id` is present → compute resulting depths → if any node exceeds 3,
   return `422 CATEGORY_MAX_DEPTH_EXCEEDED`.
6. If `name` is present → check uniqueness (excluding current ID) → if taken,
   return `409 CATEGORY_NAME_DUPLICATE`.
7. If `code` is present AND not null → check uniqueness (excluding current ID) → if taken,
   return `409 CATEGORY_CODE_DUPLICATE`.
8. If `subject_ids` is present → validate all subject IDs exist → if any missing,
   return `404 CATEGORY_SUBJECT_NOT_FOUND`.
9. If `division_ids` is present → validate all division IDs exist → if any missing,
   return `404 CATEGORY_DIVISION_NOT_FOUND`.
10. Perform UPDATE + scope replacement within open transaction; catch DB `23505` as a final
    name/code duplicate safety net.

**Q9: Tree endpoint — how is the tree assembled?**
Resolution: The tree is assembled in-memory. A flat SELECT of all ENABLED categories is fetched
first, then the service groups rows by `parent_id` and builds the nested structure recursively
(depth ≤ 3 ensures bounded recursion with at most ~N² complexity, safe for typical category
volumes). If `root_id` is provided, the tree is built starting from that node only. Disabled
categories are excluded from the tree regardless of their children's status.

**Q10: Does `dependency-registry` check anything in this stage?**
Resolution: In this stage, all downstream tables that would reference `category_id`
(`mcq_questions`, `traditional_questions`, auto-selection configs) do not yet exist.
`categories.dependency-registry.ts` is implemented as a stub returning
`{ hasContent: false }`. Each downstream stage is responsible for registering its own FK check
against categories when it introduces its table. `CATEGORY_HAS_DEPENDENT_CONTENT` (409) is
reserved for a future hard-delete surface that is explicitly out of scope.

### Session 2026-03-22 — speckit.clarify

- Q: Concurrent `parent_id` locking — how should hierarchy-mutating transactions guard against race conditions on the target category row? → A: SELECT FOR UPDATE on the target category row (or parent row for `createCategory`) when opening any hierarchy-mutating transaction.
- Q: When soft-deleting a category (DELETE or PATCH status → DISABLED) that has direct ENABLED children, should the operation be blocked or cascade-disable? → A: Block with 422 `CATEGORY_HAS_ENABLED_CHILDREN`. Operator must explicitly disable all direct ENABLED children first before the parent can be disabled.
- Q: How should the RBAC permission check be applied — inline handler logic, route-level middleware, or a service-layer guard? → A: Middleware: `requirePermission('question_manage', 'classification_manage')` registered on each write route (POST, PATCH, DELETE) in the router factory, consistent with the tenant/license middleware pattern. Read routes require only authenticated session and valid license.
