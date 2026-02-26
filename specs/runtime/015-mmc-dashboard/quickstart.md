# Quickstart: MMC Dashboard Implementation Guide

**Stage**: STAGE_15_MMC_DASHBOARD  
**Phase**: 02 – Platform MMC  
**Status**: Developer Guide  
**Date**: February 26, 2026

---

## Overview

This guide provides step-by-step instructions for implementing the MMC Dashboard from specification through production deployment.

The implementation is divided into 5 phases spanning 5 development days. Each phase builds progressively and can be tested independently.

---

## Phase 0: Setup & Prerequisites (Day 1, 2 hours)

### Check Prerequisites

```bash
# 1. Verify master_db schema version
psql master_db -c "SELECT schema_version FROM master_db_version LIMIT 1;"
# Should return: >= 8 (or 7+ if you'll add revenue_records in this stage)

# 2. Verify tables exist
psql master_db -c "\dt licenses products affiliates affiliate_usages revenue_records mmc_members"

# 3. Check existing indexes
psql master_db -c "SELECT indexname FROM pg_indexes WHERE tablename IN ('licenses', 'products', 'affiliates', 'affiliate_usages', 'revenue_records');"
```

### Create Branch & Directory Structure

```bash
# Branch out from main
git checkout main && git pull
git checkout -b 015-mmc-dashboard

# Create directory structure
mkdir -p apps/api/src/routes/mmc/dashboard
mkdir -p apps/api/tests/integration/mmc-dashboard
mkdir -p apps/api/tests/unit/mmc-dashboard
mkdir -p packages/domain-core/mmc-dashboard
mkdir -p apps/mmc/src/views/dashboard
mkdir -p apps/mmc/src/components/dashboard
```

### Install Dependencies (if needed)

```bash
# Redis for caching (if not already installed)
npm install redis@4.6.0

# Zod for schema validation (should already be installed)
npm list zod

# Decimal.js for precise monetary calculations
npm install decimal.js@10.4.3
npm install --save-dev @types/decimal.js
```

### Setup Local Test Database

```bash
# Reset test master_db
npm run db:test:reset

# Seed test data
node scripts/seed-dashboard-test-data.js
# Inserts:
# - 1,250 licenses (1200 active, 35 soft-locked, 15 archived)
# - 10,000 revenue records (over 12 months)
# - 87 affiliates with 5,000 usage entries
```

---

## Phase 1: Backend Implementation (Days 2-3, 16 hours)

### Step 1.1: Create Domain Package

**File**: `packages/domain-core/mmc-dashboard/index.ts`

```typescript
/**
 * Domain Core: MMC Dashboard
 *
 * Provides dashboard metric calculations:
 * - License aggregation (by status)
 * - Revenue calculations (with aggregate rounding)
 * - Geographic aggregation
 * - Affiliate performance metrics
 * - Trend analysis
 * - CSV export formatting
 */

export * from './metrics'
export * from './calculations'
export * from './validators'
export * from './csv-generator'
```

**File**: `packages/domain-core/mmc-dashboard/metrics.ts`

```typescript
import Decimal from 'decimal.js'
import { Pool } from 'pg'

export interface LicenseMetrics {
  total: number
  active: number
  soft_locked: number
  archived: number
}

export async function getLicenseMetrics(pool: Pool): Promise<LicenseMetrics> {
  const result = await pool.query(`
    SELECT
      status,
      COUNT(*) as count
    FROM licenses
    WHERE deleted_at IS NULL
    GROUP BY status
  `)

  const metrics: LicenseMetrics = {
    total: 0,
    active: 0,
    soft_locked: 0,
    archived: 0,
  }

  for (const row of result.rows) {
    metrics.total += row.count
    if (row.status === 'ACTIVE') metrics.active = row.count
    else if (row.status === 'SOFT_LOCKED') metrics.soft_locked = row.count
    else if (row.status === 'ARCHIVED') metrics.archived = row.count
  }

  return metrics
}

export async function getRevenueMetrics(pool: Pool) {
  const [thisMonth, thisYear, lastMonth] = await Promise.all([
    pool.query(`
      SELECT SUM(amount) as revenue
      FROM revenue_records
      WHERE created_at >= DATE_TRUNC('month', NOW())
        AND deleted_at IS NULL
    `),
    pool.query(`
      SELECT SUM(amount) as revenue
      FROM revenue_records
      WHERE created_at >= DATE_TRUNC('year', NOW())
        AND deleted_at IS NULL
    `),
    pool.query(`
      SELECT SUM(amount) as revenue
      FROM revenue_records
      WHERE created_at >= DATE_TRUNC('month', NOW() - INTERVAL '1 month')
        AND created_at < DATE_TRUNC('month', NOW())
        AND deleted_at IS NULL
    `),
  ])

  return {
    this_month: roundRevenue(thisMonth.rows[0]?.revenue || '0'),
    this_year: roundRevenue(thisYear.rows[0]?.revenue || '0'),
    last_month: roundRevenue(lastMonth.rows[0]?.revenue || '0'),
  }
}

export function roundRevenue(value: string | number): string {
  return new Decimal(value || 0)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    .toString()
}
```

**File**: `packages/domain-core/mmc-dashboard/csv-generator.ts`

```typescript
export async function* generateCsvStream(rows: any[], headers: string[]) {
  // Emit headers
  yield headers.join(',') + '\n'

  // Emit rows
  for (const row of rows) {
    const values = headers.map((header) => {
      const value = row[header]
      // Escape CSV values (quote if contains comma or quote)
      if (
        typeof value === 'string' &&
        (value.includes(',') || value.includes('"'))
      ) {
        return `"${value.replace(/"/g, '""')}"`
      }
      return value || ''
    })
    yield values.join(',') + '\n'
  }
}
```

### Step 1.2: Create Middleware

**File**: `apps/api/src/middleware/permission.middleware.ts`

```typescript
import { Context, MiddlewareHandler } from 'hono'
import type { Logger } from '@zidney/logger'
import type { Pool } from 'pg'

interface PermissionContext extends Context {
  user?: { id: string }
  correlation_id?: string
}

export function createPermissionMiddleware(
  masterDb: Pool,
  logger: Logger
): MiddlewareHandler {
  return async (ctx: PermissionContext, next) => {
    try {
      const user = ctx.user

      if (!user) {
        logger.warn({
          event: 'permission_check_failed',
          reason: 'no_user',
          correlation_id: ctx.correlation_id,
        })
        return ctx.json(
          {
            success: false,
            data: null,
            error: {
              code: 'UNAUTHORIZED',
              message: 'User authentication required',
            },
          },
          401
        )
      }

      // Query for reporting.view permission (with workspace_id from tenant resolver context)
      // PRODUCTION IMPLEMENTATION REQUIREMENT: Include workspace_id filtering as per plan.md §507-510
      const result = await masterDb.query(
        `SELECT role_id FROM mmc_members 
         WHERE user_id = $1 AND workspace_id = $2 AND deleted_at IS NULL LIMIT 1`,
        [user.id, workspaceId] // workspaceId from tenant resolver context
      )

      if (result.rows.length === 0) {
        logger.info({
          event: 'permission_check_failed',
          reason: 'not_mmc_member',
          user_id: user.id,
          correlation_id: ctx.correlation_id,
        })
        return ctx.json(
          {
            success: false,
            data: null,
            error: {
              code: 'PERMISSION_DENIED',
              message: 'reporting.view permission required to access dashboard',
            },
          },
          403
        )
      }

      const roleId = result.rows[0].role_id

      // Check if role has reporting.view permission
      const permResult = await masterDb.query(
        `SELECT permission_id FROM role_permissions 
         WHERE role_id = $1 
         AND permission_name = 'reporting.view'`,
        [roleId]
      )

      if (permResult.rows.length === 0) {
        logger.info({
          event: 'permission_check_failed',
          reason: 'permission_denied',
          user_id: user.id,
          role_id: roleId,
          correlation_id: ctx.correlation_id,
        })
        return ctx.json(
          {
            success: false,
            data: null,
            error: {
              code: 'PERMISSION_DENIED',
              message: 'reporting.view permission required to access dashboard',
            },
          },
          403
        )
      }

      logger.info({
        event: 'permission_check_passed',
        user_id: user.id,
        correlation_id: ctx.correlation_id,
      })

      await next()
    } catch (error) {
      logger.error({
        event: 'permission_check_error',
        error: error instanceof Error ? error.message : String(error),
        correlation_id: ctx.correlation_id,
      })
      return ctx.json(
        {
          success: false,
          data: null,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to check permissions',
          },
        },
        500
      )
    }
  }
}
```

### Step 1.3: Create Dashboard Route Handlers

**File**: `apps/api/src/routes/mmc/dashboard/routes.ts`

```typescript
import { Hono } from 'hono'
import { Context } from 'hono'
import type { Pool } from 'pg'
import type { Logger } from '@zidney/logger'
import { createPermissionMiddleware } from '@zidney/middleware/permission.middleware'
import { licenseEnforcementMiddleware } from '@zidney/middleware/license-enforcement.middleware'
import {
  getLicenseMetrics,
  getRevenueMetrics,
  SummaryResponse,
} from '@zidney/domain-core/mmc-dashboard'

export interface DashboardBindings {
  masterDb: Pool
  logger: Logger
  redisClient: any
}

const dashboardRoutes = new Hono<{ Bindings: DashboardBindings }>()

// Apply middleware chain
dashboardRoutes.use(licenseEnforcementMiddleware)
dashboardRoutes.use(createPermissionMiddleware)

/**
 * GET /api/mmc/dashboard/summary
 * Returns license counts and revenue snapshot
 */
dashboardRoutes.get(
  '/summary',
  async (ctx: Context<{ Bindings: DashboardBindings }>) => {
    try {
      const { masterDb, logger, redisClient } = ctx.env
      const correlationId = ctx.get('correlation_id')

      const cacheKey = `mmc:dashboard:summary:mmc`

      // Check cache
      const cached = await redisClient.get(cacheKey)
      if (cached) {
        logger.info({
          event: 'dashboard_cache_hit',
          endpoint: '/summary',
          correlation_id: correlationId,
        })
        ctx.header('X-Cache', 'HIT')
        return ctx.json({
          success: true,
          data: JSON.parse(cached),
          error: null,
        })
      }

      // Fetch from database
      const [licenses, revenue] = await Promise.all([
        getLicenseMetrics(masterDb),
        getRevenueMetrics(masterDb),
      ])

      const data = {
        licenses,
        revenue,
        snapshot_at: new Date().toISOString(),
      }

      // Cache for 5 minutes
      await redisClient.setex(cacheKey, 300, JSON.stringify(data))

      ctx.header('X-Cache', 'MISS')
      ctx.header('Cache-Control', 'max-age=300, public')

      logger.info({
        event: 'dashboard_query_executed',
        endpoint: '/summary',
        response_time_ms: 45, // Placeholder
        correlation_id: correlationId,
      })

      return ctx.json({
        success: true,
        data,
        error: null,
      })
    } catch (error) {
      ctx.env.logger.error({
        event: 'dashboard_error',
        endpoint: '/summary',
        error: error instanceof Error ? error.message : String(error),
        correlation_id: ctx.get('correlation_id'),
      })

      return ctx.json(
        {
          success: false,
          data: null,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to retrieve dashboard summary',
          },
        },
        500
      )
    }
  }
)

/**
 * Implement remaining endpoints (revenue-breakdown, geographic, affiliates, trends, export)
 * following the same pattern:
 * 1. Validate query params
 * 2. Check cache
 * 3. Execute query (with proper indexes)
 * 4. Format response
 * 5. Log with correlation_id
 */

export default dashboardRoutes
```

### Step 1.4: Create Database Indexes

**File**: `apps/api/src/db/master/migrations/20260226_010_create_dashboard_indexes.ts`

```typescript
import { PoolClient } from 'pg'

export const description =
  'Create indexes for MMC Dashboard performance optimization'

export async function up(client: PoolClient): Promise<void> {
  // Licenses indexes
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_licenses_status ON licenses(status);
    CREATE INDEX IF NOT EXISTS idx_licenses_deleted_at ON licenses(deleted_at);
    CREATE INDEX IF NOT EXISTS idx_licenses_workspace_slug ON licenses(workspace_slug);
  `)

  // Revenue records indexes
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_revenue_records_created_at ON revenue_records(created_at);
    CREATE INDEX IF NOT EXISTS idx_revenue_records_product_id ON revenue_records(product_id);
    CREATE INDEX IF NOT EXISTS idx_revenue_records_billing_country ON revenue_records(billing_country);
    CREATE INDEX IF NOT EXISTS idx_revenue_records_product_created 
      ON revenue_records(product_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_revenue_records_country_created 
      ON revenue_records(billing_country, created_at);
  `)

  // Affiliates and usages indexes
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_affiliates_status ON affiliates(status);
    CREATE INDEX IF NOT EXISTS idx_affiliates_mmc_member_id ON affiliates(mmc_member_id);
    CREATE INDEX IF NOT EXISTS idx_affiliate_usages_affiliate_id ON affiliate_usages(affiliate_id);
    CREATE INDEX IF NOT EXISTS idx_affiliate_usages_created_at ON affiliate_usages(created_at);
    CREATE INDEX IF NOT EXISTS idx_affiliate_usages_affiliate_created 
      ON affiliate_usages(affiliate_id, created_at);
  `)

  await client.query(`INSERT INTO _schema_migrations (migration_name, executed_at)
    VALUES ('20260226_010_create_dashboard_indexes', NOW())`)
}

export async function down(client: PoolClient): Promise<void> {
  // Rollback: Drop all indexes (note: this is dangerous in production)
  await client.query(`
    DROP INDEX IF EXISTS idx_licenses_status;
    DROP INDEX IF EXISTS idx_licenses_deleted_at;
    DROP INDEX IF EXISTS idx_licenses_workspace_slug;
    DROP INDEX IF EXISTS idx_revenue_records_created_at;
    DROP INDEX IF EXISTS idx_revenue_records_product_id;
    DROP INDEX IF EXISTS idx_revenue_records_billing_country;
    DROP INDEX IF EXISTS idx_revenue_records_product_created;
    DROP INDEX IF EXISTS idx_revenue_records_country_created;
    DROP INDEX IF EXISTS idx_affiliates_status;
    DROP INDEX IF EXISTS idx_affiliates_mmc_member_id;
    DROP INDEX IF EXISTS idx_affiliate_usages_affiliate_id;
    DROP INDEX IF EXISTS idx_affiliate_usages_created_at;
    DROP INDEX IF EXISTS idx_affiliate_usages_affiliate_created;
  `)
}
```

### Step 1.5: Implement All 6 Endpoints

Repeat the pattern from Step 1.3 for:

- `GET /api/mmc/dashboard/revenue-breakdown`
- `GET /api/mmc/dashboard/geographic`
- `GET /api/mmc/dashboard/affiliates`
- `GET /api/mmc/dashboard/trends`
- `POST /api/mmc/dashboard/export`

Each should:

1. Validate query parameters
2. Check Redis cache (if applicable)
3. Execute optimized SQL query
4. Format response (with aggregate rounding for monetary values)
5. Log structured event with correlation_id
6. Return standardized response object

**Reference templates in data-model.md (Part 4) for SQL queries**

---

## Phase 2: Backend Testing (Days 3-4, 12 hours)

### Step 2.1: Unit Tests

**File**: `apps/api/tests/unit/mmc-dashboard/metrics.test.ts`

```typescript
import { describe, it, expect } from 'vitest'
import {
  roundRevenue,
  getLicenseMetrics,
  calculateGrowthPercent,
} from '@zidney/domain-core/mmc-dashboard'

describe('Dashboard Metrics', () => {
  describe('Revenue Rounding', () => {
    it('should round revenue to 2 decimals using round-half-up', () => {
      expect(roundRevenue('100.445')).toBe('100.45')
      expect(roundRevenue('100.005')).toBe('100.01')
      expect(roundRevenue('100.004')).toBe('100.00')
      expect(roundRevenue('95000.4567')).toBe('95000.46')
    })
  })

  describe('Growth Calculation', () => {
    it('should calculate growth percentage correctly', () => {
      const growth = calculateGrowthPercent('230000.00', '220000.00')
      expect(growth).toBe('4.55')
    })

    it('should handle zero previous value', () => {
      const growth = calculateGrowthPercent('100.00', '0.00')
      expect(growth).toBe('0.00') // Avoid divide by zero
    })
  })
})
```

### Step 2.2: Integration Tests

**File**: `apps/api/tests/integration/mmc-dashboard/endpoints.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import app from '@zidney/api'
import { masterDb, testData } from '@zidney/tests/fixtures'

describe('Dashboard Endpoints', () => {
  beforeAll(async () => {
    // Seed test data
    await testData.seedLicenses(masterDb, 1250)
    await testData.seedRevenueRecords(masterDb, 10000)
  })

  afterAll(async () => {
    // Cleanup
    await masterDb.query('DELETE FROM revenue_records WHERE 1=1')
    await masterDb.query('DELETE FROM licenses WHERE 1=1')
  })

  describe('GET /api/mmc/dashboard/summary', () => {
    it('should return 200 with license counts and revenue', async () => {
      const response = await request(app)
        .get('/api/mmc/dashboard/summary')
        .set('Authorization', `Bearer ${testData.adminToken}`)

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.licenses).toBeDefined()
      expect(response.body.data.revenue).toBeDefined()
    })

    it('should return 403 if permission missing', async () => {
      const response = await request(app)
        .get('/api/mmc/dashboard/summary')
        .set('Authorization', `Bearer ${testData.limitedUserToken}`)

      expect(response.status).toBe(403)
      expect(response.body.error.code).toBe('PERMISSION_DENIED')
    })

    it('should respond in under 300ms', async () => {
      const start = Date.now()
      await request(app)
        .get('/api/mmc/dashboard/summary')
        .set('Authorization', `Bearer ${testData.adminToken}`)
      const elapsed = Date.now() - start

      expect(elapsed).toBeLessThan(300)
    })
  })

  // Repeat for all 6 endpoints
})
```

### Step 2.3: Performance Tests

**File**: `apps/api/tests/performance/mmc-dashboard/concurrent.test.ts`

```typescript
import { describe, it, expect } from 'vitest'
import request from 'supertest'
import app from '@zidney/api'

describe('Dashboard Concurrent Load', () => {
  it('should handle 100 concurrent requests within 300ms', async () => {
    const requests = Array.from({ length: 100 }, (_, i) =>
      request(app)
        .get('/api/mmc/dashboard/summary')
        .set('Authorization', `Bearer ${generateTestToken(i)}`)
    )

    const start = Date.now()
    const results = await Promise.all(requests)
    const duration = Date.now() - start

    const successful = results.filter((r) => r.status === 200).length
    const maxLatency = Math.max(
      ...results.map((r) => parseInt(r.headers['x-response-time']))
    )

    expect(successful).toBe(100)
    expect(maxLatency).toBeLessThan(300)
    expect(duration).toBeLessThan(1000) // All 100 complete within 1 second
  })
})
```

### Step 2.4: Run All Tests

```bash
# Unit tests
npm run test:unit -- tests/unit/mmc-dashboard

# Integration tests
npm run test:integration -- tests/integration/mmc-dashboard

# Performance tests
npm run test:performance -- tests/performance/mmc-dashboard/concurrent

# Check types
npm run type-check

# Check lint
npm run lint
```

---

## Phase 3: Frontend Implementation (Day 4, 8 hours)

### Step 3.1: Create Dashboard Component Structure

**File**: `apps/mmc/src/views/Dashboard.vue`

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import CommercialHealth from '@/components/dashboard/CommercialHealth.vue'
import GeographicDistribution from '@/components/dashboard/GeographicDistribution.vue'
import AffiliateLeaderboard from '@/components/dashboard/AffiliateLeaderboard.vue'
import GrowthTrends from '@/components/dashboard/GrowthTrends.vue'

const loading = ref(true)
const error = ref<string | null>(null)

// Fetch summary data
const { data: summary } = useQuery({
  queryKey: ['dashboard-summary'],
  queryFn: () => dashboardApi.getSummary(),
})

onMounted(async () => {
  try {
    // Load all dashboard sections
    await Promise.all([
      summary,
      // ... other queries
    ])
    loading.value = false
  } catch (err) {
    error.value =
      err instanceof Error ? err.message : 'Failed to load dashboard'
    loading.value = false
  }
})
</script>

<template>
  <div class="dashboard-container">
    <h1>MMC Dashboard</h1>

    <div v-if="loading" class="loading-state">
      <p>Loading dashboard...</p>
    </div>

    <div v-else-if="error" class="error-state">
      <Alert variant="destructive">
        <p>{{ error }}</p>
        <Button @click="() => location.reload()">Retry</Button>
      </Alert>
    </div>

    <div v-else class="dashboard-grid">
      <CommercialHealth :data="summary?.data" />
      <GeographicDistribution />
      <AffiliateLeaderboard />
      <GrowthTrends />
    </div>
  </div>
</template>

<style scoped>
.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 2rem;
}
</style>
```

### Step 3.2: Create Sub-Components

**File**: `apps/mmc/src/components/dashboard/CommercialHealth.vue`

```vue
<script setup lang="ts">
import { computed } from 'vue'
import type { SummaryData } from '@zidney/dashboard-contracts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface Props {
  data?: SummaryData
}

defineProps<Props>()

const formattedData = computed(() => {
  if (!props.data) return null

  return {
    ...props.data,
    revenue: {
      this_month: `$${parseFloat(props.data.revenue.this_month).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      this_year: `$${parseFloat(props.data.revenue.this_year).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      last_month: `$${parseFloat(props.data.revenue.last_month).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
    },
  }
})
</script>

<template>
  <Card v-if="formattedData" class="commercial-health">
    <CardHeader>
      <CardTitle>Commercial Health</CardTitle>
    </CardHeader>
    <CardContent>
      <div class="metrics-grid">
        <div class="metric">
          <p class="label">ACTIVE Licenses</p>
          <p class="value">{{ formattedData.licenses.active }}</p>
        </div>
        <div class="metric">
          <p class="label">SOFT_LOCKED Licenses</p>
          <p class="value">{{ formattedData.licenses.soft_locked }}</p>
        </div>
        <div class="metric">
          <p class="label">This Month Revenue</p>
          <p class="value">{{ formattedData.revenue.this_month }}</p>
        </div>
        <div class="metric">
          <p class="label">YTD Revenue</p>
          <p class="value">{{ formattedData.revenue.this_year }}</p>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
```

### Step 3.3: Integrate API Client

**File**: `apps/mmc/src/services/dashboard-api.ts`

```typescript
import type {
  SummaryResponse,
  RevenueBreakdownResponse,
  GeographicResponse,
  AffiliatesResponse,
  TrendsResponse,
} from '@zidney/dashboard-contracts'

const BASE_URL = '/api/mmc/dashboard'

export const dashboardApi = {
  async getSummary(): Promise<SummaryResponse> {
    const response = await fetch(`${BASE_URL}/summary`, {
      headers: {
        Authorization: `Bearer ${getAuthToken()}`,
        'Content-Type': 'application/json',
      },
    })

    const data: SummaryResponse = await response.json()

    if (!response.ok) {
      throw new Error(
        data.error?.message || 'Failed to fetch dashboard summary'
      )
    }

    return data
  },

  async getRevenueBreakdown(
    dateFrom?: string,
    dateTo?: string
  ): Promise<RevenueBreakdownResponse> {
    const params = new URLSearchParams()
    if (dateFrom) params.append('date_from', dateFrom)
    if (dateTo) params.append('date_to', dateTo)

    const response = await fetch(`${BASE_URL}/revenue-breakdown?${params}`, {
      headers: {
        Authorization: `Bearer ${getAuthToken()}`,
        'Content-Type': 'application/json',
      },
    })

    const data: RevenueBreakdownResponse = await response.json()

    if (!response.ok) {
      throw new Error(
        data.error?.message || 'Failed to fetch revenue breakdown'
      )
    }

    return data
  },

  // Implement remaining methods (geographic, affiliates, trends, export)
}

function getAuthToken(): string {
  // Retrieve from localStorage or auth context
  return localStorage.getItem('auth_token') || ''
}
```

---

## Phase 4: Integration Testing & Optimization (Day 5, 10 hours)

### Step 4.1: Verify Indexes

```bash
# Check all dashboard indexes exist
psql master_db << EOF
SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename IN ('licenses', 'revenue_records', 'affiliates', 'affiliate_usages', 'products')
ORDER BY tablename, indexname;
EOF

# Run EXPLAIN ANALYZE on each query pattern
psql master_db << EOF
EXPLAIN ANALYZE
SELECT status, COUNT(*) FROM licenses WHERE deleted_at IS NULL GROUP BY status;

EXPLAIN ANALYZE
SELECT p.id, SUM(r.amount) FROM products p
LEFT JOIN revenue_records r ON p.id = r.product_id
WHERE r.created_at >= '2025-02-26' AND r.created_at <= '2026-02-26'
GROUP BY p.id;

-- ... repeat for other query patterns
EOF
```

### Step 4.2: Run Concurrency Test

```bash
# Load test with 100 concurrent users
npm run test:performance -- tests/performance/mmc-dashboard/concurrent.test.ts

# Expected output:
# ✓ should handle 100 concurrent requests within 300ms
# - All requests complete successfully
# - Max latency < 300ms
# - Average latency < 150ms
```

### Step 4.3: Validate Isolation

```bash
# Run isolation tests
npm run test:integration -- tests/integration/mmc-dashboard/isolation.test.ts

# Expected output:
# ✓ should NOT query any tenant database
# ✓ should NOT perform cross-tenant joins
# ✓ metrics scoped to master_db only
```

### Step 4.4: Check Audit Logging

```bash
# Run dashboard access, then check logs
npm run test:integration -- tests/integration/mmc-dashboard/logging.test.ts

# Verify in logs:
# - correlation_id present
# - user_id logged
# - workspace_id logged
# - response_time_ms logged
# - endpoint name logged
```

### Step 4.5: Performance Regression Baseline

```bash
# Record baseline performance metrics
npm run benchmark -- apps/api/tests/performance/mmc-dashboard/metrics.json

# Store in git-tracked file for CI/CD to compare
git add apps/api/tests/performance/mmc-dashboard/metrics.json
```

---

## Phase 5: Deployment (Day 6, 4 hours)

### Step 5.1: Merge & CI/CD

```bash
# Commit all changes
git add -A
git commit -m "feat: implement MMC Dashboard (STAGE_15)

- 6 analytics endpoints (summary, revenue-breakdown, geographic, affiliates, trends, export)
- Master database only; zero tenant DB access
- Tiered Redis caching (5-min summary, 1-min affiliates, 10-min trends)
- 100+ concurrent users support; <300ms latency guarantee
- Complete test coverage (unit, integration, performance, isolation)
- Comprehensive audit logging
- Data contracts with Zod validation"

# Push to repository
git push origin 015-mmc-dashboard

# Create Pull Request
# - Link to spec: specs/runtime/015-mmc-dashboard/spec.md
# - Link to plan: specs/runtime/015-mmc-dashboard/plan.md
# - CI/CD pipeline runs:
#   - Type check (TypeScript strict mode)
#   - Lint (ESLint, Prettier)
#   - Unit tests (>90% coverage)
#   - Integration tests (all endpoints)
#   - Performance tests (<300ms)
#   - Security scan (no secrets, no PII)
```

### Step 5.2: Staging Deployment

```bash
# Deploy to staging environment
./scripts/deploy-staging.sh 015-mmc-dashboard

# Post-deployment verification
curl -H "Authorization: Bearer $TEST_TOKEN" \
  https://staging-mmc.zidney.com/api/mmc/dashboard/summary

# Expected response: 200 OK with license/revenue data

# Run E2E tests on staging
npm run test:e2e -- --url https://staging-mmc.zidney.com
```

### Step 5.3: Production Deployment

```bash
# After staging verification, merge to main and deploy
git checkout main
git merge 015-mmc-dashboard

# Deploy to production
./scripts/deploy-production.sh main

# Verify endpoints
curl -H "Authorization: Bearer $PROD_TOKEN_ADMIN" \
  https://mmc.zidney.com/api/mmc/dashboard/summary

# Monitor dashboards
# - Check response times (should be <150ms average, <300ms p99)
# - Check error rate (should be <0.1%)
# - Check cache hit rate (should be >70%)
```

---

## Local Testing Setup

### Create Test Data Seed Script

**File**: `scripts/seed-dashboard-test-data.js`

```javascript
const { Pool } = require('pg')

const pool = new Pool({
  connectionString:
    process.env.TEST_MASTER_DB_URL ||
    'postgresql://postgres:password@localhost:5432/master_db_test',
})

async function seed() {
  const client = await pool.connect()

  try {
    // Insert 1,250 licenses
    const licenseIds = []
    for (let i = 0; i < 1250; i++) {
      const status = i < 1200 ? 'ACTIVE' : i < 1235 ? 'SOFT_LOCKED' : 'ARCHIVED'
      const result = await client.query(
        `INSERT INTO licenses (product_id, workspace_slug, status, created_at)
         VALUES ($1, $2, $3, NOW() - INTERVAL '${Math.random() * 365} days')
         RETURNING id`,
        ['prod-uuid', `workspace-${i}`, status]
      )
      licenseIds.push(result.rows[0].id)
    }

    // Insert 10,000 revenue records
    for (let i = 0; i < 10000; i++) {
      const amount = (Math.random() * 1000 + 100).toFixed(4)
      const daysAgo = Math.floor(Math.random() * 365)
      await client.query(
        `INSERT INTO revenue_records 
         (license_id, product_id, amount, billing_country, created_at)
         VALUES ($1, $2, $3, $4, NOW() - INTERVAL '${daysAgo} days')`,
        [
          licenseIds[i % 1250],
          'prod-uuid',
          amount,
          ['US', 'GB', 'CA', 'DE', 'FR'][i % 5],
        ]
      )
    }

    console.log('✓ Seeded 1,250 licenses and 10,000 revenue records')
  } finally {
    client.release()
    pool.end()
  }
}

seed().catch(console.error)
```

### Environment Variables

**File**: `.env.test`

```
TEST_MASTER_DB_URL=postgresql://postgres:password@localhost:5432/master_db_test
REDIS_URL=redis://localhost:6379/1
NODE_ENV=test
LOG_LEVEL=debug
```

### Run Local Server

```bash
# Start Redis
redis-server --port 6379 &

# Start API server in test mode
npm run dev:api -- --env test

# In another terminal, run tests
npm run test:integration -- tests/integration/mmc-dashboard
```

---

## Troubleshooting

### Issue: Queries Slower Than 300ms

**Solution**:

1. Check index usage: `EXPLAIN ANALYZE` on slow query
2. Verify indexes exist: `\di` in psql
3. Analyze table: `ANALYZE licenses; ANALYZE revenue_records;`
4. Check query planner stats: `EXPLAIN FORMAT=JSON`
5. Consider materialized view for complex aggregations

### Issue: "PERMISSION_DENIED" Error

**Solution**:

1. Verify user has `reporting.view` permission in `role_permissions` table
2. Check `mmc_members` table has entry for user
3. Verify JWT token is valid (not expired)

### Issue: Cache Not Working

**Solution**:

1. Check Redis is running: `redis-cli ping` (should return PONG)
2. Verify Redis client initialized: `npm run test:integration -- --grep "cache"`
3. Check cache key format: Check logs for `dashboard_cache_hit/miss` events

---

## Monitoring & Observability

### Key Metrics to Monitor

```typescript
// In Datadog/Prometheus dashboard:
- mmc_dashboard_request_duration_ms (p50, p95, p99)
- mmc_dashboard_cache_hit_rate (target: >70%)
- mmc_dashboard_error_rate (target: <0.1%)
- mmc_dashboard_query_duration_ms (by query type)
- mmc_dashboard_concurrent_users (active sessions)
```

### Alert Rules

```yaml
- name: dashboard_latency_high
  condition: p99_response_time > 300ms
  action: notify_on_call

- name: dashboard_cache_hit_rate_low
  condition: cache_hit_rate < 50%
  action: notify_platform_team

- name: dashboard_error_rate_high
  condition: error_rate > 0.5%
  action: page_on_call
```

---

## Checklist Before Production

- [ ] All 6 endpoints implemented
- [ ] All unit tests passing (>90% coverage)
- [ ] All integration tests passing
- [ ] Performance tests passing (<300ms)
- [ ] Isolation tests passing (no tenant DB access)
- [ ] Audit logging verified (correlation_id, user_id, workspace_id)
- [ ] Index creation migration written
- [ ] Redis caching implemented
- [ ] Frontend components created and tested
- [ ] Type checking passes (TypeScript strict mode)
- [ ] Linting passes (ESLint, Prettier)
- [ ] Security review completed (no PII/secrets in logs)
- [ ] Documentation complete (plan.md, data-model.md, api-responses.md)
- [ ] PR reviewed and approved
- [ ] Staging deployment successful
- [ ] Production deployment ready

---

END OF QUICKSTART.MD
