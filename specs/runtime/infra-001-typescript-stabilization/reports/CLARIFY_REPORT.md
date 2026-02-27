# Clarify Report — STAGE_INFRA_01_TYPESCRIPT_STABILIZATION

**Step:** 2 — Clarify
**Timestamp:** 2026-02-27T00:02:00Z
**Status:** COMPLETE

---

## Summary

Five targeted clarifications were identified and resolved for the TypeScript Infrastructure Stabilization stage. All ambiguities were in the area of implementation strategy and tooling policy — none were constitutional or isolation concerns. All decisions are encoded directly in `spec.md` under `## Clarifications / ### Session 2026-02-27`.

Zero unresolved items. Planning is authorized.

---

## Inputs Reviewed

- `specs/runtime/infra-001-typescript-stabilization/spec.md` (including `## Clarifications / ### Session 2026-02-27`)

---

## Clarifications Resolved

| #     | Question                                                                | Resolution                                                                                                                                      | Impact                                                            |
| ----- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| CL-01 | Should `noUnusedLocals`/`noUnusedParameters` be enforced in test files? | Option D: Add `tsconfig.test.json` extending `tsconfig.base.json` with only these two flags disabled, scoped to test paths                      | Adds a new artifact to the plan: `tsconfig.test.json` per app     |
| CL-02 | Are the 5 migration passes strictly sequential?                         | Sequential within a package; parallelizable across packages; each pass requires a passing typecheck before proceeding                           | Pass strategy confirmed; plan must reflect per-package sequencing |
| CL-03 | How to handle third-party `@types` gaps?                                | Install `@types/*` first; if unavailable, create stub at `packages/types/src/vendor/<lib>.d.ts`; `@ts-ignore` is last resort with justification | Adds vendor stub pattern to plan                                  |
| CL-04 | What if a type fix reveals a real logic bug?                            | Stop the pass, raise a separate issue, stub with safe interim type; escalate if critical path (attempt engine, license, isolation)              | Escape hatch defined; does not require plan change                |
| CL-05 | Required format for `@ts-ignore` justification?                         | `// ts-ignore: <reason> [<issue-ref>]` on the line immediately above the directive; missing comment fails code review                           | Adds enforceable policy to plan (ESLint or review rule)           |

---

## Open Items

None.

---

## Spec Updates Applied

- Appended `## Clarifications / ### Session 2026-02-27` to `specs/runtime/infra-001-typescript-stabilization/spec.md`
- CL-01 through CL-05 fully encoded with question, decision, and rationale
- FR-07 (test file type compliance) is now clarified to allow `tsconfig.test.json` override for `noUnusedLocals`/`noUnusedParameters` only
- FR-09 (ts-ignore policy) now has an explicit format requirement: `// ts-ignore: <reason> [<issue-ref>]`

---

## Constitutional Compliance

| Check                                     | Status | Notes                                                         |
| ----------------------------------------- | ------ | ------------------------------------------------------------- |
| All material ambiguities resolved         | ✅     | 5/5 questions answered; zero open items                       |
| Transaction strategy confirmed            | ✅ N/A | Infrastructure stage — no DB writes introduced                |
| Idempotency strategy confirmed            | ✅ N/A | No new endpoints; no idempotency surface                      |
| Isolation boundaries confirmed            | ✅     | No data access model changes; tenant isolation unaffected     |
| Version and license constraints confirmed | ✅     | Type fixes do not change version or license enforcement logic |

**Overall:** COMPLIANT — planning authorized.
