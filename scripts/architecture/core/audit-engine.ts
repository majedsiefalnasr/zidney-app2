/**
 * Audit Engine Module
 *
 * Purpose: Extract audit logic from infra-audit
 * Used by: infra-audit, architecture analysis
 *
 * Provides:
 * - Repository-wide architecture auditing
 * - Module discovery and analysis
 * - Violation reporting and scoring
 */

import { findOversizedFiles } from '../../core/file-analyzer'
import type { GraphEdge } from '../../core/graph-analyzer'
import {
  detectCycles,
  findReachable,
  findStronglyConnectedComponents,
} from '../../core/graph-analyzer'

export interface AuditFinding {
  type: 'error' | 'warning' | 'info'
  module: string
  message: string
  severity: 'critical' | 'high' | 'medium' | 'low'
}

export interface AuditReport {
  timestamp: number
  moduleCount: number
  edgeCount: number
  findings: AuditFinding[]
  cycleDetected: boolean
  cycles?: string[][]
  oversizedModules?: string[]
  score: number
}

/**
 * Run full repository audit
 */
export function runFullAudit(
  edges: GraphEdge[],
  modules: string[],
  oversizeThreshold: number = 2000
): AuditReport {
  const findings: AuditFinding[] = []
  const timestamp = Date.now()

  // Check for cycles
  const cycleResult = detectCycles(edges)
  if (cycleResult.hasCycle && cycleResult.cycle) {
    findings.push({
      type: 'error',
      module: cycleResult.cycle.join(' → '),
      message: `Circular dependency detected: ${cycleResult.cycle.join(' → ')}`,
      severity: 'critical',
    })
  }

  // Check for orphaned modules
  const referencedModules = new Set<string>()
  for (const edge of edges) {
    referencedModules.add(edge.from)
    referencedModules.add(edge.to)
  }

  for (const module of modules) {
    if (!referencedModules.has(module)) {
      findings.push({
        type: 'warning',
        module,
        message: `Module ${module} has no dependencies in graph`,
        severity: 'medium',
      })
    }
  }

  // Check for strongly connected components (potential cycles)
  const scc = findStronglyConnectedComponents(edges)
  for (const component of scc) {
    if (component.size > 1) {
      findings.push({
        type: 'error',
        module: Array.from(component).join(', '),
        message: `Strongly connected component detected (potential cycle)`,
        severity: 'high',
      })
    }
  }

  // Check for oversized modules
  const oversized = findOversizedFiles('.', { maxLines: oversizeThreshold })
  if (oversized.length > 0) {
    findings.push({
      type: 'warning',
      module: oversized.map((f) => f.path).join(', '),
      message: `${oversized.length} files exceed size threshold (${oversizeThreshold} lines)`,
      severity: 'medium',
    })
  }

  // Calculate audit score (0-100)
  const criticalCount = findings.filter((f) => f.severity === 'critical').length
  const highCount = findings.filter((f) => f.severity === 'high').length
  const score = Math.max(0, 100 - criticalCount * 25 - highCount * 10)

  return {
    timestamp,
    moduleCount: modules.length,
    edgeCount: edges.length,
    findings,
    cycleDetected: cycleResult.hasCycle,
    cycles: cycleResult.cycle ? [cycleResult.cycle] : undefined,
    oversizedModules: oversized.map((f) => f.path),
    score,
  }
}

/**
 * Audit specific module and its dependencies
 */
export function auditModule(
  moduleName: string,
  edges: GraphEdge[],
  modules: string[]
): AuditReport {
  const findings: AuditFinding[] = []

  // Find all dependencies of module
  const reachable = findReachable(edges, moduleName)

  if (reachable.reachable.size === 0) {
    findings.push({
      type: 'warning',
      module: moduleName,
      message: `Module ${moduleName} has no outgoing dependencies`,
      severity: 'low',
    })
  } else if (reachable.reachable.size > 20) {
    findings.push({
      type: 'warning',
      module: moduleName,
      message: `Module ${moduleName} depends on ${reachable.reachable.size} modules (high coupling)`,
      severity: 'medium',
    })
  }

  return {
    timestamp: Date.now(),
    moduleCount: modules.length,
    edgeCount: edges.length,
    findings,
    cycleDetected: false,
    score: findings.length === 0 ? 100 : 75,
  }
}

/**
 * Check audit health status
 */
export function getAuditHealthStatus(report: AuditReport): 'PASS' | 'WARN' | 'FAIL' {
  const errorCount = report.findings.filter((f) => f.type === 'error').length
  const warningCount = report.findings.filter((f) => f.type === 'warning').length

  if (errorCount > 0) {
    return 'FAIL'
  }
  if (warningCount > 0) {
    return 'WARN'
  }
  return 'PASS'
}

/**
 * Format audit report for display
 */
export function formatAuditReport(report: AuditReport): string {
  const lines: string[] = [
    `Audit Report (${new Date(report.timestamp).toISOString()})`,
    `Modules: ${report.moduleCount}`,
    `Edges: ${report.edgeCount}`,
    `Score: ${report.score}/100`,
    `Status: ${getAuditHealthStatus(report)}`,
    ``,
    `Findings: ${report.findings.length}`,
  ]

  for (const finding of report.findings) {
    lines.push(`  [${finding.severity.toUpperCase()}] ${finding.module}: ${finding.message}`)
  }

  return lines.join('\n')
}
