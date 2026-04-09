import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { assertNoConsoleUsage } from '../logger'
import { createLogger, setConsoleJsonTransport } from '../structured-logger'
import { log } from '../utils/logger'

describe('CLI logger targeted tests', () => {
  let logSpy: any
  let warnSpy: any
  let errorSpy: any
  let stdoutSpy: any

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true as any)
    // Ensure LOG_LEVEL allows info/debug messages in tests
    process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'debug'
  })

  afterEach(() => {
    logSpy.mockRestore()
    warnSpy.mockRestore()
    errorSpy.mockRestore()
    stdoutSpy.mockRestore()
  })

  it('renders header and result box with details', () => {
    // header should render without throwing
    log.header('Unit Test Header', 'a short description', { align: 'center' })
    expect(logSpy).toHaveBeenCalled()

    // result should include totals and custom detail metrics
    log.setScript('unit:script')
    log.result(
      {
        total: 4,
        passed: 3,
        failed: 1,
        warnings: 1,
        message: 'completed',
        extraMetric: 42,
        featureEnabled: true,
        nullable: null,
      },
      { align: 'center' }
    )

    // ensure something meaningful was printed
    const calledArgs = logSpy.mock.calls.flat()
    const anyContainTotal = calledArgs.some(
      (a: unknown) => typeof a === 'string' && a.includes('Total')
    )
    expect(anyContainTotal).toBeTruthy()
  })

  it('progress bar and spinner operate without throwing and write to stdout', () => {
    log.progressStart(3)
    log.progressTick()
    log.progressTick()
    log.progressEnd()
    expect(stdoutSpy).toHaveBeenCalled()

    log.spin('working')
    // stop immediately; spinner.stop writes a final clear and optional text
    log.stopSpin('done')
    expect(stdoutSpy).toHaveBeenCalled()
  })

  it('renders simple result box and badges', () => {
    log.resultSimple('All Good', 'success', { align: 'center' })
    expect(logSpy).toHaveBeenCalled()

    log.badge('Deployed', 'success')
    log.badges([{ text: 'one' }, { text: 'two', type: 'warning' }])
    expect(logSpy).toHaveBeenCalled()
  })

  it('box, table and list helpers do not crash', () => {
    log.box('Title', 'line one\nline two')
    log.table(
      [
        { name: 'a', status: 'PASS' },
        { name: 'b', status: 'FAIL' },
      ],
      { title: 'T' }
    )
    log.list(['first', 'second'])
    expect(logSpy).toHaveBeenCalled()
  })

  it('assertNoConsoleUsage throws on raw console usage', () => {
    expect(() => assertNoConsoleUsage('some code with log.info("x")')).toThrow()
    expect(() => assertNoConsoleUsage('no console here')).not.toThrow()
  })

  it('structured logger console transport writes JSON to stdout', () => {
    setConsoleJsonTransport()
    const s = createLogger('unit:structured', false)
    s.info('structured hello', { a: 1 })
    // transport writes one or more JSON lines to stdout
    expect(stdoutSpy).toHaveBeenCalled()
    const last = stdoutSpy.mock.calls[stdoutSpy.mock.calls.length - 1][0]
    const asStr = typeof last === 'string' ? last : String(last)
    expect(asStr).toContain('structured hello')
  })
})
