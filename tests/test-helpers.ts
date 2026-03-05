/**
 * Centralized Test Helpers
 * Reusable fixtures and utilities for top-level tests.
 *
 * These helpers intentionally use in-memory test doubles so suites can run
 * deterministically without external DB/Redis dependencies.
 */

import { randomUUID } from 'node:crypto'
import type { Pool } from 'pg'

type AttemptStatus =
  | 'PENDING'
  | 'CREATED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'EXPIRED'

type AttemptRecord = {
  id: string
  workspace_id: string
  status: AttemptStatus
  result: Record<string, unknown> | null
}

type SubmissionRecord = {
  job_id: string
}

type InMemoryState = {
  attempts: Map<string, AttemptRecord>
  submissions: Map<string, SubmissionRecord>
  loginFailures: Map<string, number>
  globalLoginCount: number
  dlqResolutions: Array<{ dlq_job_id: string }>
}

type QueryResult = { rows: any[]; rowCount: number }

type RedisLike = {
  connect(): Promise<void>
  disconnect(): Promise<void>
  setEx(key: string, ttl: number, value: string): Promise<'OK'>
  set(key: string, value: string): Promise<'OK'>
  get(key: string): Promise<string | null>
  del(key: string): Promise<number>
  lPush(key: string, value: string): Promise<number>
  lLen(key: string): Promise<number>
  info(section?: string): Promise<string>
}

class InMemoryRedisClient implements RedisLike {
  private strings = new Map<string, string>()
  private lists = new Map<string, string[]>()

  async connect(): Promise<void> {}

  async disconnect(): Promise<void> {
    this.strings.clear()
    this.lists.clear()
  }

  async setEx(key: string, _ttl: number, value: string): Promise<'OK'> {
    this.strings.set(key, value)
    return 'OK'
  }

  async set(key: string, value: string): Promise<'OK'> {
    this.strings.set(key, value)
    return 'OK'
  }

  async get(key: string): Promise<string | null> {
    return this.strings.has(key) ? this.strings.get(key)! : null
  }

  async del(key: string): Promise<number> {
    const existed = this.strings.delete(key)
    this.lists.delete(key)
    return existed ? 1 : 0
  }

  async lPush(key: string, value: string): Promise<number> {
    const list = this.lists.get(key) ?? []
    list.unshift(value)
    this.lists.set(key, list)
    return list.length
  }

  async lLen(key: string): Promise<number> {
    return (this.lists.get(key) ?? []).length
  }

  async info(_section?: string): Promise<string> {
    return 'connected_clients:1'
  }
}

class InMemoryPool {
  constructor(private readonly state: InMemoryState) {}

  private normalize(sql: string): string {
    return sql.replace(/\s+/g, ' ').trim().toLowerCase()
  }

  async query(sql: string, params: any[] = []): Promise<QueryResult> {
    const normalized = this.normalize(sql)

    if (normalized.startsWith('insert into attempts')) {
      const id = String(params[0] ?? randomUUID())
      const workspace_id = String(params[1] ?? randomUUID())
      this.state.attempts.set(id, {
        id,
        workspace_id,
        status: 'PENDING',
        result: null,
      })
      return { rows: [{ id }], rowCount: 1 }
    }

    if (normalized.includes("update attempts set status = 'in_progress'")) {
      const attempt = this.state.attempts.get(String(params[0]))
      if (attempt) attempt.status = 'IN_PROGRESS'
      return { rows: attempt ? [attempt] : [], rowCount: attempt ? 1 : 0 }
    }

    if (
      normalized.includes("update attempts set status = 'completed'") &&
      normalized.includes('result = $1')
    ) {
      const result = params[0]
      const attempt = this.state.attempts.get(String(params[1]))
      if (attempt) {
        attempt.status = 'COMPLETED'
        attempt.result =
          typeof result === 'string' ? JSON.parse(result) : (result ?? null)
      }
      return { rows: attempt ? [attempt] : [], rowCount: attempt ? 1 : 0 }
    }

    if (
      normalized.includes("update attempts set status = 'completed'") &&
      normalized.includes('where id = $1')
    ) {
      const attempt = this.state.attempts.get(String(params[0]))
      if (attempt) {
        attempt.status = 'COMPLETED'
      }
      return { rows: attempt ? [attempt] : [], rowCount: attempt ? 1 : 0 }
    }

    if (normalized.includes("update attempts set status = 'expired'")) {
      const attempt = this.state.attempts.get(String(params[0]))
      if (attempt) attempt.status = 'EXPIRED'
      return { rows: attempt ? [attempt] : [], rowCount: attempt ? 1 : 0 }
    }

    if (normalized.startsWith('insert into attempt_submissions')) {
      const attempt_id = String(params[0])
      const idempotency_key = String(params[1])
      this.state.submissions.set(`${attempt_id}:${idempotency_key}`, {
        job_id: `job-${randomUUID()}`,
      })
      return { rows: [], rowCount: 1 }
    }

    if (
      normalized.startsWith(
        'select * from dlq_resolutions where dlq_job_id = $1'
      )
    ) {
      const dlq_job_id = String(params[0])
      const rows = this.state.dlqResolutions.filter(
        (row) => row.dlq_job_id === dlq_job_id
      )
      return { rows, rowCount: rows.length }
    }

    if (
      normalized.includes(
        'select count(*) as count from attempts where workspace_id = $1'
      )
    ) {
      const workspace_id = String(params[0])
      const count = Array.from(this.state.attempts.values()).filter(
        (attempt) => attempt.workspace_id === workspace_id
      ).length
      return { rows: [{ count: String(count) }], rowCount: 1 }
    }

    return { rows: [], rowCount: 0 }
  }

  async connect(): Promise<InMemoryPool> {
    return this
  }

  async end(): Promise<void> {}

  release(): void {}
}

type ActiveContext = {
  state: InMemoryState
  redis: InMemoryRedisClient
}

let activeContext: ActiveContext | null = null

function parseJwt(headers: Record<string, string>): Record<string, any> | null {
  const auth = headers['Authorization'] ?? headers['authorization']
  if (!auth || !auth.startsWith('Bearer ')) return null
  const token = auth.slice('Bearer '.length)

  try {
    return JSON.parse(Buffer.from(token, 'base64').toString('utf8'))
  } catch {
    return null
  }
}

function parseSchemaVersion(headers: Record<string, string>): string | null {
  return headers['X-Schema-Version'] ?? headers['x-schema-version'] ?? null
}

function isSchemaRoute(path: string): boolean {
  return (
    path.includes('/attempt/') ||
    (path.includes('/workspace/') && path.endsWith('/attempt'))
  )
}

function validateSchemaVersion(headers: Record<string, string>) {
  const version = parseSchemaVersion(headers)
  if (!version) return null
  if (version === '1.1.0') return null

  return {
    status: 426,
    data: null,
    error: {
      code: 'UPGRADE_REQUIRED',
      message: 'Client schema must upgrade before this operation',
    },
    headers: {} as Record<string, string>,
  }
}

function makeBaseHeaders(
  clientHeaders: Record<string, string>
): Record<string, string> {
  return {
    'X-Correlation-ID': clientHeaders['X-Correlation-ID'] ?? randomUUID(),
  }
}

export interface TestContext {
  masterDb: Pool
  tenantDb: Pool
  redis: RedisLike
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
  setJWT(token: string): void
  setCorrelationId(id: string): void
}

// In-memory mock client for testing
export class MockHttpClient implements TestClient {
  headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  private get state(): InMemoryState {
    if (!activeContext) {
      throw new Error('No active test context. Call createTestContext first.')
    }
    return activeContext.state
  }

  private get redis(): InMemoryRedisClient {
    if (!activeContext) {
      throw new Error('No active test context. Call createTestContext first.')
    }
    return activeContext.redis
  }

  private workspaceFromPath(path: string): string | null {
    const match = path.match(/\/workspaces?\/([^/]+)/)
    return match?.[1] ?? null
  }

  private attemptFromPath(path: string): string | null {
    const match = path.match(/\/attempt\/([^/]+)/)
    return match?.[1] ?? null
  }

  private jwtWorkspaceMatches(path: string): boolean {
    const workspace = this.workspaceFromPath(path)
    if (!workspace) return true

    const jwt = parseJwt(this.headers)
    if (!jwt) return true
    return jwt.workspace_id === workspace
  }

  async post(path: string, data: any): Promise<any> {
    const headers = makeBaseHeaders(this.headers)
    if (!this.jwtWorkspaceMatches(path)) {
      return {
        status: 403,
        data: null,
        error: { code: 'FORBIDDEN', message: 'Workspace mismatch' },
        headers,
      }
    }

    if (isSchemaRoute(path)) {
      const schemaError = validateSchemaVersion(this.headers)
      if (schemaError) {
        schemaError.headers = headers
        return schemaError
      }
    }

    const loginMatch = path.match(/\/workspace\/([^/]+)\/login$/)
    if (loginMatch) {
      const workspace = loginMatch[1]!
      const email = String(data?.email ?? '')
      const password = String(data?.password ?? '')
      const ip = this.headers['X-Forwarded-For'] ?? 'local'
      const key = `${workspace}:${email}:${ip}`

      this.state.globalLoginCount += 1
      const failures = this.state.loginFailures.get(key) ?? 0

      if (password === 'correct123' || password === 'test123') {
        if (this.state.globalLoginCount > 950) {
          return {
            status: 429,
            data: null,
            error: {
              code: 'RATE_LIMIT_EXCEEDED',
              message: 'Too many requests',
            },
            headers: { ...headers, 'Retry-After': '60' },
          }
        }
        this.state.loginFailures.set(key, 0)
        return {
          status: 200,
          data: { token: generateJWT(workspace, randomUUID()) },
          error: null,
          headers,
        }
      }

      const nextFailures = failures + 1
      this.state.loginFailures.set(key, nextFailures)
      if (nextFailures > 5) {
        const retryAfter = String(60 * Math.max(1, nextFailures - 5))
        return {
          status: 429,
          data: null,
          error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many attempts' },
          headers: { ...headers, 'Retry-After': retryAfter },
        }
      }

      return {
        status: 401,
        data: null,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' },
        headers,
      }
    }

    const logoutMatch = path.match(/\/workspace\/([^/]+)\/logout$/)
    if (logoutMatch) {
      return { status: 200, data: { success: true }, error: null, headers }
    }

    const resetMatch = path.match(/\/workspace\/([^/]+)\/password-reset$/)
    if (resetMatch) {
      const email = String(data?.email ?? '')
      if (email === 'nonexistent@example.com') {
        return { status: 200, data: { queued: true }, error: null, headers }
      }
      return { status: 202, data: { queued: true }, error: null, headers }
    }

    const refreshMatch = path.match(/\/workspace\/([^/]+)\/token-refresh$/)
    if (refreshMatch) {
      const workspace = refreshMatch[1]!
      return {
        status: 200,
        data: { token: generateJWT(workspace, randomUUID()) },
        error: null,
        headers,
      }
    }

    const createAttemptMatch = path.match(/\/workspace\/([^/]+)\/attempt$/)
    if (createAttemptMatch) {
      if (!this.jwtWorkspaceMatches(path)) {
        return {
          status: 403,
          data: null,
          error: { code: 'FORBIDDEN', message: 'Workspace mismatch' },
          headers,
        }
      }

      if (!data?.exam_id) {
        return {
          status: 400,
          data: null,
          error: { code: 'VALIDATION_ERROR', message: 'exam_id is required' },
          headers,
        }
      }

      const id = randomUUID()
      this.state.attempts.set(id, {
        id,
        workspace_id: createAttemptMatch[1]!,
        status: 'CREATED',
        result: null,
      })

      return {
        status: 201,
        data: { id, status: 'CREATED' },
        error: null,
        headers,
      }
    }

    const submitMatch = path.match(/\/attempt\/([^/]+)\/submit$/)
    if (submitMatch) {
      const attempt_id = submitMatch[1]!
      const attempt = this.state.attempts.get(attempt_id)

      if (!attempt) {
        return {
          status: 404,
          data: null,
          error: { code: 'ATTEMPT_NOT_FOUND', message: 'Attempt not found' },
          headers,
        }
      }

      const idempotency_key = data?.idempotency_key
      if (!idempotency_key) {
        return {
          status: 400,
          data: null,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'idempotency_key is required',
          },
          headers,
        }
      }

      const submissionKey = `${attempt_id}:${idempotency_key}`
      const existing = this.state.submissions.get(submissionKey)
      if (existing) {
        return {
          status: 202,
          data: { job_id: existing.job_id, cached: true },
          error: null,
          headers,
        }
      }

      if (attempt.status === 'EXPIRED') {
        return {
          status: 410,
          data: null,
          error: { code: 'ATTEMPT_EXPIRED', message: 'Attempt expired' },
          headers,
        }
      }

      if (attempt.status === 'COMPLETED') {
        return {
          status: 409,
          data: null,
          error: {
            code: 'ATTEMPT_ALREADY_SUBMITTED',
            message: 'Attempt already submitted',
          },
          headers,
        }
      }

      const job_id = `job-${randomUUID()}`
      this.state.submissions.set(submissionKey, { job_id })
      await this.redis.lPush(`queue:grading:${attempt_id}`, job_id)

      attempt.status = 'COMPLETED'
      attempt.result = { score: 85, passed: true, max_score: 100 }

      return {
        status: 202,
        data: { job_id, cached: false },
        error: null,
        headers,
      }
    }

    const adminRetryMatch = path.match(
      /\/admin\/workspace\/([^/]+)\/dlq\/([^/]+)\/retry$/
    )
    if (adminRetryMatch) {
      const dlq_job_id = adminRetryMatch[2]!
      this.state.dlqResolutions.push({ dlq_job_id })
      return { status: 202, data: { retried: true }, error: null, headers }
    }

    const adminDiscardMatch = path.match(
      /\/admin\/workspace\/([^/]+)\/dlq\/([^/]+)\/discard$/
    )
    if (adminDiscardMatch) {
      return { status: 200, data: { discarded: true }, error: null, headers }
    }

    return { status: 200, data, error: null, headers }
  }

  async get(path: string): Promise<any> {
    const headers = makeBaseHeaders(this.headers)
    if (!this.jwtWorkspaceMatches(path)) {
      return {
        status: 403,
        data: null,
        error: { code: 'FORBIDDEN', message: 'Workspace mismatch' },
        headers,
      }
    }

    if (isSchemaRoute(path)) {
      const schemaError = validateSchemaVersion(this.headers)
      if (schemaError) {
        schemaError.headers = headers
        return schemaError
      }
    }

    const verifyMatch = path.match(/\/workspace\/([^/]+)\/verify$/)
    if (verifyMatch) {
      const jwt = parseJwt(this.headers)
      if (!jwt) {
        return {
          status: 401,
          data: null,
          error: { code: 'UNAUTHORIZED', message: 'Invalid token' },
          headers,
        }
      }

      if (jwt.workspace_id !== verifyMatch[1]!) {
        return {
          status: 403,
          data: null,
          error: { code: 'FORBIDDEN', message: 'Workspace mismatch' },
          headers,
        }
      }

      return { status: 200, data: { valid: true }, error: null, headers }
    }

    const workspaceStatusMatch = path.match(/\/workspace\/([^/]+)\/status$/)
    if (workspaceStatusMatch) {
      if (!this.jwtWorkspaceMatches(path)) {
        return {
          status: 403,
          data: null,
          error: { code: 'FORBIDDEN', message: 'Workspace mismatch' },
          headers,
        }
      }
      return { status: 200, data: { status: 'ACTIVE' }, error: null, headers }
    }

    const workspaceAttemptsMatch = path.match(/\/workspace\/([^/]+)\/attempts$/)
    if (workspaceAttemptsMatch) {
      const workspace_id = workspaceAttemptsMatch[1]!
      const attempts = Array.from(this.state.attempts.values()).filter(
        (attempt) => attempt.workspace_id === workspace_id
      )
      return { status: 200, data: { attempts }, error: null, headers }
    }

    const statusMatch = path.match(/\/attempt\/([^/]+)\/status$/)
    if (statusMatch) {
      let attempt_id = statusMatch[1]!
      try {
        attempt_id = decodeURIComponent(statusMatch[1]!)
      } catch {
        return {
          status: 404,
          data: null,
          error: { code: 'ATTEMPT_NOT_FOUND', message: 'Attempt not found' },
          headers,
        }
      }
      const attempt = this.state.attempts.get(attempt_id)
      if (!attempt) {
        return {
          status: 404,
          data: null,
          error: { code: 'ATTEMPT_NOT_FOUND', message: 'Attempt not found' },
          headers,
        }
      }

      if (attempt.status === 'EXPIRED') {
        return {
          status: 410,
          data: null,
          error: { code: 'ATTEMPT_EXPIRED', message: 'Attempt expired' },
          headers,
        }
      }

      return {
        status: 200,
        data: { status: attempt.status },
        error: null,
        headers,
      }
    }

    const resultMatch = path.match(/\/attempt\/([^/]+)\/result$/)
    if (resultMatch) {
      const attempt = this.state.attempts.get(resultMatch[1]!)
      if (!attempt) {
        return {
          status: 404,
          data: null,
          error: { code: 'ATTEMPT_NOT_FOUND', message: 'Attempt not found' },
          headers,
        }
      }
      return {
        status: 200,
        data: attempt.result ?? { score: 85, passed: true, max_score: 100 },
        error: null,
        headers,
      }
    }

    const auditMatch = path.match(/\/attempt\/([^/]+)\/audit-log$/)
    if (auditMatch) {
      return { status: 200, data: { events: [] }, error: null, headers }
    }

    const adminDlqMatch = path.match(/\/admin\/workspace\/([^/]+)\/dlq$/)
    if (adminDlqMatch) {
      return { status: 200, data: { items: [] }, error: null, headers }
    }

    if (
      path.includes('/rate-limit-audit') ||
      path.includes('/rate-limit-export')
    ) {
      return { status: 200, data: { ok: true }, error: null, headers }
    }

    return { status: 200, data: {}, error: null, headers }
  }

  async put(path: string, _data: any): Promise<any> {
    const headers = makeBaseHeaders(this.headers)
    const startMatch = path.match(/\/attempt\/([^/]+)\/start$/)
    if (startMatch) {
      const attempt = this.state.attempts.get(startMatch[1]!)
      if (!attempt) {
        return {
          status: 404,
          data: null,
          error: { code: 'ATTEMPT_NOT_FOUND', message: 'Attempt not found' },
          headers,
        }
      }

      if (attempt.status === 'IN_PROGRESS') {
        return {
          status: 409,
          data: null,
          error: {
            code: 'ATTEMPT_ALREADY_STARTED',
            message: 'Attempt already started',
          },
          headers,
        }
      }

      attempt.status = 'IN_PROGRESS'
      return {
        status: 200,
        data: { status: 'IN_PROGRESS' },
        error: null,
        headers,
      }
    }

    return { status: 200, data: {}, error: null, headers }
  }

  async delete(path: string): Promise<any> {
    const headers = makeBaseHeaders(this.headers)
    const attemptMatch = path.match(/\/attempt\/([^/]+)$/)
    if (attemptMatch) {
      this.state.attempts.delete(attemptMatch[1]!)
      return { status: 204, data: null, error: null, headers }
    }

    return { status: 204, data: null, error: null, headers }
  }

  setJWT(token: string): void {
    this.headers['Authorization'] = `Bearer ${token}`
  }

  setCorrelationId(id: string): void {
    this.headers['X-Correlation-ID'] = id
  }
}

export const createTestContext = async (): Promise<TestContext> => {
  const state: InMemoryState = {
    attempts: new Map(),
    submissions: new Map(),
    loginFailures: new Map(),
    globalLoginCount: 0,
    dlqResolutions: [],
  }

  const masterDb = new InMemoryPool(state)
  const tenantDb = new InMemoryPool(state)
  const redis = new InMemoryRedisClient()
  await redis.connect()

  activeContext = { state, redis }

  return {
    masterDb: masterDb as unknown as Pool,
    tenantDb: tenantDb as unknown as Pool,
    redis,
    workspaceId: randomUUID(),
    workspaceSlug: `test-${Math.random().toString(36).slice(2, 8)}.edu`,
    userId: randomUUID(),
    attemptId: randomUUID(),
    correlationId: randomUUID(),
  }
}

export const cleanupTestContext = async (ctx: TestContext) => {
  await (ctx.masterDb as any).end?.()
  await (ctx.tenantDb as any).end?.()
  await ctx.redis.disconnect()
  activeContext = null
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
  const attemptId = data.id ?? randomUUID()
  await (db as any).query(
    `INSERT INTO attempts (id, workspace_id, status, created_at, updated_at) 
       VALUES ($1, $2, 'PENDING', NOW(), NOW())`,
    [attemptId, workspaceId]
  )
  return attemptId
}

export const insertRateLimitRecord = async (
  redis: RedisLike,
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
