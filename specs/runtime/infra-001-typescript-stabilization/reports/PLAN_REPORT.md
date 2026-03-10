# Plan Report — STAGE_INFRA_01_TYPESCRIPT_STABILIZATION

**Step:** 3 — Plan **Timestamp:** 2026-02-27T00:03:00Z **Status:** COMPLETE

---

## Summary

Technical plan drafted and validated for the TypeScript Infrastructure Stabilization stage.
`speckit.plan` executed Phase 0 research against the actual codebase — confirming **866 TypeScript
errors** (not estimated). The plan covers a 5-pass migration strategy with per-pass exit gates, Day
0 tsconfig hardening tasks, CI gate design (two-step typecheck), and vendor stub conventions.

Guardian validation: **Zidney Architecture Checker: PASS** | **Zidney API Designer: PASS**

One architecture inconsistency (Design Decision 3 vs 7 — tsconfig.test.json CI gate scope) was
identified and resolved by updating plan.md to adopt the two-step CI typecheck approach
(`pnpm typecheck:src` + `pnpm typecheck:tests`).

---

## Inputs Reviewed

- `specs/runtime/infra-001-typescript-stabilization/spec.md` (includes Clarifications CL-01–05)
- `specs/runtime/infra-001-typescript-stabilization/plan.md`
- `specs/runtime/infra-001-typescript-stabilization/research.md`

No `data-model.md` or `contracts/` — infrastructure stage; not applicable.

---

## Architecture Layers Touched

| Layer                   | Planned Changes                                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------- |
| API (`apps/api`)        | TypeScript type fixes across route handlers, middleware, DB access layers — no behavioral changes |
| Worker (`apps/worker`)  | Type contracts cleaned; job payload types aligned with domain-core — no logic changes             |
| Frontend (`apps/mmc`)   | Vue 3 component TypeScript config enforcement; no component logic changes                         |
| DB Master               | None — no schema changes                                                                          |
| DB Tenant               | None — no schema changes                                                                          |
| Packages (`packages/*`) | All shared packages get explicit types, inheritance fixes, and missing tsconfig.json files        |
| Tests                   | Pass 5 cleans all test file type errors using `tsconfig.test.json` configuration                  |
| CI/CD                   | New `typecheck:src` + `typecheck:tests` GitHub Actions job gate added                             |

---

## Key Technical Decisions

| #   | Decision                                                                                                    | Rationale                                                                                                                                                                                           |
| --- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | tsconfig.base.json adds 3 missing options (`noImplicitAny`, `strictNullChecks`, `noUncheckedIndexedAccess`) | These are not part of the `strict` umbrella; must be added explicitly to enforce complete strictness                                                                                                |
| 2   | 4 packages with weakening overrides must have those overrides removed on Day 0                              | `apps/api` (`strict: false`), `packages/domain-core` (`noImplicitAny: false`), `apps/api/tsconfig.app.json`, and `packages/ui-system` are blocking the full error count until overrides are removed |
| 3   | Two-step CI typecheck: `tsconfig.json` excludes test paths; `tsconfig.test.json` covers tests               | Ensures `noUnusedLocals/Parameters` enforced on production code but not test code (CL-01); Architecture Checker-approved                                                                            |
| 4   | Script renamed from `type-check` to `typecheck:src` + `typecheck:tests` + `typecheck` aggregator            | Aligns with the industry standard `typecheck` script name; enables per-scope invocation                                                                                                             |
| 5   | 5-pass migration strategy: sequential within package, parallel across packages                              | Maintains incremental correctness while allowing team parallelism (CL-02)                                                                                                                           |
| 6   | Vendor stub at `packages/types/src/vendor/<lib>.d.ts` for missing `@types`                                  | Centralizes all third-party type stubs in one location; avoids scattering `@ts-ignore` across source (CL-03)                                                                                        |
| 7   | `@ts-ignore` requires `// ts-ignore: <reason> [<issue-ref>]` on preceding line                              | Grep-enforceable; must pass ESLint `ban-ts-comment` with description rule (CL-05)                                                                                                                   |
| 8   | pnpm version pinned to `'9'` in CI YAML                                                                     | Prevents non-deterministic CI behavior from `latest` version; Architecture Checker recommendation                                                                                                   |
| 9   | Domain contract alignment (Pass 2): structural assignability exit gate                                      | No cross-layer casts required; middleware interface changes require STOP + ADR                                                                                                                      |
| 10  | Logic bug isolation protocol (CL-04): stop pass, raise issue, stub interim type                             | Prevents behavioral changes from entering the type-stabilization PR; critical path escalation defined                                                                                               |

---

## Migration Impact

| Item                  | Value | Notes                                                         |
| --------------------- | ----- | ------------------------------------------------------------- |
| Migration required    | No    | Infrastructure stage — no DB schema changes                   |
| `schema_version` bump | No    | No database changes                                           |
| Backward compatible   | Yes   | Type fixes are compile-time only; no runtime behavior changed |

---

## Transaction Boundaries

Not applicable — this is an infrastructure stage. No database write operations are introduced.

---

## Idempotency Strategy

Not applicable — no new API endpoints or worker jobs introduced.

---

## Day 0 Checklist (Required Before Pass 1)

1. Add missing compiler options to `tsconfig.base.json` (`noImplicitAny`, `strictNullChecks`,
   `noUncheckedIndexedAccess`)
2. Remove `strict: false` override from `apps/api/tsconfig.json`
3. Remove `noImplicitAny: false` from `packages/domain-core/tsconfig.json`
4. Remove additional weakening overrides from `apps/api/tsconfig.app.json` and
   `packages/ui-system/tsconfig.json`
5. Create `tsconfig.test.json` (extends base, disables `noUnusedLocals`/`noUnusedParameters`,
   includes test paths)
6. Update root `tsconfig.json` to exclude test paths
7. Create `packages/redis-utils/tsconfig.json` (extends base)
8. Create `packages/types/tsconfig.json` (extends base)
9. Rename script: `type-check` → `typecheck:src`; add `typecheck:tests` and `typecheck` aggregator
   in root `package.json`
10. Re-run `pnpm typecheck:src` to establish new error baseline after tsconfig changes

---

## Constitutional Compliance

| Check                                            | Status  | Notes                                                                       |
| ------------------------------------------------ | ------- | --------------------------------------------------------------------------- |
| ADR-0001 Database-per-tenant isolation preserved | ✅ PASS | No DB access model changes                                                  |
| ADR-0004 Single runtime contract preserved       | ✅ PASS | API-domain-worker type alignment is additive; middleware untouched          |
| ADR-0007 Version compatibility preserved         | ✅ PASS | No version enforcement logic changes                                        |
| ADR-0008 Semantic versioning preserved           | ✅ PASS | Infrastructure stage; no feature version bump                               |
| No cross-tenant access introduced                | ✅ PASS | Type-layer only; no data access changes                                     |
| License middleware enforcement preserved         | ✅ PASS | Middleware untouched; escalation trigger defined if interface change needed |
| Snapshot integrity preserved                     | ✅ PASS | Attempt engine out of scope                                                 |
| Attempt engine immutability maintained           | ✅ PASS | Attempt engine explicitly excluded                                          |

**Overall:** COMPLIANT — all guardian verdicts PASS

---

## Guardian Verdicts

| Guardian                    | Verdict | Key Notes                                                                 |
| --------------------------- | ------- | ------------------------------------------------------------------------- |
| Zidney Architecture Checker | ✅ PASS | One pre-Day-0 issue resolved (Design Decision 3 vs 7 inconsistency fixed) |
| Zidney API Designer         | ✅ PASS | 3 non-blocking observations recorded; none block implementation           |

---

## Artifacts Generated

- `specs/runtime/infra-001-typescript-stabilization/plan.md` (29.5 KB + Architecture Checker fix)
- `specs/runtime/infra-001-typescript-stabilization/research.md` (15.7 KB)

---

## Next Step

No blockers. Proceed to Step 4 — Tasks.
