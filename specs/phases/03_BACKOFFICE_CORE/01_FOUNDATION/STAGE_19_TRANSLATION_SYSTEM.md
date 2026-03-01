# STAGE 19 – Translation System

Phase: 03_BACKOFFICE_CORE  
Domain: 01_FOUNDATION  
Scope: Entity translation management per tenant  
Database: Tenant DB only

---

## Stage Status

Status: DRAFT
Risk Level: UNKNOWN
Initiated: 2026-03-01T00:00:00Z

Scope Open:

- Specification pending

Constitutional Compliance:

- Pending constitutional audit

Notes:
Stage initialized. Specification in progress.

---

## Objective

Implement a tenant-scoped entity-level translation system that:

- Supports dynamic language configuration per workspace
- Enforces strict tenant isolation
- Provides deterministic fallback behavior
- Supports coverage analytics
- Scales to millions of translation rows (university scale)

Translations are fully isolated per tenant database.

---

## Architectural Principles

1. Translations are stored only inside tenant DB.
2. No master-level translations allowed.
3. Default language values are stored in base entity tables.
4. Translation table stores only non-default language values.
5. All translation resolution occurs in API layer (not database triggers).
6. Translation reads must be index-optimized.

---

## Translation Model

Translations are identified by composite identity:

- entity_type
- entity_id
- field_name
- language_code

This enables:

- Multi-field translation per entity
- Partial translation support
- Field-level coverage tracking

Example:

entity_type: "subject"  
entity_id: UUID  
field_name: "title"  
language_code: "ar"

---

## Database Schema

Table: translations

Columns:

- id (UUID, PK)
- entity_type (varchar, indexed)
- entity_id (UUID, indexed)
- field_name (varchar)
- language_code (varchar, indexed)
- translated_value (text)
- created_at
- updated_at

Required unique constraint:

(entity_type, entity_id, field_name, language_code)

Required indexes:

- (entity_type, entity_id)
- (language_code)
- (entity_type, language_code)

This ensures scalable lookup performance.

---

## Default Language Strategy

Default language content:

- Stored directly in entity base table (e.g., subjects.title)
- Never duplicated inside translations table
- Immutable fallback source

If translation row deleted:

- System falls back automatically to default language

No duplication of default values allowed.

---

## Fallback Logic (API Layer)

When retrieving entity field:

1. If requested_language == default_language  
   → Return base entity field value.

2. Else:
   - Attempt to fetch translation row.
   - If exists → return translated_value.
   - If missing → fallback to default language value.

3. If default value missing (invalid state)  
   → Return empty string and log warning.

Fallback must be deterministic and consistent across all modules.

---

## Language Management

Languages are defined in:

workspace_settings.language_settings

Each workspace can:

- Add language
- Remove language
- Set default language

Constraints:

- Default language cannot be removed.
- Removing language deletes its translation rows.
- Changing default language does not migrate existing base values automatically.

---

## Coverage Tracking

Coverage calculation per language:

Coverage % =
(Translated fields count / Total translatable fields count) \* 100

Coverage must:

- Be computed at query time OR cached with invalidation
- Be scoped per entity_type
- Be scoped per language
- Never include default language

Used for:

- Translation dashboard
- Workspace completeness reporting

---

## Performance & Scale Considerations

Expected scale:

- Millions of translation rows (large institutions)
- High read frequency

Requirements:

- All translation lookups must use indexed queries
- Avoid N+1 queries (batch load translations)
- Allow pagination for translation management UI
- No full-table scans allowed

If growth exceeds expected scale:

- Introduce partitioning by language_code or entity_type

---

## Write Rules

When saving translation:

- Must validate language exists in workspace settings
- Must validate entity exists
- Must upsert (insert or update)
- Must update updated_at timestamp

No silent overwrite without audit logging.

---

## Audit Logging

Every translation change must:

- Log entity_type
- Log entity_id
- Log language_code
- Log field_name
- Log user_id (staff who changed)
- Log timestamp

Audit logs stored in tenant DB.

---

## Validation Criteria

Stage complete when:

- Translations isolated per tenant
- Default language never duplicated
- Unique constraint enforced
- Fallback logic consistent
- Coverage calculation correct
- Large dataset tested for performance
- No cross-tenant leakage
- Removing language removes translations safely

---

## Not Allowed

- Global translation table
- Translation stored in master_db
- Storing default language inside translations table
- Hardcoded language codes
- Database triggers performing fallback logic
- Cross-tenant translation queries
