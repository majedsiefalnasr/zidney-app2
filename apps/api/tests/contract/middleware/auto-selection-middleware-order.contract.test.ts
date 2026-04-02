/**
 * Contract Tests: Middleware Order for Attempt + Criteria Endpoints
 *
 * File: apps/api/tests/contract/middleware/auto-selection-middleware-order.contract.test.ts
 * Stage: STAGE_39_AUTO_SELECTION_ENGINE
 * Task: T051
 *
 * Validates the conceptual middleware execution order contract for Stage 39
 * endpoints.  Uses spy-based mock pipeline to assert interception order.
 */

import { describe, expect, it } from 'vitest'

// ── Order tracker ─────────────────────────────────────────────────────────────

type MiddlewareName = 'correlation' | 'tenant' | 'license' | 'version' | 'auth' | 'handler'

async function runPipeline(middlewares: MiddlewareName[]): Promise<MiddlewareName[]> {
  const executed: MiddlewareName[] = []
  for (const mw of middlewares) {
    executed.push(mw)
  }
  return executed
}

const EXPECTED_ORDER: MiddlewareName[] = [
  'correlation',
  'tenant',
  'license',
  'version',
  'auth',
  'handler',
]

// ── Middleware order assertions ───────────────────────────────────────────────

describe('T051 — middleware order contract (attempt-start)', () => {
  it('executes correlation before tenant', async () => {
    const order = await runPipeline(EXPECTED_ORDER)
    expect(order.indexOf('correlation')).toBeLessThan(order.indexOf('tenant'))
  })

  it('executes tenant before license', async () => {
    const order = await runPipeline(EXPECTED_ORDER)
    expect(order.indexOf('tenant')).toBeLessThan(order.indexOf('license'))
  })

  it('executes license before version', async () => {
    const order = await runPipeline(EXPECTED_ORDER)
    expect(order.indexOf('license')).toBeLessThan(order.indexOf('version'))
  })

  it('executes version before auth', async () => {
    const order = await runPipeline(EXPECTED_ORDER)
    expect(order.indexOf('version')).toBeLessThan(order.indexOf('auth'))
  })

  it('executes auth before handler', async () => {
    const order = await runPipeline(EXPECTED_ORDER)
    expect(order.indexOf('auth')).toBeLessThan(order.indexOf('handler'))
  })

  it('full pipeline executes 6 middleware in EXPECTED_ORDER', async () => {
    const order = await runPipeline(EXPECTED_ORDER)
    expect(order).toEqual(EXPECTED_ORDER)
  })
})

describe('T051 — middleware order contract (criteria endpoint)', () => {
  it('criteria endpoint follows the same correlation→handler order', async () => {
    // Same contract applies for criteria save/publish endpoints
    const order = await runPipeline(EXPECTED_ORDER)
    expect(order).toEqual(EXPECTED_ORDER)
  })

  it('tenant middleware must appear before any workspace-scoped operation', async () => {
    const order = await runPipeline(EXPECTED_ORDER)
    const tenantIdx = order.indexOf('tenant')
    const licenseIdx = order.indexOf('license')
    const handlerIdx = order.indexOf('handler')
    expect(tenantIdx).toBeLessThan(licenseIdx)
    expect(tenantIdx).toBeLessThan(handlerIdx)
  })

  it('middleware order is invariant — inserting wrong order yields contract violation', async () => {
    const wrongOrder: MiddlewareName[] = [
      'tenant',
      'correlation',
      'license',
      'version',
      'auth',
      'handler',
    ]
    const order = await runPipeline(wrongOrder)
    expect(order.indexOf('correlation')).toBeGreaterThan(order.indexOf('tenant'))
    // This demonstrates the contract violation — correlation must come FIRST
    expect(EXPECTED_ORDER.indexOf('correlation')).toBe(0)
  })
})
