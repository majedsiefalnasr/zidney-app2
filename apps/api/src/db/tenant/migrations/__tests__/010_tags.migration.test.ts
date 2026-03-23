/**
 * Migration 010 — Tags Validation Tests — STAGE_32_TAGS
 *
 * File: apps/api/src/db/tenant/migrations/__tests__/010_tags.migration.test.ts
 *
 * Validates that the `up()` function emits the correct SQL DDL statements:
 * - Both tables created with correct columns and constraints
 * - Three FK constraints (tags_created_by_fkey, tags_updated_by_fkey, tag_relations_tag_id_fkey)
 * - Three B-tree indexes (status, tag_id, entity composite)
 * - Schema version bump to 1.16.0
 * - Two CONCURRENT unique indexes in Phase 2 (outside transaction)
 * - Transaction lifecycle (BEGIN / COMMIT)
 * - ROLLBACK on Phase 1 error
 *
 * Strategy: mock PoolClient.query and assert all expected SQL fragments.
 * No live database required — deterministic in CI.
 */

import type { PoolClient, QueryResult } from 'pg'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { up } from '../20260323_010_tags'

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

/** Returns a client that throws on the N-th non-control query */
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

describe('010_tags migration — up()', () => {
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

  // ── Table: tags ────────────────────────────────────────────────────────────

  it('creates tags table with all required columns', () => {
    const ddl = calls.find((c) => c.text.includes('CREATE TABLE') && c.text.includes('tags ('))
    expect(ddl).toBeDefined()
    const sql = ddl!.text
    expect(sql).toContain('id')
    expect(sql).toContain('UUID')
    expect(sql).toContain('name')
    expect(sql).toContain('VARCHAR(255)')
    expect(sql).toContain('normalized_name')
    expect(sql).toContain('status')
    expect(sql).toContain('VARCHAR(20)')
    expect(sql).toContain('created_at')
    expect(sql).toContain('updated_at')
    expect(sql).toContain('created_by')
    expect(sql).toContain('updated_by')
    expect(sql).toContain('TIMESTAMPTZ')
  })

  it('creates tags table with correct primary key constraint name', () => {
    const ddl = calls.find((c) => c.text.includes('CREATE TABLE') && c.text.includes('tags ('))
    expect(ddl!.text).toContain('tags_pkey')
  })

  it('creates tags table with status check constraint on ENABLED/DISABLED', () => {
    const ddl = calls.find((c) => c.text.includes('CREATE TABLE') && c.text.includes('tags ('))
    const sql = ddl!.text
    expect(sql).toContain('tags_status_check')
    expect(sql).toContain("'ENABLED'")
    expect(sql).toContain("'DISABLED'")
  })

  it('creates tags table with IF NOT EXISTS guard', () => {
    const ddl = calls.find((c) => c.text.includes('CREATE TABLE') && c.text.includes('tags ('))
    expect(ddl!.text).toContain('IF NOT EXISTS')
  })

  // ── Table: tag_relations ──────────────────────────────────────────────────

  it('creates tag_relations table with all required columns', () => {
    const ddl = calls.find(
      (c) => c.text.includes('CREATE TABLE') && c.text.includes('tag_relations (')
    )
    expect(ddl).toBeDefined()
    const sql = ddl!.text
    expect(sql).toContain('id')
    expect(sql).toContain('UUID')
    expect(sql).toContain('tag_id')
    expect(sql).toContain('entity_type')
    expect(sql).toContain('VARCHAR(40)')
    expect(sql).toContain('entity_id')
    expect(sql).toContain('created_at')
    expect(sql).toContain('TIMESTAMPTZ')
  })

  it('creates tag_relations table with correct primary key', () => {
    const ddl = calls.find(
      (c) => c.text.includes('CREATE TABLE') && c.text.includes('tag_relations (')
    )
    expect(ddl!.text).toContain('tag_relations_pkey')
  })

  it('creates tag_relations with entity_type check constraint covering all three entity types', () => {
    const ddl = calls.find(
      (c) => c.text.includes('CREATE TABLE') && c.text.includes('tag_relations (')
    )
    const sql = ddl!.text
    expect(sql).toContain('tag_relations_entity_type_check')
    expect(sql).toContain("'MCQ_QUESTION'")
    expect(sql).toContain("'TRADITIONAL_QUESTION'")
    expect(sql).toContain("'LIBRARY_FILE'")
  })

  // ── FK constraints ────────────────────────────────────────────────────────

  it('adds FK: tags.created_by → users.id ON DELETE SET NULL', () => {
    const fk = calls.find(
      (c) =>
        c.text.includes('tags_created_by_fkey') &&
        c.text.includes('REFERENCES users') &&
        c.text.includes('ON DELETE SET NULL')
    )
    expect(fk).toBeDefined()
  })

  it('adds FK: tags.updated_by → users.id ON DELETE SET NULL', () => {
    const fk = calls.find(
      (c) =>
        c.text.includes('tags_updated_by_fkey') &&
        c.text.includes('REFERENCES users') &&
        c.text.includes('ON DELETE SET NULL')
    )
    expect(fk).toBeDefined()
  })

  it('adds FK: tag_relations.tag_id → tags.id ON DELETE CASCADE', () => {
    const fk = calls.find(
      (c) =>
        c.text.includes('tag_relations_tag_id_fkey') &&
        c.text.includes('REFERENCES tags') &&
        c.text.includes('ON DELETE CASCADE')
    )
    expect(fk).toBeDefined()
  })

  it('all FK constraints use IF NOT EXISTS guard via DO $$ block', () => {
    const fkCalls = calls.filter(
      (c) => c.text.includes('ADD CONSTRAINT') && c.text.includes('_fkey')
    )
    expect(fkCalls.length).toBeGreaterThanOrEqual(3)
    for (const fk of fkCalls) {
      expect(fk.text).toContain('IF NOT EXISTS')
    }
  })

  // ── B-tree indexes ────────────────────────────────────────────────────────

  it('creates idx_tags_status index', () => {
    expect(
      calls.some((c) => c.text.includes('CREATE INDEX') && c.text.includes('idx_tags_status'))
    ).toBe(true)
  })

  it('creates idx_tag_relations_tag_id index', () => {
    expect(
      calls.some(
        (c) => c.text.includes('CREATE INDEX') && c.text.includes('idx_tag_relations_tag_id')
      )
    ).toBe(true)
  })

  it('creates idx_tag_relations_entity composite index on (entity_type, entity_id)', () => {
    const idx = calls.find(
      (c) =>
        c.text.includes('CREATE INDEX') &&
        c.text.includes('idx_tag_relations_entity') &&
        c.text.includes('entity_type') &&
        c.text.includes('entity_id')
    )
    expect(idx).toBeDefined()
  })

  it('all B-tree indexes use IF NOT EXISTS guard', () => {
    const indexCalls = calls.filter(
      (c) => c.text.includes('CREATE INDEX') && !c.text.includes('CONCURRENTLY')
    )
    expect(indexCalls.length).toBeGreaterThanOrEqual(3)
    for (const idx of indexCalls) {
      expect(idx.text).toContain('IF NOT EXISTS')
    }
  })

  // ── Schema version bump ────────────────────────────────────────────────────

  it("bumps schema version to '1.16.0' in _schema_versions table", () => {
    const bump = calls.find(
      (c) =>
        c.text.includes('UPDATE _schema_versions') &&
        c.text.includes("version = '1.16.0'") &&
        c.text.includes("name = 'schema_version'")
    )
    expect(bump).toBeDefined()
  })

  // ── CONCURRENT unique indexes (Phase 2, outside transaction) ─────────────

  it('creates CONCURRENT unique index on normalized_name after COMMIT', () => {
    const commitIdx = calls.findIndex((c) => c.text.trim() === 'COMMIT')
    const concurrentIdx = calls.findIndex(
      (c) =>
        c.text.includes('CREATE UNIQUE INDEX CONCURRENTLY') &&
        c.text.includes('unique_tags_normalized_name')
    )
    expect(concurrentIdx).toBeGreaterThan(commitIdx)
  })

  it('creates CONCURRENT unique index on (tag_id, entity_type, entity_id) after COMMIT', () => {
    const commitIdx = calls.findIndex((c) => c.text.trim() === 'COMMIT')
    const concurrentIdx = calls.findIndex(
      (c) =>
        c.text.includes('CREATE UNIQUE INDEX CONCURRENTLY') &&
        c.text.includes('unique_tag_relation')
    )
    expect(concurrentIdx).toBeGreaterThan(commitIdx)
  })

  it('CONCURRENT indexes use IF NOT EXISTS guard', () => {
    const concurrentCalls = calls.filter((c) => c.text.includes('CREATE UNIQUE INDEX CONCURRENTLY'))
    expect(concurrentCalls).toHaveLength(2)
    for (const idx of concurrentCalls) {
      expect(idx.text).toContain('IF NOT EXISTS')
    }
  })

  it('unique_tags_normalized_name targets the normalized_name column', () => {
    const idx = calls.find(
      (c) =>
        c.text.includes('CONCURRENTLY') &&
        c.text.includes('unique_tags_normalized_name') &&
        c.text.includes('normalized_name')
    )
    expect(idx).toBeDefined()
  })

  it('unique_tag_relation targets tag_id, entity_type, entity_id', () => {
    const idx = calls.find(
      (c) =>
        c.text.includes('CONCURRENTLY') &&
        c.text.includes('unique_tag_relation') &&
        c.text.includes('tag_id') &&
        c.text.includes('entity_type') &&
        c.text.includes('entity_id')
    )
    expect(idx).toBeDefined()
  })

  // ── Query ordering — BEGIN before all DDL ─────────────────────────────────

  it('issues BEGIN as the first query', () => {
    expect(calls[0]!.text.trim()).toBe('BEGIN')
  })

  it('issues COMMIT after schema version bump and before CONCURRENT indexes', () => {
    const commitIdx = calls.findIndex((c) => c.text.trim() === 'COMMIT')
    const versionBumpIdx = calls.findIndex((c) => c.text.includes("version = '1.16.0'"))
    expect(commitIdx).toBeGreaterThan(versionBumpIdx)
  })
})

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe('010_tags migration — error handling', () => {
  it('issues ROLLBACK when Phase 1 DDL query fails', async () => {
    const { client, calls } = makeFailingClient(1)
    await expect(up(client)).rejects.toThrow('Simulated DB failure')
    expect(calls.some((c) => c.text.trim() === 'ROLLBACK')).toBe(true)
  })

  it('re-throws the original error after ROLLBACK', async () => {
    const { client } = makeFailingClient(1)
    await expect(up(client)).rejects.toThrow('Simulated DB failure')
  })
})
