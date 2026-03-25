# Specify Report — Unified Governance Gate System

**Step:** 1 — Specify
**Timestamp:** 2026-03-25T00:10:00Z
**Status:** COMPLETE

---

## Summary

Specification complete. INFRA-27 introduces a unified governance gate system that composes 5 existing guards (`arch:guard`, `validate:types`, `validate:runtime-scripts`, `script:usage-scan`, `security:scan:ci`, `ai-context:validate`) into a single deterministic pipeline callable via `governance:gate`, `governance:gate:ci`, and `governance:gate:changed`. The spec captures pre-commit, CI, and orchestrator integration points along with a report generation command. 5 user stories and 11 functional requirements defined. No architectural decisions required — this is a pure script-composition stage.

---

## Inputs Reviewed

- `specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_27_UNIFIED_GOVERNANCE_GATE_SYSTEM.md`
- `specs/runtime/infra-025-script-system-standardization-and-governance/spec.md`
- `specs/runtime/infra-026-trivy-security-scanning-and-enforcement/spec.md`
- `docs/PROJECT_CONTEXT_PRIMER.md`
- `.agents/skills/script-system-governance/SKILL.md`

---

## Key Decisions

| #   | Decision                                                                                   | Rationale                                                                                            |
| --- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| 1   | Gate runs all guards sequentially in report-all mode                                       | Fail-fast would hide multiple violations; report-all lets developers fix all issues in one pass      |
| 2   | `governance:gate:changed` scoped to `arch:guard:changed` + `validate:runtime-scripts` only | Fast pre-commit feedback budget (< 10s); full security and type scans run in CI                      |
| 3   | Gate is an orchestration layer only — no new validation logic                              | Prevents drift and duplication across the governance stack                                           |
| 4   | `governance` domain registered as tracked exception to 9-domain naming policy              | Separate concern from existing domains; pending skill update tracked as risk                         |
| 5   | Report output to `docs/governance/governance-report.md`                                    | Consistent with existing `docs/` artefact patterns; `.gitignore` treatment deferred to clarification |

---

## Functional Requirements Captured

- FR-001: `governance:gate` — full sequential composition of 6 guards
- FR-002: `governance:gate:ci` — CI strict-mode wrapper
- FR-003: `governance:gate:changed` — scoped to changed files, < 10s budget
- FR-004: `governance:report` — consolidated markdown report to `docs/governance/`
- FR-005: All implementation files under `scripts/governance/`
- FR-006: 5-field metadata headers on all `.ts` gate files
- FR-007: `.husky/pre-commit` extended with `governance:gate:changed`
- FR-008: `.github/workflows/architecture-governance.yml` receives `Unified Governance Gate` step
- FR-009: Orchestrator updated for Step 6 and Step 7 gate calls
- FR-010: No duplicate validation logic — composition only
- FR-011: Exit code policy: 0=pass, 1=fail, warnings never fail

---

## Clarifications Required

None — all requirements are well-defined from the stage file and prior INFRA stage specs.

---

## Constitutional Compliance

| Check                                   | Status | Notes                                  |
| --------------------------------------- | ------ | -------------------------------------- |
| No cross-tenant access introduced       | ✅     | Pure tooling stage — no tenant surface |
| License middleware requirement captured | ✅ N/A | No HTTP routes                         |
| Snapshot integrity requirement captured | ✅ N/A | Not applicable                         |
| Idempotency strategy defined            | ✅     | Same repo state → same exit code       |
| Transaction boundaries identified       | ✅ N/A | No DB access                           |
| Server-authoritative time enforced      | ✅ N/A | Not applicable                         |

**Overall:** COMPLIANT

---

## Open Risks

| Risk                                               | Severity | Notes                                           |
| -------------------------------------------------- | -------- | ----------------------------------------------- |
| Upstream guards not yet all passing                | HIGH     | Must verify all 5 upstreams before wiring gate  |
| `governance:gate:changed` exceeds 10s target       | MEDIUM   | Profile `arch:guard:changed` separately         |
| `governance` domain exception to naming policy     | LOW      | Document as tracked exception                   |
| Report file accidentally committed with stale data | LOW      | `.gitignore` treatment to be decided in Clarify |
