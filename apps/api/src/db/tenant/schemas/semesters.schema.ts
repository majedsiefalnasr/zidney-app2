/**
 * Drizzle ORM Schema — semesters
 *
 * File: apps/api/src/db/tenant/schemas/semesters.schema.ts
 * Stage: STAGE_27_SEMESTERS
 *
 * NOTE: The partial functional unique index `semesters_name_lower_unique_active`
 * is owned by the migration DDL. Drizzle cannot represent a partial functional index
 * in a schema file, so it is intentionally absent here. This is consistent with
 * the pattern used for divisions, teams, and other soft-delete entities.
 */

import { date, index, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'

export const semesters = pgTable(
  'semesters',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    start_date: date('start_date'),
    end_date: date('end_date'),
    status: varchar('status', { length: 20 }).notNull().default('ENABLED'),
    deleted_at: timestamp('deleted_at', { withTimezone: true }),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    statusIdx: index('idx_semesters_status').on(table.status),
    startDateIdx: index('idx_semesters_start_date').on(table.start_date),
    deletedAtIdx: index('idx_semesters_deleted_at').on(table.deleted_at),
    // semesters_name_lower_unique_active: declared in migration (partial functional index)
  })
)

export type Semester = typeof semesters.$inferSelect
export type NewSemester = typeof semesters.$inferInsert
