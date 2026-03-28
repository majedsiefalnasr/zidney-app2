/**
 * Module Roster Utility
 *
 * Purpose: Cache and quickly access module information
 * Used by: infra-audit, ai-guard, architecture-diff
 *
 * Provides:
 * - Fast module lookup
 * - Module dependency tracking
 * - Module inventory management
 * @library-module
 */

import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export interface ModuleInfo {
  name: string
  type: 'package' | 'app'
  packagePath: string
  mainFile: string
  dependencies: string[]
  dependents: string[]
  version?: string
  description?: string
}

export interface ModuleRoster {
  timestamp: number
  version: number
  modules: ModuleInfo[]
  moduleIndex: Record<string, ModuleInfo>
  totalModuleCount: number
  fileHashes: Record<string, string>
  generationTimeMs: number
  lastUpdated: number
  nextScanRequired: boolean
}

/**
 * Generate module roster from repository structure
 */
export function generateModuleRoster(): ModuleRoster {
  const startTime = performance.now()
  const modules: ModuleInfo[] = []
  const moduleIndex: Record<string, ModuleInfo> = {}
  const fileHashes: Record<string, string> = {}

  // Scan packages/
  const packagesPath = 'packages'
  if (existsSync(packagesPath)) {
    const packages = readdirSync(packagesPath, { withFileTypes: true })
    for (const entry of packages) {
      if (entry.isDirectory()) {
        const modulePath = join(packagesPath, entry.name)
        const packageJsonPath = join(modulePath, 'package.json')

        if (existsSync(packageJsonPath)) {
          const info = createPackageModuleInfo(modulePath, 'package', packageJsonPath)
          modules.push(info)
          moduleIndex[info.name] = info
          fileHashes[packageJsonPath] = hashFile(packageJsonPath)
        }
      }
    }
  }

  // Scan apps/
  const appsPath = 'apps'
  if (existsSync(appsPath)) {
    const apps = readdirSync(appsPath, { withFileTypes: true })
    for (const entry of apps) {
      if (entry.isDirectory()) {
        const modulePath = join(appsPath, entry.name)
        const packageJsonPath = join(modulePath, 'package.json')

        if (existsSync(packageJsonPath)) {
          const info = createPackageModuleInfo(modulePath, 'app', packageJsonPath)
          modules.push(info)
          moduleIndex[info.name] = info
          fileHashes[packageJsonPath] = hashFile(packageJsonPath)
        }
      }
    }
  }

  // Resolve dependencies between modules
  resolveModuleDependencies(modules, moduleIndex)

  const generationTimeMs = performance.now() - startTime

  return {
    timestamp: Date.now(),
    version: 1,
    modules,
    moduleIndex,
    totalModuleCount: modules.length,
    fileHashes,
    generationTimeMs: Math.round(generationTimeMs),
    lastUpdated: Date.now(),
    nextScanRequired: false,
  }
}

/**
 * Create ModuleInfo from package.json
 */
function createPackageModuleInfo(
  modulePath: string,
  type: 'package' | 'app',
  packageJsonPath: string
): ModuleInfo {
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))

  // Determine main entry point
  let mainFile = 'src/index.ts'
  if (packageJson.main) {
    mainFile = packageJson.main
  } else if (existsSync(join(modulePath, 'index.ts'))) {
    mainFile = 'index.ts'
  }

  const name =
    type === 'package'
      ? `packages/${packageJson.name.split('/').pop()}`
      : `apps/${packageJson.name.split('/').pop()}`

  return {
    name,
    type,
    packagePath: packageJsonPath,
    mainFile: join(modulePath, mainFile),
    dependencies: extractDependencies(packageJson),
    dependents: [],
    version: packageJson.version,
    description: packageJson.description,
  }
}

/**
 * Extract internal dependencies from package.json
 */
function extractDependencies(packageJson: Record<string, unknown>): string[] {
  const deps: string[] = []
  const all = {
    ...(packageJson.dependencies as Record<string, unknown>),
    ...(packageJson.devDependencies as Record<string, unknown>),
    ...(packageJson.peerDependencies as Record<string, unknown>),
  }

  for (const name of Object.keys(all)) {
    // Match @zidney/* internal packages
    if (name.startsWith('@zidney/')) {
      const packageName = name.replace('@zidney/', '')
      deps.push(`packages/${packageName}`)
    }
    // Match app imports (if any)
    if (name.startsWith('@')) {
      // Could be app imports depending on alias configuration
    }
  }

  return Array.from(new Set(deps))
}

/**
 * Resolve which modules depend on which
 */
function resolveModuleDependencies(
  modules: ModuleInfo[],
  moduleIndex: Record<string, ModuleInfo>
): void {
  const moduleNames = new Set(Object.keys(moduleIndex))

  for (const module of modules) {
    for (const dep of module.dependencies) {
      if (moduleNames.has(dep) && moduleIndex[dep]) {
        moduleIndex[dep].dependents.push(module.name)
      }
    }
  }

  // Remove duplicates
  for (const module of modules) {
    module.dependents = Array.from(new Set(module.dependents))
  }
}

/**
 * Hash file for cache validation
 */
function hashFile(filePath: string): string {
  try {
    const content = readFileSync(filePath, 'utf-8')
    return createHash('sha256').update(content).digest('hex').slice(0, 16)
  } catch {
    return 'unknown'
  }
}

/**
 * Get module by name
 */
export function getModule(roster: ModuleRoster, name: string): ModuleInfo | null {
  return roster.moduleIndex[name] || null
}

/**
 * Get all dependencies of a module
 */
export function getModuleDependencies(roster: ModuleRoster, moduleName: string): ModuleInfo[] {
  const module = getModule(roster, moduleName)
  if (!module) {
    return []
  }

  return module.dependencies
    .map((name) => getModule(roster, name))
    .filter((m): m is ModuleInfo => m !== null)
}

/**
 * Get all dependents of a module
 */
export function getModuleDependents(roster: ModuleRoster, moduleName: string): ModuleInfo[] {
  const module = getModule(roster, moduleName)
  if (!module) {
    return []
  }

  return module.dependents
    .map((name) => getModule(roster, name))
    .filter((m): m is ModuleInfo => m !== null)
}

/**
 * Get transitive dependencies
 */
export function getTransitiveDependencies(
  roster: ModuleRoster,
  moduleName: string,
  visited = new Set<string>()
): string[] {
  if (visited.has(moduleName)) {
    return []
  }

  visited.add(moduleName)
  const module = getModule(roster, moduleName)
  if (!module) {
    return []
  }

  const result = [...module.dependencies]
  for (const dep of module.dependencies) {
    result.push(...getTransitiveDependencies(roster, dep, visited))
  }

  return Array.from(new Set(result))
}

/**
 * Get all modules at a specific layer
 */
export function getModulesByLayer(roster: ModuleRoster, layer: 'package' | 'app'): ModuleInfo[] {
  return roster.modules.filter((m) => m.type === layer)
}

/**
 * Format roster for reporting
 */
export function formatRosterReport(roster: ModuleRoster): string {
  const lines: string[] = [
    `Module Roster Report`,
    `Total modules: ${roster.totalModuleCount}`,
    `Packages: ${getModulesByLayer(roster, 'package').length}`,
    `Apps: ${getModulesByLayer(roster, 'app').length}`,
    `Generated in: ${roster.generationTimeMs}ms`,
    ``,
    `Modules:`,
  ]

  for (const module of roster.modules) {
    lines.push(`  ${module.name} (${module.type})`)
    if (module.dependencies.length > 0) {
      lines.push(`    Dependencies: ${module.dependencies.join(', ')}`)
    }
    if (module.dependents.length > 0) {
      lines.push(`    Dependents: ${module.dependents.join(', ')}`)
    }
  }

  return lines.join('\n')
}

export interface ModuleInfo {
  name: string
  type: 'package' | 'app'
  packagePath: string
  mainFile: string
  dependencies: string[]
  dependents: string[]
  version?: string
  description?: string
}

export interface ModuleRoster {
  timestamp: number
  version: number
  modules: ModuleInfo[]
  moduleIndex: Record<string, ModuleInfo>
  totalModuleCount: number
  fileHashes: Record<string, string>
  generationTimeMs: number
  lastUpdated: number
  nextScanRequired: boolean
}
