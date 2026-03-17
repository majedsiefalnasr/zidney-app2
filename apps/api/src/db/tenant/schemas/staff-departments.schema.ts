/**
 * Drizzle ORM Schema — Staff Departments Join Table (Tenant Database)
 *
 * File: apps/api/src/db/tenant/schemas/staff-departments.schema.ts
 * Stage: STAGE_23_DEPARTMENTS
 * Date: 2026-03-17
 *
 * Drizzle pgTable definition for the `staff_departments` join table.
 * Table created by migration 20260317_001_departments.ts.
 *
 * Composite primary key: (staff_id, department_id).
 * FK staff_id → backoffice_staff_users(id) ON DELETE CASCADE.
 * FK department_id → departments(id) ON DELETE CASCADE.
 *   Cascade (not RESTRICT): department deletion cascades to staff assignments
 *   once the service guard confirms no active assignments remain.
 *
 * Key difference from staff_divisions:
 *   staff_divisions.division_id uses ON DELETE RESTRICT (divisions are first-class boundaries).
 *   staff_departments.department_id uses ON DELETE CASCADE (departments are secondary segmentation).
 *
 * No separate idx_staff_departments_staff_id — the composite PK (staff_id, department_id)
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
import { departments } from './departments.schema'

// ---------------------------------------------------------------------------
// staff_departments
// ---------------------------------------------------------------------------

export const staffDepartments = pgTable(
  'staff_departments',
  {
    /** FK → backoffice_staff_users(id) ON DELETE CASCADE */
    staff_id: uuid('staff_id')
      .notNull()
      .references(() => backofficeStaffUsers.id, { onDelete: 'cascade' }),

    /** FK → departments(id) ON DELETE CASCADE */
    department_id: uuid('department_id')
      .notNull()
      .references(() => departments.id, { onDelete: 'cascade' }),

    /** Server-set assignment timestamp (ADR-0006 — client time not trusted). */
    assigned_at: timestamp('assigned_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    /**
     * Composite PK enforces uniqueness of (staff_id, department_id) at DB level.
     * Enables idempotent ON CONFLICT DO NOTHING upsert at service layer.
     */
    pk: primaryKey({ columns: [table.staff_id, table.department_id] }),

    /**
     * idx_staff_departments_staff_id is intentionally NOT declared here.
     * The composite PK (staff_id, department_id) has staff_id as leading column,
     * so PostgreSQL can use it for all staff_id prefix queries without a separate index.
     */

    /** Count/list staff members in a department (DEPARTMENT_HAS_ASSIGNMENTS guard). */
    departmentIdIdx: index('idx_staff_departments_department_id').on(table.department_id),
  })
)

export type StaffDepartment = typeof staffDepartments.$inferSelect
export type NewStaffDepartment = typeof staffDepartments.$inferInsert
