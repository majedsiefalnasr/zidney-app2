import { existsSync, readFileSync } from 'node:fs'
import type { GuardRule, RuleContext, RuleResult, ViolationRecord } from '../types'

function readText(path: string): string {
  return existsSync(path) ? readFileSync(path, 'utf-8') : ''
}

function signalViolation(
  rule: string,
  message: string,
  file: string,
  sourceModule = 'governance-contract'
): ViolationRecord {
  return {
    rule,
    severity: 'error',
    message,
    location: { file },
    source_module: sourceModule,
    remediation: '',
  }
}

function validateDatabasePerTenantSignals(repoRoot: string): ViolationRecord[] {
  const primerPath = `${repoRoot}/docs/PROJECT_CONTEXT_PRIMER.md`
  const agentsPath = `${repoRoot}/AGENTS.md`
  const primer = readText(primerPath)
  const agents = readText(agentsPath)

  const hasPrimerSignal = /database-per-tenant/i.test(primer)
  const hasNoRowBased = /no row-based multi-tenancy/i.test(primer)
  const hasAgentsSignal = /database-per-tenant/i.test(agents)

  if (hasPrimerSignal && hasNoRowBased && hasAgentsSignal) {
    return []
  }

  return [
    signalViolation(
      'non-negotiables.database-per-tenant',
      'Missing required database-per-tenant governance signals in architecture contracts.',
      hasPrimerSignal
        ? agentsPath.replace(`${repoRoot}/`, '')
        : primerPath.replace(`${repoRoot}/`, '')
    ),
  ]
}

function validateCrossTenantJoinPatterns(context: RuleContext): ViolationRecord[] {
  const violations: ViolationRecord[] = []
  const patterns = [
    /from\s+workspace_[a-z0-9_]+\s+join\s+workspace_[a-z0-9_]+/i,
    /join\s+workspace_[a-z0-9_]+/i,
  ]

  for (const file of context.targetFiles) {
    if (!/\.(ts|tsx|js|jsx|sql)$/.test(file)) {
      continue
    }
    if (!file.startsWith('apps/') && !file.startsWith('packages/')) {
      continue
    }
    if (!existsSync(file)) {
      continue
    }
    const content = readFileSync(file, 'utf-8')
    const lines = content.split('\n')
    lines.forEach((line, index) => {
      const trimmed = line.trim()
      if (
        trimmed.startsWith('//') ||
        trimmed.startsWith('/*') ||
        trimmed.startsWith('*') ||
        trimmed.startsWith('--') ||
        trimmed.startsWith('#')
      ) {
        return
      }

      for (const pattern of patterns) {
        if (!pattern.test(line)) {
          continue
        }
        violations.push({
          rule: 'non-negotiables.cross-tenant-join',
          severity: 'error',
          message: 'Potential cross-tenant join pattern detected in governed source.',
          location: {
            file,
            line: index + 1,
            column: Math.max(line.search(pattern), 0) + 1,
          },
          source_module: file.startsWith('apps/')
            ? file.split('/').slice(0, 2).join('/')
            : 'unknown',
          remediation: '',
        })
      }
    })
  }

  return violations
}

function validateLicenseMiddlewareContract(repoRoot: string): ViolationRecord[] {
  const appPath = `${repoRoot}/apps/api/src/app.ts`
  const appText = readText(appPath)
  const hasWorkspaceBinding = appText.includes("app.use('/api/workspaces/*', tenantResolver)")
  const hasLicenseBinding =
    appText.includes("app.use('/api/workspaces/*', licenseMiddleware)") ||
    appText.includes('licenseEnforcementMiddleware')

  if (hasWorkspaceBinding && hasLicenseBinding) {
    return []
  }

  return [
    signalViolation(
      'non-negotiables.license-middleware',
      'Mandatory workspace-bound tenant and license middleware contract surface is missing.',
      'apps/api/src/app.ts',
      'apps/api'
    ),
  ]
}

function validateArchitectureDrift(repoRoot: string): ViolationRecord[] {
  const required = [
    'docs/ai/context/ai-architecture-summary.md',
    'docs/ai/context/ai-module-map.json',
    'docs/ai/context/ai-layer-model.json',
    'docs/ai/context/ai-dependency-graph.json',
    'docs/ai/context/ai-runtime-map.json',
    'docs/ai/context/ai-runtime-dependents.json',
    'docs/ai/context/ai-architecture-brain.json',
    'docs/ai/context/ai-architecture-diff.json',
    'docs/ai/context/ai-context-mini.json',
  ]

  const missing = required.filter((relativePath) => !existsSync(`${repoRoot}/${relativePath}`))
  if (missing.length > 0) {
    return missing.map((file) =>
      signalViolation(
        'non-negotiables.arch-drift',
        'Architecture context artifact is missing; regenerate architecture intelligence context.',
        file
      )
    )
  }

  try {
    const map = JSON.parse(
      readFileSync(`${repoRoot}/docs/architecture/intelligence/ARCHITECTURE_MAP.json`, 'utf-8')
    ) as { modules?: Record<string, unknown> }
    const graph = JSON.parse(
      readFileSync(`${repoRoot}/docs/ai/context/ai-dependency-graph.json`, 'utf-8')
    ) as { modules?: string[] | Record<string, unknown> }

    const mapModules = new Set(Object.keys(map.modules ?? {}))
    const graphModules = new Set(
      Array.isArray(graph.modules) ? graph.modules : Object.keys(graph.modules ?? {})
    )

    const unresolved = [...mapModules].filter((module) => !graphModules.has(module))
    if (unresolved.length > 0) {
      return unresolved.map((module) =>
        signalViolation(
          'non-negotiables.arch-drift',
          `Architecture drift detected: module missing from dependency graph (${module}).`,
          'docs/ai/context/ai-dependency-graph.json'
        )
      )
    }
  } catch {
    return [
      signalViolation(
        'non-negotiables.arch-drift',
        'Unable to parse architecture map or dependency graph for consistency check.',
        'docs/ai/context/ai-dependency-graph.json'
      ),
    ]
  }

  return []
}

export async function runNonNegotiablesRule(context: RuleContext): Promise<RuleResult> {
  const violations = [
    ...validateDatabasePerTenantSignals(context.repoRoot),
    ...validateCrossTenantJoinPatterns(context),
    ...validateLicenseMiddlewareContract(context.repoRoot),
    ...validateArchitectureDrift(context.repoRoot),
  ]

  return {
    rule: 'non-negotiables',
    violations,
  }
}

export const nonNegotiablesRule: GuardRule = {
  id: 'non-negotiables',
  order: 30,
  enabledIn: ['development', 'strict', 'changed'],
  run: runNonNegotiablesRule,
}
