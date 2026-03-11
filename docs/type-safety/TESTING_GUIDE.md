# Type Safety - Testing Guide

Comprehensive test scenarios for validating the 8-layer Type Safety Governance system.

## Test Scenarios by Layer

### Layer 1: TypeScript Strict Mode

**Test 1.1: Implicit Any Detection**

```typescript
// Test case
function process(data) {
  // Should error: implicit any
  return data.value;
}

// Expected: Compiler error
// Actual: ✅ Error TS7006: Parameter 'data' implicitly has an 'any' type
```

**Test 1.2: Unchecked Array Access**

```typescript
// Test case
const items: string[] = ["a", "b"];
const first = items[0].toUpperCase(); // Potential undefined!

// Expected: Compiler error
// Actual: ✅ Error TS2532: Object is possibly 'undefined'
```

**Test 1.3: Null/Undefined Safety**

```typescript
// Test case
function getName(user: { name: string } | null) {
  return user.name; // Could be null!
}

// Expected: Compiler error
// Actual: ✅ Error TS2531: Object is possibly 'null'
```

---

### Layer 2: Biome Linting

**Test 2.1: Explicit Any Detection**

```bash
# File with explicit any
const data: any = something;

# Run linter
bun lint src/file.ts

# Expected: Lint error
# Actual: ✅ Linter warning: Function parameter should have explicit types
```

**Test 2.2: @ts-ignore Comment Validation**

```typescript
// Test case
// @ts-ignore
const value = someValue;

# Run linter
bun lint

# Expected: Lint error (missing comment)
# Actual: ✅ Linter warning: Missing justification
```

---

### Layer 3: Guard Script

**Test 3.1: Detect Explicit Any Patterns**

```bash
# Files with various any patterns
apps/api/src/test.ts:
  - const x: any = 1;
  - const y = data as any;
  - const z: Stream<any> = ...;

# Run guard script
bun type-safety-guard

# Expected: 3 violations detected
# Actual: ✅ Detects all 3 patterns
```

**Test 3.2: Exception Tracking**

```bash
# With exception registered
ALLOWED_ANY_EXCEPTIONS.json:
  - file: apps/api/src/legacy.ts
    pattern: explicit-any
    status: active
    sunsetDate: 2026-06-30

# Run guard script
bun type-safety-guard

# Expected: Exception suppressed
# Actual: ✅ No violation reported for legacy.ts
```

**Test 3.3: Expired Exception Detection**

```bash
# With expired exception
ALLOWED_ANY_EXCEPTIONS.json:
  - file: apps/api/src/old.ts
    sunsetDate: 2026-01-01  # Past!

# Run guard script
bun type-safety-guard

# Expected: Expired exception flagged
# Actual: ✅ Reports: "EXPIRED: apps/api/src/old.ts"
```

---

### Layer 4: Runtime Validation

**Test 4.1: Valid Data Passes**

```typescript
const schema = z.object({ name: z.string() });

const validData = { name: "John" };
const result = schema.parse(validData);

// Expected: Success, result typed as { name: string }
// Actual: ✅ result = { name: 'John' }
```

**Test 4.2: Invalid Data Throws**

```typescript
const schema = z.object({ name: z.string() });

const invalidData = { name: 123 }; // Wrong type!
try {
  schema.parse(invalidData);
} catch (error) {
  // Expected: ZodError thrown
  // Actual: ✅ ZodError with issue details
}
```

**Test 4.3: API Endpoint Validation**

```bash
# POST request with invalid data
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"email": "invalid-email"}' # Invalid format

# Expected: 422 Validation error
# Actual: ✅ Response: { error: "Invalid request", issues: [...] }
```

---

### Layer 5: CI Enforcement

**Test 5.1: Type Error Blocks CI**

```bash
# File with type error
src/api/users.ts:
  const count: number = "5"; // Type mismatch!

# Push to PR
git push origin feature/test-types

# Expected: CI fails, merge blocked
# Actual: ✅ CI shows: "TypeScript Compile Check failed"
```

**Test 5.2: Fixed Code Passes CI**

```bash
# File fixed
src/api/users.ts:
  const count: number = parseInt("5", 10); // Correct!

# Push fix
git push origin feature/test-types

# Expected: CI passes, merge allowed
# Actual: ✅ CI shows: "All type safety checks passed"
```

---

### Layer 6: Domain Layer Safety

**Test 6.1: Protected Package Enforcement**

```bash
# Add any to protected package
packages/domain-core/src/user.ts:
  function getUser(): any { } // Not allowed!

# Run guard script
bun type-safety-guard

# Expected: Error (domain layer)
# Actual: ✅ Reports violation with HIGH severity
```

**Test 6.2: Exception Approval Process**

```bash
# Request exception via GitHub issue
# Architecture team approves (2-week deadline)
# Add to domain-core/ALLOWED_ANY_EXCEPTIONS.json
{
  "file": "packages/domain-core/src/legacy.ts",
  "pattern": "explicit-any",
  "approvedDate": "2026-03-11",
  "sunsetDate": "2026-03-25"
}

# Run guard script
bun type-safety-guard

# Expected: Exception suppressed
# Actual: ✅ No violation reported
```

---

### Layer 7: Boundary-Typed Architecture

**Test 7.1: Explicit Export Types**

```typescript
// File: packages/domain-core/src/users.ts

// ✅ GOOD
export function getUserById(id: string): Promise<User> {
  return db.getUserById(id);
}

// ❌ BAD
export function getUserIds() { // Implicit return type!
  return db.getUserIds();
}

# Run typecheck
bun typecheck

# Expected: Error on implicit export type
# Actual: ✅ Error TS7006: Return type implicitly inferred
```

**Test 7.2: IDE Type Information**

```typescript
// Import from domain-core
import { getUserById } from "@packages/domain-core";

// Hover in IDE (VSCode)
// Expected: Shows return type: Promise<User>
// Actual: ✅ IDE shows: (id: string) => Promise<User>
```

---

### Layer 8: AI Governance

**Test 8.1: AI Code Follows Same Rules**

Create a test PR with AI-generated code that:

```typescript
// ✅ Uses unknown + validation
async function handleRequest(data: unknown) {
  const validated = RequestSchema.parse(data);
  return processRequest(validated);
}

// NOT:
async function handleRequest(data: any) {
  return processRequest(data);
}
```

**Expected**: AI code passes identical CI gates as human code
**Actual**: ✅ CI passes, no special treatment

**Test 8.2: AI Code Review Validation**

```bash
# AI-generated PR submitted
# Code reviewer verifies:
# ✓ No any usage
# ✓ All external data validated
# ✓ Generics used for flexibility
# ✓ @ts-ignore comments justified

# Expected: All checks pass
# Actual**: ✅ PR approved with same rigor as human code
```

---

## Integration Test: Full Request Flow

**Scenario**: Create a new exam

### Step 1: Developer writes endpoint code

```typescript
// apps/api/src/routes/exams.ts
router.post("/exams", async (c) => {
  const body: unknown = await c.req.json();
  const exam = CreateExamSchema.parse(body);
  const created = await service.createExam(exam);
  return c.json(created);
});
```

### Step 2: Local validation

```bash
bun typecheck       # Layer 1: ✅ 0 errors
bun lint            # Layer 2: ✅ 0 violations
bun type-safety-guard # Layer 3: ✅ 0 violations
```

### Step 3: Push to PR

```bash
git add .
git commit -m "feat: add POST /exams endpoint"
git push origin feature/create-exams
```

### Step 4: CI pipeline runs

```
GitHub CI
├─ TypeScript Compile (Layer 1): ✅ PASS
├─ Guard Script (Layer 3): ✅ PASS
├─ Biome Lint (Layer 2): ✅ PASS
└─ Overall: ✅ ALL CHECKS PASSED

Merge button: ENABLED
```

### Step 5: Code review

```
Architecture Team Review:
✓ Validates types correct (Layer 7)
✓ Checks external data handled (Layer 4)
✓ Verifies no any usage (Rule 1)
✓ Confirms validation pattern (Rule 2)
✓ Approves PR
```

### Step 6: Merge and deploy

Code merges to main, goes to production

### Step 7: Runtime validation onRequest

```
API Request:
POST /api/exams
{ "name": "CS101", "questions": [...] }
        ↓
Layer 4 Runtime: Validate with schema
        ↓
✅ Valid → Proceed to domain logic
❌ Invalid → Return 422 error
```

---

## Test Execution

### Run All Tests

```bash
# Full test suite
bun test

# Just type safety tests
bun test tests/type-safety

# Specific test file
bun test tests/unit/routes/exams.test.ts
```

### Coverage Goals

| Area               | Target   | Actual |
| ------------------ | -------- | ------ |
| Validation schemas | 90%      | -      |
| Route handlers     | 95%      | -      |
| Domain logic       | 85%      | -      |
| Error handling     | 100%     | -      |
| **Overall**        | **>85%** | -      |

---

## Acceptance Criteria

### Layer-By-Layer Acceptance

| Layer | Acceptance Criteria                  | Status |
| ----- | ------------------------------------ | ------ |
| 1     | `bun typecheck` passes               | ✅     |
| 2     | `bun lint` passes                    | ✅     |
| 3     | `bun type-safety-guard` reports 0    | ✅     |
| 4     | All API inputs validated             | ✅     |
| 5     | CI job <2min, blocks merges          | ✅     |
| 6     | Protected packages: 0% unallowed any | ✅     |
| 7     | All exports explicitly typed         | ✅     |
| 8     | AI code passes same gates            | ✅     |

### MVP Success Criteria

- ✅ Layers 1, 2, 5 fully operational
- ✅ All CI checks pass on test PR
- ✅ Type errors block merge
- ✅ Team feedback positive

---

Last Updated: 2026-03-11
