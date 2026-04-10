import { describe, expect, it, vi } from 'vitest'
import { createLogger, runWithLogContext, setLoggerTransport } from '../../utils/structured-logger'

describe('structured-logger adapter', () => {
  it('invokes configured transport with LogEntry', () => {
    const spy = vi.fn()
    setLoggerTransport(spy)

    const logger = createLogger('test-module')
    logger.info('hello', { x: 1 })

    expect(spy).toHaveBeenCalled()
    const arg = spy.mock.calls[0][0]
    expect(arg).toHaveProperty('message')
    expect(arg.message).toMatch(/hello/)
  })

  it('merges async context via runWithLogContext', () => {
    const res = runWithLogContext({ workspaceId: 'ws1' }, () => {
      const logger = createLogger('ctx-test')
      return logger.getContext()
    })

    expect(res.workspaceId).toBe('ws1')
  })
})
