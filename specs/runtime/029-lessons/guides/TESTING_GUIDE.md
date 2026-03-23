# Testing Guide — Stage 029: Lessons

**Branch:** `spec/029-lessons`  
**Base URL:** `/api/v1/backoffice/workspace`  
**Auth:** Bearer token required (backoffice user)  
**Tenant:** workspace resolved from URL path (`/:workspaceSlug`)

---

## Prerequisites

1. A workspace with a valid license exists
2. A Subject exists — you'll need its `id` as `subjectId` in lesson operations
3. User is authenticated with backoffice scope

---

## API Endpoints

### 1. List Lessons (paginated)

**Request:**

```
GET /api/v1/backoffice/workspace/:workspaceSlug/lessons
    ?subjectId=<uuid>
    &page=1
    &limit=20
    &search=physics
    &status=ENABLED
```

**Expected response (200):**

```json
{
  "success": true,
  "data": {
    "lessons": [
      {
        "id": "...",
        "subjectId": "...",
        "name": "Introduction to Physics",
        "code": "PHYS-101",
        "description": "...",
        "status": "ENABLED",
        "createdAt": "2026-03-21T00:00:00.000Z",
        "updatedAt": "2026-03-21T00:00:00.000Z"
      }
    ],
    "total": 1,
    "page": 1,
    "limit": 20
  },
  "error": null
}
```

**Edge cases:**

- `subjectId` required — omitting it returns 400
- `status` filter: `ENABLED` or `DISABLED`
- Empty result → `{ lessons: [], total: 0, page: 1 }`

---

### 2. Get Active Lessons (minimal — for frontoffice/runtime)

**Request:**

```
GET /api/v1/backoffice/workspace/:workspaceSlug/lessons/runtime
    ?subjectId=<uuid>
```

**Expected response (200):**

```json
{
  "success": true,
  "data": {
    "lessons": [{ "id": "...", "name": "Introduction to Physics", "code": "PHYS-101" }]
  },
  "error": null
}
```

**Note:** Only returns `ENABLED` lessons. Returns only `id`, `name`, `code`.

---

### 3. Create Lesson

**Request:**

```
POST /api/v1/backoffice/workspace/:workspaceSlug/lessons
Content-Type: application/json

{
  "subjectId": "<uuid>",
  "name": "Introduction to Physics",
  "code": "PHYS-101",
  "description": "Covers basic mechanics and thermodynamics"
}
```

**Expected response (201):**

```json
{
  "success": true,
  "data": {
    "lesson": { "id": "...", "subjectId": "...", "name": "...", ... }
  },
  "error": null
}
```

**Error cases:**

- Duplicate name within same subject → 409 `LESSON_NAME_DUPLICATE`
- Invalid `subjectId` (not a UUID) → 422
- Missing `name` → 422

---

### 4. Get Single Lesson

**Request:**

```
GET /api/v1/backoffice/workspace/:workspaceSlug/lessons/:lessonId
```

**Expected response (200):**

```json
{
  "success": true,
  "data": {
    "lesson": { "id": "...", "subjectId": "...", "name": "...", ... }
  },
  "error": null
}
```

**Error cases:**

- Unknown `lessonId` → 404 `LESSON_NOT_FOUND`

---

### 5. Update Lesson

**Request:**

```
PATCH /api/v1/backoffice/workspace/:workspaceSlug/lessons/:lessonId
Content-Type: application/json

{
  "name": "Updated Lesson Name",
  "status": "DISABLED"
}
```

**Expected response (200):**

```json
{
  "success": true,
  "data": { "lesson": { ... } },
  "error": null
}
```

**Error cases:**

- Editing non-status fields on a `DISABLED` lesson → 409 `LESSON_DISABLED`
- Setting `status: ENABLED` when already `ENABLED` → 409 `LESSON_ALREADY_ENABLED`
- Setting `status: DISABLED` when already `DISABLED` → 409 `LESSON_ALREADY_DISABLED`
- Duplicate name within subject → 409 `LESSON_NAME_DUPLICATE`
- Unknown `lessonId` → 404 `LESSON_NOT_FOUND`

---

### 6. Delete Lesson (soft-delete)

**Request:**

```
DELETE /api/v1/backoffice/workspace/:workspaceSlug/lessons/:lessonId
```

**Expected response (200):**

```json
{
  "success": true,
  "data": { "deleted": true },
  "error": null
}
```

**Note:** Soft-delete — sets `status = DISABLED`. Does not remove the row.

**Error cases:**

- Lesson already `DISABLED` → 409 `LESSON_ALREADY_DISABLED`
- Unknown `lessonId` → 404 `LESSON_NOT_FOUND`

---

## Error Response Shape

All errors follow the standard contract:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "LESSON_NOT_FOUND",
    "message": "Lesson not found"
  }
}
```

HTTP status codes per error code:

| Code                      | HTTP Status |
| ------------------------- | ----------- |
| `LESSON_NOT_FOUND`        | 404         |
| `LESSON_NAME_DUPLICATE`   | 409         |
| `LESSON_ALREADY_ENABLED`  | 409         |
| `LESSON_ALREADY_DISABLED` | 409         |
| `LESSON_DISABLED`         | 409         |
| `LESSON_INVALID_INPUT`    | 422         |
| `LESSON_INTERNAL_ERROR`   | 500         |

---

## Database Verification

After each mutation, verify in the tenant DB:

```sql
-- List all lessons for a subject
SELECT id, name, code, status, created_at, updated_at
FROM lessons
WHERE subject_id = '<subjectId>'
ORDER BY created_at;

-- Verify soft-delete
SELECT id, status FROM lessons WHERE id = '<lessonId>';
-- Should show status = 'DISABLED'
```

---

## Automated Test Coverage

Run without a database:

```bash
bun run test \
  packages/domain-core/src/lessons/__tests__/lessons.service.test.ts \
  apps/api/src/routes/backoffice/lessons/__tests__/lessons.integration.test.ts
```

Expected: **37/37 passing**
