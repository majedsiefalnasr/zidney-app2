# Spec: Category Values

**Feature Branch**: `spec/031-category-values`
**Stage**: `STAGE_31_CATEGORY_VALUES`
**Phase**: `03_BACKOFFICE_CORE / 03_CONTENT_CLASSIFICATION`
**Created**: 2026-03-22
**Status**: DRAFT
**Stage File**: `specs/phases/03_BACKOFFICE_CORE/03_CONTENT_CLASSIFICATION/STAGE_31_CATEGORY_VALUES.md`
**Depends On**: `specs/runtime/030-categories/spec.md` (STAGE_30_CATEGORIES)

---

## Overview

This stage implements **Category Values** — the selectable dimension options that populate a
Category axis in the Zidney classification taxonomy. Category Values are the concrete, enumerable
entries that operators tag onto questions and exam configurations.

**Relationship to Categories:**

```
Category  (e.g. "Difficulty")
  └── Category Value  (e.g. "Easy")
  └── Category Value  (e.g. "Medium")
  └── Category Value  (e.g. "Hard")
```

Category Values have no independent existence: they are structurally and semantically bound to
their parent Category. A Category Value cannot be moved to a different Category after creation.

**What is being built:**

- A `category_values` table (tenant DB) containing: a non-nullable `category_id` FK to
  `categories.id`, a tenant+category-unique `code`, a `status` field following a
  multi-step workflow, full audit columns, and soft-delete via `deleted_at`.
- A translation-driven display layer: `name` and `description` are stored in the shared
  `translations` table (entity_type = `"CATEGORY_VALUE"`), not as columns on the
  `category_values` table.
- Optional scope-filter linking tables (`category_value_subjects`,
  `category_value_divisions`) that inherit and refine the parent Category's scope restrictions.
- A complete Category Value CRUD API (list, create, read, update, soft-delete) with full
  translation read/write support, accessible to authorized Backoffice staff, protected by
  tenant resolver and license middleware.
- Status lifecycle: `COMPLETED → UNDER_REVIEW → APPROVED → ENABLED / DISABLED` enforced
  via the Status Workflow Engine.
- Permission gating: all writes require `question_manage` OR `classification_manage`.

**What Category Values provide:**

| Use Case                     | How Category Values Are Applied                                                         |
| ---------------------------- | --------------------------------------------------------------------------------------- |
| Question annotation          | MCQ and traditional questions tagged with a Category Value ID (e.g., Difficulty = Hard) |
| Auto-selection filtering     | Exam auto-selection engine queries by Category Value to draw from the correct pool      |
| Exam configuration snapshots | Category Value FK resolved and captured at attempt start; immutable thereafter          |
| Analytics breakdown          | Pass rates and content coverage aggregated per Category Value                           |
| Backoffice content panels    | Values appear in classification pickers filtered by their parent Category               |

**Affected system areas:**

| Area                | Affected? | Notes                                                                                              |
| ------------------- | --------- | -------------------------------------------------------------------------------------------------- |
| Tenant Isolation    | Yes       | All tables reside exclusively in tenant DB; never shared across tenants                            |
| License Enforcement | Yes       | License middleware mandatory on all workspace category-value routes                                |
| Categories          | Yes       | `category_values.category_id` FK; a Category must exist before its Values can be created           |
| Subjects            | Yes       | `category_value_subjects` creates optional FK dependency on `subjects.id`                          |
| Divisions           | Yes       | `category_value_divisions` creates optional FK dependency on `divisions.id`                        |
| Translation System  | Yes       | `name` and `description` stored in `translations` table, not in `category_values`                  |
| Attempt Engine      | No        | Category Value FK in downstream content is snapshot-captured at attempt start                      |
| Worker              | No        | Category Value CRUD is synchronous; no background processing required                              |
| Frontoffice         | No        | Frontoffice inherits classification context via enrolled exam; no direct CRUD                      |
| Academic Content    | Yes       | Category Values are a pre-requisite dependency for MCQ Questions and Traditional Questions tagging |

---

## Constitutional Compliance Declaration

This specification is validated against **Zidney Constitution v1.2.0**.

| Rule                                   | Compliance                                                                                                           |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| No cross-tenant access                 | ✓ All `category_values` tables reside exclusively within the tenant DB                                               |
| No middleware bypass                   | ✓ Tenant resolver → license middleware mandatory before any category-value route                                     |
| No grading outside worker              | ✓ Feature does not touch attempt or grading logic                                                                    |
| No direct DB instantiation             | ✓ All DB access via tenant resolver context; no global singleton                                                     |
| No weakening of snapshot integrity     | ✓ Category Value FKs in downstream content are immutable after attempt capture                                       |
| No weakening of transaction boundaries | ✓ All writes (create, update, soft-delete, scope mutations, translation writes) are wrapped in explicit transactions |
| No weakening of version enforcement    | ✓ Schema version incremented; migration is forward-only                                                              |
| Server-authoritative time only         | ✓ `created_at`/`updated_at` set by server; no client-supplied timestamps accepted                                    |
| No console.log allowed                 | ✓ All logging via structured logger with required fields                                                             |
| Division boundary preserved            | ✓ Division scoping is opt-in via `category_value_divisions`; no cross-division data leakage                          |
| Rate limiting enforced                 | ✓ Platform rate-limiting middleware applied; write routes ≤ 30 req/min, read routes ≤ 120 req/min per workspace      |
| Error contract enforced                | ✓ All responses: `{ success: boolean, data: object \| null, error: { code, message } \| null }`                      |

---

## Isolation Impact Analysis

| Concern             | Detail                                                                                             |
| ------------------- | -------------------------------------------------------------------------------------------------- |
| Database accessed   | Tenant DB only. Zero master DB access.                                                             |
| Tenant resolution   | Resolved from workspace slug (subdomain or path) before any route handler executes.                |
| Connection pool     | Obtained from `c.get('tenant').pool` — the per-tenant pool injected by tenant resolver middleware. |
| Resolver middleware | Tenant resolver + license middleware run before every category-value route handler.                |
| New tables          | `category_values`, `category_value_subjects`, `category_value_divisions` — all in tenant DB.       |
| Shared tenant data  | None. Category Values are tenant-private. Cross-tenant access is structurally impossible.          |

---

## License & Version Enforcement

| Concern                | Detail                                                                                                      |
| ---------------------- | ----------------------------------------------------------------------------------------------------------- |
| License middleware     | Yes — mandatory on all workspace category-value routes                                                      |
| Allowed license states | `ACTIVE` only. `SOFT_LOCKED` → 423. `ARCHIVED` → 403.                                                       |
| Limit enforcement      | No category-value-count license cap introduced in this stage.                                               |
| Schema version check   | Yes — requests to tenants below `MIN_SCHEMA_VERSION = "1.15.0"` rejected with 409 `SCHEMA_VERSION_MISMATCH` |
| Product version check  | Not applicable to this stage.                                                                               |

---

## User Stories

### US-01 — Create a Category Value (Priority: P1)

**As a** Backoffice administrator with `question_manage` or `classification_manage` permission,
**I want to** create a new value entry within an existing Category,
**So that** questions can be tagged with this specific classification value.

**Acceptance Scenarios:**

1. **Given** an active workspace license and an ENABLED parent Category, **When** a user submits a
   valid create request with a unique code and at least a `name` translation, **Then** a new
   Category Value is persisted with `status = COMPLETED`.
2. **Given** a `category_id` that does not exist in the tenant, **Then** the API returns 404
   `CATEGORY_NOT_FOUND`.
3. **Given** a `category_id` for a DISABLED Category, **Then** the API returns 422
   `CATEGORY_DISABLED` (cannot add values to a disabled category).
4. **Given** a `code` already taken by another value in the same category, **Then** the API returns
   409 `CATEGORY_VALUE_CODE_DUPLICATE`.
5. **Given** `subject_ids` in the payload that are not a subset of the parent Category's subject
   scope (when the parent has a subject scope), **Then** the API returns 422
   `CATEGORY_VALUE_SCOPE_EXCEEDS_PARENT`.
6. **Given** `division_ids` in the payload that are not a subset of the parent Category's division
   scope, **Then** the API returns 422 `CATEGORY_VALUE_SCOPE_EXCEEDS_PARENT`.
7. **Given** a translation payload with a `language_code` that is not supported by the workspace,
   **Then** the API returns 422 `UNSUPPORTED_LANGUAGE`.
8. **Given** a staff member without `question_manage` AND without `classification_manage`, **Then**
   the API returns 403 Forbidden.
9. **Given** a missing or empty `name` translation for the workspace default language, **Then** the
   API returns 422 `CATEGORY_VALUE_NAME_REQUIRED` (at least the default-language name must be
   provided).

---

### US-02 — List Category Values (Priority: P1)

**As a** Backoffice content creator,
**I want to** list values for a given category with optional filters,
**So that** I can select the correct classification value when tagging a question.

**Acceptance Scenarios:**

1. **Given** multiple Category Values exist for a category, **When** the list endpoint is called
   with a valid `category_id`, **Then** all values for that category are returned with pagination
   metadata and translated `name` fields in the requested language.
2. **Given** a `status` filter, **Then** only values matching that status are returned.
3. **Given** a `search` query, **Then** only values whose translated `name` contains the query
   string (case-insensitive) are returned.
4. **Given** invalid `page` or `limit` values, **Then** the API returns 422 `VALIDATION_ERROR`.
5. **Given** a `category_id` that does not exist in the tenant, **Then** the API returns 404
   `CATEGORY_NOT_FOUND`.
6. **Given** soft-deleted values (`deleted_at IS NOT NULL`), they are never included in list
   results unless an explicit `include_deleted=true` filter is present and the caller has admin
   permission.

---

### US-03 — Get a Single Category Value (Priority: P1)

**As a** Backoffice content manager,
**I want to** retrieve the full details of a single Category Value by ID,
**So that** I can view its configuration, translations, and current scope restrictions.

**Acceptance Scenarios:**

1. **Given** a valid `id` belonging to the current tenant, **When** the get endpoint is called,
   **Then** the full row plus its translations (all languages), scope lists (`subject_ids`,
   `division_ids`), and parent category summary are returned.
2. **Given** an `id` that does not exist in the tenant DB, **Then** the API returns 404
   `CATEGORY_VALUE_NOT_FOUND`.
3. **Given** an `id` belonging to another tenant, **Then** the API returns 404 (no 403 — no
   information leakage).
4. **Given** a soft-deleted value, **Then** the API returns 404 `CATEGORY_VALUE_NOT_FOUND`.

---

### US-04 — Update a Category Value (Priority: P1)

**As a** Backoffice administrator,
**I want to** update a Category Value's code, translations, or scope,
**So that** I can refine classification entries over time.

**Acceptance Scenarios:**

1. **Given** a valid Category Value ID, **When** an update with a new unique code is submitted,
   **Then** the value is updated and the response contains the updated row.
2. **Given** an update to a soft-deleted value, **Then** the API returns 404
   `CATEGORY_VALUE_NOT_FOUND`.
3. **Given** a translation update, **When** the payload includes translations, **Then** existing
   translations for the supplied language codes are replaced atomically; languages not present in
   the payload are left unchanged.
4. **Given** `subject_ids` in the update payload, **Then** the full subject scope is replaced
   atomically in the same transaction. If any `subject_id` does not exist, the operation is rolled
   back with 404 `CATEGORY_VALUE_SUBJECT_NOT_FOUND`.
5. **Given** `division_ids` in the update payload, **Then** the full division scope is replaced
   atomically. If any `division_id` does not exist, the operation is rolled back with 404
   `CATEGORY_VALUE_DIVISION_NOT_FOUND`.
6. **Given** an update where `subject_ids` would exceed the parent Category's subject scope,
   **Then** the API returns 422 `CATEGORY_VALUE_SCOPE_EXCEEDS_PARENT`.
7. **Given** a staff member without the required permissions, **Then** the API returns 403
   Forbidden.
8. **Given** a `category_id` change attempt in the payload, **Then** the API ignores or rejects
   it with 422 `CATEGORY_VALUE_CATEGORY_IMMUTABLE` — the parent category of a value cannot be
   changed after creation.

---

### US-05 — Transition Status (Priority: P1)

**As a** Backoffice workflow operator,
**I want to** advance a Category Value through the review workflow,
**So that** only peer-reviewed values become available for question tagging.

**Acceptance Scenarios:**

1. **Given** a value in `COMPLETED` status, **When** a transition to `UNDER_REVIEW` is submitted,
   **Then** the status is updated.
2. **Given** a value in `UNDER_REVIEW` status, **When** a transition to `APPROVED` is submitted,
   **Then** the status is updated.
3. **Given** a value in `APPROVED` status, **When** a transition to `ENABLED` is submitted,
   **Then** the status is updated and the value becomes usable in question classification.
4. **Given** a value in `APPROVED` status, **When** a transition to `DISABLED` is submitted,
   **Then** the status is updated and the value is deactivated.
5. **Given** an invalid status transition (e.g., `COMPLETED → ENABLED` skipping steps), **Then**
   the API returns 422 `INVALID_STATUS_TRANSITION`.
6. **Given** a value in `ENABLED` status, **When** a transition to `DISABLED` is submitted,
   **Then** the status is updated and the value can no longer be assigned to new content.
7. **Given** a value in `DISABLED` status, **When** a transition to `ENABLED` is submitted,
   **Then** the status is updated (re-enable path).

---

### US-06 — Soft-Delete a Category Value (Priority: P1)

**As a** Backoffice administrator,
**I want to** soft-delete a Category Value that is no longer needed,
**So that** it cannot be used in new content while preserving historical integrity.

**Acceptance Scenarios:**

1. **Given** a Category Value not referenced by any questions or exams, **When** a delete request
   is sent, **Then** `deleted_at` is set to the current server timestamp and the response returns
   `{ deleted: true }`.
2. **Given** a Category Value referenced by one or more `mcq_questions`, `traditional_questions`,
   or `exams`, **Then** the API returns 422 `CATEGORY_VALUE_IN_USE` and deletion is blocked.
3. **Given** a value already soft-deleted, **When** a delete request is sent, **Then** the API
   returns 200 `{ deleted: true }` (idempotent — already-deleted is treated as success).
4. **Given** a staff member without the required permissions, **Then** the API returns 403
   Forbidden.

---

### US-07 — Manage Translations (Priority: P1)

**As a** Backoffice content manager,
**I want to** add, update, and view translations for a Category Value,
**So that** the platform displays correct names in Arabic and English (and future languages).

**Acceptance Scenarios:**

1. **Given** a create request with translations, **When** submitted, **Then** translation rows are
   inserted atomically in the same transaction as the `category_values` row.
2. **Given** a get request, **When** the response is returned, **Then** translations for all
   available languages are included in the response.
3. **Given** an update request with a new translation for a language that already has one,
   **Then** the existing translation row is replaced (upsert), not duplicated.
4. **Given** the workspace default language is Arabic, and a get is performed without specifying a
   language, **Then** the Arabic translation is used as the primary `name` in the response.
5. **Given** a language code not configured in the workspace, **Then** the API returns 422
   `UNSUPPORTED_LANGUAGE`.

---

## Data Model

### Table: `category_values` (Tenant DB only)

| Column        | Type           | Constraints                                              | Notes                                  |
| ------------- | -------------- | -------------------------------------------------------- | -------------------------------------- |
| `id`          | `UUID`         | `PRIMARY KEY DEFAULT gen_random_uuid()`                  |                                        |
| `category_id` | `UUID`         | `NOT NULL, FK → categories.id ON DELETE RESTRICT, INDEX` | Immutable after creation               |
| `code`        | `VARCHAR(100)` | `NOT NULL`                                               | Unique per category (case-insensitive) |
| `status`      | `VARCHAR(20)`  | `NOT NULL DEFAULT 'COMPLETED'`                           | ENUM: see Status Workflow below        |
| `created_at`  | `TIMESTAMPTZ`  | `NOT NULL DEFAULT NOW()`                                 | Server-set                             |
| `updated_at`  | `TIMESTAMPTZ`  | `NOT NULL DEFAULT NOW()`                                 | Server-set on every write              |
| `created_by`  | `UUID`         | `NULLABLE, FK → users.id ON DELETE SET NULL`             | Audit: creator user ID                 |
| `updated_by`  | `UUID`         | `NULLABLE, FK → users.id ON DELETE SET NULL`             | Audit: last modifier user ID           |
| `deleted_at`  | `TIMESTAMPTZ`  | `NULLABLE`                                               | Soft-delete; NULL = active             |

> `name` and `description` are NOT columns. They live in the `translations` table.

**Status CHECK constraint:**

```sql
CONSTRAINT category_values_status_check CHECK (
  status IN ('COMPLETED', 'UNDER_REVIEW', 'APPROVED', 'ENABLED', 'DISABLED')
)
```

**Unique code constraint per category (case-insensitive, active values only):**

```sql
CREATE UNIQUE INDEX unique_category_values_code
  ON category_values (category_id, LOWER(code))
  WHERE deleted_at IS NULL;
```

**Delete restriction:** `ON DELETE RESTRICT` on `category_id` prevents hard-deletion of a
Category that still has active (non-soft-deleted) values.

---

### Translation Records for Category Values

Category Values do **not** have `name` or `description` columns. All display text is stored in the
shared `translations` table with the following shape:

| Column             | Value / Constraint                          |
| ------------------ | ------------------------------------------- |
| `entity_type`      | `"CATEGORY_VALUE"` (constant)               |
| `entity_id`        | `category_values.id` (UUID)                 |
| `language_code`    | e.g., `"ar"`, `"en"` (workspace-configured) |
| `field_name`       | `"name"` or `"description"`                 |
| `translated_value` | The translated text                         |

**Fallback rule:** When a display-language `name` is not found, fall back to the workspace default
language. If no translation exists at all, return an empty string (never null error).

**Required at creation:** At minimum, a `name` translation for the workspace default language must
be provided in the create request. A create without this is rejected with 422
`CATEGORY_VALUE_NAME_REQUIRED`.

---

### Table: `category_value_subjects` (Tenant DB only — optional scope)

| Column              | Type   | Constraints                                           | Notes |
| ------------------- | ------ | ----------------------------------------------------- | ----- |
| `id`                | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()`               |       |
| `category_value_id` | `UUID` | `NOT NULL, FK → category_values.id ON DELETE CASCADE` |       |
| `subject_id`        | `UUID` | `NOT NULL, FK → subjects.id ON DELETE CASCADE`        |       |

**Unique constraint:**

```sql
CONSTRAINT unique_category_value_subjects UNIQUE (category_value_id, subject_id)
```

**Semantics:** Empty rows for a given `category_value_id` imply the value is globally available
within whatever scope the parent Category's own `category_subjects` permits. Rows present restrict
the value to the listed subjects (must be a subset of the parent Category's subject scope).

---

### Table: `category_value_divisions` (Tenant DB only — optional scope)

| Column              | Type   | Constraints                                           | Notes |
| ------------------- | ------ | ----------------------------------------------------- | ----- |
| `id`                | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()`               |       |
| `category_value_id` | `UUID` | `NOT NULL, FK → category_values.id ON DELETE CASCADE` |       |
| `division_id`       | `UUID` | `NOT NULL, FK → divisions.id ON DELETE CASCADE`       |       |

**Unique constraint:**

```sql
CONSTRAINT unique_category_value_divisions UNIQUE (category_value_id, division_id)
```

---

### Indexes

| Index Name                               | Table                      | Columns                                               | Type             | Purpose                                             |
| ---------------------------------------- | -------------------------- | ----------------------------------------------------- | ---------------- | --------------------------------------------------- |
| `unique_category_values_code`            | `category_values`          | `(category_id, LOWER(code)) WHERE deleted_at IS NULL` | Unique (partial) | Per-category code uniqueness for active values      |
| `idx_category_values_category_id`        | `category_values`          | `category_id`                                         | B-tree           | Lookup all values for a category                    |
| `idx_category_values_status`             | `category_values`          | `status`                                              | B-tree           | Status-filtered queries                             |
| `idx_category_values_category_id_status` | `category_values`          | `(category_id, status)`                               | B-tree           | Combined category+status filter (most common query) |
| `idx_category_values_deleted_at`         | `category_values`          | `deleted_at`                                          | B-tree (partial) | Active-value scans (`WHERE deleted_at IS NULL`)     |
| `idx_cv_subjects_category_value_id`      | `category_value_subjects`  | `category_value_id`                                   | B-tree           | Scope lookup by value                               |
| `idx_cv_subjects_subject_id`             | `category_value_subjects`  | `subject_id`                                          | B-tree           | Reverse scope lookup by subject                     |
| `idx_cv_divisions_category_value_id`     | `category_value_divisions` | `category_value_id`                                   | B-tree           | Scope lookup by value                               |
| `idx_cv_divisions_division_id`           | `category_value_divisions` | `division_id`                                         | B-tree           | Reverse scope lookup by division                    |

---

### Migration File

Naming follows existing pattern: `YYYYMMDD_NNN_name.ts`

Planned file: `apps/api/src/db/tenant/migrations/20260322_009_category_values.ts`

Schema version increment: `1.14.0 → 1.15.0`

All DDL wrapped in `BEGIN / COMMIT`. Down migration not provided (forward-only per ADR-0008).

---

### Entity Relationships

```
categories (PK: id)
  └── category_values (category_id FK → categories.id, ON DELETE RESTRICT)
        ├── translations (entity_id FK, entity_type = "CATEGORY_VALUE")
        ├── category_value_subjects (category_value_id FK, CASCADE)
        │     └── subjects (subject_id FK, CASCADE)
        └── category_value_divisions (category_value_id FK, CASCADE)
              └── divisions (division_id FK, CASCADE)
```

Downstream (later stages):

```
category_values.id ← mcq_questions.category_value_id
category_values.id ← traditional_questions.category_value_id
```

---

## Status Workflow

Category Values follow a multi-step review workflow managed by the Status Workflow Engine.

### Valid Statuses

| Status         | Meaning                                                                        |
| -------------- | ------------------------------------------------------------------------------ |
| `COMPLETED`    | Initial state. Value is drafted; not yet under review.                         |
| `UNDER_REVIEW` | Submitted for peer/editorial review.                                           |
| `APPROVED`     | Reviewed and approved; ready to be published.                                  |
| `ENABLED`      | Published and active. Can be assigned to questions and exam configurations.    |
| `DISABLED`     | Deactivated. Cannot be assigned to new content; existing references preserved. |

### Valid Transitions

```
COMPLETED
    │
    ▼
UNDER_REVIEW
    │
    ▼
APPROVED
    │         │
    ▼         ▼
ENABLED    DISABLED
    │         │
    └────┬────┘
         │  (bidirectional toggle between ENABLED ↔ DISABLED)
```

| From           | To             | Allowed                             |
| -------------- | -------------- | ----------------------------------- |
| `COMPLETED`    | `UNDER_REVIEW` | ✓                                   |
| `UNDER_REVIEW` | `APPROVED`     | ✓                                   |
| `APPROVED`     | `ENABLED`      | ✓                                   |
| `APPROVED`     | `DISABLED`     | ✓                                   |
| `ENABLED`      | `DISABLED`     | ✓                                   |
| `DISABLED`     | `ENABLED`      | ✓                                   |
| Any other pair |                | ✗ → 422 `INVALID_STATUS_TRANSITION` |

### Usage Restrictions by Status

| Status         | Assignable to new questions | Assignable to exam config | Visible in pickers |
| -------------- | --------------------------- | ------------------------- | ------------------ |
| `COMPLETED`    | No                          | No                        | No (draft only)    |
| `UNDER_REVIEW` | No                          | No                        | No                 |
| `APPROVED`     | No                          | No                        | No (pre-publish)   |
| `ENABLED`      | Yes                         | Yes                       | Yes                |
| `DISABLED`     | No                          | No                        | No                 |

Existing question/exam references to a DISABLED value are **preserved** for historical integrity.

---

## API Contracts

All category-value routes are registered under the workspace Backoffice namespace:
`/workspace/:slug/backoffice/` (prefix handled by the outer Hono app and tenant/license
middleware stack).

Route file: `apps/api/src/routes/backoffice/category-values/index.ts`

### Route Table

| Method   | Path                   | Handler function             | Description                                              |
| -------- | ---------------------- | ---------------------------- | -------------------------------------------------------- |
| `GET`    | `/category-values`     | `listCategoryValuesHandler`  | Paginated list filtered by `category_id`, status, search |
| `POST`   | `/category-values`     | `createCategoryValueHandler` | Create a new Category Value with translations            |
| `GET`    | `/category-values/:id` | `getCategoryValueHandler`    | Get single value by ID (with translations + scope)       |
| `PATCH`  | `/category-values/:id` | `updateCategoryValueHandler` | Update fields, translations, status, or scope            |
| `DELETE` | `/category-values/:id` | `deleteCategoryValueHandler` | Soft-delete (set `deleted_at` to server timestamp)       |

---

### GET /category-values

**Query Parameters:**

| Parameter         | Type      | Required | Description                                                                      |
| ----------------- | --------- | -------- | -------------------------------------------------------------------------------- |
| `category_id`     | `UUID`    | Yes      | Parent category filter — required for all list calls                             |
| `status`          | `string`  | No       | Filter by status: `COMPLETED \| UNDER_REVIEW \| APPROVED \| ENABLED \| DISABLED` |
| `search`          | `string`  | No       | Partial case-insensitive search on translated `name` (max 100 chars)             |
| `language`        | `string`  | No       | Language code for returned translations. Defaults to workspace default.          |
| `page`            | `number`  | No       | Default `1`, min `1`                                                             |
| `limit`           | `number`  | No       | Default `20`, min `1`, max `100`                                                 |
| `include_deleted` | `boolean` | No       | Admin-only; include soft-deleted values when `true`. Default `false`.            |

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "category_id": "uuid",
        "code": "string",
        "status": "ENABLED",
        "name": "string",
        "description": "string | null",
        "subject_ids": ["uuid"],
        "division_ids": ["uuid"],
        "created_at": "ISO8601",
        "updated_at": "ISO8601",
        "deleted_at": "ISO8601 | null",
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

**Error Responses:**

| HTTP | Error Code           | Condition                                     |
| ---- | -------------------- | --------------------------------------------- |
| 422  | `VALIDATION_ERROR`   | Missing `category_id` or invalid query params |
| 404  | `CATEGORY_NOT_FOUND` | `category_id` does not exist in tenant DB     |

---

### POST /category-values

**Request Body:**

```json
{
  "category_id": "uuid (required)",
  "code": "string (required, max 100)",
  "translations": [
    {
      "language_code": "ar",
      "name": "string (required for default language)",
      "description": "string | null (optional)"
    }
  ],
  "subject_ids": ["uuid"],
  "division_ids": ["uuid"]
}
```

**Success Response (201):**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "category_id": "uuid",
    "code": "string",
    "status": "COMPLETED",
    "translations": [{ "language_code": "ar", "name": "سهل", "description": null }],
    "subject_ids": ["uuid"],
    "division_ids": ["uuid"],
    "created_at": "ISO8601",
    "updated_at": "ISO8601",
    "deleted_at": null,
    "created_by": "uuid | null",
    "updated_by": "uuid | null"
  },
  "error": null
}
```

**Error Responses:**

| HTTP | Error Code                            | Condition                                                        |
| ---- | ------------------------------------- | ---------------------------------------------------------------- |
| 404  | `CATEGORY_NOT_FOUND`                  | `category_id` does not exist in tenant DB                        |
| 422  | `CATEGORY_DISABLED`                   | Parent category is DISABLED; cannot add values                   |
| 409  | `CATEGORY_VALUE_CODE_DUPLICATE`       | `code` (case-insensitive) already taken in this category         |
| 422  | `CATEGORY_VALUE_NAME_REQUIRED`        | No `name` translation for workspace default language             |
| 422  | `UNSUPPORTED_LANGUAGE`                | A `language_code` is not in the workspace language config        |
| 422  | `CATEGORY_VALUE_SCOPE_EXCEEDS_PARENT` | `subject_ids` or `division_ids` are not a subset of parent scope |
| 404  | `CATEGORY_VALUE_SUBJECT_NOT_FOUND`    | Any `subject_id` not found in tenant DB                          |
| 404  | `CATEGORY_VALUE_DIVISION_NOT_FOUND`   | Any `division_id` not found in tenant DB                         |
| 422  | `VALIDATION_ERROR`                    | Missing required fields or invalid field values                  |
| 403  | `FORBIDDEN`                           | Missing `question_manage` AND `classification_manage` permission |
| 423  | `LICENSE_LOCKED`                      | Workspace license is `SOFT_LOCKED`                               |

---

### GET /category-values/:id

Returns a single Category Value with all translations and scope lists.

**Path Parameters:** `id` (UUID)

**Query Parameters:**

| Parameter  | Type     | Required | Description                                          |
| ---------- | -------- | -------- | ---------------------------------------------------- |
| `language` | `string` | No       | Preferred language for `name`/`description` display. |

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "category_id": "uuid",
    "category": { "id": "uuid", "name": "string", "status": "ENABLED" },
    "code": "string",
    "status": "ENABLED",
    "translations": [
      { "language_code": "ar", "name": "سهل", "description": null },
      { "language_code": "en", "name": "Easy", "description": null }
    ],
    "subject_ids": ["uuid"],
    "division_ids": ["uuid"],
    "created_at": "ISO8601",
    "updated_at": "ISO8601",
    "deleted_at": null,
    "created_by": "uuid | null",
    "updated_by": "uuid | null"
  },
  "error": null
}
```

**Error Responses:**

| HTTP | Error Code                 | Condition                                      |
| ---- | -------------------------- | ---------------------------------------------- |
| 422  | `VALIDATION_ERROR`         | `id` path parameter is not a valid UUID format |
| 404  | `CATEGORY_VALUE_NOT_FOUND` | Value does not exist, or is soft-deleted       |

---

### PATCH /category-values/:id

**Request Body (all fields optional; at least one required):**

```json
{
  "code": "string (max 100)",
  "status": "COMPLETED | UNDER_REVIEW | APPROVED | ENABLED | DISABLED",
  "translations": [
    {
      "language_code": "ar",
      "name": "string",
      "description": "string | null"
    }
  ],
  "subject_ids": ["uuid"],
  "division_ids": ["uuid"]
}
```

**Semantics for scope fields:**

- `subject_ids` absent → subject scope unchanged.
- `subject_ids: []` → all subject scope cleared; value applies globally within parent scope.
- `subject_ids: [uuid1]` → full replacement of subject scope with exactly these values.
- Same semantics for `division_ids`.

**Semantics for translations:**

- `translations` absent → translations unchanged.
- `translations: [{ language_code: "ar", name: "X" }]` → upsert for `ar`; other languages
  unchanged.

**Success Response (200):**

```json
{
  "success": true,
  "data": { "<updated category value row with translations and scope>" },
  "error": null
}
```

**Error Responses:**

| HTTP | Error Code                            | Condition                                                    |
| ---- | ------------------------------------- | ------------------------------------------------------------ |
| 404  | `CATEGORY_VALUE_NOT_FOUND`            | Value not found or soft-deleted                              |
| 409  | `CATEGORY_VALUE_CODE_DUPLICATE`       | New `code` already taken in this category                    |
| 422  | `INVALID_STATUS_TRANSITION`           | Proposed status not a valid transition from current status   |
| 422  | `CATEGORY_VALUE_CATEGORY_IMMUTABLE`   | Attempt to change `category_id`                              |
| 422  | `CATEGORY_VALUE_SCOPE_EXCEEDS_PARENT` | Scope IDs are not a subset of parent category's scope        |
| 422  | `UNSUPPORTED_LANGUAGE`                | A `language_code` in translations is not workspace-supported |
| 404  | `CATEGORY_VALUE_SUBJECT_NOT_FOUND`    | Any `subject_id` in new scope not found                      |
| 404  | `CATEGORY_VALUE_DIVISION_NOT_FOUND`   | Any `division_id` in new scope not found                     |
| 422  | `VALIDATION_ERROR`                    | Invalid field values or empty body                           |
| 403  | `FORBIDDEN`                           | Missing required permission                                  |

---

### DELETE /category-values/:id

Performs a **soft delete** by setting `deleted_at = NOW()` (server time). No SQL `DELETE` is
issued.

**Success Response (200):**

```json
{
  "success": true,
  "data": { "deleted": true },
  "error": null
}
```

**Error Responses:**

| HTTP | Error Code                 | Condition                                 |
| ---- | -------------------------- | ----------------------------------------- |
| 422  | `VALIDATION_ERROR`         | `id` is not a valid UUID format           |
| 404  | `CATEGORY_VALUE_NOT_FOUND` | Value not found (never existed)           |
| 422  | `CATEGORY_VALUE_IN_USE`    | Value is referenced by questions or exams |
| 403  | `FORBIDDEN`                | Missing required permission               |

---

## Business Rules

### BR-01: Code Uniqueness is Per-Category (Active Values Only)

`code` must be unique within a given `category_id` among non-soft-deleted values. The uniqueness
index is partial: `WHERE deleted_at IS NULL`. A re-created value with the same code as a
previously soft-deleted value is permitted. Uniqueness is case-insensitive (functional index on
`LOWER(code)`).

### BR-02: `category_id` is Immutable After Creation

A Category Value's parent category cannot be changed after creation. Any PATCH request that
includes a `category_id` field must be rejected with 422 `CATEGORY_VALUE_CATEGORY_IMMUTABLE`.
Domain reassignment is not permitted; the operator must soft-delete and recreate.

### BR-03: Initial Status is `COMPLETED`

All newly created Category Values start in `COMPLETED` status. The workflow engine advances them
through the defined transitions. There is no mechanism to create a value directly in `ENABLED`
status.

### BR-04: Only `ENABLED` Values With an `ENABLED` Parent Category Are Usable in Classification

Only values in `ENABLED` status may be:

- Assigned to new MCQ Question classifications
- Assigned to new Traditional Question classifications
- Referenced in Exam configuration auto-selection filters

Additionally, the value's parent Category must also be `ENABLED` at the time of assignment.
A value whose parent Category is `DISABLED` cannot be assigned to new content even if the value
itself is `ENABLED`. This check is performed at the service layer when validating a classification
assignment request.

Values in any other status (`COMPLETED`, `UNDER_REVIEW`, `APPROVED`, `DISABLED`), or whose parent
Category is `DISABLED`, must be rejected at the point of assignment with 422
`CATEGORY_VALUE_NOT_ENABLED`.

### BR-05: Referential Integrity Blocks Hard Deletion

`category_values.id` will be referenced by `mcq_questions` and `traditional_questions` via FK
constraints (added in subsequent stages). These `ON DELETE RESTRICT` constraints prevent hard
deletion at the database level. The API must additionally perform a soft-delete reference check
before setting `deleted_at`.

### BR-06: Parent Category Scope Is the Maximum Permissible Scope

If the parent Category has a `category_subjects` scope restriction, any `subject_ids` on the
Category Value must be a subset. If the parent Category has no subject scope restriction
(globally available), the Category Value may have any subject_ids or none.

The same rule applies to `division_ids`.

This ensures Category Values cannot be more broadly scoped than their parent Category.

### BR-07: All Writes Transactional

Every create, update (including translation upserts and scope replacements), and soft-delete
operation must complete within a single explicit `BEGIN / COMMIT / ROLLBACK` block. Partial state
is never persisted. Repository functions do not open transactions; the service layer is
responsible.

### BR-08: Scope Replacement Is Atomic

When `subject_ids` or `division_ids` is supplied, the full scope set is replaced atomically:
all previous scope rows are deleted first, then all new rows are inserted, within the same
transaction. No partial scope state is ever persisted.

### BR-09: Translation Upsert Semantics

When a PATCH includes a `translations` array, each item is upserted by `(entity_id,
language_code, field_name)`. Languages not included in the patch payload are left unchanged.
There is no mechanism to delete a specific translation via PATCH; translations are
additive/replaceable only.

### BR-10: Translation Fallback

When serving a `name` or `description`, the API falls back to the workspace default language if
the requested language has no translation. If no translation exists in any language, an empty
string is returned (never a null pointer error).

### BR-11: Soft-Delete Is the Only Delete Path

The API never issues a SQL `DELETE` on `category_values`. The `DELETE /category-values/:id`
endpoint sets `deleted_at` to the current server timestamp. The `ON DELETE RESTRICT` on
`category_id` prevents hard-deletion of a Category that has non-soft-deleted values. Downstream
FK constraints (added in later stages) prevent soft-deletion of a value that has active
references.

### BR-12: Disabled Values Preserve Existing References

When a value is `DISABLED` or soft-deleted, its existing question/exam references are not
deleted or nullified. Historical classification integrity is preserved. Only new assignments are
blocked.

### BR-13: `updated_by` Audit Column

`created_by` is set once at creation and never updated. `updated_by` is set to the acting user
ID on every mutation. Both use `ON DELETE SET NULL` semantics on their FK to `users.id`.

### BR-14: `deleted_at` Excludes from All Standard Queries

All standard list and lookup operations filter on `deleted_at IS NULL` unless the caller
explicitly passes `include_deleted=true` with admin-level permission. This filter is applied at
the repository layer, not the service layer, to ensure it cannot be accidentally omitted.

### BR-15: `SELECT FOR UPDATE` on Status Transitions and Soft-Delete

Any service operation that reads and then transitions status must acquire a row-level lock
(`SELECT ... FOR UPDATE`) on the `category_values` row before checking the current status and
applying the transition. This prevents concurrent status transitions from racing on stale state.

The soft-delete operation must also acquire `SELECT ... FOR UPDATE` on the target row before
executing the reference count check and setting `deleted_at`. Without this lock, two concurrent
DELETE requests could both pass the reference check before either commits, bypassing the
idempotency guard; note that an already-deleted value returns 200 `{ deleted: true }` (idempotent
pattern) rather than an error.

---

## Validation Rules

### Field-Level Validation

| Field           | Rule                                                                                      |
| --------------- | ----------------------------------------------------------------------------------------- |
| `category_id`   | Required on create. Valid UUID. Must exist in tenant DB. Immutable after creation.        |
| `code`          | Required on create. String. Max 100 chars. No leading/trailing whitespace. URL-safe.      |
| `status`        | Optional on create (defaults to `COMPLETED`). Must be a valid transition on update.       |
| `translations`  | On create: at minimum one entry for workspace default language with a non-empty `name`.   |
| `language_code` | Must be a workspace-configured language code (validated against workspace language list). |
| `name`          | Per-translation field. Non-empty string. Max 255 chars.                                   |
| `description`   | Per-translation field. Optional. Max 2000 chars.                                          |
| `subject_ids`   | Array of valid UUIDs, or empty array, or absent. Each must exist in tenant DB.            |
| `division_ids`  | Array of valid UUIDs, or empty array, or absent. Each must exist in tenant DB.            |

### Cross-Field Validation

| Rule                                                                    | Error Code                            |
| ----------------------------------------------------------------------- | ------------------------------------- |
| `status` change must follow valid transitions                           | `INVALID_STATUS_TRANSITION`           |
| `subject_ids` must be subset of parent Category's scope                 | `CATEGORY_VALUE_SCOPE_EXCEEDS_PARENT` |
| `division_ids` must be subset of parent Category's scope                | `CATEGORY_VALUE_SCOPE_EXCEEDS_PARENT` |
| `code` must be unique per `category_id` (case-insensitive, active only) | `CATEGORY_VALUE_CODE_DUPLICATE`       |

---

## Deletion Rules

| Condition                                                | Behaviour                                         |
| -------------------------------------------------------- | ------------------------------------------------- |
| Value is not referenced by any questions or exams        | Soft-delete allowed (set `deleted_at`)            |
| Value is referenced by `mcq_questions`                   | Soft-delete blocked → 422 `CATEGORY_VALUE_IN_USE` |
| Value is referenced by `traditional_questions`           | Soft-delete blocked → 422 `CATEGORY_VALUE_IN_USE` |
| Value is referenced by `exams`                           | Soft-delete blocked → 422 `CATEGORY_VALUE_IN_USE` |
| Value already soft-deleted                               | Returns 200 `{ deleted: true }` (idempotent)      |
| Hard SQL DELETE attempted via migration/tooling          | FK `ON DELETE RESTRICT` blocks at database level  |
| Category hard delete attempted while active values exist | FK `ON DELETE RESTRICT` blocks at database level  |

**Note:** Reference checking for MCQ Questions, Traditional Questions, and Exams will be enforced
at the service layer in this stage as pre-checks, in addition to the eventual DB-level FK
constraints added in later stages. Pre-checks use `COUNT` queries on downstream tables; if any
downstream tables do not yet exist (migration not yet applied), the pre-check is skipped and only
the DB FK constraint applies.

---

## Transaction Boundaries

| Operation                  | Transactional? | What is included in the transaction                                             |
| -------------------------- | -------------- | ------------------------------------------------------------------------------- |
| Create Category Value      | Yes            | INSERT into `category_values`, INSERT translations, INSERT scope rows           |
| Update Category Value      | Yes            | UPDATE `category_values`, UPSERT translations, DELETE+INSERT scope rows         |
| Status Transition          | Yes            | SELECT FOR UPDATE + UPDATE `category_values.status`                             |
| Soft-Delete Category Value | Yes            | SELECT FOR UPDATE + Reference count check + UPDATE `category_values.deleted_at` |

All transactions are managed at the **service layer**. Repository functions accept an optional
transaction handle and do not open their own transactions.

---

## Idempotency Strategy

| Operation          | Idempotency Mechanism                                                                                                       |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| Create             | Unique index on `(category_id, LOWER(code)) WHERE deleted_at IS NULL` prevents duplicates; returns 409 on conflict          |
| Status Transition  | Re-submitting the same transition for the current status returns 422 `INVALID_STATUS_TRANSITION`, not a silent success      |
| Soft-Delete        | Attempting to soft-delete an already-deleted value returns 200 `{ deleted: true }` (idempotent — no error, no side effects) |
| Scope Replacement  | Replacing with the same scope is idempotent (delete + re-insert within transaction)                                         |
| Translation Upsert | Upsert by `(entity_id, language_code, field_name)` is inherently idempotent                                                 |

---

## Observability Requirements

### Structured Log Fields (required on every request)

| Field               | Source                                           |
| ------------------- | ------------------------------------------------ |
| `request_id`        | Injected by request middleware                   |
| `workspace_slug`    | From tenant resolver context                     |
| `user_id`           | From auth session                                |
| `action`            | Descriptive name: `category_value.create`, etc.  |
| `category_value_id` | Included on get/update/delete operations         |
| `category_id`       | Always included                                  |
| `status`            | Status before and after on transition operations |
| `duration_ms`       | Total handler duration                           |

### Error Contract

All API responses follow:

```json
{
  "success": boolean,
  "data": object | null,
  "error": { "code": "string", "message": "string" } | null
}
```

---

## Rate Limiting & Abuse Protection

| Route Classification               | Rate Limit                  | Notes                            |
| ---------------------------------- | --------------------------- | -------------------------------- |
| Write routes (POST, PATCH, DELETE) | ≤ 30 req/min per workspace  | Applied by platform middleware   |
| Read routes (GET)                  | ≤ 120 req/min per workspace | Applied by platform middleware   |
| Auth required                      | All routes                  | Standard Backoffice session auth |

---

## Access Control

### Permission Requirements

| Operation                        | Required Permission                                     |
| -------------------------------- | ------------------------------------------------------- |
| Create / Update / Delete (write) | `question_manage` OR `classification_manage`            |
| Read (list, get)                 | Any authenticated Backoffice user with workspace access |
| Status transitions               | `question_manage` OR `classification_manage`            |
| `include_deleted=true` on list   | Admin role or `classification_manage` permission        |

### Permission Check Implementation

Permission enforcement uses **middleware** applied at the route level in `index.ts`.
Middleware order: tenant resolver → license middleware → session auth → `requirePermission(...)`.
Read routes do not carry `requirePermission`; they require only authenticated session and valid
license.

---

## Layer Separation Confirmation

| Layer    | Confirmed                                                                     |
| -------- | ----------------------------------------------------------------------------- |
| Frontend | No business logic — displays data returned by API                             |
| API      | No grading logic — routing, validation, tenant/license/permission checks only |
| Domain   | Pure functions for status transition validation, scope subset validation      |
| Worker   | No category-value writes — this feature is fully synchronous                  |
| MMC      | No tenant DB access — MMC does not interact with category_values              |

---

## Failure Modes & Recovery

| Failure Mode                          | Handling                                                             |
| ------------------------------------- | -------------------------------------------------------------------- |
| DB connection failure                 | 503 returned; no partial state written (transaction rolled back)     |
| Schema version mismatch               | 409 `SCHEMA_VERSION_MISMATCH` — request rejected before handler      |
| License soft-locked                   | 423 `LICENSE_LOCKED` — returned by license middleware before handler |
| Translation table unavailable         | 500 logged; transaction rolled back                                  |
| Concurrent status transition race     | `SELECT FOR UPDATE` prevents race; second writer receives 422        |
| Scope FK violation (subject/division) | Transaction rolled back; 404 returned to caller                      |
| Downstream reference check failure    | Transaction rolled back; 422 `CATEGORY_VALUE_IN_USE` returned        |

---

## Test Strategy

| Test Type             | Coverage                                                                          |
| --------------------- | --------------------------------------------------------------------------------- |
| Unit tests            | Status transition validation; scope subset validation; translation fallback logic |
| Integration tests     | Full CRUD flow per endpoint with tenant isolation assertions                      |
| Transaction rollback  | Partial-insert failure on scope rows must leave `category_values` row absent      |
| Idempotency tests     | Duplicate create → 409; duplicate soft-delete → 404; same scope replacement → 200 |
| Isolation tests       | Two tenants, same category IDs — confirmed no cross-tenant data returned          |
| Status workflow tests | Each valid transition succeeds; each invalid transition returns 422               |
| Translation tests     | Default-language fallback; missing language fallback; unsupported language → 422  |
| Scope enforcement     | Value scope exceeding parent scope → 422; subset sub-scope → 200                  |
| Deletion guard tests  | Value referenced by question → 422; unreferenced value → deleted                  |

---

## Non-Functional Requirements

| Requirement              | Target                                                                         |
| ------------------------ | ------------------------------------------------------------------------------ |
| List endpoint latency    | P99 < 200ms for up to 500 values per category with translations joined         |
| Single-value get latency | P99 < 100ms                                                                    |
| Write throughput         | Supports ≤ 30 req/min per workspace without degradation                        |
| Concurrent writes        | Row-level locking prevents race conditions on status transitions               |
| Soft-delete recovery     | Soft-deleted data remains accessible to admins with `include_deleted` flag     |
| Data residency           | All `category_values` data resides exclusively in the tenant DB — no master DB |

---

## Explicit Non-Goals

This feature does **NOT**:

- Store scoring, grading, or weighting logic (values are classification metadata only)
- Manage division or subject assignment directly (references only via scope tables)
- Implement automatic propagation of status changes to downstream question references
- Provide a Frontoffice-facing read API for Category Values (Frontoffice inherits context via
  enrolled exam snapshots)
- Allow moving a Category Value from one Category to another
- Expose a bulk-import API for Category Values (out of scope for this stage)
- Implement history/audit trail beyond `created_by`, `updated_by`, `created_at`, `updated_at`
- Define question-level validation rules (that is the responsibility of the MCQ/TQ stages)

---

## Assumptions

1. The `translations` table with the described schema already exists or will be created as part
   of the i18n infrastructure (pre-requisite for this stage).
2. The workspace language list is available via the tenant context (e.g., `c.get('tenant').languages`).
3. Downstream tables (`mcq_questions`, `traditional_questions`) do not yet have FK constraints
   to `category_values.id` at the time this migration runs; the reference check in the
   soft-delete handler must be conditional on table existence.
4. `ON DELETE RESTRICT` on `category_values.category_id → categories.id` means that a Category
   with active values cannot be hard-deleted. This is enforced at the DB level and is
   intentional.
5. "Active" for scope-subset validation means the parent category's scope at the time of the
   Category Value create/update; the scope is not dynamically re-validated if the parent
   category's scope later changes.

---

## Final Constitutional Compliance Statement

Compliant with Zidney Constitution v1.2.0 — No violations detected.

---

## Clarifications

### Session 2026-03-22

**Q: Should `SELECT FOR UPDATE` be applied to the soft-delete operation to prevent a concurrent-deletion race on the reference count check?**
**A:** Yes. The soft-delete transaction must acquire `SELECT ... FOR UPDATE` on the `category_values` row before running the reference count check and writing `deleted_at`. Without this lock, two concurrent DELETE requests can both pass the reference check before either commits, defeating the 404 idempotency guard. This is consistent with BR-15's locking philosophy and has been applied: the Transaction Boundaries table now records `SELECT FOR UPDATE` for soft-delete, and BR-15 has been extended to cover this case.

**Q: Are status transition permissions role-differentiated across transition stages (e.g., only a reviewer can approve UNDER_REVIEW → APPROVED), or is a single permission tier applied uniformly?**
**A:** A flat single-tier permission (`question_manage OR classification_manage`) governs ALL status transitions uniformly for this stage. No per-transition role differentiation is required. The workflow is editorial, not a strict multi-role approval gate. Role-scoped transition gating is out of scope for Stage 31 and may be introduced in a future governance stage if needed.

**Q: Can a parent Category be DISABLED while it has active (non-soft-deleted) Category Values, and what is the usability impact on those ENABLED values?**
**A:** Yes — the Category disable guard (Stage 30, US-06 scenario 5) only blocks disabling a Category with ENABLED direct child _categories_; it does not block based on the presence of Category Values. However, BR-04 has been extended: a Category Value is usable for new content assignment **only if** both the value is `ENABLED` AND its parent Category is also `ENABLED`. Existing references to a value whose parent is subsequently `DISABLED` are preserved for historical integrity. The usability block applies only to _new_ assignments.

**Q: Does the general PATCH endpoint (code, translations, scope fields) require a concurrency guard beyond the `SELECT FOR UPDATE` already specified for status transitions?**
**A:** No additional locking (`version` column or ETag) is required. For non-status PATCH fields (code, translations, scope), last-write-wins semantics are acceptable — backoffice editorial concurrency is low and the `updated_at` audit column provides accountability. The `SELECT FOR UPDATE` requirement in BR-15 applies to status-transition operations only; it does not apply to general field updates in this stage.

**Q: Is the per-category `code` uniqueness intentional and does it permit the same `code` value across different categories in the same tenant?**
**A:** Yes, intentional. Category Value `code` identifies one option _within_ a classification dimension (e.g., `"EASY"` within Difficulty), whereas Category `code` identifies the dimension axis itself (tenant-scoped). Reusing `"EASY"` across multiple categories (e.g., Difficulty → Easy, Cognitive Level → Easy) is a valid and expected use case. The partial unique index `(category_id, LOWER(code)) WHERE deleted_at IS NULL` is the correct and complete constraint. No cross-category code uniqueness is required.

---

## Risk Assessment

| Risk Factor                        | Score  |
| ---------------------------------- | ------ |
| Database migration (schema change) | +3     |
| New tables added (3 tables)        | +2     |
| Security-sensitive logic           | +3     |
| Multi-tenant data isolation logic  | +3     |
| More than 10 tasks                 | +1     |
| Worker interaction / async job     | 0      |
| External API integration           | 0      |
| New package dependency             | 0      |
| **Total**                          | **12** |

**Risk Level: HIGH (12 / threshold 8+)**

Primary drivers: new tenant-scoped schema (3 tables + migration), multi-tenant isolation across
all layers, permission gating on all write paths, `SELECT FOR UPDATE` concurrency requirements,
and the reference-check guard on soft-delete against cross-stage downstream tables.
