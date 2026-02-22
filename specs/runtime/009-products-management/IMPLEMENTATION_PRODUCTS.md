# Products Management Implementation Guide

**Stage:** STAGE_09_PRODUCTS  
**Status:** Core implementation complete (51/79 tasks)  
**Last Updated:** 2024-12-15

## Quick Reference

### Key Files

```
packages/domain-core/src/products/
├── productService.ts          # Business logic (8 core functions)
├── productValidation.ts       # Validation helpers
└── types/
    └── Product.ts             # Type definitions

packages/types/src/
├── enums/Module.ts            # 6 module definitions
├── products/
│   ├── Product.ts             # Core interfaces
│   └── AuditLog.ts            # Audit structures
└── errors/
    └── ErrorCodes.ts          # All 13 error codes

apps/api/src/
├── routes/mmc/
│   └── products.ts            # 7 API endpoints
├── middleware/
│   ├── correlationIdMiddleware.ts
│   ├── licenseMiddleware.ts
│   ├── auditReadMiddleware.ts
│   └── rateLimitMiddleware.ts
└── utils/
    ├── errorHandler.ts        # Error mapping
    └── responseWrapper.ts     # Response formatting

apps/api/src/db/master/migrations/
├── 20260221_004_create_products.sql
└── 20260222_005_complete_products_schema.sql
```

---

## Architecture Overview

### Layered Structure

```
┌─────────────────────────────────┐
│   API Routes (7 endpoints)      │
├─────────────────────────────────┤
│   Middleware Chain (5 layers)   │
├─────────────────────────────────┤
│   Domain Services (8 functions) │
├─────────────────────────────────┤
│   Validation (5 validators)     │
├─────────────────────────────────┤
│   Database Layer                │
│   (PostgreSQL with Drizzle)     │
└─────────────────────────────────┘
```

### Trust Chain

```
Client Request
    ↓
1. Correlation ID Middleware (trace all requests)
    ↓
2. Authentication Middleware (verify token)
    ↓
3. License Middleware (validate workspace)
    ↓
4. Route Handler (business logic)
    ↓
API Response
```

---

## Data Model

### Products Table

```sql
CREATE TABLE products (
    id UUID PRIMARY KEY,
    name JSONB NOT NULL,              -- {en: string, ar?: string}
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    enabled_modules TEXT[] NOT NULL,  -- Array of Module enums
    status VARCHAR(20) NOT NULL,      -- ACTIVE, INACTIVE
    current_version INTEGER NOT NULL, -- Current version number
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);
```

### Product Versions Table (Immutable)

```sql
CREATE TABLE product_versions (
    id UUID PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES products(id),
    version_number INTEGER NOT NULL,
    name JSONB NOT NULL,
    enabled_modules TEXT[] NOT NULL,
    description TEXT,
    change_summary TEXT,
    created_at TIMESTAMP NOT NULL,

    UNIQUE(product_id, version_number)
);
```

### Audit Logs Table (Immutable)

```sql
CREATE TABLE product_audit_logs (
    id UUID PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES products(id),
    action VARCHAR(50) NOT NULL,      -- CREATE, UPDATE, STATUS_CHANGE
    previous_version INTEGER,
    new_version INTEGER,
    changed_fields JSONB,              -- {field: {old, new}}
    performed_by VARCHAR(255),
    timestamp TIMESTAMP NOT NULL,

    INDEX(product_id, timestamp DESC),
    INDEX(action),
    INDEX(performed_by)
);
```

---

## Core Functions

### 1. createProduct()

**Location:** `packages/domain-core/src/products/productService.ts`

**Behavior:**

- Creates product with initial version 1
- Atomic transaction: insert product → insert version 1 → insert audit log
- Returns Product with current_version = 1

**Parameters:**

```typescript
async function createProduct(
  client: PoolClient,
  input: CreateProductInput,
  performedBy: string
): Promise<Product>
```

**Transaction:**

```sql
BEGIN;
  INSERT INTO products (...) RETURNING *;
  INSERT INTO product_versions (...);
  INSERT INTO product_audit_logs WITH action='CREATE';
COMMIT;
```

### 2. updateProduct()

**Location:** `packages/domain-core/src/products/productService.ts`

**Behavior:**

- Detects actual changes using field diff
- Only increments version if changes detected
- Atomic transaction: compute diff → insert version → update product → insert audit

**Parameters:**

```typescript
async function updateProduct(
  client: PoolClient,
  id: string,
  input: UpdateProductInput,
  performedBy: string
): Promise<Product>
```

**Version Increment Logic:**

```typescript
const hasChanges = computeFieldDiff(old, input)
if (!hasChanges) {
  // Return without incrementing version
  return product
}
// Increment version and create audit log
const newVersion = product.current_version + 1
```

### 3. changeProductStatus()

**Location:** `packages/domain-core/src/products/productService.ts`

**Behavior:**

- Changes status without affecting version
- Creates STATUS_CHANGE audit log (no previous_version/new_version)
- Atomic transaction: update status → insert audit

**Key Difference from UPDATE:**

- Version NOT incremented
- No change_summary
- No previous_version/new_version in audit log

### 4. getProductById()

**Location:** `packages/domain-core/src/products/productService.ts`

**Behavior:**

- Simple SELECT query
- Returns complete product object with current_version

### 5. getProductBySlug()

**Location:** `packages/domain-core/src/products/productService.ts`

**Behavior:**

- Query by unique slug
- Used in product creation to detect duplicates

### 6. listProducts()

**Location:** `packages/domain-core/src/products/productService.ts`

**Pagination Logic:**

```typescript
const limit = Math.min(filters.limit || 20, 100) // Cap at 100
const offset = filters.offset || 0

// Build WHERE clause
let where = ''
if (filters.status === 'ACTIVE' || filters.status === 'INACTIVE') {
  where += `WHERE status = '${filters.status}'`
}

// Execute query
const results = await client.query(
  `SELECT * FROM products ${where} 
   ORDER BY created_at DESC 
   LIMIT $1 OFFSET $2`,
  [limit, offset]
)
```

### 7. deleteProduct()

**Location:** `packages/domain-core/src/products/productService.ts`

**Behavior:**

- Check for licenses (throws error if exist)
- Cascade delete: audit logs → versions → product
- All in single atomic transaction

**Cascade Delete Order:**

```sql
BEGIN;
  DELETE FROM product_audit_logs WHERE product_id = $1;
  DELETE FROM product_versions WHERE product_id = $1;
  DELETE FROM products WHERE id = $1;
COMMIT;
```

### 8. getProductAuditLog()

**Location:** `packages/domain-core/src/products/productService.ts`

**Behavior:**

- Query with optional filters (action, date range)
- Paginate results
- Sort by timestamp DESC
- Include performed_by user details

---

## Validation Functions

### validateProductName()

```typescript
// Requirements:
// - name.en required (1-255 chars)
// - name.ar optional (1-255 chars)
// - No special validation, allow all characters

const isValid =
  name.en &&
  name.en.length >= 1 &&
  name.en.length <= 255 &&
  (!name.ar || (name.ar.length >= 1 && name.ar.length <= 255))
```

### validateModulesEnum()

```typescript
// Requirements:
// - At least one module
// - All modules must be valid enum values
// - No duplicates allowed

const validModules = [
  'MCQ',
  'TRADITIONAL_EXAMS',
  'EXERCISES',
  'LIBRARY',
  'LIVES',
  'FORUM',
]
const isValid =
  modules.length > 0 &&
  modules.every((m) => validModules.includes(m)) &&
  new Set(modules).size === modules.length
```

### validateSlug()

```typescript
// Requirements:
// - 1-100 chars
// - Lowercase alphanumeric + dashes
// - Cannot start or end with dash
// - No spaces or special chars

const isValid =
  /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(slug) &&
  slug.length >= 1 &&
  slug.length <= 100
```

### validateSlugUniqueness()

```typescript
const result = await client.query(
  'SELECT COUNT(*) as count FROM products WHERE slug = $1',
  [slug]
)
const isDuplicate = result.rows[0].count > 0
if (isDuplicate) {
  throw new AppError(ErrorCodes.DUPLICATE_SLUG, 'Product slug already exists')
}
```

### getProductName()

```typescript
// Localization fallback
// Returns requested language if available, else English
export function getProductName(
  product: Product,
  lang: 'en' | 'ar' = 'en'
): string {
  if (lang === 'ar' && product.name.ar) {
    return product.name.ar
  }
  return product.name.en
}
```

---

## API Endpoints

### 1. POST /api/v1/mmc/products

```typescript
Router.post(
  '/products',
  correlationIdMiddleware,
  licenseMiddleware,
  asyncHandler(async (c: Context) => {
    const body = c.req.json()
    const validated = CreateProductSchema.parse(body)
    const product = await productService.createProduct(
      dbClient,
      validated,
      userId
    )
    return sendCreated(c, product)
  })
)
```

**Rate Limit:** 10 req/min

### 2. GET /api/v1/mmc/products

**Rate Limit:** 100 req/min

### 3. GET /api/v1/mmc/products/:id

**Rate Limit:** 100 req/min

### 4. PUT /api/v1/mmc/products/:id

**Rate Limit:** 20 req/min

### 5. PATCH /api/v1/mmc/products/:id/status

```typescript
// Important: Version NOT incremented
Router.patch(
  '/products/:id/status',
  correlationIdMiddleware,
  licenseMiddleware,
  asyncHandler(async (c: Context) => {
    const { status } = c.req.json()
    const product = await productService.changeProductStatus(
      dbClient,
      productId,
      status,
      userId
    )
    return sendSuccess(c, product)
  })
)
```

**Rate Limit:** 20 req/min

### 6. DELETE /api/v1/mmc/products/:id

**Rate Limit:** 10 req/min (conservative to prevent accidents)

### 7. GET /api/v1/mmc/products/:id/audit-log

```typescript
// Additional middleware: auditReadMiddleware
Router.get(
  '/products/:id/audit-log',
  correlationIdMiddleware,
  auditReadMiddleware, // Verify AUDIT_READ permission
  licenseMiddleware,
  asyncHandler(async (c: Context) => {
    const filters = AuditLogQueryFiltersSchema.parse(c.req.query())
    const logs = await productService.getProductAuditLog(
      dbClient,
      productId,
      filters
    )
    return sendList(c, logs.items, logs.total, logs.limit, logs.offset)
  })
)
```

**Rate Limit:** 50 req/min

---

## Extending with New Modules

To add a new module:

### 1. Update Module Enum

**File:** `packages/types/src/enums/Module.ts`

```typescript
export enum Module {
  MCQ = 'MCQ',
  TRADITIONAL_EXAMS = 'TRADITIONAL_EXAMS',
  EXERCISES = 'EXERCISES',
  LIBRARY = 'LIBRARY',
  LIVES = 'LIVES',
  FORUM = 'FORUM',
  NEW_MODULE = 'NEW_MODULE', // Add here
}

export const ModuleLabels: Record<Module, { en: string; ar: string }> = {
  // ... existing
  [Module.NEW_MODULE]: { en: 'New Module', ar: 'وحدة جديدة' },
}
```

### 2. Update Validation

**File:** `packages/validation/src/products/productValidation.ts`

```typescript
const VALID_MODULES = Object.values(Module)

export function validateModulesEnum(modules: unknown[]): boolean {
  return modules.every((m) => VALID_MODULES.includes(m as Module))
}
```

### 3. Update API Documentation

**File:** `docs/API_PRODUCTS_MANAGEMENT.md`

Add to Module Definitions table.

### 4. No Database Change Needed

The `enabled_modules` is stored as TEXT[] (flexible array), no migration needed.

---

## Error Handling

### Error Code Mapping

Error codes → HTTP Status → Message

```typescript
const ErrorCodeToStatusMap = {
  INVALID_MODULE_ENUM: 400,
  INVALID_NAME_LOCALIZATION: 400,
  SLUG_NOT_MUTABLE: 400,
  DUPLICATE_SLUG: 409,
  PRODUCT_HAS_LICENSES: 409,
  PRODUCT_NOT_FOUND: 404,
  LICENSE_NOT_FOUND: 404,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  WORKSPACE_LOCKED: 423,
  WORKSPACE_ARCHIVED: 403,
  VERSION_MISMATCH: 426,
  INTERNAL_SERVER_ERROR: 500,
}
```

### Throwing Errors

```typescript
// In domain service
throw new AppError(
  ErrorCodes.DUPLICATE_SLUG,
  'Product slug already exists',
  { slug }
);

// In handler
catch (error) {
  return handleError(c, error);
}
```

---

## Testing

### Running Tests

```bash
# All products tests
npm run test -- products

# Unit tests
npm run test -- tests/unit/products

# Integration tests
npm run test -- tests/integration/products

# Load tests
npm run test -- tests/load/products

# Contract tests
npm run test -- tests/contract/products
```

### Test Coverage Goals

- **Unit:** 95%+ coverage on validation and service logic
- **Integration:** 100% endpoint coverage
- **Load:** Verify performance under 10k+ operations
- **Contract:** OpenAPI compliance

---

## Monitoring & Observability

### Structured Logging

All operations include correlation ID:

```typescript
logger.info('product_created', {
  correlation_id: correlationId,
  workspace_id: workspaceId,
  user_id: userId,
  product_id: product.id,
  product_slug: product.slug,
  duration_ms: Date.now() - startTime,
})
```

### Metrics

Prometheus metrics available:

```
product_create_duration_ms (histogram)
product_update_duration_ms (histogram)
product_list_duration_ms (histogram)
product_create_total (counter, by status)
product_error_total (counter, by error_code)
product_count (gauge, by status)
```

---

## Performance Considerations

### Indexes

```sql
CREATE INDEX idx_products_slug ON products(slug);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_created_at ON products(created_at DESC);
CREATE INDEX idx_versions_product_id ON product_versions(product_id);
CREATE INDEX idx_audit_logs_product_id ON product_audit_logs(product_id);
CREATE INDEX idx_audit_logs_timestamp ON product_audit_logs(timestamp DESC);
```

### Query Optimization

- List pagination: max 100 items per page
- Audit logs: limited to 100 items per page
- Search: indexed on slug, name (full-text possible future)
- All queries use prepared statements (Drizzle ORM)

### Concurrency Control

- PostgreSQL sequential consistency via transactions
- Rate limiting prevents thundering herd
- Version numbers prevent lost updates
- Audit logs immutable for compliance

---

## Security

### Secrets

No secrets in code. License keys/tokens managed by license middleware.

### Input Validation

- All inputs validated with Zod schemas
- Slug format restricted to alphanumeric + dashes
- Module enum validated against known values
- Names limited to 255 chars

### Access Control

- `products:read` scope for GET operations
- `products:write` scope for POST/PUT
- `products:delete` scope for DELETE
- `products:audit` scope for audit log access
- All checked in middleware

---

## Stage 10 Integration (License Engine)

Products are consumed by Stage 10 (License Engine):

```
Product (Stage 09)
    ↓
    └─→ License (Stage 10)
         ├─ quantity: number
         ├─ valid_from/to: date
         └─ product_id: FK to Product
```

**Constraint:** Cannot delete product with active licenses (implement before Stage 10).

---

## Troubleshooting

### "Product not found" but I just created it

- Verify product was created (check audit log)
- Verify you're querying same workspace
- Check database connection

### Version not incrementing on update

- Verify actual changes in request body
- Check no-change scenario: if old === new, version unchanged (by design)

### Rate limit exceeded

- Implement exponential backoff in clients
- Check limit headers in response

### Audit log query slow

- Verify timestamp index exists
- Use smaller date range filters

---

## Next Steps

**Stage 10 (License Engine):** Implement licensing system with products as base template
