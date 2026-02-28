/**
 * Test DB fixture stub
 * Provides a test database pool for API performance tests
 */
import { Pool } from 'pg'

let testPool: Pool | null = null

/**
 * Get or create a test database pool
 */
export async function getTestDb(): Promise<Pool> {
  if (!testPool) {
    testPool = new Pool({
      connectionString:
        process.env.DATABASE_URL ||
        'postgresql://postgres:postgres@localhost:5432/zidney_test',
    })
  }
  return testPool
}

/**
 * Close the test database pool
 */
export async function closeTestDb(): Promise<void> {
  if (testPool) {
    await testPool.end()
    testPool = null
  }
}
