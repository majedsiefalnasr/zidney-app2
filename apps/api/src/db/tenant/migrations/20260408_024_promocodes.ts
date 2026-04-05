/**
 * Migration: Promocodes
 * File: apps/api/src/db/tenant/migrations/20260408_024_promocodes.ts
 * Stage: STAGE_45_PROMOCODES
 * Date: 2026-04-08
 *
 * Purpose:
 *   Creates the `promocodes` and `promocode_usages` tables for the commercial
 *   discount layer. Promocodes are per-workspace, case-insensitive, and support
 *   PERCENTAGE, FIXED, and FREE_TRIAL discount types.
 *
 * Safety:
 *   - Uses CREATE TABLE IF NOT EXISTS and CREATE INDEX IF NOT EXISTS for idempotency.
 *   - Wrapped in explicit BEGIN/COMMIT/ROLLBACK for atomicity.
 *   - Forward-only: no DROP statements, no data backfill required.
 *   - FK references use ON DELETE RESTRICT to preserve usage history.
 *
 * Impact:
 *   - Adds `promocodes` table (20 columns, 8 CHECK constraints, 2 indexes).
 *   - Adds `promocode_usages` table (6 columns, 1 CHECK constraint, 3 indexes).
 *
 * References: ADR-0001 (tenant isolation), ADR-0003 (forward-only migrations),
 *             ADR-0006 (server-authoritative time)
 */

import type { PoolClient } from 'pg'

export async function up(client: PoolClient): Promise<void> {
  await client.query('BEGIN')
  try {
    // -------------------------------------------------------------------------
    // promocodes
    // -------------------------------------------------------------------------
    await client.query(`
      CREATE TABLE IF NOT EXISTS promocodes (
        id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
        code                VARCHAR(100)  NOT NULL,
        type                VARCHAR(20)   NOT NULL,
        value               NUMERIC(10,2),
        free_trial_days     INTEGER,
        valid_from          TIMESTAMPTZ   NOT NULL,
        valid_until         TIMESTAMPTZ   NOT NULL,
        usage_limit         INTEGER,
        per_user_limit      INTEGER       NOT NULL DEFAULT 1,
        applies_to_plan_ids JSONB         NOT NULL DEFAULT '[]'::jsonb,
        target_division_ids JSONB,
        target_group_ids    JSONB,
        is_stackable        BOOLEAN       NOT NULL DEFAULT FALSE,
        is_active           BOOLEAN       NOT NULL DEFAULT TRUE,
        created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

        CONSTRAINT promocodes_type_check
          CHECK (type IN ('PERCENTAGE', 'FIXED', 'FREE_TRIAL')),

        CONSTRAINT promocodes_value_required_for_percentage_fixed
          CHECK (
            (type IN ('PERCENTAGE', 'FIXED') AND value IS NOT NULL) OR
            (type = 'FREE_TRIAL' AND value IS NULL)
          ),

        CONSTRAINT promocodes_free_trial_days_required
          CHECK (
            (type = 'FREE_TRIAL' AND free_trial_days IS NOT NULL AND free_trial_days > 0) OR
            (type != 'FREE_TRIAL' AND free_trial_days IS NULL)
          ),

        CONSTRAINT promocodes_value_positive
          CHECK (value IS NULL OR value > 0),

        CONSTRAINT promocodes_percentage_max_100
          CHECK (type != 'PERCENTAGE' OR value <= 100),

        CONSTRAINT promocodes_valid_window
          CHECK (valid_until > valid_from),

        CONSTRAINT promocodes_per_user_limit_min
          CHECK (per_user_limit >= 1),

        CONSTRAINT promocodes_usage_limit_positive
          CHECK (usage_limit IS NULL OR usage_limit >= 1)
      )
    `)

    // Case-insensitive unique code per tenant DB
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_promocodes_code_lower
        ON promocodes (LOWER(code))
    `)

    // Fast lookup for active codes within validity window
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_promocodes_active
        ON promocodes (is_active, valid_from, valid_until)
        WHERE is_active = TRUE
    `)

    // -------------------------------------------------------------------------
    // promocode_usages
    // -------------------------------------------------------------------------
    await client.query(`
      CREATE TABLE IF NOT EXISTS promocode_usages (
        id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
        promocode_id    UUID          NOT NULL REFERENCES promocodes(id) ON DELETE RESTRICT,
        student_id      UUID          NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
        subscription_id UUID          NOT NULL REFERENCES subscriptions(id) ON DELETE RESTRICT,
        discount_amount NUMERIC(10,2) NOT NULL,
        redeemed_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

        CONSTRAINT promocode_usages_discount_non_negative
          CHECK (discount_amount >= 0)
      )
    `)

    // Deduplication: one usage per (promocode, subscription) pair
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_promocode_usages_subscription
        ON promocode_usages (promocode_id, subscription_id)
    `)

    // Usage count for global limit enforcement
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_promocode_usages_promocode
        ON promocode_usages (promocode_id)
    `)

    // Usage count for per-user limit enforcement
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_promocode_usages_student_promocode
        ON promocode_usages (student_id, promocode_id)
    `)

    // -------------------------------------------------------------------------
    // subscriptions.price_paid — final price after promocode discount
    // -------------------------------------------------------------------------
    await client.query(`
      ALTER TABLE subscriptions
        ADD COLUMN IF NOT EXISTS price_paid NUMERIC(10,2)
    `)

    // -------------------------------------------------------------------------
    // schema_version bump
    // -------------------------------------------------------------------------
    await client.query(`
      UPDATE schema_versions SET version = 24, updated_at = NOW()
        WHERE id = 1
    `)

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  }
}

export async function down(_client: PoolClient): Promise<void> {
  // Forward-only migration — no down path (ADR-0003)
}
