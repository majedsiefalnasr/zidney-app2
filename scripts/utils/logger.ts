/**
 * Zidney Shared Logger
 *
 * Shared terminal logger used across the Zidney monorepo. This module
 * provides a human-friendly CLI logger with colorized output, an AI-mode
 * JSON summary emitter (`--ai`), and small UX helpers like spinners and
 * progress bars. It is intentionally minimal and dependency-free so it can
 * be used in scripts, CI checks, and local developer tooling.
 *
 * Exports:
 * - `log`: default `Logger` instance used by scripts
 * - `flushAi()`: flush collected AI logs as JSON when running with `--ai`
 * - `exit(code)`: flush AI logs and exit the process safely
 *
 * Notes:
 * - Methods check `--ai` and `--silent` flags and become no-ops when set.
 * - Colors use ANSI escape codes and are disabled in AI mode.
 */

import { AsyncLocalStorage } from 'node:async_hooks'
import stringWidth from 'string-width'

type LogLevel = 'info' | 'success' | 'warn' | 'error' | 'step'

type AiStatus = 'success' | 'error' | 'warning' | 'info'

type Align = 'start' | 'center' | 'end'

interface AiLogPayload {
  status: AiStatus
  script?: string
  message?: string
  duration_ms?: number
  data?: LogData
}

type LogData = Record<string, unknown>

/**
 * Normalize an unknown error into a plain object suitable for logging.
 *
 * If the input is an Error instance, extracts `name`, `message`, and `stack`.
 * Otherwise returns an object with a stringified `error` field.
 *
 * @param err - The error value to serialize
 * @returns A plain object representation of the error
 */
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
const isJson = process.argv.includes('--json')
const isPretty = process.argv.includes('--pretty')
const STRICT_UX = process.env.STRICT_UX === 'true'

const LOG_LEVEL = (process.env.LOG_LEVEL || 'info') as StructuredLogLevel

const levelPriority: Record<StructuredLogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

const LOG_SAMPLE_RATE = Number(process.env.LOG_SAMPLE_RATE || '1')

const NODE_ENV = process.env.NODE_ENV || 'development'

/**
 * Apply sensible environment defaults for the logger based on `NODE_ENV`.
 *
 * This will set `process.env.LOG_LEVEL` when it is not already defined
 * for production and test environments.
 */
function applyEnvDefaults() {
  if (NODE_ENV === 'production') {
    process.env.LOG_LEVEL ||= 'warn'
  }

  if (NODE_ENV === 'test') {
    process.env.LOG_LEVEL ||= 'error'
  }
}

applyEnvDefaults()

// Global minimum display width (used by boxes, tables, and progress bars).
// Can be overridden with `LOG_MIN_WIDTH` or (legacy) `LOG_MIN_BOX_WIDTH` env var.
const LOG_MIN_WIDTH = Number(process.env.LOG_MIN_WIDTH || process.env.LOG_MIN_BOX_WIDTH || '50')

// ANSI/fullwidth-aware padding helpers using `string-width` for visible widths.
function padRightVisible(s: string, width: number): string {
  const str = String(s)
  const w = stringWidth(str)
  return str + ' '.repeat(Math.max(0, width - w))
}

function _padLeftVisible(s: string, width: number): string {
  const str = String(s)
  const w = stringWidth(str)
  return ' '.repeat(Math.max(0, width - w)) + str
}

// Align text into a fixed visible width using `string-width`.
function alignText(s: string, width: number, align: Align = 'start'): string {
  const str = String(s)
  const w = stringWidth(str)
  if (w >= width) return str
  const space = width - w
  if (align === 'center') {
    const left = Math.floor(space / 2)
    const right = space - left
    return ' '.repeat(left) + str + ' '.repeat(right)
  } else if (align === 'end') {
    return ' '.repeat(space) + str
  } else {
    return str + ' '.repeat(space)
  }
}

/**
 * Determine whether this log event should be emitted according to sampling.
 *
 * Returns `true` when `LOG_SAMPLE_RATE` permits emitting the log.
 */
function shouldSample(): boolean {
  if (LOG_SAMPLE_RATE >= 1) return true
  return Math.random() < LOG_SAMPLE_RATE
}

/**
 * Decide if a message at `level` should be logged based on configured
 * `LOG_LEVEL` and sampling policy.
 *
 * @param level - Level to evaluate
 */
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
  gray: '\x1b[90m',
  white: '\x1b[37m',
  bgGreen: '\x1b[42m',
  bgRed: '\x1b[41m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
}

function ciError(message: string) {
  if (process.env.GITHUB_ACTIONS === 'true') {
    console.log(`::error::${message}`)
  }
}

function ciWarning(message: string) {
  if (process.env.GITHUB_ACTIONS === 'true') {
    console.log(`::warning::${message}`)
  }
}

/**
 * Apply ANSI color codes to `text` according to `level`.
 *
 * This is intentionally a no-op in `--ai` mode so machine-readable output
 * remains stable.
 */
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

/**
 * Format a line with the appropriate symbol and color for a given `level`.
 *
 * Returns plain text when running in `--ai` mode.
 */
function format(level: LogLevel, message: string): string {
  if (isAiMode) return message
  const symbol = symbols[level]
  return colorize(level, `${symbol} ${message}`)
}

// --- AI batching (explicit flush, CI-safe) ---
const aiBuffer: AiLogPayload[] = []

/**
 * Buffer an AI-mode payload to be flushed later by `flushAi()`.
 *
 * Internal helper; callers should generally use the public logging methods
 * which will call `pushAi()` when running with `--ai`.
 */
function pushAi(payload: AiLogPayload) {
  aiBuffer.push(payload)
}

/**
 * Flush buffered AI-mode logs to stdout as a single JSON object.
 *
 * This function is a no-op unless the process was started with `--ai`.
 * It aggregates collected AI payloads and writes a deterministic JSON
 * summary suitable for machine consumption.
 *
 * Example output shape:
 * {
 *   status: 'success'|'error',
 *   summary: { total, errors, success, duration_ms },
 *   errors: [...],
 *   successes: [...]
 * }
 */
export function flushAi(): void {
  if (!isAiMode || aiBuffer.length === 0) return

  const errors = aiBuffer.filter((p) => p.status === 'error')
  const successes = aiBuffer.filter((p) => p.status === 'success')

  const output = {
    status: errors.length > 0 ? 'error' : 'success',
    summary: {
      total: aiBuffer.length,
      errors: errors.length,
      success: successes.length,
      duration_ms: aiBuffer.reduce((acc, p) => acc + (p.duration_ms || 0), 0),
    },
    errors,
    successes,
  }

  const json = isPretty ? JSON.stringify(output, null, 2) : JSON.stringify(output)
  process.stdout.write(`${json}\n`)
}

/**
 * Ensures AI output is flushed before exiting process
 */
/**
 * Flush any buffered AI output and exit the process.
 *
 * This wrapper ensures `flushAi()` runs before terminating the process so
 * AI-mode consumers receive the complete JSON summary. Preferred over
 * calling `process.exit()` directly in scripts that use `--ai`.
 *
 * @param code - Exit code to return to the operating system
 * @returns never (this function will terminate the process)
 */
export function exit(code: number): never {
  flushAi()
  process.exit(code)
}

// lightweight spinner
const spinnerFrames = ['-', '\\', '|', '/']

/**
 * Lightweight terminal spinner used for short-running operations.
 *
 * The spinner is intentionally minimal: it writes a rotating frame to
 * stdout using `process.stdout.write` and clears itself when stopped.
 * It is disabled in `--ai`, CI, and `--silent` modes.
 */
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

/**
 * Small progress bar helper that renders a fixed-width bar to stdout.
 *
 * Usage:
 * - `start(total)` to initialize
 * - `tick()` to increment
 * - `end()` to finish and newline
 *
 * Disabled in `--ai`, CI, and `--silent` modes.
 */
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
    const width = Math.max(10, LOG_MIN_WIDTH - 10)
    const ratio = this.total ? this.current / this.total : 0
    const filled = Math.round(width * ratio)
    const bar = '█'.repeat(filled) + '░'.repeat(width - filled)
    const percent = Math.round(ratio * 100)
    process.stdout.write(`\r[${bar}] ${percent}%`)
  }
}

/**
 * Primary CLI logger providing a suite of human-friendly logging helpers.
 *
 * The `Logger` class exposes methods for structured summaries (`result`),
 * inline UX helpers (spinners, progress bars), and small visual elements
 * (badges, tables, stats). Use the exported `log` instance across scripts
 * to ensure consistent terminal UX and AI-mode compatibility.
 */
class Logger {
  private scriptName?: string
  private startTime?: number
  private spinner = new Spinner()
  private progress = new ProgressBar()
  private groupLevel = 0
  private slowThresholdMs = Number(process.env.LOG_SLOW_THRESHOLD || '2000')

  /**
   * Set the script name used for AI-mode payloads and structured logs.
   *
   * @param name - Logical name of the running script
   */
  setScript(name: string) {
    this.scriptName = name
  }

  /**
   * @deprecated Use `header()` instead. This method will be removed.
   */
  start(title: string) {
    this.startTime = Date.now()
    if (isAiMode || isSilent) return
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log(`▶ START: ${title}`)
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`)
  }

  /**
   * Prints script header with title and optional description
   * @param title
   * @param description
   * @returns
   */
  header(title: string, description?: string, options?: { align?: Align }) {
    this.startTime = Date.now()

    if (isAiMode || isSilent) return

    const compact = process.argv.includes('--compact')

    const content = description ? `${title.toUpperCase()}\n${description}` : title.toUpperCase()

    const lines = content.split('\n')
    const width = Math.max(...lines.map((l) => stringWidth(l))) + 4

    if (compact) {
      console.log(`\n${colors.bold}${title.toUpperCase()}${colors.reset}`)
      if (description) console.log(description)
      console.log('')
      return
    }

    // Determine alignment: options -> env -> default 'start'
    const envAlign = (process.env.LOG_BOX_ALIGN || '').toLowerCase()
    const align = (options?.align ||
      (envAlign === 'center' ? 'center' : envAlign === 'end' ? 'end' : 'start')) as Align

    console.log(`\n┌${'─'.repeat(width - 2)}┐`)
    for (const line of lines) {
      const inner = width - 4
      const aligned = alignText(line, inner, align)
      console.log(`│ ${aligned} │`)
    }
    console.log(`└${'─'.repeat(width - 2)}┘\n`)
  }

  /**
   * Print a summary block with a message and optional elapsed duration.
   *
   * In `--ai` mode the summary is buffered as a success payload. In
   * interactive mode a decorative summary box is printed to stdout.
   *
   * @param message - Human readable summary message shown in final block
   */
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

  /**
   * Print a structured result summary including counts and an optional
   * message. When running in `--ai` mode the result is pushed to the AI
   * buffer as a structured payload instead of printing text.
   *
   * @param summary - Object with optional `passed`, `failed`, `total`, and `message` fields
   */
  result(
    summary: {
      passed?: number
      failed?: number
      total?: number
      warnings?: number
      message?: string
    },
    options?: { align?: Align }
  ) {
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
            warnings: summary.warnings,
            total: summary.total,
          },
        })
      }
      return
    }

    // Build rows
    const rows: Array<[string, string]> = []

    const total = summary.total ?? 0
    const passed = summary.passed ?? 0
    const failed = summary.failed ?? 0

    const passedPct = total > 0 ? Math.round((passed / total) * 100) : 0
    const failedPct = total > 0 ? Math.round((failed / total) * 100) : 0

    if (summary.total !== undefined) {
      rows.push(['Total', `${colors.bold}${total}${colors.reset}`])
    }

    if (summary.passed !== undefined) {
      rows.push([
        'Passed',
        `${colors.green}${passed}${colors.reset} ${colors.dim}(${passedPct}%)${colors.reset}`,
      ])
    }

    if (summary.failed !== undefined) {
      rows.push([
        'Failed',
        `${colors.red}${failed}${colors.reset} ${colors.dim}(${failedPct}%)${colors.reset}`,
      ])
    }

    if (summary.warnings !== undefined) {
      const warningPct = total > 0 ? Math.round((summary.warnings / total) * 100) : 0
      rows.push([
        'Warnings',
        `${colors.yellow}${summary.warnings}${colors.reset} ${colors.dim}(${warningPct}%)${colors.reset}`,
      ])
    }

    if (duration) {
      rows.push(['Duration', `${colors.cyan}${duration}ms${colors.reset}`])
    }

    const compact = process.argv.includes('--compact')

    const status: 'success' | 'error' | 'warning' =
      summary.failed && summary.failed > 0 ? 'error' : summary.failed === 0 ? 'success' : 'warning'

    const badgeBg =
      status === 'error' ? colors.bgRed : status === 'success' ? colors.bgGreen : colors.bgYellow

    const badgeText = status.toUpperCase()

    // width calculations
    // Use `string-width` for accurate visible width (ANSI-aware + wide chars)

    const col1Width = Math.max(...rows.map(([k]) => stringWidth(k)), 0)
    const col2Width = Math.max(...rows.map(([, v]) => stringWidth(v)), 0)
    const contentWidth = col1Width + col2Width + 4

    // Allow a fixed box width via `LOG_BOX_WIDTH` env var. Otherwise compute
    // a sensible width from content and clamp to the terminal width.
    const envBoxWidth = Number(process.env.LOG_BOX_WIDTH || '')
    const termCols =
      process.stdout && typeof process.stdout.columns === 'number' ? process.stdout.columns : 60

    let boxWidth = Math.max(contentWidth, stringWidth(badgeText) + 2) + 2
    if (Number.isFinite(envBoxWidth) && envBoxWidth > 0) {
      boxWidth = Math.max(10, Math.min(envBoxWidth, termCols - 2))
    } else {
      boxWidth = Math.max(boxWidth, LOG_MIN_WIDTH)
      boxWidth = Math.min(boxWidth, Math.max(20, termCols - 2))
    }

    // Ensure the box obeys the configured global minimum width
    boxWidth = Math.max(boxWidth, LOG_MIN_WIDTH)

    if (compact) {
      console.log(`\n${status.toUpperCase()}`)
      for (const [k, v] of rows) console.log(`${k}: ${v}`)
      if (summary.message) console.log(summary.message)
      console.log('')
      return
    }

    // Render a decorative, bordered box around the result using `string-width`
    const innerWidth = boxWidth - 2
    const topBorder = `┌${'─'.repeat(innerWidth)}┐`
    const bottomBorder = `└${'─'.repeat(innerWidth)}┘`

    console.log(`\n${topBorder}`)

    // Badge: support alignment (start | center | end) via options or `LOG_BOX_ALIGN`
    const envAlign = (process.env.LOG_BOX_ALIGN || '').toLowerCase()
    const align = (options?.align ||
      (envAlign === 'center' ? 'center' : envAlign === 'end' ? 'end' : 'start')) as Align

    const badgeVisible = stringWidth(badgeText)
    let badgePadLeft = 0
    let badgePadRight = 0
    if (align === 'center') {
      badgePadLeft = Math.floor((innerWidth - badgeVisible) / 2)
      badgePadRight = Math.max(0, innerWidth - badgeVisible - badgePadLeft)
    } else if (align === 'end') {
      badgePadRight = 1
      badgePadLeft = Math.max(0, innerWidth - badgeVisible - badgePadRight)
    } else {
      badgePadLeft = 1
      badgePadRight = Math.max(0, innerWidth - badgeVisible - badgePadLeft)
    }

    const badgeLine =
      badgeBg +
      colors.bold +
      colors.white +
      ' '.repeat(badgePadLeft) +
      badgeText +
      ' '.repeat(badgePadRight) +
      colors.reset
    console.log(`│${badgeLine}│`)

    // spacer
    console.log(`│${' '.repeat(innerWidth)}│`)

    // Prepare visible-width-aware padding helpers
    const padRightVisible = (s: string, width: number) => {
      const w = stringWidth(s)
      return s + ' '.repeat(Math.max(0, width - w))
    }
    const padLeftVisible = (s: string, width: number) => {
      const w = stringWidth(s)
      return ' '.repeat(Math.max(0, width - w)) + s
    }

    const paddingLeft = 1
    const paddingRight = 1
    const availableInner = Math.max(0, innerWidth - paddingLeft - paddingRight)

    // Compute display widths so the table fills the box width
    const col1DisplayWidth = col1Width
    const col2DisplayWidth = Math.max(col2Width, availableInner - col1DisplayWidth - 2)

    for (const [k, v] of rows) {
      const left = padRightVisible(k, col1DisplayWidth)
      const right = padLeftVisible(v, col2DisplayWidth)
      const line = `${' '.repeat(paddingLeft)}${left}${' '.repeat(2)}${right}${' '.repeat(
        paddingRight
      )}`
      console.log(`│${line}│`)
    }

    // message (word-wrapped to fit inside box)
    if (summary.message) {
      console.log(`│${' '.repeat(innerWidth)}│`)
      const wrapWidth = Math.max(0, innerWidth - 2)
      const words = String(summary.message).split(/\s+/)
      let line = ''
      for (const w of words) {
        const candidate = line ? `${line} ${w}` : w
        if (stringWidth(candidate) <= wrapWidth) {
          line = candidate
        } else {
          console.log(`│ ${line}${' '.repeat(Math.max(0, wrapWidth - stringWidth(line)))} │`)
          line = w
        }
      }
      if (line) {
        console.log(`│ ${line}${' '.repeat(Math.max(0, wrapWidth - stringWidth(line)))} │`)
      }
    }

    console.log(bottomBorder)

    // performance threshold (plain line)
    if (duration && duration > this.slowThresholdMs) {
      const warnMsg = `Slow execution: ${duration}ms`
      console.log(`${colors.yellow}⚠ ${warnMsg}${colors.reset}`)
      ciWarning(warnMsg)
    }

    // CI annotations for failure
    if (status === 'error' && summary.message) {
      ciError(summary.message)
    }
  }

  /**
   * Compare current result with previous values
   */
  trend(current: number, previous: number, label: string) {
    if (isAiMode || isSilent) return

    const diff = current - previous
    const symbol = diff > 0 ? '↑' : diff < 0 ? '↓' : '→'
    const color = diff > 0 ? colors.red : diff < 0 ? colors.green : colors.dim

    console.log(`${label}: ${current} ${color}${symbol} ${Math.abs(diff)}${colors.reset}`)
  }

  /**
   * Start a lightweight spinner with contextual text.
   * @param text - Short description shown after the spinner frame
   */
  spin(text: string) {
    this.spinner.start(text)
  }

  /**
   * Stop the currently running spinner and optionally print a final message.
   * @param text - Optional completion message to print after stopping spinner
   */
  stopSpin(text?: string) {
    this.spinner.stop(text)
  }

  /**
   * Initialize a progress bar for a known total number of steps.
   * @param total - Number of items to complete
   */
  progressStart(total: number) {
    this.progress.start(total)
  }

  /**
   * Advance the active progress bar by a number of steps.
   * @param step - Steps to advance (default: 1)
   */
  progressTick(step = 1) {
    this.progress.tick(step)
  }

  /**
   * Complete the active progress bar and move to a new line.
   */
  progressEnd() {
    this.progress.end()
  }

  /**
   * Render a table from an array of row objects.
   *
   * Each row object must share the same set of keys which will be used as
   * column headers. Columns are auto-sized to fit the widest value. You can
   * supply `options.title` to print a header and control `colors` or
   * `borderless` layout.
   *
   * @param rows - Array of row objects (columns inferred from keys)
   * @param options - Optional display options: `title`, `colors`, `borderless`
   */
  table(
    rows: Array<Record<string, string>>,
    options?: { title?: string; colors?: boolean; borderless?: boolean }
  ) {
    if (isAiMode || isSilent) return
    if (rows.length === 0) return

    if (options?.title) {
      console.log(`\n${colors.bold}${options.title}${colors.reset}`)
    }

    const firstRow = rows[0]
    if (!firstRow) return

    const columns = Object.keys(firstRow)

    // Compute visible widths for each column (ANSI + fullwidth aware)
    const colWidths: number[] = columns.map((col) => {
      const widths = rows.map((row) => stringWidth(String(row[col] ?? '')))
      return Math.max(stringWidth(col), ...widths)
    })

    // Account for separators (" │ " or "   ") when computing total width
    const sepWidth = options?.borderless ? 3 : 3
    let totalWidth: number =
      colWidths.reduce((a, b) => a + b, 0) + Math.max(0, (columns.length - 1) * sepWidth)

    // Enforce global minimum width by distributing extra space across columns
    if (totalWidth < LOG_MIN_WIDTH && colWidths.length > 0) {
      let extra = LOG_MIN_WIDTH - totalWidth
      let i = 0
      while (extra > 0) {
        const idx = i % colWidths.length
        colWidths[idx] = (colWidths[idx] ?? 0) + 1
        i += 1
        extra -= 1
      }
      totalWidth = LOG_MIN_WIDTH
    }

    // Header
    const header = columns
      .map((col, i) => padRightVisible(col, colWidths[i] ?? 0))
      .join(options?.borderless ? '   ' : ' │ ')
    console.log(`${colors.bold}${header}${colors.reset}`)

    if (!options?.borderless) {
      console.log(columns.map((_, i) => '─'.repeat(colWidths[i] ?? 0)).join('─┼─'))
    }

    // Rows
    for (const row of rows) {
      let line = columns
        .map((col, i) => {
          const value = String(row[col] ?? '')
          return padRightVisible(value, colWidths[i] ?? 0)
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

  /**
   * Render a single colored badge with an icon and label.
   *
   * Badges are useful for short, inline status indicators in scripts and
   * checks. They are suppressed in `--ai` and `--silent` modes.
   *
   * @param text - Label to display inside the badge
   * @param type - Badge type which controls background color and symbol
   */
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
    if (badge) {
      console.log(
        `${badge.bg}${colors.bold}${colors.white} ${badge.symbol} ${text} ${colors.reset}`
      )
    }
  }

  /**
   * Render multiple badges on the same line.
   *
   * Each item should include `text` and an optional `type` which controls
   * the badge color and symbol.
   *
   * @param items - Array of badge descriptors
   */
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
        if (!badge) return ''
        return `${badge.bg}${colors.bold}${colors.white} ${badge.symbol} ${item.text} ${colors.reset}`
      })
      .join('')

    console.log(rendered)
  }

  /**
   * Render a compact result box that only contains a title with a status badge.
   *
   * Useful for scripts that have no numeric summary data but want a
   * visually consistent success/error badge with a boxed title.
   *
   * @param title - Label to display in the box
   * @param status - One of `success|error|warning|info` controlling color
   * @param options - Optional alignment for the badge/title
   */
  resultSimple(
    title: string,
    status: 'success' | 'error' | 'warning' | 'info' = 'info',
    options?: { align?: Align }
  ) {
    if (isAiMode || isSilent) {
      if (isAiMode) {
        pushAi({ status: status as AiStatus, script: this.scriptName, message: title })
      }
      return
    }

    const badgeText = status.toUpperCase()

    // width calculations (minimal and responsive)
    const contentWidth = Math.max(stringWidth(title), stringWidth(badgeText)) + 4
    const envBoxWidth = Number(process.env.LOG_BOX_WIDTH || '')
    const termCols =
      process.stdout && typeof process.stdout.columns === 'number' ? process.stdout.columns : 60

    let boxWidth = Math.max(contentWidth, LOG_MIN_WIDTH)
    if (Number.isFinite(envBoxWidth) && envBoxWidth > 0) {
      boxWidth = Math.max(10, Math.min(envBoxWidth, termCols - 2))
    } else {
      boxWidth = Math.min(boxWidth, Math.max(20, termCols - 2))
    }

    boxWidth = Math.max(boxWidth, LOG_MIN_WIDTH)
    const innerWidth = boxWidth - 2

    // badge background mapping
    const badgeBg =
      status === 'error'
        ? colors.bgRed
        : status === 'success'
          ? colors.bgGreen
          : status === 'warning'
            ? colors.bgYellow
            : colors.bgBlue

    // alignment
    const envAlign = (process.env.LOG_BOX_ALIGN || '').toLowerCase()
    const align = (options?.align ||
      (envAlign === 'center' ? 'center' : envAlign === 'end' ? 'end' : 'start')) as Align

    const badgeVisible = stringWidth(badgeText)
    let badgePadLeft = 0
    let badgePadRight = 0
    if (align === 'center') {
      badgePadLeft = Math.floor((innerWidth - badgeVisible) / 2)
      badgePadRight = Math.max(0, innerWidth - badgeVisible - badgePadLeft)
    } else if (align === 'end') {
      badgePadRight = 1
      badgePadLeft = Math.max(0, innerWidth - badgeVisible - badgePadRight)
    } else {
      badgePadLeft = 1
      badgePadRight = Math.max(0, innerWidth - badgeVisible - badgePadLeft)
    }

    const topBorder = `┌${'─'.repeat(innerWidth)}┐`
    const bottomBorder = `└${'─'.repeat(innerWidth)}┘`

    const badgeLine =
      badgeBg +
      colors.bold +
      colors.white +
      ' '.repeat(badgePadLeft) +
      badgeText +
      ' '.repeat(badgePadRight) +
      colors.reset

    console.log(`\n${topBorder}`)
    console.log(`│${badgeLine}│`)
    console.log(`│${' '.repeat(innerWidth)}│`)

    // title (single-line, aligned)
    const titleInner = Math.max(0, innerWidth - 2)
    const titleAligned = alignText(title, titleInner, align)
    console.log(`│ ${titleAligned} │`)

    console.log(bottomBorder)
  }

  /**
   * Print a compact labeled statistic line.
   *
   * @param label - Name of the metric
   * @param value - Value to display
   * @param color - Optional color key to style the value
   */
  stat(label: string, value: string | number, color: keyof typeof colors = 'cyan') {
    if (isAiMode || isSilent) return
    const colorCode = colors[color] || colors.cyan
    console.log(`${colors.bold}${label}${colors.reset}: ${colorCode}${value}${colors.reset}`)
  }

  /**
   * Render a small inline code block with a language label.
   *
   * @param text - Code or preformatted text to display
   * @param language - Optional language label shown in the header
   */
  code(text: string, language: string = 'text') {
    if (isAiMode || isSilent) return
    console.log(`\n${colors.dim}┌─ ${language}${colors.reset}`)
    console.log(`${colors.blue}${text}${colors.reset}`)
    console.log(`${colors.dim}└─${colors.reset}\n`)
  }

  /**
   * Print a bullet list of items.
   *
   * @param items - Array of strings to render as bullets
   * @param indent - Number of spaces to indent each line
   */
  list(items: string[], indent: number = 0) {
    if (isAiMode || isSilent) return
    const padding = ' '.repeat(indent)
    for (const item of items) {
      console.log(`${padding}${colors.cyan}▪${colors.reset} ${item}`)
    }
  }

  /**
   * Render a list of failed items
   */
  failList(title: string, items: string[]) {
    if (isAiMode || isSilent) return
    if (!items.length) return

    console.log(`\n${colors.red}✖ ${title} (${items.length})${colors.reset}\n`)
    for (const item of items) {
      console.log(`  ${colors.red}•${colors.reset} ${item}`)
    }
  }

  /**
   * Render a list of warning items
   */
  warningList(title: string, items: string[]) {
    if (isAiMode || isSilent) return
    if (!items.length) return

    console.log(`\n${colors.yellow}⚠ ${title} (${items.length})${colors.reset}\n`)
    for (const item of items) {
      console.log(`  ${colors.yellow}•${colors.reset} ${item}`)
    }
  }

  /**
   * Render a list of successful items
   */
  successList(title: string, items: string[]) {
    if (isAiMode || isSilent) return
    if (!items.length) return

    console.log(`\n${colors.green}✔ ${title} (${items.length})${colors.reset}\n`)
    for (const item of items) {
      console.log(`  ${colors.green}•${colors.reset} ${item}`)
    }
  }

  /**
   * Assert condition and log error if false
   */
  assert(condition: boolean, message: string) {
    if (!condition) this.error(message)
  }

  /**
   * Display empty state message
   */
  empty(message: string) {
    if (isAiMode || isSilent) return
    console.log(`${colors.dim}${message}${colors.reset}`)
  }

  /**
   * Lightweight section step (non-nested)
   * @param title
   * @returns
   */
  sectionStep(title: string) {
    if (isAiMode || isSilent) return
    console.log(`\n▶ ${colors.bold}${title}${colors.reset}`)
  }

  /**
   * Render a box with a title and content
   * @param title
   * @param content
   * @returns
   */
  box(title: string, content: string, options?: { align?: Align }) {
    if (isAiMode || isSilent) return
    // Use visible-width-aware sizing and global minimum width
    const termCols =
      process.stdout && typeof process.stdout.columns === 'number' ? process.stdout.columns : 80
    const desiredOuter = Math.max(stringWidth(title) + 4, stringWidth(content) + 4, LOG_MIN_WIDTH)
    const outerWidth = Math.min(desiredOuter, Math.max(10, termCols - 2))
    const innerWidth = outerWidth - 2

    const top = `┌${'─'.repeat(innerWidth)}┐`
    const bottom = `└${'─'.repeat(innerWidth)}┘`

    // Determine alignment: options -> env -> default 'start'
    const envAlign = (process.env.LOG_BOX_ALIGN || '').toLowerCase()
    const align = (options?.align ||
      (envAlign === 'center' ? 'center' : envAlign === 'end' ? 'end' : 'start')) as Align
    const contentInner = Math.max(0, innerWidth - 2)
    const titleAligned = alignText(title, contentInner, align)
    const contentAligned = alignText(content, contentInner, 'start')
    const titleLine = `│ ${colors.bold}${titleAligned}${colors.reset} │`
    const contentLine = `│ ${contentAligned} │`

    console.log(`\n${top}`)
    console.log(titleLine)
    console.log(contentLine)
    console.log(`${bottom}\n`)
  }

  /**
   * Print a highlighted piece of text using a color and optional bolding.
   *
   * @param text - The text to highlight
   * @param color - Color key to use
   * @param bold - Whether to apply bold styling
   */
  highlight(text: string, color: keyof typeof colors = 'yellow', bold: boolean = true) {
    if (isAiMode || isSilent) return
    const colorCode = colors[color] || colors.yellow
    const formatted = bold
      ? `${colors.bold}${colorCode}${text}${colors.reset}`
      : `${colorCode}${text}${colors.reset}`
    console.log(formatted)
  }

  /**
   * Render lightweight tag tokens (prefixed with `#`).
   *
   * @param items - Tag strings to render
   * @param color - Optional color key for tags
   */
  tags(items: string[], color: keyof typeof colors = 'magenta') {
    if (isAiMode || isSilent) return
    const colorCode = colors[color] || colors.magenta
    const rendered = items.map((item) => `${colorCode}#${item}${colors.reset}`).join('  ')
    console.log(rendered)
  }

  /**
   * Return a colored text fragment (no newline).
   *
   * @param content - Text content
   * @param color - Optional color key
   */
  text(content: string, color: keyof typeof colors = 'white') {
    if (isAiMode || isSilent) return
    const colorCode = colors[color] || colors.white
    return `${colorCode}${content}${colors.reset}`
  }

  /**
   * Return a bolded (and optionally colored) text fragment.
   *
   * @param content - Text content
   * @param color - Optional color key or 'none'
   */
  bold(content: string, color: keyof typeof colors | 'none' = 'none') {
    if (isAiMode || isSilent) return ''
    const colorCode = color === 'none' ? '' : colors[color as keyof typeof colors] || ''
    return `${colors.bold}${colorCode}${content}${colors.reset}`
  }

  /**
   * Return a colored numeric/text fragment for inline display.
   *
   * @param value - Number or string to format
   * @param color - Color key
   */
  number(value: number | string, color: keyof typeof colors = 'cyan') {
    if (isAiMode || isSilent) return ''
    const colorCode = colors[color] || colors.cyan
    return `${colorCode}${value}${colors.reset}`
  }

  /**
   * Render a single composed line from multiple colored/bold fragments.
   *
   * @param elements - Array of fragments with optional color and bold
   */
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

  /**
   * Render a proportional, colored progress bar composed of segments for
   * success / error / warning / info counts and optionally print a
   * percentage breakdown. Useful for test/build/deployment summaries.
   *
   * @param stats - numeric counts for each status type
   * @param options - display options: `title` and `showPercentage` (defaults true)
   */
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

    const termCols =
      process.stdout && typeof process.stdout.columns === 'number' ? process.stdout.columns : 80

    // Derive a bar width from the global minimum, but clamp to terminal
    const barWidth = Math.max(10, Math.min(termCols - 10, LOG_MIN_WIDTH - 10))
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

  /**
   * Start a logical group block in the output, increasing indentation.
   *
   * @param title - Group title
   */
  group(title: string) {
    if (isAiMode || isSilent) return
    this.groupLevel++
    const indent = '  '.repeat(this.groupLevel - 1)
    console.log(`\n${indent}▶ ${title}`)
  }

  /**
   * End the most recent group.
   */
  groupEnd() {
    if (isAiMode || isSilent) return
    this.groupLevel = Math.max(0, this.groupLevel - 1)
  }

  /**
   * Render a section header.
   *
   * @param title - Section title
   */
  section(title: string) {
    if (isAiMode || isSilent) return
    console.log(`\n━━ ◼ ${title.toUpperCase()} ━━`)
  }

  /**
   * Render a visual divider line.
   */
  divider() {
    if (isAiMode || isSilent) return
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  }

  /**
   * Informational log (avoid in main UX flow)
   */
  info(message: string) {
    if (isAiMode || isSilent) {
      if (isAiMode) pushAi({ status: 'info', script: this.scriptName, message })
      return
    }

    if (STRICT_UX) {
      console.warn(`${colors.yellow}[UX WARNING] Avoid log.info() in main flow${colors.reset}`)
    }

    console.log(`${colors.dim}${message}${colors.reset}`)
  }

  /**
   * Log a successful message.
   *
   * In `--ai` mode this is buffered as a success payload.
   */
  success(message: string, data?: LogData) {
    if (isAiMode || isSilent) {
      if (isAiMode) {
        pushAi({ status: 'success', script: this.scriptName, message, data })
      }
      return
    }
    if (isJson) {
      console.log(JSON.stringify({ level: 'success', message, data }))
    } else {
      console.log(format('success', message))
    }
  }

  /**
   * Log a warning message (visually emphasized).
   */
  warn(message: string, data?: LogData) {
    if (isAiMode || isSilent) {
      if (isAiMode) {
        pushAi({ status: 'warning', script: this.scriptName, message, data })
      }
      return
    }
    console.log(format('warn', message))
  }

  /**
   * Log an error message and optional metadata.
   *
   * In `--ai` mode this is buffered as an error payload.
   */
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

    if (isJson) {
      console.error(JSON.stringify({ level: 'error', message, data: normalizedData }))
    } else {
      console.error(format('error', message))
      if (normalizedData) {
        console.error(JSON.stringify(normalizedData, null, 2))
      }
    }
  }

  /**
   * Emit a small step line used for multi-step output.
   */
  step(message: string) {
    if (isAiMode || isSilent) return
    const indent = '  '.repeat(this.groupLevel)
    console.log(`${indent}${format('step', message)}`)
  }

  /**
   * Emit a debug-level message routed through AI buffer in `--ai` mode.
   */
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

/**
 * Default shared logger instance used across repository scripts.
 *
 * Import as: `import { log } from 'scripts/utils/logger'` and use its
 * methods for consistent CLI output and AI-mode buffering.
 */
export const log = new Logger()

/**
 * Assert that a given source string does not contain raw `console.*` usage.
 *
 * Throws an error when a prohibited `console` call is detected so scripts
 * remain consistent with the shared logger API.
 *
 * @param source - Source code to inspect
 */
export function assertNoConsoleUsage(source: string) {
  if (/console\.(log|error|warn|info)\(/.test(source)) {
    throw new Error('Raw console usage detected. Use shared logger instead.')
  }
}

// --- Structured Logger Adapter and compatibility exports ---------------------------------

/**
 * Structured log level names used by the `StructuredLogger` adapter.
 */
export type StructuredLogLevel = 'debug' | 'info' | 'warn' | 'error'

// Backwards-compat alias for older callers that expect a LogLevel type name
/**
 * Backwards-compatible alias for `StructuredLogLevel`.
 */
export type StructuredLogLevelAlias = StructuredLogLevel

/**
 * Optional context attached to structured log entries.
 *
 * This is stored in AsyncLocalStorage and merged into `LogEntry.context`.
 */
export interface LogContext {
  correlationId?: string
  workspaceSlug?: string
  workspaceId?: string
  userId?: string
  attemptId?: string
  module?: string
}

const asyncContext = new AsyncLocalStorage<LogContext>()

/**
 * Retrieve the current `LogContext` stored in the async context, if any.
 *
 * Returns `undefined` when no context has been set for the current async
 * execution chain.
 */
function getAsyncContext(): LogContext | undefined {
  return asyncContext.getStore()
}

/**
 * Run a function within a provided `LogContext` so downstream code can
 * access the context via `getAsyncContext()`.
 *
 * @param context - Context object to set for the duration of `fn`
 * @param fn - Callback to execute with the provided context
 * @returns The return value of `fn`
 */
export function runWithLogContext<T>(context: LogContext, fn: () => T): T {
  return asyncContext.run(context, fn)
}

/**
 * Structured log entry shape emitted by `StructuredLogger` transports.
 */
export interface LogEntry {
  timestamp: string
  level: StructuredLogLevel
  message: string
  context: LogContext
  metadata?: Record<string, unknown>
}

/**
 * Create a short, human-friendly correlation id used in structured logs.
 *
 * Not cryptographically strong — intended only for tracing and debugging.
 */
function generateCorrelationId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

/**
 * Minimal Structured Logger interface used by the adapter in this file.
 */
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

/**
 * Create a `StructuredLogger` for a given module.
 *
 * @param moduleName - Logical module name used in log context
 * @param jsonOutput - When true, the logger emits JSON entries instead of CLI output
 */
export function createLogger(moduleName: string, jsonOutput = false): StructuredLogger {
  return new StructuredLoggerAdapter(moduleName, jsonOutput)
}

/**
 * Configure a transport function to receive structured `LogEntry` objects.
 *
 * The transport may be async; errors are swallowed to keep logging non-fatal.
 */
export function setLoggerTransport(fn: (entry: LogEntry) => void | Promise<void>) {
  StructuredLoggerAdapter.setTransport(fn)
}

/**
 * Convenience transport that writes structured JSON log entries to stdout.
 */
export function setConsoleJsonTransport() {
  setLoggerTransport((entry) => {
    process.stdout.write(`${JSON.stringify(entry)}\n`)
  })
}

/**
 * Return a singleton global `StructuredLogger` instance.
 *
 * Creates the logger on first access using `createLogger()`.
 */
export function getGlobalLogger(moduleName = 'global'): StructuredLogger {
  if (!_globalStructuredLogger) {
    _globalStructuredLogger = createLogger(moduleName)
  }
  return _globalStructuredLogger
}

/**
 * Merge partial context into the global logger's context.
 */
export function setGlobalLoggerContext(context: Partial<LogContext>): void {
  getGlobalLogger().setContext(context)
}

/**
 * Helper to log a debug message via the global structured logger.
 */
export function logDebug(message: string, metadata?: Record<string, unknown>): void {
  getGlobalLogger().debug(message, metadata)
}

/**
 * Helper to log an info message via the global structured logger.
 */
export function logInfo(message: string, metadata?: Record<string, unknown>): void {
  getGlobalLogger().info(message, metadata)
}

/**
 * Helper to log a warning via the global structured logger.
 */
export function logWarn(message: string, metadata?: Record<string, unknown>): void {
  getGlobalLogger().warn(message, metadata)
}

/**
 * Helper to log an error via the global structured logger.
 */
export function logError(message: string, metadata?: Record<string, unknown>): void {
  getGlobalLogger().error(message, metadata)
}

/**
 * Run an async or sync function while measuring duration and emitting
 * span-style success/error diagnostic messages via the global logger.
 *
 * Useful for short-lived operations where duration tracking is desired.
 */
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
