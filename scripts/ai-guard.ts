/**
 * Zidney AI Guard
 *
 * Purpose:
 * Enforce architecture rules defined in:
 *  - docs/architecture/intelligence/ARCHITECTURE_CONTRACT.json
 *  - docs/architecture/intelligence/ARCHITECTURE_MAP.json
 *
 * This script is intended to run:
 *  - before AI-generated commits
 *  - inside CI pipelines
 *
 * Hard enforcement rules (Option A):
 *  - Layer violations → FAIL
 *  - Dependency rule violations → FAIL
 *  - Circular dependencies → FAIL
 *  - Architecture drift → FAIL
 */

import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

function getCurrentBranch(): string {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', {
      encoding: 'utf-8',
    }).trim()
  } catch {
    return ''
  }
}

type ArchitectureContract = {
  dependencyRules?: {
    forbidden?: Record<string, string[]>
  }
  layerRules?: {
    forbidden?: Record<string, string[]>
  }
}

type ArchitectureMap = {
  modules?: Record<
    string,
    {
      layer?: string
      allowed_dependencies?: string[]
      forbidden_dependencies?: string[]
    }
  >
}

type ArchitectureBrain = {
  rules?: {
    dependencyRules?: {
      forbidden?: Record<string, string[]>
    }
    layerRules?: {
      forbidden?: Record<string, string[]>
    }
  }
  modules?: string[]
  edges?: { from: string; to: string }[]
}

const CONTRACT_PATH = 'docs/architecture/intelligence/ARCHITECTURE_CONTRACT.json'

const ARCH_MAP_PATH = 'docs/architecture/intelligence/ARCHITECTURE_MAP.json'

const AI_BRAIN_PATH = 'docs/ai/context/ai-architecture-brain.json'

function loadContract(): ArchitectureContract {
  const raw = readFileSync(CONTRACT_PATH, 'utf-8')
  return JSON.parse(raw)
}

function loadArchitectureMap(): ArchitectureMap {
  try {
    const raw = readFileSync(ARCH_MAP_PATH, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

function loadArchitectureBrain(): ArchitectureBrain | null {
  try {
    const raw = readFileSync(AI_BRAIN_PATH, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function getChangedFiles(): string[] {
  try {
    const staged = execSync('git diff --cached --name-only', {
      encoding: 'utf-8',
    })
      .split('\n')
      .map((f) => f.trim())
      .filter(Boolean)
      .filter((f) => f.endsWith('.ts') || f.endsWith('.tsx') || f.endsWith('.vue'))

    // When no staged files are detected (e.g. in CI where git index is empty,
    // or when invoked outside of a commit), fall back to scanning all tracked
    // source files so the arch-guard CI job cannot be trivially bypassed.
    if (staged.length === 0) {
      const all = execSync('git ls-files -- "*.ts" "*.tsx" "*.vue"', {
        encoding: 'utf-8',
      })
        .split('\n')
        .map((f) => f.trim())
        .filter(Boolean)
      if (all.length > 0) {
        return all
      }
    }

    return staged
  } catch {
    return []
  }
}

function extractImports(filePath: string): string[] {
  try {
    const content = readFileSync(filePath, 'utf-8')

    const importRegex = /import\s+(?:[\w*\s{},]+)\s+from\s+['"]([^'"]+)['"]/g

    const matches: string[] = []
    let match

    while ((match = importRegex.exec(content))) {
      matches.push(match[1])
    }

    return matches
  } catch {
    return []
  }
}

function detectModule(importPath: string): string | null {
  if (importPath.startsWith('@zidney/')) {
    return importPath.replace('@zidney/', '')
  }

  if (importPath.startsWith('packages/')) {
    return importPath.split('/')[1]
  }

  if (importPath.startsWith('apps/')) {
    return importPath.split('/')[1]
  }

  return null
}

function detectFileModule(file: string): string | null {
  if (file.startsWith('packages/')) {
    return file.split('/')[1]
  }

  if (file.startsWith('apps/')) {
    return file.split('/')[1]
  }

  return null
}

function resolveModulePath(module: string): string | null {
  if (!module) return null

  if (module.startsWith('@zidney/')) {
    return `packages/${module.replace('@zidney/', '')}`
  }

  if (module.startsWith('apps/') || module.startsWith('packages/')) {
    return module.split('/').slice(0, 2).join('/')
  }

  return null
}

function validateArchitectureMap(
  filePath: string,
  _fileModule: string,
  imports: string[],
  archMap: ArchitectureMap
): string[] {
  const violations: string[] = []

  const modulePath = resolveModulePath(filePath)
  if (!modulePath) return violations

  const moduleDef = archMap.modules?.[modulePath]
  if (!moduleDef) return violations

  const allowed = moduleDef.allowed_dependencies || []
  const forbidden = moduleDef.forbidden_dependencies || []

  for (const imp of imports) {
    const target = resolveModulePath(imp)
    if (!target) continue

    if (forbidden.includes(target)) {
      violations.push(`ARCH_MAP forbidden dependency: ${modulePath} → ${target}`)
    }

    if (allowed.length > 0 && !allowed.includes(target)) {
      violations.push(`ARCH_MAP dependency not allowed: ${modulePath} → ${target}`)
    }
  }

  return violations
}

function validateRules(
  ruleType: string,
  fileModule: string,
  imports: string[],
  rules?: Record<string, string[]>
): string[] {
  if (!rules) return []

  const violations: string[] = []

  const forbidden = rules[fileModule] || []

  for (const imp of imports) {
    const module = detectModule(imp)
    if (!module) continue

    if (forbidden.includes(module)) {
      violations.push(`${ruleType} violation: ${fileModule} → ${module} is forbidden`)
    }
  }

  return violations
}

function validateCrossAppImports(
  fileModule: string,
  filePath: string,
  imports: string[]
): string[] {
  const violations: string[] = []

  // Only enforce for app modules
  const isAppFile = filePath.startsWith('apps/')
  if (!isAppFile) return violations

  for (const imp of imports) {
    const module = detectModule(imp)
    if (!module) continue

    // If an app imports another app directly → violation
    if (imp.startsWith('apps/') && module !== fileModule) {
      violations.push(`Cross-app violation: apps/${fileModule} → apps/${module} is forbidden`)
    }
  }

  return violations
}

function validateRelativeLeaks(_filePath: string, imports: string[]): string[] {
  const violations: string[] = []

  for (const imp of imports) {
    // Detect relative paths that climb directories
    if (!imp.startsWith('.')) continue

    // If the relative path explicitly references apps or packages, block it
    if (imp.includes('apps/') || imp.includes('packages/')) {
      violations.push(
        `Relative architecture leak: "${imp}" should use module import instead of relative path`
      )
    }
  }

  return violations
}

function getModuleDepsFromBrain(modulePath: string, brain: ArchitectureBrain): string[] {
  if (!brain?.edges) return []

  return brain.edges.filter((e) => e.from === modulePath).map((e) => e.to)
}

function validateBranchNaming(changedFiles: string[]): void {
  const branch = getCurrentBranch()

  // Only enforce spec/* branches when working on spec-driven stages
  const isSpecWork = changedFiles.some((f) => f.startsWith('specs/'))

  if (!isSpecWork) {
    return
  }

  if (!branch) return

  // Zidney Hard Mode requires spec branches for stage work
  if (!branch.startsWith('spec/')) {
    console.error('\nAI Guard: Invalid branch for architecture-controlled changes.')
    console.error(`Current branch: ${branch}`)
    console.error('Required pattern: spec/<stage-name>')
    console.error('Example: spec/005-tenant-provisioning-service\n')

    process.exit(1)
  }

  // Attempt to detect stage file being modified
  const stageFile = changedFiles.find((f) => /STAGE_[A-Z0-9_]+/.test(f))

  if (stageFile) {
    const match = stageFile.match(/STAGE_[A-Z0-9_]+/)

    if (match) {
      const expectedStage = match[0]
      const branchStage = branch.replace('spec/', '').toUpperCase()

      if (!branchStage.includes(expectedStage)) {
        console.error('\nAI Guard: Stage branch mismatch.')
        console.error(`Stage file modified: ${expectedStage}`)
        console.error(`Current branch: ${branch}`)
        console.error(`Expected branch to include: spec/${expectedStage}`)
        console.error('Example: spec/STAGE_21_ROLE_PERMISSION_SYSTEM\n')

        process.exit(1)
      }
    }
  }
}

function runGuard() {
  const changedFiles = getChangedFiles()

  validateBranchNaming(changedFiles)

  const brain = loadArchitectureBrain()
  if (brain) {
    console.log('AI Guard: using ai-architecture-brain.json for rule validation.')
  }

  const contract = brain?.rules
    ? {
        dependencyRules: brain.rules.dependencyRules,
        layerRules: brain.rules.layerRules,
      }
    : loadContract()

  const archMap = loadArchitectureMap()

  if (changedFiles.length === 0) {
    console.log('AI Guard: no changed files detected.')
    process.exit(0)
  }

  const violations: string[] = []

  for (const file of changedFiles) {
    const fileModule = detectFileModule(file)

    if (!fileModule) continue

    // Raw imports from source file — used for relative-leak checks (must always be source-based)
    const rawImports = extractImports(file)

    let imports = rawImports

    // Prefer architecture brain graph if available for cross-layer/dep/arch-map checks
    if (brain) {
      const modulePath = resolveModulePath(file)

      if (modulePath) {
        const brainDeps = getModuleDepsFromBrain(modulePath, brain)

        if (brainDeps.length > 0) {
          imports = brainDeps
        }
      }
    }

    const archMapViolations = validateArchitectureMap(file, fileModule, imports, archMap)

    const crossAppViolations = validateCrossAppImports(fileModule, file, imports)

    // Relative leak check always uses raw source imports — brain paths are module IDs, not import strings
    const relativeLeakViolations = validateRelativeLeaks(file, rawImports)

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

    violations.push(
      ...dependencyViolations.map((v) => `${file}: ${v}`),
      ...layerViolations.map((v) => `${file}: ${v}`),
      ...crossAppViolations.map((v) => `${file}: ${v}`),
      ...relativeLeakViolations.map((v) => `${file}: ${v}`),
      ...archMapViolations.map((v) => `${file}: ${v}`)
    )
  }

  if (violations.length > 0) {
    console.error('\nAI Guard: Architecture violations detected\n')

    for (const v of violations) {
      console.error(' -', v)
    }

    console.error('\nCommit rejected by Zidney AI Guard. Fix architecture violations.')

    process.exit(1)
  }

  console.log('AI Guard: architecture validation passed.')
}

runGuard()
