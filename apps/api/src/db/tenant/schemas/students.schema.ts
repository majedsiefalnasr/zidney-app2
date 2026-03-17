/**
 * Drizzle ORM Schema — Students (Tenant Database)
 *
 * File: apps/api/src/db/tenant/schemas/students.schema.ts
 * Stage: STAGE_22_DIVISIONS
 * Date: 2026-03-16
 *
 * Drizzle pgTable definition for the `students` table.
 * The `students` table provides the student identity layer for tenant workspaces.
 * The `division_id` FK column was added by migration 20260316_001_divisions.ts
 * (STAGE_22); all other columns exist from the bootstrap stage.
 *
 * Note: In some tenant database bootstraps the student entity lives in a table
 * named `users` (004-create-core-application-tables.sql). In either case
 * this Drizzle schema records the shape required for division assignment and
 * the FK constraint added by STAGE_22.
 *
 * Constitutional Compliance:
 * ✓ No HTTP logic — data definitions only
 * ✓ No framework dependencies beyond drizzle-orm
 * ✓ Tenant DB only — no master DB references
 */

import { index, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'

import { departments } from './departments.schema'
import { divisions } from './divisions.schema'

// ---------------------------------------------------------------------------
// students
// (Reflects the STAGE_22 shape after division_id FK is added by migration)
// ---------------------------------------------------------------------------

export const students = pgTable(
  'students',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Tenant-unique student identifier (may be NULL for non-bootstrapped rows). */
    external_id: varchar('external_id', { length: 255 }),
    /** Student email address — unique per workspace. */
    email: varchar('email', { length: 255 }).notNull(),
    first_name: varchar('first_name', { length: 255 }),
    last_name: varchar('last_name', { length: 255 }),
    /**
     * Division assignment — added by migration 20260316_001_divisions.ts (STAGE_22).
     * FK → divisions(id) ON DELETE RESTRICT:
     *   prevents deleting a division that still has students.
     * NOT NULL after STAGE_22 migration backfill.
     */
    division_id: uuid('division_id')
      .notNull()
      .references(() => divisions.id, { onDelete: 'restrict' }),
    /**
     * Department assignment — added by migration 20260317_001_departments.ts (STAGE_23).
     * FK → departments(id) ON DELETE SET NULL:
     *   deleting a department sets this column to null for previously assigned students.
     * NULLABLE: no backfill required; existing students start with department_id = null.
     */
    department_id: uuid('department_id').references(() => departments.id, { onDelete: 'setNull' }),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    /** List all students in a division + FK traversal path. */
    divisionIdIdx: index('idx_students_division_id').on(table.division_id),
    /** List all students in a department + FK traversal path. */
    departmentIdIdx: index('idx_students_department_id').on(table.department_id),
    /** uniqueIndex on email is handled by DB bootstrap — not declared here. */
    externalIdIdx: index('idx_students_external_id').on(table.external_id),
  })
)

export type Student = typeof students.$inferSelect
export type NewStudent = typeof students.$inferInsert
