/**
 * Drizzle ORM Schema — Staff Groups Join Table (Tenant Database)
 *
 * File: apps/api/src/db/tenant/schemas/staff-groups.schema.ts
 * Stage: STAGE_24_GROUPS
 * Date: 2026-03-19
 *
 * Drizzle pgTable definition for the `staff_groups` join table.
 * Table created by migration 20260319_001_groups.ts.
 *
 * Composite primary key: (staff_id, group_id).
 * FK staff_id → backoffice_staff_users(id) ON DELETE CASCADE.
 * FK group_id → groups(id) ON DELETE CASCADE.
 *
 * Note on FK cascade vs soft-delete:
 *   Groups use soft-delete (deleted_at). The ON DELETE CASCADE on group_id means
 *   a hard-delete of a groups row would cascade to staff_groups. Since groups are
 *   soft-deleted only this cascade will not fire in normal operation; it exists as
 *   a safety net only (see Architecture Decision AD-05 in plan.md).
 *
 * No separate idx_staff_groups_staff_id — the composite PK (staff_id, group_id)
 * has staff_id as the leading column, so PostgreSQL can use it for all staff_id
 * prefix lookups without a redundant index.
 *
 * Constitutional Compliance:
 * ✓ No HTTP logic — data definitions only
 * ✓ No framework dependencies beyond drizzle-orm
 * ✓ Tenant DB only — no master DB references
 */

import { index, pgTable, primaryKey, timestamp, uuid } from 'drizzle-orm/pg-core'

import { backofficeStaffUsers } from './backoffice-staff-users.schema'
import { groups } from './groups.schema'

// ---------------------------------------------------------------------------
// staff_groups
// ---------------------------------------------------------------------------

export const staffGroups = pgTable(
  'staff_groups',
  {
    /** FK → backoffice_staff_users(id) ON DELETE CASCADE */
    staff_id: uuid('staff_id')
      .notNull()
      .references(() => backofficeStaffUsers.id, { onDelete: 'cascade' }),

    /** FK → groups(id) ON DELETE CASCADE (soft-delete safety net — see file JSDoc) */
    group_id: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),

    /** Server-set assignment timestamp (ADR-0006 — client time not trusted). */
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    /**
     * Composite PK enforces uniqueness of (staff_id, group_id) at DB level.
     * Enables idempotent ON CONFLICT DO NOTHING upsert at service layer.
     */
    pk: primaryKey({ columns: [table.staff_id, table.group_id] }),

    /**
     * idx_staff_groups_staff_id is intentionally NOT declared here.
     * The composite PK (staff_id, group_id) has staff_id as leading column,
     * so PostgreSQL can use it for all staff_id prefix queries without a separate index.
     */

    /** Count/list staff members in a group (GROUP_HAS_ASSIGNMENTS guard at delete). */
    groupIdIdx: index('idx_staff_groups_group_id').on(table.group_id),
  })
)

export type StaffGroup = typeof staffGroups.$inferSelect
export type NewStaffGroup = typeof staffGroups.$inferInsert
