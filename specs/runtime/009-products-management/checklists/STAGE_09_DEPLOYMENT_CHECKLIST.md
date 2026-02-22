# STAGE_09_PRODUCTS Deployment Checklist

**Deployment Date:** ******\_\_\_\_******  
**Release Manager:** ******\_\_\_\_******  
**Status:** ☐ NOT STARTED | ☐ IN PROGRESS | ☐ COMPLETE

---

## PRE-DEPLOYMENT (Run 2 hours before deployment)

### Code Verification

- [ ] All code committed to `main` branch
- [ ] Git status clean: `git status` returns clean
- [ ] Tag created: `git tag release/v1.9.1_STAGE09`
- [ ] All 46 tasks marked complete in spec

### Test Suite

- [ ] Unit tests passing: `npm run test` (66+ tests, 127+ assertions)
- [ ] TypeScript check passing: `npm run typecheck`
- [ ] ESLint passing: `npm run lint`
- [ ] Contract tests passing: `npm run test:contract`
- [ ] Migration tests passing: `npm run test:db`

### Security Checks

- [ ] No secrets committed: `npm run security:secrets`
- [ ] Dependency audit passing: `npm audit --audit-level=high`
- [ ] No console.log in production code: grep check passed
- [ ] No hardcoded API keys/tokens found

### Documentation Review

- [ ] Migrations documented with comments
- [ ] Rollback procedures documented
- [ ] Error handling spec reviewed
- [ ] Rate limiting configured (10-100/min per endpoint)

---

## DEPLOYMENT (Actual deployment window)

### 1. Database Snapshot (5 min)

**On Production VPS:**

```bash
# Create pre-deployment snapshot
pg_dump -U postgres -d zidney_master -Fc > \
  /backups/zidney_master_2026_02_22_pre_stage09.dump

# Verify snapshot created
ls -lh /backups/zidney_master_2026_02_22_pre_stage09.dump
# Expected: ~500MB+ (depends on data volume)
```

- [ ] Snapshot created
- [ ] Snapshot verified (file exists and > 100MB)
- [ ] Snapshot backed up to external storage

### 2. Database Migration (10 min)

**On Production VPS:**

```bash
# Connect to master database
psql -U postgres -d zidney_master

-- Run migration 1
\i /app/migrations/20260221_004_create_products.sql

-- Run migration 2
\i /app/migrations/20260222_005_complete_products_schema.sql

-- Verify tables created
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name LIKE 'product%';
-- Expected: products, product_versions, product_audit_logs

-- Verify schema integrity
SELECT COUNT(*) FROM products; -- Should be 0
SELECT COUNT(*) FROM product_versions; -- Should be 0
SELECT COUNT(*) FROM product_audit_logs; -- Should be 0

-- Verify constraints
SELECT constraint_name FROM information_schema.table_constraints
WHERE table_name = 'products' AND constraint_type = 'UNIQUE';
-- Expected: uk_products_slug
```

- [ ] Migration 1 applied successfully
- [ ] Migration 2 applied successfully
- [ ] products table exists and empty
- [ ] product_versions table exists and empty
- [ ] product_audit_logs table exists and empty
- [ ] All indexes created
- [ ] All triggers in place
- [ ] Schema version incremented

**If migration fails:**

- [ ] Stop deployment
- [ ] Restore snapshot: `pg_restore -U postgres -d zidney_master /backups/zidney_master_2026_02_22_pre_stage09.dump`
- [ ] Investigate error
- [ ] Escalate to database team

### 3. Build Docker Image (5 min)

**On Build Server:**

```bash
# Build Docker image
docker build -f apps/api/Dockerfile \
  -t zidney-api:1.9.1_STAGE09 \
  -t zidney-api:latest \
  .

# Verify image
docker inspect zidney-api:1.9.1_STAGE09
# Expected: Image exists, size ~150MB

# Test image locally (optional but recommended)
docker run --rm zidney-api:1.9.1_STAGE09 --version
```

- [ ] Docker image built successfully
- [ ] Image tagged with version `1.9.1_STAGE09`
- [ ] Image verified

### 4. Push to Registry (3 min)

**On Build Server:**

```bash
# Login to registry
docker login registry.example.com

# Push image
docker push registry.example.com/zidney-api:1.9.1_STAGE09
docker push registry.example.com/zidney-api:latest

# Verify image in registry
curl -H "Authorization: Bearer $REGISTRY_TOKEN" \
  https://registry.example.com/v2/zidney-api/tags/list
```

- [ ] Image pushed to registry
- [ ] Registry verified

### 5. Deploy to Staging (10 min)

**On K8s Cluster (Staging):**

```bash
# Update staging deployment
kubectl set image deployment/zidney-api-staging \
  api=registry.example.com/zidney-api:1.9.1_STAGE09 \
  -n staging

# Watch rollout
kubectl rollout status deployment/zidney-api-staging -n staging
# Expected: "deployment "zidney-api-staging" successfully rolled out"

# Verify pods running
kubectl get pods -n staging -l app=zidney-api
# Expected: All pods in Running state
```

- [ ] Staging deployment updated
- [ ] Rollout completed successfully
- [ ] All staging pods running

### 6. Staging Smoke Tests (10 min)

**Run Full Smoke Test Suite:**

```bash
# Test database connectivity
curl -s https://staging-api.zidney.com/health/db | jq .
# Expected: "status": "healthy"

# Test products routes
curl -X GET https://staging-api.zidney.com/api/v1/mmc/products \
  -H "Authorization: Bearer $STAGING_TOKEN" | jq .
# Expected: 200 OK, "success": true, empty items array

# Test product creation
curl -X POST https://staging-api.zidney.com/api/v1/mmc/products \
  -H "Authorization: Bearer $STAGING_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": {"en": "Test Product"},
    "slug": "test-product",
    "enabled_modules": ["MCQ"]
  }' | jq .
# Expected: 201 Created, product_id in response

# Test audit log endpoint
curl -X GET "https://staging-api.zidney.com/api/v1/mmc/products/$PRODUCT_ID/audit-log" \
  -H "Authorization: Bearer $STAGING_TOKEN" | jq .
# Expected: 200 OK, audit entries in response

# Check logs for errors
kubectl logs -f deployment/zidney-api-staging -n staging --tail=100 | grep ERROR
# Expected: No ERROR level logs
```

- [ ] Health check passes
- [ ] Products endpoints respond (all 6 tested)
- [ ] Sample product created successfully
- [ ] Audit log accessible
- [ ] No ERROR logs observed
- [ ] Correlation IDs in logs

**If staging tests fail:**

- [ ] Rollback staging: `kubectl set image deployment/zidney-api-staging api=registry.example.com/zidney-api:1.9.0 -n staging`
- [ ] Restore database snapshot
- [ ] Investigate error logs
- [ ] Fix and retry

### 7. Production Blue-Green Swap (5 min)

**On K8s Cluster (Production):**

```bash
# Update production "green" environment
kubectl set image deployment/zidney-api-green \
  api=registry.example.com/zidney-api:1.9.1_STAGE09 \
  -n production

# Watch rollout
kubectl rollout status deployment/zidney-api-green -n production --timeout=10m
# Expected: "deployment "zidney-api-green" successfully rolled out"

# Verify green pods running
kubectl get pods -n production -l app=zidney-api,version=green
# Expected: All green pods in Running state

# Switch traffic to green
kubectl patch service zidney-api-service -n production \
  -p '{"spec":{"selector":{"version":"green"}}}'
```

- [ ] Green environment deployed
- [ ] Green pods running and healthy
- [ ] Traffic switched to green
- [ ] Blue environment still running (for 30-min rollback window)

---

## POST-DEPLOYMENT (Monitor continuously for 24 hours)

### Immediate Checks (5-10 min)

```bash
# Production health check
curl -s https://api.zidney.com/health | jq .
# Expected: "status": "healthy"

# Production products endpoint
curl -X GET https://api.zidney.com/api/v1/mmc/products \
  -H "Authorization: Bearer $PROD_TOKEN" | jq .
# Expected: 200 OK

# Check error rate
curl -s https://api.zidney.com/metrics | grep "products_errors_total"
# Expected: Should be 0

# Check latency
curl -s https://api.zidney.com/metrics | grep "products_request_duration"
# Expected: 95th percentile < 200ms
```

- [ ] Production health check passes
- [ ] Products endpoints responding
- [ ] Error rate 0
- [ ] Latency nominal (< 200ms)

### 5-Minute Monitoring

**Check logs:**

```bash
kubectl logs -f deployment/zidney-api-green -n production --tail=50 | grep products
# Expected: Normal info-level logs, no errors
```

- [ ] Logs show normal operation
- [ ] No errors/warnings in products service
- [ ] Correlation IDs present and valid

### 15-Minute Review

**Dashboards & Metrics:**

- [ ] Grafana dashboard (Stage 09 Products) showing green
- [ ] Error rates at 0%
- [ ] Response times < 200ms p95
- [ ] Database query performance nominal
- [ ] No oom-killed pods
- [ ] No pod restarts

### 30-Minute Decision

**Review All Monitoring:**

If **ALL GREEN** (no issues):

- [ ] Finalize deployment
- [ ] Keep blue running for backup for 30+ minutes
- [ ] Document any observations
- [ ] Continue monitoring

If **ANY ISSUES DETECTED**:

- [ ] Trigger rollback immediately:
  ```bash
  kubectl patch service zidney-api-service -n production \
    -p '{"spec":{"selector":{"version":"blue"}}}'
  ```
- [ ] Investigate root cause
- [ ] Restore database if needed
- [ ] Escalate to engineering team

### 1-Hour Checkpoint

- [ ] No new errors in last 30 minutes
- [ ] Latency stable
- [ ] Pod restart count 0
- [ ] Database query performance good
- [ ] No customer complaints reported

### 4-Hour Checkpoint

- [ ] All metrics stable
- [ ] No anomalies detected
- [ ] All functionality working as expected
- [ ] Manual testing of all products endpoints successful

### 24-Hour Review (Next Business Day)

- [ ] 24-hour error rate < 0.01%
- [ ] 24-hour latency p95 < 200ms
- [ ] Database backup completed
- [ ] Final deployment log documented
- [ ] Next stage (STAGE_10_LICENSES) approved to proceed

---

## ROLLBACK PROCEDURES

### Option 1: Blue-Green Rollback (Instant, < 2 min)

**Use if:** Critical bug or error spike within 30 minutes

```bash
# Revert traffic to blue (previous version)
kubectl patch service zidney-api-service -n production \
  -p '{"spec":{"selector":{"version":"blue"}}}'

# Monitor green pods (keep for investigation)
kubectl get pods -n production -l app=zidney-api,version=green

# Clean up green (after investigation)
kubectl scale deployment zidney-api-green --replicas=0
```

**Expected Time:** < 2 minutes  
**Data Impact:** Minimal (no database changes reverted)

- [ ] Traffic switched back to blue
- [ ] Blue pods receiving traffic
- [ ] Error rate returns to normal
- [ ] Investigation started

### Option 2: Database + App Rollback (Full, 5-10 min)

**Use if:** Data corruption or schema issue

```bash
# Stop all API containers
kubectl scale deployment zidney-api-green --replicas=0
kubectl scale deployment zidney-api-blue --replicas=0

# Restore database snapshot
pg_restore -U postgres -d zidney_master \
  /backups/zidney_master_2026_02_22_pre_stage09.dump

# Redeploy previous version of API
kubectl set image deployment/zidney-api-blue \
  api=registry.example.com/zidney-api:1.9.0

# Restore traffic to blue
kubectl patch service zidney-api-service -n production \
  -p '{"spec":{"selector":{"version":"blue"}}}'
```

**Expected Time:** 5-10 minutes  
**Data Impact:** All products data created after deployment is lost (acceptable, beta feature)

- [ ] Database restored from snapshot
- [ ] API reverted to previous version
- [ ] Traffic restored
- [ ] Incident report filed

---

## SUCCESS CRITERIA

✅ **Deployment Successful If:**

1. All smoke tests pass ✓
2. Zero new errors in first hour ✓
3. Response times < 200ms p95 ✓
4. No customer-facing issues ✓
5. All middleware functioning (correlation IDs, license checks) ✓
6. Database constraints enforced ✓
7. Audit trail recording all operations ✓
8. Logging structured and complete ✓
9. No secrets exposed ✓
10. Blue-green rollback ready (for 30 min) ✓

---

## FAILURE CRITERIA

❌ **Rollback Immediately If:**

1. Error rate > 1% ✗
2. Response time p95 > 500ms ✗
3. Pod OOMKilled or CrashLoopBackOff ✗
4. Database migration fails ✗
5. License middleware broken ✗
6. Correlation ID not in logs ✗
7. Data corruption detected ✗
8. Security vulnerability identified ✗
9. Any 5xx error in products routes ✗
10. Audit trail not recording operations ✗

---

## COMMUNICATION LOG

**Deployment Notifications:**

- [ ] Notified stakeholders 1 hour before deployment
- [ ] Deployment started notification sent
- [ ] Deployment completed notification sent (success/rollback)
- [ ] Monitoring dashboard shared with team
- [ ] Post-deployment report prepared

**Escalation Contacts:**

- Platform Lead: ******\_\_\_\_******
- Security Team: ******\_\_\_\_******
- Database Team: ******\_\_\_\_******
- Operations Team: ******\_\_\_\_******

---

## SIGN-OFF

| Checkpoint             | Owner    | Time    | Status |
| ---------------------- | -------- | ------- | ------ |
| Pre-deployment Checks  | **\_\_** | **_:_** | ☐ PASS |
| Database Migration     | **\_\_** | **_:_** | ☐ PASS |
| Build & Registry       | **\_\_** | **_:_** | ☐ PASS |
| Staging Deployment     | **\_\_** | **_:_** | ☐ PASS |
| Staging Smoke Tests    | **\_\_** | **_:_** | ☐ PASS |
| Production Blue-Green  | **\_\_** | **_:_** | ☐ PASS |
| Production Smoke Tests | **\_\_** | **_:_** | ☐ PASS |
| 1-Hour Monitoring      | **\_\_** | **_:_** | ☐ PASS |
| 24-Hour Review         | **\_\_** | **_:_** | ☐ PASS |

**Deployment Status:** ☐ SUCCESSFUL | ☐ ROLLED BACK | ☐ IN PROGRESS

**Release Manager Signature:** **********\_\_**********  
**Date & Time Completed:** **_/_**/\_**\_ **:\_\_ UTC

---

**Document Version:** 1.0  
**Last Updated:** 2026-02-22  
**Deployment Reference:** STAGE_09_PRODUCTS v1.9.1
