# Authentication System Specification (STAGE_03)

**Stage:** STAGE_03_AUTHENTICATION_SYSTEM  
**Phase:** 1 – Platform Foundation  
**Priority:** Critical  
**Status:** Specification

## Purpose

This directory contains the complete specification for implementing Zidney's workspace-isolated
authentication system across three independent domains (MMC, Backoffice, Frontoffice).

## Files

- **spec.md** — Detailed technical specification with data models, transaction boundaries, and
  compliance requirements
- **data-model.md** — Entity-relationship diagram and table definitions
- **plan.md** — Implementation roadmap and architecture
- **tasks.md** — Actionable implementation tasks
- **clarify.md** — Clarification notes and assumptions

## Quick Start

Start with [spec.md](./spec.md) for the full specification, then review
[data-model.md](./data-model.md) for schema details.

## Key Concepts

### Three Authentication Domains

1. **MMC** — Platform-level (master_db)
2. **Backoffice** — Staff/instructors (tenant_db)
3. **Frontoffice** — Students (tenant_db)

Each domain is completely isolated with separate user tables and token scopes.

### Workspace Isolation

Every tenant token includes `workspace_id`. This is validated on every request:

```
token.workspace_id == resolved.workspace_id → Allow
token.workspace_id != resolved.workspace_id → 401 Unauthorized
```

### License Enforcement

Login requires `license.status == ACTIVE`. Soft-locked workspaces return 423, archived return 403.

### Token Versioning

Users have `token_version` counter. Invalidation works by incrementing it:

```
token.token_version == user.token_version → Allow
token.token_version != user.token_version → 401 Unauthorized
```

This enables stateless logout-all without maintaining a token blacklist.

### Version Compatibility

Tokens include `schema_version` and `product_version`. Mismatches return 426 Upgrade Required,
preventing old sessions from surviving schema upgrades.

## Compliance

✅ All Zidney constitutional requirements met  
✅ Database-per-tenant isolation enforced  
✅ License middleware mandatory  
✅ No cross-workspace token reuse  
✅ Audit logging complete  
✅ Transaction boundaries defined

## Reference

- **Phase Stage:**
  [STAGE_03_AUTHENTICATION_SYSTEM.md](../../../phases/01_PLATFORM_FOUNDATION/STAGE_03_AUTHENTICATION_SYSTEM.md)
- **Constitution:** [PROJECT_CONTEXT_PRIMER.md](../../../docs/PROJECT_CONTEXT_PRIMER.md)
- **ADR References:** ADR-0001 (isolation), ADR-0006 (time), ADR-0007 (versioning), ADR-0008
  (semver)
