# STAGE_02C Specification Summary

**Created:** 2026-02-16  
**Stage:** STAGE_02C_MIGRATION_AND_VERSIONING_MODEL  
**Phase:** 01 – Platform Foundation  
**Status:** SPECIFICATION COMPLETE

---

## Overview

This directory contains the complete functional specification for the Zidney Migration & Versioning
Model (STAGE_02C). The specification operationalizes ADR-0008 (Semantic Versioning Policy) and
defines the deterministic schema evolution framework that guarantees institutional trust and
multi-tenant consistency.

---

## Specification Artifacts

### 1. **spec.md** – Primary Specification Document

**Purpose:** Formal, template-compliant specification covering all functional requirements

**Contents:**

- Feature overview and architectural context
- Constitutional compliance declaration
- Isolation impact analysis
- License & version enforcement detail
- Data model definitions (schema objects)
- Transaction boundaries
- Authoritative time usage
- Idempotency strategy
- Observability requirements
- Rate limiting policies
- Layer separation confirmation
- Failure modes & recovery strategies
- Test strategy (unit + integration)
- Validation criteria for completion
- Final compliance statement

**Compliance:** Follows Zidney Specify Template v1.0  
**Authority:** Governed by ADR-0008 (Semantic Versioning Policy)

---

### 2. **data-model.md** – Data Model Reference

**Purpose:** Comprehensive entity documentation for all versioning and migration tables

**Contents:**

**Master DB Entities:**

- `platform_settings` – Single-row system table tracking current and minimum supported schema
  versions
- `migration_registry` – Immutable append-only audit log of all applied migrations
- `tenants_registry` (modified) – Added `schema_version` column for fast compatibility checks
- `upgrade_snapshots` – Metadata tracking for pre-upgrade database snapshots

**Tenant DB Entities:**

- `schema_version` – Single-row table (source of truth) tracking tenant's current schema version

**Additional Documentation:**

- Migration file structure and naming conventions
- Migration file headers and metadata requirements
- Idempotency constraints
- Migration file validation rules
- Version compatibility matrix
- State machine diagrams
- Data integrity rules
- Example data snapshots
- Storage and performance notes

**Compliance:** Includes SemVer rules, transactional semantics, immutability constraints

---

### 3. **quickstart.md** – Implementer Reference Guide

**Purpose:** Quick reference for development teams implementing migration engine

**Contents:**

- 60-second concept overview
- Critical rules (must-know)
- Core files and locations
- Implementation checklist
- Example migration file (fully annotated)
- Version compatibility worked example
- Debugging guide for failed upgrades
- Key API endpoints (upgrade requests)
- Observability queries (debugging SQL)
- Common gotchas and how to avoid them
- Resource links

**Usage:** Developer on-ramp; operational runbook

---

## Constitutional Compliance

**Status:** ✓ FULLY COMPLIANT with Zidney Constitution v1.2.0

**Compliance Confirmations:**

✓ **Multi-Tenancy Model:** Database-per-tenant preserved; no shared tenant tables  
✓ **Isolation:** Tenant resolution mandatory; no implicit tenant context  
✓ **License Enforcement:** Middleware mandatory before upgrade execution  
✓ **Transaction Integrity:** All-or-nothing migrations; no partial state  
✓ **Versioning Enforcement:** Runtime refuses incompatible schemas (426 errors)  
✓ **Immutability:** Migration files locked after production deployment  
✓ **Audit Trail:** All operations logged with correlation_id, workspace_slug  
✓ **Error Handling:** Compliant with error standard; structured responses  
✓ **Secrets:** No secrets embedded in migration files  
✓ **Testing:** Unit + integration tests mandatory

**Architectural Authority:** ADR-0008 (Semantic Versioning Policy) — binding

---

## Key Principles Embedded

1. **Forward-Only Evolution**
   - Versions only increase; never decrease
   - No rollback of SQL (only snapshot restoration)
   - Immutable migration files after production

2. **Deterministic Compatibility**
   - SemVer enforced: MAJOR.MINOR.PATCH
   - Runtime validates before execution
   - Explicit version bumps required

3. **Transactional Safety**
   - Single transaction: Migrations + version update
   - Atomic commit or all-or-nothing rollback
   - Partial state forbidden

4. **Workspace Autonomy**
   - Opt-in tenant upgrades
   - Upgrades never automatic
   - Controlled release schedule per workspace

5. **Auditability**
   - Migration registry (append-only)
   - Snapshot metadata (immutable)
   - Structured logging (correlation tracking)

6. **Institutional Trust**
   - No schema drift (all tenants consistent path)
   - No per-tenant customization
   - License validation enforced

---

## Specification Coverage Matrix

| Area                            | Coverage   | Detail Level                                          |
| ------------------------------- | ---------- | ----------------------------------------------------- |
| **Master Migration Flow**       | ✓ Complete | Deployment, staging, validation                       |
| **Tenant Migration Flow**       | ✓ Complete | License check, lock, transaction, unlock              |
| **Version Compatibility Check** | ✓ Complete | Resolver integration, 426 error handling              |
| **Schema Objects (Master DB)**  | ✓ Complete | All 4 tables with constraints, indexes, relationships |
| **Schema Objects (Tenant DB)**  | ✓ Complete | Single-row schema_version table                       |
| **Migration File Format**       | ✓ Complete | Structure, headers, naming, idempotency               |
| **Transaction Boundaries**      | ✓ Complete | BEGIN/COMMIT/ROLLBACK semantics                       |
| **Snapshot Management**         | ✓ Complete | Creation, retention, metadata tracking                |
| **Upgrade Logging**             | ✓ Complete | Fields, structure, retention                          |
| **Error Handling**              | ✓ Complete | All failure modes, recovery steps                     |
| **Observability**               | ✓ Complete | Logs, metrics, debugging queries                      |
| **Idempotency**                 | ✓ Complete | File-level, upgrade-level, replay protection          |
| **Rate Limiting**               | ✓ Complete | Concurrent upgrade prevention                         |
| **Test Strategy**               | ✓ Complete | Unit, integration, scenarios                          |

---

## Readiness for Next Stages

### Prerequisites Met For: Plan (speckit.plan)

✓ Specification complete and template-compliant  
✓ Data model fully defined  
✓ All functional requirements explicit  
✓ Constitutional compliance confirmed  
✓ Architectural authority (ADR-0008) referenced  
✓ Error handling specified  
✓ Test strategy defined

### Next Stage: speckit.plan

The plan stage will:

- Design implementation architecture
- Map specification to code artifacts
- Define deployment sequence
- Create design decision documentation
- Generate implementation artifacts

### Subsequent Stage: speckit.tasks

The tasks stage will:

- Convert plan into atomic, dependency-ordered tasks
- Create implementation checklist
- Define success criteria per task
- Establish verification gates

---

## Key Decisions Locked by This Spec

| Decision                       | Rationale                                 | Authority               |
| ------------------------------ | ----------------------------------------- | ----------------------- |
| SemVer versioning system       | Deterministic compatibility tracking      | ADR-0008                |
| Opt-in tenant upgrades         | Institutional autonomy, safety            | Constitution            |
| Single transaction per upgrade | Atomic consistency, no partial state      | Operational Integrity   |
| Append-only migration registry | Auditability, immutable history           | Institutional Trust     |
| Snapshot-backed rollback only  | No auto-rollback; explicit recovery       | ADR-0005 (Opt-in Model) |
| Three version dimensions       | Product + Schema + Platform compatibility | ADR-0008                |
| Forward-only migrations        | No schema rollback complexity             | Migration Discipline    |
| Idempotent migration files     | Safe replay, cluster deployment           | Reliability             |

---

## Resource Links

| Resource         | Path                                                                            | Purpose                  |
| ---------------- | ------------------------------------------------------------------------------- | ------------------------ |
| Specification    | spec.md                                                                         | Full requirements        |
| Data Model       | data-model.md                                                                   | Schema definitions       |
| Quick Reference  | quickstart.md                                                                   | Developer on-ramp        |
| STAGE Stage File | ../../phases/01_PLATFORM_FOUNDATION/STAGE_02C_MIGRATION_AND_VERSIONING_MODEL.md | Original requirements    |
| Governing ADR    | ../../../docs/architecture/adr/adr-0008-formalize-semantic-versioning-policy.md | Version policy authority |
| Constitution     | ../../../AGENTS.md                                                              | Platform rules           |
| Specify Template | ../../templates/specify-template.md                                             | Specification format     |

---

## Verification Checklist

Before proceeding to planning:

- [x] spec.md complete and readable
- [x] data-model.md complete and comprehensive
- [x] quickstart.md provides clear developer guidance
- [x] Constitutional compliance confirmed
- [x] ADR-0008 properly referenced
- [x] All requirements from STAGE_02C_MIGRATION_AND_VERSIONING_MODEL.md captured
- [x] Error handling aligned with error standard
- [x] Test strategy defined
- [x] Observability requirements explicit
- [x] Transaction semantics clear
- [x] All 24 clarification questions answered (see CLARIFICATION_RESPONSES.md)
- [x] Responses encoded into specifications
- [x] Isolation boundaries documented
- [x] Concurrency rules explicit

**Status: READY FOR PLANNING**

---

## Author Notes

This specification formalizes the migration and versioning model that is foundational to Zidney's
institutional trust guarantee. Every schema change across the platform flows through this system.
Clarity, consistency, and strictness in this specification cascades to all subsequent stages.

Key areas that require careful implementation:

1. **Transactional integrity** – Never partial state
2. **Checksum validation** – Catch file tampering early
3. **Ruler enforcement** – Hard 426 blocks, not warnings
4. **Logging discipline** – Complete audit trails
5. **Snapshot atomicity** – Snapshot + migration atomic

---

END SPECIFICATION SUMMARY
