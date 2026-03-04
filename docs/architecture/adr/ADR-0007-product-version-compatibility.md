# ADR-0007 — Product Version Compatibility Model

## Status

Accepted

---

## Context

Zidney supports controlled product evolution with the following characteristics:

- Product updates over time
- Workspace opt-in upgrades
- Schema versioning per tenant
- Runtime compatibility enforcement

Each License stores:

- schema_version
- product_version

Each tenant database stores:

- schema_version

The runtime must prevent:

- New runtime code executing against outdated schema
- Old product configurations conflicting with new runtime logic
- Partial upgrades causing inconsistent behavior
- Silent corruption of tenant data

A strict compatibility enforcement model is required to preserve institutional trust.

---

## Decision

Zidney enforces strict schema and product compatibility validation at runtime.

The runtime defines:

- MIN_SUPPORTED_SCHEMA_VERSION
- CURRENT_PRODUCT_VERSION
- SUPPORTED_PRODUCT_VERSION_RANGE

On every workspace-bound request:

1. If tenant.schema_version < MIN_SUPPORTED_SCHEMA_VERSION  
   → Reject request with HTTP 426 (Upgrade Required)

2. If license.product_version is outside SUPPORTED_PRODUCT_VERSION_RANGE  
   → Reject request with HTTP 426

3. Runtime execution must never proceed under incompatible conditions.

Upgrades must be explicit and controlled through MMC.

---

## Rules

### Schema Compatibility

Allowed changes:

- Additive migrations
- New tables
- New nullable columns
- Backward-compatible defaults
- Index additions

Not allowed without compatibility bridge:

- Dropping required columns
- Changing column types incompatibly
- Renaming columns without transitional phase
- Removing constraints relied upon by runtime

Schema migrations must be:

- Versioned
- Ordered
- Idempotent
- Applied per tenant
- Logged

---

### Product Version Compatibility

Product version controls:

- Enabled modules
- Feature flags
- Runtime behavioral configuration
- Commercial configuration surface

Compatibility model:

- Minor versions must remain backward compatible
- Major versions may require explicit upgrade
- Breaking changes require:
  - Migration
  - Explicit workspace opt-in
  - Compatibility validation

Runtime must contain a compatibility matrix mapping supported product versions.

If product version is unsupported:
→ Runtime execution must stop.

---

### Upgrade Flow

Upgrade is initiated through MMC.

Upgrade sequence:

1. Validate compatibility preconditions
2. Lock workspace
3. Apply tenant migrations
4. Update schema_version
5. Update product_version
6. Unlock workspace

Upgrade must be:

- Atomic
- Logged
- Recoverable via snapshot

Partial upgrade states are not allowed.

---

### Rollback Strategy

If upgrade fails:

- Restore tenant snapshot
- Restore schema_version
- Restore product_version
- Log CRITICAL compatibility failure
- Block runtime execution until resolved

No partially upgraded state may remain active.

---

### Runtime Enforcement

License middleware must:

- Load schema_version from tenant database
- Load product_version from master database
- Compare against runtime compatibility rules
- Reject incompatible execution

No route handler may bypass compatibility validation.

---

### Observability Requirements

All compatibility failures must log:

- request_id
- workspace_slug
- schema_version
- product_version
- expected_schema_version
- supported_product_version_range
- error_code = VERSION_COMPATIBILITY_FAILURE

Logs must be structured and traceable.

---

## Consequences

Positive:

- Prevents silent runtime corruption
- Protects tenant data integrity
- Enables safe platform evolution
- Preserves institutional trust

Negative:

- Requires strict migration governance
- Increases upgrade coordination overhead
- Prevents uncontrolled hotfix behavior

These tradeoffs are intentional.

---

## Related ADR

- ADR-0001 Database per tenant
- ADR-0002 Snapshot Attempt Model
- ADR-0006 Runtime Authoritative Time
