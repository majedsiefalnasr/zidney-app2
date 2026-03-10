# Quickstart: Implement multi-tenancy architecture for Zidney platform

**Date**: 2026-02-15 **Feature**:
[specs/runtime/002-multi-tenancy-architecture/spec.md](specs/runtime/002-multi-tenancy-architecture/spec.md)

## Overview

This guide shows how to implement and use the multi-tenancy architecture in Zidney API.

## Prerequisites

- Bun runtime
- PostgreSQL instance
- Master database created
- Environment variables set

## Setup

### 1. Environment Variables

```bash
# Master DB
MASTER_DB_HOST=localhost
MASTER_DB_PORT=5432
MASTER_DB_NAME=master_db
MASTER_DB_USER=zidney
MASTER_DB_PASSWORD=encrypted_password

# Runtime
PLATFORM_PRODUCT_VERSION=1.0.0
```

### 2. Master Database Migration

Run migration to create `tenants_registry` table:

```sql
CREATE TABLE tenants_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_slug VARCHAR(50) UNIQUE NOT NULL,
  db_name VARCHAR(100) NOT NULL,
  db_host VARCHAR(100) NOT NULL,
  db_port INTEGER NOT NULL,
  db_user VARCHAR(50) NOT NULL,
  db_password TEXT NOT NULL, -- encrypted
  schema_version VARCHAR(20) NOT NULL,
  product_version VARCHAR(20) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 3. API Middleware Setup

In `apps/api/src/middleware/tenant-resolver.ts`:

```typescript
import { Hono } from 'hono';
import { Pool } from 'pg';
import * as semver from 'semver';

const tenantPools = new Map<string, Pool>();

export const tenantResolver = async (c: Context, next: Next) => {
  // Extract slug from subdomain or path
  const slug = extractWorkspaceSlug(c.req);

  // Load registry (with cache)
  const registry = await loadRegistry(slug);

  // Load license
  const license = await loadLicense(slug);

  // Enforce license
  if (license.status !== 'ACTIVE') {
    return c.json({ error: { code: 'LICENSE_BLOCKED', ... } }, 423);
  }

  // Check versions
  if (!semver.satisfies(license.productVersion, `<=${PLATFORM_PRODUCT_VERSION}`)) {
    return c.json({ error: { code: 'VERSION_MISMATCH', ... } }, 426);
  }

  // Get pool
  const pool = getOrCreatePool(registry);

  // Attach context
  c.set('tenant', {
    workspaceId: registry.id,
    workspaceSlug: slug,
    tenantDb: pool,
    license,
    schemaVersion: registry.schemaVersion,
    productVersion: registry.productVersion,
    requestId: generateRequestId()
  });

  await next();
};
```

### 4. Using Tenant Context

In route handlers:

```typescript
app.get("/api/workspace/:slug/exams", tenantResolver, async (c) => {
  const tenant = c.get("tenant");
  const result = await tenant.tenantDb.query("SELECT * FROM exams");
  return c.json({ success: true, data: result.rows });
});
```

## Testing

### Unit Tests

```typescript
describe("Tenant Resolver", () => {
  it("should resolve valid tenant", async () => {
    // Test middleware
  });

  it("should reject invalid license", async () => {
    // Test enforcement
  });
});
```

### Integration Tests

```typescript
describe("Multi-tenancy Isolation", () => {
  it("should not access other tenant data", async () => {
    // Test isolation
  });
});
```

## Troubleshooting

- **Pool exhaustion**: Check pool limits (<10 connections per tenant)
- **Version mismatch**: Update PLATFORM_PRODUCT_VERSION
- **Slug not found**: Verify tenants_registry entry
- **Connection failed**: Check tenant DB credentials

## Next Steps

- Implement provisioning service (Stage 5)
- Add runtime features using tenant context
- Monitor pool metrics
