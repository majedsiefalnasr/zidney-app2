# Testing Guide — Provisioning Trigger (STAGE_12)

**Stage:** STAGE_12_PROVISIONING_TRIGGER  
**Phase:** 02_PLATFORM_MMC  
**Date:** 2026-02-25  
**Audience:** QA Engineers, Developers, Integration Testers

---

## Quick Start

For new hires and QA teams: **This guide provides step-by-step instructions to validate the entire provisioning pipeline.**

**Typical Test Duration:** 30-45 minutes (all scenarios)  
**Environment:** Local development or staging

---

## Pre-Test Checklist

Before running any test scenario, verify:

- [ ] PostgreSQL running (`docker-compose up -d`)
- [ ] Redis running (`docker-compose up -d`)
- [ ] Workspace database initialized: `npm run db:migrate:master`
- [ ] Test fixtures loaded: `npm run seed:test`
- [ ] Worker service running: `npm run dev:worker`
- [ ] API service running: `npm run dev:api`
- [ ] Environment variables set: `.env.test` loaded

**Command to Verify Setup:**

```bash
npm run test:health-check
```

Expected output: All 4 health checks passing ✅

---

## Test Scenarios

### Scenario 1: License Creation (Happy Path)

**Objective:** Verify successful license creation returns 201 with provisioning job queued

**Test Type:** Integration Test (`test_create_license.integration.test.ts`)  
**Duration:** ~5 minutes

**Prerequisites:**

- MMC service token valid in `.env.test`
- Master DB connection working

**Steps:**

1. **Start Fresh**

   ```bash
   npm run test:clean
   npm run test:setup
   ```

2. **Create License**

   ```bash
   curl -X POST http://localhost:3000/licenses \
     -H "Authorization: Bearer $(cat .env.test | grep MMC_TOKEN)" \
     -H "Content-Type: application/json" \
     -d '{
       "workspace_slug": "test-org-1",
       "organization_name": "Test Organization",
       "product_id": "prod-001",
       "admin_email": "admin@test.org",
       "student_limit": 100,
       "staff_limit": 10
     }'
   ```

3. **Verify Response**
   - ✅ Status code: **201 Created**
   - ✅ Response format: `{ success: true, data: { id: "...", status: "PENDING_PROVISION", created_at: "..." }, error: null }`
   - ✅ License ID returned
   - ✅ Status is `PENDING_PROVISION`

4. **Check Provisioning Job Queued**

   ```bash
   npm run dev:inspect-queue
   # Should show 1 pending provisioning job
   ```

5. **Expected Result:** ✅ PASS

**Failure Diagnosis:**

- If 400: Check request JSON structure
- If 401: Verify MMC token in Authorization header
- If 409: Workspace slug already exists
- If 500: Check API logs for database error

---

### Scenario 2: License Status Polling

**Objective:** Verify status polling endpoint returns correct state during provisioning

**Test Type:** Integration Test (`test_get_license_status.integration.test.ts`)  
**Duration:** ~3 minutes per poll

**Prerequisites:**

- Scenario 1 (License Creation) completed successfully

**Steps:**

1. **Poll License Status (Immediate)**

   ```bash
   curl http://localhost:3000/licenses/{LICENSE_ID}/status \
     -H "Authorization: Bearer $(cat .env.test | grep MMC_TOKEN)"
   ```

2. **Verify Initial Status**
   - ✅ Status: `PENDING_PROVISION`
   - ✅ Response includes: `created_at`, `provisioned_at: null`, `failed_at: null`
   - ✅ Retry guidance provided: `"retry_after_ms": 5000`

3. **Wait 10 seconds, poll again**

   ```bash
   sleep 10
   curl http://localhost:3000/licenses/{LICENSE_ID}/status ...
   ```

4. **Verify Status Updated (Once Worker Processes)**
   - ✅ Status changes to `PROVISIONED` OR `PROVISION_FAILED`
   - ✅ `provisioned_at` timestamp set (if successful)
   - ✅ No `failed_at` timestamp (if successful)

5. **Expected Result:** ✅ PASS

**Failure Diagnosis:**

- If status never changes: Check worker logs (`npm run dev:inspect-worker-logs`)
- If `PROVISION_FAILED`: Check `last_provision_error` field for details
- If 404: License ID not found (verify from creation response)

---

### Scenario 3: Provisioning Pipeline Execution

**Objective:** Verify full 7-step provisioning completes without errors

**Test Type:** End-to-End (`test_provisioning_e2e.test.ts`)  
**Duration:** ~15 minutes (full pipeline)

**Prerequisites:**

- All services running
- Fresh test database

**Steps:**

1. **Trigger Provisioning**

   ```bash
   npm run test:e2e:provisioning
   ```

2. **Monitor Worker Logs**

   ```bash
   npm run dev:inspect-worker-logs --filter="provisioning"
   ```

3. **Verify Each Step Completes**
   - ✅ Step 1 (Validate & Lock): "Workspace lock acquired"
   - ✅ Step 2 (Database Setup): "Master database created"
   - ✅ Step 3 (Schema): "Tenant database created"
   - ✅ Step 4 (Indexes): "Indexes created successfully"
   - ✅ Step 5 (Migrations): "Baseline migrations applied"
   - ✅ Step 6 (Registry): "Registry entry inserted"
   - ✅ Step 7 (Admin Account): "Admin account created"

4. **Check Final Status**

   ```bash
   curl http://localhost:3000/licenses/{LICENSE_ID}/status ...
   ```

   - ✅ Status: `PROVISIONED`
   - ✅ `provisioned_at` is set
   - ✅ `failed_at` is null

5. **Verify Tenant Database Initialized**

   ```bash
   npm run db:inspect-tenant {WORKSPACE_SLUG}
   # Should show schema tables and indexes
   ```

6. **Expected Result:** ✅ PASS

**Failure Diagnosis:**

- If pipeline stops at Step 3: Disk space issue, check `/tmp` and database disk usage
- If Step 7 fails: Admin account creation error, check service logs
- If status never updates: Worker not consuming queue, check Redis connection

---

### Scenario 4: Idempotency (Duplicate Request)

**Objective:** Verify duplicate provisioning request returns same result (idempotent)

**Test Type:** Integration (`test_idempotency.integration.test.ts`)  
**Duration:** ~5 minutes

**Prerequisites:**

- Scenario 1 (License Creation) completed

**Steps:**

1. **Send Identical License Creation Twice**

   ```bash
   PAYLOAD='{ "workspace_slug": "idempotent-test", ... }'

   curl -X POST http://localhost:3000/licenses \
     -H "Idempotency-Key: idem-001" \
     -d "$PAYLOAD"

   # Save LICENSE_ID_1

   sleep 2

   curl -X POST http://localhost:3000/licenses \
     -H "Idempotency-Key: idem-001" \
     -d "$PAYLOAD"

   # Save LICENSE_ID_2
   ```

2. **Verify Responses Identical**
   - ✅ `LICENSE_ID_1 === LICENSE_ID_2`
   - ✅ Both have same timestamp
   - ✅ Only ONE provisioning job in queue (not two)

3. **Verify Single Job Processes**

   ```bash
   npm run test:inspect-queue
   # Should show exactly 1 job (not duplicated)
   ```

4. **Expected Result:** ✅ PASS (True idempotency)

**Failure Diagnosis:**

- If two jobs created: Idempotency service failed, check Redis storage
- If different IDs returned: Service not reading Idempotency-Key header

---

### Scenario 5: Error Handling — Invalid Product

**Objective:** Verify license creation rejects invalid product_id

**Test Type:** Unit / Integration (`test_errors.test.ts`)  
**Duration:** ~3 minutes

**Steps:**

1. **Create License with Invalid Product**

   ```bash
   curl -X POST http://localhost:3000/licenses \
     -H "Authorization: Bearer ..." \
     -d '{
       "workspace_slug": "test-invalid",
       "product_id": "nonexistent-product",
       ...
     }'
   ```

2. **Verify Error Response**
   - ✅ Status code: **400 Bad Request** OR **409 Conflict**
   - ✅ Response format: `{ success: false, data: null, error: { code: "INVALID_PRODUCT_ID", message: "..." } }`
   - ✅ No license created (verify with GET)

3. **Expected Result:** ✅ PASS

---

### Scenario 6: Rate Limiting

**Objective:** Verify rate limiting enforced on provisioning endpoints

**Test Type:** Load / Middleware (`test_rate_limit.test.ts`)  
**Duration:** ~5 minutes

**Steps:**

1. **Send 10 License Creation Requests**

   ```bash
   for i in {1..10}; do
     curl -X POST http://localhost:3000/licenses \
       -H "Authorization: Bearer ..." \
       -d "{ \"workspace_slug\": \"rate-test-$i\", ... }"
   done
   ```

2. **Check Request #6-10 Status (After Rate Limit)**
   - ✅ Status code: **429 Too Many Requests**
   - ✅ Response contains: `"Retry-After"` header with seconds to wait

3. **Wait for Window Reset**

   ```bash
   sleep 61  # Rate limit window reset
   ```

4. **Verify Next Request Succeeds**
   - ✅ Status code: **201 Created**

5. **Expected Result:** ✅ PASS

---

### Scenario 7: Workspace Lock (Concurrency)

**Objective:** Verify distributed lock prevents concurrent provisioning of same workspace

**Test Type:** Concurrency (`test_distributed_lock.test.ts`)  
**Duration:** ~10 minutes

**Steps:**

1. **Start Two Provisioning Requests Simultaneously**

   ```bash
   (curl -X POST http://localhost:3000/licenses ... &) && \
   (curl -X POST http://localhost:3000/licenses ... &)
   ```

2. **Monitor Worker Logs**
   - ✅ First request acquires lock: "Lock acquired for workspace-slug"
   - ✅ Second request blocked: "Waiting for workspace lock"
   - ✅ Second acquires after first completes

3. **Verify Both Succeed Eventually**
   - ✅ Both return 201 status
   - ✅ Different LICENSE_IDs assigned
   - ✅ Two separate workspaces created

4. **Expected Result:** ✅ PASS

---

### Scenario 8: Database Snapshot (Version Enforcement)

**Objective:** Verify provisioning job snapshots configuration at start time

**Test Type:** Integration (`test_schema_version.test.ts`)  
**Duration:** ~5 minutes

**Prerequisites:**

- Create a license to provision

**Steps:**

1. **Create License with Current Schema Version (e.g., v1.0.0)**

   ```bash
   curl -X POST http://localhost:3000/licenses ... # Creates with schema_version=1.0.0
   ```

2. **Update Master DB Schema Version** (Simulate schema upgrade)

   ```bash
   npm run db:update-schema-version 1.1.0
   ```

3. **Poll License Status**
   - ✅ Provisioning job uses original `schema_version: 1.0.0` (snapshotted)
   - ✅ Tenant database initialized with v1.0.0 migrations (not v1.1.0)

4. **Expected Result:** ✅ PASS (Configuration immutable)

---

### Scenario 9: Recovery from Failure (DLQ)

**Objective:** Verify failed provisions are logged to DLQ and can be inspected

**Test Type:** Resilience (`test_dlq_recovery.test.ts`)  
**Duration:** ~10 minutes

**Prerequisites:**

- Service configured to simulated failure mode (test mode)

**Steps:**

1. **Trigger Provisioning with Simulated Failure**

   ```bash
   export TEST_SIMULATE_FAILURE=true
   npm run test:e2e:provisioning-failure
   ```

2. **Monitor DLQ**

   ```bash
   npm run dev:inspect-dlq
   ```

3. **Verify Failed Job in DLQ**
   - ✅ Failed job logged with full error details
   - ✅ Correlation ID preserved
   - ✅ Retryable flag set correctly

4. **Attempt Manual Retry**

   ```bash
   npm run dev:retry-dlq-entry {JOB_ID}
   ```

5. **Verify Retry (with Failure Cleared)**
   - ✅ Job resubmitted to queue
   - ✅ Completes successfully this time
   - ✅ Removed from DLQ

6. **Expected Result:** ✅ PASS

---

### Scenario 10: Audit Log Recording

**Objective:** Verify all provisioning events logged for audit trail

**Test Type:** Compliance (`test_audit_log.test.ts`)  
**Duration:** ~5 minutes

**Prerequisites:**

- Complete Scenario 1 (License Creation)

**Steps:**

1. **Query Audit Log**

   ```bash
   npm run dev:inspect-audit-log --license_id={LICENSE_ID}
   ```

2. **Verify All Events Recorded**
   - ✅ `license.created` — License record created
   - ✅ `license.provisioning_started` — Job enqueued
   - ✅ `provisioning.step_1_started` — Lock acquired
   - ✅ `provisioning.step_2_completed` — Database created
   - ✅ ... (all 7 steps)
   - ✅ `license.provisioned` — Final status
   - ✅ `provisioning.completed` — Job finalized

3. **Verify Metadata**
   - ✅ Each entry has: `timestamp`, `actor_id`, `action`, `resource_id`, `details`
   - ✅ Correlation ID preserved across all events

4. **Expected Result:** ✅ PASS

---

## Regression Test Suite

**Quick Validation Before Merge**

Run all automated tests:

```bash
npm run test:provisioning:all
```

Expected output:

- ✅ **960+ tests passing**
- ✅ **0 linting errors**
- ✅ **0 TypeScript compilation errors**
- ✅ **All 4 validation gates passing**

**Duration:** ~10 minutes

---

## Manual Smoke Test Checklist

Quick 5-minute sanity check:

- [ ] `npm run dev:api` starts without errors
- [ ] `npm run dev:worker` starts without errors
- [ ] `curl http://localhost:3000/health` returns 200
- [ ] Database migrations run successfully
- [ ] One license creation request succeeds (201)
- [ ] Status polling returns `PENDING_PROVISION`
- [ ] Worker completes provisioning (status → `PROVISIONED`)
- [ ] Tenant database schema exists and has tables

**Expected Result:** All 8 checks pass ✅

---

## Troubleshooting

### License Creation Returns 400 Bad Request

**Likely Cause:** Invalid request JSON

**Fix:**

1. Verify all required fields present: `workspace_slug`, `organization_name`, `product_id`, `admin_email`, `student_limit`, `staff_limit`
2. Check JSON syntax (use `jq` to validate)
3. Verify header: `Content-Type: application/json`

### Status Polling Returns 404

**Likely Cause:** License ID not found

**Fix:**

1. Copy LICENSE_ID from license creation response exactly
2. Verify value in master database: `SELECT id FROM licenses WHERE id = '...';`

### Provisioning Never Completes (Stuck in PENDING_PROVISION)

**Likely Cause:** Worker not consuming queue

**Fix:**

1. Verify Redis running: `redis-cli ping` → `PONG`
2. Check worker logs: `npm run dev:inspect-worker-logs`
3. Restart worker: `npm run dev:worker`

### DLQ Accumulating Failed Jobs

**Likely Cause:** Infrastructure issue

**Steps to Diagnose:**

1. Inspect DLQ entry details: `npm run dev:inspect-dlq --entry_id={ID}`
2. Check error message and stack trace
3. Verify infrastructure (disk space, database connections, Redis memory)

---

## Performance Baselines

Expected performance for provisioning:

| Operation                        | Expected Duration | Threshold |
| -------------------------------- | ----------------- | --------- |
| License creation (API response)  | <200ms            | <500ms    |
| Provisioning pipeline (step 1-7) | 15-30s            | <60s      |
| Status polling response          | <100ms            | <200ms    |
| Rate limiting evaluation         | <50ms             | <100ms    |
| Lock acquisition                 | <10ms             | <50ms     |

**Measurement Command:**

```bash
npm run test:performance:provisioning
```

---

## Test Report Template

For QA sign-off, use this template:

```
# Provisioning Trigger — QA Sign-Off

**Date:** YYYY-MM-DD
**Tester:** [Name]
**Environment:** [Local/Staging]

## Scenarios Tested

| Scenario | Status | Notes |
| -------- | ------ | ----- |
| 1. License Creation (Happy Path) | ✅ | |
| 2. License Status Polling | ✅ | |
| 3. Provisioning Pipeline | ✅ | |
| 4. Idempotency | ✅ | |
| 5. Error Handling | ✅ | |
| 6. Rate Limiting | ✅ | |
| 7. Concurrency Lock | ✅ | |
| 8. Version Snapshotting | ✅ | |
| 9. DLQ Recovery | ✅ | |
| 10. Audit Logging | ✅ | |

## Regression Tests

- Unit Tests: 960/965 passing ✅
- Integration Tests: All passing ✅
- E2E Tests: All passing ✅

## Issues Found

None — approved for production ✅

**Signed:** [Name, Date]
```

---

## Support

**Questions?** Reference:

- `specs/runtime/012-provisioning-trigger/spec.md` — Feature specification
- `specs/runtime/012-provisioning-trigger/plan.md` — Technical design
- `docs/architecture/adr/adr-*.md` — Architectural decisions

---

**Last Updated:** 2026-02-25  
**Next Review:** Post-production monitoring (7 days)
