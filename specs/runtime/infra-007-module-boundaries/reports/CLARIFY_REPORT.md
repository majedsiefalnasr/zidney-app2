# Clarify Report — STAGE_INFRA_07_MODULE_BOUNDARIES

**Step:** 2 — Clarify  
**Timestamp:** 2026-03-08T00:00:00.000Z  
**Status:** COMPLETE

---

## Summary

5 implementation-critical ambiguities were identified and fully resolved through codebase analysis.
This included inspecting `ai-guard.ts`, `infra-audit.ts`, `ARCHITECTURE_MAP.json`, `tsconfig.json`,
`tsconfig.base.json`, and `ci.yml`. All resolutions are grounded in existing code — no assumptions
made. Spec updated in-place with a `## Clarifications / Session 2026-03-08` section. Ready for
technical planning.

---

## Inputs Reviewed

- `specs/runtime/infra-007-module-boundaries/spec.md`
- `docs/architecture/intelligence/ARCHITECTURE_MAP.json`
- `scripts/ai-guard.ts` (current structure and validators)
- `scripts/infra-audit.ts` (alias resolution patterns)
- `tsconfig.json` and `tsconfig.base.json` (path alias definitions)
- `.github/workflows/ci.yml` (CI pipeline structure)
- `package.json` (existing script names)

---

## Clarifications Resolved

| #   | Question                                                                  | Resolution                                                                                                                                                                                    | Impact                                                  |
| --- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| C1  | Is `module-boundaries.json` schema distinct from `ARCHITECTURE_MAP.json`? | Yes — structurally distinct. `ARCHITECTURE_MAP.json` is flat per-module; `module-boundaries.json` is layer-first with dependency matrices. Both coexist.                                      | Prevents schema conflicts; keeps backward compatibility |
| C2  | What structural changes does `ai-guard.ts` require?                       | 3 new additions: `BOUNDARIES_PATH` constant, `loadModuleBoundaries()`, `validateLayerBoundaries()` + cross-cutting rules evaluator. All existing validators remain intact.                    | Scopes implementation work precisely                    |
| C3  | How are TypeScript path aliases resolved?                                 | Must use `loadTsAliases()` from `infra-audit.ts` — the `@zidney/ui/*` wildcard requires special handling that plain prefix-stripping cannot do correctly.                                     | Prevents silent false negatives on aliased imports      |
| C4  | Should existing boundary violations be treated as warnings or errors?     | Always blocking errors. No warning mode. Violations must be fixed before `BACKEND CLOSED`.                                                                                                    | Eliminates ambiguity in SC-006/SC-010                   |
| C5  | Where does the CI step insert? Name of `bun run ai-guard` command?        | CI: `arch-guard` job already exists; step renamed to `module-boundary-validation`. `package.json` needs `"ai-guard": "bun scripts/ai-guard.ts"` added — currently only `"arch:guard"` exists. | Defines exact implementation target for FR-010          |

---

## Open Items

None. All implementation-critical ambiguities resolved.

---

## Spec Updates Applied

- Appended `## Clarifications / Session 2026-03-08` section to `spec.md` with 5 Q&A pairs
- Updated `module-boundaries.json` schema section to reflect schema-distinctness from
  `ARCHITECTURE_MAP.json`
- Clarified `ai-guard.ts` structural changes required (3 new additions, existing validators
  preserved)
- Confirmed alias resolution must use `loadTsAliases()` from `infra-audit.ts`
- Confirmed existing violations are always errors, never warnings
- Confirmed CI step insertion point and missing `"ai-guard"` npm script

---

## Constitutional Compliance

| Check                                     | Status | Notes                                                          |
| ----------------------------------------- | ------ | -------------------------------------------------------------- |
| All material ambiguities resolved         | ✅     | 5 resolved, 0 remaining                                        |
| Transaction strategy confirmed            | ✅ N/A | No database transactions — pure static analysis tooling        |
| Idempotency strategy confirmed            | ✅     | `bun run ai-guard` is stateless and idempotent by design       |
| Isolation boundaries confirmed            | ✅ N/A | INFRA stage — no tenant isolation concerns                     |
| Version and license constraints confirmed | ✅ N/A | Tooling-only stage — no version compatibility concerns         |
| Import boundary rules at tool level       | ✅     | `loadTsAliases()` reuse confirmed for correct alias resolution |

**Overall:** COMPLIANT

---

## Open Risks

None beyond those captured in SPECIFY_REPORT.md. Clarifications added mitigation detail for R3
(alias resolution now resolved via `loadTsAliases()` reuse).

---

## Next Step

Proceed to Step 3 — Plan.
