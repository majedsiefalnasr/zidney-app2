# Research Findings: Affiliate Program Implementation

**Date**: 2026-02-25 | **Feature**: STAGE_13_AFFILIATES | **Phase**: 02_PLATFORM_MMC

---

## Executive Summary

All architectural and technical clarifications have been resolved in the specification. The spec includes a comprehensive "Clarifications" section (Session 2026-02-25) that addresses all edge cases and design decisions. No additional research is needed.

---

## Clarification Resolution

### Q1: Per-Client Limit Under Concurrent Purchases

**Status**: ✓ RESOLVED

**Decision**: Option C (Reject Second After First Commits)

**Rationale**: Transactional integrity and safety-first principle. Each transaction acquires row lock, checks limit, and either commits or rejects. The second transaction sees the incremented counter post-commit from the first transaction and rejects with `AFFILIATE_USAGE_LIMIT_PER_CLIENT_EXCEEDED`.

**Implementation**: Per-client limit validation occurs within the transaction after acquiring `SELECT ... FOR UPDATE` lock. If limit exceeded, transaction rolls back and client receives HTTP 429 (Too Many Requests) or 400 (Bad Request with AFFILIATE_LIMIT_EXCEEDED code).

**Spec Reference**: [spec.md#Q1](spec.md#clarifications) - Concurrency Guarantees section

---

### Q2: Fractional Cent Handling in Financial Calculations

**Status**: ✓ RESOLVED

**Decision**: NUMERIC(12,2) with ROUND(amount, 2) deterministic rounding

**Rationale**: Zidney requires deterministic financial calculations. NUMERIC(12,2) natively supports 2-decimal precision. All calculations use: `ROUND(base_amount * percentage / 100, 2)`. This produces consistent, reproducible results across all systems and is auditable.

**Implementation**:

- All discount_amount and commission_amount fields are NUMERIC(12,2)
- Application layer MUST use database SQL functions for rounding (not floating-point math in code)
- Calculation audit trail includes the raw multiplied value before rounding and the rounded result

**Example**:

```sql
base_amount: 100.00
discount_percentage: 33.33
discount_amount: ROUND(100.00 * 33.33 / 100, 2) = ROUND(33.33, 2) = 33.33
commission_amount: ROUND(100.00 * 5.00 / 100, 2) = ROUND(5.00, 2) = 5.00
```

**Spec Reference**: [spec.md#Q2](spec.md#clarifications) - Transactional Financial Calculations section

---

### Q3: Zero or Negative Base Amounts

**Status**: ✓ RESOLVED

**Decision**: Reject as Invalid (HTTP 400 Bad Request)

**Rationale**: Financial integrity. Zero or negative amounts indicate a data error upstream. Affiliate code should not be applied to invalid transactions.

**Implementation**: License purchase endpoint validates base_amount > 0 before affiliate validation. If violated, returns HTTP 400 with error code `INVALID_LICENSE_AMOUNT`.

**Cascading Effect**: This validation is part of the license purchase transaction but occurs before affiliate validation, preventing corrupt financial records from reaching the affiliate system.

**Spec Reference**: [spec.md#Q3](spec.md#clarifications) - Failure Modes & Recovery section

---

### Q4: Affiliate Deletion During Transaction

**Status**: ✓ RESOLVED

**Decision**: Prevent via ON DELETE RESTRICT Foreign Key Constraint

**Rationale**: Audit trail and referential integrity. Affiliate records MUST NOT be deleted if affiliate_usages records exist. Soft delete via status field is the only allowed "deletion" path (logical delete, not physical).

**Implementation**: `affiliate_usages.affiliate_id` has `ON DELETE RESTRICT` constraint. Physical deletion of affiliates is forbidden if usages exist. Deactivation happens via `status = INACTIVE`, not deletion.

**Safety Guarantee**: Prevents race conditions between deletion and transaction commit. Maintains audit trail completeness.

**Spec Reference**: [spec.md#Q4](spec.md#clarifications) - Concurrency Protection section

---

### Q5: Admin Action Audit Trail

**Status**: ✓ RESOLVED

**Decision**: Yes — Separate Admin Audit Log Table

**Rationale**: Distinguish user/admin actions from customer usage tracking. Enables compliance reporting (who changed what when) and incident investigation. Audit trail is comprehensive and forensically complete.

**Implementation**: New table `affiliate_admin_audit` tracks all admin mutations:

```typescript
{
  id: uuid (primary key)
  affiliate_id: uuid (fk)
  admin_id: uuid (fk, from authenticated session)
  action: enum ('CREATE' | 'UPDATE' | 'DISABLE' | 'DELETE_ATTEMPT_PREVENTED')
  old_values: jsonb (if UPDATE)
  new_values: jsonb (if UPDATE)
  ip_address: inet
  created_at: timestamp
}
```

All admin operations (create, update, disable) log to this table transactionally.

**Spec Reference**: [spec.md#Q5](spec.md#clarifications) - Audit trail tracking section

---

## Architectural Compliance Verification

### Constitution Alignment

| Principle                     | Compliance | Notes                                                            |
| ----------------------------- | ---------- | ---------------------------------------------------------------- |
| Database-Per-Tenant Isolation | ✓          | Master_db only, no tenant DB access                              |
| Middleware Authority          | ✓          | Affiliate validation substep within license purchase transaction |
| License Enforcement           | ✓          | Does not override license lifecycle                              |
| Attempt Engine                | ✓          | Not applicable, attempt engine untouched                         |
| Versioned Evolution           | ✓          | Forward-only migration with version bump                         |
| Runtime Authoritative Time    | ✓          | Server time validates affiliate windows                          |
| Concurrency Guarantees        | ✓          | Row-level locking prevents race conditions                       |
| Strict Layer Separation       | ✓          | UI/API/Domain properly isolated                                  |
| Error Handling                | ✓          | Zidney standard error responses                                  |
| Operational Integrity         | ✓          | Transactional boundaries maintained                              |

**Conclusion**: All Constitutional requirements satisfied. No architectural drift detected.

---

## Technology Stack Decisions

### Database: PostgreSQL (NUMERIC Type)

**Why Chosen**: Zidney already uses PostgreSQL for master_db. NUMERIC type provides arbitrary precision without floating-point errors, essential for financial calculations.

**Alternatives Considered**:

- SQLite: Would require schema migration across all deployments, not available in master_db setup
- Column type DECIMAL: Equivalent to NUMERIC in PostgreSQL, chosen NUMERIC for clarity

**Decision**: Continue with PostgreSQL, use NUMERIC(12,2) for all financial fields

---

### Concurrency: Pessimistic Locking (SELECT ... FOR UPDATE)

**Why Chosen**: Prevents race conditions on usage_count increment and per-client limit checks. Simple, deterministic, database-enforced.

**Alternatives Considered**:

- **Optimistic Locking** (version column): Would require two queries (read version, check-and-update), risk of conflicts under high concurrency
- **Redis Distributed Lock**: Adds external dependency, introduces network latency, requires TTL management
- **Application-Level Semaphore**: Non-persistent, lost on process restart, doesn't scale horizontally

**Decision**: Use pessimistic locking with `SELECT ... FOR UPDATE`, lock timeout → HTTP 409 Conflict

---

### Financial Calculations: Database-Side via SQL

**Why Chosen**: Eliminates floating-point rounding errors from application layer. Ensures consistency across all client types (API, worker, batch imports).

**Alternatives Considered**:

- **Application-Side Calculations**: Risk of language-specific rounding inconsistencies (JavaScript, Python, etc.). Humans-are-bad-with-decimals problem
- **BigDecimal/Decimal Libraries**: Adds dependency, still subject to implementation variations

**Decision**: All calculations via PostgreSQL ROUND() function, application layer trusts database

---

### Audit Trail: Immutable Event Log

**Why Chosen**: Compliance and reconciliation. Financial audits require immutable, append-only records. Easy to export for reporting.

**Alternatives Considered**:

- **Soft Update Pattern**: Mark records as updated but keep old values, harder to query
- **Versioned Records**: Similar concept but more complex for audit extraction

**Decision**: Immutable affiliate_usages + affiliate_admin_audit tables (INSERT only, no UPDATE/DELETE)

---

## Performance & Scale Assumptions

### Expected Traffic

- Affiliate CRUD: Low frequency (admin operations, <1 per second)
- License purchases: Variable frequency (scaling with platform growth)
- Premium customers: ~10-100 concurrent purchases per day max

**Concurrency Impact**: Row-level lock will serialize concurrent purchases of same code. For typical use cases (<10/sec), lock wait time negligible (< 100ms).

**If Scale Increases**: Index on `(affiliate_id, client_id)` for per-client limit check is indexed in affiliate_usages table, query cost O(log n).

---

## Testing Strategy Alignment

### Unit Tests: Business Logic

- Decimal arithmetic: Edge cases (0%, 100%, fractional)
- Validation: Date ranges, limits, format checks
- Error codes: All error paths covered

### Integration Tests: API & Transactions

- Affiliate CRUD endpoints: Create, read, list, update, disable
- License purchase with affiliate code: Apply code, validation failures
- Transaction rollback: Failure modes (expired, over limit, etc)

### Concurrency Tests: Transactional Safety

- Concurrent purchases, same code: Usage counter correctness
- Per-client limit under concurrency: Rejection at correct moment
- Lock timeout: Graceful degradation

### Audit Trail Tests:

- Admin mutations logged: Create, update, disable
- Usage immutability: No UPDATE/DELETE on affiliate_usages
- Correlation ID tracing: All logs linked to request

---

## Deployment & Migration Strategy

### Migration Order

1. **Migration 009**: Create affiliates, affiliate_usages tables + enums, indexes, constraints
2. **Migration 010**: Create affiliate_admin_audit table
3. Schema version bump: Tracked in master_db version table
4. Deployment: API server updated with affiliate routes

### Rollback Plan

- Migrations are forward-only (no down() rollback)
- Rollback method: Restore from database snapshot
- Admin action: Database restore via operations team, not automatic

### Zero-Downtime Deployment

- Migrations run before API server startup: Blocking but brief
- Affiliate routes inactive until migrations complete
- License purchase flow unaffected (affiliate code parameter optional)

---

## Summary of Design Decisions

| Decision                | Rationale                     | Alternative Trade-offs                                             |
| ----------------------- | ----------------------------- | ------------------------------------------------------------------ |
| Master_db only          | Isolation guarantee           | Rent/multi-tenancy requires complex per-tenant sync                |
| Pessimistic locking     | Deterministic concurrency     | Optimistic locks add query overhead; distributed locks add latency |
| NUMERIC calculations    | Financial precision guarantee | Application-side decimals risk rounding errors                     |
| Soft delete (status)    | Audit completeness            | Hard delete loses history, breaks referential integrity            |
| Immutable audit tables  | Compliance requirement        | Mutable audit tracks requires complex change capture               |
| Row-level FK constraint | Prevent orphanned data        | Allows deletion adds audit reconstruction complexity               |

---

## Next Steps

- **Phase 1**: Proceed with data-model.md, contracts/, quickstart.md generation
- **Phase 2**: Execute /speckit.tasks for detailed task breakdown
- **Implementation**: Follow task workflow, targeting **Phase 2 completion** for feature branch merge
