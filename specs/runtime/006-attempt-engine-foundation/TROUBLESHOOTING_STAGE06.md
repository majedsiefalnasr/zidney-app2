# STAGE 06 Troubleshooting Guide

**Version:** 1.0.0  
**Status:** Production Ready  
**Last Updated:** 2026-02-18

---

## Quick Reference

### Common Issues Matrix

| Symptom              | Error                | Code | Solution             |
| -------------------- | -------------------- | ---- | -------------------- |
| Can't create attempt | Invalid exam ID      | 400  | Verify UUID format   |
| Attempt locked       | Too many submissions | 409  | Retry with backoff   |
| License blocked      | Soft-locked          | 423  | Contact account team |
| Schema mismatch      | Upgrade needed       | 426  | Update to v1.1.0+    |
| Grading stuck        | DLQ growing          | N/A  | Scale workers        |
| Slow responses       | Latency high         | 503  | Check database       |

---

## API Errors

### HTTP 400 – Bad Request

**Error Codes:**

#### `INVALID_EXAM_ID`

```
Cause: exam_id is not a valid UUID
Response:
{
  "success": false,
  "error": {
    "code": "INVALID_EXAM_ID",
    "message": "exam_id must be a valid UUID (e.g., 550e8400-e29b-41d4-a716-446655440000)",
    "details": {
      "provided": "invalid-id",
      "format": "UUID"
    }
  }
}

Solution:
- Check exam_id format
- Ensure it's a valid UUID v4
- curl -X POST /api/v1/attempts \
    -d '{"exam_id":"550e8400-e29b-41d4-a716-446655440000",...}'
```

#### `INVALID_ATTEMPT_MODE`

```
Cause: attempt_mode is not RELAX, CHRONO, or RUSH
Response:
{
  "error": {
    "code": "INVALID_ATTEMPT_MODE",
    "message": "attempt_mode must be one of: RELAX, CHRONO, RUSH"
  }
}

Solution:
- Use only: RELAX, CHRONO, or RUSH
- Check for typos (case-sensitive)
```

#### `MISSING_REQUIRED_FIELD`

```
Cause: exam_id or attempt_mode missing from request body
Response:
{
  "error": {
    "code": "MISSING_REQUIRED_FIELD",
    "message": "Field 'exam_id' is required"
  }
}

Solution:
- Include all required fields in JSON body
- POST body format:
  {
    "exam_id": "...",
    "attempt_mode": "CHRONO"
  }
```

---

### HTTP 401 – Unauthorized

**Cause:** Missing or invalid JWT token

```
Response:
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Missing or invalid authentication token"
  }
}

Debugging Steps:
1. Verify Authorization header present
   curl -H "Authorization: Bearer $TOKEN" ...

2. Check token format
   - Should start with "Bearer "
   - Followed by JWT string

3. Validate JWT manually
   node -e "console.log(require('jwt-simple').decode('$TOKEN', 'secret'))"

4. Check token expiration
   jwt.io → paste token → check 'exp' claim

5. If token expired, request new one
   curl -X POST /auth/login -d '{"email":"...","password":"..."}'
```

---

### HTTP 403 – Forbidden

**Cause:** User lacks permission (insufficient role or wrong workspace)

```
Response:
{
  "error": {
    "code": "FORBIDDEN",
    "message": "User lacks permission to access this resource"
  }
}

Debugging:
1. Check user role
   SELECT role FROM users WHERE id = '...';
   # Must be 'student', 'teacher', or 'admin'

2. Check workspace assignment
   SELECT * FROM user_workspaces WHERE user_id = '...' AND workspace_id = '...';

3. Check if user is enrolled in exam
   SELECT * FROM exam_enrollments WHERE user_id = '...' AND exam_id = '...';

4. Verify with admin
   curl -X GET /admin/users/$USER_ID \
     -H "Authorization: Bearer $ADMIN_TOKEN"
```

---

### HTTP 404 – Not Found

**Cause:** Attempt or exam doesn't exist

```
Response:
{
  "error": {
    "code": "ATTEMPT_NOT_FOUND",
    "message": "Attempt 550e8400-e29b-41d4-a716-446655440000 not found"
  }
}

Debugging:
1. Verify attempt exists
   curl -X GET /api/v1/attempts/$ATTEMPT_ID \
     -H "Authorization: Bearer $TOKEN"

2. If 404, check database
   psql -U postgres -d zidney_tenant_acme \
     -c "SELECT * FROM attempts WHERE id = '...';"

3. If not found, was it deleted?
   - Attempts are only deleted if workspace deleted (cascading)
   - Otherwise, attempt should always exist

4. Check workspace
   curl -X GET /workspaces/$WORKSPACE_SLUG
```

---

### HTTP 409 – Conflict

#### `ATTEMPT_ALREADY_SUBMITTED`

```
Cause: Attempt is already submitted or finalized
Response:
{
  "error": {
    "code": "ATTEMPT_ALREADY_SUBMITTED",
    "message": "Attempt already submitted (status=FINALIZED)",
    "details": {
      "status": "FINALIZED",
      "score": 18.5
    }
  }
}

Solution:
- Check attempt status first
  curl -X GET /api/v1/attempts/550e8400-e29b-41d4-a716-446655440000

- If FINALIZED, submission already complete
- If SUBMITTED, poll /result for grading status
```

#### `ATTEMPT_LOCKED` (Concurrent Submission)

```
Cause: Another submission in progress (pessimistic lock timeout)
Response:
{
  "error": {
    "code": "ATTEMPT_LOCKED",
    "message": "Attempt is locked by another submission. Retry with exponential backoff.",
    "details": {
      "retry_after_ms": 100
    }
  }
}

Retry Strategy:
1st retry:   Wait 100ms  → POST /submit
2nd retry:   Wait 200ms  → POST /submit
3rd retry:   Wait 400ms  → POST /submit
4th retry:   Wait 5s     → POST /submit

If still 409 after 4 retries:
- Check worker health: Are jobs being processed?
- Scale workers: docker scale zidney-worker=5
- Check database: Connection pool full?
```

---

### HTTP 423 – Soft-Locked

**Cause:** Workspace license is soft-locked (allows read/create, blocks submit)

```
Response:
{
  "error": {
    "code": "SOFT_LOCKED",
    "message": "Workspace is soft-locked. Students can create attempts but cannot submit.",
    "details": {
      "workspace_slug": "tenant-acme",
      "reason": "Payment overdue"
    }
  }
}

This is NOT a system error – it's a business rule

Solution:
1. User can create attempts anytime
2. User CANNOT submit for grading
3. Contact account management to reactivate license
4. Once reactivated, submissions work immediately

For operators:
- Check license status
  psql -c "SELECT slug, status FROM licenses WHERE workspace_id = '...';"

- If needed, reactivate license
  psql -c "UPDATE licenses SET status = 'ACTIVE' WHERE workspace_id = '...';"

- Verify
  curl -X GET /workspaces/tenant-acme
```

---

### HTTP 426 – Upgrade Required

**Cause:** Schema or product version mismatch

```
Response:
{
  "error": {
    "code": "SCHEMA_MISMATCH",
    "message": "Attempt requires schema v1.1.0 but database is v1.0.0. Upgrade required.",
    "details": {
      "database_version": "1.0.0",
      "required_version": "1.1.0"
    }
  }
}

Solution:
1. This indicates a data mismatch (shouldn't happen)
2. Likely cause: Partial migration (wrong row inserted with v1.1.0 data into v1.0.0 schema)

Action:
1. Check schema version
   psql -c "SELECT schema_version FROM information_schema.tables LIMIT 1;"

2. If schema is v1.0.0, delete the mismatched attempt
   psql -c "DELETE FROM attempts WHERE id = '...';"

3. Redeploy with matching schema version

4. If legitimate upgrade needed:
   - Run migration: apps/api/src/db/tenant/migrations/v1.1.0/...
   - Redeploy worker and API
```

---

## Worker Errors

### Job Stuck in PROCESSING

**Symptoms:**

- Grading takes >30 seconds
- Attempt status still SUBMITTED after 5 minutes
- No error in logs

**Investigation:**

```bash
# Check job status
psql -U postgres -d zidney_tenant_acme \
  -c "SELECT id, status, started_at FROM grading_jobs
      WHERE status = 'PROCESSING' AND started_at < NOW() - INTERVAL '5 minutes';"

# If found, worker crashed without cleanup

# Check worker health
docker ps | grep zidney-worker
# If not running, that's the problem

# Check logs
docker logs zidney-worker | grep ERROR | tail -10
```

**Solution:**

```bash
# Restart worker
docker restart zidney-worker

# Worker will resume from same job (idempotent)
# If deterministic, will produce same result

# Monitor
docker logs -f zidney-worker | grep "grading_completed"
```

---

### Determinism Failure (Different Scores on Retry)

**Symptoms:**

- Same attempt graded twice to different scores
- Alerts fire: "Determinism check failed"

**This should never happen – it's a critical bug**

**Investigation:**

```bash
# Retrieve both grading results
psql -U postgres -d zidney_tenant_acme \
  -c "SELECT result_snapshot FROM attempts WHERE id = '...';"

# Check if scores differ
# If so, escalate immediately

# Verify snapshot immutability
psql -c "SELECT question_snapshot, grading_config_snapshot FROM attempts WHERE id = '...';"

# Are they identical to when first graded?
# If not, snapshot was modified (BUG)
```

**Root Causes:**

1. **Algorithm Bug** – ScoreEngine has non-deterministic code
   - Fix: Review ScoreEngine code, add determinism tests

2. **Snapshot Mutation** – Snapshot modified after storage
   - Fix: Add immutability constraint to schema

3. **Incorrect Rollback** – Old version has different algorithm
   - Fix: Always test backward compatibility

**Prevention:**

```typescript
// Determinism test (already in Phase F tests)
async function testDeterminism() {
  const attempt = createTestAttempt();
  const results = [];

  for (let i = 0; i < 100; i++) {
    const result = await scoreEngine.grade(...);
    results.push(result.total_score);
  }

  // All scores must be identical
  expect(new Set(results).size).toBe(1);
}
```

---

### DLQ Backlog Growing

**Symptoms:**

- DLQ table has >10 rows
- Grading jobs not completing

**Check Error Patterns:**

```bash
psql -U postgres -d zidney_tenant_acme \
  -c "SELECT error_message, COUNT(*) as count
      FROM grading_jobs
      WHERE status = 'DEAD_LETTER'
      GROUP BY error_message
      ORDER BY count DESC;"

# Example output:
# error_message | count
# Database connection timeout | 5
# JSON parse failed | 2
```

**Solutions by Error Type:**

**Error: "Database connection timeout"**

- Solution: Scale workers down to reduce connection demand
  ```bash
  docker scale zidney-worker=1
  ```

**Error: "JSON parse failed"**

- Solution: Check snapshot for corruption
  ```bash
  psql -c "SELECT id FROM attempts WHERE question_snapshot IS NULL;"
  # If results, data corruption detected
  ```

**Error: "Grading algorithm error"**

- Solution: Fix algorithm bug, redeploy

---

## Database Issues

### Query Performance (Slow Submissions)

**Symptom:** POST /submit takes >2 seconds

**Investigation:**

```bash
# Check query execution plan
psql -U postgres -d zidney_tenant_acme \
  -c "EXPLAIN ANALYZE SELECT * FROM attempts WHERE id = '...' FOR UPDATE NOWAIT;"

# Look for:
# - Table scans (should be index scans)
# - High cost estimates

# Check index usage
psql -c "SELECT * FROM pg_stat_user_indexes WHERE tablename = 'attempts';"

# Check missing indexes
psql -c "SELECT schemaname, tablename, indexname FROM pg_indexes WHERE tablename = 'attempts';"
```

**Solutions:**

1. **Add Missing Index**

   ```sql
   CREATE INDEX idx_attempts_workspace_id
   ON attempts(workspace_id);
   ```

2. **Update Table Statistics**

   ```bash
   psql -c "ANALYZE attempts;"
   ```

3. **Archive Old Attempts** (Phase 2)
   ```bash
   # Reduces table size, improves index performance
   ```

---

### Connection Pool Exhaustion

**Symptom:** "Timeout acquiring connection" errors

**Debugging:**

```bash
# Check current connections
psql -c "SELECT COUNT(*) FROM pg_stat_activity WHERE datname = 'zidney_tenant_acme';"

# Check max_connections setting
psql -c "SELECT setting FROM pg_settings WHERE name = 'max_connections';"

# Show connection details
psql -c "SELECT application_name, state, state_change, query
         FROM pg_stat_activity
         WHERE datname = 'zidney_tenant_acme'
         ORDER BY state_change DESC;"

# Look for idle connections
psql -c "SELECT COUNT(*) FROM pg_stat_activity WHERE state = 'idle in transaction';"
# These should be killed
```

**Solution:**

```bash
# Kill idle transactions
psql -c "SELECT pg_terminate_backend(pid)
         FROM pg_stat_activity
         WHERE state = 'idle in transaction';"

# Increase max_connections
# Edit postgresql.conf: max_connections = 200
# Or:
psql -c "ALTER SYSTEM SET max_connections = 200;"
# Requires server restart
pg_ctl restart

# Verify
psql -c "SELECT setting FROM pg_settings WHERE name = 'max_connections';"
```

---

## Isolation Violations

### Cross-Tenant Data Leak

**Symptom:** User sees another tenant's data (CRITICAL)

**Investigation:**

```bash
# Find queries without workspace_id
grep -r "SELECT.*FROM attempts" apps/api/src/ | grep -v "workspace_id"

# Any results = BUG (potential data leak)

# Check code history
git log --oneline --all -- apps/api/src/ | head -20
# Find when code was added without workspace_id check

# Check if data was accessed
psql -c "SELECT user_id, workspace_id FROM attempts WHERE workspace_id = 'WRONG_TENANT';"
# Any results = data leak occurred
```

**Response (CRITICAL INCIDENT):**

1. **IMMEDIATE:** Stop all API traffic

   ```bash
   docker stop zidney-api
   ```

2. **Investigation:** Determine scope of leak
   - Which users accessed wrong workspace?
   - Which data was exposed?
   - How long was code live?

3. **Remediation:**
   - Fix code bug
   - Audit logs to identify access
   - Notify affected users
   - Update incident response plan

4. **Redeploy:** Only after code review confirms fix

---

## Verification Commands

### Health Status

```bash
# API health
curl http://localhost:3000/health

# Worker health
curl http://localhost:3001/health

# Database
psql -U postgres -c "SELECT version();"

# Redis
redis-cli PING
```

### Attempt Verification

```bash
# Create test attempt
ATTEMPT_ID=$(curl -X POST /api/v1/attempts \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"exam_id":"...","attempt_mode":"CHRONO"}' \
  | jq -r '.data.id')

# Check database
psql -d zidney_tenant_acme \
  -c "SELECT id, status, score FROM attempts WHERE id = '$ATTEMPT_ID';"

# Submit and poll
curl -X POST /api/v1/attempts/$ATTEMPT_ID/submit \
  -H "Authorization: Bearer $TOKEN"

sleep 5

# Poll result
curl -X GET /api/v1/attempts/$ATTEMPT_ID/result \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```

### Log Verification

```bash
# Check structured logs
docker logs zidney-api | grep "correlation_id" | head -5

# Check for errors
docker logs zidney-api | grep ERROR

# Check worker processing
docker logs zidney-worker | grep "grading_completed" | tail -10
```

---

## Escalation Decision Tree

```
ERROR occurred?
│
├─→ API Error (4xx)
│   ├─→ 400: Check input format (docs)
│   ├─→ 401: Check JWT token
│   ├─→ 403: Check permissions
│   ├─→ 404: Check resource exists
│   ├─→ 409: Retry with backoff
│   ├─→ 423: Contact account team
│   └─→ 426: Run migration
│
├─→ Worker Error
│   ├─→ Job stuck: Restart worker
│   ├─→ DLQ growing: Scale workers or check logs
│   └─→ Determinism failure: ESCALATE (critical)
│
├─→ Database Error
│   ├─→ Connection timeout: Kill idle connections
│   ├─→ Slow queries: Add indexes or archive data
│   └─→ Data leak: ESCALATE (critical)
│
└─→ Unknown
    └─→ Check /health, logs, then escalate
```

---

**Last Updated:** 2026-02-18  
**Maintainer:** Zidney Support Team
