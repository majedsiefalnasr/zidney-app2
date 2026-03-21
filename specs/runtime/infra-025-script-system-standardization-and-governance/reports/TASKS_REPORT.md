# Tasks Report — Script System Standardization And Governance

**Step:** 4 — Tasks  
**Timestamp:** 2026-03-21T12:05:05Z  
**Status:** COMPLETE

---

## Summary

14 atomic tasks generated for INFRA-025. All tasks are strictly scoped to developer tooling: validation scripts, refactor engine, package.json renames, CI workflow additions, registry generator update, metadata headers, and AI skill update. No database migrations, no HTTP routes, no frontend components, no tenant logic. Tasks are sequentially ordered with two parallel groups (T003–T005 and T009–T010).

---

## Inputs Reviewed

- `specs/runtime/infra-025-script-system-standardization-and-governance/spec.md` (11 FRs + 5 clarifications)
- `specs/runtime/infra-025-script-system-standardization-and-governance/plan.md` (713 lines)
- `specs/runtime/infra-025-script-system-standardization-and-governance/research.md` (399 lines — 33 violations inventoried)
- `specs/runtime/infra-025-script-system-standardization-and-governance/tasks.md` (14 tasks generated)

---

## Task Breakdown

| Category            | Count  | Tasks      | Notes                                                                 |
| ------------------- | ------ | ---------- | --------------------------------------------------------------------- |
| Foundation docs     | 2      | T001, T002 | Migration map + registry placeholder                                  |
| Validation scripts  | 3      | T003–T005  | script-naming, script-usage, script-infrastructure (parallel group A) |
| Refactor engine     | 1      | T006       | `scripts/dev/refactor-scripts.ts` (`dev:refactor:scripts`)            |
| Registry generator  | 1      | T007       | Update `scripts/generate/script-docs.ts` — 5-field enforcement        |
| Package.json new    | 1      | T008       | 5 new governed entries                                                |
| Metadata headers    | 1      | T009       | 13+ scripts needing `@category`/`@usage` (parallel group B)           |
| Package.json rename | 1      | T010       | 33 renames/removals from migration map (parallel group B)             |
| Live refactor run   | 1      | T011       | Execute dev:refactor:scripts + verify 0 unresolved                    |
| CI integration      | 1      | T012       | Append 4-step block to architecture-governance.yml                    |
| AI skill update     | 1      | T013       | Update .agents/skills/script-system-governance/SKILL.md               |
| Validation gate     | 1      | T014       | Full script governance + CI gate — terminal task                      |
| **Total**           | **14** |            |                                                                       |

---

## Parallel Execution Groups

| Group | Tasks            | Condition                  |
| ----- | ---------------- | -------------------------- |
| A     | T003, T004, T005 | After T001 + T002 complete |
| B     | T009, T010       | After T008 complete        |

All other tasks are sequential. T014 is the terminal gate.

---

## Risk-Ranked Task Summary

| Task | Risk      | Description                                                         |
| ---- | --------- | ------------------------------------------------------------------- |
| T001 | 🟢 LOW    | Create docs/scripts/SCRIPT_MIGRATION_MAP.md                         |
| T002 | 🟢 LOW    | Create docs/scripts/SCRIPT_REGISTRY.md placeholder                  |
| T003 | 🟢 LOW    | Implement scripts/validate/script-naming.ts                         |
| T004 | 🟢 LOW    | Implement scripts/validate/script-usage.ts                          |
| T005 | 🟢 LOW    | Implement scripts/validate/script-infrastructure.ts                 |
| T006 | 🟢 LOW    | Implement scripts/dev/refactor-scripts.ts                           |
| T007 | 🟢 LOW    | Update scripts/generate/script-docs.ts                              |
| T008 | 🟡 MEDIUM | Add 5 new entries to root package.json                              |
| T009 | 🟢 LOW    | Add metadata fields to 13+ existing scripts                         |
| T010 | 🟡 MEDIUM | Apply 33 renames/removals to root package.json — large surface area |
| T011 | 🟡 MEDIUM | Live refactor engine run — mutates docs/specs/agents/CI content     |
| T012 | 🟡 MEDIUM | Append CI block to architecture-governance.yml                      |
| T013 | 🟢 LOW    | Update .agents/skills/script-system-governance/SKILL.md             |
| T014 | 🟡 MEDIUM | Full validation gate — all checks must exit 0                       |

---

## Tasks with External Dependencies

None identified. All tooling uses bun built-ins, Bun APIs, and node:fs/node:path. No external npm packages added.

---

## High-Downstream-Impact Tasks

| Task | Impact               | Description                                                                                                                             |
| ---- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| T010 | 🔴 HIGH downstream   | Renames 33 `bun run` script names in root `package.json` — any undiscovered reference in CI, docs, or agents will break after this step |
| T011 | 🟡 MEDIUM downstream | Live refactor engine replaces references in CI workflows, docs, spec files, and agent skills — wide write scope                         |
| T012 | 🟡 MEDIUM downstream | CI step additions affect all contributors' `architecture-governance` workflow runs                                                      |

T010 and T011 have the highest risk of missed references. T011's report (`SCRIPT_REFACTOR_REPORT.md`) is the safety net — "0 unresolved" is the only acceptable exit state.

---

## Transactional Tasks

**N/A** — This stage introduces no database writes. All filesystem writes are idempotent (replaceAll, file.writeFileSync). The refactor engine's dry-run mode provides a transactional preview before live execution.

---

## Idempotency Tasks

- **T006 / T011**: `dev:refactor:scripts` — replaceAll on already-migrated content produces zero matches; re-running is safe.
- **T007 / T005**: `dev:generate:script-docs` + staleness check — normalized diff is empty after first successful run; re-running never fails.
- **T003 / T004 / T005**: Validators are pure read-only — idempotent by definition.

---

## Constitutional Compliance

| Check                                        | Status | Notes                                                                                                   |
| -------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------- |
| All write paths include transaction tasks    | ✅     | N/A — no DB writes; filesystem writes are idempotent                                                    |
| Idempotency tasks are defined where required | ✅     | T006/T011 refactor engine is idempotent; generators are idempotent                                      |
| Layer boundary rules are respected           | ✅     | No `apps/*` or `packages/*` code touched; scope is `scripts/`, `docs/scripts/`, CI, root `package.json` |
| No unrelated file modifications planned      | ✅     | All 14 tasks are strictly scoped within the governance boundary                                         |
| Migration tasks included when required       | ✅     | N/A — no schema migration; T002 creates the registry placeholder                                        |

**Overall:** COMPLIANT

---

## Open Risks

- T010 / T011 combined have the widest write surface. If any `bun run <old-name>` reference exists in an excluded path or in a format the engine's replaceAll doesn't match (e.g. indirect variable references), it will not be caught until a subsequent CI run fails. T014's full gate is the safety net.
- T012: If `.github/workflows/architecture-governance.yml` already has implicit step ordering or `needs:` chains, the implementer must verify appending steps 14–17 does not break step dependency resolution.

---

## Next Step

Proceed to Step 5 — Analyze.
