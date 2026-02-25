# Tasks Report – STAGE_14_MMC_MEMBERS

**Generated:** 2026-02-25T16:15:00Z  
**Stage:** STAGE_14_MMC_MEMBERS  
**Phase:** 02_PLATFORM_MMC  
**Step:** 4 – Tasks

---

## Task Summary

✅ **Total Tasks:** 62 atomic, sequentially-ordered implementation tasks  
✅ **Parallelizable:** 28 tasks marked [P] (45% parallelism potential)  
✅ **Critical Path:** ~15 tasks on main dependency chain  
✅ **Estimated Duration:** 5-6 weeks (full-team parallel, 4-5 engineers)

---

## Task Breakdown by Phase

### Phase 1: Database Migrations (6 Tasks)

Foundation layer: All schema creation before any code.

| Task | Title                                          | Status |
| ---- | ---------------------------------------------- | ------ |
| T001 | Create mmc_members table                       | [ ]    |
| T002 | Create roles table                             | [ ]    |
| T003 | Create role_permissions table                  | [ ]    |
| T004 | Create mmc_member_invitations table            | [ ]    |
| T005 | Create mmc_audit_log table (immutable)         | [ ]    |
| T006 | Create request_log table (idempotency support) | [ ]    |

**Dependencies:** None (can start immediately)  
**Estimated Duration:** 2-3 hours total  
**Success Criteria:**

- All migrations run without errors
- All constraints applied (FK, UNIQUE, CHECK)
- All indexes created
- Schema version incremented

---

### Phase 2: Middleware & Infrastructure (6 Tasks)

Authentication and authorization foundation: All endpoints depend on this.

| Task     | Title                                                         | Parallelizable |
| -------- | ------------------------------------------------------------- | -------------- |
| T007 [P] | Implement MMC JWT validation middleware                       | Yes            |
| T008 [P] | Implement MMC permission enforcement middleware               | Yes            |
| T009 [P] | Implement token_version cascade invalidation on role change   | Yes            |
| T010 [P] | Implement idempotency-key request logging (hybrid Redis + DB) | Yes            |
| T011     | Implement rate limiting (5/min login, 10/min creation)        | Yes            |
| T012 [P] | Implement structured logging with correlation_id propagation  | Yes            |

**Dependencies:** Phase 1 (schema)  
**Estimated Duration:** 6-8 hours  
**Success Criteria:**

- All middleware passes unit tests
- Auth middleware rejects workspace-scoped tokens
- Permission matrix correctly lookups from DB
- Token invalidation cascades to all affected sessions
- Rate limiting blocks excess requests with 429 response

---

### Phase 3: User Story 1 – Member CRUD (8 Tasks)

Core member management: Basic create, read, update, disable operations.

| Task     | Title                                                                  | Parallelizable |
| -------- | ---------------------------------------------------------------------- | -------------- |
| T013     | Create MMC member service (domain logic)                               | [ ]            |
| T014 [P] | Implement POST /mmc/members (create) endpoint                          | Yes            |
| T015 [P] | Implement GET /mmc/members/:id (read) endpoint                         | Yes            |
| T016 [P] | Implement PATCH /mmc/members/:id (update) endpoint                     | Yes            |
| T017 [P] | Implement DELETE /mmc/members/:id (soft disable) endpoint              | Yes            |
| T018 [P] | Implement GET /mmc/members (list with pagination)                      | Yes            |
| T019 [P] | Unit tests: MMC member service                                         | Yes            |
| T020 [P] | Integration tests: Member endpoints (create → read → update → disable) | Yes            |

**Dependencies:** Phase 2 (middleware)  
**Estimated Duration:** 8-10 hours  
**Success Criteria:**

- Member creation returns 201 with generated ID
- Username uniqueness enforced (409 on duplicate)
- Email uniqueness enforced (409 on duplicate)
- Update validates input and returns 200
- Disable sets status=DISABLED and increments token_version
- List endpoint supports pagination (offset, limit)
- All responses match error contract

---

### Phase 4: User Story 2 – Role & Permission Management (8 Tasks)

RBAC core: Role CRUD, permission matrix updates with cascading session invalidation.

| Task     | Title                                                                              | Parallelizable |
| -------- | ---------------------------------------------------------------------------------- | -------------- |
| T021     | Create roles service (domain logic)                                                | [ ]            |
| T022 [P] | Implement GET /mmc/roles (list all roles)                                          | Yes            |
| T023 [P] | Implement GET /mmc/roles/:id (role detail)                                         | Yes            |
| T024 [P] | Implement GET /mmc/roles/:id/permissions (permission matrix)                       | Yes            |
| T025 [P] | Implement PATCH /mmc/roles/:id/permissions (batch update + cascade)                | Yes            |
| T026 [P] | Implement POST /mmc/roles (create role)                                            | Yes            |
| T027 [P] | Implement DELETE /mmc/roles (with FK safety check)                                 | Yes            |
| T028 [P] | Unit tests: Role service; Integration tests: Role endpoints + cascade verification | Yes            |

**Dependencies:** Phase 3 (member service)  
**Estimated Duration:** 10-12 hours  
**Success Criteria:**

- Permission matrix accurately reflects role assignments
- Role permission edit cascades token_version increment to ALL affected members
- Within 100ms of cascade, affected sessions become invalid (401 on next request)
- Role deletion rejected if members assigned (FK constraint + 409 response)
- All permission domains enumerated correctly

---

### Phase 5: User Story 3 – Authentication & Sessions (7 Tasks)

Login, logout, session management, token validation.

| Task     | Title                                                                        | Parallelizable |
| -------- | ---------------------------------------------------------------------------- | -------------- |
| T029     | Create auth service (domain logic)                                           | [ ]            |
| T030 [P] | Implement POST /mmc/auth/login (with bcrypt validation + rate limiting)      | Yes            |
| T031 [P] | Implement POST /mmc/auth/logout (optional; clear session flag)               | Yes            |
| T032 [P] | Implement GET /mmc/auth/me (current user profile)                            | Yes            |
| T033 [P] | Implement GET /mmc/permissions/check (permission matrix for frontend)        | Yes            |
| T034 [P] | Verify token_version cascade invalidates sessions (within 100ms)             | Yes            |
| T035 [P] | Unit tests: Auth service; Integration tests: Login flow + token invalidation | Yes            |

**Dependencies:** Phase 4 (permissions)  
**Estimated Duration:** 8-10 hours  
**Success Criteria:**

- Login returns JWT with token_version
- Invalid credentials return 401 (3 attempts locked for 60s per rate limit)
- JWT validation rejects workspace_id (403)
- Logout clears session (if stateful) or just returns 200 (if stateless)
- Permission check returns all user permissions for UI optimization
- Token invalidation cascade tested under load (100+ concurrent invalidations)

---

### Phase 6: User Story 4 – Invitations & Onboarding (8 Tasks)

Invite workflow: Generate tokens, send emails, accept with password creation.

| Task     | Title                                                                                             | Parallelizable |
| -------- | ------------------------------------------------------------------------------------------------- | -------------- |
| T036     | Create invitations service (domain logic + email support)                                         | [ ]            |
| T037 [P] | Implement POST /mmc/invitations (create + generate token_once)                                    | Yes            |
| T038 [P] | Implement POST /mmc/invitations/:token/accept (accept + create account)                           | Yes            |
| T039 [P] | Implement GET /mmc/invitations (list pending)                                                     | Yes            |
| T040 [P] | Implement GET /mmc/invitations/:id (detail)                                                       | Yes            |
| T041 [P] | Implement POST /mmc/invitations/:id/resend (regenerate token + resend email)                      | Yes            |
| T042 [P] | Implement DELETE /mmc/invitations/:id (cancel pending + cleanup)                                  | Yes            |
| T043 [P] | Unit tests: Invitations service; Integration tests: Full invitation flow (send → expire → accept) | Yes            |

**Dependencies:** Phase 5 (auth)  
**Estimated Duration:** 10-12 hours  
**Success Criteria:**

- Invitation token generated and hashed
- Email sent asynchronously
- Token expiration enforced (24h TTL, 410 GONE on expired)
- Duplicate email handling: multiple pending invitations allowed, first accept wins (409 on second)
- Acceptance creates mmc_members record + sets password
- Expired cleanup job runs automatically (or manual trigger)

---

### Phase 7: Testing & Validation (12 Tasks)

Comprehensive testing: Unit, integration, concurrency, edge cases.

| Task     | Title                                                                          | Parallelizable |
| -------- | ------------------------------------------------------------------------------ | -------------- |
| T044 [P] | Unit tests: All service layer functions (member, role, auth, invitations)      | Yes            |
| T045 [P] | Integration tests: All API flows (CRUD sequences, cascades, permission checks) | Yes            |
| T046 [P] | Concurrency tests: Token cascade under 100+ parallel updates                   | Yes            |
| T047 [P] | Concurrency tests: Duplicate member creation (idempotency + constraint)        | Yes            |
| T048 [P] | Concurrency tests: Role deletion blocked with members assigned                 | Yes            |
| T049 [P] | Edge case tests: Expired invitations, duplicate emails, FK violations          | Yes            |
| T050 [P] | Load tests: Permission check latency (target p95 <50ms)                        | Yes            |
| T051 [P] | Load tests: Member creation throughput (target p95 <200ms)                     | Yes            |
| T052 [P] | Snapshot tests: API error responses (all error codes)                          | Yes            |
| T053 [P] | Audit log tests: All state changes logged with before/after snapshots          | Yes            |
| T054 [P] | Idempotency tests: Duplicate requests return cached response                   | Yes            |
| T055 [P] | Rate limiting tests: Login lockout, creation throttle                          | Yes            |

**Dependencies:** Phase 6 (all features)  
**Estimated Duration:** 12-15 hours  
**Success Criteria:**

- All tests pass (unit: 100%, integration: 100%)
- Concurrency tests show no race conditions
- Performance targets met (p95 <50ms for checks, <200ms for creation)
- 100% audit log coverage
- Edge cases handled without data corruption
- Rate limiting blocks correctly

---

### Phase 8: Polish & Observability (7 Tasks)

Final touches: Logging improvements, documentation, performance tuning.

| Task     | Title                                                                              | Parallelizable |
| -------- | ---------------------------------------------------------------------------------- | -------------- |
| T056 [P] | Add structured logging to all endpoints (correlation_id, user_id, action)          | Yes            |
| T057 [P] | Add observability: API latency metrics (Prometheus-compatible)                     | Yes            |
| T058 [P] | Add observability: Database query metrics                                          | Yes            |
| T059 [P] | Performance tuning: Index verification + query plans                               | Yes            |
| T060 [P] | Documentation: API README + endpoint examples                                      | Yes            |
| T061 [P] | Documentation: Developer guide (authentication, permission checks, error handling) | Yes            |
| T062 [P] | Final validation: All acceptance criteria verified; no regressions                 | Yes            |

**Dependencies:** Phase 7 (testing)  
**Estimated Duration:** 6-8 hours  
**Success Criteria:**

- All logs structured (JSON) with required fields
- Metrics exposed on /metrics endpoint
- Database queries optimized per performance targets
- API documentation complete and accurate
- Developer guide includes code examples
- All acceptance criteria from spec met

---

## Task Dependencies & Critical Path

```
Phase 1 (6 tasks)
  ↓
Phase 2 (6 tasks) [Middleware foundational]
  ↓
Phase 3 (8 tasks) [US1 – Member CRUD] ────→ (6 parallelizable)
  ↓
Phase 4 (8 tasks) [US2 – Roles] ──────────→ (6 parallelizable)
  ↓
Phase 5 (7 tasks) [US3 – Auth] ──────────→ (6 parallelizable)
  ↓
Phase 6 (8 tasks) [US4 – Invitations] ──→ (6 parallelizable)
  ↓
Phase 7 (12 tasks) [Testing] ───────────→ (12 parallelizable)
  ↓
Phase 8 (7 tasks) [Polish] ─────────────→ (7 parallelizable)
```

**Critical Path (Sequential):**

1. Phase 1 (schema) – 2-3 hours
2. Phase 2 (middleware) – 6-8 hours
3. Phase 3 (member CRUD) – 2-3 hours (core logic only)
4. Phase 4 (roles) – 2-3 hours (core logic only)
5. Phase 5 (auth) – 2-3 hours
6. Phase 6 (invitations) – 2-3 hours
7. Phase 7 (testing) – can run in parallel with Phase 8
8. Phase 8 (polish) – 1-2 hours

**Total Critical Path:** ~20-25 hours (3-4 days for single engineer, or 1 day with 4-5 engineers)

---

## Parallelization Opportunity

- **Phase 3:** 6 of 8 tasks marked [P] (CRUD endpoints can be coded in parallel after member service)
- **Phase 4:** 6 of 8 tasks marked [P] (role/permission endpoints independent)
- **Phase 5:** 6 of 7 tasks marked [P]
- **Phase 6:** 6 of 8 tasks marked [P]
- **Phase 7:** 12 of 12 tasks marked [P] (all tests can run in parallel)
- **Phase 8:** 7 of 7 tasks marked [P]

**Total Parallelizable:** 43 of 62 tasks (69% parallelism potential)

**With 4 Engineers:**

- Phase 1: 1 engineer (2-3h)
- Phase 2: 2 engineers (3-4h)
- Phases 3-6: 4 engineers (2-3h each phase, total 8-12h)
- Phases 7-8: 1-2 engineers (6-8h parallel)
- **Total: 1-2 weeks** (vs. 5-6 weeks single engineer)

---

## Success Criteria – Foundation

Every task must satisfy:

✅ **Code Quality:**

- ESLint passes
- TypeScript strict mode passes (no any)
- No console.log (use structured logger)

✅ **Testing:**

- Unit tests: ≥80% coverage for services
- Integration tests: ≥90% coverage for API flows
- Any concurrency → explicit concurrency test

✅ **Observability:**

- Structured logs with correlation_id
- Error codes match error contract
- Metrics (if applicable)

✅ **Constitutional Alignment:**

- No tenant resolver calls in MMC code
- All transactions atomic
- No plaintext secrets
- Master_db only

---

## Ready for Drift Analysis & Implementation

All 62 tasks are atomic, sequenced, and parallelizable.

**Next Steps:**

1. Drift analysis (speckit.analyze) — validate against constitution
2. Implementation (speckit.implement) — execute tasks per phase
3. Validation (test harness) — verify all acceptance criteria
