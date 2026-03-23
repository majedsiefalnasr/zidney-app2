# Safe Rollout Plan — INFRA_AUDIT_CHECKLIST

## Related Documents

- [GAP_REPORT.md](./GAP_REPORT.md)
- [RISK_CLASSIFICATION.md](./RISK_CLASSIFICATION.md)

---

## Audit Metadata

| Field     | Value                                      |
| --------- | ------------------------------------------ |
| Timestamp | 2026-03-04T09:37:45.391Z                   |
| Git SHA   | `10d878c3ae506e15ecd470327598ac87de186fb2` |
| Branch    | `infra-002-audit-checklist`                |
| Status    | AUDIT COMPLETE                             |
| Auditor   | speckit.implement (automated audit stage)  |

---

## Prerequisites

This plan may only be executed when:

1. This stage (`INFRA_AUDIT_CHECKLIST`) is marked **AUDIT COMPLETE**.
2. All three audit reports are present and reviewed:
   - [GAP_REPORT.md](./GAP_REPORT.md) ✅
   - [RISK_CLASSIFICATION.md](./RISK_CLASSIFICATION.md) ✅
   - [SAFE_ROLLOUT_PLAN.md](./SAFE_ROLLOUT_PLAN.md) ✅ (this document)
3. `infra-audit-report.json` has been generated at the current git SHA.
4. No stage-closing work from `STAGE_INFRA_GOVERNANCE` may begin until all Phase 1 items below are
   **verified complete**.

---

## Sequencing Rationale

Remediation is ordered from lowest to highest risk, with each phase depending on the previous:

- **Phase 1 (LOW Risk):** Foundational fixes that are non-breaking, additive-only, and reduce the
  noise that would otherwise obscure Phase 2 work.
- **Phase 2 (MEDIUM Risk):** Structural improvements to test infrastructure, ESLint enforcement, CI
  matrix, and documentation — each item is independent but benefits from Phase 1 being clean.
- **Phase 3 (HIGH/CRITICAL Risk):** Items that require architectural review, may cause CI breakage
  during fix, or affect other teams (TypeScript errors, skipped tests, coverage gates).

**No Phase 2 item may be worked on until Phase 1 is verified complete.**  
**No Phase 3 item may be worked on until Phase 2 is verified complete.**

---

## Phase 1: LOW-Risk Quick Wins

_Target: all items non-breaking and additive-only. No CI breakage expected._

| Item | Gap ID | Action                                                                                            | Verification                                                              |
| ---- | ------ | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| 1.1  | GAP-V3 | Add `coverage` block to each per-app vitest config (matching root format: `text`, `json`, `html`) | `bun run test:coverage` from each app dir produces coverage report        |
| 1.2  | GAP-L2 | Add `vue/multi-word-component-names: warn` to root `eslint.config.mjs`                            | `bun run lint` passes; new rule emits warnings only                       |
| 1.3  | GAP-D3 | Add `"husky": "^9.0"` to root `package.json` devDependencies; run `bun install`                   | `bun install` installs husky; `.husky/pre-commit` is active after install |
| 1.4  | GAP-D2 | Fix `.husky/pre-commit`: change `bun run typecheck` to `bun run typecheck`                        | `bun run typecheck` resolves to the correct target                        |

**Phase 1 Exit Criteria:**

- [ ] All 4 items above are committed with passing lint and typecheck
- [ ] No new TS errors introduced
- [ ] `bun run typecheck` exits 0 from pre-commit hook

---

## Phase 2: MEDIUM-Risk Governance Items

_Requires Phase 1 complete and verified. Each item may cause temporary CI noise or require minor
refactoring._

### 2.1 Vitest Consolidation

| Item  | Gap ID | Action                                                                                                                      | Verification                                 |
| ----- | ------ | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| 2.1.1 | GAP-V1 | Create `vitest.workspace.ts` at repo root; include all 5 app configs                                                        | `vitest run` from root discovers all configs |
| 2.1.2 | GAP-V2 | Align `test.environment` values: root uses `node` for API/Worker; app configs keep `jsdom`; api-client sets explicit `node` | Each app's tests pass in correct environment |

### 2.2 ESLint Enforcement

| Item  | Gap ID | Action                                                                                                                                                                       | Verification                                                                      |
| ----- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 2.2.1 | GAP-L1 | Escalate `no-console` from `warn` to `error` in root `eslint.config.mjs` (after clearing pre-existing console uses in scripts or adding appropriate eslint-disable comments) | `bun run lint` exits 0 with 0 console errors                                      |
| 2.2.2 | GAP-L1 | Escalate `@typescript-eslint/no-explicit-any` from `warn` to `error` (requires fixing or typing current `any` usages)                                                        | `bun run lint` exits 0 with 0 any-type errors                                     |
| 2.2.3 | GAP-L3 | Add `eslint.config.js` to `apps/api`, `apps/worker`; add to relevant `packages/*`                                                                                            | `bunx eslint apps/api` and `bunx eslint apps/worker` run and produce clean output |
| 2.2.4 | GAP-B1 | Replace root `build` script with Bun-compatible workspace invocation                                                                                                         | `bun run build` exits 0                                                           |

### 2.3 Documentation

| Item  | Gap ID | Action                                                                                                                                                     | Verification                                            |
| ----- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| 2.3.1 | GAP-R3 | Reorganize `packages/types/README.md` to include the 7 required governance sections                                                                        | Audit script re-run reports all 7 sections as `PRESENT` |
| 2.3.2 | GAP-R3 | Reorganize `packages/ui-system/README.md` to include the 7 required governance sections                                                                    | Audit script re-run reports all 7 sections as `PRESENT` |
| 2.3.3 | GAP-R2 | Create `README.md` for: `packages/api-client`, `packages/config`, `packages/domain-core`, `packages/logger`, `packages/redis-utils`, `packages/validation` | Audit script re-run reports `PRESENT` for each          |

### 2.4 CI Matrix

| Item  | Gap ID | Action                                                                                                | Verification                                                   |
| ----- | ------ | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| 2.4.1 | GAP-C1 | Add Lint and Type Check steps to `test-stage-001.yml`                                                 | Workflow runs lint and typecheck before unit/integration tests |
| 2.4.2 | GAP-C4 | Create a unified pre-merge gate workflow (lint + typecheck + unit tests + coverage collection)        | New workflow triggers on all PRs to `main`/`develop`           |
| 2.4.3 | GAP-B3 | Establish coverage baseline by running `bun run test:coverage` inside Docker Compose test environment | Coverage percentages recorded in next audit iteration          |

### 2.5 Flaky Tests

| Item  | Gap ID | Action                                                                                                                                | Verification                         |
| ----- | ------ | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| 2.5.1 | GAP-T2 | Investigate and resolve `.retry()` markers in `packages/api-client/tests/client.test.ts` and `apps/worker/tests/load-testing.test.ts` | Static scan shows 0 flaky test files |

**Phase 2 Exit Criteria:**

- [ ] All Phase 2 items committed
- [ ] `bun run lint` exits 0
- [ ] `bun run typecheck` exits 0
- [ ] All 8 `packages/*` have compliant READMEs
- [ ] Unified CI gate workflow is active
- [ ] Coverage baseline established in Docker environment

---

## Phase 3: HIGH-Risk Items (Requires Architectural Review)

_Requires Phase 2 verified complete. These items may break CI during fix, require cross-team
coordination, or involve significant refactoring._

### 3.1 TypeScript Errors (Blocking)

| Item  | Gap ID          | Action                                                              | Notes                                                                                                                           |
| ----- | --------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 3.1.1 | GAP-D1 / GAP-B2 | Fix `apps/mmc/src/core/guards/index.ts` — add proper module exports | Resolves TS2306 errors in both `apps/mmc` and `apps/frontoffice`. Requires understanding of what guards are intended to export. |

### 3.2 Skipped Tests (Blocking)

| Item  | Gap ID | Action                                                                                                                                                                                                                                                                    | Notes                                                                                                                |
| ----- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 3.2.1 | GAP-T1 | Investigate and re-enable skipped license tests: `tests/unit/license-rbac.test.ts`, `tests/security/licenses.security.test.ts`, `tests/integration/licenses.e2e.test.ts`, `tests/integration/provisioning-failure.test.ts`, `tests/integration/license-soft-lock.test.ts` | License enforcement tests are a governance integrity requirement. These may require DB/test fixtures to be complete. |
| 3.2.2 | GAP-T1 | Re-enable `packages/ui-system/tests/unit/DataTable.spec.ts`, `composables.spec.ts`, `utilities.spec.ts`                                                                                                                                                                   | Verify why these are skipped; re-enable or mark as `TODO` with a tracking issue.                                     |
| 3.2.3 | GAP-T1 | Re-enable `apps/api/tests/integration/tenant-resolver.test.ts`                                                                                                                                                                                                            | Tenant resolver is a core isolation component; its tests must not be skipped.                                        |
| 3.2.4 | GAP-T1 | Re-enable `apps/worker/tests/unit/provisioning/provisioning.test.ts`                                                                                                                                                                                                      | Worker provisioning tests are critical to platform correctness.                                                      |

### 3.3 Coverage Gate Enforcement (Blocking)

| Item  | Gap ID | Action                                                                                                                                         | Notes                                                                    |
| ----- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 3.3.1 | GAP-C2 | Add a coverage threshold to the unified CI gate workflow: fail if Lines% or Functions% drops below the established baseline (from Phase 2.4.3) | Requires: baseline established in Phase 2.4.3; threshold agreed by team. |

### 3.4 E2E Test Infrastructure

| Item  | Gap ID          | Action                                                                                                                                                                         | Notes                                                                                              |
| ----- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| 3.4.1 | GAP-E1 / GAP-C3 | Add Playwright to at least one app (`apps/mmc` recommended as the highest-risk user-facing app); configure `playwright.config.ts`; add at least one E2E test for the auth flow | Requires architectural decision: which app gets E2E first, and which browser targets are in scope. |

### 3.5 README Completion — Apps

| Item  | Gap ID | Action                                                                                                 | Notes                                                        |
| ----- | ------ | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| 3.5.1 | GAP-R1 | Create `README.md` for all 5 `apps/*` directories: `api`, `backoffice`, `frontoffice`, `mmc`, `worker` | Each README must include all 7 required governance sections. |

### 3.6 Pre-Existing ESLint Error Backlog

| Item  | Gap ID | Action                                                  | Notes                                                                                                                                                                                                 |
| ----- | ------ | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3.6.1 | GAP-L4 | Clear the 10 pre-existing ESLint errors in the codebase | Must be done before rule escalation in Phase 2 takes full effect. The 10 errors may have expanded if `no-console` is escalated to `error` — that escalation must happen after the backlog is cleared. |

**Phase 3 Exit Criteria:**

- [ ] `bun run typecheck:src` exits 0 (TS errors resolved)
- [ ] All 10 skipped test files have been re-enabled or tracked with issues
- [ ] Coverage gate is active in CI
- [ ] At least one E2E test running in CI for one app
- [ ] All 5 `apps/*` have compliant READMEs
- [ ] `bun run lint` exits 0

---

## Governance Gate: Requirements Before STAGE_INFRA_GOVERNANCE

**This section enforces FR-US10-5:**

> No `STAGE_INFRA_GOVERNANCE` task may be opened until **all three audit report documents are
> present and reviewed**, and no remediation task may begin until this audit is marked **AUDIT
> COMPLETE**.

### Gate Conditions (All Must Be True)

| Condition                                                                                 | Status                 |
| ----------------------------------------------------------------------------------------- | ---------------------- |
| `GAP_REPORT.md` is present in `specs/runtime/infra-002-audit-checklist/reports/`          | ✅ Met                 |
| `RISK_CLASSIFICATION.md` is present in `specs/runtime/infra-002-audit-checklist/reports/` | ✅ Met                 |
| `SAFE_ROLLOUT_PLAN.md` is present in `specs/runtime/infra-002-audit-checklist/reports/`   | ✅ Met                 |
| All three documents contain a "Related Documents" section with cross-references           | ✅ Met                 |
| This stage (`INFRA_AUDIT_CHECKLIST`) is marked AUDIT COMPLETE in `workflow-state.json`    | ⏳ Pending stage close |
| All Phase 1 remediation items are verified complete                                       | ⏳ Pending Phase 1     |

### What May NOT Start Yet

- No `STAGE_INFRA_GOVERNANCE` stage file may be created
- No `STAGE_INFRA_GOVERNANCE` tasks may be written or executed
- No enforcement flag in any config file (ESLint severity escalation, coverage threshold insertion)
  may be committed until Phase 1 is complete and verified

### What May Start Now (After Stage Close)

- Phase 1 LOW-risk items (1.1–1.4) may be executed in the NEXT feature branch after this stage is
  merged and marked AUDIT COMPLETE.

---

## Summary

| Phase   | Gap Count | Risk Level | Prerequisite   | Status  |
| ------- | --------- | ---------- | -------------- | ------- |
| Phase 1 | 4         | LOW        | Audit Complete | PENDING |
| Phase 2 | 15        | MEDIUM     | Phase 1 ✓      | PENDING |
| Phase 3 | 9         | HIGH       | Phase 2 ✓      | PENDING |
| **All** | **28**    | —          | Sequenced      | PENDING |
