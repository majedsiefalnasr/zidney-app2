/*
 * Zidney Shared Logger
 * Supports:
 * - Normal mode (human-friendly UX)
 * - --ai mode (JSON + minimal summary)
 * - Duration tracking
 * - Lightweight spinner
 */

import { AsyncLocalStorage } from 'node:async_hooks'

type LogLevel = 'info' | 'success' | 'warn' | 'error' | 'step'

type AiStatus = 'success' | 'error' | 'warning' | 'info'

interface AiLogPayload {
  status: AiStatus
  script?: string
  message?: string
  duration_ms?: number
  data?: LogData
}

type LogData = Record<string, unknown>

function serializeError(err: unknown): LogData {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: err.stack,
    }
  }
  return { error: String(err) }
}

const isAiMode = process.argv.includes('--ai')
const isCI = process.env.CI === 'true' || process.env.CI === '1'

const isSilent = process.argv.includes('--silent')

const LOG_LEVEL = (process.env.LOG_LEVEL || 'info') as StructuredLogLevel

const levelPriority: Record<StructuredLogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

const LOG_SAMPLE_RATE = Number(process.env.LOG_SAMPLE_RATE || '1')

const NODE_ENV = process.env.NODE_ENV || 'development'

function applyEnvDefaults() {
  if (NODE_ENV === 'production') {
    process.env.LOG_LEVEL ||= 'warn'
  }

  if (NODE_ENV === 'test') {
    process.env.LOG_LEVEL ||= 'error'
  }
}

applyEnvDefaults()

function shouldSample(): boolean {
  if (LOG_SAMPLE_RATE >= 1) return true
  return Math.random() < LOG_SAMPLE_RATE
}

function shouldLog(level: StructuredLogLevel): boolean {
  return levelPriority[level] >= levelPriority[LOG_LEVEL] && shouldSample()
}

const symbols: Record<LogLevel, string> = {
  info: 'ℹ',
  success: '✔',
  warn: '⚠',
  error: '✖',
  step: '•',
}

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  white: '\x1b[37m',
  bgGreen: '\x1b[42m',
  bgRed: '\x1b[41m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
}

function colorize(level: LogLevel, text: string): string {
  if (isAiMode) return text

  switch (level) {
    case 'success':
      return `${colors.green}${text}${colors.reset}`
    case 'error':
      return `${colors.red}${text}${colors.reset}`
    case 'warn':
      return `${colors.yellow}${text}${colors.reset}`
    case 'info':
      return `${colors.blue}${text}${colors.reset}`
    case 'step':
      return `${colors.cyan}${text}${colors.reset}`
    default:
      return text
  }
}

function format(level: LogLevel, message: string): string {
  if (isAiMode) return message
  const symbol = symbols[level]
  return colorize(level, `${symbol} ${message}`)
}

// --- AI batching (explicit flush, CI-safe) ---
const aiBuffer: AiLogPayload[] = []

function pushAi(payload: AiLogPayload) {
  aiBuffer.push(payload)
}

export function flushAi() {
  if (!isAiMode || aiBuffer.length === 0) return

  const output = {
    status: aiBuffer.some((p) => p.status === 'error') ? 'error' : 'success',
    count: aiBuffer.length,
    duration_ms: aiBuffer.reduce((acc, p) => acc + (p.duration_ms || 0), 0),
    entries: aiBuffer,
  }

  process.stdout.write(`${JSON.stringify(output)}\n`)
}

// lightweight spinner
const spinnerFrames = ['-', '\\', '|', '/']

class Spinner {
  private i = 0
  private timer?: NodeJS.Timeout

  start(text: string) {
    if (isAiMode || isCI || isSilent) return
    this.timer = setInterval(() => {
      this.i = (this.i + 1) % spinnerFrames.length
      const frame = spinnerFrames[this.i]
      process.stdout.write(`\r${frame} ${text}`)
    }, 80)
  }

  stop(finalText?: string) {
    if (isAiMode || isCI || isSilent) return
    if (this.timer) clearInterval(this.timer)
    process.stdout.write('\r\x1b[K')
    if (finalText) console.log(finalText)
  }
}

class ProgressBar {
  private total = 0
  private current = 0

  start(total: number) {
    if (isAiMode || isCI || isSilent) return
    this.total = total
    this.current = 0
    this.render()
  }

  tick(step = 1) {
    if (isAiMode || isCI || isSilent) return
    this.current += step
    this.render()
  }

  end() {
    if (isAiMode || isCI || isSilent) return
    this.current = this.total
    this.render()
    process.stdout.write('\r\x1b[K\n')
  }

  private render() {
    const width = 20
    const ratio = this.total ? this.current / this.total : 0
    const filled = Math.round(width * ratio)
    const bar = '█'.repeat(filled) + '░'.repeat(width - filled)
    const percent = Math.round(ratio * 100)
    process.stdout.write(`\r[${bar}] ${percent}%`)
  }
}

class Logger {
  private scriptName?: string
  private startTime?: number
  private spinner = new Spinner()
  private progress = new ProgressBar()
  private groupLevel = 0

  setScript(name: string) {
    this.scriptName = name
  }

  start(title: string) {
    this.startTime = Date.now()
    if (isAiMode || isSilent) return
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log(`▶ START: ${title}`)
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`)
  }

  header(title: string, description?: string) {
    this.startTime = Date.now()

    if (isAiMode || isSilent) return

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log(title.toUpperCase())
    if (description) console.log(description)
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`)
  }

  end(message: string) {
    const duration = this.startTime ? Date.now() - this.startTime : undefined

    if (isAiMode || isSilent) {
      if (isAiMode) {
        pushAi({
          status: 'success',
          script: this.scriptName,
          message,
          duration_ms: duration,
        })
      }
      return
    }

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log(`■ SUMMARY`)
    console.log(`${message}${duration ? ` (${duration}ms)` : ''}`)
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`)
  }

  result(summary: { passed?: number; failed?: number; total?: number; message?: string }) {
    const duration = this.startTime ? Date.now() - this.startTime : undefined

    if (isAiMode || isSilent) {
      if (isAiMode) {
        pushAi({
          status: summary.failed && summary.failed > 0 ? 'error' : 'success',
          script: this.scriptName,
          message: summary.message,
          duration_ms: duration,
          data: {
            passed: summary.passed,
            failed: summary.failed,
            total: summary.total,
          },
        })
      }
      return
    }

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log(`${colors.bold}RESULT${colors.reset}`)

    if (summary.total !== undefined) {
      console.log(`${colors.bold}Total:${colors.reset} ${summary.total}`)
    }

    if (summary.passed !== undefined) {
      const passedColor = summary.passed > 0 ? colors.green : colors.dim
      console.log(
        `${colors.bold}Passed:${colors.reset} ${passedColor}${summary.passed}${colors.reset}`
      )
    }

    if (summary.failed !== undefined) {
      const failedColor = summary.failed > 0 ? colors.red : colors.dim
      console.log(
        `${colors.bold}Failed:${colors.reset} ${failedColor}${summary.failed}${colors.reset}`
      )
    }

    if (summary.message) {
      const messageColor =
        summary.failed && summary.failed > 0
          ? colors.red
          : summary.failed === 0
            ? colors.green
            : colors.yellow
      console.log(`${messageColor}${summary.message}${colors.reset}`)
    }

    if (duration) {
      console.log(`${colors.dim}Duration: ${duration}ms${colors.reset}`)
    }

    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`)
  }

  spin(text: string) {
    this.spinner.start(text)
  }

  stopSpin(text?: string) {
    this.spinner.stop(text)
  }

  progressStart(total: number) {
    this.progress.start(total)
  }

  progressTick(step = 1) {
    this.progress.tick(step)
  }

  progressEnd() {
    this.progress.end()
  }

  table(
    rows: Array<Record<string, string>>,
    options?: { title?: string; colors?: boolean; borderless?: boolean }
  ) {
    if (isAiMode || isSilent) return
    if (rows.length === 0) return

    if (options?.title) {
      console.log(`\n${colors.bold}${options.title}${colors.reset}`)
    }

    const columns = Object.keys(rows[0])
    const colWidths = columns.map((col) =>
      Math.max(col.length, ...rows.map((row) => String(row[col] || '').length))
    )

    // Header
    const header = columns
      .map((col, i) => col.padEnd(colWidths[i]))
      .join(options?.borderless ? '   ' : ' │ ')
    console.log(`${colors.bold}${header}${colors.reset}`)

    if (!options?.borderless) {
      console.log(columns.map((_, i) => '─'.repeat(colWidths[i])).join('─┼─'))
    }

    // Rows
    for (const row of rows) {
      let line = columns
        .map((col, i) => {
          const value = String(row[col] || '')
          return value.padEnd(colWidths[i])
        })
        .join(options?.borderless ? '   ' : ' │ ')

      // Color code based on status/result column
      const statusCol = row.status || row.result || row.Status || row.Result
      if (statusCol && options?.colors !== false) {
        if (statusCol.includes('✓') || statusCol.toUpperCase().includes('PASS')) {
          line = `${colors.green}${line}${colors.reset}`
        } else if (statusCol.includes('✖') || statusCol.toUpperCase().includes('FAIL')) {
          line = `${colors.red}${line}${colors.reset}`
        } else if (statusCol.includes('⚠') || statusCol.toUpperCase().includes('WARN')) {
          line = `${colors.yellow}${line}${colors.reset}`
        }
      }

      console.log(line)
    }

    console.log('')
  }

  badge(text: string, type: 'success' | 'error' | 'warning' | 'info' | 'gray' = 'info') {
    if (isAiMode || isSilent) return

    const badges: Record<string, { bg: string; symbol: string }> = {
      success: { bg: colors.bgGreen, symbol: '✓' },
      error: { bg: colors.bgRed, symbol: '✖' },
      warning: { bg: colors.bgYellow, symbol: '⚠' },
      info: { bg: colors.bgBlue, symbol: 'ℹ' },
      gray: { bg: '\x1b[48;5;8m', symbol: '◆' }, // Gray background
    }

    const badge = badges[type]
    console.log(`${badge.bg}${colors.bold}${colors.white} ${badge.symbol} ${text} ${colors.reset}`)
  }

  badges(items: Array<{ text: string; type?: 'success' | 'error' | 'warning' | 'info' | 'gray' }>) {
    if (isAiMode || isSilent) return

    const badgeMap: Record<string, { bg: string; symbol: string }> = {
      success: { bg: colors.bgGreen, symbol: '✓' },
      error: { bg: colors.bgRed, symbol: '✖' },
      warning: { bg: colors.bgYellow, symbol: '⚠' },
      info: { bg: colors.bgBlue, symbol: 'ℹ' },
      gray: { bg: '\x1b[48;5;8m', symbol: '◆' },
    }

    const rendered = items
      .map((item) => {
        const type = item.type || 'info'
        const badge = badgeMap[type]
        return `${badge.bg}${colors.bold}${colors.white} ${badge.symbol} ${item.text} ${colors.reset}`
      })
      .join('')

    console.log(rendered)
  }

  stat(label: string, value: string | number, color: keyof typeof colors = 'cyan') {
    if (isAiMode || isSilent) return
    const colorCode = colors[color] || colors.cyan
    console.log(`${colors.bold}${label}${colors.reset}: ${colorCode}${value}${colors.reset}`)
  }

  code(text: string, language: string = 'text') {
    if (isAiMode || isSilent) return
    console.log(`\n${colors.dim}┌─ ${language}${colors.reset}`)
    console.log(`${colors.blue}${text}${colors.reset}`)
    console.log(`${colors.dim}└─${colors.reset}\n`)
  }

  list(items: string[], indent: number = 0) {
    if (isAiMode || isSilent) return
    const padding = ' '.repeat(indent)
    for (const item of items) {
      console.log(`${padding}${colors.cyan}▪${colors.reset} ${item}`)
    }
  }

  box(title: string, content: string) {
    if (isAiMode || isSilent) return
    const width = Math.max(title.length, content.length) + 4
    const top = `┌${'─'.repeat(width - 2)}┐`
    const titleLine = `│ ${colors.bold}${title.padEnd(width - 4)}${colors.reset} │`
    const contentLine = `│ ${content.padEnd(width - 4)} │`
    const bottom = `└${'─'.repeat(width - 2)}┘`

    console.log(`\n${top}`)
    console.log(titleLine)
    console.log(contentLine)
    console.log(`${bottom}\n`)
  }

  highlight(text: string, color: keyof typeof colors = 'yellow', bold: boolean = true) {
    if (isAiMode || isSilent) return
    const colorCode = colors[color] || colors.yellow
    const formatted = bold
      ? `${colors.bold}${colorCode}${text}${colors.reset}`
      : `${colorCode}${text}${colors.reset}`
    console.log(formatted)
  }

  tags(items: string[], color: keyof typeof colors = 'magenta') {
    if (isAiMode || isSilent) return
    const colorCode = colors[color] || colors.magenta
    const rendered = items.map((item) => `${colorCode}#${item}${colors.reset}`).join('  ')
    console.log(rendered)
  }

  text(content: string, color: keyof typeof colors = 'white') {
    if (isAiMode || isSilent) return
    const colorCode = colors[color] || colors.white
    return `${colorCode}${content}${colors.reset}`
  }

  bold(content: string, color: keyof typeof colors | 'none' = 'none') {
    if (isAiMode || isSilent) return ''
    const colorCode = color === 'none' ? '' : colors[color as keyof typeof colors] || ''
    return `${colors.bold}${colorCode}${content}${colors.reset}`
  }

  number(value: number | string, color: keyof typeof colors = 'cyan') {
    if (isAiMode || isSilent) return ''
    const colorCode = colors[color] || colors.cyan
    return `${colorCode}${value}${colors.reset}`
  }

  line(elements: Array<{ content: string; color?: keyof typeof colors; bold?: boolean }>) {
    if (isAiMode || isSilent) return

    const rendered = elements
      .map((el) => {
        const colorCode = el.color ? colors[el.color] || '' : ''
        const bold = el.bold ? colors.bold : ''
        return `${bold}${colorCode}${el.content}${colors.reset}`
      })
      .join(' ')

    console.log(rendered)
  }

  progressResult(
    stats: {
      success?: number
      error?: number
      warning?: number
      info?: number
    },
    options?: { title?: string; showPercentage?: boolean }
  ) {
    if (isAiMode || isSilent) return

    const title = options?.title || 'Results'
    const showPercentage = options?.showPercentage !== false

    const success = stats.success || 0
    const error = stats.error || 0
    const warning = stats.warning || 0
    const info = stats.info || 0
    const total = success + error + warning + info || 1

    const successPct = (success / total) * 100
    const errorPct = (error / total) * 100
    const warningPct = (warning / total) * 100
    const infoPct = (info / total) * 100

    const barWidth = 30
    const successWidth = Math.round((successPct / 100) * barWidth)
    const errorWidth = Math.round((errorPct / 100) * barWidth)
    const warningWidth = Math.round((warningPct / 100) * barWidth)
    const infoWidth = Math.max(0, barWidth - successWidth - errorWidth - warningWidth)

    const successSegment = colors.bgGreen + ' '.repeat(successWidth) + colors.reset
    const errorSegment = colors.bgRed + ' '.repeat(errorWidth) + colors.reset
    const warningSegment = colors.bgYellow + ' '.repeat(warningWidth) + colors.reset
    const infoSegment = colors.bgBlue + ' '.repeat(infoWidth) + colors.reset

    const bar = successSegment + errorSegment + warningSegment + infoSegment

    console.log(`\n${title}`)
    console.log(bar)

    if (showPercentage) {
      const entries = []
      if (success > 0)
        entries.push(
          `${colors.green}✓ Success ${success} (${Math.round(successPct)}%)${colors.reset}`
        )
      if (error > 0)
        entries.push(`${colors.red}✖ Error ${error} (${Math.round(errorPct)}%)${colors.reset}`)
      if (warning > 0)
        entries.push(
          `${colors.yellow}⚠ Warning ${warning} (${Math.round(warningPct)}%)${colors.reset}`
        )
      if (info > 0)
        entries.push(`${colors.blue}ℹ Info ${info} (${Math.round(infoPct)}%)${colors.reset}`)

      console.log(entries.join(' │ '))
    }
  }

  group(title: string) {
    if (isAiMode || isSilent) return
    this.groupLevel++
    const indent = '  '.repeat(this.groupLevel - 1)
    console.log(`\n${indent}▶ ${title}`)
  }

  groupEnd() {
    if (isAiMode || isSilent) return
    this.groupLevel = Math.max(0, this.groupLevel - 1)
  }

  section(title: string) {
    if (isAiMode || isSilent) return
    console.log(`\n━━ ◼ ${title.toUpperCase()} ━━`)
  }

  divider() {
    if (isAiMode || isSilent) return
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  }

  info(message: string) {
    if (isAiMode || isSilent) {
      if (isAiMode) {
        pushAi({ status: 'info', script: this.scriptName, message })
      }
      return
    }
    console.log(format('info', message))
  }

  success(message: string, data?: LogData) {
    if (isAiMode || isSilent) {
      if (isAiMode) {
        pushAi({ status: 'success', script: this.scriptName, message, data })
      }
      return
    }
    console.log(format('success', message))
  }

  warn(message: string, data?: LogData) {
    if (isAiMode || isSilent) {
      if (isAiMode) {
        pushAi({ status: 'warning', script: this.scriptName, message, data })
      }
      return
    }
    console.log(format('warn', message))
  }

  error(message: string, data?: LogData | Error) {
    const duration = this.startTime ? Date.now() - this.startTime : undefined

    const normalizedData = data instanceof Error ? serializeError(data) : data

    if (isAiMode || isSilent) {
      if (isAiMode) {
        pushAi({
          status: 'error',
          script: this.scriptName,
          message,
          data: normalizedData,
          duration_ms: duration,
        })
      }
      return
    }

    console.error(format('error', message))
    if (normalizedData) {
      console.error(JSON.stringify(normalizedData, null, 2))
    }
  }

  step(message: string) {
    if (isAiMode || isSilent) return
    const indent = '  '.repeat(this.groupLevel)
    console.log(`${indent}${format('step', message)}`)
  }

  debug(message: string, data?: LogData) {
    if (isAiMode || isSilent) {
      if (isAiMode) {
        pushAi({ status: 'info', script: this.scriptName, message, data })
      }
      return
    }
    console.log(format('info', `[DEBUG] ${message}`))
  }
}

export const log = new Logger()

export function assertNoConsoleUsage(source: string) {
  if (/console\.(log|error|warn|info)\(/.test(source)) {
    throw new Error('Raw console usage detected. Use shared logger instead.')
  }
}

// --- Structured Logger Adapter and compatibility exports ---------------------------------

export type StructuredLogLevel = 'debug' | 'info' | 'warn' | 'error'

// Backwards-compat alias for older callers that expect a LogLevel type name
export type StructuredLogLevelAlias = StructuredLogLevel

export interface LogContext {
  correlationId?: string
  workspaceSlug?: string
  workspaceId?: string
  userId?: string
  attemptId?: string
  module?: string
}

const asyncContext = new AsyncLocalStorage<LogContext>()

function getAsyncContext(): LogContext | undefined {
  return asyncContext.getStore()
}

export function runWithLogContext<T>(context: LogContext, fn: () => T): T {
  return asyncContext.run(context, fn)
}

export interface LogEntry {
  timestamp: string
  level: StructuredLogLevel
  message: string
  context: LogContext
  metadata?: Record<string, unknown>
}

function generateCorrelationId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

export interface StructuredLogger {
  setContext(context: Partial<LogContext>): void
  getContext(): LogContext
  debug(message: string, metadata?: Record<string, unknown>): void
  info(message: string, metadata?: Record<string, unknown>): void
  warn(message: string, metadata?: Record<string, unknown>): void
  error(message: string, metadata?: Record<string, unknown>): void
  child(context: Partial<LogContext>): StructuredLogger
}

class StructuredLoggerAdapter implements StructuredLogger {
  private static transport?: (entry: LogEntry) => void | Promise<void>

  static setTransport(fn: (entry: LogEntry) => void | Promise<void>) {
    StructuredLoggerAdapter.transport = fn
  }

  private context: LogContext

  constructor(
    private moduleName: string,
    private jsonOutput = false
  ) {
    this.context = { module: moduleName, correlationId: generateCorrelationId() }
    try {
      log.setScript(moduleName)
    } catch {
      // ignore
    }
  }

  setContext(context: Partial<LogContext>): void {
    this.context = { ...this.context, ...context }
  }

  getContext(): LogContext {
    return { ...this.context, ...(getAsyncContext() || {}) }
  }

  private emit(level: StructuredLogLevel, message: string, metadata?: Record<string, unknown>) {
    if (!shouldLog(level)) return

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: this.getContext(),
      metadata: metadata instanceof Error ? serializeError(metadata) : metadata,
    }

    // send to external transport if configured
    if (StructuredLoggerAdapter.transport) {
      try {
        const res = StructuredLoggerAdapter.transport(entry)
        if (res instanceof Promise) {
          res.catch(() => {})
        }
      } catch {
        // ignore transport failures
      }
    }

    if (this.jsonOutput) {
      console.log(JSON.stringify(entry))
      return
    }

    // human-friendly: delegate to CLI logger when possible
    if (level === 'error') {
      log.error(message, metadata)
    } else if (level === 'warn') {
      log.warn(message, metadata)
    } else {
      if (metadata && Object.keys(metadata).length > 0) {
        try {
          log.info(`${message} ${JSON.stringify(metadata)}`)
        } catch {
          console.log(`${message} ${JSON.stringify(metadata)}`)
        }
      } else {
        log.info(message)
      }
    }
  }

  debug(message: string, metadata?: Record<string, unknown>): void {
    this.emit('debug', message, metadata)
  }

  info(message: string, metadata?: Record<string, unknown>): void {
    this.emit('info', message, metadata)
  }

  warn(message: string, metadata?: Record<string, unknown>): void {
    this.emit('warn', message, metadata)
  }

  error(message: string, metadata?: Record<string, unknown>): void {
    this.emit('error', message, metadata)
  }

  child(context: Partial<LogContext>): StructuredLogger {
    const child = new StructuredLoggerAdapter(this.moduleName, this.jsonOutput)
    child.setContext({ ...this.context, ...context })
    return child
  }
}

let _globalStructuredLogger: StructuredLogger | null = null

export function createLogger(moduleName: string, jsonOutput = false): StructuredLogger {
  return new StructuredLoggerAdapter(moduleName, jsonOutput)
}

export function setLoggerTransport(fn: (entry: LogEntry) => void | Promise<void>) {
  StructuredLoggerAdapter.setTransport(fn)
}

export function setConsoleJsonTransport() {
  setLoggerTransport((entry) => {
    process.stdout.write(`${JSON.stringify(entry)}\n`)
  })
}

export function getGlobalLogger(moduleName = 'global'): StructuredLogger {
  if (!_globalStructuredLogger) {
    _globalStructuredLogger = createLogger(moduleName)
  }
  return _globalStructuredLogger
}

export function setGlobalLoggerContext(context: Partial<LogContext>): void {
  getGlobalLogger().setContext(context)
}

export function logDebug(message: string, metadata?: Record<string, unknown>): void {
  getGlobalLogger().debug(message, metadata)
}

export function logInfo(message: string, metadata?: Record<string, unknown>): void {
  getGlobalLogger().info(message, metadata)
}

export function logWarn(message: string, metadata?: Record<string, unknown>): void {
  getGlobalLogger().warn(message, metadata)
}

export function logError(message: string, metadata?: Record<string, unknown>): void {
  getGlobalLogger().error(message, metadata)
}

export async function withSpan<T>(name: string, fn: () => Promise<T> | T): Promise<T> {
  const start = Date.now()
  try {
    const result = await fn()
    logDebug(`span:${name}:success`, { duration_ms: Date.now() - start })
    return result
  } catch (err: unknown) {
    const meta: Record<string, unknown> =
      err instanceof Error ? serializeError(err) : { error: String(err) }
    logError(`span:${name}:error`, meta)
    throw err
  }
}
