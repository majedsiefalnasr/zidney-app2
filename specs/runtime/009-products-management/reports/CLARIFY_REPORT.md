# CLARIFY Report – Products Management

**Stage:** STAGE_09_PRODUCTS  
**Phase:** 02_PLATFORM_MMC  
**Date:** 2026-02-22  
**Status:** COMPLETE

---

## Clarification Summary

All 5 critical ambiguities have been resolved through targeted clarification questions. **All
recommendations (Option A) were approved.**

---

## Clarifications Locked

### **Q1: Product Listing Default Visibility**

**Decision: APPROVED — Option A**

```
GET /products returns ACTIVE only by default.
INACTIVE products require explicit ?status=INACTIVE filter.
```

**Reasoning (User):**

> License creation and provisioning flows must not accidentally reference inactive products. Default
> ACTIVE-only prevents operational mistakes and keeps pagination predictable.

**Specification Impact:**

- ✅ GET /products query must include `WHERE status = 'ACTIVE'` as default
- ✅ GET /products?status=INACTIVE returns archived products only
- ✅ GET /products?status=\* or ?status=all returns both ACTIVE and INACTIVE
- ✅ License creation flows can safely call GET /products without status filter
- ✅ Backoffice UI can offer "show archived" toggle that appends ?status=INACTIVE

**Test Impact:**

- Add test: GET /products returns ACTIVE only without status param
- Add test: GET /products?status=INACTIVE returns INACTIVE only
- Add test: License creation flow doesn't accidentally surface INACTIVE products

**API Contract:**

```
GET /products                    → ACTIVE products only (default)
GET /products?status=ACTIVE      → ACTIVE products only (explicit)
GET /products?status=INACTIVE    → INACTIVE products only
GET /products?status=all         → Both ACTIVE and INACTIVE
```

---

### **Q2: Module Enumeration — Hardcoded or Extensible?**

**Decision: APPROVED — Option A**

```
Modules are a hardcoded enum in code.
New modules require code release + database migration.
```

**Reasoning (User):**

> Modules directly affect provisioning, RBAC, attempt engine availability, and schema assumptions.
> Dynamic module registration would break deterministic provisioning and constitutional guarantees.
> Module introduction must remain version-controlled and migration-bound.

**Specification Impact:**

- ✅ Module list is **TypeScript enum** (not database table):
  ```typescript
  enum Module {
    MCQ = "MCQ",
    TRADITIONAL_EXAMS = "TRADITIONAL_EXAMS",
    EXERCISES = "EXERCISES",
    LIBRARY = "LIBRARY",
    LIVES = "LIVES",
    FORUM = "FORUM",
  }
  ```
- ✅ Product.enabled_modules is validated against enum at all layers (API, domain, DB)
- ✅ New modules trigger:
  - Code change (add to enum)
  - DB migration (update schema_version)
  - Release/deployment
  - License provisioning logic review
- ✅ Runtime module authorization checks use this enum
- ✅ No module registration table or runtime discovery

**Test Impact:**

- Add test: Invalid module enum rejected with 400
- Add test: All 6 known modules accepted
- Add test: Unknown module ("UNKNOWN") rejected
- Add test: Empty enabled_modules rejected

**Constitutional Impact:**

- ✅ Preserves deterministic provisioning (module list is always known)
- ✅ Maintains schema version integrity (new modules = new schema)
- ✅ Prevents runtime configuration drift
- ✅ Aligns with ADR-0001 (version control over runtime discovery)

---

### **Q3: Product Name Localization Model**

**Decision: APPROVED — Option A**

```
JSON structure: {"en": "English name", "ar": "Arabic name"}
English (en) is required; all products must have English name.
Missing translations fall back to English.
Supported languages initially: English (en) + Arabic (ar).
```

**Reasoning (User):**

> Zidney already supports EN/AR directionality. English as canonical fallback preserves
> deterministic rendering and prevents null UI states. Keeps schema simple while future-proofing.

**Specification Impact:**

- ✅ Product name schema:
  ```json
  {
    "name": {
      "en": "Basic Exam Suite",
      "ar": "حزمة الامتحان الأساسية"
    }
  }
  ```
- ✅ Validation rules:
  - `name.en` is **required** (NOT NULL)
  - `name.ar` is optional
  - Unknown language codes rejected (only en/ar allowed in Stage 9)
- ✅ Fallback behavior:
  ```typescript
  function getProductName(product: Product, lang: string): string {
    if (lang === "ar" && product.name.ar) return product.name.ar;
    return product.name.en; // Fallback to English
  }
  ```
- ✅ Future extensibility:
  - To add ES (Spanish): Add validation rule `lang IN ('en', 'ar', 'es')`
  - No schema change; only code + migration to validate new language

**Test Impact:**

- Add test: Product creation fails if name.en missing
- Add test: Product creation succeeds if name.ar missing (optional)
- Add test: Product update allows adding/modifying translations
- Add test: Non-en/ar language codes rejected
- Add test: Empty strings rejected for language values

**UI Rendering Impact:**

- Backoffice displays product name in user's preferred language (en/ar)
- If translation missing, falls back to English
- No null/undefined product names in UI

**Database Constraint:**

```sql
ALTER TABLE products
ADD CONSTRAINT name_en_required CHECK (name->>'en' IS NOT NULL);
```

---

### **Q4: Product Deletion — Hard Delete or Soft Delete?**

**Decision: APPROVED — Option A**

```
Hard delete only. No soft delete mechanism.
DELETE /products/{id} succeeds only if no licenses reference product.
If licenses exist, DELETE returns 409 Conflict.
Product deletion is permanent and immediate (no grace period).
```

**Reasoning (User):**

> If licenses exist, product is part of historical financial/contractual record. Soft delete
> introduces ambiguity in provisioning and compliance. Hard delete + 409 conflict keeps lifecycle
> explicit and clean.

**Specification Impact:**

- ✅ No `deleted_at` column in products table
- ✅ DELETE operation enforced by foreign key constraint:
  ```sql
  -- Prevents deletion if licenses exist
  ALTER TABLE licenses
  ADD CONSTRAINT fk_licenses_product_id
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT;
  ```
- ✅ DELETE /products/{id} behavior:
  - ✅ If no licenses exist → Hard delete (all rows, versions, audit logs)
  - ✅ If licenses exist → 409 Conflict (with message: "Product has active licenses")
- ✅ Alternatives for problematic products:
  - Change status to INACTIVE (prevents new licenses, preserves history)
  - Migrate licenses to new product (manual operation, coordinated by support)
  - Never recommend hard delete in production for products with history

**Test Impact:**

- Add test: DELETE succeeds when no licenses
- Add test: DELETE fails with 409 when licenses exist
- Add test: Foreign key constraint prevents orphaned licenses
- Add test: No cascading delete of licenses (explicit 409 instead)

**Audit Trail Impact:**

- ✅ product_versions and product_audit_logs are RESTRICTED too (cannot be orphaned)
- ✅ Deletion audit trail:
  - Option 1: Delete audit logs too (hard delete cascade) — simplest
  - Option 2: Archive audit logs to archive table before delete — complex
  - **Decision: Hard cascade delete. If product deleted, history deleted too.**
  - **Justification**: If product truly unused, not deleting history won't hurt (space cost
    negligible). If licenses exist, delete is prevented anyway.

---

### **Q5: Audit Log API Exposure**

**Decision: APPROVED — Option A**

```
GET /products/{id}/audit-log (admin-only endpoint)
Returns immutable audit trail; paginated; filterable by action and timestamp.
Includes performed_by field with admin user details.
Access restricted to MMC admins with AUDIT_READ permission.
```

**Reasoning (User):**

> MMC is compliance-facing. Product changes impact licenses, pricing, modules, and legal scope.
> Audit visibility must be queryable for transparency and debugging. Audit logs remain immutable and
> tenant-scoped.

**Specification Impact:**

- ✅ New API endpoint:

  ```
  GET /api/mmc/products/{id}/audit-log
  Query params: ?limit=50&offset=0&action=UPDATE&from_date=2026-02-01&to_date=2026-02-22

  Response:
  {
    "data": [
      {
        "id": "uuid",
        "product_id": "uuid",
        "action": "CREATE|UPDATE|STATUS_CHANGE",
        "previous_version": null,
        "new_version": 1,
        "changed_fields": {
          "name": { "old": null, "new": {...} },
          "enabled_modules": { "old": [], "new": ["MCQ", "EXERCISES"] }
        },
        "performed_by": {
          "id": "uuid",
          "email": "admin@mmc.com",
          "name": "Platform Admin"
        },
        "timestamp": "2026-02-22T10:30:00Z"
      }
    ],
    "pagination": {
      "limit": 50,
      "offset": 0,
      "total": 247
    }
  }
  ```

- ✅ Authorization:
  - Requires MMC admin role
  - License middleware checks: Product belongs to master_db (always accessible to admins)
  - Consider: AUDIT_READ permission gate (if RBAC supports it)

- ✅ Pagination:
  - Default limit: 50 (max 100)
  - Sorted by timestamp DESC (newest first)
  - Cursor-based or offset-based (recommend cursor for stability)

- ✅ Filtering:
  - By action: CREATE, UPDATE, STATUS_CHANGE
  - By date range: from_date, to_date (ISO 8601)
  - By performed_by user_id (future)

**Test Impact:**

- Add test: GET /products/{id}/audit-log requires authentication
- Add test: GET /products/{id}/audit-log requires admin role
- Add test: Audit logs returned in chronological order (DESC)
- Add test: Pagination works correctly
- Add test: Filters by action and date work correctly
- Add test: performed_by field populated with user details
- Add test: Audit logs are read-only (no mutation possible)

**Compliance Impact:**

- ✅ Product changes are fully auditable
- ✅ Supports regulatory compliance requests ("who changed the product?")
- ✅ Enables debugging: "Why did module X disappear from product Y?"
- ✅ Transparent governance: All product changes have forensic trail

**Internal Audit Logging (Separate from Audit Log API):**

- ✅ All product operations also logged to application structured logs (JSON)
- ✅ These logs go to centralized monitoring (not queryable via API)
- ✅ API audit-log endpoint is queryable historical index

---

## Ambiguities Resolution Status

| Ambiguity                   | Question | Decision                     | Status    |
| --------------------------- | -------- | ---------------------------- | --------- |
| INACTIVE product visibility | Q1       | ACTIVE-only default          | ✅ LOCKED |
| Module extensibility        | Q2       | Hardcoded enum               | ✅ LOCKED |
| Name localization           | Q3       | JSON en/ar + fallback        | ✅ LOCKED |
| Deletion policy             | Q4       | Hard delete (no soft delete) | ✅ LOCKED |
| Audit log access            | Q5       | Admin queryable endpoint     | ✅ LOCKED |

**Total Ambiguities Resolved: 5/5**

---

## Specifications Updated

All clarifications have been **integrated into the STAGE_09_PRODUCTS.md file**:

- ✅ Product Listing Visibility section added
- ✅ Module Enum Definitions section added
- ✅ Name Localization Rules section added
- ✅ Product Deletion Policy section added
- ✅ Audit Log API Specification section added

---

## Next Phase: Planning

**Automatic Continuation Gate: PASS**

All clarifications locked.  
No unresolved ambiguities remain.  
Constitutional compliance maintained.  
All decisions encoded in stage file.

**Proceeding to Step 3 — Plan**

---

## API DESIGN VALIDATION GATE

**Date:** 2026-02-22  
**Phase:** Post-Plan Validation  
**Validator:** Zidney API Architecture  
**Status:** 🔴 BLOCKED – 4 Architectural Issues Found

### Gate Purpose

Before implementation proceeds, the PLAN_REPORT.md API design was validated against 12 acceptance
criteria. This gate ensures all architectural requirements are met before code generation.

### Validation Results

**Criteria Passing:** 8/12 ✅  
**Criteria Needing Work:** 4/12 ❌

**Full Details:** See [VALIDATION_REPORT.md](./VALIDATION_REPORT.md)

---

### BLOCKER #1: Rate Limiting Not Documented ❌

**Severity:** CRITICAL  
**Category:** Security

**Requirement:**

```
- 10/min for POST (create products)
- 20/min for PUT (update products)
- 100/min for GET (list/read products)
- Per-user identity (not IP-based)
```

**Current State:** Not mentioned in PLAN_REPORT.md

**Risk:** DDoS vulnerability, production reliability at risk

**Required Fix:**

- Add Section 7.1 to PLAN_REPORT.md: "Rate Limiting Strategy"
- Specify Redis sliding-window implementation
- Define middleware chain integration
- Add test cases for rate limit enforcement
- Estimated effort: 30 minutes

**Decision Required:** Approve rate limiting implementation approach?

---

### BLOCKER #2: API Versioning Not in URI Path ⚠️

**Severity:** HIGH  
**Category:** Architecture

**Requirement:**

```
API versioning via URL (/api/v1/mmc/products) or header
```

**Current State:**

```
Endpoints defined as: /api/mmc/products
No /v1/ in path, no header versioning documented
```

**Risk:** Backward compatibility unclear, breaking changes uncontrolled

**Decision Needed:**

- **Option A:** URI versioning: Update all endpoints to `/api/v1/mmc/products`
- **Option B:** Header versioning: Require `Accept: application/vnd.zidney.v1+json`

**Recommended:** Option A (URI versioning is more discoverable)

**Required Fix:**

- Update Section 3.1 in PLAN_REPORT.md with chosen versioning strategy
- Update all 6 endpoint definitions with version prefix
- Document deprecation path for future versions
- Estimated effort: 15 minutes

**Decision Required:** URI versioning (A) or Header versioning (B)?

---

### BLOCKER #3: OpenAPI 3.0 Specification Not Generated ❌

**Severity:** MEDIUM  
**Category:** Documentation

**Requirement:**

```
OpenAPI 3.0 spec generated
Examples provided for all endpoints
Spec completeness verified
```

**Current State:**

- PLAN_REPORT.md has human-readable examples
- **Missing:** Formal OpenAPI 3.0 YAML/JSON specification file

**Impact:**

- No auto-generated SDK possible
- IDE/Postman integration blocked
- No Swagger UI / ReDoc available
- Contract-first validation missing

**Required Fix:**

- Generate `docs/api/products-management-api-spec.yaml`
- Include all 6 endpoints with full OpenAPI structure
- Estimated effort: 45 minutes

**Decision Required:** Approve OpenAPI spec generation?

---

### BLOCKER #4: Metrics Collection Not Defined ❌

**Severity:** MEDIUM  
**Category:** Observability

**Requirement:**

```
Metrics collected (latency, error rates)
Correlation ID in responses (already PASS)
```

**Current State:**

- PLAN_REPORT.md documents structured logging
- **Missing:** Metrics aggregation strategy (Prometheus/CloudWatch)

**Required Fix:**

- Add Section 7.2 to PLAN_REPORT.md: "Metrics Collection"
- Define key metrics with Prometheus
- Estimated effort: 30 minutes

**Decision Required:** Approve Prometheus-based metrics approach?

---

## Decisions Required

**These questions must be answered before proceeding to implementation:**

1. Rate Limiting: Approve Redis sliding-window implementation?
2. API Versioning: Choose URI versioning (/v1/) or header versioning?
3. OpenAPI Spec: Generate formal OpenAPI 3.0 YAML spec?
4. Metrics Collection: Use Prometheus for aggregation?

---

## Impact if Issues Not Fixed

| Issue             | Impact                                      |
| ----------------- | ------------------------------------------- |
| No Rate Limiting  | Production DDoS vulnerability               |
| No API Versioning | Breaking changes uncontrolled               |
| No OpenAPI Spec   | Integration barriers, no SDK generation     |
| No Metrics        | Production blind, no performance visibility |

---

## Remediation Path

1. **Approve Decisions** (above)
2. **Update PLAN_REPORT.md** with 4 new sections
3. **Create OpenAPI Spec File**
4. **Re-validate** against 12 criteria
5. **Proceed to Implementation** when all PASS

**Estimated Total Effort:** ~2-3 hours

---

**Validator Recommendation:** All 4 issues are fixable and essential. Do not skip to implementation
without addressing them.
