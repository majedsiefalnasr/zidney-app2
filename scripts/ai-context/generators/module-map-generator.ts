/**
 * Module Map Generator (T027)
 *
 * Purpose: Generate complete module dependency map
 * Target: <200KB artifact
 *
 * Provides:
 * - All known modules in repository
 * - Direct dependencies per module
 * - Module metadata
 */

import { createLogger } from '../../core/logger-factory'
import { generateModuleRoster } from '../../core/module-roster'

const logger = createLogger('module-map-generator')

export interface ModuleMapData {
  timestamp: number
  modules: Array<{
    name: string
    type: 'package' | 'app'
    dependencies: string[]
    dependents: string[]
    version?: string
  }>
  moduleCount: number
  edgeCount: number
}

/**
 * Generate module map
 */
export async function generateModuleMap(): Promise<ModuleMapData> {
  logger.info('Generating module map')

  try {
    const roster = generateModuleRoster()

    const data: ModuleMapData = {
      timestamp: Date.now(),
      modules: roster.modules.map((m) => ({
        name: m.name,
        type: m.type,
        dependencies: m.dependencies,
        dependents: m.dependents,
        version: m.version,
      })),
      moduleCount: roster.modules.length,
      edgeCount: roster.modules.reduce((sum, m) => sum + m.dependencies.length, 0),
    }

    const sizeBytes = JSON.stringify(data).length
    logger.info('Module map generated', {
      modules: data.moduleCount,
      size_kb: (sizeBytes / 1024).toFixed(1),
    })

    return data
  } catch (error) {
    logger.error('Module map generation failed', { error: String(error) })
    throw error
  }
}

/**
 * Validate module map completeness
 */
export function validateModuleMapCompleteness(data: ModuleMapData): {
  isComplete: boolean
  issues: string[]
} {
  const issues: string[] = []

  if (data.moduleCount === 0) {
    issues.push('No modules found in map')
  }

  if (data.edgeCount === 0 && data.moduleCount > 1) {
    issues.push('Multiple modules found but no dependencies registered')
  }

  for (const module of data.modules) {
    if (!module.name) {
      issues.push(`Module missing name`)
    }
  }

  return {
    isComplete: issues.length === 0,
    issues,
  }
}

/**
 * Get module map statistics
 */
export function getModuleMapStats(data: ModuleMapData): Record<string, unknown> {
  const packages = data.modules.filter((m) => m.type === 'package').length
  const apps = data.modules.filter((m) => m.type === 'app').length
  const avgDeps = data.edgeCount / (data.moduleCount || 1)

  return {
    total_modules: data.moduleCount,
    packages,
    apps,
    total_edges: data.edgeCount,
    avg_dependencies: avgDeps.toFixed(2),
    size_bytes: JSON.stringify(data).length,
  }
}

export default generateModuleMap
