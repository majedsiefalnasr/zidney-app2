# Clarify Report — License Lifecycle

**Step:** 2 — Clarify  
**Timestamp:** 2026-02-24T00:00:00Z  
**Status:** COMPLETE

---

## Summary

All five targeted clarification questions have been resolved. Clarifications capture architectural decisions on snapshot storage determinism, audit compliance, failure recovery, deletion authorization, and restore performance. All answers align with Zidney Constitutional constraints (immutability, determinism, middleware enforcement, worker delegation, idempotency, server-authoritative time). No additional ambiguities remain.

---

## Clarifications Recorded

| #   | Topic                         | Decision                                                               | Confidence |
| --- | ----------------------------- | ---------------------------------------------------------------------- | ---------- |
| 1   | Snapshot Location Determinism | Deterministic: `s3://snapshots/{license_id}/{timestamp}.tar.gz`        | High       |
| 2   | Audit Trail Retention         | Never auto-delete; manual purge only with elevated authz               | High       |
| 3   | Snapshot Failure Recovery     | Worker retries 3x, license stays SOFT_LOCKED, alert on persistent fail | High       |
| 4   | Deletion Authorization        | Admin-only, 2FA re-auth, confirmation phrase, immutable audit          | High       |
| 5   | Restore Time SLA              | Size-based async: <1GB ≤5min, 1-5GB ≤15min, >5GB ≤30min                | High       |

---

## Architectural Alignment Verified

| Constraint                          | Status | Notes                                                                 |
| ----------------------------------- | ------ | --------------------------------------------------------------------- |
| No cross-tenant access              | ✅     | Snapshots and deletion isolated per license_id/tenant_id              |
| Immutable audit trails              | ✅     | Manual-purge-only policy with legal hold support                      |
| Determinism (no client-clock trust) | ✅     | All timestamps server-generated (UTC); snapshot paths deterministic   |
| Middleware enforcement              | ✅     | Resolved path calculation (no runtime config override risk)           |
| Worker delegation (async)           | ✅     | Snapshot creation + restore both worker-based with retry policy       |
| Idempotency                         | ✅     | Restore is idempotent (atomicity defined)                             |
| Version compatibility               | ✅     | Schema version tagged on snapshot; compatibility validated on restore |
| Observable failures                 | ✅     | Snapshot failures surface as CRITICAL alerts; DLQ pattern retained    |

**Overall Assessment:** CONSTITUTIONALLY COMPLIANT ✅

---

## Decisions Rationale

### Q1: Deterministic Paths Enable Auditing

- Prevents path injection and misconfiguration drift
- Reproducible restore logic (enables integrity validation with checksums)
- Compatible with immutable snapshot model
- No per-workspace configuration complexity

### Q2: Manual-Purge Preserves Compliance

- Automatic deletion introduces legal discovery and regulatory risk
- Zidney enforces immutable audit trails; auto-expiration contradicts this
- Manual purge ensures deterministic governance
- Supports legal hold for compliance investigations

### Q3: Retry + Alert = Observable Determinism

- Never allows archival without snapshot (preserves recovery guarantee)
- Worker retry pattern matches STAGE 09/10 provisioning model
- Alert on failures enables proactive ops; no silent failures
- License remains SOFT_LOCKED = state clarity for operators

### Q4: Admin-Only + 2FA + Phrase = Irreversibility Protection

- Non-reversible operation requires maximum friction
- Matches "hardened governance" pattern in STAGE 03 MMC modules
- No developer pathway = prevents accidental production deletions
- Immutable audit entry = compliance accountability

### Q5: Async + Size-Based SLA = Operational Confidence

- Aligns with existing worker + DLQ + metrics patterns
- Async prevents timeout on large workspaces (>5GB)
- Size-based SLA is realistic and observable
- ETA calculation + progress tracking = operational transparency

---

## Pre-Planning Validation

All clarifications are implementable within Zidney architecture:

- ✅ Snapshot path determinism: Calculated at snapshot creation; stored in metadata
- ✅ Manual audit purge: Add purge workflow to MMC Admin panel with 2-step confirmation
- ✅ Retry + alert: Implement using existing Worker retry pattern + alert service
- ✅ 2FA deletion: Integrate with existing auth middleware (STAGE 02A)
- ✅ Async restore: Delegate to Worker; return job_id to client; use WebSocket or polling for progress

No new technology or architecture changes required.

---

## Open Ambiguities Remaining

**None.** All originally flagged ambiguities have been resolved through explicit decisions. Specification is now ready for technical planning.

---

## Next Step

Proceed to Step 3 — Plan. With all clarifications locked in, technical design can proceed with confidence on:

- Exact snapshot storage paths and metadata schema
- Audit log immutability constraints and purge mechanisms
- Worker retry policy and DLQ integration
- Deletion authorization flow and confirmation UI
- Restore async implementation with progress tracking
