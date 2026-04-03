/**
 * Drizzle ORM Schema — Hierarchy Nodes (Tenant Database)
 *
 * File: apps/api/src/db/tenant/schemas/hierarchy-nodes.schema.ts
 * Stage: STAGE_25_HIERARCHY_TREE
 *
 * Represents tree nodes in the workspace hierarchy.
 * Full schema will be expanded in STAGE_25_HIERARCHY_TREE.
 * This stub is required for FK reference from staff_hierarchy_levels.
 */

import { pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'

export const hierarchyNodes = pgTable('hierarchy_nodes', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  parent_id: uuid('parent_id'),
  description: text('description'),
  status: varchar('status', { length: 20 }).notNull().default('ENABLED'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export type HierarchyNode = typeof hierarchyNodes.$inferSelect
export type NewHierarchyNode = typeof hierarchyNodes.$inferInsert
