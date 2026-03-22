/**
 * Migration 009 — Category Values Validation Tests — STAGE_31_CATEGORY_VALUES
 *
 * File: apps/api/src/db/tenant/migrations/__tests__/009_category_values.migration.test.ts
 *
 * Validates that the `up()` function from migration 009 issues the correct SQL
 * DDL statements: correct table structures, FK constraints, B-tree indexes, and
 * the CONCURRENT partial functional unique index.
 *
 * Strategy: mock PoolClient.query as a spy and assert that all expected SQL
 * fragments are issued. This runs without a live database and is deterministic
 * in CI. A separate live-DB test would go in docker-compose.test.yml.
 */

import type { PoolClient, QueryResult } from 'pg'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { up } from '../20260322_009_category_values'

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

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('009_category_values migration — up()', () => {
  let client: PoolClient
  let calls: QueryCall[]

  beforeEach(async () => {
    ;({ client, calls } = makeMockClient())
    await up(client)
  })

  // ── Transaction lifecycle ──────────────────────────────────────────────────

  it('opens a transaction with BEGIN', () => {
    expect(calls.some((c) => c.text.trim() === 'BEGIN')).toBe(true)
  })

  it('commits the transaction with COMMIT', () => {
    expect(calls.some((c) => c.text.trim() === 'COMMIT')).toBe(true)
  })

  // ── Table creation ─────────────────────────────────────────────────────────

  it('creates category_values table with all required columns', () => {
    const ddl = calls.find(
      (c) => c.text.includes('CREATE TABLE') && c.text.includes('category_values')
    )
    expect(ddl).toBeDefined()
    const sql = ddl!.text
    // Primary columns
    expect(sql).toContain('id')
    expect(sql).toContain('UUID')
    expect(sql).toContain('category_id')
    expect(sql).toContain('code')
    expect(sql).toContain('VARCHAR(100)')
    expect(sql).toContain('status')
    expect(sql).toContain('VARCHAR(20)')
    expect(sql).toContain('deleted_at')
    // Status check constraint
    expect(sql).toContain("'COMPLETED'")
    expect(sql).toContain("'UNDER_REVIEW'")
    expect(sql).toContain("'APPROVED'")
    expect(sql).toContain("'ENABLED'")
    expect(sql).toContain("'DISABLED'")
    // Primary key
    expect(sql).toContain('category_values_pkey')
  })

  it('creates category_value_subjects table', () => {
    const ddl = calls.find(
      (c) =>
        c.text.includes('CREATE TABLE') &&
        c.text.includes('category_value_subjects') &&
        !c.text.includes('category_values (')
    )
    expect(ddl).toBeDefined()
    const sql = ddl!.text
    expect(sql).toContain('category_value_id')
    expect(sql).toContain('subject_id')
    expect(sql).toContain('category_value_subjects_pkey')
    expect(sql).toContain('unique_category_value_subjects')
  })

  it('creates category_value_divisions table', () => {
    const ddl = calls.find(
      (c) =>
        c.text.includes('CREATE TABLE') &&
        c.text.includes('category_value_divisions') &&
        !c.text.includes('category_values (')
    )
    expect(ddl).toBeDefined()
    const sql = ddl!.text
    expect(sql).toContain('category_value_id')
    expect(sql).toContain('division_id')
    expect(sql).toContain('category_value_divisions_pkey')
    expect(sql).toContain('unique_category_value_divisions')
  })

  // ── FK constraints ────────────────────────────────────────────────────────

  it('adds FK: category_values.category_id → categories.id ON DELETE CASCADE', () => {
    const fk = calls.find(
      (c) =>
        c.text.includes('cv_category_id_fkey') &&
        c.text.includes('REFERENCES categories') &&
        c.text.includes('ON DELETE CASCADE')
    )
    expect(fk).toBeDefined()
  })

  it('adds FK: category_value_subjects.category_value_id → category_values.id', () => {
    const fk = calls.find(
      (c) =>
        c.text.includes('cv_subjects_category_value_id_fkey') &&
        c.text.includes('REFERENCES category_values')
    )
    expect(fk).toBeDefined()
  })

  it('adds FK: category_value_divisions.category_value_id → category_values.id', () => {
    const fk = calls.find(
      (c) =>
        c.text.includes('cv_divisions_category_value_id_fkey') &&
        c.text.includes('REFERENCES category_values')
    )
    expect(fk).toBeDefined()
  })

  // ── B-tree indexes ────────────────────────────────────────────────────────

  it('creates idx_category_values_category_id index', () => {
    expect(
      calls.some(
        (c) => c.text.includes('CREATE INDEX') && c.text.includes('idx_category_values_category_id')
      )
    ).toBe(true)
  })

  it('creates idx_category_values_status index', () => {
    expect(
      calls.some(
        (c) => c.text.includes('CREATE INDEX') && c.text.includes('idx_category_values_status')
      )
    ).toBe(true)
  })

  it('creates idx_category_values_category_id_status composite index', () => {
    expect(
      calls.some(
        (c) =>
          c.text.includes('CREATE INDEX') &&
          c.text.includes('idx_category_values_category_id_status')
      )
    ).toBe(true)
  })

  it('creates partial index on deleted_at', () => {
    const idx = calls.find(
      (c) =>
        c.text.includes('CREATE INDEX') &&
        c.text.includes('idx_category_values_deleted_at') &&
        c.text.includes('WHERE deleted_at IS NULL')
    )
    expect(idx).toBeDefined()
  })

  // ── Schema version bump ────────────────────────────────────────────────────

  it("bumps schema version to '1.15.0' in _schema_versions table", () => {
    const bump = calls.find(
      (c) =>
        c.text.includes('UPDATE _schema_versions') &&
        c.text.includes("version = '1.15.0'") &&
        c.text.includes("name = 'schema_version'")
    )
    expect(bump).toBeDefined()
  })

  // ── CONCURRENT unique index (Phase 2, outside transaction) ────────────────

  it('creates CONCURRENT unique partial functional index on (category_id, LOWER(code))', () => {
    const idx = calls.find(
      (c) =>
        c.text.includes('CREATE UNIQUE INDEX CONCURRENTLY') &&
        c.text.includes('unique_category_values_code') &&
        c.text.includes('LOWER(code)') &&
        c.text.includes('WHERE deleted_at IS NULL')
    )
    expect(idx).toBeDefined()
  })

  it('issues CONCURRENT index AFTER the COMMIT (outside the transaction)', () => {
    const commitIdx = calls.findIndex((c) => c.text.trim() === 'COMMIT')
    const concurrentIdx = calls.findIndex(
      (c) =>
        c.text.includes('CREATE UNIQUE INDEX CONCURRENTLY') &&
        c.text.includes('unique_category_values_code')
    )
    // commitIdx must appear before concurrentIdx
    expect(commitIdx).toBeGreaterThanOrEqual(0)
    expect(concurrentIdx).toBeGreaterThan(commitIdx)
  })

  // ── Rollback on error ─────────────────────────────────────────────────────

  it('rolls back on error during Phase 1', async () => {
    const localCalls: QueryCall[] = []
    let callCount = 0
    const errorClient = {
      query: vi.fn(async (text: string) => {
        const sql = typeof text === 'string' ? text : (text as { text: string }).text
        localCalls.push({ text: sql })
        callCount++
        // Fail on the second DDL query (CREATE TABLE category_values)
        if (callCount === 2 && sql.includes('CREATE TABLE')) {
          throw new Error('simulated DDL failure')
        }
        return { rows: [], rowCount: 0 } as unknown as QueryResult
      }),
    } as unknown as PoolClient

    await expect(up(errorClient)).rejects.toThrow('simulated DDL failure')
    expect(localCalls.some((c) => c.text.trim() === 'ROLLBACK')).toBe(true)
  })
})
