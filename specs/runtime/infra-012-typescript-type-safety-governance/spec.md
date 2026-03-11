# TypeScript Type Safety Governance - Specification

## Feature Overview

**Feature Name**: TypeScript Type Safety Governance Layer

**Phase**: 01_PLATFORM_FOUNDATION

**Stage**: STAGE_INFRA_12_TYPESCRIPT_TYPE_SAFETY_GOVERNANCE

**Branch**: spec/infra-012-typescript-type-safety-governance

**Stage File**: [specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_12_TYPESCRIPT_TYPE_SAFETY_GOVERNANCE.md](../../phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_12_TYPESCRIPT_TYPE_SAFETY_GOVERNANCE.md)

---

## Constitutional Compliance Declaration

**Subject**: Infrastructure Governance - Type Safety System

**Components Affected**:

- ❌ Isolation (no cross-tenant changes)
- ❌ License enforcement (no license changes)
- ❌ Attempt engine (no attempt engine changes)
- ❌ Worker (governance only, no worker logic changes)
- ❌ Runtime (governance only, no runtime changes)
- ❌ Frontoffice (governance only, no UI logic changes)

**Compliance Status**:

This feature is a **governance layer only**—it introduces no new database tables, does not access tenant data, does not modify grading logic, does not instantiate databases, and does not weaken any architectural boundaries.

Type safety governance is **purely a compile-time and CI-time enforcement mechanism** with no runtime execution impact.

**Declaration**: ✅ **Fully Compliant with Zidney Constitution v1.2.0 — No violations detected.**

---

## Problem Statement

### The Risk: Unsafe Types in AI-Assisted Development

Zidney operates in an **AI-assisted development environment** where both human developers and AI agents contribute code. This environment creates unique type safety risks:

**The Problem**:

- AI agents can silently introduce unsafe TypeScript constructs (`any`, `as any`, `@ts-ignore`, implicit `any`) without triggering compile errors
- These unsafe constructs disable TypeScript's type guarantees, allowing runtime errors to slip into production
- The **"viral any" problem**: A single `any` can propagate through the codebase, infecting module boundaries and making refactoring unsafe
- Without governance, AI contributions can introduce latent runtime bugs that surface only in production

**Root Cause**:

- TypeScript's `any` type is intentionally permissive to enable rapid development
- Current tooling (tsc, ESLint) provides insufficient enforcement for critical packages
- No systematic, automated detection of unsafe patterns across the entire monorepo
- Lack of CI-time enforcement means unsafe code can merge into primary branches

**Impact if Unsolved**:

- Runtime type errors leak into production despite TypeScript compilation
- IDE intelligence becomes unreliable when navigating code with `any` boundaries
- Refactoring becomes unsafe—developers cannot trust that type changes are propagated correctly
- Maintenance costs increase as developers spend time debugging runtime errors that should have been caught at compile time
- AI-assisted development becomes a source of architectural decay rather than acceleration

---

## Solution Overview

Zidney solves this problem with a **multi-layered Type Safety Governance System** that enforces strict typing across the monorepo at compile-time, lint-time, and CI-time.

The system consists of **8 interdependent enforcing layers**:

1. **TypeScript Compiler Rules** — Strict mode configuration that makes unsafe constructs compiler errors
2. **Biome Lint Enforcement** — Linter rules that catch `any` and `@ts-ignore` and require justification comments
3. **Type Safety Guard Script** — Custom automation that scans for unsafe patterns before CI
4. **Runtime Validation Layer** — Validation infrastructure that converts external data from `any` to strictly typed
5. **CI Enforcement** — CI pipeline checks that block unsafe TypeScript from merging
6. **Domain Layer Safety** — 100% type integrity requirement for critical packages
7. **Boundary-Typed Architecture** — All public APIs must be fully typed at boundaries
8. **AI Governance Rules** — Rules for AI agents to follow when contributing code

These layers work **in combination**—each layer covers blind spots in the others. Code cannot be unsafe to just one layer.

---

## Functional Requirements

### FR1: Strict TypeScript Compiler Configuration

**Requirement**: Enable TypeScript strict mode and related compiler options.

**Details**:

- Set `strict: true` in `tsconfig.json` (enables all strict checks)
- Enable `noImplicitAny: true` (implicit `any` triggers error)
- Enable `noUncheckedIndexedAccess: true` (array/object access must be type-safe)
- Enable `exactOptionalPropertyTypes: true` (optional fields enforced strictly)
- Enable `noPropertyAccessFromIndexSignature: true` (index signature access restricted)

**Acceptance Criteria**:

- `bun typecheck` runs without errors on the entire monorepo
- Implicit `any` anywhere in the codebase causes `tsc` to fail
- Type errors cannot be silently ignored
- All existing code must pass strict mode

**Why It Works**:
Strict mode converts unsafe typing from a lint-time warning to a compile-time error. AI agents cannot write code that passes `bun typecheck` if it contains implicit `any`.

---

### FR2: Biome Lint Rules for Explicit `any` Detection

**Requirement**: Configure Biome linter to prevent explicit `any` and `@ts-ignore` without justification.

**Details**:

- Enable `suspicious/noExplicitAny` rule
- Forbid `@ts-ignore` comments unless they include a specific justification
- Restrict unsafe type assertion patterns (`as any`, `<any>`, etc.)

**Allowed Exception Pattern**:

```typescript
// biome-ignore lint/suspicious/noExplicitAny -- third-party SDK (ExternalLib v2.1.0) has no type definitions; see https://github.com/externallib/issue-123
const sdk: any = window.ExternalSDK;
```

**Acceptance Criteria**:

- Explicit `any` without justification comment causes lint failure
- Justification comment must explain _why_ `any` is necessary and reference external constraint
- Comments referencing missing type definitions must include library name and version
- Developers cannot suppress rules without explicit justification
- AI agents cannot auto-generate code with `any`

**Why It Works**:
This layer catches explicit uses of `any` that bypass TypeScript's type inference. By requiring justification, it creates accountability and forces developers to document why safety is being traded for convenience.

---

### FR3: Type Safety Guard Script

**Requirement**: Create `scripts/type-safety-guard.ts` to automatically detect unsafe patterns.

**Details**:
The script scans all TypeScript files in the monorepo for patterns:

- `: any` (explicit any type annotation)
- ` as any` (type assertion to any)
- `<any>` (angle-bracket assertion to any)
- `@ts-ignore` comments (type error suppression)

For each violation found, the script outputs:

- File path
- Line number
- Pattern detected
- Suggestion for remediation

**Execution**:

- Runs during `bun typecheck` CI step
- Runs as pre-commit hook (optional for developers, enforced in CI)
- Can be triggered manually: `bun type-safety-guard`

**Exit Code Behavior**:

- Exit code 0 if no violations found
- Exit code 1 if violations found (CI failure)
- Optional `--allow-list` flag to suppress known-safe violations

**Acceptance Criteria**:

- Script detects all patterns listed above in any file
- Detects violations in node_modules (excluded by default)
- Output is parseable by CI systems (GitHub Actions, GitLab CI, etc.)
- Performance: runs in <30 seconds for full monorepo scan
- Script includes unit tests for each pattern type

**Why It Works**:
This layer provides custom detection logic that generic linters might miss. It's specialized for Zidney's specific safety guarantees and can be updated as new unsafe patterns emerge.

---

### FR4: Runtime Validation Layer

**Requirement**: Establish a validation layer that converts external data from `unknown` to strictly typed domain models.

**Details**:

- Use existing `packages/validation` module
- All external data must be typed as `unknown` at entry points:
  - API response payloads from external services
  - Database query results
  - Message queue payloads
  - Environment variables
- Data must be validated using schemas before use in domain logic

**Validation Pattern**:

```typescript
// ❌ Forbidden
const user = apiResponse.data as User;

// ✅ Required
import { UserSchema } from "@zidney/validation";
const user = UserSchema.parse(apiResponse.data);
```

**Integration Points**:

- API client layer (validates responses before returning to domain)
- Database query layer (validates results before returning to domain)
- Message queue consumer (validates payloads before processing)
- Environment variable parser (validates and types env vars)

**Acceptance Criteria**:

- No code paths accept external data typed as domain models directly
- All external data entry points use validation schemas
- Type inference forces unknown → validated type conversion
- Validation errors are caught before reaching business logic
- Validation rules are maintainable and extensible

**Why It Works**:
This layer prevents the `any`/casting problem from occurring at runtime. Even if external APIs change their response shape, the validation layer catches mismatches before corrupted data reaches the domain.

---

### FR5: CI Type Safety Enforcement

**Requirement**: Block unsafe TypeScript from merging into protected branches.

**Details**:

- Add `bun typecheck` to pre-merge CI pipeline
- CI must fail if:
  - Type errors exist
  - Type safety guard script finds violations
  - Type coverage falls below 98%
- CI checks apply to all PRs targeting main/staging branches

**CI Steps** (in order):

1. Run `bun typecheck` (tsc --noEmit)
2. Run type safety guard script
3. Run `npx type-coverage` (if enabled, optional)

**Acceptance Criteria**:

- PRs cannot merge if type errors exist
- Type safety violations appear in PR checks
- CI reports include remediation suggestions
- False positives can be managed via allow-list
- Type check completes in CI within acceptable time bounds (< 2 minutes)

**Why It Works**:
CI enforcement creates a hard boundary between unsafe code and protected branches. Even if developers disable local checks, CI blocks unsafe code from merging.

---

### FR6: Domain Layer Safety — 100% Type Integrity

**Requirement**: Enforce zero `any` in critical domain packages.

**Details**:
Protected packages (100% type integrity required):

- `packages/domain-core` — Core business logic models and rules
- `packages/types` — Type definitions and domain types
- `packages/validation` — Validation and schema definitions

**Enforcement**:

- Type safety guard script flags any `any` in protected packages as critical violations
- CI fails if protected packages contain `any`
- Code review process requires justification for any exception (requires ADR)

**Exceptions**:

- Exceptions must be explicitly documented in an ADR
- Exception must include business justification and timeline for remediation
- Exceptions are tracked separately for periodic review

**Acceptance Criteria**:

- `bun type-safety-guard` reports zero `any` in protected packages
- All legitimate use of `unknown` (pre-validation) is correctly distinguished from `any`
- Build fails if protected packages violate 100% type integrity

**Why It Works**:
Critical packages form the foundation of all domain logic. By maintaining 100% type integrity in these packages, all code that depends on them gets reliable types for free. Type errors in dependencies surface immediately to dependents.

---

### FR7: Boundary-Typed Architecture

**Requirement**: All public API boundaries must be fully typed (no implicit inference of public API return types).

**Details**:
For all exported functions and classes:

- Explicit return type annotations required
- Parameter types must be explicitly annotated (no implicit `any`)
- Generic parameters must be constrained when needed

**Rules by Module Boundary**:

- API Controllers: All endpoints must have typed request/response schemas
- Domain Functions: All exported functions must have explicit input/output types
- Repository Interfaces: All query methods must return explicitly typed results
- Message Handlers: All message consumers must validate and type input payloads
- Service Interfaces: All service methods must have explicit contracts

**Example Pattern**:

```typescript
// ❌ Implicit inference (not allowed)
export function getUser(id) {
  return db.query("SELECT * FROM users WHERE id = ?", [id]);
}

// ✅ Explicit boundaries (required)
export function getUser(id: UserId): Promise<User> {
  return db.query<User>("SELECT * FROM users WHERE id = ?", [id]);
}
```

**Acceptance Criteria**:

- All module boundaries have explicit type annotations
- Type inference cannot be relied on for public APIs
- IDE shows explicit types for all exported symbols
- Refactoring tools can safely update types across boundaries

**Why It Works**:
Typing boundaries prevents `any` from propagating through the codebase. If a module's interface is typed, its dependents inherit those type guarantees automatically.

---

### FR8: AI Governance Rules for Type Safety

**Requirement**: Define and enforce type safety rules for AI-assisted development.

**Details**:
AI agents must follow type safety rules when contributing code to Zidney:

**Rule 1 — Avoid `any`**

- AI must not introduce `any` unless absolutely necessary
- Pattern: Use generics or conditional types instead of `any`

**Rule 2 — Use `unknown` for External Data**

- External data (API responses, DB results, etc.) must be typed as `unknown`
- `unknown` forces explicit validation before use

**Rule 3 — Validate Runtime Inputs**

- Before using external data in domain logic, validate it against schemas
- Use `UserSchema.parse(data)` not `data as User`

**Rule 4 — Use Generics Instead of Dynamic Typing**

- Pattern: `T extends Validator` instead of `any extends Validator`
- Preserves type information through transformations

**Rule 5 — Required Search Path for Unknown Types**
If AI cannot determine a type:

1. Search the repository for similar patterns
2. Inspect `packages/types` for existing type definitions
3. Inspect `packages/domain-core` for model definitions
4. Only then may AI introduce a temporary placeholder type with a TODO comment

**Enforcement**:

- Type safety guard script blocks AI-generated code with violations
- CI fails if AI introduces unsafe patterns
- Code review process includes type safety verification

**Acceptance Criteria**:

- AI-generated code passes all type safety checks
- AI agents document their type discovery process in commit messages
- AI agents respect 100% type integrity in protected packages
- AI contributions maintain or improve overall code type coverage

**Why It Works**:
By establishing explicit rules for AI agents, we align AI behavior with the type safety governance system. AI agents become force multipliers for type safety rather than detractors from it.

---

## Non-Functional Requirements

### NFR1: Performance

**Type Checking Performance**:

- `bun typecheck` completes in < 90 seconds on full monorepo (average development machine)
- Type safety guard script completes in < 30 seconds
- CI type check step completes in < 2 minutes
- Developer IDE response time for type inference: < 500ms
- Zero performance regression compared to pre-governance baseline

**Why It Matters**:
Fast feedback loops are critical for developer experience. If type checking is slow, developers will disable it locally, undermining the governance system.

---

### NFR2: Developer Experience (DX)

**Error Messages**:

- Type error messages are clear and actionable
- Guard script violations include remediation suggestions
- Lint errors suggest specific fixes where possible

**Documentation**:

- Type safety rules are documented with examples
- AI Governance rules are published and version-controlled
- Common patterns are collected in runbooks

**Exceptions**:

- Developers can use `biome-ignore` comments with justification
- Allow-list mechanism exists for known-safe but technically unsafe code
- Exception process is lightweight and doesn't impede legitimate use

**Why It Matters**:
Governance systems are only effective if developers understand and buy into them. Poor DX leads to shadow suppression of warnings and erosion of governance.

---

### NFR3: Maintainability

**Rules Centralization**:

- All type safety rules defined in one place (`.agents/skills/typescript-governance/` and `tsconfig.json`)
- Biome rules defined in `biome.json`
- Guard script logic defined in `scripts/type-safety-guard.ts`

**Auditing**:

- Type safety status can be audited at any time
- Historical trends can be tracked (type coverage over time)
- Violations can be searched across the codebase

**Why It Matters**:
Distributed rules become impossible to maintain. Centralizing governance makes it easier to update rules as patterns evolve.

---

### NFR4: Compatibility

**Backward Compatibility**:

- Strict TypeScript mode enables incrementally—legacy code can use allow-list
- Biome rules include exceptions for third-party code
- Guard script allows documented exceptions

**Forward Compatibility**:

- Rules can be extended without breaking existing code
- New patterns can be added to guard script as needed
- AI governance rules can evolve with agent capabilities

**Why It Matters**:
Greenfield strict typing is easy; maintaining it across an existing codebase requires gradualism and explicit exception handling.

---

## Scope

### In Scope

✅ TypeScript strict mode configuration  
✅ Biome lint rules for type safety  
✅ Type safety guard script execution  
✅ Runtime validation layer integration  
✅ CI/CD type safety checks  
✅ Domain layer type integrity enforcement  
✅ Boundary-typed architecture validation  
✅ AI governance rules definition  
✅ Type coverage reporting (optional)  
✅ Documentation of type safety rules  
✅ Exception handling and allow-lists

### Out of Scope

❌ Retrofitting all existing code to strict mode (done incrementally, with exceptions)  
❌ Type-checking node_modules (skipped by default)  
❌ Runtime type validation instrumentation (done at layer entry points only)  
❌ Publishing types for external consumers (internal use only)  
❌ IDE plugin development for type safety visualizations  
❌ Automatic type inference from tests

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Type Safety Governance System                 │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│ Layer 1: TypeScript Compiler Rules (tsconfig.json)               │
│ └─ strict mode, noImplicitAny, noUncheckedIndexedAccess, etc.    │
│ └─ Output: Compile-time errors for unsafe constructs            │
└──────────────────────────────────────────────────────────────────┘
                                 ▲
                                 │
┌──────────────────────────────────────────────────────────────────┐
│ Layer 2: Biome Lint Enforcement (biome.json)                     │
│ └─ noExplicitAny, forbid @ts-ignore without justification        │
│ └─ Output: Lint-time violations with remediation suggestions     │
└──────────────────────────────────────────────────────────────────┘
                                 ▲
                                 │
┌──────────────────────────────────────────────────────────────────┐
│ Layer 3: Type Safety Guard Script (scripts/type-safety-guard.ts) │
│ └─ Scans for `:any`, `as any`, `<any>`, `@ts-ignore`            │
│ └─ Output: Detailed violation report with file/line/reason       │
└──────────────────────────────────────────────────────────────────┘
                                 ▲
                                 │
┌──────────────────────────────────────────────────────────────────┐
│ Layer 4: Runtime Validation Layer (packages/validation)          │
│ └─ Converts `unknown` external data to validated types           │
│ └─ Output: Type-safe domain models from untrusted input          │
└──────────────────────────────────────────────────────────────────┘
                                 ▲
                                 │
┌──────────────────────────────────────────────────────────────────┐
│ Layer 5: CI Enforcement (CI Pipeline)                            │
│ └─ Runs typecheck + guard + type-coverage checks                 │
│ └─ Output: PR merge gates blocks unsafe code                     │
└──────────────────────────────────────────────────────────────────┘
                                 ▲
                                 │
┌──────────────────────────────────────────────────────────────────┐
│ Layer 6: Domain Layer Safety (packages: domain-core, types, val) │
│ └─ 100% type integrity requirement for critical packages         │
│ └─ Output: No `any` in foundation packages                       │
└──────────────────────────────────────────────────────────────────┘
                                 ▲
                                 │
┌──────────────────────────────────────────────────────────────────┐
│ Layer 7: Boundary-Typed Architecture (All Module Boundaries)     │
│ └─ Explicit types on all exported functions/classes              │
│ └─ Output: Reliable type inference for all dependents            │
└──────────────────────────────────────────────────────────────────┘
                                 ▲
                                 │
┌──────────────────────────────────────────────────────────────────┐
│ Layer 8: AI Governance Rules (.agents/skills/typescript-gov)     │
│ └─ Rules for AI agents when contributing code                    │
│ └─ Output: AI-generated code meets all governance requirements   │
└──────────────────────────────────────────────────────────────────┘


Data Flow — External Input to Domain Boundary:

  External System          Entry Point              Domain Layer
  ┌──────────────┐    ┌─────────────────┐    ┌──────────────────┐
  │   API/DB/    │───▶│ unknown (typed) │───▶│   Validated      │
  │   Queue      │    │ via Validation  │    │   Typed Model    │
  │              │    │ Layer (Fr4)     │    │   (100% safe)    │
  └──────────────┘    └─────────────────┘    └──────────────────┘
                            ▲                         ▲
                            │                         │
                       Validation                  Boundary
                       (Layer 4)                   Types
                                                  (Layer 7)
```

---

## Dependencies

### Internal Dependencies

**Packages**:

- `packages/validation` — Used for runtime validation of external data
- `packages/types` — Type definitions (protected domain package)
- `packages/domain-core` — Domain models (protected domain package)
- `packages/logger` — For typed logging in validation layer

**Scripts**:

- `scripts/type-safety-guard.ts` — New script created by this stage
- `tsconfig.json` — Modified to enable strict mode (shared)
- `biome.json` — Modified to add type safety linter rules (shared)

### External Dependencies

**Tooling**:

- `TypeScript` (bun runtime includes TypeScript) — Type checking
- `Biome` (already installed) — Linting
- `type-coverage` (optional, npm package) — Type coverage reporting

**Standards**:

- TypeScript Compiler API — For AST analysis in guard script
- ES2020+ TypeScript features — For guard script implementation

### Monorepo Services

**CI/CD Integration**:

- GitHub Actions (or equivalent CI system) — Runs type safety checks
- Pre-commit hooks (Husky) — Optional local enforcement

**Does NOT depend on**:

- ❌ Any database changes
- ❌ Any API changes
- ❌ Any worker changes
- ❌ Frontoffice changes
- ❌ License enforcement changes
- ❌ Attempt engine changes

---

## Implementation Tasks Mapped to Requirements

| Task | Requirement | Description                                               |
| ---- | ----------- | --------------------------------------------------------- |
| T001 | FR1         | Enable strict TypeScript configuration in tsconfig.json   |
| T002 | FR2         | Add Biome rules preventing explicit `any`                 |
| T003 | FR3         | Create `scripts/type-safety-guard.ts` script              |
| T004 | FR5         | Integrate guard into CI pipeline                          |
| T005 | FR4         | Ensure runtime validation layer is used for external data |
| T006 | FR7         | Enforce typed module boundaries across monorepo           |
| T007 | FR8         | Document and implement AI governance rules                |
| T008 | FR5         | Add optional type coverage reporting to CI                |

---

## Success Criteria

### SC1: TypeScript Strict Mode Successfully Enabled

**Measurement**:

- `bun typecheck` runs without errors
- `noImplicitAny` is true in tsconfig.json
- All build pipelines run `bun typecheck` successfully

---

### SC2: Biome Prevents Unsafe Typing

**Measurement**:

- `biome lint` fails on code with explicit `any` without justification
- `biome lint` fails on `@ts-ignore` without justification
- Zero explicit `any` violations found in protected packages

---

### SC3: Guard Script Detects Violations

**Measurement**:

- `bun type-safety-guard` successfully detects `:any`, `as any`, `<any>`, `@ts-ignore`
- Script runs in < 30 seconds
- Script output is parseable by CI systems

---

### SC4: CI Blocks Unsafe TypeScript from Merging

**Measurement**:

- Type safety checks appear in all PR checks
- PRs with type errors are not mergeable
- CI reports include clear remediation guidance

---

### SC5: External Data is Runtime Validated

**Measurement**:

- All external data entry points use validation layer
- Type inference shows `unknown` before validation
- Developers cannot use external data without validation

---

### SC6: Domain Layer Maintains 100% Type Integrity

**Measurement**:

- Protected packages (`domain-core`, `types`, `validation`) contain zero `any`
- Type safety guard script detects any violations immediately
- Zero exceptions needed for protected packages

---

### SC7: Boundary-Typed Architecture Enforced

**Measurement**:

- All exported functions have explicit return type annotations
- All API endpoints have typed request/response schemas
- IDE shows explicit types for all public APIs

---

### SC8: AI Governance Rules Established

**Measurement**:

- AI governance rules documented in `.agents/skills/typescript-governance/`
- AI agents follow type safety rules when contributing
- No AI-generated code contains unsafe type patterns

---

## Assumptions

1. **Existing Code Alignment**: Existing code in the monorepo can be brought into compliance with strict mode through iterations and targeted refactoring (not all at once)

2. **Third-Party SDK Exception**: Some third-party SDKs lack TypeScript definitions; using `any` for these is acceptable with documented justification

3. **Validation Layer Availability**: `packages/validation` already exists and provides schema validation capabilities; no new validation framework needed

4. **CI/CD Infrastructure**: GitHub Actions (or equivalent CI system) is available and can run custom scripts; no CI infrastructure changes needed

5. **Team Buy-In**: Developers understand and accept type safety governance as a core project value; enforcement is not perceived as obstruction

6. **Tooling Stability**: TypeScript, Biome, and type-coverage tools are stable and actively maintained; version pins are respected

---

## Success Validation

### How to Validate Each Layer

**Layer 1 — TypeScript Compiler**:

```bash
bun typecheck
# Expected: Zero type errors
```

**Layer 2 — Biome Linting**:

```bash
biome lint
# Expected: Zero explicit `any` violations in protected packages
```

**Layer 3 — Guard Script**:

```bash
bun type-safety-guard
# Expected: Zero violations detected
```

**Layer 4 — Runtime Validation**:

```bash
# Inspect code paths accepting external data
grep -r "unknown" packages/api-client/src
# Expected: All external responses typed as unknown before validation
```

**Layer 5 — CI Enforcement**:

```bash
# Check PR merge requirements
# Expected: Type safety checks appear in required status checks
```

**Layer 6 — Domain Layer Safety**:

```bash
bun type-safety-guard --check-protected-packages
# Expected: Zero `any` in domain-core, types, validation
```

**Layer 7 — Boundary Types**:

```typescript
// Check exported symbols
import * as api from "@zidney/api-client";
// Expected: IDE shows explicit types for all exports
```

**Layer 8 — AI Governance**:

```bash
# Review AI-generated PR
# Expected: No type safety violations in code review
```

---

## Rollback Strategy

Type safety governance is a **one-way system**—it should not be rolled back once enabled.

**Why**:

- Once strict mode is enabled, code written against it depends on its guarantees
- Rolling back would introduce new unsafe patterns into code that was type-safe under strict mode
- Enforcement provides value immediately; disabling it removes that value

**If Critical Issues Arise**:

1. **Temporary Exception via Allow-List**: Add specific violations to allow-list temporarily
   - Allows merging PRs while maintaining governance framework
   - Document reason for exception
   - Set timeline for remediation

2. **Rule Relaxation**: Relax specific rules (e.g., allow `@ts-ignore` without justification) if pattern emerges as legitimate
   - Requires team discussion and documentation
   - Should be rare

3. **Complete Removal** (not recommended): Would require:
   - Team consensus that type safety governance provides no value
   - Migration plan to remove type safety infrastructure
   - Update to all AI governance rules
   - This is **not expected** to occur

---

## Documentation Requirements

### Required Documentation

1. **Type Safety Rules Handbook**
   - Explain each of the 8 layers
   - Provide examples of compliant and non-compliant code
   - Explain the "why" behind each rule

2. **AI Governance Rules Document**
   - Detailed rules for AI agents contributing to Zidney
   - Examples of type-safe vs. unsafe patterns from AI perspective
   - Decision tree for resolving type unknowns

3. **Exception Handling Guide**
   - How to request `biome-ignore` exception
   - How to add code to allow-list
   - The exception review process

4. **Runbooks**
   - "How to fix type errors" guide
   - "How to validate external data" pattern guide
   - "How to type a new API endpoint" example

### Required Artifacts

- `tsconfig.json` — Updated with strict mode configuration
- `biome.json` — Updated with type safety linter rules
- `scripts/type-safety-guard.ts` — New guard script
- `.agent/skills/typescript-governance/SKILL.md` — AI governance rules
- `docs/type-safety/` directory — All type safety documentation

---

Compliant with Zidney Constitution v1.2.0 — No violations detected.
