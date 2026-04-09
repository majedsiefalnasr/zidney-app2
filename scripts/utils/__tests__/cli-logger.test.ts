import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { assertNoConsoleUsage } from '../logger'
import { createLogger, setConsoleJsonTransport, setLoggerTransport } from '../structured-logger'
import { log } from '../utils/logger'

describe('CLI logger surface', () => {
  let logSpy: any
  let writeSpy: any

  beforeEach(() => {
    // silence transports between tests
    setLoggerTransport(() => undefined)
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true as any)
  })

  afterEach(() => {
    logSpy.mockRestore()
    writeSpy.mockRestore()
    setLoggerTransport(() => undefined)
  })

  it('assertNoConsoleUsage throws when raw console usage is present', () => {
    expect(() => assertNoConsoleUsage("log.info('x')")).toThrow()
    expect(() => assertNoConsoleUsage('function foo() {}')).not.toThrow()
  })

  it('header prints an uppercase title', () => {
    log.header('My Test Title', 'extra')
    const combined = logSpy.mock.calls.map((c: any[]) => String(c[0])).join('\n')
    expect(combined).toContain('MY TEST TITLE')
  })

  it('result prints a summary block', () => {
    log.header('Summary Test')
    log.result({ total: 3, passed: 2, failed: 1, warnings: 0, message: 'done' })
    const joined = logSpy.mock.calls.map((c: any[]) => String(c[0])).join('\n')
    expect(joined).toContain('SUMMARY')
    expect(joined).toContain('done')
  })

  it('setConsoleJsonTransport writes structured JSON entries to stdout', () => {
    setConsoleJsonTransport()
    const logger = createLogger('cli-json-test')
    logger.info('hello', { a: 1 })
    // transport writes a JSON line to stdout
    expect(writeSpy).toHaveBeenCalled()
    const found = writeSpy.mock.calls.find((c: any[]) => String(c[0]).includes('"message":"hello"'))
    expect(found).toBeDefined()
  })
})
