# Implementation Plan: MMC Dashboard

**Stage**: STAGE_15_MMC_DASHBOARD  
**Phase**: 02 – Platform MMC  
**Branch**: 015-mmc-dashboard  
**Created**: February 26, 2026  
**Status**: Ready for Implementation

---

## 1. Technical Context

### Architecture Overview

The MMC Dashboard is a master_db-only, read-only analytics layer serving platform-level insights. No
mutations, no tenant database access, no cross-tenant joins.

**Architecture Principles:**

1. **Master Database Isolation**: All queries execute exclusively on master_db; zero tenant database
   access
2. **Middleware-First Authorization**: License → Permission → Query execution order enforced
3. **Tiered Caching Strategy**: High-read metrics cached at 5-min TTL; revenue/geographic queries
   always fresh (indexed)
4. **Role-Based Query Filtering**: `reporting.view` permission required; query-level filtering
   enforces workspace scope
5. **Performance Guarantee**: All endpoints <300ms (average <150ms) under 100 concurrent users
6. **Audit Trail**: Structured logging with correlation_id, user_id, workspace_id, timestamp on all
   access

### Data Flow

```
Request
  ↓
[1] Correlation ID Middleware (UUID generation, context injection)
  ↓
[2] Tenant Resolver (MMC workspace slug)
  ↓
[3] License Enforcement (master_db license status check; block if not ACTIVE)
  ↓
[4] Permission Check (reporting.view required; 403 if missing)
  ↓
[5] Dashboard Query Engine
  │
  ├─→ [Cache Layer] (Redis, TTL varies by endpoint)
  │
  ├─→ [Query Executor] (master_db only)
  │   ├─ Licenses table (status aggregation, indexed)
  │   ├─ Revenue records (time-range, product grouping, indexed)
  │   ├─ Affiliates & affiliate_usages (commission summation, indexed)
  │   └─ Products table (revenue breakdown, indexed)
  │
  └─→ [Response Formatter] (aggregate rounding, pagination)
  ↓
[6] Send Response + Audit Log
```

### Trust Chain Protection

```
Isolation Guaranteed By:
  Tenant Resolver
    ↓
  License Middleware (validates ACTIVE status)
    ↓
  Permission Middleware (enforces reporting.view)
    ↓
  Query Execution (master_db + query-level workspace filtering)
    ↓
  No tenant database accessed
  No cross-tenant joins
  No row-level data leakage
```

---

## 2. API Endpoint Specifications

### Base Route: `/api/mmc/dashboard`

All endpoints require:

- `Authorization: Bearer <token>` header
- License middleware validation (MMC workspace must be ACTIVE)
- Permission middleware validation (`reporting.view` required)
- Middleware execution order enforced

### Endpoint 1: Commercial Health Summary

**Route**: `GET /api/mmc/dashboard/summary`

**Purpose**: License status counts, current month + YTD revenue at a glance

**Query Parameters**: None (returns platform-wide metrics)

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "licenses": {
      "total": 1250,
      "active": 1200,
      "soft_locked": 35,
      "archived": 15
    },
    "revenue": {
      "this_month": "24500.50",
      "this_year": "287650.75",
      "last_month": "22100.25"
    },
    "snapshot_at": "2026-02-26T15:30:00Z"
  },
  "error": null
}
```

**Key Details:**

- License counts aggregated from `licenses` table WHERE `deleted_at IS NULL`, grouped by status
- Revenue calculated from `revenue_records` WHERE `created_at >= DATE_TRUNC('month', NOW())` for
  current month
- YTD calculated WHERE `created_at >= DATE_TRUNC('year', NOW())`
- All currency values returned as strings (2 decimal precision)
- Cache: 5-minute TTL (summary data changes slowly)

**Performance Target**: <100ms (pre-computed or indexed)

**Error Response** (403):

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "PERMISSION_DENIED",
    "message": "reporting.view permission required to access dashboard"
  }
}
```

**Error Response** (423):

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "LICENSE_INACTIVE",
    "message": "MMC workspace license is not ACTIVE"
  }
}
```

---

### Endpoint 2: Revenue Breakdown by Product

**Route**: `GET /api/mmc/dashboard/revenue-breakdown`

**Purpose**: Top 5 products by revenue, month-to-date and year-to-date totals

**Query Parameters**:

- `date_from` (optional): ISO 8601 date; default: 12 months ago
- `date_to` (optional): ISO 8601 date; default: today
- Validation: `date_to` must be >= `date_from`; return 400 if invalid

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "products": [
      {
        "product_id": "uuid-1",
        "product_name": "Zidney Pro",
        "revenue_this_period": "82000.50",
        "revenue_previous_period": "75000.00",
        "growth_percent": "9.33",
        "license_count": 450
      },
      {
        "product_id": "uuid-2",
        "product_name": "Zidney Enterprise",
        "revenue_this_period": "65000.00",
        "revenue_previous_period": "60000.00",
        "growth_percent": "8.33",
        "license_count": 120
      }
    ],
    "total_revenue": "147000.50",
    "period": {
      "from": "2025-02-26",
      "to": "2026-02-26"
    }
  },
  "error": null
}
```

**Key Details:**

- SQL:
  `SELECT product_id, SUM(amount) FROM revenue_records WHERE created_at BETWEEN ? AND ? GROUP BY product_id ORDER BY SUM(amount) DESC LIMIT 5`
- All revenue values with 2-decimal precision, stored as strings
- Growth calculated as: `(this_period - previous_period) / previous_period * 100`, rounded to 2
  decimals
- License count: `SELECT COUNT(*) FROM licenses WHERE product_id = ? AND status = 'ACTIVE'`
- Cache: Fresh indexed query (no caching due to date range variability)

**Performance Target**: <200ms for 10k revenue records

**Error Response** (400):

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "INVALID_DATE_RANGE",
    "message": "date_to must be >= date_from"
  }
}
```

---

### Endpoint 3: Geographic Revenue Distribution

**Route**: `GET /api/mmc/dashboard/geographic`

**Purpose**: Revenue and license counts grouped by billing country

**Query Parameters**:

- `date_from` (optional): ISO 8601 date; default: 12 months ago
- `date_to` (optional): ISO 8601 date; default: today
- `sort_by` (optional): "revenue" (default) | "license_count"
- `limit` (optional): 1-100; default: 50

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "countries": [
      {
        "country_code": "US",
        "country_name": "United States",
        "revenue": "95000.50",
        "license_count": 650,
        "avg_revenue_per_license": "146.15"
      },
      {
        "country_code": "GB",
        "country_name": "United Kingdom",
        "revenue": "32000.25",
        "license_count": 180,
        "avg_revenue_per_license": "177.78"
      }
    ],
    "total_revenue": "127000.75",
    "total_countries": 28,
    "queried_countries": 50
  },
  "error": null
}
```

**Key Details:**

- SQL:
  `SELECT billing_country, SUM(amount) as revenue, COUNT(DISTINCT license_id) as license_count FROM revenue_records WHERE created_at BETWEEN ? AND ? GROUP BY billing_country ORDER BY {sort_by} DESC LIMIT ?`
- Country codes standardized to ISO 3166-1 alpha-2 (US, GB, etc.)
- Country names resolved from reference table or hardcoded mapping
- All currency values with 2-decimal precision, stored as strings
- `avg_revenue_per_license = revenue / license_count`
- Pagination: offset-based; default 50 items, max 100
- Cache: Fresh indexed query (geographic aggregation changes frequently)

**Performance Target**: <250ms for 50 countries

**Error Response** (400):

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "INVALID_LIMIT",
    "message": "limit must be between 1 and 100"
  }
}
```

---

### Endpoint 4: Affiliate Performance Leaderboard

**Route**: `GET /api/mmc/dashboard/affiliates`

**Purpose**: Top affiliates by commission generated, with usage metrics

**Query Parameters**:

- `date_from` (optional): ISO 8601 date; default: 30 days ago
- `date_to` (optional): ISO 8601 date; default: today
- `sort_by` (optional): "commission" (default) | "usage_count" | "name"
- `status` (optional): "ACTIVE" | "INACTIVE" | "ALL"; default: "ACTIVE"
- `page` (optional): 1-based; default: 1
- `page_size` (optional): 1-100; default: 50

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "affiliates": [
      {
        "affiliate_id": "uuid-1",
        "name": "Top Partner Inc",
        "status": "ACTIVE",
        "total_commission": "15500.50",
        "usage_count": 350,
        "avg_commission_per_usage": "44.29",
        "last_activity": "2026-02-26T10:30:00Z"
      },
      {
        "affiliate_id": "uuid-2",
        "name": "Secondary Partners",
        "status": "ACTIVE",
        "total_commission": "8000.00",
        "usage_count": 200,
        "avg_commission_per_usage": "40.00",
        "last_activity": "2026-02-25T14:20:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "page_size": 50,
      "total_affiliates": 87,
      "total_pages": 2
    }
  },
  "error": null
}
```

**Key Details:**

- SQL:
  `SELECT a.id, a.name, a.status, SUM(au.commission_amount) as total_commission, COUNT(au.id) as usage_count, MAX(au.created_at) as last_activity FROM affiliates a LEFT JOIN affiliate_usages au ON a.id = au.affiliate_id WHERE au.created_at BETWEEN ? AND ? AND a.status = ? GROUP BY a.id ORDER BY {sort_by} {sort_direction} LIMIT ? OFFSET ?`
- Commission amounts with 2-decimal precision, stored as strings
- `avg_commission_per_usage = total_commission / usage_count`
- Pagination: offset-based; default 50, max 100
- `last_activity` shows most recent affiliate_usages.created_at
- Cache: 1-minute TTL (affiliate metrics moderately volatile)

**Performance Target**: <200ms for 100 affiliates

**Error Response** (400):

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "INVALID_PAGE_SIZE",
    "message": "page_size must be between 1 and 100"
  }
}
```

---

### Endpoint 5: Growth Trends (12-Month History)

**Route**: `GET /api/mmc/dashboard/trends`

**Purpose**: Monthly license and revenue trends for growth visualization

**Query Parameters**:

- `months` (optional): 3, 6, 12 (default: 12)
- `metric` (optional): "license_count" | "revenue" | "both" (default: "both")

**Response** (200 OK):

```json
{
  "success": true,
  "data": {
    "trends": [
      {
        "month": "2025-02-26",
        "license_count": 1100,
        "revenue": "220000.00",
        "mrr": "220000.00"
      },
      {
        "month": "2025-03-26",
        "license_count": 1120,
        "revenue": "230000.00",
        "mrr": "230000.00"
      }
    ],
    "summary": {
      "total_license_growth": "150",
      "total_license_growth_percent": "13.64",
      "total_revenue_growth": "67650.75",
      "total_revenue_growth_percent": "30.72"
    },
    "period_months": 12
  },
  "error": null
}
```

**Key Details:**

- SQL:
  `SELECT DATE_TRUNC('month', created_at)::date as month, COUNT(DISTINCT license_id) as license_count, SUM(amount) as revenue FROM revenue_records WHERE created_at >= NOW() - INTERVAL ? GROUP BY DATE_TRUNC('month', created_at) ORDER BY month ASC`
- Monthly data points aggregated using materialized view (refresh nightly) if available; falls back
  to raw query
- Revenue values with 2-decimal precision, stored as strings
- `mrr` = Monthly Recurring Revenue = average of last 3 months (optional enhancement)
- Cache: 10-minute TTL (precomputed summary tables used for stability)

**Performance Target**: <500ms (materialized view allows larger dataset)

---

### Endpoint 6: Export Dashboard Data

**Route**: `POST /api/mmc/dashboard/export`

**Purpose**: CSV export of dashboard metrics (subject to 50k row limit)

**Request Body**:

```json
{
  "section": "geographic",
  "date_from": "2025-02-26",
  "date_to": "2026-02-26",
  "format": "csv"
}
```

**Query Parameters**: None

**Response** (200 OK):

- `Content-Type: text/csv`
- `Content-Disposition: attachment; filename="mmc-dashboard-export-2026-02-26.csv"`
- CSV file with headers and data rows, UTF-8 encoded

**Example CSV Content (geographic export)**:

```
Country Code,Country Name,Revenue,License Count,Avg Revenue Per License
US,United States,95000.50,650,146.15
GB,United Kingdom,32000.25,180,177.78
```

**Key Details:**

- Pre-check: Execute count(\*) query; if > 50,000 rows, return 413 before executing full export
- Exports always use fresh query (no cache); ensures financial data integrity
- Streaming response if dataset large; avoid loading entire result set in memory
- All currency values formatted with 2 decimals, comma separators
- Encoding: UTF-8 with BOM for Excel compatibility
- Cache: No caching for exports (always fresh)

**Performance Target**: <2 seconds for 50k rows

**Error Response** (413):

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "PAYLOAD_TOO_LARGE",
    "message": "Export request would return 185,000 rows. Maximum 50,000 rows allowed. Please filter by date range, country, or product."
  }
}
```

---

## 3. Middleware Layer Specifications

### Middleware Execution Order (MANDATORY)

1. **Correlation ID Middleware** – Generate or pass-through UUID
2. **Tenant Resolver** – Extract workspace slug from subdomain/path
3. **License Enforcement** – Validate MMC workspace license is ACTIVE
4. **Permission Middleware** – Check `reporting.view` permission
5. **Route Handler** – Execute dashboard query

### License Enforcement Middleware

**Implementation Location**: `apps/api/src/middleware/license.middleware.ts`

**Behavior**:

- Query master_db: `SELECT status FROM licenses WHERE workspace_slug = ? AND deleted_at IS NULL`
- If status = "ACTIVE": proceed to next middleware
- If status = "SOFT_LOCKED" or "ARCHIVED": return 423 (Locked)
- If license not found: return 404 (Not Found)
- If database error: return 500 with generic message (specific error logged)

**Response on 423**:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "LICENSE_LOCKED",
    "message": "MMC workspace license is not active"
  }
}
```

### Permission Middleware

**Implementation Location**: `apps/api/src/middleware/permission.middleware.ts`

**Behavior**:

- Extract user_id from JWT token
- Query master_db:
  `SELECT role_id FROM mmc_members WHERE user_id = ? AND workspace_id = ? AND deleted_at IS NULL`
- Query master_db:
  `SELECT * FROM role_permissions WHERE role_id = ? AND permission_name = 'reporting.view'`
- If permission found: proceed to next middleware
- If permission not found: return 403 (Forbidden)
- Log authorization attempt with correlation_id, user_id, timestamp

**Response on 403**:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "PERMISSION_DENIED",
    "message": "reporting.view permission required to access dashboard"
  }
}
```

---

## 4. Database Query Patterns

### Indexed Query Patterns

All dashboard queries MUST use indexed columns exclusively. Query planner must confirm NO sequential
scans.

**Pattern 1: License Status Aggregation**

```sql
-- Indexed query (uses idx_licenses_status)
SELECT
  status,
  COUNT(*) as count
FROM licenses
WHERE deleted_at IS NULL
GROUP BY status;
```

**Indexes Required**:

- `idx_licenses_status` (licenses.status)
- `idx_licenses_deleted_at` (licenses.deleted_at) – for WHERE clause

---

**Pattern 2: Revenue by Product (Date-Range)**

```sql
-- Indexed query (uses composite index on product_id + created_at)
SELECT
  p.id,
  p.name,
  SUM(r.amount) as total_revenue,
  COUNT(DISTINCT r.license_id) as license_count
FROM products p
LEFT JOIN revenue_records r ON p.id = r.product_id
WHERE r.created_at >= $1 AND r.created_at <= $2
GROUP BY p.id, p.name
ORDER BY total_revenue DESC
LIMIT 5;
```

**Indexes Required**:

- `idx_revenue_records_product_id` (revenue_records.product_id)
- `idx_revenue_records_created_at` (revenue_records.created_at)
- Composite: `idx_revenue_records_product_created` (product_id, created_at)

---

**Pattern 3: Geographic Aggregation**

```sql
-- Indexed query (uses idx_revenue_records_billing_country + created_at)
SELECT
  r.billing_country,
  SUM(r.amount) as revenue,
  COUNT(DISTINCT r.license_id) as license_count
FROM revenue_records r
WHERE r.created_at >= $1 AND r.created_at <= $2
GROUP BY r.billing_country
ORDER BY revenue DESC
LIMIT 50;
```

**Indexes Required**:

- `idx_revenue_records_billing_country` (revenue_records.billing_country)
- `idx_revenue_records_created_at` (revenue_records.created_at)

---

**Pattern 4: Affiliate Performance**

```sql
-- Indexed query (uses idx_affiliate_usages_affiliate_id + created_at)
SELECT
  a.id,
  a.name,
  a.status,
  SUM(au.commission_amount) as total_commission,
  COUNT(au.id) as usage_count,
  MAX(au.created_at) as last_activity
FROM affiliates a
LEFT JOIN affiliate_usages au ON a.id = au.affiliate_id
WHERE au.created_at >= $1 AND au.created_at <= $2 AND a.status = $3
GROUP BY a.id, a.name, a.status
ORDER BY total_commission DESC
LIMIT 50 OFFSET 0;
```

**Indexes Required**:

- `idx_affiliate_usages_affiliate_id` (affiliate_usages.affiliate_id)
- `idx_affiliate_usages_created_at` (affiliate_usages.created_at)
- `idx_affiliates_status` (affiliates.status)
- Composite: `idx_affiliate_usages_affiliate_created` (affiliate_id, created_at)

---

### Aggregation Function Specifications

**Revenue Calculation (Aggregate Rounding)**

```typescript
// Database: store full precision
SELECT SUM(amount) as total_revenue FROM revenue_records;
// Returns: 95000.4567...

// Application layer: round at display
const displayValue = new Decimal(databaseValue)
  .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
  .toString();
// Output: "95000.46"
```

Rationale: Aggregate rounding (sum first, then round) avoids cumulative rounding errors. Database
stores full precision for audit trail; display rounds once at presentation layer.

---

**Commission Summation (Same Pattern)**

```sql
-- Database: aggregate with full precision
SELECT SUM(commission_amount) as total_commission
FROM affiliate_usages
WHERE affiliate_id = $1 AND created_at BETWEEN $2 AND $3;

-- Result: 15500.4999...
-- Application: round to 2 decimals: "15500.50"
```

---

**Time-Based Filtering**

```sql
-- Monthly aggregation (safe across timezones)
SELECT
  DATE_TRUNC('month', created_at AT TIME ZONE 'UTC')::date as month,
  SUM(amount) as revenue
FROM revenue_records
WHERE created_at >= $1 AND created_at < $2
GROUP BY DATE_TRUNC('month', created_at AT TIME ZONE 'UTC')
ORDER BY month ASC;

-- Note: created_at stored in UTC; AT TIME ZONE 'UTC' ensures consistency
```

---

## 5. Error Handling & Response Format

### Standard Response Format (ALL endpoints)

```json
{
  "success": boolean,
  "data": object | null,
  "error": {
    "code": string,
    "message": string
  } | null
}
```

**Rules:**

- `success` = true only if HTTP 200; all non-200 responses have `success` = false
- `data` = populated for success responses; null for errors
- `error` = null for successful responses; populated for errors
- `error.code` = machine-readable error code (e.g., "PERMISSION_DENIED", "LICENSE_LOCKED")
- `error.message` = user-friendly message (no implementation details, secrets, or stack traces)

---

### HTTP Status Codes & Error Codes

| HTTP | Error Code                                           | Scenario                                           |
| ---- | ---------------------------------------------------- | -------------------------------------------------- |
| 200  | N/A (success)                                        | Query successful                                   |
| 400  | INVALID_DATE_RANGE, INVALID_LIMIT, INVALID_PAGE_SIZE | Malformed request parameters                       |
| 401  | UNAUTHORIZED                                         | Missing/invalid JWT token                          |
| 403  | PERMISSION_DENIED                                    | User lacks reporting.view permission               |
| 404  | NOT_FOUND                                            | License not found (workspace doesn't exist)        |
| 413  | PAYLOAD_TOO_LARGE                                    | Export request exceeds 50k rows                    |
| 423  | LICENSE_LOCKED                                       | MMC workspace license not ACTIVE                   |
| 500  | INTERNAL_ERROR                                       | Database query failure (generic message to client) |

---

### Error Logging Strategy (SHALL NOT EXPOSE TO CLIENT)

**Logged**:
`[ERROR] License enforcement failed for workspace=acme-university, error_type=SOFT_LOCKED, correlation_id=uuid-xxx, timestamp=2026-02-26T15:30:00Z`

**NOT Logged**: Database connection strings, API keys, SQL syntax errors (sent to SentryLogs only)

---

## 6. Logging & Observability Requirements

### Mandatory Structured Logging Fields

Every dashboard request MUST log:

```json
{
  "timestamp": "2026-02-26T15:30:00.123Z",
  "level": "info|warn|error",
  "service": "mmc-dashboard",
  "correlation_id": "uuid-xxx",
  "user_id": "user-uuid",
  "workspace_id": "mmc-workspace-uuid",
  "endpoint": "/api/mmc/dashboard/summary",
  "method": "GET",
  "response_status": 200,
  "response_time_ms": 45,
  "query_count": 1,
  "cache_hit": true,
  "error_code": null
}
```

**Log Events:**

1. **DASHBOARD_REQUEST_START** – On request entry (correlation_id generated)
2. **LICENSE_VALIDATION_PASS** – After license middleware passes
3. **PERMISSION_CHECK_PASS** – After permission middleware passes
4. **DASHBOARD_QUERY_EXECUTED** – After query execution (include query_count)
5. **RESPONSE_SENT** – On response (include response_time_ms)
6. **AUTHORIZATION_FAILED** – On 403 or 423 (include failure_reason)
7. **QUERY_PERFORMANCE_ALERT** – If response_time > 300ms (include response_time_ms)

---

### Observability Metrics

Track in monitoring system (Prometheus, DataDog, etc.):

- `mmc_dashboard_request_total` – Counter by endpoint and status
- `mmc_dashboard_request_duration_ms` – Histogram by endpoint
- `mmc_dashboard_query_duration_ms` – Histogram by query type (license, revenue, affiliate, etc.)
- `mmc_dashboard_cache_hit_rate` – Gauge overall cache hit %
- `mmc_dashboard_authorization_failures` – Counter by failure_reason
- `mmc_dashboard_response_time_p50`, `p95`, `p99` – Percentile timings by endpoint

---

## 7. Caching Strategy

### Tiered Caching Architecture

**Tier 1: Redis (Distributed Cache)**

| Endpoint             | TTL          | Rationale                                                          |
| -------------------- | ------------ | ------------------------------------------------------------------ |
| `/summary`           | 5 min        | License/revenue summary changes slowly; high hit rate              |
| `/revenue-breakdown` | 0 (no cache) | Date-range variability makes caching ineffective                   |
| `/geographic`        | 0 (no cache) | Country distribution changes frequently with new orders            |
| `/affiliates`        | 1 min        | Affiliate metrics somewhat volatile; short TTL for limited benefit |
| `/trends`            | 10 min       | Monthly aggregations change rarely; precomputed summary tables     |
| `/export`            | 0 (no cache) | Financial data freshness required; always fresh                    |

**Cache Key Structure**:

```
mmc_dashboard:{endpoint}:{workspace_id}:{hash(query_params)}
```

Example:

```
mmc_dashboard:summary:mmc-workspace-uuid:sha256({})
mmc_dashboard:affiliates:mmc-workspace-uuid:sha256({"date_from":"2026-02-01","status":"ACTIVE"})
```

---

### Invalidation Strategy

1. **Time-Based**: TTL expiry (automatic via Redis)
2. **Event-Based** (Optional Enhancement):
   - On new revenue_record created: invalidate `/summary` & `/revenue-breakdown` caches
   - On affiliate_usage created: invalidate `/affiliates` cache
   - On license status change: invalidate all caches for affected workspace

---

### Cache Hit Rate Targets

- `/summary`: >85% (distributed systems, 5-min window)
- `/affiliates`: >60% (more volatile, 1-min window)
- `/trends`: >90% (precomputed, 10-min window)
- Overall: >70% across all endpoints

---

## 8. Concurrency & Performance Optimization

### Concurrency Handling

**Challenge**: 100+ concurrent users querying dashboard simultaneously

**Solutions**:

1. **Connection Pooling**: Maintain master_db connection pool with min=5, max=20 connections; reuse
   pooled connections
2. **Query Optimization**: All queries use indexed columns; no full-table scans
3. **Materialized Views** (Optional): For `/trends` endpoint, pre-aggregate monthly data in a
   summary table refreshed nightly
4. **Read Replicas** (Optional Future): Dashboard queries can execute on read-only replicas to
   reduce primary load
5. **Query Timeouts**: Set 5-second hard timeout; return 500 if query exceeds timeout

**Concurrency Test Scenario**:

- 100 concurrent users
- Each user requests `/summary`, waits 2 seconds, requests `/geographic`
- Expected: All queries complete within 300ms; no query timeouts
- Cache hit rate should reach >70%

---

### Performance Optimization Techniques

1. **Batch Aggregation**: Use SQL GROUP BY instead of application-level aggregation
2. **Index Strategy**: See section 4 (Database Query Patterns) for full index list
3. **Query Plan Analysis**: Use `EXPLAIN ANALYZE` to verify all queries use appropriate indexes
4. **Result Set Limiting**: All queries use LIMIT to prevent returning unbounded results
5. **Date Range Constraints**: All time-based queries include WHERE clause on `created_at` to scope
   search

---

## 9. Testing Approach by Endpoint

### Unit Tests (Domain Logic)

**File**: `apps/api/tests/unit/mmc-dashboard/metrics.test.ts`

```typescript
describe("Dashboard Metrics", () => {
  describe("Revenue Calculations", () => {
    test("should calculate total revenue with aggregate rounding", () => {
      const records = [{ amount: "100.445" }, { amount: "200.556" }, { amount: "300.001" }];
      const total = sumAndRound(records);
      expect(total).toBe("601.00"); // 100.445 + 200.556 + 300.001 = 601.002 → '601.00'
    });

    test("should handle empty revenue set", () => {
      const total = sumAndRound([]);
      expect(total).toBe("0.00");
    });
  });

  describe("License Status Aggregation", () => {
    test("should count licenses by status", () => {
      const licenses = [
        { status: "ACTIVE" },
        { status: "ACTIVE" },
        { status: "SOFT_LOCKED" },
        { status: "ARCHIVED" },
      ];
      const counts = aggregateLicensesByStatus(licenses);
      expect(counts).toEqual({
        active: 2,
        soft_locked: 1,
        archived: 1,
      });
    });
  });

  describe("Geographic Aggregation", () => {
    test("should group revenue by country with no duplicates", () => {
      const records = [
        { billing_country: "US", amount: "1000" },
        { billing_country: "US", amount: "500" },
        { billing_country: "GB", amount: "800" },
      ];
      const geo = aggregateByCountry(records);
      expect(geo).toEqual([
        { country: "US", revenue: "1500.00" },
        { country: "GB", revenue: "800.00" },
      ]);
    });
  });

  describe("Permission Validation", () => {
    test("should return true if user has reporting.view", () => {
      const user = { permissions: ["reporting.view", "admin"] };
      expect(hasReportingView(user)).toBe(true);
    });

    test("should return false if user lacks reporting.view", () => {
      const user = { permissions: ["admin"] };
      expect(hasReportingView(user)).toBe(false);
    });
  });
});
```

---

### Integration Tests (API Endpoints)

**File**: `apps/api/tests/integration/mmc-dashboard/endpoints.test.ts`

```typescript
describe("MMC Dashboard Endpoints", () => {
  describe("GET /api/mmc/dashboard/summary", () => {
    test("should return 200 with license counts and revenue", async () => {
      // Setup: Seed master_db with test licenses and revenue
      const response = await request(app)
        .get("/api/mmc/dashboard/summary")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.licenses.total).toBeGreaterThan(0);
      expect(response.body.data.revenue.this_month).toBeDefined();
    });

    test("should return 403 if user lacks reporting.view permission", async () => {
      const response = await request(app)
        .get("/api/mmc/dashboard/summary")
        .set("Authorization", `Bearer ${limitedUserToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("PERMISSION_DENIED");
    });

    test("should return 423 if license is SOFT_LOCKED", async () => {
      // Setup: Soft-lock the MMC workspace license
      await masterDb.query("UPDATE licenses SET status = $1 WHERE workspace_slug = $2", [
        "SOFT_LOCKED",
        "mmc",
      ]);

      const response = await request(app)
        .get("/api/mmc/dashboard/summary")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(423);
      expect(response.body.error.code).toBe("LICENSE_LOCKED");
    });

    test("should respond within 300ms", async () => {
      const start = Date.now();
      const response = await request(app)
        .get("/api/mmc/dashboard/summary")
        .set("Authorization", `Bearer ${adminToken}`);

      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(300);
    });
  });

  describe("GET /api/mmc/dashboard/revenue-breakdown", () => {
    test("should return top 5 products by revenue", async () => {
      const response = await request(app)
        .get("/api/mmc/dashboard/revenue-breakdown")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.products).toHaveLength(5);
      expect(response.body.data.products[0].revenue_this_period).toBeDefined();
    });

    test("should return 400 if date_to < date_from", async () => {
      const response = await request(app)
        .get("/api/mmc/dashboard/revenue-breakdown?date_from=2026-02-26&date_to=2026-01-01")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("INVALID_DATE_RANGE");
    });

    test("should respond within 300ms with indexed query", async () => {
      const start = Date.now();
      await request(app)
        .get("/api/mmc/dashboard/revenue-breakdown")
        .set("Authorization", `Bearer ${adminToken}`);

      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(300);
    });
  });

  describe("Isolation Tests", () => {
    test("should NOT query any tenant database", async () => {
      // Setup: Mock tenant DB to error if queried
      const tenantDbMock = jest
        .spyOn(tenantDbPool, "query")
        .mockRejectedValue(new Error("Tenant DB should not be queried"));

      const response = await request(app)
        .get("/api/mmc/dashboard/summary")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(200); // Should succeed without tenant DB
      expect(tenantDbMock).not.toHaveBeenCalled(); // Verify tenant DB not queried
    });
  });
});
```

---

### Performance Tests

**File**: `apps/api/tests/performance/mmc-dashboard/concurrent-load.test.ts`

```typescript
describe("Dashboard Concurrent Load", () => {
  test("should handle 100 concurrent users with <300ms max latency", async () => {
    const users = Array.from({ length: 100 }, (_, i) => ({
      token: generateUserToken(i),
      workspace: "mmc",
    }));

    const promises = users.map((user) =>
      request(app).get("/api/mmc/dashboard/summary").set("Authorization", `Bearer ${user.token}`),
    );

    const start = Date.now();
    const results = await Promise.all(promises);
    const totalTime = Date.now() - start;

    const times = results.map((r) => r.body.responseTime || 100);
    const avgTime = times.reduce((a, b) => a + b) / times.length;
    const maxTime = Math.max(...times);

    expect(maxTime).toBeLessThan(300);
    expect(avgTime).toBeLessThan(150);
    expect(results.every((r) => r.status === 200)).toBe(true);
  });
});
```

---

## 10. Version Compatibility

### Schema Version Enforcement

- Dashboard requires `master_db.schema_version >= 8` (assumes revenue_records and affiliate tables
  added)
- If schema version incompatible: return 426 (Upgrade Required)

**Check**: Executed after license middleware, before query execution

```typescript
const schemaCheck = await masterDb.query("SELECT schema_version FROM master_db_version LIMIT 1");
if (schemaCheck.rows[0].schema_version < 8) {
  return ctx.json(
    {
      success: false,
      data: null,
      error: {
        code: "SCHEMA_INCOMPATIBLE",
        message: "Dashboard requires master_db schema version 8 or higher",
      },
    },
    426,
  );
}
```

---

## 11. Implementation Sequence

### Phase 0: Setup & Preparation (Day 1)

1. Create middleware files (license, permission enforcement)
2. Create route file: `apps/api/src/routes/mmc/dashboard.ts`
3. Create domain package: `packages/domain-core/mmc-dashboard/` with metric calculation functions

### Phase 1: Backend Implementation (Days 2-3)

1. Implement `/summary` endpoint (license aggregation)
2. Implement `/revenue-breakdown` endpoint (product-based revenue)
3. Implement `/geographic` endpoint (country aggregation)
4. Implement `/affiliates` endpoint (affiliate leaderboard)
5. Implement `/trends` endpoint (monthly trends)
6. Implement `/export` endpoint (CSV streaming)

### Phase 2: Caching & Optimization (Day 3)

1. Add Redis caching layer (summary, trends, affiliates)
2. Add cache invalidation logic
3. Verify query indexes exist; optimize slow queries

### Phase 3: Frontend Implementation (Day 4)

1. Create Dashboard component: `apps/mmc/src/views/Dashboard.vue`
2. Create sub-components: CommercialHealth, GeographicDistribution, AffiliateLeaderboard,
   GrowthTrends
3. Integrate with API client
4. Add error boundaries and loading states

### Phase 4: Testing & Validation (Day 5)

1. Run unit test suite
2. Run integration test suite
3. Run performance load test (100 concurrent users)
4. Verify audit logging and correlation_id propagation
5. Validate isolation (confirm no tenant DB queries)

### Phase 5: Deployment (Day 6)

1. Merge to 015-mmc-dashboard branch
2. Run linting, type checks, test suite
3. Deploy to staging environment
4. Run end-to-end tests
5. Deploy to production

---

## 12. Architectural Decision Rationale

### Why Redis (not in-process cache)?

**Decision**: Use Redis for distributed caching (tiered TTL strategy)

**Rationale**:

- In-process cache (e.g., Node.js memory) does not persist across Bun restarts
- In-process cache does not share state across multiple Bun instances (if scaled horizontally)
- Redis provides:
  - Atomic operations (safe for concurrent access)
  - Automatic TTL expiry (no memory leak risk)
  - Shared state across instances (enables horizontal scaling)
  - Monitoring and debugging tools (Redis CLI, metrics export)

**Alternative Considered**: Materialized views only (no Redis)

- Rejection: Materialized views have fixed refresh schedule; cannot provide sub-second freshness for
  summary data
- Dashboard `/summary` needs <50ms response; materialized view refresh (once nightly) too stale for
  active monitoring

---

### Why Aggregate Rounding (not per-transaction)?

**Decision**: Sum revenue/commission with full precision; round once at display layer

**Rationale**:

- Aggregate rounding (sum first, then round) preserves mathematical precision
- Per-transaction rounding (round each transaction, then sum) accumulates rounding errors
- Example: Three transactions of $100.00 (after rounding)
  - Aggregate: $100.001 + $100.002 + $100.001 = $300.004 → round to $300.00 ✓
  - Per-transaction: round($100.001)=$100.00 + round($100.002)=$100.00 + round($100.001)=$100.00 =
    $300.00 ✓ (matches)
- Edge case: Three transactions of $100.005
  - Aggregate: $100.005 + $100.005 + $100.005 = $300.015 → round to $300.02
  - Per-transaction: $100.01 + $100.01 + $100.01 = $300.03 ✗ (doesn't match; error = $0.01)

**Conclusion**: Aggregate rounding ensures audit trail accuracy and matches financial
reconciliation.

---

### Why Role-Based Filtering at SQL (not middleware)?

**Decision**: Enforce `reporting.view` permission at SQL WHERE clause level, not in application code

**Rationale**:

- SQL-level filtering prevents accidental data exposure if application code bypasses permission
  check
- SQL ensures authorization is enforced at database access layer (defense-in-depth principle)
- Query patterns:

  ```sql
  -- Dangerous (middleware only):
  SELECT * FROM revenue_records;  -- Retrieve all, filter in app → risk if app code skipped

  -- Safe (SQL-level filtering):
  SELECT * FROM revenue_records
  WHERE workspace_id IN (SELECT workspace_id FROM mmc_members WHERE user_id = $1 AND workspace_id = (SELECT workspace_id FROM licenses WHERE workspace_slug = 'mmc'))
  -- Forces authorization at data retrieval, even if app code flawed
  ```

For MMC Dashboard (master_db only), scope is implicit: all metrics are platform-wide for
authenticated `reporting.view` users. No multi-workspace filtering needed.

---

### Why 50K Export Limit?

**Decision**: Maximum 50,000 rows per export; return 413 if request exceeds

**Rationale**:

- Memory safety: Streaming 50k rows uses ~50MB RAM; 500k rows uses ~500MB (risk of OOM crash)
- Compliance: Financial data exports likely subject to data retention policies; 50k row limit forces
  users to explicitly filter (audit trail of export requests)
- User experience: 50k rows = ~20 screens of data; users should filter by date/country/product
  instead of exporting entire dataset
- Precedent: Google Sheets, Salesforce, Tableau all have export row limits (typically 10k-100k)

**Alternative Considered**: Async export (queue for later download)

- Rejection: Added complexity for MVP; dashboard is primarily browsing use case, not daily bulk
  exports

---

### Why Tiered Caching vs Uniform TTL?

**Decision**: Different TTL for different endpoints (5-min summary, 1-min affiliates, 10-min trends,
0-min revenue)

**Rationale**:

- Performance vs Freshness Trade-off:
  - Summary data (license counts, YTD revenue) changes slowly; 5-min cache = 85%+ hit rate
  - Affiliate metrics change more frequently (new usages constantly); 1-min cache = ~60% hit rate
  - Trends (monthly aggregations) almost never change; 10-min cache = 95%+ hit rate
  - Revenue breakdown (product split) varies with every new order; 0 cache (always fresh)
- Uniform 5-min TTL would be too stale for real-time affiliate metrics; 1-min TTL would waste cache
  for trends
- Tiered approach balances performance optimization with data freshness requirements

---

## 13. Success Criteria & Acceptance

### Technical Success Metrics

✅ All 6 endpoints respond within 300ms (average <150ms) under 100 concurrent users  
✅ Zero queries to tenant databases; 100% master_db-only access (verified via audit logs)  
✅ All authorization failures (missing permission, locked license) return appropriate error codes
<50ms  
✅ CSV export streams >50k row requests return 413 with helpful error message  
✅ Audit logging includes correlation_id, user_id, workspace_id, endpoint, response_time  
✅ All monetary values displayed with 2-decimal precision (aggregate rounding)  
✅ Cache hit rate >70% overall; >85% for `/summary`, >90% for `/trends`

### Quality Gates

✅ Unit test coverage >90% for metric calculation functions  
✅ Integration tests pass for all 6 endpoints (success & error paths)  
✅ Performance tests confirm <300ms max latency under 100 concurrent users  
✅ Isolation tests confirm no tenant database access  
✅ TypeScript strict mode: zero compilation errors  
✅ ESLint: zero linting errors  
✅ Manual security review: no PII or secrets in logs/responses

---

## 14. Implementation Risks & Mitigation

| Risk                                                 | Impact                                         | Mitigation                                                                                                                    |
| ---------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Query timeout on large aggregations (100k+ records)  | 500 Error, dashboard unavailable               | Implement 5s hard query timeout; use precomputed summary tables for large datasets; set `work_mem=256MB` in PostgreSQL config |
| Memory exhaustion on CSV export (50k+ rows)          | Node.js crash, service downtime                | Validate row count before query (SELECT COUNT(\*)); stream response; limit to 50k rows                                        |
| Cross-tenant data leakage in aggregations            | Data breach, compliance violation              | Enforce query-level filtering; audit logs reviewed for cross-tenant joins; unit tests verify isolation                        |
| Authorization bypass (permission middleware skipped) | Unauthorized dashboard access                  | Implement middleware chain validation; integration tests verify 403 returned for missing permission                           |
| Performance degradation with concurrent load         | Response times exceed 300ms threshold          | Connection pooling (min=5, max=20); query indexing validation (EXPLAIN ANALYZE); load testing before deployment               |
| Cache invalidation bugs (stale metrics)              | Incorrect financial reporting, business impact | Manual cache invalidation during development; monitoring alerts if cache hit rate drops below 60%                             |

---

## 15. Dependencies & Prerequisites

**Must Exist Before Implementation:**

1. ✅ MMC members and roles system (STAGE_14)
2. ✅ Permission model with `reporting.view` role
3. ✅ Affiliates table (`affiliates`) with affiliate_usages
4. ✅ Products table with product metadata
5. ⏳ Revenue records table (`revenue_records`) – **May need migration**
6. ✅ License middleware implementation
7. ✅ Correlation ID middleware (already in place)

**To Verify**: Check master_db schema version; if <8, may need to add revenue_records and affiliate
indexes.

---

END OF PLAN.MD
