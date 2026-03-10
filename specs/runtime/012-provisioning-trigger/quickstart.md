# Quickstart: Local Provisioning Development

**Purpose**: Set up local development environment for testing STAGE 12 – Provisioning Trigger
system  
**Time Required**: 15-20 minutes  
**Prerequisites**: Docker, Node.js 18+, PostgreSQL client tools

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│ Local Docker Compose Stack                                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐    ┌───────────┐    ┌──────────────────┐    │
│  │ PostgreSQL   │    │ Redis     │    │ Provisioning     │    │
│  │ (master_db + │    │ (queue +  │    │ Worker (local    │    │
│  │  tenant_dbs) │    │  lock)    │    │  node process)   │    │
│  └──────────────┘    └───────────┘    └──────────────────┘    │
│         ▲                   ▲                   │               │
│         └───────────────────┴───────────────────┘               │
│                                                                 │
│                   ┌────────────────────┐                        │
│                   │ Hono API           │                        │
│                   │ (localhost:3000)   │                        │
│                   └────────────────────┘                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Step 1: Clone & Install Dependencies

```bash
# Clone repository (if not already cloned)
git clone https://github.com/zidney/zidney-app2.git
cd zidney-app2

# Checkout provisioning branch
git checkout 012-provisioning-trigger

# Install dependencies
npm install

# Build packages
npm run build
```

---

## Step 2: Start Docker Compose Stack

```bash
# Start PostgreSQL + Redis
docker-compose up -d

# Verify services are running
docker-compose ps

# Output should show:
# - postgres (5432)
# - redis (6379)
```

**Check PostgreSQL is running**:

```bash
psql -h localhost -U postgres -d postgres -c "SELECT 1;"
# Output: ?column?
#    1
```

**Check Redis is running**:

```bash
redis-cli ping
# Output: PONG
```

---

## Step 3: Set Up Master Database

```bash
# Create master database
createdb -h localhost -U postgres master_db

# Run master migrations
npm run migrate:master

# Verify migrations applied
psql -h localhost -U postgres -d master_db -c "
  SELECT * FROM information_schema.tables
  WHERE table_name IN ('licenses', 'tenants_registry');
"
# Should show: licenses, tenants_registry tables exist
```

**Connection String**:

```
postgresql://postgres:postgres@localhost:5432/master_db
```

---

## Step 4: Configure Environment Variables

Create `.env.local` in repository root:

```bash
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/master_db
REDIS_URL=redis://localhost:6379

# API
API_PORT=3000
API_HOST=localhost
NODE_ENV=development

# Worker
WORKER_ENABLED=true
WORKER_CONCURRENCY=2
WORKER_POLL_INTERVAL_MS=1000

# Provisioning
SCHEMA_VERSION=1.2.0
PRODUCT_VERSION=1.0.0
PROVISIONING_TIMEOUT_MS=60000

# Logging
LOG_LEVEL=debug
```

---

## Step 5: Insert Test Product

```bash
# Connect to master_db
psql -h localhost -U postgres -d master_db

# Insert test product
INSERT INTO products (id, name, version, active) VALUES (
  '550e8400-e29b-41d4-a716-446655440100'::uuid,
  'test-product',
  '1.0.0',
  true
);

# Verify
SELECT * FROM products;
```

---

## Step 6: Start API Server (Development Mode)

In terminal 1:

```bash
cd apps/api
npm run dev

# Output:
# ✓ Server started on http://localhost:3000
```

---

## Step 7: Start Provisioning Worker (Development Mode)

In terminal 2:

```bash
cd apps/worker
npm run dev

# Output:
# ✓ Worker consumer started, polling queue...
```

---

## Step 8: Test Provisioning Flow

### Test 1: Create License (Enqueue Job)

```bash
# Create license
curl -X POST http://localhost:3000/mmc/licenses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-token" \
  -H "X-Correlation-ID: test-corr-001" \
  -d '{
    "workspace_slug": "test-institution",
    "organization_name": "Test Institution",
    "admin_email": "admin@test.edu",
    "product_id": "550e8400-e29b-41d4-a716-446655440100",
    "student_limit": 1000,
    "staff_limit": 50,
    "uses_divisions": false,
    "default_language": "en"
  }'

# Response:
# {
#   "success": true,
#   "data": {
#     "license_id": "550e8400-e29b-41d4-a716-446655440001",
#     "workspace_slug": "test-institution",
#     "status": "PENDING_PROVISION",
#     "job_id": "550e8400-e29b-41d4-a716-446655440002",
#     "created_at": "2026-02-24T10:00:00.000Z"
#   },
#   "error": null
# }
```

**Save the `license_id` for next tests**.

### Test 2: Monitor Job Processing

Watch Worker terminal:

```
Worker logs should show:
→ provisioning_started (license_id: 550e8400-e29b-41d4-a716-446655440001)
→ license_validation (OK)
→ database_creation (workspace_test_institution)
→ migration_applied (001_init_schema.sql)
→ seed_roles (4 roles inserted)
→ seed_permissions (7 permissions inserted)
→ seed_settings (4 settings inserted)
→ admin_created (admin@test.edu)
→ registry_inserted
→ license_activated
→ provisioning_success (duration_ms: 8234)
```

### Test 3: Verify License Status

```bash
# Check license status is now ACTIVE
psql -h localhost -U postgres -d master_db -c "
  SELECT id, workspace_slug, status, provisioned_at
  FROM licenses
  WHERE id = '550e8400-e29b-41d4-a716-446655440001';
"

# Output should have status = 'ACTIVE' and provisioned_at timestamp filled
```

### Test 4: Verify Tenant Database Created

```bash
# List databases
psql -h localhost -U postgres -l | grep workspace_test

# Connect to tenant database
psql -h localhost -U postgres -d workspace_test_institution -c "
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public';
"

# Should show: roles, permissions, workspace_settings, users tables
```

### Test 5: Verify Tenant Registry Entry

```bash
# Check registry
psql -h localhost -U postgres -d master_db -c "
  SELECT license_id, workspace_slug, db_name, schema_version
  FROM tenants_registry
  WHERE workspace_slug = 'test-institution';
"

# Output:
#   license_id                           | workspace_slug  | db_name
# ─────────────────────────────────────┼─────────────────┼──────────────────
#  550e8400-e29b-41d4-a716-446655440001 | test-institution| workspace_test_institution
```

### Test 6: Verify Admin User Created

```bash
# Connect to tenant database and check admin user
psql -h localhost -U postgres -d workspace_test_institution -c "
  SELECT email, first_name, last_name, role_id, verified_at
  FROM users
  WHERE email = 'admin@test.edu';
"

# Output should show admin user with role_id linked to ADMIN role, verified_at = NULL
```

### Test 7: Test Idempotency (Duplicate Job)

```bash
# Verify can re-enqueue same license without issues
curl -X POST http://localhost:3000/mmc/licenses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-token" \
  -d '{
    "workspace_slug": "test-institution",
    "organization_name": "Test Institution",
    "admin_email": "admin@test.edu",
    "product_id": "550e8400-e29b-41d4-a716-446655440100",
    "student_limit": 1000,
    "staff_limit": 50,
    "uses_divisions": false,
    "default_language": "en"
  }'

# Should return 409 Conflict (workspace_slug already exists)
```

---

## Step 9: Test Failure Scenarios

### Scenario 1: Invalid Workspace Slug

```bash
curl -X POST http://localhost:3000/mmc/licenses \
  -H "Content-Type: application/json" \
  -d '{
    "workspace_slug": "INVALID-SLUG",
    "organization_name": "Test",
    "admin_email": "admin@test.edu",
    "product_id": "550e8400-e29b-41d4-a716-446655440100",
    "student_limit": 1000,
    "staff_limit": 50,
    "uses_divisions": false
  }'

# Should return 400 Bad Request (INVALID_WORKSPACE_SLUG)
```

### Scenario 2: Invalid Email

```bash
curl -X POST http://localhost:3000/mmc/licenses \
  -H "Content-Type: application/json" \
  -d '{
    "workspace_slug": "test-invalid-email",
    "organization_name": "Test",
    "admin_email": "not-an-email",
    "product_id": "550e8400-e29b-41d4-a716-446655440100",
    "student_limit": 1000,
    "staff_limit": 50,
    "uses_divisions": false
  }'

# Should return 400 Bad Request (INVALID_ADMIN_EMAIL)
```

### Scenario 3: Product Not Found

```bash
curl -X POST http://localhost:3000/mmc/licenses \
  -H "Content-Type: application/json" \
  -d '{
    "workspace_slug": "test-invalid-product",
    "organization_name": "Test",
    "admin_email": "admin@test.edu",
    "product_id": "00000000-0000-0000-0000-000000000000",
    "student_limit": 1000,
    "staff_limit": 50,
    "uses_divisions": false
  }'

# Should return 404 Not Found (PRODUCT_NOT_FOUND)
```

---

## Step 10: Test Failure Recovery

### Simulate Migration Failure

```bash
# Manually corrupt migration (for testing only)
# Edit apps/api/src/db/tenant/migrations/001_init_schema.sql
# Add invalid SQL (e.g., extra semicolon causing syntax error)

# Enqueue new job
curl -X POST http://localhost:3000/mmc/licenses \
  -H "Content-Type: application/json" \
  -d '{
    "workspace_slug": "test-migration-fail",
    "organization_name": "Test",
    "admin_email": "admin@test.edu",
    "product_id": "550e8400-e29b-41d4-a716-446655440100",
    "student_limit": 1000,
    "staff_limit": 50,
    "uses_divisions": false
  }'

# Watch Worker logs - should show MIGRATION_FAILED error

# Check license status in database:
psql -h localhost -U postgres -d master_db -c "
  SELECT status, last_provision_error, retry_count
  FROM licenses WHERE workspace_slug = 'test-migration-fail';
"

# Should show status = 'PROVISION_FAILED', error message filled, retry_count = 0

# Verify orphan database is NOT left behind
psql -h localhost -U postgres -l | grep workspace_test_migration

# Should NOT exist (Worker cleaned it up)

# Fix migration and redeploy
npm run build && npm run migrate:tenant

# Requeue job (manual retry API)
curl -X POST http://localhost:3000/admin/licenses/{license_id}/retry-provision \
  -H "Authorization: Bearer admin-token"

# Job should be re-enqueued and attempt provisioning again
```

---

## Debugging Tips

### Check Logs

**API logs**:

```bash
# In terminal 1 (API server)
# All structured logs with correlation_id
```

**Worker logs**:

```bash
# In terminal 2 (Worker)
# All provisioning events with license_id, workspace_slug
```

### Query Master Database

```bash
# Check all licenses
psql -h localhost -U postgres -d master_db -c "
  SELECT id, workspace_slug, status, created_at, provisioned_at, failed_at
  FROM licenses
  ORDER BY created_at DESC;
"

# Check pending licenses
psql -h localhost -U postgres -d master_db -c "
  SELECT * FROM licenses WHERE status = 'PENDING_PROVISION';
"

# Check failed licenses
psql -h localhost -U postgres -d master_db -c "
  SELECT id, workspace_slug, last_provision_error, retry_count
  FROM licenses WHERE status = 'PROVISION_FAILED';
"

# Check registry
psql -h localhost -U postgres -d master_db -c "
  SELECT * FROM tenants_registry ORDER BY created_at DESC;
"
```

### Query Redis Queue

```bash
# Check provisioning queue length
redis-cli LLEN provisioning:queue

# Peek at next job (without removing)
redis-cli LINDEX provisioning:queue 0

# Check DLQ
redis-cli LLEN provisioning:dlq
redis-cli LRANGE provisioning:dlq 0 -1
```

### List Tenant Databases

```bash
# List all workspace databases created
psql -h localhost -U postgres -l | grep workspace_
```

### Check Tenant Database Contents

```bash
# List all tables in specific tenant database
psql -h localhost -U postgres -d workspace_test_institution -c "
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public' ORDER BY table_name;
"

# Check roles
psql -h localhost -U postgres -d workspace_test_institution -c "SELECT * FROM roles;"

# Check permissions
psql -h localhost -U postgres -d workspace_test_institution -c "SELECT * FROM permissions;"

# Check settings
psql -h localhost -U postgres -d workspace_test_institution -c "
  SELECT setting_key, setting_value, value_type FROM workspace_settings;
"

# Check admin user
psql -h localhost -U postgres -d workspace_test_institution -c "
  SELECT u.email, u.first_name, r.name as role
  FROM users u
  JOIN roles r ON u.role_id = r.id;
"
```

---

## Common Issues & Solutions

### Issue: Ports Already in Use

```bash
# PostgreSQL already running on 5432?
lsof -i :5432  # Find process
kill <PID>     # Kill it

# Redis already running on 6379?
lsof -i :6379
kill <PID>
```

### Issue: PostgreSQL Connection Refused

```bash
# Check service is running
docker-compose ps

# If not running:
docker-compose down
docker-compose up -d

# Or if using local PostgreSQL, start it:
brew services start postgresql  # macOS
pg_ctl -D /usr/local/var/postgres start
```

### Issue: Workers Not Processing Jobs

```bash
# 1. Check Worker is running (terminal 2)
# 2. Check Redis is accessible
redis-cli ping

# 3. Check job in queue
redis-cli LLEN provisioning:queue

# 4. Check Worker logs for errors
# 5. Restart Worker:
pkill -f "worker.*dev"
npm run dev
```

### Issue: Tenant Database Already Exists

```bash
# If provisioning fails mid-way, orphan DB might exist
# Drop it manually to retry:
psql -h localhost -U postgres -c "DROP DATABASE IF EXISTS workspace_test_institution;"

# Or Worker should clean it up on retry
# Check logs for "Database dropped after failure"
```

### Issue: Migration Already Applied

```bash
# If schema_versions has entry but retry needed:
psql -h localhost -U postgres -d workspace_test_institution -c "
  DELETE FROM schema_versions WHERE version = '1.2.0';
"

# Then retry provisioning
```

---

## Performance Testing

### Load Test: Create 10 Licenses in Parallel

```bash
# Create test script (test-load.sh)
for i in {1..10}; do
  curl -X POST http://localhost:3000/mmc/licenses \
    -H "Content-Type: application/json" \
    -d "{
      \"workspace_slug\": \"load-test-$i\",
      \"organization_name\": \"Test Org $i\",
      \"admin_email\": \"admin$i@test.edu\",
      \"product_id\": \"550e8400-e29b-41d4-a716-446655440100\",
      \"student_limit\": 1000,
      \"staff_limit\": 50,
      \"uses_divisions\": false
    }" & done

wait

# Monitor Worker processing
watch -n 1 'redis-cli LLEN provisioning:queue'

# All 10 jobs should process within ~2 minutes (120s each)
```

### Metrics to Monitor

```bash
# Check total licenses created
psql -h localhost -U postgres -d master_db -c "SELECT COUNT(*) FROM licenses;"

# Check successful provisions
psql -h localhost -U postgres -d master_db -c "SELECT COUNT(*) FROM licenses WHERE status = 'ACTIVE';"

# Check failed provisions
psql -h localhost -U postgres -d master_db -c "SELECT COUNT(*) FROM licenses WHERE status = 'PROVISION_FAILED';"

# Check registry consistency
psql -h localhost -U postgres -d master_db -c "SELECT COUNT(*) FROM tenants_registry;"

# Count tenant databases
psql -h localhost -U postgres -l | grep -c "workspace_"
```

---

## Cleanup

### Stop All Services

```bash
# Stop API
pkill -f "apps/api.*dev"

# Stop Worker
pkill -f "apps/worker.*dev"

# Stop Docker services
docker-compose down

# Remove Docker volumes (if needed)
docker-compose down -v
```

### Clean Up Test Data

```bash
# Drop all test databases
psql -h localhost -U postgres -c "
  SELECT datname
  FROM pg_database
  WHERE datname LIKE 'workspace_%'"

# For each database, drop it:
psql -h localhost -U postgres -c "DROP DATABASE IF EXISTS workspace_test_institution;"

# Or drop master_db tables (development only):
psql -h localhost -U postgres -d master_db -c "
  DELETE FROM tenants_registry;
  DELETE FROM licenses;
"
```

---

## Next Steps

After successful local testing:

1. **Run Integration Tests**:

   ```bash
   npm run test:integration
   ```

2. **Check Coverage**:

   ```bash
   npm run test:coverage
   ```

3. **Linting**:

   ```bash
   npm run lint
   ```

4. **Build for Production**:

   ```bash
   npm run build
   ```

5. **Deploy to Staging**:
   - Follow CI/CD pipeline in `.github/workflows/`
   - Push branch to GitHub: `git push origin 012-provisioning-trigger`
   - Pipeline auto-deploys to staging

6. **Deploy to Production**:
   - After staging acceptance tests pass
   - Create GitHub release / merge to main
   - Production pipeline triggers

---

## References

- [API Contract Documentation](contracts/license-creation-api.md)
- [Worker Job Contract](contracts/provisioning-job-contract.md)
- [Error Code Reference](contracts/error-codes.md)
- [Data Model Design](data-model.md)
- [Full Implementation Plan](plan.md)
