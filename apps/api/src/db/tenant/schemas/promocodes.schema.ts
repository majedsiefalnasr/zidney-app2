/**
 * Drizzle Schema: promocodes
 * File: apps/api/src/db/tenant/schemas/promocodes.schema.ts
 * Stage: STAGE_45_PROMOCODES
 */

import { type InferInsertModel, type InferSelectModel, sql } from 'drizzle-orm'
import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

export const promocodes = pgTable('promocodes', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: varchar('code', { length: 100 }).notNull(),
  type: varchar('type', { length: 20 }).notNull(),
  value: numeric('value', { precision: 10, scale: 2 }),
  free_trial_days: integer('free_trial_days'),
  valid_from: timestamp('valid_from', { withTimezone: true }).notNull(),
  valid_until: timestamp('valid_until', { withTimezone: true }).notNull(),
  usage_limit: integer('usage_limit'),
  per_user_limit: integer('per_user_limit').notNull().default(1),
  applies_to_plan_ids: jsonb('applies_to_plan_ids')
    .notNull()
    .default(sql`'[]'::jsonb`)
    .$type<string[]>(),
  target_division_ids: jsonb('target_division_ids').$type<string[] | null>(),
  target_group_ids: jsonb('target_group_ids').$type<string[] | null>(),
  is_stackable: boolean('is_stackable').notNull().default(false),
  is_active: boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export type Promocode = InferSelectModel<typeof promocodes>
export type NewPromocode = InferInsertModel<typeof promocodes>
