import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('structured-logger extra', () => {
  let origArgv: string[]
  let origEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    origArgv = process.argv.slice()
    origEnv = { ...process.env }
  })

  afterEach(() => {
    process.argv.length = 0
    process.argv.push(...origArgv)

    for (const k of Object.keys(process.env)) {
      if (!(k in origEnv)) delete process.env[k]
    }
    for (const k of Object.keys(origEnv)) process.env[k] = origEnv[k]

    vi.restoreAllMocks()
    vi.resetModules()
  })

  it('exercises child, debug/warn/error and JSON transport', async () => {
    vi.resetModules()
    process.env.NODE_ENV = 'development'
    process.env.LOG_LEVEL = 'debug'

    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)

    const sMod = await import('../../utils/structured-logger')
    const { createLogger, setConsoleJsonTransport, setLoggerTransport } = sMod

    const transportSpy = vi.fn(() => Promise.resolve())
    setLoggerTransport(transportSpy as any)

    const logger = createLogger('x-mod', false)
    logger.debug('dmsg')
    logger.warn('wmsg')
    logger.error('emsg', new Error('boom'))

    const child = logger.child({ userId: 'u1' })
    child.info('hello child')
    expect(child.getContext().userId).toBe('u1')

    // console JSON transport writes to stdout
    setConsoleJsonTransport()
    const j = createLogger('j-mod', false)
    j.info('json-msg', { b: 2 })
    expect(stdoutSpy).toHaveBeenCalled()

    stdoutSpy.mockRestore()
    // clear transport
    setLoggerTransport(() => {})
  })
})
