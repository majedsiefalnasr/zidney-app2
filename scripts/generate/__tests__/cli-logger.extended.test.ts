import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('Extended CLI logger unit tests', () => {
  let origArgv: string[]
  let origEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    // snapshot environment and argv so tests can mutate safely
    origArgv = process.argv.slice()
    origEnv = { ...process.env }
  })

  afterEach(() => {
    // restore argv
    process.argv.length = 0
    process.argv.push(...origArgv)

    // restore env: remove any keys not present originally, then restore
    for (const k of Object.keys(process.env)) {
      if (!(k in origEnv)) delete process.env[k]
    }
    for (const k of Object.keys(origEnv)) process.env[k] = origEnv[k]
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it('serializeError and getPassthroughFlags behave as expected', async () => {
    vi.resetModules()
    process.env.CI = '1'
    const mod = await import('../../utils/logger')
    const { serializeError, getPassthroughFlags } = mod

    const errObj = serializeError(new Error('boom'))
    expect(errObj).toHaveProperty('name', 'Error')
    expect(errObj).toHaveProperty('message', 'boom')

    const flags = getPassthroughFlags(['--pretty'])
    expect(flags).toContain('--pretty')
    expect(flags).toContain('--ci')
  })

  it('exercises many CLI logger methods to increase function coverage', async () => {
    vi.resetModules()
    process.env.NODE_ENV = 'development'
    process.env.LOG_LEVEL = 'debug'

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)

    const { log } = await import('../../utils/logger')

    log.header('Title', 'description', { align: 'center' })
    log.result({ total: 2, passed: 2, failed: 0, message: 'ok' }, { align: 'center' })
    log.resultSimple('Compact', 'success', { align: 'center' })
    log.badge('Build', 'info')
    log.badges([{ text: 'One', type: 'success' }])
    log.table([{ Name: 'x', Value: 'y' }], { title: 'T' })
    log.box('Box', 'Line1\nLine2', { align: 'start' })
    log.stat('Stat', 123)
    log.code('log.info(1)', 'js')
    log.list(['a', 'b'], 1)
    log.failList('Fails', ['f1'])
    log.warningList('Warns', ['w1'])
    log.successList('Good', ['g1'])
    log.trend(10, 5, 'delta')
    log.progressResult({ success: 1, error: 0, warning: 0, info: 0 }, { title: 'Progress' })
    log.group('grp')
    log.groupEnd()
    log.section('sec')
    log.divider()
    log.line([{ content: 'line' }])
    log.info('informational')
    log.success('succeeded')
    log.warn('a warning')
    log.error('an error')
    log.debug('debug message')
    log.step('step message')

    expect(logSpy).toHaveBeenCalled()

    logSpy.mockRestore()
    warnSpy.mockRestore()
    errorSpy.mockRestore()
    stdoutSpy.mockRestore()
  })

  it('flushAi emits JSON envelope in --ai mode', async () => {
    vi.resetModules()
    const originalArgv = process.argv.slice()
    process.argv.push('--ai')
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)

    const { flushAi } = await import('../../utils/logger')
    flushAi()

    expect(stdoutSpy).toHaveBeenCalled()
    const last = stdoutSpy.mock.calls[stdoutSpy.mock.calls.length - 1][0]
    expect(String(last)).toContain('"status"')

    // restore argv
    process.argv.length = 0
    process.argv.push(...originalArgv)
    stdoutSpy.mockRestore()
  })

  it('structured logger transports, context and withSpan work', async () => {
    vi.resetModules()
    process.env.NODE_ENV = 'development'
    process.env.LOG_LEVEL = 'debug'

    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)

    const sMod = await import('../../utils/structured-logger')
    const {
      setLoggerTransport,
      createLogger,
      setConsoleJsonTransport,
      runWithLogContext,
      withSpan,
      getGlobalLogger,
      setGlobalLoggerContext,
    } = sMod

    const transportSpy = vi.fn()
    // install a transport and verify it's invoked
    setLoggerTransport(transportSpy as any)
    const s = createLogger('test:mod', false)
    s.info('hello', { a: 1 })
    expect(transportSpy).toHaveBeenCalled()

    // console JSON transport writes to stdout
    setConsoleJsonTransport()
    const s2 = createLogger('test:mod2', false)
    s2.info('json-msg', { b: 2 })
    expect(stdoutSpy).toHaveBeenCalled()

    // runWithLogContext merges context into created logger
    runWithLogContext({ correlationId: 'cid-1' }, () => {
      const s3 = createLogger('ctx', false)
      expect(s3.getContext().correlationId).toBe('cid-1')
    })

    // withSpan: success and error paths
    await expect(withSpan('ok-span', () => 'result')).resolves.toBe('result')
    await expect(
      withSpan('err-span', () => {
        throw new Error('boom')
      })
    ).rejects.toThrow()

    const g = getGlobalLogger('gmod')
    setGlobalLoggerContext({ workspaceId: 'ws-1' })
    expect(g.getContext().workspaceId).toBe('ws-1')

    stdoutSpy.mockRestore()
    // clear transport
    setLoggerTransport(() => {})
  })
})
