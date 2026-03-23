# Testing Guide — MCQ Baskets (Stage 33)

**Stage:** MCQ Baskets  
**Phase:** 03_BACKOFFICE_CORE / 03_CONTENT_CLASSIFICATION  
**Stage Directory:** `specs/runtime/033-mcq-baskets`  
**Generated On:** 2026-03-23

---

## Purpose

This guide explains how to validate the MCQ Baskets implementation end-to-end. It covers automated test execution, manual test scenarios, and debugging common issues.

---

## Summary of Delivered Behavior

The MCQ Baskets stage introduces a complete question basket (collection) management system for the backoffice. Instructors can create, manage, and organize questions into reusable baskets, assign baskets to exams, and control which questions are available through various filtering and eligibility rules.

Key outcomes:

- **Basket CRUD Operations:** Create, list, retrieve, update, and delete question baskets with atomic transactions
- **Basket Status Workflow:** Baskets transition through DRAFT → ENABLED → DISABLED states with permission guards
- **Question Management:** Link/unlink questions to/from baskets with duplicate detection and cardinality constraints
- **Tenant Isolation:** All basket operations are scoped to the authenticated workspace
- **Data Integrity:** All modifications are wrapped in database transactions with proper locking

---

## Prerequisites

| Requirement                    | Validation Command / Check                                    |
| ------------------------------ | ------------------------------------------------------------- |
| Node.js v20+                   | `node --version`                                              |
| Bun v1+                        | `bun --version`                                               |
| Docker running                 | `docker ps` (should list containers)                          |
| PostgreSQL running (tenant DB) | `psql -h localhost -U postgres -d zidney_tenant_test -c '\l'` |
| Redis running (session cache)  | `redis-cli ping` (should return PONG)                         |
| `.env` or `.env.test` present  | Verify file exists; contains `DATABASE_URL`, `REDIS_URL`      |
| Git branch correct             | `git branch` (should show `spec/033-mcq-baskets`)             |

---

## Files in Scope

**Domain Package (packages/domain-core/src/baskets/):**

```
baskets/
├── __tests__/
│   ├── baskets.service.test.ts      (35 unit tests)
│   └── baskets.repository.test.ts   (8 unit tests)
├── baskets.types.ts                  (domain types)
├── baskets.errors.ts                 (error codes + HTTP mapping)
├── baskets.repository.ts             (SQL queries, row mappers)
├── baskets.service.ts                (business logic, TX boundaries)
├── baskets.dependency-registry.ts    (module registration)
└── index.ts                          (public exports)
```

**API Routes (apps/api/src/routes/backoffice/baskets/):**

```
baskets/
├── __tests__/
│   ├── baskets.crud.test.ts          (12 integration tests)
│   ├── baskets.workflow.test.ts      (9 workflow tests)
│   ├── baskets.questions.test.ts     (7 question management tests)
│   ├── baskets.isolation.test.ts     (1 tenant isolation test)
│   └── baskets.deletion-guard.test.ts (6 deletion safety tests)
├── create-basket.ts
├── list-baskets.ts
├── get-basket.ts
├── update-basket.ts
├── delete-basket.ts
├── transition-basket.ts
├── link-question.ts
├── unlink-question.ts
├── list-questions.ts
├── helpers.ts
└── index.ts
```

**Infrastructure (apps/api/src/db/tenant/):**

```
├── migrations/
│   └── 20260323_011_mcq_baskets.ts       (create tables, indexes)
├── schemas/
│   ├── baskets.schema.ts                 (Drizzle baskets table)
│   ├── basket-questions.schema.ts        (Drizzle join table)
│   └── index.ts
└── ...
```

---

## Local Run Commands

```bash
# Install dependencies
bun install

# Apply migrations (tenant setup)
bun run db:migrate

# Start API server in dev mode
bun run dev:api

# In another terminal, start Redis (if not already running)
redis-server

# In another terminal, start E2E server
bun run dev:api --port 3001
```

---

## Automated Validation Commands

### Run All Tests for Stage 33

```bash
# Run domain package tests (service + repository)
bun test packages/domain-core/src/baskets/__tests__/

# Run API route tests (CRUD + workflow + questions + isolation + deletion)
bun test apps/api/src/routes/backoffice/baskets/__tests__/

# Run all together
bun test packages/domain-core/src/baskets/__tests__/ apps/api/src/routes/backoffice/baskets/__tests__/
```

### Expected Output

```
Test Files  7 passed (7)
      Tests  100 passed (100)

Coverage report available in ./coverage/ (if --coverage flag used)
```

### Run with Coverage

```bash
bun test --coverage packages/domain-core/src/baskets/__tests__/ apps/api/src/routes/backoffice/baskets/__tests__/
```

---

## Manual Test Scenarios

### Scenario 1 — Create and List Baskets

**Purpose:** Verify basket CRUD operations work correctly under normal conditions

**Setup:**

1. Start the API: `bun run dev:api`
2. Use a REST client (Postman, Thunder Client, curl) or the Backoffice frontend
3. Authenticate with a test tenant (e.g., workspace_id: `123e4567-e89b-12d3-a456-426614174000`)

**Steps:**

1. Create a new basket:

   ```http
   POST /api/v1/backoffice/workspace/baskets
   Content-Type: application/json
   Authorization: Bearer <test-token>

   {
     "name": "Biology Quiz Questions",
     "code": "BIO_QUIZ_Q1",
     "type": "generic",
     "maxQuestions": 50,
     "description": "General biology multiple-choice questions for Year 11"
   }
   ```

2. Capture the response basket ID (e.g., `resp.data.id`)
3. List baskets to verify the new one appears:
   ```http
   GET /api/v1/backoffice/workspace/baskets?type=generic
   Authorization: Bearer <test-token>
   ```
4. Retrieve the specific basket:
   ```http
   GET /api/v1/backoffice/workspace/baskets/{basketId}
   Authorization: Bearer <test-token>
   ```

**Expected:**

- Status 201 for POST (basket created)
- `response.success === true`, `response.data.id` is a UUID, `response.data.status === 'DRAFT'`
- Status 200 for GET /baskets-list; the created basket appears in `items[]`
- Status 200 for GET /baskets/{id}; basket details match what was POSTed

---

### Scenario 2 — Link Questions and Enforce Maximum Cardinality

**Purpose:** Verify question linkage, duplicate detection, and max questions enforcement

**Setup:** Have a basket created (from Scenario 1) and at least 3 questions created in the system

**Steps:**

1. Link a question to the basket:

   ```http
   POST /api/v1/backoffice/workspace/baskets/{basketId}/questions
   Content-Type: application/json
   Authorization: Bearer <test-token>

   {
     "questionId": "550e8400-e29b-41d4-a716-446655440001"
   }
   ```

2. Attempt to link the same question again (duplicate test):
   ```http
   POST /api/v1/backoffice/workspace/baskets/{basketId}/questions
   {
     "questionId": "550e8400-e29b-41d4-a716-446655440001"  // Same question ID
   }
   ```
3. Link more questions until reaching the `maxQuestions` limit (e.g., 50 in Scenario 1):

   ```http
   # Link question 2
   POST /api/v1/backoffice/workspace/baskets/{basketId}/questions
   { "questionId": "550e8400-e29b-41d4-a716-446655440002" }

   # ...repeat for questions 3-50...

   # Link question 51 (should fail with 409)
   POST /api/v1/backoffice/workspace/baskets/{basketId}/questions
   { "questionId": "550e8400-e29b-41d4-a716-446655440051" }
   ```

4. List questions in the basket:
   ```http
   GET /api/v1/backoffice/workspace/baskets/{basketId}/questions
   Authorization: Bearer <test-token>
   ```

**Expected:**

- Status 201 for first link
- Status 409 BASKET_QUESTION_ALREADY_LINKED for duplicate (second link attempt)
- Status 409 BASKET_MAX_QUESTIONS_REACHED when 51st question added (limit is 50)
- Status 200 for list-questions; `items[]` contains exactly 50 questions

---

### Scenario 3 — Basket Status Transitions with Permission Guards

**Purpose:** Verify workflow state machine and permission enforcement

**Setup:** Have a DRAFT basket (from Scenario 1)

**Steps:**

1. As a user with `manage_basket_workflow` permission, transition to ENABLED:

   ```http
   POST /api/v1/backoffice/workspace/baskets/{basketId}/transition
   Content-Type: application/json
   Authorization: Bearer <admin-token>  // Must have manage_basket_workflow

   {
     "to": "ENABLED"
   }
   ```

2. Verify basket is now ENABLED:
   ```http
   GET /api/v1/backoffice/workspace/baskets/{basketId}
   Authorization: Bearer <admin-token>
   ```
3. Attempt to transition from ENABLED to DRAFT (should fail — invalid):
   ```http
   POST /api/v1/backoffice/workspace/baskets/{basketId}/transition
   {
     "to": "DRAFT"
   }
   ```
4. Transition to DISABLED:
   ```http
   POST /api/v1/backoffice/workspace/baskets/{basketId}/transition
   {
     "to": "DISABLED"
   }
   ```

**Expected:**

- Status 200 for valid transitions (DRAFT→ENABLED, ENABLED→DISABLED)
- Status 403 FORBIDDEN if user lacks `manage_basket_workflow` permission
- Status 422 INVALID_STATE_TRANSITION for ENABLED→DRAFT
- Final basket.status should reflect the transition

---

### Scenario 4 — Tenant Isolation (Edge Case)

**Purpose:** Verify baskets created in one tenant are not visible in another

**Setup:** Two separate authentication tokens representing different workspaces/tenants

**Steps:**

1. Using Tenant A token, create a basket:
   ```http
   POST /api/v1/backoffice/workspace/baskets
   Authorization: Bearer <tenant-a-token>
   {
     "name": "Tenant A Basket",
     "code": "TENANT_A_BASKET",
     "type": "generic"
   }
   ```
2. Capture the basket ID
3. List baskets in Tenant A:
   ```http
   GET /api/v1/backoffice/workspace/baskets
   Authorization: Bearer <tenant-a-token>
   ```
4. Switch to Tenant B token and list baskets:
   ```http
   GET /api/v1/backoffice/workspace/baskets
   Authorization: Bearer <tenant-b-token>
   ```
5. Attempt to access Tenant A's basket directly from Tenant B:
   ```http
   GET /api/v1/backoffice/workspace/baskets/{basket-a-id}
   Authorization: Bearer <tenant-b-token>
   ```

**Expected:**

- Status 200 for Tenant A list; basket appears in `items[]`
- Status 200 for Tenant B list; Tenant A's basket does NOT appear (empty or different baskets)
- Status 404 NOT_FOUND when Tenant B tries to access Tenant A's basket by ID

---

### Scenario 5 — Delete Basket with Integrity Guards (Edge Case)

**Purpose:** Verify deletion guards that prevent removal of referenced baskets

**Setup:** A basket that is referenced in exam configuration

**Steps:**

1. Create a basket and link it to an exam configuration (if system supports this)
2. Attempt to delete the basket:
   ```http
   DELETE /api/v1/backoffice/workspace/baskets/{basketId}
   Authorization: Bearer <admin-token>
   ```
3. If referenced, observe the error response
4. If not referenced, verify successful deletion

**Expected:**

- Status 409 BASKET_REFERENCED_IN_EXAM if basket is in use
- Status 200 with `{ deleted: true }` if basket can be safely deleted
- Subsequent GET should return 404 after successful deletion

---

## Debugging Common Issues

### Issue: Tests Fail with "VI.MOCK() NOT FOUND"

**Cause:** Test file uses incorrect relative path to `vi.mock()` dependency

**Solution:**

```typescript
// ❌ Wrong (test file in __tests__/, path resolves relative to __tests__/)
vi.mock("../workflow/workflow.engine");

// ✅ Correct (one extra ../)
vi.mock("../../workflow/workflow.engine");
```

### Issue: SQL Error "COLUMN 'ID' DOES NOT EXIST"

**Cause:** Repository uses aliased table (`FROM mcq_baskets b`) but query references unaliased column

**Solution:**

```typescript
// ❌ Wrong
WHERE id = $1

// ✅ Correct
WHERE b.id = $1
```

### Issue: Tests Timeout or Hang

**Cause:** Real database connection attempted instead of mocked

**Solution:**

- Verify `vi.mock()` paths are correct
- Confirm `getDb()` is properly mocked to return `MockDB` object
- Check that SQL mocks return expected structure (`{ rows: [...], count: '0' }`)

### Issue: "BASKET_NOT_FOUND" Error on Valid Basket ID

**Cause:** Query used non-UUID string (e.g., `'bad-id'`, `'non-existent'`) as basketId

**Solution:**

- Route handlers validate `basketId` with `z.string().uuid()`
- Pass valid UUID strings to tests
- Use predefined `BASKET_ID = '550e8400-e29b-41d4-a716-446655440000'` constant

### Issue: Test Asserts "Count is 0 but Expected 50"

**Cause:** Mock repository returned count row for ALL queries (including data queries)

**Solution:**

```typescript
// ✅ Correct: SQL-aware mock
if (sql.includes("COUNT(*)")) {
  return { rows: [{ count: "50" }] };
} else {
  return {
    rows: [
      /* basket rows */
    ],
  };
}
```

---

## Test Run Examples

### Example 1: Run Single Test File

```bash
bun test packages/domain-core/src/baskets/__tests__/baskets.service.test.ts

# Output example:
# ✓ baskets.service.test.ts (35)
#   ✓ createBasket
#     ✓ creates basket with valid input
#     ✓ returns BASKET_CODE_DUPLICATE if code already exists
#     ✓ requires license and workspace context
#   ✓ getBasket
#     ✓ returns basket with question count...
#   ... (35 total tests)
```

### Example 2: Run with Grep Filter

```bash
bun test packages/domain-core/src/baskets/__tests__/baskets.service.test.ts -t "createBasket"

# Runs only tests matching the pattern "createBasket"
```

### Example 3: Run with Coverage Report

```bash
bun test --coverage packages/domain-core/src/baskets/__tests__/

# Output: coverage/index.html (open in browser for visual report)
```

---

## Continuous Integration

The tests are also run in CI/CD pipelines:

- **Pre-commit:** `bun run precommit:test` validates Stage 33 tests pass
- **GitHub Actions:** `.github/workflows/ci.yml` runs full test suite on PR
- **Deployment:** Stage cannot be deployed to production if tests fail

---

## Support & Troubleshooting

For issues not covered above:

1. Check the test output for the exact error message
2. Review the test file's describe/it blocks to understand test intent
3. Compare with passing stages in `specs/runtime/` for similar test patterns
4. Consult `.agents/skills/api-testing-patterns/SKILL.md` for multi-tenant test conventions
5. Escalate to Code Reviewer agent if systematic issue found

---

## Cleanup After Testing

```bash
# Rollback test migrations (if using test tenant DB)
bun run db:rollback

# Clear test cache and coverage
rm -rf .vitest coverage .nyc_output
```
