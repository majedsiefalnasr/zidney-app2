import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('Additional CLI logger unit tests', () => {
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

  it('getPassthroughFlags / hasCiFlag / shouldLog respect env and args', async () => {
    vi.resetModules()
    process.env.CI = '1'
    process.env.LOG_SAMPLE_RATE = '0'
    process.env.LOG_LEVEL = 'error'

    const mod1 = await import('../../utils/logger')
    const { hasCiFlag, getPassthroughFlags, shouldLog } = mod1

    expect(hasCiFlag([])).toBe(true)
    const flags = getPassthroughFlags([])
    expect(flags).toContain('--ci')
    // LOG_SAMPLE_RATE=0 forces shouldLog -> false for debug
    expect(shouldLog('debug')).toBe(false)

    // now try a different LOG_LEVEL + sample rate
    vi.resetModules()
    process.env.LOG_SAMPLE_RATE = '1'
    process.env.LOG_LEVEL = 'debug'
    const mod2 = await import('../../utils/logger')
    expect(mod2.shouldLog('debug')).toBe(true)
  })

  it('result formatting collects details and produces output', async () => {
    vi.resetModules()
    process.env.NODE_ENV = 'development'
    process.env.LOG_BOX_WIDTH = '40'

    const logCalls: string[] = []
    const logSpy = vi.spyOn(console, 'log').mockImplementation((...args: any[]) => {
      logCalls.push(String(args.join(' ')))
    })

    const { log } = await import('../../utils/logger')

    log.result({
      passed: 1,
      total: 1,
      message: 'All good',
      foo: 'bar',
      details: { count: 3, ok: true, empty: null },
    })

    expect(logCalls.length).toBeGreaterThan(0)
    // header/top badge present
    const joined = logCalls.join('\n')
    expect(joined).toContain('SUCCESS')

    logSpy.mockRestore()
  })

  it('flushAi emits non-empty JSON when AI buffer populated', async () => {
    vi.resetModules()
    process.argv.push('--ai')

    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)

    const mod = await import('../../utils/logger')
    const { log, flushAi } = mod

    log.success('op', { debug: 1 })
    flushAi()

    expect(stdoutSpy).toHaveBeenCalled()
    const last = String(stdoutSpy.mock.calls[stdoutSpy.mock.calls.length - 1][0])
    expect(last).toContain('"status"')

    stdoutSpy.mockRestore()
  })

  it('assertNoConsoleUsage throws on raw console usage and table/box/code render', async () => {
    vi.resetModules()
    process.env.NODE_ENV = 'development'

    const { assertNoConsoleUsage, log } = await import('../../utils/logger')

    expect(() => assertNoConsoleUsage('const x = 1')).not.toThrow()
    expect(() => assertNoConsoleUsage('log.info("x")')).toThrow()

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    // table with borderless option
    log.table([{ Name: 'n', Value: 'v' }], { title: 'T', borderless: true })
    log.code('log.info(1)', 'js')
    // box with long content to trigger wrapping
    log.box('Title', 'long '.repeat(20))

    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })
})
