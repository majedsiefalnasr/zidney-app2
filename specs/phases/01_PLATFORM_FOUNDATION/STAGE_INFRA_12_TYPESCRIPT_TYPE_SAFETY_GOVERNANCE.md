# STAGE_INFRA_12_TYPESCRIPT_TYPE_SAFETY_GOVERNANCE

Phase: 01_PLATFORM_FOUNDATION Type: Infrastructure Governance Stage Purpose: Enforce strict
TypeScript safety rules across the Zidney monorepo and prevent unsafe typing patterns—especially
those introduced by AI-assisted development.

---

## Stage Status

Status: DRAFT
Step: tasks
Risk Level: LOW
Last Updated: 2026-03-11T16:00:00Z

Tasks Generated:

- Total: 48 atomic tasks
- MVP (Layers 1+5): 14 tasks (Phase 0) — 40 hours estimated, 1-2 weeks delivery
- Post-MVP (Layers 2-8): 34 tasks (Phases 1-7) — 150 hours estimated, deferred until MVP stable
- Parallel Opportunities: 28 tasks can run concurrently (type fixes, CI setup, documentation)
- Test Scenarios: 5 comprehensive test scenarios mapped to governance layers

Task Breakdown by Layer:

- Foundation: 2 setup tasks
- Layer 1 (TypeScript Strict): 8 tasks → tsconfig.json strict mode + type fixes
- Layer 5 (CI Enforcement): 6 tasks → GitHub Actions CI gate for typecheck + guard + biome
- Layer 3 (Guard Script): 6 tasks [deferred]
- Layer 6 (Domain Layer): 5 tasks [deferred]
- Layer 4 (Validation): 4 tasks [deferred]
- Layer 2 (Biome Lint): 3 tasks [deferred]
- Layer 7 (Boundary Typing): 6 tasks [deferred]
- Layer 8 (AI Governance): 3 tasks [deferred]
- Documentation: 7 tasks [deferred]

Deferred Scope:

- Layers 2-4 (post-MVP Phase 2) — 27 tasks
- Layers 6-8 (post-MVP Phase 3) — 7 tasks

Constitutional Compliance:

- Task set compliant — drift analysis required before implementation
- All 48 tasks respect type safety governance scope
- Sequential layer dependencies enforced
- MVP path clear and unblocked

Notes:
Atomic task set generated. Drift analysis gate pending.

---

# Objective

Establish a **Type Safety Governance Layer** that guarantees:

- No unsafe `any` propagation
- Strict typing at module boundaries
- Runtime validation of external data
- Automated detection of unsafe TypeScript constructs
- CI enforcement of type safety

This stage transforms TypeScript from a developer convenience into a **core architectural
enforcement mechanism**.

---

# Problems This Stage Solves

AI-assisted development often introduces unsafe constructs such as:

- `any`
- `as any`
- `@ts-ignore`
- implicit `any`
- unsafe casting of external data

These constructs disable the TypeScript compiler’s guarantees and allow runtime errors to leak into
production.

Without governance, `any` spreads through the codebase (“viral any problem”).

This stage introduces **systematic prevention**.

---

# Governance Architecture

Type safety is enforced through multiple layers.

1. TypeScript Compiler Rules
2. Biome Lint Enforcement
3. Type Safety Guard Script
4. Runtime Validation Layer
5. CI Enforcement
6. AI Governance Rules

All layers must pass for a commit or PR to succeed.

---

# Layer 1 — Strict TypeScript Compiler Configuration

Update `tsconfig.json` to enforce strict safety.

Required configuration:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noPropertyAccessFromIndexSignature": true
  }
}
```

Key guarantees:

- Implicit `any` becomes a compile error
- Optional fields are strictly enforced
- Unsafe property access is blocked

---

# Layer 2 — Biome Lint Enforcement

Biome enforces lint rules that TypeScript alone cannot guarantee.

Required rules:

- `noExplicitAny`
- forbid `@ts-ignore`
- restrict unsafe assertions

Example allowed exception:

```ts
// biome-ignore lint/suspicious/noExplicitAny -- third-party SDK has no type definitions
const sdk: any = window.ExternalSDK;
```

Rule:

Explicit `any` must always include a justification comment.

---

# Layer 3 — Type Safety Guard

Create script:

```
scripts/type-safety-guard.ts
```

Purpose:

Automatically detect unsafe TypeScript constructs.

The guard scans for:

- `: any`
- `as any`
- `<any>`
- `@ts-ignore`

Example violation output:

```
Type Safety Violation
File: packages/api-client/src/client.ts
Line: 42
Reason: explicit any detected
```

CI must fail if violations exist.

---

# Layer 4 — Boundary-Typed Architecture

Zidney adopts **Boundary-Typed Architecture**.

Rules:

All module boundaries must be fully typed.

This includes:

- exported functions
- API responses
- domain models
- repository interfaces

Example:

```ts
export function getUser(id: UserId): Promise<User>;
```

Never rely on implicit inference for public APIs.

---

# Layer 5 — Runtime Validation

External data must be validated at **API entry point or service boundary** before entering the domain layer.

**Validation Ownership Model:**

- **Endpoint team** owns schema definition for their domain
- **Central validation team** owns enforcement infrastructure (`packages/validation`)

External sources include:

- API responses (validated at HTTP boundary)
- database results (validated at repository layer)
- message queues (validated at worker entry point)
- environment variables (validated at service initialization)

External data must be typed as:

```
unknown
```

Then validated using the validation layer.

Validation package:

```
packages/validation
```

Example:

```ts
const user = UserSchema.parse(data);
```

Forbidden pattern:

```
const user = data as User
```

**Performance Targets:**

- Critical paths (exam submission, grading, question retrieval) must achieve <100ms additional latency from validation
- Non-critical paths: validation overhead acceptable up to <500ms
- Measure and baseline validation overhead on current critical submission path

---

# Layer 6 — Domain Layer Safety

Critical domain packages must never contain `any`.

Protected packages:

```
packages/domain-core
packages/types
packages/validation
```

These packages must maintain **100% type integrity**.

---

# Layer 7 — CI Type Safety Enforcement

CI must run:

```
bun typecheck
```

Equivalent to:

```
tsc --noEmit
```

PRs must fail if type errors occur.

Optional additional enforcement:

```
npx type-coverage
```

Target coverage:

```
>= 98%
```

---

# Layer 8 — AI Governance

AI must follow the rules defined in:

```
.agents/skills/typescript-governance
```

AI must:

- avoid `any`
- use `unknown` for external data
- validate runtime inputs
- use generics instead of dynamic typing

If AI cannot determine a type it must:

1. search the repository
2. inspect `packages/types`
3. inspect `domain-core` models

Only then may it introduce a temporary placeholder type.

---

# Implementation Tasks

T001 — Enable strict TypeScript configuration

T002 — Add Biome rules preventing explicit `any`

T003 — Create `scripts/type-safety-guard.ts`

T004 — Integrate guard into CI pipeline

T005 — Add runtime validation enforcement

T006 — Enforce typed module boundaries

T007 — Update AI governance rules

T008 — Add optional type coverage reporting

---

# Testing Strategy

Test the guard system with intentional violations.

Examples:

Test case 1 — explicit any

```
const value: any = "test"
```

Expected result:

CI failure.

Test case 2 — unsafe cast

```
const user = data as User
```

Expected result:

CI failure.

Test case 3 — validated data

```
const user = UserSchema.parse(data)
```

Expected result:

Pass.

---

# Success Criteria

The stage is complete when:

- TypeScript strict mode enabled
- Biome prevents unsafe typing
- Guard script detects violations
- CI blocks unsafe TypeScript
- External data is validated
- Domain layer contains zero `any`

---

# Long-Term Impact

After this stage:

- AI cannot silently introduce unsafe types
- runtime type errors are drastically reduced
- IDE intelligence remains reliable
- refactoring becomes safe at scale

TypeScript becomes a **core architectural safety system for Zidney**.

---

# Notes

Type safety is not optional in an AI-assisted monorepo.

Every unsafe type introduces hidden runtime risk and architectural decay.

This governance layer ensures that both human developers and AI contributors maintain strict typing
discipline.
