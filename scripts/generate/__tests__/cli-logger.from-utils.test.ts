import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { assertNoConsoleUsage } from '../../utils/logger'
import { log } from '../utils/logger'

describe('CLI logger targeted tests (moved to generate project)', () => {
  let logSpy: any
  let warnSpy: any
  let errorSpy: any
  let stdoutSpy: any

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true as any)
    process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'debug'
  })

  afterEach(() => {
    logSpy.mockRestore()
    warnSpy.mockRestore()
    errorSpy.mockRestore()
    stdoutSpy.mockRestore()
  })

  it('renders header and result box with details', () => {
    log.header('Moved Test Header', 'desc', { align: 'center' })
    expect(logSpy).toHaveBeenCalled()

    log.setScript('unit:script')
    log.result({ total: 2, passed: 2, failed: 0, message: 'ok', extra: 7 }, { align: 'center' })
    const calledArgs = logSpy.mock.calls.flat()
    expect(
      calledArgs.some((a: unknown) => typeof a === 'string' && a.includes('Total'))
    ).toBeTruthy()
  })

  it('progress and spinner write to stdout', () => {
    log.progressStart(2)
    log.progressTick()
    log.progressEnd()
    expect(stdoutSpy).toHaveBeenCalled()

    log.spin('x')
    log.stopSpin('done')
    expect(stdoutSpy).toHaveBeenCalled()
  })

  it('assertNoConsoleUsage validation works', () => {
    expect(() => assertNoConsoleUsage('log.warn("x")')).toThrow()
    expect(() => assertNoConsoleUsage('clean code')).not.toThrow()
  })

  it('structured logger console transport writes JSON to stdout', async () => {
    // Ensure modules are reloaded so logger picks up LOG_LEVEL from env
    vi.resetModules()
    process.env.LOG_LEVEL = 'debug'

    const { setConsoleJsonTransport, createLogger } = await import('../../utils/structured-logger')
    setConsoleJsonTransport()
    const s = createLogger('unit:structured', false)
    s.info('structured hello', { a: 1 })
    expect(stdoutSpy).toHaveBeenCalled()
    const last = stdoutSpy.mock.calls[stdoutSpy.mock.calls.length - 1][0]
    const asStr = typeof last === 'string' ? last : String(last)
    expect(asStr).toContain('structured hello')
  })
})
