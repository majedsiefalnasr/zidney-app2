# Implementation Plan — Grading Core

**Stage:** STAGE_40_GRADING_CORE  
**Phase:** 03_BACKOFFICE_CORE / 04_EXAM_ENGINE_CORE  
**Generated:** 2026-04-02

---

## 1. Architecture Overview

The Grading Core is a **pure domain-layer** module under `packages/domain-core/src/grading/`. It has ZERO HTTP, framework, or app-level dependencies. It receives a Drizzle transaction handle (`tx`) and operates entirely on snapshot data already persisted in the `attempts` table.

### Execution Context

```
Worker/API  ──(tx, attemptId, workspaceId)──▷  gradeAttempt()
                                                     │
               ┌─────────────────────────────────────┤
               │                                     │
          load attempt + snapshot              grading engine
          (SELECT FOR UPDATE)                        │
               │                         ┌───────────┴──────────┐
               │                    MCQ Grader          Traditional Grader
               │                         │                      │
               │                         └──────────┬───────────┘
               │                              ScoreAggregator
               │                                     │
               │                              persist results
               │                         (grading_results + question results)
               │                                     │
               └──────────── update attempt status ───┘
                                     │
                                   COMMIT
```

### Layer Assignment

| Layer        | Responsibility                                            | Files                                                |
| ------------ | --------------------------------------------------------- | ---------------------------------------------------- |
| Domain Core  | Grading logic, score computation, pass/fail determination | `packages/domain-core/src/grading/*.ts`              |
| DB Schema    | New tables + `attempts` column addition                   | `apps/api/src/db/tenant/schemas/grading-*.schema.ts` |
| Migration    | Forward-only DDL for new tables and column                | `apps/api/src/db/tenant/migrations/20260404_019_*`   |
| Schema Index | Barrel re-exports                                         | `apps/api/src/db/tenant/schemas/index.ts`            |

---

## 2. Database Design

### 2.1 New Tables

See `data-model.md` for full DDL and Drizzle schema definitions.

| Table                      | Purpose                                | Rows per attempt   |
| -------------------------- | -------------------------------------- | ------------------ |
| `grading_results`          | Aggregate attempt-level grading result | 1                  |
| `grading_question_results` | Per-question grading detail            | N (question count) |
| `grading_overrides`        | Admin score override audit trail       | 0–M                |

### 2.2 Attempt Table Modifications

- ADD `grading_status VARCHAR(20)` — values: `PENDING`, `GRADING`, `GRADED`, `OVERRIDE`. Default `PENDING`.
- UPDATE `valid_status` CHECK constraint → add `GRADED` to the allowed set.
- ADD CHECK `valid_grading_status` on `grading_status`.

### 2.3 Schema Version

- FROM: 1.24.0 (auto-selection engine)
- TO: 1.25.0

---

## 3. Migration Plan

Single migration file: `20260404_019_grading_core.ts`

Migration steps (single transaction):

1. Add `grading_status` column to `attempts` (nullable initially for backfill, then set NOT NULL with default).
2. Drop old `valid_status` check constraint, add new one including `GRADED`.
3. Add `valid_grading_status` check constraint.
4. Create `grading_results` table with all columns and constraints.
5. Create `grading_question_results` table with all columns and constraints.
6. Create `grading_overrides` table with all columns and constraints.
7. Create all indexes.
8. Bump schema_version to 1.25.0.

**Safety:**

- Additive-only (new tables + new column).
- CHECK constraint is dropped and re-created (not altered) to maintain atomicity.
- All DDL in single BEGIN/COMMIT.
- No data backfill required (existing attempts get `grading_status = PENDING` via default).

---

## 4. Domain Package Design

### 4.1 File Structure

```
packages/domain-core/src/grading/
├── index.ts                    — barrel exports
├── grading.types.ts            — shared type definitions
├── grading-engine.ts           — main orchestrator: gradeAttempt()
├── mcq-grader.ts               — MCQ grading (SINGLE, MULTIPLE, TRUE_FALSE, ARRANGEMENT)
├── traditional-grader.ts       — Traditional grading (TRUE_FALSE, FILL_BLANK, SHORT_ANSWER)
├── score-aggregator.ts         — score summation, pass/fail, percentage
├── grading.repository.ts       — DB persistence (insert results, update attempt)
└── grading.errors.ts           — domain error codes
```

### 4.2 Core Interface: `gradeAttempt()`

```typescript
interface GradeAttemptInput {
  attemptId: string;
  workspaceId: string;
}

interface GradeAttemptResult {
  gradingResultId: string;
  totalScore: number;
  totalPossibleScore: number;
  percentage: number;
  passed: boolean;
  questionResults: QuestionGradingResult[];
  gradingVersion: string;
  gradedAt: Date;
}

async function gradeAttempt(
  input: GradeAttemptInput,
  tx: DrizzleTransaction,
): Promise<GradeAttemptResult>;
```

### 4.3 MCQ Grading Logic

| Type        | Input                    | Logic                                 | Output          |
| ----------- | ------------------------ | ------------------------------------- | --------------- |
| SINGLE      | `selectedOptionId`       | `=== correctOptionId`                 | full score or 0 |
| MULTIPLE    | `selectedOptionIds[]`    | exact set match (sorted compare)      | full score or 0 |
| TRUE_FALSE  | `selectedValue: boolean` | `=== correctValue`                    | full score or 0 |
| ARRANGEMENT | `orderedOptionIds[]`     | exact sequence match (index-by-index) | full score or 0 |

All comparisons are strict equality. No partial scoring. No negative scoring.

### 4.4 Traditional Grading Logic

| Type         | Input                               | Logic                                                   | Output          |
| ------------ | ----------------------------------- | ------------------------------------------------------- | --------------- |
| TRUE_FALSE   | `selectedValue: boolean`            | `=== correctAnswer`                                     | full score or 0 |
| FILL_BLANK   | `textAnswer: string`                | exact match; if `normalize_case=true`, lowercase + trim | full score or 0 |
| SHORT_ANSWER | `rawAnswer, selfFlag, awardedScore` | store as-is; awarded_score from student self-eval       | explicit score  |

### 4.5 Score Aggregation

```
total_score       = SUM(awarded_score for all questions)
total_possible    = SUM(question_score for all questions)
percentage        = (total_score / total_possible) * 100
passed            = pass_type === 'PERCENTAGE'
                      ? percentage >= pass_value
                      : total_score >= pass_value
```

### 4.6 Error Codes

| Code                           | HTTP | When                                         |
| ------------------------------ | ---- | -------------------------------------------- |
| GRADING_ATTEMPT_NOT_FOUND      | 404  | Attempt ID does not exist in workspace       |
| GRADING_ATTEMPT_ALREADY_GRADED | 409  | `grading_status = GRADED` or result exists   |
| GRADING_SNAPSHOT_INCOMPLETE    | 422  | Missing required fields in snapshot          |
| GRADING_SCORE_OVERFLOW         | 422  | awarded > possible for a question            |
| GRADING_LATE_SUBMISSION        | 422  | Submission timestamp > deadline              |
| GRADING_INVALID_STATUS         | 409  | Attempt not in SUBMITTED / valid auto-submit |
| GRADING_TRANSACTION_FAILED     | 500  | Transaction rollback (unexpected)            |

---

## 5. Transactional Flow

```
1. BEGIN transaction
2. SELECT * FROM attempts WHERE id = $attemptId AND workspace_id = $workspaceId FOR UPDATE
3. VALIDATE status ∈ {SUBMITTED, IN_PROGRESS (auto-submit only)}
4. VALIDATE grading_status ≠ GRADED (idempotency guard)
   → If already GRADED, return existing result from grading_results
5. UPDATE attempts SET grading_status = 'GRADING'
6. Parse grading_config_snapshot → extract question_scores, correct_answers, pass config
7. VALIDATE snapshot completeness (all required fields present)
8. For each question in attempt:
   a. Determine question type (MCQ or Traditional)
   b. Execute type-specific grader
   c. Produce QuestionGradingResult
9. Run ScoreAggregator → total_score, percentage, passed
10. INSERT INTO grading_results (aggregate row)
11. INSERT INTO grading_question_results (per-question rows, batch)
12. UPDATE attempts SET grading_status = 'GRADED', status = 'GRADED',
    score = percentage, passed = passed, finalized_at = NOW()
13. COMMIT
```

If any step (3-12) fails → full ROLLBACK. Attempt remains in previous state.

---

## 6. Idempotency Strategy

- **Primary guard:** `grading_status` column. If `GRADED`, skip computation and return existing result.
- **Concurrency guard:** `SELECT FOR UPDATE` prevents double-grading.
- **Unique constraint:** `grading_results.attempt_id` is UNIQUE — DB rejects duplicate inserts.
- **Behavior on re-invocation:** Return existing `grading_results` row without re-computing.

---

## 7. Observability

Each grading execution logs:

```json
{
  "level": "info",
  "service": "GradingEngine",
  "event": "attempt_graded",
  "workspace_slug": "<slug>",
  "attempt_id": "<uuid>",
  "exam_id": "<uuid>",
  "total_score": 85,
  "total_possible_score": 100,
  "percentage": 85.0,
  "passed": true,
  "grading_duration_ms": 42,
  "grading_version": "1.0.0",
  "question_count": 50,
  "correlation_id": "<uuid>"
}
```

Error logging follows the Zidney error contract: `{ success: false, error: { code, message } }`.

---

## 8. Dependency Map

### Internal Dependencies (domain-core only)

| From                  | To                    | Reason                      |
| --------------------- | --------------------- | --------------------------- |
| grading-engine.ts     | mcq-grader.ts         | MCQ type dispatch           |
| grading-engine.ts     | traditional-grader.ts | Traditional type dispatch   |
| grading-engine.ts     | score-aggregator.ts   | Final score computation     |
| grading-engine.ts     | grading.repository.ts | DB persistence              |
| grading-engine.ts     | grading.errors.ts     | Error creation              |
| grading-engine.ts     | grading.types.ts      | Shared type imports         |
| grading.repository.ts | (Drizzle schemas)     | Schema references for types |

### External Package Dependencies

| Package        | Usage                   | Notes             |
| -------------- | ----------------------- | ----------------- |
| drizzle-orm    | Query building, tx type | Already installed |
| @zidney/logger | Structured logging      | Already installed |

No new package installations required.

---

## 9. Test Plan

### Unit Tests (Pure Functions)

| Test                          | Module             | Assertions                      |
| ----------------------------- | ------------------ | ------------------------------- |
| MCQ SINGLE correct            | mcq-grader         | score = full                    |
| MCQ SINGLE incorrect          | mcq-grader         | score = 0                       |
| MCQ MULTIPLE exact set        | mcq-grader         | score = full                    |
| MCQ MULTIPLE partial          | mcq-grader         | score = 0                       |
| MCQ TRUE_FALSE correct        | mcq-grader         | score = full                    |
| MCQ ARRANGEMENT exact order   | mcq-grader         | score = full                    |
| MCQ ARRANGEMENT wrong order   | mcq-grader         | score = 0                       |
| Traditional TRUE_FALSE        | traditional-grader | score = full or 0               |
| Traditional FILL_BLANK match  | traditional-grader | score = full                    |
| Traditional FILL_BLANK case   | traditional-grader | normalize_case=true → match     |
| Traditional SHORT_ANSWER self | traditional-grader | stores explicit awarded_score   |
| Score aggregation happy path  | score-aggregator   | correct total, percentage, pass |
| Score aggregation all wrong   | score-aggregator   | total=0, percentage=0, fail     |
| Score pass by SCORE type      | score-aggregator   | pass when total >= pass_value   |
| Score pass by PERCENTAGE type | score-aggregator   | pass when pct >= pass_value     |
| Determinism (same input)      | grading-engine     | identical output on re-run      |

### Integration / Transaction Tests

| Test                | Assertions                                   |
| ------------------- | -------------------------------------------- |
| Full grading flow   | Results persisted, status = GRADED           |
| Idempotent re-grade | Returns existing result, no duplicate insert |
| Invalid status      | Rejects with GRADING_INVALID_STATUS          |
| Missing snapshot    | Rejects with GRADING_SNAPSHOT_INCOMPLETE     |
| Already graded      | Returns with GRADING_ATTEMPT_ALREADY_GRADED  |
| Rollback on failure | No partial state after error                 |

---

## 10. Implementation Order

| Phase | Description                        | Dependencies     |
| ----- | ---------------------------------- | ---------------- |
| 1     | Drizzle schema definitions         | None             |
| 2     | Migration file                     | Phase 1          |
| 3     | Type definitions + error codes     | None             |
| 4     | MCQ grader (pure function)         | Phase 3          |
| 5     | Traditional grader (pure function) | Phase 3          |
| 6     | Score aggregator (pure function)   | Phase 3          |
| 7     | Grading repository (DB layer)      | Phase 1, 3       |
| 8     | Grading engine (orchestrator)      | Phase 4, 5, 6, 7 |
| 9     | Barrel exports + index.ts updates  | Phase 8          |
| 10    | Unit tests                         | Phase 4, 5, 6    |
| 11    | Integration tests                  | Phase 8          |

---

## 11. Files Changed

### New Files

| File                                                                    | Type       |
| ----------------------------------------------------------------------- | ---------- |
| `apps/api/src/db/tenant/schemas/grading-results.schema.ts`              | Schema     |
| `apps/api/src/db/tenant/schemas/grading-question-results.schema.ts`     | Schema     |
| `apps/api/src/db/tenant/schemas/grading-overrides.schema.ts`            | Schema     |
| `apps/api/src/db/tenant/migrations/20260404_019_grading_core.ts`        | Migration  |
| `packages/domain-core/src/grading/index.ts`                             | Barrel     |
| `packages/domain-core/src/grading/grading.types.ts`                     | Types      |
| `packages/domain-core/src/grading/grading-engine.ts`                    | Logic      |
| `packages/domain-core/src/grading/mcq-grader.ts`                        | Logic      |
| `packages/domain-core/src/grading/traditional-grader.ts`                | Logic      |
| `packages/domain-core/src/grading/score-aggregator.ts`                  | Logic      |
| `packages/domain-core/src/grading/grading.repository.ts`                | Repository |
| `packages/domain-core/src/grading/grading.errors.ts`                    | Errors     |
| `packages/domain-core/src/grading/__tests__/mcq-grader.test.ts`         | Test       |
| `packages/domain-core/src/grading/__tests__/traditional-grader.test.ts` | Test       |
| `packages/domain-core/src/grading/__tests__/score-aggregator.test.ts`   | Test       |
| `packages/domain-core/src/grading/__tests__/grading-engine.test.ts`     | Test       |

### Modified Files

| File                                                | Change                              |
| --------------------------------------------------- | ----------------------------------- |
| `apps/api/src/db/tenant/schemas/attempts.schema.ts` | Add `grading_status` column + check |
| `apps/api/src/db/tenant/schemas/index.ts`           | Add grading schema re-exports       |
| `packages/domain-core/src/index.ts`                 | Add grading module export           |

---

## 12. Architectural Constraints Verified

| Constraint                          | Status | Notes                                      |
| ----------------------------------- | ------ | ------------------------------------------ |
| ADR-0001: Tenant isolation          | ✅     | All queries include workspace_id           |
| ADR-0002: Snapshot immutability     | ✅     | Grading reads ONLY from snapshot columns   |
| ADR-0006: Server-authoritative time | ✅     | graded_at = NOW() in DB transaction        |
| ADR-0007: Version compatibility     | ✅     | grading_version recorded on every result   |
| ADR-0008: Semantic versioning       | ✅     | Schema 1.24.0 → 1.25.0                     |
| Import boundary                     | ✅     | domain-core imports no apps/\* modules     |
| No HTTP deps in domain              | ✅     | Zero Hono/HTTP imports in grading/         |
| Forward-only migration              | ✅     | New tables, new column, no destructive DDL |
| Trust chain                         | ✅     | Domain layer only — no auth/license bypass |

---

## 13. Deferred (Not in Scope)

- Worker integration (grading job consumer)
- API endpoints for grading results
- AI grading for SHORT_ANSWER
- Partial scoring
- Negative scoring
- Re-grading pipeline
- Certificate generation on pass
