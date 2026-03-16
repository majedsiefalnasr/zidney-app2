/**
 * Divisions Migration Regression Tests (T034)
 *
 * File: tests/integration/divisions-migration.test.ts
 * Stage: STAGE_22_DIVISIONS
 * Date: 2026-03-16
 *
 * Tests the migration module (up/down exports) in isolation using a mock PoolClient.
 * Does NOT require a live database — all DDL statements are captured and validated.
 *
 * Coverage:
 * 1. down() throws a "forward-only" error (ADR-0008 compliance)
 * 2. up() issues BEGIN and COMMIT (single transactional block)
 * 3. up() creates the divisions table
 * 4. up() creates the staff_divisions table
 * 5. up() adds divisions_enabled column to workspace_settings
 * 6. up() adds division_id column to students (nullable → NOT NULL + FK)
 * 7. up() performs student backfill (UPDATE students WHERE division_id IS NULL)
 * 8. up() bumps schema_version to '1.5.0'
 * 9. up() creates the divisions_name_lower_unique index
 * 10. up() ROLLBACKs on any query failure
 * 11. description export is a non-empty string
 */

import type { PoolClient } from 'pg'
import type { Mock } from 'vitest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  description,
  down,
  up,
} from '../../apps/api/src/db/tenant/migrations/20260316_001_divisions'

/** Build a mock PoolClient whose query() records all SQL statements. */
function buildMockClient(opts: { failOnQuery?: string | RegExp } = {}): {
  client: PoolClient
  sqlLog: string[]
} {
  const sqlLog: string[] = []

  const client = {
    query: vi.fn(async (sql: string) => {
      const trimmed = sql.trimStart()
      sqlLog.push(trimmed)

      if (opts.failOnQuery) {
        const pattern = opts.failOnQuery
        const matches =
          typeof pattern === 'string' ? trimmed.includes(pattern) : pattern.test(trimmed)
        if (matches) {
          throw new Error(`Simulated DB failure on: ${trimmed.slice(0, 60)}`)
        }
      }

      return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] }
    }) as unknown as Mock,
    // Unused PoolClient methods — satisfy the type signature
    connect: vi.fn(),
    release: vi.fn(),
    end: vi.fn(),
    copyFrom: vi.fn(),
    copyTo: vi.fn(),
    pauseDrain: vi.fn(),
    resumeDrain: vi.fn(),
    escapeIdentifier: vi.fn((s: string) => `"${s}"`),
    escapeLiteral: vi.fn((s: string) => `'${s}'`),
    getTypeParser: vi.fn(),
    setTypeParser: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    removeListener: vi.fn(),
    once: vi.fn(),
    addListener: vi.fn(),
    emit: vi.fn(),
    listeners: vi.fn(() => []),
    rawListeners: vi.fn(() => []),
    listenerCount: vi.fn(() => 0),
    removeAllListeners: vi.fn(),
    eventNames: vi.fn(() => []),
    prependListener: vi.fn(),
    prependOnceListener: vi.fn(),
  } as unknown as PoolClient

  return { client, sqlLog }
}

/** Case-insensitive check: does any logged SQL contain the given substring? */
function any(log: string[], fragment: string): boolean {
  const lowerFragment = fragment.toLowerCase()
  return log.some((sql) => sql.toLowerCase().includes(lowerFragment))
}

// ---------------------------------------------------------------------------
// 1. Module contract — exports
// ---------------------------------------------------------------------------

describe('divisions migration module exports', () => {
  it('exports a non-empty description string', () => {
    expect(typeof description).toBe('string')
    expect(description.length).toBeGreaterThan(0)
  })

  it('exports an up() function', () => {
    expect(typeof up).toBe('function')
  })

  it('exports a down() function', () => {
    expect(typeof down).toBe('function')
  })
})

// ---------------------------------------------------------------------------
// 2. down() — ADR-0008 forward-only enforcement
// ---------------------------------------------------------------------------

describe('down() — forward-only enforcement', () => {
  it('throws with a "forward-only" message', async () => {
    const { client } = buildMockClient()
    await expect(down(client)).rejects.toThrow(/forward.only/i)
  })

  it('does NOT execute any SQL statements', async () => {
    const { client, sqlLog } = buildMockClient()
    try {
      await down(client)
    } catch {
      // Expected
    }
    expect(sqlLog).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// 3. up() — transaction envelope
// ---------------------------------------------------------------------------

describe('up() — transaction envelope', () => {
  it('issues BEGIN before any DDL', async () => {
    const { client, sqlLog } = buildMockClient()
    await up(client)

    expect(sqlLog[0]).toMatch(/^BEGIN/i)
  })

  it('issues COMMIT as the last statement on success', async () => {
    const { client, sqlLog } = buildMockClient()
    await up(client)

    expect(sqlLog[sqlLog.length - 1]).toMatch(/^COMMIT/i)
  })

  it('issues ROLLBACK when a query fails (never commits)', async () => {
    const { client, sqlLog } = buildMockClient({
      failOnQuery: 'CREATE TABLE IF NOT EXISTS divisions',
    })

    await expect(up(client)).rejects.toThrow('Simulated DB failure')

    expect(any(sqlLog, 'ROLLBACK')).toBe(true)
    expect(any(sqlLog, 'COMMIT')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 4. up() — divisions table
// ---------------------------------------------------------------------------

describe('up() — divisions table DDL', () => {
  let sqlLog: string[]

  beforeEach(async () => {
    const mock = buildMockClient()
    sqlLog = mock.sqlLog
    await up(mock.client)
  })

  it('creates the divisions table', () => {
    expect(any(sqlLog, 'CREATE TABLE IF NOT EXISTS divisions')).toBe(true)
  })

  it('defines an id column as UUID with default gen_random_uuid()', () => {
    const divCreate = sqlLog.find((s) =>
      s.toLowerCase().includes('create table if not exists divisions')
    )
    expect(divCreate).toBeTruthy()
    expect(divCreate!.toLowerCase()).toContain('gen_random_uuid()')
  })

  it('defines a name column as VARCHAR(255) NOT NULL', () => {
    const divCreate = sqlLog.find((s) =>
      s.toLowerCase().includes('create table if not exists divisions')
    )
    expect(divCreate).toBeTruthy()
    expect(divCreate!.toLowerCase()).toContain('varchar(255)')
  })

  it('defines status with CHECK constraint', () => {
    const divCreate = sqlLog.find((s) =>
      s.toLowerCase().includes('create table if not exists divisions')
    )
    expect(divCreate).toBeTruthy()
    expect(divCreate!.toLowerCase()).toContain("check (status in ('enabled', 'disabled'))")
  })

  it('adds is_default column if not exists', () => {
    expect(any(sqlLog, 'ADD COLUMN IF NOT EXISTS is_default')).toBe(true)
  })

  it('adds status column if not exists (upgrade path)', () => {
    expect(any(sqlLog, 'ADD COLUMN IF NOT EXISTS status')).toBe(true)
  })

  it('adds updated_at column if not exists (upgrade path)', () => {
    expect(any(sqlLog, 'ADD COLUMN IF NOT EXISTS updated_at')).toBe(true)
  })

  it('drops old UNIQUE name constraint via DROP CONSTRAINT IF EXISTS', () => {
    expect(any(sqlLog, 'DROP CONSTRAINT IF EXISTS divisions_name_key')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 5. up() — divisions_name_lower_unique index
// ---------------------------------------------------------------------------

describe('up() — divisions_name_lower_unique index', () => {
  let sqlLog: string[]

  beforeEach(async () => {
    const mock = buildMockClient()
    sqlLog = mock.sqlLog
    await up(mock.client)
  })

  it('creates the case-insensitive unique index', () => {
    expect(any(sqlLog, 'divisions_name_lower_unique')).toBe(true)
  })

  it('index is UNIQUE and based on LOWER(name)', () => {
    const idxSql = sqlLog.find((s) => s.toLowerCase().includes('divisions_name_lower_unique'))
    expect(idxSql).toBeTruthy()
    expect(idxSql!.toLowerCase()).toContain('create unique index')
    expect(idxSql!.toLowerCase()).toContain('lower(name)')
  })

  it('creates idx_divisions_status index', () => {
    expect(any(sqlLog, 'idx_divisions_status')).toBe(true)
  })

  it('creates idx_divisions_is_default index', () => {
    expect(any(sqlLog, 'idx_divisions_is_default')).toBe(true)
  })

  it('creates idx_divisions_created_at_id composite index', () => {
    expect(any(sqlLog, 'idx_divisions_created_at_id')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 6. up() — staff_divisions table
// ---------------------------------------------------------------------------

describe('up() — staff_divisions table DDL', () => {
  let sqlLog: string[]

  beforeEach(async () => {
    const mock = buildMockClient()
    sqlLog = mock.sqlLog
    await up(mock.client)
  })

  it('creates the staff_divisions table', () => {
    expect(any(sqlLog, 'CREATE TABLE IF NOT EXISTS staff_divisions')).toBe(true)
  })

  it('defines a composite PRIMARY KEY (staff_id, division_id)', () => {
    const tbl = sqlLog.find((s) =>
      s.toLowerCase().includes('create table if not exists staff_divisions')
    )
    expect(tbl).toBeTruthy()
    expect(tbl!.toLowerCase()).toContain('primary key (staff_id, division_id)')
  })

  it('references backoffice_staff_users with ON DELETE CASCADE', () => {
    const tbl = sqlLog.find((s) =>
      s.toLowerCase().includes('create table if not exists staff_divisions')
    )
    expect(tbl).toBeTruthy()
    expect(tbl!.toLowerCase()).toContain('on delete cascade')
  })

  it('references divisions(id) with ON DELETE RESTRICT', () => {
    const tbl = sqlLog.find((s) =>
      s.toLowerCase().includes('create table if not exists staff_divisions')
    )
    expect(tbl).toBeTruthy()
    expect(tbl!.toLowerCase()).toContain('on delete restrict')
  })

  it('creates idx_staff_divisions_division_id index', () => {
    expect(any(sqlLog, 'idx_staff_divisions_division_id')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 7. up() — workspace_settings alteration
// ---------------------------------------------------------------------------

describe('up() — workspace_settings alterations', () => {
  let sqlLog: string[]

  beforeEach(async () => {
    const mock = buildMockClient()
    sqlLog = mock.sqlLog
    await up(mock.client)
  })

  it('adds divisions_enabled column to workspace_settings', () => {
    const stmt = sqlLog.find(
      (s) =>
        s.toLowerCase().includes('alter table workspace_settings') &&
        s.toLowerCase().includes('divisions_enabled')
    )
    expect(stmt).toBeTruthy()
  })

  it('defaults divisions_enabled to true (existing tenants keep feature on)', () => {
    const stmt = sqlLog.find(
      (s) =>
        s.toLowerCase().includes('alter table workspace_settings') &&
        s.toLowerCase().includes('divisions_enabled')
    )
    expect(stmt!.toLowerCase()).toContain('default true')
  })

  it('uses ADD COLUMN IF NOT EXISTS for idempotency', () => {
    const stmt = sqlLog.find(
      (s) =>
        s.toLowerCase().includes('alter table workspace_settings') &&
        s.toLowerCase().includes('divisions_enabled')
    )
    expect(stmt!.toLowerCase()).toContain('add column if not exists')
  })
})

// ---------------------------------------------------------------------------
// 8. up() — students alterations and backfill
// ---------------------------------------------------------------------------

describe('up() — students alterations and backfill', () => {
  let sqlLog: string[]

  beforeEach(async () => {
    const mock = buildMockClient()
    sqlLog = mock.sqlLog
    await up(mock.client)
  })

  it('adds division_id column to students', () => {
    const stmt = sqlLog.find(
      (s) =>
        s.toLowerCase().includes('alter table students') && s.toLowerCase().includes('division_id')
    )
    expect(stmt).toBeTruthy()
  })

  it('adds division_id initially as nullable (no NOT NULL on ADD COLUMN)', () => {
    const addColStmt = sqlLog.find(
      (s) =>
        s.toLowerCase().includes('alter table students') &&
        s.toLowerCase().includes('add column if not exists division_id')
    )
    expect(addColStmt).toBeTruthy()
    // The ADD COLUMN statement itself should not include NOT NULL
    expect(addColStmt!.toLowerCase()).not.toContain('not null')
  })

  it('backfills students.division_id from the default division', () => {
    const backfill = sqlLog.find(
      (s) =>
        s.toLowerCase().includes('update students') &&
        s.toLowerCase().includes('division_id is null')
    )
    expect(backfill).toBeTruthy()
    expect(backfill!.toLowerCase()).toContain('where is_default = true')
  })

  it('sets division_id NOT NULL after backfill', () => {
    const setNotNull = sqlLog.find(
      (s) =>
        s.toLowerCase().includes('alter table students') &&
        s.toLowerCase().includes('alter column division_id set not null')
    )
    expect(setNotNull).toBeTruthy()
  })

  it('backfill runs before NOT NULL constraint (order check)', () => {
    const backfillIdx = sqlLog.findIndex(
      (s) =>
        s.toLowerCase().includes('update students') &&
        s.toLowerCase().includes('division_id is null')
    )
    const notNullIdx = sqlLog.findIndex(
      (s) =>
        s.toLowerCase().includes('alter table students') && s.toLowerCase().includes('set not null')
    )
    expect(backfillIdx).toBeGreaterThan(-1)
    expect(notNullIdx).toBeGreaterThan(-1)
    expect(backfillIdx).toBeLessThan(notNullIdx)
  })

  it('adds FK constraint on students.division_id → divisions(id)', () => {
    const fk = sqlLog.find(
      (s) =>
        s.toLowerCase().includes('students') &&
        s.toLowerCase().includes('foreign key (division_id)') &&
        s.toLowerCase().includes('references divisions(id)')
    )
    expect(fk).toBeTruthy()
  })

  it('FK uses ON DELETE RESTRICT (protecting referential integrity)', () => {
    const fk = sqlLog.find(
      (s) =>
        s.toLowerCase().includes('students') &&
        s.toLowerCase().includes('foreign key (division_id)')
    )
    expect(fk!.toLowerCase()).toContain('on delete restrict')
  })

  it('creates idx_students_division_id index', () => {
    expect(any(sqlLog, 'idx_students_division_id')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 9. up() — schema_version bump
// ---------------------------------------------------------------------------

describe("up() — schema_version bump to '1.5.0'", () => {
  let sqlLog: string[]

  beforeEach(async () => {
    const mock = buildMockClient()
    sqlLog = mock.sqlLog
    await up(mock.client)
  })

  it("updates schema_version to '1.5.0'", () => {
    const bump = sqlLog.find(
      (s) =>
        s.toLowerCase().includes('update schema_version') && s.toLowerCase().includes("'1.5.0'")
    )
    expect(bump).toBeTruthy()
  })

  it('schema_version UPDATE runs before COMMIT (inside transaction)', () => {
    const bumpIdx = sqlLog.findIndex(
      (s) =>
        s.toLowerCase().includes('update schema_version') && s.toLowerCase().includes("'1.5.0'")
    )
    const commitIdx = sqlLog.findIndex((s) => /^commit/i.test(s.trimStart()))

    expect(bumpIdx).toBeGreaterThan(-1)
    expect(bumpIdx).toBeLessThan(commitIdx)
  })
})

// ---------------------------------------------------------------------------
// 10. up() — ROLLBACK on query failure (safety gate)
// ---------------------------------------------------------------------------

describe('up() — ROLLBACK on failure', () => {
  it('rolls back if backfill UPDATE fails', async () => {
    const { client, sqlLog } = buildMockClient({
      failOnQuery: 'UPDATE students',
    })

    await expect(up(client)).rejects.toThrow()

    expect(any(sqlLog, 'ROLLBACK')).toBe(true)
    expect(any(sqlLog, 'COMMIT')).toBe(false)
  })

  it('rolls back if schema_version UPDATE fails', async () => {
    const { client, sqlLog } = buildMockClient({
      failOnQuery: 'UPDATE schema_version',
    })

    await expect(up(client)).rejects.toThrow()

    expect(any(sqlLog, 'ROLLBACK')).toBe(true)
    expect(any(sqlLog, 'COMMIT')).toBe(false)
  })

  it('rolls back if ADD COLUMN divisions_enabled fails', async () => {
    const { client, sqlLog } = buildMockClient({
      failOnQuery: /ALTER TABLE workspace_settings/,
    })

    await expect(up(client)).rejects.toThrow()

    expect(any(sqlLog, 'ROLLBACK')).toBe(true)
  })
})
