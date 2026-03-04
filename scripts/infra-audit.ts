/**
 * Zidney Infrastructure Audit
 *
 * Monorepo governance scanner.
 * Scans repository structure and outputs infra-audit-report.json
 *
 * Responsibilities:
 * - Vitest configuration audit
 * - ESLint configuration audit
 * - Playwright presence
 * - Test distribution analysis
 * - README governance checks
 * - Skipped / flaky / quarantined test detection
 * - Dependency boundary enforcement
 *
 * NOTE:
 * CLI utility — exempt from service-layer logging standards.
 */

import { execSync } from 'child_process'
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'fs'
import { basename, join, relative } from 'path'

const ROOT = process.cwd()

const REPORT_DIR = join(ROOT, 'docs', 'reports')
const ARCH_DIR = join(ROOT, 'docs', 'architecture')
const ARCH_GRAPHS_DIR = join(ROOT, 'docs', 'architecture', 'graphs')
const ARCH_INTEL_DIR = join(ROOT, 'docs', 'architecture', 'intelligence')
const ARCH_HISTORY_DIR = join(ROOT, 'docs', 'architecture', 'audits', 'history')

if (!existsSync(REPORT_DIR)) {
  mkdirSync(REPORT_DIR, { recursive: true })
}

if (!existsSync(ARCH_DIR)) {
  mkdirSync(ARCH_DIR, { recursive: true })
}

if (!existsSync(ARCH_GRAPHS_DIR)) {
  mkdirSync(ARCH_GRAPHS_DIR, { recursive: true })
}

if (!existsSync(ARCH_INTEL_DIR)) {
  mkdirSync(ARCH_INTEL_DIR, { recursive: true })
}

if (!existsSync(ARCH_HISTORY_DIR)) {
  mkdirSync(ARCH_HISTORY_DIR, { recursive: true })
}

/* -------------------------------------------------------------------------- */
/* TSConfig Alias Resolution                                                  */
/* -------------------------------------------------------------------------- */

interface TsAliasMap {
  alias: string
  target: string
}

function loadTsAliases(): TsAliasMap[] {
  const paths = [join(ROOT, 'tsconfig.json'), join(ROOT, 'tsconfig.base.json')]

  for (const p of paths) {
    if (!existsSync(p)) continue

    try {
      const json = JSON.parse(readFileSync(p, 'utf-8'))
      const pathsConfig = json?.compilerOptions?.paths

      if (!pathsConfig) continue

      const aliases: TsAliasMap[] = []

      for (const key of Object.keys(pathsConfig)) {
        const cleanKey = key.replace('/*', '')
        const target = pathsConfig[key][0]?.replace('/*', '')

        if (target) {
          aliases.push({
            alias: cleanKey,
            target,
          })
        }
      }

      return aliases
    } catch {
      continue
    }
  }

  return []
}

const TS_ALIASES = loadTsAliases()

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

const SKIP_DIRS = new Set(['node_modules', '.git', '.DS_Store'])

const SECRET_PATTERNS: RegExp[] = [
  /^\.env$/,
  /^\.env\..+/,
  /\.pem$/,
  /\.key$/,
  /\.secret$/,
  /\.p12$/,
  /\.pfx$/,
]

const VITEST_CONFIG_NAMES = new Set([
  'vitest.config.ts',
  'vitest.config.js',
  'vitest.workspace.ts',
  'vitest.workspace.js',
])

const PLAYWRIGHT_CONFIG_NAMES = new Set([
  'playwright.config.ts',
  'playwright.config.js',
])

const ESLINT_CONFIG_PATTERNS: RegExp[] = [
  /^eslint\.config\.(js|mjs|cjs|ts)$/,
  /^\.eslintrc\.(js|json|cjs|yaml|yml)$/,
  /^\.eslintrc$/,
]

const REQUIRED_README_SECTIONS = [
  'Purpose',
  'Responsibilities',
  'Dependencies',
  'Public API',
  'How to Run Tests',
  'Environment Variables',
  'Known Boundaries',
]

/* Dependency boundary rules */

const DEP_RULES = {
  forbidPackagesImportingApps: true,
  forbidAppsImportingOtherApps: true,
}

/* Zidney architectural layer rules */

const LAYER_RULES = {
  // UI primitives must not depend on domain logic
  forbidUiImportingDomain: {
    source: 'packages/ui-system',
    target: 'packages/domain-core',
  },

  // API client must remain transport layer only
  forbidApiClientImportingWorker: {
    source: 'packages/api-client',
    target: 'apps/worker',
  },
}

/* Test classification patterns */

const SKIP_PATTERNS = [
  /\.skip\s*\(/,
  /\.todo\s*\(/,
  /\bxit\s*\(/,
  /\bxdescribe\s*\(/,
]

const FLAKY_PATTERNS = [/\.retry\s*\(/, /\/\/\s*(flaky|unstable)/i]

const QUARANTINE_PATTERNS = [/\[QUARANTINED\]/i, /@quarantine/i]

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function resolveImportTarget(imp: string): string | null {
  // direct workspace imports
  const pkg = imp.match(/^packages\/([^/]+)/)
  if (pkg) return `packages/${pkg[1]}`

  const app = imp.match(/^apps\/([^/]+)/)
  if (app) return `apps/${app[1]}`

  // Zidney alias pattern
  const zidneyAlias = imp.match(/^@zidney\/([^/]+)/)
  if (zidneyAlias) return `packages/${zidneyAlias[1]}`

  // TSConfig aliases
  for (const a of TS_ALIASES) {
    if (imp.startsWith(a.alias)) {
      const resolved = imp.replace(a.alias, a.target)

      if (resolved.startsWith('packages/')) {
        const parts = resolved.split('/')
        return `${parts[0]}/${parts[1]}`
      }

      if (resolved.startsWith('apps/')) {
        const parts = resolved.split('/')
        return `${parts[0]}/${parts[1]}`
      }

      return resolved
    }
  }

  // common Vite/TS root aliases
  const rootAlias = imp.match(/^@\/([^/]+)/)
  if (rootAlias) return rootAlias[1]

  const tildeAlias = imp.match(/^~\/([^/]+)/)
  if (tildeAlias) return tildeAlias[1]

  return null
}

function safeRead(path: string): string | null {
  try {
    return readFileSync(path, 'utf-8')
  } catch {
    return null
  }
}

function walk(dir: string, files: Map<string, string>) {
  let entries: string[] = []

  try {
    entries = readdirSync(dir)
  } catch {
    return
  }

  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue

    const full = join(dir, entry)

    let isDir = false
    try {
      isDir = statSync(full).isDirectory()
    } catch {
      continue
    }

    if (isDir) {
      walk(full, files)
      continue
    }

    if (SECRET_PATTERNS.some((p) => p.test(entry))) continue

    const rel = relative(ROOT, full)
    files.set(rel, full)
  }
}

/* -------------------------------------------------------------------------- */
/* Vitest audit                                                               */
/* -------------------------------------------------------------------------- */

interface VitestEntry {
  path: string
  environment: string | null
  globals: boolean | null
  coverageEnabled: boolean
  reporters: string[]
  isWorkspace: boolean
}

function scanVitest(files: Map<string, string>): VitestEntry[] {
  const results: VitestEntry[] = []

  for (const [rel, full] of files) {
    const name = basename(full)

    if (!VITEST_CONFIG_NAMES.has(name)) continue

    const content = safeRead(full) ?? ''

    const env = content.match(/environment\s*:\s*['"]([^'"]+)['"]/)?.[1] ?? null
    const globals =
      content.match(/globals\s*:\s*(true|false)/)?.[1] === 'true' ? true : null

    const coverage = /coverage\s*:/.test(content)

    const reporters =
      content
        .match(/reporter\s*:\s*\[([^\]]+)/)?.[1]
        ?.match(/['"]([^'"]+)['"]/g)
        ?.map((r) => r.replace(/['"]/g, '')) ?? []

    results.push({
      path: rel,
      environment: env,
      globals,
      coverageEnabled: coverage,
      reporters,
      isWorkspace: name.includes('workspace'),
    })
  }

  return results
}

function vitestRisk(configs: VitestEntry[]): 'LOW' | 'MEDIUM' | 'HIGH' {
  if (configs.some((c) => c.isWorkspace)) return 'LOW'

  if (configs.length <= 1) return 'LOW'
  if (configs.length <= 3) return 'MEDIUM'
  return 'HIGH'
}

/* -------------------------------------------------------------------------- */
/* ESLint audit                                                               */
/* -------------------------------------------------------------------------- */

interface ESLintEntry {
  path: string
  format: 'flat' | 'legacy'
}

function scanEslint(files: Map<string, string>): ESLintEntry[] {
  const results: ESLintEntry[] = []

  for (const [rel] of files) {
    const name = basename(rel)

    if (!ESLINT_CONFIG_PATTERNS.some((p) => p.test(name))) continue

    const flat = /^eslint\.config\./.test(name)

    results.push({
      path: rel,
      format: flat ? 'flat' : 'legacy',
    })
  }

  return results
}

/* -------------------------------------------------------------------------- */
/* Test file distribution                                                     */
/* -------------------------------------------------------------------------- */

interface TestCounts {
  unit: number
  integration: number
  spec: number
  total: number
  perApp: Record<string, { unit: number; integration: number; spec: number }>
}

function countTests(files: Map<string, string>): TestCounts {
  let unit = 0
  let integration = 0
  let spec = 0

  const perApp: TestCounts['perApp'] = {}

  for (const [rel] of files) {
    const isTest = rel.endsWith('.test.ts') || rel.endsWith('.test.js')
    const isSpec = rel.endsWith('.spec.ts')

    if (isTest && rel.match(/^apps\/[^/]+\/tests\/unit/)) {
      unit++
      const app = rel.split('/')[1]
      perApp[app] ??= { unit: 0, integration: 0, spec: 0 }
      perApp[app].unit++
    }

    if (isTest && rel.match(/tests\/integration/)) {
      integration++
      const app = rel.split('/')[1]
      perApp[app] ??= { unit: 0, integration: 0, spec: 0 }
      perApp[app].integration++
    }

    if (isSpec) {
      spec++
      const app = rel.split('/')[1]
      if (rel.startsWith('apps/')) {
        perApp[app] ??= { unit: 0, integration: 0, spec: 0 }
        perApp[app].spec++
      }
    }
  }

  return {
    unit,
    integration,
    spec,
    total: unit + integration + spec,
    perApp,
  }
}

/* -------------------------------------------------------------------------- */
/* README audit                                                               */
/* -------------------------------------------------------------------------- */

function checkSections(content: string) {
  const result: Record<string, string> = {}

  for (const section of REQUIRED_README_SECTIONS) {
    const match = content.match(new RegExp(`^#{1,3}\\s+${section}`, 'im'))

    if (!match) {
      result[section] = 'MISSING'
      continue
    }

    result[section] = 'PRESENT'
  }

  return result
}

function scanReadmes() {
  const dirs = ['apps', 'packages']
  const results: any[] = []

  for (const base of dirs) {
    const root = join(ROOT, base)

    if (!existsSync(root)) continue

    const subs = readdirSync(root)

    for (const sub of subs) {
      const path = join(root, sub)

      if (!statSync(path).isDirectory()) continue

      const rel = `${base}/${sub}`

      const readme = join(path, 'README.md')

      if (!existsSync(readme)) {
        results.push({ directory: rel, hasReadme: false })
        continue
      }

      const content = safeRead(readme) ?? ''

      const sections = checkSections(content)

      if (rel.startsWith('apps/') && sections['Public API'] === 'MISSING') {
        sections['Public API'] = 'PRESENT_EMPTY'
      }

      results.push({
        directory: rel,
        hasReadme: true,
        sections,
      })
    }
  }

  return results
}

/* -------------------------------------------------------------------------- */
/* Test stability audit                                                       */
/* -------------------------------------------------------------------------- */

function scanTestStability(files: Map<string, string>) {
  const skipped: string[] = []
  const flaky: string[] = []
  const quarantined: string[] = []

  for (const [rel, full] of files) {
    if (!rel.match(/\.(test|spec)\.(ts|js)$/)) continue

    const content = safeRead(full)
    if (!content) continue

    if (QUARANTINE_PATTERNS.some((p) => p.test(content))) {
      quarantined.push(rel)
      continue
    }

    if (SKIP_PATTERNS.some((p) => p.test(content))) {
      skipped.push(rel)
    }

    if (FLAKY_PATTERNS.some((p) => p.test(content))) {
      flaky.push(rel)
    }
  }

  return { skipped, flaky, quarantined }
}

/* -------------------------------------------------------------------------- */
/* Dependency boundary audit                                                  */
/* -------------------------------------------------------------------------- */

function scanDependencyBoundaries(files: Map<string, string>) {
  const violations: any[] = []

  for (const [rel, full] of files) {
    if (!rel.endsWith('.ts') && !rel.endsWith('.js')) continue

    const content = safeRead(full)
    if (!content) continue

    const imports = content.matchAll(/from\s+['"]([^'"]+)['"]/g)

    for (const m of imports) {
      const imp = m[1]

      if (
        DEP_RULES.forbidPackagesImportingApps &&
        rel.startsWith('packages/') &&
        imp.startsWith('apps/')
      ) {
        violations.push({
          file: rel,
          importPath: imp,
          rule: 'packages_must_not_import_apps',
        })
      }

      if (DEP_RULES.forbidAppsImportingOtherApps && rel.startsWith('apps/')) {
        const srcApp = rel.split('/')[1]
        const resolved = resolveImportTarget(imp)
        const target = resolved?.startsWith('apps/')
          ? resolved.split('/')[1]
          : null

        if (target && target !== srcApp) {
          violations.push({
            file: rel,
            importPath: imp,
            rule: 'apps_must_not_import_other_apps',
          })
        }
      }
    }
  }

  return violations
}

/* -------------------------------------------------------------------------- */
/* Circular dependency audit                                                  */
/* -------------------------------------------------------------------------- */

interface CircularDependency {
  from: string
  to: string
}

function scanCircularDependencies(files: Map<string, string>) {
  const graph: Record<string, Set<string>> = {}
  const cycles: CircularDependency[] = []

  for (const [rel, full] of files) {
    if (!rel.endsWith('.ts') && !rel.endsWith('.js')) continue

    const moduleRoot = rel.startsWith('packages/')
      ? rel.split('/').slice(0, 2).join('/')
      : rel.startsWith('apps/')
        ? rel.split('/').slice(0, 2).join('/')
        : null

    if (!moduleRoot) continue

    graph[moduleRoot] ??= new Set()

    const content = safeRead(full)
    if (!content) continue

    const imports = content.matchAll(/from\s+['"]([^'"]+)['"]/g)

    for (const m of imports) {
      const imp = m[1]

      const target = resolveImportTarget(imp)

      if (target && target !== moduleRoot) {
        graph[moduleRoot].add(target)
      }
    }
  }

  const visited = new Set<string>()
  const stack = new Set<string>()

  function dfs(node: string, path: string[]) {
    if (stack.has(node)) {
      const cycleStart = path.indexOf(node)
      const cyclePath = path.slice(cycleStart).concat(node)

      for (let i = 0; i < cyclePath.length - 1; i++) {
        cycles.push({
          from: cyclePath[i],
          to: cyclePath[i + 1],
        })
      }

      return
    }

    if (visited.has(node)) return

    visited.add(node)
    stack.add(node)

    const neighbors = graph[node] || new Set()

    for (const next of neighbors) {
      dfs(next, [...path, node])
    }

    stack.delete(node)
  }

  for (const node of Object.keys(graph)) {
    dfs(node, [])
  }

  return cycles
}

/* -------------------------------------------------------------------------- */
/* Architectural layer enforcement                                            */
/* -------------------------------------------------------------------------- */

interface LayerViolation {
  file: string
  importPath: string
  rule: string
}

function scanLayerViolations(files: Map<string, string>) {
  const violations: LayerViolation[] = []

  for (const [rel, full] of files) {
    if (!rel.endsWith('.ts') && !rel.endsWith('.js')) continue

    const content = safeRead(full)
    if (!content) continue

    const imports = content.matchAll(/from\s+['"]([^'"]+)['"]/g)

    for (const m of imports) {
      const imp = m[1]

      if (
        rel.startsWith(LAYER_RULES.forbidUiImportingDomain.source) &&
        resolveImportTarget(imp) === LAYER_RULES.forbidUiImportingDomain.target
      ) {
        violations.push({
          file: rel,
          importPath: imp,
          rule: 'ui_system_must_not_import_domain_core',
        })
      }

      if (
        rel.startsWith(LAYER_RULES.forbidApiClientImportingWorker.source) &&
        resolveImportTarget(imp) ===
          LAYER_RULES.forbidApiClientImportingWorker.target
      ) {
        violations.push({
          file: rel,
          importPath: imp,
          rule: 'api_client_must_not_import_worker',
        })
      }
    }
  }

  return violations
}

/* -------------------------------------------------------------------------- */
/* Dependency graph export (AI / architecture visualization)                  */
/* -------------------------------------------------------------------------- */

interface DependencyGraph {
  nodes: string[]
  edges: { from: string; to: string }[]
}

interface AIDependencyGraph {
  nodes: { id: string; type: 'package' | 'app' }[]
  edges: { from: string; to: string }[]
  centrality: Record<string, number>
}

function buildDependencyGraph(files: Map<string, string>): DependencyGraph {
  const nodes = new Set<string>()
  const edges: { from: string; to: string }[] = []

  for (const [rel, full] of files) {
    if (!rel.endsWith('.ts') && !rel.endsWith('.js')) continue

    const moduleRoot = rel.startsWith('packages/')
      ? rel.split('/').slice(0, 2).join('/')
      : rel.startsWith('apps/')
        ? rel.split('/').slice(0, 2).join('/')
        : null

    if (!moduleRoot) continue

    nodes.add(moduleRoot)

    const content = safeRead(full)
    if (!content) continue

    const imports = content.matchAll(/from\s+['"]([^'"]+)['"]/g)

    for (const m of imports) {
      const imp = m[1]

      const target = resolveImportTarget(imp)

      if (target && target !== moduleRoot) {
        nodes.add(target)
        edges.push({ from: moduleRoot, to: target })
      }
    }
  }

  return {
    nodes: Array.from(nodes),
    edges,
  }
}

function computeCentrality(graph: DependencyGraph) {
  const counts: Record<string, number> = {}

  for (const node of graph.nodes) counts[node] = 0

  for (const edge of graph.edges) {
    counts[edge.to] = (counts[edge.to] ?? 0) + 1
  }

  return counts
}

function exportAIGraph(graph: DependencyGraph): AIDependencyGraph {
  const centrality = computeCentrality(graph)

  const nodes = graph.nodes.map((n) => ({
    id: n,
    type: n.startsWith('packages/') ? 'package' : 'app',
  }))

  return {
    nodes,
    edges: graph.edges,
    centrality,
  }
}

/* -------------------------------------------------------------------------- */
/* Mermaid graph export                                                       */
/* -------------------------------------------------------------------------- */

function exportMermaidGraph(graph: DependencyGraph) {
  const lines: string[] = ['graph TD']

  for (const edge of graph.edges) {
    const from = edge.from.replace(/[\/-]/g, '_')
    const to = edge.to.replace(/[\/-]/g, '_')

    lines.push(`  ${from} --> ${to}`)
  }

  return lines.join('\n')
}

function exportArchitectureMermaid(graph: DependencyGraph) {
  const lines: string[] = ['graph TD']

  const packages: string[] = []
  const apps: string[] = []

  for (const node of graph.nodes) {
    if (node.startsWith('packages/')) packages.push(node)
    else if (node.startsWith('apps/')) apps.push(node)
  }

  if (packages.length) {
    lines.push('  subgraph packages')

    for (const node of packages) {
      const safe = node.replace(/[\\/-]/g, '_')
      lines.push(`    ${safe}[${node}]`)
    }

    lines.push('  end')
  }

  if (apps.length) {
    lines.push('  subgraph apps')

    for (const node of apps) {
      const safe = node.replace(/[\\/-]/g, '_')
      lines.push(`    ${safe}[[${node}]]`)
    }

    lines.push('  end')
  }

  for (const edge of graph.edges) {
    const from = edge.from.replace(/[\\/-]/g, '_')
    const to = edge.to.replace(/[\\/-]/g, '_')

    lines.push(`  ${from} --> ${to}`)
  }

  return lines.join('\n')
}

function detectArchitectureDrift(graph: DependencyGraph) {
  const drift: { from: string; to: string }[] = []

  for (const edge of graph.edges) {
    if (edge.from.startsWith('packages/') && edge.to.startsWith('apps/')) {
      drift.push(edge)
    }
  }

  return drift
}

/* -------------------------------------------------------------------------- */
/* Architecture Score calculator                                              */
/* -------------------------------------------------------------------------- */

function computeArchitectureScore(params: {
  circular: number
  depViolations: number
  layerViolations: number
  drift: number
  skipped: number
  flaky: number
}) {
  let score = 100

  score -= params.circular * 10
  score -= params.depViolations * 5
  score -= params.layerViolations * 5
  score -= params.drift * 5
  score -= params.skipped * 0.5
  score -= params.flaky * 1

  if (score < 0) score = 0

  return Math.round(score)
}

/* -------------------------------------------------------------------------- */
/* CI enforcement mode                                                        */
/* -------------------------------------------------------------------------- */

const CI_MODE = process.argv.includes('--ci')
const ARCH_SCORE_THRESHOLD = 85

/* -------------------------------------------------------------------------- */
/* Main                                                                       */
/* -------------------------------------------------------------------------- */

console.log('[INFRA AUDIT] Starting...')

const files = new Map<string, string>()
walk(ROOT, files)

const gitSha = (() => {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim()
  } catch {
    return 'UNKNOWN'
  }
})()

const vitest = scanVitest(files)
const eslint = scanEslint(files)
const playwright = Array.from(files.keys()).filter((f) =>
  PLAYWRIGHT_CONFIG_NAMES.has(basename(f))
)

const tests = countTests(files)
const readmes = scanReadmes()
const stability = scanTestStability(files)
const depViolations = scanDependencyBoundaries(files)
const circularDependencies = scanCircularDependencies(files)
const layerViolations = scanLayerViolations(files)
const dependencyGraph = buildDependencyGraph(files)
const architectureDrift = detectArchitectureDrift(dependencyGraph)
const aiGraph = exportAIGraph(dependencyGraph)

const architectureScore = computeArchitectureScore({
  circular: circularDependencies.length,
  depViolations: depViolations.length,
  layerViolations: layerViolations.length,
  drift: architectureDrift.length,
  skipped: stability.skipped.length,
  flaky: stability.flaky.length,
})

/* -------------------------------------------------------------------------- */
/* Architecture Trend Analysis                                                */
/* -------------------------------------------------------------------------- */

function getPreviousArchitectureScore(): number | null {
  try {
    const files = readdirSync(ARCH_HISTORY_DIR)
      .filter((f) => f.startsWith('audit-') && f.endsWith('.json'))
      .sort()

    if (files.length < 2) return null

    const previousFile = files[files.length - 2]
    const previous = JSON.parse(
      readFileSync(join(ARCH_HISTORY_DIR, previousFile), 'utf-8')
    )

    return previous.architectureScore ?? null
  } catch {
    return null
  }
}

const previousArchitectureScore = getPreviousArchitectureScore()

const architectureScoreDelta =
  previousArchitectureScore !== null
    ? architectureScore - previousArchitectureScore
    : null

const moduleRisk = classifyModuleRisk(aiGraph.centrality)

function classifyModuleRisk(centrality: Record<string, number>) {
  const risks: Record<string, 'LOW' | 'MEDIUM' | 'HIGH'> = {}

  const values = Object.values(centrality)
  const max = Math.max(...values, 1)

  for (const [module, score] of Object.entries(centrality)) {
    const ratio = score / max

    if (ratio > 0.66) risks[module] = 'HIGH'
    else if (ratio > 0.33) risks[module] = 'MEDIUM'
    else risks[module] = 'LOW'
  }

  return risks
}

const report = {
  timestamp: new Date().toISOString(),
  gitSha,
  vitestConfigs: vitest,
  eslintConfigs: eslint,
  playwrightConfigs: playwright,
  testDistribution: tests,
  readmeAudit: readmes,
  skippedTests: stability.skipped,
  flakyTests: stability.flaky,
  quarantinedTests: stability.quarantined,
  dependencyViolations: depViolations,
  circularDependencies,
  layerViolations,
  dependencyGraph,
  architectureDrift,
  aiGraph,
  architectureScore,
  moduleRisk,
  consolidationRisk: vitestRisk(vitest),
}

writeFileSync(
  join(REPORT_DIR, 'infra-audit-report.json'),
  JSON.stringify(report, null, 2)
)

writeFileSync(
  join(ARCH_GRAPHS_DIR, 'dependency-graph.json'),
  JSON.stringify(dependencyGraph, null, 2)
)

writeFileSync(
  join(ARCH_GRAPHS_DIR, 'dependency-graph-ai.json'),
  JSON.stringify(aiGraph, null, 2)
)

writeFileSync(
  join(ARCH_GRAPHS_DIR, 'dependency-graph.mmd'),
  exportMermaidGraph(dependencyGraph)
)

writeFileSync(
  join(ARCH_GRAPHS_DIR, 'architecture-graph.mmd'),
  exportArchitectureMermaid(dependencyGraph)
)

// Persist architecture history snapshots
const historyFile = join(ARCH_HISTORY_DIR, `audit-${Date.now()}.json`)
writeFileSync(historyFile, JSON.stringify(report, null, 2))

// Generate Architecture Dashboard markdown
const dashboard = `# Zidney Architecture Dashboard

**Generated:** ${report.timestamp}
**Git SHA:** ${gitSha}

## Architecture Score

**Score:** ${architectureScore} / 100

**Trend:** ${
  architectureScoreDelta === null
    ? 'N/A'
    : architectureScoreDelta > 0
      ? `+${architectureScoreDelta} improvement`
      : `${architectureScoreDelta} regression`
}

## System Health

| Metric | Value |
|------|------|
| Circular Dependencies | ${circularDependencies.length} |
| Dependency Violations | ${depViolations.length} |
| Layer Violations | ${layerViolations.length} |
| Architecture Drift | ${architectureDrift.length} |
| Skipped Tests | ${stability.skipped.length} |
| Flaky Tests | ${stability.flaky.length} |

## Test Distribution

Total Tests: ${tests.total}

- Unit: ${tests.unit}
- Integration: ${tests.integration}
- E2E (spec): ${tests.spec}

## Dependency Graph

Nodes: ${dependencyGraph.nodes.length}

Edges: ${dependencyGraph.edges.length}

## Top Architectural Hotspots

${Object.entries(aiGraph.centrality)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10)
  .map(([k, v]) => `- ${k} (${v})`)
  .join('\n')}

---

Generated by **Zidney Infra Audit v7**.
`

writeFileSync(join(ARCH_INTEL_DIR, 'ARCHITECTURE_DASHBOARD.md'), dashboard)

const heatmap = `# Zidney Architecture Risk Heatmap

Generated: ${new Date().toISOString()}

## Module Risk Classification

| Module | Risk |
|------|------|
${Object.entries(moduleRisk)
  .sort((a, b) => {
    const order: any = { HIGH: 3, MEDIUM: 2, LOW: 1 }
    return order[b[1]] - order[a[1]]
  })
  .map(([m, r]) => `| ${m} | ${r} |`)
  .join('\n')}

## Interpretation

HIGH = architecture hotspot (high dependency pressure)
MEDIUM = moderate coupling
LOW = isolated module

Generated by Zidney Infra Audit V9.
`

writeFileSync(join(ARCH_INTEL_DIR, 'ARCHITECTURE_HEATMAP.md'), heatmap)

const aiContext = {
  generatedAt: new Date().toISOString(),
  gitSha,
  architectureScore,
  moduleRisk,
  architectureDrift,
  dependencyRules: DEP_RULES,
  layerRules: LAYER_RULES,
  modules: dependencyGraph.nodes,
  hotspots: Object.entries(aiGraph.centrality)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([module, score]) => ({ module, score })),
  edges: dependencyGraph.edges,
}

writeFileSync(
  join(ARCH_INTEL_DIR, 'ARCHITECTURE_CONTEXT.json'),
  JSON.stringify(aiContext, null, 2)
)

/* -------------------------------------------------------------------------- */
/* AI Architecture Contract (machine-readable governance rules)              */
/* -------------------------------------------------------------------------- */

const architectureContract = {
  version: '1.0',
  generatedAt: new Date().toISOString(),
  gitSha,
  architectureScore,
  modules: dependencyGraph.nodes,
  layers: {
    packages: dependencyGraph.nodes.filter((n) => n.startsWith('packages/')),
    apps: dependencyGraph.nodes.filter((n) => n.startsWith('apps/')),
  },
  rules: {
    dependencyRules: DEP_RULES,
    layerRules: LAYER_RULES,
  },
  moduleRisk,
  edges: dependencyGraph.edges,
}

writeFileSync(
  join(ARCH_INTEL_DIR, 'ARCHITECTURE_CONTRACT.json'),
  JSON.stringify(architectureContract, null, 2)
)

// Generate Interactive Architecture Graph (V8)
const interactiveGraphHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Zidney Architecture Graph</title>
<script src="https://unpkg.com/vis-network/standalone/umd/vis-network.min.js"></script>
<style>
  body { font-family: system-ui, sans-serif; margin:0; padding:0; }
  #topbar { padding:10px 16px; background:#111; color:#fff }
  #graph { width:100%; height:calc(100vh - 40px); }
</style>
</head>
<body>
<div id="topbar">
  Zidney Architecture Graph — ${gitSha.substring(0, 7)} — Score ${architectureScore}/100
</div>
<div id="graph"></div>
<script>

const nodes = ${JSON.stringify(
  aiGraph.nodes.map((n) => ({
    id: n.id,
    label: n.id,
    group: n.type,
  }))
)}

const edges = ${JSON.stringify(
  aiGraph.edges.map((e) => ({
    from: e.from,
    to: e.to,
  }))
)}

const container = document.getElementById('graph')

const data = {
  nodes: new vis.DataSet(nodes),
  edges: new vis.DataSet(edges)
}

const options = {
  layout: {
    improvedLayout: true
  },
  physics: {
    stabilization: true
  },
  groups: {
    package: {
      shape: 'box'
    },
    app: {
      shape: 'ellipse'
    }
  },
  edges: {
    arrows: 'to'
  }
}

new vis.Network(container, data, options)

</script>
</body>
</html>
`

writeFileSync(
  join(ARCH_GRAPHS_DIR, 'architecture-graph.html'),
  interactiveGraphHtml
)

console.log('[INFRA AUDIT] Complete')
console.log('Vitest configs:', vitest.length)
console.log('Playwright configs:', playwright.length)
console.log('Total tests:', tests.total)
console.log('Skipped tests:', stability.skipped.length)
console.log('Flaky tests:', stability.flaky.length)
console.log('Quarantined tests:', stability.quarantined.length)
console.log('Dependency violations:', depViolations.length)
console.log('Circular dependencies:', circularDependencies.length)
console.log('Layer violations:', layerViolations.length)
console.log('Architecture drift:', architectureDrift.length)
console.log('Architecture score:', architectureScore, '/ 100')

if (architectureScoreDelta !== null) {
  const trend =
    architectureScoreDelta > 0
      ? `+${architectureScoreDelta} improvement`
      : `${architectureScoreDelta} regression`

  console.log('Architecture trend since last audit:', trend)
}
console.log('Dependency graph nodes:', dependencyGraph.nodes.length)
console.log('Dependency graph edges:', dependencyGraph.edges.length)
const hottest = Object.entries(aiGraph.centrality)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 5)
console.log(
  'Top architectural hotspots:',
  hottest.map(([k, v]) => `${k}(${v})`).join(', ')
)
const highRiskModules = Object.entries(moduleRisk)
  .filter(([, r]) => r === 'HIGH')
  .map(([m]) => m)

if (highRiskModules.length) {
  console.log('High risk modules:', highRiskModules.join(', '))
}
console.log('Architecture graphs exported to docs/architecture/graphs/')
console.log(
  'Interactive architecture graph: docs/architecture/graphs/architecture-graph.html'
)
console.log(
  'Architecture dashboard exported: docs/architecture/intelligence/ARCHITECTURE_DASHBOARD.md'
)
console.log(
  'Architecture heatmap exported: docs/architecture/intelligence/ARCHITECTURE_HEATMAP.md'
)
console.log(
  'AI architecture context exported: docs/architecture/intelligence/ARCHITECTURE_CONTEXT.json'
)
console.log(
  'AI architecture contract exported: docs/architecture/intelligence/ARCHITECTURE_CONTRACT.json'
)
console.log('Architecture history stored in docs/architecture/audits/history/')
console.log('Audit report exported to docs/reports/')

/* -------------------------------------------------------------------------- */
/* CI Enforcement                                                             */
/* -------------------------------------------------------------------------- */

if (CI_MODE) {
  const failures: string[] = []

  if (circularDependencies.length > 0) {
    failures.push(
      `Circular dependencies detected (${circularDependencies.length})`
    )
  }

  if (depViolations.length > 0) {
    failures.push(
      `Dependency boundary violations detected (${depViolations.length})`
    )
  }

  if (layerViolations.length > 0) {
    failures.push(
      `Architectural layer violations detected (${layerViolations.length})`
    )
  }

  if (architectureDrift.length > 0) {
    failures.push(`Architecture drift detected (${architectureDrift.length})`)
  }

  if (architectureScore < ARCH_SCORE_THRESHOLD) {
    failures.push(
      `Architecture score below threshold (${architectureScore} < ${ARCH_SCORE_THRESHOLD})`
    )
  }

  if (failures.length > 0) {
    console.error('\n[INFRA AUDIT][CI] ❌ Governance violations detected:')

    for (const f of failures) {
      console.error(` - ${f}`)
    }

    console.error(
      '\n[INFRA AUDIT][CI] Failing build due to governance violations.'
    )

    process.exit(1)
  } else {
    console.log('\n[INFRA AUDIT][CI] ✅ Governance checks passed.')
  }
}
