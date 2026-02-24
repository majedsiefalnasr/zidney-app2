/**
 * Unit Tests: Immutability Trigger
 *
 * Validates append-only semantics for attempt-events style tables:
 * INSERT allowed, UPDATE blocked, DELETE allowed.
 *
 * Stage: STAGE_02B_TENANT_BASELINE_SCHEMA
 * Task: T031 (Unit test for immutability trigger)
 */

import { Pool } from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createLogger } from '@zidney/logger'

const logger = createLogger('ImmutabilityTriggerTest')
const ATTEMPTS_TABLE = 'test_immut_attempts'
const EVENTS_TABLE = 'test_immut_attempt_events'
const UPDATE_TRIGGER = 'prevent_test_immut_attempt_events_update'
const IMMUTABLE_FN = 'test_raise_immutable_violation'

const getTenantTestConnectionString = () => {
  if (process.env.TEST_DATABASE_URL) {
    return process.env.TEST_DATABASE_URL
  }
  if (process.env.TENANT_DATABASE_URL) {
    return process.env.TENANT_DATABASE_URL
  }
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL
  }

  const user = process.env.DB_USER || 'zidney_app'
  const password = process.env.DB_PASSWORD || 'change-me-in-production'
  const host = process.env.DB_HOST || 'localhost'
  const port = process.env.DB_PORT || '5432'
  const database = process.env.DB_DATABASE || process.env.DB_NAME || 'zidney_master'

  return `postgresql://${user}:${password}@${host}:${port}/${database}`
}

describe('Immutability Trigger Tests (T031)', () => {
  let pool: Pool
  let attemptId: string

  beforeAll(async () => {
    pool = new Pool({ connectionString: getTenantTestConnectionString() })

    await pool.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`)

    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${ATTEMPTS_TABLE} (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid()
      )
    `)

    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${EVENTS_TABLE} (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        attempt_id UUID NOT NULL REFERENCES ${ATTEMPTS_TABLE}(id) ON DELETE CASCADE,
        event_type VARCHAR(50) NOT NULL,
        event_payload JSONB,
        occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_by UUID
      )
    `)

    await pool.query(`
      CREATE OR REPLACE FUNCTION ${IMMUTABLE_FN}()
      RETURNS TRIGGER AS $$
      BEGIN
        RAISE EXCEPTION 'Immutable table: % does not allow updates', TG_TABLE_NAME
          USING ERRCODE = '23514';
        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql
    `)

    await pool.query(`DROP TRIGGER IF EXISTS ${UPDATE_TRIGGER} ON ${EVENTS_TABLE}`)
    await pool.query(`
      CREATE TRIGGER ${UPDATE_TRIGGER}
      BEFORE UPDATE ON ${EVENTS_TABLE}
      FOR EACH ROW
      EXECUTE FUNCTION ${IMMUTABLE_FN}()
    `)

    logger.info('Immutability trigger tests starting')
  })

  afterAll(async () => {
    if (pool) {
      try {
        await pool.query(`DROP TRIGGER IF EXISTS ${UPDATE_TRIGGER} ON ${EVENTS_TABLE}`)
        await pool.query(`DROP FUNCTION IF EXISTS ${IMMUTABLE_FN}()`)
        await pool.query(`DROP TABLE IF EXISTS ${EVENTS_TABLE}`)
        await pool.query(`DROP TABLE IF EXISTS ${ATTEMPTS_TABLE}`)
      } finally {
        await pool.end()
      }
    }
  })

  beforeEach(async () => {
    await pool.query(`TRUNCATE TABLE ${EVENTS_TABLE}, ${ATTEMPTS_TABLE} CASCADE`)
    const result = await pool.query(
      `INSERT INTO ${ATTEMPTS_TABLE} DEFAULT VALUES RETURNING id`
    )
    attemptId = result.rows[0].id
  })

  it('INSERT into attempt_events succeeds', async () => {
    const result = await pool.query(
      `INSERT INTO ${EVENTS_TABLE} (
        attempt_id, event_type, event_payload, occurred_at, created_at, created_by
      ) VALUES ($1, 'START', '{}', now(), now(), gen_random_uuid())
      RETURNING id`,
      [attemptId]
    )

    expect(result.rows.length).toBe(1)
    expect(result.rows[0].id).toBeDefined()
    logger.info('INSERT test passed')
  })

  it('UPDATE on attempt_events raises immutability violation', async () => {
    const insertResult = await pool.query(
      `INSERT INTO ${EVENTS_TABLE} (
        attempt_id, event_type, event_payload, occurred_at, created_at, created_by
      ) VALUES ($1, 'ANSWER_SUBMIT', '{"answer": 1}', now(), now(), gen_random_uuid())
      RETURNING id`,
      [attemptId]
    )

    const eventId = insertResult.rows[0].id

    try {
      await pool.query(
        `UPDATE ${EVENTS_TABLE} SET event_payload = '{"answer": 2}' WHERE id = $1`,
        [eventId]
      )
      expect.fail('UPDATE should have failed due to immutability trigger')
    } catch (error: unknown) {
      const pgError = error as { code?: string }
      expect(pgError.code).toBe('23514')
      logger.info('UPDATE test passed - immutability trigger enforced')
    }
  })

  it('DELETE on attempt_events is allowed', async () => {
    const result = await pool.query(
      `INSERT INTO ${EVENTS_TABLE} (
        attempt_id, event_type, event_payload, occurred_at, created_at, created_by
      ) VALUES ($1, 'PAUSE', '{}', now(), now(), gen_random_uuid())
      RETURNING id`,
      [attemptId]
    )

    const eventId = result.rows[0].id
    const deleteResult = await pool.query(
      `DELETE FROM ${EVENTS_TABLE} WHERE id = $1`,
      [eventId]
    )

    expect(deleteResult.rowCount).toBe(1)
    logger.info('DELETE test passed')
  })

  it('Multiple events can be inserted without interference', async () => {
    const insertCount = 5

    for (let i = 0; i < insertCount; i++) {
      await pool.query(
        `INSERT INTO ${EVENTS_TABLE} (
          attempt_id, event_type, event_payload, occurred_at, created_at, created_by
        ) VALUES ($1, 'ANSWER_SUBMIT', $2, now(), now(), gen_random_uuid())`,
        [attemptId, JSON.stringify({ answer: i })]
      )
    }

    const result = await pool.query(
      `SELECT COUNT(*) as count FROM ${EVENTS_TABLE} WHERE attempt_id = $1`,
      [attemptId]
    )

    expect(parseInt(result.rows[0].count, 10)).toBe(insertCount)
    logger.info('Multiple INSERT test passed')
  })
})
