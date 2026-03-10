# Implementation Guide: Products Management

## Architecture Overview

The Products Management feature is implemented across three layers following Zidney's layered
architecture:

### Layer Stack

```
┌─────────────────────────────────────┐
│  API Layer (apps/api)               │
│  - HTTP routing (Hono framework)    │
│  - Middleware chain                 │
│  - Request/response handling        │
└─────────────────────────────────────┘
              ↓ depends on
┌─────────────────────────────────────┐
│  Domain Layer (packages/domain-core)│
│  - Business logic                   │
│  - Service functions                │
│  - Validation rules                 │
└─────────────────────────────────────┘
              ↓ depends on
┌─────────────────────────────────────┐
│  Database Layer                     │
│  - PostgreSQL schema                │
│  - Transactions                     │
│  - Connection pooling               │
└─────────────────────────────────────┘
```

## Project Structure

### API Routes

**File**: `apps/api/src/routes/mmc/products.ts`

Contains all HTTP endpoint handlers:

```
POST   /products              → createProduct()
GET    /products              → listProducts()
GET    /products/:id          → getProductById()
PUT    /products/:id          → updateProduct()
PATCH  /products/:id/status   → changeProductStatus()
DELETE /products/:id          → deleteProduct()
GET    /products/:id/audit-log → getProductAuditLog()
```

**Middleware Chain** (in execution order):

1. `correlationIdMiddleware` - Adds X-Correlation-ID header for request tracing
2. `authMiddleware` - Validates JWT token
3. `licenseMiddleware` - Validates workspace license status
4. `auditReadMiddleware` - _(audit endpoints only)_ - Enables audit log reads

### Domain Service

**File**: `packages/domain-core/src/products/productService.ts`

Pure business logic layer with no HTTP dependencies:

```typescript
// Product CRUD operations
export async function createProduct(
  dbClient,
  input: CreateProductInput,
  userId: string,
): Promise<Product>;

export async function updateProduct(
  dbClient,
  productId: string,
  updates: UpdateProductInput,
  userId: string,
): Promise<Product>;

export async function changeProductStatus(
  dbClient,
  productId: string,
  newStatus: ProductStatus,
  userId: string,
): Promise<Product>;

// Product queries
export async function getProductById(dbClient, productId: string): Promise<Product>;

export async function getProductBySlug(dbClient, slug: string): Promise<Product>;

export async function listProducts(
  dbClient,
  options?: ListOptions,
): Promise<PaginatedResponse<Product>>;

// Audit operations
export async function getProductAuditLog(
  dbClient,
  productId: string,
  options?: ListOptions,
): Promise<PaginatedResponse<AuditLogEntry>>;

export async function deleteProduct(dbClient, productId: string, userId: string): Promise<void>;
```

### Type Definitions

**File**: `packages/types/products/Product.ts`

```typescript
export interface Product {
  id: string;
  name: ProductName;
  slug: string;
  description?: string | null;
  enabled_modules: ModuleEnum[];
  status: ProductStatus;
  current_version: number;
  created_at: string;
  updated_at: string;
}

export interface ProductVersion {
  id: string;
  product_id: string;
  version_number: number;
  name: ProductName;
  slug: string;
  description?: string | null;
  enabled_modules: ModuleEnum[];
  created_at: string;
  created_by: string;
}

export interface AuditLogEntry {
  id: string;
  product_id: string;
  action: AuditAction;
  timestamp: string;
  performed_by: string;
  previous_version?: number | null;
  new_version?: number | null;
  changed_fields?: Record<string, FieldChange> | null;
}

export type ProductStatus = "ACTIVE" | "INACTIVE";
export type AuditAction = "CREATE" | "UPDATE" | "STATUS_CHANGE";
export type ModuleEnum =
  | "MODULE_ASSESSMENT"
  | "MODULE_ATTEMPT"
  | "MODULE_CONTENT"
  | "MODULE_REPORTING"
  | "MODULE_PROCTOR"
  | "MODULE_ANALYTICS";
```

## Database Schema

### Table: products

```sql
CREATE TABLE products (
  id UUID PRIMARY KEY,
  name JSONB NOT NULL,                    -- { "en": "...", "ar": "..." }
  slug VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  enabled_modules TEXT[] NOT NULL,        -- Array of module enums
  status VARCHAR(50) NOT NULL,            -- 'ACTIVE', 'INACTIVE'
  current_version INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  created_by UUID NOT NULL
);

CREATE INDEX idx_products_slug ON products(slug);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_created_at ON products(created_at DESC);
```

### Table: product_versions

```sql
CREATE TABLE product_versions (
  id UUID PRIMARY KEY,
  product_id UUID NOT NULL,              -- Foreign key to products
  version_number INTEGER NOT NULL,
  name JSONB NOT NULL,
  slug VARCHAR(255) NOT NULL,
  description TEXT,
  enabled_modules TEXT[] NOT NULL,
  created_at TIMESTAMP NOT NULL,
  created_by UUID NOT NULL,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX idx_product_versions_unique
  ON product_versions(product_id, version_number);
CREATE INDEX idx_product_versions_created_at
  ON product_versions(created_at DESC);
```

### Table: product_audit_logs

```sql
CREATE TABLE product_audit_logs (
  id UUID PRIMARY KEY,
  product_id UUID NOT NULL,              -- Foreign key to products
  action VARCHAR(50) NOT NULL,           -- 'CREATE', 'UPDATE', 'STATUS_CHANGE'
  timestamp TIMESTAMP NOT NULL,
  performed_by UUID NOT NULL,
  previous_version INTEGER,
  new_version INTEGER,
  changed_fields JSONB,                  -- Only for UPDATE
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE INDEX idx_audit_logs_product_id ON product_audit_logs(product_id);
CREATE INDEX idx_audit_logs_action ON product_audit_logs(action);
CREATE INDEX idx_audit_logs_timestamp ON product_audit_logs(timestamp DESC);
```

## Data Flow

### Product Creation Flow

```
HTTP Request (POST /products)
  ↓
API Route Handler
  ↓
Middleware Chain
  - Correlation ID
  - Auth validation
  - License validation
  ↓
productService.createProduct()
  ├─ Validate input
  │  ├─ Check name (English required, Arabic optional)
  │  ├─ Check slug (unique, lowercase alphanumeric+hyphens)
  │  └─ Check modules (1+ required, no duplicates)
  │
  ├─ Start transaction
  │  ├─ Insert into products (status: ACTIVE, version: 1)
  │  ├─ Insert into product_versions (version 1 snapshot)
  │  ├─ Insert into product_audit_logs (action: CREATE)
  │  └─ Commit
  │
  ├─ Log operation (structured logging)
  │
  └─ Return Product object
      ↓
API Route Handler
  ├─ Set HTTP status: 201
  ├─ Add headers (Correlation-ID, Rate-Limit)
  └─ Return JSON response
      ↓
HTTP Response
```

### Product Update Flow

```
HTTP Request (PUT /products/:id)
  ↓
API Route Handler
  ↓
Middleware Chain
  ↓
productService.updateProduct()
  ├─ Get current product
  ├─ Validate updates
  ├─ Compute changes (computeFieldDiff)
  │
  ├─ If NO changes detected
  │  └─ Return current product (no-op, no version bump)
  │
  ├─ If changes detected
  │  ├─ Increment current_version
  │  ├─ Start transaction
  │  │  ├─ Update products table
  │  │  ├─ Insert new product_versions record
  │  │  ├─ Insert product_audit_logs (action: UPDATE, with changed_fields)
  │  │  └─ Commit
  │  │
  │  ├─ Log operation
  │  └─ Return updated Product
      ↓
HTTP Response (200)
```

### Status Change Flow

```
HTTP Request (PATCH /products/:id/status)
  ↓
productService.changeProductStatus()
  ├─ Get current product
  ├─ Validate new status
  │
  ├─ Start transaction
  │  ├─ Update products.status
  │  ├─ Update products.updated_at
  │  ├─ Insert product_audit_logs (action: STATUS_CHANGE, no version bump)
  │  └─ Commit
  │
  └─ Return updated Product
      ↓
HTTP Response (200)
```

**Key Difference**: Update increments version, Status Change does not.

## Validation Rules

### Product Name

- **Required**: English (en) name
- **Optional**: Arabic (ar) name
- **Length**: 1-255 characters per language
- **Type**: Non-empty string

```typescript
function validateProductName(name: ProductName): void {
  if (!name.en || name.en.length === 0) {
    throw new ValidationError("INVALID_NAME_LOCALIZATION", "English name required");
  }
  if (name.en.length > 255) {
    throw new ValidationError("INVALID_NAME_LOCALIZATION", "Name too long");
  }
  if (name.ar && name.ar.length > 255) {
    throw new ValidationError("INVALID_NAME_LOCALIZATION", "Arabic name too long");
  }
}
```

### Slug

- **Format**: Lowercase letters, numbers, hyphens
- **Pattern**: `^[a-z0-9]+(?:-[a-z0-9]+)*$`
- **Length**: 1-255 characters
- **Uniqueness**: Database constraint (UNIQUE)
- **Immutability**: Cannot change post-creation

```typescript
function validateSlug(slug: string): void {
  const pattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  if (!pattern.test(slug)) {
    throw new ValidationError(
      "INVALID_SLUG_FORMAT",
      "Slug must be lowercase alphanumeric with hyphens only",
    );
  }
  if (slug.length > 255) {
    throw new ValidationError("INVALID_SLUG_FORMAT", "Slug too long");
  }
}
```

### Modules

- **Valid values**: MODULE_ASSESSMENT, MODULE_ATTEMPT, MODULE_CONTENT, MODULE_REPORTING,
  MODULE_PROCTOR, MODULE_ANALYTICS
- **Minimum**: 1 module required
- **Maximum**: 6 modules
- **Uniqueness**: No duplicates allowed

```typescript
function validateModulesEnum(modules: ModuleEnum[]): void {
  const validModules = [
    "MODULE_ASSESSMENT",
    "MODULE_ATTEMPT",
    "MODULE_CONTENT",
    "MODULE_REPORTING",
    "MODULE_PROCTOR",
    "MODULE_ANALYTICS",
  ];

  if (modules.length === 0) {
    throw new ValidationError("INVALID_MODULE_ENUM", "At least one module required");
  }

  const seen = new Set<string>();
  for (const mod of modules) {
    if (!validModules.includes(mod)) {
      throw new ValidationError("INVALID_MODULE_ENUM", `Invalid module: ${mod}`);
    }
    if (seen.has(mod)) {
      throw new ValidationError("INVALID_MODULE_ENUM", "Duplicate module");
    }
    seen.add(mod);
  }
}
```

### Status Transitions

- **ACTIVE** → INACTIVE: Allowed
- **INACTIVE** → ACTIVE: Allowed
- **ACTIVE** → ACTIVE: Allowed (idempotent)
- **INACTIVE** → INACTIVE: Allowed (idempotent)

## Extending Products

### Adding New Modules

1. **Update type definition** (`packages/types/products/Product.ts`):

```typescript
export type ModuleEnum =
  | "MODULE_ASSESSMENT"
  | "MODULE_ATTEMPT"
  | "MODULE_CONTENT"
  | "MODULE_REPORTING"
  | "MODULE_PROCTOR"
  | "MODULE_ANALYTICS"
  | "MODULE_NEW_FEATURE"; // Add here
```

2. **Update validation** (`packages/domain-core/src/products/productService.ts`):

```typescript
const validModules = [
  "MODULE_ASSESSMENT",
  "MODULE_ATTEMPT",
  "MODULE_CONTENT",
  "MODULE_REPORTING",
  "MODULE_PROCTOR",
  "MODULE_ANALYTICS",
  "MODULE_NEW_FEATURE", // Add here
];
```

3. **Database schema already supports** (uses TEXT[]):

No migration needed for array column.

### Adding New Product Fields

1. **Update Product interface**:

```typescript
export interface Product {
  // ... existing fields
  new_field?: string | null;
}
```

2. **Create migration**:

```sql
ALTER TABLE products ADD COLUMN new_field VARCHAR(255);
ALTER TABLE product_versions ADD COLUMN new_field VARCHAR(255);
```

3. **Update validation** + **API endpoints** + **service functions**.

4. **Update OpenAPI spec** (`docs/api/products-management-api-spec.yaml`).

### Adding New Endpoints

Follow the existing pattern:

1. Add function to `productService.ts`
2. Add route handler to `apps/api/src/routes/mmc/products.ts`
3. Add middleware if needed (auth, license validation)
4. Add unit tests to `/tests/unit/`
5. Add integration tests to `/tests/integration/`
6. Update OpenAPI spec

## Error Handling

All errors follow the standard error format:

```typescript
interface ErrorResponse {
  success: false;
  data: null;
  error: {
    code: string;
    message: string;
  };
}
```

### Error Codes

| Code                      | HTTP | Cause                               |
| ------------------------- | ---- | ----------------------------------- |
| DUPLICATE_SLUG            | 409  | Slug already exists                 |
| INVALID_MODULE_ENUM       | 400  | Invalid module value                |
| INVALID_NAME_LOCALIZATION | 400  | Invalid name structure              |
| INVALID_SLUG_FORMAT       | 400  | Slug format invalid                 |
| PRODUCT_NOT_FOUND         | 404  | Product ID not found                |
| PRODUCT_HAS_LICENSES      | 409  | Cannot delete product with licenses |
| INTERNAL_SERVER_ERROR     | 500  | Unexpected error                    |

## Logging

All operations are logged with structured logging:

```typescript
log({
  level: "info",
  message: "Product created",
  service: "products-api",
  workspace_id: ctx.workspaceId,
  workspace_slug: ctx.workspaceSlug,
  user_id: userId,
  correlation_id: ctx.correlationId,
  product_id: product.id,
  product_slug: product.slug,
});
```

## Performance Considerations

### Indexes

- **products.slug**: Unique constraint ensures O(1) lookup
- **product_versions.product_id, version_number**: Unique ensures efficient version lookups
- **product_audit_logs.product_id**: Enables fast pagination of audit logs
- **product_audit_logs.timestamp DESC**: Sorted audit log queries

### Query Optimization

List products query is optimized:

```sql
SELECT * FROM products
WHERE status = 'ACTIVE'
ORDER BY created_at DESC
LIMIT 10 OFFSET 0;
```

Uses index on (status, created_at).

Audit log pagination is efficient:

```sql
SELECT * FROM product_audit_logs
WHERE product_id = $1
ORDER BY timestamp DESC
LIMIT 10 OFFSET 0;
```

Uses index on (product_id, timestamp DESC).

## Transaction Safety

### ACID Properties

All multi-row operations use transactions:

**Create**: Insert 3 rows atomically (products, product_versions, product_audit_logs)

```typescript
const client = await dbClient.connect();
try {
  await client.query("BEGIN");
  // ... insert rows
  await client.query("COMMIT");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
}
```

**Update**: 3 rows updated atomically

**Delete**: Cascade delete via foreign key (automatic)

## Stage 10 Handoff

This implementation completes Stage 9 (Products Management Phase 1-9 + testing/documentation).

### Next Stage (Stage 10): Product Licensing

- Products ← → Licenses (one-to-many)
- License distribution to workspaces
- License usage tracking
- Entitlement validation

**Build on**: Current product service layer

**Dependencies**: This stage's API endpoints, service functions, type definitions, and database
schema.

### Integration Points for Stage 10

1. **License Service** will call:
   - `getProductById()` - Validate product exists
   - `getProductBySlug()` - Lookup by slug
   - `listProducts()` - List available products

2. **License Service** will add:
   - Foreign key: licenses.product_id → products.id
   - License status tracking
   - Entitlement calculations

3. **Product API** will be extended:
   - GET /products/:id/licenses - List associated licenses
   - Delete protection: PRODUCT_HAS_LICENSES error

## Testing

Comprehensive test coverage across three levels:

### Unit Tests (Phase 11: T061-T065)

- Validation functions
- Service logic
- Edge cases
- Type definitions
- Module enums

### Integration Tests (Phase 10: T052-T060)

- End-to-end API flows
- Status changes
- Deletions
- Atomicity
- Error responses

### Contract Tests (Phase 12: T066-T067)

- OpenAPI compliance
- Response schema validation
- Header validation
- Error schema compliance

### Load Tests (Phase 13: T068-T071)

- Concurrent updates (20+)
- Slug uniqueness under concurrency
- List performance (1000+ products, <1s)
- Audit query performance (10000+ entries, <1s)

## Related Documentation

- **API Documentation**: [API_PRODUCTS_MANAGEMENT.md](API_PRODUCTS_MANAGEMENT.md)
- **OpenAPI Spec**: [products-management-api-spec.yaml](products-management-api-spec.yaml)
- **Database Guide**: [README_PRODUCTS.md](../../runtime/009-products-management/README_PRODUCTS.md)
- **Deployment Guide**:
  [DEPLOYMENT_AND_VALIDATION_PRODUCTS.md](../../runtime/009-products-management/DEPLOYMENT_AND_VALIDATION_PRODUCTS.md)
