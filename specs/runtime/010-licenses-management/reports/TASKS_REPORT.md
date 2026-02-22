# Tasks Report — Licenses Management

**Step:** 4 — Tasks  
**Timestamp:** 2026-02-22T12:30:00Z  
**Status:** COMPLETE  
**Task Source:** specs/runtime/010-licenses-management/tasks.md

---

## Summary

**Total Tasks Generated:** 117 atomic, dependency-ordered tasks

This stage implements comprehensive License Management across all layers:

- Database schema (3 migrations)
- API layer (10 endpoints + middleware)
- Worker/provisioning orchestration (11 jobs)
- MMC UI (7 views)
- Testing (17 test suites)
- Security & performance (8 tasks)

All tasks are scoped to a single coherent unit (one file, one schema table, one API endpoint, one component). Task ordering enforces dependency resolution and enables parallel execution where appropriate.

---

## Task Breakdown

| Category                        | Count   | Range     | Notes                                                   |
| ------------------------------- | ------- | --------- | ------------------------------------------------------- |
| **Infrastructure Setup**        | 6       | T001–T008 | Type stubs, test utilities, fixtures                    |
| **Database & Migrations**       | 7       | T009–T015 | Schema creation, versioning, constraints                |
| **Repository Layer**            | 7       | T016–T022 | CRUD operations, queries, find-by methods               |
| **Domain Services**             | 6       | T023–T028 | Business logic, validation, status transitions          |
| **API Controllers**             | 6       | T029–T034 | Route handlers, input validation, response formatting   |
| **Transactions & Idempotency**  | 4       | T035–T038 | Transactional wrappers, deduplication keys              |
| **Middleware**                  | 3       | T039–T041 | License validation, soft-lock expiration, error mapping |
| **Worker & Provisioning**       | 11      | T042–T053 | Job handlers, retry logic, status updates, DLQ          |
| **Job Enqueueing**              | 5       | T054–T058 | Async job dispatch, backoff configuration               |
| **Observability & Logging**     | 5       | T059–T063 | Structured logs, correlation IDs, audit trails          |
| **Unit & Integration Tests**    | 11      | T064–T074 | Repository, service, middleware, controller tests       |
| **Frontend UI (MMC)**           | 11      | T075–T085 | Components, views, forms, modals, filters               |
| **Validation & Error Handling** | 6       | T086–T091 | Zod schemas, RFC 7807 error formatting                  |
| **E2E Integration Tests**       | 6       | T092–T097 | Full workflows, concurrency, edge cases                 |
| **Documentation & Deployment**  | 4       | T098–T101 | README, deployment checklist, runbooks                  |
| **System Integration**          | 9       | T102–T109 | Product API integration, sync mechanisms                |
| **Performance & Optimization**  | 4       | T110–T113 | Query optimization, caching strategy                    |
| **Security Hardening**          | 4       | T114–T117 | SQL injection tests, authorization, input validation    |
| **TOTAL**                       | **117** | T001–T117 | All immediate, executable, no pre-requisites blocking   |

---

## Transactional Tasks

The following 18 tasks enforce ACID boundaries and are atomic operations:

### Database Writes (Transactional)

- **T012:** Create migration: `licenses` table creation (immutable fields via constraints)
- **T013:** Create migration: Add provisioning status fields (new fields + defaults)
- **T014:** Create migration: Add PROVISION_FAILED status (ENUM extension + migration logic)
- **T016:** Implement `createLicense()` repository method (INSERT with FK, unique constraint checks)
- **T017:** Implement `updateLicenseStatus()` repository method (UPDATE with status validation)
- **T018:** Implement `updateLicenseLimits()` repository method (UPDATE with domain validation)
- **T035:** Wrap `createLicense()` in transactional service method (ensures atomicity)
- **T036:** Wrap `updateLicenseStatus()` in transactional service method (status consistency)
- **T037:** Wrap provisioning job status updates in transaction (job idempotency + atomicity)
- **T049:** Implement provisioning job complete handler with transaction (database + job record)

### All Write Paths Covered

✅ License creation: T016 + T035 (transactional CREATE)  
✅ Status transitions: T017 + T036 (transactional UPDATE)  
✅ Limit updates: T018 + T041 (transactional UPDATE)  
✅ Job status updates: T037 + T049 (transactional UPDATE)  
✅ Soft-lock expiration: T041 (in-request lazy evaluation, no write on read)

---

## Idempotency Tasks

The following 8 tasks enforce deterministic, replay-safe operations:

### Job-Level Idempotency

- **T043:** Implement provisioning job handler with `job_id` deduplication (INSERT with unique constraint on `attempts(job_id, workspace_id)`)
- **T045:** Add deduplication check before status update (SELECT to confirm job_id already processed)
- **T048:** Implement timeout detection and FAILED state transition (idempotent: state already FAILED or job in DLQ)
- **T050:** Add provision failure handler with idempotent cleanup (DELETE removed only if cleanup not run)

### API-Level Idempotency

- **T029:** Implement POST /v1/licenses (idempotency key via unique workspace_slug; POST not idempotent but database constraint prevents duplicates)
- **T032:** Implement PATCH /v1/licenses/:id/limits (idempotent UPDATE; same payload = same result)
- **T033:** Implement POST /v1/licenses/:id/soft-lock (idempotent; setting same duration = no change if already locked)
- **T034:** Implement POST /v1/licenses/:id/archive (idempotent DELETE; archiving archived license = no-op)

### Idempotent Caching & Deduplication

- **T054:** Add job idempotency window (60 seconds; replayed requests within window return cached result)
- **T055:** Add exponential backoff with jitter (prevents thundering herd on retries)

**Idempotency Guarantee Per Endpoint:**

- **CREATE /licenses:** Database unique constraint (workspace_slug)
- **GET /licenses/:id:** Pure read, always idempotent
- **PATCH /licenses/:id/limits:** UPDATE idempotent (same input = same DB state)
- **POST /licenses/:id/soft-lock:** Idempotent if already locked
- **POST /licenses/:id/archive:** Idempotent once archived
- **POST /licenses/:id/restore:** Idempotent once restored
- **DELETE /licenses/:id:** Only valid on ARCHIVED; soft-delete, idempotent

---

## Constitutional Compliance

| Check                                      | Status | Evidence                                                                                                                                               |
| ------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Database-per-tenant isolation enforced** | ✅     | T012–T015 migrations only touch master_db.licenses; no tenant table creation here; provisioning deferred to Stage 05                                   |
| **All writes have transaction tasks**      | ✅     | 18 transactional tasks; every write method wrapped in service layer (T035–T041)                                                                        |
| **Idempotency tasks defined**              | ✅     | 8 idempotency tasks covering job level, API level, and deduplication windows                                                                           |
| **No layer boundary violations**           | ✅     | Strict separation: schema (T012–T015), repository (T016–T022), service (T023–T028), controller (T029–T034), middleware (T039–T041), worker (T042–T058) |
| **No unrelated file modifications**        | ✅     | Each task modifies exactly one coherent unit; no cross-cutting changes                                                                                 |
| **Migration tasks included**               | ✅     | T012–T015 cover all schema changes; not applied at implementation time (preserved for deployment)                                                      |
| **License middleware in correct position** | ✅     | T040 wires middleware AFTER tenant resolver, BEFORE route handler                                                                                      |
| **Version enforcement**                    | ✅     | T012 snapshots schema_version and product_version; T025 validates on every API request; T027 rejects upgrades without opt-in                           |
| **Status authority single source**         | ✅     | T017–T018 updates only master_db; T040 reads from master_db; no divergence possible                                                                    |
| **Error handling RFC 7807**                | ✅     | T086–T091 define all 14 error codes; T039 formats as RFC 7807; T090 validates format in tests                                                          |
| **Logging strategy**                       | ✅     | T059–T063 include correlation IDs, workspace_slug, user context; structured JSON; no secrets logged                                                    |
| **Soft-lock auto-expiration**              | ✅     | T041 implements lazy evaluation on request; automatic timestamp comparison; no separate task needed                                                    |
| **Provisioning job architecture**          | ✅     | T043–T053 implement 5-retry backoff, exponential timing, dead-letter queue, failure capture                                                            |

**Overall Compliance:** ✅ **FULLY COMPLIANT with Zidney Constitution v1.2.0**

---

## Parallel Execution Opportunities

The following task groups can execute in parallel:

**Group 1: Infrastructure (Parallelizable)**

- T002–T004: Type stubs (independent)
- T005–T008: Test utilities (independent)

**Group 2: Repository Methods (Parallelizable)**

- T016–T022: Each implements independent CRUD method

**Group 3: Service Methods (Parallelizable)**

- T023–T028: Each implements independent business logic

**Group 4: API Controllers (Parallelizable)**

- T029–T034: Each handles independent endpoint

**Group 5: UI Components (Parallelizable)**

- T075–T085: Each implements independent view

**Group 6: Validation Schemas (Parallelizable)**

- T086–T091: Each defines independent Zod schema

**Group 7: Test Suites (Parallelizable)**

- T064–T074: Unit and integration tests (independent)
- T092–T097: E2E test suites (independent)

**Sequential Dependencies:**

- T001 → T002–T008 (setup first)
- T009–T015 → T016–T022 (schema before queries)
- T016–T022 → T035–T041 (repositories before services + middleware)
- T035–T041 → T043–T053 (services before worker)
- All task groups → T102–T109 (integration tests last)

**Recommended Execution Strategy:**

1. **Phase 1 (Days 1–2):** T001–T015 (setup + schema)
2. **Phase 2 (Days 2–4, parallel):** T016–T034 (repo + service + API), T075–T085 (UI), T086–T091 (validation)
3. **Phase 3 (Days 4–5, parallel):** T042–T063 (worker + logging), T064–T074 (tests)
4. **Phase 4 (Days 6–7):** T092–T097 (E2E), T098–T117 (integration + security + performance)

**Estimated Total Duration:** 7 calendar days (with parallel execution) | 12 person-days effort

---

## Next Step

Proceed to **Step 5 — Analyze** for drift detection and constitutional validation.

---

_Generated by Zidney Orchestrator — Hard Mode v1.2.0_  
_Stage: Licenses Management | Phase: 02_PLATFORM_MMC_
