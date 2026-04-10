import { describe, expect, it } from 'vitest'
import { getGlobalLogger, setGlobalLoggerContext, setLoggerTransport } from '../structured-logger'

describe('global structured logger', () => {
  it('getGlobalLogger returns a singleton and respects context', () => {
    const received: any[] = []
    setLoggerTransport((entry) => received.push(entry))

    const g = getGlobalLogger('global-test')
    g.info('start')

    setGlobalLoggerContext({ correlationId: 'cid-xyz' })
    g.info('after')

    const e = received.find((r) => r.message === 'after')
    expect(e).toBeDefined()
    expect(e.context.correlationId).toBe('cid-xyz')
  })
})
