# Plan Report — STAGE_INFRA_07_MODULE_BOUNDARIES

**Step:** 3 — Plan  
**Timestamp:** 2026-03-08T00:00:00.000Z  
**Status:** COMPLETE

---

## Summary

Technical plan is complete for the Module Boundary Enforcement stage. The plan introduces a new
`docs/architecture/module-boundaries.json` file as the primary, layer-first boundary map, extends
`scripts/ai-guard.ts` with three constructs (`loadModuleBoundaries()`, `loadTsAliases()`,
`validateLayerBoundaries()`), adds a `"ai-guard"` npm script, renames the CI step to
`module-boundary-validation`, and enhances `infra-audit.ts` for undeclared module detection
(FR-008).

Guardian validations passed: Zidney Architecture Checker (VERDICT: PASS) and Zidney API Designer
(VERDICT: PASS).

---

## Inputs Reviewed

- `specs/runtime/infra-007-module-boundaries/spec.md` (496+ lines, including Clarifications section)
- `specs/runtime/infra-007-module-boundaries/plan.md` (generated — full implementation design)
- `specs/runtime/infra-007-module-boundaries/research.md` (generated — current-state archaeology)
- `scripts/ai-guard.ts` (full — current validator chain understood)
- `scripts/infra-audit.ts` (first 150 lines — `loadTsAliases()` pattern understood)
- `docs/architecture/intelligence/ARCHITECTURE_MAP.json` (current module classifications)
- `package.json` (current scripts)
- `tsconfig.json` + `tsconfig.base.json` (alias map — 20 aliases across both files)
- `.github/workflows/ci.yml` (current CI structure)

---

## Architecture Layers Touched

| Layer               | Planned Changes                                                              |
| ------------------- | ---------------------------------------------------------------------------- |
| Governance Tools    | `scripts/ai-guard.ts` extended with 14 new constructs (backward-compatible)  |
| Governance Tools    | `scripts/infra-audit.ts` enhanced with FR-008 undeclared-module detection    |
| Architecture Config | `docs/architecture/module-boundaries.json` created (layer-first JSON)        |
| CI Pipeline         | `.github/workflows/ci.yml` — CI step renamed to `module-boundary-validation` |
| Package Scripts     | `package.json` — `"ai-guard"` script added                                   |
| Tests               | `tests/static/` and `tests/unit/` — new test files for FR coverage           |

No changes to `apps/*`, `packages/*` runtime code, database schemas, or HTTP routes.

---

## Key Technical Decisions

| #   | Decision                                                                               | Rationale                                                                                                                               |
| --- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `module-boundaries.json` uses layer-first schema distinct from `ARCHITECTURE_MAP.json` | Per clarification C-001: different structural schemas serve different purposes; both co-exist                                           |
| 2   | `packages/types` → `infrastructure` layer (corrects ARCHITECTURE_MAP.json)             | Pure type definitions with no business logic belong in infrastructure; domain classification was incorrect                              |
| 3   | `packages/api-client` → `ui` layer (corrects ARCHITECTURE_MAP.json)                    | HTTP client for frontend apps only; must not be importable by `apps/api` or `apps/worker`                                               |
| 4   | `loadTsAliases()` merges both `tsconfig.json` AND `tsconfig.base.json`                 | Per clarification C-003: `@zidney/api-client` only exists in `tsconfig.base.json`; single-file resolution fails                         |
| 5   | Missing `module-boundaries.json` → graceful warning + fallback (not exit)              | Per clarification C-002 (NFR-003): graceful degradation prevents CI breakage before stage is merged                                     |
| 6   | Malformed `module-boundaries.json` → hard `process.exit(1)`                            | FR-001: if the file exists it must be valid — corrupted config is a developer error, not a degradable state                             |
| 7   | Existing violations always blocking                                                    | Per clarification C-004: no warning mode                                                                                                |
| 8   | `validateLayerBoundaries()` exported                                                   | Consistent with existing exported validators pattern; enables proper unit test isolation                                                |
| 9   | `forbidden_dependencies` field stored but not evaluated                                | `allowed_dependencies` positive allow-list is exhaustive; `forbidden_dependencies` is human-documentation-only (defense-in-depth field) |

---

## Migration Impact

| Item                  | Value | Notes                                                |
| --------------------- | ----- | ---------------------------------------------------- |
| Migration required    | No    | INFRA governance stage — no database schema changes  |
| `schema_version` bump | No    | Not applicable                                       |
| Backward compatible   | Yes   | Graceful fallback if `module-boundaries.json` absent |

---

## Transaction Boundaries

Not applicable — INFRA governance stage. No database writes. No HTTP transactions.

---

## Idempotency Strategy

Not applicable — INFRA governance stage. `ai-guard.ts` is a read-only validation script. Running it
multiple times produces the same output.

---

## Constitutional Compliance

| Check                                  | Status | Notes                                                         |
| -------------------------------------- | ------ | ------------------------------------------------------------- |
| No cross-tenant logic introduced       | ✅     | INFRA stage — pure tooling, no tenant context                 |
| All writes are transactional by design | ✅     | No database writes                                            |
| Server-authoritative time enforced     | ✅     | Not applicable                                                |
| License middleware enforced            | ✅     | Not applicable                                                |
| Version compatibility enforced         | ✅     | Not applicable                                                |
| No architecture redesign without ADR   | ✅     | Layer corrections align with existing ADR-defined layer model |
| No new npm packages                    | ✅     | Uses only `node:fs` and `node:child_process` built-ins        |
| Existing validators preserved          | ✅     | All 5 existing `ai-guard.ts` validators unchanged             |
| `ARCHITECTURE_MAP.json` not modified   | ✅     | NFR-003 compliant                                             |

**Overall:** COMPLIANT

---

## Guardian Validation

### Zidney Architecture Checker

**VERDICT: PASS** (Technical Plan)

Key observations:

- All 13 modules correctly classified across 4 layers (4+2+2+5)
- `packages/types` → `infrastructure` and `packages/api-client` → `ui` reclassifications are
  architecturally sound
- All 5 existing validators and 3 existing loaders preserved untouched
- `loadTsAliases()` correctly merges both tsconfig files
- 9 ADRs inspected — none affected
- No forbidden imports introduced
- `ARCHITECTURE_MAP.json` preserved (NFR-003 compliant)

Advisory notes received (non-blocking):

- Potential `infrastructure → infrastructure` self-dependency violations may surface in Step 4
  (SC-010 remediation handles this)
- Potential `ui → domain` violations via `packages/validation` imports may surface (same SC-010
  remediation path)

### Zidney API Designer

**VERDICT: PASS**

Confirmed: No HTTP APIs created or modified. `validateLayerBoundaries()` export signature is
correct, stable, and pure-function. No hidden cross-service concerns.

---

## Files Planned for Implementation

| File                                       | Action | FRs Addressed                                          |
| ------------------------------------------ | ------ | ------------------------------------------------------ |
| `docs/architecture/module-boundaries.json` | CREATE | FR-001, FR-002, FR-003, FR-007                         |
| `scripts/ai-guard.ts`                      | MODIFY | FR-003, FR-004, FR-005, FR-006, FR-007, FR-010, FR-012 |
| `package.json`                             | MODIFY | FR-010                                                 |
| `.github/workflows/ci.yml`                 | MODIFY | FR-009                                                 |
| `scripts/infra-audit.ts`                   | MODIFY | FR-008                                                 |
| `tests/static/module-boundaries.test.ts`   | CREATE | FR-002                                                 |
| `tests/unit/ai-guard-boundaries.test.ts`   | CREATE | FR-003 through FR-007, FR-012                          |

**Explicitly NOT changed:**

- `docs/architecture/intelligence/ARCHITECTURE_MAP.json` (NFR-003)
- `docs/architecture/intelligence/ARCHITECTURE_CONTRACT.json`
- Any `apps/*` or `packages/*` runtime code
- Any migration files
