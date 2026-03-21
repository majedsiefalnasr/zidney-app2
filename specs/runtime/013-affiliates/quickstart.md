# Developer Quick-Start: Affiliate System Testing

**Stage**: STAGE_13_AFFILIATES | **Phase**: 02_PLATFORM_MMC | **Last Updated**: 2026-02-25

---

## Table of Contents

1. [Local Setup](#local-setup)
2. [Database Setup](#database-setup)
3. [Running the API](#running-the-api)
4. [Testing Affiliate CRUD](#testing-affiliate-crud)
5. [Testing License Purchase with Affiliate](#testing-license-purchase-with-affiliate)
6. [Concurrency Testing](#concurrency-testing)
7. [Troubleshooting](#troubleshooting)

---

## Local Setup

### Prerequisites

- Node.js 18+ (Zidney uses Bun, but Node can run tests)
- Bun 1.0+
- PostgreSQL 14+
- Docker (optional, for containerized PostgreSQL)
- Git

### Installation

```bash
# Clone repository
git clone <repo-url>
cd zidney-app2

# Install dependencies
bun install

# Setup environment file
cp .env.example .env

# Configure for local development
# Edit .env:
# DATABASE_URL=postgresql://user:password@localhost:5432/zidney_master_db
# MASTER_DB_HOST=localhost
# MASTER_DB_PORT=5432
# MMC_TOKEN=dev-test-token
```

---

## Database Setup

### Option 1: Docker PostgreSQL (Quick)

```bash
# Start PostgreSQL container
docker run -d \
  --name zidney-postgres \
  -e POSTGRES_USER=zidney \
  -e POSTGRES_PASSWORD=localdev123 \
  -e POSTGRES_DB=zidney_master_db \
  -p 5432:5432 \
  postgres:16-alpine

# Wait for PostgreSQL to be ready
sleep 5

# Verify connection
psql postgresql://zidney:localdev123@localhost:5432/zidney_master_db -c "SELECT 1"
```

### Option 2: Existing PostgreSQL

```bash
# Create database
createdb -U postgres zidney_master_db

# Update .env with credentials
DATABASE_URL=postgresql://postgres:password@localhost:5432/zidney_master_db
```

### Run Migrations

```bash
# From repository root
cd apps/api

# Execute all master_db migrations
bun run db:migrate

# Or execute specific migrations
bun run db:migrate --migration=009_create_affiliates_tables.ts
bun run db:migrate --migration=010_create_affiliate_admin_audit.ts

# Verify tables created
bun db:introspect
```

---

## Running the API

### Start Development Server

```bash
# From repository root
bun run dev

# API will start on http://localhost:3000
# Expected output:
# ✓ API server running on http://localhost:3000
# ✓ Master DB connected
# ✓ Worker ready
```

### Verify Server Health

```bash
curl http://localhost:3000/health

# Expected response:
# {"success":true,"status":"healthy"}
```

---

## Testing Affiliate CRUD

### 1. Create an Affiliate

```bash
curl -X POST http://localhost:3000/v1/mmc/affiliates \
  -H "Authorization: Bearer dev-test-token" \
  -H "Content-Type: application/json" \
  -H "X-Correlation-ID: test-001" \
  -d '{
    "promo_code": "DEVTEST01",
    "discount_percentage": 10.50,
    "commission_percentage": 2.75,
    "usage_limit_total": 100,
    "usage_limit_per_client": 5,
    "start_date": "2026-03-01T00:00:00Z",
    "end_date": "2026-05-31T23:59:59Z",
    "allow_with_other_discounts": false,
    "description": "Development test affiliate code"
  }'

# Expected response (201 Created):
# {
#   "success": true,
#   "data": {
#     "id": "aff-<uuid>",
#     "promo_code": "DEVTEST01",
#     "discount_percentage": "10.50",
#     "commission_percentage": "2.75",
#     "usage_limit_total": 100,
#     "usage_limit_per_client": 5,
#     "usage_count": 0,
#     "status": "ACTIVE",
#     "created_at": "2026-02-25T...",
#     "updated_at": "2026-02-25T..."
#   },
#   "error": null
# }

# Save the affiliate ID for later use
AFFILIATE_ID="aff-<uuid>"  # Copy from response
```

### 2. List Affiliates

```bash
curl -X GET "http://localhost:3000/v1/mmc/affiliates?status=ACTIVE&limit=10" \
  -H "Authorization: Bearer dev-test-token" \
  -H "X-Correlation-ID: test-002"

# Expected response (200 OK):
# {
#   "success": true,
#   "data": {
#     "affiliates": [...],
#     "pagination": {"page": 1, "limit": 10, "total": 1, "total_pages": 1}
#   },
#   "error": null
# }
```

### 3. Edit an Affiliate

```bash
curl -X PATCH "http://localhost:3000/v1/mmc/affiliates/$AFFILIATE_ID" \
  -H "Authorization: Bearer dev-test-token" \
  -H "Content-Type: application/json" \
  -H "X-Correlation-ID: test-003" \
  -d '{
    "discount_percentage": 15.00,
    "usage_limit_total": 200
  }'

# Expected response (200 OK):
# Modified affiliate with new values
```

### 4. View Affiliate Usage History

```bash
curl -X GET "http://localhost:3000/v1/mmc/affiliates/$AFFILIATE_ID/usages" \
  -H "Authorization: Bearer dev-test-token" \
  -H "X-Correlation-ID: test-004"

# Expected response (200 OK):
# {
#   "success": true,
#   "data": {
#     "affiliate_id": "aff-...",
#     "promo_code": "DEVTEST01",
#     "total_usages": 0,
#     "total_base_amount": "0.00",
#     "total_discount_amount": "0.00",
#     "total_commission_amount": "0.00",
#     "usages": [],
#     "pagination": {"page": 1, "total": 0}
#   },
#   "error": null
# }
```

### 5. Disable an Affiliate

```bash
curl -X POST "http://localhost:3000/v1/mmc/affiliates/$AFFILIATE_ID/disable" \
  -H "Authorization: Bearer dev-test-token" \
  -H "X-Correlation-ID: test-005"

# Expected response (200 OK):
# Affiliate with status="INACTIVE"
```

---

## Testing License Purchase with Affiliate

### Prerequisites

- Affiliate code created (from CRUD section above)
- Product exists in database
- Client can authenticate

### Create a Test Affiliate

```bash
# Create a test affiliate for license purchase testing
curl -X POST http://localhost:3000/v1/mmc/affiliates \
  -H "Authorization: Bearer dev-test-token" \
  -H "Content-Type: application/json" \
  -d '{
    "promo_code": "TESTPURCHASE",
    "discount_percentage": 20.00,
    "commission_percentage": 5.00,
    "usage_limit_total": 50,
    "usage_limit_per_client": 10,
    "start_date": "2026-01-01T00:00:00Z",
    "end_date": "2026-12-31T23:59:59Z",
    "description": "Testing affiliate"
  }'

# Save the affiliate ID
TEST_AFFILIATE_ID="aff-<uuid>"
```

### Purchase License Without Affiliate

```bash
curl -X POST http://localhost:3000/v1/licenses/purchase \
  -H "Authorization: Bearer <client-token>" \
  -H "Content-Type: application/json" \
  -H "X-Correlation-ID: license-001" \
  -d '{
    "product_id": "prod-001",
    "workspace_name": "Test University",
    "student_limit": 1000,
    "staff_limit": 50
  }'

# Expected response (201 Created):
# {
#   "success": true,
#   "data": {
#     "license_id": "lic-001",
#     "amount_paid": "5000.00",
#     "discount_applied": false,
#     "affiliate_code": null
#   },
#   "error": null
# }
```

### Purchase License With Affiliate Code

```bash
curl -X POST http://localhost:3000/v1/licenses/purchase \
  -H "Authorization: Bearer <client-token>" \
  -H "Content-Type: application/json" \
  -H "X-Correlation-ID: license-002" \
  -d '{
    "product_id": "prod-001",
    "workspace_name": "Test University 2",
    "student_limit": 1000,
    "staff_limit": 50,
    "promo_code": "TESTPURCHASE"
  }'

# Expected response (201 Created):
# {
#   "success": true,
#   "data": {
#     "license_id": "lic-002",
#     "amount_before_discount": "5000.00",
#     "discount_applied": true,
#     "discount_amount": "1000.00",
#     "amount_paid": "4000.00",
#     "affiliate_code": "TESTPURCHASE",
#     "commission_earned": "250.00"
#   },
#   "error": null
# }
```

### Test Expired Code

```bash
# Create an expired code
curl -X POST http://localhost:3000/v1/mmc/affiliates \
  -H "Authorization: Bearer dev-test-token" \
  -H "Content-Type: application/json" \
  -d '{
    "promo_code": "EXPIRED",
    "discount_percentage": 10.00,
    "commission_percentage": 2.00,
    "start_date": "2025-01-01T00:00:00Z",
    "end_date": "2025-12-31T23:59:59Z",
    "description": "Expired code for testing"
  }'

# Try to use expired code
curl -X POST http://localhost:3000/v1/licenses/purchase \
  -H "Authorization: Bearer <client-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "product_id": "prod-001",
    "workspace_name": "Test Expired",
    "student_limit": 1000,
    "promo_code": "EXPIRED"
  }'

# Expected response (400 Bad Request):
# {
#   "success": false,
#   "error": {
#     "code": "AFFILIATE_CODE_EXPIRED",
#     "message": "Promo code 'EXPIRED' expired on 2025-12-31"
#   }
# }
```

### Test Usage Limit

```bash
# Create code with low limit
curl -X POST http://localhost:3000/v1/mmc/affiliates \
  -H "Authorization: Bearer dev-test-token" \
  -H "Content-Type: application/json" \
  -d '{
    "promo_code": "LIMITED",
    "discount_percentage": 10.00,
    "commission_percentage": 2.00,
    "usage_limit_total": 1,
    "usage_limit_per_client": 1,
    "start_date": "2026-01-01T00:00:00Z",
    "end_date": "2026-12-31T23:59:59Z"
  }'

# First purchase succeeds
curl -X POST http://localhost:3000/v1/licenses/purchase \
  -H "Authorization: Bearer <client-token>" \
  -d '{"product_id": "prod-001", "workspace_name": "Test1", "promo_code": "LIMITED"}'

# Second purchase fails (limit reached)
curl -X POST http://localhost:3000/v1/licenses/purchase \
  -H "Authorization: Bearer <client-token>" \
  -d '{"product_id": "prod-001", "workspace_name": "Test2", "promo_code": "LIMITED"}'

# Expected response (400 Bad Request):
# {
#   "success": false,
#   "error": {
#     "code": "AFFILIATE_USAGE_LIMIT_EXCEEDED",
#     "message": "Promo code 'LIMITED' has reached its global usage limit of 1"
#   }
# }
```

---

## Concurrency Testing

### Load Test: Multiple Concurrent Purchases with Same Code

```bash
#!/bin/bash
# Create test affiliate
AFFILIATE_ID=$(curl -s -X POST http://localhost:3000/v1/mmc/affiliates \
  -H "Authorization: Bearer dev-test-token" \
  -H "Content-Type: application/json" \
  -d '{"promo_code":"CONCURRENT","discount_percentage":5,"commission_percentage":1,"usage_limit_total":100,"start_date":"2026-01-01T00:00:00Z","end_date":"2026-12-31T23:59:59Z"}' | jq -r '.data.id')

# Fire 10 concurrent license purchases with same code
for i in {1..10}; do
  curl -X POST http://localhost:3000/v1/licenses/purchase \
    -H "Authorization: Bearer <client-token>" \
    -H "Content-Type: application/json" \
    -d "{\"product_id\":\"prod-001\",\"workspace_name\":\"Concurrent$i\",\"promo_code\":\"CONCURRENT\"}" &
done
wait

# Verify usage count
curl -X GET "http://localhost:3000/v1/mmc/affiliates/$AFFILIATE_ID/usages" \
  -H "Authorization: Bearer dev-test-token" | jq '.data.pagination.total'

# Expected: usage count should be 10 (no gaps, no double-counting)
```

### Concurrency Limits Test

```bash
#!/bin/bash
# Create code with per-client limit=2
curl -X POST http://localhost:3000/v1/mmc/affiliates \
  -H "Authorization: Bearer dev-test-token" \
  -H "Content-Type: application/json" \
  -d '{
    "promo_code": "PERPERSON",
    "discount_percentage": 5.00,
    "commission_percentage": 1.00,
    "usage_limit_per_client": 2,
    "usage_limit_total": 100,
    "start_date": "2026-01-01T00:00:00Z",
    "end_date": "2026-12-31T23:59:59Z"
  }'

# Fire 5 concurrent purchases from same client
for i in {1..5}; do
  curl -X POST http://localhost:3000/v1/licenses/purchase \
    -H "Authorization: Bearer <same-client-token>" \
    -H "Content-Type: application/json" \
    -d "{\"product_id\":\"prod-001\",\"workspace_name\":\"ClientLimit$i\",\"promo_code\":\"PERPERSON\"}" &
done
wait

# Verify: first 2 succeed, next 3 fail with AFFILIATE_USAGE_LIMIT_PER_CLIENT_EXCEEDED
```

---

## Troubleshooting

### Issue: "AFFILIATE_CODE_NOT_FOUND"

**Problem**: Affiliate code doesn't exist or wrong promo_code

**Solution**:

```bash
# Verify code exists
curl -X GET http://localhost:3000/v1/mmc/affiliates \
  -H "Authorization: Bearer dev-test-token" | jq '.data.affiliates[] | .promo_code'
```

### Issue: "AFFILIATE_CODE_EXPIRED"

**Problem**: Current time outside start_date..end_date window

**Solution**:

```bash
# Check current time (API uses server time)
curl -X GET http://localhost:3000/health | jq '.timestamp'

# Create affiliate with future dates
curl -X POST http://localhost:3000/v1/mmc/affiliates \
  -H "Authorization: Bearer dev-test-token" \
  -H "Content-Type: application/json" \
  -d '{
    "promo_code": "FUTURE",
    "start_date": "2026-06-01T00:00:00Z",
    "end_date": "2026-08-31T23:59:59Z",
    ...
  }'
```

### Issue: "INVALID_PAGINATION"

**Problem**: page or limit parameters invalid

**Solution**:

```bash
# Valid pagination
curl -X GET "http://localhost:3000/v1/mmc/affiliates?page=1&limit=50" \
  -H "Authorization: Bearer dev-test-token"
```

### Issue: Database Connection Error

**Problem**: PostgreSQL not running or wrong connection string

**Solution**:

```bash
# Verify PostgreSQL running
docker ps | grep postgres

# Test connection
psql postgresql://zidney:localdev123@localhost:5432/zidney_master_db -c "SELECT 1"

# Check .env DATABASE_URL
cat .env | grep DATABASE_URL

# Restart API server
bun run dev
```

### Issue: "UNAUTHORIZED" (403)

**Problem**: Admin lacks required RBAC permission

**Solution**:

```bash
# Verify admin token in request
-H "Authorization: Bearer dev-test-token"

# Check admin has affiliates:* permissions
# (in test/development, all MMC tokens trusted)
```

---

## Debugging

### Enable Verbose Logging

```bash
# Set log level
LOG_LEVEL=debug bun run dev
```

### Query Database Directly

```bash
# List all affiliates
psql postgresql://zidney:localdev123@localhost:5432/zidney_master_db -c \
  "SELECT id, promo_code, status, usage_count, created_at FROM affiliates;"

# List all usages
psql postgresql://zidney:localdev123@localhost:5432/zidney_master_db -c \
  "SELECT affiliate_id, client_id, base_amount, discount_amount, commission_amount, created_at FROM affiliate_usages ORDER BY created_at DESC LIMIT 10;"

# View admin audit trail
psql postgresql://zidney:localdev123@localhost:5432/zidney_master_db -c \
  "SELECT affiliate_id, admin_id, action, new_values, created_at FROM affiliate_admin_audit ORDER BY created_at DESC LIMIT 10;"
```

### Monitor API Logs

```bash
# Watch API logs for affiliate events
bun run dev 2>&1 | grep -i affiliate
```

---

## Next Steps

1. **Run Unit Tests**: `bun test tests/unit/affiliates/`
2. **Run Integration Tests**: `bun test tests/integration/affiliates/`
3. **Run Concurrency Tests**: `bun test tests/edge-cases/affiliates/concurrent-purchases.test.ts`
4. **Load Testing**: Use Artillery or k6 for high-volume testing
5. **Deploy**: Follow deployment guide in docs/02_DEVOPS_DEPLOYMENT/

---

## Additional Resources

- [API Contracts](./contracts/)
- [Data Model](./data-model.md)
- [Implementation Plan](./plan.md)
- [Specification](./spec.md)
- [API AGENTS.md](../../../apps/api/AGENTS.md)
