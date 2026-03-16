/**
 * Drizzle ORM Schema — Staff Divisions Join Table (Tenant Database)
 *
 * File: apps/api/src/db/tenant/schemas/staff-divisions.schema.ts
 * Stage: STAGE_22_DIVISIONS
 * Date: 2026-03-16
 *
 * Drizzle pgTable definition for the `staff_divisions` join table.
 * Table created by migration 20260316_001_divisions.ts.
 *
 * Composite primary key: (staff_id, division_id).
 * FK staff_id → backoffice_staff_users(id) ON DELETE CASCADE.
 * FK division_id → divisions(id) ON DELETE RESTRICT.
 *
 * No separate idx_staff_divisions_staff_id — the composite PK (staff_id, division_id)
 * has staff_id as the leading column, so PostgreSQL uses it for all staff_id prefix
 * lookups without a redundant index.
 *
 * Constitutional Compliance:
 * ✓ No HTTP logic — data definitions only
 * ✓ No framework dependencies beyond drizzle-orm
 * ✓ Tenant DB only — no master DB references
 */

import { index, pgTable, primaryKey, timestamp, uuid } from 'drizzle-orm/pg-core'

import { backofficeStaffUsers } from './backoffice-staff-users.schema'
import { divisions } from './divisions.schema'

// ---------------------------------------------------------------------------
// staff_divisions
// ---------------------------------------------------------------------------

export const staffDivisions = pgTable(
  'staff_divisions',
  {
    /** FK → backoffice_staff_users(id) ON DELETE CASCADE */
    staff_id: uuid('staff_id')
      .notNull()
      .references(() => backofficeStaffUsers.id, { onDelete: 'cascade' }),
    /** FK → divisions(id) ON DELETE RESTRICT */
    division_id: uuid('division_id')
      .notNull()
      .references(() => divisions.id, { onDelete: 'restrict' }),
    /** Server-set assignment timestamp (ADR-0006 — client time not trusted). */
    assigned_at: timestamp('assigned_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    /** Composite PK enforces uniqueness of (staff_id, division_id) at DB level. */
    pk: primaryKey({ columns: [table.staff_id, table.division_id] }),
    /**
     * idx_staff_divisions_staff_id is intentionally NOT declared here.
     * The composite PK (staff_id, division_id) has staff_id as leading column,
     * so PostgreSQL can use it for all staff_id prefix queries without a separate index.
     */
    /** Count/list staff members in a division (DIVISION_IN_USE guard). */
    divisionIdIdx: index('idx_staff_divisions_division_id').on(table.division_id),
  })
)

export type StaffDivision = typeof staffDivisions.$inferSelect
export type NewStaffDivision = typeof staffDivisions.$inferInsert
