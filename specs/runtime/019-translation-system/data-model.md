# Data Model: Translation System

**Phase**: 1 — Design  
**Feature Branch**: `019-translation-system`  
**Date**: 2026-03-01  
**Depends on**: research.md (complete)

---

## 1. `translations` Table

### Purpose

Stores all non-default-language translated values for translatable entity fields. Never holds
default-language content (enforced at service layer per FR-005, FR-008).

### Column Definitions

| Column             | Type           | Constraints                                      | Notes                                                                                                                                           |
| ------------------ | -------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`               | `UUID`         | PRIMARY KEY, NOT NULL, DEFAULT gen_random_uuid() | Server-generated — client never supplies this                                                                                                   |
| `entity_type`      | `VARCHAR(100)` | NOT NULL                                         | Open-ended registry (e.g. `'subject'`, `'category'`, `'question'`). Validated against `TRANSLATABLE_FIELDS` at service layer, not DB constraint |
| `entity_id`        | `UUID`         | NOT NULL                                         | References entity in another tenant table; no FK (cannot ref multiple parent tables per Q1)                                                     |
| `field_name`       | `VARCHAR(100)` | NOT NULL                                         | Validated against `TRANSLATABLE_FIELDS[entity_type]` at service layer                                                                           |
| `language_code`    | `VARCHAR(10)`  | NOT NULL                                         | ISO 639-1 (e.g. `'ar'`, `'fr'`). NOT the default language (enforced at service layer)                                                           |
| `translated_value` | `TEXT`         | NOT NULL                                         | Opaque string. Empty string `''` is a valid value (intentional blank) — NULL is never stored                                                    |
| `created_at`       | `TIMESTAMPTZ`  | NOT NULL, DEFAULT NOW()                          | Server-authoritative. Never overwritten on upsert                                                                                               |
| `updated_at`       | `TIMESTAMPTZ`  | NOT NULL, DEFAULT NOW()                          | Server-authoritative. Set to `NOW()` on every upsert                                                                                            |

### Unique Constraint (Idempotency Key)

```sql
CONSTRAINT translations_composite_unique
  UNIQUE (entity_type, entity_id, field_name, language_code)
```

This constraint is the upsert conflict target (per Q4 clarification). Submitting the same composite
key twice is always safe — the second call updates `translated_value` and `updated_at`.

### Indexes

```sql
-- Unique constraint also acts as a B-tree index on the 4-column key
-- (created implicitly by the UNIQUE constraint above)

-- Index 1: Batch entity load (FR-037) + entity cleanup (Q1)
CREATE INDEX idx_translations_entity
  ON translations (entity_type, entity_id);

-- Index 2: Coverage aggregation (FR-022) — index-only scan for COUNT(*)
CREATE INDEX idx_translations_coverage
  ON translations (entity_type, language_code);

-- Index 3: Language drain/removal (DRAIN job + row-count check)
CREATE INDEX idx_translations_language
  ON translations (language_code);
```

### Notes on Scale (SC-007, FR-039)

- At 5M rows per tenant, B-tree indexes on the above columns support sub-50ms indexed lookups.
- Fill factor left at default (90%) — suitable for upsert-heavy tables.
- Forward-compatible with declarative range partitioning by `language_code` or `entity_type` without
  application changes. Partitioning not introduced at this stage.
- Autovacuum tuning recommended for this table in operations runbook (upserts generate dead tuples).

### Drizzle Schema Definition (TypeScript)

```typescript
// apps/api/src/db/tenant/schemas/translations.schema.ts
import { index, pgTable, text, timestamp, unique, uuid, varchar } from "drizzle-orm/pg-core";

export const translations = pgTable(
  "translations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entity_type: varchar("entity_type", { length: 100 }).notNull(),
    entity_id: uuid("entity_id").notNull(),
    field_name: varchar("field_name", { length: 100 }).notNull(),
    language_code: varchar("language_code", { length: 10 }).notNull(),
    translated_value: text("translated_value").notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    compositeUnique: unique("translations_composite_unique").on(
      table.entity_type,
      table.entity_id,
      table.field_name,
      table.language_code,
    ),
    entityIndex: index("idx_translations_entity").on(table.entity_type, table.entity_id),
    coverageIndex: index("idx_translations_coverage").on(table.entity_type, table.language_code),
    languageIndex: index("idx_translations_language").on(table.language_code),
  }),
);
```

---

## 2. `translation_audit_logs` Table

### Purpose

Immutable, append-only audit trail for all translation write events (create, update, delete). Scoped
exclusively to the tenant database. Never modified or deleted (enforced by trigger). Satisfies
FR-031 through FR-035.

### Column Definitions

| Column           | Type           | Constraints                                      | Notes                                                                                    |
| ---------------- | -------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `id`             | `UUID`         | PRIMARY KEY, NOT NULL, DEFAULT gen_random_uuid() |                                                                                          |
| `workspace_id`   | `UUID`         | NOT NULL                                         | Passed as data — no FK (tenant DB; workspace ID from resolver context)                   |
| `entity_type`    | `VARCHAR(100)` | NOT NULL                                         | Same value as affected translation row                                                   |
| `entity_id`      | `UUID`         | NOT NULL                                         | Same value as affected translation row                                                   |
| `field_name`     | `VARCHAR(100)` | NOT NULL                                         | Same value as affected translation row                                                   |
| `language_code`  | `VARCHAR(10)`  | NOT NULL                                         | Same value as affected translation row                                                   |
| `action`         | `VARCHAR(20)`  | NOT NULL                                         | `'created'` \| `'updated'` \| `'deleted'`                                                |
| `previous_value` | `TEXT`         | NULL OK                                          | Value before the change. NULL for `'created'`. Populated for `'updated'` and `'deleted'` |
| `new_value`      | `TEXT`         | NULL OK                                          | Value after the change. NULL for `'deleted'`. Populated for `'created'` and `'updated'`  |
| `user_id`        | `UUID`         | NOT NULL                                         | Staff actor who performed the operation. Required (FR-032)                               |
| `correlation_id` | `VARCHAR(50)`  | NOT NULL                                         | Request correlation ID (FR-033)                                                          |
| `reason`         | `VARCHAR(100)` | NULL OK                                          | Optional reason code (e.g. `'language_removed'` for FR-035 cascade deletes)              |
| `created_at`     | `TIMESTAMPTZ`  | NOT NULL, DEFAULT NOW()                          | Server-authoritative. Immutable after insert                                             |

### Immutability Enforcement

A trigger prevents UPDATE and DELETE on this table, identical to the pattern used by
`workspace_settings_audit`:

```sql
CREATE TRIGGER prevent_translation_audit_modification
  BEFORE UPDATE OR DELETE ON translation_audit_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();
-- Reuses the existing trigger function from v1.0.0/triggers.sql
```

### Indexes

```sql
-- Primary query pattern: audit trail for a specific entity (paginated)
CREATE INDEX idx_tal_entity_created
  ON translation_audit_logs (workspace_id, entity_type, entity_id, created_at DESC, id DESC);

-- Secondary: audit trail by language (for language removal audit queries)
CREATE INDEX idx_tal_language_created
  ON translation_audit_logs (workspace_id, language_code, created_at DESC);
```

### Drizzle Schema Definition (TypeScript)

```typescript
// apps/api/src/db/tenant/schemas/translation-audit-logs.schema.ts
import { index, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export const translationAuditLogs = pgTable(
  "translation_audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspace_id: uuid("workspace_id").notNull(),
    entity_type: varchar("entity_type", { length: 100 }).notNull(),
    entity_id: uuid("entity_id").notNull(),
    field_name: varchar("field_name", { length: 100 }).notNull(),
    language_code: varchar("language_code", { length: 10 }).notNull(),
    action: varchar("action", { length: 20 }).notNull(), // 'created'|'updated'|'deleted'
    previous_value: text("previous_value"),
    new_value: text("new_value"),
    user_id: uuid("user_id").notNull(),
    correlation_id: varchar("correlation_id", { length: 50 }).notNull(),
    reason: varchar("reason", { length: 100 }),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    entityCreatedIndex: index("idx_tal_entity_created").on(
      table.workspace_id,
      table.entity_type,
      table.entity_id,
      table.created_at,
      table.id,
    ),
    languageCreatedIndex: index("idx_tal_language_created").on(
      table.workspace_id,
      table.language_code,
      table.created_at,
    ),
  }),
);
```

---

## 3. `TRANSLATABLE_FIELDS` Constant Map

### Purpose

Defines the canonical set of translatable fields per entity_type. Serves as the single source of
truth for:

1. Field validation in translation write operations (FR-025 extension)
2. Coverage denominator calculation (spec Q5 clarification)
3. Translation panel field listing (User Story 5)

### TypeScript Type Definition

```typescript
// packages/domain-core/src/translation/translatable-fields.ts

/**
 * Canonical map of entity_type → translatable field names.
 *
 * Coverage denominator = TRANSLATABLE_FIELDS[entity_type].length
 * Field validation: field_name must be TRANSLATABLE_FIELDS[entity_type][n]
 *
 * To add a new entity_type or field:
 *   1. Add entry here
 *   2. Bump domain-core package minor version
 *   3. No DB migration required (translations table is open-ended)
 */
export const TRANSLATABLE_FIELDS = {
  subject: ["title", "description"],
  category: ["name", "description"],
  question: ["text", "explanation"],
  exam: ["title", "description", "instructions"],
  // Extend as new translatable entities are added to the platform
} as const satisfies Record<string, readonly string[]>;

/** Union of all registered entity types */
export type TranslatableEntityType = keyof typeof TRANSLATABLE_FIELDS;

/** Union of all field names for a given entity type */
export type TranslatableFieldName<T extends TranslatableEntityType> =
  (typeof TRANSLATABLE_FIELDS)[T][number];

/**
 * Returns the list of translatable fields for an entity_type.
 * Returns empty array for unknown entity types (logs warning at service layer).
 */
export function getTranslatableFields(entityType: string): readonly string[] {
  return (TRANSLATABLE_FIELDS as Record<string, readonly string[]>)[entityType] ?? [];
}

/**
 * Returns true if entity_type is a registered translatable entity.
 */
export function isTranslatableEntityType(entityType: string): entityType is TranslatableEntityType {
  return entityType in TRANSLATABLE_FIELDS;
}
```

### Adding a New Entity Type

1. Add `entity_type: ['field1', 'field2']` entry to `TRANSLATABLE_FIELDS`
2. Bump `packages/domain-core` package minor version in `package.json`
3. No DB migration required — the `translations` table accepts any `entity_type` string
4. Coverage denominator automatically reflects the new field count on next computation

---

## 4. `workspace_settings.language_settings` JSON Schema Update

### Current Schema (Stage 018)

```typescript
interface LanguageSettings {
  default_language: string; // ISO 639-1, e.g. "ar"
  supported_languages: string[]; // e.g. ["ar", "en", "fr"]
}
```

### Updated Schema (Stage 019 — Translation System)

```typescript
interface LanguageSettings {
  default_language: string;
  supported_languages: string[];
  /**
   * Per-language operational status.
   * Key: language_code (ISO 639-1)
   * Value:
   *   'active'   — normal state; translations are accepted and readable
   *   'removing' — async drain in progress; language was removed from
   *                supported_languages but its translation rows are still
   *                being deleted by DRAIN_LANGUAGE_TRANSLATIONS worker job
   *
   * Absence of a key is equivalent to 'active'.
   * This field is written only by:
   *   - Language removal endpoint (sets to 'removing' for large datasets)
   *   - DRAIN_LANGUAGE_TRANSLATIONS worker job (removes entry after drain)
   * It MUST NOT be set via the public settings update API for arbitrary values.
   */
  language_status?: Record<string, "active" | "removing">;
}
```

### Backward Compatibility

- `language_status` is optional — all existing `workspace_settings` rows are valid without it.
- Absent `language_status` key = all languages are `'active'` (computed default, not stored
  default).
- No database migration for this change. The JSONB column absorbs the new field on first write.
- Validation schema update: `workspace-settings.validation.ts` `languageSettingsSchema` must add
  `language_status: z.record(z.enum(['active', 'removing'])).optional()`.

### State Machine for Language Removal

```
Language in supported_languages, no status key (= 'active')
    │
    ▼  Admin removes language
    │
    ├─ count ≤ 10,000 → synchronous in-transaction delete → language removed from supported_languages, no status change
    │
    └─ count > 10,000 → language removed from supported_languages
                      → language_status[code] = 'removing'
                      → DRAIN job enqueued
                      → Worker drains batches
                      → Worker deletes language_status[code] entry
                      → Drain complete
```

### Write Guard at Service Layer

The `translation.service.ts` MUST check `language_status` before accepting translation writes:

- If `language_status[language_code] === 'removing'` → reject with `UNSUPPORTED_LANGUAGE` (422) —
  the language is being removed and no new translations are accepted.
- If `language_code` not in `supported_languages` → reject with `UNSUPPORTED_LANGUAGE` (422).

---

## 5. Migration Approach

### Version Bump

Per ADR-0008: adding new tables (`translations`, `translation_audit_logs`) is an **additive**
database change → **MINOR** bump.

- Current schema version: `1.1.0`
- New schema version: `1.2.0`

### Migration File

```
apps/api/src/db/tenant/migrations/20260301_001_translation_system.ts
```

### Migration Contents

The single forward-only migration performs, in transaction order:

1. `CREATE TABLE translations` with all columns, NOT NULL constraints
2. `ALTER TABLE translations ADD CONSTRAINT translations_composite_unique UNIQUE (...)`
3. `CREATE INDEX idx_translations_entity ON translations (...)`
4. `CREATE INDEX idx_translations_coverage ON translations (...)`
5. `CREATE INDEX idx_translations_language ON translations (...)`
6. `CREATE TABLE translation_audit_logs` with all columns
7. `CREATE INDEX idx_tal_entity_created ON translation_audit_logs (...)`
8. `CREATE INDEX idx_tal_language_created ON translation_audit_logs (...)`
9. `CREATE TRIGGER prevent_translation_audit_modification ...` (reuses existing
   `prevent_audit_modification()` function)
10. `UPDATE schema_version SET version = '1.2.0', applied_at = NOW()` (per schema_version table
    pattern)

### Compliance Checklist

- [ ] Forward-only: `down()` throws
      `new Error('Translation system migration is not reversible. Restore from snapshot.')`
- [ ] Transactional: all statements in one BEGIN/COMMIT block
- [ ] Idempotent: all `CREATE ... IF NOT EXISTS`
- [ ] No existing table modification (additive only)
- [ ] schema_version bumped from `1.1.0` → `1.2.0`
- [ ] Stage tag in file header: `Stage: 019_TRANSLATION_SYSTEM`
