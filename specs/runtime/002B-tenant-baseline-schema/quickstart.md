# Quickstart: Tenant Baseline Schema

**Duration**: ~15 minutes  
**Audience**: Backend developers, DevOps engineers  
**Prerequisites**: PostgreSQL 14+, Node.js 18+, Bun

---

## Overview

This quickstart guides you through:

1. Setting up the development environment
2. Running schema initialization locally
3. Testing the baseline schema
4. Verifying migration flow
5. Running integration tests

---

## Environment Setup

### 1. Install Dependencies

```bash
# Install Node.js 18+ or Bun
curl -fsSL https://bun.sh/install | bash

# Navigate to API directory
cd apps/api

# Install dependencies
bun install

# Verify PostgreSQL 14+
psql --version  # PostgreSQL 14.x, 15.x, or 16.x
```

### 2. Configure Local Development Database

```bash
# Start PostgreSQL (if using Docker)
docker run -d \
  --name zidney-postgres \
  -e POSTGRES_PASSWORD=password \
  -p 5432:5432 \
  postgres:16-alpine

# Create MMC master database
psql -U postgres -h localhost -c "CREATE DATABASE zidney_mmc;"

# Create tenant database (will be created by provisioning in production)
psql -U postgres -h localhost -c "CREATE DATABASE zidney_tenant_workspace_1;"

# Verify connections
psql -U postgres -h localhost -d zidney_mmc -c "SELECT 1"  # Should return 1
```

### 3. Set Up Environment Variables

```bash
# Copy example .env
cp .env.example .env

# Edit .env
cat > .env <<'EOF'
# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/zidney_mmc
DATABASE_PORT=5432

# Tenant pools
TENANT_DB_HOST=localhost
TENANT_DB_PORT=5432
TENANT_DB_USERNAME=postgres
TENANT_DB_PASSWORD=password

# Worker
WORKER_REDIS_URL=redis://localhost:6379
WORKER_QUEUE_NAME=schema-initialization

# API
API_PORT=3000
API_LOG_LEVEL=debug

# Feature flags
SCHEMA_BASELINE_ENABLED=true
EOF

# Start Redis (if using Docker)
docker run -d \
  --name zidney-redis \
  -p 6379:6379 \
  redis:7-alpine

# Verify Redis
redis-cli ping  # Should return PONG
```

---

## Running Schema Initialization

### 1. Start Worker (In Terminal 1)

```bash
# Terminal 1: Start worker queue processor
cd apps/worker
bun run dev

# Expected output:
# [worker] Listening on queue: schema-initialization
# [worker] Worker ready
```

### 2. Start API (In Terminal 2)

```bash
# Terminal 2: Start API server
cd apps/api
bun run dev

# Expected output:
# [api] Server listening on http://localhost:3000
# [api] Health check: OK
```

### 3. Provision a Workspace (In Terminal 3)

```bash
# Terminal 3: Provision workspace with schema initialization

# First, create workspace in master DB
psql -U postgres -h localhost -d zidney_mmc <<'EOF'
INSERT INTO workspaces (id, slug, name)
VALUES ('550e8400-e29b-41d4-a716-446655440000', 'test-workspace', 'Test Workspace');

INSERT INTO licenses (id, workspace_id, status, product_version_compatibility)
VALUES ('f47ac10b-58cc-4372-a567-0e02b2c3d479', '550e8400-e29b-41d4-a716-446655440000', 'ACTIVE', '1.0.0');

INSERT INTO workspace_users (workspace_id, user_id, role)
VALUES ('550e8400-e29b-41d4-a716-446655440000', 'user-uuid', 'ADMIN');
EOF

# Now call the provisioning API
curl -X POST http://localhost:3000/mmm/workspaces/550e8400-e29b-41d4-a716-446655440000/schema/initialize \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-jwt-token" \
  -H "Idempotency-Key: f47ac10b-58cc-4372-a567-0e02b2c3d479" \
  -d '{"notify_on_complete": false}'

# Expected response (HTTP 202):
# {
#   "success": true,
#   "data": {
#     "task_id": "a1b2c3d4-e5f6-47a8-b8c9-d0e1f2a3b4c5",
#     "workspace_id": "550e8400-e29b-41d4-a716-446655440000",
#     "status": "initialization_queued",
#     "estimated_duration_seconds": 5
#   },
#   "error": null
# }

# Watch worker output (should show schema creation logs)
# Expected worker output:
# [worker:INIT_TENANT_SCHEMA] Starting schema initialization for workspace: 550e8400-e29b-41d4-a716-446655440000
# [worker:INIT_TENANT_SCHEMA] Creating table: users
# [worker:INIT_TENANT_SCHEMA] Creating table: attempts
# ...
# [worker:INIT_TENANT_SCHEMA] Completed schema initialization (v1.0.0) in 4.2s
```

### 4. Verify Schema Created

```bash
# Terminal 3: Verify tenant database now has schema_version table
psql -U postgres -h localhost -d zidney_tenant_workspace_1 <<'EOF'
SELECT * FROM schema_version;
EOF

# Expected output:
# version | applied_at | checksum
# --------|------------|------------------
# 1.0.0   | 2026-02-16 10:30:45.123456+00 | abc123def456...

# Count tables created
psql -U postgres -h localhost -d zidney_tenant_workspace_1 <<'EOF'
SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema='public';
EOF

# Expected output: ~36-40 tables
```

---

## Testing Baseline Schema

### 1. Run Unit Tests

```bash
cd apps/api

# Run all unit tests
bun test tests/unit/schema-baseline.test.ts

# Expected output:
# ✓ Schema initialization script creates all 38 tables
# ✓ Soft delete trigger prevents hard DELETE
# ✓ Immutability trigger prevents UPDATE on attempt_events
# ✓ Schema_version single-row trigger prevents duplicate INSERT
# ✓ Subscriptions unique constraint enforced
# ...
# Tests: 12 passed, 0 failed (45ms)
```

### 2. Run Integration Tests

```bash
# Full end-to-end provisioning test
bun test tests/integration/tenant-provisioning.test.ts

# Expected output:
# ✓ End-to-end workspace provisioning
# ✓ Transaction rollback: schema reverted on failure
# ✓ Foreign key constraint validation
# ✓ Schema version validation: product vs tenant
# ✓ License soft-lock enforcement
# ✓ Idempotency: repeated provisioning returns cached response
# ...
# Tests: 15 passed, 0 failed (8.2s)
```

### 3. Run Isolation Tests

```bash
# Cross-tenant isolation verification
bun test tests/integration/isolation.test.ts

# Expected output:
# ✓ Cross-tenant query prevention
# ✓ Connection pool isolation
# ✓ Tenant resolver accuracy
# Tests: 8 passed, 0 failed (2.1s)
```

### 4. Run Concurrency Tests

```bash
# High-concurrency load test
bun test tests/integration/concurrency.test.ts --timeout=30000

# Expected output:
# ✓ 100 concurrent attempt submissions: no lost updates
# ✓ Concurrent migrations on same tenant: serialization enforced
# ✓ Concurrent provisioning: idempotency prevents race
# Tests: 5 passed, 0 failed (12.4s)
```

---

## Testing Migration Flow

### 1. Create Migration File

```bash
# Create versioned migration (v1.0.0 → v1.1.0)
cat > apps/api/src/db/tenant/migrations/001_add_optional_column.sql <<'EOF'
-- Migration v1.0.0 → v1.1.0
-- Add optional column to users table

ALTER TABLE users ADD COLUMN preferred_language VARCHAR(5) DEFAULT 'en_US';
EOF

# Calculate checksum (store for verification)
sha256sum apps/api/src/db/tenant/migrations/001_add_optional_column.sql
# Output: abc123def456... (store this)
```

### 2. Enqueue Migration (Manual/Admin)

```bash
# (Future: API endpoint for admin-triggered migrations)
# For now, simulate via Redis queue:

redis-cli RPUSH schema-migrations-queue '{
  "task_type": "APPLY_MIGRATION",
  "workspace_id": "550e8400-e29b-41d4-a716-446655440000",
  "tenant_db_url": "postgresql://postgres:password@localhost:5432/zidney_tenant_workspace_1",
  "new_version": "1.1.0",
  "checksum": "abc123def456..."
}'

# Watch worker output
# Expected logs:
# [worker:APPLY_MIGRATION] Starting migration for workspace: 550e8400-e29b-41d4-a716-446655440000
# [worker:APPLY_MIGRATION] Validating checksum: MATCH
# [worker:APPLY_MIGRATION] Applying migration v1.1.0
# [worker:APPLY_MIGRATION] Updated schema_version: 1.0.0 → 1.1.0
# [worker:APPLY_MIGRATION] Migration completed in 0.8s
```

### 3. Verify Migration Applied

```bash
# Check schema_version updated
psql -U postgres -h localhost -d zidney_tenant_workspace_1 <<'EOF'
SELECT * FROM schema_version;
EOF

# Expected output:
# version | applied_at | checksum
# --------|------------|------------------
# 1.1.0   | 2026-02-16 10:35:22.654321+00 | abc123def456...

# Verify column added
psql -U postgres -h localhost -d zidney_tenant_workspace_1 <<'EOF'
\d users
EOF

# Expected: Column 'preferred_language' present
```

---

## Key Verification Checklist

- [ ] Worker queue starts without errors
- [ ] API server starts without errors
- [ ] Provisioning API returns 202 Accepted
- [ ] Worker processes schema initialization task
- [ ] schema_version table exists and contains v1.0.0
- [ ] All 36–40 baseline tables created
- [ ] Soft delete trigger prevents hard DELETE
- [ ] Attempt_events immutability enforced
- [ ] Schema_version single-row trigger enforced
- [ ] Unit tests pass (12 tests)
- [ ] Integration tests pass (15 tests)
- [ ] Isolation tests pass (8 tests)
- [ ] Concurrency tests pass (5 tests)
- [ ] Migration flow works (v1.0.0 → v1.1.0)
- [ ] Connection pool isolation verified

---

## Common Issues & Troubleshooting

### Issue: "connection refused" (PostgreSQL)

**Solution**:

```bash
# Verify PostgreSQL running
docker ps | grep postgres

# If not running, start it
docker run -d --name zidney-postgres -e POSTGRES_PASSWORD=password -p 5432:5432 postgres:16-alpine

# Verify connection
psql -U postgres -h localhost -c "SELECT 1"
```

### Issue: "Queue connection refused" (Redis)

**Solution**:

```bash
# Verify Redis running
docker ps | grep redis

# If not running, start it
docker run -d --name zidney-redis -p 6379:6379 redis:7-alpine

# Verify connection
redis-cli ping
```

### Issue: "workspace not found" (API call)

**Solution**:

```bash
# Verify workspace exists in master DB
psql -U postgres -h localhost -d zidney_mmc <<'EOF'
SELECT id, slug, name FROM workspaces WHERE id='550e8400-e29b-41d4-a716-446655440000';
EOF

# If not found, create it:
psql -U postgres -h localhost -d zidney_mmc <<'EOF'
INSERT INTO workspaces (id, slug, name)
VALUES ('550e8400-e29b-41d4-a716-446655440000', 'test-ws', 'Test Workspace');
EOF
```

### Issue: "schema already exists" or "table already exists"

**Solution**:

```bash
# This is expected on retry (idempotent). Verify with same Idempotency-Key:
curl -X POST http://localhost:3000/mmm/workspaces/550e8400-e29b-41d4-a716-446655440000/schema/initialize \
  -H "Idempotency-Key: f47ac10b-58cc-4372-a567-0e02b2c3d479" ...

# Should return 409 Conflict + cached response (not error)
```

### Issue: "Timeout" in migration

**Solution**:

```bash
# Check worker queue depth
redis-cli LLEN schema-migrations-queue

# If > 100, worker might be overloaded
# Scale: bun run worker --workers=4 (in production)

# For testing, check worker logs for actual errors
```

---

## Next Steps

1. **Implement Attempt Engine** (STAGE_06): Build attempt submission & grading
2. **Implement Migrations** (STAGE_02C): Formalize versioning policy
3. **Add Admin UI**: Backoffice for schema management
4. **Set Up CI/CD**: Automated testing on schema changes

---

## References

- [Data Model](./data-model.md)
- [Implementation Plan](./plan.md)
- [API Spec](./contracts/schema-api.openapi.yaml)
- [Feature Spec](./spec.md)

---

End of Quickstart.
