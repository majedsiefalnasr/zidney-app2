# Plan Report — STAGE_INFRA_06_ARCHITECTURE_GUARD

**Step:** 3 — Plan  
**Timestamp:** 2026-03-08T03:00:00.000Z  
**Status:** COMPLETE

Guardian Verdicts: **Zidney Architecture Checker — PASS | Zidney API Designer — PASS**

---

## Summary

Technical plan completed for STAGE_INFRA_06_ARCHITECTURE_GUARD. The plan covers 9 file changes
across `package.json`, `scripts/ai-guard.ts`, `tests/unit/ai-guard/`, and `tests/static/`:

1. Add `arch:guard` npm script to `package.json`
2. Add `export` to 7 pure functions in `scripts/ai-guard.ts` (non-logic change, enables testability)
3. Create 5 fixture files for deterministic unit test isolation
4. Create `tests/unit/ai-guard/ai-guard-validation.test.ts` with 7 function-level `describe` blocks
5. Create `tests/static/05-architecture-guard.test.ts` with 7 contract validity assertions

No migrations, no API routes, no database changes, no frontend changes.

---

## Inputs Reviewed

- `specs/runtime/infra-006-architecture-guard/spec.md`
- `specs/runtime/infra-006-architecture-guard/plan.md`
- `scripts/ai-guard.ts` (445 lines — full source read)
- `docs/architecture/intelligence/ARCHITECTURE_CONTRACT.json` (rules structure verified)
- `docs/architecture/intelligence/ARCHITECTURE_MAP.json` (module definitions verified)
- `tests/static/04-migration-discipline.test.ts` (pattern reference)

---

## Architecture Layers Touched

| Layer             | Planned Changes                                                  |
| ----------------- | ---------------------------------------------------------------- |
| API               | None                                                             |
| Worker            | None                                                             |
| Frontend          | None                                                             |
| DB Master         | None                                                             |
| DB Tenant         | None                                                             |
| Developer Tooling | `package.json` script, `scripts/ai-guard.ts` exports, test files |

---

## Key Technical Decisions

| #   | Decision                                                   | Rationale                                                                                               |
| --- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 1   | Add `export` to pure functions in `ai-guard.ts`            | Functions are not currently exported; required for Vitest unit tests to import and invoke them directly |
| 2   | Use fixture files instead of mocking `readFileSync`        | Avoids brittle mock setup; fixture files are real TS files that `extractImports()` can read normally    |
| 3   | Test at function boundary, not CLI boundary                | CLI testing requires git staging state; function testing is deterministic with fixtures                 |
| 4   | Static test reads `ARCHITECTURE_CONTRACT.json` directly    | Validates machine-readable contract integrity as a regression test; no execution required               |
| 5   | Skip unit testing of `validateBranchNaming` and `runGuard` | Both use `process.exit` and git CLI — integration-tested via pre-commit hook instead                    |

---

## Migration Impact

| Item                  | Value | Notes                         |
| --------------------- | ----- | ----------------------------- |
| Migration required    | No    | No database changes           |
| `schema_version` bump | No    | No tenant DB changes          |
| Backward compatible   | N/A   | No API or DB contract changes |

---

## Transaction Boundaries

Not applicable. No database operations.

---

## Idempotency Strategy

Not applicable. No state-mutating operations.

---

## Constitutional Compliance

| Check                                  | Status | Notes                                          |
| -------------------------------------- | ------ | ---------------------------------------------- |
| No cross-tenant logic introduced       | ✅     | No DB, no tenant resolution                    |
| All writes are transactional by design | ✅     | Not applicable                                 |
| Server-authoritative time enforced     | ✅     | Not applicable                                 |
| License middleware enforced            | ✅     | Not applicable                                 |
| Version compatibility enforced         | ✅     | Not applicable                                 |
| No architecture redesign without ADR   | ✅     | Export additions are non-architectural changes |

**Overall:** COMPLIANT

---

## Open Risks

- **Biome linting on new test files**: Unit test files must not trigger `noExplicitAny`,
  `noUnusedVariables`, or `noConsole` violations. Tests must use typed assertions throughout.
- **Fixture file compilation**: Fixture `.ts` files are never compiled by the production build —
  verified by tsconfig exclusion patterns. They are source-read-only by `extractImports()`.

---

## Next Step

Proceed to Step 4 — Tasks.
