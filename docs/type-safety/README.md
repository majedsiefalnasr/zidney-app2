# Type Safety Governance - Architecture Overview

Zidney's 8-layer Type Safety Governance system prevents unsafe TypeScript from reaching production.

## System Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│           Type Safety Governance - 8 Enforcing Layers            │
└──────────────────────────────────────────────────────────────────┘

Layer 8              AI Governance Rules
                    (AI contribution guidelines & rules)
     ▲
     │
Layer 7             Boundary-Typed Architecture
                    (All public exports have explicit types)
     ▲
     │
Layer 6             Domain Layer Safety
                    (100% type integrity in protected packages)
     ▲
     │
Layer 5             CI Enforcement
                    (GitHub Actions pre-merge validation)
     ▲
     │
Layer 4             Runtime Validation Layer
                    (Schema validation at API boundaries)
     ▲
     │
Layer 3             Type Safety Guard Script
                    (Custom pattern detection: :any, as any, @ts-ignore)
     ▲
     │
Layer 2             Biome Lint Enforcement
                    (noExplicitAny, @ts-ignore validation)
     ▲
     │
Layer 1             TypeScript Compiler Rules
                    (strict mode, noImplicitAny, noUncheckedIndexedAccess)
     │
     ▼
   Developer Code
```

## Layers Explained

### Layer 1: TypeScript Compiler Rules (Compile-Time)

**What**: Strict mode configuration in `tsconfig.json`

**Rules**:

- `strict: true` — All strict mode flags enabled
- `noImplicitAny: true` — Implicit `any` becomes compiler error
- `noUncheckedIndexedAccess: true` — Array/object access must be checked
- `exactOptionalPropertyTypes: true` — Optional properties are strictly `T | undefined`

**Mechanism**: Compiler errors prevent code from compiling

**When**: `bun run typecheck` (compile-time)

**Scope**: All TypeScript code

---

### Layer 2: Biome Lint Enforcement (Lint-Time)

**What**: Biome linting rules for type safety in `biome.json`

**Rules**:

- `suspicious/noExplicitAny` — Explicit `any` requires justification comment
- `noUnusedVariables` — Unused variables caught early
- Comment pattern: `// <library>: <version> - <issue URL>`

**Mechanism**: Lint errors fail CI and block merge

**When**: `bun run lint` (before commit, in CI)

**Scope**: All TypeScript files

---

### Layer 3: Type Safety Guard Script (Pre-CI)

**What**: Custom script detecting unsafe patterns in `scripts/type-safety-guard.ts`

**Detects**:

- `:any` type annotations
- `as any` type assertions
- `<any>` generic syntax
- `@ts-ignore` without justification
- Expired exceptions

**Mechanism**: Fails CI job if violations found

**When**: Pre-commit (optional), CI pipeline (mandatory)

**Scope**: All .ts/.tsx files

---

### Layer 4: Runtime Validation Layer (Runtime)

**What**: Schema validation infrastructure in `packages/validation/`

**Converts**:

- `unknown` external data (API responses, DB results, queue messages)
- → Validated typed models (safe to use in domain logic)

**Entry Points**:

- API route handlers
- Queue message processing
- Database result handling
- Environment variable validation

**Mechanism**: Validation fails with 422 error if data invalid

**When**: Request processing (runtime)

**Scope**: External data handling

---

### Layer 5: CI Enforcement (Pre-Merge)

**What**: GitHub Actions workflow `ci-type-safety.yml`

**Pipeline**:

1. TypeScript compile check (`tsc --noEmit`)
2. Type safety guard scan
3. Biome lint validation

**Mechanism**: CI job fails → PR merge blocked

**When**: Every PR to develop/main

**Scope**: All PR code changes

---

### Layer 6: Domain Layer Safety (Package-Level)

**What**: Zero `any` policy for critical packages

**Protected Packages**:

- `packages/domain-core` — Core business logic
- `packages/types` — Type definitions
- `packages/validation` — Validation schemas

**Registry**: `ALLOWED_ANY_EXCEPTIONS.json` per package

**Mechanism**: Guard script enforces, exception approval required

**When**: Automatic enforcement in CI

**Scope**: Protected packages only

---

### Layer 7: Boundary-Typed Architecture (Module-Level)

**What**: All public exports have explicit types

**Examples**:

```typescript
// ✅ GOOD - Explicit return type
export function validateUser(input: unknown): User {
  // validation logic
  return user;
}

// ❌ BAD - Implicit return type
export function validateUser(input: unknown) {
  // validation logic
  return user; // type inferred
}
```

**Mechanism**: `noImplicitAny` prevents implicit exports

**When**: Development, compile-time

**Scope**: All public API exports

---

### Layer 8: AI Governance Rules (Human + AI)

**What**: Explicit rules for AI agents contributing code

**Core Rules**:

1. Never use `any` — use `unknown` instead
2. Validate external data at boundaries
3. Use generics for dynamic types, not `any`
4. Justify all `@ts-ignore` comments

**Mechanism**: Code review, same CI gates as human code

**When**: AI code contribution, PR review

**Scope**: All AI-contributed code

---

## Compliance Status

| Component | Status          | Notes                             |
| --------- | --------------- | --------------------------------- |
| Layer 1   | ✅ MVP COMPLETE | Strict mode enabled globally      |
| Layer 2   | ✅ MVP COMPLETE | Biome noExplicitAny enforced      |
| Layer 3   | ✅ IMPLEMENTED  | Guard script deployed             |
| Layer 4   | 🚀 IN PROGRESS  | Validation schemas being added    |
| Layer 5   | ✅ MVP COMPLETE | CI job integrated                 |
| Layer 6   | 🚀 IN PROGRESS  | Protected packages being hardened |
| Layer 7   | 🚀 IN PROGRESS  | Boundary typing being audited     |
| Layer 8   | 🚀 IN PROGRESS  | AI governance skill being created |

---

## Quick Reference

### Common Type Safety Operations

**Check for type errors locally**:

```bash
bun run typecheck
```

**Run full type safety validation**:

```bash
bun run validate:types
```

**Scan for unsafe patterns**:

```bash
bun run arch:type-safety-guard
```

**Fix type errors in a module**:

```bash
cd packages/domain-core
bun run typecheck
# Then fix errors...
```

### Key Files to Know

| File                                            | Purpose              | Layer |
| ----------------------------------------------- | -------------------- | ----- |
| `tsconfig.base.json`                            | Root strict config   | 1     |
| `biome.json`                                    | Linter configuration | 2     |
| `scripts/type-safety-guard.ts`                  | Guard script         | 3     |
| `packages/validation/src/schemas/`              | Schema definitions   | 4     |
| `.github/workflows/ci-type-safety.yml`          | CI pipeline          | 5     |
| `ALLOWED_ANY_EXCEPTIONS.json`                   | Exception registry   | 6     |
| `packages/*/src/index.ts`                       | Public exports       | 7     |
| `.agents/skills/typescript-governance/SKILL.md` | AI rules             | 8     |

---

## For More Information

See full documentation in:

- [Type Safety Handbook](./TYPE_SAFETY_HANDBOOK.md) — Layer-by-layer guide
- [Guard Script Guide](./GUARD_SCRIPT.md) — How to use the guard script
- [Runbooks](./RUNBOOK_FIX_TYPE_ERRORS.md) — Troubleshooting guides
- [AI Governance](./AI_GOVERNANCE_HANDBOOK.md) — AI contribution rules

---

Last Updated: 2026-03-11
