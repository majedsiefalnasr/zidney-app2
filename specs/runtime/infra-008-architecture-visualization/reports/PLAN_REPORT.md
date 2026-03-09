# Plan Report — STAGE_INFRA_08_ARCHITECTURE_VISUALIZATION

**Step:** 3 — Plan
**Timestamp:** 2026-03-09T00:00:00.000Z
**Status:** COMPLETE

---

## Summary

A complete 6-step implementation plan has been generated for the architecture visualization pipeline. The plan introduces `scripts/architecture/visualize.ts` — a standalone read-only script that converts existing audit output into curated Mermaid diagrams stored in `docs/architecture/visualization/`. No database, no API routes, no tenant logic — pure developer tooling.

Guardian Plan Validation:

- Zidney Architecture Checker: **VERDICT: PASS** (no critical or high findings)
- Zidney API Designer: **N/A — PASS** (no API routes, endpoints, or middleware in scope)

---

## Inputs Reviewed

- `specs/runtime/infra-008-architecture-visualization/spec.md`
- `specs/runtime/infra-008-architecture-visualization/plan.md`
- `specs/runtime/infra-008-architecture-visualization/research.md`
- `specs/runtime/infra-008-architecture-visualization/data-model.md`
- `docs/architecture/graphs/dependency-graph.json` (actual schema)
- `docs/architecture/intelligence/ARCHITECTURE_MAP.json` (actual schema)
- `scripts/architecture/` (existing patterns)
- `scripts/infra-audit.ts` (data source)

---

## Architecture Layers Touched

| Layer          | Planned Changes                                                                                           |
| -------------- | --------------------------------------------------------------------------------------------------------- |
| API            | None                                                                                                      |
| Worker         | None                                                                                                      |
| Frontend       | None                                                                                                      |
| DB Master      | None                                                                                                      |
| DB Tenant      | None                                                                                                      |
| Infrastructure | `scripts/architecture/visualize.ts` (new file), `docs/architecture/visualization/` (generated at runtime) |
| Config         | `package.json` — add `arch:visualize` script entry                                                        |
| Tests          | `tests/unit/visualize/` (new), `tests/static/06-architecture-visualization.test.ts` (new)                 |

---

## Key Technical Decisions

| #   | Decision                                                                               | Rationale                                                                               |
| --- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 1   | Use `node:fs` / `node:path` instead of Bun file APIs                                   | Vitest mockability — all existing arch scripts use `node:fs` for the same reason        |
| 2   | All diagram generator functions are pure and exportable                                | Unit testability — no I/O inside generator functions; I/O only in `main()`              |
| 3   | `generateSystemOverview()` takes no parameters                                         | Static trust chain is hardcoded architectural knowledge, not derived from import graph  |
| 4   | Git SHA injected into output README via `execSync('git rev-parse HEAD')` with fallback | Provides generation provenance without requiring git as a hard dependency               |
| 5   | Heuristic fallback: `apps/*` → runtime/ui, `packages/*` → domain/infrastructure        | Covers 100% of unregistered modules in the actual dependency graph                      |
| 6   | No `vi.mock` in unit tests — fixture-driven testing                                    | Pure functions with fixture inputs are more readable and reliable than mock-based tests |

---

## Implementation Plan (6 Steps)

| Step | File                                                          | Action                                                 |
| ---- | ------------------------------------------------------------- | ------------------------------------------------------ |
| 1    | `tests/unit/visualize/fixtures/dependency-graph.fixture.json` | Create — minimal test fixture                          |
| 2    | `tests/unit/visualize/fixtures/architecture-map.fixture.json` | Create — minimal test fixture                          |
| 3    | `scripts/architecture/visualize.ts`                           | Create — main script (all exported functions + main()) |
| 4    | `tests/unit/visualize/visualize.test.ts`                      | Create — 12 unit tests                                 |
| 5    | `tests/static/06-architecture-visualization.test.ts`          | Create — 6 static tests                                |
| 6    | `package.json`                                                | Modify — add `arch:visualize` entry                    |

---

## Migration Impact

| Item                  | Value | Notes                                                          |
| --------------------- | ----- | -------------------------------------------------------------- |
| Migration required    | No    | Pure tooling, no DB changes                                    |
| `schema_version` bump | No    | Not applicable                                                 |
| Backward compatible   | Yes   | Additive only — no existing files modified except package.json |

---

## Transaction Boundaries

- Not applicable. No database writes. Script writes to filesystem only; OS-level atomicity is sufficient for documentation artifacts.

---

## Idempotency Strategy

- Fully idempotent by design. Running `bun run arch:visualize` multiple times overwrites output files with identical content (byte-identical given the same input files). Output directory is created if missing.

---

## Constitutional Compliance

| Check                                  | Status | Notes                                                |
| -------------------------------------- | ------ | ---------------------------------------------------- |
| No cross-tenant logic introduced       | ✅     | No tenant context of any kind                        |
| All writes are transactional by design | ✅ N/A | Filesystem writes; no DB transactions needed         |
| Server-authoritative time enforced     | ✅ N/A | No time-sensitive logic                              |
| License middleware enforced            | ✅ N/A | No API routes                                        |
| Version compatibility enforced         | ✅ N/A | No schema version changes                            |
| No architecture redesign without ADR   | ✅     | Additive tooling only; no architecture layer changes |

**Overall:** COMPLIANT

---

## Open Risks

- `dependency-graph.json` schema change by upstream `infra-audit.ts` update: mitigated by defensive JSON parsing
- `packages/app` and `packages/ui` (unregistered modules) trigger heuristic fallback + warning: explicitly handled per Q2 clarification

---

## Next Step

Proceed to Step 4 — Tasks.
