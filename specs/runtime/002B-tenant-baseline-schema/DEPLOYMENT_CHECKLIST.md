# Deployment Checklist: Schema Provisioning MUST Items

**Date**: 2026-02-16
**Status**: CRITICAL - Required for production deployment
**Owner**: Principal Engineer
**Audience**: DevOps, SRE, Platform Team

---

## Pre-Deployment Phase (48 hours before)

### Code Review Gate

- [ ] **Code Review Complete**
  - All 6 MUST items reviewed by principal engineer
  - CRITICAL_REVIEW_RESOLUTION.md approved
  - No blocking security concerns

- [ ] **Type Safety Verified**
  - TypeScript compilation: `npm run build` passes with 0 errors
  - No `any` types in sensitive code paths (idempotency, triggers)
  - All database types imported correctly

- [ ] **SQL Syntax Validated**
  - All migrations pass syntax check
  - Triggers compile successfully
  - Constraints are valid PostgreSQL
  - Run: `psql -d test-db -f baseline-schema.sql --dry-run`

- [ ] **Git History Clean**
  - Feature branch rebased on main
  - No merge conflicts
  - Commit history is atomic (one commit per MUST item)

### Architecture Review

- [ ] **Tenant Isolation Confirmed**
  - No cross-tenant queries in idempotency code
  - All DB connections from tenant resolver
  - No workspace override from request body
  - Master DB tables are workspace-scoped

- [ ] **Import Boundaries Verified**
  - Worker imports only from `@zidney/domain-core`
  - API imports only from packages
  - No circular dependencies
  - No UI imports in backend code

- [ ] **Error Handling Standards Met**
  - All PostgreSQL errors structured in response
  - Error codes documented (23505, etc.)
  - No raw error messages exposed to frontend
  - Correlation IDs propagated in all logs

### Documentation Review

- [ ] **PRINCIPAL_ENGINEER_FEEDBACK.md Addressed**
  - All 6 MUST items implemented ✓
  - All 3 SHOULD items reviewed (defer/defer/medium priority)
  - All edge cases documented
  - Production validation gates created

- [ ] **ADR Alignment Confirmed**
  - ADR-0001 (database-per-tenant): Respected ✓
  - ADR-0002 (snapshot-attempt-model): Snapshot immutability implemented ✓
  - ADR-0006 (runtime-authoritative-time): Server time enforced in worker ✓
  - No ADR conflicts introduced

- [ ] **Migration Policy Followed**
  - One migration per MUST item
  - Forward-only migrations
  - No retroactive edits to old migrations
  - Migration sequence documented

---

## Pre-Production Phase (24 hours before)

### Staging Deployment Test

- [ ] **Deploy to Staging Environment**
  - Use same Docker image as production
  - Use same PostgreSQL version (14+)
  - Apply migrations in order
  - Monitor logs for errors

- [ ] **Run Integration Tests on Staging**
  - Execute: `npm test -- --testNamePattern="MUST Items"`
  - All 6 test suites pass
  - No flaky tests
  - Coverage: >95% for idempotency code

- [ ] **Verify Master DB Registry**
  - Execute: `./docs/operations/verify-registry-integrity.sh`
  - All 10 checks pass
  - No orphaned databases
  - No missing provisioning_tasks table

- [ ] **Test Snapshot Immutability**
  - Create attempt with snapshots
  - Attempt UPDATE on snapshot column → blocked
  - Attempt DELETE on attempt → blocked
  - Verify audit log recorded denials

### Load Testing on Staging

- [ ] **Execute Production Validation Gate 4**
  - 15 concurrent provisioning requests
  - p50 latency < 500ms
  - p99 latency < 2000ms
  - 0 timeouts
  - 0 deadlocks
  - All tasks completed successfully

- [ ] **Execute Idempotency Race Test (Gate 2)**
  - 3 concurrent identical requests
  - Verify exactly 1 provisioning task created
  - Other 2 return same task_id
  - Status progression: PENDING → IN_PROGRESS → COMPLETED
  - No duplicate schemas created

- [ ] **Execute Tampering Detection Test (Gate 3)**
  - Corrupt baseline-schema.sql checksum
  - Trigger provisioning task
  - Verify task escalated to DLQ
  - Alert fired: "Schema Tampering Detected"
  - Worker can retry after fix

- [ ] **Monitor Connection Pool**
  - Max connections during load: < 80% of limit
  - Connection leak velocity: 0/minute
  - Idle connections released properly
  - Pool recovery time after spike: < 10s

### Monitoring Verification

- [ ] **Prometheus Metrics Available**
  - `schema_provisioning_tasks_total` counter present
  - `schema_provisioning_duration_seconds` histogram present
  - `schema_provisioning_failures_total` counter present
  - All metrics queryable from Prometheus endpoint

- [ ] **Grafana Dashboard Deployed**
  - Schema Provisioning dashboard visible
  - 8 panels showing real-time metrics
  - All data sources connected
  - No missing time series warnings

- [ ] **Alert Rules Loaded**
  - $ Prometheus rules syntax valid
  - All 8 alert rules configured
  - Alert routing to on-call channel verified
  - Dry-run: Fire test alert → received correctly

### Database Backup Verification

- [ ] **Master DB Snapshot Taken**
  - Command: `pg_dump -d zidney_master -f backup-master-pre-deploy.sql.gz`
  - Verify restore works: `pg_restore -d zidney_master_test < backup-master-pre-deploy.sql.gz`
  - Checksum documented
  - Stored in backup vault with tagging "pre-deployment"

- [ ] **Connection Pool State Captured**
  - Redis keyspace snapshot taken
  - Documented current pool state
  - Can restore if needed: `redis-cli BGSAVE`

---

## Production Deployment Phase (2 hours)

### Pre-Deployment Verification

- [ ] **Production DB Health Check**
  - Database is reachable
  - No active long-running transactions
  - No locks held
  - Replication lag < 100ms (if applicable)

- [ ] **Production Configuration Verified**
  - Environment variables set correctly
  - Database connection string pointing to production DB
  - Master DB connection pool size: 25-50 connections
  - Tenant DB connection pool size: 10-20 per tenant
  - Lock timeout: 5 seconds
  - Statement timeout: 30 seconds

- [ ] **Monitoring System Ready**
  - Grafana authenticated and accessible
  - Prometheus scrape targets all GREEN
  - Alert notification channels active
  - SLA dashboard operational

### Deployment Steps (In Sequence)

**Step 1: Deploy API & Worker Code** (5-10 minutes)

```bash
# Build Docker images
docker build -t zidney-api:vX.Y.Z ./apps/api
docker build -t zidney-worker:vX.Y.Z ./apps/worker

# Push to registry
docker push zidney-api:vX.Y.Z
docker push zidney-worker:vX.Y.Z

# Update Kubernetes manifests (if k8s) or docker-compose
# kubectl set image deployment/api api=zidney-api:vX.Y.Z
# kubectl set image deployment/worker worker=zidney-worker:vX.Y.Z

# Verify deployment
kubectl rollout status deployment/api -n production
kubectl rollout status deployment/worker -n production

# ✓ Wait for all pods ready
```

- [ ] **Deployment Health Check**
  - API pod logs: 0 errors
  - Worker pod logs: 0 errors
  - Readiness probes passing
  - Liveness probes active

**Step 2: Apply Master DB Migrations** (2-5 minutes)

```bash
# Run migration: provisioning_tasks table + UNIQUE constraint
npm run migrate:master --env=production

# Verify table created
psql -U postgres -d zidney_master -c "
  SELECT table_name FROM information_schema.tables
  WHERE table_name = 'provisioning_tasks'
"

# ✓ Table must exist
```

- [ ] **Migration Verification**
  - provisioning_tasks table exists
  - UNIQUE(workspace_id, idempotency_key) constraint present
  - Indexes created successfully
  - No FK violations

**Step 3: Run Registry Integrity Check** (5-10 minutes)

```bash
# Execute registry verification script
./docs/operations/verify-registry-integrity.sh \
  --master-host ${PROD_DB_HOST} \
  --master-db zidney_master \
  --master-user postgres

# Expected: [PASS] All 10 integrity checks passed
```

- [ ] **Integrity Check Results**
  - Output shows: [PASS] All checks passed
  - No orphaned tenants
  - No missing databases
  - No configuration mismatches
  - Exit code: 0

**Step 4: Smoke Test** (5-15 minutes)

```bash
# Test 1: Provision a test tenant
curl -X POST https://api.production/api/workspaces \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -d '{"slug": "smoke-test-prod-2026", "name": "Smoke Test"}'

# ✓ Response status: 200
# ✓ Workspace ID created
# ✓ Database provisioning task started

# Test 2: Verify duplicate request idempotency
curl -X POST https://api.production/api/workspaces \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -H "Idempotency-Key: smoke-prod-2026" \
  -d '{"slug": "smoke-test-prod-2026-2", ...}'

curl -X POST https://api.production/api/workspaces \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -H "Idempotency-Key: smoke-prod-2026" \
  -d '{"slug": "smoke-test-prod-2026-2", ...}'

# ✓ Both requests return same workspace ID
# ✓ Only 1 provisioning task created (verified in DB)

# Test 3: Verify snapshot immutability
# (Requires framework-specific test, e.g., API endpoint guard)
curl -X PATCH https://api.production/api/attempts/${ATTEMPT_ID} \
  -H "Authorization: Bearer ${USER_TOKEN}" \
  -d '{"configuration_snapshot": {"v": "2"}}'

# ✓ Response status: 403 (Forbidden)
# ✓ Error: "Attempt snapshots are immutable"
```

- [ ] **Smoke Test Results**
  - All 3 tests passed
  - Workspace created successfully
  - Duplicate request detected and handled
  - Snapshot immutability enforced

**Step 5: Monitor for 30 Minutes** (30 minutes)

```bash
# Watch metrics dashboard
# Watch alert dashboard
# Monitor logs in real-time

# Key metrics to watch:
# - schema_provisioning_tasks_total (should increase with test traffic)
# - schema_provisioning_duration_seconds_count (should show completed tasks)
# - No schema_provisioning_failures_total spikes
```

- [ ] **30-Minute Monitoring Results**
  - No critical alerts fired
  - Error rate: < 0.1%
  - p99 latency: < 2000ms
  - Database connection pool normal
  - No lock contentions in logs
  - No OOM events
  - No network errors

### Post-Deployment Verification

- [ ] **Production DB State Confirmed**
  - Execute: `./docs/operations/verify-registry-integrity.sh` (production)
  - All 10 checks still pass
  - No data corruption detected
  - Schema version updated
  - Lake checkpoint updated

- [ ] **Production Monitoring Active**
  - Grafana dashboards showing live production data
  - Alert rules evaluating against production metrics
  - Historical metrics saved (can query last 24 hours)

- [ ] **Logs Aggregation Working**
  - Logs visible in centralized logging system
  - Correlation IDs traced successfully
  - No logs lost
  - Log volume within expected range

---

## Post-Deployment Phase (2-24 hours)

### Day 1 Validation

- [ ] **Monitor for Production Issues**
  - Alert queue empty for 24 hours
  - Error rate remains < 0.1%
  - p99 latency remains < 2000ms
  - No hotspots in database queries

- [ ] **Production Validation Gate Execution (Optional)**
  - Execute Gate 2 (duplicate race) in production if needed
  - Execute Gate 3 (tampering) in production if needed
  - Execute Gate 4 (load) during off-peak hours

- [ ] **Team Communication**
  - Release notes posted to Slack/Teams
  - Incident response team acknowledged deployment
  - Product team notified of new capabilities
  - Documentation updated on wiki

### Week 1 Validation

- [ ] **Performance Baseline Established**
  - Collect 1 week of metrics
  - Compare p50/p99 latency to baseline
  - Identify any slow queries
  - No degradation in overall system performance

- [ ] **Security Audit**
  - Verify no accidental data exposure
  - Check for privilege escalation attempts
  - Review audit logs for schema changes
  - Confirm RBAC still enforced

- [ ] **Disaster Recovery Test**
  - Restore from production backup taken before deployment
  - Verify full functional recovery
  - Test failover to replica (if applicable)
  - Document recovery time in SLA

---

## Rollback Plan (If Needed)

### Immediate Rollback (< 1 minute)

```bash
# Revert to previous API/Worker image
kubectl rollout undo deployment/api -n production
kubectl rollout undo deployment/worker -n production

# Verify revert
kubectl rollout status deployment/api -n production
kubectl rollout status deployment/worker -n production
```

- [ ] **Rollback Verification**
  - Previous version deployed
  - All pods healthy
  - Smoke tests pass
  - Metrics return to baseline

### Database Rollback (If Critical)

```bash
# Only if data was corrupted
# Restore from backup
pg_restore -d zidney_master < backup-master-pre-deploy.sql.gz

# Verify restoration
./docs/operations/verify-registry-integrity.sh
```

- [ ] **Data Integrity After Rollback**
  - All tables present
  - All constraints enforced
  - No missing workspaces
  - Provision task history preserved

### Post-Rollback Analysis

- [ ] **Root Cause Analysis**
  - Identify what caused the failure
  - Document in incident report
  - Update checklist if needed
  - Fix issue before retry

- [ ] **Retry Plan**
  - Schedule retry after 24-48 hours
  - Re-run all pre-deployment tests
  - Additional validation gates
  - Get principal engineer approval

---

## Sign-Off

**Deployment Lead**: **\*\*\*\***\_**\*\*\*\*** Date: **\_\_\_**

**Principal Engineer**: **\*\*\*\***\_**\*\*\*\*** Date: **\_\_\_**

**SRE/DevOps**: **\*\*\*\***\_**\*\*\*\*** Date: **\_\_\_**

**Release Manager**: **\*\*\*\***\_**\*\*\*\*** Date: **\_\_\_**

---

## Post-Deployment Incident Response

### If Alert "SchemaProvisioningDLQEscalation" Fires

1. Check alert details in Grafana
2. Review task in provisioning_tasks table (status: DLQ_ESCALATED)
3. Investigate failure reason
4. Fix root cause
5. Manual retry task or restart worker
6. Verify task completes

### If Alert "SchemaTamperingDetected" Fires

1. **CRITICAL**: Suspend all new provisioning
2. Verify baseline-schema.sql checksum
3. Check git history for unauthorized changes
4. Restore baseline-schema.sql from git
5. Re-verify checksum
6. Resume provisioning
7. Create security incident ticket

### If Alert "SchemaProvisioningHighFailureRate" Fires

1. Check worker logs for error patterns
2. Query provisioning_tasks table for failures
3. Check database connectivity
4. Check lock contention
5. Review recent deployments
6. Possible causes: DB unavailable, connection pool exhausted, long transaction
7. Take appropriate action

---

## Success Criteria

✅ **Deployment Successful If**:

- All 6 MUST items functioning correctly in production
- Idempotency enforced: duplicate requests return same task_id
- Snapshot immutability enforced: UPDATE/DELETE blocked by triggers
- Registry integrity validated: 10/10 checks pass
- Monitoring active: dashboards show real-time production data
- Alerts configured: 8/8 alert rules loaded
- Error rate: < 0.1% across all provisioning requests
- Latency: p99 < 2000ms for provisioning completion
- No data loss: backup restoration verified
- Zero security issues: no unauthorized access attempts

✅ **Rollback Necessary If**:

- Any MUST item not functioning
- Idempotency violated: duplicate requests create multiple tasks
- Data corruption: registry integrity check fails
- Unrecoverable error: more than 5% failure rate
- Security breach: unauthorized schema modifications detected
- Performance degradation: p99 latency > 5000ms

---

**Document Version**: 1.0
**Last Updated**: 2026-02-16
**Next Review**: 2026-02-23 (post-deployment validation)
