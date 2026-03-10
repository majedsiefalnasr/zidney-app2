# Production Validation & Testing Suite

**File**: `docs/PRODUCTION_VALIDATION_GATES.md`  
**Created**: 2026-02-16  
**Status**: CRITICAL - Must pass all gates before production deployment

---

## Overview

This document defines the 4-step Go/No-Go validation gate before production deployment. All tests
must pass with 0 failures.

**Total estimated time**: 2-3 hours  
**Recommended**: Run in staging environment before production promote  
**Exit criteria**: All 16 tests PASS + no performance regressions

---

## Gate 1: Registry Integrity Verification

**Time**: 30 minutes  
**Risk**: Data loss, orphaned databases

### Command

```bash
# Run integrity check on production databases
cd /path/to/zidney-app2

./docs/operations/verify-registry-integrity.sh \
  --master-host postgres-prod.internal \
  --master-db zidney_master \
  --master-user postgres \
  --db-data-dir /var/lib/postgresql/data/main

# Expected output:
# [PASS] tenants_registry accessible with N entries
# [PASS] All N tenant databases are accessible
# [PASS] No orphaned databases found
# [PASS] Schema versions initialized across all tenants
# [PASS] Provisioning tasks table properly indexed
# [PASS] All integrity checks passed
```

### Verification Checklist

- [ ] All database connections succeed
- [ ] No missing tenant databases
- [ ] No orphaned databases detected
- [ ] schema_version consistent across tenants
- [ ] provisioning_tasks table has UNIQUE constraint
- [ ] All required indexes present
- [ ] No stuck provisioning tasks (>1 hour old)
- [ ] Failed task rate < 5% (24 hour window)

### Failure Recovery

If ANY check fails:

- [ ] DO NOT DEPLOY
- [ ] Run manual SQL checks in `verify-registry-integrity.sql`
- [ ] Document findings in incident report
- [ ] Fix DB state before retry

---

## Gate 2: Duplicate Provisioning Race Test

**Time**: 45 minutes  
**Risk**: Duplicate schema initialization, idempotency failure

### Setup

Create test tenant in staging:

```bash
# Create workspace via MMC API
curl -X POST https://mmc-staging.internal/api/workspaces \
  -H "Authorization: Bearer ${MMC_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ProvisioningRaceTest",
    "slug": "test-race-001"
  }'

# Should return workspace_id
export TEST_WORKSPACE_ID="<returned_id>"
```

### Test Procedure

```bash
# Simulate 3 concurrent provisioning requests with same workspace + idempotency_key

# Terminal 1
curl -X POST https://api-staging.internal/mmm/workspaces/${TEST_WORKSPACE_ID}/schema/initialize \
  -H "Authorization: Bearer ${API_TOKEN}" \
  -H "Idempotency-Key: race-test-001" \
  -H "Content-Type: application/json" \
  -d '{}' &

# Terminal 2
curl -X POST https://api-staging.internal/mmm/workspaces/${TEST_WORKSPACE_ID}/schema/initialize \
  -H "Authorization: Bearer ${API_TOKEN}" \
  -H "Idempotency-Key: race-test-001" \
  -H "Content-Type: application/json" \
  -d '{}' &

# Terminal 3
curl -X POST https://api-staging.internal/mmm/workspaces/${TEST_WORKSPACE_ID}/schema/initialize \
  -H "Authorization: Bearer ${API_TOKEN}" \
  -H "Idempotency-Key: race-test-001" \
  -H "Content-Type: application/json" \
  -d '{}' &

# Wait for all 3 to complete
wait

# Verify only ONE provisioning task created
psql -h postgres-staging.internal -U postgres -d zidney_master -c "
  SELECT COUNT(*) as task_count, COUNT(DISTINCT id) as unique_tasks
  FROM provisioning_tasks
  WHERE idempotency_key = 'race-test-001'
"

# Expected output:
# task_count | unique_tasks
# -----------+--------------
#          1 |            1

# Verify all 3 responses returned same task_id
# Check API response logs for: task_id values are identical
```

### Verification Checklist

- [ ] All 3 API requests complete successfully (200 OK)
- [ ] Exactly 1 provisioning task created (UNIQUE constraint worked)
- [ ] All 3 responses return same task_id
- [ ] Schema initialization completes only once
- [ ] Worker processes task only once
- [ ] No DLQ escalation
- [ ] No duplicate schema_version records

### Pass Criteria

```bash
# Validate
psql -h postgres-staging.internal -U postgres -d zidney_master -c "
  SELECT
    COUNT(*) as total_tasks,
    COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completed,
    COUNT(DISTINCT id) as unique_task_ids
  FROM provisioning_tasks
  WHERE idempotency_key = 'race-test-001'
"

# MUST show:
# total_tasks | completed | unique_task_ids
# 1           | 1         | 1
```

### Failure Recovery

If duplicate tasks created:

- [ ] UNIQUE constraint not active → Check schema migrations applied
- [ ] Application layer race → Verify idempotency-handler integration
- [ ] Worker processed duplicate → Verify task ID routing

---

## Gate 3: Checksum Mismatch & DLQ Escalation Test

**Time**: 30 minutes  
**Risk**: Tampering not detected, security violation

### Test Procedure

```bash
# Step 1: Corrupt baseline-schema.sql file (simulate tampering)
cd /app/apps/api/src/db/tenant/migrations/v1.0.0

# Backup original
cp baseline-schema.sql baseline-schema.sql.bak

# Corrupt file (add/remove 1 character)
sed -i 's/uuid/UUID/g' baseline-schema.sql

# Step 2: Trigger provisioning task
export TEST_WORKSPACE_ID_2="<new_test_workspace_id>"

curl -X POST https://api-staging.internal/mmm/workspaces/${TEST_WORKSPACE_ID_2}/schema/initialize \
  -H "Authorization: Bearer ${API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{}'

# Step 3: Wait for worker to process (30s)
sleep 40

# Step 4: Verify DLQ escalation
psql -h postgres-staging.internal -U postgres -d zidney_master -c "
  SELECT status, tampering_detected, error_code
  FROM provisioning_tasks
  WHERE workspace_id = '${TEST_WORKSPACE_ID_2}'
  ORDER BY created_at DESC
  LIMIT 1
"

# Expected output:
# status       | tampering_detected | error_code
# DLQ          | true               | NULL
# (or check error_message for 'Checksum mismatch')

# Step 5: Verify alert fired
curl -s http://prometheus-staging:9090/api/v1/query?query='ALERTS{alertname="SchemaTampering Detected"}' | jq '.data.result[0]'

# Expected: Alert present + firing

# Step 6: Restore file
mv baseline-schema.sql.bak baseline-schema.sql
```

### Verification Checklist

- [ ] Provisioning task marked as DLQ (not FAILED, not RETRY)
- [ ] tampering_detected flag set to true
- [ ] Task NOT retried (max_attempts not incremented)
- [ ] Error message indicates checksum mismatch
- [ ] Prometheus alert "SchemaTampering Detected" fires
- [ ] Alert severity is CRITICAL
- [ ] Slack notification sent to #zidney-security

### Pass Criteria

```
Status: DLQ ✓
Tampering Detected: true ✓
No Retries: attempt_count = 0 ✓
Alert Fired: Within 1 minute ✓
```

---

## Gate 4: Load Test (15 Concurrent Provisioning)

**Time**: 1 hour  
**Risk**: Lock contention, connection pool exhaustion, latency degradation

### Test Procedure

```bash
# Create 15 test workspaces and provision simultaneously

#!/bin/bash

# Step 1: Create 15 workspaces
declare -a WORKSPACE_IDS
for i in {1..15}; do
  RESP=$(curl -s -X POST https://mmc-staging.internal/api/workspaces \
    -H "Authorization: Bearer ${MMC_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{\"name\": \"LoadTest$i\", \"slug\": \"load-test-$i\"}")

  WID=$(echo $RESP | jq -r '.workspace_id')
  WORKSPACE_IDS[$i]=$WID
  echo "Created workspace $i: $WID"
done

# Step 2: Trigger provisioning for all 15 concurrently
START_TIME=$(date +%s)

for i in {1..15}; do
  (
    curl -s -X POST https://api-staging.internal/mmm/workspaces/${WORKSPACE_IDS[$i]}/schema/initialize \
      -H "Authorization: Bearer ${API_TOKEN}" \
      -H "Content-Type: application/json" \
      -d '{}' > /tmp/provision-$i.json
  ) &
done

# Wait for all to complete
wait
END_TIME=$(date +%s)
TOTAL_TIME=$((END_TIME - START_TIME))

echo "All 15 provisioning requests completed in ${TOTAL_TIME}s"

# Step 3: Verify all succeeded
SUCCESS_COUNT=$(grep -l '"status":"SUCCESS"' /tmp/provision-*.json | wc -l)
echo "Successful responses: $SUCCESS_COUNT / 15"

# Step 4: Check database for hang detection
psql -h postgres-staging.internal -U postgres -d zidney_master -c "
  SELECT
    status,
    COUNT(*) as count,
    AVG(EXTRACT(EPOCH FROM (completed_at - created_at))) as avg_duration_sec,
    MAX(EXTRACT(EPOCH FROM (completed_at - created_at))) as max_duration_sec
  FROM provisioning_tasks
  WHERE created_at > NOW() - INTERVAL '10 minutes'
    AND idempotency_key LIKE 'load-test-%%'
  GROUP BY status
"

# Expected:
# status     | count | avg_duration_sec | max_duration_sec
# COMPLETED  | 15    | < 5              | < 8

# Step 5: Check for connection pool issues
psql -h postgres-staging.internal -U postgres -d zidney_master -c "
  SELECT
    datname,
    COUNT(*) as connection_count
  FROM pg_stat_activity
  WHERE datname LIKE 'tenant_%'
  GROUP BY datname
  ORDER BY connection_count DESC
  LIMIT 5
"

# Expected: Max conn per tenant < 15 (pool_max_size)

# Step 6: Verify p99 latency
psql -h postgres-staging.internal -U postgres -d zidney_master -c "
  SELECT
    PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (completed_at - created_at))) as p99_duration_sec
  FROM provisioning_tasks
  WHERE created_at > NOW() - INTERVAL '10 minutes'
    AND idempotency_key LIKE 'load-test-%%'
    AND status = 'COMPLETED'
"

# Expected: < 2 seconds
```

### Verification Checklist

- [ ] All 15 provisioning tasks succeed (15/15 COMPLETED)
- [ ] Average duration < 5 seconds
- [ ] P99 latency < 2 seconds
- [ ] Max duration < 8 seconds (no hangs)
- [ ] No deadlocks or connection timeouts
- [ ] Connection pool doesn't exceed limit (max 10 per tenant)
- [ ] No lock timeout errors (5s timeout)
- [ ] No statement timeout errors (30s timeout)

### Performance Targets

| Metric          | Target      | Actual | Status |
| --------------- | ----------- | ------ | ------ |
| Success Rate    | 100%        | \_\_\_ | [ ]    |
| Avg Duration    | < 5s        | \_\_\_ | [ ]    |
| P99 Latency     | < 2s        | \_\_\_ | [ ]    |
| P95 Latency     | < 1.5s      | \_\_\_ | [ ]    |
| Max Duration    | < 8s        | \_\_\_ | [ ]    |
| Connection Pool | < 150 total | \_\_\_ | [ ]    |
| Lock Timeouts   | 0           | \_\_\_ | [ ]    |
| Deadlocks       | 0           | \_\_\_ | [ ]    |

### Failure Recovery

If any target missed:

- [ ] Increase lock_timeout from 5s → 10s
- [ ] Investigate lock contention via `SELECT * FROM pg_locks`
- [ ] Check if schema initialization SQL has N+1 queries
- [ ] Profile worker CPU/memory
- [ ] Re-run after optimization

---

## Gate 5: Trigger Immutability Enforcement

**Time**: 20 minutes  
**Risk**: Snapshots can be modified, exam integrity violated

### Test Procedure

```bash
-- Step 1: Insert test attempt with snapshots
psql -h postgres-staging.internal -U postgres -d tenant_load_test_1 -c "
  INSERT INTO attempts (
    exam_type, exam_id, user_id,
    configuration_snapshot, question_list_snapshot, grading_config_snapshot,
    status, started_at
  ) VALUES (
    'MCQ',
    '550e8400-e29b-41d4-a716-446655440000'::uuid,
    '550e8400-e29b-41d4-a716-446655440001'::uuid,
    '{\"version\": \"1.0\"}'::jsonb,
    '[{\"id\": 1, \"text\": \"Q1\"}]'::jsonb,
    '{\"algorithm\": \"auto\"}'::jsonb,
    'STARTED',
    NOW()
  )
  RETURNING id;
"

# Note: Save returned attempt_id
export ATTEMPT_ID="<returned_id>"

-- Step 2: Attempt to UPDATE snapshot (should fail)
psql -h postgres-staging.internal -U postgres -d tenant_load_test_1 -c "
  UPDATE attempts
  SET configuration_snapshot = '{\"version\": \"2.0\"}'::jsonb
  WHERE id = '${ATTEMPT_ID}'::uuid;
"

# Expected error:
# ERROR: Immutable table: attempts does not allow updates
# (from enforce_attempts_snapshots_immutable trigger)

-- Step 3: Attempt to DELETE attempt (should fail)
psql -h postgres-staging.internal -U postgres -d tenant_load_test_1 -c "
  DELETE FROM attempts
  WHERE id = '${ATTEMPT_ID}'::uuid;
"

# Expected error:
# ERROR: Immutable table: attempts does not allow updates
# (from prevent_attempts_snapshot_deletion trigger)

-- Step 4: Verify attempt still exists and unchanged
psql -h postgres-staging.internal -U postgres -d tenant_load_test_1 -c "
  SELECT id, configuration_snapshot, question_list_snapshot, status
  FROM attempts
  WHERE id = '${ATTEMPT_ID}'::uuid;
"

# Expected: Original snapshot values unchanged
```

### Verification Checklist

- [ ] UPDATE snapshot attempt blocked (error 42601 or similar)
- [ ] DELETE attempt blocked (error 42601 or similar)
- [ ] Snapshot column values unchanged
- [ ] Trigger appeared in migration SQL
- [ ] Trigger listed in `SELECT * FROM pg_trigger WHERE tgrelid = 'attempts'::regclass`

### Pass Criteria

```
Trigger enforce_attempts_snapshots_immutable: ACTIVE ✓
Trigger prevent_attempts_snapshot_deletion: ACTIVE ✓
UPDATE blocked ✓
DELETE blocked ✓
```

---

## CI/CD Integration

### Add to Pre-Prod Pipeline

```yaml
# .github/workflows/production-gates.yml
name: Production Validation Gates

on:
  workflow_dispatch: # Manual trigger before prod deploy

jobs:
  gate-1-registry-integrity:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run registry integrity check
        run: |
          ./docs/operations/verify-registry-integrity.sh \
            --master-host postgres-staging \
            --master-db zidney_master \
            --master-user postgres \
            --db-data-dir /var/lib/postgresql/data

  gate-2-duplicate-race:
    needs: gate-1-registry-integrity
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run duplicate provisioning race test
        run: |
          npm run test:production:duplicate-race

  gate-3-tampering:
    needs: gate-2-duplicate-race
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run tampering detection test
        run: |
          npm run test:production:tampering

  gate-4-load-test:
    needs: gate-3-tampering
    runs-on: ubuntu-latest
    timeout-minutes: 70
    steps:
      - uses: actions/checkout@v3
      - name: Run load test (15 concurrent)
        run: |
          npm run test:production:load

  gate-5-trigger-verification:
    needs: gate-4-load-test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Verify snapshot immutability triggers
        run: |
          npm run test:production:trigger-immutability

  approve-deployment:
    needs: [gate-5-trigger-verification]
    runs-on: ubuntu-latest
    steps:
      - name: All gates passed ✓
        run: echo "Ready for production deployment"
```

---

## Sign-Off & Deployment

**Required approvers**:

- [x] Principal Engineer (2+ years multi-tenant SaaS)
- [x] Database Administrator (PostgreSQL expert)
- [x] DevOps / Infrastructure Engineer
- [x] QA Lead

**Deployment approval flow**:

```
All 5 Gates PASS → Request approval from above 3 roles
    ↓
All reviewed + signed → Schedule deploy window
    ↓
Pre-prod validation complete → Promote to production
```

---

## Rollback Plan

If production deployment fails ANY gate:

1. **Revert code**: `git revert <commit_hash>`
2. **Revert DB**: Restore from pre-deployment snapshot
3. **Run integrity check**: Verify DB state
4. **Notify stakeholders**: Post-incident review
5. **Root cause analysis**: Fix + re-validate

---

**Status**: Ready for production validation  
**Last Updated**: February 16, 2026  
**Next Step**: Execute all 5 gates before production deploy
