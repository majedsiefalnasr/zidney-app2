import { check, index, integer, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'

export const mcqBaskets = pgTable(
  'mcq_baskets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 255 }).notNull(),
    code: varchar('code', { length: 100 }).notNull(),
    type: varchar('type', { length: 20 }).notNull(),
    max_questions: integer('max_questions'),
    description: text('description'),
    status: varchar('status', { length: 20 }).notNull().default('DRAFT'),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    status_updated_at: timestamp('status_updated_at', { withTimezone: true }),
    status_updated_by: uuid('status_updated_by'),
    created_by: uuid('created_by'),
    updated_by: uuid('updated_by'),
  },
  (table) => ({
    typeCheck: check('mcq_baskets_type_check', `${table.type.name} IN ('LINKED', 'UNLINKED')`),
    statusCheck: check(
      'mcq_baskets_status_check',
      `${table.status.name} IN ('DRAFT', 'COMPLETED', 'UNDER_REVIEW', 'APPROVED', 'ENABLED')`
    ),
    typeIdx: index('idx_mcq_baskets_type').on(table.type),
    statusIdx: index('idx_mcq_baskets_status').on(table.status),
    // FK constraints (status_updated_by, created_by, updated_by → users) are migration-owned
    // CONCURRENT unique index (code) is migration-owned
  })
)

export type Basket = typeof mcqBaskets.$inferSelect
export type NewBasket = typeof mcqBaskets.$inferInsert
