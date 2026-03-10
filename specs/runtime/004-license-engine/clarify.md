# Clarifications Session — STAGE_04_LICENSE_ENGINE

**Date**: February 17, 2026  
**Feature**: License Engine Core  
**Branch**: `004-license-engine`  
**Status**: Complete  
**Questions Asked**: 5  
**All Answered**: ✅ Yes

---

## Session Summary

**Objective**: Audit specification for ambiguities in transactions, idempotency, concurrency,
version enforcement, middleware enforcement, security, error contracts, and isolation.

**Result**: All critical ambiguities resolved. Specification now ready for planning phase.

---

## Questions & Answers

### Q1: Transaction Isolation for Concurrent Limit Checks

**Topic**: Race condition prevention in student/staff limit enforcement  
**Ambiguity**: Lock mechanism not specified; implementation team could choose wrong isolation level

**Question**:

> For student/staff limit enforcement (T2), which transactional lock mechanism prevents concurrent
> requests from both inserting the Nth student when limit=N?

**Options**:

- A: SELECT FOR UPDATE (row-level lock; first request acquires, second waits)
- B: SERIALIZABLE isolation (PostgreSQL serializes conflicting transactions)
- C: Optimistic concurrency (count → insert → retry on conflict)

**Answer**: **A – SELECT FOR UPDATE**

**Clarification Integration** (Transaction Boundaries section):

- Lock mechanism: `SELECT ... FOR UPDATE COUNT(*) + INSERT` (atomic)
- Behavior: First request locks; counts limit; blocks second
- Second request: Waits; counts limit+1; fails with 402
- Overhead: Minimal (row-level, not table-level)

---

### Q2: Idempotency Key Storage & Collision Handling

**Topic**: How idempotency keys are persisted and checked for state transitions

**Ambiguity**: Storage location, TTL, and collision resolution not defined

**Question**:

> How should idempotency keys be stored (database, Redis, or compute-on-demand) and what TTL should
> be used?

**Options**:

- A: Database table `idempotency_keys` (forever retention)
- B: Redis cache with 24-hour TTL (prevents stale cache; aligns with async patterns)
- C: In-request deduplication only (state immutability model; no storage)

**Answer**: **B – Redis cache with 24-hour TTL**

**Clarification Integration** (Idempotency Strategy section):

- State transitions: Redis cache; `idempotency:{license_id}:{target_state}:{request_id_hash}`
- TTL: 24 hours (sufficient for retry windows; prevents stale responses)
- Behavior: First submission stored; retries get cached response; after TTL expires, new request
  treated as fresh
- Snapshot dedup: Database query (checking recent snapshots within 1 hour)
- Cache failure: Proceed without caching; best-effort idempotency

---

### Q3: Version Enforcement Direction & Forward Compatibility

**Topic**: How version mismatches should be handled (strict, forward-compatible,
backward-compatible)

**Ambiguity**: Directional semantics not specified; could allow data corruption if implementation
reverses logic

**Question**:

> Should version comparison use strict equality, or allow forward/backward compatibility?
>
> - If tenant > license (tenant upgraded ahead), allow or block?
> - If tenant < license (license requires newer tenant), allow or block?

**Options**:

- A: Forward-compatible (tenant ≥ license allowed; tenant < license blocks 426)
- B: Strict equality (tenant must exactly match license)
- C: Maximum flexibility (tenant > license allowed; tenant < license allowed)

**Answer**: **A – Forward-Compatible (tenant ≥ license)**

**Clarification Integration** (License & Version Enforcement section):

- Comparison:
  `IF tenant.schema_version >= license.expected_schema_version THEN allow (200) ELSE 426`
- Semantics:
  - tenant > license: **Allowed** (tenant ahead; runtime handles old contract)
  - tenant = license: **Allowed** (exact match)
  - tenant < license: **Blocked** (tenant outdated; return 426)
- Rationale: Prevents runtime assumptions about missing schema features

---

### Q4: Soft-Lock Auto-Expiry Timing & Precision

**Topic**: When SOFT_LOCKED → ARCHIVED auto-transition should occur (every request, at auth, or
cron)

**Ambiguity**: Check timing and race condition handling not defined

**Question**:

> Should expiry check occur on every API request, only at authentication, or via background cron?
> How should race conditions be handled if two requests simultaneously detect expiry?

**Options**:

- A: Every request (fail-fast; user gets 403 immediately after expiry; race handled via SELECT FOR
  UPDATE)
- B: Auth only (medium cost; background cron handles stale sessions)
- C: Cron job only (low cost; one check per minute per license)

**Answer**: **A – Check Every Request (Middleware)**

**Clarification Integration** (Authoritative Time Usage section):

- Location: License middleware (not cron)
- Execution: Every API request for workspace-bound routes
- Logic: `IF status=SOFT_LOCKED AND NOW() > soft_lock_until THEN UPDATE to ARCHIVED`
- Race handling: SELECT FOR UPDATE equivalent; first updater wins; second sees already ARCHIVED
- Cost: Negligible (one timestamp comparison)
- Cron: Optional (optimization only; not required)
- Rationale: Fail-fast; no stale state from delayed cron

---

### Q5: Error Code Registry & Granularity

**Topic**: What specific error codes should be returned (generic vs granular)

**Ambiguity**: Complete error code mapping not specified; implementation might use inconsistent
codes

**Question**:

> Should error codes be generic (LICENSE_BLOCKED for all restrictions) or granular
> (LICENSE_SOFT_LOCKED vs LICENSE_ARCHIVED)?

**Options**:

- A: Granular codes (LICENSE_SOFT_LOCKED, LICENSE_ARCHIVED, LIMIT_EXCEEDED, SCHEMA_VERSION_MISMATCH,
  etc.)
- B: Generic codes (LICENSE_BLOCKED, VERSION_ERROR, LIMIT_ERROR)
- C: HTTP status codes only (no error_code field)

**Answer**: **A – Granular Error Codes**

**Clarification Integration** (Observability Requirements section):

- Error code format: `{error_code: "LICENSE_*", message: "human-readable"}`
- Mapping defined for all scenarios:
  - SOFT_LOCKED → 423
  - ARCHIVED → 403
  - LIMIT_EXCEEDED → 402
  - VERSION_MISMATCH (schema) → 426
  - UPGRADE_REQUIRED (product) → 426
  - INVALID_STATE_TRANSITION → 409
- Principles:
  - Codes are specific and actionable
  - Codes consistent across similar scenarios
  - No implementation details exposed
  - Human messages provide context

---

## Sections Updated

| Section                       | Type     | Changes                                              |
| ----------------------------- | -------- | ---------------------------------------------------- |
| Clarifications Session        | New      | Added session record                                 |
| Transaction Boundaries        | Enhanced | T2 mechanism clarified (SELECT FOR UPDATE)           |
| Idempotency Strategy          | Enhanced | Storage (Redis), TTL (24hr), collision handling      |
| License & Version Enforcement | Enhanced | Direction logic (≥), forward-compatibility semantics |
| Authoritative Time Usage      | Enhanced | Expiry check timing (every request), race handling   |
| Observability Requirements    | Enhanced | Error code registry, granular mapping                |

---

## Coverage Summary

| Category                   | Status   | Notes                                                            |
| -------------------------- | -------- | ---------------------------------------------------------------- |
| **Transactions**           | Resolved | SELECT FOR UPDATE mechanism specified for T2                     |
| **Idempotency**            | Resolved | Redis + DB dedup specified; TTL defined                          |
| **Concurrency**            | Resolved | Row-level lock + SELECT FOR UPDATE; race handling documented     |
| **Version Enforcement**    | Resolved | Direction semantics (≥) clarified; forward-compatibility defined |
| **Middleware Enforcement** | Resolved | Every-request timing; SELECT FOR UPDATE for race prevention      |
| **Security Validation**    | Resolved | Error codes granular; no data exposure                           |
| **Error Contract**         | Resolved | Complete error code registry with HTTP mappings                  |
| **Isolation Boundaries**   | Resolved | Master-only license table; tenant DB access after validation     |

---

## Spec Readiness Assessment

**Before Clarification**: Partial clarity; 5 areas of uncertainty  
**After Clarification**: Full clarity; all decisions documented

**Status**: ✅ **READY FOR PLANNING PHASE**

### Next Steps

1. ✅ Specification complete
2. ✅ Clarifications complete (5/5 questions answered)
3. ➡️ **Planning phase**: Generate plan.md with design artifacts
4. ➡️ Task generation: Generate tasks.md
5. ➡️ Implementation: Execute via speckit.implement

---

## Compliance Validation

✅ No new violations introduced by clarifications  
✅ All decisions align with Constitution v1.2.0  
✅ All ADRs still respected (ADR-0001, 0006, 0008)

**Final Status**: Specification is **complete, clarified, and compliant**
