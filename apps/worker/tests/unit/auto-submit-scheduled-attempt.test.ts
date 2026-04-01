/**
 * Auto-Submit Scheduled Attempt Handler — Unit Tests
 *
 * File: apps/worker/tests/unit/auto-submit-scheduled-attempt.test.ts
 * Stage: STAGE_38_SCHEDULED_ENGINE — T035
 *
 * Tests the idempotency, lock contention, transaction flow, and forced-submission
 * reason priority for the auto-submit handler.
 *
 * All I/O is mocked — no real DB or Redis required.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Mock logger (must come before handler import)
// ---------------------------------------------------------------------------

vi.mock('@zidney/logger', () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}))

// ---------------------------------------------------------------------------
// Import handler under test (after mocks)
// ---------------------------------------------------------------------------

import type { AutoSubmitScheduledAttemptJob } from '@zidney/job-queue/types'
import { handleAutoSubmitScheduledAttempt } from '../../src/jobs/auto-submit-scheduled-attempt'

// ---------------------------------------------------------------------------
// Test utilities
// ---------------------------------------------------------------------------

function makeJob(
  overrides: Partial<AutoSubmitScheduledAttemptJob> = {}
): AutoSubmitScheduledAttemptJob {
  return {
    job_name: 'auto_submit_scheduled_attempt',
    attempt_id: '00000000-0000-0000-0000-000000000001',
    scheduled_exam_id: '00000000-0000-0000-0000-000000000010',
    forced_submission_reason: 'WINDOW_EXPIRED',
    correlation_id: 'test-corr-001',
    workspace_id: 'ws-001',
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

function makeDbClient(
  rows: unknown[] = [{ id: 'att-001', status: 'IN_PROGRESS', auto_submitted: false }]
) {
  const client = {
    query: vi.fn(),
    release: vi.fn(),
  }

  // Default: BEGIN → SELECT FOR UPDATE (rows) → UPDATE → COMMIT
  client.query
    .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // BEGIN
    .mockResolvedValueOnce({ rows, rowCount: rows.length }) // SELECT FOR UPDATE
    .mockResolvedValueOnce({ rows: [], rowCount: 1 }) // UPDATE
    .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // COMMIT

  return client
}

function makePool(client: ReturnType<typeof makeDbClient>) {
  return {
    connect: vi.fn().mockResolvedValue(client),
  }
}

function makeRedis(lockResult: string | null = 'OK') {
  return {
    set: vi.fn().mockResolvedValue(lockResult),
    del: vi.fn().mockResolvedValue(1),
  } as unknown as import('redis').RedisClientType
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('handleAutoSubmitScheduledAttempt', () => {
  afterEach(() => vi.clearAllMocks())

  describe('Lock contention', () => {
    it('returns immediately when Redis lock is not acquired (null)', async () => {
      const redis = makeRedis(null)
      const pool = { connect: vi.fn() }
      const job = makeJob()

      await handleAutoSubmitScheduledAttempt(job, pool as never, redis)

      expect(pool.connect).not.toHaveBeenCalled()
      expect(redis.del).not.toHaveBeenCalled()
    })

    it('releases lock after successful submission', async () => {
      const attempt = { id: 'att-001', status: 'IN_PROGRESS', auto_submitted: false }
      const client = makeDbClient([attempt])
      const pool = makePool(client)
      const redis = makeRedis('OK')
      const job = makeJob()

      await handleAutoSubmitScheduledAttempt(job, pool as never, redis)

      expect(redis.del).toHaveBeenCalledWith(`auto_submit_lock:${job.attempt_id}`)
    })

    it('releases lock even when transaction throws', async () => {
      const client = {
        query: vi
          .fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({
            rows: [{ id: 'att-001', status: 'IN_PROGRESS', auto_submitted: false }],
          }) // SELECT
          .mockRejectedValueOnce(new Error('DB error')), // UPDATE throws
        release: vi.fn(),
      }
      const pool = makePool(client as never)
      const redis = makeRedis('OK')
      const job = makeJob()

      await expect(handleAutoSubmitScheduledAttempt(job, pool as never, redis)).rejects.toThrow(
        'DB error'
      )

      expect(redis.del).toHaveBeenCalledWith(`auto_submit_lock:${job.attempt_id}`)
      expect(client.release).toHaveBeenCalled()
    })
  })

  describe('Idempotency', () => {
    it('skips when attempt status is already SUBMITTED', async () => {
      const attempt = { id: 'att-001', status: 'SUBMITTED', auto_submitted: true }
      const client = {
        query: vi
          .fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({ rows: [attempt] }) // SELECT FOR UPDATE
          .mockResolvedValueOnce({ rows: [] }), // ROLLBACK
        release: vi.fn(),
      }
      const pool = makePool(client as never)
      const redis = makeRedis('OK')
      const job = makeJob()

      await handleAutoSubmitScheduledAttempt(job, pool as never, redis)

      // Should have called ROLLBACK, not UPDATE
      const queryCalls = client.query.mock.calls.map((c) =>
        (c[0] as string).trim().split('\n')[0].trim()
      )
      expect(queryCalls).toContain('ROLLBACK')
      expect(queryCalls).not.toContain('UPDATE attempts')

      // Lock still released
      expect(redis.del).toHaveBeenCalledWith(`auto_submit_lock:${job.attempt_id}`)
    })

    it('skips when attempt auto_submitted is already true', async () => {
      const attempt = { id: 'att-001', status: 'IN_PROGRESS', auto_submitted: true }
      const client = {
        query: vi
          .fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({ rows: [attempt] }) // SELECT FOR UPDATE
          .mockResolvedValueOnce({ rows: [] }), // ROLLBACK
        release: vi.fn(),
      }
      const pool = makePool(client as never)
      const redis = makeRedis('OK')
      const job = makeJob()

      await handleAutoSubmitScheduledAttempt(job, pool as never, redis)

      const queryCalls = client.query.mock.calls.map((c) => (c[0] as string).trim().toUpperCase())
      expect(queryCalls.some((q) => q.startsWith('ROLLBACK'))).toBe(true)
    })

    it('skips gracefully when attempt row not found', async () => {
      const client = {
        query: vi
          .fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({ rows: [] }) // SELECT returns empty
          .mockResolvedValueOnce({ rows: [] }), // ROLLBACK
        release: vi.fn(),
      }
      const pool = makePool(client as never)
      const redis = makeRedis('OK')
      const job = makeJob({ attempt_id: 'non-existent-id' })

      await handleAutoSubmitScheduledAttempt(job, pool as never, redis)

      // No UPDATE should be called
      const queryCalls = client.query.mock.calls.map((c) => (c[0] as string).trim().toUpperCase())
      expect(queryCalls.some((q) => q.startsWith('UPDATE'))).toBe(false)
    })
  })

  describe('Successful submission', () => {
    it('calls UPDATE with correct status and reason', async () => {
      const attempt = { id: 'att-001', status: 'IN_PROGRESS', auto_submitted: false }
      const client = makeDbClient([attempt])
      const pool = makePool(client)
      const redis = makeRedis('OK')
      const job = makeJob({ forced_submission_reason: 'WINDOW_EXPIRED' })

      await handleAutoSubmitScheduledAttempt(job, pool as never, redis)

      // Find the UPDATE call
      const updateCall = client.query.mock.calls.find(
        (c) => typeof c[0] === 'string' && (c[0] as string).trim().startsWith('UPDATE')
      )
      expect(updateCall).toBeDefined()

      // Params: [attempt_id, reason]
      const params = updateCall![1] as unknown[]
      expect(params[0]).toBe(job.attempt_id)
      expect(params[1]).toBe('WINDOW_EXPIRED')
    })

    it('calls UPDATE with DURATION_EXPIRED reason when provided', async () => {
      const attempt = { id: 'att-001', status: 'IN_PROGRESS', auto_submitted: false }
      const client = makeDbClient([attempt])
      const pool = makePool(client)
      const redis = makeRedis('OK')
      const job = makeJob({ forced_submission_reason: 'DURATION_EXPIRED' })

      await handleAutoSubmitScheduledAttempt(job, pool as never, redis)

      const updateCall = client.query.mock.calls.find(
        (c) => typeof c[0] === 'string' && (c[0] as string).trim().startsWith('UPDATE')
      )
      const params = updateCall![1] as unknown[]
      expect(params[1]).toBe('DURATION_EXPIRED')
    })

    it('calls UPDATE with CONNECTION_TIMEOUT reason when provided', async () => {
      const attempt = { id: 'att-001', status: 'IN_PROGRESS', auto_submitted: false }
      const client = makeDbClient([attempt])
      const pool = makePool(client)
      const redis = makeRedis('OK')
      const job = makeJob({ forced_submission_reason: 'CONNECTION_TIMEOUT' })

      await handleAutoSubmitScheduledAttempt(job, pool as never, redis)

      const updateCall = client.query.mock.calls.find(
        (c) => typeof c[0] === 'string' && (c[0] as string).trim().startsWith('UPDATE')
      )
      const params = updateCall![1] as unknown[]
      expect(params[1]).toBe('CONNECTION_TIMEOUT')
    })

    it('uses lock key scoped to attempt_id', async () => {
      const attempt = { id: 'att-unique', status: 'IN_PROGRESS', auto_submitted: false }
      const client = makeDbClient([attempt])
      const pool = makePool(client)
      const redis = makeRedis('OK')
      const job = makeJob({ attempt_id: 'att-unique' })

      await handleAutoSubmitScheduledAttempt(job, pool as never, redis)

      expect(redis.set).toHaveBeenCalledWith(
        'auto_submit_lock:att-unique',
        '1',
        expect.objectContaining({ NX: true })
      )
    })

    it('calls BEGIN and COMMIT in order', async () => {
      const attempt = { id: 'att-001', status: 'IN_PROGRESS', auto_submitted: false }
      const client = makeDbClient([attempt])
      const pool = makePool(client)
      const redis = makeRedis('OK')
      const job = makeJob()

      await handleAutoSubmitScheduledAttempt(job, pool as never, redis)

      const sqlCalls = client.query.mock.calls.map((c) => (c[0] as string).trim().toUpperCase())
      const beginIdx = sqlCalls.indexOf('BEGIN')
      const commitIdx = sqlCalls.indexOf('COMMIT')

      expect(beginIdx).toBeGreaterThanOrEqual(0)
      expect(commitIdx).toBeGreaterThan(beginIdx)
    })

    it('releases the DB client in all scenarios (finally block)', async () => {
      const attempt = { id: 'att-001', status: 'IN_PROGRESS', auto_submitted: false }
      const client = makeDbClient([attempt])
      const pool = makePool(client)
      const redis = makeRedis('OK')

      await handleAutoSubmitScheduledAttempt(makeJob(), pool as never, redis)

      expect(client.release).toHaveBeenCalledOnce()
    })
  })

  describe('Error handling', () => {
    it('rolls back and re-throws when UPDATE fails', async () => {
      const dbError = new Error('DB connection lost')
      const client = {
        query: vi
          .fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({
            rows: [{ id: 'att-001', status: 'IN_PROGRESS', auto_submitted: false }],
          }) // SELECT
          .mockRejectedValueOnce(dbError), // UPDATE throws
        release: vi.fn(),
      }
      const pool = makePool(client as never)
      const redis = makeRedis('OK')

      await expect(
        handleAutoSubmitScheduledAttempt(makeJob(), pool as never, redis)
      ).rejects.toThrow('DB connection lost')

      expect(client.release).toHaveBeenCalled()
    })
  })
})
