#!/usr/bin/env bun
/**
 * @script ai:runtime:status
 * @domain ai
 * @category dev
 * @description Check the AI runtime environment layers, report health status,
 *   and exit non-zero when runtime prerequisites are broken.
 * @usage bun run ai:runtime:status
 */

import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { exit, log } from '../utils/logger'

// ─── Types ──────────────────────────────────────────────────────────────────

export type CheckStatus = 'ok' | 'warning' | 'error'

type OkResult = { label: string; status: 'ok'; message: string }
type WarnResult = { label: string; status: 'warning'; message: string; suggestion: string }
type ErrorResult = { label: string; status: 'error'; message: string; suggestion: string }
export type CheckResult = OkResult | WarnResult | ErrorResult

// ─── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_THRESHOLD_MS = 24 * 60 * 60 * 1000 // 24 hours

const CONTEXT_ARTIFACTS = [
  'docs/ai/context/ai-context-mini.json',
  'docs/ai/context/ai-architecture-brain.json',
  'docs/ai/context/ai-module-map.json',
  'docs/ai/context/ai-layer-model.json',
  'docs/ai/context/ai-runtime-map.json',
  'docs/ai/context/ai-dependency-graph.json',
]

const SKILL_NAMES = [
  'architecture-intelligence',
  'architecture-self-healing',
  'analysis-retry-engine',
  'subagent-parallelization',
  'terminal-safety',
  'rtk-execution-layer',
  'mcp-routing',
]

const GOVERNANCE_SCRIPTS = [
  'scripts/ai-guard.ts',
  'scripts/infra-audit.ts',
  'scripts/governance/validate-architecture-brain.ts',
  'scripts/architecture-guard/architecture-guard.ts',
  'scripts/type-safety-guard.ts',
]

const MCP_MATRIX_PATH = 'docs/ai/MCP_ACTIVATION_MATRIX.md'
log.setScript('ai:runtime:status')

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getFreshnessThreshold(): number {
  const envVal = process.env.AI_RUNTIME_FRESHNESS_THRESHOLD_MS
  if (envVal) {
    const parsed = Number(envVal)
    if (!Number.isNaN(parsed) && parsed > 0) return parsed
  }
  return DEFAULT_THRESHOLD_MS
}

// ─── Check Functions ─────────────────────────────────────────────────────────

/**
 * Check 1: Context Loader
 * Verifies all 6 required docs/ai/context/ artifacts exist and are fresh.
 */
export function checkContextLoader(root: string): CheckResult {
  try {
    const missing = CONTEXT_ARTIFACTS.filter((p) => !existsSync(join(root, p)))

    if (missing.length > 0) {
      return {
        label: 'Context Loader',
        status: 'error',
        message: `Missing artifacts: ${missing.join(', ')}`,
        suggestion: 'bun run ai:context:refresh',
      }
    }

    const miniJsonPath = join(root, 'docs/ai/context/ai-context-mini.json')
    const stat = statSync(miniJsonPath)
    const ageMs = Date.now() - stat.mtimeMs
    const threshold = getFreshnessThreshold()

    if (ageMs > threshold) {
      return {
        label: 'Context Loader',
        status: 'warning',
        message: 'AI context artifacts are stale',
        suggestion: 'bun run ai:context:refresh',
      }
    }

    return {
      label: 'Context Loader',
      status: 'ok',
      message: 'AI context artifacts present and fresh',
    }
  } catch {
    return {
      label: 'Context Loader',
      status: 'error',
      message: 'Check failed with exception',
      suggestion: 'bun run ai:context:refresh',
    }
  }
}

/**
 * Check 2: Skill Loader
 * Verifies all 7 required .agents/skills/ SKILL.md files exist.
 */
export function checkSkillLoader(root: string): CheckResult {
  try {
    const missing = SKILL_NAMES.filter(
      (name) => !existsSync(join(root, '.agents', 'skills', name, 'SKILL.md'))
    )
    const present = SKILL_NAMES.length - missing.length

    if (missing.length > 0) {
      const missingPaths = missing.map((name) => `.agents/skills/${name}/SKILL.md`)
      return {
        label: 'Skill Loader',
        status: 'error',
        message: `Core skills present (${present}/7). Missing: ${missingPaths.join(', ')}`,
        suggestion: 'Restore missing skill directories under .agents/skills/',
      }
    }

    return {
      label: 'Skill Loader',
      status: 'ok',
      message: 'Core skills present (7/7)',
    }
  } catch {
    return {
      label: 'Skill Loader',
      status: 'error',
      message: 'Check failed with exception',
      suggestion: 'Restore missing skill directories under .agents/skills/',
    }
  }
}

/**
 * Check 3: Architecture Intelligence
 * Verifies brain JSON validity, edge pattern compliance, and ARCHITECTURE_MAP.json existence.
 * Uses INDEPENDENT try/catch per sub-check so both always execute.
 */
export function checkArchitectureIntelligence(root: string): CheckResult {
  const validEdgePattern = /^(packages|apps)\/[^/]+$/

  let brainError: string | null = null
  let edgeWarning: string | null = null

  // Sub-check 3a (independent try/catch): brain existence + JSON parse + edge validation
  try {
    const brainPath = join(root, 'docs/ai/context/ai-architecture-brain.json')

    if (!existsSync(brainPath)) {
      brainError = 'Architecture brain absent'
    } else {
      let parsed: unknown
      try {
        parsed = JSON.parse(readFileSync(brainPath, 'utf-8'))
      } catch {
        brainError = 'Architecture brain unparseable'
        parsed = null
      }

      if (parsed === null || parsed === undefined) {
        brainError = brainError ?? 'Architecture brain unparseable'
      } else if (typeof parsed !== 'object' || Array.isArray(parsed)) {
        brainError = 'Architecture brain unparseable'
      } else if (Object.keys(parsed as object).length === 0) {
        brainError = 'Architecture brain is empty'
      } else {
        // Edge validation
        const brain = parsed as Record<string, unknown>
        const graph = brain.dependencyGraph as Record<string, unknown> | undefined
        const edges = graph?.edges

        if (Array.isArray(edges)) {
          const sample = edges.slice(0, 200)
          const violatingEdges: string[] = []

          for (const edge of sample) {
            const e = edge as Record<string, unknown>
            if (typeof e.from === 'string' && !validEdgePattern.test(e.from)) {
              violatingEdges.push(`from: ${e.from}`)
            }
            if (typeof e.to === 'string' && !validEdgePattern.test(e.to)) {
              violatingEdges.push(`to: ${e.to}`)
            }
          }

          if (violatingEdges.length > 0) {
            edgeWarning = `${violatingEdges.length} edge endpoint(s) violate module path pattern`
          }
        }
      }
    }
  } catch {
    brainError = 'Check failed with exception'
  }

  // Sub-check 3b (independent try/catch): ARCHITECTURE_MAP.json existence
  let mapError: string | null = null
  try {
    const mapPath = join(root, 'docs/architecture/intelligence/ARCHITECTURE_MAP.json')
    if (!existsSync(mapPath)) {
      mapError = 'ARCHITECTURE_MAP.json absent'
    }
  } catch {
    mapError = 'Check failed with exception'
  }

  // Aggregate results
  if (brainError !== null) {
    return {
      label: 'Architecture Intelligence',
      status: 'error',
      message: brainError,
      suggestion: 'bun run arch:validate:brain',
    }
  }

  if (mapError !== null) {
    return {
      label: 'Architecture Intelligence',
      status: 'error',
      message: mapError,
      suggestion: 'bun run arch:generate',
    }
  }

  if (edgeWarning !== null) {
    return {
      label: 'Architecture Intelligence',
      status: 'warning',
      message: edgeWarning,
      suggestion: 'bun run arch:validate:brain',
    }
  }

  return {
    label: 'Architecture Intelligence',
    status: 'ok',
    message: 'Brain valid, ARCHITECTURE_MAP.json present',
  }
}

/**
 * Check 4: MCP Routing
 * Verifies the MCP activation matrix is present.
 */
export function checkMcpRouting(root: string): CheckResult {
  try {
    if (!existsSync(join(root, MCP_MATRIX_PATH))) {
      return {
        label: 'MCP Routing',
        status: 'warning',
        message: 'MCP activation matrix absent',
        suggestion: 'Restore docs/ai/MCP_ACTIVATION_MATRIX.md',
      }
    }

    return {
      label: 'MCP Routing',
      status: 'ok',
      message: 'MCP activation matrix present',
    }
  } catch {
    return {
      label: 'MCP Routing',
      status: 'error',
      message: 'Check failed with exception',
      suggestion: 'Restore docs/ai/MCP_ACTIVATION_MATRIX.md',
    }
  }
}

/**
 * Check 5: Deterministic Execution
 * Verifies all 5 governance scripts are present.
 */
export function checkDeterministicExecution(root: string): CheckResult {
  try {
    const missing = GOVERNANCE_SCRIPTS.filter((p) => !existsSync(join(root, p)))

    if (missing.length > 0) {
      return {
        label: 'Deterministic Execution',
        status: 'error',
        message: `Missing: ${missing.join(', ')}`,
        suggestion: 'Restore missing governance scripts',
      }
    }

    return {
      label: 'Deterministic Execution',
      status: 'ok',
      message: 'Runtime governance scripts present',
    }
  } catch {
    return {
      label: 'Deterministic Execution',
      status: 'error',
      message: 'Check failed with exception',
      suggestion: 'Restore missing governance scripts',
    }
  }
}

// ─── Output Formatter ────────────────────────────────────────────────────────

const LABEL_WIDTH = 32
const SYMBOL_OK = '[✔]'
const SYMBOL_WARNING = '[⚠]'
const SYMBOL_ERROR = '[✗]'

export function printResults(results: CheckResult[]): void {
  process.stdout.write('AI Runtime Status\n─────────────────\n')

  for (const result of results) {
    const symbol =
      result.status === 'ok'
        ? SYMBOL_OK
        : result.status === 'warning'
          ? SYMBOL_WARNING
          : SYMBOL_ERROR

    const label = `${result.label}:`.padEnd(LABEL_WIDTH)
    let line = `${symbol} ${label} ${result.message}`

    if (result.status === 'error' || result.status === 'warning') {
      line += ` → run: ${result.suggestion}`
    }

    process.stdout.write(`${line}\n`)
  }

  const errors = results.filter((r) => r.status === 'error').length
  const warnings = results.filter((r) => r.status === 'warning').length
  const healthy = errors === 0

  const summaryLabel = healthy ? 'HEALTHY' : 'UNHEALTHY'
  const summaryDetail = healthy
    ? ''
    : ` (${errors} error${errors !== 1 ? 's' : ''}, ${warnings} warning${warnings !== 1 ? 's' : ''})`

  process.stdout.write(`\nAI runtime environment: ${summaryLabel}${summaryDetail}\n`)
}

function isDirectExecution(): boolean {
  const entry = process.argv[1] ?? ''
  return /(?:^|[\\/])runtime-status\.ts$/.test(entry)
}

// ─── Entry Point ─────────────────────────────────────────────────────────────

export async function main(): Promise<void> {
  log.header('AI RUNTIME STATUS', 'Checks the health of the AI agent runtime environment')
  process.stdout.write('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
  process.stdout.write('AI RUNTIME STATUS CHECK\n')
  process.stdout.write('Checks all 5 layers of the AI Agent Runtime Environment\n')
  process.stdout.write('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n')
  const root = process.cwd()

  const results: CheckResult[] = [
    checkContextLoader(root),
    checkSkillLoader(root),
    checkArchitectureIntelligence(root),
    checkMcpRouting(root),
    checkDeterministicExecution(root),
  ]

  printResults(results)

  const errors = results.filter((r) => r.status === 'error').length
  const _warnings = results.filter((r) => r.status === 'warning').length
  const healthy = results.length - errors

  process.stdout.write(
    `\n\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\\n`
  )
  process.stdout.write('RESULT\\n')
  process.stdout.write(`Total: ${results.length}\\n`)
  process.stdout.write(`Healthy: ${healthy}\\n`)
  process.stdout.write(`Failed: ${errors}\\n`)
  process.stdout.write(
    `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\\n`
  )

  exit(results.some((r) => r.status === 'error') ? 1 : 0)
}

if (isDirectExecution()) {
  main()
}
