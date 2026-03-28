/**
 * Mini Context Generator (T026)
 *
 * Purpose: Generate minimal AI context for fast bootstrap
 * Target: <50KB artifact
 *
 * Provides:
 * - Layer model definition
 * - Critical boundaries definition
 * - Quick reference for AI agent startup
 
 * @library-module
*/

import { createLogger } from '../../utils/logger'

const logger = createLogger('mini-context-generator')

export interface MiniContextData {
  timestamp: number
  layers: Record<string, string[]>
  boundaries: {
    forbidden_dependencies: Record<string, string[]>
    forbidden_layers: Record<string, string[]>
  }
  critical_rules: string[]
  version: string
}

/**
 * Generate mini context (critical path, <50KB target)
 */
export async function generateMiniContext(): Promise<MiniContextData> {
  logger.info('Generating mini context')

  const data: MiniContextData = {
    timestamp: Date.now(),
    layers: {
      'ui-layer': ['packages/ui-system', 'apps/frontoffice', 'apps/backoffice'],
      'api-layer': ['apps/api'],
      'domain-layer': ['packages/domain-core', 'packages/validation'],
      'infrastructure-layer': ['packages/logger', 'packages/redis-utils', 'packages/job-queue'],
      'config-layer': ['packages/config'],
      'types-layer': ['packages/types'],
    },
    boundaries: {
      forbidden_dependencies: {
        'ui-layer/*': ['apps/api', 'packages/domain-core'],
        'api-layer/*': ['packages/ui-system'],
      },
      forbidden_layers: {
        'ui-layer': ['api-layer', 'domain-layer'],
        'config-layer': ['ui-layer', 'api-layer', 'domain-layer'],
      },
    },
    critical_rules: [
      'No cross-app imports',
      'UI cannot import domain logic directly',
      'Database-per-tenant isolation mandatory',
      'License enforcement on all workspace routes',
    ],
    version: '2.0',
  }

  logger.info('Mini context generated', { size_bytes: JSON.stringify(data).length })
  return data
}

/**
 * Validate mini context size
 */
export function validateMiniContextSize(data: MiniContextData, maxSizeBytes = 51200): boolean {
  const sizeBytes = JSON.stringify(data).length
  const isValid = sizeBytes <= maxSizeBytes

  if (!isValid) {
    logger.warn(`Mini context exceeds size limit`, {
      current: sizeBytes,
      max: maxSizeBytes,
      excess: sizeBytes - maxSizeBytes,
    })
  }

  return isValid
}

/**
 * Get mini context file size metrics
 */
export function getMiniContextMetrics(data: MiniContextData): {
  sizeBytes: number
  sizeKb: number
} {
  const sizeBytes = JSON.stringify(data).length
  return {
    sizeBytes,
    sizeKb: sizeBytes / 1024,
  }
}

export default generateMiniContext
