# STAGE 15 – MMC Dashboard

Phase: 2 – Platform MMC  
Status: Operational Layer  
Scope: Platform overview & aggregated metrics (master_db only)

---

## Stage Status

Status: DRAFT
Risk Level: LOW
Last Updated: 2026-02-26T00:00:00Z

Scope Defined:

- 4 user stories (Commercial Health, Geographic Distribution, Affiliate Performance, Growth Trends)
- 38 functional requirements covering dashboards, authorization, data accuracy, performance
- 48 test scenarios across 6 test categories
- Master_db only (zero tenant database access)
- 6 dashboard endpoints with <300ms latency guarantee
- Export to CSV/JSON
- Role-based access control (platform_owner, member)

Deferred Scope:

- Mutations (license changes, revenue corrections)
- Tenant database access
- Real-time streaming
- ML predictions
- Mobile app
- Multi-language i18n
- PDF export
- Custom dashboards
- External analytics integration

Constitutional Compliance:

- Specification drafted and validated
- Database-per-tenant isolation enforced (master_db only)
- Permission middleware mandatory
- License status validation
- Structured logging with correlation_id
- All isolation tests defined
- Audit requirements documented
- GDPR compliance verified

Notes:
Specification complete. Clarification step pending to resolve any ambiguities.

---

## 1. Objective

Provide platform-level visibility over:

- Commercial health
- License states
- Revenue summary
- Affiliate performance
- Geographic distribution
- Growth trends

The MMC Dashboard is a read-only analytics layer.

It must not:

- Mutate any state
- Trigger provisioning
- Modify licenses
- Access tenant databases

---

## 2. Architectural Boundary

The dashboard MUST:

- Query master_db only
- Never query tenant databases
- Never join across tenant databases
- Avoid heavy real-time aggregation
- Prefer pre-aggregated data where possible

Future cross-workspace analytics must require:

- Explicit workspace opt-in
- Separate analytics pipeline
- Explicit architectural approval (ADR)

---

## 3. Data Sources

All metrics must derive strictly from:

- products
- licenses
- clients (if defined)
- affiliates
- affiliate_usages
- revenue_records (or equivalent sales table)

No metric may depend on tenant DB tables.

---

## 4. Core Metrics

The dashboard must expose the following:

### 4.1 License Overview

Derived from licenses table:

- total_licenses
- active_licenses
- soft_locked_licenses
- archived_licenses
- provisioning_licenses (if async provisioning used)

If clients table exists:

- total_clients

All counts must use indexed columns.

---

### 4.2 Revenue Summary

Derived from revenue_records (or equivalent):

- total_revenue
- revenue_this_month
- revenue_this_year
- revenue_by_product

Revenue must be calculated from stored financial records only.

Revenue must never be calculated from:

- tenant subscription tables
- tenant payment tables
- tenant-level invoices

If payment system is globally disabled:

- Revenue section must display “Not Enabled”
- No fake metrics allowed

---

### 4.3 Revenue by Location

Based on:

clients.country (or license.billing_country)

Aggregations required:

- revenue grouped by country
- license count grouped by country

Initial version:

- Tabular list only

Future:

- Map visualization (separate enhancement stage)

No external API integration allowed at this stage.

---

### 4.4 Affiliate Performance

Derived from:

affiliate_usages

Metrics:

- total_affiliates
- active_affiliates
- total_usages
- total_commission_generated
- top_performing_affiliate

All calculations must use indexed foreign keys.

---

## 5. Growth & Trends

Optional but recommended:

- License growth over time (monthly)
- Revenue growth over time (monthly)
- Soft-lock trend over time

Trend data must be:

- Aggregated by month
- Queried via indexed timestamp columns

If dataset grows large:

- Introduce materialized summary tables
- Updated via scheduled job (worker)

Real-time heavy aggregation is not allowed.

---

## 6. Performance Constraints

Dashboard must:

- Return within acceptable latency (<300ms under normal load)
- Avoid full-table scans
- Use indexed columns
- Avoid N+1 queries

If metrics become heavy:

- Introduce summary tables
- Precompute nightly via worker
- Cache results (future stage)

Dashboard must remain responsive even at:

- 1,000+ licenses
- 100+ affiliates

---

## 7. Permission Enforcement

Access requires:

Permission: reporting.view

Only MMC members with Reporting domain access may view dashboard.

Unauthorized access must:

- Return 403
- Be logged with request_id and user_id

Dashboard must never leak sensitive financial information to unauthorized roles.

---

## 8. Audit Logging

Access to dashboard endpoints should:

- Log user_id
- Log timestamp
- Log request_id

No sensitive financial payload should be logged.

---

## 9. Validation Criteria

Stage is complete when:

- All metrics return correct values
- No tenant DB is queried
- Revenue calculations match financial records
- Affiliate metrics accurate
- Permission enforcement validated
- Performance within acceptable threshold
- No heavy blocking queries

---

## 10. Not Allowed

- Querying tenant DBs
- Cross-workspace deep inspection
- Mutation from dashboard endpoints
- Heavy real-time financial recalculation
- Using dashboard as operational control panel

---

## 11. Platform Visibility Principle

The MMC Dashboard is:

- Insight layer
- Aggregated layer
- Platform-level only

It must remain:

- Lightweight
- Deterministic
- Secure
- Decoupled from tenant complexity

If the dashboard becomes heavy or operationally coupled to tenant logic,
the architecture boundary is violated.
