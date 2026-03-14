/**
 * Runtime Map Generator (T029)
 *
 * Purpose: Define runtime service topology and interactions
 * Target: <50KB artifact
 *
 * Provides:
 * - Service definitions (API, Worker, MMC, Backoffice, Frontoffice)
 * - Service-to-service communication patterns
 * - Runtime configuration
 */

import { createLogger } from '../../core/logger-factory'

const logger = createLogger('runtime-map-generator')

export interface RuntimeService {
  name: string
  type: 'api' | 'worker' | 'mmc' | 'backoffice' | 'frontoffice'
  dependencies?: string[]
  endpoints?: string[]
  description?: string
}

export interface RuntimeMapData {
  timestamp: number
  services: Record<string, RuntimeService>
  interactions: Array<{
    from: string
    to: string
    type: 'http' | 'queue' | 'cache' | 'database'
  }>
  version: string
}

/**
 * Generate runtime map
 */
export async function generateRuntimeMap(): Promise<RuntimeMapData> {
  logger.info('Generating runtime map')

  try {
    const data: RuntimeMapData = {
      timestamp: Date.now(),
      services: {
        api: {
          name: 'API',
          type: 'api',
          dependencies: ['postgres', 'redis'],
          endpoints: ['/api/v1/auth', '/api/v1/workspace', '/api/v1/attempt'],
          description: 'Bun + Hono REST API server',
        },
        worker: {
          name: 'Worker',
          type: 'worker',
          dependencies: ['postgres', 'redis', 'job-queue'],
          endpoints: [],
          description: 'Background job processor',
        },
        mmc: {
          name: 'MMC',
          type: 'mmc',
          dependencies: ['postgres', 'api'],
          endpoints: ['/api/mmc/dashboard'],
          description: 'Multi-tenant management console',
        },
        backoffice: {
          name: 'Backoffice',
          type: 'backoffice',
          dependencies: ['api'],
          endpoints: ['/backoffice'],
          description: 'Institution management UI',
        },
        frontoffice: {
          name: 'Frontoffice',
          type: 'frontoffice',
          dependencies: ['api'],
          endpoints: ['/exam', '/dashboard'],
          description: 'Student exam and dashboard UI',
        },
      },
      interactions: [
        { from: 'mmc', to: 'api', type: 'http' },
        { from: 'backoffice', to: 'api', type: 'http' },
        { from: 'frontoffice', to: 'api', type: 'http' },
        { from: 'api', to: 'postgres', type: 'database' },
        { from: 'api', to: 'redis', type: 'cache' },
        { from: 'api', to: 'worker', type: 'queue' },
        { from: 'worker', to: 'postgres', type: 'database' },
        { from: 'worker', to: 'redis', type: 'cache' },
      ],
      version: '1.0',
    }

    const sizeBytes = JSON.stringify(data).length
    logger.info('Runtime map generated', {
      services: Object.keys(data.services).length,
      interactions: data.interactions.length,
      size_kb: (sizeBytes / 1024).toFixed(1),
    })

    return data
  } catch (error) {
    logger.error('Runtime map generation failed', { error: String(error) })
    throw error
  }
}

/**
 * Get runtime map statistics
 */
export function getRuntimeMapStats(data: RuntimeMapData): Record<string, unknown> {
  const servicesByType = Object.values(data.services).reduce(
    (acc, svc) => {
      acc[svc.type] = (acc[svc.type] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  return {
    total_services: Object.keys(data.services).length,
    services_by_type: servicesByType,
    total_interactions: data.interactions.length,
    size_bytes: JSON.stringify(data).length,
  }
}

export default generateRuntimeMap
