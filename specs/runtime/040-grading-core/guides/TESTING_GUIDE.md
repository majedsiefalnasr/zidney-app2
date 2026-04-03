# STAGE_40: Grading Core — Testing Guide

**Stage:** STAGE_40_GRADING_CORE  
**Branch:** spec/040-grading-core  
**Phase:** 04_EXAM_ENGINE_CORE  
**Status:** Ready for QA Testing

---

## Overview

This guide covers testing strategy for the Grading Core implementation. The grading engine supports 7 question types across 4 grading modes with comprehensive error handling and workspace isolation.

**Test Coverage:** 69+ unit assertions implemented. Integration tests ready for setup.

---

## Test Execution Quick Start

### Run All Grading Tests

```bash
cd /Users/majedsiefalnasr/Documents/Work/MAJED/zidney-app2

# Install dependencies (if needed)
bun install

# Run all grading tests
bun run test -- packages/domain-core/src/grading/__tests__/

# Expected output:
# ✓ packages/domain-core/src/grading/__tests__/mcq-grader.test.ts (28 passing)
# ✓ packages/domain-core/src/grading/__tests__/traditional-grader.test.ts (17 passing)
# ✓ packages/domain-core/src/grading/__tests__/score-aggregator.test.ts (22 passing)
# Total: 67+ tests passing
```

### Run Individual Test Suites

```bash
# MCQ Grader tests
bun run test -- packages/domain-core/src/grading/__tests__/mcq-grader.test.ts

# Traditional Grader tests
bun run test -- packages/domain-core/src/grading/__tests__/traditional-grader.test.ts

# Score Aggregator tests
bun run test -- packages/domain-core/src/grading/__tests__/score-aggregator.test.ts

# Integration tests (template)
bun run test -- packages/domain-core/src/grading/__tests__/grading.integration.test.ts
```

### Type Safety Validation

```bash
bun run typecheck:src

# Expected output:
# No errors found
```

---

## Test Strategy by Question Type

### 1. MCQ_SINGLE (Single-Choice Multiple Choice)

**Behavior:** Learner selects one option. Award points if exact match, else zero.

**Test Cases:**

| Test                | Input                               | Expected                          | Status |
| ------------------- | ----------------------------------- | --------------------------------- | ------ |
| Correct answer      | selectedOptionId: "opt-A" (correct) | awardedScore: 10, isCorrect: true | ✅     |
| Incorrect answer    | selectedOptionId: "opt-B" (wrong)   | awardedScore: 0, isCorrect: false | ✅     |
| Missing response    | response: null                      | Error: INVALID_QUESTION_RESPONSE  | ✅     |
| Empty string option | selectedOptionId: ""                | awardedScore: 0, isCorrect: false | ✅     |

**Manual Test ([Test ID: G001]):**

```
Given: MCQ question "Which planet is closest to sun?"
      Options: A=Mercury, B=Venus, C=Earth, D=Mars
      Correct: A (Mercury)
When: User selects Mercury
Then: Question should be marked correct, awarded_score = 10

When: User selects Venus
Then: Question should be marked incorrect, awarded_score = 0

When: User skips question (no response)
Then: System should reject during grading with INVALID_QUESTION_RESPONSE
```

---

### 2. MCQ_MULTIPLE (Multi-Selection Multiple Choice)

**Behavior:** Learner selects multiple options. Award points if set equality (sort-order independent), else zero.

**Test Cases:**

| Test                   | Input                                  | Expected                          | Status |
| ---------------------- | -------------------------------------- | --------------------------------- | ------ |
| Exact match            | [opt-A, opt-B] (requires [A,B])        | awardedScore: 10, isCorrect: true | ✅     |
| Exact match (reversed) | [opt-B, opt-A] (requires [A,B])        | awardedScore: 10, isCorrect: true | ✅     |
| Partial set            | [opt-A] (requires [A,B])               | awardedScore: 0, isCorrect: false | ✅     |
| Extra options          | [opt-A, opt-B, opt-C] (requires [A,B]) | awardedScore: 0, isCorrect: false | ✅     |
| Empty selection        | [] (requires [A,B])                    | awardedScore: 0, isCorrect: false | ✅     |

**Manual Test ([Test ID: G002]):**

```
Given: MCQ question "Which statements are true?" (select all)
      A. Earth orbits Sun ✓
      B. Moon orbits Earth ✓
      C. Sun orbits Earth ✗
      D. Stars are planets ✗
      Correct: [A, B]
When: User selects A and B
Then: Question correct, awarded_score = 10

When: User selects A, B, and C
Then: Question incorrect (extra option), awarded_score = 0

When: User selects only A
Then: Question incorrect (incomplete), awarded_score = 0

When: User selects none
Then: Question incorrect (empty), awarded_score = 0
```

---

### 3. MCQ_TRUE_FALSE (True/False Single Choice)

**Behavior:** Learner selects boolean value. Award points if exact match, else zero.

**Test Cases:**

| Test             | Input                               | Expected                          | Status |
| ---------------- | ----------------------------------- | --------------------------------- | ------ |
| Correct: True    | selectedValue: true (correct)       | awardedScore: 5, isCorrect: true  | ✅     |
| Correct: False   | selectedValue: false (correct)      | awardedScore: 5, isCorrect: true  | ✅     |
| Incorrect: True  | selectedValue: true (false correct) | awardedScore: 0, isCorrect: false | ✅     |
| Incorrect: False | selectedValue: false (true correct) | awardedScore: 0, isCorrect: false | ✅     |
| Missing response | response: null                      | Error: INVALID_QUESTION_RESPONSE  | ✅     |

**Manual Test ([Test ID: G003]):**

```
Given: True/False question "The mitochondria is the powerhouse of the cell"
      Correct Answer: True
When: User selects True
Then: Question correct, awarded_score = 5

When: User selects False
Then: Question incorrect, awarded_score = 0

When: User skips question
Then: System rejects with INVALID_QUESTION_RESPONSE
```

---

### 4. MCQ_ARRANGEMENT (Order/Arrange Question)

**Behavior:** Learner arranges items in order. Award points if index-by-index order match, else zero.

**Test Cases:**

| Test          | Input                       | Expected                          | Status |
| ------------- | --------------------------- | --------------------------------- | ------ |
| Correct order | [item1, item2, item3]       | awardedScore: 10, isCorrect: true | ✅     |
| Wrong order   | [item2, item1, item3]       | awardedScore: 0, isCorrect: false | ✅     |
| Partial order | [item1, item3, item2]       | awardedScore: 0, isCorrect: false | ✅     |
| Missing item  | [item1, item2] (3 required) | awardedScore: 0, isCorrect: false | ✅     |

**Manual Test ([Test ID: G004]):**

```
Given: Arrangement question "Order these events by date"
      A. American Revolution (1776)
      B. French Revolution (1789)
      C. Industrial Revolution (1760-1840)
      Correct order: C, A, B
When: User arranges as [C, A, B]
Then: Question correct, awarded_score = 10

When: User arranges as [A, B, C]
Then: Question incorrect (wrong order), awarded_score = 0

When: User arranges as [C, A] (missing B)
Then: Question incorrect (incomplete), awarded_score = 0
```

---

### 5. TRADITIONAL_TRUE_FALSE (Traditional T/F Question)

**Behavior:** Learner enters boolean response. Award points if exact match, else zero.

**Test Cases:**

| Test               | Input                                               | Expected                          | Status |
| ------------------ | --------------------------------------------------- | --------------------------------- | ------ |
| Correct: True      | textAnswer: "True"                                  | awardedScore: 5, isCorrect: true  | ✅     |
| Correct: False     | textAnswer: "False"                                 | awardedScore: 5, isCorrect: true  | ✅     |
| Case variant: TRUE | textAnswer: "TRUE" (case-insensitive if configured) | awardedScore: 5, isCorrect: true  | ✅     |
| Incorrect          | textAnswer: "Maybe"                                 | awardedScore: 0, isCorrect: false | ✅     |
| Empty              | textAnswer: ""                                      | awardedScore: 0, isCorrect: false | ✅     |

**Manual Test ([Test ID: G005]):**

```
Given: Traditional T/F question "Photosynthesis requires light"
      Correct Answer: True
When: User responds "True"
Then: Question correct, awarded_score = 5

When: User responds "true" (lowercase, if normalize_case=true)
Then: Question correct, awarded_score = 5

When: User responds "False"
Then: Question incorrect, awarded_score = 0
```

---

### 6. TRADITIONAL_FILL_BLANK (Fill-in-the-Blank Question)

**Behavior:** Learner enters text. Award points if string match (with optional case-normalization), else zero.

**Test Cases:**

| Test              | Input                                      | Expected                          | Status |
| ----------------- | ------------------------------------------ | --------------------------------- | ------ |
| Exact match       | textAnswer: "Paris" (correct)              | awardedScore: 8, isCorrect: true  | ✅     |
| Case mismatch     | textAnswer: "paris" (normalize_case=true)  | awardedScore: 8, isCorrect: true  | ✅     |
| Case mismatch     | textAnswer: "paris" (normalize_case=false) | awardedScore: 0, isCorrect: false | ✅     |
| Whitespace trim   | textAnswer: " Paris "                      | awardedScore: 8, isCorrect: true  | ✅     |
| Partially correct | textAnswer: "Par"                          | awardedScore: 0, isCorrect: false | ✅     |
| Empty response    | textAnswer: ""                             | awardedScore: 0, isCorrect: false | ✅     |

**Manual Test ([Test ID: G006]):**

```
Given: Fill-blank question "The capital of France is ______"
      Correct Answer: "Paris"
      normalize_case: false
When: User responds "Paris"
Then: Question correct, awarded_score = 8

When: User responds "paris" (lowercase)
Then: Question incorrect (case mismatch), awarded_score = 0

When: normalize_case is changed to TRUE and user responds "paris"
Then: Question correct, awarded_score = 8 (case normalized)

When: User responds "paris " (trailing space)
Then: Question correct (whitespace trimmed), awarded_score = 8
```

---

### 7. TRADITIONAL_SHORT_ANSWER (Short Answer with Self-Eval)

**Behavior:** Learner enters text + self-rates. Award points based on learner flag OR explicit teacher score.

**Test Cases:**

| Test              | Input                      | Expected                         | Status |
| ----------------- | -------------------------- | -------------------------------- | ------ |
| Self-correct      | selfFlag: true             | awardedScore: full (10)          | ✅     |
| Self-incorrect    | selfFlag: false            | awardedScore: 0                  | ✅     |
| Explicit score    | awardedScore: 7 (max: 10)  | awardedScore: 7, isCorrect: true | ✅     |
| Score exceeds max | awardedScore: 15 (max: 10) | awardedScore: 10 (capped)        | ✅     |
| Missing response  | textAnswer: null           | Error: INVALID_QUESTION_RESPONSE | ✅     |

**Manual Test ([Test ID: G007]):**

```
Given: Short-answer question "Explain mitosis in your own words" (max 10 points)
When: User submits answer and marks selfFlag=true (self-correct)
Then: Question awarded full 10 points

When: User submits answer and marks selfFlag=false (self-incorrect)
Then: Question awarded 0 points (learner knows it's wrong)

When: Teacher reviews and explicitly awards 7 points
Then: Question awarded 7 points (explicit override)

When: Teacher mistakenly enters 15 points (above max)
Then: Question capped at 10 points (safety guard)
```

---

## Score Aggregation Testing

### Percentage Calculation

**Test Cases:**

| Test            | totalScore | totalPossible | Expected %           | Status |
| --------------- | ---------- | ------------- | -------------------- | ------ |
| 50/100          | 50         | 100           | 50.00%               | ✅     |
| 33/100          | 33         | 100           | 33.00%               | ✅     |
| 2/3             | 2          | 3             | 66.67%               | ✅     |
| 1/3             | 1          | 3             | 33.33%               | ✅     |
| 0/0 (edge case) | 0          | 0             | 0% (totalPossible=0) | ✅     |

**Manual Test ([Test ID: G008]):**

```
Given: Attempt with 30 questions total possible 100 points
      Question 1: 10/10 ✓
      Question 2: 8/10 ✓
      Question 3: 0/10 ✗
      ...remaining unanswered (0 points)
      Total: 18/100
When: Score aggregator calculates
Then: totalScore = 18
      totalPossible = 100
      percentage = (18/100) × 100 = 18.00% (2 decimals)

Given: 2/3 scoring scenario
When: 2 out of 3 questions correct
Then: percentage = (2/3) × 100 = 66.6666...
      Rounded to 2 decimals: 66.67%
```

### Pass Rule Testing

**Percentage Pass Rule:** `passed = (percentage >= pass_value)`

| Test                | percentage | pass_value | pass_type  | Expected | Status |
| ------------------- | ---------- | ---------- | ---------- | -------- | ------ |
| Pass (at threshold) | 80.00%     | 80         | PERCENTAGE | true     | ✅     |
| Pass (above)        | 85.00%     | 80         | PERCENTAGE | true     | ✅     |
| Fail (below)        | 75.00%     | 80         | PERCENTAGE | false    | ✅     |
| Fail (just below)   | 79.99%     | 80         | PERCENTAGE | false    | ✅     |

**Score Pass Rule:** `passed = (totalScore >= pass_value)`

| Test                | totalScore | pass_value | pass_type | Expected | Status |
| ------------------- | ---------- | ---------- | --------- | -------- | ------ |
| Pass (at threshold) | 80         | 80         | SCORE     | true     | ✅     |
| Pass (above)        | 85         | 80         | SCORE     | true     | ✅     |
| Fail (below)        | 75         | 80         | SCORE     | false    | ✅     |
| Fail (just below)   | 79         | 80         | SCORE     | false    | ✅     |

**Manual Test ([Test ID: G009]):**

```
Given: Exam with PERCENTAGE pass rule (80% required)
      Student total: 85 points / 100 possible
      Percentage: 85.00%
When: Grading engine evaluates
Then: passed = true (85% >= 80%)
      Status: GRADED, Result: PASSED

Given: Same exam with SCORE pass rule (80 points required)
      Student total: 85 points / 100 possible
When: Grading engine evaluates
Then: passed = true (85 >= 80)
      Status: GRADED, Result: PASSED

Given: Same exam with SCORE pass rule (90 points required)
      Student total: 85 points / 100 possible
When: Grading engine evaluates
Then: passed = false (85 < 90)
      Status: GRADED, Result: FAILED
```

---

## Error Handling Testing

### 7 Error Codes

**Test Cases by Error:**

| Error Code                    | HTTP Status | Trigger                                      | Manual Test                                  |
| ----------------------------- | ----------- | -------------------------------------------- | -------------------------------------------- |
| ATTEMPT_NOT_FOUND             | 404         | Grade non-existent attemptId                 | T101: Use invalid UUID                       |
| ATTEMPT_ALREADY_GRADED        | 409         | Grade attempt with grading_status != PENDING | T102: Grade twice                            |
| INVALID_QUESTION_RESPONSE     | 400         | Response missing required fields             | T103: No selectedOptionId for MCQ            |
| CONFIG_SNAPSHOT_CORRUPTED     | 422         | Snapshot validation fails                    | T104: Invalid pass_type in snapshot          |
| QUESTION_SNAPSHOT_MISSING     | 404         | Question data unavailable                    | T105: Missing question_id in snapshot        |
| GRADING_ENGINE_ERROR          | 500         | Unhandled error during grading               | T106: Simulate DB connection failure         |
| WORKSPACE_ISOLATION_VIOLATION | 403         | workspace_id mismatch                        | T107: Grade attempt from different workspace |

**Manual Test ([Test ID: T101-T107]):**

```
T101 - ATTEMPT_NOT_FOUND:
  Given: Grade endpoint called with attemptId="00000000-0000-0000-0000-000000000000"
  When: Engine cannot find attempt in database
  Then: Response: 404 | Error: ATTEMPT_NOT_FOUND | Message: "Attempt not found"

T102 - ATTEMPT_ALREADY_GRADED:
  Given: Attempt with grading_status='GRADED'
  When: Grade endpoint called again for same attempt
  Then: Response: 409 | Error: ATTEMPT_ALREADY_GRADED | Message: "Attempt already graded"

T103 - INVALID_QUESTION_RESPONSE:
  Given: MCQ question with missing selectedOptionId in response
  When: Engine validates user response for grading
  Then: Response: 400 | Error: INVALID_QUESTION_RESPONSE | Message: "Question response missing required fields"

[Continue T104-T107 similarly]
```

---

## Workspace Isolation Testing

**Objective:** Verify grading engine cannot leak data across workspaces.

**Test Scenario ([Test ID: I001]):**

```
Setup:
  Workspace A: ExamID=exam-1, AttemptID=att-1
  Workspace B: ExamID=exam-2, AttemptID=att-2

Test 1: Grade Attempt in Workspace A
  When: Grade att-1 with workspace_id=workspaceA
  Then: Result saved to grading_results with workspace_id=workspaceA

Test 2: Query Result from Workspace A
  When: Query grading_result_id from workspaceA
  Then: Result returned (data belongs to workspaceA)

Test 3: Attempt Cross-Workspace Query
  When: Query same grading_result_id with workspace_id=workspaceB
  Then: 404 NOT FOUND (isolation enforced)

Test 4: Attempt Cross-Workspace Grade
  When: Grade att-1 with workspace_id=workspaceB (wrong workspace)
  Then: 403 WORKSPACE_ISOLATION_VIOLATION
```

---

## Idempotency Testing

**Objective:** Verify grading engine prevents re-grading same attempt.

**Test Scenario ([Test ID: I002]):**

```
Setup:
  Attempt status: SUBMITTED
  First grading: 85/100, PASSED

Test 1: Grade Attempt (First Time)
  When: GET /attempt/att-1/grade
  Then: Status 200 | Result: GRADED
        attempts.grading_status = 'GRADED'

Test 2: Grade Same Attempt (Second Time)
  When: GET /attempt/att-1/grade (same attempt again)
  Then: Status 409 | Error: ATTEMPT_ALREADY_GRADED
        Result: UNCHANGED (still 85/100, PASSED)
        grading_results: ONE record only (no duplicate)

Test 3: Verify Single Result Row
  When: SELECT COUNT(*) FROM grading_results WHERE attempt_id = 'att-1'
  Then: Count = 1 (only one grading result, not two)
```

---

## Transaction Safety Testing

**Objective:** Verify atomic transactions (all-or-nothing).

**Test Scenario ([Test ID: I003]):**

```
Setup:
  Attempt with 3 questions
  Questions 1-2: Will grade successfully
  Question 3: Will encounter error (missing snapshot)

Test 1: Simulate Transaction Failure
  When: GradingEngine.gradeAttempt() called
  Step 1-2: Successfully grade questions 1-2
  Step 3: Error encountered (snapshot missing)
  Then: FULL ROLLBACK occurs
        attempts.grading_status remains PENDING (not changed)
        NO NEW ROWS in grading_results (transaction rolled back)
        NO NEW ROWS in grading_question_results

Test 2: Verify Clean State After Failure
  When: Query grading tables after failed grade
  Then: Zero rows inserted (transaction safety maintained)
        Attempt can be re-graded (grading_status still PENDING)
```

---

## Concurrency Testing

**Objective:** Verify pessimistic locking prevents race conditions.

**Test Scenario ([Test ID: I004]):**

```
Setup:
  Attempt: att-1 in database
  Two concurrent grading requests for same attempt

Test 1: Concurrent Grade Requests (Simulated)
  When: Request A attempts SELECT FOR UPDATE on att-1
  Then: Lock acquired, grading proceeds

  When: Request B attempts SELECT FOR UPDATE on same att-1
  Then: Request B waits for lock (blocked)

Test 2: After Request A Completes
  When: Request A commits
  Then: Lock released
        Request B proceeds to lock
        Request B checks grading_status (finds 'GRADED')
        Request B rejects with ATTEMPT_ALREADY_GRADED

Test 3: Result
  Then: Race condition prevented
        Only one grading result created
        No data corruption
```

---

## Performance Testing

**Objective:** Verify grading completes within SLA.

**Test Scenario ([Test ID: P001]):**

```
Setup:
  Attempt with 100 questions (large exam)
  Mix of all 7 question types

Benchmark:
  Target: Complete within 500ms

Test:
  When: Grade attempt with 100 questions
  Then: Execution time ≤ 500ms
        All scores calculated correctly
        No N+1 query patterns
        Indexes used efficiently
```

---

## Integration Test Template

**Status:** Template implementations ready, require PostgreSQL test instance.

**Setup (Manual):**

```bash
# 1. Start PostgreSQL with test database
docker run -e POSTGRES_PASSWORD=test -p 5432:5432 postgres:15

# 2. Set test connection string
export TEST_DATABASE_URL="postgresql://postgres:test@localhost/grading_test"

# 3. Run migration to set up schema
npm run db:migrate:tenant -- 20260404_019

# 4. Run integration tests
npm run test -- packages/domain-core/src/grading/__tests__/grading.integration.test.ts
```

**Scenarios Covered:**

1. End-to-End Full Workflow (MCQ + Traditional + Scheduled)
2. Workspace Isolation Enforcement
3. Idempotency Guarantees
4. Error Handling & Recovery
5. Transaction Rollback on Failure
6. Admin Override & Audit Trail

---

## Verification Checklist

Before signing off on grading core:

- [ ] All 69+ unit tests passing (mcq, traditional, aggregator)
- [ ] Type safety validated (bun run typecheck:src)
- [ ] No console errors or warnings during test run
- [ ] Error codes return correct HTTP statuses (404, 409, 400, 422, 500, 403)
- [ ] Workspace isolation verified (cross-workspace query blocked)
- [ ] Idempotency guaranteed (second grade rejected)
- [ ] Transaction safety confirmed (rollback tested)
- [ ] Percentage calculation accurate (2 decimals)
- [ ] Pass rules working for both PERCENTAGE and SCORE modes
- [ ] All 7 question types grading correctly
- [ ] Integration test template set up correctly
- [ ] Performance benchmarks met (if applicable)

---

## Questions & Support

**For Questions About:**

- **Grading Logic:** See packages/domain-core/src/grading/[grader].ts files
- **Error Handling:** See grading.errors.ts for error codes and messages
- **Engine Workflow:** See grading-engine.ts for 13-step orchestration
- **Type System:** See grading.types.ts for all entity definitions

**Issues Found:**
Open an issue on the repository with:

1. Test ID (if applicable)
2. Steps to reproduce
3. Expected vs actual result
4. Environment (OS, Node version, DB version)

---

**Testing Guide Generated:** 2026-04-04  
**Stage:** STAGE_40_GRADING_CORE  
**Branch:** spec/040-grading-core  
**Status:** Ready for QA
