# Specify Report — TRANSLATION_SYSTEM

**Step:** 1 — Specify  
**Timestamp:** 2026-03-01T00:10:00Z  
**Status:** COMPLETE

---

## Summary

Specification for the tenant-scoped entity-level translation system is complete. The spec covers the
full domain: translations isolated per tenant DB, default-language strategy (base entity table
only), deterministic API-layer fallback, language lifecycle management (add/remove/change default),
coverage analytics, bulk management, audit logging, and scale requirements. All 42 functional
requirements are traceable to 6 user stories. No `[NEEDS CLARIFICATION]` markers remain.

---

## Inputs Reviewed

- `specs/runtime/019-translation-system/spec.md` (25.8 KB)
- `specs/runtime/019-translation-system/checklists/requirements.md`
- `specs/phases/03_BACKOFFICE_CORE/01_FOUNDATION/STAGE_19_TRANSLATION_SYSTEM.md`

---

## Key Decisions

| #   | Decision                                                                       | Rationale                                                                                                           |
| --- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| 1   | Default-language values stored only in base entity table                       | Prevents duplication, ensures single source of truth, FR-005/FR-007                                                 |
| 2   | Fallback logic in API layer only — no DB triggers                              | Architectural constraint; trigger-based fallback violates tenant isolation and testability (FR-009)                 |
| 3   | Upsert on composite key `(entity_type, entity_id, field_name, language_code)`  | Idempotent writes; natural handling of create vs update without separate endpoints (FR-024, FR-030)                 |
| 4   | Language removal cascades in same transaction as settings update               | Ensures no orphaned translation rows and atomic config+data removal (FR-016)                                        |
| 5   | Coverage scoped per `(entity_type, language_code)` pair                        | Enables granular dashboard; default language excluded as it lives outside translations table (FR-019, FR-020)       |
| 6   | Coverage cache invalidated on any translation write or language config change  | Balances performance with freshness; cross-tenant cache strictly prohibited (FR-021, FR-023)                        |
| 7   | Batch writes must commit or reject as unit (no partial saves)                  | Transaction integrity — prevents inconsistent translation states (FR-029)                                           |
| 8   | Audit log append-only in tenant DB with correlation_id                         | Constitutional requirement; audit trail scoped per tenant with full context (FR-031–FR-035)                         |
| 9   | Entity type registry is open-ended (domain-owned)                              | Avoids coupling translation system to specific entity types; domain layer declares translatable fields (Assumption) |
| 10  | Forward-compatible schema for partitioning by `language_code` or `entity_type` | Supports scale beyond initial expected millions of rows without app changes (FR-039)                                |

---

## Functional Requirements Captured

42 functional requirements across 8 domains:

- **Translation Storage** (FR-001–FR-005): Tenant-only storage, schema definition, unique
  constraint, required indexes, no default-language values
- **Default Language Strategy** (FR-006–FR-008): Workspace settings source, read from base table
  only, reject default-language writes
- **Fallback Logic** (FR-009–FR-013): API-layer only, translation row takes priority, deterministic
  base-table fallback, empty string + warning on invalid state, identical behavior across all entity
  types
- **Language Management** (FR-014–FR-018): Settings-based language config, validate language on
  write, cascading deletion in same transaction, protect default language from removal, no
  auto-migration on default change
- **Coverage Tracking** (FR-019–FR-023): Per `(entity_type, language_code)`, excludes default
  language, supports cache with invalidation, indexed-only queries, tenant-scoped cache
- **Write Rules** (FR-024–FR-030): Upsert semantics, language validation, entity existence
  validation, transactional writes, server-authoritative `updated_at`, batch atomicity, idempotency
- **Audit Logging** (FR-031–FR-035): Append-only per write, full audit fields including
  correlation_id, language-removal audit entries
- **Performance & Scale** (FR-036–FR-039): No full-table scans, single-query batch loading,
  pagination with max page size, forward-compatible partitioning schema
- **Access Control** (FR-040–FR-042): Tenant resolver first, license middleware required, staff-only
  writes

---

## Clarifications Required

None. All specification areas are fully resolved.

---

## Constitutional Compliance

| Check                                   | Status | Notes                                                                                                    |
| --------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------- |
| No cross-tenant access introduced       | ✅     | translations table lives in tenant DB only; FR-001 and FR-023 prohibit shared access                     |
| License middleware requirement captured | ✅     | FR-041 mandates license enforcement middleware before any business logic                                 |
| Snapshot integrity requirement captured | ✅     | Not applicable (translation system is not part of attempt engine); N/A noted in spec                     |
| Idempotency strategy defined            | ✅     | FR-030: upsert semantics make critical endpoints naturally idempotent                                    |
| Transaction boundaries identified       | ✅     | FR-027, FR-029: all writes transactional; FR-016: language removal + cascade in same transaction         |
| Server-authoritative time enforced      | ✅     | FR-028: `updated_at` set to server-authoritative time; FR-032: audit timestamps are server-authoritative |
| No DB triggers for business logic       | ✅     | FR-009: fallback logic forbidden in triggers, stored procedures, or computed columns                     |
| Database-per-tenant preserved           | ✅     | FR-001: translations stored exclusively in tenant DB; master DB usage prohibited                         |
| Tenant resolver middleware required     | ✅     | FR-040: all translation routes require tenant resolver before DB access                                  |

**Overall:** COMPLIANT

---

## Open Risks

- **Scale path**: Partitioning by `language_code` or `entity_type` is forward-compatible per spec
  (FR-039) but not yet implemented — if tenant data volume grows faster than projected, partitioning
  must be introduced proactively.
- **Coverage denominator accuracy**: Coverage calculation accuracy depends on domain layer correctly
  declaring all translatable fields per entity_type — if a domain layer updates its translatable
  field list without updating the denominator used in coverage queries, coverage percentages will be
  inaccurate.
- **Entity deletion cascade**: The spec identifies orphaned translation cleanup on entity deletion
  (edge case) but defers strategy choice to the plan phase — this requires a decision between FK
  cascade vs. background cleanup job.

---

## Next Step

Proceed to Step 2 — Clarify.
