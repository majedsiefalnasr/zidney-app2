/**
 * Migration 018 — Auto-Selection Engine — Validation Tests
 *
 * File: apps/api/src/db/tenant/migrations/__tests__/018_auto_selection_engine.migration.test.ts
 * Stage: STAGE_39_AUTO_SELECTION_ENGINE
 *
 * Validates that up() emits correct SQL DDL:
 * - 3 new columns on attempts
 * - attempt_questions table + unique constraint + 2 indexes
 * - attempt_start_idempotency_claims table + unique constraint + 2 indexes
 * - 3 new columns on mcq_exam_auto_criteria
 * - Old check constraint dropped, new quota check added
 * - Schema version bumped to 1.24.0
 * - Transaction lifecycle (BEGIN / COMMIT)
 * - ROLLBACK on error
 *
 * No live database required — deterministic in CI.
 */

import type { PoolClient, QueryResult } from 'pg'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { up } from '../20260403_018_auto_selection_engine'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type QueryCall = { text: string }

function makeMockClient(): { client: PoolClient; calls: QueryCall[] } {
  const calls: QueryCall[] = []
  const client = {
    query: vi.fn(async (text: string | { text: string }) => {
      const sql = typeof text === 'string' ? text : text.text
      calls.push({ text: sql })
      return { rows: [], rowCount: 0 } as unknown as QueryResult
    }),
  } as unknown as PoolClient
  return { client, calls }
}

function makeFailingClient(failAfterNthDataQuery: number): {
  client: PoolClient
  calls: QueryCall[]
} {
  const calls: QueryCall[] = []
  let dataQueryCount = 0
  const client = {
    query: vi.fn(async (text: string | { text: string }) => {
      const sql = typeof text === 'string' ? text : text.text
      calls.push({ text: sql })
      if (/^(BEGIN|COMMIT|ROLLBACK)$/.test(sql.trim())) {
        return { rows: [], rowCount: 0 } as unknown as QueryResult
      }
      dataQueryCount++
      if (dataQueryCount >= failAfterNthDataQuery) {
        throw new Error('Simulated DB failure')
      }
      return { rows: [], rowCount: 0 } as unknown as QueryResult
    }),
  } as unknown as PoolClient
  return { client, calls }
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('018_auto_selection_engine migration — up()', () => {
  let client: PoolClient
  let calls: QueryCall[]

  beforeEach(async () => {
    ;({ client, calls } = makeMockClient())
    await up(client)
  })

  // ── Transaction lifecycle ─────────────────────────────────────────────────

  it('opens a transaction with BEGIN', () => {
    expect(calls.some((c) => c.text.trim() === 'BEGIN')).toBe(true)
  })

  it('commits the transaction with COMMIT', () => {
    expect(calls.some((c) => c.text.trim() === 'COMMIT')).toBe(true)
  })

  // ── Attempts columns ──────────────────────────────────────────────────────

  it('adds selection_seed column to attempts', () => {
    const ddl = calls.find(
      (c) => c.text.includes('ALTER TABLE attempts') && c.text.includes('selection_seed')
    )
    expect(ddl).toBeDefined()
    expect(ddl!.text).toContain('selection_seed TEXT')
  })

  it('adds candidate_pool_fingerprint column to attempts', () => {
    const ddl = calls.find(
      (c) =>
        c.text.includes('ALTER TABLE attempts') && c.text.includes('candidate_pool_fingerprint')
    )
    expect(ddl).toBeDefined()
    expect(ddl!.text).toContain('candidate_pool_fingerprint TEXT')
  })

  it('adds selection_diagnostics jsonb column to attempts', () => {
    const ddl = calls.find(
      (c) => c.text.includes('ALTER TABLE attempts') && c.text.includes('selection_diagnostics')
    )
    expect(ddl).toBeDefined()
    expect(ddl!.text).toContain('selection_diagnostics JSONB')
  })

  // ── attempt_questions table ───────────────────────────────────────────────

  it('creates attempt_questions table', () => {
    const ddl = calls.find(
      (c) => c.text.includes('CREATE TABLE') && c.text.includes('attempt_questions')
    )
    expect(ddl).toBeDefined()
    const sql = ddl!.text
    expect(sql).toContain('attempt_id')
    expect(sql).toContain('question_id')
    expect(sql).toContain('question_order')
    expect(sql).toContain('workspace_id')
  })

  it('adds unique constraint on (attempt_id, question_id) in attempt_questions', () => {
    const ddl = calls.find((c) => c.text.includes('attempt_questions') && c.text.includes('UNIQUE'))
    expect(ddl).toBeDefined()
    expect(ddl!.text).toContain('attempt_id')
    expect(ddl!.text).toContain('question_id')
  })

  it('creates idx_attempt_questions_attempt_id index', () => {
    const ddl = calls.find((c) => c.text.includes('idx_attempt_questions_attempt_id'))
    expect(ddl).toBeDefined()
  })

  it('creates idx_attempt_questions_workspace_attempt index', () => {
    const ddl = calls.find((c) => c.text.includes('idx_attempt_questions_workspace_attempt'))
    expect(ddl).toBeDefined()
  })

  // ── attempt_start_idempotency_claims table ────────────────────────────────

  it('creates attempt_start_idempotency_claims table', () => {
    const ddl = calls.find(
      (c) => c.text.includes('CREATE TABLE') && c.text.includes('attempt_start_idempotency_claims')
    )
    expect(ddl).toBeDefined()
    const sql = ddl!.text
    expect(sql).toContain('workspace_id')
    expect(sql).toContain('user_id')
    expect(sql).toContain('exam_id')
    expect(sql).toContain('idempotency_key')
    expect(sql).toContain('attempt_id')
    expect(sql).toContain('expires_at')
  })

  it('adds unique constraint on (workspace_id, user_id, exam_id, idempotency_key)', () => {
    const ddl = calls.find(
      (c) =>
        c.text.includes('attempt_start_idempotency_claims') &&
        c.text.includes('UNIQUE') &&
        c.text.includes('idempotency_key')
    )
    expect(ddl).toBeDefined()
    expect(ddl!.text).toContain('workspace_id')
    expect(ddl!.text).toContain('user_id')
    expect(ddl!.text).toContain('exam_id')
  })

  it('creates idx_attempt_start_idempotency_claims_lookup index', () => {
    const ddl = calls.find((c) => c.text.includes('idx_attempt_start_idempotency_claims_lookup'))
    expect(ddl).toBeDefined()
  })

  it('creates idx_attempt_start_idempotency_claims_expiry index', () => {
    const ddl = calls.find((c) => c.text.includes('idx_attempt_start_idempotency_claims_expiry'))
    expect(ddl).toBeDefined()
  })

  // ── mcq_exam_auto_criteria columns ────────────────────────────────────────

  it('adds fixed_count column to mcq_exam_auto_criteria', () => {
    const ddl = calls.find(
      (c) => c.text.includes('ALTER TABLE mcq_exam_auto_criteria') && c.text.includes('fixed_count')
    )
    expect(ddl).toBeDefined()
    expect(ddl!.text).toContain('INTEGER')
  })

  it('adds category_ids column to mcq_exam_auto_criteria', () => {
    const ddl = calls.find(
      (c) =>
        c.text.includes('ALTER TABLE mcq_exam_auto_criteria') && c.text.includes('category_ids')
    )
    expect(ddl).toBeDefined()
  })

  it('adds semester_id column to mcq_exam_auto_criteria', () => {
    const ddl = calls.find(
      (c) => c.text.includes('ALTER TABLE mcq_exam_auto_criteria') && c.text.includes('semester_id')
    )
    expect(ddl).toBeDefined()
  })

  // ── Constraint update on mcq_exam_auto_criteria ───────────────────────────

  it('drops old percentage check constraint', () => {
    const ddl = calls.find(
      (c) =>
        c.text.includes('DROP CONSTRAINT') &&
        c.text.includes('mcq_exam_auto_criteria_percentage_check')
    )
    expect(ddl).toBeDefined()
  })

  it('adds new quota check constraint allowing percentage OR fixed_count', () => {
    const ddl = calls.find(
      (c) =>
        c.text.includes('ADD CONSTRAINT') && c.text.includes('mcq_exam_auto_criteria_quota_check')
    )
    expect(ddl).toBeDefined()
    const sql = ddl!.text
    expect(sql).toContain('percentage')
    expect(sql).toContain('fixed_count')
  })

  // ── Schema version ────────────────────────────────────────────────────────

  it('bumps schema version to 1.24.0', () => {
    const ddl = calls.find(
      (c) => c.text.includes('UPDATE _schema_versions') && c.text.includes('1.24.0')
    )
    expect(ddl).toBeDefined()
    expect(ddl!.text).toContain("version = '1.24.0'")
    expect(ddl!.text).toContain("WHERE version = '1.23.0'")
  })

  // ── Rollback on error ─────────────────────────────────────────────────────

  it('rolls back on first data query failure', async () => {
    const { client: failClient, calls: failCalls } = makeFailingClient(1)
    await expect(up(failClient)).rejects.toThrow('Simulated DB failure')
    expect(failCalls.some((c) => c.text.trim() === 'ROLLBACK')).toBe(true)
    expect(failCalls.some((c) => c.text.trim() === 'COMMIT')).toBe(false)
  })
})
