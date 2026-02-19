/**
 * Centralized Test Helpers
 * Reusable fixtures and utilities for all test levels
 */

import { Pool } from 'pg'
import { createClient, RedisClientType } from 'redis'

export interface TestContext {
  masterDb: Pool
  tenantDb: Pool
  redis: RedisClientType
  workspaceId: string
  workspaceSlug: string
  userId: string
  attemptId: string
  correlationId: string
}

export interface TestClient {
  post(path: string, data: any): Promise<any>
  get(path: string): Promise<any>
  put(path: string, data: any): Promise<any>
  delete(path: string): Promise<any>
  headers: Record<string, string>
}

// In-memory mock client for testing
export class MockHttpClient implements TestClient {
  headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  async post(path: string, data: any): Promise<any> {
    return { status: 200, data, error: null }
  }

  async get(path: string): Promise<any> {
    return { status: 200, data: {}, error: null }
  }

  async put(path: string, data: any): Promise<any> {
    return { status: 200, data, error: null }
  }

  async delete(path: string): Promise<any> {
    return { status: 204, data: null, error: null }
  }

  setJWT(token: string) {
    this.headers['Authorization'] = `Bearer ${token}`
  }

  setCorrelationId(id: string) {
    this.headers['X-Correlation-ID'] = id
  }
}

// Test fixtures
export const createTestContext = async (): Promise<TestContext> => {
  const masterDb = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: 5432,
    user: 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: 'zidney_master_test',
  })

  const tenantDb = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: 5432,
    user: 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: 'zidney_tenant_test',
  })

  const redis = createClient({
    url: `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`,
  })

  await redis.connect()

  return {
    masterDb,
    tenantDb,
    redis,
    workspaceId: 'ws-' + Math.random().toString(36).substring(7),
    workspaceSlug: 'test-' + Math.random().toString(36).substring(7),
    userId: 'user-' + Math.random().toString(36).substring(7),
    attemptId: 'attempt-' + Math.random().toString(36).substring(7),
    correlationId: 'corr-' + Math.random().toString(36).substring(7),
  }
}

export const cleanupTestContext = async (ctx: TestContext) => {
  await ctx.masterDb.end()
  await ctx.tenantDb.end()
  await ctx.redis.disconnect()
}

export const createTestClient = (): TestClient => {
  return new MockHttpClient()
}

export const generateJWT = (workspaceId: string, userId: string): string => {
  const payload = {
    sub: userId,
    workspace_id: workspaceId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  }
  return Buffer.from(JSON.stringify(payload)).toString('base64')
}

export const insertTestAttempt = async (
  db: Pool,
  workspaceId: string,
  data: any = {}
): Promise<string> => {
  const attemptId = 'attempt-' + Math.random().toString(36).substring(7)
  await db.query(
    `INSERT INTO attempts (id, workspace_id, status, created_at, updated_at) 
       VALUES ($1, $2, 'PENDING', NOW(), NOW())`,
    [attemptId, workspaceId]
  )
  return attemptId
}

export const insertRateLimitRecord = async (
  redis: RedisClientType,
  bucketKey: string,
  count: number,
  ttl: number = 60
): Promise<void> => {
  await redis.setEx(bucketKey, ttl, count.toString())
}

export const expectErrorResponse = (
  response: any,
  expectedCode: string,
  expectedStatus: number
) => {
  expect(response.status).toBe(expectedStatus)
  expect(response.error).toBeDefined()
  expect(response.error.code).toBe(expectedCode)
  expect(response.data).toBeNull()
}

export const expectSuccessResponse = (
  response: any,
  expectedStatus: number = 200
) => {
  expect(response.status).toBe(expectedStatus)
  expect(response.success).toBe(true)
  expect(response.error).toBeNull()
  expect(response.data).toBeDefined()
}

export const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
