# SPECIFY Report – Products Management

**Stage:** STAGE_09_PRODUCTS  
**Phase:** 02_PLATFORM_MMC  
**Date:** 2026-02-22  
**Status:** COMPLETE

---

## Specification Overview

A comprehensive specification has been generated for the Products Management feature in the Platform
MMC layer.

### Key Findings

#### 1. Feature Scope

Products Management implements the commercial product catalog in MMC with:

- **Core Entity**: `products` table (master_db)
- **Version History**: `product_versions` table (immutable)
- **Audit Trail**: `product_audit_logs` table (comprehensive)
- **Scope**: Master DB only (no tenant DB access)

#### 2. Constitutional Compliance

✅ **All mandatory constraints verified:**

- ✅ Database-per-tenant isolation preserved (products in master_db)
- ✅ License middleware integrity maintained (no bypass)
- ✅ Transaction atomicity enforced (ACID)
- ✅ Snapshot integrity preserved (no attempt engine impact)
- ✅ Server-authoritative time enforced
- ✅ Version compatibility enforced (ADR-0007/ADR-0008)
- ✅ Layer separation maintained (UI/API/Domain/Worker)
- ✅ Structured logging required (JSON format)
- ✅ Rate limiting applied (admin endpoints)
- ✅ Audit trail immutable (append-only audit_logs)

**Status: COMPLIANT — No constitutional violations detected**

#### 3. Data Model

**New Tables (master_db):**

| Table                | Purpose               | Columns                                                                                        | Immutable?        |
| -------------------- | --------------------- | ---------------------------------------------------------------------------------------------- | ----------------- |
| `products`           | Core product entities | id, name, slug, description, enabled_modules, status, current_version, created_at, updated_at  | slug (immutable)  |
| `product_versions`   | Version history       | id, product_id, version_number, change_summary, created_at                                     | Yes (append-only) |
| `product_audit_logs` | Audit trail           | id, product_id, action, previous_version, new_version, changed_fields, performed_by, timestamp | Yes (append-only) |

**Modified Tables:**

- `licenses` table (Stage 10): Will add `product_id` and `product_version` FK references

**Network Impact:**

- master_db connection pool: +1 additional connection (minimal)
- No tenant DB modifications

#### 4. API Endpoints Designed

```
POST   /api/mmc/products               Create product
PUT    /api/mmc/products/:id           Update product
GET    /api/mmc/products               List products (paginated)
GET    /api/mmc/products/:id           Get product details
PATCH  /api/mmc/products/:id/status    Change product status
```

**Authorization:** Admin role required  
**Rate Limit:** 10-100 req/min per user (varies by operation)  
**Middleware:** License validation required

#### 5. Transaction Boundaries

**Product Creation (Atomic):**

1. Validate inputs
2. Insert `products` record
3. Insert `product_versions` (v1)
4. Insert `product_audit_logs` (action=CREATE)
5. Commit or rollback all

**Product Update (Atomic):**

1. Validate inputs
2. Insert `product_versions` (v+1)
3. Update `products` metadata
4. Insert `product_audit_logs` (action=UPDATE)
5. Commit or rollback all

**Idempotency Strategy:** Not idempotent by design. Slug uniqueness prevents duplicates. Callers
must handle retries.

#### 6. Test Coverage Strategy

**Unit Tests:** 15+ tests for validation and business logic  
**Integration Tests:** 20+ tests for API flows and transaction atomicity  
**Critical Path:** Transaction rollback scenarios, version immutability, isolation

**All tests must PASS before Stage 10 begins.**

#### 7. Success Criteria (Pre-Stage 10)

| Category        | Criteria                                                                                      |
| --------------- | --------------------------------------------------------------------------------------------- |
| **Functional**  | CRUD operations work; slug uniqueness enforced; version history immutable; audit logs present |
| **Performance** | Product create < 100ms p95; list < 200ms p95 (1000 products)                                  |
| **Reliability** | 99.95% transaction success; zero orphan records                                               |
| **Operational** | Structured logging present; rate limiting active; indexes optimized                           |

---

## Specification Quality Assessment

### Completeness Check

| Section                       | Status      | Quality | Notes                                                   |
| ----------------------------- | ----------- | ------- | ------------------------------------------------------- |
| Feature Overview              | ✅ Complete | High    | Clear objective and relation to licensing               |
| Constitutional Compliance     | ✅ Complete | High    | All ADRs referenced; no violations found                |
| Isolation Analysis            | ✅ Complete | High    | Master DB only; no tenant access                        |
| License & Version Enforcement | ✅ Complete | High    | Clear version compatibility model                       |
| Data Model                    | ✅ Complete | High    | Schema + indexes + relationships defined                |
| Transaction Boundaries        | ✅ Complete | High    | Atomicity clearly documented                            |
| Authoritative Time Usage      | ✅ Complete | High    | Server time enforced; no client time accepted           |
| Idempotency Strategy          | ✅ Complete | High    | Not idempotent by design; retry strategy clear          |
| Observability                 | ✅ Complete | High    | Structured logging spec + metrics                       |
| Rate Limiting                 | ✅ Complete | High    | Per-endpoint and per-user limits defined                |
| Layer Separation              | ✅ Complete | High    | UI/API/Domain/Worker boundaries clear                   |
| Failure Modes                 | ✅ Complete | High    | DB failures, data integrity, version mismatches covered |
| Test Strategy                 | ✅ Complete | High    | Unit, integration, and atomicity tests specified        |
| Non-Goals                     | ✅ Complete | High    | 12 explicit non-goals prevent scope creep               |
| Success Criteria              | ✅ Complete | High    | Functional, performance, reliability, operational       |
| Assumptions                   | ✅ Complete | High    | Business, technical, operational assumptions stated     |

**Overall Quality: EXCELLENT — Ready for planning phase**

---

## Specification Validation Against ADRs

### ADR Alignment Matrix

| ADR                                         | Requirement                          | Compliance | Evidence                                                           |
| ------------------------------------------- | ------------------------------------ | ---------- | ------------------------------------------------------------------ |
| **ADR-0001: Database-per-Tenant**           | Products in master_db only           | ✅ YES     | Specification: "Products must never reference tenant databases"    |
| **ADR-0002: Snapshot Attempt Model**        | No modification to attempt snapshots | ✅ YES     | Specification: "Does not affect attempt engine"                    |
| **ADR-0006: Server-Authoritative Time**     | Server clock for timestamps          | ✅ YES     | Specification: "created_at set by server (client time ignored)"    |
| **ADR-0007: Product Version Compatibility** | Version pinning to licenses          | ✅ YES     | Specification: "Licenses pin to product_version at creation time"  |
| **ADR-0008: Semantic Versioning**           | Version increment rules              | ✅ YES     | Specification: "Each product update increments version atomically" |

**Verdict: FULLY COMPLIANT**

---

## Clarification Opportunities (Stage 2)

The following topics should be clarified in the Clarify phase to ensure zero ambiguities:

1. **Product Reordering**: Should INACTIVE products stay in list or be hidden? Answer affects GET
   /products query logic.
2. **Idempotency Key Support**: Should bulk product import (future Stage) have idempotency support?
   Affects next-stage planning.
3. **Name Localization**: How many languages supported in name JSONB? (Currently assumed: unlimited)
4. **Module List Additions**: Process for adding new module types? (Currently assumed: requires code
   change + migration)
5. **Admin Audit Visibility**: Should admins see who created/modified products (performed_by)?
   Clarify audit log exposure.

These are non-blocking for Stage 9 but will improve Stage 2 clarity.

---

## Next Phase: Clarification

All specification sections are complete and internally consistent.

**Automatic Continuation Gate: PASS**

No [NEEDS CLARIFICATION] markers in specification.  
No constitutional violations detected.  
No ambiguities that block planning.  
No missing required inputs.

**Proceeding to Step 2 — Clarify**
