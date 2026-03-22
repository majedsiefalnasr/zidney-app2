# Analyze Report — <STAGE_NAME>

**Step:** 5 — Analyze (Drift Audit)
**Timestamp:** <ISO_TIMESTAMP>
**Verdict:** PASSED / BLOCKED

---

## Executive Summary

[Concise summary of the audit outcome, scope analyzed, and high-level recommendation.]

---

## Inputs

- `specs/runtime/<STAGE_DIR_NAME>/spec.md`
- `specs/runtime/<STAGE_DIR_NAME>/plan.md`
- `specs/runtime/<STAGE_DIR_NAME>/tasks.md`
- architecture context: `docs/ai/context/` (ai-architecture-brain, ai-module-map)

---

## Composite Verdict

- Structural Audit: PASS / FAIL
- Security Auditor: PASS / BLOCKED
- Performance Optimizer: PASS / BLOCKED
- QA Engineer: PASS / BLOCKED
- Code Reviewer: PASS / BLOCKED

**Final Gate:** APPROVED (all PASS) / BLOCKED (any BLOCKED)

---

## Violations (Detailed)

| Status       | Severity    | Rule                         | Location         | Notes             |
| ------------ | ----------- | ---------------------------- | ---------------- | ----------------- |
| 🆕 New       | 🚨 Critical | tenant_isolation_bypass      | apps/api/src/... | Short explanation |
| ❌ Remaining | ⚠️ High     | missing_transaction_boundary | packages/...     | Short explanation |

> Add rows as needed. Use `Location` with workspace-relative file link where possible.

---

## Remediation Progress (Attempt <N>)

- ✅ Fixed: <count>
- ❌ Remaining: <count>
- 🆕 New: <count>

For each `❌ Remaining` or `🆕 New` include a one-line remediation suggestion and the recommended owner.

---

## Evidence & Repro Commands

- Commands run (include exact commands and outputs or file excerpts):

```
# Example
rtk node ./scripts/infra-audit.ts --stage <STAGE_DIR_NAME>
rtk bun run typecheck
rtk gitnexus impact <symbol>
```

Paste or attach critical excerpts (stack traces, failing test outputs, lint errors) under this section.

---

## Risk Assessment

- Computed Risk Level: LOW / MEDIUM / HIGH
- Drivers: [list primary factors: migrations, security, external deps, worker async]

---

## Recommendations

1. Blocker fixes: short list of 1–3 critical actions required to proceed.
2. Non-blocker improvements: lower-priority tasks to address before production.
3. Suggested re-audit steps and who should run them.

---

## Next Steps

- If `Final Gate` = APPROVED → update `.workflow-state.json` (drift_passed = true) and proceed to Step 6 — Implement.
- If `Final Gate` = BLOCKED → record remediation tasks, assign owners, and re-run the audit after fixes.

---

## Appendix: Full Guardian Outputs

### Security Auditor

[Paste full output or attach link to artifact]

### Performance Optimizer

[Paste full output or attach link to artifact]

### QA Engineer

[Paste full output or attach link to artifact]

### Code Reviewer

[Paste full output or attach link to artifact]

---

## Change Log

- <ISO_TIMESTAMP> — Template created by AI — follow Zidney audit format.
