# Clarify Report — STAGE_INFRA_16_REPOSITORY_SANITIZATION_AND_DEAD_CODE_ELIMINATION

**Step:** 2 — Clarify  
**Timestamp:** 2026-03-13T22:58:31Z  
**Status:** COMPLETE

---

## Summary

The clarification pass resolved the remaining governance-specific ambiguities without requiring an interactive question round. The spec now explicitly defines protected assets, the evidence threshold for dead-asset removal, and the minimum validation gates that must still pass after repository cleanup.

---

## Inputs Reviewed

- `specs/runtime/infra-016-repository-sanitization-and-dead-code-elimination/spec.md` (including `## Clarifications`)

---

## Clarifications Resolved

| #   | Question                                                 | Resolution                                                                                                                                                                 | Impact                                                                                          |
| --- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 1   | Which low-frequency assets are still non-removable?      | Governance and safety assets remain protected, including architecture docs, AI docs, CI workflows, Husky hooks, and core governance scripts.                               | Prevents accidental deletion of infrastructure that underpins validation and AI context.        |
| 2   | What proof is required before an asset is declared dead? | Removal requires zero unresolved evidence across source imports, tests, package scripts, CI, hooks, AGENTS and skill references, AI-context paths, and governance reports. | Raises the evidence bar for cleanup and forces ambiguous cases into retention or manual review. |
| 3   | Which post-sanitization gates are mandatory?             | The minimum validation chain includes lint, typecheck, test, arch:guard, infra-audit, validate-architecture-brain, type-safety-guard, and ai-context refresh.              | Makes the implementation and acceptance criteria concrete and auditable.                        |

---

## Open Items

- None

---

## Spec Updates Applied

- Added a `Clarifications` section with a dated session entry.
- Tightened edge cases and cleanup classification criteria around protected and ambiguous assets.
- Added the explicit minimum validation set required after sanitization.

---

## Constitutional Compliance

| Check                                     | Status | Notes                                                                                                         |
| ----------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------- |
| All material ambiguities resolved         | ✅     | No user-interactive clarification was needed after the repo-derived clarifications were written into the spec |
| Transaction strategy confirmed            | ✅     | No database or transactional behavior is introduced in this repository-governance stage                       |
| Idempotency strategy confirmed            | ✅     | Cleanup decisions remain deterministic and auditable through the sanitization inventory and report            |
| Isolation boundaries confirmed            | ✅     | Tenant isolation and app/package boundaries remain unchanged and explicitly protected                         |
| Version and license constraints confirmed | ✅     | License, version, and runtime invariants are unchanged and remain out of scope                                |

**Overall:** COMPLIANT

---

## Open Risks

- Ambiguous low-frequency assets can still produce false positives during implementation; the spec now requires retention or manual review in those cases.

---

## Next Step

Proceed to Step 3 — Plan.
