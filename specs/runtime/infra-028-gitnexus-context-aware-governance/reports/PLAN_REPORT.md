# Plan Report — GitNexus Context-Aware Governance

**Step:** 3 — Plan
**Timestamp:** 2026-03-25T00:20:00Z
**Status:** COMPLETE

---

## Summary

Technical plan produced for INFRA-28. Four new TypeScript scripts (`build.ts`, `changed.ts`, `impact.ts`, `validate.ts`) will be created under `scripts/context/`. No HTTP layer, no database, no migration required. All existing architecture boundaries preserved. Pure additive tooling: scripts registered in `package.json`, two new guards prepended to `governance/gate.ts`, pre-commit hook updated, CI workflow updated. Risk Level: LOW.

---

## Inputs Reviewed

- `specs/runtime/infra-028-gitnexus-context-aware-governance/spec.md`
- `specs/runtime/infra-028-gitnexus-context-aware-governance/plan.md`
- `specs/runtime/infra-028-gitnexus-context-aware-governance/research.md`

---

## Architecture Layers Touched

| Layer                  | Planned Changes                                                                                                             |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| API                    | None                                                                                                                        |
| Worker                 | None                                                                                                                        |
| Frontend               | None                                                                                                                        |
| DB Master              | None                                                                                                                        |
| DB Tenant              | None                                                                                                                        |
| Infrastructure/Tooling | `scripts/context/` (4 scripts + 1 test). `governance/gate.ts` modified. `.husky/pre-commit` modified. CI workflow modified. |

---

## Key Technical Decisions

| #   | Decision                                                              | Rationale                                                            |
| --- | --------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 1   | Atomic write (`.tmp` + `renameSync`) for all context artifacts        | Prevents partial/corrupt files on CI or interrupted pre-commit       |
| 2   | No external JSON Schema library in `validate.ts` (NFR-005)            | No new package dependencies introduced                               |
| 3   | `context:validate` reads `schema.version` from JSON file (not import) | `SCHEMA_VERSION` in `gitnexus-context.ts` is not exported            |
| 4   | `context:changed` has 5-minute freshness cache                        | Pre-commit runs fast — avoids repeated `git diff` on same staged set |
| 5   | `context:impact` filters `riskIndicators` from `assembleContext()`    | Reuses existing BFS/impact data; no custom graph traversal           |

---

## Migration Impact

| Item                  | Value | Notes                                       |
| --------------------- | ----- | ------------------------------------------- |
| Migration required    | No    | No database touched                         |
| `schema_version` bump | No    | Schema file read-only; no structural change |
| Backward compatible   | Yes   | Additive only — old scripts unchanged       |

---

## Transaction Boundaries

- No database writes. All filesystem writes use atomic pattern (`writeFileSync` on tmp + `renameSync`).

---

## Idempotency Strategy

- `context:build`: idempotent — re-generates with `--force`, skips if fresh (<24h) by default
- `context:changed`: cached 5 min — returns early if artifact is fresh
- `context:impact`: deterministic from current inputs — re-run always safe
- `context:validate`: read-only — inherently idempotent

---

## Constitutional Compliance

| Check                                  | Status | Notes                                        |
| -------------------------------------- | ------ | -------------------------------------------- |
| No cross-tenant logic introduced       | ✅     | Scripts have no tenant isolation concern     |
| All writes are transactional by design | ✅     | Atomic filesystem writes via `renameSync`    |
| Server-authoritative time enforced     | ✅     | `new Date().toISOString()` — no client clock |
| License middleware enforced            | ✅ N/A | No HTTP routes                               |
| Version compatibility enforced         | ✅     | `context:validate` `schemaVersion` check     |
| No architecture redesign without ADR   | ✅     | Pure tooling stage, no ADR required          |

**Overall:** COMPLIANT
