import { existsSync, readFileSync } from 'node:fs'
import {
  detectFileModule,
  extractImports,
  loadModuleBoundaries,
  loadTsAliases,
  validateArchitectureMap,
  validateCrossAppImports,
  validateLayerBoundaries,
  validateRelativeLeaks,
  validateRules,
} from '../../ai-guard'
import type { GuardRule, RuleContext, RuleResult, ViolationRecord } from '../types'

interface ArchitectureContract {
  dependencyRules?: {
    forbidden?: Record<string, string[]>
  }
  layerRules?: {
    forbidden?: Record<string, string[]>
  }
}

interface ArchitectureMap {
  modules?: Record<
    string,
    {
      layer?: string
      allowed_dependencies?: string[]
      forbidden_dependencies?: string[]
    }
  >
}

interface ArchitectureBrain {
  rules?: {
    dependencyRules?: {
      forbidden?: Record<string, string[]>
    }
    layerRules?: {
      forbidden?: Record<string, string[]>
    }
  }
}

function loadContract(repoRoot: string): ArchitectureContract {
  const brainPath = `${repoRoot}/docs/ai/context/ai-architecture-brain.json`
  if (existsSync(brainPath)) {
    try {
      const brain = JSON.parse(readFileSync(brainPath, 'utf-8')) as ArchitectureBrain
      if (brain.rules) {
        return {
          dependencyRules: brain.rules.dependencyRules,
          layerRules: brain.rules.layerRules,
        }
      }
    } catch {
      // Fall through to contract file.
    }
  }

  const contractPath = `${repoRoot}/docs/architecture/intelligence/ARCHITECTURE_CONTRACT.json`
  return JSON.parse(readFileSync(contractPath, 'utf-8')) as ArchitectureContract
}

function loadArchitectureMap(repoRoot: string): ArchitectureMap {
  const path = `${repoRoot}/docs/architecture/intelligence/ARCHITECTURE_MAP.json`
  return JSON.parse(readFileSync(path, 'utf-8')) as ArchitectureMap
}

function fileToSourceModule(filePath: string): string {
  const module = detectFileModule(filePath)
  if (!module) {
    return 'unknown'
  }
  if (filePath.startsWith('apps/')) {
    return `apps/${module}`
  }
  if (filePath.startsWith('packages/')) {
    return `packages/${module}`
  }
  return module
}

function mapViolation(
  filePath: string,
  sourceModule: string,
  message: string,
  rule = 'dependency-boundaries'
): ViolationRecord {
  return {
    rule,
    severity: 'error',
    message,
    location: {
      file: filePath,
    },
    source_module: sourceModule,
    remediation: '',
  }
}

export async function runDependencyBoundariesRule(context: RuleContext): Promise<RuleResult> {
  const contract = loadContract(context.repoRoot)
  const architectureMap = loadArchitectureMap(context.repoRoot)
  const boundaries = loadModuleBoundaries()
  const aliases = loadTsAliases()

  const violations: ViolationRecord[] = []

  for (const filePath of context.targetFiles) {
    if (!existsSync(filePath)) {
      continue
    }
    if (!/\.(ts|tsx|js|jsx|vue)$/.test(filePath)) {
      continue
    }

    const fileModule = detectFileModule(filePath)
    if (!fileModule) {
      continue
    }

    const sourceModule = fileToSourceModule(filePath)
    const imports = extractImports(filePath)

    const dependencyViolations = validateRules(
      'Dependency',
      fileModule,
      imports,
      contract.dependencyRules?.forbidden
    )
    const layerViolations = validateRules(
      'Layer',
      fileModule,
      imports,
      contract.layerRules?.forbidden
    )
    const crossAppViolations = validateCrossAppImports(fileModule, filePath, imports)
    const relativeLeakViolations = validateRelativeLeaks(filePath, imports)
    const archMapViolations = validateArchitectureMap(
      filePath,
      fileModule,
      imports,
      architectureMap
    )
    const layerBoundaryViolations = boundaries
      ? validateLayerBoundaries(filePath, imports, boundaries, aliases)
      : []

    for (const message of [
      ...dependencyViolations,
      ...layerViolations,
      ...crossAppViolations,
      ...relativeLeakViolations,
      ...archMapViolations,
      ...layerBoundaryViolations,
    ]) {
      violations.push(mapViolation(filePath, sourceModule, message))
    }
  }

  return {
    rule: 'dependency-boundaries',
    violations,
  }
}

export const dependencyBoundariesRule: GuardRule = {
  id: 'dependency-boundaries',
  order: 10,
  enabledIn: ['development', 'strict', 'changed'],
  run: runDependencyBoundariesRule,
}
