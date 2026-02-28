# Plan Report — ENV Configuration

**Step:** 3 — Plan  
**Timestamp:** 2026-02-28T21:15:00Z  
**Status:** COMPLETE

---

## Summary

Technical plan generated for ENV Configuration stage. The implementation establishes a factory-based environment configuration strategy across all 3 Zidney frontend apps using `createEnvConfig(overrides?)` with `Object.freeze()` immutability. Shared TypeScript interfaces in `packages/types` (type-only, zero runtime). Per-app implementation in `core/config/` directory. ESLint AST-based lint rule for `import.meta.env` enforcement.

Guardian validation: Architecture Checker **PASS**, API Designer **PASS** — both with conditions to address during implementation.

---

## Inputs Reviewed

- `specs/runtime/ui-05-env-configuration/spec.md`
- `specs/runtime/ui-05-env-configuration/plan.md`
- `specs/runtime/ui-05-env-configuration/research.md`
- `specs/runtime/ui-05-env-configuration/data-model.md`
- `specs/runtime/ui-05-env-configuration/quickstart.md`
- `specs/runtime/ui-05-env-configuration/contracts/env-module-api.md`

---

## Architecture Layers Touched

| Layer           | Planned Changes                                                                                                                                                               |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API             | None                                                                                                                                                                          |
| Worker          | None                                                                                                                                                                          |
| Frontend        | core/config/ in MMC, Backoffice, Frontoffice: env.ts (refactor), app-config.ts (new), feature-flags.ts (new), eslint.config.js (lint rule), vite-env.d.ts (type augmentation) |
| DB Master       | None                                                                                                                                                                          |
| DB Tenant       | None                                                                                                                                                                          |
| Shared Packages | packages/types: env-config.ts (new, type-only)                                                                                                                                |

---

## Key Technical Decisions

| #   | Decision                                                        | Rationale                                                            |
| --- | --------------------------------------------------------------- | -------------------------------------------------------------------- |
| 1   | Factory function pattern `createEnvConfig(overrides?)`          | Enables test mockability without vi.stubEnv()/vi.resetModules()      |
| 2   | Three-file structure: env.ts → feature-flags.ts → app-config.ts | Separation of concerns: raw parsing, flag normalization, aggregation |
| 3   | Shared types in packages/types (type-only)                      | Compile-time consistency across apps with zero runtime coupling      |
| 4   | ESLint no-restricted-syntax AST selector                        | Catches import.meta.env usage at lint time, prevents config sprawl   |
| 5   | Object.freeze() for immutability                                | Simple, no-dependency solution for FR-006/FR-015                     |
| 6   | Backoffice extends base with optional workspaceSlug             | Dev convenience only; production context from route/backend          |

---

## Migration Impact

| Item                  | Value | Notes                                   |
| --------------------- | ----- | --------------------------------------- |
| Migration required    | No    | No DB schema changes                    |
| `schema_version` bump | No    | Frontend-only stage                     |
| Backward compatible   | Yes   | Module-level appConfig export preserved |

---

## Transaction Boundaries

- N/A — Frontend-only stage. No database writes.

---

## Idempotency Strategy

- N/A — Configuration is read-only and initialized once.

---

## Guardian Validation Results

| Guardian             | Verdict | Conditions                                                                                              |
| -------------------- | ------- | ------------------------------------------------------------------------------------------------------- |
| Architecture Checker | PASS    | Fix feature-flags.ts direct import.meta.env access; resolve normalizeAppEnv vs spec conflict            |
| API Designer         | PASS    | Fix feature-flags.ts factory testability; align contract export; document MODE → VITE_APP_ENV migration |

### Conditions to Address During Implementation

1. **feature-flags.ts must not read import.meta.env directly** — Route all env reads through env.ts per D3
2. **normalizeAppEnv must handle unrecognized values** — All mode helpers should return false for unknown modes per spec US3/AS4
3. **createFeatureFlags must use its parameter** — Accept overrides for testability
4. **Add standalone featureFlags export** to app-config.ts per contract
5. **Document MODE → VITE_APP_ENV migration** in implementation tasks

---

## Constitutional Compliance

| Check                                  | Status | Notes                                         |
| -------------------------------------- | ------ | --------------------------------------------- |
| No cross-tenant logic introduced       | ✅     | Frontend-only; no tenant DB access            |
| All writes are transactional by design | ✅     | N/A — no writes                               |
| Server-authoritative time enforced     | ✅     | N/A — no time logic                           |
| License middleware enforced            | ✅     | N/A — no backend routes                       |
| Version compatibility enforced         | ✅     | N/A — no version checks needed                |
| No architecture redesign without ADR   | ✅     | Evolutionary change within existing structure |

**Overall:** COMPLIANT

---

## Implementation Files (Declared Scope)

```
packages/types/src/env-config.ts          # NEW
packages/types/src/index.ts               # MODIFIED

apps/mmc/src/core/config/env.ts           # MODIFIED
apps/mmc/src/core/config/app-config.ts    # NEW
apps/mmc/src/core/config/feature-flags.ts # NEW
apps/mmc/src/vite-env.d.ts                # MODIFIED
apps/mmc/eslint.config.js                 # MODIFIED
apps/mmc/.env.example                     # NEW/MODIFIED

apps/backoffice/src/core/config/env.ts           # MODIFIED
apps/backoffice/src/core/config/app-config.ts    # NEW
apps/backoffice/src/core/config/feature-flags.ts # NEW
apps/backoffice/src/vite-env.d.ts                # MODIFIED
apps/backoffice/eslint.config.js                 # MODIFIED
apps/backoffice/.env.example                     # NEW/MODIFIED

apps/frontoffice/src/core/config/env.ts           # MODIFIED
apps/frontoffice/src/core/config/app-config.ts    # NEW
apps/frontoffice/src/core/config/feature-flags.ts # NEW
apps/frontoffice/src/vite-env.d.ts                # MODIFIED
apps/frontoffice/eslint.config.js                 # MODIFIED
apps/frontoffice/.env.example                     # NEW/MODIFIED

apps/mmc/tests/unit/core/env-config.test.ts       # MODIFIED
apps/mmc/tests/unit/core/feature-flags.test.ts    # NEW
apps/mmc/tests/unit/core/app-config.test.ts       # NEW

apps/backoffice/tests/unit/core/env-config.test.ts       # MODIFIED
apps/backoffice/tests/unit/core/feature-flags.test.ts    # NEW
apps/backoffice/tests/unit/core/app-config.test.ts       # NEW

apps/frontoffice/tests/unit/core/env-config.test.ts       # MODIFIED
apps/frontoffice/tests/unit/core/feature-flags.test.ts    # NEW
apps/frontoffice/tests/unit/core/app-config.test.ts       # NEW
```

---

## Open Risks

- Low: Existing code references import.meta.env (lint rule catches at CI)
- Low: Migration of appConfig import paths (search-and-replace)

---

## Next Step

Proceed to Step 4 — Tasks.
