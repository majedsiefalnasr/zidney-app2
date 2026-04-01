/**
 * Scheduled Exam Migrations — Unit Tests
 *
 * File: apps/api/src/db/tenant/migrations/__tests__/scheduled-exam-migrations.test.ts
 * Stage: STAGE_38_SCHEDULED_ENGINE — T036
 *
 * Validates SQL DDL emitted by migrations 016 and 017
 * using a mock PoolClient (no live DB required).
 */

import type { PoolClient, QueryResult } from 'pg'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { up as up016 } from '../20260402_016_create_scheduled_exams'
import { up as up017 } from '../20260402_017_add_scheduled_fields_to_attempts'

// ---------------------------------------------------------------------------
// Test helpers
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

function makeFailing(failAfterDataQuery: number): { client: PoolClient; calls: QueryCall[] } {
  const calls: QueryCall[] = []
  let count = 0
  const client = {
    query: vi.fn(async (text: string | { text: string }) => {
      const sql = typeof text === 'string' ? text : text.text
      calls.push({ text: sql })
      if (/^(BEGIN|COMMIT|ROLLBACK)$/i.test(sql.trim())) {
        return { rows: [], rowCount: 0 } as unknown as QueryResult
      }
      count++
      if (count >= failAfterDataQuery) throw new Error('Simulated DB failure')
      return { rows: [], rowCount: 0 } as unknown as QueryResult
    }),
  } as unknown as PoolClient
  return { client, calls }
}

// ---------------------------------------------------------------------------
// Migration 016 — scheduled_exams table
// ---------------------------------------------------------------------------

describe('Migration 016 — Create scheduled_exams', () => {
  let client: PoolClient
  let calls: QueryCall[]

  beforeEach(async () => {
    ;({ client, calls } = makeMockClient())
    await up016(client)
  })

  it('opens a transaction with BEGIN', () => {
    expect(calls.some((c) => /^BEGIN$/i.test(c.text.trim()))).toBe(true)
  })

  it('commits with COMMIT', () => {
    expect(calls.some((c) => /^COMMIT$/i.test(c.text.trim()))).toBe(true)
  })

  it('creates scheduled_exams table with IF NOT EXISTS', () => {
    const ddl = calls.find(
      (c) => c.text.includes('CREATE TABLE') && c.text.includes('scheduled_exams')
    )
    expect(ddl).toBeDefined()
    expect(ddl!.text).toContain('IF NOT EXISTS')
  })

  it('table includes required core columns', () => {
    const ddl = calls.find(
      (c) => c.text.includes('CREATE TABLE') && c.text.includes('scheduled_exams')
    )!
    expect(ddl.text).toContain('id')
    expect(ddl.text).toContain('base_exam_id')
    expect(ddl.text).toContain('workspace_id')
    expect(ddl.text).toContain('title')
    expect(ddl.text).toContain('code')
    expect(ddl.text).toContain('status')
    expect(ddl.text).toContain('window_start')
    expect(ddl.text).toContain('window_end')
    expect(ddl.text).toContain('duration_minutes')
    expect(ddl.text).toContain('late_tolerance_minutes')
    expect(ddl.text).toContain('allow_single_attempt')
    expect(ddl.text).toContain('reminder_before_start')
    expect(ddl.text).toContain('reminder_before_end')
    expect(ddl.text).toContain('base_exam_snapshot')
    expect(ddl.text).toContain('base_exam_hash')
    expect(ddl.text).toContain('base_exam_modified')
    expect(ddl.text).toContain('deleted_at')
  })

  it('table has PRIMARY KEY constraint', () => {
    const ddl = calls.find(
      (c) => c.text.includes('CREATE TABLE') && c.text.includes('scheduled_exams')
    )!
    expect(ddl.text).toContain('PRIMARY KEY')
  })

  it('table has FK to workspaces', () => {
    const ddl = calls.find(
      (c) => c.text.includes('CREATE TABLE') && c.text.includes('scheduled_exams')
    )!
    expect(ddl.text).toContain('FOREIGN KEY')
    expect(ddl.text).toContain('workspaces')
  })

  it('table has window_end > window_start CHECK constraint', () => {
    const ddl = calls.find(
      (c) => c.text.includes('CREATE TABLE') && c.text.includes('scheduled_exams')
    )!
    expect(ddl.text).toContain('window_end > window_start')
  })

  it('table has status CHECK constraint with valid values', () => {
    const ddl = calls.find(
      (c) => c.text.includes('CREATE TABLE') && c.text.includes('scheduled_exams')
    )!
    expect(ddl.text).toContain('DRAFT')
    expect(ddl.text).toContain('ENABLED')
    expect(ddl.text).toContain('ARCHIVED')
  })

  it('creates workspace_id B-tree index', () => {
    const idx = calls.find(
      (c) => c.text.includes('CREATE INDEX') && c.text.includes('idx_scheduled_exams_workspace_id')
    )
    expect(idx).toBeDefined()
    expect(idx!.text).toContain('IF NOT EXISTS')
  })

  it('creates base_exam_id B-tree index', () => {
    const idx = calls.find(
      (c) => c.text.includes('CREATE INDEX') && c.text.includes('idx_scheduled_exams_base_exam_id')
    )
    expect(idx).toBeDefined()
  })

  it('schema version is bumped', () => {
    const versionCall = calls.find(
      (c) => c.text.includes('_schema_versions') && c.text.includes('1.22.0')
    )
    expect(versionCall).toBeDefined()
  })

  it('is idempotent — IF NOT EXISTS guards on table and indexes', () => {
    // All CREATE TABLE + CREATE INDEX calls use IF NOT EXISTS
    const createCalls = calls.filter((c) => c.text.includes('CREATE'))
    const allIdempotent = createCalls.every((c) => c.text.includes('IF NOT EXISTS'))
    expect(allIdempotent).toBe(true)
  })

  it('rolls back on failure', async () => {
    const { client: badClient, calls: badCalls } = makeFailing(1)
    await expect(up016(badClient)).rejects.toThrow('Simulated DB failure')
    expect(badCalls.some((c) => /^ROLLBACK$/i.test(c.text.trim()))).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Migration 017 — Add scheduled fields to attempts
// ---------------------------------------------------------------------------

describe('Migration 017 — Add scheduled fields to attempts', () => {
  let client: PoolClient
  let calls: QueryCall[]

  beforeEach(async () => {
    ;({ client, calls } = makeMockClient())
    await up017(client)
  })

  it('opens a transaction with BEGIN', () => {
    expect(calls.some((c) => /^BEGIN$/i.test(c.text.trim()))).toBe(true)
  })

  it('commits with COMMIT', () => {
    expect(calls.some((c) => /^COMMIT$/i.test(c.text.trim()))).toBe(true)
  })

  it('adds is_scheduled column with IF NOT EXISTS', () => {
    const col = calls.find((c) => c.text.includes('ADD COLUMN') && c.text.includes('is_scheduled'))
    expect(col).toBeDefined()
    expect(col!.text).toContain('IF NOT EXISTS')
    expect(col!.text).toContain('BOOLEAN')
  })

  it('adds scheduled_exam_id column', () => {
    const col = calls.find(
      (c) => c.text.includes('ADD COLUMN') && c.text.includes('scheduled_exam_id')
    )
    expect(col).toBeDefined()
    expect(col!.text).toContain('UUID')
  })

  it('adds scheduled_end_time column', () => {
    const col = calls.find(
      (c) => c.text.includes('ADD COLUMN') && c.text.includes('scheduled_end_time')
    )
    expect(col).toBeDefined()
    expect(col!.text).toContain('TIMESTAMPTZ')
  })

  it('adds auto_submitted column', () => {
    const col = calls.find(
      (c) => c.text.includes('ADD COLUMN') && c.text.includes('auto_submitted')
    )
    expect(col).toBeDefined()
    expect(col!.text).toContain('BOOLEAN')
  })

  it('adds forced_submission_reason column', () => {
    const col = calls.find(
      (c) => c.text.includes('ADD COLUMN') && c.text.includes('forced_submission_reason')
    )
    expect(col).toBeDefined()
    expect(col!.text).toContain('VARCHAR')
  })

  it('adds last_heartbeat_at column', () => {
    const col = calls.find(
      (c) => c.text.includes('ADD COLUMN') && c.text.includes('last_heartbeat_at')
    )
    expect(col).toBeDefined()
    expect(col!.text).toContain('TIMESTAMPTZ')
  })

  it('adds partial index for scheduled_exam_id', () => {
    const idx = calls.find(
      (c) => c.text.includes('CREATE INDEX') && c.text.includes('idx_attempts_scheduled_exam_id')
    )
    expect(idx).toBeDefined()
    expect(idx!.text).toContain('IF NOT EXISTS')
  })

  it('adds partial index for active scheduled attempts', () => {
    const idx = calls.find(
      (c) => c.text.includes('CREATE INDEX') && c.text.includes('idx_attempts_scheduled_active')
    )
    expect(idx).toBeDefined()
    expect(idx!.text).toContain('WHERE')
    expect(idx!.text).toContain('is_scheduled')
    expect(idx!.text).toContain('IN_PROGRESS')
  })

  it('adds exactly 6 ALTER TABLE ADD COLUMN statements', () => {
    const addCols = calls.filter(
      (c) => c.text.includes('ALTER TABLE') && c.text.includes('ADD COLUMN')
    )
    expect(addCols.length).toBe(6)
  })

  it('schema version is bumped to 1.23.0', () => {
    const versionCall = calls.find(
      (c) => c.text.includes('_schema_versions') && c.text.includes('1.23.0')
    )
    expect(versionCall).toBeDefined()
  })

  it('is idempotent — all ADD COLUMN use IF NOT EXISTS', () => {
    const addCols = calls.filter(
      (c) => c.text.includes('ALTER TABLE') && c.text.includes('ADD COLUMN')
    )
    expect(addCols.every((c) => c.text.includes('IF NOT EXISTS'))).toBe(true)
  })

  it('adds forced_submission_reason with CHECK constraint', () => {
    const reasonCol = calls.find(
      (c) => c.text.includes('ADD COLUMN') && c.text.includes('forced_submission_reason')
    )
    expect(reasonCol).toBeDefined()
    expect(reasonCol!.text).toContain('CONSTRAINT')
    expect(reasonCol!.text).toContain('attempts_forced_submission_reason_check')
    expect(reasonCol!.text).toContain('ATTEMPT_TIME_EXCEEDED')
    expect(reasonCol!.text).toContain('SCHEDULED_END_REACHED')
    expect(reasonCol!.text).toContain('CONNECTION_TIMEOUT')
  })

  it('rolls back on failure', async () => {
    const { client: badClient, calls: badCalls } = makeFailing(1)
    await expect(up017(badClient)).rejects.toThrow('Simulated DB failure')
    expect(badCalls.some((c) => /^ROLLBACK$/i.test(c.text.trim()))).toBe(true)
  })
})
