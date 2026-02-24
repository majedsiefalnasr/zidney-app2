# Specify Report — License Lifecycle

**Step:** 1 — Specify  
**Timestamp:** 2026-02-24T00:00:00Z  
**Status:** COMPLETE

---

## Summary

Specification for License Lifecycle Operations has been extracted from stage file and formalized into executable requirement. The specification captures all four license states (ACTIVE, SOFT_LOCKED, ARCHIVED, DELETED), state transition rules, audit requirements, snapshot/restore workflows, and permanent deletion workflows. All lifecycle logic is middleware-enforced and single-source-of-truth (master_db licenses.status). 22 acceptance criteria defined covering state model, soft lock enforcement, archival, restoration, deletion, TTL management, audit logging, UI integration, error handling, data integrity, and security.

---

## Inputs Reviewed

- `specs/phases/02_PLATFORM_MMC/STAGE_11_LICENSE_LIFECYCLE.md` — stage definition with full scope
- `docs/PROJECT_CONTEXT_PRIMER.md` — trust chain and multi-tenancy model
- `AGENTS.md` — AI behavioral contracts (architecture non-negotiable)

---

## Key Decisions

| # | Decision | Rationale |
| --- | --- | --- |
| 1 | Four-state model (ACTIVE → SOFT_LOCKED → ARCHIVED → DELETED) | Deterministic progression prevents orphaned states; recoverable up to archival |
| 2 | Middleware-enforced soft lock at every 401/403 gate | Prevents bypassable logic, ensures single enforcement layer |
| 3 | Snapshot mandatory before archival | Enables deterministic restore, audit trail, and data recovery |
| 4 | Permanent deletion after explicit admin action (not TTL) | Complies with institutional trust: no silent deletion |
| 5 | Server-authoritative timestamps only (not client) | Prevents state timestamp spoofing; single source of truth |
| 6 | Audit log immutable after write | Transactional guarantees integrity; irreversible record for legal compliance |

---

## Functional Requirements Captured

**State Management:**
- ACTIVE: Full workspace operational
- SOFT_LOCKED: Access denied, snapshot/restore available, schema-compatible
- ARCHIVED: Snapshot permanent, tenant DB inaccessible, archived state published to MMC
- DELETED: Tenant DB deleted, licenses record marked with deletion timestamp

**Transitions:**
- ACTIVE → SOFT_LOCKED (payment lapse, 90-day auto-expiration)
- SOFT_LOCKED → ACTIVE (payment received, within 90-day window)
- SOFT_LOCKED → ARCHIVED (90-day window expired or explicit admin action)
- ARCHIVED → DELETED (explicit permanent deletion, irreversible)
- ARCHIVED → ACTIVE not allowed (recovery only from SOFT_LOCKED)

**Operations:**
- Snapshot Creation: Captures schema_version, schema, RBAC, question library, grading config before archival
- Restoration: Full schema restore from snapshot, version compatibility validated
- Audit: Every transition logged immutably with actor, timestamp, reason, snapshot ref
- TTL: Grace period 7 days → enforcement 90 days → permanent archival

**Infrastructure:**
- Tenant Resolver enforces soft-lock check before route handler
- License Service single source of truth
- Provisioning Worker handles async snapshot creation
- Master DB snapshot storage (S3 or integrated)

---

## Clarifications Required

**1 Snapshot Location Determinism** (Non-Blocking)
- **Question:** Are snapshot storage paths deterministically calculated (e.g., `s3://snapshots/{tenant_id}/{timestamp}.tar.gz`) or configurable per workspace?
- **Impact:** Minor — affects plan storage layer detail
- **Default Assumption:** Deterministic paths (Option A)
- **Status:** Can be resolved in Step 2 (Clarify) or deferred to planning if unambiguous

---

## Constitutional Compliance

| Check | Status | Notes |
| --- | --- | --- |
| No cross-tenant access introduced | ✅ | Snapshots and deletion scoped per tenant; tenant resolver enforces isolation |
| License middleware requirement captured | ✅ | Soft-lock enforced in Tenant Resolver middleware (before handler) |
| Snapshot integrity requirement captured | ✅ | Snapshots immutable after creation; version & schema tagged |
| Idempotency strategy defined | ✅ | State transitions idempotent: SOFT_LOCKED → ACTIVE twice returns same state |
| Transaction boundaries identified | ✅ | snapshot_created → audit_logged atomic; restore → version_check → create transactional |
| Server-authoritative time enforced | ✅ | All timestamps (grace_until, archived_at, deleted_at) server-generated |
| Attempt isolation preserved | ✅ | Archived/deleted workspaces unreachable via attempt engine |
| Worker authority enforced | ✅ | Async snapshot creation delegated to Worker; API only initiates |

**Overall:** COMPLIANT ✅

---

## Open Risks

**1. Snapshot Storage Availability**
- Risk: Snapshot creation fails → workspace stuck in SOFT_LOCKED indefinitely
- Mitigation: Worker retry policy (max 3 retries) with exponential backoff; alert on persistent failure; admin manual action

**2. Concurrent State Transitions**
- Risk: Two requests arrive during grace period → race to ARCHIVED
- Mitigation: SELECT FOR UPDATE in License Service; state transition validates current state before write

**3. Schema Incompatibility on Restore**
- Risk: Snapshot schema_version incompatible with current product version
- Mitigation: Version compatibility matrix checked before restore; admin notified; restore blocked with clear error

---

## Next Step

Proceed to Step 2 — Clarify. One non-blocking clarification identified (snapshot location determinism); can be resolved interactively or deferred to planning based on user preference.

