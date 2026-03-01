/**
 * Drizzle ORM Schema — Translation Audit Logs (Tenant Database)
 *
 * File: apps/api/src/db/tenant/schemas/translation-audit-logs.schema.ts
 * Stage: 019_TRANSLATION_SYSTEM
 * Date: 2026-03-01
 *
 * Drizzle pgTable definition for the `translation_audit_logs` table.
 * Immutable, append-only audit trail for all translation write events.
 * Immutability enforced at DB level via `prevent_translation_audit_modification` trigger.
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
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

// ---------------------------------------------------------------------------
// translation_audit_logs
// ---------------------------------------------------------------------------

export const translationAuditLogs = pgTable(
  'translation_audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /**
     * Workspace UUID — passed as data (no FK, tenant DB context).
     */
    workspace_id: uuid('workspace_id').notNull(),
    entity_type: varchar('entity_type', { length: 100 }).notNull(),
    entity_id: uuid('entity_id').notNull(),
    field_name: varchar('field_name', { length: 100 }).notNull(),
    language_code: varchar('language_code', { length: 10 }).notNull(),
    /**
     * Write operation type.
     * 'created' | 'updated' | 'deleted'
     */
    action: varchar('action', { length: 20 }).notNull(),
    /**
     * Value before the change.
     * NULL for 'created' actions.
     * Populated for 'updated' and 'deleted' actions.
     */
    previous_value: text('previous_value'),
    /**
     * Value after the change.
     * NULL for 'deleted' actions.
     * Populated for 'created' and 'updated' actions.
     */
    new_value: text('new_value'),
    /**
     * Staff actor who performed the operation. Required (FR-032).
     */
    user_id: uuid('user_id').notNull(),
    /**
     * Request correlation ID for end-to-end tracing (FR-033).
     */
    correlation_id: varchar('correlation_id', { length: 50 }).notNull(),
    /**
     * Optional reason code.
     * e.g., 'language_removed' for FR-035 cascade deletes.
     */
    reason: varchar('reason', { length: 100 }),
    /**
     * Server-authoritative creation timestamp. Immutable after insert.
     */
    created_at: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    /**
     * Primary query pattern: paginated audit trail for a specific entity.
     * Covers: WHERE workspace_id = X AND entity_type = Y AND entity_id = Z
     * ORDER BY created_at DESC, id DESC
     */
    entityCreatedIndex: index('idx_tal_entity_created').on(
      table.workspace_id,
      table.entity_type,
      table.entity_id,
      table.created_at,
      table.id
    ),
    /**
     * Secondary: audit trail by language (for language removal audit queries).
     * Covers: WHERE workspace_id = X AND language_code = Y ORDER BY created_at DESC
     */
    languageCreatedIndex: index('idx_tal_language_created').on(
      table.workspace_id,
      table.language_code,
      table.created_at
    ),
  })
)

export type TranslationAuditLogRow = typeof translationAuditLogs.$inferSelect
export type NewTranslationAuditLogRow = typeof translationAuditLogs.$inferInsert
