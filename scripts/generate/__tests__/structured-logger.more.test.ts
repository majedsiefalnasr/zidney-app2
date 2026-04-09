import { afterEach, beforeEach, expect, test, vi } from 'vitest'

// These tests dynamically import the module after resetting modules so that
// environment-derived constants (like LOG_LEVEL) are re-evaluated per-test.

beforeEach(() => {
  // Clear module cache so imports pick up any env changes we set in tests
  vi.resetModules()
})

afterEach(async () => {
  // Restore any mocked stdout/stderr
  try {
    vi.restoreAllMocks()
  } catch {}

  // Ensure logger transport is cleared to a noop between tests
  const mod = await import('../../utils/structured-logger')
  // set a harmless noop transport
  mod.setLoggerTransport(() => {})
})

test('setLoggerTransport swallows synchronous transport errors', async () => {
  process.env.LOG_LEVEL = 'info'
  const mod = await import('../../utils/structured-logger')

  const transport = vi.fn(() => {
    throw new Error('transport-failure')
  })

  mod.setLoggerTransport(transport)

  const logger = mod.createLogger('mod-sync')

  // Should not throw even though transport throws
  expect(() => logger.info('hello', { a: 1 })).not.toThrow()
  expect(transport).toHaveBeenCalled()
})

test('setLoggerTransport swallows async transport rejections', async () => {
  process.env.LOG_LEVEL = 'info'
  const mod = await import('../../utils/structured-logger')

  const transport = vi.fn(() => Promise.reject(new Error('async-fail')))
  mod.setLoggerTransport(transport)

  const logger = mod.createLogger('mod-async')
  logger.info('hi', { b: 2 })

  // allow microtasks to run so the internal .catch() can attach and run
  await new Promise((r) => setImmediate(r))

  expect(transport).toHaveBeenCalled()
})

test('setConsoleJsonTransport writes a JSON entry to stdout', async () => {
  process.env.LOG_LEVEL = 'info'
  const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true as any)

  const mod = await import('../../utils/structured-logger')
  mod.setConsoleJsonTransport()

  const logger = mod.createLogger('mod-json')
  logger.info('structured', { x: 1 })

  // Find a stdout call that is valid JSON with our message
  const calls = stdoutSpy.mock.calls.map((c) => c[0])
  const jsonCall = calls.find((s) => {
    if (typeof s !== 'string') return false
    try {
      const obj = JSON.parse(s)
      return obj && obj.message === 'structured'
    } catch {
      return false
    }
  })

  expect(jsonCall).toBeTruthy()
  stdoutSpy.mockRestore()
})

test('runWithLogContext merges async context into logger.getContext()', async () => {
  process.env.LOG_LEVEL = 'info'
  const mod = await import('../../utils/structured-logger')

  const logger = mod.createLogger('mod-ctx')
  logger.setContext({ userId: 'u1' })

  mod.runWithLogContext({ workspaceId: 'ws1' }, () => {
    const ctx = logger.getContext()
    expect(ctx.userId).toBe('u1')
    expect(ctx.workspaceId).toBe('ws1')
    expect(ctx.module).toBe('mod-ctx')
    // correlationId is generated automatically and should be present
    expect(typeof ctx.correlationId).toBe('string')
    expect(ctx.correlationId.includes('-')).toBeTruthy()
  })
})

test('withSpan emits success and error spans via transport', async () => {
  process.env.LOG_LEVEL = 'debug'
  const mod = await import('../../utils/structured-logger')

  const transport = vi.fn()
  mod.setLoggerTransport(transport)

  // success path
  const v = await mod.withSpan('op-success', () => 'ok')
  expect(v).toBe('ok')

  // should have emitted at least one entry for the success span
  const successFound = transport.mock.calls.some(
    (c) => c[0] && String(c[0].message).includes('span:op-success:success')
  )
  expect(successFound).toBeTruthy()

  // error path
  await expect(
    mod.withSpan('op-error', () => {
      throw new Error('fail')
    })
  ).rejects.toThrow('fail')
  const errorFound = transport.mock.calls.some(
    (c) => c[0] && String(c[0].message).includes('span:op-error:error')
  )
  expect(errorFound).toBeTruthy()
})
