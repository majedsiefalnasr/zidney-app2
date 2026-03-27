# Plan Report — Unified Governance Gate System

**Step:** 3 — Plan  
**Timestamp:** 2026-03-25T01:00:00Z  
**Status:** COMPLETE

---

## Summary

The technical plan for INFRA-27 is complete and guardian-validated. This is a pure tooling stage — no
database, no HTTP routes, no tenant logic. Three new TypeScript files are created under
`scripts/governance/` alongside five new `package.json` entries. Pre-commit and CI workflow receive
incremental additions (one new bash line and one new YAML step respectively). The stage also delivers
`governance` as the 10th canonical domain in `.agents/skills/script-system-governance/SKILL.md`.

Guardian validation passed after two remediation rounds addressing:

- Script name corrections in spec.md (FR-003 stale hyphenated name)
- API contract clarifications (FR-004 exit-0 contract, FR-001 passthrough, FR-003 fail-fast semantics)
- Dependency table accuracy (`ai-context:validate` correctly identified as INFRA-27 deliverable)
- CI insertion-point consistency fixed (spec Q4 corrected: 17 steps, after step 17)
- SKILL.md updated: 10-domain canonical list, `scripts/governance/` in Script Location Policy

---

## Inputs Reviewed

- `specs/runtime/infra-027-unified-governance-gate-system/spec.md` (296 lines, including clarifications)
- `specs/runtime/infra-027-unified-governance-gate-system/plan.md` (519 lines)
- `specs/runtime/infra-027-unified-governance-gate-system/research.md` (208 lines)
- No `data-model.md` (N/A — no DB)
- No `contracts/` (N/A — no HTTP surface)

---

## Architecture Layers Touched

| Layer        | Planned Changes                                                                                                     |
| ------------ | ------------------------------------------------------------------------------------------------------------------- |
| Tooling      | New: `scripts/governance/gate.ts`, `gate-ci.ts`, `report.ts`                                                        |
| package.json | New: `ai-context:validate`, `governance:gate`, `governance:gate:ci`, `governance:gate:changed`, `governance:report` |
| Pre-commit   | Add: `bun run governance:gate:changed` after Trivy secret scan                                                      |
| CI Workflow  | Add: Step 18 — Unified Governance Gate (`bun run governance:gate:ci`) after step 17                                 |
| Orchestrator | Document: Step 6 pre-execution gate → `governance:gate:changed`; Step 7 closure → `governance:gate`                 |
| SKILL.md     | Update: 10th domain `governance` + `scripts/governance/` Script Location Policy entry                               |
| .gitignore   | Add: `docs/governance/governance-report.md`                                                                         |
| API          | None                                                                                                                |
| Worker       | None                                                                                                                |
| Frontend     | None                                                                                                                |
| DB Master    | None (no migration)                                                                                                 |
| DB Tenant    | None (no migration)                                                                                                 |

---

## Key Technical Decisions

| #   | Decision                                                                                                                        | Rationale                                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `gate.ts` runs all guards sequentially using `$.nothrow()` and collects exit codes before deciding final exit (report-all mode) | Spec FR-001 mandates report-all — prevents silent single-guard masking of cumulative violations                                 |
| 2   | `gate-ci.ts` wraps `gate.ts` via `bun run governance:gate` delegation, not direct import                                        | Keeps CI variant orthogonal; `gate.ts` can evolve without changing the CI entry point                                           |
| 3   | `governance:gate:changed` is a single-line `package.json` script using `&&` (fail-fast)                                         | Good enough for pre-commit speed; FR-005 explicitly permits single-line scripts for simple compositions                         |
| 4   | `governance:report` always exits 0                                                                                              | Audit/report tools must never block pipelines; callers read the report file, not the exit code                                  |
| 5   | `ai-context:validate` alias created in INFRA-27                                                                                 | INFRA-22 delivers the underlying scripts; the alias unification is an INFRA-27 deliverable per spec clarification Q1            |
| 6   | `docs/governance/governance-report.md` added to `.gitignore`                                                                    | Prevents stale reports from being tracked in SCM (confirmed gap in clarification Q3)                                            |
| 7   | `core/governance-validator.ts` NOT imported by gate scripts                                                                     | Research confirmed it is a type-safety/brain utility unrelated to gate orchestration; gate uses only `bun $` shell delegation   |
| 8   | `governance` registered as 10th canonical domain                                                                                | Architecture Guardian HIGH finding resolved within this stage scope rather than tracked separately                              |
| 9   | SKILL.md updated as in-scope INFRA-27 deliverable                                                                               | Following Architecture Guardian ruling — aligns naming policy with actual usage, prevents `validate:scripts:naming` CI failures |

---

## Migration Impact

| Item                  | Value | Notes                          |
| --------------------- | ----- | ------------------------------ |
| Migration required    | No    | No database changes whatsoever |
| `schema_version` bump | No    | N/A                            |
| Backward compatible   | Yes   | All changes additive           |

---

## Transaction Boundaries

- N/A — no database operations, no mutable shared state
- `governance:gate` is idempotent by design: deterministic subprocess delegation, no state mutation

---

## Idempotency Strategy

- Running `governance:gate` or `governance:gate:ci` multiple times on unchanged repository state produces
  identical exit codes and identical output. No guards are stateful.
- `governance:report` re-writes `docs/governance/governance-report.md` (idempotent file write). The
  output is deterministic given the same repository state.

---

## Constitutional Compliance

| Check                                    | Status | Notes                                             |
| ---------------------------------------- | ------ | ------------------------------------------------- |
| No cross-tenant logic introduced         | ✅     | N/A — pure tooling, no routes, no workspace logic |
| All writes are transactional by design   | ✅     | N/A — no DB writes                                |
| Server-authoritative time enforced       | ✅     | N/A — no time-sensitive operations                |
| License middleware enforced              | ✅     | N/A — no HTTP routes                              |
| Version compatibility enforced           | ✅     | N/A — no package versioning logic                 |
| No architecture redesign without ADR     | ✅     | Pure tooling orchestration layer only             |
| Import boundaries: `scripts/` → `apps/*` | ✅     | Forbidden — gate uses shell delegation only       |
| Exit code contract (0/1 only)            | ✅     | FR-011 — fully specified                          |
| No duplicate validation logic            | ✅     | FR-010 — gate is orchestration only               |

**Overall:** COMPLIANT

---

## Guardian Verdicts

| Guardian              | Verdict | Attempt                                 |
| --------------------- | ------- | --------------------------------------- |
| Architecture Guardian | PASS    | 2 (initial: PASS with HIGH; remediated) |
| API Designer          | PASS    | 2 (initial: BLOCKED; remediated)        |

Remediation rounds applied:

- Round 1: FR-003 script name, dependency table, Q4 CI step count, FR-004 exit-code contract, FR-001 passthrough, FR-003 fail-fast semantics, pre-commit scope exclusion, FR-002 annotations, SKILL.md 10-domain update
- Round 2: plan.md stale "tracked exception" comments removed, plan.md gate.ts metadata NOTE removed, SKILL.md §3 example and Anti-Patterns table updated

---

## Open Risks

| Risk                                                        | Likelihood | Impact | Status                                                                   |
| ----------------------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------ |
| One or more upstream guards not yet passing on clean branch | Medium     | High   | Must verify independently before Step 6                                  |
| `governance:gate:changed` exceeds 10-second target          | Medium     | Medium | Profile `arch:guard:changed` in integration test                         |
| Report file accidentally committed                          | Low        | Low    | Mitigated — `docs/governance/governance-report.md` added to `.gitignore` |

---

## Files Produced

| File                                                                 | Size       | Status                                          |
| -------------------------------------------------------------------- | ---------- | ----------------------------------------------- |
| `specs/runtime/infra-027-unified-governance-gate-system/plan.md`     | 519 lines  | Written                                         |
| `specs/runtime/infra-027-unified-governance-gate-system/research.md` | 208 lines  | Written                                         |
| `specs/runtime/infra-027-unified-governance-gate-system/spec.md`     | ~296 lines | Updated (guardian corrections)                  |
| `.agents/skills/script-system-governance/SKILL.md`                   | Updated    | 10-domain table, location policy, anti-patterns |

---

## Next Step

Proceed to Step 4 — Tasks.
