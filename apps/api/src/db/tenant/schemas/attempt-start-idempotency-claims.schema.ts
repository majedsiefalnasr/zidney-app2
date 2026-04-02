/**
 * Drizzle Schema — attempt_start_idempotency_claims
 *
 * File: apps/api/src/db/tenant/schemas/attempt-start-idempotency-claims.schema.ts
 * Stage: STAGE_39_AUTO_SELECTION_ENGINE
 *
 * Exactly-once semantics for attempt start operations.
 * A claim is inserted atomically before any side effects occur.
 * On replay (same idempotency_key), the existing attempt_id is returned.
 * TTL (expires_at) enables future housekeeping. Claims are tenant-scoped.
 */

import { index, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core'

export const attemptStartIdempotencyClaims = pgTable(
  'attempt_start_idempotency_claims',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspace_id: uuid('workspace_id').notNull(),
    user_id: uuid('user_id').notNull(),
    exam_id: uuid('exam_id').notNull(),
    idempotency_key: text('idempotency_key').notNull(),
    attempt_id: uuid('attempt_id'),
    payload_hash: text('payload_hash'),
    claimed_at: timestamp('claimed_at', { withTimezone: true }).notNull().defaultNow(),
    expires_at: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    unique('uq_attempt_start_idempotency_key').on(
      table.workspace_id,
      table.user_id,
      table.exam_id,
      table.idempotency_key
    ),
    index('idx_attempt_start_idempotency_claims_lookup').on(
      table.workspace_id,
      table.user_id,
      table.exam_id,
      table.idempotency_key
    ),
    index('idx_attempt_start_idempotency_claims_expiry').on(table.expires_at),
  ]
)

export type AttemptStartIdempotencyClaim = typeof attemptStartIdempotencyClaims.$inferSelect
export type NewAttemptStartIdempotencyClaim = typeof attemptStartIdempotencyClaims.$inferInsert
