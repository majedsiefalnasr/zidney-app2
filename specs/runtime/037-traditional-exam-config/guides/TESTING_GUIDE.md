# Testing Guide — Traditional Exam Configuration

**Stage:** Traditional Exam Configuration  
**Branch:** `spec/037-traditional-exam-config`  
**Audience:** QA engineers, reviewing developers

---

## Overview

This guide covers manual testing scenarios for Stage 37 — Traditional Exam Configuration. All endpoints require an authenticated session with a valid workspace license. Use a tenant workspace slug in the URL or subdomain.

Base URL: `https://<tenant>.zidney.app/api/v1/backoffice/workspace`  
Auth header: `Authorization: Bearer <jwt_token>`

---

## Prerequisites

1. A tenant workspace with a valid license (non-expired, correct tier).
2. A user account with backoffice access.
3. At least one `topic` (or `exercise`) module enabled in the workspace (provides `exam_module_type_id`).
4. At least one section template with subsections (`traditional_exam_sections` + `traditional_exam_subsections` with FK to the exam via `exam_id`). Sections/subsections are created by a prior stage and linked to the exam on creation via template.
5. At least one `question` record in the question bank (provides `question_id` for assignment).

---

## Scenario 1 — Create a Traditional Exam

**Endpoint:** `POST /traditional-exams`  
**Role required:** `write` (e.g. `admin`, `content_manager`)

**Step 1 — Create exam:**

```json
POST /traditional-exams
{
  "title": "Mathematics Final Exam",
  "exam_module_type_id": "<uuid of the module type>",
  "grading_mode": "auto",
  "allow_back_navigation": true,
  "randomize_questions": false,
  "show_results_immediately": true,
  "passing_score_percentage": 60
}
```

**Expected response:**

```json
{
  "success": true,
  "data": {
    "id": "<uuid>",
    "tenant_id": "<tenant_uuid>",
    "title": "Mathematics Final Exam",
    "status": "DRAFT",
    "grading_mode": "auto",
    "created_at": "...",
    "updated_at": "..."
  },
  "error": null
}
```

**Verify:** `status` is `DRAFT`. `tenant_id` matches the current tenant.

---

## Scenario 2 — List Exams

**Endpoint:** `GET /traditional-exams`  
**Role required:** `read`

**Step 1 — List with pagination:**

```
GET /traditional-exams?page=1&limit=20
```

**Expected:** Array of exams. Only exams belonging to the current tenant (tenant isolation).

**Step 2 — Filter by status:**

```
GET /traditional-exams?status=DRAFT
```

**Verify:** Only `DRAFT` exams returned.

---

## Scenario 3 — Get Exam Detail

**Endpoint:** `GET /traditional-exams/:id`  
**Role required:** `read`

```
GET /traditional-exams/<exam_id>
```

**Expected:** Full exam object.  
**Verify 404:** Request with `id` belonging to a different tenant → `404 NOT_FOUND`.

---

## Scenario 4 — Update Exam

**Endpoint:** `PUT /traditional-exams/:id`  
**Role required:** `write`

```json
PUT /traditional-exams/<exam_id>
{
  "title": "Mathematics Final Exam (Updated)",
  "passing_score_percentage": 70
}
```

**Expected:** Updated exam object. `updated_at` is newer.

**Blocked state test:** Transition to `ENABLED` first, then attempt `PUT`:

```
Expected: 422 TRADITIONAL_EXAM_INVALID_STATUS_FOR_OPERATION
```

---

## Scenario 5 — State Transitions (FSM)

**Endpoint:** `POST /traditional-exams/:id/workflow/transition`  
**Role required:** `transition` (e.g. `admin`, `publisher`)

### 5a — Submit for review

```json
POST /traditional-exams/<exam_id>/workflow/transition
{ "target_status": "UNDER_REVIEW" }
```

**Expected:** `status: UNDER_REVIEW`

### 5b — Enable (requires valid structure)

```json
POST /traditional-exams/<exam_id>/workflow/transition
{ "target_status": "ENABLED" }
```

**Expected if structure is incomplete:**

```json
{ "success": false, "error": { "code": "TRADITIONAL_EXAM_ENABLE_VALIDATION_FAILED", ... } }
```

**Expected if structure is valid (all subsections have `question_count` questions assigned, all with `points_per_question`):**

```json
{ "data": { "status": "ENABLED" } }
```

### 5c — Invalid transition

```json
POST /traditional-exams/<exam_id>/workflow/transition
{ "target_status": "ARCHIVED" }
```

When exam is `DRAFT` → Expected: `422 TRADITIONAL_EXAM_INVALID_TRANSITION`

---

## Scenario 6 — Exam Settings

**Endpoint:** `PUT /traditional-exams/:id/settings`  
**Role required:** `write`

```json
PUT /traditional-exams/<exam_id>/settings
{
  "total_time_limit_seconds": 3600,
  "max_attempts": 3,
  "cooldown_period_seconds": 86400
}
```

**Expected:** Settings created or updated. Re-sending the same request (idempotency test) → same response, no duplicate record.

**Get settings:**

```
GET /traditional-exams/<exam_id>/settings
```

**Expected:** The upserted settings object.

---

## Scenario 7 — Section and Subsection Management

**Endpoint:** `GET /traditional-exams/:id/sections`  
**Role required:** `read`

```
GET /traditional-exams/<exam_id>/sections
```

**Expected:** List of sections each containing their subsections (nested).

**Update section:**

```json
PUT /traditional-exams/<exam_id>/sections/<section_id>
{ "order_index": 2, "passing_score_percentage": 60 }
```

**Update subsection:**

```json
PUT /traditional-exams/<exam_id>/sections/<section_id>/subsections/<subsection_id>
{ "question_count": 10, "points_per_question": 5, "time_limit_seconds": 600 }
```

---

## Scenario 8 — Question Assignment

**Endpoint:** `POST /traditional-exams/:id/sections/:sectionId/subsections/:subsectionId/questions`  
**Role required:** `write`

```json
POST /traditional-exams/<exam_id>/sections/<section_id>/subsections/<subsection_id>/questions
{
  "question_ids": ["<q1_uuid>", "<q2_uuid>", "<q3_uuid>"]
}
```

**Expected:** Added questions listed. Sending the same `question_ids` again → `ON CONFLICT DO NOTHING`, no duplicates.

**List assigned questions:**

```
GET /traditional-exams/<exam_id>/sections/<section_id>/subsections/<subsection_id>/questions
```

---

## Scenario 9 — Reorder Questions

**Endpoint:** `PUT /traditional-exams/:id/…/questions/reorder`  
**Role required:** `write`

```json
PUT /traditional-exams/<exam_id>/sections/<section_id>/subsections/<subsection_id>/questions/reorder
{
  "ordered_question_ids": ["<q2_uuid>", "<q3_uuid>", "<q1_uuid>"]
}
```

**Expected:** Questions reordered. List endpoint now returns questions in new order.

---

## Scenario 10 — Remove Question

**Endpoint:** `DELETE /traditional-exams/:id/…/questions/:questionId`  
**Role required:** `write`

```
DELETE /traditional-exams/<exam_id>/sections/<section_id>/subsections/<subsection_id>/questions/<q1_uuid>
```

**Expected:** `204 No Content`.  
**Removing again (idempotency):** `404 TRADITIONAL_EXAM_QUESTION_NOT_FOUND`.

---

## Scenario 11 — Soft Delete

**Endpoint:** `DELETE /traditional-exams/:id`  
**Role required:** `write`

**Pre-condition:** Exam must be in `DRAFT` status.

```
DELETE /traditional-exams/<exam_id>
```

**Expected:** `204 No Content`. `GET /traditional-exams/<exam_id>` → `404`.

**Test with ENABLED exam:** Expected `422 TRADITIONAL_EXAM_INVALID_STATUS_FOR_OPERATION`.

---

## Scenario 12 — Tenant Isolation

1. Create an exam with **Tenant A** credentials.
2. Authenticate as **Tenant B**.
3. Attempt `GET /traditional-exams/<tenant_a_exam_id>` with Tenant B token.
4. **Expected:** `404 TRADITIONAL_EXAM_NOT_FOUND` — Tenant B cannot see Tenant A's exam.

---

## Scenario 13 — RBAC Enforcement

| Action                          | Required Role | Test with lower role    |
| ------------------------------- | ------------- | ----------------------- |
| `GET /traditional-exams`        | `read`        | Unauthenticated → 401   |
| `POST /traditional-exams`       | `write`       | `read`-only user → 403  |
| `PUT /traditional-exams/:id`    | `write`       | `read`-only user → 403  |
| `POST …/workflow/transition`    | `transition`  | `write`-only user → 403 |
| `DELETE /traditional-exams/:id` | `write`       | `read`-only user → 403  |

---

## Automated Tests

Unit tests for the domain layer are located at:

- `packages/domain-core/src/traditional-exams/__tests__/` (if created in future iteration)

Integration test coverage targets:

- Tenant isolation assertion on all 15 endpoints
- FSM invalid transition coverage (every invalid source→target pair)
- Settings idempotency (PUT → PUT same body → same result)
- `assign-questions` idempotency (duplicate `question_ids` → no duplicate rows)
- RBAC 403 for all role-restricted endpoints

---

## Error Code Reference

| Code                                            | HTTP | Meaning                                                     |
| ----------------------------------------------- | ---- | ----------------------------------------------------------- |
| `TRADITIONAL_EXAM_NOT_FOUND`                    | 404  | Exam does not exist or belongs to another tenant            |
| `TRADITIONAL_EXAM_INVALID_TRANSITION`           | 422  | FSM transition not allowed from current state               |
| `TRADITIONAL_EXAM_ENABLE_VALIDATION_FAILED`     | 422  | Structural requirements not met for ENABLED                 |
| `TRADITIONAL_EXAM_INVALID_STATUS_FOR_OPERATION` | 422  | Operation not allowed in current status (e.g. edit ENABLED) |
| `TRADITIONAL_EXAM_SECTION_NOT_FOUND`            | 404  | Section not found                                           |
| `TRADITIONAL_EXAM_SUBSECTION_NOT_FOUND`         | 404  | Subsection not found                                        |
| `TRADITIONAL_EXAM_QUESTION_NOT_FOUND`           | 404  | Question assignment not found                               |
| `TRADITIONAL_EXAM_DUPLICATE_CODE`               | 422  | Exam code already in use in this tenant                     |
| `TRADITIONAL_EXAM_DB_ERROR`                     | 500  | Unexpected database error (non-retryable)                   |
