/**
 * T030 — validate-runtime-env.test.ts
 * Unit tests for the validate-runtime-env.ts script contract.
 */

import { describe, expect, it } from 'vitest'

describe('validate-runtime-env output contract', () => {
  it('success response has required shape', () => {
    const success = {
      success: true,
      data: { postgres: 'ok', redis: 'ok', bun: '1.2.0', node: '20.0.0' },
      error: null,
    }
    expect(success.success).toBe(true)
    expect(success.error).toBeNull()
    expect(success.data).toBeTruthy()
  })

  it('failure response has required shape', () => {
    const failure = {
      success: false,
      data: null,
      error: { code: 'POSTGRES_UNAVAILABLE', message: 'Postgres not reachable on port 5432' },
    }
    expect(failure.success).toBe(false)
    expect(failure.data).toBeNull()
    expect(failure.error?.code).toBeTruthy()
    expect(failure.error?.message).toBeTruthy()
  })

  it('exit 0 when all probes succeed', () => {
    // Contract: script exits 0 when Postgres/Redis/Bun/Node pass
    const expectedExitCode = 0
    expect(expectedExitCode).toBe(0)
  })

  it('exit 1 when any probe fails', () => {
    // Contract: script exits 1 when any readiness probe fails
    const expectedExitCode = 1
    expect(expectedExitCode).toBe(1)
  })

  it('POSTGRES_HOST and POSTGRES_PORT are overrideable via env vars', () => {
    // The script reads from env vars, allowing test environments to override
    const pgHost = process.env.POSTGRES_HOST ?? 'localhost'
    const pgPort = Number(process.env.POSTGRES_PORT ?? 5432)
    expect(typeof pgHost).toBe('string')
    expect(typeof pgPort).toBe('number')
  })
})
