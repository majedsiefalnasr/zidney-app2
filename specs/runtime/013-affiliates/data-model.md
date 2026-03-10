# Data Model: Affiliate System

**Stage**: STAGE_13_AFFILIATES | **Phase**: 02_PLATFORM_MMC | **Database**: master_db

---

## Overview

The affiliate system uses three master_db tables to implement B2B promotional code management with
financial tracking and audit logging. All tables enforce referential integrity and business rule
constraints at the database level.

---

## Table: affiliates

**Purpose**: Store affiliate program definitions and configuration  
**Immutability**: promo_code immutable after insert; all other fields mutable  
**Usage Pattern**: Frequently read during license purchase validation; infrequently written (admin
operations)

### Schema

```sql
CREATE TABLE affiliates (
  -- Identifiers
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Promo Code (Business Key)
  promo_code VARCHAR(50) UNIQUE NOT NULL,
  --   Format: Uppercase alphanumeric (A-Z, 0-9) only
  --   Length: 3-50 characters
  --   Immutable: Cannot change after insert
  --   Pattern: ^[A-Z0-9]{3,50}$

  -- Financial Configuration
  discount_percentage NUMERIC(5,2) NOT NULL CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
  --   Range: 0.00 to 100.00
  --   Type: NUMERIC for deterministic rounding
  --   Precision: 2 decimal places
  --   Example: 10.50 means 10.5% discount

  commission_percentage NUMERIC(5,2) NOT NULL CHECK (commission_percentage >= 0 AND commission_percentage <= 100),
  --   Range: 0.00 to 100.00
  --   Type: NUMERIC for deterministic rounding
  --   Precision: 2 decimal places
  --   Example: 2.75 means 2.75% commission to affiliate

  -- Discount Stacking Rule
  allow_with_other_discounts BOOLEAN NOT NULL DEFAULT false,
  --   false: Cannot combine with institutional discounts
  --   true: Can apply simultaneously with other discount codes
  --   Enforcement: Application layer responsibility

  -- Usage Limits
  usage_limit_total INTEGER,
  --   NULL: No limit (unlimited uses)
  --   >= 0: Maximum total global uses across all clients
  --   Enforcement: Checked atomically during purchase transaction

  usage_limit_per_client INTEGER,
  --   NULL: No limit (client can use code unlimited times)
  --   >= 0: Maximum uses per unique client
  --   Enforcement: COUNT(affiliate_usages) checked within transaction

  -- Running Counter
  usage_count INTEGER NOT NULL DEFAULT 0,
  --   Incremented transactionally with license purchase
  --   Used for quick validation of usage_limit_total
  --   Must equal COUNT(*) FROM affiliate_usages WHERE affiliate_id = id
  --     (can be verified via scheduled reconciliation job)

  -- Temporal Validity
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  --   Promo code becomes active at this time
  --   Validation: start_date < end_date (enforced by constraint)
  --   Timezone: UTC (stored in database as UTC)

  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  --   Promo code becomes inactive after this time (exclusive)
  --   Validation: end_date > start_date
  --   Enforcement: CURRENT_TIMESTAMP BETWEEN start_date AND end_date

  -- Status (Soft Delete Pattern)
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  --   ACTIVE: Code is available for use
  --   INACTIVE: Code has been disabled by admin (soft delete)
  --   Enforcement: Only ACTIVE codes allowed in validation

  -- Admin Notes
  description TEXT,
  --   Optional human-readable description
  --   Used for admin interface display
  --   Not visible to customers

  -- Audit Fields
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  --   Immutable record creation time

  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  --   Updated on every column modification (except promo_code)
  --   Managed by trigger: UPDATE affiliates SET updated_at = NOW() WHEN ...

  -- Constraints
  CONSTRAINT valid_dates CHECK (start_date < end_date),
  CONSTRAINT valid_promo_code_format CHECK (promo_code ~ '^[A-Z0-9]{3,50}$'),
  CONSTRAINT valid_usage_limits CHECK (
    usage_limit_total IS NULL OR usage_limit_total >= 0
    AND usage_limit_per_client IS NULL OR usage_limit_per_client >= 0
  )
);
```

### Indexes

```sql
-- Business Key Lookup (most common read pattern)
CREATE UNIQUE INDEX idx_affiliates_promo_code ON affiliates(promo_code);

-- Status Filtering
CREATE INDEX idx_affiliates_status ON affiliates(status);

-- Time-Range Queries (reporting, analytics)
CREATE INDEX idx_affiliates_dates ON affiliates(start_date, end_date);

-- Composite for temporal + status (optimization)
CREATE INDEX idx_affiliates_status_dates ON affiliates(status, start_date, end_date);

-- For created_at ordering in list responses
CREATE INDEX idx_affiliates_created_at ON affiliates(created_at DESC);
```

### Triggers

```sql
-- Auto-update 'updated_at' on any modification (except promo_code, auto-maintained)
CREATE TRIGGER affiliate_update_timestamp
BEFORE UPDATE ON affiliates
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();
-- Assumption: update_timestamp() function exists globally in master_db

-- Prevent promo_code modification (immutability enforcement at database level)
CREATE TRIGGER affiliate_protect_promo_code
BEFORE UPDATE ON affiliates
FOR EACH ROW
WHEN (NEW.promo_code != OLD.promo_code)
BEGIN
  RAISE EXCEPTION 'promo_code is immutable';
END;
```

---

## Table: affiliate_usages

**Purpose**: Immutable audit trail of every affiliate code application  
**Immutability**: INSERT only, no UPDATE/DELETE allowed  
**Usage Pattern**: Append-only; read for reporting/reconciliation

### Schema

```sql
CREATE TABLE affiliate_usages (
  -- Identifiers
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign Keys (Immutable References)
  affiliate_id UUID NOT NULL REFERENCES affiliates(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  --   Reference to the affiliate code used
  --   ON DELETE RESTRICT: Prevents deletion of active affiliate with usages
  --   ON UPDATE CASCADE: Auto-update if affiliate.id changes (unlikely but safe)

  client_id UUID NOT NULL,
  --   References clients table (from master_db or appropriate schema)
  --   Identifies the purchasing client
  --   Used for per-client usage limit counting

  license_id UUID NOT NULL UNIQUE,
  --   References licenses table (master_db + tenant_db context)
  --   One usage per license purchase (unique constraint)
  --   Prevents double-crediting same license to multiple affiliates

  -- Financial Data (Immutable Record)
  base_amount NUMERIC(12,2) NOT NULL,
  --   Purchase amount before discount
  --   Type: NUMERIC for deterministic calculations
  --   Precision: 2 decimal places (currency)
  --   Immutable: Captured at time of purchase for audit trail

  discount_amount NUMERIC(12,2) NOT NULL,
  --   Calculated discount: ROUND(base_amount * discount_percentage / 100, 2)
  --   Immutable: Captured at time of purchase
  --   Audit trail: Enables verification: discount_percentage = (discount_amount * 100) / base_amount

  commission_amount NUMERIC(12,2) NOT NULL,
  --   Calculated commission: ROUND(base_amount * commission_percentage / 100, 2)
  --   Immutable: Captured at time of purchase
  --   Audit trail: Enables verification and payout calculation

  -- Timestamp
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  --   Time of purchase transaction commit
  --   Immutable
  --   Audit trail: Enables temporal analysis

  -- Constraints
  CONSTRAINT positive_base_amount CHECK (base_amount > 0),
  CONSTRAINT non_negative_discount CHECK (discount_amount >= 0),
  CONSTRAINT non_negative_commission CHECK (commission_amount >= 0)
);
```

### Indexes

```sql
-- Affiliate Reporting (most common read pattern)
CREATE INDEX idx_affiliate_usages_affiliate_id ON affiliate_usages(affiliate_id);

-- Client Reporting
CREATE INDEX idx_affiliate_usages_client_id ON affiliate_usages(client_id);

-- License Tracking
CREATE INDEX idx_affiliate_usages_license_id ON affiliate_usages(license_id);

-- Time-Based Analysis
CREATE INDEX idx_affiliate_usages_created_at ON affiliate_usages(created_at DESC);

-- Composite: affiliate + client (per-client limit checking)
CREATE INDEX idx_affiliate_usages_affiliate_client ON affiliate_usages(affiliate_id, client_id);

-- Composite: client + created_at (client purchase history)
CREATE INDEX idx_affiliate_usages_client_date ON affiliate_usages(client_id, created_at DESC);
```

### Immutability Enforcement

```sql
-- Prevent INSERT after insert (no direct updates allowed)
CREATE TRIGGER affiliate_usages_immutable
BEFORE UPDATE ON affiliate_usages
FOR EACH ROW
BEGIN
  RAISE EXCEPTION 'affiliate_usages records are immutable (append-only audit log)';
END;

-- Prevent DELETE
CREATE TRIGGER affiliate_usages_prevent_delete
BEFORE DELETE ON affiliate_usages
FOR EACH ROW
BEGIN
  RAISE EXCEPTION 'affiliate_usages records cannot be deleted';
END;
```

---

## Table: affiliate_admin_audit

**Purpose**: Track all administrative actions on affiliate system (creates, updates, disables)  
**Immutability**: INSERT only, no UPDATE/DELETE allowed  
**Usage Pattern**: Audit trail for compliance and forensic investigation

### Schema

```sql
CREATE TABLE affiliate_admin_audit (
  -- Identifiers
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- What Was Modified
  affiliate_id UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE ON UPDATE CASCADE,
  --   Reference to affiliate being modified
  --   ON DELETE CASCADE: When affiliate soft-deleted, cascade delete audit (retention policy decision)
  --   ON UPDATE CASCADE: Auto-update if affiliate.id changes

  -- Who Did It
  admin_id UUID NOT NULL,
  --   References mmc_users table (admin identity)
  --   Identifies the administrator who performed the action

  -- What Happened
  action VARCHAR(50) NOT NULL CHECK (action IN ('CREATE', 'UPDATE', 'DISABLE', 'DELETE_ATTEMPT_PREVENTED')),
  --   CREATE: New affiliate record created
  --   UPDATE: Existing affiliate record modified
  --   DISABLE: Status changed from ACTIVE to INACTIVE
  --   DELETE_ATTEMPT_PREVENTED: Admin tried to delete, was blocked by ON DELETE RESTRICT

  -- Before/After Values (for audit trail)
  old_values JSONB,
  --   Previous column values (if UPDATE)
  --   NULL for CREATE actions
  --   Example: {"discount_percentage": "10.00", "usage_limit_total": 1000}

  new_values JSONB,
  --   New column values (if UPDATE or CREATE)
  --   NULL for DELETE_ATTEMPT_PREVENTED
  --   Example: {"discount_percentage": "15.00", "usage_limit_total": 500}

  -- Request Context
  ip_address INET,
  --   IP address of admin client
  --   Used for access pattern analysis
  --   Nullable: Fallback if not captured

  -- Timestamp
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  --   Action timestamp (immutable)

  -- Constraints
  CONSTRAINT json_consistency CHECK (
    (action = 'CREATE' AND old_values IS NULL)
    OR (action IN ('UPDATE', 'DISABLE') AND old_values IS NOT NULL)
    OR (action = 'DELETE_ATTEMPT_PREVENTED')
  )
);
```

### Indexes

```sql
-- Affiliate Audit Trail (most common read pattern)
CREATE INDEX idx_affiliate_admin_audit_affiliate_id ON affiliate_admin_audit(affiliate_id);

-- Admin Activity Tracking
CREATE INDEX idx_affiliate_admin_audit_admin_id ON affiliate_admin_audit(admin_id);

-- Time-Based Audit Analysis
CREATE INDEX idx_affiliate_admin_audit_created_at ON affiliate_admin_audit(created_at DESC);

-- Action Filtering
CREATE INDEX idx_affiliate_admin_audit_action ON affiliate_admin_audit(action);

-- Composite: affiliate + timestamp (chronological audit of single affiliate)
CREATE INDEX idx_affiliate_admin_audit_affiliate_date ON affiliate_admin_audit(affiliate_id, created_at DESC);

-- Composite: admin + timestamp (admin activity report)
CREATE INDEX idx_affiliate_admin_audit_admin_date ON affiliate_admin_audit(admin_id, created_at DESC);
```

### Immutability Enforcement

```sql
-- Prevent any modifications to audit records
CREATE TRIGGER affiliate_admin_audit_immutable
BEFORE UPDATE ON affiliate_admin_audit
FOR EACH ROW
BEGIN
  RAISE EXCEPTION 'affiliate_admin_audit records are immutable (append-only compliance log)';
END;

-- Prevent DELETE
CREATE TRIGGER affiliate_admin_audit_prevent_delete
BEFORE DELETE ON affiliate_admin_audit
FOR EACH ROW
BEGIN
  RAISE EXCEPTION 'affiliate_admin_audit records cannot be deleted (compliance requirement)';
END;
```

---

## Data Relationships & Constraints

### Referential Integrity Map

```
affiliates
    ↓
    ├─→ affiliate_usages (affiliate_id FK, ON DELETE RESTRICT)
    │   ├─→ clients (client_id)
    │   └─→ licenses (license_id, UNIQUE)
    │
    └─→ affiliate_admin_audit (affiliate_id FK, ON DELETE CASCADE)
        └─→ mmc_users (admin_id)
```

### Transactional Boundaries

**License Purchase with Affiliate Code** (Single SERIALIZABLE Transaction):

```
BEGIN TRANSACTION;
  SELECT * FROM affiliates WHERE promo_code = $1 FOR UPDATE;
  -- Acquire exclusive row lock, prevents concurrent modifications

  -- Validation (all in same transaction)
  CHECK status = 'ACTIVE'
  CHECK CURRENT_TIMESTAMP BETWEEN start_date AND end_date
  CHECK usage_count < usage_limit_total (if set)

  SELECT COUNT(*) FROM affiliate_usages
  WHERE affiliate_id = $1 AND client_id = $2;
  CHECK count < usage_limit_per_client (if set)

  -- Record Usage (immutable insert)
  INSERT INTO affiliate_usages
  (affiliate_id, client_id, license_id, base_amount, discount_amount, commission_amount)
  VALUES (...);

  -- Update Counter
  UPDATE affiliates SET usage_count = usage_count + 1
  WHERE id = $1;

  -- Complete License Purchase (existing logic)
  -- ... (license record creation, etc.)

COMMIT;
-- OR ROLLBACK if any validation fails
```

### Cascading Operations

**Admin Disables Affiliate Code**:

```typescript
// Transaction flow:
// 1. Admin calls PATCH /v1/mmc/affiliates/:id with status='INACTIVE'
// 2. Application validates admin auth
// 3. BEGIN transaction
// 4. UPDATE affiliates SET status = 'INACTIVE' WHERE id = $1
// 5. INSERT INTO affiliate_admin_audit (affiliate_id, admin_id, action='DISABLE', new_values=...)
// 6. COMMIT
// Result: Code disabled, audit logged, existing usages unaffected
// Note: affiliate_usages records are immutable and remain for audit trail
```

**Rollback on Validation Failure**:

```typescript
// If usage_count >= usage_limit_total:
// 1. Validation fails within transaction
// 2. ROLLBACK entire transaction
// 3. affiliate_usages record NOT inserted
// 4. usage_count NOT incremented
// 5. License purchase does NOT proceed
// 6. Client sees HTTP 400 with AFFILIATE_USAGE_LIMIT_EXCEEDED
```

---

## Concurrency & Locking Strategy

### Query Pattern: License Purchase with Affiliate

```sql
-- Step 1: Acquire exclusive lock (pessimistic)
SELECT * FROM affiliates WHERE promo_code = $1 FOR UPDATE;

-- Step 2: Validate (all within lock scope)
-- * Check status, dates, usage limits
-- * COUNT from affiliate_usages for per-client limit

-- Step 3: Insert usage record (immutable)
INSERT INTO affiliate_usages (...) VALUES (...);

-- Step 4: Increment counter (atomic with lock)
UPDATE affiliates SET usage_count = usage_count + 1 WHERE id = $1;
```

**Lock Behavior**:

- **Concurrent Transaction 1**: Acquires lock, validates, inserts usage, increments counter, commits
- **Concurrent Transaction 2**: Waits for Transaction 1's lock release (default timeout ~30 seconds)
- **Result**: Transaction 2 sees incremented counter from Transaction 1, checks limit again,
  proceeds or rejects
- **Safety**: No double-counting, deterministic behavior, audit trail captures both transactions

### Deadlock Prevention

- Single table involved (affiliates): No nested locks
- Consistent lock ordering: Always same affiliate row
- Minimal lock duration: < 100ms typical
- No blocking on affiliate_usages reads (SELECT uses snapshot isolation)

---

## Reconciliation Queries

### Validate usage_count Accuracy

```sql
-- Compare counter vs reality (should always match)
SELECT
  a.id,
  a.promo_code,
  a.usage_count,
  COUNT(au.id) as actual_count,
  CASE
    WHEN a.usage_count = COUNT(au.id) THEN 'OK'
    ELSE 'MISMATCH'
  END as status
FROM affiliates a
LEFT JOIN affiliate_usages au ON a.id = au.affiliate_id
GROUP BY a.id, a.promo_code, a.usage_count
ORDER BY status DESC;
```

### Find Orphaned Records (should be empty)

```sql
-- Affiliate usages without affiliate (should be impossible)
SELECT au.id, au.affiliate_id
FROM affiliate_usages au
LEFT JOIN affiliates a ON au.affiliate_id = a.id
WHERE a.id IS NULL;
```

### Admin Audit Trail for Specific Affiliate

```sql
SELECT
  aaa.created_at,
  aaa.action,
  aaa.admin_id,
  aaa.old_values,
  aaa.new_values,
  aaa.ip_address
FROM affiliate_admin_audit aaa
WHERE aaa.affiliate_id = $1
ORDER BY aaa.created_at DESC;
```

### Financial Reconciliation Report

```sql
SELECT
  au.affiliate_id,
  a.promo_code,
  COUNT(*) as usage_count,
  SUM(au.base_amount) as total_base,
  SUM(au.discount_amount) as total_discount,
  SUM(au.commission_amount) as total_commission,
  AVG(au.discount_amount::numeric / NULLIF(au.base_amount, 0)) * 100 as avg_discount_pct
FROM affiliate_usages au
JOIN affiliates a ON au.affiliate_id = a.id
GROUP BY au.affiliate_id, a.promo_code
ORDER BY total_commission DESC;
```

---

## Schema Evolution Constraints

### Immutable Fields (Cannot Be Changed After Initial Migration)

- `affiliates.promo_code` - Enforced by trigger
- `affiliate_usages.*` - Enforced by immutability trigger
- `affiliate_admin_audit.*` - Enforced by immutability trigger

### Mutable Fields (Can Be Changed via Admin Operations)

- `affiliates.discount_percentage`
- `affiliates.commission_percentage`
- `affiliates.usage_limit_total`
- `affiliates.usage_limit_per_client`
- `affiliates.start_date` / `end_date`
- `affiliates.status` (ACTIVE ↔ INACTIVE)
- `affiliates.description`
- `affiliates.allow_with_other_discounts`

### Version Tracking

- Master_db schema version: Incremented with migration
- Affiliate table: No per-record version (append-only audit trail sufficient)
- Migration: Two sequential migrations (see Implementation Plan)

---

## Performance Characteristics

### Read Operations

- **By promo_code**: O(log n) via unique index
- **By affiliate_id**: O(log n) via index on affiliate_usages
- **By status**: O(log n) via index
- **Time range queries**: O(log n) via start_date/end_date index

### Write Operations

- **Create affiliate**: O(1) INSERT
- **Update affiliate**: O(1) UPDATE (triggers auto-manage updated_at)
- **Disable affiliate**: O(1) UPDATE + O(1) INSERT to audit
- **Record usage**: O(log n) UPDATE (usage_count++) + O(1) INSERT to audit

### Expected Query Times (Tuning Notes)

- Affiliate lookup: < 1ms (in-memory cache possible)
- Usage validation: 10-50ms (includes row lock acquisition + per-client count)
- License purchase total: < 200ms p95 including affiliate validation

---

## Summary

The affiliate system schema enforces:

✓ **Financial Accuracy**: NUMERIC precision, deterministic rounding  
✓ **Concurrency Safety**: Row-level locking, transactional integrity  
✓ **Audit Completeness**: Immutable usage + admin action trails  
✓ **Data Integrity**: Foreign keys, CHECK constraints, triggers  
✓ **Performance**: Indexes on common query patterns  
✓ **Compliance**: Append-only records, detailed audit logs

All logic is database-enforced, not application-layer dependent.
