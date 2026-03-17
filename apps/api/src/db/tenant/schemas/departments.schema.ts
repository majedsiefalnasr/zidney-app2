/**
 * Drizzle ORM Schema — Departments (Tenant Database)
 *
 * File: apps/api/src/db/tenant/schemas/departments.schema.ts
 * Stage: STAGE_23_DEPARTMENTS
 * Date: 2026-03-17
 *
 * Drizzle pgTable definition for the `departments` table.
 * Table created by migration 20260317_001_departments.ts.
 *
 * Self-referencing parent_id:
 *   Uses the `(): AnyPgColumn =>` deferred lambda to satisfy TypeScript strict
 *   mode while allowing the self-reference forward declaration.
 *
 * Functional composite unique index:
 *   UNIQUE (LOWER(name), COALESCE(parent_id, uuid_sentinel)) is owned by the
 *   migration (`departments_name_parent_lower_unique`). Drizzle cannot express
 *   this functional index via uniqueIndex(); no uniqueIndex() declaration here
 *   to avoid generating a conflicting plain UNIQUE constraint.
 *
 * Constitutional Compliance:
 * ✓ No HTTP logic — data definitions only
 * ✓ No framework dependencies beyond drizzle-orm
 * ✓ Tenant DB only — no master DB references
 */

import type { AnyPgColumn } from 'drizzle-orm/pg-core'
import { index, integer, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'

import { divisions } from './divisions.schema'

// ---------------------------------------------------------------------------
// departments
// ---------------------------------------------------------------------------

export const departments = pgTable(
  'departments',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    /** Department display name. Unique within same parent scope (functional composite index). */
    name: varchar('name', { length: 255 }).notNull(),

    /**
     * Department classification type.
     * Allowed values: 'MAIN' | 'SUB' | 'SIMPLE'.
     * CHECK constraint enforced at DB layer in migration.
     */
    type: varchar('type', { length: 20 }).notNull(),

    /**
     * Self-referencing parent FK.
     * Null = root-level department (no parent).
     * FK → departments(id) ON DELETE RESTRICT: prevents parent deletion while children exist.
     * Uses AnyPgColumn deferred lambda for TypeScript self-reference forward declaration.
     */
    parent_id: uuid('parent_id').references((): AnyPgColumn => departments.id, {
      onDelete: 'restrict',
    }),

    /**
     * Optional division association.
     * Null = cross-division department (accessible from any division).
     * FK → divisions(id) ON DELETE RESTRICT: division cannot be deleted while departments reference it.
     */
    division_id: uuid('division_id').references(() => divisions.id, { onDelete: 'restrict' }),

    /**
     * Maximum number of students assignable to this department.
     * Null = unlimited.
     * Positive integer only — CHECK (max_users IS NULL OR max_users > 0) enforced in migration.
     * Enforcement uses SELECT FOR UPDATE on departments row inside student assignment transaction.
     */
    max_users: integer('max_users'),

    /** Optional description. Nullable — no default. */
    description: text('description'),

    /**
     * Department lifecycle status.
     * 'ENABLED'  → department is operational and accepting assignments.
     * 'DISABLED' → department is inactive; existing assignments preserved,
     *              new assignments rejected (DEPARTMENT_DISABLED error).
     * CHECK constraint enforced at DB layer in migration.
     */
    status: varchar('status', { length: 20 }).notNull().default('ENABLED'),

    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    /**
     * Hierarchy traversal index — used by GET /:id/children and tree build.
     * Also serves the parent deletion guard (FK scan on parent_id).
     */
    parentIdIdx: index('idx_departments_parent_id').on(table.parent_id),

    /**
     * Division-scoped filter — used by list endpoint division_id filter.
     * Also serves the division deletion guard (FK scan on division_id).
     */
    divisionIdIdx: index('idx_departments_division_id').on(table.division_id),

    /** Status filter — list ENABLED/DISABLED departments. */
    statusIdx: index('idx_departments_status').on(table.status),

    /** Type filter — list MAIN/SUB/SIMPLE departments. */
    typeIdx: index('idx_departments_type').on(table.type),

    /**
     * Keyset pagination composite index (created_at, id).
     * Handled by migration:
     *   CREATE INDEX idx_departments_created_at_id ON departments (created_at ASC, id ASC)
     * Not declared via Drizzle index() to avoid conflicts with the migration-managed index.
     */
  })
)

export type Department = typeof departments.$inferSelect
export type NewDepartment = typeof departments.$inferInsert
