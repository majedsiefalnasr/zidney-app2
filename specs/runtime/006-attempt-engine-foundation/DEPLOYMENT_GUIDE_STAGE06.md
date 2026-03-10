# STAGE 06 Deployment Guide

**Version:** 1.0.0  
**Status:** Production Ready  
**Last Updated:** 2026-02-18

---

## Prerequisites

### Infrastructure

- **PostgreSQL:** 12+ (with timezone support, SSL optional but recommended)
- **Redis:** 6+ (for job queue and idempotency cache)
- **Node.js:** 18+ (with Bun 1.x runtime)
- **Docker:** 20+ (and Docker Compose for local deployment)
- **Kubernetes:** 1.24+ (optional, for production orchestration)

### Access & Credentials

- Database credentials (superuser for migrations, service user for runtime)
- Redis connection string
- Workspace slug (for tenant database naming)
- JWT private/public keys (pre-generated)

### Backup & Rollback Plan

- Full database backup created (pre-deployment)
- Previous API image tagged (for rollback)
- Previous worker image tagged (for rollback)

---

## Pre-Deployment Checklist

- [ ] PostgreSQL instance accessible (test connection)
- [ ] Redis instance accessible (test connection)
- [ ] Database backup created: `pg_dump zidney > backup_$(date +%Y%m%d_%H%M%S).sql`
- [ ] Previous API image tag noted (e.g., `v0.9.9`)
- [ ] Previous worker image tag noted (e.g., `v0.9.9`)
- [ ] License middleware verified (simulate soft-lock test case)
- [ ] Version matrix validated (test with schema v1.0.0)
- [ ] Worker monitoring setup active (check Prometheus/Grafana endpoints)
- [ ] Logging aggregation ready (ELK stack or equivalent receiving logs)
- [ ] Alerting configured (PagerDuty, Slack, or on-call system)
- [ ] On-call engineer notified of deployment window

---

## Database Migration

### Step 1: Backup

```bash
# Create backup before migration (safety net)
BACKUP_FILE="backup_$(date +%Y%m%d_%H%M%S).sql"
pg_dump \
  -U postgres \
  -d zidney_master \
  --format=plain \
  > "/backups/$BACKUP_FILE"

echo "Backup created: /backups/$BACKUP_FILE"

# Verify backup
gunzip -t "/backups/$BACKUP_FILE.gz" && echo "Backup verified"
```

### Step 2: Apply Attempt Engine Schema (v1.0.0)

**For each tenant database:**

```bash
# Environment
TENANT_SLUG="tenant-acme"
TENANT_DB="zidney_${TENANT_SLUG}"
MIGRATION_FILE="apps/api/src/db/tenant/migrations/v1.0.0/001_create_attempt_engine_tables.sql"

# Connect and apply migration
psql -U postgres -d "$TENANT_DB" < "$MIGRATION_FILE"

echo "Migration applied to $TENANT_DB"
```

**Or via Docker:**

```bash
docker exec zidney-postgres psql \
  -U postgres \
  -d zidney_tenant_acme \
  -f /migrations/v1.0.0/001_create_attempt_engine_tables.sql
```

### Step 3: Verify Schema

```bash
# Check tables exist
psql -U postgres -d zidney_tenant_acme \
  -c "SELECT table_name FROM information_schema.tables
      WHERE table_name LIKE 'attempt%' ORDER BY table_name;"

# Expected output:
# ┌────────────────────────────┐
# │      table_name            │
# ├────────────────────────────┤
# │ attempt_progress           │
# │ attempts                   │
# │ grading_jobs               │
# │ submission_idempotency_keys│
# └────────────────────────────┘

# Verify indexes
psql -U postgres -d zidney_tenant_acme \
  -c "SELECT indexname FROM pg_indexes
      WHERE tablename LIKE 'attempt%' ORDER BY indexname;"

# Should show 8+ indexes
```

### Step 4: Update Schema Version (Master DB)

```bash
# Record schema version for license enforcement
psql -U postgres -d zidney_master \
  -c "UPDATE workspaces
      SET schema_version = '1.0.0',
          updated_at = NOW()
      WHERE slug = 'tenant-acme';"

# Verify
psql -U postgres -d zidney_master \
  -c "SELECT slug, schema_version, updated_at
      FROM workspaces WHERE slug = 'tenant-acme';"
```

---

## API Deployment

### Step 1: Build Docker Image

```bash
# Build API image
docker build -t zidney-api:1.0.0 \
  --build-arg NODE_ENV=production \
  apps/api/

echo "Image built: zidney-api:1.0.0"

# Verify image
docker inspect zidney-api:1.0.0 | head -20
```

### Step 2: Configure Environment

**Create `.env.production`:**

```bash
# Database
DATABASE_URL=postgresql://zidney_user:$PASSWORD@postgres.example.com:5432/zidney_tenant_acme
DATABASE_POOL_SIZE=20
DATABASE_STATEMENT_CACHE_SIZE=100

# Redis
REDIS_URL=redis://redis.example.com:6379/0
REDIS_QUEUE_NAME=grading_jobs
REDIS_CACHE_TTL=1800

# JWT
JWT_PRIVATE_KEY=$(cat /secrets/jwt_private.pem)
JWT_PUBLIC_KEY=$(cat /secrets/jwt_public.pem)

# Logging
LOG_LEVEL=info
LOG_FORMAT=json
CORRELATION_ID_TRACKING=true

# Server
NODE_ENV=production
PORT=3000
```

### Step 3: Start API Server

**Docker:**

```bash
docker run -d \
  --name zidney-api \
  --restart unless-stopped \
  -p 3000:3000 \
  -e DATABASE_URL="postgresql://..." \
  -e REDIS_URL="redis://..." \
  -e LOG_LEVEL="info" \
  -v /secrets:/secrets:ro \
  zidney-api:1.0.0

# Check logs
docker logs -f zidney-api
```

**Kubernetes:**

```bash
kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: zidney-api
spec:
  replicas: 2
  selector:
    matchLabels:
      app: zidney-api
  template:
    metadata:
      labels:
        app: zidney-api
    spec:
      containers:
      - name: api
        image: zidney-api:1.0.0
        ports:
        - containerPort: 3000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: api-secrets
              key: database-url
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: api-secrets
              key: redis-url
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 10
EOF

kubectl rollout status deployment/zidney-api
```

---

## Worker Deployment

### Step 1: Build Worker Image

```bash
docker build -t zidney-worker:1.0.0 \
  --build-arg NODE_ENV=production \
  apps/worker/

echo "Image built: zidney-worker:1.0.0"
```

### Step 2: Start Worker

**Docker (Single Instance):**

```bash
docker run -d \
  --name zidney-worker \
  --restart unless-stopped \
  -e DATABASE_URL="postgresql://..." \
  -e REDIS_URL="redis://..." \
  -e LOG_LEVEL="info" \
  -e MAX_CONCURRENT_JOBS=1 \
  -v /secrets:/secrets:ro \
  zidney-worker:1.0.0

docker logs -f zidney-worker
```

**Docker Compose (Scaled):**

```yaml
version: "3.9"

services:
  worker-1:
    image: zidney-worker:1.0.0
    environment:
      DATABASE_URL: postgresql://...
      REDIS_URL: redis://...
      WORKER_ID: worker-1
    restart: unless-stopped

  worker-2:
    image: zidney-worker:1.0.0
    environment:
      DATABASE_URL: postgresql://...
      REDIS_URL: redis://...
      WORKER_ID: worker-2
    restart: unless-stopped
```

**Kubernetes (Scalable):**

```bash
kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: zidney-worker
spec:
  replicas: 3
  selector:
    matchLabels:
      app: zidney-worker
  template:
    metadata:
      labels:
        app: zidney-worker
    spec:
      containers:
      - name: worker
        image: zidney-worker:1.0.0
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: worker-secrets
              key: database-url
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: worker-secrets
              key: redis-url
        - name: MAX_CONCURRENT_JOBS
          value: "1"
        resources:
          requests:
            cpu: "1"
            memory: "1Gi"
          limits:
            cpu: "2"
            memory: "2Gi"
EOF

kubectl rollout status deployment/zidney-worker
```

---

## Post-Deployment Validation

### 1. Server Health Check

```bash
# Health endpoint check
curl -v http://localhost:3000/health

# Expected 200 OK
# {
#   "status": "healthy",
#   "uptime": 123456,
#   "version": "1.0.0",
#   "timestamp": "2026-02-18T14:30:00Z"
# }
```

### 2. Database Connectivity

```bash
# All 4 tables should exist
psql -U postgres -c "\dt" zidney_tenant_acme | grep attempt

# Expected output includes:
# public | attempt_progress | table
# public | attempts | table
# public | grading_jobs | table
# public | submission_idempotency_keys | table
```

### 3. Create Test Attempt

```bash
# Get test token
TOKEN=$(curl -X POST http://localhost:3000/auth/login \
  -d '{"email":"test@example.com","password":"..."}' \
  -H "Content-Type: application/json" \
  | jq -r '.data.token')

# Create attempt
curl -X POST http://localhost:3000/api/v1/workspaces/tenant-acme/attempts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "exam_id": "550e8400-e29b-41d4-a716-446655440000",
    "attempt_mode": "CHRONO"
  }'

# Expected: 201 CREATED with attempt details
```

### 4. Submit and Poll Grading

```bash
# Extract attempt ID from previous response
ATTEMPT_ID="550e8400-e29b-41d4-a716-446655440001"

# Submit attempt
curl -X POST http://localhost:3000/api/v1/workspaces/tenant-acme/attempts/$ATTEMPT_ID/submit \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'

# Expected: 202 ACCEPTED

# Poll result (wait up to 30 seconds)
for i in {1..30}; do
  STATUS=$(curl -s http://localhost:3000/api/v1/workspaces/tenant-acme/attempts/$ATTEMPT_ID/result \
    -H "Authorization: Bearer $TOKEN" | jq -r '.status')

  if [ "$STATUS" = "FINALIZED" ]; then
    echo "Grading complete!"
    break
  fi
  sleep 1
done
```

### 5. Worker Processing Verification

```bash
# Check worker logs
docker logs zidney-worker | grep "attempt_graded\|job_completed"

# Expected output like:
# {"event":"attempt_graded","attempt_id":"...","score":18,"status":"COMPLETED"}

# Check grading_jobs table
psql -U postgres -d zidney_tenant_acme \
  -c "SELECT status, COUNT(*) FROM grading_jobs GROUP BY status;"

# Expected: Should have COMPLETED jobs (or PENDING if queue busy)
```

### 6. Load Test (Optional)

```bash
# Run load test suite (if available)
npm run test:load -w apps/api

# Expected:
# ✓ 100 concurrent attempts created
# ✓ 1000 submissions processed
# ✓ All grading complete within 100 seconds
# ✓ DLQ empty (0 failed jobs)
```

---

## Rollback Plan

### Code Rollback (Preferred)

**Container ↔ Image Swap:**

```bash
# If API problems detected
docker stop zidney-api
docker rm zidney-api
docker run -d \
  --name zidney-api \
  --restart unless-stopped \
  -p 3000:3000 \
  -e DATABASE_URL="..." \
  zidney-api:0.9.9  # Previous version

# Or in Kubernetes
kubectl set image deployment/zidney-api \
  api=zidney-api:0.9.9

# Verify
kubectl rollout status deployment/zidney-api
```

### Schema Rollback (NOT SUPPORTED)

**Attempt Engine schema is forward-only.** You cannot roll back schema changes.

**Options if schema failure detected:**

1. **Snapshot Restore** (Full restore, all data loss since migration)

   ```bash
   # Restore from pre-migration backup
   gunzip -c /backups/backup_$(date +%Y%m%d_%H%M%S).sql.gz \
     | psql zidney_tenant_acme
   ```

2. **Code Fix + Redeploy**
   - Fix bug in grading logic
   - Redeploy new API version
   - Worker retries failed jobs
   - No schema change needed

---

## Monitoring Setup

### 1. Prometheus Metrics

```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: "zidney-api"
    static_configs:
      - targets: ["localhost:3000"]
    metrics_path: "/metrics"

  - job_name: "zidney-worker"
    static_configs:
      - targets: ["localhost:3001"]
    metrics_path: "/metrics"
```

### 2. Key Alerts

```yaml
# alerts.yml
groups:
  - name: zidney_stage06
    rules:
      - alert: DLQBacklogGrowing
        expr: grading_jobs_dlq_size > 10
        for: 5m
        annotations:
          severity: critical

      - alert: WorkerThroughputLow
        expr: rate(grading_jobs_completed_total[5m]) < 5
        for: 10m
        annotations:
          severity: warning

      - alert: LockTimeoutFrequent
        expr: rate(submission_lock_timeout_total[5m]) > 0.01
        for: 5m
        annotations:
          severity: warning
```

### 3. Logs Aggregation

**ELK Stack:**

```bash
# Filebeat (Agent)
filebeat -e -c filebeat.yml

# Elasticsearch (Indexing)
# Kibana (UI)

# Query examples
GET /zidney-*/doc/_search
{
  "query": {
    "match": {
      "event": "attempt_graded"
    }
  }
}
```

---

## Troubleshooting During Deployment

### Symptom: API Won't Start

**Check logs:**

```bash
docker logs zidney-api | tail -50
```

**Common causes:**

- Database connection string invalid
- Redis unavailable
- Port 3000 already in use

### Symptom: Schema Migration Fails

**Check migration file:**

```bash
psql -U postgres -d zidney_tenant_acme \
  -c "SELECT * FROM information_schema.tables WHERE table_name = 'attempts';"
```

**If table exists from previous run:**

```bash
# Drop and re-run (careful!)
psql -U postgres -d zidney_tenant_acme -c "DROP TABLE attempts CASCADE;"

# Re-apply migration
psql -U postgres -d zidney_tenant_acme < migration.sql
```

### Symptom: Worker Not Processing Jobs

**Check job queue:**

```bash
redis-cli LLEN grading_jobs  # Should show pending jobs

# Empty? No submissions yet
# >0? Worker stuck, check logs
docker logs zidney-worker | grep ERROR
```

---

## Success Criteria

All of the following must be true before marking deployment complete:

- ✅ API health check returns 200 OK
- ✅ All 4 tables created in tenant database
- ✅ Test attempt created successfully (201 response)
- ✅ Test attempt submitted successfully (202 response)
- ✅ Grading job completed within 30 seconds
- ✅ Result retrieved with score (200 response)
- ✅ Worker processing logs show success
- ✅ DLQ empty (0 failed jobs)
- ✅ Monitoring alerts firing on test trigger
- ✅ Logs aggregating correctly in ELK stack

---

## Post-Deployment Sign-Off

- [ ] All success criteria met
- [ ] On-call engineer verified stability
- [ ] Monitoring alerts configured
- [ ] Backup verified and stored
- [ ] Runbook updated with deployment date
- [ ] Team notified of live status

**Deployment Date:** 2026-02-18  
**Deployed By:** [Engineer Name]  
**Reviewed By:** [Architect Name]

---

**Next Steps:** Monitor metrics for 24 hours. If stable, phase 2 development can begin.
