/**
 * Structured Logger Adapter
 *
 * Provides a structured-logging API compatible with `@zidney/logger`'s
 * `createLogger(moduleName)` pattern, but routes output through the CLI
 * logger (`../utils/logger`) when running in human-friendly mode and emits
 * JSON entries when in JSON mode or when a transport is configured.
 *
 * Used by scripts under `scripts/` that want structured `.debug()`,
 * `.warn()`, and `.error()` methods with metadata.
 *
 * @module scripts/utils/structured-logger
 */

import { AsyncLocalStorage } from 'node:async_hooks'
import type { StructuredLogLevel } from './logger'
import { log, serializeError, shouldLog } from './logger'

// Re-export the type so consumers importing from here (or via barrel) get it
export type { StructuredLogLevel }

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
  ci?: boolean
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
      log.info(JSON.stringify(entry))
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
          log.info(`${message} ${JSON.stringify(metadata)}`)
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
