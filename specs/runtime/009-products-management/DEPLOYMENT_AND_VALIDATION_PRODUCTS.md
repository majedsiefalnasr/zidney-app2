# Deployment & Validation Checklist - Products Management

**Stage:** STAGE_09_PRODUCTS  
**Version:** 1.0.0  
**Last Updated:** 2024-12-15

---

## Pre-Deployment Validation

### Code Quality Checks

- [ ] **TypeScript Compilation:** `npm run build`

  ```bash
  npm run build
  # Expected: No errors, all type-safe
  ```

- [ ] **Linting:** `npm run lint`

  ```bash
  npm run lint apps/api
  # Expected: No errors or warnings
  ```

- [ ] **Format Check:** `npm run format:check`
  ```bash
  npm run format:check
  # Expected: All files formatted
  ```

### Automated Testing

- [ ] **Unit Tests:** `npm run test -- tests/unit/products`

  ```bash
  npm run test -- tests/unit/products
  # Expected: All pass, >95% coverage
  # Coverage report in: coverage/
  ```

- [ ] **Integration Tests:** `npm run test -- tests/integration/products`

  ```bash
  npm run test -- tests/integration/products
  # Expected: All 9 test suites pass
  # Tests: create, list, get, update, status, delete, audit, transactions, errors
  ```

- [ ] **Contract Tests:** `npm run test -- tests/contract/products`

  ```bash
  npm run test -- tests/contract/products
  # Expected: OpenAPI compliance verified
  ```

- [ ] **Load Tests:** `npm run test -- tests/load/products`

  ```bash
  npm run test -- tests/load/products
  # Expected: Performance targets met
  # - List 1000+ items within 1 second
  # - Search within 500ms
  # - Audit log query 10k entries within 1 second
  ```

- [ ] **All Tests:** `npm run test`
  ```bash
  npm run test
  # Expected: Full suite passes (expect ~2000+ tests)
  ```

### Database Migration Validation

- [ ] **Migration File Format:** Check migration syntax

  ```bash
  cat apps/api/src/db/master/migrations/20260221_004_create_products.sql
  # Expected: Valid SQL, proper transaction wrapping
  ```

- [ ] **Migration Applied:** Verify in staging/dev

  ```bash
  # In staging/dev database
  SELECT * FROM information_schema.tables
  WHERE table_name IN ('products', 'product_versions', 'product_audit_logs');
  # Expected: All 3 tables exist
  ```

- [ ] **Constraints Verified:**

  ```sql
  -- Check constraints exist
  SELECT constraint_name FROM information_schema.table_constraints
  WHERE table_name = 'products';
  # Expected: UNIQUE on slug, CHECK constraints on status/modules/version
  ```

- [ ] **Indexes Exist:**

  ```sql
  SELECT indexname FROM pg_indexes
  WHERE tablename IN ('products', 'product_versions', 'product_audit_logs');
  # Expected: All indexes present (8+ indexes total)
  ```

- [ ] **Schema Version Updated:**
  ```sql
  SELECT schema_version FROM workspaces LIMIT 1;
  # Expected: Incremented to new version
  ```

### API Documentation Validation

- [ ] **API Docs Exist:** Check documentation

  ```bash
  ls -la docs/API_PRODUCTS_MANAGEMENT.md
  # Expected: File exists, contains all 7 endpoints
  ```

- [ ] **Implementation Guide:** Check implementation docs

  ```bash
  ls -la docs/IMPLEMENTATION_PRODUCTS.md
  # Expected: Complete with examples and extension guide
  ```

- [ ] **Database README:** Check database docs

  ```bash
  ls -la apps/api/src/db/master/migrations/README_PRODUCTS.md
  # Expected: Schema documented with queries
  ```

- [ ] **OpenAPI Spec:** Verify spec file
  ```bash
  # Check OpenAPI spec includes all 7 endpoints
  grep -c "operationId" docs/api/products-management-api-spec.yaml
  # Expected: At least 7 operations
  ```

### Middleware Validation

- [ ] **Correlation ID Middleware:** Active

  ```bash
  grep -l "correlationIdMiddleware" apps/api/src/routes/mmc/products.ts
  # Expected: Found in all routes
  ```

- [ ] **License Middleware:** Active on all endpoints

  ```bash
  grep -l "licenseMiddleware" apps/api/src/routes/mmc/products.ts
  # Expected: Found on all routes except health checks
  ```

- [ ] **Audit Read Middleware:** Active on audit log endpoint

  ```bash
  grep -l "auditReadMiddleware" apps/api/src/routes/mmc/products.ts
  # Expected: Found on audit log route
  ```

- [ ] **Rate Limiting:** Configured correctly
  ```bash
  grep -A 10 "POST /products" apps/api/src/routes/mmc/products.ts
  # Expected: 10 req/min limit in code
  ```

### Error Handling Validation

- [ ] **All 13 Error Codes Implemented:**

  ```bash
  grep -c "ErrorCodes\." packages/types/src/errors/ErrorCodes.ts | grep 13
  # Expected: All 13 codes defined
  ```

- [ ] **HTTP Status Mappings Correct:**

  ```typescript
  // In test: Verify all error codes map to correct HTTP status
  npm run test -- tests/integration/products/test_errors.ts
  # Expected: All 13 status mappings correct
  ```

- [ ] **Response Format Validated:**
  ```bash
  npm run test -- tests/response-format.test.ts
  # Expected: All responses follow {success, data, error} format
  ```

---

## Staging Environment Validation

### Health Checks

- [ ] **API Server Running:**

  ```bash
  curl -X GET https://staging-api.zidney.com/health
  # Expected: 200 OK
  ```

- [ ] **Database Connected:**

  ```bash
  curl -X GET https://staging-api.zidney.com/health/db
  # Expected: 200 OK, database responsive
  ```

- [ ] **Redis Connected:**
  ```bash
  curl -X GET https://staging-api.zidney.com/health/redis
  # Expected: 200 OK, rate limiting operational
  ```

### API Endpoint Smoke Tests

- [ ] **POST /api/v1/mmc/products**

  ```bash
  curl -X POST https://staging-api.zidney.com/api/v1/mmc/products \
    -H "Authorization: Bearer STAGING_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "name": {"en": "Test Product"},
      "slug": "test-prod-'$(date +%s)'",
      "enabled_modules": ["MCQ", "LIBRARY"]
    }'
  # Expected: 201 Created with product ID
  ```

- [ ] **GET /api/v1/mmc/products**

  ```bash
  curl -X GET "https://staging-api.zidney.com/api/v1/mmc/products?limit=5" \
    -H "Authorization: Bearer STAGING_TOKEN"
  # Expected: 200 OK with paginated list
  ```

- [ ] **PUT /api/v1/mmc/products/:id**

  ```bash
  curl -X PUT "https://staging-api.zidney.com/api/v1/mmc/products/PRODUCT_ID" \
    -H "Authorization: Bearer STAGING_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"name": {"en": "Updated Name"}}'
  # Expected: 200 OK with incremented version
  ```

- [ ] **PATCH /api/v1/mmc/products/:id/status**

  ```bash
  curl -X PATCH "https://staging-api.zidney.com/api/v1/mmc/products/PRODUCT_ID/status" \
    -H "Authorization: Bearer STAGING_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"status": "INACTIVE"}'
  # Expected: 200 OK, version unchanged
  ```

- [ ] **GET /api/v1/mmc/products/:id/audit-log**

  ```bash
  curl -X GET "https://staging-api.zidney.com/api/v1/mmc/products/PRODUCT_ID/audit-log" \
    -H "Authorization: Bearer STAGING_TOKEN"
  # Expected: 200 OK with audit trail
  ```

- [ ] **DELETE /api/v1/mmc/products/:id**
  ```bash
  curl -X DELETE "https://staging-api.zidney.com/api/v1/mmc/products/PRODUCT_ID" \
    -H "Authorization: Bearer STAGING_TOKEN"
  # Expected: 204 No Content (or 409 if licenses exist)
  ```

### Error Handling Tests

- [ ] **Test 409 DUPLICATE_SLUG:**

  ```bash
  # Create two products with same slug
  # Expected: First succeeds (201), second fails (409)
  ```

- [ ] **Test 404 PRODUCT_NOT_FOUND:**

  ```bash
  curl -X GET "https://staging-api.zidney.com/api/v1/mmc/products/00000000-0000-0000-0000-000000000000" \
    -H "Authorization: Bearer STAGING_TOKEN"
  # Expected: 404 with error code
  ```

- [ ] **Test 400 INVALID_MODULE_ENUM:**

  ```bash
  # POST with invalid module
  # Expected: 400 with error code and message listing valid modules
  ```

- [ ] **Test 401 UNAUTHORIZED:**

  ```bash
  curl -X GET "https://staging-api.zidney.com/api/v1/mmc/products" \
    -H "Authorization: Bearer INVALID_TOKEN"
  # Expected: 401 UNAUTHORIZED
  ```

- [ ] **Test 423 WORKSPACE_LOCKED:**
  ```bash
  # Create request with soft-locked workspace
  # Expected: 423 WORKSPACE_LOCKED
  ```

### Concurrency Tests (Optional in Staging)

- [ ] **Concurrent Creates with Same Slug:**

  ```bash
  # Script: Create 10 products simultaneously with same slug
  # Expected: 1 succeeds (201), 9 fail with 409
  ```

- [ ] **Concurrent Updates to Same Product:**
  ```bash
  # Script: Update same product 10 times simultaneously
  # Expected: All succeed, versions increment 1→2→3...→11
  ```

### Performance Tests

- [ ] **List Performance (100+ products):**

  ```bash
  # Create 100 products, list with pagination
  # Expected: Response within 500ms
  ```

- [ ] **Search Performance:**

  ```bash
  # Search by name across 100+ products
  # Expected: Results within 300ms
  ```

- [ ] **Audit Log Query (50+ entries):**
  ```bash
  # Query audit log with pagination
  # Expected: Response within 200ms
  ```

### Logging & Monitoring

- [ ] **Structured Logs Generated:**

  ```bash
  # Check log output in ELK/CloudWatch
  # Expected: product_created, product_updated, product_error logs with correlation_id
  ```

- [ ] **Correlation IDs Propagate:**

  ```bash
  # Make request and check response headers
  curl -i -X GET https://staging-api.zidney.com/api/v1/mmc/products \
    -H "Authorization: Bearer TOKEN"
  # Expected: x-correlation-id header in response
  ```

- [ ] **Metrics Collected:**

  ```bash
  # Check Prometheus metrics endpoint
  curl -X GET https://staging-api.zidney.com/metrics | grep product_
  # Expected: product_create_total, product_update_total, etc.
  ```

- [ ] **Rate Limit Headers Present:**
  ```bash
  curl -i -X GET https://staging-api.zidney.com/api/v1/mmc/products \
    -H "Authorization: Bearer TOKEN"
  # Expected: x-ratelimit-limit, x-ratelimit-remaining headers
  ```

---

## Production Deployment Checklist

### Pre-Production Final Review

- [ ] **Code Review Approved:** Verify PR merged
- [ ] **All Tests Passing:** Green check on CI/CD
- [ ] **Zero TypeScript Errors:** Build succeeds
- [ ] **Security Scan Passed:** No vulnerabilities detected
- [ ] **Performance Benchmarks Met:** Load tests acceptable
- [ ] **Documentation Complete:** All docs updated

### Production Deployment Steps

1. [ ] **Backup Production Database:**

   ```bash
   pg_dump zidney_prod | gzip > zidney_prod_$(date +%Y%m%d_%H%M%S).sql.gz
   # Store backup in S3/backup location
   ```

2. [ ] **Apply Database Migration:**

   ```bash
   # In production database
   psql -h prod-db.zidney.com -U postgres -d zidney_prod -f migrations/20260221_004_create_products.sql
   psql -h prod-db.zidney.com -U postgres -d zidney_prod -f migrations/20260222_005_complete_products_schema.sql
   ```

3. [ ] **Verify Schema Applied:**

   ```sql
   SELECT table_name FROM information_schema.tables
   WHERE table_name IN ('products', 'product_versions', 'product_audit_logs');
   # Expected: All 3 tables exist
   ```

4. [ ] **Deploy API Code:**

   ```bash
   # Push image to registry and trigger deployment
   docker push zidney-api:v1.0.0-stage09
   kubectl set image deployment/api api=zidney-api:v1.0.0-stage09 -n production
   ```

5. [ ] **Wait for Rollout:**

   ```bash
   kubectl rollout status deployment/api -n production --timeout=5m
   # Expected: All pods running
   ```

6. [ ] **Run Smoke Tests:**
   ```bash
   npm run test:smoke -- --env=production
   # Expected: All critical endpoints pass
   ```

### Post-Production Validation

- [ ] **Health Check Passing:**

  ```bash
  curl -X GET https://api.zidney.com/health
  # Expected: 200 OK
  ```

- [ ] **Product Creation Works:**

  ```bash
  # Create test product
  # Expected: 201 Created
  ```

- [ ] **Audit Logs Recorded:**

  ```sql
  SELECT COUNT(*) FROM product_audit_logs WHERE action = 'CREATE';
  # Expected: At least 1 (from test product)
  ```

- [ ] **No Error Spikes:**

  ```bash
  # Check production logs
  # Expected: Error rate < 0.1%, no 500 errors for products endpoints
  ```

- [ ] **Performance Acceptable:**

  ```bash
  # Check Datadog/CloudWatch metrics
  # Expected: p95 latency < 200ms, p99 < 500ms
  ```

- [ ] **Rate Limiting Working:**
  ```bash
  # Make rapid requests
  # Expected: 429 after limit exceeded
  ```

---

## Rollback Plan (If Issues)

### Quick Rollback (< 5 minutes)

1. [ ] **Revert Deployment:**

   ```bash
   kubectl rollout undo deployment/api -n production
   ```

2. [ ] **Verify Old Version Running:**

   ```bash
   kubectl get deployment api -o wide -n production
   # Expected: Previous image version
   ```

3. [ ] **Confirm No Errors:**
   ```bash
   curl -X GET https://api.zidney.com/health
   # Expected: 200 OK
   ```

### Full Rollback (If Database Issue)

1. [ ] **Restore Database from Backup:**

   ```bash
   # Stop application
   kubectl scale deployment/api --replicas=0 -n production

   # Restore
   gunzip < zidney_prod_20240115_143022.sql.gz | psql -h prod-db.zidney.com -U postgres -d zidney_prod
   ```

2. [ ] **Verify Restore:**

   ```sql
   SELECT COUNT(*) FROM products;
   # Should match pre-deployment count
   ```

3. [ ] **Start Application:**
   ```bash
   kubectl scale deployment/api --replicas=3 -n production
   ```

---

## Sign-Off

| Role          | Name | Date | Signature |
| ------------- | ---- | ---- | --------- |
| QA Lead       |      |      |           |
| DevOps        |      |      |           |
| Architect     |      |      |           |
| Product Owner |      |      |           |

---

## Related Documentation

- [Deployment Strategy](../02_DEVOPS_DEPLOYMENT/01_DEPLOYMENT_OVERVIEW.md)
- [Database Migration Policy](../01_ENGINEERING_GOVERNANCE/04_DATABASE_MIGRATION_POLICY.md)
- [API Documentation](../API_PRODUCTS_MANAGEMENT.md)
- [Implementation Guide](../IMPLEMENTATION_PRODUCTS.md)
