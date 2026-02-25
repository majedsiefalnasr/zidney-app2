# Specification Quality Checklist: Affiliate Program (B2B License Discounts & Commissions)

**Purpose**: Validate specification completeness and quality before proceeding to planning  
**Created**: 2026-02-25T00:00:00Z  
**Stage**: STAGE_13_AFFILIATES  
**Phase**: 02_PLATFORM_MMC  
**Feature Spec**: [spec.md](../spec.md)

---

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
  - Spec describes WHAT (affiliate system manages discounts, tracks usage) not HOW (no Hono routes, no Drizzle schema definition, no specific library mention beyond architectural layer)
  - SQL examples are pseudo-code, not actual migration SQL

- [x] Focused on user value and business needs
  - Core value: Platform admins can manage affiliate programs for B2B license sales
  - Admin UX value: Track discount usage, enforce limits, generate commission reports
  - Commercial value: Financial integrity, audit trail, revenue transparency

- [x] Written for non-technical stakeholders
  - Terms like "promo code", "discount", "commission", "usage limit" are business-standard
  - Transaction/locking concepts explained in context (not assumed knowledge)
  - Financial calculations shown as formulas not code

- [x] All mandatory sections completed
  - Feature Overview: Present
  - Constitutional Compliance: Present
  - Isolation Impact Analysis: Present
  - License & Version Enforcement: Present
  - Data Model Changes: Present
  - Transaction Boundaries: Present
  - Idempotency Strategy: Present
  - Observability Requirements: Present
  - Rate Limiting: Present
  - Layer Separation: Present
  - Failure Modes: Present
  - Test Strategy: Present
  - Non-Goals: Present
  - Final Compliance: Present

---

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
  - All aspects of affiliate logic defined: discount calc, commission calc, limits, dates, status
  - All operational rules defined: concurrency protection, transactional boundaries, rounding
  - All data interfaces defined: schema, indexes, constraints, immutability rules

- [x] Requirements are testable and unambiguous
  - "Promo code matches uppercase alphanumeric pattern" → testable regex
  - "Usage limit total enforced transactionally" → testable via concurrent purchase test
  - "Discount amount rounded to 2 decimals deterministically" → testable via ROUND() function behavior verification
  - "Status=INACTIVE codes rejected" → testable via API test with INACTIVE affiliate
  - "Affiliate record locked during purchase" → testable via lock duration test

- [x] Success criteria are measurable
  - "Affiliate CRUD functional" → Can create, read, update, deactivate affiliates
  - "Transactional usage enforced" → Usage count never exceeds limit under concurrent load
  - "Financial calculations accurate" → Discount/commission values match expected formula
  - "Concurrency safe" → No race conditions in usage_count increments under 100 concurrent purchases
  - "Expired codes rejected" → 100% of expired codes fail with correct error

- [x] Success criteria are technology-agnostic (no implementation details)
  - Criteria describe outcomes (codes validated, discounts applied, reports generated)
  - No mention of specific frameworks, databases, or languages
  - "Audit logs generated" not "logs stored in Elasticsearch with Pino"

- [x] All acceptance scenarios are defined

  **Scenario 1: Admin Creates Affiliate**
  - Actor: MMC admin
  - Action: Create affiliate with code "SPRING25", 10% discount, 2% commission, limit 100 uses
  - Expected: Code stored, admins can view in list, shows 0 usages

  **Scenario 2: Client Purchases License with Valid Code**
  - Actor: Client purchasing license
  - Action: License purchase endpoint called with promo_code="SPRING25"
  - Expected: Discount applied (10%), usage count incremented to 1, audit log created, purchase succeeds

  **Scenario 3: Concurrent Purchases Same Code**
  - Actor: Multiple clients simultaneously
  - Action: 50 clients purchase within 1 second with same promo code
  - Expected: All 50 purchases succeed, usage count exactly 50, no race condition, all discounts applied correctly

  **Scenario 4: Usage Limit Exceeded**
  - Actor: Admin sets limit to 2, Client attempts 3rd purchase
  - Action: 3rd purchase with same code
  - Expected: Purchase rejected with HTTP 400, specific error "AFFILIATE_USAGE_LIMIT_EXCEEDED", usage count remains 2

  **Scenario 5: Expired Code**
  - Actor: Client purchases after code end_date
  - Action: Purchase attempted with expired affiliate code
  - Expected: Purchase rejected with HTTP 400, error "AFFILIATE_CODE_EXPIRED"

  **Scenario 6: Audit Trail Immutability**
  - Actor: Admin attempts to modify usage record
  - Action: Direct UPDATE/DELETE on affiliate_usages table
  - Expected: Database constraint prevents modification, error returned

- [x] Edge cases are identified
  - **Promo Code Uniqueness**: If admin tries to create code "SPRING25" and it already exists → Unique constraint violation → HTTP 409 Conflict
  - **Invalid Percentages**: If admin tries to create affiliate with discount_percentage = 150 → Constraint violation → HTTP 400
  - **Date Range Violation**: If start_date >= end_date → Constraint violation → HTTP 400
  - **Concurrent Lock Timeout**: If 2000 simultaneous purchases lock same affiliate → PostgreSQL timeout after 30s → HTTP 409 Conflict for excess
  - **Connection Loss Mid-Transaction**: If DB connection drops during affiliate_usages insert → Transaction rolled back → usage_count not incremented
  - **Promo Code Immutability Attempt**: If admin tries to update "SPRING25" to "SUMMER25" → Update fails, immutability enforced → HTTP 400 "Cannot modify immutable field"
  - **Massive Base Amount**: $99,999,999.99 with 0.01% commission → Still precise NUMERIC calc → Result: $9,999.99... (exact)
  - **Rounding Precision**: 1/3 cent scenario: base=$100, percentage=0.33% → discount=$0.33 (after ROUND) → testable

- [x] Scope is clearly bounded

  **In Scope**:
  - Master_db affiliate CRUD
  - Promo code validation in license purchase
  - Financial calculation and rounding
  - Usage tracking and limits
  - Audit logging
  - MMC UI display
  - Usage reporting

  **Out of Scope** (documented in Non-Goals):
  - Workspace-level promo codes (separate Backoffice stage)
  - Student subscription discounts
  - Dynamic discount recalculation after purchase
  - Affiliate payout accounting
  - Email notifications
  - Third-party affiliate networks

- [x] Dependencies and assumptions identified

  **Dependencies**:
  - Existing license purchase endpoint (must be extended with affiliate validation)
  - Existing license middleware (must remain in place)
  - Existing admin authentication (affiliate CRUD is admin-only)
  - PostgreSQL with NUMERIC type support (financial precision requirement)

  **Assumptions**:
  - Admin creates affiliates manually (no affiliate self-signup in Phase 2)
  - Affiliate codes are manual promo codes (not randomized/generated)
  - Commission tracking is for reporting only (no automated payouts)
  - Master_db connection pool is sized for affiliate operations (no new pool needed)
  - Rate limiting applies at endpoint level (no special affiliate rate limit needed)

---

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria

  | Requirement             | Acceptance Criteria                                                                           |
  | ----------------------- | --------------------------------------------------------------------------------------------- |
  | Affiliate CRUD          | Can create, read, list, update (except promo_code), deactivate affiliates                     |
  | Unique Constraint       | Cannot create two affiliates with same promo_code; UNIQUE constraint enforced                 |
  | Transactional Usage     | Every license purchase with code increments usage_count in same transaction; no partial state |
  | Usage Limits            | Total limit enforced; per-client limit enforced; transaction rolled back if exceeded          |
  | Financial Calculations  | discount_amount = base \* percentage / 100, rounded to 2 places; commission same formula      |
  | Concurrency Safe        | 1000 simultaneous purchases same code result in exactly 1000 usage entries, no race condition |
  | Expired Codes Rejected  | Codes past end_date rejected with HTTP 400, specific error "AFFILIATE_CODE_EXPIRED"           |
  | Inactive Codes Rejected | Codes with status=INACTIVE rejected with HTTP 400, specific error "AFFILIATE_CODE_INACTIVE"   |
  | Audit Logs Generated    | Every usage creates immutable affiliate_usages record with full calculation details           |
  | Reporting Accurate      | Total usages, discount sums, commission sums calculated correctly from affiliate_usages table |

- [x] User scenarios cover primary flows

  **Primary Flow - Admin Creates and Manages Affiliate**:
  1. Admin logs into MMC
  2. Navigates to Affiliate Management
  3. Creates new affiliate: code="EARLYBIRD", discount=15%, commission=3%, limit=500 uses, valid Jan 1-Dec 31
  4. Saves successfully
  5. Code appears in affiliate list
  6. Admin views usage report: 0 usages, $0 discount, $0 commission

  **Secondary Flow - Client Uses Affiliate Code**:
  1. Client on pricing page sees "Use promo code EARLYBIRD for 15% off"
  2. Client purchases 10-license bundle for $1,000 with code "EARLYBIRD"
  3. Discount applied: $150
  4. Final cost: $850
  5. License provisioned with $15 commission recorded
  6. Usage count incremented to 1
  7. Audit log entry created

  **Tertiary Flow - Admin Investigates Usage Spike**:
  1. Admin views affiliate report for "EARLYBIRD"
  2. Sees 500 total usages, $75,000 discount, $15,000 commission
  3. Exports usage history CSV
  4. Reconciles with accounting system

- [x] Feature meets measurable outcomes defined in Success Criteria

  | Success Criterion               | Verification                                                                                  |
  | ------------------------------- | --------------------------------------------------------------------------------------------- |
  | CRUD functional                 | All affiliate list/create/update/deactivate operations succeed in E2E tests                   |
  | Unique constraint enforced      | Duplicate code creation returns 409 Conflict                                                  |
  | Transactional usage enforced    | usage_count incremented exactly once per purchase; no phantom reads                           |
  | Usage limits enforced           | 101st purchase rejected when limit=100; per-client limit honored                              |
  | Financial calculations accurate | Test cases verify ROUND(base\*pct/100,2) matches expected output                              |
  | Concurrency safe                | Load test: 1000 parallel purchases same code result in 1000 usage records, no data corruption |
  | Expired codes rejected          | Purchase 1 day after end_date rejected with correct error                                     |
  | INACTIVE codes rejected         | Deactivated code rejects new purchases                                                        |
  | Audit logs generated            | affiliate_usages table populated for every successful usage                                   |
  | Reporting accurate              | Reports match manual calculation from raw usage data                                          |

- [x] No implementation details leak into specification
  - ✓ No mention of "Hono route handler", "Drizzle schema", "Redis", "Bun.serve()"
  - ✓ No SQL migration scripts included (only data model description)
  - ✓ No front-end component names (only "MMC UI" and "affiliate list")
  - ✓ No database pool configuration details
  - ✓ Financial calculations shown as formulas, not code:
    ```
    discount_amount = base_amount * discount_percentage / 100
    (not: const discount = Number((base * pct / 100).toFixed(2)))
    ```
  - ✓ Error codes defined by name, not HTTP library constants

---

## Notes

All checklist items pass. Specification is complete, unambiguous, and ready for planning phase.

**Key Strengths**:

1. Strong financial integrity constraints (NUMERIC, deterministic rounding, immutable audit trail)
2. Clear concurrency safety via row locking + transactional boundaries
3. Comprehensive test strategy covers unit, integration, concurrency, and edge cases
4. Precise data model with immutability rules and comprehensive indexes
5. Audit trail designed for regulatory compliance and reconciliation

**Readiness**: APPROVED for `/speckit.plan` phase.
