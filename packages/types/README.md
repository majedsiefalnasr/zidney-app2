# @zidney/types

## Purpose

Shared TypeScript type definitions and enums for the entire Zidney platform. Serves as the single source of truth for all domain entity shapes, status enums, and role definitions used across `apps/*` and `packages/*`.

---

## Responsibilities

- Export TypeScript interfaces for all master-DB entities: `Product`, `License`, `TenantRegistry`, `MMCUser`, `PlatformSchemaVersion`
- Export status enums: `LicenseStatus`, `MMCUserRole`, `AttemptStatus`, `WorkspaceStatus`
- Export request/response wrapper types used by the API layer
- Provide type utilities shared across domain packages

---

## Dependencies

No runtime dependencies — pure TypeScript type definitions only.

---

## How to Run Tests

```bash
# Type-check only (types package has no runtime test logic)
bun run vitest run --project types

# From repo root typecheck
bun run typecheck
```

---

## Environment Variables

None.

---

## Known Boundaries

- **No runtime code** — this package emits type declarations only; no `.js` output
- **No business logic** — types describe data shapes, not behavior
- May be imported by all `apps/*` and `packages/*` without restriction
- Must not import from any other `packages/*` or `apps/*`

---

## Public API

```typescript
import type {
  // Entity types
  Product,
  License,
  TenantRegistry,
  MMCUser,
  PlatformSchemaVersion,

  // Enums
  LicenseStatus, // PENDING_PROVISION | ACTIVE | SOFT_LOCKED | ARCHIVED | PROVISION_FAILED
  MMCUserRole, // mmc_admin | mmc_support
  AttemptStatus, // IN_PROGRESS | SUBMITTED | GRADED | ABANDONED
  WorkspaceStatus, // ACTIVE | SOFT_LOCKED | ARCHIVED

  // API wrapper types
  ApiSuccess, // { success: true, data: T }
  ApiError, // { success: false, error: { code: string, message: string } }
  ApiResponse, // ApiSuccess<T> | ApiError

  // Utility types
  Paginated, // { items: T[], total: number, page: number, pageSize: number }
  WithTimestamps, // { created_at: Date, updated_at: Date }
} from '@zidney/types'
```

---

## Entity Reference

All entity types are exported from `@zidney/types`:

```typescript
import {
  Product,
  License,
  TenantRegistry,
  MMCUser,
  PlatformSchemaVersion,
  LicenseStatus,
  MMCUserRole,
} from '@zidney/types'
```

### Product

Application product definition.

```typescript
interface Product {
  id: string // UUID
  name: string
  slug: string // Globally unique identifier
  description?: string
  version: string // Semantic version: X.Y.Z
  enabled_modules: Record<string, boolean> // Feature flags
  created_at: Date
}
```

**Example**:

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Zidney Pro",
  "slug": "pro",
  "version": "1.0.0",
  "enabled_modules": {
    "realtime_analytics": true,
    "ai_grading": false
  },
  "created_at": "2026-02-16T10:30:00Z"
}
```

---

### License

License registry with workspace allocation.

```typescript
interface License {
  id: string // UUID
  product_id: string // FK→products
  workspace_slug: string // Globally unique
  status: LicenseStatus // ACTIVE | SOFT_LOCKED | ARCHIVED
  student_limit?: number // NULL = unlimited
  staff_limit?: number // NULL = unlimited
  soft_lock_until?: Date
  archived_at?: Date
  created_at: Date
  updated_at: Date
}

enum LicenseStatus {
  ACTIVE = 'ACTIVE',
  SOFT_LOCKED = 'SOFT_LOCKED',
  ARCHIVED = 'ARCHIVED',
}
```

---

### TenantRegistry

Tenant database connection metadata.

```typescript
interface TenantRegistry {
  id: string // UUID
  license_id: string // FK→licenses
  workspace_slug: string // Unique, matches license slug
  db_host: string
  db_port: number
  db_name: string
  db_user: string
  db_password_encrypted: string // Encrypted at rest
  created_at: Date
  updated_at: Date
}
```

---

### MMCUser

Master Management Console user account.

```typescript
interface MMCUser {
  id: number // Serial
  email: string // Globally unique
  password_hash: string // Bcrypt hash
  role: MMCUserRole
  last_login_at?: Date
  created_at: Date
  updated_at: Date
}

enum MMCUserRole {
  ADMIN = 'admin',
  OPERATOR = 'operator',
  READ_ONLY = 'read_only',
}
```

---

### PlatformSchemaVersion

Platform schema version tracking (single-row table).

```typescript
interface PlatformSchemaVersion {
  id: 1 // Always 1
  current_version: string // X.Y.Z
  minimum_supported_version: string // X.Y.Z
  updated_at: Date
}
```

---

## Input/Output Types

All I/O types for API operations:

```typescript
import {
  CreateProductInput,
  CreateLicenseInput,
  CreateTenantRegistryInput,
  CreateMMCUserInput,
  UpdateProductInput,
  UpdateLicenseInput,
  UpdateTenantRegistryInput,
  UpdateMMCUserInput,
} from '@zidney/types'
```

---

## Utility Functions

Common functions for business logic:

```typescript
import {
  parseVersion,
  compareVersions,
  isVersionCompatible,
  isLicenseActive,
  isLicenseSoftLocked,
  isLicenseArchived,
  canLicenseBeUsed,
} from '@zidney/types'

// Version parsing
const version = parseVersion('1.5.3') // { major: 1, minor: 5, patch: 3 }

// Version comparison
compareVersions('1.5.0', '1.0.0') // 1 (first is greater)

// Version compatibility check
isVersionCompatible('1.5.0', '1.0.0') // true (1.5.0 >= 1.0.0)

// License state checking
isLicenseActive(LicenseStatus.ACTIVE) // true
canLicenseBeUsed(LicenseStatus.SOFT_LOCKED) // false
```

---

## Error Codes

All error codes and HTTP status mappings:

```typescript
import { MasterDBErrorCode, getHTTPStatus } from '@zidney/types'

// Error code enumeration
enum MasterDBErrorCode {
  INVALID_REQUEST_BODY = 'INVALID_REQUEST_BODY', // 400
  PRODUCT_NOT_FOUND = 'PRODUCT_NOT_FOUND', // 404
  LICENSE_SOFT_LOCKED = 'LICENSE_SOFT_LOCKED', // 423
  SCHEMA_VERSION_MISMATCH = 'SCHEMA_VERSION_MISMATCH', // 426
  // ... 28 total error codes
}

// Get HTTP status for error
getHTTPStatus(MasterDBErrorCode.LICENSE_NOT_FOUND) // 404
getHTTPStatus(MasterDBErrorCode.DATABASE_ERROR) // 500
```

See [API_ERROR_CODES.md](../../docs/API_ERROR_CODES.md) for complete error reference.

---

## API Response Envelope

Standard response format for all APIs:

```typescript
import {
  APIResponse,
  APISuccessResponse,
  APIErrorResponse,
  createSuccessResponse,
  createErrorResponse,
  isSuccessResponse,
  isErrorResponse,
} from '@zidney/types';

// Success response
const success: APISuccessResponse<Product> = {
  success: true,
  data: { id: '...', name: '...', ... },
  error: null,
};

// Error response
const error: APIErrorResponse = {
  success: false,
  data: null,
  error: {
    code: MasterDBErrorCode.PRODUCT_NOT_FOUND,
    message: 'Product not found',
  },
};

// Factory functions
const response1 = createSuccessResponse(product);
const response2 = createErrorResponse(
  MasterDBErrorCode.INVALID_REQUEST_BODY,
  'Invalid input'
);

// Type guards
if (isSuccessResponse(response)) {
  console.log(response.data); // Typed as Product
}
if (isErrorResponse(response)) {
  console.log(response.error.code); // Typed as MasterDBErrorCode
}
```

---

## RBAC (Role-Based Access Control)

Permission matrix for MMC user roles:

```typescript
import {
  MasterDBPermission,
  RolePermissions,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  getPermissions,
} from '@zidney/types'

// Permission enumeration
enum MasterDBPermission {
  CREATE_PRODUCT = 'create_product',
  READ_PRODUCT = 'read_product',
  UPDATE_PRODUCT = 'update_product',
  DELETE_PRODUCT = 'delete_product',
  // ... 20+ permissions
}

// Check permissions
hasPermission(MMCUserRole.ADMIN, MasterDBPermission.DELETE_PRODUCT) // true
hasPermission(MMCUserRole.READ_ONLY, MasterDBPermission.CREATE_LICENSE) // false

// Check multiple permissions
hasAllPermissions(MMCUserRole.OPERATOR, [
  MasterDBPermission.CREATE_LICENSE,
  MasterDBPermission.UPDATE_LICENSE,
]) // true

// Get all permissions for role
const permissions = getPermissions(MMCUserRole.ADMIN)
```

**Role Permission Matrix**:

| Permission           | Admin | Operator | Read-Only |
| -------------------- | ----- | -------- | --------- |
| CREATE_PRODUCT       | ✓     | ✗        | ✗         |
| UPDATE_LICENSE       | ✓     | ✓        | ✗         |
| MANAGE_LICENSE_STATE | ✓     | ✓        | ✗         |
| READ_PRODUCT         | ✓     | ✓        | ✓         |
| VIEW_AUDIT_LOG       | ✓     | ✓        | ✓         |

See [rbac.ts](../src/rbac.ts) for complete matrix.

---

## Validation

Runtime validation for input data:

```typescript
import {
  ValidationError,
  validateCreateProductInput,
  validateCreateLicenseInput,
  validateCreateTenantRegistryInput,
  validateCreateMMCUserInput,
} from '@zidney/validation'

try {
  const product = validateCreateProductInput(input)
  // input is now strongly typed
} catch (error) {
  if (error instanceof ValidationError) {
    console.error(`${error.code}: ${error.message}`)
    // error.code is MasterDBErrorCode
  }
}
```

---

## Structured Logging

Logging utilities for master database operations:

```typescript
import { MasterDBLogger } from '@zidney/domain-core/logging'

const logger = new MasterDBLogger('my-service')

// Info logging
logger.info({
  phase: 'startup',
  message: 'Initializing master database',
})

// Error logging (with automatic correlation ID)
logger.error({
  phase: 'execution',
  status: 'failed',
  error: {
    code: 'DATABASE_ERROR',
    message: error.message,
  },
})

// Outputs structured JSON:
// {"timestamp":"2026-02-16T...","level":"INFO","service":"my-service",...}
```

---

## Usage Examples

### Creating a Product

```typescript
import {
  validateCreateProductInput,
  createSuccessResponse,
} from '@zidney/types'

export async function createProduct(body: unknown) {
  // Validate input
  const input = validateCreateProductInput(body)

  // Insert to database
  const product = await db.products.create(input)

  // Return response
  return createSuccessResponse(product)
}
```

### Checking License State

```typescript
import { isLicenseActive, canLicenseBeUsed, License } from '@zidney/types'

function canUseLicense(license: License): boolean {
  return canLicenseBeUsed(license.status)
}

function isExpired(license: License): boolean {
  return !isLicenseActive(license.status)
}
```

### Permission Checking

```typescript
import { hasPermission, MasterDBPermission, MMCUserRole } from '@zidney/types'

function canDeleteProduct(role: MMCUserRole): boolean {
  return hasPermission(role, MasterDBPermission.DELETE_PRODUCT)
}
```

---

## Type Safety Best Practices

1. **Always use input validation types** before inserting to database
2. **Use type guards** for response checking (isSuccessResponse, isErrorResponse)
3. **Export types, not implementations** - types are re-exported for public API
4. **Validate at boundaries** - API input validation, database output transformation

---

## See Also

- [Master Database Schema](../../apps/api/src/db/master/README.md)
- [Error Codes Reference](../../docs/API_ERROR_CODES.md)
- [Validation Schema](../validation/src/master-db-schema.ts)
- [TypeScript Configuration](../../docs/01_ENGINEERING_GOVERNANCE/02_CODE_STANDARDS.md)
