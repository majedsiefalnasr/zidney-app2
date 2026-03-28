/**
 * Diff Engine Module
 *
 * Purpose: Extract diff generation logic from architecture-diff
 * Used by: architecture-diff, change detection
 *
 * Provides:
 * - Architecture state comparison
 * - Drift detection
 * - Change reporting
 
 * @library-module
*/

import { createHash } from 'node:crypto'
import type { GraphEdge } from '../../core/graph-analyzer'

export interface ArchitectureSnapshot {
  timestamp: number
  moduleCount: number
  edgeCount: number
  modules: string[]
  edges: GraphEdge[]
  hash: string
}

export interface ArchitectureDiff {
  timestamp: number
  snapshotA: ArchitectureSnapshot
  snapshotB: ArchitectureSnapshot
  hasChanged: boolean
  driftDetected: boolean
  addedModules: string[]
  removedModules: string[]
  addedEdges: GraphEdge[]
  removedEdges: GraphEdge[]
  changedDependencies: {
    module: string
    from: string[]
    to: string[]
  }[]
}

/**
 * Create a snapshot of current architecture
 */
export function createSnapshot(modules: string[], edges: GraphEdge[]): ArchitectureSnapshot {
  const hash = createHash('sha256')
    .update(JSON.stringify({ modules, edges }))
    .digest('hex')
    .slice(0, 16)

  return {
    timestamp: Date.now(),
    moduleCount: modules.length,
    edgeCount: edges.length,
    modules,
    edges,
    hash,
  }
}

/**
 * Compare two architecture snapshots
 */
export function compareSnapshots(
  snapshotA: ArchitectureSnapshot,
  snapshotB: ArchitectureSnapshot
): ArchitectureDiff {
  const modulesA = new Set(snapshotA.modules)
  const modulesB = new Set(snapshotB.modules)

  // Find added and removed modules
  const addedModules = Array.from(modulesB).filter((m) => !modulesA.has(m))
  const removedModules = Array.from(modulesA).filter((m) => !modulesB.has(m))

  // Find added and removed edges
  const edgeSetA = new Set(snapshotA.edges.map((e) => `${e.from} → ${e.to}`))
  const edgeSetB = new Set(snapshotB.edges.map((e) => `${e.from} → ${e.to}`))

  const addedEdges = snapshotB.edges.filter((e) => !edgeSetA.has(`${e.from} → ${e.to}`))
  const removedEdges = snapshotA.edges.filter((e) => !edgeSetB.has(`${e.from} → ${e.to}`))

  // Find changed dependencies per module
  const changedDependencies: ArchitectureDiff['changedDependencies'] = []
  const commonModules = Array.from(modulesA).filter((m) => modulesB.has(m))

  for (const module of commonModules) {
    const depsA = snapshotA.edges
      .filter((e) => e.from === module)
      .map((e) => e.to)
      .sort()
    const depsB = snapshotB.edges
      .filter((e) => e.from === module)
      .map((e) => e.to)
      .sort()

    if (JSON.stringify(depsA) !== JSON.stringify(depsB)) {
      changedDependencies.push({
        module,
        from: depsA,
        to: depsB,
      })
    }
  }

  const hasChanged =
    addedModules.length > 0 || removedModules.length > 0 || changedDependencies.length > 0

  return {
    timestamp: Date.now(),
    snapshotA,
    snapshotB,
    hasChanged,
    driftDetected: snapshotA.hash !== snapshotB.hash,
    addedModules,
    removedModules,
    addedEdges,
    removedEdges,
    changedDependencies,
  }
}

/**
 * Detect architecture drift
 */
export function detectDrift(
  expectedSnapshot: ArchitectureSnapshot,
  currentSnapshot: ArchitectureSnapshot
): boolean {
  return expectedSnapshot.hash !== currentSnapshot.hash
}

/**
 * Check if changes are significant
 */
export function isSignificantChange(diff: ArchitectureDiff): boolean {
  // Significant if module count changed by >10% or critical edges changed
  const moduleChangePercent =
    Math.abs(diff.snapshotB.moduleCount - diff.snapshotA.moduleCount) / diff.snapshotA.moduleCount

  return (
    moduleChangePercent > 0.1 || diff.removedEdges.length > 0 || diff.changedDependencies.length > 5
  )
}

/**
 * Format diff for display
 */
export function formatDiff(diff: ArchitectureDiff): string {
  const lines: string[] = [
    `Architecture Diff Report`,
    `Generated: ${new Date(diff.timestamp).toISOString()}`,
    `Snapshot A: ${new Date(diff.snapshotA.timestamp).toISOString()}`,
    `Snapshot B: ${new Date(diff.snapshotB.timestamp).toISOString()}`,
    `Has Changed: ${diff.hasChanged ? 'YES' : 'NO'}`,
    `Drift Detected: ${diff.driftDetected ? 'YES' : 'NO'}`,
    ``,
    `Added Modules: ${diff.addedModules.length}`,
  ]

  if (diff.addedModules.length > 0) {
    diff.addedModules.forEach((m) => {
      lines.push(`  + ${m}`)
    })
  }

  lines.push(`Removed Modules: ${diff.removedModules.length}`)
  if (diff.removedModules.length > 0) {
    diff.removedModules.forEach((m) => {
      lines.push(`  - ${m}`)
    })
  }

  lines.push(`Added Dependencies: ${diff.addedEdges.length}`)
  if (diff.addedEdges.length > 0 && diff.addedEdges.length <= 10) {
    diff.addedEdges.forEach((e) => {
      lines.push(`  + ${e.from} → ${e.to}`)
    })
  }

  lines.push(`Removed Dependencies: ${diff.removedEdges.length}`)
  if (diff.removedEdges.length > 0 && diff.removedEdges.length <= 10) {
    diff.removedEdges.forEach((e) => {
      lines.push(`  - ${e.from} → ${e.to}`)
    })
  }

  lines.push(`Changed Dependency Patterns: ${diff.changedDependencies.length}`)
  if (diff.changedDependencies.length > 0 && diff.changedDependencies.length <= 5) {
    diff.changedDependencies.forEach((c) => {
      lines.push(`  ${c.module}:`)
      lines.push(`    from: [${c.from.join(', ')}]`)
      lines.push(`    to: [${c.to.join(', ')}]`)
    })
  }

  return lines.join('\n')
}

/**
 * Export diff to JSON for CI tracking
 */
export function exportDiffAsJSON(diff: ArchitectureDiff): string {
  return JSON.stringify(
    {
      timestamp: diff.timestamp,
      hasChanged: diff.hasChanged,
      driftDetected: diff.driftDetected,
      metrics: {
        moduleCount: {
          before: diff.snapshotA.moduleCount,
          after: diff.snapshotB.moduleCount,
          change: diff.snapshotB.moduleCount - diff.snapshotA.moduleCount,
        },
        edgeCount: {
          before: diff.snapshotA.edgeCount,
          after: diff.snapshotB.edgeCount,
          change: diff.snapshotB.edgeCount - diff.snapshotA.edgeCount,
        },
      },
      changes: {
        addedModules: diff.addedModules,
        removedModules: diff.removedModules,
        addedEdgesCount: diff.addedEdges.length,
        removedEdgesCount: diff.removedEdges.length,
        changedDependencyPatternsCount: diff.changedDependencies.length,
      },
    },
    null,
    2
  )
}
