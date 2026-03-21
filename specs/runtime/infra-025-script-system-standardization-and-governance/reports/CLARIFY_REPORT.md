# Clarify Report — Script System Standardization And Governance

**Step:** 2 — Clarify
**Timestamp:** 2026-03-21T00:00:00Z
**Status:** COMPLETE

---

## Summary

All 5 targeted clarification questions were resolved using the stage file as authority. No blockers remain. The spec has been updated in-place with a `## Clarifications / ### Session 2026-03-21` section. Three checklists were generated (security, performance, governance). Risk level computed as **LOW** (11 tasks → +1 point only; no DB, no security surfaces, no external APIs).

---

## Inputs Reviewed

- `specs/runtime/infra-025-script-system-standardization-and-governance/spec.md` (including `## Clarifications`)

---

## Clarifications Resolved

| #   | Question                                                                                      | Resolution                                                                                                                                                                                                                               | Impact                                                           |
| --- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 1   | Do validation scripts fail-fast or report all violations?                                     | **Report-all mode** mandated. Both `validate/script-naming.ts` and `validate/script-usage.ts` must collect and emit the complete violation set before exiting. Fail-fast is prohibited.                                                  | FR-008 updated. Enables single-pass remediation.                 |
| 2   | Which CI workflow file receives the script governance steps?                                  | **`architecture-governance.yml`** only. Script governance is a governance concern; steps are added as a new `# Script System Governance` block inside the existing job. No new workflow file created.                                    | FR-009 updated. Bounds CI integration scope.                     |
| 3   | Does the refactor engine scan `.sh` files?                                                    | **Yes.** The file-match regex must include `\.sh$`. The stage file skeleton omits this and must be corrected during implementation.                                                                                                      | FR-004 updated. Prevents `.sh` references being left unreplaced. |
| 4   | Are lifecycle scripts (`build`, `test`, `lint`, etc.) exempt from duplicate-name enforcement? | **Yes.** Standard lifecycle scripts that exist across all workspaces are exempt from the deduplication rule. Only governance-pattern names (`<domain>:<action>[:<scope>]`) are subject to the duplicate check.                           | FR-002 updated. Prevents false positives on common script names. |
| 5   | Does the AI skill supersede or supplement existing script documentation?                      | **Supplement.** `AGENTS.md` and inline docs remain authoritative for their declared scope. The skill provides operational governance for agents creating, renaming, or validating scripts — it does not override existing documentation. | FR-011 clarified. Avoids documentation conflicts.                |

---

## Risk Level Computation

| Factor                        | Points |
| ----------------------------- | ------ |
| Database migration            | 0      |
| New table / column            | 0      |
| Security-sensitive logic      | 0      |
| Worker interaction            | 0      |
| Multi-tenant isolation logic  | 0      |
| External API integration      | 0      |
| More than 10 tasks (11 tasks) | +1     |
| New package dependency        | 0      |
| **Total**                     | **1**  |

**Risk Level: LOW**

---

## Checklists Generated

| File                        | Items | Focus                                                                                                       |
| --------------------------- | ----- | ----------------------------------------------------------------------------------------------------------- |
| `checklists/security.md`    | 20    | Injection in script names, secrets in outputs, file-write boundary, path traversal, AI skill authority      |
| `checklists/performance.md` | 22    | Validation time budgets, refactor engine scan cost, CI overhead, registry staleness detection               |
| `checklists/governance.md`  | 45    | Domain map completeness, naming precision, migration map integrity, CI bypass prevention, orchestrator gate |

---

## Open Items

None — all clarifications resolved. Ready for technical planning.
