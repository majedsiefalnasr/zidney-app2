/**
 * ProvisioningErrorHandler - Map provisioning errors to HTTP status codes
 * Task: T019 – Map provisioning error codes to HTTP status codes
 * Also includes: StructuredLogger (T023)
 * Phase: 01 – Platform Foundation
 */

// ============================================================================
// T019: Error Code Mapping
// ============================================================================

export enum ProvisioningErrorCode {
  PROV_001 = 'PROV_001', // Slug already registered
  PROV_002 = 'PROV_002', // Database creation failed
  PROV_003 = 'PROV_003', // Migration execution failed
  PROV_004 = 'PROV_004', // Registry write failed
  PROV_005 = 'PROV_005', // License update failed
  PROV_006 = 'PROV_006', // Lock collision
  PROV_007 = 'PROV_007', // Invalid workspace slug
  PROV_008 = 'PROV_008', // License not found
  PROV_009 = 'PROV_009', // License not in PROVISIONING state
  PROV_010 = 'PROV_010', // Checksum mismatch
}

export interface ErrorMapping {
  code: ProvisioningErrorCode
  http_status: number
  message: string
}

const ERROR_MAPPINGS: Record<ProvisioningErrorCode, ErrorMapping> = {
  [ProvisioningErrorCode.PROV_001]: {
    code: ProvisioningErrorCode.PROV_001,
    http_status: 409,
    message: 'Workspace slug already registered (conflict)',
  },
  [ProvisioningErrorCode.PROV_002]: {
    code: ProvisioningErrorCode.PROV_002,
    http_status: 500,
    message: 'Database creation failed',
  },
  [ProvisioningErrorCode.PROV_003]: {
    code: ProvisioningErrorCode.PROV_003,
    http_status: 500,
    message: 'Migration execution failed',
  },
  [ProvisioningErrorCode.PROV_004]: {
    code: ProvisioningErrorCode.PROV_004,
    http_status: 500,
    message: 'Registry entry creation failed',
  },
  [ProvisioningErrorCode.PROV_005]: {
    code: ProvisioningErrorCode.PROV_005,
    http_status: 500,
    message: 'License state transition failed',
  },
  [ProvisioningErrorCode.PROV_006]: {
    code: ProvisioningErrorCode.PROV_006,
    http_status: 409,
    message: 'Provisioning lock collision (another provisioning in progress)',
  },
  [ProvisioningErrorCode.PROV_007]: {
    code: ProvisioningErrorCode.PROV_007,
    http_status: 400,
    message: 'Invalid workspace slug format',
  },
  [ProvisioningErrorCode.PROV_008]: {
    code: ProvisioningErrorCode.PROV_008,
    http_status: 404,
    message: 'License not found',
  },
  [ProvisioningErrorCode.PROV_009]: {
    code: ProvisioningErrorCode.PROV_009,
    http_status: 400,
    message: 'License not in PROVISIONING state',
  },
  [ProvisioningErrorCode.PROV_010]: {
    code: ProvisioningErrorCode.PROV_010,
    http_status: 500,
    message: 'Migration checksum mismatch (integrity error)',
  },
}

export const ProvisioningErrorHandler = {
  getErrorMapping(code: ProvisioningErrorCode): ErrorMapping | null {
    return ERROR_MAPPINGS[code] || null
  },

  getHttpStatus(code: ProvisioningErrorCode): number {
    return ERROR_MAPPINGS[code]?.http_status || 500
  },

  getMessage(code: ProvisioningErrorCode): string {
    return ERROR_MAPPINGS[code]?.message || 'Unknown provisioning error'
  },

  handleError(error: Error | string, correlation_id: string) {
    const error_str = typeof error === 'string' ? error : error.message
    let code = ProvisioningErrorCode.PROV_002 // Default

    // Extract error code if embedded in error message
    const match = error_str.match(/PROV_(\d{3})/)
    if (match) {
      code = `PROV_${match[1]}` as unknown as ProvisioningErrorCode
    }

    const mapping = ERROR_MAPPINGS[code]
    if (!mapping) {
      return {
        http_status: 500,
        error: {
          code: 'PROV_002',
          message: 'Provisioning failed: Unknown error',
          correlation_id,
        },
      }
    }

    return {
      http_status: mapping.http_status,
      error: {
        code: mapping.code,
        message: mapping.message,
        details: error_str,
        correlation_id,
      },
    }
  },
} as const

// ============================================================================
// T023: Structured Logger (Foundational for all logging)
// ============================================================================

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  FATAL = 'FATAL',
}

export interface LogContext {
  timestamp: string
  level: LogLevel
  service: string
  version: string
  correlation_id: string
  workspace_slug?: string
  license_id?: number
  organization_id?: number
  user_id?: string
  event: string
  details?: Record<string, unknown>
  error?: {
    code?: string
    message?: string
    stack?: string
  }
  duration_ms?: number
}

/**
 * StructuredLogger: All-structured JSON logging with correlation IDs
 * No console.log allowed - must use structured logger
 */
export class StructuredLogger {
  private service_name: string
  private version: string
  private min_level: LogLevel

  constructor(
    service_name: string,
    version: string = '1.0.0',
    min_level: LogLevel = LogLevel.INFO
  ) {
    this.service_name = service_name
    this.version = version
    this.min_level = min_level
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR, LogLevel.FATAL]
    const min_idx = levels.indexOf(this.min_level)
    const level_idx = levels.indexOf(level)
    return level_idx >= min_idx
  }

  private formatTimestamp(): string {
    return new Date().toISOString()
  }

  private writeLog(context: LogContext): void {
    if (!this.shouldLog(context.level)) return

    // Mask sensitive data
    const details = context.details as Record<string, unknown> | undefined
    let sanitizedDetails: Record<string, unknown> | undefined
    if (details && typeof details === 'object') {
      sanitizedDetails = { ...details }
      if ('password' in sanitizedDetails) {
        sanitizedDetails.password = '***MASKED***'
      }
      if ('token' in sanitizedDetails) {
        sanitizedDetails.token = '***MASKED***'
      }
    }

    // Write to stdout as JSON
    const output = { ...context, details: sanitizedDetails ?? context.details }
    console.log(JSON.stringify(output, null, 2))

    // For FATAL, also write to stderr
    if (context.level === LogLevel.FATAL) {
      console.error(JSON.stringify(context))
    }
  }

  info(event: string, context: Partial<LogContext>): void {
    this.writeLog({
      timestamp: this.formatTimestamp(),
      level: LogLevel.INFO,
      service: this.service_name,
      version: this.version,
      correlation_id: context.correlation_id || 'no-correlation-id',
      workspace_slug: context.workspace_slug,
      license_id: context.license_id,
      organization_id: context.organization_id,
      event,
      details,
      duration_ms: context.duration_ms,
    })
  }

  debug(event: string, context: Partial<LogContext>): void {
    this.writeLog({
      timestamp: this.formatTimestamp(),
      level: LogLevel.DEBUG,
      service: this.service_name,
      version: this.version,
      correlation_id: context.correlation_id || 'no-correlation-id',
      workspace_slug: context.workspace_slug,
      event,
      details: context.details,
    })
  }

  warn(event: string, context: Partial<LogContext>): void {
    this.writeLog({
      timestamp: this.formatTimestamp(),
      level: LogLevel.WARN,
      service: this.service_name,
      version: this.version,
      correlation_id: context.correlation_id || 'no-correlation-id',
      workspace_slug: context.workspace_slug,
      event,
      details: context.details,
      error: context.error,
    })
  }

  error(event: string, error: Error | string, context: Partial<LogContext>): void {
    const error_obj = error instanceof Error ? error : new Error(error)

    this.writeLog({
      timestamp: this.formatTimestamp(),
      level: LogLevel.ERROR,
      service: this.service_name,
      version: this.version,
      correlation_id: context.correlation_id || 'no-correlation-id',
      workspace_slug: context.workspace_slug,
      license_id: context.license_id,
      event,
      details: context.details,
      error: {
        code: context.error?.code,
        message: error_obj.message,
        stack: error_obj.stack,
      },
    })
  }

  fatal(event: string, error: Error | string, context: Partial<LogContext>): void {
    const error_obj = error instanceof Error ? error : new Error(error)

    this.writeLog({
      timestamp: this.formatTimestamp(),
      level: LogLevel.FATAL,
      service: this.service_name,
      version: this.version,
      correlation_id: context.correlation_id || 'no-correlation-id',
      workspace_slug: context.workspace_slug,
      event,
      error: {
        code: context.error?.code,
        message: error_obj.message,
        stack: error_obj.stack,
      },
    })
  }
}

export default {
  ProvisioningErrorHandler,
  StructuredLogger,
  ProvisioningErrorCode,
  LogLevel,
}
