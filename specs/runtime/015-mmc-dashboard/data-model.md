# Data Model: MMC Dashboard Master Database Schema

**Stage**: STAGE_15_MMC_DASHBOARD  
**Phase**: 02 – Platform MMC  
**Status**: Schema Definition  
**Date**: February 26, 2026

---

## Overview

The MMC Dashboard queries **master_db only**. This document specifies the complete schema requirements for all tables, indexes, and query patterns needed to support dashboard analytics operations.

All dashboard data derives from pre-existing master_db tables (products, licenses, affiliates, affiliate_usages, revenue_records) plus optional summary tables for performance optimization.

---

## Part 1: Core Tables (Already Exist or Required)

### Table 1: `licenses`

**Purpose**: Master license registry; single source of truth for workspace license state  
**Status**: Already exists (STAGE_01, migrated)  
**Schema**:

```sql
CREATE TABLE licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  workspace_slug VARCHAR(100) NOT NULL UNIQUE,
  workspace_id UUID NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'SOFT_LOCKED', 'ARCHIVED')),
  student_limit INTEGER,
  staff_limit INTEGER,
  soft_lock_until TIMESTAMP WITH TIME ZONE,
  archived_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,

  CONSTRAINT license_status_valid CHECK (
    CASE
      WHEN status = 'ARCHIVED' THEN archived_at IS NOT NULL
      WHEN status = 'SOFT_LOCKED' THEN soft_lock_until IS NOT NULL
      ELSE TRUE
    END
  )
);
```

**Indexes Required** (Dashboard Queries):

```sql
-- For license status aggregation
CREATE INDEX idx_licenses_status ON licenses(status);

-- For filtering deleted licenses
CREATE INDEX idx_licenses_deleted_at ON licenses(deleted_at);

-- For workspace lookup during license validation
CREATE INDEX idx_licenses_workspace_slug ON licenses(workspace_slug);
```

**Dashboard Queries Using This Table**:

```sql
-- Query 1: License Status Counts (for /summary endpoint)
SELECT
  status,
  COUNT(*) as count
FROM licenses
WHERE deleted_at IS NULL
GROUP BY status;

-- Result Example:
-- status        | count
-- ------------+-------
-- ACTIVE        | 1200
-- SOFT_LOCKED   |   35
-- ARCHIVED      |   15
```

---

### Table 2: `products`

**Purpose**: Product catalog (e.g., 'Zidney Pro', 'Zidney Enterprise')  
**Status**: Already exists (STAGE_09)  
**Schema**:

```sql
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name JSONB NOT NULL,  -- {"en": "Product Name", "ar": "اسم المنتج"}
  slug VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  version VARCHAR(20) NOT NULL DEFAULT '1.0.0',
  enabled_modules JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  CONSTRAINT product_version_format CHECK (version ~ '^[0-9]+\.[0-9]+\.[0-9]+')
);
```

**Indexes Required** (Dashboard Queries):

```sql
-- For product lookup by revenue aggregation
CREATE INDEX idx_products_id ON products(id);

-- For product name lookup
CREATE INDEX idx_products_slug ON products(slug);
```

**Dashboard Queries Using This Table**:

```sql
-- Query 2: Revenue by Product (for /revenue-breakdown endpoint)
SELECT
  p.id,
  p.name->>'en' as product_name,
  SUM(r.amount) as total_revenue,
  COUNT(DISTINCT r.license_id) as license_count
FROM products p
LEFT JOIN revenue_records r ON p.id = r.product_id
WHERE r.created_at >= DATE_TRUNC('month', NOW())
GROUP BY p.id, p.name
ORDER BY total_revenue DESC
LIMIT 5;

-- Result Example:
-- id          | product_name  | total_revenue | license_count
-- ----------+---------------+--------------+--------------
-- uuid-pro   | Zidney Pro    | 82000.50     | 450
-- uuid-ent   | Zidney Enterprise | 65000.00 | 120
```

---

### Table 3: `revenue_records`

**Purpose**: Financial transaction audit trail; every payment/charge recorded  
**Status**: May need migration; create if missing  
**Schema**:

```sql
CREATE TABLE revenue_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id UUID NOT NULL REFERENCES licenses(id) ON DELETE RESTRICT,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  amount NUMERIC(12, 4) NOT NULL,  -- Full precision; no rounding in DB
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  billing_country VARCHAR(2),  -- ISO 3166-1 alpha-2 code (e.g., 'US', 'GB')
  affiliate_id UUID REFERENCES affiliates(id) ON DELETE SET NULL,
  affiliate_commission NUMERIC(12, 4),
  transaction_type VARCHAR(50) NOT NULL
    CHECK (transaction_type IN ('SUBSCRIPTION', 'ONE_TIME', 'REFUND', 'ADJUSTMENT')),
  payment_method VARCHAR(50),  -- e.g., 'STRIPE', 'PAYPAL', 'BANK_TRANSFER'
  external_transaction_id VARCHAR(255) UNIQUE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,

  CONSTRAINT amount_positive CHECK (amount >= 0),
  CONSTRAINT commission_positive CHECK (affiliate_commission IS NULL OR affiliate_commission >= 0)
);
```

**Indexes Required** (Dashboard Queries):

```sql
-- For time-range queries (most common)
CREATE INDEX idx_revenue_records_created_at ON revenue_records(created_at);

-- For product-based aggregation
CREATE INDEX idx_revenue_records_product_id ON revenue_records(product_id);

-- For geographic aggregation
CREATE INDEX idx_revenue_records_billing_country ON revenue_records(billing_country);

-- Composite indexes (PostgreSQL 11+)
-- For efficient range queries by date + product
CREATE INDEX idx_revenue_records_product_created
  ON revenue_records(product_id, created_at);

-- For efficient range queries by country + date
CREATE INDEX idx_revenue_records_country_created
  ON revenue_records(billing_country, created_at);
```

**Dashboard Queries Using This Table**:

```sql
-- Query 3: Revenue This Month (for /summary endpoint)
SELECT
  SUM(amount) as revenue_this_month
FROM revenue_records
WHERE created_at >= DATE_TRUNC('month', NOW())
  AND deleted_at IS NULL;

-- Query 4: Revenue This Year (for /summary endpoint)
SELECT
  SUM(amount) as revenue_this_year
FROM revenue_records
WHERE created_at >= DATE_TRUNC('year', NOW())
  AND deleted_at IS NULL;

-- Query 5: Geographic Aggregation (for /geographic endpoint)
SELECT
  r.billing_country,
  SUM(r.amount) as revenue,
  COUNT(DISTINCT r.license_id) as license_count
FROM revenue_records r
WHERE r.created_at >= $1 AND r.created_at <= $2
  AND r.deleted_at IS NULL
GROUP BY r.billing_country
ORDER BY revenue DESC
LIMIT 50;

-- Query 6: Revenue Export (for /export endpoint)
SELECT
  r.billing_country,
  r.created_at,
  r.product_id,
  r.amount,
  r.transaction_type
FROM revenue_records r
WHERE r.created_at >= $1 AND r.created_at <= $2
  AND r.deleted_at IS NULL
ORDER BY r.created_at DESC, r.billing_country DESC
LIMIT 50000;
```

---

### Table 4: `affiliates`

**Purpose**: Affiliate program partner accounts  
**Status**: Already exists (STAGE_13)  
**Schema**:

```sql
CREATE TABLE affiliates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mmc_member_id UUID NOT NULL REFERENCES mmc_members(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED')),
  commission_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.10,  -- 10% commission
  promo_code VARCHAR(50) IMMUTABLE UNIQUE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,

  CONSTRAINT commission_rate_valid CHECK (commission_rate >= 0 AND commission_rate <= 1)
);
```

**Indexes Required** (Dashboard Queries):

```sql
-- For status filtering
CREATE INDEX idx_affiliates_status ON affiliates(status);

-- For membership lookup (if needed for filtering)
CREATE INDEX idx_affiliates_mmc_member_id ON affiliates(mmc_member_id);
```

**Dashboard Queries Using This Table**:

```sql
-- Query 7: Affiliate Leaderboard (for /affiliates endpoint)
SELECT
  a.id,
  a.name,
  a.status,
  SUM(au.commission_amount) as total_commission,
  COUNT(au.id) as usage_count,
  MAX(au.created_at) as last_activity
FROM affiliates a
LEFT JOIN affiliate_usages au ON a.id = au.affiliate_id
WHERE au.created_at >= $1 AND au.created_at <= $2
  AND a.status = $3
  AND a.deleted_at IS NULL
GROUP BY a.id, a.name, a.status
ORDER BY total_commission DESC
LIMIT 50 OFFSET $4;
```

---

### Table 5: `affiliate_usages`

**Purpose**: Immutable audit trail of affiliate code usage (append-only)  
**Status**: Already exists (STAGE_13)  
**Schema**:

```sql
CREATE TABLE affiliate_usages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  license_id UUID REFERENCES licenses(id) ON DELETE SET NULL,
  commission_amount NUMERIC(12, 4) NOT NULL,  -- Calculated at usage time; immutable
  source VARCHAR(50) NOT NULL DEFAULT 'PROMO_CODE'
    CHECK (source IN ('PROMO_CODE', 'REFERRAL_LINK', 'PARTNER_PORTAL')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  CONSTRAINT commission_positive CHECK (commission_amount >= 0)
);

-- Make table immutable (no UPDATE/DELETE allowed)
CREATE TRIGGER prevent_affiliate_usage_modification
BEFORE UPDATE OR DELETE ON affiliate_usages
FOR EACH ROW
EXECUTE FUNCTION raise_immutable_error();
```

**Indexes Required** (Dashboard Queries):

```sql
-- For joining with affiliates
CREATE INDEX idx_affiliate_usages_affiliate_id ON affiliate_usages(affiliate_id);

-- For time-range queries
CREATE INDEX idx_affiliate_usages_created_at ON affiliate_usages(created_at);

-- Composite index (PostgreSQL 11+) for efficient joins + time filtering
CREATE INDEX idx_affiliate_usages_affiliate_created
  ON affiliate_usages(affiliate_id, created_at);
```

**Dashboard Queries Using This Table**:

```sql
-- Query 8: Total Affiliate Commission (for /affiliates endpoint)
SELECT
  SUM(au.commission_amount) as total_commission_all_time,
  COUNT(au.id) as total_usages_all_time
FROM affiliate_usages au;

-- Query 9: Recent Affiliate Commission (for /affiliates endpoint)
SELECT
  SUM(au.commission_amount) as total_commission_period,
  COUNT(au.id) as usage_count_period
FROM affiliate_usages au
WHERE au.created_at >= $1 AND au.created_at <= $2;
```

---

### Table 6: `mmc_members`

**Purpose**: Platform staff/admin accounts  
**Status**: Already exists (STAGE_14)  
**Schema**:

```sql
CREATE TABLE mmc_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,  -- References MMC workspace
  user_id UUID NOT NULL,  -- References user account
  role_id UUID NOT NULL REFERENCES roles(id),
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE', 'SUSPENDED', 'INACTIVE')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,

  UNIQUE(user_id)  -- One membership per user
);
```

**No Direct Dashboard Queries**: Used indirectly for permission validation (middleware)

---

## Part 2: Summary Tables (Optional Performance Optimization)

These tables are **optional** and should be created only if performance testing shows need for precomputation.

### Table 7: `revenue_summary_monthly` (Optional Materialized View)

**Purpose**: Pre-aggregated monthly revenue for dashboard trends  
**Status**: Create if needed (after performance baseline)  
**Schema**:

```sql
CREATE MATERIALIZED VIEW revenue_summary_monthly AS
SELECT
  DATE_TRUNC('month', created_at AT TIME ZONE 'UTC')::date as month,
  product_id,
  billing_country,
  SUM(amount) as total_revenue,
  COUNT(DISTINCT license_id) as license_count,
  COUNT(*) as transaction_count
FROM revenue_records
WHERE deleted_at IS NULL
GROUP BY DATE_TRUNC('month', created_at AT TIME ZONE 'UTC'), product_id, billing_country;

CREATE INDEX idx_revenue_summary_monthly_month
  ON revenue_summary_monthly(month);

CREATE INDEX idx_revenue_summary_monthly_country
  ON revenue_summary_monthly(billing_country);
```

**Refresh Strategy**:

```sql
-- Refresh nightly at 02:00 UTC (non-blocking)
REFRESH MATERIALIZED VIEW CONCURRENTLY revenue_summary_monthly;

-- Scheduled in worker: apps/worker/src/jobs/refresh-materialized-views.ts
```

**Dashboard Query Using This Table**:

```sql
-- Query 10: Trends (for /trends endpoint)
SELECT
  month,
  SUM(license_count) as total_licenses,
  SUM(total_revenue) as total_revenue
FROM revenue_summary_monthly
WHERE month >= NOW() - INTERVAL '12 months'
GROUP BY month
ORDER BY month ASC;
```

---

### Table 8: `affiliate_summary_monthly` (Optional, Future)

**Purpose**: Pre-aggregated monthly affiliate performance  
**Status**: Future enhancement; not required for MVP  
**Schema** (Example):

```sql
CREATE MATERIALIZED VIEW affiliate_summary_monthly AS
SELECT
  DATE_TRUNC('month', created_at AT TIME ZONE 'UTC')::date as month,
  affiliate_id,
  COUNT(*) as usage_count,
  SUM(commission_amount) as commission_generated
FROM affiliate_usages
GROUP BY DATE_TRUNC('month', created_at AT TIME ZONE 'UTC'), affiliate_id;

CREATE INDEX idx_affiliate_summary_monthly_month
  ON affiliate_summary_monthly(month);

CREATE INDEX idx_affiliate_summary_monthly_affiliate
  ON affiliate_summary_monthly(affiliate_id);
```

---

## Part 3: Query Templates by Endpoint

### Endpoint 1: `/summary` – License Counts & Revenue

**SQL Template**:

```sql
-- Get license counts by status
SELECT
  COALESCE(status, 'ACTIVE') as status,
  COUNT(*) as count
FROM licenses
WHERE deleted_at IS NULL
GROUP BY status;

-- Get revenue this month
SELECT SUM(amount) as revenue
FROM revenue_records
WHERE created_at >= DATE_TRUNC('month', NOW())
  AND deleted_at IS NULL;

-- Get revenue this year
SELECT SUM(amount) as revenue
FROM revenue_records
WHERE created_at >= DATE_TRUNC('year', NOW())
  AND deleted_at IS NULL;

-- Get revenue last month
SELECT SUM(amount) as revenue
FROM revenue_records
WHERE created_at >= DATE_TRUNC('month', NOW() - INTERVAL '1 month')
  AND created_at < DATE_TRUNC('month', NOW())
  AND deleted_at IS NULL;
```

**Execution Time**: <50ms (indexed, aggregation on small result set)  
**Cache TTL**: 5 minutes

---

### Endpoint 2: `/revenue-breakdown` – Top 5 Products

**SQL Template**:

```sql
SELECT
  p.id,
  p.name->>'en' as product_name,
  COUNT(DISTINCT r.license_id) as license_count,
  SUM(r.amount) as total_revenue,

  -- Compare to previous period
  SUM(CASE
    WHEN r.created_at < $1 THEN r.amount
    ELSE 0
  END) as previous_period_revenue
FROM products p
LEFT JOIN revenue_records r ON p.id = r.product_id
WHERE (r.created_at IS NULL OR (r.created_at >= $1 AND r.created_at <= $2))
  AND (r.deleted_at IS NULL OR r.deleted_at IS NULL)
GROUP BY p.id, p.name
ORDER BY total_revenue DESC
LIMIT 5;
```

**Parameters**:

- `$1`: date_from (e.g., '2025-02-26')
- `$2`: date_to (e.g., '2026-02-26')

**Execution Time**: <200ms  
**Cache TTL**: 0 (no cache; date-range variability)

---

### Endpoint 3: `/geographic` – Revenue by Country

**SQL Template**:

```sql
SELECT
  r.billing_country,
  COUNT(DISTINCT r.license_id) as license_count,
  SUM(r.amount) as revenue,
  SUM(r.amount) / COUNT(DISTINCT r.license_id) as avg_revenue_per_license
FROM revenue_records r
WHERE r.created_at >= $1 AND r.created_at <= $2
  AND r.deleted_at IS NULL
GROUP BY r.billing_country
ORDER BY
  CASE
    WHEN $3 = 'revenue' THEN revenue
    WHEN $3 = 'license_count' THEN license_count
    ELSE revenue
  END DESC
LIMIT $4;
```

**Parameters**:

- `$1`: date_from
- `$2`: date_to
- `$3`: sort_by ('revenue' or 'license_count')
- `$4`: limit (default 50, max 100)

**Execution Time**: <250ms  
**Cache TTL**: 0 (no cache; frequency varies with orders)

---

### Endpoint 4: `/affiliates` – Leaderboard

**SQL Template**:

```sql
SELECT
  a.id,
  a.name,
  a.status,
  COUNT(DISTINCT au.id) as usage_count,
  SUM(au.commission_amount) as total_commission,
  SUM(au.commission_amount) / COUNT(DISTINCT au.id) as avg_commission_per_usage,
  MAX(au.created_at) as last_activity
FROM affiliates a
LEFT JOIN affiliate_usages au ON a.id = au.affiliate_id
WHERE au.created_at >= $1 AND au.created_at <= $2
  AND a.status = $3
  AND a.deleted_at IS NULL
GROUP BY a.id, a.name, a.status
ORDER BY
  CASE
    WHEN $4 = 'commission' THEN total_commission
    WHEN $4 = 'usage_count' THEN usage_count
    WHEN $4 = 'name' THEN a.name
    ELSE total_commission
  END DESC
LIMIT $5 OFFSET $6;
```

**Parameters**:

- `$1`: date_from
- `$2`: date_to
- `$3`: status ('ACTIVE', 'INACTIVE', 'ALL')
- `$4`: sort_by
- `$5`: page_size
- `$6`: offset (page - 1) \* page_size

**Execution Time**: <200ms  
**Cache TTL**: 1 minute

---

### Endpoint 5: `/trends` – 12-Month Trends

**SQL Template** (Using Materialized View):

```sql
SELECT
  m.month,
  SUM(m.license_count) as total_licenses,
  SUM(m.total_revenue) as total_revenue,
  SUM(SUM(m.total_revenue)) OVER (
    ORDER BY m.month
  ) as cumulative_revenue
FROM revenue_summary_monthly m
WHERE m.month >= NOW()::date - INTERVAL '12 months'
GROUP BY m.month
ORDER BY m.month ASC;
```

**Alternative** (Without Materialized View):

```sql
SELECT
  DATE_TRUNC('month', r.created_at AT TIME ZONE 'UTC')::date as month,
  COUNT(DISTINCT r.license_id) as total_licenses,
  SUM(r.amount) as total_revenue
FROM revenue_records r
WHERE r.created_at >= NOW() - INTERVAL '12 months'
  AND r.deleted_at IS NULL
GROUP BY DATE_TRUNC('month', r.created_at AT TIME ZONE 'UTC')
ORDER BY month ASC;
```

**Execution Time**: <50ms (materialized view) or <500ms (raw query)  
**Cache TTL**: 10 minutes

---

### Endpoint 6: `/export` – CSV Export

**SQL Template**:

**Step 1: Validate Row Count**

```sql
SELECT COUNT(*) as row_count
FROM revenue_records r
WHERE r.created_at >= $1 AND r.created_at <= $2
  AND (r.billing_country = $3 OR $3 IS NULL)
  AND r.deleted_at IS NULL;
```

**Step 2: Export if Valid**

```sql
SELECT
  r.billing_country,
  r.created_at,
  p.name->>'en' as product_name,
  r.amount,
  r.currency,
  r.transaction_type,
  a.name as affiliate_name,
  r.affiliate_commission
FROM revenue_records r
LEFT JOIN products p ON r.product_id = p.id
LEFT JOIN affiliates a ON r.affiliate_id = a.id
WHERE r.created_at >= $1 AND r.created_at <= $2
  AND (r.billing_country = $3 OR $3 IS NULL)
  AND r.deleted_at IS NULL
ORDER BY r.created_at DESC, r.billing_country DESC
LIMIT 50000;
```

**Execution Time**: <2 seconds (streaming response)  
**Cache TTL**: 0 (always fresh for financial data)

---

## Part 4: Aggregation Functions & Calculations

### Revenue Aggregation (Rounding Strategy)

**Database Layer** (Full Precision):

```sql
-- Database stores full precision (NUMERIC(12, 4))
SELECT amount FROM revenue_records WHERE id = $1;
-- Returns: 100.4567
```

**Application Layer** (Display Rounding):

```typescript
import Decimal from 'decimal.js'

function roundRevenue(value: string): string {
  // Parse stored value, round to 2 decimals (round-half-up)
  return new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toString()
}

// Example
roundRevenue('95000.4567') // Returns: "95000.46"
roundRevenue('100.005') // Returns: "100.01" (round-half-up)
roundRevenue('100.004') // Returns: "100.00"
```

### Commission Calculation

**Pattern**: Sum all commissions with full precision; round once at display

```sql
-- Database aggregation (full precision)
SELECT
  SUM(commission_amount) as total_commission
FROM affiliate_usages
WHERE affiliate_id = $1 AND created_at BETWEEN $2 AND $3;

-- Result: 15500.4999...
```

```typescript
// Application display rounding
const displayCommission = roundRevenue(dbResult.total_commission)
// Output: "15500.50"
```

### Average Calculations

```typescript
function calculateAverage(sum: string, count: number): string {
  return new Decimal(sum)
    .dividedBy(new Decimal(count))
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    .toString()
}

// Example: avg_revenue_per_license
const avg = calculateAverage('95000.50', 650) // "146.15"
```

### Growth Percentage

```typescript
function calculateGrowthPercent(current: string, previous: string): string {
  const curr = new Decimal(current)
  const prev = new Decimal(previous)

  if (prev.isZero()) return '0.00' // Avoid divide by zero

  return curr
    .minus(prev)
    .dividedBy(prev)
    .times(100)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    .toString()
}

// Example
calculateGrowthPercent('230000.00', '220000.00') // "4.55"
```

---

## Part 5: Performance Budget & Dataset Sizing

### Expected Table Sizes (Baseline)

Assuming 1,250 active licenses across 1-year history:

| Table                     | Estimated Rows | Avg Row Size | Total Storage             |
| ------------------------- | -------------- | ------------ | ------------------------- |
| `licenses`                | 1,250          | 500 bytes    | ~625 KB                   |
| `products`                | 3-5            | 2 KB         | ~10 KB                    |
| `revenue_records`         | 10,000-50,000  | 400 bytes    | 4-20 MB                   |
| `affiliates`              | 50-100         | 300 bytes    | ~30 KB                    |
| `affiliate_usages`        | 1,000-5,000    | 200 bytes    | 200 KB - 1 MB             |
| `revenue_summary_monthly` | 12-36          | 200 bytes    | ~7 KB (materialized view) |

---

### Query Performance Targets

| Query                  | Expected Rows          | Without Index | With Index | Target  |
| ---------------------- | ---------------------- | ------------- | ---------- | ------- |
| License Status Counts  | 3-4                    | 8ms           | 2ms        | <10ms   |
| Revenue by Product     | 5                      | 25ms          | 12ms       | <50ms   |
| Geographic Aggregation | 20-50                  | 35ms          | 15ms       | <75ms   |
| Affiliate Leaderboard  | 50                     | 18ms          | 8ms        | <50ms   |
| Trends (Materialized)  | 12                     | 1ms           | 1ms        | <5ms    |
| Trends (Raw Query)     | 12 aggregates from 50k | 150ms         | 80ms       | <200ms  |
| Export Count Check     | 1                      | 150ms         | 50ms       | <100ms  |
| Export Full Query      | 50,000                 | 1000ms        | 400ms      | <2000ms |

---

### Index Maintenance Policy

**Monitor Every 7 Days**:

```sql
-- Check index bloat
SELECT schemaname, tablename, indexname, idx_size, idx_size_pretty
FROM (
  SELECT
    current_schema() as schemaname,
    t.tablename,
    i.indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) as idx_size_pretty,
    pg_relation_size(indexrelid) as idx_size
  FROM pg_tables t
  JOIN pg_indexes i ON t.tablename = i.tablename
  WHERE t.schemaname = 'public'
) idx_sizes
WHERE idx_size > 1048576  -- > 1 MB
ORDER BY idx_size DESC;
```

**Reindex If**:

- Index bloat > 50% of size (exceeds dead tuple threshold)
- Query plan changes to sequential scan (regression detected)

**Quarterly Maintenance**:

```sql
-- Run quarterly (off-peak hours)
REINDEX INDEX CONCURRENTLY idx_revenue_records_created_at;
REINDEX INDEX CONCURRENTLY idx_revenue_records_product_id;
-- ... repeat for all dashboard indexes
```

---

## Part 6: Data Integrity & Constraints

### Referential Integrity

```sql
-- License → Product (foreign key)
ALTER TABLE licenses
ADD CONSTRAINT fk_license_product
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT;

-- Revenue Record → License (foreign key)
ALTER TABLE revenue_records
ADD CONSTRAINT fk_revenue_license
  FOREIGN KEY (license_id) REFERENCES licenses(id) ON DELETE RESTRICT;

-- Revenue Record → Product (foreign key)
ALTER TABLE revenue_records
ADD CONSTRAINT fk_revenue_product
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT;

-- Affiliate Usage → Affiliate (foreign key)
ALTER TABLE affiliate_usages
ADD CONSTRAINT fk_usage_affiliate
  FOREIGN KEY (affiliate_id) REFERENCES affiliates(id) ON DELETE CASCADE;
```

### Check Constraints

```sql
-- Revenue amounts must be non-negative
ALTER TABLE revenue_records
ADD CONSTRAINT revenue_amount_positive
  CHECK (amount >= 0);

-- Commission amounts must be non-negative
ALTER TABLE affiliate_usages
ADD CONSTRAINT commission_amount_positive
  CHECK (commission_amount >= 0);

-- Commission rates must be 0-100%
ALTER TABLE affiliates
ADD CONSTRAINT commission_rate_valid
  CHECK (commission_rate >= 0 AND commission_rate <= 1);
```

---

## Part 7: Backup & Recovery Considerations

### Data Retention Policy

- `revenue_records`: Retained indefinitely (financial audit trail)
- `affiliate_usages`: Retained indefinitely (immutable audit trail)
- `licenses`: Retained indefinitely (license history)
- Soft-deleted records: Retained 7 years (compliance requirement)
- Never physically delete from production; use soft-delete (deleted_at timestamp)

### Snapshot Strategy

Before schema changes:

1. Take PostgreSQL backup: `pg_dump --no-owner -Fc master_db > backup-YYYYMMDD.dump`
2. Archive to S3 with versioning enabled
3. Verify restore works on staging environment
4. Execute migration only after successful verification

---

## Part 8: Team-Specific Implementation Notes

### For Backend Developer (API/Query Optimization)

1. Verify all dashboard indexes exist in your test environment:

   ```bash
   psql master_db -c "SELECT indexname FROM pg_indexes WHERE tablename IN ('licenses', 'revenue_records', 'affiliates', 'affiliate_usages', 'products') ORDER BY tablename, indexname;"
   ```

2. Run EXPLAIN ANALYZE on all 6 query templates to ensure indexed plans
3. Load test: Simulate 100 concurrent requests; verify all complete <300ms
4. Monitor query execution time before/after optimization

### For Frontend Developer (UI Display)

1. All monetary values received from API are **strings** (to preserve precision)
2. Display with 2 decimal places: `$${parseFloat(value).toFixed(2)}`
3. Never perform calculations on frontend (all done on backend)
4. Percentages displayed as `${growth}%` (already rounded on backend)

### For Data Analyst/Business

1. Dashboard metrics are **platform-level aggregate** (not per-workspace)
2. Revenue and commission data sourced from `revenue_records` table
3. For drilling into individual license/affiliate details, custom queries needed (outside dashboard scope)
4. Audit trail: All dashboard access logged in `mmc_audit_log` table

---

END OF DATA-MODEL.MD
