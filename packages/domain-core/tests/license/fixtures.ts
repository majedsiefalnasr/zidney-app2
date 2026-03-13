/**
 * Test Setup & Fixtures
 *
 * Provides test utilities, mocks, and fixtures for License Engine tests.
 * Base setup for all test files.
 */

import { v4 as uuidv4 } from 'uuid'
import { afterEach, beforeEach, expect, vi } from 'vitest'

/**
 * Test Database Fixtures
 */
export const testFixtures = {
  /**
   * Create mock license object
   */
  makeLicense: (overrides?: any) => ({
    id: uuidv4(),
    product_id: uuidv4(),
    workspace_id: uuidv4(),
    workspace_slug: `test-${Math.random().toString(36).slice(2, 9)}.edu`,
    student_limit: 300,
    staff_limit: 50,
    status: 'ACTIVE',
    soft_lock_until: null,
    archived_at: null,
    deleted_at: null,
    expected_schema_version: '1.0.0',
    expected_product_version: '1.0.0',
    created_at: new Date(),
    updated_at: new Date(),
    snapshot_id: null,
    ...overrides,
  }),

  /**
   * Create mock user object
   */
  makeUser: (overrides?: any) => ({
    id: uuidv4(),
    workspace_id: uuidv4(),
    name: 'Test User',
    email: `test-${Math.random().toString(36).slice(2, 9)}@example.com`,
    role: 'STUDENT',
    status: 'ENABLED',
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  }),

  /**
   * Create mock workspace object
   */
  makeWorkspace: (overrides?: any) => ({
    id: uuidv4(),
    name: 'Test Workspace',
    slug: `test-${Math.random().toString(36).slice(2, 9)}`,
    status: 'ACTIVE',
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  }),

  /**
   * Create mock product object
   */
  makeProduct: (overrides?: any) => ({
    id: uuidv4(),
    name: 'Test Product',
    version: '1.0.0',
    default_student_limit: 300,
    default_staff_limit: 50,
    created_at: new Date(),
    ...overrides,
  }),

  /**
   * Create mock archive snapshot
   */
  makeArchiveSnapshot: (overrides?: any) => ({
    id: uuidv4(),
    license_id: uuidv4(),
    snapshot_location: 's3://bucket/snapshot.sql',
    snapshot_timestamp: new Date().toISOString(),
    created_at: new Date(),
    ...overrides,
  }),

  /**
   * Create mock request context
   */
  makeContext: (overrides?: any) => ({
    correlation_id: uuidv4(),
    workspace_id: uuidv4(),
    workspace_slug: 'test.edu',
    user_id: uuidv4(),
    role: 'ADMIN',
    license_id: uuidv4(),
    license_status: 'ACTIVE',
    student_limit: 300,
    staff_limit: 50,
    ...overrides,
  }),
}

/**
 * Mock Database Client
 */
export class MockDatabaseClient {
  transactionActive = false
  private queries: { sql: string; params: any[] }[] = []
  private mockedResults: Array<{
    matcher: string | RegExp
    rows: any[] | null
    error?: any
  }> = []

  private normalizeSql(sql: string): string {
    return sql.replace(/\s+/g, ' ').trim().toLowerCase()
  }

  private matches(sql: string, matcher: string | RegExp): boolean {
    if (matcher instanceof RegExp) {
      return matcher.test(sql)
    }

    const normalizedMatcher = this.normalizeSql(matcher)
    return sql.includes(normalizedMatcher)
  }

  query = vi.fn(async (sql: string, params: any[] = []) => {
    this.queries.push({ sql, params })
    const normalizedSql = this.normalizeSql(sql)

    // Transaction control statements
    if (
      normalizedSql.startsWith('begin') ||
      normalizedSql.startsWith('commit') ||
      normalizedSql.startsWith('rollback')
    ) {
      return { rows: [], rowCount: 0 }
    }

    // Return explicitly mocked results first.
    const matchIndex = this.mockedResults.findIndex((entry) =>
      this.matches(normalizedSql, entry.matcher)
    )

    if (matchIndex >= 0) {
      const entry = this.mockedResults.splice(matchIndex, 1)[0]!
      if (entry.error) {
        throw entry.error
      }

      const rows = entry.rows ?? []
      return { rows, rowCount: rows.length }
    }

    // Common INSERT behavior used by transaction-wrapper tests.
    if (normalizedSql.includes('insert into users') && normalizedSql.includes('returning id')) {
      const id = params[0] || uuidv4()
      return { rows: [{ id }], rowCount: 1 }
    }

    if (normalizedSql.includes('select count(*) as count')) {
      return { rows: [{ count: '0' }], rowCount: 1 }
    }

    return { rows: [], rowCount: 0 }
  })

  mockResult = (sql: string | RegExp, rows: any[] | null, error?: any, _metadata?: unknown) => {
    this.mockedResults.push({ matcher: sql, rows, error })
  }

  beginTransaction = vi.fn(async () => {
    this.transactionActive = true
  })

  commit = vi.fn(async () => {
    this.transactionActive = false
  })

  rollback = vi.fn(async () => {
    this.transactionActive = false
  })

  release = vi.fn(() => {})

  connect = vi.fn(async () => this)

  getQueries = () => this.queries

  reset = () => {
    this.queries = []
    this.mockedResults = []
    vi.clearAllMocks()
  }
}

/**
 * Mock Redis Client
 */
export class MockRedisClient {
  private store: Map<string, any> = new Map()
  private ttls: Map<string, number> = new Map()

  get = vi.fn(async (key: string) => {
    return this.store.has(key) ? this.store.get(key) : null
  })

  set = vi.fn(async (key: string, value: any) => {
    this.store.set(key, value)
    return 'OK'
  })

  setex = vi.fn(async (key: string, ttl: number, value: any) => {
    this.store.set(key, value)
    this.ttls.set(key, ttl)
    return 'OK'
  })

  del = vi.fn(async (key: string) => {
    const existed = this.store.has(key)
    this.store.delete(key)
    this.ttls.delete(key)
    return existed ? 1 : 0
  })

  flushall = vi.fn(async () => {
    this.store.clear()
    this.ttls.clear()
    return 'OK'
  })

  flush = vi.fn(async () => this.flushall())

  getTTL = vi.fn(async (key: string) => this.ttls.get(key) ?? -2)

  reset = () => {
    this.store.clear()
    this.ttls.clear()
    vi.clearAllMocks()
  }
}

/**
 * Test Context Setup
 */
export function setupTestContext() {
  const mockDb = new MockDatabaseClient()
  const mockRedis = new MockRedisClient()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    mockDb.reset()
    mockRedis.reset()
  })

  return { mockDb, mockRedis }
}

/**
 * Assert parameterized query (SQL injection safety)
 */
export function assertParameterizedQuery(query: string) {
  // Should use $1, $2, etc. for parameters (not string concatenation)
  const hasDollarParams = /$\d+/.test(query)
  const hasStringConcat = query.includes("'") && query.includes('+') && !query.includes("''")

  expect(hasDollarParams).toBe(true)
  expect(hasStringConcat).toBe(false)
}

/**
 * Assert transactional isolation level
 */
export function assertTransactionIsolation(query: string) {
  // Should include SERIALIZABLE or REPEATABLE READ
  const hasIsolation = query.includes('SERIALIZABLE') || query.includes('REPEATABLE READ')
  expect(hasIsolation).toBe(true)
}

/**
 * Assert SELECT FOR UPDATE (row locking)
 */
export function assertSelectForUpdate(query: string) {
  expect(query).include('FOR UPDATE')
}

/**
 * Assert structured logging fields
 */
export function assertStructuredLog(logObject: any) {
  const requiredFields = ['timestamp', 'level', 'service', 'correlation_id', 'action']

  for (const field of requiredFields) {
    expect(logObject).toHaveProperty(field)
  }

  // Ensure no console primitives
  expect(typeof logObject).toBe('object')
}

/**
 * Concurrency Test Helper
 *
 * Simulates N concurrent requests with same operation
 */
export async function testConcurrency(
  operation: () => Promise<any>,
  concurrencyLevel: number = 5
): Promise<any[]> {
  const promises = Array(concurrencyLevel)
    .fill(null)
    .map(() => operation())
  return Promise.all(promises)
}

/**
 * Race Condition Test Helper
 *
 * Ensures operations are truly concurrent via Promise.all
 */
export async function assertRaceCondition(
  operation1: () => Promise<any>,
  operation2: () => Promise<any>
): Promise<{ result1: any; result2: any }> {
  const results = await Promise.all([operation1(), operation2()])
  return {
    result1: results[0],
    result2: results[1],
  }
}

/**
 * Rollback Test Helper
 *
 * Verifies transaction rollback on error
 */
export async function testTransactionRollback(
  operation: () => Promise<any>,
  shouldFail: boolean = true
): Promise<void> {
  if (shouldFail) {
    await expect(operation()).rejects.toThrow()
  } else {
    await expect(operation()).resolves.toBeDefined()
  }
}

export default {
  testFixtures,
  MockDatabaseClient,
  MockRedisClient,
  setupTestContext,
  assertParameterizedQuery,
  assertTransactionIsolation,
  assertSelectForUpdate,
  assertStructuredLog,
  testConcurrency,
  assertRaceCondition,
  testTransactionRollback,
}
