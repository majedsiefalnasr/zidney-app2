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
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import type { AIDependencyGraph } from '../packages/types/src/ai-context'
import { runUnifiedArchitectureGuard } from './architecture-guard/runner'

function getCurrentBranch(): string {
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', {
      encoding: 'utf-8',
    }).trim()

    // In CI (especially GitHub Actions), git checkout can leave us in a detached HEAD state.
    // Attempt to recover the actual branch name from environment variables.
    if (branch === 'HEAD') {
      // GitHub Actions pull_request event
      if (process.env.GITHUB_HEAD_REF) {
        return process.env.GITHUB_HEAD_REF
      }

      // GitHub Actions push/workflow_dispatch event
      if (process.env.GITHUB_REF_NAME) {
        return process.env.GITHUB_REF_NAME
      }

      // Local detached HEAD (not in CI) - cannot validate
      return ''
    }

    return branch
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

export interface TsAliasMap {
  alias: string
  target: string
}

type CrossCuttingRule = {
  rule: string
  description?: string
  action: 'FORBIDDEN'
  source_pattern?: string
  target_pattern?: string
  source?: string[]
  target?: string[]
  source_layer?: string
}

type ModuleBoundaries = {
  version: string
  description?: string
  layers: Record<string, string[]>
  allowed_dependencies: Record<string, string[]>
  forbidden_dependencies: Record<string, string[]>
  cross_cutting_rules?: CrossCuttingRule[]
}

const CONTRACT_PATH = 'docs/architecture/intelligence/ARCHITECTURE_CONTRACT.json'

const ARCH_MAP_PATH = 'docs/architecture/intelligence/ARCHITECTURE_MAP.json'

const AI_BRAIN_PATH = 'docs/ai/context/ai-architecture-brain.json'

const BOUNDARIES_PATH = 'docs/architecture/module-boundaries.json'

const GRAPH_PATH = 'docs/ai/context/ai-dependency-graph.json'

const EXPECTED_SCHEMA_VERSION = '2'

const DEFAULT_MAX_AGE_HOURS = 24

export interface GuardConfig {
  mode: 'full' | 'incremental'
  explicitModules: string[] | null
  outputJson: boolean
}

export type GraphLoadResult =
  | { graph: AIDependencyGraph }
  | { graph: null; reason: 'missing' | 'corrupt' | 'stale' | 'schema_mismatch' }

export interface ArchitectureImpactReport {
  run_id: string
  timestamp: string
  validation_mode: 'incremental' | 'full'
  modules_validated: number
  modules_skipped: number
  skipped_unmapped_files: string[]
  fallback_reason: string | null
  verdict: 'pass' | 'fail'
  violations: string[]
  duration_ms: number
}

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

export function loadModuleBoundaries(): ModuleBoundaries | null {
  if (!existsSync(BOUNDARIES_PATH)) {
    console.warn(
      '[ai-guard] WARNING: module-boundaries.json not found — falling back to ARCHITECTURE_MAP.json only'
    )
    return null
  }
  try {
    const raw = readFileSync(BOUNDARIES_PATH, 'utf-8')
    const parsed = JSON.parse(raw) as ModuleBoundaries
    if (
      !parsed.layers ||
      typeof parsed.layers !== 'object' ||
      Array.isArray(parsed.layers) ||
      !parsed.allowed_dependencies ||
      typeof parsed.allowed_dependencies !== 'object' ||
      Array.isArray(parsed.allowed_dependencies) ||
      !parsed.forbidden_dependencies ||
      typeof parsed.forbidden_dependencies !== 'object' ||
      Array.isArray(parsed.forbidden_dependencies)
    ) {
      console.error(
        '[ai-guard] ERROR: module-boundaries.json is structurally invalid — missing required fields (layers, allowed_dependencies, forbidden_dependencies)'
      )
      process.exit(1)
    }
    return parsed
  } catch {
    console.error(
      '[ai-guard] ERROR: module-boundaries.json is malformed — cannot validate boundaries'
    )
    process.exit(1)
  }
}

export function loadTsAliases(): TsAliasMap[] {
  const configs = ['tsconfig.json', 'tsconfig.base.json']
  const result: TsAliasMap[] = []
  const seen = new Set<string>()

  for (const configFile of configs) {
    try {
      if (!existsSync(configFile)) continue
      const json = JSON.parse(readFileSync(configFile, 'utf-8'))
      const pathsConfig = json?.compilerOptions?.paths as Record<string, string[]> | undefined
      if (!pathsConfig) continue

      for (const key of Object.keys(pathsConfig)) {
        const cleanKey = key.replace('/*', '')
        if (seen.has(cleanKey)) continue

        // Skip multi-target aliases (they need context-aware resolution like resolveImportTarget in infra-audit)
        const targetsList = pathsConfig[key]
        if (targetsList && targetsList.length > 1) {
          seen.add(cleanKey)
          continue
        }

        // Skip bare @ and ~ — these are special multi-target aliases that need special handling
        if (cleanKey === '@' || cleanKey === '~') {
          seen.add(cleanKey)
          continue
        }

        const rawTarget = pathsConfig[key]?.[0]
        if (!rawTarget) continue
        const cleanTarget = rawTarget.replace('/*', '')
        seen.add(cleanKey)
        result.push({ alias: cleanKey, target: cleanTarget })
      }
    } catch (err) {
      console.warn(
        `[ai-guard] WARNING: failed to load aliases from ${configFile} — alias-based boundary checks may be incomplete`,
        err instanceof Error ? err.message : String(err)
      )
    }
  }
  return result
}

function isTestFile(filePath: string): boolean {
  // Exclude test files to avoid false positives
  // Test mocking is allowed to cross app boundaries
  return (
    filePath.includes('/tests/') ||
    filePath.includes('.test.') ||
    filePath.includes('.spec.') ||
    filePath.includes('vitest.config') ||
    filePath.includes('vitest.workspace')
  )
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
      .filter((f) => !isTestFile(f))

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
        .filter((f) => !isTestFile(f))
      if (all.length > 0) {
        return all
      }
    }

    return staged
  } catch {
    return []
  }
}

export function extractImports(filePath: string): string[] {
  try {
    const content = readFileSync(filePath, 'utf-8')

    const importRegex = /import\s+(?:[\w*\s{},]+)\s+from\s+['"]([^'"]+)['"]/g

    const matches: string[] = []
    let match: RegExpExecArray | null

    match = importRegex.exec(content)
    while (match) {
      const captured = match[1]
      if (captured) {
        matches.push(captured)
      }
      match = importRegex.exec(content)
    }

    return matches
  } catch {
    return []
  }
}

export function detectModule(importPath: string): string | null {
  if (importPath.startsWith('@zidney/')) {
    return importPath.replace('@zidney/', '')
  }

  if (importPath.startsWith('packages/')) {
    return importPath.split('/')[1] ?? null
  }

  if (importPath.startsWith('apps/')) {
    return importPath.split('/')[1] ?? null
  }

  return null
}

export function detectFileModule(file: string): string | null {
  if (file.startsWith('packages/')) {
    return file.split('/')[1] ?? null
  }

  if (file.startsWith('apps/')) {
    return file.split('/')[1] ?? null
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

export function validateArchitectureMap(
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

export function validateRules(
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

export function validateCrossAppImports(
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

export function validateRelativeLeaks(_filePath: string, imports: string[]): string[] {
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

function getLayerForModule(modulePath: string, boundaries: ModuleBoundaries): string | null {
  for (const [layer, modules] of Object.entries(boundaries.layers)) {
    if (modules.includes(modulePath)) return layer
  }
  return null
}

export function resolveImportToModule(
  importPath: string,
  aliases: TsAliasMap[],
  sourceFile?: string
): string | null {
  // Special case: Handle bare @ and @/* which are multi-target aliases
  // These cannot be safely resolved without source context
  if (importPath === '@' || importPath.startsWith('@/')) {
    if (sourceFile) {
      // Check if source is a package
      const sourcePackage = sourceFile.match(/^packages\/([^/]+)/)
      if (sourcePackage) {
        // Package-internal @/ import
        return null
      }

      // Check if source is an app
      const sourceApp = sourceFile.match(/^apps\/([^/]+)/)
      if (sourceApp) {
        // App-internal @/ import
        return null
      }
    }
    // If no source context, we can't resolve these safely
    return null
  }

  // 1. Try alias resolution — longest matching alias wins
  let bestMatch: TsAliasMap | null = null
  for (const entry of aliases) {
    const { alias } = entry
    if (importPath === alias || importPath.startsWith(`${alias}/`)) {
      if (!bestMatch || alias.length > bestMatch.alias.length) {
        bestMatch = entry
      }
    }
  }

  if (bestMatch) {
    // Normalize target like "packages/ui-system/src/index.ts" → "packages/ui-system"
    // Also handle leading "./" (e.g., "./packages/logger/src")
    const cleanTarget = bestMatch.target.replace(/^\.\//, '')
    const parts = cleanTarget.split('/')
    if (parts.length >= 2 && (parts[0] === 'packages' || parts[0] === 'apps')) {
      return `${parts[0]}/${parts[1]}`
    }
  }

  // 2. Direct monorepo path (no alias needed)
  if (importPath.startsWith('packages/') || importPath.startsWith('apps/')) {
    return importPath.split('/').slice(0, 2).join('/')
  }

  // 3. External npm package — not a monorepo module
  return null
}

export function matchesGlobPattern(modulePath: string, pattern: string): boolean {
  if (pattern.endsWith('/*')) {
    // "apps/*" matches "apps/mmc", "apps/api", etc. but NOT "apps" itself
    return modulePath.startsWith(pattern.slice(0, -1))
  }
  return modulePath === pattern
}

function ruleSourceMatches(
  rule: CrossCuttingRule,
  sourceModule: string,
  sourceLayer: string
): boolean {
  if (rule.source_pattern !== undefined)
    return matchesGlobPattern(sourceModule, rule.source_pattern)
  if (rule.source !== undefined) return rule.source.includes(sourceModule)
  if (rule.source_layer !== undefined) return sourceLayer === rule.source_layer
  return false
}

function ruleTargetMatches(rule: CrossCuttingRule, targetModule: string): boolean {
  if (rule.target_pattern !== undefined)
    return matchesGlobPattern(targetModule, rule.target_pattern)
  if (rule.target !== undefined) return rule.target.includes(targetModule)
  return false
}

export function validateLayerBoundaries(
  filePath: string,
  imports: string[],
  boundaries: ModuleBoundaries,
  aliases: TsAliasMap[]
): string[] {
  const violations: string[] = []

  // Determine source module full path (e.g., "apps/mmc", "packages/ui-system")
  const pathParts = filePath.split('/')
  if (pathParts[0] !== 'apps' && pathParts[0] !== 'packages') return violations
  const sourceModule = `${pathParts[0]}/${pathParts[1]}`

  const sourceLayer = getLayerForModule(sourceModule, boundaries)
  if (!sourceLayer) return violations // Undeclared module — infra-audit will warn

  const allowedLayers = boundaries.allowed_dependencies[sourceLayer] ?? []
  const crossCuttingRules = boundaries.cross_cutting_rules ?? []

  for (const imp of imports) {
    const targetModule = resolveImportToModule(imp, aliases, filePath)
    if (!targetModule) continue
    if (targetModule === sourceModule) continue

    const targetLayer = getLayerForModule(targetModule, boundaries)
    if (!targetLayer) continue // Undeclared target module — skip

    // Layer matrix check: target layer must be in source's allowed_dependencies
    if (!allowedLayers.includes(targetLayer)) {
      violations.push(
        `ARCHITECTURE VIOLATION — layer violation: ${sourceLayer} → ${targetLayer}: ` +
          `${sourceModule} may not import ${targetModule}`
      )
      // Continue to also check cross-cutting rules — we want all violations reported
    }

    // Cross-cutting rules (evaluated independently of layer matrix)
    for (const rule of crossCuttingRules) {
      if (
        ruleSourceMatches(rule, sourceModule, sourceLayer) &&
        ruleTargetMatches(rule, targetModule)
      ) {
        violations.push(
          `ARCHITECTURE VIOLATION — cross-cutting rule [${rule.rule}]: ` +
            `${sourceModule} → ${targetModule} is forbidden`
        )
      }
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

  // Only enforce strict stage matching when working on spec/* branches
  if (!branch.startsWith('spec/')) {
    return
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

/* -------------------------------------------------------------------------- */
/* Incremental Guard — new utilities (T005–T010)                              */
/* -------------------------------------------------------------------------- */

export function parseArgs(): GuardConfig {
  const args = process.argv.slice(2)
  const mode: 'full' | 'incremental' = args.includes('--incremental') ? 'incremental' : 'full'

  let explicitModules: string[] | null = null
  const modulesIdx = args.indexOf('--modules')
  const modulesArg = modulesIdx !== -1 ? args[modulesIdx + 1] : undefined
  if (modulesArg) {
    explicitModules = modulesArg
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean)
  }

  const outputJson = args.includes('--output') && args[args.indexOf('--output') + 1] === 'json'

  return { mode, explicitModules, outputJson }
}

export function loadDependencyGraph(): GraphLoadResult {
  if (!existsSync(GRAPH_PATH)) {
    return { graph: null, reason: 'missing' }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(GRAPH_PATH, 'utf-8'))
  } catch {
    return { graph: null, reason: 'corrupt' }
  }

  const raw = parsed as Record<string, unknown>

  if (raw.schema_version !== EXPECTED_SCHEMA_VERSION) {
    return { graph: null, reason: 'schema_mismatch' }
  }

  const maxAgeHours =
    typeof process.env.ARCH_GRAPH_MAX_AGE_HOURS === 'string'
      ? Number(process.env.ARCH_GRAPH_MAX_AGE_HOURS)
      : DEFAULT_MAX_AGE_HOURS

  if (!raw.generated_at || typeof raw.generated_at !== 'string') {
    return { graph: null, reason: 'stale' }
  }

  const generatedAt = new Date(raw.generated_at).getTime()
  const ageMs = Date.now() - generatedAt
  if (Number.isNaN(ageMs) || ageMs > maxAgeHours * 3_600_000) {
    return { graph: null, reason: 'stale' }
  }

  return { graph: raw as unknown as AIDependencyGraph }
}

export function mapToModules(
  files: string[],
  moduleKeys: string[]
): { modules: Set<string>; skipped: string[] } {
  const modules = new Set<string>()
  const skipped: string[] = []

  for (const file of files) {
    // Longest-prefix match
    let matched: string | null = null
    for (const key of moduleKeys) {
      if (file === key || file.startsWith(key + '/')) {
        if (!matched || key.length > matched.length) {
          matched = key
        }
      }
    }
    if (matched) {
      modules.add(matched)
    } else {
      skipped.push(file)
    }
  }

  return { modules, skipped }
}

export function detectNewModules(moduleKeys: string[]): boolean {
  const keySet = new Set(moduleKeys)
  for (const prefix of ['apps', 'packages']) {
    const dir = prefix
    if (!existsSync(dir)) continue
    const entries = readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const modulePath = `${prefix}/${entry.name}`
      if (!keySet.has(modulePath)) return true
    }
  }
  return false
}

export function computeImpactScope(changed: Set<string>, graph: AIDependencyGraph): Set<string> {
  const scope = new Set<string>(changed)
  const queue = [...changed]

  while (queue.length > 0) {
    const module = queue.pop()
    if (!module) {
      continue
    }
    const dependents = graph.reverse_dependencies[module] ?? []
    for (const dep of dependents) {
      if (!scope.has(dep)) {
        scope.add(dep)
        queue.push(dep)
      }
    }
  }

  return scope
}

type ValidationResult = {
  fallback_reason: string | null
  verdict: 'pass' | 'fail'
  violations: string[]
  modules_validated: number
  modules_skipped: number
  skipped_unmapped_files: string[]
}

function runFullScanWithReason(
  fallbackReason: string | null,
  stagedFiles: string[]
): ValidationResult {
  // Run full guard logic — capture violations by delegating to the existing scan
  const violations: string[] = []
  const archMap = loadArchitectureMap()
  const brain = loadArchitectureBrain()
  const boundaries = loadModuleBoundaries()
  const aliases = loadTsAliases()
  const contract = brain?.rules
    ? { dependencyRules: brain.rules.dependencyRules, layerRules: brain.rules.layerRules }
    : loadContract()

  for (const file of stagedFiles) {
    if (!existsSync(file)) continue
    const fileModule = detectFileModule(file)
    if (!fileModule) continue

    const rawImports = extractImports(file)
    let imports = rawImports
    if (brain) {
      const modulePath = resolveModulePath(file)
      if (modulePath) {
        const brainDeps = getModuleDepsFromBrain(modulePath, brain)
        if (brainDeps.length > 0) imports = brainDeps
      }
    }

    const archMapViolations = validateArchitectureMap(file, fileModule, imports, archMap)
    const layerBoundaryViolations = boundaries
      ? validateLayerBoundaries(file, imports, boundaries, aliases)
      : []
    const crossAppViolations = validateCrossAppImports(fileModule, file, imports)
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
      ...archMapViolations.map((v) => `${file}: ${v}`),
      ...layerBoundaryViolations.map((v) => `${file}: ${v}`)
    )
  }

  return {
    fallback_reason: fallbackReason,
    verdict: violations.length > 0 ? 'fail' : 'pass',
    violations,
    modules_validated: stagedFiles.length,
    modules_skipped: 0,
    skipped_unmapped_files: [],
  }
}

export async function runIncremental(config: GuardConfig): Promise<ValidationResult> {
  const stagedEnv = process.env.STAGED_FILES ?? ''
  const stagedFiles = stagedEnv
    .split('\n')
    .map((f) => f.trim())
    .filter(Boolean)

  if (stagedFiles.length === 0) {
    console.log('AI Guard (incremental): no staged files — skipping.')
    process.exit(0)
  }

  const archMap = loadArchitectureMap()
  const moduleKeys = Object.keys(archMap?.modules ?? {})

  // Check fallback triggers
  const mapChanged = stagedFiles.some(
    (f) => f.endsWith('ARCHITECTURE_MAP.json') || f.includes('docs/architecture/intelligence/')
  )

  if (mapChanged) {
    console.log('AI Guard (incremental): ARCHITECTURE_MAP changed — running full scan.')
    const result = runFullScanWithReason('map_changed', stagedFiles)
    finalizeResult(result, config)
    return result
  }

  if (detectNewModules(moduleKeys)) {
    console.log('AI Guard (incremental): new module detected — running full scan.')
    const result = runFullScanWithReason('new_module_detected', stagedFiles)
    finalizeResult(result, config)
    return result
  }

  let loadResult = loadDependencyGraph()

  if (loadResult.graph === null) {
    if (loadResult.reason === 'missing') {
      console.log('AI Guard (incremental): graph missing — regenerating...')
      try {
        execSync('bun scripts/infra-audit.ts --generate-graph', { stdio: 'inherit' })
      } catch {
        console.warn(
          'AI Guard (incremental): graph regeneration failed — falling back to full scan.'
        )
        const result = runFullScanWithReason('graph_missing', stagedFiles)
        finalizeResult(result, config)
        return result
      }
      const retry = loadDependencyGraph()
      if (retry.graph === null) {
        const result = runFullScanWithReason('graph_missing', stagedFiles)
        finalizeResult(result, config)
        return result
      }
      loadResult = retry
    } else if (loadResult.reason === 'stale') {
      console.log('AI Guard (incremental): graph stale — running full scan.')
      const result = runFullScanWithReason('graph_stale', stagedFiles)
      finalizeResult(result, config)
      return result
    } else {
      // 'corrupt' or 'schema_mismatch' — do not attempt regen
      console.log(
        `AI Guard (incremental): graph unusable (${loadResult.reason}) — running full scan.`
      )
      const result = runFullScanWithReason('graph_unusable', stagedFiles)
      finalizeResult(result, config)
      return result
    }
  }

  // loadResult.graph is non-null
  const graph = loadResult.graph

  let scope: Set<string>
  const skippedFiles: string[] = []

  if (config.explicitModules) {
    scope = new Set(config.explicitModules)
  } else {
    const mapped = mapToModules(stagedFiles, moduleKeys)
    skippedFiles.push(...mapped.skipped)
    scope = computeImpactScope(mapped.modules, graph)
  }

  if (scope.size >= moduleKeys.length) {
    console.log('AI Guard (incremental): full scope — running full scan.')
    const result = runFullScanWithReason('full_scope', stagedFiles)
    finalizeResult(result, config)
    return result
  }

  // Incremental: validate only files in affected scope
  const scopedFiles = stagedFiles.filter((f) => {
    const matched = moduleKeys.find((k) => f === k || f.startsWith(k + '/'))
    return matched ? scope.has(matched) : false
  })

  console.log(
    `AI Guard (incremental): validating ${scope.size} module(s): ${[...scope].join(', ')}`
  )

  const violations: string[] = []
  const archMapForIncremental = archMap
  const brain = loadArchitectureBrain()
  const boundaries = loadModuleBoundaries()
  const aliases = loadTsAliases()
  const contract = brain?.rules
    ? { dependencyRules: brain.rules.dependencyRules, layerRules: brain.rules.layerRules }
    : loadContract()

  for (const file of scopedFiles) {
    if (!existsSync(file)) continue
    const fileModule = detectFileModule(file)
    if (!fileModule) continue

    const rawImports = extractImports(file)
    let imports = rawImports
    if (brain) {
      const modulePath = resolveModulePath(file)
      if (modulePath) {
        const brainDeps = getModuleDepsFromBrain(modulePath, brain)
        if (brainDeps.length > 0) imports = brainDeps
      }
    }

    const archMapViolations = validateArchitectureMap(
      file,
      fileModule,
      imports,
      archMapForIncremental
    )
    const layerBoundaryViolations = boundaries
      ? validateLayerBoundaries(file, imports, boundaries, aliases)
      : []
    const crossAppViolations = validateCrossAppImports(fileModule, file, imports)
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
      ...archMapViolations.map((v) => `${file}: ${v}`),
      ...layerBoundaryViolations.map((v) => `${file}: ${v}`)
    )
  }

  const result: ValidationResult = {
    fallback_reason: null,
    verdict: violations.length > 0 ? 'fail' : 'pass',
    violations,
    modules_validated: scope.size,
    modules_skipped: moduleKeys.length - scope.size,
    skipped_unmapped_files: skippedFiles,
  }
  finalizeResult(result, config)
  return result
}

function finalizeResult(result: ValidationResult, config: GuardConfig): void {
  if (result.violations.length > 0) {
    console.error('\nAI Guard: Architecture violations detected\n')
    for (const v of result.violations) {
      console.error(' -', v)
    }
    console.error('\nCommit rejected by Zidney AI Guard. Fix architecture violations.')
    process.exit(1)
  }

  if (config.outputJson) {
    const report: ArchitectureImpactReport = {
      run_id: `${Date.now()}`,
      timestamp: new Date().toISOString(),
      validation_mode: config.mode === 'incremental' ? 'incremental' : 'full',
      modules_validated: result.modules_validated,
      modules_skipped: result.modules_skipped,
      skipped_unmapped_files: result.skipped_unmapped_files,
      fallback_reason: result.fallback_reason,
      verdict: result.verdict,
      violations: result.violations,
      duration_ms: 0,
    }
    console.log(JSON.stringify(report, null, 2))
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

  const boundaries = loadModuleBoundaries()
  const aliases = loadTsAliases()

  if (boundaries) {
    console.log('AI Guard: module-boundaries.json loaded — layer boundary validation enabled.')
  }

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

    const layerBoundaryViolations = boundaries
      ? validateLayerBoundaries(file, imports, boundaries, aliases)
      : []

    // DEBUG: Log violations for packages/ui-system
    if (file.includes('packages/ui-system')) {
      if (layerBoundaryViolations.length > 0) {
        console.error(
          `DEBUG [${file}]: Got ${layerBoundaryViolations.length} violations from validateLayerBoundaries`
        )
        console.error(
          `  Imports checked: ${imports.slice(0, 3).join(', ')}${imports.length > 3 ? '...' : ''}`
        )
      }
    }

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
      ...archMapViolations.map((v) => `${file}: ${v}`),
      ...layerBoundaryViolations.map((v) => `${file}: ${v}`)
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

// Only execute when run directly (not when imported for unit testing)
if ((import.meta as { main?: boolean }).main) {
  if (process.argv.includes('--unified-runner')) {
    runUnifiedArchitectureGuard(process.argv.slice(2)).then((code) => process.exit(code))
  } else {
    const config = parseArgs()
    if (config.mode === 'incremental') {
      runIncremental(config)
    } else {
      runGuard()
    }
  }
}
