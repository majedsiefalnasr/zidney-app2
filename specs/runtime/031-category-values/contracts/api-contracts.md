# API Contracts: Category Values (Stage 031)

**Stage**: STAGE_31_CATEGORY_VALUES  
**Phase**: 03_BACKOFFICE_CORE / 03_CONTENT_CLASSIFICATION  
**Date**: 2026-03-22  
**Base Path**: `/workspace/:slug/backoffice/category-values`  
**Middleware**: tenant resolver → license middleware → permission guard (before all handlers)

---

## Global Conventions

- All responses follow the error contract: `{ success: boolean, data: object|null, error: { code, message }|null }`
- All timestamps are ISO 8601 format with timezone (UTC)
- UUIDs are lowercase hyphenated format
- Rate limits: **writes ≤ 30 req/min**, **reads ≤ 120 req/min** per workspace
- License requirement: `ACTIVE` only. `SOFT_LOCKED` → 423. `ARCHIVED` → 403.
- Schema version: `MIN_SCHEMA_VERSION = "1.15.0"`. Tenants below this → 409 `SCHEMA_VERSION_MISMATCH`.
- Permission gates: `question_manage` OR `classification_manage` required for all write operations.

---

## Route Table

| Method   | Path                   | Handler                      | Auth Required                            | Rate Limit |
| -------- | ---------------------- | ---------------------------- | ---------------------------------------- | ---------- |
| `GET`    | `/category-values`     | `listCategoryValuesHandler`  | workspace staff                          | 120/min    |
| `POST`   | `/category-values`     | `createCategoryValueHandler` | question_manage OR classification_manage | 30/min     |
| `GET`    | `/category-values/:id` | `getCategoryValueHandler`    | workspace staff                          | 120/min    |
| `PATCH`  | `/category-values/:id` | `updateCategoryValueHandler` | question_manage OR classification_manage | 30/min     |
| `DELETE` | `/category-values/:id` | `deleteCategoryValueHandler` | question_manage OR classification_manage | 30/min     |

---

## GET /category-values

Paginated list of Category Values for a specific parent category.

### Request

**Method:** `GET`  
**Path:** `/workspace/:slug/backoffice/category-values`

**Query Parameters:**

| Parameter         | Type    | Required | Validation                                                             | Default           |
| ----------------- | ------- | -------- | ---------------------------------------------------------------------- | ----------------- |
| `category_id`     | UUID    | **Yes**  | Valid UUID v4 format                                                   | —                 |
| `status`          | string  | No       | One of: `COMPLETED`, `UNDER_REVIEW`, `APPROVED`, `ENABLED`, `DISABLED` | —                 |
| `search`          | string  | No       | Max 100 characters; used as ILIKE `%search%` on translated name        | —                 |
| `language`        | string  | No       | 2–10 chars; workspace-supported language code                          | workspace default |
| `page`            | integer | No       | Min 1                                                                  | `1`               |
| `limit`           | integer | No       | Min 1, max 100                                                         | `20`              |
| `include_deleted` | boolean | No       | Requires admin permission; `true` includes soft-deleted                | `false`           |

### Success Response — 200 OK

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "category_id": "1a2b3c4d-5e6f-7890-abcd-ef1234567890",
        "code": "EASY",
        "status": "ENABLED",
        "name": "Easy",
        "description": null,
        "subject_ids": ["uuid1", "uuid2"],
        "division_ids": [],
        "created_at": "2026-03-22T10:00:00.000Z",
        "updated_at": "2026-03-22T10:05:00.000Z",
        "deleted_at": null,
        "created_by": "user-uuid",
        "updated_by": null
      }
    ],
    "total": 3,
    "page": 1,
    "limit": 20
  },
  "error": null
}
```

**List item fields:**

- `name`: resolved from `translations` for the requested `language` (or workspace default)
- `description`: resolved from `translations`; `null` if no description translation exists
- `subject_ids`: array of UUIDs from `category_value_subjects`; empty if globally scoped
- `division_ids`: array of UUIDs from `category_value_divisions`; empty if globally scoped

### Error Responses

| HTTP | Error Code                | Condition                                                                     |
| ---- | ------------------------- | ----------------------------------------------------------------------------- |
| 422  | `VALIDATION_ERROR`        | `category_id` missing or invalid UUID format; invalid `page`/`limit`          |
| 404  | `CATEGORY_NOT_FOUND`      | `category_id` does not exist in the tenant DB                                 |
| 403  | `FORBIDDEN`               | Caller lacks `classification_manage` and `include_deleted=true` was requested |
| 409  | `SCHEMA_VERSION_MISMATCH` | Tenant schema below `1.15.0`                                                  |
| 423  | `LICENSE_LOCKED`          | Workspace license is `SOFT_LOCKED`                                            |
| 403  | `FORBIDDEN`               | Workspace license is `ARCHIVED`                                               |

---

## POST /category-values

Create a new Category Value within an existing ENABLED parent Category.

### Request

**Method:** `POST`  
**Path:** `/workspace/:slug/backoffice/category-values`  
**Content-Type:** `application/json`

**Request Body:**

```json
{
  "category_id": "1a2b3c4d-5e6f-7890-abcd-ef1234567890",
  "code": "EASY",
  "translations": [
    {
      "language_code": "ar",
      "name": "سهل",
      "description": null
    },
    {
      "language_code": "en",
      "name": "Easy",
      "description": "An easy difficulty level"
    }
  ],
  "subject_ids": ["uuid1"],
  "division_ids": []
}
```

**Field Validation:**

| Field                          | Type         | Required               | Constraints                                                              |
| ------------------------------ | ------------ | ---------------------- | ------------------------------------------------------------------------ |
| `category_id`                  | UUID         | Yes                    | Valid UUID v4; must exist and be ENABLED                                 |
| `code`                         | string       | Yes                    | 1–100 chars; trimmed; case-insensitive unique per category               |
| `translations`                 | array        | Yes                    | At least one entry with the workspace default language                   |
| `translations[].language_code` | string       | Yes                    | Must be in workspace supported_languages                                 |
| `translations[].name`          | string       | Yes (for default lang) | 1–500 chars                                                              |
| `translations[].description`   | string\|null | No                     | Max 2000 chars                                                           |
| `subject_ids`                  | UUID[]       | No                     | Each UUID must exist; must be subset of parent category's subject scope  |
| `division_ids`                 | UUID[]       | No                     | Each UUID must exist; must be subset of parent category's division scope |

### Success Response — 201 Created

```json
{
  "success": true,
  "data": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "category_id": "1a2b3c4d-5e6f-7890-abcd-ef1234567890",
    "code": "EASY",
    "status": "COMPLETED",
    "translations": [
      { "language_code": "ar", "name": "سهل", "description": null },
      { "language_code": "en", "name": "Easy", "description": "An easy difficulty level" }
    ],
    "subject_ids": ["uuid1"],
    "division_ids": [],
    "created_at": "2026-03-22T10:00:00.000Z",
    "updated_at": "2026-03-22T10:00:00.000Z",
    "deleted_at": null,
    "created_by": "user-uuid",
    "updated_by": null
  },
  "error": null
}
```

**Guarantees:**

- `status` is always `COMPLETED` on creation (hardcoded; not client-supplied)
- `deleted_at` is always `null` on creation
- All provided translations are persisted atomically in the same transaction

### Error Responses

| HTTP | Error Code                            | Condition                                                                       |
| ---- | ------------------------------------- | ------------------------------------------------------------------------------- |
| 404  | `CATEGORY_NOT_FOUND`                  | `category_id` does not exist in tenant DB                                       |
| 422  | `CATEGORY_DISABLED`                   | Parent category status is not `ENABLED`                                         |
| 409  | `CATEGORY_VALUE_CODE_DUPLICATE`       | `code` (case-insensitive) already taken in this category among active values    |
| 422  | `CATEGORY_VALUE_NAME_REQUIRED`        | No `name` translation for the workspace default language                        |
| 422  | `UNSUPPORTED_LANGUAGE`                | A `language_code` is not in the workspace's `supported_languages`               |
| 422  | `CATEGORY_VALUE_SCOPE_EXCEEDS_PARENT` | `subject_ids` or `division_ids` are not a subset of the parent category's scope |
| 404  | `CATEGORY_VALUE_SUBJECT_NOT_FOUND`    | One or more `subject_id` values do not exist in the tenant DB                   |
| 404  | `CATEGORY_VALUE_DIVISION_NOT_FOUND`   | One or more `division_id` values do not exist in the tenant DB                  |
| 422  | `VALIDATION_ERROR`                    | Missing required fields; invalid UUID format; field length exceeded             |
| 403  | `FORBIDDEN`                           | Caller lacks `question_manage` and `classification_manage`                      |
| 409  | `SCHEMA_VERSION_MISMATCH`             | Tenant schema below `1.15.0`                                                    |
| 423  | `LICENSE_LOCKED`                      | Workspace license is `SOFT_LOCKED`                                              |

---

## GET /category-values/:id

Retrieve complete details of a single Category Value including all translations and scope.

### Request

**Method:** `GET`  
**Path:** `/workspace/:slug/backoffice/category-values/:id`

**Path Parameters:**

| Parameter | Type | Required | Validation           |
| --------- | ---- | -------- | -------------------- |
| `id`      | UUID | Yes      | Valid UUID v4 format |

**Query Parameters:**

| Parameter  | Type   | Required | Description                                                                          |
| ---------- | ------ | -------- | ------------------------------------------------------------------------------------ |
| `language` | string | No       | Preferred language for `name`/`description` display (affects list view `name` field) |

### Success Response — 200 OK

```json
{
  "success": true,
  "data": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "category_id": "1a2b3c4d-5e6f-7890-abcd-ef1234567890",
    "category": {
      "id": "1a2b3c4d-5e6f-7890-abcd-ef1234567890",
      "name": "Difficulty",
      "status": "ENABLED"
    },
    "code": "EASY",
    "status": "ENABLED",
    "translations": [
      { "language_code": "ar", "name": "سهل", "description": null },
      { "language_code": "en", "name": "Easy", "description": "An easy difficulty level" }
    ],
    "subject_ids": ["uuid1"],
    "division_ids": [],
    "created_at": "2026-03-22T10:00:00.000Z",
    "updated_at": "2026-03-22T10:05:00.000Z",
    "deleted_at": null,
    "created_by": "user-uuid",
    "updated_by": "another-user-uuid"
  },
  "error": null
}
```

**Notes:**

- `translations` always contains **all** available language translations for the value

> **Translation shape note** — Translation objects in API responses use `name` and `description` as
> field keys. Internally the `translations` table stores each as a separate row with
> `field_name = 'name' | 'description'` and the text in `translated_value`. The API layer groups
> rows by `language_code` and remaps `translated_value` to the corresponding field key. The raw
> `translated_value` column name does not appear in API request/response bodies.

- `category` is a summary of the parent category (not the full category object)
- Soft-deleted values (deleted_at IS NOT NULL) return 404 as if not found

### Error Responses

| HTTP | Error Code                 | Condition                                             |
| ---- | -------------------------- | ----------------------------------------------------- |
| 422  | `VALIDATION_ERROR`         | `id` path parameter is not a valid UUID format        |
| 404  | `CATEGORY_VALUE_NOT_FOUND` | Value does not exist in tenant DB, or is soft-deleted |
| 409  | `SCHEMA_VERSION_MISMATCH`  | Tenant schema below `1.15.0`                          |
| 423  | `LICENSE_LOCKED`           | Workspace license is `SOFT_LOCKED`                    |

---

## PATCH /category-values/:id

Partially update a Category Value. All fields are optional; at least one must be provided.

### Request

**Method:** `PATCH`  
**Path:** `/workspace/:slug/backoffice/category-values/:id`  
**Content-Type:** `application/json`

**Path Parameters:**

| Parameter | Type | Required | Validation           |
| --------- | ---- | -------- | -------------------- |
| `id`      | UUID | Yes      | Valid UUID v4 format |

**Request Body (all optional, at least one required):**

```json
{
  "code": "MEDIUM",
  "status": "UNDER_REVIEW",
  "translations": [
    {
      "language_code": "ar",
      "name": "متوسط",
      "description": "مستوى متوسط"
    }
  ],
  "subject_ids": ["uuid1", "uuid2"],
  "division_ids": []
}
```

**Field Semantics:**

| Field          | Semantics                                                                                    |
| -------------- | -------------------------------------------------------------------------------------------- |
| `code`         | Replace code; must remain case-insensitively unique for active values in this category       |
| `status`       | Trigger a status transition; must be a valid transition from current status                  |
| `translations` | Array absent → unchanged. Array present → upsert listed languages; other languages unchanged |
| `subject_ids`  | Array absent → unchanged. `[]` → clear all subject scope. Non-empty → full replace           |
| `division_ids` | Array absent → unchanged. `[]` → clear all division scope. Non-empty → full replace          |

**Validation Rules:**

- `category_id` in body → rejected with 422 `CATEGORY_VALUE_CATEGORY_IMMUTABLE`
- `status` must follow the allowed transition graph (see Status Workflow)
- New `subject_ids` must be a subset of the parent Category's subject scope
- New `division_ids` must be a subset of the parent Category's division scope

### Success Response — 200 OK

```json
{
  "success": true,
  "data": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "category_id": "1a2b3c4d-5e6f-7890-abcd-ef1234567890",
    "code": "MEDIUM",
    "status": "UNDER_REVIEW",
    "translations": [
      { "language_code": "ar", "name": "متوسط", "description": "مستوى متوسط" },
      { "language_code": "en", "name": "Easy", "description": null }
    ],
    "subject_ids": ["uuid1", "uuid2"],
    "division_ids": [],
    "created_at": "2026-03-22T10:00:00.000Z",
    "updated_at": "2026-03-22T11:00:00.000Z",
    "deleted_at": null,
    "created_by": "user-uuid",
    "updated_by": "updater-uuid"
  },
  "error": null
}
```

### Error Responses

| HTTP | Error Code                            | Condition                                                       |
| ---- | ------------------------------------- | --------------------------------------------------------------- |
| 404  | `CATEGORY_VALUE_NOT_FOUND`            | Value not found or is soft-deleted                              |
| 409  | `CATEGORY_VALUE_CODE_DUPLICATE`       | New `code` already taken in this category                       |
| 422  | `INVALID_STATUS_TRANSITION`           | Proposed `status` is not a valid transition from current status |
| 422  | `CATEGORY_VALUE_CATEGORY_IMMUTABLE`   | `category_id` was present in the request body                   |
| 422  | `CATEGORY_VALUE_SCOPE_EXCEEDS_PARENT` | Scope IDs exceed the parent Category's scope restrictions       |
| 422  | `UNSUPPORTED_LANGUAGE`                | A `language_code` in translations not in workspace config       |
| 404  | `CATEGORY_VALUE_SUBJECT_NOT_FOUND`    | A `subject_id` in the new scope not found in tenant DB          |
| 404  | `CATEGORY_VALUE_DIVISION_NOT_FOUND`   | A `division_id` in the new scope not found in tenant DB         |
| 422  | `VALIDATION_ERROR`                    | Invalid field values; empty request body                        |
| 403  | `FORBIDDEN`                           | Caller lacks the required permission                            |
| 409  | `CATEGORY_VALUE_LOCK_CONFLICT`        | Concurrent modification; retry                                  |
| 409  | `SCHEMA_VERSION_MISMATCH`             | Tenant schema below `1.15.0`                                    |
| 423  | `LICENSE_LOCKED`                      | Workspace license is `SOFT_LOCKED`                              |

---

## DELETE /category-values/:id

Soft-delete a Category Value (sets `deleted_at = NOW()`). No SQL `DELETE` is issued.

### Request

**Method:** `DELETE`  
**Path:** `/workspace/:slug/backoffice/category-values/:id`

**Path Parameters:**

| Parameter | Type | Required | Validation           |
| --------- | ---- | -------- | -------------------- |
| `id`      | UUID | Yes      | Valid UUID v4 format |

**No request body.**

### Success Response — 200 OK

```json
{
  "success": true,
  "data": { "deleted": true },
  "error": null
}
```

**Guarantees:**

- `deleted_at` is set to the current **server** timestamp (never client-supplied)
- The `category_values` row remains in the database; only `deleted_at` is written
- Associated `category_value_subjects` and `category_value_divisions` rows are **not** deleted
  (scope data is preserved for audit purposes)
- The soft-deleted value no longer appears in list results (default) or get responses

### Error Responses

| HTTP | Error Code                     | Condition                                                           |
| ---- | ------------------------------ | ------------------------------------------------------------------- |
| 422  | `VALIDATION_ERROR`             | `id` is not a valid UUID format                                     |
| 404  | `CATEGORY_VALUE_NOT_FOUND`     | Value row does not exist in the tenant DB                           |
| 422  | `CATEGORY_VALUE_IN_USE`        | Value is referenced by one or more questions or exam configurations |
| 403  | `FORBIDDEN`                    | Caller lacks `question_manage` and `classification_manage`          |
| 409  | `CATEGORY_VALUE_LOCK_CONFLICT` | Concurrent modification in progress (PG 55P03); retry               |
| 409  | `SCHEMA_VERSION_MISMATCH`      | Tenant schema below `1.15.0`                                        |
| 423  | `LICENSE_LOCKED`               | Workspace license is `SOFT_LOCKED`                                  |

---

## Shared Error Response Shape

All error responses conform to:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "CATEGORY_VALUE_NOT_FOUND",
    "message": "Category value not found."
  }
}
```

---

## Status Workflow Reference

Valid transitions (enforced by service layer):

| From           | To             | Allowed                             |
| -------------- | -------------- | ----------------------------------- |
| `COMPLETED`    | `UNDER_REVIEW` | ✓                                   |
| `UNDER_REVIEW` | `APPROVED`     | ✓                                   |
| `APPROVED`     | `ENABLED`      | ✓                                   |
| `APPROVED`     | `DISABLED`     | ✓                                   |
| `ENABLED`      | `DISABLED`     | ✓                                   |
| `DISABLED`     | `ENABLED`      | ✓                                   |
| Any other pair | —              | ✗ → 422 `INVALID_STATUS_TRANSITION` |

---

## Implementation Notes for Route Handlers

1. **No business logic in route handlers.** All validation and DB operations are delegated to functions
   in `packages/domain-core/src/category-values/`.

2. **Permission check order:** tenant resolver → license middleware → permission guard → handler.
   Permission is checked before any DB query.

3. **`getDb(c)`** extracts the tenant pool from `c.get('tenant').pool`.

4. **`buildAuditCtx(c)`** extracts `user_id`, `correlation_id`, `workspace_slug`, `workspace_id`.

5. **Error mapping:** `CategoryValueError` instances are caught in each handler and mapped to HTTP
   responses via `CATEGORY_VALUE_ERROR_HTTP_STATUS` lookup table.

6. **Correlation ID** is included in all structured log entries.

7. **Search safety:** the `search` parameter is passed as a parameterised SQL value
   (`params.push('%' + search + '%')`), never interpolated into the SQL string.
