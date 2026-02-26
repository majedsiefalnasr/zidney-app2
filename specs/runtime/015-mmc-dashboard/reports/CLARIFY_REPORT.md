# Clarification Report – STAGE_15_MMC_DASHBOARD

**Generated:** 2026-02-26T00:00:00Z  
**Stage:** MMC Dashboard  
**Phase:** 02_PLATFORM_MMC  
**Branch:** 015-mmc-dashboard

---

## Overview

Five critical clarifications resolved to refine specification before technical planning. All ambiguities locked; zero remaining unknowns.

---

## Clarifications Resolved

### 1. Revenue Calculation Precision & Rounding

**Ambiguity:**  
Specification defined ±0.01 USD tolerance but left unclear:

- Apply per-transaction or aggregate?
- Which rounding method (banker's, standard, truncation)?
- Sub-cent precision in database?

**Decision: C – Aggregate rounding with standard round-half-up at display**

- **Database storage:** Full precision (no rounding)
- **Display layer:** Round to 2 decimals using standard rounding (round-half-up)
- **Applies to:** All monetary displays (revenue summaries, MRR, commission)
- **Why:** Financial industry standard; minimizes cumulative rounding errors; maintains audit accuracy

**Impact on spec:**

- SC-002 (revenue accuracy): Updated to "aggregate rounding to 2 decimal places at display; database stores full precision"
- FR-005 (revenue display): All displays use banker's round function
- API response format: MoneyDisplay type enforces 2-decimal rounding

---

### 2. Affiliate Commission Rounding Method

**Ambiguity:**  
Commission aggregation strategy undefined:

- Round per-line before sum or after sum?
- Precision of affiliate_usages.commission_amount?
- Calculate on net or gross revenue?

**Decision: B – Sum with full precision, round final total at display**

- **Database:** affiliate_usages.commission_amount remains source of truth (stores full precision)
- **Aggregation:** SUM(commission_amount) across all affiliates, then round once at display (2 decimals)
- **Display:** Standard rounding applied to final sum only
- **Why:** Matches revenue rounding pattern; prevents cascading rounding errors; maintains financial accuracy

**Impact on spec:**

- FR-024 (commission aggregation): Specifies sequence: query full precision, sum all rows, round for display
- FR-026 (commission accuracy): ±0.00 USD now verifiable with aggregate rounding
- Test scenario T-027 (commission isolation): Validates no cross-affiliate contamination in sum

---

### 3. Concurrent Load Definition & Caching Strategy

**Ambiguity:**  
"100+ simultaneous sessions" could mean requests or users; caching strategy absent:

- Does it mean 100 concurrent API requests or 100 concurrent users?
- Should dashboard cache? If yes, invalidation strategy?
- Which endpoints must maintain <300ms under load?

**Decision: B – 100 concurrent users; tiered caching; all endpoints <300ms hard guarantee**

- **Load definition:** 100 concurrent active users (browser sessions or WebSocket connections)
- **Caching strategy:** Tiered approach:
  - **Summary dashboard:** Redis cache with 5-minute TTL (summary data is stable)
  - **Revenue breakdown:** Fresh indexed query (operational accuracy needed)
  - **Geographic distribution:** Fresh indexed query (operational accuracy)
  - **Affiliate leaderboard:** Cached (affiliate rankings change infrequently)
  - **Trends:** Cached (historical data immutable)
  - **Export:** Always fresh query (financial record integrity)
- **Performance guarantee:** Hard <300ms on all 6 endpoints (not 95th percentile) under 100 concurrent user load
- **Why:** Balances performance with freshness; fresh queries for operational data; cache for historical/immutable data; stability-first approach

**Impact on spec:**

- SC-007: Updated to list 100 concurrent user target
- FR-013: Caching strategy documented with specific endpoints and TTLs
- Performance requirements (PT-001-005): All include concurrent load testing with k6 or similar
- Architecture section: Added "Caching Strategy" subsection with Redis configuration

---

### 4. Export File Size Limits & Materialized View Refresh

**Ambiguity:**  
Export constraints and data freshness undefined:

- Max rows per export file?
- Behavior on large exports (paginate, queue, reject)?
- Should exports use cached data or always fresh query?

**Decision: B – Max 50,000 rows; 413 on larger requests; always fresh query**

- **Export size limit:** 50,000 rows per file (balances compliance export needs with memory safety)
- **Over-limit behavior:** Return HTTP 413 Payload Too Large with message suggesting date/country/product filters
- **Data freshness:** Exports always execute fresh query (never from cache) to ensure financial data integrity
- **Pagination:** Clients must filter dataset to <50k rows; no server-side pagination for exports
- **Why:** 50k rows is typical for compliance report exports; prevents memory exhaustion; fresh queries ensure audit-trail accuracy

**Impact on spec:**

- EC-009: "Export >50k rows triggers 413; user must filter"
- FR-035: "All exports execute fresh query; never cached"
- API endpoints: GET /export returns explicit 413 error response specification
- Error handling (EH-001): Documented 413 error code and user guidance

---

### 5. User Role Hierarchy & Data Visibility Scope

**Ambiguity:**  
Role-based view filtering undefined:

- Can members see all workspaces or only their own?
- Cross-workspace aggregations visible to whom?
- Role hierarchy or independent permission sets?

**Decision: A – Role hierarchy with workspace-scoped visibility**

- **Role hierarchy:** `platform_owner ⊃ member` (owner superset of member)
- **platform_owner:** Views all workspaces + cross-workspace aggregations (commercial health, geographic distribution, growth trends across all)
- **member with `reporting.view`:** Views only own workspace metrics (all queries filtered by workspace_id at database level)
- **Query enforcement:** Workspace filter applied at SQL WHERE clause (not application layer)
- **Why:** Maintains database-per-tenant isolation; supports operator oversight; prevents accidental cross-workspace data leaks

**Impact on spec:**

- FR-009: Updated to specify `platform_owner` scope = all workspaces; member scope = own workspace
- Middleware section: Added "Role-based Query Filtering" subsection documenting WHERE clause injection by role
- Query templates: Each endpoint includes role-based filtering in example SQL
- Isolation tests (I-T-001-009): Include role-boundary tests (member cannot see other workspace data)

---

## Summary Table

| #   | Ambiguity                  | Decision                                                               | Impact                                             | Risk Level |
| --- | -------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------- | ---------- |
| 1   | Revenue rounding precision | Aggregate rounding at display with standard round-half-up              | All monetary displays; SC-002, accounting tests    | LOW        |
| 2   | Commission aggregation     | Sum full precision, round final at display                             | Affiliate metrics; FR-024, accuracy tests          | LOW        |
| 3   | Load definition & caching  | 100 concurrent users; tiered caching (5min TTL); <300ms hard guarantee | Performance strategy; k6 benchmarks; all endpoints | MEDIUM     |
| 4   | Export limits              | Max 50k rows; 413 on larger; always fresh query                        | Export endpoints; error handling; EC-009           | LOW        |
| 5   | Role hierarchy             | platform_owner ⊃ member; workspace-scoped queries                      | Security; multi-tenancy; WHERE clause injection    | HIGH       |

---

## Quality Gate Verification

**All clarifications are:**

✅ **Documented & Traceable** — All decisions recorded in spec.md § Clarifications  
✅ **Actionable & Concrete** — Each decision includes implementation guidance (rounding function, cache TTL, query WHERE clause, etc.)  
✅ **Tested & Verifiable** — Corresponding test scenarios updated to verify each decision  
✅ **Risk-aware** — No unresolved ambiguities; high-risk decisions (role hierarchy, export freshness) documented as tests  
✅ **Compliant** — All decisions align with Zidney constitutional constraints (multi-tenancy isolation, middleware order, structured logging)

---

## Specification Status After Clarifications

| Category                  | Status                                                      |
| ------------------------- | ----------------------------------------------------------- |
| Spec completeness         | ✅ Complete (1152 lines + clarifications)                   |
| Ambiguity scan            | ✅ All 5 critical areas resolved                            |
| Remaining unknowns        | ✅ Zero                                                     |
| Test strategy alignment   | ✅ All 48 scenarios updated with clarification details      |
| Constitutional compliance | ✅ Verified (isolation, middleware, caching, audit logging) |

---

## Next Steps

**Ready for:** Step 3 – Plan (speckit.plan) to generate:

- `plan.md` – Technical design and architecture
- `data-model.md` – Master_db schema requirements
- `research.md` – Investigation of caching strategy options
- `contracts/` – API response contracts
- `quickstart.md` – Implementation guide for developers

All clarifications locked. No additional ambiguity resolution needed.
