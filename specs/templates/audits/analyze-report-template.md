# Analyze Report — <STAGE_NAME>

**Step:** 5 — Analyze (Drift Detector)  
**Timestamp:** <ISO_TIMESTAMP>  
**Status:** APPROVED / BLOCKED

---

## Summary

[Brief summary of drift analysis outcome.]

---

## Inputs Reviewed

- `specs/runtime/<STAGE_DIR_NAME>/spec.md`
- `specs/runtime/<STAGE_DIR_NAME>/plan.md`
- `specs/runtime/<STAGE_DIR_NAME>/tasks.md`
- Guardian outputs from Step 5.1A

---

## Violations Detected

| # | Violation Type | Description | Severity | Owner | Remediation |
| --- | --- | --- | --- | --- | --- |
| 1 | ... | ... | LOW / MEDIUM / HIGH / CRITICAL | ... | ... |

Use `None` when no violations are present.

---

## Audit Checklist

| Domain | Check | Status | Notes |
| --- | --- | --- | --- |
| Isolation | No cross-tenant joins | ✅ / ❌ | ... |
| Isolation | Tenant resolver required for tenant DB access | ✅ / ❌ | ... |
| License | License middleware enforced before tenant DB access | ✅ / ❌ | ... |
| Transactions | All write paths transactional | ✅ / ❌ | ... |
| Idempotency | Replay protection defined for critical flows | ✅ / ❌ | ... |
| Snapshot Integrity | Snapshot remains immutable after start (if applicable) | ✅ / ❌ / N/A | ... |
| Versioning | Schema/product compatibility checks enforced | ✅ / ❌ | ... |
| Observability | Structured logs include `correlation_id` and `workspace_slug` | ✅ / ❌ | ... |
| Security | No tenant override from request body | ✅ / ❌ | ... |

---

## Guardian Verdicts

| Guardian | Verdict | Key Findings |
| --- | --- | --- |
| zidney-security-auditor | PASS / BLOCKED | ... |
| zidney-performance-optimizer | PASS / BLOCKED | ... |
| zidney-qa-engineer | PASS / BLOCKED | ... |
| zidney-code-reviewer | PASS / BLOCKED | ... |

---

## Final Gate Decision

`APPROVED — Implementation authorized.`  
OR  
`BLOCKED — Constitutional or safety violations detected. Remediation required.`

---

## Next Step

Proceed to Step 6 — Implement.
