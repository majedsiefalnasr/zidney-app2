/**
 * T061: Health Check Endpoint Implementation
 * File: apps/api/src/routes/health.routes.ts
 */

import { Hono } from 'hono'
import { db } from '../db'
import { redis } from '../services/redis'

export const healthRoutes = new Hono()

interface HealthResponse {
  status: 'healthy' | 'unhealthy'
  master_db: 'connected' | 'disconnected'
  redis: 'connected' | 'disconnected'
  migrations_current: boolean
  timestamp: string
}

/**
 * GET /health
 * Public health check endpoint (no authentication required)
 * Used by load balancers and deployment systems to verify service status
 *
 * Response 200 (healthy):
 * {
 *   "status": "healthy",
 *   "master_db": "connected",
 *   "redis": "connected",
 *   "migrations_current": true,
 *   "timestamp": "2025-02-25T10:30:45.123Z"
 * }
 *
 * Response 503 (unhealthy):
 * {
 *   "status": "unhealthy",
 *   "master_db": "disconnected",
 *   "redis": "disconnected",
 *   "migrations_current": false,
 *   "timestamp": "2025-02-25T10:30:45.123Z"
 * }
 */
healthRoutes.get('/health', async (c) => {
  const timestamp = new Date().toISOString()
  const response: HealthResponse = {
    status: 'healthy',
    master_db: 'disconnected',
    redis: 'disconnected',
    migrations_current: false,
    timestamp,
  }

  // Check master database connectivity
  try {
    // Test query with 5 second timeout
    const result = await Promise.race([
      db.query('SELECT 1'),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('DB timeout')), 5000)
      ),
    ])
    response.master_db = 'connected'
  } catch (error) {
    response.status = 'unhealthy'
    response.master_db = 'disconnected'
  }

  // Check Redis connectivity
  try {
    // Test PING with 5 second timeout
    const result = await Promise.race([
      redis.ping(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Redis timeout')), 5000)
      ),
    ])
    response.redis = 'connected'
  } catch (error) {
    response.status = 'unhealthy'
    response.redis = 'disconnected'
  }

  // Check migrations current
  try {
    // Query schema_version from migrations table
    const migrationQuery = `
      SELECT version FROM master.schema_migrations 
      ORDER BY version DESC 
      LIMIT 1
    `
    const result = await db.query(migrationQuery)

    // EXPECTED_MIGRATION_VERSION must match latest migration
    // Update this constant when new migrations are added
    const EXPECTED_MIGRATION_VERSION = '20260225010000' // Latest master migration

    if (
      result.rows.length > 0 &&
      result.rows[0].version === EXPECTED_MIGRATION_VERSION
    ) {
      response.migrations_current = true
    } else {
      response.status = 'unhealthy'
      response.migrations_current = false
    }
  } catch (error) {
    response.status = 'unhealthy'
    response.migrations_current = false
  }

  // Return 200 if healthy, 503 if unhealthy
  const statusCode = response.status === 'healthy' ? 200 : 503
  return c.json(response, statusCode)
})

/**
 * Health Check Test Suite (to be implemented)
 *
 * test('GET /health returns 200 when all systems operational', async () => {
 *   const res = await fetch('http://localhost:3000/health')
 *   expect(res.status).toBe(200)
 *   const body = await res.json()
 *   expect(body.status).toBe('healthy')
 *   expect(body.master_db).toBe('connected')
 *   expect(body.redis).toBe('connected')
 *   expect(body.migrations_current).toBe(true)
 * })
 *
 * test('GET /health returns 503 when database disconnected', async () => {
 *   // Simulate DB disconnect
 *   db.pool.destroy()
 *   const res = await fetch('http://localhost:3000/health')
 *   expect(res.status).toBe(503)
 *   const body = await res.json()
 *   expect(body.status).toBe('unhealthy')
 *   expect(body.master_db).toBe('disconnected')
 * })
 *
 * test('GET /health returns 503 when Redis disconnected', async () => {
 *   // Simulate Redis disconnect
 *   redis.disconnect()
 *   const res = await fetch('http://localhost:3000/health')
 *   expect(res.status).toBe(503)
 *   const body = await res.json()
 *   expect(body.status).toBe('unhealthy')
 *   expect(body.redis).toBe('disconnected')
 * })
 *
 * test('GET /health returns 503 when migrations out of date', async () => {
 *   // Manually downgrade version in schema_migrations
 *   await db.query('UPDATE master.schema_migrations SET version = ?')
 *   const res = await fetch('http://localhost:3000/health')
 *   expect(res.status).toBe(503)
 *   const body = await res.json()
 *   expect(body.migrations_current).toBe(false)
 * })
 *
 * test('GET /health uses 5 second timeout for database check', async () => {
 *   const startTime = Date.now()
 *   // Simulate slow DB (hangs)
 *   db.query = jest.fn(() => new Promise(() => {})) // Never resolves
 *   const res = await fetch('http://localhost:3000/health')
 *   const elapsed = Date.now() - startTime
 *   expect(elapsed).toBeLessThan(6000) // Should timeout around 5s
 *   expect(res.status).toBe(503)
 * })
 *
 * test('GET /health response includes timestamp', async () => {
 *   const res = await fetch('http://localhost:3000/health')
 *   const body = await res.json()
 *   expect(body.timestamp).toBeDefined()
 *   // Verify timestamp is valid ISO 8601
 *   expect(new Date(body.timestamp)).toBeInstanceOf(Date)
 * })
 *
 * test('GET /health is publicly accessible (no auth required)', async () => {
 *   // No authorization header
 *   const res = await fetch('http://localhost:3000/health')
 *   expect(res.status).not.toBe(401) // Should NOT return 401 Unauthorized
 *   expect(res.status).not.toBe(403) // Should NOT return 403 Forbidden
 * })
 */

export default healthRoutes
