# Test Execution Guide

## Overview

This guide explains how to run the test suite for STAGE_TEST_01_PLATFORM_FOUNDATION.

## Prerequisites

Before running tests, ensure:

- PostgreSQL 15+ running on localhost:5433
- Redis 7+ running on localhost:6380
- Node.js >= 20 installed
- Vitest >= 1.0 installed

Verify environment:

```bash
bash scripts/verify-test-env.sh
```

## Running Tests

### Run Everything (Sequential)

```bash
bash scripts/run-all-tests.sh
```

Expected runtime: ~65 minutes (sequential) / ~35 minutes (parallel CI)

### Run by Test Area

```bash
# Area 1: Tenant Isolation (unit + integration)
npm run test:area-1

# Area 2: Provisioning (integration)
npm run test:area-2

# Area 3: License Engine (unit + integration)
npm run test:area-3

# Area 4: Migration Discipline (static)
npm run test:area-4

# Area 5: Rate Limiting (unit + integration)
npm run test:area-5

# Area 6: Observability (integration)
npm run test:area-6

# Area 7: Attempt Engine (integration)
npm run test:area-7

# Area 8: Performance (performance)
npm run test:area-8
```

### Run by Test Type

```bash
# All unit tests
npm run test:unit

# All integration tests
npm run test:integration

# All static tests
npm run test:static

# All performance tests
npm run test:performance
```

### Run with Coverage

```bash
npm run test:coverage
```

Outputs: `coverage/index.html`

### Run Single Test File

```bash
npm run test -- tests/unit/01-tenant-isolation.test.ts --reporter=verbose
```

## Test Organization

```
tests/
├── unit/                          # Unit tests (mocked dependencies)
│   ├── 01-tenant-isolation.test.ts
│   ├── 03-license-engine.test.ts
│   └── 05-rate-limiting.test.ts
├── integration/                   # Integration tests (real DB)
│   ├── 01-tenant-isolation.test.ts
│   ├── 02-provisioning.test.ts
│   ├── 03-license-engine.test.ts
│   ├── 05-rate-limiting.test.ts
│   ├── 06-observability.test.ts
│   └── 07-attempt-engine.test.ts
├── static/                        # Static analysis (no DB)
│   └── 04-migration-discipline.test.ts
├── performance/                   # Performance tests (load)
│   └── 08-performance-baseline.test.ts
└── fixtures/                      # Test data factories
    └── index.ts
```

## Debugging Failed Tests

### Increase Verbosity

```bash
npm run test -- --reporter=verbose
```

### Run Single Test with Debug

```bash
npm run test -- tests/unit/03-license-engine.test.ts --reporter=verbose --inspect
```

### Check Logs

Test logs are written to stdout. Check `/tmp/test-*.log` files after running:

```bash
bash scripts/run-all-tests.sh
cat /tmp/test-static.log    # Logs from static tests
cat /tmp/test-unit.log      # Logs from unit tests
cat /tmp/test-integration.log
cat /tmp/test-performance.log
```

## Adding New Tests

### 1. Create Test File

```bash
touch tests/integration/09-new-feature.test.ts
```

### 2. Use Pattern

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createDbManager } from "../../db-manager";
import { seedWorkspace } from "../../fixtures";

describe("Area 9: New Feature", () => {
  let masterDb: any;

  beforeEach(async () => {
    const dbManager = createDbManager();
    masterDb = await dbManager.getMasterDb();
  });

  afterEach(async () => {
    // Cleanup
  });

  it("Test description", async () => {
    // Test implementation
    expect(true).toBe(true);
  });
});
```

### 3. Run Your Tests

```bash
npm run test -- tests/integration/09-new-feature.test.ts
```

## Environment Variables

Set these to customize test execution:

```bash
# Database
export DB_HOST=localhost
export DB_PORT=5433
export DB_USER=zidney_test
export DB_PASSWORD=test_password_secure_123

# Redis
export REDIS_HOST=localhost
export REDIS_PORT=6380

# Test timeout (ms)
export TEST_TIMEOUT=30000

# Run tests
bash scripts/run-all-tests.sh
```

## CI/CD Pipeline

GitHub Actions workflow: `.github/workflows/test-stage-001.yml`

Pipeline:

1. Static Analysis (5 min) - parallel
2. Unit Tests (15 min) - parallel to integration
3. Integration Tests (30 min) - critical path
4. Performance Tests (15 min) - depends on integration

Total: ~35 minutes

## Troubleshooting

### "PostgreSQL not reachable"

```bash
# Start Docker containers
docker-compose -f docker-compose.test.yml up -d

# Initialize database
bash scripts/init-test-db.sh

# Run tests
npm run test:integration
```

### "Redis not reachable"

```bash
# Start Redis service
redis-server --port 6380

# Or use Docker
docker-compose -f docker-compose.test.yml up -d redis-test
```

### "Tests timing out"

- Increase timeout: `export TEST_TIMEOUT=60000`
- Check database is responsive: `bash scripts/verify-test-env.sh`
- Check if other tests are running

### "Flaky tests"

- Increase concurrency limits: `TEST_LOCK_TIMEOUT_MS=70000`
- Run tests sequentially: `npm run test -- --run --reporter=verbose`
- Check system resources

## Success Criteria

All tests must pass for PRODUCTION_READY promotion:

- ✅ All 31 test scenarios passing
- ✅ All 8 areas validated
- ✅ Coverage > 80%
- ✅ Performance thresholds met
- ✅ Zero architectural drift
