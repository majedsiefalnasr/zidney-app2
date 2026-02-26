# STAGE_INFRA_01_TYPESCRIPT_STABILIZATION

## Stage Status

IN PROGRESS – Structural stabilization required before production promotion.

This stage exists to eliminate accumulated TypeScript technical debt across
Foundation, MMC, Worker, and shared packages before any stage is promoted
from BACKEND CLOSED to PRODUCTION READY.

---

# 1. Purpose

This is an infrastructure hardening stage.

It does NOT introduce new features.

It stabilizes:

- TypeScript strict compliance
- Project-wide type safety guarantees
- Build determinism
- CI enforcement of type integrity
- Long-term maintainability baseline

This stage is mandatory before:

- Promoting STAGE_TEST_01_PLATFORM_FOUNDATION to PRODUCTION READY
- Enabling strict CI type gates
- Declaring runtime stack production-safe

---

# 2. Current Problem Statement

Baseline audit revealed:

- 800+ pre-existing TypeScript errors
- Type drift between domain, API, and worker
- Inconsistent strictness between packages
- Legacy `any` usage
- Missing return types
- Implicit any parameters
- Inconsistent tsconfig inheritance

Although tests pass, type integrity is not guaranteed.

This violates Zidney’s long-term architectural discipline.

---

# 3. Objectives

This stage must:

1. Reduce TypeScript errors to ZERO.
2. Enforce `"strict": true` across entire monorepo.
3. Eliminate all implicit `any`.
4. Remove unsafe type assertions where possible.
5. Standardize tsconfig inheritance model.
6. Enable CI hard-fail on type errors.
7. Ensure test files are also strict-clean.
8. Validate worker + API cross-contract typing.

---

# 4. Scope

### Included

- apps/api
- apps/worker
- apps/mmc
- packages/\*
- shared domain modules
- test files
- migration scripts (if typed)

### Excluded

- Generated files
- Node_modules
- Temporary scaffolding

---

# 5. Required Configuration

## 5.1 Root tsconfig.base.json

Must enforce:

```
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true
  }
}
```

All sub-packages must extend from this file.

No local weakening allowed.

---

# 6. Enforcement Model

## 6.1 CI Gate

Add mandatory type check step:

```
pnpm typecheck
```

CI must FAIL if:

- Any TypeScript error exists
- Any package bypasses strict mode

Warnings are allowed.
Errors are blocking.

---

# 7. Migration Strategy

The cleanup must be done in structured passes:

### Pass 1 – Remove Implicit Any

- Add explicit types
- Fix function signatures
- Define missing interfaces

### Pass 2 – Domain Contract Alignment

- Ensure API DTO types match domain types
- Validate worker message contracts

### Pass 3 – Strict Null Handling

- Remove unsafe optional chaining
- Add proper guards

### Pass 4 – Cross-Package Imports

- Fix circular dependencies
- Ensure type-only imports where needed

### Pass 5 – Test Strict Compliance

- Remove any from tests
- Enforce typed mocks

---

# 8. Success Criteria

This stage is COMPLETE when:

- `pnpm typecheck` returns 0 errors
- All packages compile clean
- CI blocks on any future type error
- No `// @ts-ignore` used except documented cases
- Type coverage validated by manual review

---

# 9. Risk Management

### Risk: Large Refactor Surface

Mitigation:

- Incremental commits
- Domain-by-domain cleanup

### Risk: Hidden Runtime Assumptions

Mitigation:

- Run full test suite after each pass
- Use runtime smoke tests

---

# 10. Constitutional Alignment

This stage reinforces:

- Determinism
- Explicit contracts
- Isolation safety
- Operational integrity
- CI enforceability

It strengthens the foundation without altering feature behavior.

---

# 11. Exit Conditions

When complete:

- Update STAGE_TEST_01_PLATFORM_FOUNDATION.md
- Promote from BACKEND CLOSED → PRODUCTION READY
- Lock strict CI enforcement

Until then:

Foundation cannot be considered production hardened.

---

## Final Constitutional Statement

Compliant with Zidney Constitution v1.2.0 — Infrastructure hardening stage. No behavioral changes introduced.
