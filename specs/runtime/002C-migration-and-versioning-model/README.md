# STAGE_02C – Migration & Versioning Model

**Phase:** 01 – Platform Foundation  
**Stage:** STAGE_02C_MIGRATION_AND_VERSIONING_MODEL  
**Status:** Specification Complete – Ready for Planning  
**Created:** 2026-02-16

---

## What Is This Stage?

STAGE_02C defines Zidney's deterministic, auditable schema evolution system. It operationalizes
ADR-0008 (Semantic Versioning Policy) and ensures:

- **No schema drift** across tenants
- **Controlled upgrades** (opt-in, not automatic)
- **Rollback capability** via snapshots
- **Runtime compatibility** (426 errors on incompatibility)
- **Institutional trust** through immutable audit trails

This stage is **critical** — all subsequent schema changes depend on its engine.

---

## Quick Navigation

| Document                                                     | Audience           | Purpose                                      |
| ------------------------------------------------------------ | ------------------ | -------------------------------------------- |
| **[spec.md](spec.md)**                                       | Architects, PMs    | Complete spec (all clarifications encoded)   |
| **[data-model.md](data-model.md)**                           | Database engineers | Schema definitions, entities, relationships  |
| **[quickstart.md](quickstart.md)**                           | Developers         | Implementation guide, debugging, examples    |
| **[clarify.md](clarify.md)**                                 | Reference          | 24 clarification questions (RESOLVED ✓)      |
| **[CLARIFICATION_RESPONSES.md](CLARIFICATION_RESPONSES.md)** | Stakeholders       | All 24 answers documented                    |
| **[SPECIFICATION_SUMMARY.md](SPECIFICATION_SUMMARY.md)**     | Project leads      | Status, compliance, readiness                |
| **[clarify.md](clarify.md)**                                 | Stakeholders       | 24 clarification questions requiring answers |
| **[SPECIFICATION_SUMMARY.md](SPECIFICATION_SUMMARY.md)**     | Project leads      | Status, compliance, readiness                |

---

## Key Concepts (2-Minute Read)

### Three Version Dimensions

```
SCHEMA VERSION (tenant)
├─ Stored: tenant_db.schema_version (source of truth)
├─ Format: SemVer (1.2.0)
└─ Purpose: Track which migrations applied

PRODUCT VERSION (commercial layer)
├─ Stored: master_db.licenses.product_version
└─ Purpose: Feature availability control

PLATFORM VERSION (global)
├─ Stored: master_db.platform_settings
└─ Purpose: Minimum required version
```

### Migration Flow (High Level)

```
[Upgrade triggered]
  ↓
[License valid? schema_version requires upgrade?]
  ↓
[Create snapshot]
  ↓
[Lock workspace]
  ↓
[Execute migrations (transactional)]
  ↓
[Update versions] ← atomic with migration
  ↓
[Unlock workspace]
  ↓
[Success or rollback]
```

### Runtime Compatibility Check

```
[Request arrives]
  ↓
[Check: tenant.schema_version ≥ minimum_supported?]
  ↓
[YES] Request proceeds →
[NO]  Response 426 Upgrade Required
```

---

## What You Need to Implement

### 1. Master Migration Runner

- Load migration files sequentially
- Prevent gaps (e.g., 001, 003 missing 002 → FAIL)
- Transactional execution
- Update `platform_settings.current_schema_version`

### 2. Tenant Migration Runner

- Validate license ACTIVE
- Acquire workspace write lock
- Create snapshot (pre-migration)
- Execute migrations transactionally
- Update both tenant_db AND master_db versions
- Release lock

### 3. Resolver Compatibility Check

- Read `platform_settings.minimum_supported_schema_version`
- Read tenant's schema version
- Validate: `tenant_version ≥ minimum_supported`
- Block with 426 if incompatible

### 4. Schema Objects

- 5 new/modified tables (see **data-model.md**)
- Indexes for performance
- Constraints for integrity

---

## Core Rules (Must Know)

✓ **Forward-only** – Versions never decrease  
✓ **Immutable migrations** – Files locked after production deployment  
✓ **Transactional** – All-or-nothing, no partial state  
✓ **Opt-in upgrades** – Tenants choose when to upgrade  
✓ **SemVer required** – Every schema change bumps version  
✓ **License-gated** – Only ACTIVE workspaces can upgrade  
✓ **Snapshot-backed** – Rollback via manual snapshot restoration  
✓ **Audit-tracked** – migration_registry immutable log

---

## Compliance Status

**Zidney Constitution:** ✓ COMPLIANT  
**Import Boundaries:** ✓ COMPLIANT  
**Multi-Tenancy:** ✓ COMPLIANT  
**License Enforcement:** ✓ COMPLIANT  
**Transactional Integrity:** ✓ COMPLIANT  
**Error Handling:** ✓ COMPLIANT

---

## What's in Each File?

### spec.md (9000+ words)

- Complete functional specification
- Follows Zidney Specify Template
- Covers all layers: isolation, licensing, transactions, observability
- Test strategy defined
- Failure modes covered
- Validation criteria locked

### data-model.md (6000+ words)

- Master DB entities: platform_settings, migration_registry, upgrade_snapshots
- Tenant DB entities: schema_version
- Migration file structure and format
- SemVer mapping rules
- State machines (master flow, tenant flow)
- Data integrity rules
- Example JSON snapshots

### quickstart.md (4000+ words)

- 60-second concept overview
- Implementation checklist (all tasks)
- Example migration file (copy-paste ready)
- Worked example: version incompatibility scenario
- Debugging guide (failed upgrades)
- Common gotchas
- API endpoints
- SQL queries for observability

### SPECIFICATION_SUMMARY.md (2000+ words)

- Artifact inventory
- Constitutional compliance matrix
- Key decisions locked
- Readiness for next stages (planning)
- Verification checklist

---

## Read Next: Planning Phase

Once you understand this spec, the next step is **speckit.plan**, which will:

1. Design the implementation architecture
2. Map spec requirements to code artifacts
3. Define deployment sequence
4. Create design decision documentation
5. Generate architecture diagrams

This stage provides the "what"; planning will provide the "how".

---

## Resources

| Item                            | Location                                                                        |
| ------------------------------- | ------------------------------------------------------------------------------- |
| Governing Architecture Decision | docs/architecture/adr/adr-0008-formalize-semantic-versioning-policy.md          |
| Platform Constitution           | AGENTS.md (section: Migration Discipline)                                       |
| Master Stage File               | ../../phases/01_PLATFORM_FOUNDATION/STAGE_02C_MIGRATION_AND_VERSIONING_MODEL.md |
| Specification Template          | ../../templates/specify-template.md                                             |

---

## Questions?

**Implementation questions?** → See **quickstart.md** (common gotchas section)  
**Data model questions?** → See **data-model.md**  
**Requirement questions?** → See **spec.md** (search by topic)  
**Stage questions?** → See **SPECIFICATION_SUMMARY.md**

---

## Timeline Readiness

- ✓ Specification: COMPLETE
- ✓ Data model: COMPLETE
- ✓ Developer guides: COMPLETE
- ✓ Compliance: VERIFIED
- ⧐ Planning: AWAITING (next)
- ⧐ Tasks: AWAITING (after planning)
- ⧐ Implementation: AWAITING (after tasks)

---

END README
