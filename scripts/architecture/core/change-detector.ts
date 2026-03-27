/**
 * Change Detector — Detect which modules have changed since last run
 *
 * Purpose: Enable incremental analysis by identifying which packages/apps
 * have changed, allowing tools to skip unchanged modules.
 *
 * Strategy:
 * 1. Read previous module state (via git) or from cache
 * 2. Compare current package.json/tsconfig hashes
 * 3. Return list of changed modules
 * 4. Trigger full analysis on first run
 
 * @library-module
*/

import { execSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

interface ChangedModule {
  name: string // e.g., "packages/domain-core"
  type: 'package' | 'app'
  changeType: 'added' | 'modified' | 'deleted'
  changedFiles: string[] // Which files changed
}

interface ChangeDetectionResult {
  changedModules: ChangedModule[]
  allModulesDetected: string[] // All modules in repo
  isFirstRun: boolean // If true, treat as full change (all modules changed)
  analysisScope: 'full' | 'incremental' // Recommended scope
  timestamp: number
}

/**
 * Detect which modules have changed since last audit
 */
export function detectChangedModules(): ChangeDetectionResult {
  const repoRoot = process.cwd()

  // Detect all modules in repo
  const allModules = getAllModules(repoRoot)

  // Check if this is first run (no previous state)
  const isFirstRun = !hasAuditState(repoRoot)

  if (isFirstRun) {
    // First run: treat all modules as changed
    return {
      changedModules: allModules.map((name) => ({
        name,
        type: name.startsWith('apps/') ? 'app' : 'package',
        changeType: 'added' as const,
        changedFiles: ['package.json', 'tsconfig.json'],
      })),
      allModulesDetected: allModules,
      isFirstRun: true,
      analysisScope: 'full',
      timestamp: Date.now(),
    }
  }

  // Get changed files from git
  const changedFiles = getGitChangedFiles(repoRoot)

  // Map changed files to modules
  const changedModuleSet = new Set<string>()
  changedFiles.forEach((file) => {
    const module = getModuleForFile(file, allModules)
    if (module) changedModuleSet.add(module)
  })

  // Detect tsconfig or package.json changes at root (affects all modules)
  const globalConfigChanged =
    changedFiles.includes('tsconfig.json') ||
    changedFiles.includes('package.json') ||
    changedFiles.includes('bun.lock')

  if (globalConfigChanged) {
    // Global config change = full analysis required
    const changedModules = allModules.map((name) => ({
      name,
      type: name.startsWith('apps/') ? 'app' : 'package',
      changeType: 'modified' as const,
      changedFiles: ['package.json', 'tsconfig.json'],
    }))

    return {
      changedModules,
      allModulesDetected: allModules,
      isFirstRun: false,
      analysisScope: 'full',
      timestamp: Date.now(),
    }
  }

  // Build result from changed modules
  const changedModules = Array.from(changedModuleSet).map((name) => ({
    name,
    type: name.startsWith('apps/') ? 'app' : 'package',
    changeType: 'modified' as const,
    changedFiles: changedFiles.filter((f) => f.startsWith(`${name}/`)),
  }))

  return {
    changedModules,
    allModulesDetected: allModules,
    isFirstRun: false,
    analysisScope: changedModules.length > 0 ? 'incremental' : 'full',
    timestamp: Date.now(),
  }
}

/**
 * Get all modules in repository (packages/* and apps/*)
 */
function getAllModules(repoRoot: string): string[] {
  const modules: string[] = []

  // Scan packages/
  const packagesDir = join(repoRoot, 'packages')
  if (existsSync(packagesDir)) {
    try {
      const packages = execSync(`ls -d ${packagesDir}/*/ 2>/dev/null || true`)
        .toString()
        .trim()
        .split('\n')
        .filter((p) => p)
      packages.forEach((p) => {
        const name = p.replace(`${packagesDir}/`, '').replace(/\/$/, '')
        if (name) modules.push(`packages/${name}`)
      })
    } catch {
      // silently ignore
    }
  }

  // Scan apps/
  const appsDir = join(repoRoot, 'apps')
  if (existsSync(appsDir)) {
    try {
      const apps = execSync(`ls -d ${appsDir}/*/ 2>/dev/null || true`)
        .toString()
        .trim()
        .split('\n')
        .filter((a) => a)
      apps.forEach((a) => {
        const name = a.replace(`${appsDir}/`, '').replace(/\/$/, '')
        if (name) modules.push(`apps/${name}`)
      })
    } catch {
      // silently ignore
    }
  }

  return modules
}

/**
 * Get list of changed files from git (since last commit or HEAD)
 */
function getGitChangedFiles(repoRoot: string): string[] {
  try {
    // Get both staged and unstaged changes
    const diff = execSync(
      "git diff --name-only --diff-filter=ACMDU HEAD~1 HEAD 2>/dev/null || git diff --name-only HEAD~1 2>/dev/null || echo ''",
      { cwd: repoRoot }
    )
      .toString()
      .trim()

    if (!diff) return []
    return diff.split('\n').filter((f) => f)
  } catch {
    // If git fails, assume all files changed (safe default)
    return ['package.json', 'tsconfig.json']
  }
}

/**
 * Map a file path to its owning module
 */
function getModuleForFile(filePath: string, allModules: string[]): string | undefined {
  // Check if file belongs to any module
  for (const module of allModules) {
    if (filePath.startsWith(`${module}/`)) {
      return module
    }
  }

  // For root-level config files, return undefined (caller will handle)
  if (filePath.includes('package.json') || filePath.includes('tsconfig.json')) {
    return undefined
  }

  return undefined
}

/**
 * Check if previous audit state exists
 */
function hasAuditState(repoRoot: string): boolean {
  // Check for marker file indicating prior audit
  const markers = [
    join(repoRoot, '.cache/audit-state.json'),
    join(repoRoot, 'docs/ai/context/ai-dependency-graph.json'),
  ]
  return markers.some((m) => existsSync(m))
}

/**
 * Hash a file for change detection
 */
export function hashFile(filePath: string): string {
  try {
    const content = readFileSync(filePath, 'utf-8')
    return createHash('sha256').update(content).digest('hex')
  } catch {
    return ''
  }
}

/**
 * Compute hash of all package.json files
 */
export function computeModuleHashes(modules: string[]): Record<string, string> {
  const hashes: Record<string, string> = {}
  modules.forEach((module) => {
    const pkgPath = join(process.cwd(), module, 'package.json')
    hashes[module] = hashFile(pkgPath)
  })
  return hashes
}
