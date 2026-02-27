# Specify Report — STAGE_INFRA_01_TYPESCRIPT_STABILIZATION

**Step:** 1 — Specify
**Timestamp:** 2026-02-27T00:00:00Z
**Status:** COMPLETE

---

## Summary

Specification drafted for the TypeScript Infrastructure Stabilization stage. This is a non-feature infrastructure hardening stage that does not introduce any user-facing behavior. The spec covers the elimination of 800+ pre-existing TypeScript errors across the Zidney monorepo, enforcement of `strict: true` in all packages, standardization of `tsconfig` inheritance, and CI hard-fail on type errors.

The spec is constitutional-compliance-first: no isolation model changes, no middleware bypasses, no behavioral changes. All type corrections are compile-time only.

Zero `[NEEDS CLARIFICATION]` markers. All decisions resolved from the stage file and documented via explicit assumptions.

---

## Inputs Reviewed

- `specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_01_TYPESCRIPT_STABILIZATION.md`
- `specs/runtime/infra-001-typescript-stabilization/spec.md`
- `specs/runtime/infra-001-typescript-stabilization/checklists/requirements.md`

---

## Key Decisions

| #   | Decision                                                                  | Rationale                                                                                                                                                                                 |
| --- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `apps/frontoffice` and `apps/backoffice` are excluded from this stage     | Deferred to a future frontend stabilization stage; reducing blast radius of this infrastructure change                                                                                    |
| 2   | `// @ts-ignore` suppression is allowed with documented justification only | Some third-party type definition gaps may require temporary suppression; undocumented suppressions are forbidden                                                                          |
| 3   | Test files are included in scope                                          | Test `any` casts undermine the type safety guarantee; strict typing must extend to the test layer                                                                                         |
| 4   | Migration scripts included if TypeScript-typed                            | Typed migration scripts are part of the compile chain and must be clean                                                                                                                   |
| 5   | No ADR required for this stage                                            | Stage file confirms no architectural invariant is altered; if Pass 2 (Domain Contract Alignment) reveals a middleware contract change, an ADR must be raised before that change is merged |

---

## Functional Requirements Captured

- **FR-01:** Root `tsconfig.base.json` must enforce `strict: true`, `noImplicitAny: true`, `strictNullChecks: true`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `noUncheckedIndexedAccess`
- **FR-02:** All sub-packages must extend from `tsconfig.base.json` — no weakening allowed
- **FR-03:** Zero implicit `any` — all parameters, return types, variables must have explicit types
- **FR-04:** Zero unsafe type assertions — `as any` forbidden except with documented narrowing
- **FR-05:** Domain contract alignment — API DTOs and worker message types structurally compatible with domain entities
- **FR-06:** Strict null handling — no unguarded optional access, `!` non-null assertions only with justification
- **FR-07:** Test file type compliance — all test files, mocks, helpers strictly typed
- **FR-08:** CI hard-fail — `pnpm typecheck` must exit code `0`; pipeline blocks on any type error
- **FR-09:** ts-ignore policy — `// @ts-ignore` only with a line-above justification comment; grep-enforceable

---

## Clarifications Required

None. Zero `[NEEDS CLARIFICATION]` markers in the spec.

---

## Constitutional Compliance

| Check                                   | Status | Notes                                                         |
| --------------------------------------- | ------ | ------------------------------------------------------------- |
| No cross-tenant access introduced       | ✅     | Type-layer changes only; no DB access model changes           |
| License middleware requirement captured | ✅     | Middleware untouched; spec confirms no middleware bypass      |
| Snapshot integrity requirement captured | ✅     | No attempt engine changes; snapshot immutability not affected |
| Idempotency strategy defined            | ✅ N/A | Infrastructure stage — no new endpoints introduced            |
| Transaction boundaries identified       | ✅ N/A | No DB write logic changes                                     |
| Server-authoritative time enforced      | ✅ N/A | No time logic changes                                         |
| Layer boundaries preserved              | ✅     | Explicit types enforce layer boundaries at compile time       |

**Overall:** COMPLIANT

---

## Open Risks

1. **Large Refactor Surface** — 800+ errors across multiple packages; mitigation: incremental commits, domain-by-domain cleanup
2. **Hidden Runtime Assumptions** — A type fix may reveal a logic defect disguised by `any`; mitigation: full test suite run after each pass, runtime smoke tests
3. **Third-Party Type Definition Gaps** — Some libraries may lack accurate type definitions; mitigation: `@ts-ignore` with documented justification, targeted `@types/*` installation

---

## Next Step

No unresolved clarifications. No blockers. Proceed to Step 2 — Clarify.
