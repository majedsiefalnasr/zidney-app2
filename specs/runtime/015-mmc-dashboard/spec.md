# Feature Specification: MMC Dashboard

**Feature Branch**: `015-mmc-dashboard`  
**Phase**: 02 – Platform MMC  
**Stage**: STAGE_15_MMC_DASHBOARD  
**Created**: February 26, 2026  
**Status**: Ready for Planning  
**Reference**: [Phase Stage Definition](../../../specs/phases/02_PLATFORM_MMC/STAGE_15_MMC_DASHBOARD.md)

---

## Feature Overview

### What is Being Built

The MMC Dashboard is a platform-level, read-only analytics interface providing insight into:

- Commercial health (license inventory, statuses)
- Revenue summary (total, monthly, annual, by product)
- Geographic distribution (revenue and license counts by country)
- Affiliate performance (usage metrics, commission tracking)
- Growth trends (optional: license and revenue trends over time)

The dashboard is **insight-only**: no mutations, no provisioning triggers, no license modifications. All data derives strictly from master_db pre-aggregated tables and indexed queries.

### Phase & Stage Context

- **Phase**: 02 – Platform MMC
- **Stage**: STAGE_15_MMC_DASHBOARD
- **Status**: Specification Ready for Planning
- **Depends On**: STAGE_14_MMC_MEMBERS, STAGE_13_AFFILIATES, License Engine, Revenue Tables
- **Enables**: MMC operational monitoring, reporting exports, compliance auditing

### Systems Affected

✅ **MMC Frontend**: Dashboard UI for platform admins  
✅ **MMC API**: New read-only analytics endpoints  
✅ **Master Database**: Requires indexed, pre-aggregated views/tables  
✅ **Authorization**: Permission-based access (reporting.view)  
✅ **Logging**: Audit trail for dashboard access

**Not Affected:**

- Tenant databases (never queried)
- License lifecycle (read-only)
- Provisioning engine
- Attempt engine
- Affiliate scoring logic

---

## Constitutional Compliance Declaration

### Mandatory Guarantees

✅ **Database-Per-Tenant Preserved**: Dashboard queries master_db only; tenant databases never accessed or joined  
✅ **No Cross-Tenant Data Leakage**: All metrics scope strictly to workspace metadata in master DB  
✅ **No Middleware Bypass**: License middleware enforces workspace access before analytics queries  
✅ **No Unauthorized Access**: Permission middleware (reporting.view) blocks unauthenticated users  
✅ **No Mutations**: Dashboard is read-only; no state transitions, license changes, or tenant modifications  
✅ **No Real-Time Aggregation**: Heavy computations pre-aggregated; queries use indexed columns only  
✅ **Audit Logging Mandatory**: All dashboard access logged with correlation_id, user_id, timestamp  
✅ **Server-Authoritative Time**: All timestamps sourced from server, never client

---

## Architectural Boundary (CRITICAL)

The MMC Dashboard MUST:

- **Data Source**: Query `master_db` only
- **Schema**: Use `products`, `licenses`, `mmc_members`, `affiliates`, `affiliate_usages`, `revenue_records` tables exclusively
- **Aggregation**: Use indexed columns and pre-computed summary tables where dataset grows large
- **Performance**: Complete all responses within 300ms under normal load (1000+ licenses)
- **Authorization**: Enforce `reporting.view` permission per STAGE_14_MMC_MEMBERS

The MMC Dashboard MUST NOT:

- Query any tenant database
- Join across tenant/master boundaries
- Execute heavy real-time aggregations
- Mutate any state (licenses, affiliates, revenue)
- Expose tenant-specific financial data
- Trigger provisioning or state transitions
- Bypass license middleware
- Leak sensitive data to unauthorized roles

---

## Isolation Impact Analysis

### Database Access Pattern

**Master Database Only:**

- `products` table: Product metadata for revenue breakdowns (indexed: `id`)
- `licenses` table: Workspace license states and limits (indexed: `status`, `workspace_id`)
- `mmc_members` table: Platform staff (indexed: `workspace_id`)
- `affiliates` table: Affiliate accounts (indexed: `id`, `mmc_member_id`)
- `affiliate_usages` table: Usage tracking (indexed: `affiliate_id`, `created_at`)
- `revenue_records` table: Financial transactions (indexed: `created_at`, `product_id`)
- Summary tables (future): Precomputed monthly aggregations (indexed: `month`, `metric_type`)

**Tenant Databases:**

- Never accessed
- No cross-workspace joins
- No row-level aggregation
- No leakage through summary tables

**Resolver Middleware Order:**

1. Tenant ID resolved via slug (MMC workspace)
2. License validated (MMC member workspace must be ACTIVE)
3. Permission checked (reporting.view required)
4. Dashboard query executed within authenticated context

✅ **No shared tenant data across workspaces**  
✅ **No cross-tenant joins**  
✅ **Isolation intact through middleware enforcement**

---

## License & Version Enforcement

### License Middleware Requirement

✅ **MANDATORY** for all dashboard endpoints  
✅ Executes before analytics queries  
✅ Validates MMC workspace license status

### Version Checks

- `master_db.schema_version` must be compatible with dashboard API version
- Revenue schema supports products, affiliates, usage summary tables
- If schema version incompatible: return 426 (Upgrade Required)

### Permission Enforcement Model

**Permission Required**: `reporting.view`

- Belongs to mmc_members.roles (per STAGE_14_MMC_MEMBERS)
- Checked before every dashboard query
- Unauthorized access returns 403 (Forbidden)
- Must be logged as audit event

---

## Data Model & Schema Requirements

### Master Database Tables (Read-Only Access)

#### 1. Licenses Table (Existing, Read Used)

```sql
SELECT
  COUNT(*) as total_licenses,
  COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) as active_licenses,
  COUNT(CASE WHEN status = 'SOFT_LOCKED' THEN 1 END) as soft_locked_licenses,
  COUNT(CASE WHEN status = 'ARCHIVED' THEN 1 END) as archived_licenses
FROM licenses
WHERE deleted_at IS NULL;
```

**Indexes Required**:

- `idx_licenses_status` (for status-based counts)
- `idx_licenses_workspace_id` (for workspace scoping, if needed)

#### 2. Products Table (Existing, Used for Revenue Breakdown)

```sql
SELECT
  p.id,
  p.name,
  SUM(r.amount) as total_revenue
FROM products p
LEFT JOIN revenue_records r ON p.id = r.product_id
GROUP BY p.id, p.name
ORDER BY total_revenue DESC;
```

**Indexes Required**:

- `idx_products_id` (primary key)
- Composite index on `revenue_records(product_id, created_at)` for time-range queries

#### 3. Revenue Records Table (Existing, Used for Financial Metrics)

```sql
-- Monthly Revenue
SELECT
  DATE_TRUNC('month', created_at)::date as month,
  SUM(amount) as revenue
FROM revenue_records
WHERE created_at >= NOW() - INTERVAL '12 months'
GROUP BY DATE_TRUNC('month', created_at)
ORDER BY month DESC;

-- By Location
SELECT
  billing_country,
  COUNT(DISTINCT product_id) as license_count,
  SUM(amount) as revenue
FROM revenue_records
GROUP BY billing_country
ORDER BY revenue DESC;
```

**Indexes Required**:

- `idx_revenue_records_created_at` (for time-range queries)
- `idx_revenue_records_product_id` (for product breakdowns)
- `idx_revenue_records_billing_country` (for geographic aggregation)

#### 4. Affiliates Table (Existing, Used for Performance Metrics)

```sql
SELECT
  a.id,
  a.name,
  COUNT(DISTINCT au.id) as total_usages,
  SUM(au.commission_amount) as total_commission
FROM affiliates a
LEFT JOIN affiliate_usages au ON a.id = au.affiliate_id
WHERE a.deleted_at IS NULL
GROUP BY a.id, a.name
ORDER BY total_commission DESC;
```

**Indexes Required**:

- `idx_affiliates_id` (primary key)
- `idx_affiliates_mmc_member_id` (if needing affiliate ownership)
- `idx_affiliate_usages_affiliate_id` (for join efficiency)

#### 5. Affiliate Usages Table (Existing, Used for Commission & Activity)

```sql
SELECT
  COUNT(*) as total_usages,
  COUNT(DISTINCT affiliate_id) as active_affiliates,
  SUM(commission_amount) as total_commission_generated
FROM affiliate_usages
WHERE created_at >= NOW() - INTERVAL '30 days';
```

**Indexes Required**:

- `idx_affiliate_usages_created_at` (for time-range queries)
- `idx_affiliate_usages_affiliate_id` (for aggregation)

#### 6. Optional: Summary Tables (Future, for Performance)

If dataset grows beyond acceptable query times, introduce materialized views:

```sql
-- Monthly Revenue Summary (refreshed nightly via worker job)
CREATE TABLE IF NOT EXISTS revenue_summary_monthly (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month DATE NOT NULL,
  product_id UUID,
  total_revenue NUMERIC(12, 2),
  license_count INTEGER,
  billing_country VARCHAR(2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(month, product_id, billing_country)
);

CREATE INDEX idx_revenue_summary_monthly_month ON revenue_summary_monthly(month);
CREATE INDEX idx_revenue_summary_monthly_country ON revenue_summary_monthly(billing_country);

-- Affiliate Summary (refreshed nightly for accuracy)
CREATE TABLE IF NOT EXISTS affiliate_summary_monthly (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month DATE NOT NULL,
  affiliate_id UUID NOT NULL,
  total_usages INTEGER,
  commission_generated NUMERIC(12, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(month, affiliate_id)
);

CREATE INDEX idx_affiliate_summary_monthly_month ON affiliate_summary_monthly(month);
CREATE INDEX idx_affiliate_summary_monthly_affiliate ON affiliate_summary_monthly(affiliate_id);
```

**Refresh Strategy:**

- Materialized views updated nightly via scheduled worker job
- Summary tables avoid real-time heavy aggregation
- Dashboard queries use summary tables once volume exceeds threshold

---

## User Scenarios & Testing

### User Story 1: Platform Admin Views Commercial Dashboard (Priority: P1)

**Actor**: MMC member with `reporting.view` permission  
**Goal**: Understand platform commercial health at a glance

**Scenario**:

1. Admin logs into MMC workspace
2. Navigates to Dashboard → Commercial Health
3. System displays:
   - Total licenses and breakdown by status (ACTIVE, SOFT_LOCKED, ARCHIVED)
   - Current month revenue and YTD revenue
   - Top 5 products by revenue
4. Admin explores filters: date range, product, geography

**Why this priority**: Core insight layer; highest business value; enables decision-making

**Independent Test**:

- Can be tested independently by mocking master_db queries
- Validates license count queries, revenue aggregations are correct
- Delivers complete commercial overview without other metrics

**Acceptance Scenarios**:

1. **Given** admin is authenticated as MMC member, **When** they access Dashboard, **Then** system displays license counts (ACTIVE, SOFT_LOCKED, ARCHIVED) matching licenses table
2. **Given** revenue_records table has 100 entries, **When** admin views revenue summary, **Then** total_revenue and monthly_revenue calculations match pre-calculated values
3. **Given** admin lacks reporting.view permission, **When** they request dashboard data, **Then** system returns 403 Forbidden
4. **Given** MMC workspace license is SOFT_LOCKED or ARCHIVED, **When** admin requests dashboard, **Then** system blocks access with appropriate error

---

### User Story 2: Platform Analyst Views Geographic Revenue Distribution (Priority: P2)

**Actor**: MMC member with `reporting.view` permission  
**Goal**: Understand revenue and customer distribution by country

**Scenario**:

1. Admin navigates to Dashboard → Geographic Insights
2. System displays:
   - Table: Country | Revenue | License Count | Trend
   - Top 10 countries by revenue
   - Visual bar chart (or table in MVP)
3. Admin filters by date range (default: last 12 months)
4. Admin exports data as CSV

**Why this priority**: Secondary reporting need; requires geographic aggregation; enables market segmentation

**Independent Test**:

- Can be tested by mocking revenue_records with diverse country and country codes
- Validates GROUP BY billing_country and SUM(amount) queries
- Delivers geographic insight without other dashboard features

**Acceptance Scenarios**:

1. **Given** revenue_records have entries from 5 countries, **When** admin views geographic distribution, **Then** revenue is correctly grouped by country with accurate sums
2. **Given** admin requests geographic data, **When** system executes query, **Then** query completes within 300ms
3. **Given** revenue_records for a country show $10,000 total, **When** admin views that country's revenue, **Then** displayed amount matches $10,000
4. **Given** admin requests CSV export, **When** system processes request, **Then** file contains all countries sorted by revenue descending

---

### User Story 3: Platform Executive Reviews Affiliate Performance (Priority: P2)

**Actor**: MMC executive with `reporting.view` permission  
**Goal**: Assess affiliate channel contributions and identify top performers

**Scenario**:

1. Admin navigates to Dashboard → Affiliate Performance
2. System displays:
   - Affiliate leaderboard: Name | Total Usages | Commission Generated | Status
   - Total active affiliates and total commission
   - Top 10 affiliates by commission
3. Admin filters by time period (default: last 30 days)
4. Admin can drill down into individual affiliate performance

**Why this priority**: Affiliate management is core to MMC; requires aggregation of affiliate_usages table

**Independent Test**:

- Testable via mocking affiliate_usages with diverse commission_amounts
- Validates SUM(commission_amount), COUNT(DISTINCT affiliate_id) queries
- Delivers affiliate visibility without other dashboard sections

**Acceptance Scenarios**:

1. **Given** 5 affiliates with distinct commission amounts, **When** admin views affiliate leaderboard, **Then** affiliates are ranked by commission descending with correct totals
2. **Given** query includes 1000 usages, **When** system aggregates, **Then** response time is <300ms
3. **Given** an affiliate has 50 usages in the period, **When** admin views affiliate performance, **Then** usage count displays as 50
4. **Given** admin filters by last 30 days, **When** system executes query, **Then** only usages with created_at >= 30 days ago are included

---

### User Story 4: Platform Operator Reviews Growth Trends (Optional) (Priority: P3)

**Actor**: MMC member with `reporting.view` permission  
**Goal**: Understand platform growth trajectory (license and revenue trends)

**Scenario**:

1. Admin navigates to Dashboard → Growth Trends
2. System displays line chart:
   - X-axis: Months (last 12 months)
   - Y-axis (dual): License count (left) and Revenue (right)
3. Admin can toggle individual trend lines on/off
4. Admin can zoom into specific month for detail

**Why this priority**: Strategic planning; nice-to-have for initial MVP; requires precomputed monthly summaries

**Independent Test**:

- Testable independently using summary tables or raw data aggregation
- Validates monthly GROUP BY queries and date range filtering
- Delivers growth insight without blocking other dashboard features

**Acceptance Scenarios**:

1. **Given** historical data for 12 months, **When** admin views trend chart, **Then** each month's data is plotted accurately
2. **Given** license count grew from 100 to 150 over 12 months, **When** admin views license trend, **Then** chart shows upward trajectory
3. **Given** admin requests trend data, **When** system executes query, **Then** response time is <500ms (precomputed tables allowed)
4. **Given** revenue increased from $10K to $50K over period, **When** admin views revenue trend, **Then** chart displays correct monthly progression

---

### Edge Cases

- **Empty master_db**: If no licenses, revenue records, or affiliates exist, dashboard displays "No data available" with helpful messaging
- **No revenue_records table**: If payment system disabled, revenue section displays "Reporting not enabled" (per stage spec section 4.2)
- **User lacks reporting.view permission**: Request returns 403; error message does not leak dashboard data
- **Timezone handling**: All timestamps normalized to server timezone; no client-side time interpretation
- **Large dataset (1000+ licenses, 100+ affiliates)**: Query response time must remain <300ms; uses indexed queries and precomputed summaries
- **Concurrent dashboard access**: Multiple admins viewing dashboard simultaneously must not cause query contention (indexed query design)
- **Session timeout**: User session expires during dashboard viewing; subsequent data fetch returns 401 Unauthorized
- **Affiliate commission calculation inconsistency**: If affiliate_usages.commission_amount differs from expected calculation, dashboard displays actual stored value (not recalculated)

---

## Functional Requirements

### Dashboard Endpoint Requirements

- **Fr-001**: System MUST provide `/api/mmc/dashboard/summary` endpoint returning license counts grouped by status (ACTIVE, SOFT_LOCKED, ARCHIVED) from master_db licenses table
- **Fr-002**: System MUST calculate revenue_this_month and revenue_this_year from revenue_records table, displaying in USD with comma separators
- **Fr-003**: System MUST provide `/api/mmc/dashboard/revenue-breakdown` endpoint returning revenue by product (top 5), ordered descending by total revenue
- **Fr-004**: System MUST provide `/api/mmc/dashboard/geographic` endpoint returning revenue and license counts grouped by billing_country, sorted descending by revenue
- **Fr-005**: System MUST provide `/api/mmc/dashboard/affiliates` endpoint returning top affiliates by total_commission_generated, including usage count and status (ACTIVE/INACTIVE)
- **Fr-006**: System MUST provide `/api/mmc/dashboard/trends` endpoint (optional) returning monthly license and revenue trends for the past 12 months, queryable by date range

### Authorization & Security

- **Fr-007**: System MUST enforce `reporting.view` permission before returning any dashboard data; unauthorized requests return 403 Forbidden
- **Fr-008**: System MUST validate MMC member workspace license status (must be ACTIVE); if SOFT_LOCKED, ARCHIVED, or DELETED, return 423 (Locked) or appropriate error
- **Fr-009**: System MUST include correlation_id, user_id, workspace_id, timestamp in all dashboard access logs
- **Fr-010**: System MUST NOT expose tenant-specific financial data in dashboard responses; all metrics scoped to master_db only
- **Fr-011**: System MUST NOT include sensitive PII (e.g., member emails, affiliate private keys) in dashboard JSON responses

### Data Accuracy

- **Fr-012**: System MUST query exclusively from master_db; zero queries to any tenant database allowed
- **Fr-013**: System MUST use indexed columns only; full-table scans prohibited for performance compliance
- **Fr-014**: System MUST calculate license_count from `licenses` table WHERE `deleted_at IS NULL`; do not include deleted licenses
- **Fr-015**: System MUST calculate total_revenue from `revenue_records` table; never derive from tenant subscription or payment records
- **Fr-016**: System MUST aggregate affiliate metrics from `affiliate_usages` table; commission_amount must be summed directly, not recalculated

### Performance

- **Fr-017**: System MUST return all dashboard endpoints within 300ms under normal load (1000+ licenses, 100+ affiliates); if latency exceeds threshold, use precomputed summary tables
- **Fr-018**: System MUST use pagination for large result sets (e.g., affiliate lists); default 50 items per page, max 100
- **Fr-019**: System MUST include `X-Response-Time` header in all dashboard responses for monitoring
- **Fr-020**: System MUST avoid N+1 query patterns; use JOIN or LEFT JOIN for related data, not sequential queries

### API Response Contract

- **Fr-021**: System MUST return all API responses in standardized format: `{ success: boolean, data: object | null, error: { code: string, message: string } | null }`
- **Fr-022**: System MUST include `correlation_id` in response headers for request tracing
- **Fr-023**: System MUST return HTTP 303 for invalid date ranges with specific error message (e.g., "Invalid date range: end_date must be after start_date")
- **Fr-024**: System MUST cache read-only responses (if implementing caching) with appropriate Cache-Control headers; cache expiry default 5 minutes for summary data

### Logging & Audit

- **Fr-025**: System MUST log all dashboard access with structured logging (service, timestamp, user_id, workspace_id, correlation_id, endpoint, response_time)
- **Fr-026**: System MUST log authorization failures with failure reason (e.g., "PERMISSION_DENIED: reporting.view required")
- **Fr-027**: System MUST NOT log sensitive financial payloads; log only metric names, timestamps, and query parameters
- **Fr-028**: System MUST support audit trail export via separate compliance endpoint (future stage)

### Frontend Rendering

- **Fr-029**: Frontend MUST display all metrics in "Commercial Health" card with clear labels (e.g., "ACTIVE Licenses", "This Month Revenue")
- **Fr-030**: Frontend MUST display geographic data in sortable table with columns: Country, Revenue, License Count, YoY Growth %
- **Fr-031**: Frontend MUST display affiliate data in sortable leaderboard with columns: Rank, Affiliate Name, Usages, Commission, Status
- **Fr-032**: Frontend MUST provide date range picker for filtering (default: last 30 days for metrics, last 12 months for trends)
- **Fr-033**: Frontend MUST display loading state while fetching data and error state if API returns error
- **Fr-034**: Frontend MUST include "Export as CSV" button for all tabular data (geographic, affiliate lists)

### Error Handling

- **Fr-035**: System MUST return 401 if user session expired or authentication failed
- **Fr-036**: System MUST return 403 if user lacks `reporting.view` permission
- **Fr-037**: System MUST return 423 if MMC workspace license is not ACTIVE
- **Fr-038**: System MUST return 500 with generic error message if database query fails; specific error logged (not exposed to client)

---

## Key Entities

- **Dashboard Metrics**: Aggregated insight objects (license counts, revenue totals, affiliate performance) computed from master_db
- **License Summary**: Snapshot of license states and counts at dashboard query time (queries licenses table)
- **Revenue Record**: Financial transaction entry linking to product, affiliate (if applicable), and billing address (from revenue_records table)
- **Affiliate Performance**: Aggregated usage and commission metrics per affiliate over time period
- **Geographic Distribution**: Country-level aggregation of revenue and license activity
- **Monthly Trend**: Precomputed or calculated monthly snapshots of license count and revenue for growth visualization

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: Dashboard displays accurate license count breakdowns (by status) matching licenses table within <300ms query latency
- **SC-002**: Revenue summary calculations (total, monthly, annual, by product) match pre-agreed financial reconciliation within ±0.01 USD for 100-entry test dataset
- **SC-003**: Geographic distribution correctly groups revenue by country with no double-counting; query completes within 300ms for 1000+ revenue records
- **SC-004**: Affiliate performance metrics (top affiliates by commission, total usages) match precomputed values; query latency <300ms with 100+ affiliates
- **SC-005**: 100% of unauthorized access attempts (missing reporting.view permission) return 403 Forbidden within 50ms (no data leakage)
- **SC-006**: Zero queries to tenant databases observed in 100+ dashboard access test runs; 100% of queries isolated to master_db
- **SC-007**: Dashboard response time remains <300ms under concurrent load (50 simultaneous dashboard viewers); average response time <150ms
- **SC-008**: All dashboard access logged with correlation_id, user_id, workspace_id, timestamp; audit trail is complete and queryable
- **SC-009**: No sensitive financial payloads or PII exposed in logs or error messages; compliance checklist passes manual review
- **SC-010**: CSV export files contain all rows and columns matching on-screen display with no truncation or formatting errors; exports completed within 2 seconds for <10K rows

### Quality Gates

- **QG-001**: All functional requirements have passing unit tests (>90% coverage for dashboard domain logic)
- **QG-002**: All dashboard endpoints have passing integration tests with real (test) master_db queries
- **QG-003**: Permission enforcement tested via integration tests (verify 403 for missing reporting.view, 423 for inactive license)
- **QG-004**: Query performance tested; all endpoints confirmed <300ms (average <150ms) under normal load
- **QG-005**: No cross-tenant data leakage in 100+ test scenarios; audit review confirms isolation intact
- **QG-006**: Schema migration (if summary tables added) passes forward-compatibility validation per ADR-0008
- **QG-007**: Frontend component tests verify all metrics render correctly; CSV export functionality tested end-to-end
- **QG-008**: Linting and type checking pass (TypeScript strict mode for API and frontend code)

---

## Assumptions

- **Revenue System Enabled**: Assumes `revenue_records` table exists and is populated by payment system; if payment system disabled, revenue section displays "Not Enabled" (per stage spec)
- **Billing Country Provided**: Assumes revenue_records includes `billing_country` field; if not populated, geographic aggregation returns "Unknown" bucket
- **Indexed Columns Available**: Assumes master_db has indexes on `licenses.status`, `revenue_records.created_at`, `affiliate_usages.affiliate_id`, `revenue_records.product_id`; performance requirements depend on these indexes
- **No Client-Side Aggregation**: All calculations performed server-side; frontend receives fully computed metrics ready for display
- **Timestamp Normalization**: All times in ISO 8601 format, UTC-normalized by backend; frontend displays in user's local timezone (if supported by MMC frontend layer)
- **Affiliate Commission Model Stable**: Assumes affiliate_usages.commission_amount is final; no retroactive recalculation of commissions
- **No Real-Time Revenue Updates**: Revenue records are eventually-consistent; dashboard may be 1-2 hours behind live financial system
- **MMC Workspace Always Active**: MMC platform workspace must never be archived or deleted; license checks enforce this
- **Permission Model Inherited**: Permissions (reporting.view) defined in STAGE_14_MMC_MEMBERS; assumes role-based access control implementation available

---

## Out of Scope (Explicitly Not Included)

- **Tenant-Level Analytics**: No per-workspace drilldown; MMC Dashboard is platform-level only
- **Real-Time Financial Recalculation**: Heavy aggregations moved to scheduled worker jobs with materialized views
- **Mutation Operations**: No license changes, affiliate modifications, or revenue adjustments from dashboard
- **Advanced Visualization**: Initial MVP is tables and basic charts; advanced visualizations (heatmaps, 3D graphs) are future stages
- **Custom Report Builder**: No ad-hoc query or report generation in this stage; fixed dashboard sections only
- **Cross-Tenant Benchmarking**: Comparison of tenant performance against peers not allowed (multi-tenancy isolation)
- **Predictive Analytics**: No forecasting, trend extrapolation, or ML-based anomaly detection
- **Real-Time Webhooks**: No event streams or live updates; dashboard is pull-based (refresh on user request)
- **Mobile Optimization**: Initial MVP assumes desktop/tablet access; mobile optimization is future stage
- **Integrations**: No export to Salesforce, Tableau, or other platforms in this stage

---

## Migration & Dependencies

**Depends On**:

- STAGE_14_MMC_MEMBERS (permission system with reporting.view role)
- STAGE_13_AFFILIATES (affiliate_usages table and aggregation logic)
- License Engine (licenses table populated and accessible)
- Revenue Records infrastructure (revenue_records table and payment system integration)
- Master DB schema (products, licenses, revenue_records, affiliates, affiliate_usages tables indexed)

**Schema Changes**:

- No breaking changes to existing tables
- Optional addition of summary tables for performance (revenue_summary_monthly, affiliate_summary_monthly)
- All new tables are additive; no column modifications to existing production tables

**Migration Strategy**:

- If summary tables added: initial migration creates empty tables; nightly worker job populates retroactively over 7 days
- Backward compatible: dashboard works with or without summary tables (uses raw queries if summaries unavailable)
- Forward compatible: queries include fallback logic for future schema evolution

---

## Testing Strategy

### Unit Tests

- **UT-001**: Revenue calculation logic (total, monthly, by product) returns correct sums with mock data
- **UT-002**: License count aggregation (by status) matches expected counts; handles deleted_at NULL filtering
- **UT-003**: Permission check utility returns true/false for reporting.view permission correctly
- **UT-004**: Date range validation (end_date > start_date); rejects invalid ranges with appropriate error
- **UT-005**: Geographic aggregation groups revenue correctly by country_code with no duplicates
- **UT-006**: Affiliate commission summation correctly calculates total commission and usage count from fixture data
- **UT-007**: Metric formatting (currency, percentages, large numbers) displays correctly with comma separators and precision

### Integration Tests

- **IT-001**: Dashboard summary endpoint returns correct license counts querying real (test) master_db; response time <300ms
- **IT-002**: Revenue endpoints return calculated values matching pre-agreed test fixtures; response contract matches spec
- **IT-003**: Geographic endpoint groups diverse country data correctly; no country appears twice in response
- **IT-004**: Affiliate endpoint ranks affiliates correctly by commission; pagination works (default 50, max 100)
- **IT-005**: Permission enforcement: unauthorized requests (lacking reporting.view) return 403; authorized requests return 200
- **IT-006**: License validation: if MMC workspace license is not ACTIVE, dashboard returns 423; if ACTIVE, proceeds to query
- **IT-007**: Concurrent load test: 50 simultaneous requests achieve average response time <150ms, max <300ms
- **IT-008**: Audit logging: all successful dashboard queries logged with correlation_id, user_id, workspace_id, timestamp
- **IT-009**: Authorization failure logging: failed access attempts logged with reason (PERMISSION_DENIED, LICENSE_INVALID)

### Contract Tests (Response Format)

- **CT-001**: All endpoints return standardized response format: `{ success: boolean, data: object | null, error: null | { code, message } }`
- **CT-002**: Success responses include correlation_id in header and request_id in body (if applicable)
- **CT-003**: Error responses include descriptive error code (e.g., "PERMISSION_DENIED", "LICENSE_INACTIVE") and user-friendly message
- **CT-004**: Timestamp fields use ISO 8601 format with timezone info; no ambiguity about UTC vs local time

### Isolation Tests (Critical)

- **IsT-001**: Dashboard queries never access tenant databases; audit query log confirms 100% master_db-only access
- **IsT-002**: No cross-tenant joins executed; revenue and license for tenant A never combined with tenant B data
- **IsT-003**: Revenue records from different products don't cross-contaminate in per-product breakdown; GROUP BY ensures isolation
- **IsT-004**: Affiliate data for different affiliates not mixed; affiliate_usages grouped correctly by affiliate_id

### Performance Tests

- **PT-001**: License summary query (<300ms): 1000+ licenses in test DB; query returns count in <300ms
- **PT-002**: Revenue time-range query (<300ms): 10,000 revenue records; monthly aggregation completes <300ms
- **PT-003**: Geographic grouping (<300ms): 1000+ revenue records across 50+ countries; query <300ms
- **PT-004**: Affiliate aggregation (<300ms): 100 affiliates with 1000+ usages; top 10 affiliates query <300ms
- **PT-005**: Concurrent access: 50 simultaneous requests all complete <300ms; no query timeout or connection pool exhaustion

### Snapshot Tests

- **ST-001**: Revenue calculation snapshot: Compare calculated revenue against golden snapshot for consistency across code changes
- **ST-002**: License breakdown snapshot: Verify license count distribution (ACTIVE, SOFT_LOCKED, ARCHIVED) against known-good snapshot
- **ST-003**: Geographic aggregation snapshot: Confirm country grouping and revenue distribution matches expected output
- **ST-004**: CSV export snapshot: Verify exported file content (headers, data rows, formatting) against golden snapshot

---

## Implementation Notes

### Architecture Patterns

1. **Read-Only Query Pattern**: All dashboard endpoints execute SELECT queries only; no UPDATE, INSERT, DELETE allowed
2. **Indexed Access Pattern**: All queries explicitly use indexed columns; query planner should never recommend sequential scan
3. **Aggregation Layer**: Heavy computations delegated to precomputed summary tables (updated by worker job); real-time queries use indexed aggregations only
4. **Middleware Stack**: License → Permission → Query execution order enforced via middleware composition
5. **Response Caching**: Consider 5-minute cache on dashboard summary (low-frequency read); longer caches for trend data (precomputed)

### Frontend Architecture

- **Stateless Components**: Dashboard sections (Commercial Health, Geographic, Affiliate) implemented as lightweight presentational components
- **Data Fetching**: Centralized API client handles all dashboard requests; no data duplication across components
- **Error Boundaries**: Graceful fallback if individual section fails to load; don't block entire dashboard
- **Responsive Layout**: Dashboard adapts to MMC workspace theme tokens (shadcn-vue + Tailwind v4)

### Logging Strategy

- **Request-Level Logging**: Every dashboard endpoint logs method, path, query parameters, response status, response_time
- **Error Logging**: Failed queries logged with correlation_id and specific error reason (e.g., "PERMISSION_DENIED", "LICENSE_LOCKED")
- **Audit Events**: Successful dashboard access for reporting.view permission logged as AUDIT_DASHBOARD_ACCESS
- **PII Protection**: No user secrets, affiliate API keys, or detailed addresses logged; log only aggregated metrics

---

## Compliance & Governance

- **GDPR Compliance**: Dashboard aggregates no personal data; no PII in metrics or exports (confirmed in security review)
- **Financial Data Sensitivity**: Revenue data classified as internal confidential; access restricted to reporting.view role
- **Audit Trail**: All dashboard access logged for compliance review; audit logs retained per data retention policy
- **Constitutional Alignment**: Dashboard preserves database-per-tenant isolation, enforces license middleware, uses no global DB singleton

---

## Future Enhancements (Post-MVP)

- **Advanced Visualizations**: Map view for geographic distribution, 3D trend charts
- **Custom Report Builder**: Ad-hoc query interface for power users (requires strict permission controls)
- **Real-Time Dashboard**: WebSocket subscription for live metrics (requires caching and materialized view strategy)
- **Alerting**: Automated notifications for anomalies (e.g., sudden revenue spike/drop, license threshold warning)
- **Predictive Analytics**: Trend forecasting, customer churn risk scoring
- **Mobile Optimization**: Responsive design for iOS/Android tablet access
- **Scheduled Reports**: Email delivery of dashboard snapshot on regular schedule
- **Integration Exports**: One-click export to Salesforce, Tableau, Google Sheets
