# Specification — Grading Core

**Stage:** STAGE_40_GRADING_CORE  
**Phase:** 03_BACKOFFICE_CORE / 04_EXAM_ENGINE_CORE  
**Generated:** 2026-04-02

---

## 1. Overview

Implement a unified, deterministic grading engine in `packages/domain-core/src/grading/` that computes scores for all exam and question types. The engine operates exclusively on immutable attempt snapshots captured at attempt start — it never references live exam configuration.

### Supported Exam Types

- **MCQ**: SINGLE, MULTIPLE, TRUE_FALSE, ARRANGEMENT
- **Traditional**: TRUE_FALSE, FILL_BLANK, SHORT_ANSWER
- **Scheduled**: MCQ_SCHEDULED, TRADITIONAL_SCHEDULED

### Supported Modes

- RELAX, CHRONO, RUSH (mode does not affect grading logic; only timing)

---

## 2. Functional Requirements

### FR-01: MCQ Grading

| Question Type | Grading Rule                                             | Scoring         |
| ------------- | -------------------------------------------------------- | --------------- |
| SINGLE        | Exact match of selected option ID against correct option | Full score or 0 |
| MULTIPLE      | Exact set match (all correct selected, no incorrect)     | Full score or 0 |
| TRUE_FALSE    | Boolean match                                            | Full score or 0 |
| ARRANGEMENT   | Exact ordered sequence match                             | Full score or 0 |

- No partial scoring in v1.
- No negative scoring in v1.
- Score per question is defined in `grading_config_snapshot.question_scores[question_id]`.

### FR-02: Traditional Grading

| Question Type | Grading Rule                                                                   | Scoring                       |
| ------------- | ------------------------------------------------------------------------------ | ----------------------------- |
| TRUE_FALSE    | Auto-graded: boolean match against `correct_answer` snapshot                   | Full score or 0               |
| FILL_BLANK    | Auto-graded: exact match with optional case normalization                      | Full score or 0               |
| SHORT_ANSWER  | Self-evaluated (v1): student provides `self_correction_flag` and awarded score | Explicit awarded score stored |

- Each traditional question has a `score` field (numeric, precision 10, scale 2).
- SHORT_ANSWER stores: `raw_answer`, `self_correction_flag`, `awarded_score`.
- Future AI grading MUST append a grading revision record — never overwrite.

### FR-03: Score Aggregation

For every graded attempt:

1. Compute per-question score (0 or full for auto-graded, explicit for self-evaluated).
2. Sum to `total_score`.
3. Compute `percentage = (total_score / total_possible_score) * 100`.
4. Determine pass/fail:
   - If `pass_type = PERCENTAGE`: `percentage >= pass_value`
   - If `pass_type = SCORE`: `total_score >= pass_value`
5. Persist: `total_score`, `percentage`, `passed`, `graded_at`, `grading_version`.

### FR-04: Submission Trigger Handling

| Trigger                    | Behavior                                       |
| -------------------------- | ---------------------------------------------- |
| Manual submit              | Normal grading                                 |
| Auto-submit (TIME_EXPIRED) | Normal grading with `forced_submission = true` |
| CONNECTION_LOSS            | Normal grading with `forced_submission = true` |
| ADMIN_FORCE                | Normal grading with `forced_submission = true` |

- Late submissions (after deadline) MUST be rejected before grading begins.
- Attempt must store `forced_submission` boolean and `forced_reason`.

### FR-05: Immutability Rules

After grading completes:

- Attempt status → `GRADED`
- Answers, score, pass/fail are locked
- No mutation allowed except admin override with:
  - `override_reason`
  - `override_user_id`
  - `override_timestamp`
  - `override_audit_entry`

Direct score mutation is prohibited.

### FR-06: Transactional Guarantee

Grading flow within a single transaction:

1. `SELECT FOR UPDATE` on attempt row
2. Validate `status = SUBMITTED` (or `IN_PROGRESS` for auto-submit)
3. Execute grading computation
4. Persist per-question results
5. Persist aggregate results
6. Update attempt status to `GRADED`
7. Commit

No partial grading state allowed. If any step fails, full rollback.

### FR-07: Determinism Guarantee

Given the same snapshot + same answers + same grading rules → result MUST always be identical. No `Math.random()`, no `Date.now()` during computation. Only `graded_at` timestamp is non-deterministic (server time at grading completion).

### FR-08: Grading Version Tracking

Each grading execution records `grading_version` (engine semantic version). Enables:

- Audit trail of which engine version produced a result
- Future re-grading with newer engine versions

---

## 3. Non-Functional Requirements

### NFR-01: Performance

- Grading a single attempt with up to 200 questions must complete in < 500ms.
- Grading must not lock the attempt row for more than 2 seconds.

### NFR-02: Observability

Each grading execution must log:

- `workspace_slug`, `attempt_id`, `exam_id`
- `total_score`, `passed`, `grading_duration_ms`
- `correlation_id`
- Errors must be structured using the Zidney error contract.

### NFR-03: Concurrency Safety

- Grading the same attempt concurrently must be safe (SELECT FOR UPDATE prevents double-grading).
- Idempotency: re-submitting an already-graded attempt returns the existing result, does not re-grade.

---

## 4. Data Model Changes

### New Table: `grading_results`

| Column               | Type          | Constraints                        |
| -------------------- | ------------- | ---------------------------------- |
| id                   | uuid          | PK, default random                 |
| workspace_id         | uuid          | NOT NULL                           |
| attempt_id           | uuid          | NOT NULL, FK → attempts.id         |
| total_score          | numeric(10,2) | NOT NULL                           |
| total_possible_score | numeric(10,2) | NOT NULL                           |
| percentage           | numeric(5,2)  | NOT NULL                           |
| passed               | boolean       | NOT NULL                           |
| pass_type            | varchar(20)   | NOT NULL (PERCENTAGE \| SCORE)     |
| pass_value           | numeric(10,2) | NOT NULL                           |
| grading_version      | varchar(20)   | NOT NULL                           |
| graded_at            | timestamptz   | NOT NULL                           |
| graded_by            | varchar(50)   | NOT NULL (ENGINE \| SELF \| ADMIN) |
| metadata             | jsonb         | nullable                           |
| created_at           | timestamptz   | NOT NULL, default now              |

Indexes:

- `uq_grading_results_attempt_id` UNIQUE on (attempt_id)
- `idx_grading_results_workspace_attempt` on (workspace_id, attempt_id)

### New Table: `grading_question_results`

| Column                  | Type          | Constraints                       |
| ----------------------- | ------------- | --------------------------------- |
| id                      | uuid          | PK, default random                |
| workspace_id            | uuid          | NOT NULL                          |
| attempt_id              | uuid          | NOT NULL                          |
| grading_result_id       | uuid          | NOT NULL, FK → grading_results.id |
| question_id             | uuid          | NOT NULL                          |
| question_type           | varchar(20)   | NOT NULL                          |
| question_score          | numeric(10,2) | NOT NULL (max for this question)  |
| awarded_score           | numeric(10,2) | NOT NULL                          |
| is_correct              | boolean       | NOT NULL                          |
| user_response           | jsonb         | NOT NULL                          |
| correct_answer_snapshot | jsonb         | NOT NULL                          |
| grading_metadata        | jsonb         | nullable                          |
| created_at              | timestamptz   | NOT NULL, default now             |

Indexes:

- `uq_grading_question_results_attempt_question` UNIQUE on (attempt_id, question_id)
- `idx_grading_question_results_grading_result_id` on (grading_result_id)
- `idx_grading_question_results_workspace_attempt` on (workspace_id, attempt_id)

### New Table: `grading_overrides`

| Column            | Type          | Constraints                       |
| ----------------- | ------------- | --------------------------------- |
| id                | uuid          | PK, default random                |
| workspace_id      | uuid          | NOT NULL                          |
| attempt_id        | uuid          | NOT NULL, FK → attempts.id        |
| grading_result_id | uuid          | NOT NULL, FK → grading_results.id |
| previous_score    | numeric(10,2) | NOT NULL                          |
| new_score         | numeric(10,2) | NOT NULL                          |
| previous_passed   | boolean       | NOT NULL                          |
| new_passed        | boolean       | NOT NULL                          |
| override_reason   | text          | NOT NULL                          |
| override_user_id  | uuid          | NOT NULL                          |
| created_at        | timestamptz   | NOT NULL, default now             |

Indexes:

- `idx_grading_overrides_attempt_id` on (attempt_id)
- `idx_grading_overrides_workspace` on (workspace_id)

### Attempt Table Changes

- Add `grading_status` varchar(20) — values: `PENDING`, `GRADING`, `GRADED`, `OVERRIDE`
- (Existing `status` check updated to include `GRADED`)

---

## 5. Domain Package Structure

```
packages/domain-core/src/grading/
├── index.ts                    — barrel export
├── grading.types.ts            — type definitions
├── grading-engine.ts           — main grading orchestrator
├── mcq-grader.ts               — MCQ type-specific grading
├── traditional-grader.ts       — Traditional type-specific grading
├── score-aggregator.ts         — score summation and pass/fail
├── grading.repository.ts       — DB persistence layer
└── grading.errors.ts           — domain-specific error codes
```

---

## 6. API Surface

No new endpoints in this stage. Grading is invoked by the worker/submission flow (Phase 04_RUNTIME). This stage only implements the **domain logic + persistence layer**.

Future integration points:

- Worker calls `gradeAttempt(attemptId, workspaceId, db)` after submission validation.
- API reads `grading_results` for result display.

---

## 7. Error Codes

| Code                           | HTTP | Description                                     |
| ------------------------------ | ---- | ----------------------------------------------- |
| GRADING_ATTEMPT_NOT_FOUND      | 404  | Attempt does not exist                          |
| GRADING_ATTEMPT_ALREADY_GRADED | 409  | Attempt already has grading result              |
| GRADING_SNAPSHOT_INCOMPLETE    | 422  | Question or grading snapshot is missing/corrupt |
| GRADING_SCORE_OVERFLOW         | 422  | Computed score exceeds possible range           |
| GRADING_LATE_SUBMISSION        | 422  | Submission after deadline                       |
| GRADING_INVALID_STATUS         | 409  | Attempt not in submittable status               |
| GRADING_TRANSACTION_FAILED     | 500  | Transaction rollback during grading             |

---

## 8. Architectural Constraints

- **ADR-0001**: All queries include `workspace_id` — tenant isolation enforced.
- **ADR-0002**: Grading uses ONLY snapshot data — never references live exam config.
- **ADR-0006**: Server-authoritative time for `graded_at`.
- **ADR-0007**: Version compatibility — `grading_version` recorded on every result.
- **ADR-0008**: Semantic versioning — grading engine version follows semver.
- **Import boundary**: `packages/domain-core` MUST NOT import from `apps/*`.
- **No HTTP dependencies**: Grading is a pure domain function, no Hono/HTTP deps.

---

## 9. Migration Strategy

- Forward-only migration in `apps/api/src/db/tenant/migrations/`.
- New tables: `grading_results`, `grading_question_results`, `grading_overrides`.
- ALTER `attempts` table: add `grading_status` column.
- Update `valid_status` check constraint to include `GRADED`.

---

## 10. Test Strategy

- **Unit tests**: Pure grading functions (MCQ, Traditional, aggregation) with known inputs/outputs.
- **Determinism tests**: Same input → same output across multiple runs.
- **Transaction tests**: Rollback on partial failure.
- **Concurrency tests**: Parallel grading of same attempt returns same result.
- **Edge cases**: Empty answers, all correct, all wrong, score overflow, missing snapshot fields.

---

## 11. Deferred Scope

- AI grading for SHORT_ANSWER (future stage)
- Partial scoring for MULTIPLE choice (v2)
- Negative scoring (v2)
- Re-grading pipeline (future stage)
- Grading API endpoints (Phase 04_RUNTIME)
- Worker integration (Phase 04_RUNTIME)
