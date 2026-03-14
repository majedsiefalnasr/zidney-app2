# Analyze Report — <STAGE_NAME>

**Step:** 5 — Analyze (Drift Detector)  
**Timestamp:** <ISO_TIMESTAMP>  
**Status:** PASS / BLOCKED

---

## Summary

[Brief summary of drift analysis outcome.]

If the stage touches routing or template authority, the summary must explicitly confirm whether the
routing registry is complete, whether canonical parity exists for all rewired consumers, and whether
same-batch migration requirements are reflected in the task graph.

---

## Inputs Reviewed

- `specs/runtime/<STAGE_DIR_NAME>/spec.md`
- `specs/runtime/<STAGE_DIR_NAME>/plan.md`
- `specs/runtime/<STAGE_DIR_NAME>/tasks.md`
- `specs/runtime/<STAGE_DIR_NAME>/research.md` when planning rationale or alternative analysis is part of the design authority
- `specs/runtime/<STAGE_DIR_NAME>/quickstart.md` when operator sequencing or validation cadence is part of the design
- `specs/runtime/<STAGE_DIR_NAME>/data-model.md` when the stage formalizes entities, registry fields, or migration states
- `specs/runtime/<STAGE_DIR_NAME>/contracts/` when the stage defines enforceable contracts or registry schemas
- `docs/architecture/intelligence/ROUTING_AUTHORITY_REGISTRY.md` when the stage touches agents, prompts, templates, or support-surface cleanup authority
- Stage evidence artifacts that already exist by Analyze time or that the stage explicitly defines as design-time inputs; if they are implementation-time artifacts, Analyze must instead verify that the task graph creates and gates them at the required points
- Guardian outputs from Step 5.1A

---

## Violations Detected

| #   | Violation Type | Description | Severity                       | Owner | Remediation |
| --- | -------------- | ----------- | ------------------------------ | ----- | ----------- |
| 1   | ...            | ...         | LOW / MEDIUM / HIGH / CRITICAL | ...   | ...         |

Use `None` when no violations are present.

---

## Audit Checklist

| Domain             | Check                                                                                                                                        | Status        | Notes |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ----- |
| Isolation          | No cross-tenant joins                                                                                                                        | ✅ / ❌       | ...   |
| Isolation          | Tenant resolver required for tenant DB access                                                                                                | ✅ / ❌       | ...   |
| License            | License middleware enforced before tenant DB access                                                                                          | ✅ / ❌       | ...   |
| Transactions       | All write paths transactional                                                                                                                | ✅ / ❌       | ...   |
| Idempotency        | Replay protection defined for critical flows                                                                                                 | ✅ / ❌       | ...   |
| Snapshot Integrity | Snapshot remains immutable after start (if applicable)                                                                                       | ✅ / ❌ / N/A | ...   |
| Versioning         | Schema/product compatibility checks enforced                                                                                                 | ✅ / ❌       | ...   |
| Observability      | Structured logs include `correlation_id` and `workspace_slug`                                                                                | ✅ / ❌       | ...   |
| Security           | No tenant override from request body                                                                                                         | ✅ / ❌       | ...   |
| Routing            | Routing authority registry is complete and consulted where required                                                                          | ✅ / ❌ / N/A | ...   |
| Templates          | Canonical parity exists for every rewired legacy template consumer                                                                           | ✅ / ❌ / N/A | ...   |
| Prompts            | Authoritative and compatibility prompt surfaces stay synchronized                                                                            | ✅ / ❌ / N/A | ...   |
| Guidance           | Stale legacy references to nonexistent template trees are removed                                                                            | ✅ / ❌ / N/A | ...   |
| Entrypoints        | Touched shell and loader paths resolve one authority model                                                                                   | ✅ / ❌ / N/A | ...   |
| Validation Cadence | Per-batch smoke evidence is recorded for each routing-affecting batch                                                                        | ✅ / ❌ / N/A | ...   |
| Validation Cadence | Full governance suite reruns occur after rewiring/hardening, before retirement or cleanup mutations, and again after the final cleanup state | ✅ / ❌ / N/A | ...   |
| Stage Authority    | Stage-file requirements and validation boundaries are fully reflected in the analyzed artifacts                                              | ✅ / ❌ / N/A | ...   |
| Support Surfaces   | All named in-scope support surfaces have explicit dispositions or blocked-retirement evidence                                                | ✅ / ❌ / N/A | ...   |
| Protected Surfaces | Protected governance files remain unchanged or have minimal, explicitly justified migration edits                                            | ✅ / ❌ / N/A | ...   |

---

## Guardian Verdicts

| Guardian                     | Verdict        | Key Findings |
| ---------------------------- | -------------- | ------------ |
| zidney-security-auditor      | PASS / BLOCKED | ...          |
| zidney-performance-optimizer | PASS / BLOCKED | ...          |
| zidney-qa-engineer           | PASS / BLOCKED | ...          |
| zidney-code-reviewer         | PASS / BLOCKED | ...          |

---

## Final Gate Decision

`PASS — Implementation authorized.`  
OR  
`BLOCKED — Constitutional or safety violations detected. Remediation required.`

---

## Next Step

Proceed to Step 6 — Implement.
