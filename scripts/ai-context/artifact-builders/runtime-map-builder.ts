/**
 * Runtime Map Builder - Generate ai-runtime-map.json
 * Task: T021
 * Path: scripts/ai-context/artifact-builders/runtime-map-builder.ts
 */

import type { AIRuntimeMap } from '../../../packages/types/src/ai-context'
import type { SourceMetadata } from '../source-loader'

export async function buildRuntimeMap(metadata: SourceMetadata): Promise<AIRuntimeMap> {
  const services: AIRuntimeMap['services'] = {}

  // Map Docker services to modules
  for (const dockerService of metadata.dockerServices) {
    let correspondingModule = ''

    // Match service to module
    if (dockerService.name.includes('api')) {
      correspondingModule = 'apps/api'
    } else if (dockerService.name.includes('worker')) {
      correspondingModule = 'apps/worker'
    } else if (dockerService.name.includes('mmc')) {
      correspondingModule = 'apps/mmc'
    } else if (dockerService.name.includes('backoffice')) {
      correspondingModule = 'apps/backoffice'
    } else if (dockerService.name.includes('frontoffice')) {
      correspondingModule = 'apps/frontoffice'
    }

    if (correspondingModule) {
      services[dockerService.name] = {
        module: correspondingModule,
        runtime: 'Bun',
        framework: dockerService.name.includes('api') ? 'Hono' : 'Node.js',
        depends_on: [],
        port: 3000,
      }
    }
  }

  // Add infrastructure dependencies
  const infrastructure: AIRuntimeMap['infrastructure'] = {
    postgres: {
      type: 'postgres',
      version: '15',
      port: 5432,
    },
    redis: {
      type: 'redis',
      version: '7',
      port: 6379,
    },
  }

  return {
    schema_version: '1.0.0',
    generated_at: new Date().toISOString(),
    services,
    infrastructure,
  }
}
