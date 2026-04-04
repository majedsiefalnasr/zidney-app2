/**
 * Migration: Plans and Subscriptions
 * File: apps/api/src/db/tenant/migrations/20260407_023_plans_and_subscriptions.ts
 * Stage: STAGE_44_PLANS_AND_SUBSCRIPTIONS
 * Date: 2026-04-07
 *
 * Purpose:
 *   Creates the `plans` and `subscriptions` tables for the commercial layer.
 *   Plans define billable product offerings per workspace.
 *   Subscriptions bind a student to a plan for a fixed duration.
 *
 * Safety:
 *   - Uses CREATE TABLE IF NOT EXISTS and CREATE INDEX IF NOT EXISTS for idempotency.
 *   - Wrapped in explicit BEGIN/COMMIT/ROLLBACK for atomicity.
 *   - Forward-only: no DROP statements, no data backfill required.
 *   - FK references use ON DELETE RESTRICT to prevent orphaned records.
 *
 * Impact:
 *   - Adds `plans` table (12 columns, 3 CHECK constraints, 1 index).
 *   - Adds `subscriptions` table (14 columns, 3 CHECK constraints, 4 indexes).
 *   - Unique partial index prevents more than one ACTIVE subscription per student.
 *
 * References: ADR-0003 (Database-per-tenant isolation)
 */

import type { PoolClient } from 'pg'

export async function up(client: PoolClient): Promise<void> {
  await client.query('BEGIN')
  try {
    // -------------------------------------------------------------------------
    // plans
    // -------------------------------------------------------------------------
    await client.query(`
      CREATE TABLE IF NOT EXISTS plans (
        id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id     VARCHAR(255) NOT NULL,
        name             VARCHAR(255) NOT NULL,
        description      TEXT,
        price            NUMERIC(10,2) NOT NULL DEFAULT 0.00,
        billing_type     VARCHAR(20)  NOT NULL DEFAULT 'one-time',
        duration_days    INTEGER      NOT NULL,
        enabled_modules  JSONB        NOT NULL DEFAULT '[]',
        is_active        BOOLEAN      NOT NULL DEFAULT TRUE,
        is_deleted       BOOLEAN      NOT NULL DEFAULT FALSE,
        created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `)

    await client.query(`
      ALTER TABLE plans
        ADD CONSTRAINT IF NOT EXISTS chk_plans_billing_type
          CHECK (billing_type IN ('one-time', 'recurring'))
    `)

    await client.query(`
      ALTER TABLE plans
        ADD CONSTRAINT IF NOT EXISTS chk_plans_duration_days
          CHECK (duration_days > 0)
    `)

    await client.query(`
      ALTER TABLE plans
        ADD CONSTRAINT IF NOT EXISTS chk_plans_price
          CHECK (price >= 0)
    `)

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_plans_workspace
        ON plans(workspace_id)
        WHERE is_deleted = FALSE
    `)

    // -------------------------------------------------------------------------
    // subscriptions
    // -------------------------------------------------------------------------
    await client.query(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        student_id      UUID        NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
        plan_id         UUID        NOT NULL REFERENCES plans(id) ON DELETE RESTRICT,
        status          VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        started_at      TIMESTAMPTZ NOT NULL,
        expires_at      TIMESTAMPTZ NOT NULL,
        auto_renew      BOOLEAN     NOT NULL DEFAULT FALSE,
        payment_method  VARCHAR(20) NOT NULL DEFAULT 'MANUAL',
        gateway_ref     VARCHAR(255),
        notes           TEXT,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)

    await client.query(`
      ALTER TABLE subscriptions
        ADD CONSTRAINT IF NOT EXISTS chk_subscriptions_status
          CHECK (status IN ('ACTIVE', 'EXPIRED', 'CANCELED', 'PENDING'))
    `)

    await client.query(`
      ALTER TABLE subscriptions
        ADD CONSTRAINT IF NOT EXISTS chk_subscriptions_payment_method
          CHECK (payment_method IN ('MANUAL', 'GATEWAY'))
    `)

    await client.query(`
      ALTER TABLE subscriptions
        ADD CONSTRAINT IF NOT EXISTS chk_subscriptions_expires_after_start
          CHECK (expires_at > started_at)
    `)

    // Unique partial index: at most one ACTIVE subscription per student
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_active_per_student
        ON subscriptions(student_id)
        WHERE status = 'ACTIVE'
    `)

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_subscriptions_student
        ON subscriptions(student_id)
    `)

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_subscriptions_plan
        ON subscriptions(plan_id)
    `)

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_subscriptions_expires
        ON subscriptions(expires_at)
        WHERE status = 'ACTIVE'
    `)

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  }
}
