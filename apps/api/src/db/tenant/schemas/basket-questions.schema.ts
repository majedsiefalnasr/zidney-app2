import { index, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core'

export const mcqBasketQuestions = pgTable(
  'mcq_basket_questions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    basket_id: uuid('basket_id').notNull(),
    question_id: uuid('question_id').notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    basketIdIdx: index('idx_mcq_basket_questions_basket_id').on(table.basket_id),
    questionIdIdx: index('idx_mcq_basket_questions_question_id').on(table.question_id),
    // FK: basket_id → mcq_baskets(id) ON DELETE CASCADE — migration-owned
    // FK: question_id → mcq_questions(id) ON DELETE CASCADE — migration-owned
    // CONCURRENT unique index (basket_id, question_id) — migration-owned
  })
)

export type BasketQuestion = typeof mcqBasketQuestions.$inferSelect
export type NewBasketQuestion = typeof mcqBasketQuestions.$inferInsert
