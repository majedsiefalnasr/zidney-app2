/**
 * Logger Spy for Test Observability
 * Captures and validates structured logging output
 */

export interface LogEntry {
  timestamp: string
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'
  service: string
  workspace_slug?: string
  workspace_id?: string
  correlation_id?: string
  user_id?: string
  message: string
  [key: string]: any
}

export class LoggerSpy {
  private logs: LogEntry[] = []

  /**
   * Capture a log entry (called by the application)
   */
  capture(entry: LogEntry): void {
    this.logs.push(entry)
  }

  /**
   * Get all captured logs
   */
  getLogs(): LogEntry[] {
    return [...this.logs]
  }

  /**
   * Get logs by correlation ID
   */
  getLogsByCorrelationId(id: string): LogEntry[] {
    return this.logs.filter((log) => log.correlation_id === id)
  }

  /**
   * Get logs by level
   */
  getLogsByLevel(level: string): LogEntry[] {
    return this.logs.filter((log) => log.level === level)
  }

  /**
   * Get logs by workspace
   */
  getLogsByWorkspace(workspaceId: string): LogEntry[] {
    return this.logs.filter((log) => log.workspace_id === workspaceId)
  }

  /**
   * Verify all logs have required fields
   */
  verifyRequiredFields(): {
    valid: boolean
    missing: Array<{ index: number; fields: string[] }>
  } {
    const required = [
      'timestamp',
      'level',
      'service',
      'correlation_id',
      'message',
    ]
    const missing: Array<{ index: number; fields: string[] }> = []

    this.logs.forEach((log, index) => {
      const missingFields: string[] = []
      for (const field of required) {
        if (
          !(field in log) ||
          log[field] === undefined ||
          log[field] === null
        ) {
          missingFields.push(field)
        }
      }
      if (missingFields.length > 0) {
        missing.push({ index, fields: missingFields })
      }
    })

    return {
      valid: missing.length === 0,
      missing,
    }
  }

  /**
   * Check for sensitive data exposure in logs
   */
  checkForSensitiveData(): {
    safe: boolean
    violations: Array<{ index: number; field: string; pattern: string }>
  } {
    const sensitivePatterns = [
      { pattern: /password/i, name: 'password' },
      { pattern: /token/i, name: 'token' },
      { pattern: /secret/i, name: 'secret' },
      { pattern: /api[_-]?key/i, name: 'api_key' },
      { pattern: /bearer\s+[a-z0-9]+/i, name: 'bearer_token' },
    ]

    const violations: Array<{ index: number; field: string; pattern: string }> =
      []

    this.logs.forEach((log, index) => {
      Object.entries(log).forEach(([field, value]) => {
        const stringValue = String(value)
        for (const { pattern, name } of sensitivePatterns) {
          if (pattern.test(stringValue)) {
            violations.push({ index, field, pattern: name })
          }
        }
      })
    })

    return {
      safe: violations.length === 0,
      violations,
    }
  }

  /**
   * Verify all logs are valid JSON
   */
  verifyJsonValidity(): {
    valid: boolean
    errors: Array<{ index: number; error: string }>
  } {
    const errors: Array<{ index: number; error: string }> = []

    this.logs.forEach((log, index) => {
      try {
        JSON.stringify(log)
      } catch (e) {
        errors.push({ index, error: String(e) })
      }
    })

    return {
      valid: errors.length === 0,
      errors,
    }
  }

  /**
   * Clear all logs
   */
  clear(): void {
    this.logs = []
  }

  /**
   * Get total log count
   */
  count(): number {
    return this.logs.length
  }
}

/**
 * Factory to create logger spy
 */
export function createLoggerSpy(): LoggerSpy {
  return new LoggerSpy()
}
