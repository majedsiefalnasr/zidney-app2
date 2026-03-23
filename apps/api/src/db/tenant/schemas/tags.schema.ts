/**
 * Drizzle ORM Schema — tags
 *
 * File: apps/api/src/db/tenant/schemas/tags.schema.ts
 * Stage: STAGE_32_TAGS
 *
 * NOTE: The functional unique index (unique_tags_normalized_name) is migration-owned.
 * Drizzle cannot represent CONCURRENT partial functional indexes.
 * FK constraints (created_by, updated_by) are also migration-owned.
 */

import { check, index, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'

export const tags = pgTable(
  'tags',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 255 }).notNull(),
    normalized_name: varchar('normalized_name', { length: 255 }).notNull(),
    status: varchar('status', { length: 20 }).notNull().default('ENABLED'),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    created_by: uuid('created_by'),
    updated_by: uuid('updated_by'),
  },
  (table) => ({
    statusCheck: check('tags_status_check', `${table.status.name} IN ('ENABLED', 'DISABLED')`),
    statusIdx: index('idx_tags_status').on(table.status),
    // unique_tags_normalized_name: migration-owned CONCURRENT partial functional index
    // FK constraints (created_by, updated_by): migration-owned
  })
)

export type Tag = typeof tags.$inferSelect
export type NewTag = typeof tags.$inferInsert
