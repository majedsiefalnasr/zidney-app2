# Specify Report — STAGE_INFRA_06_ARCHITECTURE_GUARD

**Step:** 1 — Specify  
**Timestamp:** 2026-03-08T00:00:00.000Z  
**Status:** COMPLETE

---

## Summary

Specification authored for STAGE_INFRA_06_ARCHITECTURE_GUARD — the repository-level architecture
protection system for Zidney.

The stage was found to have a significant portion of its implementation already in place
(`scripts/ai-guard.ts`, `.husky/pre-commit`, `ARCHITECTURE_CONTRACT.json`). The spec accurately
reflects this current state and scopes deliverables strictly to the **gap items** that complete the
stage:

1. `arch:guard` npm script (CLI entry point)
2. Unit tests for `ai-guard.ts` validation functions
3. Static architecture rule tests
4. Test fixtures

No `[NEEDS CLARIFICATION]` markers were added — all requirements are deterministic based on the
existing codebase state.

---

## Inputs Reviewed

- `specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_06_ARCHITECTURE_GUARD.md` — stage description
- `specs/templates/specify-template.md` — spec template
- `scripts/ai-guard.ts` — existing implementation (445 lines)
- `scripts/infra-audit.ts` — existing governance audit
- `.husky/pre-commit` — existing 3-gate hook
- `docs/architecture/intelligence/ARCHITECTURE_CONTRACT.json` — existing rules
- `docs/architecture/intelligence/ARCHITECTURE_MAP.json` — existing module rules
- `docs/architecture/adr/` — 9 ADR decision records
- `package.json` — existing scripts inventory
- `tests/unit/ai-guard/` — existing empty test directory
- `.specify/memory/constitution.md` — Zidney Constitution v1.2.0

---

## Key Decisions

| #   | Decision                                                   | Rationale                                                                                                                               |
| --- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Do NOT modify `scripts/ai-guard.ts` logic                  | Already working correctly and passing all pre-commit gates; changes would risk regression                                               |
| 2   | Scope deliverables to 4 gap items only                     | Architecture guard is mostly complete; this stage finalizes test coverage and CLI exposure                                              |
| 3   | Use fixture files for unit tests                           | `extractImports()` reads actual file content via `readFileSync` — fixture files simulate real-world import patterns without git staging |
| 4   | Add `arch:guard` as named script                           | Developers need a documented, discoverable CLI entry point distinct from the implicit pre-commit hook                                   |
| 5   | Static test validates ARCHITECTURE_CONTRACT.json structure | Machine-readable contract integrity must be verified as a regression test                                                               |

---

## Functional Requirements Captured

- FR-01: `arch:guard` npm script → `package.json`
- FR-02: Unit tests for all `ai-guard.ts` validation functions →
  `tests/unit/ai-guard/ai-guard-validation.test.ts`
- FR-03: Static architecture rule test → `tests/static/05-architecture-guard.test.ts`
- FR-04: `detectModule` / `detectFileModule` path resolution tests
- FR-05: Pre-commit hook documentation verification (no content changes needed)

---

## Clarifications Required

None — all requirements are deterministic based on existing codebase state.

---

## Constitutional Compliance

| Check                                   | Status | Notes                                    |
| --------------------------------------- | ------ | ---------------------------------------- |
| No cross-tenant access introduced       | ✅     | No database access at all                |
| License middleware requirement captured | ✅     | Not applicable — developer tooling       |
| Snapshot integrity requirement captured | ✅     | Not applicable — no attempt logic        |
| Idempotency strategy defined            | ✅     | Guard is inherently idempotent           |
| Transaction boundaries identified       | ✅     | Not applicable — no DB writes            |
| Server-authoritative time enforced      | ✅     | Not applicable — no time-dependent logic |

**Overall:** COMPLIANT

---

## Open Risks

- **Test isolation:** Unit tests must not depend on `git diff --staged` output (which varies by
  developer environment). Fixture file approach mitigates this.
- **Test file linting:** New test files must pass Biome checks. Use correct TypeScript patterns to
  avoid `noExplicitAny` or `noUnusedVariables` violations.

---

## Next Step

Proceed to Step 2 — Clarify.
