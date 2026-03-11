# Layer Contracts & Interface Specifications

**Document Purpose**: Define the formal contracts (guarantees and responsibilities) between each governance layer.

**Date**: 2026-03-11  
**Version**: 1.0.0

---

## Contract Architecture Model

Each layer provides guarantees to downstream layers and depends on upstream layers' guarantees:

```
┌─────────────────────────────────────────────────────────────────┐
│                         Type Safety Guarantees                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ Client Code                                                     │
│  ├─ Assumption: Types are correct and safe                     │
│  └─ Responsibility: None (consumer, not provider)              │
│                                                                  │
│ ↑ Contract 7: Boundary Types                                   │
│   ├─ Guarantee: All exports have explicit types                │
│   ├─ Requirement: Complete type annotations                    │
│   └─ Verified by: Layer 1 (strict mode)                        │
│                                                                  │
│ ↑ Contract 6: Domain Layer Safety                              │
│   ├─ Guarantee: Protected packages have zero `any`             │
│   ├─ Requirement: ALLOWED_ANY_EXCEPTIONS.json approved         │
│   └─ Verified by: Layer 3 (guard script)                       │
│                                                                  │
│ ↑ Contract 4: Runtime Validation                               │
│   ├─ Guarantee: External data validated before domain access   │
│   ├─ Requirement: Schema validation at entry points            │
│   └─ Verified by: Layer 1 (type system)                        │
│                                                                  │
│ ↑ Contract 5: CI Enforcement                                   │
│   ├─ Guarantee: Unsafe code cannot merge                       │
│   ├─ Requirement: CI passes all type checks                    │
│   └─ Verified by: Layers 1-3                                   │
│                                                                  │
│ ↑ Contract 3: Guard Script                                     │
│   ├─ Guarantee: Detects unsafe patterns                        │
│   ├─ Requirement: <30s execution; accurate detection           │
│   └─ Verified by: Layer 1 (pattern matching)                   │
│                                                                  │
│ ↑ Contract 2: Biome Linting                                    │
│   ├─ Guarantee: Explicit `any` caught without comment          │
│   ├─ Requirement: Rule enforcement on lint                     │
│   └─ Verified by: Layer 1 (tsc rule support)                   │
│                                                                  │
│ ↑ Contract 1: TypeScript Compiler Rules                        │
│   ├─ Guarantee: Implicit `any` is compiler error              │
│   ├─ Requirement: strict mode + noImplicitAny enabled          │
│   └─ Verified by: tsc compiler checks                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Contract 1: TypeScript Compiler Rules

**Layer**: Layer 1  
**Provider**: TypeScript compiler (tsc)  
**Consumers**: All downstream layers, all code

### 1.1 Guarantees

The TypeScript compiler, when configured with strict mode, guarantees:

✅ **No Implicit Any**

- Code without explicit types that would be inferred as `any` causes compilation error
- If code compiles, type is not implicit `any`

✅ **Explicit Null/Undefined Handling**

- Variables declared without explicit type cannot assume null-free type
- Accessing property on possibly-null value causes error
- Must use optional chaining (?.) or type guards

✅ **Function Parameter Types**

- All function parameters must have explicit types (inheritance allowed)
- No parameter can be implicitly typed as `any`

✅ **Function Return Type Inference**

- Return types can be inferred (not required to be explicit)
- But inference is based on strict mode; no `any` inferences
- Explicit return types still recommended for boundaries

✅ **Index Access Safety**

- Accessing array/object by index returns `T | undefined`
- Accessing non-existent property shows error
- Must use optional chaining or type narrowing

### 1.2 Requirements

Code must:

✅ **Pass tsc --noEmit with strict mode**

```bash
bun typecheck
# Exit code 0 = all requirements met
```

✅ **Include tsconfig.json with**

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUncheckedIndexedAccess": true
  }
}
```

✅ **Code must compile with these options**

- No `any` without explicit annotation (allowed but requires Biome comment)
- No untyped parameters
- No implicit null/undefined

### 1.3 Verification

**How to verify Contract 1 compliance**:

```bash
# Step 1: Run TypeScript compiler
bun typecheck

# Step 2: Check exit code
echo $?  # 0 = compliant, 1 = violations

# Step 3: If violations exist, fix and re-run
# Code cannot proceed to next contract until this passes
```

### 1.4 Dependencies

**Contract 1 depends on**:

- TypeScript 5.0+ installed and available
- Node.js/Bun runtime working
- tsconfig.json properly configured

**Contract 1 is required for**:

- Contract 2 (Biome cannot lint non-compiling code effectively)
- Contract 3 (Guard script assumes code is compilable)
- All downstream contracts

---

## Contract 2: Biome Linting

**Layer**: Layer 2  
**Provider**: Biome linter  
**Consumers**: CI pipeline, developers

### 2.1 Guarantees

Biome linter, when configured with `suspicious/noExplicitAny` rule, guarantees:

✅ **Detects Explicit `any` Without Justification**

- Any code with `: any` type annotation is flagged
- Error is raised; code cannot pass lint check

✅ **Requires Structured Justification Comments**

- `biome-ignore comment must include:
  - Library/SDK name and version
  - Issue reference (URL or issue tracker)
  - Business reason
- Vague comments ("needed", "todo") are rejected

✅ **No Silent Suppressions**

- Cannot disable rule globally in config
- Cannot suppress without comment
- Every exception is visible and documented

### 2.2 Requirements

Code must:

✅ **Pass biome lint for type safety rules**

```bash
biome lint --only=suspicious
# Exit code 0 = compliant
```

✅ **If any code contains explicit `any`**

- Must include `biome-ignore lint/suspicious/noExplicitAny --` comment
- Comment must include structured justification:
  ```typescript
  // biome-ignore lint/suspicious/noExplicitAny -- ExternalLib@2.1.0 has incomplete types (issue: https://github.com/external/issues/456)
  const data: any = window.ExternalLib;
  ```

✅ **Justification must include**

- Library/SDK name
- Version number
- Issue reference (URL)
- Business reason (1-2 sentences)

### 2.3 Verification

**How to verify Contract 2 compliance**:

```bash
# Step 1: Run Biome lint with type rules only
biome lint --only=suspicious

# Step 2: Check exit code
echo $?  # 0 = fully compliant

# Step 3: If violations found, check if all have proper comments
# biome lint output will show which lines lack comments
```

### 2.4 Dependencies

**Contract 2 depends on**:

- Contract 1 (Code must be compilable for effective linting)
- Biome 1.0+ installed
- biome.json properly configured

**Contract 2 enables**:

- Clear audit trail of deliberate type exceptions
- Developer accountability (why `any`?)
- Automated detection of unjustified exceptions

---

## Contract 3: Type Safety Guard Script

**Layer**: Layer 3  
**Provider**: scripts/type-safety-guard.ts  
**Consumers**: CI pipeline, developers

### 3.1 Guarantees

Type Safety Guard Script, when executed, guarantees:

✅ **Detects All Unsafe Patterns**

- `: any` type annotations
- `as any` type assertions
- `<any>` assertions (angle bracket syntax)
- `@ts-ignore` comments without justification
- False negatives: <1% (high detection accuracy)

✅ **Respects ALLOWED_ANY_EXCEPTIONS.json Registry**

- Violations in allow-list are not reported
- Expired entries (past sunsetDate) are reported as errors
- Exit code reflects allow-listed exceptions correctly

✅ **Performance**

- Completes in <30 seconds for full monorepo
- Scales linearly with codebase size
- Can process 1000+ files

✅ **Accurate Output**

- File paths are absolute and correct
- Line numbers are 1-indexed and correct
- Pattern classification accurate (regex + AST verified)
- Messages are clear and actionable

### 3.2 Requirements

Execution must:

✅ **Run successfully as part of CI**

```bash
bun type-safety-guard --json
# Exit code 0 = no violations
# Exit code 1 = violations found
```

✅ **Input files must be**

- Compilable TypeScript (Contract 1 must pass first)
- Includes all source files matching pattern
- Includes allow-list registries (ALLOWED_ANY_EXCEPTIONS.json)

✅ **Output format must be**

- Valid JSON (if --json flag used)
- Parseable by CI systems
- Include summary statistics
- Include detailed violations with remediation suggestions

### 3.3 Verification

**How to verify Contract 3 compliance**:

```bash
# Step 1: Run guard script
bun type-safety-guard --json > output.json

# Step 2: Verify exit code
[ $? -eq 0 ] && echo "Compliant" || echo "Violations found"

# Step 3: Verify output format
jq '.summary' output.json  # Should parse successfully

# Step 4: Check performance
jq '.metadata.executionTimeMs' output.json  # Should be < 30000
```

### 3.4 Dependencies

**Contract 3 depends on**:

- Contract 1 (Code must be compilable)
- Contract 2 (Biome must have provided comments)
- ALLOWED_ANY_EXCEPTIONS.json registries must exist and be valid
- TypeScript Compiler API available

**Contract 3 enables**:

- Contract 5 (CI Enforcement uses guard output)
- Contract 6 (Domain Layer Safety validation)

---

## Contract 4: Runtime Validation Layer

**Layer**: Layer 4  
**Provider**: packages/validation  
**Consumers**: API handlers, domain logic

### 4.1 Guarantees

Validation layer guarantees:

✅ **External Data Type Narrowing**

- Input: `unknown` (untrusted external data)
- Output: `T` (validated typed model)
- Conversion is safe and bidirectional

✅ **Validation Correctness**

- If validation succeeds, data conforms to schema
- If validation fails, error is raised before domain access
- Schema as source of truth

✅ **Performance Target**

- Validation latency <100ms per request
- Throughput >1000 validations/second
- No blocking operations

✅ **Error Information**

- Validation errors include:
  - Path to invalid field (e.g., `['user']['email']`)
  - Expected type/format
  - Actual value received
  - Suggested remedy

### 4.2 Requirements

Code must:

✅ **All external data typed as `unknown`**

```typescript
// Step 1: API response as unknown
const raw: unknown = await response.json();

// Step 2: Validate
const validated = UserSchema.parse(raw);

// Step 3: Use in domain
processUser(validated); // Type is now User
```

✅ **Define schemas for all external data types**

- API responses → ResponseSchema
- DB results → RowSchema
- Queue messages → MessageSchema
- Environment variables → EnvSchema
- File uploads → UploadSchema

✅ **No casting without validation**

```typescript
// ❌ NOT ALLOWED
const user = response as User;

// ✅ REQUIRED
const user = UserSchema.parse(response);
```

### 4.3 Verification

**How to verify Contract 4 compliance**:

```bash
# Step 1: Search for external data entry points
grep -r "unknown" apps/api/src

# Step 2: Verify each has corresponding validation
grep -A 5 "const raw: unknown" app/api/src

# Step 3: Verify no direct casting without validation
grep -r " as User\| as Admin\| as " apps/api/src | grep -v "parse"

# Step 4: Benchmark validation latency (should be <100ms)
npm run test:validation:performance
```

### 4.4 Dependencies

**Contract 4 depends on**:

- Validation schemas defined (Zod, custom, or equivalent)
- Entry points identified (API routes, DB queries, queue handlers)
- External data typing convention understood

**Contract 4 enables**:

- Type-safe domain logic (no `any` from external sources)
- Runtime error detection (bad API responses caught early)

---

## Contract 5: CI Enforcement

**Layer**: Layer 5  
**Provider**: GitHub Actions (.github/workflows/ci-type-safety.yml)  
**Consumers**: PR process, developers

### 5.1 Guarantees

CI pipeline guarantees:

✅ **Type Safety Checks Block Merge**

- PR with type errors cannot merge
- Merge button disabled until checks pass
- Clear remediation path shown

✅ **Comprehensive Checking**

- TypeScript compiler check (Contract 1)
- Guard script execution (Contract 3)
- Biome linting (Contract 2)
- Type coverage (optional)

✅ **Performance**

- Type safety job completes in <2 minutes
- Doesn't block other CI jobs
- Provides fast feedback

✅ **Clear Communication**

- CI comments on PR with:
  - Summary of violations
  - File + line numbers
  - Suggested fixes
  - Links to documentation

### 5.2 Requirements

CI must:

✅ **Run on every PR targeting main/staging**

```yaml
on:
  pull_request:
    branches: [main, staging]
```

✅ **Execute in order**:

1. `bun typecheck` (tsc --noEmit)
2. `bun type-safety-guard`
3. `biome lint --only=suspicious`

✅ **Create required status check**

```
Status: type-safety (required for merge)
```

✅ **Block merge if errors found**

- Exit code 1 from any check → PR merge blocked
- Developers must fix or request exception

### 5.3 Verification

**How to verify Contract 5 compliance**:

```bash
# Step 1: Create test PR with type error
git checkout -b test/type-error
echo "const x: any = {};" >> packages/api/src/test.ts
git commit -am "Add type error"
git push origin test/type-error

# Step 2: Create PR and observe
# CI job should run
# PR should show red X for type-safety check
# Merge button should be disabled

# Step 3: Fix violation
# Edit test.ts, remove the error
# Push fix

# Step 4: Observe PR recheck
# CI job reruns
# PR shows green for type-safety check
# Merge button enabled
```

### 5.4 Dependencies

**Contract 5 depends on**:

- Contract 1 (TypeScript compiler available)
- Contract 2 (Biome installed)
- Contract 3 (Guard script deployed)
- GitHub Actions workflow file created
- Required status check configured

**Contract 5 enforces**:

- Compliance with all upstream contracts
- Uniform enforcement across all contributors
- Hard boundary between unsafe and safe code

---

## Contract 6: Domain Layer Safety

**Layer**: Layer 6  
**Provider**: Guard script + ALLOWED_ANY_EXCEPTIONS.json registries  
**Consumers**: Domain packages, dependent packages

### 6.1 Guarantees

Domain Layer Safety guarantees:

✅ **Zero `any` in Protected Packages**

- `packages/domain-core`: zero `any`
- `packages/types`: zero `any`
- `packages/validation`: zero `any`
- Except for approve allow-listed exceptions

✅ **Exceptions are Managed Formally**

- Each exception has documented reason
- Each exception has sunset date (optional)
- Expired exceptions are flagged as errors
- Exceptions are version-controlled (audit trail)

✅ **Dependents Get Safe Types**

- Code importing from protected packages gets typed values
- No `any` propagation from foundation layers
- Can trust types throughout codebase

### 6.2 Requirements

Protected packages must:

✅ **Contain zero `any` by rule**

```bash
bun type-safety-guard --check-protected-packages
# Exit code 0 = no any in protected packages
```

✅ **If exception needed**:

1. Add to ALLOWED_ANY_EXCEPTIONS.json
2. Include business justification
3. Request architecture team approval
4. Set sunset date (recommend 6 months)

✅ **Registry must be valid**

```json
{
  "id": "unique-id",
  "file": "src/file.ts",
  "line": 42,
  "pattern": "explicit-any",
  "reason": "Business justification",
  "approver": "team-name",
  "addedDate": "2026-03-11T00:00:00Z",
  "sunsetDate": "2026-09-11T23:59:59Z",
  "status": "active"
}
```

### 6.3 Verification

**How to verify Contract 6 compliance**:

```bash
# Step 1: Run guard script with protected check
bun type-safety-guard --check-protected-packages --json

# Step 2: Verify output
# errorCount should be 0
# All violations should be in allowListedCount

# Step 3: Check for expired exceptions
# Query for status === "expired"
# If found, remediate within 1 week

# Step 4: Audit trail check
git log --oneline -- packages/domain-core/ALLOWED_ANY_EXCEPTIONS.json
# Should show approval process
```

### 6.4 Dependencies

**Contract 6 depends on**:

- Contract 3 (Guard script must support allow-lists)
- ALLOWED_ANY_EXCEPTIONS.json registries created for protected packages
- Approval workflow established

**Contract 6 enables**:

- Contract 7 (Boundary types can assume safe inputs from protected packages)

---

## Contract 7: Boundary-Typed Architecture

**Layer**: Layer 7  
**Provider**: Developers/AI agents implementing module interfaces  
**Consumers**: All packages that import from other packages

### 7.1 Guarantees

Boundary-typed architecture guarantees:

✅ **All Exports Have Explicit Types**

- Functions have return type annotations
- Parameters have type annotations
- Classes have property types
- Type variables are constrained

✅ **Type Inference Chains**

- Importing `foo` from `bar` gets explicit type
- IDE can show type on hover
- Type refactoring is safe for dependents

✅ **No Implicit `any` at Boundaries**

- Public APIs cannot use implicit any inference
- Generic parameters must be constrained
- No `as any` escapes at package boundary

### 7.2 Requirements

All exported symbols must:

✅ **Functions**: Explicit parameter + return types

```typescript
// ❌ NOT ALLOWED
export function getUser(id) {
  return db.find(id);
}

// ✅ REQUIRED
export function getUser(id: UserId): Promise<User> {
  return db.find(id);
}
```

✅ **Classes**: Type all properties + methods

```typescript
// ❌ NOT ALLOWED
export class UserService {
  find(id) { ... }
}

// ✅ REQUIRED
export class UserService {
  find(id: UserId): Promise<User> { ... }
}
```

✅ **Types**: Full type definitions

```typescript
// ❌ NOT ALLOWED
export interface User {
  id;
  name;
}

// ✅ REQUIRED
export interface User {
  id: UUID;
  name: string;
}
```

✅ **Generics**: Constrained parameters

```typescript
// ❌ NOT ALLOWED
export function map<T>(arr: T[], fn) {
  return arr.map(fn);
}

// ✅ REQUIRED
export function map<T, U>(arr: T[], fn: (x: T) => U): U[] {
  return arr.map(fn);
}
```

### 7.3 Verification

**How to verify Contract 7 compliance**:

```bash
# Step 1: Check each package's index.ts
cat packages/domain-core/src/index.ts

# Step 2: For each export, verify:
# - Functions have return type
# - Functions have parameter types
# - Classes have property types
# - No implicit inference

# Step 3: IDE verification
# Open packages/domain-core/src/index.ts
# Hover over each export
# Should see explicit type in tooltip

# Step 4: Type check
bun typecheck
# All exports should have explicit types
```

### 7.4 Dependencies

**Contract 7 depends on**:

- Contract 1 (Strict mode enables this requirement)
- Developer discipline to include explicit types
- Code review process to verify types

**Contract 7 enables**:

- Safe refactoring across package boundaries
- Reliable IDE assistance (code completion, navigation)
- Predictable type propagation

---

## Contract 8: AI Governance Rules

**Layer**: Layer 8  
**Provider**: .agents/skills/typescript-governance/SKILL.md  
**Consumers**: AI agents, code reviewers

### 8.1 Guarantees

AI Governance Rules guarantee:

✅ **Clear Guidance for AI Agents**

- AI agents receive explicit rules
- Decision trees help AI agents find unknown types
- Examples show patterns to use/avoid

✅ **Enforcement via CI**

- AI code passes same type-safety checks as human code
- No special exemptions for AI code
- Violations are caught immediately

✅ **Learning & Accountability**

- AI generated code can be reviewed for compliance
- Patterns can be analyzed and improved
- Failures are educational (agent learns patterns)

### 8.2 Requirements

AI agents must:

✅ **Follow the 5 Core Rules**

1. Avoid `any` unless absolutely necessary
2. Use `unknown` for external data
3. Validate runtime inputs
4. Use generics instead of dynamic typing
5. Follow type discovery decision tree

✅ **Produce Code That Passes**

- Contract 1 (TypeScript compiler)
- Contract 2 (Biome linting)
- Contract 3 (Guard script)
- Contract 7 (Boundary types)

✅ **Document Type Decisions**

- Include type reasoning in commit messages
- Reference decision tree if applicable
- Explain any deviations from rules

### 8.3 Verification

**How to verify Contract 8 compliance**:

```bash
# Step 1: AI generates code
# AI agent follows SKILL.md rules

# Step 2: Code is pushed in PR
# CI runs (Contracts 1-5)

# Step 3: Code review
# Reviewer checks:
# - Does code follow 5 core rules?
# - Are external data validated?
# - Are boundaries typed?
# - Is type reasoning clear?

# Step 4: If violations found
# Agent must fix and re-submit
# Process repeats until compliant
```

### 8.4 Dependencies

**Contract 8 depends on**:

- Contracts 1-7 (CI enforcement validates AI code)
- SKILL.md documentation exists
- Examples are clear and applicable
- Decision trees are provided

**Contract 8 enables**:

- AI agents can contribute type-safe code
- Human code review can focus on logic (types are machine-verified)
- Codebase quality improves with AI assistance

---

## Contract Compliance Checklist

For a feature or PR to be accepted, all applicable contracts must be satisfied:

| Contract | Requirement            | Verification                           | Blocker               |
| -------- | ---------------------- | -------------------------------------- | --------------------- |
| 1        | `bun typecheck` passes | `bun typecheck` exit 0                 | ✅ YES                |
| 2        | `biome lint` passes    | `biome lint --only suspicious` exit 0  | ✅ YES                |
| 3        | Guard script OK        | `bun type-safety-guard` has no errors  | ✅ YES                |
| 4        | Validation used        | Code review + grep validation schemas  | ✅ YES                |
| 5        | CI passes              | Green check on all type checks         | ✅ YES                |
| 6        | Exceptions managed     | ALLOWED_ANY_EXCEPTIONS.json valid      | ✅ YES                |
| 7        | Boundaries typed       | All exports have explicit types        | ✅ YES                |
| 8        | AI rules followed      | Code review confirms (if AI-generated) | ⚠️ NO (informational) |

**All YES contracts must pass; NO contracts are checked via code review.**
