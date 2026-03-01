/**
 * Drizzle ORM Schema — Translations (Tenant Database)
 *
 * File: apps/api/src/db/tenant/schemas/translations.schema.ts
 * Stage: 019_TRANSLATION_SYSTEM
 * Date: 2026-03-01
 *
 * Drizzle pgTable definition for the `translations` table.
 * Composite unique constraint used as idempotency key / upsert conflict target.
 * Three indexes support entity batch load, coverage aggregation, and language drain.
 *
 * Constitutional Compliance:
 * ✓ No HTTP logic — data definitions only
 * ✓ No framework dependencies beyond drizzle-orm
 * ✓ Tenant DB only — no master DB references
 */

import {
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

// ---------------------------------------------------------------------------
// translations
// ---------------------------------------------------------------------------

export const translations = pgTable(
  'translations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    entity_type: varchar('entity_type', { length: 100 }).notNull(),
    entity_id: uuid('entity_id').notNull(),
    field_name: varchar('field_name', { length: 100 }).notNull(),
    language_code: varchar('language_code', { length: 10 }).notNull(),
    /**
     * Opaque translated string. Empty string '' is a valid value (intentional blank).
     * NULL is never stored — enforced at service layer.
     */
    translated_value: text('translated_value').notNull(),
    /**
     * Server-authoritative creation timestamp.
     * Set once on insert — never overwritten on subsequent upserts.
     */
    created_at: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    /**
     * Server-authoritative last-update timestamp.
     * Set to NOW() on every upsert (including idempotent re-upserts).
     */
    updated_at: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    /**
     * Composite unique constraint — idempotency key and upsert conflict target.
     * Name must match migration DDL and service-layer onConflictDoUpdate target.
     */
    compositeUnique: unique('translations_composite_unique').on(
      table.entity_type,
      table.entity_id,
      table.field_name,
      table.language_code
    ),
    /**
     * Index 1: Batch entity load (FR-037) and entity cleanup (Q1).
     * Covers queries like: WHERE entity_type = X AND entity_id IN (...)
     */
    entityIndex: index('idx_translations_entity').on(
      table.entity_type,
      table.entity_id
    ),
    /**
     * Index 2: Coverage aggregation (FR-022).
     * Enables index-only COUNT(*) scans for coverage calculation.
     */
    coverageIndex: index('idx_translations_coverage').on(
      table.entity_type,
      table.language_code
    ),
    /**
     * Index 3: Language drain and row-count threshold check.
     * Used by DRAIN_LANGUAGE_TRANSLATIONS job and sync removal path.
     */
    languageIndex: index('idx_translations_language').on(table.language_code),
  })
)

export type TranslationRow = typeof translations.$inferSelect
export type NewTranslationRow = typeof translations.$inferInsert
