import { afterEach, beforeEach, expect, test, vi } from 'vitest'

// These tests dynamically import the module after resetting modules so that
// environment-derived constants (like --ai detection and LOG_LEVEL) are
// re-evaluated per-test.

let originalArgv: string[]
let originalEnv: NodeJS.ProcessEnv

beforeEach(() => {
  // Preserve env/argv and reset module cache so imports pick up env changes
  originalArgv = process.argv.slice()
  originalEnv = { ...process.env }
  vi.resetModules()
})

afterEach(() => {
  // Restore environment and argv
  process.argv = originalArgv
  process.env = { ...originalEnv }
  try {
    vi.restoreAllMocks()
  } catch {}
})

test('serializeError and assertNoConsoleUsage behave as expected', async () => {
  const mod = await import('../../utils/logger')

  const err = new Error('boom')
  const ser = mod.serializeError(err)
  expect(ser.message).toBe('boom')
  expect(ser.name).toBe('Error')

  const ser2 = mod.serializeError('simple')
  expect(ser2).toEqual({ error: 'simple' })

  expect(() => mod.assertNoConsoleUsage('no console here')).not.toThrow()
  expect(() => mod.assertNoConsoleUsage('log.info("hi")')).toThrow()
})

test('hasCiFlag and getPassthroughFlags respect args and env', async () => {
  const mod = await import('../../utils/logger')
  // explicit arg
  expect(mod.hasCiFlag(['--ci'])).toBe(true)
  expect(mod.hasCiFlag(['--not-ci'])).toBe(false)

  // env-based
  process.env.CI = '1'
  vi.resetModules()
  const mod2 = await import('../../utils/logger')
  expect(mod2.hasCiFlag([])).toBe(true)

  // getPassthroughFlags picks up known flags and appends --ci when env indicates CI
  const flags = mod2.getPassthroughFlags(['--ai', '--pretty'])
  expect(flags).toContain('--ai')
  expect(flags).toContain('--pretty')
  expect(flags).toContain('--ci')
})

test('logger instance methods render without throwing and exercise many branches', async () => {
  // Force a verbose LOG_LEVEL so debug paths are reachable
  process.env.LOG_LEVEL = 'debug'

  // Spy output to keep tests quiet and to allow assertions if needed
  const outSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true as any)
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

  const mod = await import('../../utils/logger')
  const { log, flushAi } = mod

  // Basic setters
  log.setScript('test-script')

  // Header / start / end
  log.header('My Title', 'a description', { align: 'center' })
  log.start('deprecated start')
  log.section('Section')

  // Basic payload-like methods
  log.info('an info message')
  log.success('it worked', { x: 1 })
  log.warn('a warning', { w: true })
  log.error('an error', new Error('boom'))

  // result rendering (exercises collectResultDetails, formatting, and badge)
  log.result(
    {
      passed: 2,
      failed: 1,
      total: 3,
      warnings: 0,
      message: 'done',
      details: { duration: 123, ok: true, note: 'n' },
    },
    { align: 'start' }
  )

  // spinner/progress (use fake timers briefly)
  vi.useFakeTimers()
  log.spin('working')
  // advance timers so the internal interval would have ticked if real
  vi.advanceTimersByTime(200)
  log.stopSpin('done')
  vi.useRealTimers()

  log.progressStart(3)
  log.progressTick()
  log.progressTick(2)
  log.progressEnd()

  // tables, badges, simple result and small utilities
  log.table(
    [
      { a: '1', b: 'x' },
      { a: 'long', b: 'y' },
    ],
    { title: 'T', colors: true }
  )
  log.badge('OK', 'success')
  log.badges([{ text: 'one' }, { text: 'two', type: 'warning' }])
  log.resultSimple('Done', 'success', { align: 'center' })
  log.stat('Jobs', 4)
  log.code('log.info(1)', 'js')
  log.list(['a', 'b'], 1)
  log.failList('Fails', ['f1'])
  log.warningList('Warns', ['w1'])
  log.successList('Successes', ['s1'])
  log.assert(true, 'ok')
  log.assert(false, 'will call error')
  log.empty('nothing here')
  log.sectionStep('step-1')
  log.box('Box', 'line1\nline2')
  log.highlight('hi', 'green', true)
  log.tags(['alpha', 'beta'], 'magenta')

  expect(typeof log.text('x')).toBe('string')
  expect(typeof log.bold('b')).toBe('string')
  expect(typeof log.number(42)).toBe('string')

  log.line([{ content: 'a', color: 'green', bold: true }])
  log.progressResult({ success: 2, error: 1, warning: 0, info: 0 }, { title: 'Results' })
  log.group('g1')
  log.groupEnd()
  log.section('end')
  log.divider()
  log.step('a step')
  log.debug('a debug')

  // flushAi is no-op here (not in --ai mode) but should not throw
  flushAi()

  // ensure we called at least one output api
  expect(outSpy).toHaveBeenCalled()

  outSpy.mockRestore()
  logSpy.mockRestore()
  errSpy.mockRestore()
  warnSpy.mockRestore()
})

test('flushAi emits minimal envelope when running with --ai', async () => {
  // Simulate running node with --ai so module-level isAiMode becomes true
  const oldArgv = process.argv.slice()
  process.argv = [...oldArgv.slice(0, 2), '--ai']
  vi.resetModules()

  const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true as any)

  const mod = await import('../../utils/logger')
  // buffer is empty initially; flushAi should emit a minimal success envelope
  mod.flushAi()

  const calls = writeSpy.mock.calls.map((c) => String(c[0]))
  const found = calls.some(
    (s) => s.includes('"status":"success"') || s.includes('"status": "success"')
  )
  expect(found).toBe(true)

  writeSpy.mockRestore()
  process.argv = oldArgv
})
