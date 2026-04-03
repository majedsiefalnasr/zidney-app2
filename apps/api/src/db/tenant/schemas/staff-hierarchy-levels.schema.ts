/**
 * Drizzle ORM Schema — Staff Hierarchy Levels (Tenant Database)
 *
 * File: apps/api/src/db/tenant/schemas/staff-hierarchy-levels.schema.ts
 * Stage: STAGE_41_STAFF_MANAGEMENT
 * Date: 2026-04-04
 *
 * Tracks which hierarchy nodes a staff member is assigned to.
 * Composite PK: (staff_id, hierarchy_node_id).
 */

import { pgTable, timestamp, uuid } from 'drizzle-orm/pg-core'

import { backofficeStaffUsers } from './backoffice-staff-users.schema'

export const staffHierarchyLevels = pgTable('staff_hierarchy_levels', {
  staff_id: uuid('staff_id')
    .notNull()
    .references(() => backofficeStaffUsers.id, { onDelete: 'cascade' }),
  hierarchy_node_id: uuid('hierarchy_node_id').notNull(),
  workspace_id: uuid('workspace_id').notNull(),
  assigned_at: timestamp('assigned_at', { withTimezone: true }).notNull().defaultNow(),
})

export type StaffHierarchyLevel = typeof staffHierarchyLevels.$inferSelect
export type NewStaffHierarchyLevel = typeof staffHierarchyLevels.$inferInsert
