# Type Safety Governance - Testing & QA Guide

**For**: QA Engineers, Developers, Reviewers  
**Purpose**: Ensure all 8 layers of type safety are working correctly  
**Scope**: Manual and automated test scenarios

---

## Quick Start: Verify All Layers Work

### 1-Minute Verification

```bash
# All checks should pass in <2 minutes
bun typecheck        # Layer 1
bun lint             # Layer 2
bun type-safety-guard  # Layer 3
bun validate:types   # Full suite
```

**Expected Output**: ✅ All checks pass

---

## Layer-by-Layer Testing

### Layer 1: TypeScript Strict Mode

**What to Test**: Compiler rejects implicit `any` and unsafe types

**Test Scenario 1: Implicit Any Detection**

```bash
# File: test-implicit-any.ts
function process(data) {  // Should error!
  return data.value;
}

# Run typecheck
bun typecheck

# Expected: ✅ Error TS7006: Parameter 'data' implicitly has 'any' type
```

**Test Scenario 2: Index Access Safety**

```bash
const items: string[] = ['a', 'b'];
const first = items[0].toUpperCase();  // Potential crash!

# Run typecheck
bun typecheck

# Expected: ✅ Error TS2532: Object is possibly 'undefined'
```

**Pass Criteria**:

- ✅ Compiler catches implicit `any`
- ✅ Compiler enforces index bounds checking
- ✅ Compiler rejects null/undefined mismatches

---

### Layer 2: Biome Linting

**What to Test**: Linter enforces no explicit `any`

**Test Scenario 1: Any Type Detected**

```bash
# File: test-explicit-any.ts
const data: any = response;  // Not allowed!

# Run linter
bun lint

# Expected: ⚠️ Linter warning about explicit any
```

**Test Scenario 2: @ts-ignore Without Justification**

```bash
// @ts-ignore
const value = someValue;  // Missing comment!

# Run linter
bun lint

# Expected: ⚠️ Linter warning: Missing justification
```

**Pass Criteria**:

- ✅ Linter warns on explicit `any`
- ✅ Linter warns on `@ts-ignore` without comment
- ✅ `bun lint:fix` can fix many issues

---

### Layer 3: Guard Script

**What to Test**: Pattern detection scans entire monorepo

**Test Scenario 1: Detect Multiple Patterns**

```bash
# Create test file with violations
cat > /tmp/test-patterns.ts << 'EOF'
const x: any = 1;
const y = data as any;
const z: Stream<any> = ...;
// @ts-ignore
const w = someValue;
EOF

# Run guard script with include pattern
bun type-safety-guard

# Expected: ✅ 4 violations detected
```

**Test Scenario 2: Exception Suppression**

```bash
# Add exception to registry
packages/domain-core/ALLOWED_ANY_EXCEPTIONS.json:
{
  "file": "path/to/file.ts",
  "pattern": "explicit-any",
  "status": "active"
}

# Run guard script
bun type-safety-guard

# Expected: ✅ Exception suppressed (not reported)
```

**Test Scenario 3: Expired Exception Detection**

```bash
# Add expired exception
{
  "file": "path/to/file.ts",
  "sunsetDate": "2026-01-01"  # In the past!
}

# Run guard script
bun type-safety-guard

# Expected: ⚠️ EXPIRED: path/to/file.ts
```

**Pass Criteria**:

- ✅ Guard script finds all pattern types
- ✅ Completes <30 seconds
- ✅ Exceptions properly suppressed
- ✅ Expired exceptions flagged

---

### Layer 4: Runtime Validation

**What to Test**: Schemas validate external data

**Test Scenario 1: Valid Data Passes**

```bash
# File: test-validation.ts
import { UserSchema } from '@packages/validation';

const validData = { id: '1', email: 'user@example.com' };
const user = UserSchema.parse(validData);
// Expected: ✅ user properly typed as User
```

**Test Scenario 2: Invalid Data Rejected**

```bash
const invalidData = { id: '1', email: 'not-an-email' };

try {
  UserSchema.parse(invalidData);
  console.log('FAILED: Should have thrown');
} catch (error) {
  console.log('SUCCESS: ZodError thrown as expected');
  // Expected: ✅ ZodError with detailed issues
}
```

**Test Scenario 3: API Request Validation**

```bash
# POST /api/users with invalid data
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"email": "invalid"}'

# Expected: ✅ 422 Validation Failed
# Response: { error: "Validation failed", issues: [...] }
```

**Pass Criteria**:

- ✅ Valid data passes through
- ✅ Invalid data throws ZodError
- ✅ API returns 422 on validation failure
- ✅ Error messages are helpful

---

### Layer 5: CI Enforcement

**What to Test**: GitHub Actions blocks merges on type errors

**Test Scenario 1: Type Error Blocks CI**

```bash
# Create PR with type error
git checkout -b test/type-error
cat > src/test.ts << 'EOF'
const count: number = "5";  // Type error!
EOF
git add src/test.ts
git commit -m "test: deliberate type error"
git push origin test/type-error

# Create PR
# Expected: ❌ CI fails with "TypeScript Compile Check failed"
# Expected: ✅ Merge button disabled
```

**Test Scenario 2: Fixed Code Passes CI**

```bash
# Fix the error
cat > src/test.ts << 'EOF'
const count: number = parseInt("5", 10);
EOF
git add src/test.ts
git commit -m "fix: correct type"
git push origin test/type-error

# Expected: ✅ CI passes
# Expected: ✅ Merge button enabled
```

**Pass Criteria**:

- ✅ CI job triggers on PR
- ✅ Type errors cause failure
- ✅ Merge blocked on failure
- ✅ Clear error messages shown

---

### Layer 6: Domain Layer Safety

**What to Test**: Exception registries enforce domain layer types

**Test Scenario 1: Undeclared Any Detected**

```bash
# Add any to domain-core without approval
packages/domain-core/src/legacy.ts:
function getLegacyData(): any { }  // Not allowed!

# Run guard script
bun type-safety-guard

# Expected: 🚨 Violation in domain-core (HIGH severity)
```

**Test Scenario 2: Exception Approval Flow**

```bash
# 1. Request exception via GitHub issue (title, reason, deadline)
# 2. Architecture team reviews and approves
# 3. Add to registry:
{
  "file": "packages/domain-core/src/legacy.ts",
  "pattern": "explicit-any",
  "approvedDate": "2026-03-11",
  "sunsetDate": "2026-03-25"
}
# 4. Run guard script
bun type-safety-guard

# Expected: ✅ Exception suppressed
# Expected: ⚠️ Warning when approaching sunset date
```

**Pass Criteria**:

- ✅ Unauthorized `any` detected in domain layer
- ✅ Approved exceptions suppressed
- ✅ Sunset dates enforced
- ✅ Approval audit trail maintained

---

### Layer 7: Boundary-Typed Architecture

**What to Test**: Public exports have explicit types

**Test Scenario 1: Missing Return Type**

```bash
# File: packages/domain-core/src/users.ts

// ❌ BAD - Implicit return type
export function getUserIds() {
  return db.getUserIds();
}

# Run typecheck
bun typecheck

# Expected: ✅ Error: Return type should be explicit
```

**Test Scenario 2: Correct Export Type**

```bash
// ✅ GOOD - Explicit return type
export function getUserIds(): Promise<string[]> {
  return db.getUserIds();
}

# Run typecheck
bun typecheck

# Expected: ✅ Compiles successfully
```

**Test Scenario 3: IDE Shows Type Information**

```bash
// In IDE (VSCode):
import { getUserById } from '@packages/domain-core';

// Hover over function name
// Expected: ✅ Shows: (id: string) => Promise<User>
```

**Pass Criteria**:

- ✅ Missing return types caught by compiler
- ✅ All public exports explicitly typed
- ✅ IDE shows complete type information

---

### Layer 8: AI Governance

**What to Test**: AI-contributed code follows same rules

**Test Scenario 1: AI Code Passes CI**

```bash
# AI-generated PR with proper types
async function handleRequest(data: unknown) {
  const validated = RequestSchema.parse(data);
  return processRequest(validated);
}

# Push to PR
# Run CI
# Expected: ✅ All checks pass (same as human code)
```

**Test Scenario 2: AI Code Review Validation**

```bash
# Code review checklist:
- [ ] No any usage
- [ ] All external data validated
- [ ] Generics used for flexibility
- [ ] @ts-ignore comments justified

# Expected: ✅ All checks verified
```

**Pass Criteria**:

- ✅ AI code subject to identical CI gates
- ✅ No special exemptions
- ✅ Code review validates AI rules
- ✅ Consistent enforcement

---

## Integration Test: Full Request Flow

**Scenario**: Create new exam endpoint

### Step 1: Developer Writes Code (AI or Human)

```typescript
router.post("/exams", async (c) => {
  const body: unknown = await c.req.json();
  const exam = CreateExamSchema.parse(body); // Layer 4
  const created = await service.createExam(exam);
  return c.json(created);
});
```

### Step 2: Local Validation ✅

```bash
bun typecheck        # Layer 1 ✅
bun lint             # Layer 2 ✅
bun type-safety-guard # Layer 3 ✅
```

### Step 3: Push PR

```bash
git push origin feature/create-exams
```

### Step 4: CI Pipeline ✅

```
Layer 5: CI Enforcement
├─ TypeScript Compile ✅
├─ Guard Script Scan ✅
├─ Biome Lint ✅
└─ Overall: PASS → Merge enabled
```

### Step 5: Code Review ✅

```
Layer 7: Boundary Typing
├─ Return type explicit ✅
├─ Public API typed ✅
└─ IDE shows types ✅

Layer 4: Runtime Validation
├─ External data validated ✅
├─ Schema used ✅
└─ Entry point safe ✅

Layer 8: AI (if AI-generated)
├─ Used unknown ✅
├─ Validated data ✅
├─ No @ts-ignore ✅
└─ Same CI gates ✅
```

### Step 6: Merge & Deploy

Code goes to production with type safety guaranteed across all 8 layers.

---

## Acceptance Criteria

### MVP Phase (Layers 1+5)

- [x] `bun typecheck` passes on full monorepo
- [x] `bun lint` passes
- [x] CI workflow created and functional
- [x] Type errors block PR merge
- [x] Performance <2 minutes

### Post-MVP Phase (Layers 2-8)

- [x] Guard script <30 seconds
- [x] Domain packages: 0% unallowed `any`
- [x] Runtime validation schemas created
- [x] Boundary typing audit complete
- [x] AI governance documented
- [x] Documentation complete (15+ files)

---

## Common Issues & Troubleshooting

### Issue: "Type X is not assignable to type Y"

**Solution**:

1. Check the error location
2. Verify variable type annotation is correct
3. If type is wrong, fix the initializer
4. Read: `docs/type-safety/RUNBOOK_FIX_TYPE_ERRORS.md`

### Issue: "Function implicitly has return type any"

**Solution**:

1. Add explicit return type to function signature
2. Example: `function getName(): string { }`
3. Read: `docs/type-safety/RUNBOOK_TYPE_NEW_API_ENDPOINT.md`

### Issue: Guard script shows violation, but I need the `any`

**Solution**:

1. Create GitHub issue (reason, deadline, impact)
2. Get approval from architecture team (2-week deadline)
3. Add to ALLOWED_ANY_EXCEPTIONS.json with sunset date
4. Read: `docs/type-safety/EXCEPTION_HANDLING.md`

### Issue: CI types are OK locally, but fail on PR

**Solution**:

1. Pull latest: `git pull origin main`
2. Clean install: `rm -rf node_modules && bun install`
3. Full check: `bun typecheck && bun validate:types`
4. Check CI logs for exact error

---

## Performance Monitoring

### Local Development

Track times to watch for regressions:

```bash
# Should complete in <5 seconds
time bun typecheck

# Should complete in <30 seconds
time bun type-safety-guard

# Should complete in <20 seconds
time bun lint

# Should complete in <60 seconds combined
time bun validate:types
```

### CI Pipeline

GitHub Actions displays execution time:

- Target: <2 minutes total
- Alert if: exceeds 3 minutes
- Investigation: Check typecheck cache hit rate

---

## Team Feedback Loop

### Report Issues

Create GitHub issue with:

- [ ] Title: "Type Safety: [Layer] [Issue]"
- [ ] Description: What's broken
- [ ] Steps to reproduce
- [ ] Expected vs actual
- [ ] Tag: @architecture-team

### Request Improvements

Comment on project board or create discussion:

- New pattern detection needed?
- Documentation unclear?
- Performance regression?
- Better error messages?

### Share Learnings

Document patterns you discover:

- Common type errors in your area
- Validation patterns that work well
- Exception requests that get approved
- Shortcuts that save time

---

## Success Metrics

Track over time to ensure system is healthy:

| Metric                | Target     | Check Frequency |
| --------------------- | ---------- | --------------- |
| CI job time           | <2 min     | Every PR        |
| Guard script time     | <30s       | Weekly          |
| Type errors caught    | >95%       | Monthly         |
| Exception expirations | <10 active | Monthly         |
| Team satisfaction     | >3.5/5     | Quarterly       |

---

## Next Steps

1. **Read the handbook**: `docs/type-safety/TYPE_SAFETY_HANDBOOK.md`
2. **Run verification**: `bun validate:types`
3. **Test locally**: Follow scenarios above
4. **Report findings**: Create GitHub issues if needed
5. **Share results**: Feedback to architecture team

---

**Type safety governance is now your responsibility too.**

**All team members with push access should understand these layers.**

**Questions? See: `docs/type-safety/README.md`**

---

Last Updated: 2026-03-11
