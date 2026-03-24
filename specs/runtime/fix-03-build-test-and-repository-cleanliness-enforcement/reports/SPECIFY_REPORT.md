# Specify Report — STAGE FIX 03 — Build Test and Repository Cleanliness Enforcement

**Step:** 1 — Specify  
**Timestamp:** 2026-03-24T00:00:00Z  
**Status:** COMPLETE

---

## Summary

Specification drafted for the Build, Test, and Repository Cleanliness Enforcement stage. This stage introduces a unified, policy-engine-driven enforcement layer ensuring the workspace builds cleanly, the full test suite passes in isolation, and the repository contains no stale or unauthorized generated artifacts. All validation rules are registered in the shared Policy Engine (INFRA-29) and invoked via `bun run validate:policy`.

---

## Inputs Reviewed

- `specs/runtime/fix-03-build-test-and-repository-cleanliness-enforcement/spec.md`
- `specs/runtime/fix-03-build-test-and-repository-cleanliness-enforcement/checklists/requirements.md`
- `specs/phases/0X_FIXES/STAGE_FIX_03_BUILD_TEST_AND_REPOSITORY_CLEANLINESS_ENFORCEMENT.md`

---

## Key Decisions

| #   | Decision                                                        | Rationale                                                                                                         |
| --- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 1   | All validation rules implemented as Policy Engine rules         | Stage spec explicitly requires INFRA-29 Policy Engine alignment — no direct execution logic outside policy engine |
| 2   | `--changed` mode uses GitNexus context for impact scoping       | INFRA-28 alignment: avoid redundant full-workspace runs for incremental commits                                   |
| 3   | `--full` mode executes complete validation for CI/closure       | Ensures CI runs are deterministic and comprehensive                                                               |
| 4   | Auto-fix attempt (RULE_FIX_03_AUTO_FIX_ATTEMPT) before blocking | Improves DX by correcting fixable lint/format issues automatically before failing                                 |
| 5   | Artifact allowlist enforcement (RULE_FIX_03_ARTIFACT_ALLOWLIST) | Prevents generated artifact drift — only `docs/ai/context/*`, `docs/architecture/intelligence/*`, `dist/` allowed |

---

## Functional Requirements Captured

- FR-001: Policy Engine rules registered and executable via `bun run validate:policy --changed` / `--full`
- FR-002: Environment readiness check (RULE_FIX_03_ENVIRONMENT_READY) — PostgreSQL, Redis, ENV vars, runtime versions
- FR-003: Workspace build must pass (RULE_FIX_03_BUILD_PASS)
- FR-004: Full test suite must pass (RULE_FIX_03_TEST_PASS)
- FR-005: Test isolation enforced — no DB/Redis state leakage (RULE_FIX_03_TEST_ISOLATION)
- FR-006: Flaky test detection via re-run (RULE_FIX_03_FLAKY_TEST_DETECTION — warning severity)
- FR-007: Coverage thresholds maintained — global 70%, critical modules 80% (RULE_FIX_03_COVERAGE_THRESHOLD — warning severity)
- FR-008: Repository clean post-execution (RULE_FIX_03_REPO_CLEAN)
- FR-009: No artifact drift — no persistent generated files outside allowlist (RULE_FIX_03_NO_ARTIFACT_DRIFT)
- FR-010: Auto-fix attempt before blocking (RULE_FIX_03_AUTO_FIX_ATTEMPT)
- FR-011: Structured error output with rule references on failure
- FR-012: GitNexus context used for `--changed` mode impact scoping
- FR-013: CI workflows updated to use `validate:policy --full` exclusively
- FR-014: Husky pre-commit/pre-push hooks invoke policy engine
- FR-015: Script naming follows `validate:policy` governance convention

---

## Clarifications Required

None — all 9 platform constraints are mapped to NFCs. No `[NEEDS CLARIFICATION]` markers in spec.

---

## Constitutional Compliance

| Check                                   | Status | Notes                                                                         |
| --------------------------------------- | ------ | ----------------------------------------------------------------------------- |
| No cross-tenant access introduced       | ✅     | Stage is infra-only; no tenant data access                                    |
| License middleware requirement captured | ✅     | NFC-003 — license middleware preserved on all workspace routes                |
| Snapshot integrity requirement captured | ✅     | NFC-001 — no architecture redesign; snapshot-related code excluded from scope |
| Idempotency strategy defined            | ✅     | NFC-006 — policy engine runs deterministic, order-defined rule sets           |
| Transaction boundaries identified       | ✅     | NFC-005 — all writes transactional (N/A for this infra stage)                 |
| Server-authoritative time enforced      | ✅     | NFC-004 — applies to any timestamp generated                                  |

**Overall:** COMPLIANT

---

## Open Risks

- Medium: Policy Engine integration (INFRA-29) must be fully operational before this stage implements its rules. Verified via clarification step.
- Low: Flaky test detection is warning-severity — won't block CI but should be monitored.

---

## Next Step

Proceed to Step 2 — Clarify.
