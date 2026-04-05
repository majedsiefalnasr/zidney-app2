/**
 * Drizzle Schema: promocode_usages
 * File: apps/api/src/db/tenant/schemas/promocode-usages.schema.ts
 * Stage: STAGE_45_PROMOCODES
 *
 * Note: FK relations defined at DB level in migration. Drizzle relations()
 * helper is not required — usage counts use raw count queries.
 */

import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'
import { numeric, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core'

export const promocodeUsages = pgTable('promocode_usages', {
  id: uuid('id').primaryKey().defaultRandom(),
  promocode_id: uuid('promocode_id').notNull(), // FK: promocodes.id
  student_id: uuid('student_id').notNull(), // FK: students.id
  subscription_id: uuid('subscription_id').notNull(), // FK: subscriptions.id
  discount_amount: numeric('discount_amount', { precision: 10, scale: 2 }).notNull(),
  redeemed_at: timestamp('redeemed_at', { withTimezone: true }).notNull().defaultNow(),
})

export type PromocodeUsage = InferSelectModel<typeof promocodeUsages>
export type NewPromocodeUsage = InferInsertModel<typeof promocodeUsages>
