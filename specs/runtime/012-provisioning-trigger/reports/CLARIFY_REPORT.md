# Clarify Report — STAGE_12_PROVISIONING_TRIGGER

**Generated:** 2026-02-24  
**Step:** 2 (Clarify)  
**Orchestrator:** Zidney Orchestrator v1.0  
**Status:** ✅ Clarifications recorded and resolved

---

## Summary of Questions & Answers

1. **Worker network-partition + lock TTL**
   - **Answer:** C — Worker attempts reconnect with exponential backoff up to 60s; if still disconnected, roll back, release lock, mark `PROVISION_FAILED`, and re-enqueue for retry. Recommended to avoid indefinite lock extension.

2. **Seed data initialization scope**
   - **Answer:** C — Hybrid: platform-generic baseline plus tenant-specific optional hooks (e.g., locale or tenant feature flags).

3. **Admin account initial credential handling**
   - **Answer:** D — Worker creates an admin placeholder and MMC triggers an invite flow where the admin sets their password. Worker does not return raw credentials.

4. **Database-creation failure rollback semantics**
   - **Answer:** B — Attempt automatic retries for DROP/create with exponential backoff (N attempts) then mark `PROVISION_FAILED`. Operator remediation allowed after retries fail.

5. **Concurrent provisioning requests for same workspace_slug**
   - **Answer:** A — Deduplicate at enqueue time (by `license_id`/slug); drop duplicates so a single job is processed.

---

## Spec Updates Applied

- Appended `## Clarifications` section to `spec.md` with session answers and resolution notes.
- Confirmed no remaining `[NEEDS CLARIFICATION]` markers in `spec.md`.

## Impact on Planning

- Planning may assume lock TTL handling per Q1 (retries then fail) and implement reconnect/backoff logic.
- Seed data plan should include hook points for tenant-specific initialization.
- Admin invite flow must be built into MMC/Worker integration (Worker creates placeholder only).
- Retry/backoff policy for DROP/CREATE must be implemented in Worker.
- Enqueue deduplication must be enforced in MMC (producer) and defensively in Worker.

---

**Orchestrator Verdict:** ✅ Clarifications resolved. Proceed to Step 3 (Plan).
