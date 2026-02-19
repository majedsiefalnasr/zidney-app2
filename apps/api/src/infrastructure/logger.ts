import fs from 'fs'
import path from 'path'
import {
  LogEntry,
  validateLogEntry,
} from '../../../packages/validation/src/schemas/logging-schema'

/**
 * T072: Structured Logger Implementation
 *
 * Enforces strict adherence to logging schema before writing.
 * Output formats:
 * - Console (development)
 * - JSON file (production)
 * - Structured stdout (container environments)
 *
 * All logs are validated against schema before writing.
 * Invalid entries raise SyntaxError with details.
 */

export type OutputFormat = 'console' | 'json-file' | 'json-stdout'

interface LoggerConfig {
  format: OutputFormat
  level: 'debug' | 'info' | 'warn' | 'error'
  filePath?: string
  validateSchema: boolean
  sanitizeSensitive: boolean
}

class StructuredLogger {
  private config: LoggerConfig
  private fileStream?: NodeJS.WritableStream
  private logBuffer: LogEntry[] = []
  private bufferFlushInterval?: NodeJS.Timer

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      format:
        config.format ||
        (process.env.NODE_ENV === 'production' ? 'json-file' : 'console'),
      level: config.level || 'info',
      filePath: config.filePath,
      validateSchema: config.validateSchema !== false, // Default: true
      sanitizeSensitive: config.sanitizeSensitive !== false, // Default: true
    }

    if (this.config.format === 'json-file' && this.config.filePath) {
      this.initializeFileStream()
      this.startBufferFlush()
    }
  }

  private initializeFileStream(): void {
    if (!this.config.filePath) {
      return
    }

    // Create directory if it doesn't exist
    const dir = path.dirname(this.config.filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    this.fileStream = fs.createWriteStream(this.config.filePath, {
      flags: 'a',
      encoding: 'utf8',
    })
  }

  private startBufferFlush(): void {
    this.bufferFlushInterval = setInterval(() => {
      this.flushBuffer()
    }, 5000) // Flush every 5 seconds
  }

  private flushBuffer(): void {
    if (this.logBuffer.length === 0 || !this.fileStream) {
      return
    }

    const toWrite = this.logBuffer.splice(0)
    toWrite.forEach((entry) => {
      this.fileStream?.write(JSON.stringify(entry) + '\n')
    })
  }

  private shouldLog(level: string): boolean {
    const levels = ['debug', 'info', 'warn', 'error']
    const configIndex = levels.indexOf(this.config.level)
    const entryIndex = levels.indexOf(level)

    return entryIndex >= configIndex
  }

  private write(entry: LogEntry): void {
    if (!this.shouldLog(entry.level)) {
      return
    }

    // Validate schema if enabled
    if (this.config.validateSchema) {
      try {
        validateLogEntry(entry)
      } catch (error) {
        throw new SyntaxError(
          `Log entry validation failed: ${error instanceof Error ? error.message : String(error)}`
        )
      }
    }

    switch (this.config.format) {
      case 'console':
        this.writeConsole(entry)
        break
      case 'json-file':
        this.writeJsonFile(entry)
        break
      case 'json-stdout':
        this.writeJsonStdout(entry)
        break
    }
  }

  private writeConsole(entry: LogEntry): void {
    const color = {
      debug: '\x1b[36m', // cyan
      info: '\x1b[32m', // green
      warn: '\x1b[33m', // yellow
      error: '\x1b[31m', // red
    }[entry.level]

    const reset = '\x1b[0m'

    const timestamp = new Date(entry.timestamp).toISOString()
    const prefix = `${color}[${timestamp}] [${entry.service}/${entry.level.toUpperCase()}]${reset}`

    console.log(`${prefix} ${entry.event}: ${entry.message}`)

    if (entry.error_message) {
      console.error(`${color}  Error: ${entry.error_message}${reset}`)
    }

    if (entry.error_stack) {
      console.error(`${color}  Stack:\n${entry.error_stack}${reset}`)
    }
  }

  private writeJsonFile(entry: LogEntry): void {
    this.logBuffer.push(entry)

    // Flush immediately for errors
    if (entry.level === 'error') {
      this.flushBuffer()
    }
  }

  private writeJsonStdout(entry: LogEntry): void {
    process.stdout.write(JSON.stringify(entry) + '\n')
  }

  public debug(event: string, meta: Record<string, any> = {}): void {
    this.write({
      timestamp: new Date().toISOString(),
      level: 'debug',
      service: meta.service || 'api',
      event,
      message: meta.message || event,
      correlation_id: meta.correlation_id,
      workspace_id: meta.workspace_id,
      workspace_slug: meta.workspace_slug,
      user_id: meta.user_id,
      attempt_id: meta.attempt_id,
      job_id: meta.job_id,
      metadata: meta,
    } as LogEntry)
  }

  public info(event: string, meta: Record<string, any> = {}): void {
    this.write({
      timestamp: new Date().toISOString(),
      level: 'info',
      service: meta.service || 'api',
      event,
      message: meta.message || event,
      correlation_id: meta.correlation_id,
      workspace_id: meta.workspace_id,
      workspace_slug: meta.workspace_slug,
      user_id: meta.user_id,
      attempt_id: meta.attempt_id,
      job_id: meta.job_id,
      metadata: meta,
    } as LogEntry)
  }

  public warn(event: string, meta: Record<string, any> = {}): void {
    this.write({
      timestamp: new Date().toISOString(),
      level: 'warn',
      service: meta.service || 'api',
      event,
      message: meta.message || event,
      correlation_id: meta.correlation_id,
      workspace_id: meta.workspace_id,
      workspace_slug: meta.workspace_slug,
      user_id: meta.user_id,
      attempt_id: meta.attempt_id,
      job_id: meta.job_id,
      metadata: meta,
    } as LogEntry)
  }

  public error(event: string, meta: Record<string, any> = {}): void {
    this.write({
      timestamp: new Date().toISOString(),
      level: 'error',
      service: meta.service || 'api',
      event,
      message: meta.message || event,
      correlation_id: meta.correlation_id,
      workspace_id: meta.workspace_id,
      workspace_slug: meta.workspace_slug,
      user_id: meta.user_id,
      attempt_id: meta.attempt_id,
      job_id: meta.job_id,
      error_code: meta.error_code,
      error_message: meta.error_message,
      error_stack: meta.error_stack,
      metadata: meta,
    } as LogEntry)
  }

  public close(): void {
    if (this.bufferFlushInterval) {
      clearInterval(this.bufferFlushInterval)
    }

    this.flushBuffer()

    if (this.fileStream) {
      this.fileStream.end()
    }
  }
}

// Export singleton instance
export const logger = new StructuredLogger({
  format: process.env.LOG_FORMAT as OutputFormat,
  level: (process.env.LOG_LEVEL || 'info') as any,
  filePath: process.env.LOG_FILE_PATH,
})

// Export class for testing
export { StructuredLogger }
