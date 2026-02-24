import { Pool } from 'pg'

/**
 * Legacy compatibility export for modules that import infrastructure/postgres.
 * Newer code should use db abstractions under src/db.
 */
export const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 900000,
  connectionTimeoutMillis: 30000,
})

export default db
