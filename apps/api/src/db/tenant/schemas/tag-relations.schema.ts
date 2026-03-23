/**
 * Drizzle ORM Schema — tag_relations
 *
 * File: apps/api/src/db/tenant/schemas/tag-relations.schema.ts
 * Stage: STAGE_32_TAGS
 *
 * NOTE: The UNIQUE constraint (unique_tag_relation) and FK constraints are migration-owned.
 * The composite index (idx_tag_relations_entity) is migration-owned.
 * Drizzle represents the B-tree index on tag_id here; UNIQUE and FKs are in the migration.
 */

import { check, index, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'

export const tagRelations = pgTable(
  'tag_relations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tag_id: uuid('tag_id').notNull(),
    entity_type: varchar('entity_type', { length: 40 }).notNull(),
    entity_id: uuid('entity_id').notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    entityTypeCheck: check(
      'tag_relations_entity_type_check',
      `${table.entity_type.name} IN ('MCQ_QUESTION', 'TRADITIONAL_QUESTION', 'LIBRARY_FILE')`
    ),
    tagIdIdx: index('idx_tag_relations_tag_id').on(table.tag_id),
    // idx_tag_relations_entity: migration-owned composite index (entity_type, entity_id)
    // unique_tag_relation: migration-owned UNIQUE(tag_id, entity_type, entity_id)
    // FK constraints (tag_id → tags.id CASCADE): migration-owned
  })
)

export type TagRelation = typeof tagRelations.$inferSelect
export type NewTagRelation = typeof tagRelations.$inferInsert
