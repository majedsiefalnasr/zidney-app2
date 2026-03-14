/**
 * Architecture Diff Generator (T032)
 *
 * Purpose: Generate architecture change summary and drift detection
 * Target: <100KB artifact
 *
 * Provides:
 * - Comparison with previous state
 * - Drift detection
 * - Impact analysis summary
 */

import { compareSnapshots, createSnapshot } from '../../architecture/core/diff-engine'
import type { GraphEdge } from '../../core/graph-analyzer'
import { createLogger } from '../../core/logger-factory'

const logger = createLogger('architecture-diff-generator')

export interface ArchitectureDiffData {
  timestamp: number
  snapshotA: {
    timestamp: number
    moduleCount: number
    edgeCount: number
    hash: string
  }
  snapshotB: {
    timestamp: number
    moduleCount: number
    edgeCount: number
    hash: string
  }
  hasChanged: boolean
  driftDetected: boolean
  changes: {
    addedModules: string[]
    removedModules: string[]
    addedEdgesCount: number
    removedEdgesCount: number
    changedDependencyPatternsCount: number
  }
  significant: boolean
}

/**
 * Generate architecture diff
 */
export async function generateArchitectureDiff(): Promise<ArchitectureDiffData> {
  logger.info('Generating architecture diff')

  try {
    // Current snapshot (placeholder)
    const currentModules = [
      'packages/domain-core',
      'packages/types',
      'packages/validation',
      'packages/api-client',
      'packages/config',
      'packages/logger',
      'packages/redis-utils',
      'packages/job-queue',
      'packages/ui-system',
      'apps/api',
      'apps/backoffice',
      'apps/frontoffice',
      'apps/mmc',
      'apps/worker',
    ]

    const currentEdges: GraphEdge[] = [
      { from: 'packages/api-client', to: 'packages/types' },
      { from: 'packages/domain-core', to: 'packages/types' },
      { from: 'packages/ui-system', to: 'packages/types' },
      { from: 'apps/api', to: 'packages/domain-core' },
      { from: 'apps/api', to: 'packages/logger' },
      { from: 'apps/backoffice', to: 'packages/ui-system' },
      { from: 'apps/backoffice', to: 'packages/api-client' },
      { from: 'apps/frontoffice', to: 'packages/ui-system' },
      { from: 'apps/mmc', to: 'packages/logger' },
      { from: 'apps/worker', to: 'packages/job-queue' },
    ]

    const currentSnapshot = createSnapshot(currentModules, currentEdges)

    // Previous snapshot (placeholder - assume same state initially)
    const previousSnapshot = createSnapshot(currentModules, currentEdges)

    // Compare
    const diff = compareSnapshots(previousSnapshot, currentSnapshot)

    // Determine if significant
    const significant =
      diff.addedModules.length > 2 ||
      diff.removedModules.length > 0 ||
      diff.changedDependencies.length > 5

    const data: ArchitectureDiffData = {
      timestamp: Date.now(),
      snapshotA: {
        timestamp: previousSnapshot.timestamp,
        moduleCount: previousSnapshot.moduleCount,
        edgeCount: previousSnapshot.edgeCount,
        hash: previousSnapshot.hash,
      },
      snapshotB: {
        timestamp: currentSnapshot.timestamp,
        moduleCount: currentSnapshot.moduleCount,
        edgeCount: currentSnapshot.edgeCount,
        hash: currentSnapshot.hash,
      },
      hasChanged: diff.hasChanged,
      driftDetected: diff.driftDetected,
      changes: {
        addedModules: diff.addedModules,
        removedModules: diff.removedModules,
        addedEdgesCount: diff.addedEdges.length,
        removedEdgesCount: diff.removedEdges.length,
        changedDependencyPatternsCount: diff.changedDependencies.length,
      },
      significant,
    }

    const sizeBytes = JSON.stringify(data).length
    logger.info('Architecture diff generated', {
      has_changed: data.hasChanged,
      drift_detected: data.driftDetected,
      significant: significant,
      size_kb: (sizeBytes / 1024).toFixed(1),
    })

    return data
  } catch (error) {
    logger.error('Architecture diff generation failed', { error: String(error) })
    throw error
  }
}

/**
 * Assess diff significance
 */
export function assessDiffSignificance(data: ArchitectureDiffData): {
  level: 'LOW' | 'MEDIUM' | 'HIGH'
  reason: string
} {
  if (!data.hasChanged) {
    return { level: 'LOW', reason: 'No changes detected' }
  }

  if (data.removedModules.length > 0) {
    return { level: 'HIGH', reason: 'Critical: modules removed from architecture' }
  }

  if (data.addedModules.length > 3) {
    return { level: 'HIGH', reason: 'Multiple modules added (>3)' }
  }

  if (data.changedDependencies.length > 5) {
    return { level: 'MEDIUM', reason: 'Significant dependency pattern changes' }
  }

  return { level: 'MEDIUM', reason: 'Architecture has changed' }
}

/**
 * Get diff statistics
 */
export function getDiffStats(data: ArchitectureDiffData): Record<string, unknown> {
  return {
    has_changed: data.hasChanged,
    drift_detected: data.driftDetected,
    modules: {
      added: data.changes.addedModules.length,
      removed: data.changes.removedModules.length,
    },
    edges: {
      added: data.changes.addedEdgesCount,
      removed: data.changes.removedEdgesCount,
    },
    patterns: data.changes.changedDependencyPatternsCount,
    significant: data.significant,
    size_bytes: JSON.stringify(data).length,
  }
}

export default generateArchitectureDiff
