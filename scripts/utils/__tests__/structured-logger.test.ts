import { afterEach, beforeEach, expect, test, vi } from 'vitest'

let originalArgv: string[]
let originalEnv: NodeJS.ProcessEnv

beforeEach(() => {
  originalArgv = process.argv.slice()
  originalEnv = { ...process.env }
  vi.resetModules()
})

afterEach(() => {
  process.argv = originalArgv
  process.env = { ...originalEnv }
  try {
    vi.restoreAllMocks()
  } catch {}
})

test('runWithLogContext merges async context into logger context', async () => {
  process.env.LOG_LEVEL = 'debug'
  process.env.LOG_SAMPLE_RATE = '1'
  vi.resetModules()

  const mod = await import('../../utils/structured-logger')
  const { createLogger, runWithLogContext } = mod

  const logger = createLogger('my-module')

  const result = runWithLogContext({ correlationId: 'cid-123', userId: 'u-1' }, () => {
    const ctx = (logger as any).getContext()
    expect(ctx.correlationId).toBe('cid-123')
    expect(ctx.userId).toBe('u-1')
    // should still include module name
    expect(ctx.module).toBeDefined()
    return 'ok'
  })

  expect(result).toBe('ok')
})

test('setLoggerTransport receives entries for debug/info/warn/error', async () => {
  process.env.LOG_LEVEL = 'debug'
  process.env.LOG_SAMPLE_RATE = '1'
  vi.resetModules()

  const mod = await import('../../utils/structured-logger')
  const { createLogger, setLoggerTransport } = mod

  const captured: any[] = []
  setLoggerTransport((entry) => {
    captured.push(entry)
  })

  const logger = createLogger('tmod', true)

  logger.debug('d1', { x: 1 })
  logger.info('i1', { x: 2 })
  logger.warn('w1', { x: 3 })
  logger.error('e1', new Error('boom'))

  // transport may be called asynchronously; allow microtask queue to flush
  await new Promise((r) => setTimeout(r, 10))

  // Expect at least 4 entries captured (one per call)
  expect(captured.length).toBeGreaterThanOrEqual(4)
  const levels = captured.map((c) => c.level)
  expect(levels).toContain('debug')
  expect(levels).toContain('info')
  expect(levels).toContain('warn')
  expect(levels).toContain('error')
})

test('setConsoleJsonTransport writes JSON to stdout', async () => {
  process.env.LOG_LEVEL = 'debug'
  process.env.LOG_SAMPLE_RATE = '1'
  vi.resetModules()

  const mod = await import('../../utils/structured-logger')
  const { createLogger, setConsoleJsonTransport } = mod

  const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true as any)

  setConsoleJsonTransport()
  const logger = createLogger('jsonmod', true)
  logger.info('hello', { a: 1 })

  // allow any async transport to complete
  await new Promise((r) => setTimeout(r, 10))

  const called = writeSpy.mock.calls.some((c) => String(c[0]).includes('hello'))
  expect(called).toBe(true)

  writeSpy.mockRestore()
})

test('withSpan returns result and captures error spans', async () => {
  process.env.LOG_LEVEL = 'debug'
  process.env.LOG_SAMPLE_RATE = '1'
  vi.resetModules()

  const mod = await import('../../utils/structured-logger')
  const { withSpan, setLoggerTransport } = mod

  const captured: any[] = []
  setLoggerTransport((entry) => captured.push(entry))

  const res = await withSpan('ok-span', () => 42)
  expect(res).toBe(42)

  // error path
  let threw = false
  try {
    await withSpan('bad-span', () => {
      throw new Error('fail')
    })
  } catch (_e) {
    threw = true
  }
  expect(threw).toBe(true)

  // allow async transports
  await new Promise((r) => setTimeout(r, 10))

  // Expect at least one 'error' level entry for the failed span
  const hasError = captured.some(
    (c) => c.level === 'error' || String(c.message).includes('bad-span')
  )
  expect(hasError).toBe(true)
})

import { describe, it } from 'vitest'
import { createLogger, runWithLogContext, setLoggerTransport, withSpan } from '../structured-logger'

describe('StructuredLogger adapter', () => {
  beforeEach(() => {
    // reset transport to a no-op to avoid test pollution
    setLoggerTransport(() => {})
  })

  it('sends entries to configured transport', () => {
    const received: any[] = []
    setLoggerTransport((entry) => received.push(entry))

    const logger = createLogger('test-module', true)
    logger.info('hello', { a: 1 })

    expect(received.length).toBeGreaterThan(0)
    const e = received.find((r) => r.message === 'hello')
    expect(e).toBeDefined()
    expect(e.context.module).toBe('test-module')
  })

  it('merges async context set via runWithLogContext', () => {
    const received: any[] = []
    setLoggerTransport((entry) => received.push(entry))

    runWithLogContext({ correlationId: 'cid-xyz' }, () => {
      const logger = createLogger('ctx-module', true)
      logger.info('ctx-test')
    })

    const e = received.find((r) => r.message === 'ctx-test')
    expect(e).toBeDefined()
    expect(e.context.correlationId).toBe('cid-xyz')
  })

  it('withSpan records success and error spans', async () => {
    const received: any[] = []
    setLoggerTransport((entry) => received.push(entry))

    const result = await withSpan('span-ok', () => 'ok')
    expect(result).toBe('ok')

    // wait a tick for transports to be invoked if async
    await new Promise((r) => setTimeout(r, 5))

    const ok = received.find(
      (r) => typeof r.message === 'string' && r.message.includes('span:span-ok:success')
    )
    expect(ok).toBeDefined()

    // error case
    let thrown = null
    try {
      await withSpan('span-err', () => {
        throw new Error('boom')
      })
    } catch (err) {
      thrown = err
    }
    expect(thrown).not.toBeNull()
    const err = received.find(
      (r) => typeof r.message === 'string' && r.message.includes('span:span-err:error')
    )
    expect(err).toBeDefined()
  })
})
// Ensure logger modules pick up debug-level logging in tests
process.env.LOG_LEVEL = 'debug'

describe('structured-logger adapter', () => {
  const captured: any[] = []
  afterEach(() => {
    // restore a no-op transport to avoid cross-test pollution
    setLoggerTransport(() => undefined)
    captured.length = 0
  })

  it('emits entries to configured transport', () => {
    setLoggerTransport((entry) => captured.push(entry))
    const logger = createLogger('unit:test', false)
    logger.info('hello', { a: 1 })
    logger.warn('warn')
    logger.error('boom', new Error('boom'))

    // transport should have received at least the error entry and others
    expect(captured.length).toBeGreaterThanOrEqual(1)
    expect(captured.some((e) => e.level === 'error')).toBeTruthy()
  })

  it('supports runWithLogContext and child context merging', () => {
    setLoggerTransport((entry) => captured.push(entry))
    const logger = createLogger('ctx:test')

    runWithLogContext({ correlationId: 'cid-123', userId: 'u1' }, () => {
      const child = logger.child({ attemptId: 'a1' })
      child.info('in-context', { x: 1 })
    })

    expect(captured.length).toBeGreaterThanOrEqual(1)
    expect(captured[0].context.correlationId).toBe('cid-123')
    expect(captured[0].context.attemptId).toBeDefined()
  })

  it('withSpan records success and error spans', async () => {
    setLoggerTransport((entry) => captured.push(entry))
    const res = await withSpan('span-ok', () => 'ok')
    expect(res).toBe('ok')
    expect(captured.some((e) => e.message.includes('span:span-ok:success'))).toBeTruthy()

    // error span
    let threw = false
    try {
      await withSpan('span-err', () => {
        throw new Error('fail')
      })
    } catch (_e) {
      threw = true
    }
    expect(threw).toBeTruthy()
    expect(captured.some((e) => String(e.message).includes('span:span-err:error'))).toBeTruthy()
  })
})
