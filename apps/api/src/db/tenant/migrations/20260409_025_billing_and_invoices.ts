/**
 * Migration: Billing & Invoices
 * File: apps/api/src/db/tenant/migrations/20260409_025_billing_and_invoices.ts
 * Stage: STAGE_46_BILLING_AND_INVOICES
 * Date: 2026-04-09
 *
 * Purpose:
 *   Creates the `invoices` and `billing_audit_logs` tables for the workspace
 *   billing layer. Invoices track the full subscription payment lifecycle
 *   (PENDING → PAID | FAILED | CANCELLED) and gate subscription activation.
 *   billing_audit_logs is append-only — no UPDATE or DELETE operations.
 *
 * Safety:
 *   - Uses CREATE TABLE IF NOT EXISTS and CREATE INDEX IF NOT EXISTS for idempotency.
 *   - Wrapped in explicit BEGIN/COMMIT/ROLLBACK for atomicity.
 *   - Forward-only: no DROP statements, no data backfill required.
 *   - Existing subscriptions predate invoice tracking; no FK added to subscriptions.
 *
 * Impact:
 *   - Adds `invoices` table (16 columns, 4 CHECK constraints, 5 indexes).
 *   - Adds `billing_audit_logs` table (7 columns, 1 CHECK constraint, 2 indexes).
 *
 * References: ADR-0001 (tenant isolation), ADR-0003 (forward-only migrations),
 *             ADR-0006 (server-authoritative time)
 */

import type { PoolClient } from 'pg'

export async function up(client: PoolClient): Promise<void> {
  await client.query('BEGIN')
  try {
    // -------------------------------------------------------------------------
    // invoices
    // -------------------------------------------------------------------------
    await client.query(`
      CREATE TABLE IF NOT EXISTS invoices (
        id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
        invoice_number        VARCHAR(64)   NOT NULL,
        subscriber_id         UUID          NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
        subscription_plan_id  UUID          NOT NULL REFERENCES plans(id) ON DELETE RESTRICT,
        billing_period_start  TIMESTAMPTZ   NOT NULL,
        billing_period_end    TIMESTAMPTZ   NOT NULL,
        amount                NUMERIC(12,2) NOT NULL,
        currency              VARCHAR(10)   NOT NULL DEFAULT 'SAR',
        payment_method        VARCHAR(20)   NOT NULL,
        payment_reference     VARCHAR(255),
        proof_file_id         UUID,
        status                VARCHAR(20)   NOT NULL DEFAULT 'PENDING',
        activation_date       TIMESTAMPTZ,
        idempotency_key       VARCHAR(255),
        created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

        CONSTRAINT invoices_status_check
          CHECK (status IN ('PENDING', 'PAID', 'FAILED', 'CANCELLED')),

        CONSTRAINT invoices_payment_method_check
          CHECK (payment_method IN ('GATEWAY', 'MANUAL')),

        CONSTRAINT invoices_period_check
          CHECK (billing_period_end > billing_period_start),

        CONSTRAINT invoices_amount_check
          CHECK (amount >= 0)
      )
    `)

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_number_workspace
        ON invoices(invoice_number)
    `)

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_idempotency
        ON invoices(idempotency_key)
        WHERE idempotency_key IS NOT NULL
    `)

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_invoices_subscriber
        ON invoices(subscriber_id)
    `)

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_invoices_status
        ON invoices(status)
    `)

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_invoices_created
        ON invoices(created_at DESC)
    `)

    // -------------------------------------------------------------------------
    // billing_audit_logs  (append-only)
    // -------------------------------------------------------------------------
    await client.query(`
      CREATE TABLE IF NOT EXISTS billing_audit_logs (
        id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        invoice_id  UUID        NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
        event       VARCHAR(64) NOT NULL,
        actor_id    UUID,
        actor_type  VARCHAR(20) NOT NULL DEFAULT 'SYSTEM',
        metadata    JSONB       NOT NULL DEFAULT '{}',
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        CONSTRAINT billing_audit_actor_type_check
          CHECK (actor_type IN ('SYSTEM', 'STAFF', 'GATEWAY'))
      )
    `)

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_billing_audit_invoice
        ON billing_audit_logs(invoice_id)
    `)

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_billing_audit_created
        ON billing_audit_logs(created_at DESC)
    `)

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  }
}
