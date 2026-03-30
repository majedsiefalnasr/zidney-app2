#!/usr/bin/env bun
/**
 * @script arch:generate
 * @domain arch
 * @category dev
 * @description Regenerate ARCHITECTURE_MAP.json by scanning top-level apps and
 *   packages modules and their dependencies.
 * @usage bun run arch:generate
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { exit, hasCiFlag, log } from '../utils/logger'

const ROOT = process.cwd()
const isCi = hasCiFlag()
log.setScript('arch:generate')

const ARCH_PATH = join(ROOT, 'docs', 'architecture', 'intelligence', 'ARCHITECTURE_MAP.json')

function scanModules() {
  const modules: string[] = []

  const roots = ['packages', 'apps']

  for (const r of roots) {
    const base = join(ROOT, r)
    if (!existsSync(base)) continue

    for (const entry of readdirSync(base)) {
      const full = join(base, entry)
      if (!statSync(full).isDirectory()) continue

      modules.push(`${r}/${entry}`)
    }
  }

  return modules
}

function walk(dir: string, files: string[]) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue

    const full = join(dir, entry)

    if (statSync(full).isDirectory()) {
      walk(full, files)
      continue
    }

    if (full.endsWith('.ts') || full.endsWith('.js')) {
      files.push(full)
    }
  }
}

function scanDependencies(moduleRoot: string) {
  const files: string[] = []
  walk(join(ROOT, moduleRoot), files)

  const deps = new Set<string>()

  for (const f of files) {
    const content = readFileSync(f, 'utf-8')

    const matches = Array.from(content.matchAll(/from\s+['"]([^'"]+)['"]/g))

    for (const m of matches) {
      const imp = m[1]

      const pkg = imp.match(/^packages\/([^/]+)/)
      const app = imp.match(/^apps\/([^/]+)/)

      if (pkg) deps.add(`packages/${pkg[1]}`)
      if (app) deps.add(`apps/${app[1]}`)
    }
  }

  deps.delete(moduleRoot)

  return Array.from(deps)
}

function inferLayer(module: string) {
  if (module.startsWith('packages/ui')) return 'ui'
  if (module.startsWith('apps/')) return 'ui'
  if (module.includes('config') || module.includes('redis') || module.includes('logger'))
    return 'infrastructure'
  return 'domain'
}

function generateMap() {
  log.header(
    'GENERATE ARCHITECTURE MAP',
    'Regenerates ARCHITECTURE_MAP.json from workspace modules'
  )
  if (isCi) {
    log.info('[generate-architecture-map] CI mode enabled')
  }
  const modules = scanModules()

  const existing = existsSync(ARCH_PATH)
    ? JSON.parse(readFileSync(ARCH_PATH, 'utf-8'))
    : {
        system: 'Zidney',
        architecture_model: 'layered-monorepo',
        version: '1.0',
        layers: ['domain', 'infrastructure', 'runtime', 'ui'],
        modules: {},
      }

  const newModules: Record<
    string,
    {
      layer: string
      description: string
      criticality: string
      allowed_dependencies: string[]
      forbidden_dependencies: string[]
    }
  > = {}

  for (const m of modules) {
    const deps = scanDependencies(m)

    const prev = existing.modules?.[m]

    newModules[m] = {
      layer: prev?.layer ?? inferLayer(m),
      description: prev?.description ?? '',
      criticality: prev?.criticality ?? (m.startsWith('apps/') ? 'runtime' : 'core'),
      allowed_dependencies: deps,
      forbidden_dependencies: prev?.forbidden_dependencies ?? [],
    }
  }

  const result = {
    system: 'Zidney',
    architecture_model: 'layered-monorepo',
    version: '1.0',
    layers: ['domain', 'infrastructure', 'runtime', 'ui'],
    modules: newModules,
  }

  writeFileSync(ARCH_PATH, JSON.stringify(result, null, 2))

  log.success('ARCHITECTURE_MAP.json regenerated')
  log.info(`Modules: ${Object.keys(newModules).length}`)
  log.progressResult(
    { success: Object.keys(newModules).length },
    { title: 'Architecture Map Regenerated', showPercentage: true }
  )
  exit(0)
}

generateMap()
