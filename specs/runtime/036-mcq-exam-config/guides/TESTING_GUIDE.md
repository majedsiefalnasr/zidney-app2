# Testing Guide — MCQ Exam Configuration

**Stage:** 36 — MCQ Exam Configuration
**Phase:** 03_BACKOFFICE_CORE / 04_EXAM_ENGINE_CORE
**Generated:** 2026-04-01T00:07:00Z

---

## Prerequisites

1. PostgreSQL tenant database running with migration 014 applied
2. Redis available for rate limiting
3. Valid JWT token with backoffice permissions (`exam_manage`, `content_manage`, or `content_read`)
4. Workspace with active license

---

## API Endpoints to Test

Base URL: `POST/GET/PATCH/PUT/DELETE /api/v1/backoffice/workspace/mcq-exams`

### 1. Create Exam (POST /mcq-exams)

**Happy Path:**

```json
{
  "code": "MATH-101-FINAL",
  "name": "Mathematics Final Exam",
  "subjectId": "<valid-subject-uuid>",
  "selectionMode": "MANUAL",
  "totalQuestions": 50,
  "passType": "PERCENTAGE",
  "passValue": 60
}
```

Expected: 201, returns created exam object with `id`, `status: "COMPLETED"`, `createdAt`

**Validation Errors to Test:**

- Missing required fields → 422
- `code` with special characters (e.g., `"exam@#$"`) → 422
- `passValue` > 100 with `passType: "PERCENTAGE"` → 400 (MCQ_EXAM_INVALID_PASS_VALUE)
- `totalQuestions` < 1 → 422
- Duplicate `code` (same workspace) → 409 (MCQ_EXAM_CODE_CONFLICT)

### 2. List Exams (GET /mcq-exams)

**Query Parameters:**

- `?page=1&limit=20` — pagination
- `?status=COMPLETED` — filter by status
- `?subjectId=<uuid>` — filter by subject
- `?search=math` — search by name/code

Expected: 200, returns `{ items: [...], total: N, page: 1, limit: 20 }`

### 3. Get Exam (GET /mcq-exams/:examId)

- Valid UUID → 200 with full exam detail (includes settings, questions count, criteria)
- Non-existent UUID → 404 (MCQ_EXAM_NOT_FOUND)
- Invalid UUID format → 422

### 4. Update Exam (PATCH /mcq-exams/:examId)

**Immutability Tests:**

- Cannot change `subjectId` → 400 (MCQ_EXAM_SUBJECT_IMMUTABLE)
- Cannot change `selectionMode` when status is ENABLED → 400 (MCQ_EXAM_SELECTION_MODE_LOCKED)

**Happy Path:**

```json
{
  "name": "Updated Name",
  "totalQuestions": 60
}
```

Expected: 200

### 5. Delete Exam (DELETE /mcq-exams/:examId)

- Delete COMPLETED exam → 200 `{ deleted: true }` (soft delete)
- Delete ENABLED exam → 400 (MCQ_EXAM_STATUS_LOCKED)
- Delete exam with active references → 400 (MCQ_EXAM_DELETION_BLOCKED)

### 6. Settings (PUT/GET /mcq-exams/:examId/settings)

**Upsert Settings:**

```json
{
  "deliveryMode": "CHRONO",
  "timeLimitMinutes": 90,
  "shuffleQuestions": true,
  "shuffleOptions": true,
  "showResults": "AFTER_SUBMIT",
  "showCorrectAnswers": false,
  "maxAttempts": 3
}
```

Expected: 200 (creates if not exists, updates if exists)

**Get Settings:**

- GET on exam without settings → 200 with null/defaults
- GET on exam with settings → 200 with full settings object

### 7. Questions Management

**Add Questions (POST /mcq-exams/:examId/questions):**

```json
{
  "questions": [
    { "questionId": "<valid-mcq-question-uuid>", "orderIndex": 1 },
    { "questionId": "<valid-mcq-question-uuid>", "orderIndex": 2 }
  ]
}
```

Expected: 201

**Edge Cases:**

- Duplicate questionId in same exam → 409 (MCQ_EXAM_QUESTION_ALREADY_ADDED)
- Add questions exceeding totalQuestions limit → 400 (MCQ_EXAM_TOTAL_QUESTIONS_EXCEEDED)

**Get Questions (GET /mcq-exams/:examId/questions):**
Expected: 200 with ordered list

**Reorder Questions (PUT /mcq-exams/:examId/questions/reorder):**

```json
{
  "order": [
    { "questionId": "<uuid>", "orderIndex": 2 },
    { "questionId": "<uuid>", "orderIndex": 1 }
  ]
}
```

Expected: 200

**Remove Question (DELETE /mcq-exams/:examId/questions/:questionId):**
Expected: 200 `{ removed: true }`

### 8. Criteria (PUT/GET /mcq-exams/:examId/criteria)

**Set Criteria:**

```json
{
  "criteria": [
    {
      "lessonIds": ["<uuid>"],
      "percentage": 60
    },
    {
      "tagIds": ["<uuid>"],
      "percentage": 40
    }
  ]
}
```

Expected: 200

**Validation:** Percentages must sum to 100 → 400 (MCQ_EXAM_CRITERIA_SUM_INVALID) if not

### 9. Workflow Transition (POST /mcq-exams/:examId/workflow/transition)

**Transition Flow:** COMPLETED → REVIEWED → APPROVED → ENABLED

```json
{ "to": "REVIEWED" }
```

**Pre-Enable Validation (APPROVED → ENABLED):**
Must have:

- Settings configured
- At least 1 question (MANUAL) or criteria defined (AUTOMATIC)
- totalQuestions matches question count (MANUAL)
- Criteria sum = 100% (AUTOMATIC)

If any check fails → 400 (MCQ_EXAM_NOT_READY_FOR_ENABLE)

---

## Permission Matrix

| Permission       | Read     | Write    | Transition |
| ---------------- | -------- | -------- | ---------- |
| `exam_manage`    | ✅       | ✅       | ✅         |
| `content_manage` | ✅       | ✅       | ✅         |
| `content_read`   | ✅       | ❌       | ❌         |
| `content_review` | ❌       | ❌       | ✅         |
| No permission    | ❌ (403) | ❌ (403) | ❌ (403)   |

---

## Error Codes Reference

| Code                              | HTTP | Trigger                             |
| --------------------------------- | ---- | ----------------------------------- |
| MCQ_EXAM_NOT_FOUND                | 404  | Invalid examId                      |
| MCQ_EXAM_CODE_CONFLICT            | 409  | Duplicate code in workspace         |
| MCQ_EXAM_SUBJECT_IMMUTABLE        | 400  | Attempt to change subjectId         |
| MCQ_EXAM_SELECTION_MODE_LOCKED    | 400  | Change selectionMode after ENABLED  |
| MCQ_EXAM_STATUS_LOCKED            | 400  | Delete ENABLED exam                 |
| MCQ_EXAM_DELETION_BLOCKED         | 400  | Exam has active references          |
| MCQ_EXAM_INVALID_PASS_VALUE       | 400  | passValue out of range for passType |
| MCQ_EXAM_CRITERIA_SUM_INVALID     | 400  | Criteria percentages ≠ 100          |
| MCQ_EXAM_TOTAL_QUESTIONS_EXCEEDED | 400  | Questions exceed totalQuestions     |
| MCQ_EXAM_NOT_READY_FOR_ENABLE     | 400  | Pre-enable checks failed            |
| MCQ_EXAM_QUESTION_ALREADY_ADDED   | 409  | Duplicate question in exam          |
| MCQ_EXAM_QUESTION_NOT_FOUND       | 404  | Question not in exam                |
