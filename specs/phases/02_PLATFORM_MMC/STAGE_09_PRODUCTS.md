# STAGE 09 – Products Management

Phase: 2 – Platform MMC  
Status: Critical  
Scope: Product entity, configuration model, module control, and versioning

---

## Stage Status

Status: CLARIFIED  
Risk Level: LOW  
Last Updated: 2026-02-22T00:00:00Z

Scope Defined:

- Product CRUD operations (create, read, update, list)
- Product versioning (immutable version history)
- Product status management (ACTIVE/INACTIVE)
- Audit logging and traceability
- Multi-language name support (JSON: en/ar with fallback)
- Module enumeration validation (hardcoded enum)
- Rate limiting and authorization
- Audit trail API (queryable by admins)

Deferred Scope:

- License assignment (Stage 10)
- Workspace provisioning (Stage 11)
- Bulk product import (future)
- Product A/B testing (future)

Constitutional Compliance:

- Specification clarified and validated
- All 5 ambiguities resolved
- Database-per-tenant isolation enforced
- License middleware integrity maintained
- Transaction atomicity enforced
- Version compatibility model defined
- Layer separation confirmed
- Structured logging specified

Notes:
All clarifications locked. Ready for technical planning.

---

## Objective

Implement Product Management inside MMC.

Product represents:

- A commercial offering
- A module bundle definition
- A versioned configuration baseline
- A licensing template

Products are the source of licenses.

---

## Product Role in Zidney

Product defines:

- Enabled modules
- Base configuration flags
- Default system capabilities
- Future feature flags

Relationship:

Product → License → Workspace

One product can have many licenses.  
One license references exactly one product.

Products must never reference tenant databases.

---

## Product Table (master_db)

### Core Fields

- id (uuid)
- name (JSONB: `{"en": "...", "ar": "..."}` — English required, Arabic optional)
- slug (unique, immutable, lowercase alphanumeric + dash)
- description (nullable text)
- enabled_modules (JSONB array: validated against Module enum)
- status (VARCHAR: ACTIVE | INACTIVE)
- created_at (TIMESTAMP: server-set, immutable)
- updated_at (TIMESTAMP: server-set, updated on each modification)

### Versioning Fields

- current_version (INTEGER: starts at 1, increments atomically)

### Version History Table

`product_versions` (separate table):

- id (uuid)
- product_id (uuid FK)
- version_number (INTEGER)
- change_summary (TEXT: optional description of changes)
- created_at (TIMESTAMP: when this version was created)

**Immutable:** product_versions records never modified or deleted.

### Audit Trail Table

`product_audit_logs` (separate table):

- id (uuid)
- product_id (uuid FK)
- action (VARCHAR: CREATE | UPDATE | STATUS_CHANGE)
- previous_version (INTEGER: nullable)
- new_version (INTEGER: nullable)
- changed_fields (JSONB: what changed)
- performed_by (UUID: admin user who made change)
- timestamp (TIMESTAMP: when change occurred)

**Immutable:** Audit logs are append-only, never modified.

### Slug Rules

- lowercase only
- alphanumeric characters + dash (no spaces)
- globally unique (no duplicates across products)
- immutable after creation (never changed)
- customer-readable (used in URLs and documentation)

### Status Values

- **ACTIVE:** Product available for new license creation
- **INACTIVE:** Product archived; cannot create new licenses (existing licenses unaffected)

**Default:** ACTIVE (at creation time)

**State Transitions:**
- ACTIVE → INACTIVE (disable product)
- INACTIVE → ACTIVE (re-enable product)
- Status change does NOT increment version

---

## Enabled Modules Contract

Modules are **hardcoded enum** (not free-text, not database-configurable):

```typescript
enum Module {
  MCQ = "MCQ",
  TRADITIONAL_EXAMS = "TRADITIONAL_EXAMS",
  EXERCISES = "EXERCISES",
  LIBRARY = "LIBRARY",
  LIVES = "LIVES",
  FORUM = "FORUM"
}
```

Rules:

- At least one module required per product
- Modules must be validated against TypeScript enum
- Invalid modules rejected with 400 Bad Request
- Removing a module only affects future licenses
- Existing licenses remain unchanged

Enforcement occurs at:

- API validation layer (400 on invalid enum)
- Domain service layer (pure function validation)
- Database constraint (CHECK constraintif applicable)
- Runtime authorization middleware (module availability check)

New modules require:

- Code change (add to enum + type definitions)
- Database migration (increment schema_version)
- Release and deployment
- License provisioning logic review

---

## Product Versioning Model

Products evolve over time.

Rules:

- Each structural change increments version
- Version increment must be atomic
- Version must never decrease
- Version history immutable

License stores product_version at creation.

When product updates:

- Existing licenses remain pinned to old version
- Update availability flag stored
- Workspace must explicitly opt-in upgrade

No automatic upgrade allowed.

Upgrade logic handled in License Engine stage.

---

## Product Status Model

ACTIVE:

- Can create new licenses
- Visible in license creation flow

INACTIVE:

- Cannot create new licenses
- Existing licenses remain valid

Deletion rules:

- Hard delete prohibited if any license exists
- Soft delete allowed only if no licenses exist

---

## Product Creation Flow

1. Validate slug uniqueness
2. Validate module list
3. Set current_version = 1
4. Insert product record
5. Insert version record (version 1)
6. Log audit event

No provisioning occurs at product creation.

---

## Product Update Flow

1. Validate changes
2. Create new version record
3. Increment current_version
4. Do not modify existing licenses
5. Mark update_available for affected licenses (optional flag)
6. Log audit event

Product updates must never:

- Modify existing tenant schema
- Force runtime upgrade
- Break backward compatibility

---

## Audit Requirements

Every product change must log:

- product_id
- previous_version
- new_version
- changed_fields
- performed_by
- timestamp

Audit logs must be immutable.

---

## Product Listing (MMC UI Requirements)

**Default Behavior:** GET /products returns ACTIVE products only

Must support:

- **Default list:** ACTIVE products only (no filter needed)
- **Archived products:** ?status=INACTIVE (admin can view with explicit filter)
- **All products:** ?status=all (see both ACTIVE and INACTIVE)
- Search by name (supports both en and ar)
- Search by slug
- Pagination (limit/offset)
- Sorting by created_at DESC
- View license count per product
- View current version number

Actions per row:

- View details
- Edit metadata (name, description, enabled_modules)
- Change status (ACTIVE ↔ INACTIVE)

Bulk actions:

- Change status to INACTIVE (for multiple products)

**Not Available in UI:**

- Delete product (only via API with hard constraint)
- Modify slug (immutable after creation)
- Modify version history (read-only audit trail)

---

## Clarifications Locked — Stage 2 Complete

All 5 critical ambiguities have been resolved and locked:

### 1. Product Listing Visibility (✅ Locked)

**Decision:** GET /products returns ACTIVE products only by default.

```
GET /products                    → ACTIVE products only
GET /products?status=ACTIVE      → ACTIVE products explicitly
GET /products?status=INACTIVE    → INACTIVE products only
GET /products?status=all         → Both ACTIVE and INACTIVE
```

**Rationale:** License creation flows must not accidentally reference inactive products. Default ACTIVE-only prevents operational mistakes.

**Impact:**
- License creation UI queries GET /products (safe default)
- Backoffice can offer "show archived" toggle with ?status=INACTIVE
- Pagination remains predictable and fast

---

### 2. Module Enumeration Model (✅ Locked)

**Decision:** Modules are a hardcoded enum in code. No runtime registration.

```typescript
enum Module {
  MCQ = "MCQ",
  TRADITIONAL_EXAMS = "TRADITIONAL_EXAMS",
  EXERCISES = "EXERCISES",
  LIBRARY = "LIBRARY",
  LIVES = "LIVES",
  FORUM = "FORUM"
}
```

**Rationale:** Modules directly affect provisioning, RBAC, and schema assumptions. Dynamic registration would break deterministic provisioning and constitutional guarantees. Module introduction requires version control and migration binding.

**Impact:**
- Product.enabled_modules validated against TypeScript enum
- New modules require code change + migration + release
- All layers (API, domain, DB) use same enum source
- Invalid modules rejected with 400 Bad Request

---

### 3. Product Name Localization (✅ Locked)

**Decision:** JSON format: `{"en": "...", "ar": "..."}`

**Rules:**
- English (en) is **required** (NOT NULL)
- Arabic (ar) is optional
- If Arabic translation missing, falls back to English
- Only en/ar supported in Stage 9 (extensible for future languages)

```json
{
  "name": {
    "en": "Basic Exam Suite",
    "ar": "حزمة الامتحان الأساسية"
  }
}
```

**Fallback Logic:**
```typescript
function getProductName(product: Product, language: string): string {
  if (language === 'ar' && product.name.ar) return product.name.ar
  return product.name.en  // Always has fallback
}
```

**Rationale:** Zidney already supports EN/AR directionality. English as canonical fallback preserves deterministic rendering and prevents null UI states.

**Impact:**
- DB constraint enforces name.en required
- Backoffice displays product name in user's language
- No null product names in UI
- Future language support requires only code + migration

---

### 4. Product Deletion Policy (✅ Locked)

**Decision:** Hard delete only. No soft delete mechanism.

**Rules:**
- DELETE /products/{id} succeeds only if no licenses reference product
- If licenses exist, DELETE returns 409 Conflict
- Deletion is permanent and immediate (no grace period)
- Foreign key constraint prevents orphaned licenses

```sql
ALTER TABLE licenses
ADD CONSTRAINT fk_licenses_product_id
FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT;
```

**Deletion Outcomes:**
- ✅ No licenses exist → Hard delete succeeds
- ❌ Licenses exist → 409 Conflict response
- ✅ Soft alternative: Change status to INACTIVE (preserves history)

**Rationale:** If licenses exist, product is part of financial/contractual record. Hard delete + 409 conflict keeps lifecycle explicit and clean. Avoids soft delete ambiguity in provisioning.

**Impact:**
- No deleted_at column in products table
- Foreign key constraint prevents accidental deletion
- Support path: Mark INACTIVE or migrate licenses to new product
- Audit trail is completely immutable

---

### 5. Audit Log API Exposure (✅ Locked)

**Decision:** GET /products/{id}/audit-log (admin-only queryable endpoint)

**Endpoint Specification:**
```
GET /api/v1/mmc/products/{id}/audit-log
Authorization: Admin role required
Query params: ?limit=50&offset=0&action=UPDATE&from_date=2026-02-01

Response schema:
{
  "data": [
    {
      "id": "uuid",
      "product_id": "uuid",
      "action": "CREATE|UPDATE|STATUS_CHANGE",
      "previous_version": null,
      "new_version": 1,
      "changed_fields": {...},
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

**Filtering Support:**
- By action: CREATE, UPDATE, STATUS_CHANGE
- By date range: from_date, to_date (ISO 8601)
- Future: By performed_by user_id

**Rationale:** MMC is compliance-facing. Product changes impact licenses, pricing, modules, legal scope. Audit visibility must be queryable for transparency and debugging.

**Impact:**
- Admins can fully audit product change history
- Supports compliance: "Who changed the product and when?"
- Enables debugging: "Why did module X disappear?"
- Audit logs remain immutable and append-only

---

## Validation Criteria

Stage complete when:

- Product CRUD operational
- Slug uniqueness enforced at DB level
- Module enum validation enforced
- Version increments correctly
- Version history immutable
- Existing licenses unaffected by updates
- INACTIVE product cannot create new license
- Audit logs generated

---

## Not Allowed

- ❌ Editing slug after creation (immutable)
- ❌ Removing module retroactively for existing licenses (version isolation)
- ❌ Hard deleting product with existing licenses (409 Conflict enforced by FK)
- ❌ Automatic license upgrades (licenses pin to version at creation)
- ❌ Direct tenant DB access from product logic (master_db only)
- ❌ Soft delete mechanism (hard delete + 409 when licenses exist)
- ❌ Dynamic module registration (hardcoded enum only)
- ❌ Modifying version history (product_versions immutable)
- ❌ Non-English product names (en is required)
- ❌ Free-text module names (enum validation mandatory)

---

## Stability Principle

Products define what institutions purchase.

If product configuration mutates retroactively,
commercial trust collapses.

Product version isolation must be stable before:

STAGE_10_LICENSES
