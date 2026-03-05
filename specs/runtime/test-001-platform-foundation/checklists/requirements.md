# Validation Requirements Checklist: STAGE_TEST_01_PLATFORM_FOUNDATION

**Purpose**: Validate that all architectural integrity tests pass before Phase 01 PLATFORM_FOUNDATION promotion to VALIDATED status.

**Created**: 2026-02-26

**Feature**: [Validation Specification](../spec.md)

---

## Pre-Execution Validation

### Environment Setup

- [ ] PostgreSQL database available and accessible
- [ ] Redis/distributed lock system available
- [ ] All Phase 01 stages (02-08) IMPLEMENTED and available
- [ ] Test environment isolated from production
- [ ] Build system passing (no compilation errors)
- [ ] Migration system functional and tested

---

## Area 1: Tenant Isolation Validation

### Test 1.1: Cross-Tenant Data Access Rejection

- [ ] Two workspaces (A and B) created with separate databases
- [ ] User A authenticated with Token A
- [ ] Attempt to access Workspace B resource with Token A
- [ ] Response code is **403 or 404** (not 200)
- [ ] No Workspace B data in response body
- [ ] Audit log records unauthorized access attempt
- [ ] Resolver context shows Workspace A (never B)
- [ ] **Test Status**: ☐ PASS ☐ FAIL ☐ NOT_RUN

**Notes**:

---

### Test 1.2: Master Database Boundary Enforcement

- [ ] Scanned all tenant-bound routes for direct master_db imports
- [ ] All tenant routes use resolver middleware first
- [ ] Tenant context propagates through entire request lifecycle
- [ ] Master DB only accessed for: license lookups, workspace metadata (read-only)
- [ ] Master DB NEVER accessed for: student, attempt, submission data
- [ ] Request middleware order matches specification (Correlation ID → Tenant Resolver → License → Schema Version → Handler)
- [ ] Resolver returns valid tenant context on all requests
- [ ] **Test Status**: ☐ PASS ☐ FAIL ☐ NOT_RUN

**Notes**:

---

### Test 1.3: Resolver Middleware Enforcement

- [ ] Created test configuration with resolver middleware disabled
- [ ] Service startup fails OR first workspace request returns 500/503
- [ ] Error logs indicate: "Tenant context unavailable" or similar
- [ ] No tenant routes accessible without resolver
- [ ] Graceful failure (not silent bypass)
- [ ] Resolver middleware re-enabled: service boots and routes respond normally
- [ ] **Test Status**: ☐ PASS ☐ FAIL ☐ NOT_RUN

**Notes**:

---

### Test 1.4: Workspace Slug Immutability in Context

- [ ] Request body workspace_slug ignored by resolver
- [ ] HTTP headers cannot override resolver context
- [ ] URL parameters cannot override authenticated workspace
- [ ] Resolver always extracts workspace from authenticated source only
- [ ] Audit log shows resolved workspace, not requested workspace
- [ ] **Test Status**: ☐ PASS ☐ FAIL ☐ NOT_RUN

**Notes**:

---

## Area 2: Provisioning Validation

### Test 2.1: Deterministic Database Creation (Idempotency)

- [ ] First provision of Workspace W1 creates database `w1_tenant_db`
- [ ] Database contains all baseline tables with correct schema
- [ ] schema_version matches Phase 01 specification
- [ ] Second provision of W1 returns "already provisioned" response
- [ ] Still only ONE database exists (no `w1_tenant_db_2`)
- [ ] Schema comparison: identical between provisions
- [ ] Table count, indexes, constraints identical
- [ ] **Test Status**: ☐ PASS ☐ FAIL ☐ NOT_RUN

**Notes**:

---

### Test 2.2: Distributed Lock Enforcement Under Concurrency

- [ ] Created workspace W2 (not yet provisioned)
- [ ] Submitted 5 concurrent provisioning requests
- [ ] Exactly ONE database created (no race condition duplicates)
- [ ] All 5 requests eventually succeeded (either provision or "already provisioned")
- [ ] Database schema complete and uncorrupted
- [ ] Lock acquisition timing shows serialization
- [ ] Worker logs show only one provisioning event
- [ ] **Test Status**: ☐ PASS ☐ FAIL ☐ NOT_RUN

**Notes**:

---

### Test 2.3: Baseline Schema Integrity

- [ ] All 8+ critical tables present:
  - [ ] users (id, workspace_id, email, created_at)
  - [ ] roles (id, workspace_id, name)
  - [ ] permissions (id, role_id, resource, action)
  - [ ] students (id, workspace_id, email, enrollment_id)
  - [ ] staff (id, workspace_id, email, role_id)
  - [ ] attempts (id, workspace_id, student_id, exam_id, status)
  - [ ] submissions (id, attempt_id, question_id, answer_data)
  - [ ] questions_snapshot (id, attempt_id, question_id_original, question_data)
  - [ ] schema_version (version, applied_at)
- [ ] All foreign keys present and correct
- [ ] Unique constraints enforce workspace isolation
- [ ] NOT NULL constraints on required fields
- [ ] schema_version table has exactly one row
- [ ] Version matches Phase 01 specification
- [ ] Applied_at timestamp is recent
- [ ] **Test Status**: ☐ PASS ☐ FAIL ☐ NOT_RUN

**Notes**:

---

## Area 3: License Engine Validation

### Test 3.1: License State Machine Integrity

#### 3.1a: Valid Transition ACTIVE → SOFT_LOCKED

- [ ] License L1 created in ACTIVE state
- [ ] PATCH request to change status to SOFT_LOCKED
- [ ] Response code: **200 OK**
- [ ] Database state updated: status = SOFT_LOCKED
- [ ] Workspace access returns **423 (Locked)**

#### 3.1b: Valid Transition SOFT_LOCKED → ARCHIVED

- [ ] License L2 in SOFT_LOCKED state
- [ ] PATCH request to change status to ARCHIVED
- [ ] Response code: **200 OK**
- [ ] Database state updated: status = ARCHIVED
- [ ] Workspace access returns **403 (Forbidden)**

#### 3.1c: Valid Transition SOFT_LOCKED → ACTIVE (Reactivation)

- [ ] License L3 in SOFT_LOCKED state
- [ ] PATCH request to change status to ACTIVE
- [ ] Response code: **200 OK**
- [ ] Workspace now accessible (no 423)

#### 3.1d: Invalid Transition ARCHIVED → ACTIVE (Rejected)

- [ ] License L4 in ARCHIVED state
- [ ] Attempt PATCH to ACTIVE
- [ ] Response code: **409 Conflict** (not 200)
- [ ] Error includes: "Cannot transition from ARCHIVED to ACTIVE"
- [ ] Database state unchanged: still ARCHIVED

#### 3.1e: Invalid Transition DELETED → ACTIVE (Rejected)

- [ ] License L5 in DELETED state
- [ ] Attempt PATCH to ACTIVE or SOFT_LOCKED
- [ ] Response code: **409 Conflict or 410 Gone**
- [ ] No state change

#### Overall Test Status: ☐ PASS ☐ FAIL ☐ NOT_RUN

**Notes**:

---

### Test 3.2: Version Enforcement (Schema Compatibility)

- [ ] Workspace W4 provisioned with schema_version = 2.0.0
- [ ] License points to product_version = 2.0.0
- [ ] Request to W4 returns **200 OK** (versions match)
- [ ] Manually updated schema_version to 1.9.0 (test only)
- [ ] Request to W4 returns **426 Upgrade Required**
- [ ] Error response includes: "Tenant schema v1.9.0 requires upgrade to v2.0.0"
- [ ] Reverted schema_version to 2.0.0
- [ ] Request to W4 returns **200 OK** again
- [ ] **Test Status**: ☐ PASS ☐ FAIL ☐ NOT_RUN

**Notes**:

---

### Test 3.3: License Limit Enforcement

#### 3.3a: Student Limit Enforcement

- [ ] License L6 with max_students = 100
- [ ] Created 100 students
- [ ] 100th student created successfully
- [ ] Attempt to create 101st student
- [ ] Response code: **409 Conflict** (not 200, not 500)
- [ ] Error includes: "Student limit (100) reached"
- [ ] No 101st student created in database

#### 3.3b: Staff Limit Enforcement

- [ ] License L7 with max_staff = 50
- [ ] Created 50 staff members
- [ ] Attempt to create 51st staff member
- [ ] Response code: **409 Conflict**
- [ ] Error includes staff-specific limit message
- [ ] No 51st staff created

#### 3.3c: Limit Check is Transactional

- [ ] License L8 with max_students = 10
- [ ] Bulk create operation with partial failure
- [ ] Entire transaction rolls back (all-or-nothing)
- [ ] Database has 0 new students
- [ ] No partial limit violation

#### Overall Test Status: ☐ PASS ☐ FAIL ☐ NOT_RUN

**Notes**:

---

## Area 4: Migration Discipline Validation

### Test 4.1: Forward-Only Migration Check

- [ ] Scanned all migration files in master and tenant migrations
- [ ] No DROP found in UP sections
- [ ] No DELETE FROM found in UP sections
- [ ] No TRUNCATE found anywhere
- [ ] Destructive SQL only in DOWN sections (if any)
- [ ] Migration validation script passes: `scripts/validate-migrations.sh`
- [ ] All migrations forward-compatible
- [ ] **Test Status**: ☐ PASS ☐ FAIL ☐ NOT_RUN

**Notes**:

---

### Test 4.2: Migration Hash Immutability

- [ ] Selected existing migration file: `002_create_users_table.sql`
- [ ] Recorded baseline hash/content
- [ ] Modified migration file (column definition change)
- [ ] Ran migration validation
- [ ] Validation **FAILED** with hash mismatch message
- [ ] Migration file reverted
- [ ] Validation **PASSED** after revert
- [ ] **Test Status**: ☐ PASS ☐ FAIL ☐ NOT_RUN

**Notes**:

---

### Test 4.3: Duplicate Migration ID Detection

- [ ] Identified highest migration number: e.g., 015
- [ ] Created valid migration: `016_my_migration.sql`
- [ ] Attempted to create duplicate: `016_another_migration.sql` (same number)
- [ ] Ran migration validation
- [ ] Validation **FAILED**: "Duplicate migration ID 016 found"
- [ ] Renamed one migration to 017
- [ ] Validation **PASSED** after rename
- [ ] **Test Status**: ☐ PASS ☐ FAIL ☐ NOT_RUN

**Notes**:

---

## Area 5: Rate Limiting Validation

### Test 5.1: Threshold Enforcement

#### 5.1a: Login Endpoint Rate Limit (5/minute per IP)

- [ ] Configured rate limit: 5 login attempts/minute per IP
- [ ] From IP Address A: submitted 5 login requests
- [ ] All 5 requests succeed (200, 401, or 403 depending on auth)
- [ ] From same IP A: submitted 6th request within same minute
- [ ] Response code: **429 Too Many Requests**
- [ ] Response includes `Retry-After` header
- [ ] Waited for rate limit window to expire
- [ ] 7th request returns **200 or 401** (rate limit reset)

#### 5.1b: API Endpoint Rate Limit (per authenticated user)

- [ ] Configured rate limit: 1000 requests/hour per user
- [ ] Authenticated as User U1
- [ ] Submitted 1000 requests within 1 hour
- [ ] All requests return 200
- [ ] Submitted 1001st request within same hour
- [ ] Response code: **429 Too Many Requests**
- [ ] User U2 makes requests: NOT rate-limited (separate bucket)

#### 5.1c: Submission Endpoint Idempotency + Rate Limit

- [ ] Submitted answer to attempt A1
- [ ] Re-submitted same answer (same attempt, question, data)
- [ ] Response code: **200** (idempotent, no state change)
- [ ] Third distinct submission returns **200 or 429** depending on rate limit policy
- [ ] Idempotent requests bypass rate limiting

#### Overall Test Status: ☐ PASS ☐ FAIL ☐ NOT_RUN

**Notes**:

---

### Test 5.2: Rate Limit Header Verification

- [ ] Made API request (authenticated)
- [ ] Response includes **X-RateLimit-Limit** header
- [ ] Response includes **X-RateLimit-Remaining** header
- [ ] Response includes **X-RateLimit-Reset** header
- [ ] Limit value is constant (e.g., always 1000)
- [ ] Remaining decreases with each request
- [ ] Reset is valid Unix timestamp in future
- [ ] Made another request: Remaining decreased by 1
- [ ] Continued until Remaining = 0
- [ ] Next request returns **429**, Reset unchanged
- [ ] After Reset time passed: Remaining reset to Limit value
- [ ] **Test Status**: ☐ PASS ☐ FAIL ☐ NOT_RUN

**Notes**:

---

## Area 6: Observability Validation

### Test 6.1: Structured Logging Compliance

- [ ] Configured logging output to file
- [ ] Made API request: GET `/api/workspaces/{W1}/students`
- [ ] All log entries are valid JSON (parseable)
- [ ] Each log entry contains required fields:
  - [ ] timestamp (ISO 8601)
  - [ ] level (INFO, WARN, ERROR, DEBUG)
  - [ ] service (e.g., "api")
  - [ ] workspace_slug
  - [ ] workspace_id
  - [ ] user_id (if authenticated)
  - [ ] correlation_id (matches request)
  - [ ] message (human-readable)
- [ ] Made error request (404)
- [ ] Error log includes:
  - [ ] level: ERROR
  - [ ] error.code (e.g., NOT_FOUND)
  - [ ] error.message
  - [ ] status_code
- [ ] No console.log statements (structured only)
- [ ] No sensitive data logged (passwords, tokens)
- [ ] **Test Status**: ☐ PASS ☐ FAIL ☐ NOT_RUN

**Notes**:

---

### Test 6.2: Error Response Contract (RFC 7807)

- [ ] Triggered 400 Bad Request error
- [ ] Response includes: type, title, status, detail, instance
- [ ] Triggered 401 Unauthorized error
- [ ] Response follows RFC 7807 format
- [ ] Triggered 403 Forbidden error
- [ ] Response follows RFC 7807 format
- [ ] Triggered 404 Not Found error
- [ ] Response follows RFC 7807 format
- [ ] Triggered 409 Conflict error
- [ ] Response follows RFC 7807 format (limit exceeded)
- [ ] Triggered 426 Upgrade Required error
- [ ] Response follows RFC 7807 format (schema mismatch)
- [ ] Triggered 429 Too Many Requests error
- [ ] Response follows RFC 7807 format
- [ ] Triggered 500 Internal Server Error
- [ ] Response follows RFC 7807 format
- [ ] All error responses have consistent structure
- [ ] No unstructured error responses
- [ ] **Test Status**: ☐ PASS ☐ FAIL ☐ NOT_RUN

**Notes**:

---

## Area 7: Attempt Engine Validation

### Test 7.1: Snapshot Immutability

- [ ] Created exam E1 with: 5 questions, 100 points, 60% pass threshold, grade D
- [ ] Student S1 started attempt A1 on E1
- [ ] Snapshot created and stored (questions, config, grading rules)
- [ ] Modified exam E1: changed pass threshold to 70%, added 2 questions, changed grade to C
- [ ] Verified attempt A1 snapshot unchanged:
  - [ ] Still has 5 questions (not 7)
  - [ ] Still uses 60% threshold (not 70%)
  - [ ] Still uses D grade (not C)
- [ ] Student S1 completed attempt A1
- [ ] Grading used A1's snapshot (not current E1)
- [ ] Result reflects original exam config, not modified config
- [ ] **Test Status**: ☐ PASS ☐ FAIL ☐ NOT_RUN

**Notes**:

---

### Test 7.2: Worker-Only Grading Authority

- [ ] Scanned API codebase for grading functions
- [ ] No grading logic in `/apps/api/src/routes/**`
- [ ] Grading referenced only as "delegate to worker"
- [ ] Traced submission endpoint (POST attempt submission):
  - [ ] API validates submission format
  - [ ] API stores submission in database
  - [ ] API enqueues: grade_submission task to queue
  - [ ] API returns **202 Accepted** (not 200)
  - [ ] API does NOT calculate score
- [ ] Verified Worker process:
  - [ ] Receives task from queue
  - [ ] Loads attempt snapshot
  - [ ] Executes grading logic
  - [ ] Updates submissions.score
  - [ ] Updates attempts.status and attempts.final_score
- [ ] Made submission: score is NULL until worker processes
- [ ] API returned **202 Accepted**
- [ ] After worker completes: score populated
- [ ] **Test Status**: ☐ PASS ☐ FAIL ☐ NOT_RUN

**Notes**:

---

### Test 7.3: Server-Authoritative Time Only

- [ ] Created exam E2 with time limit: 60 minutes
- [ ] Student S2 started attempt A2:
  - [ ] Server time: 2026-02-26 10:00:00 UTC
  - [ ] Attempt recorded: started_at = 10:00:00 UTC
  - [ ] Deadline calculated: 10:00 + 60 = 11:00 UTC
- [ ] Client receives deadline time
- [ ] Manipulated client clock: 55 minutes ahead
- [ ] Client sent submission with client_timestamp (fake early time)
- [ ] API ignored client_timestamp, used server time
- [ ] Submission accepted (only 30 seconds elapsed on server)
- [ ] Verified in database: created_at = server time (not client time)
- [ ] At deadline: server time 11:00:05 UTC
- [ ] Client sent submission with fake timestamp (10:59:55)
- [ ] API rejected submission (past server deadline)
- [ ] Response: **409 Conflict or 403 Forbidden**
- [ ] **Test Status**: ☐ PASS ☐ FAIL ☐ NOT_RUN

**Notes**:

---

## Area 8: Performance Baseline

### Test 8.1: Middleware Overhead < 1ms

- [ ] Created test endpoint: GET `/api/test/echo` (no-op handler)
- [ ] Included all middlewares: Correlation ID, Tenant Resolver, License, Schema Version
- [ ] Measured endpoint latency with 1000 requests
- [ ] Calculated percentiles:
  - [ ] Mean latency: \_\_\_ ms
  - [ ] P50 (median): \_\_\_ ms
  - [ ] P95: \_\_\_ ms
  - [ ] P99: \_\_\_ ms
- [ ] Measured baseline echo (no middleware): \_\_\_ ms
- [ ] Calculated middleware overhead = Full latency - Baseline
- [ ] Middleware overhead **< 1ms** (P95)
- [ ] P99 latency **< 1.5ms**
- [ ] No outliers > 2ms (except rare GC)
- [ ] **Test Status**: ☐ PASS ☐ FAIL ☐ NOT_RUN

**Notes**:

---

### Test 8.2: License Check Query < 5ms

- [ ] Created 10,000 license records
- [ ] Query: SELECT \* FROM licenses WHERE id = $1 AND status = 'ACTIVE'
- [ ] Executed query 1000 times with different IDs
- [ ] Calculated percentiles:
  - [ ] P95 query time: \_\_\_ ms
  - [ ] P99 query time: \_\_\_ ms
- [ ] Query **P95 < 5ms**
- [ ] Query **P99 < 7ms**
- [ ] Query uses indexed lookup (license ID primary key)
- [ ] **Test Status**: ☐ PASS ☐ FAIL ☐ NOT_RUN

**Notes**:

---

### Test 8.3: Provisioning Lock Resolution < 50ms

- [ ] Measured lock acquisition time: \_\_\_ ms (P95)
- [ ] Measured lock release time: \_\_\_ ms (P95)
- [ ] Ran 100 lock cycles
- [ ] Lock acquisition **< 50ms** (P95)
- [ ] Lock release **< 50ms** (P95)
- [ ] No lock timeouts or deadlocks
- [ ] **Test Status**: ☐ PASS ☐ FAIL ☐ NOT_RUN

**Notes**:

---

## Critical Architecture Constraints

### Non-Negotiable Requirements

- [ ] **No cross-tenant data access**: Tests 1.1-1.4 all PASS
- [ ] **No row-based multi-tenancy**: Database-per-tenant verified
- [ ] **License middleware required**: Tests 3.1-3.3 validate enforcement
- [ ] **Server-authoritative time**: Test 7.3 validates no client time
- [ ] **Worker-only grading**: Test 7.2 validates grading never in API
- [ ] **Attempt snapshots immutable**: Test 7.1 validates snapshot integrity
- [ ] **All writes transactional**: Tests 2.2, 3.3 validate transactions
- [ ] **Idempotency for submissions**: Test 5.1c validates idempotent submissions
- [ ] **Migration immutability**: Tests 4.1-4.3 validate migration discipline
- [ ] **Structured logging**: Tests 6.1-6.2 validate observability

---

## Stage Completion Summary

### Overall Validation Status

| Area                | Test Count | Pass   | Fail   | Not Run | Status            |
| ------------------- | ---------- | ------ | ------ | ------- | ----------------- |
| 1: Tenant Isolation | 4          | \_     | \_     | \_      | ☐ PASS ☐ FAIL     |
| 2: Provisioning     | 3          | \_     | \_     | \_      | ☐ PASS ☐ FAIL     |
| 3: License Engine   | 3          | \_     | \_     | \_      | ☐ PASS ☐ FAIL     |
| 4: Migrations       | 3          | \_     | \_     | \_      | ☐ PASS ☐ FAIL     |
| 5: Rate Limiting    | 2          | \_     | \_     | \_      | ☐ PASS ☐ FAIL     |
| 6: Observability    | 2          | \_     | \_     | \_      | ☐ PASS ☐ FAIL     |
| 7: Attempt Engine   | 3          | \_     | \_     | \_      | ☐ PASS ☐ FAIL     |
| 8: Performance      | 3          | \_     | \_     | \_      | ☐ PASS ☐ FAIL     |
| **TOTAL**           | **23**     | **\_** | **\_** | **\_**  | **☐ PASS ☐ FAIL** |

---

### Validation Gate

**STAGE PASSES when:**

- All 23 tests: ☐ PASS
- Zero critical constraint violations: ☐ CONFIRMED
- All performance baselines met: ☐ CONFIRMED
- Architecture audit passed: ☐ CONFIRMED

**STAGE FAILS if ANY:**

- Any test fails
- Any constraint violated
- Performance baseline exceeded

---

### Sign-Off

**Validating Engineer**: \***\*\*\*\*\*\*\***\_\_\_\***\*\*\*\*\*\*\***

**Date**: \***\*\*\*\*\*\*\***\_\_\_\***\*\*\*\*\*\*\***

**Notes/Issues**:

---

## Next Steps After Completion

**If PASS**:

1. Run `/specify.closure` to document completion
2. Mark stage: PRODUCTION READY
3. Promote Phase 01 to VALIDATED
4. Archive test data

**If FAIL**:

1. Document failure details in this checklist
2. Create bug report for each failed item
3. Fix issues and re-run failed tests
4. Update checklist with new results
