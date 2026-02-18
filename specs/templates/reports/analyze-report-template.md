# Analyze Report — <STAGE_NAME>

**Step:** 5 — Analyze (Drift Detector)  
**Timestamp:** <ISO_TIMESTAMP>  
**Result:** APPROVED / BLOCKED

---

## Summary

[Summary of drift analysis outcome.]

---

## Violations Detected

| #   | Violation Type       | Description | Severity          |
| --- | -------------------- | ----------- | ----------------- |
| -   | None / [description] | ...         | LOW/MED/HIGH/CRIT |

---

## Isolation Audit

| Check                            | Status  |
| -------------------------------- | ------- |
| No cross-tenant joins            | ✅ / ❌ |
| No shared student tables         | ✅ / ❌ |
| Tenant resolver used throughout  | ✅ / ❌ |
| License middleware on all routes | ✅ / ❌ |

---

## Transaction Safety Audit

| Check                         | Status  |
| ----------------------------- | ------- |
| All write paths transactional | ✅ / ❌ |
| Concurrency guards defined    | ✅ / ❌ |
| Rollback paths defined        | ✅ / ❌ |

---

## Idempotency Audit

| Check                      | Status  |
| -------------------------- | ------- |
| Idempotency keys defined   | ✅ / ❌ |
| Replay protection in place | ✅ / ❌ |
| Tests included             | ✅ / ❌ |

---

## Snapshot Integrity Audit

| Check                            | Status  |
| -------------------------------- | ------- |
| Snapshot frozen at start         | ✅ / ❌ |
| No mutations of snapshotted data | ✅ / ❌ |
| Worker-only calculation          | ✅ / ❌ |

---

## Observability Audit

| Check                     | Status  |
| ------------------------- | ------- |
| Structured logging (Pino) | ✅ / ❌ |
| correlation_id propagated | ✅ / ❌ |
| workspace_slug logged     | ✅ / ❌ |
| No console.log            | ✅ / ❌ |

---

## Overall Risk Level

`LOW` / `MEDIUM` / `HIGH` / `CRITICAL`

---

## Final Verdict

`APPROVED — Implementation authorized.`  
OR  
`BLOCKED — Constitutional violations detected. See above.`

---

## Next Step

Proceed to Step 6 — Implement.
