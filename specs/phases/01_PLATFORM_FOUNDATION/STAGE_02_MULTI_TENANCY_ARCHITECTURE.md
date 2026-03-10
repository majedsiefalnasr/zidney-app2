# STAGE 02 – Multi-Tenancy Architecture

Phase: 1 – Platform Foundation Status: Critical Scope: Database-per-tenant architecture & tenant
resolution

---

## Stage Status

Status: PRODUCTION HARDENED  
Risk Level: LOW  
Closure Date: 2026-02-16

Scope Closed:

- Database-per-tenant isolation enforced
- Tenant resolver middleware implemented
- License enforcement active
- Schema version validation active
- No fallback DB logic
- Pool-per-tenant strategy implemented
- Structured logging integrated

Deferred Scope:

- None

Constitutional Compliance:

- ADR-0001 respected (Database-per-tenant)
- No cross-tenant joins
- No global tenant state

Notes: Isolation layer is frozen. Any modification requires security review.

---

## Objective

Implement strict database-per-tenant isolation with:

- One master database
- One database per workspace (license)
- Runtime tenant resolution middleware
- One connection pool per tenant (in-memory map)
- Registry caching
- Schema version enforcement
- License-state enforcement
- Zero cross-tenant leakage

This stage defines Zidney's institutional trust foundation.

If isolation fails, Zidney fails.

---

## Architecture Model

Single PostgreSQL Instance

```
Postgres Instance
├── master*db
├── workspace*<slug*1>
├── workspace*<slug*2>
└── workspace*<slug_n>
```

Expected first-year scale: < 100 workspaces

Each workspace database:

- Fully isolated
- No shared tables
- No cross-database joins
- No global student tables
- No shared attempt tables

Isolation is database-level, not row-level.

---

## Master Database Responsibilities

master_db stores:

- products
- licenses
- tenants_registry
- mmc_users
- platform_settings
- platform_schema_version

master_db MUST NOT store:

- student data
- exam attempts
- exam content
- certificates
- subscription records
- runtime content

All B2C and Backoffice data belongs inside tenant DB.

---

## tenants_registry Table (Master DB)

Purpose: Infrastructure metadata only.

Must contain:

- id
- workspace_slug (globally unique)
- db_name
- db_host
- db_port
- db_user
- db_password (encrypted)
- schema_version
- product_version
- created_at
- updated_at

It MUST NOT store:

- license_status
- commercial state
- limits

License authority belongs strictly to licenses table.

workspace_slug:

- lowercase
- alphanumeric + dash
- globally unique
- immutable

---

## Workspace Routing Model

Routing must support:

A) Subdomain: <slug>.zidney.com

B) Path-based: /workspace/<slug>/

Resolver must:

1. Detect subdomain first
2. Fallback to path segment
3. Reject if both conflict

Slug must never be accepted from request body.

---

## Tenant Connection Resolver (Middleware)

For every workspace-bound request:

1. Extract workspace_slug

From subdomain OR path.

2. Load Registry (Cached)

- Check in-memory LRU cache (TTL 60s)
- If miss → query master_db.tenants_registry
- Cache result

3. Load License

Query master_db.licenses using workspace_slug.

License is source of truth for:

- status
- limits
- lifecycle
- version compatibility

4. Enforce License State

ACTIVE → allow SOFT_LOCKED → 423 Locked ARCHIVED → 403 Forbidden DELETED → 404 Not Found

5. Schema Version Enforcement

Compare:

tenant.schema_version platform.expected_schema_version

If mismatch:

→ 426 Upgrade Required → Log critical error → Block request

6. Resolve Tenant DB Connection

Use in-memory pool map: tenantPools = Map<workspaceId, Pool> If pool exists → reuse If not → create
new pool

7. Attach Context

req.context = { workspaceId, workspaceSlug, tenantDb, license, schemaVersion, productVersion,
requestId }

All domain services must use DB from context only.

---

## Connection Pool Strategy (Finalized)

Strategy: One pool per tenant

Because:

- < 100 expected workspaces
- Clear isolation boundary
- Safe for AI-generated code
- Predictable resource usage

---

## Pool Guardrails (Mandatory)

To prevent resource exhaustion:

- Max tenants supported: 150
- Max connections per tenant pool: 10
- Idle timeout: 5 minutes
- Pool created lazily
- Pool closed on graceful shutdown

If pool count exceeds threshold: → Log warning

---

## Graceful Shutdown Rules

On server shutdown:

- Stop accepting new requests
- Wait for active requests
- Close all tenant pools
- Close master pool
- Flush logs

No unclosed pool allowed.

---

## Schema Version Enforcement

Each tenant DB must include:

- schema_version table

On every request:

If mismatch: → 426 Upgrade Required → Block execution

No partial compatibility allowed.

---

## Isolation Guarantees

System MUST guarantee:

- No tenant can access another tenant DB
- No shared connection reuse across tenants
- No fallback default DB
- No global DB import in services
- No cross-workspace joins
- No dynamic tenant override via client input
- No request may access DB before resolver runs

Workspace identity derived only from middleware.

---

## Database Naming Convention

Tenant DB name:

workspace\_<slug> Examples:

- workspace_almajed
- workspace_university_x

Slug immutable Database name immutable

---

## Failure Handling

Workspace not found → 404 Archived → 403 Soft locked → 423 Schema mismatch → 426 DB connection
failure → 503

All logs must include:

- workspace_slug
- workspace_id
- request_id

---

## Observability Integration

Resolver must:

- Attach workspace_slug to structured logs
- Attach workspace_id
- Enforce correlation ID presence
- Reject anonymous internal access

No request proceeds without correlation ID.

---

## Hard Rules

- No row-based multi-tenancy
- No shared tenant tables
- No cross-workspace joins
- No hardcoded tenant DB connection
- No dynamic tenant override via body
- No service-level DB instantiation
- No reading license_status from tenants_registry

---

## Provisioning Dependency

This stage defines resolution architecture.

Actual DB creation implemented in:

STAGE 05 — Tenant Provisioning Service

Resolver must assume DBs may appear dynamically.

---

## Validation Criteria

Stage complete when:

- master_db operational
- tenants_registry table exists
- Can manually insert tenant
- Resolver extracts slug (subdomain + path)
- Registry cache works
- License enforcement works
- Schema mismatch returns 426
- DB pool created lazily
- Pool guardrails enforced
- Graceful shutdown closes pools
- Cross-tenant access test fails correctly
- Logs include workspace_slug

---

## Stability Principle

This stage defines Zidney's institutional trust.

Isolation failure = platform failure.

No UI, no business logic, no attempt engine until:

- Resolver stable
- License enforcement stable
- Schema enforcement stable
- Pool guardrails active
