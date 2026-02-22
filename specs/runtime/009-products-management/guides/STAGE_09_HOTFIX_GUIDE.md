# STAGE_09_PRODUCTS – Hotfix & Troubleshooting Guide

**Quick Reference for Production Issues**  
**Use this guide if critical issues arise during or after STAGE_09 deployment**

---

## SEVERITY LEVELS

| Level       | Response Time | Trigger Example                              | Action                           |
| ----------- | ------------- | -------------------------------------------- | -------------------------------- |
| 🔴 Critical | < 5 min       | Error rate > 2%, 5xx in products API         | Immediate rollback               |
| 🟠 High     | < 15 min      | Response time spike, specific endpoint fails | Investigate, hotfix if simple    |
| 🟡 Medium   | < 1 hour      | Minor bugs, performance degradation          | Scheduled hotfix or next release |
| 🟢 Low      | Next release  | Documentation issue, edge case bug           | Backlog for next sprint          |

---

## ISSUE: Products API Returns 500 Errors

### Symptoms

```
GET /api/v1/mmc/products → 500 Internal Server Error
Error logs: "Failed to connect to database" or similar
```

### Quick Triage (5 min)

```bash
# Check pod logs
kubectl logs deployment/zidney-api-green -n production --tail=50

# Check database connectivity
kubectl exec -it <pod-name> -n production -- \
  psql -U postgres -d zidney_master -c "SELECT 1;"

# Check for OOMKilled
kubectl describe pod <pod-name> -n production | grep LastState
```

### Root Causes & Fixes

#### 1. Database Connection Pool Exhausted

**Symptom:** "too many connections" in logs

**Fix:**

```bash
# Check connection count
psql -U postgres -d zidney_master -c \
  "SELECT datname, count(*) FROM pg_stat_activity GROUP BY datname;"

# Restart API pods to reset connections
kubectl rollout restart deployment/zidney-api-green -n production

# If still failing, increase pool size in deployment config
# (File: deploy/zidney-api.yml, ENV: DB_POOL_MAX=50)
```

#### 2. Memory Leak in Products Service

**Symptom:** Pod OOMKilled, gradual performance degradation

**Fix:**

```bash
# Check memory usage
kubectl top pods -n production -l app=zidney-api

# If > 500MB: Restart pods
kubectl rollout restart deployment/zidney-api-green -n production

# If persists: Verify no infinite loops in productService
# Check recent commits: git log --oneline apps/api/src/routes/mmc/products.ts
```

#### 3. Schema Mismatch

**Symptom:** "column does not exist" errors for products table

**Fix:**

```bash
# Verify schema
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name LIKE 'product%';

# If tables missing: Migration didn't run
# Re-run migrations:
psql -U postgres -d zidney_master < migrations/20260221_004_create_products.sql
psql -U postgres -d zidney_master < migrations/20260222_005_complete_products_schema.sql

# Restart API
kubectl rollout restart deployment/zidney-api-green -n production
```

### Decision: Hotfix or Rollback?

| Root Cause                | Action                                  |
| ------------------------- | --------------------------------------- |
| Connection pool exhausted | Hotfix: Restart pods                    |
| Memory leak               | Hotfix: Identify code, patch, redeploy  |
| Schema mismatch           | Hotfix: Re-run migrations               |
| Logic error               | Hotfix: Code fix OR Rollback if complex |
| Unknown                   | Rollback immediately                    |

---

## ISSUE: Products Route Returns 401 Unauthorized

### Symptoms

```
GET /api/v1/mmc/products → 401 Unauthorized
Error: "License validation failed"
```

### Root Cause Analysis

```bash
# Check license middleware logs
kubectl logs deployment/zidney-api-green -n production | grep "license_middleware"

# Verify workspace has active license
psql -U postgres -d zidney_master -c \
  "SELECT id, status, schema_version FROM workspaces WHERE slug = 'test-workspace';"

# Check if license status is ACTIVE
psql -U postgres -d zidney_master -c \
  "SELECT id, workspace_id, status FROM licenses WHERE workspace_id = '<workspace_id>';"
```

### Fixes

#### 1. License Expired or Archived

**Fix:**

```bash
# Update license status in database (admin only)
psql -U postgres -d zidney_master -c \
  "UPDATE licenses SET status = 'ACTIVE', updated_at = NOW()
   WHERE workspace_id = '<workspace_id>' AND status = 'ARCHIVED';"
```

#### 2. Schema Version Mismatch

**Fix:**

```bash
# Check workspace schema version
psql -U postgres -d zidney_master -c \
  "SELECT schema_version FROM workspaces WHERE schema_id = 'master_db';"

# Expected: >= 9 (STAGE_09 migration level)
# If < 9: Migration not applied to master_db

# Verify master_db schema version after deployment:
SELECT schema_version FROM _schema_info WHERE db_type = 'master';
```

#### 3. License Middleware Not Loaded

**Fix:**

```bash
# Verify middleware in routes
grep -n "licenseMiddleware" apps/api/src/routes/mmc/products.ts

# If missing: Add middleware to route
# File: apps/api/src/routes/mmc/products.ts
# Add after correlationIdMiddleware:
// licenseMiddleware,
```

---

## ISSUE: Products List Takes > 1 Second (Performance Degradation)

### Symptoms

```
GET /api/v1/mmc/products?limit=50
Response time: 2-3 seconds (expected: < 200ms)
```

### Diagnosis

```bash
# Check slow query logs
tail -100 /var/log/postgresql/slow-queries.log

# Analyze product listing query
EXPLAIN ANALYZE
  SELECT id, name, slug, enabled_modules, status, current_version, created_at, updated_at
  FROM products
  WHERE status = 'ACTIVE'
  ORDER BY created_at DESC
  LIMIT 50;
```

### Common Fixes

#### 1. Missing Index

**Problem:** No index on status column

**Fix:**

```sql
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at DESC);

-- Verify index exists
SELECT indexname FROM pg_indexes WHERE tablename = 'products';
```

#### 2. Full Table Scan

**Problem:** Query planner choosing seq scan instead of index

**Fix:**

```sql
-- Analyze and replan
VACUUM ANALYZE products;
REINDEX TABLE products;

-- Re-run EXPLAIN ANALYZE
EXPLAIN ANALYZE SELECT ...
```

#### 3. N+1 Query Pattern

**Problem:** Service fetching product details in loop

**Fix:** (Code change required)

- Check `productService.ts` listProducts function
- Verify single database query, not loop
- Hotfix: Batch queries together

---

## ISSUE: Audit Trail Not Recording Changes

### Symptoms

```
Create/update products, but:
GET /api/v1/mmc/products/:id/audit-log → Empty array []
```

### Root Cause Analysis

```bash
# Check if audit logs table is empty
psql -U postgres -d zidney_master -c \
  "SELECT COUNT(*) FROM product_audit_logs;"

# Expected: > 0 after operations

# Check for INSERT errors
kubectl logs deployment/zidney-api-green -n production | grep "audit"
```

### Fixes

#### 1. Audit Trigger Not Firing

**Problem:** productService INSERT doesn't call audit logger

**Fix:** (Code fix)

- Verify productService.ts includes audit insert
- Check transaction COMMIT (if rolled back, audit not saved)
- Hotfix: Add explicit audit insert if missing

#### 2. Transaction Rolled Back

**Problem:** BEGIN/ROLLBACK without INSERT to audit_logs

**Fix:** (Code review)

```typescript
// productService.ts should follow this pattern:
await client.query('BEGIN')
try {
  // ... product operations ...
  await client.query('INSERT INTO product_audit_logs ...')
  await client.query('COMMIT')
} catch (error) {
  await client.query('ROLLBACK')
  throw error
}
```

#### 3. Audit Trigger Broken

**Problem:** Trigger on product_audit_logs prevents INSERT

**Fix:**

```bash
# Check trigger status
psql -U postgres -d zidney_master -c \
  "SELECT tgname, tgisinternal FROM pg_trigger WHERE tgrelid = 'product_audit_logs'::regclass;"

# Check if immutability trigger is blocking INSERT (it shouldn't)
# Trigger should prevent UPDATE, not INSERT

# Re-create trigger if corrupt:
DROP TRIGGER IF EXISTS prevent_audit_logs_update ON product_audit_logs;
CREATE TRIGGER prevent_audit_logs_update
  BEFORE UPDATE ON product_audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION raise_audit_log_immutable();
```

---

## ISSUE: Product Slug Not Enforced as Unique

### Symptoms

```
POST /api/v1/mmc/products { "slug": "my-product" } → 201
POST /api/v1/mmc/products { "slug": "my-product" } → 201 (should be 409 Conflict)
```

### Root Cause

```bash
# Check unique constraint
psql -U postgres -d zidney_master -c \
  "SELECT constraint_name FROM information_schema.table_constraints
   WHERE table_name = 'products' AND constraint_type = 'UNIQUE';"

# Expected: uk_products_slug
```

### Fixes

#### 1. Constraint Missing

**Fix:**

```sql
-- Add unique constraint if missing
ALTER TABLE products
ADD CONSTRAINT uk_products_slug UNIQUE (slug);

-- Verify
SELECT constraint_name FROM information_schema.table_constraints
WHERE table_name = 'products' AND constraint_type = 'UNIQUE';
```

#### 2. Constraint Not Enforced in Application

**Problem:** Code doesn't catch database constraint error

**Fix:** (Code review)

```typescript
// productService.ts should catch unique violation
try {
  await client.query('INSERT INTO products ...')
} catch (error) {
  if (error.code === '23505') {
    // Unique constraint violation
    throw new AppError(ErrorCodes.SLUG_CONFLICT, 'Slug already exists')
  }
}
```

---

## ISSUE: Module Validation Not Working

### Symptoms

```
POST /api/v1/mmc/products { "enabled_modules": ["INVALID_MODULE"] } → 201 (should be 400)
```

### Root Cause

```bash
# Check Module enum in validation
grep -n "enum Module" packages/types/src/enums/Module.ts

# Should have all 6 modules: MCQ, TRADITIONAL_EXAMS, EXERCISES, LIBRARY, LIVES, FORUM
```

### Fixes

#### 1. Validation Schema Missing Module Enum

**Problem:** Zod schema doesn't validate against enum

**Fix:** (Code update)

```typescript
// packages/validation/src/products/productValidation.ts
import { Module } from '@zidney/types/enums/Module'

export const CreateProductSchema = z.object({
  enabled_modules: z
    .array(
      z.nativeEnum(Module) // ← Must use nativeEnum
    )
    .min(1),
})
```

#### 2. Database Constraint Not Enforced

**Problem:** trigger validate_product_modules() not firing

**Fix:**

```bash
# Verify trigger exists
psql -U postgres -d zidney_master -c \
  "SELECT tgname FROM pg_trigger WHERE tgrelid = 'products'::regclass;"

# Expected: validate_products_modules

# If missing, re-create:
CREATE TRIGGER validate_products_modules
  BEFORE INSERT OR UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION validate_product_modules();
```

---

## ISSUE: Cannot Delete Product (409 Conflict When No Licenses Exist)

### Symptoms

```
DELETE /api/v1/mmc/products/uuid → 409 Conflict
Error: "Foreign key violation"

(But no licenses reference this product)
```

### Root Cause

```bash
# Check if licenses table constraint is set up
psql -U postgres -d zidney_master -c \
  "SELECT constraint_name FROM information_schema.table_constraints
   WHERE table_name = 'licenses' AND constraint_name LIKE '%product%';"

# Or check for orphaned product references (from future stages)
```

### Fixes

#### 1. Licenses Table Constraint Premature

**Problem:** Stage 10 migration already ran, but constraint too strict

**Fix:**

```bash
# Check if licenses table exists (shouldn't in Stage 9)
SELECT * FROM information_schema.tables WHERE table_name = 'licenses';

# If exists: Stage 10 partially deployed
# Decision: Rollback to Stage 09, or complete Stage 10 deployment
```

#### 2. Application Logic Issue

**Problem:** productService.deleteProduct() checking wrong table

**Fix:** (Code review)

```typescript
// Should check licenses table
const checkResult = await client.query(
  'SELECT COUNT(*) FROM licenses WHERE product_id = $1',
  [productId]
)

if (checkResult.rows[0].count > 0) {
  throw new AppError(
    ErrorCodes.CONFLICT,
    'Cannot delete product with existing licenses'
  )
}
```

---

## ISSUE: Correlation ID Missing from Logs

### Symptoms

```
Logs show no correlation_id field
Makes debugging requests impossible
```

### Root Cause

```bash
# Check if correlationIdMiddleware is enabled
grep -n "correlationIdMiddleware" apps/api/src/routes/mmc/products.ts

# Check middleware implementation
cat apps/api/src/middleware/correlationIdMiddleware.ts | head -20
```

### Fixes

#### 1. Middleware Not Applied

**Fix:** (Code update)

```typescript
// apps/api/src/routes/mmc/products.ts
router.get(
  '/products',
  correlationIdMiddleware,  // ← Must be first
  licenseMiddleware,
  asyncHandler(...)
);
```

#### 2. Correlation ID Not Propagated

**Problem:** Middleware creates ID but doesn't pass to logs

**Fix:** (Code review)

```typescript
// Must extract and pass to logger
const correlationId = c.get('correlationId')
logger.info('products_list', {
  correlation_id: correlationId, // ← Must include
  // ... other fields
})
```

---

## ISSUE: Response Format Not Following Standard Contract

### Symptoms

```
Response: { "data": [...] }
Expected: { "success": true, "data": [...], "error": null }
```

### Root Cause

```bash
# Check response wrapper
grep -n "sendSuccess\|sendList" apps/api/src/utils/responseWrapper.ts
```

### Fixes

#### 1. Wrong Response Wrapper Used

**Fix:** (Code update)

```typescript
// apps/api/src/routes/mmc/products.ts
// WRONG:
return c.json({ data: products })

// CORRECT:
return sendSuccess(c, products)
return sendList(c, items, total, limit, offset)
return sendCreated(c, product)
```

#### 2. Error Response Not Following Contract

**Problem:** Error returns { message: "..." } instead of standard

````

**Fix:** (Code review)
```typescript
// Must use sendError helper
return sendError(c, new AppError(ErrorCodes.PRODUCT_NOT_FOUND, 'Not found'));

// Which returns:
{
  "success": false,
  "data": null,
  "error": {
    "code": "PRODUCT_NOT_FOUND",
    "message": "Not found"
  }
}
````

---

## EMERGENCY HOTFIX TEMPLATE

### Use this template for quick hotfixes

```bash
# 1. Create hotfix branch
git checkout -b hotfix/products-issue-XXXX
git pull origin main

# 2. Make minimal fix (one file only)
# Edit file: apps/api/src/...

# 3. Run tests (must pass)
npm run test -- apps/api/tests/

# 4. Verify fix (local test if possible)
npm run dev

# 5. Commit with hotfix tag
git add .
git commit -m "Hotfix: Brief description (Products STAGE_09)"
git tag hotfix/1.9.1-PATCH-01

# 6. Build new image
docker build -t zidney-api:1.9.1-PATCH-01 .
docker push registry.example.com/zidney-api:1.9.1-PATCH-01

# 7. Deploy to production
kubectl set image deployment/zidney-api-green \
  api=registry.example.com/zidney-api:1.9.1-PATCH-01 -n production

# 8. Monitor
kubectl logs -f deployment/zidney-api-green -n production

# 9. Merge back to main
git checkout main
git merge --no-ff hotfix/products-issue-XXXX
git push origin main
```

---

## 24-HOUR MONITORING CHECKLIST

Run these checks during first 24 hours post-deployment:

### Every 1 Hour

- [ ] Error rate check: `kubectl logs deployment/zidney-api-green | grep ERROR | wc -l`
  - Expected: 0-5 errors total
- [ ] Response time check: `curl -w "%{time_total}\n" https://api.zidney.com/api/v1/mmc/products`
  - Expected: < 500ms
- [ ] Pod health: `kubectl get pods -n production -l app=zidney-api`
  - Expected: All Running, Age < 2h

### Every 4 Hours

- [ ] Database query performance: Run slow-query audit
- [ ] Product creation test: Create test product via API
- [ ] Audit trail test: Verify audit logs recorded
- [ ] Memory usage: `kubectl top pods -n production`
  - Expected: < 500MB per pod

### At 24-Hour Mark

- [ ] Total error count (24h window): Should be < 20
- [ ] 99th percentile latency: Should be < 500ms
- [ ] No pod OOMKilled events
- [ ] No pod restart loops
- [ ] All middleware functional (correlation ID, license checks)
- [ ] Audit trail complete and immutable

---

## ESCALATION CHAIN

If issue cannot be resolved in 15 minutes:

1. **Notify:** Platform Lead
2. **If no resolution in 30 min:** Escalate to CTO
3. **If data integrity risk:** Database Team immediate escalation
4. **If security concern:** Security Team + Immediate lockdown

---

**Last Updated:** 2026-02-22  
**Valid Until:** 2026-03-22 (1 month post-deployment)  
**Next Stage:** STAGE_10_LICENSES (depends on this stage stability)
