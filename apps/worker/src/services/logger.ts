import { createLogger, type Logger } from '@zidney/logger'

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal'

export interface StructuredLogEntry {
  timestamp: string
  level: LogLevel
  service: string
  correlation_id?: string
  [key: string]: unknown
}

export const logger: Logger = createLogger('worker')

export { Logger as default } from '@zidney/logger'
