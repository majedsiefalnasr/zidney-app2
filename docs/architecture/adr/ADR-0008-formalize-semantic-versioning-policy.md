# ADR-0008 — Formalize Semantic Versioning Policy

Status: Accepted  
Date: 2026-02-15  
Decision Makers: Platform Architecture

---

## Context

Zidney is a white-label, database-per-tenant SaaS platform with:

- Product-level configuration
- Per-license product_version
- Per-tenant schema_version
- Opt-in upgrade model
- Strict runtime compatibility enforcement

To prevent breaking institutional environments, we must formalize:

- How versions are defined
- How versions are incremented
- What constitutes breaking vs non-breaking change
- How compatibility is validated at runtime
- How upgrades are orchestrated

Without strict versioning discipline, runtime drift and schema corruption become inevitable.

---

## Decision

Zidney will adopt a strict Semantic Versioning (SemVer) policy:

MAJOR.MINOR.PATCH

Applied independently to:

- product_version (stored in master_db.licenses)
- schema_version (stored in tenant DB schema_version table)
- platform_runtime_version (defined in backend config)

All runtime compatibility decisions must follow this policy.

---

## Versioning Model

### Product Version

Represents functional configuration surface:

- Enabled modules
- Feature behavior
- Runtime expectations

Stored in: master_db.licenses.product_version

Upgrade model: Opt-in per license.

---

### Schema Version

Represents database structure compatibility:

- Table structure
- Columns
- Constraints
- Indexes
- Migration state

Stored in: tenant_db.schema_version

Upgraded via migration pipeline only.

---

### Platform Runtime Version

Represents deployed backend code version.

Defined in: packages/config/runtimeVersion.ts

Used for compatibility checks.

---

## Semantic Versioning Rules

### PATCH (x.y.Z)

Allowed:

- Bug fixes
- Logging changes
- Performance improvements
- Non-structural validation changes

Not allowed:

- Schema changes
- API contract changes
- Permission model changes

PATCH must never require schema migration.

---

### MINOR (x.Y.z)

Allowed:

- Additive database changes (new table, nullable column)
- New non-breaking API fields
- New optional module capabilities
- Backward-compatible feature additions

Constraints:

- Must not remove or rename columns
- Must not change existing data shape
- Must preserve backward compatibility

MINOR upgrades may require schema migration.

---

### MAJOR (X.y.z)

Allowed:

- Breaking API changes
- Column removal
- Data structure redesign
- Permission model changes
- Behavior contract changes
- Module architecture changes

Constraints:

- Must require explicit upgrade
- Must require migration path
- Must include rollback strategy

MAJOR upgrades cannot be automatic.

---

## Compatibility Enforcement

On every request:

1. Validate tenant.schema_version against platform minimum supported schema
2. Validate license.product_version compatibility with platform runtime version

Rules:

If tenant.schema_version < minimum_supported_schema  
→ Reject request (426 Upgrade Required)

If license.product_version incompatible with runtime  
→ Reject request (426)

If MAJOR mismatch  
→ Block runtime execution entirely

Compatibility must be enforced in license middleware before domain execution.

---

## Upgrade Flow

Upgrade types:

PATCH:

- Auto-applied
- No migration
- Transparent to tenant

MINOR:

- Migration required
- Can be auto-applied if non-breaking
- Must update schema_version

MAJOR:

- Explicit approval required
- Snapshot required before migration
- Must support rollback plan
- Must be orchestrated via worker job

All upgrades must:

- Be idempotent
- Be logged
- Update version metadata atomically

---

## Migration Coupling Rules

Every schema migration file must:

- Declare target schema_version
- Declare required minimum product_version
- Declare whether it is breaking

No migration may run without version metadata update.

Schema_version must increment only via migration runner.

---

## Rollback Policy

Rollback allowed only for:

- Failed MINOR migration
- Failed MAJOR migration

Rollback must:

- Restore pre-migration snapshot
- Restore previous schema_version
- Restore previous product_version

PATCH changes are not rollback-managed.

---

## Version Storage Format

Version format must follow strict SemVer:

Example: 1.4.2

Stored as string.

No custom suffixes allowed (no -beta, -rc in production).

Pre-release versions allowed only in development environment.

---

## Logging Requirements

Every upgrade event must log:

- workspace_slug
- previous_version
- new_version
- migration_duration
- success/failure
- operator (if manual)

Logs must be structured and traceable.

---

## Prohibited Actions

- Skipping version bump on schema change
- Running migration without version increment
- Editing schema manually in production
- Auto-upgrading MAJOR versions
- Downgrading without rollback procedure

---

## Consequences

Positive:

- Predictable upgrade model
- Strong institutional trust
- Safe opt-in evolution
- Controlled runtime compatibility

Negative:

- Slower major evolution
- More operational discipline required
- Strict enforcement increases complexity

---

## Future Extensions

Potential future ADRs:

- ADR-0009 Upgrade Orchestration Contract
- ADR-0010 Multi-Version Runtime Support
- ADR-0011 Canary Workspace Upgrades

---

## Final Rule

If versioning discipline breaks, platform integrity breaks.

No schema change without version change. No breaking change without MAJOR increment. No runtime
drift allowed.
