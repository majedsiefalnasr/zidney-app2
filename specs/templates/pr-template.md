---
# Pull Request — Zidney Hard Mode

## 1. Stage & Phase

- Phase: <PHASE_NUMBER>
- Stage: <STAGE_NAME>
- Branch: `<STAGE_DIR_NAME>`
- Stage Directory: `specs/runtime/<STAGE_DIR_NAME>/`
- Stage File: `specs/phases/<STAGE_FILE_NAME>`
- Stage Status Before PR: IN PROGRESS
- Stage Status After PR: PRODUCTION READY

---

## 2. PR Type

- [x] Feature
- [ ] Architectural Change
- [ ] Infrastructure / Governance
- [ ] Security Hardening
- [ ] Refactor (No Behavior Change)
- [ ] Documentation
- [ ] Test Coverage
- [ ] Bug Fix

---

## 3. Executive Summary

[3–8 bullet points covering:]

- What problem this PR solves
- Which architectural boundary it touches
- Why the change is safe
- Which constitutional guarantees remain intact

---

## 4. Workflow Completion Evidence

Stage Directory: specs/runtime/<STAGE_DIR_NAME>/

| Step      | Status      | Report Link                                                |
| --------- | ----------- | ---------------------------------------------------------- |
| Specify   | ✅ Complete | specs/runtime/<STAGE_DIR_NAME>/reports/SPECIFY_REPORT.md   |
| Clarify   | ✅ Complete | specs/runtime/<STAGE_DIR_NAME>/reports/CLARIFY_REPORT.md   |
| Plan      | ✅ Complete | specs/runtime/<STAGE_DIR_NAME>/reports/PLAN_REPORT.md      |
| Tasks     | ✅ Complete | specs/runtime/<STAGE_DIR_NAME>/reports/TASKS_REPORT.md     |
| Analyze   | ✅ Complete | specs/runtime/<STAGE_DIR_NAME>/reports/ANALYZE_REPORT.md   |
| Implement | ✅ Complete | specs/runtime/<STAGE_DIR_NAME>/reports/IMPLEMENT_REPORT.md |
| Closure   | ✅ Complete | specs/runtime/<STAGE_DIR_NAME>/reports/CLOSURE_REPORT.md   |

---

## 5. Constitutional Compliance Checklist

Confirm compliance with Zidney Constitution v1.2.0:

- [ ] ADR-0001 — Database-per-tenant isolation preserved
- [ ] ADR-0002 — Snapshot immutability enforced (if applicable)
- [ ] ADR-0006 — Server-authoritative time only
- [ ] ADR-0007 — Version compatibility enforced
- [ ] ADR-0008 — Semantic versioning respected
- [ ] No cross-tenant access introduced
- [ ] No middleware bypass created
- [ ] No shared mutable global state introduced
- [ ] ARCHITECTURE_MAP.json rules preserved

---

## 6. Isolation & Security Verification

- [ ] No cross-workspace joins
- [ ] No default DB fallback
- [ ] All queries scoped to workspace_id
- [ ] Structured logging (no console.log)
- [ ] Error contract compliance ({ success, data, error })
- [ ] Sensitive data not logged

---

## 7. Transaction & Concurrency Safety

- [ ] All write operations wrapped in transactions
- [ ] Proper isolation level declared
- [ ] Explicit locking defined where required
- [ ] Idempotency guarantees preserved
- [ ] No race conditions introduced

---

## 8. Observability & Monitoring

- [ ] Structured logging enforced
- [ ] Correlation IDs propagated
- [ ] Metrics added or updated
- [ ] Alerts updated (if required)

---

## 9. Testing Coverage

- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Edge cases covered
- [ ] Concurrency scenarios tested (if applicable)
- [ ] Coverage threshold met

Test Command:

```bash
bun test
```

---

## 10. Migration Impact (If Applicable)

- [ ] New migrations included
- [ ] Backward compatibility verified
- [ ] Rollback strategy defined
- [ ] No untracked schema changes

---

## 11. Drift Analysis

- [ ] speckit.analyze executed
- [ ] No architectural violations
- [ ] No cross-phase leakage
- [ ] No unauthorized stage modification
- [ ] ANALYZE_REPORT.md confirms APPROVED
- [ ] ai-guard.ts executed

---

## 11A. Architecture Guard

- [ ] `ai-guard.ts` passed
- [ ] `infra-audit.ts` passed
- [ ] No architecture drift detected
- [ ] Architecture diagrams regenerated

Architecture diagrams: docs/architecture/ARCHITECTURE_DIAGRAMS.md

Commands:

```bash
bun scripts/infra-audit.ts
bun scripts/ai-guard.ts
```

---

## 12. Stage Lifecycle Verification

- [ ] Stage Status updated in `specs/phases/<STAGE_FILE_NAME>`
- [ ] .workflow-state.json updated to `PRODUCTION READY`
- [ ] README.md progress table complete
- [ ] All 7 step reports generated in `reports/`

---

## 13. Deployment Readiness

- [ ] Safe for staging
- [ ] Safe for production
- [ ] No feature flags required
- [ ] Runbook updated (if needed)

---

## 14. Risk Assessment

Risk Level:

- [ ] Low
- [ ] Medium
- [ ] High

Explain why:

---

## 15. Final Statement

This PR maintains Zidney architectural integrity and complies with Hard Mode governance.

All workflow steps completed. All reports generated. Stage lifecycle updated.

Reviewer Sign-off:

- [ ] Architecture Approved
- [ ] Security Approved
- [ ] Ready to Merge

---

## PR Checklist Enforcement (CI)

This repository enforces **Hard Mode governance** automatically in CI.

Before merging, ensure that:

- All required checkboxes in this PR template are completed
- `bun scripts/infra-audit.ts` passes
- `bun scripts/ai-guard.ts` passes
- No architecture drift is detected

CI pipelines may block the merge if:

- Required checklist items remain unchecked
- Architecture violations are detected
- Stage workflow reports are missing

Local verification:

```bash
bun scripts/infra-audit.ts
bun scripts/ai-guard.ts
bun test
```

This ensures that Zidney's architecture, governance, and testing guarantees remain intact before
merging.

---
