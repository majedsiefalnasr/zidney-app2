/**
 * Source Loader - Load and parse metadata from ADRs, module boundaries, and directory structure
 * Task: T014
 * Path: scripts/ai-context/source-loader.ts
 */

import { readFile, readdir } from 'fs/promises'
import { join, relative } from 'path'
import type { GenerationError } from './types'

/**
 * Loaded metadata from all source systems
 */
export interface SourceMetadata {
  adrFiles: ADRFile[]
  moduleBoundaries: ModuleBoundariesConfig
  modules: ModuleInfo[]
  dockerServices: DockerService[]
  sourceHash: string
  sourceTimestamp: string
  errors: GenerationError[]
}

interface ADRFile {
  number: number
  title: string
  status: string
  path: string
  content: string
}

interface ModuleBoundariesConfig {
  version: string
  layers: LayerDefinition[]
  rules: ImportRules
}

interface LayerDefinition {
  name: string
  description: string
  order: number
}

interface ImportRules {
  [layerName: string]: {
    imports_allowed: string[]
    imports_forbidden: string[]
  }
}

interface ModuleInfo {
  path: string
  name: string
  type: 'app' | 'package'
  layer?: string
}

interface DockerService {
  name: string
  image: string
  ports?: string[]
  environment?: Record<string, string>
}

/**
 * Load ADR files from docs/architecture/adr/
 */
async function loadADRs(adrDir: string): Promise<ADRFile[]> {
  const files = await readdir(adrDir)
  const adrFiles: ADRFile[] = []

  for (const file of files) {
    if (!file.startsWith('adr-') || !file.endsWith('.md')) {
      continue
    }

    try {
      const match = file.match(/adr-(\d+)/)
      if (!match) continue

      const number = parseInt(match[1], 10)
      const content = await readFile(join(adrDir, file), 'utf-8')
      const titleMatch = content.match(/^# ADR-\d+: (.+)$/m)
      const statusMatch = content.match(/## Status\n\n(.+)$/m)

      adrFiles.push({
        number,
        title: titleMatch ? titleMatch[1] : file,
        status: statusMatch ? statusMatch[1] : 'unknown',
        path: join(adrDir, file),
        content,
      })
    } catch (err) {
      console.error(`Error loading ADR ${file}:`, err)
    }
  }

  return adrFiles.sort((a, b) => a.number - b.number)
}

/**
 * Load module-boundaries.json
 */
async function loadModuleBoundaries(boundariesPath: string): Promise<ModuleBoundariesConfig> {
  try {
    const content = await readFile(boundariesPath, 'utf-8')
    return JSON.parse(content)
  } catch (err) {
    console.error(`Error loading module boundaries: ${err}`)
    throw new Error(`Failed to load module-boundaries.json: ${String(err)}`)
  }
}

/**
 * Scan apps/ and packages/ directories for module structures
 */
async function scanModules(repoRoot: string): Promise<ModuleInfo[]> {
  const modules: ModuleInfo[] = []

  const appsDir = join(repoRoot, 'apps')
  const packagesDir = join(repoRoot, 'packages')

  // Scan apps
  try {
    const appNames = await readdir(appsDir)
    for (const appName of appNames) {
      if (appName.startsWith('.')) continue
      const packageJsonPath = join(appsDir, appName, 'package.json')
      try {
        await readFile(packageJsonPath)
        modules.push({
          path: `apps/${appName}`,
          name: appName,
          type: 'app',
        })
      } catch {
        // Directory without package.json, skip
      }
    }
  } catch (err) {
    console.warn('Could not scan apps directory:', err)
  }

  // Scan packages
  try {
    const packageNames = await readdir(packagesDir)
    for (const packageName of packageNames) {
      if (packageName.startsWith('.')) continue
      const packageJsonPath = join(packagesDir, packageName, 'package.json')
      try {
        await readFile(packageJsonPath)
        modules.push({
          path: `packages/${packageName}`,
          name: packageName,
          type: 'package',
        })
      } catch {
        // Directory without package.json, skip
      }
    }
  } catch (err) {
    console.warn('Could not scan packages directory:', err)
  }

  return modules
}

/**
 * Parse docker-compose.yml for service definitions
 */
async function loadDockerServices(composePath: string): Promise<DockerService[]> {
  try {
    const content = await readFile(composePath, 'utf-8')
    // Basic YAML parsing (simplified for now)
    const services: DockerService[] = []

    const lines = content.split('\n')
    let currentService: Partial<DockerService> | null = null

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      if (line.match(/^\s{2}[a-z0-9_]+:/) && !line.includes('image:')) {
        // New service definition
        const serviceName = line.match(/^\s{2}([a-z0-9_]+):/)?.[1]
        if (serviceName) {
          currentService = { name: serviceName }
        }
      } else if (line.match(/^\s{4}image:/) && currentService) {
        currentService.image = line.split(':')[1]?.trim() || ''
      } else if (line.match(/^\s{2}[a-z0-9_]+:/) || line.trim() === '') {
        if (currentService && currentService.name) {
          services.push(currentService as DockerService)
        }
        currentService = null
      }
    }

    if (currentService && currentService.name) {
      services.push(currentService as DockerService)
    }

    return services
  } catch {
    return []
  }
}

/**
 * Compute SHA256 hash of source files for change detection
 */
async function computeSourceHash(adrDir: string, boundariesPath: string): Promise<string> {
  // Simplified hash computation (in production, use crypto.createHash)
  try {
    const adrContent = await readFile(join(adrDir), 'utf-8').catch(() => '')
    const boundariesContent = await readFile(boundariesPath, 'utf-8').catch(() => '')
    const combined = adrContent + boundariesContent

    // Simple hash (in production: crypto.createHash('sha256'))
    let hash = 0
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16)
  } catch {
    return 'unknown'
  }
}

/**
 * Main loader function - orchestrate all source loading
 */
export async function loadSourceMetadata(repoRoot: string): Promise<SourceMetadata> {
  const errors: GenerationError[] = []
  const sourceTimestamp = new Date().toISOString()

  try {
    const adrDir = join(repoRoot, 'docs/architecture/adr')
    const boundariesPath = join(repoRoot, 'docs/architecture/module-boundaries.json')
    const composePath = join(repoRoot, 'docker-compose.yml')

    const [adrs, boundaries, modules, services, sourceHash] = await Promise.all([
      loadADRs(adrDir).catch((err) => {
        errors.push({
          code: 'ADR_LOAD_FAILED',
          message: `Failed to load ADRs: ${String(err)}`,
          context: { path: adrDir },
          severity: 'warning',
        })
        return []
      }),
      loadModuleBoundaries(boundariesPath).catch((err) => {
        errors.push({
          code: 'BOUNDARIES_LOAD_FAILED',
          message: `Failed to load module boundaries: ${String(err)}`,
          context: { path: boundariesPath },
          severity: 'error',
        })
        throw err
      }),
      scanModules(repoRoot),
      loadDockerServices(composePath),
      computeSourceHash(adrDir, boundariesPath),
    ])

    return {
      adrFiles: adrs,
      moduleBoundaries: boundaries,
      modules,
      dockerServices: services,
      sourceHash,
      sourceTimestamp,
      errors,
    }
  } catch (err) {
    throw new Error(`Source loading failed: ${String(err)}`)
  }
}

/**
 * Export source metadata for testing
 */
export { ADRFile, ModuleInfo, DockerService }
