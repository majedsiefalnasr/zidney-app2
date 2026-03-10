# Tenant Resolver Middleware Contract: License Enforcement

**Stage**: STAGE 11 – License Lifecycle Operations  
**Phase**: 02 – Platform MMC  
**Interface**: Middleware  
**Location**: `packages/domain-core/src/tenant-resolver/`

---

## Overview

Tenant Resolver middleware enforces license status BEFORE route handlers execute, implementing the
trust chain:

```
Correlation ID → Tenant Resolver → License Enforcement → Schema Validation → Handler
```

This document defines the license-specific contract for Tenant Resolver.

---

## Middleware Execution Order

### Middleware Stack

```typescript
1. correlationIdMiddleware()        // Set correlation_id on ctx
2. tenantResolverMiddleware()       // Resolve workspace → establish connection
3. licenseEnforcementMiddleware()   // CHECK LICENSE STATUS ← THIS STAGE
4. schemaVersionMiddleware()        // Validate schema version
5. routeHandler()                   // Business logic
```

**Critical**: License Enforcement runs AFTER Tenant Resolver and BEFORE route handler.

- Tenant Resolver establishes multi-tenant context (workspace_slug, workspace_id)
- License Enforcement enforces access control based on license status
- Route handler never executes if license status invalid

---

## Tenant Resolver Responsibilities

### 1. Resolve Workspace from Request

**Input**: Request URL/headers

- `workspace_slug`: From subdomain (e.g., `acme-corp.zidney.com`) OR path (e.g.,
  `/workspace/acme-corp/...`)

**Output**: Set on Hono context:

```typescript
ctx.set("workspace_slug", "acme-corp");
ctx.set("workspace_id", "uuid");
ctx.set("license_id", "uuid");
```

### 2. Establish Per-Tenant Connection Pool

**Input**: workspace_id

**Output**: In-memory map of connection pools:

```typescript
tenantConnections.set(workspace_id, {
  pool: PostgreSQL Connection Pool,
  schema_version: string,
  created_at: Date
})
```

### 3. Quick License Status Lookup

**Method**: Query tenants_registry (denormalized for performance)

**Query**:

```sql
SELECT license_status, licenses.status, licenses.soft_lock_until
FROM tenants_registry
JOIN licenses ON licenses.id = tenants_registry.license_id
WHERE tenants_registry.workspace_slug = $1
```

**Result**:

```typescript
{
  license_status: "ACTIVE" | "SOFT_LOCKED" | "ARCHIVED" | "DELETED",
  soft_lock_until: Date | null,
  sync_status: "IN_SYNC" | "OUT_OF_SYNC"
}
```

**Fallback**: If tenants_registry stale (sync_status = OUT_OF_SYNC), query licenses directly:

```sql
SELECT status, soft_lock_until FROM licenses WHERE workspace_id = $1
```

---

## License Enforcement Middleware Contract

### Execution Point

**Location**: `apps/api/src/middleware/license-enforcement.ts`

**Execution**: After workspace resolution, BEFORE route handler

### License Status Checks

```typescript
async function licenseEnforcementMiddleware(ctx: Context, next: Next) {
  const workspace_slug = ctx.get("workspace_slug");

  // 1. Get license status from resolver
  const validationResult = await resolver.validateLicenseStatus(workspace_slug);

  // 2. Check status and respond accordingly
  if (validationResult.status === LicenseStatus.ACTIVE) {
    // ACTIVE: Proceed to route handler
    return await next();
  }

  // 3. Auto-transition soft-lock expiry
  if (
    validationResult.status === LicenseStatus.SOFT_LOCKED &&
    new Date() > validationResult.soft_lock_until
  ) {
    // Soft lock has expired: auto-transition to ARCHIVED
    await transitionLicenseState(ctx, {
      license_id: validationResult.license_id,
      target_state: "ARCHIVED",
      reason: "soft_lock_expired_auto_transition",
    });
    // Fall through to return 403 (now ARCHIVED)
    validationResult.status = LicenseStatus.ARCHIVED;
  }

  // 4. Return appropriate HTTP response per status
  return handleLicenseStatusResponse(ctx, validationResult);
}
```

### Status-Specific Responses

#### ACTIVE → 200 (Proceed)

```typescript
// License is valid, proceed to route handler
return await next();
```

**Middleware overhead**: < 1ms (single index lookup + switch statement)

#### SOFT_LOCKED → 423 Locked

```typescript
return ctx.json(
  {
    success: false,
    data: null,
    error: {
      code: "LICENSE_SOFT_LOCKED",
      message: "Institution license is soft-locked. Contact support for renewal.",
      expires_in_seconds: Math.floor((license.soft_lock_until - now()) / 1000),
    },
  },
  {
    status: 423,
    headers: {
      "Retry-After": String(Math.ceil((license.soft_lock_until - now()) / 1000)),
    },
  },
);
```

**Behavior**:

- Returns 423 Locked status code
- Includes `Retry-After` header with seconds until soft lock expires
- No tenant DB connection opened
- Student/staff cannot access frontoffice
- Only MMC can perform renewal/archive operations

#### ARCHIVED → 403 Forbidden

```typescript
return ctx.json(
  {
    success: false,
    data: null,
    error: {
      code: "LICENSE_ARCHIVED",
      message:
        "Institution license is archived. Workspace data is not accessible. Contact MMC for restoration or deletion.",
    },
  },
  { status: 403 },
);
```

**Behavior**:

- Returns 403 Forbidden status code
- No tenant DB access permitted
- Only restore or delete operations allowed from MMC

#### DELETED → 404 Not Found

```typescript
return ctx.json(
  {
    success: false,
    data: null,
    error: {
      code: "LICENSE_DELETED",
      message: "This workspace has been permanently deleted.",
    },
  },
  { status: 404 },
);
```

**Behavior**:

- Returns 404 Not Found (workspace appears non-existent)
- Tenant registry entry removed
- If workspace_slug reused in future: Treated as new license (new workspace_id)

---

## Auto-Expiry Implementation (Deterministic)

### On Every Request

**Check**: If status = SOFT_LOCKED and current_time > soft_lock_until

**Action**: Atomically transition to ARCHIVED

```typescript
if (license.status === "SOFT_LOCKED" && new Date() > license.soft_lock_until) {
  // Transaction: SELECT FOR UPDATE + UPDATE + INSERT audit
  const result = await db.transaction(async (tx) => {
    // 1. Lock row to prevent concurrent transitions
    const currentLicense = await tx.query("SELECT * FROM licenses WHERE id = $1 FOR UPDATE", [
      licenses.id,
    ]);

    // 2. Verify still SOFT_LOCKED (not already transitioned)
    if (currentLicense.status !== "SOFT_LOCKED") {
      throw new Error("License already transitioned");
    }

    // 3. Update status
    await tx.query(
      `UPDATE licenses 
       SET status = $2, archived_at = now(), soft_lock_until = NULL, updated_at = now()
       WHERE id = $1`,
      [licenses.id, "ARCHIVED"],
    );

    // 4. Create audit log
    await tx.query(
      `INSERT INTO license_audit_logs 
       (license_id, previous_status, new_status, actor_type, reason, timestamp, correlation_id, created_at)
       VALUES ($1, $2, $3, $4, $5, now(), $6, now())`,
      [licenses.id, "SOFT_LOCKED", "ARCHIVED", "SYSTEM", "Soft lock 90-day expiry", correlation_id],
    );
  });

  // 5. Log transition
  logger.info("Soft lock auto-expired to ARCHIVED", {
    license_id: license.id,
    workspace_slug,
    correlation_id,
    triggered_by_request: true,
  });
}
```

**No Cron Job Needed**:

- Auto-expiry happens on-demand during request processing
- Deterministic: Every request checks expiry
- No delayed jobs or scheduled tasks required
- Immediate effect: Next request receives 403 (ARCHIVED status)

---

## Tenant Context Storage

### Per-Request Context

After license validation, middleware sets:

```typescript
ctx.set('license_status', 'ACTIVE|SOFT_LOCKED|ARCHIVED|DELETED')
ctx.set('license_id', 'uuid')
ctx.set('is_license_active', true|false)
ctx.set('soft_lock_expires_at', Date | null)
ctx.set('workspace_context', {
  workspace_id: 'uuid',
  workspace_slug: 'string',
  license_status: 'ACTIVE|SOFT_LOCKED|ARCHIVED|DELETED',
  is_writable: true|false,
  connection_pool: PostgreSQL Pool
})
```

**Usage in Route Handlers**:

```typescript
router.get('/attempts/:attemptId', async (ctx) => {
  const context = ctx.get('workspace_context')

  // No need to check license status again (already validated by middleware)
  const db = context.connection_pool
  const attempt = await db.query(...)

  // ctx.req.workspaceSlug, ctx.req.workspaceId already set
})
```

---

## Exception Cases

### Non-Tenant Route

Routes that don't require workspace context (e.g., `POST /licenses`, global admin endpoints) should
skip license enforcement:

```typescript
// Option 1: Explicit bypass annotation
@SkipLicenseEnforcement()
router.post('/licenses', async (ctx) => {
  // No license check
})

// Option 2: Check workspace_slug presence
// If ctx.get('workspace_slug') is null, middleware skips enforcement
```

### WebSocket Connections

WebSocket middleware follows same pattern:

1. Upgrade request passes through licensing middleware
2. If license status invalid (SOFT_LOCKED, ARCHIVED, DELETED), reject upgrade
3. If upgraded successfully, WebSocket maintains connection until status changes
4. Server closes connection if license status changes during active connection

---

## Monitoring & Observability

### Structured Logging Events

```json
{
  "timestamp": "2026-02-24T10:30:00Z",
  "level": "info",
  "service": "tenant-resolver",
  "event": "license_validation",
  "workspace_slug": "acme-corp",
  "license_status": "ACTIVE",
  "duration_ms": 0.8,
  "correlation_id": "uuid"
}
```

```json
{
  "timestamp": "2026-02-24T10:30:00Z",
  "level": "warn",
  "service": "tenant-resolver",
  "event": "license_soft_lock_expired",
  "workspace_slug": "acme-corp",
  "license_id": "uuid",
  "action": "auto_transition_to_archived",
  "correlation_id": "uuid"
}
```

```json
{
  "timestamp": "2026-02-24T10:30:00Z",
  "level": "warn",
  "service": "tenant-resolver",
  "event": "license_access_denied",
  "workspace_slug": "acme-corp",
  "license_status": "ARCHIVED",
  "http_status": 403,
  "correlation_id": "uuid"
}
```

### Metrics

Track these metrics per license status:

- Request count by status (ACTIVE, SOFT_LOCKED, ARCHIVED, DELETED)
- Auto-expiry transitions per hour
- 403/423/404 response rates
- Middleware latency (p50, p95, p99)

---

## Performance Guarantees

### Middleware Overhead

- License status lookup: Single index query on tenants_registry
- Response time: < 1ms (target SLA)
- No N+1 queries or unnecessary joins
- Cached in-memory if possible (respects cache TTL)

### Index Strategy

```sql
-- These indexes are critical for middleware performance
CREATE INDEX idx_tenants_registry_workspace_slug ON tenants_registry(workspace_slug);
CREATE INDEX idx_tenants_registry_license_status ON tenants_registry(license_status);
CREATE INDEX idx_licenses_status ON licenses(status);
CREATE INDEX idx_licenses_soft_lock_until ON licenses(soft_lock_until)
  WHERE status = 'SOFT_LOCKED';
```

---

## Error Handling

### Transient Failures

If license status lookup fails (network error, DB unavailable):

```typescript
// Fail open (permit access) vs fail closed (block access)?
// Per PROJECT_CONTEXT_PRIMER: Trust chain is unbreakable
// → FAIL CLOSED (deny access, don't permit on uncertainty)

try {
  const validationResult = await resolver.validateLicenseStatus(workspace_slug);
} catch (error) {
  logger.error("License validation failed", { error, workspace_slug });
  return ctx.json(
    {
      success: false,
      data: null,
      error: {
        code: "LICENSE_CHECK_UNAVAILABLE",
        message: "Unable to verify license status. Please try again.",
      },
    },
    { status: 503 }, // Service Unavailable
  );
}
```

---

## Configuration

### Environment Variables

```bash
# License enforcement
LICENSE_CHECK_CACHE_TTL_MS=60000          # Cache license status for 1 minute
LICENSE_SOFT_LOCK_GRACE_PERIOD_DAYS=90    # 90-day grace period
LICENSE_STATUS_FALLBACK_TO_LICENSES=true  # Query licenses if registry stale

# Performance
TENANT_RESOLVER_TIMEOUT_MS=5000           # Timeout for resolver ops
TENANT_CONNECTION_POOL_SIZE=20            # Per-tenant pool size
```

---

## Conclusion

Tenant Resolver middleware implements deterministic license enforcement at the request layer,
ensuring the trust chain is never broken. Auto-expiry is handled on-demand without cron jobs, and
all access decisions are atomic and auditable.
