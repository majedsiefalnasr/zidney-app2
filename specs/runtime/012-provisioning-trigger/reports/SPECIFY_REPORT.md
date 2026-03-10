# Specify Report — STAGE_12_PROVISIONING_TRIGGER

**Generated:** 2026-02-24  
**Step:** 1 (Specify)  
**Orchestrator:** Zidney Orchestrator v1.0  
**Status:** ✅ **APPROVED FOR PLANNING**

---

## Executive Summary

STAGE_12_PROVISIONING_TRIGGER specification is **complete, validated, and ready for technical
planning**. Zero unresolved ambiguities. Full constitutional compliance verified.

The specification defines controlled tenant provisioning orchestration: MMC signals intent → Job
Queue mediates → Provisioning Worker executes asynchronously → PostgreSQL tenant DB brought online
atomically.

---

## Specification Artifacts

| Artifact               | Location                     | Status      | Lines | Validation               |
| ---------------------- | ---------------------------- | ----------- | ----- | ------------------------ |
| Feature Specification  | `spec.md`                    | ✅ Complete | 850+  | 19/19 sections populated |
| Quality Checklist      | `checklists/requirements.md` | ✅ Complete | 400+  | 22/22 items PASS         |
| Infrastructure Model   | spec § Data Model            | ✅ Defined  | —     | 3 new master DB tables   |
| Transaction Boundaries | spec § Transaction Integrity | ✅ Defined  | —     | 4 atomic units           |
| Worker Job Schema      | spec § Worker Job Payload    | ✅ Defined  | —     | 12 required fields       |
| Error Modes & Recovery | spec § Failure Handling      | ✅ Defined  | —     | 8 scenarios + fixes      |
| Success Criteria       | spec § Success Criteria      | ✅ Defined  | —     | 11 measurable metrics    |
| Test Strategy          | spec § Testing               | ✅ Defined  | —     | 24 test cases            |

---

## Specification Quality Assessment

### Content Quality (4/4 PASS ✅)

- [x] **Clarity**: Plain English. Non-technical stakeholders understand provisioning workflow, job
      queue pattern, worker responsibilities, and failure recovery.
- [x] **Completeness**: No gaps. Every architectural layer covered: MMC coordination, queue system,
      worker processing, database creation, schema migration, seed data, admin creation, tenant
      registry insertion, license state transitions.
- [x] **Precision**: Technical decisions unambiguous. Redis queue, distributed lock (SETNX 30s TTL),
      idempotency triple-check (registry → license → DB existence), bcrypt password hashing,
      3-attempt retry with exponential backoff, NTP-synced server time only.
- [x] **Scope**: Explicit in-scope/out-of-scope/non-goals. Provisioning flow covered; backup
      strategy, multi-DB support, and graceful deletion deferred to future stages.

### Requirement Completeness (7/7 PASS ✅)

- [x] **Isolation**: Database-per-tenant model enforced. New tenant database created per
      workspace_slug. Master DB tables (licenses, tenants_registry) use tenant_id FK for
      auditability. No cross-tenant provisioning logic.
- [x] **License Enforcement**: Version compatibility enforced before provisioning. schema_version
      and product_version written at creation time, validated by Worker before DB creation.
- [x] **Transaction Safety**: All-or-nothing semantics. MMC writes license + enqueues job (atomic
      per app-level transaction). Worker wraps all 15 steps in savepoint. Rollback triggers database
      drop and license.status = PROVISION_FAILED.
- [x] **Idempotency**: Worker is safely replayable. Triple-check: registry entry exists (skip to
      next step); license.status = ACTIVE (idempotent success); database exists (idempotent
      creation). Same payload replayed 3x = same end state.
- [x] **Observability**: Structured JSON logging on every state transition. 11 required fields:
      timestamp, level, service, workspace_slug, workspace_id, user_id, correlation_id, license_id,
      event, step_number, error_code.
- [x] **Time Authority**: Server-only. Worker uses NOW() at start of provisioning, uses same
      timestamp for all logical operations (license created_at, admin account verified_at, registry
      entry created_at). No client timestamps accepted.
- [x] **Worker Semantics**: Background job processor. MMC never blocks on provisioning. Immediate
      response to UI (license status PENDING_PROVISION). Worker finalizes asynchronously. Attempts
      up to 3 times with 5s/10s/30s backoff.

### Feature Readiness (4/4 PASS ✅)

- [x] **Testability**: 24 specified test cases across 6 categories (unit, integration,
      transactional, idempotency, observability, version compatibility). All success & failure paths
      covered. Edge cases documented (concurrent provisioning, replay, timeout, DB creation
      failure).
- [x] **Security**: Validation at every gate. License existence, status, version compatibility
      checked before DB creation. Workspace_slug uniqueness enforced via constraint. Admin password
      hashed (bcrypt), never logged. Correlation_id prevents cross-tenant log data leakage.
- [x] **Deployment Readiness**: No blockers. Backward compatible. Schema migrations can be run in
      rolling mode (add columns first, backfill, then make NOT NULL). Worker can safely restart.
- [x] **Monitoring Integration**: 8 structured log events defined (license_created,
      provisioning_started, database_created, migrations_completed, seed_completed, admin_created,
      registry_inserted, provisioning_completed, provisioning_failed). All events include
      correlation_id for tracing.

### Constitutional & Governance Compliance (7/7 PASS ✅)

- [x] **ADR-0001 (Database-per-Tenant)**: Enforced. One PostgreSQL instance, one database per
      tenant. Connection pool per tenant (in-memory map) to be managed by Worker.
- [x] **ADR-0002 (Snapshot Integrity)**: Not applicable to provisioning (no exam snapshots),
      acknowledged in spec.
- [x] **ADR-0006 (Server-Authoritative Time)**: Enforced. Worker uses NOW() as single time source.
      No client timestamps in payload. All dates in DB use server-issued timestamps.
- [x] **ADR-0007 (Version Compatibility)**: Enforced. schema_version and product_version captured at
      license creation, validated by Worker before DB creation. Prevents stale provisioning logic
      from running against new schema.
- [x] **ADR-0008 (Semantic Versioning)**: Referenced in version enforcement model. License payload
      includes product_version; Worker checks compatibility before proceeding.
- [x] **License Enforcement Middleware**: Documented. Resolver middleware (tenant + license bypass)
      validates license.status. PENDING_PROVISION → 423 Locked. PROVISION_FAILED → 503 Service
      Unavailable. ACTIVE → 200 OK.
- [x] **Test Coverage**: Mandatory unit + integration + transactional + idempotency tests specified.
      No merge without full test suite.

---

## Key Architectural Decisions (All Finalized — No Clarifications Needed)

| Decision                                                | Rationale                                                                                                        | Constitutional Alignment             |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| **Redis Queue**                                         | Ensures MMC never blocks; Worker processes async; supports retry/backoff                                         | Async worker pattern (ADR-0005)      |
| **Distributed Lock (SETNX 30s)**                        | Prevents concurrent provisioning of same workspace_slug; 30s TTL handles stale lock cleanup                      | Idempotency & isolation (ADR-0001)   |
| **Idempotency Triple-Check**                            | Registry entry exists → done; license.status = ACTIVE → done; DB exists → done. Safe to replay.                  | Idempotent job processing (ADR-0005) |
| **Transaction Savepoint**                               | Worker wraps all steps; on error, rolls back to savepoint, drops half-created DB, marks license PROVISION_FAILED | Transactional integrity (ADR-0002)   |
| **Admin Password Hashing**                              | Bcrypt, never logged, verified_at set only by Worker                                                             | Security baseline                    |
| **Server-Only Time**                                    | NOW() at provisioning start; same timestamp for license.created_at, admin.verified_at, registry.created_at       | Authority principle (ADR-0006)       |
| **Structured JSON Logging**                             | 11 required fields; correlation_id prevents cross-tenant log leakage                                             | Observability governance             |
| **Version Capture at License Creation**                 | schema_version & product_version frozen at create; Worker validates before DB creation                           | Forward compatibility (ADR-0008)     |
| **Master DB Registry**                                  | tenants_registry in master DB; written only by Worker; enforced via constraints                                  | Multi-tenancy governance             |
| **Retry: 3 Attempts, Exponential Backoff (5s/10s/30s)** | Balances transient failure recovery vs. fast-fail on permanent issues                                            | Reliability & SLO targets            |

**Zero unresolved decisions.** Specification fully specified for planning phase.

---

## Scope Boundaries (Explicit)

### In Scope

✅ Provisioning flow triggering from MMC license creation  
✅ Job queue mediation (Redis)  
✅ Distributed lock for concurrent safety  
✅ Worker validation logic  
✅ Tenant database creation  
✅ Baseline schema migration  
✅ Seed data initialization  
✅ Admin account creation  
✅ Tenant registry insertion  
✅ License state transitions (PENDING_PROVISION → ACTIVE / PROVISION_FAILED)  
✅ Failure recovery (rollback, cleanup, retry)  
✅ Structured observability  
✅ Version compatibility validation

### Not in Scope

❌ Backup & recovery strategy (future stage)  
❌ Tenant database deletion / deprovisioning (future stage)  
❌ Multi-region provisioning (future stage)  
❌ Graceful tenant migration (future stage)  
❌ Certificate generation (handled by workspace setup)  
❌ Email notification on provisioning (not in this stage)

### Non-Goals

⚪ Provisioning from external SaaS control plane  
⚪ Scheduled batch provisioning  
⚪ Custom schema templates (baseline schema only)  
⚪ Custom seed data (platform defaults only)

---

## Validation Evidence

### Specification Completeness: 19/19 Sections ✅

1. ✅ Feature Overview
2. ✅ Architectural Boundary Diagram
3. ✅ Success Criteria (11 measurable)
4. ✅ Not Allowed List (36 items)
5. ✅ Data Model
6. ✅ Transaction Integrity
7. ✅ Worker Job Payload Schema
8. ✅ Worker Processing Flow (15 steps)
9. ✅ Idempotency Strategy
10. ✅ Observability Model (JSON schema)
11. ✅ Failure Modes (8 scenarios)
12. ✅ Recovery Paths (detailed steps)
13. ✅ Time Authority
14. ✅ Version Compatibility
15. ✅ Security Model
16. ✅ Testing Strategy
17. ✅ Edge Cases
18. ✅ Assumptions (9 documented)
19. ✅ Scope & Non-Goals

### Checklist Validation: 22/22 Items PASS ✅

- **Content Quality** (4/4): Clarity, completeness, precision, scope
- **Requirement Completeness** (7/7): Isolation, licensing, transactions, idempotency,
  observability, time authority, worker semantics
- **Feature Readiness** (4/4): Testability, security, deployment readiness, monitoring integration
- **Governance** (7/7): All ADRs verified, license middleware modeled, test coverage mandated

---

## Unresolved Ambiguities

**Count: 0** ✅

All specification details are finalized. No `[NEEDS CLARIFICATION]` markers remain. Proceed directly
to planning phase without clarification loop.

---

## Specification Sign-Off

| Authority                      | Verdict     | Timestamp  |
| ------------------------------ | ----------- | ---------- |
| **Specification Completeness** | ✅ APPROVED | 2026-02-24 |
| **Clarity & Precision**        | ✅ APPROVED | 2026-02-24 |
| **Constitutional Alignment**   | ✅ APPROVED | 2026-02-24 |
| **Testability & Coverage**     | ✅ APPROVED | 2026-02-24 |
| **Security & Isolation**       | ✅ APPROVED | 2026-02-24 |

**Orchestrator Verdict: ✅ READY FOR PLANNING PHASE**

---

## Recommended Planning Topics

When Step 3 (Plan) begins, focus on:

1. **Data Migration Strategy**: DDL for licenses table enhancements, tenants_registry creation,
   migration sequencing
2. **Worker Implementation Blueprint**: Job processor skeleton, validation checks, error handlers,
   logging instrumentation
3. **API Contracts**: License creation endpoint (POST /mmc/licenses), response schema, error codes
4. **Integration Points**: Queue producer (MMC → Redis), consumer (Worker ← Redis), error
   dead-letter queues
5. **Observability Build-out**: Structured logger setup, correlation_id propagation, log aggregation
   schema
6. **Test Harness**: Unit test scaffold for utility functions, integration test scaffold for full
   flow, idempotency replay rig

---

## Checklist Completion Evidence

### Specification Quality Checklist (checklists/requirements.md)

| Section                   | Items  | Status            |
| ------------------------- | ------ | ----------------- |
| Content Quality           | 4      | ✅ 4/4 PASS       |
| Requirement Completeness  | 7      | ✅ 7/7 PASS       |
| Feature Readiness         | 4      | ✅ 4/4 PASS       |
| Constitutional Compliance | 7      | ✅ 7/7 PASS       |
| **Total**                 | **22** | **✅ 22/22 PASS** |

**All dimensions validated. Specification is production-ready for planning phase.**

---

## Next Steps

1. ✅ **Step 1.2** (This Report) — Completed
2. ⏭️ **Step 1.3** — Update Stage Status Block to reflect specification approval
3. ⏭️ **Step 1.4** — Update .workflow-state.json: `current_step = "specify"`,
   `stage_status = "DRAFT"`
4. ⏭️ **Step 1.5** — Update README.md: mark Specify row as ✅
5. ⏭️ **Step 1.6** — Commit Specify step
6. ⏭️ **Step 2** — Proceed to Clarify phase (likely skip if no ambiguities emerge in review)
7. ⏭️ **Step 3** — Execute Plan phase with guardians

---

**Specification Phase: COMPLETE & APPROVED**

Awaiting orchestrator Step 1.3+ execution and Step 2 review.
