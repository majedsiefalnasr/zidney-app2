/**
 * @script gitnexus:context
 * @domain gitnexus
 * @description Generates a structured GitNexus context JSON artifact from git state and the
 *   ai-architecture-brain.json. Replaces legacy brain-printing output with machine-readable
 *   context consumed by AI orchestrators and CI gates.
 * @mode cli
 * @dependencies node:child_process, node:fs, node:path, docs/ai/context/ai-architecture-brain.json
 *
 * Output: docs/ai/context/gitnexus-context.json (or stdout with --dry-run)
 * Schema:  docs/ai/gitnexus-context.schema.json
 *
 * Usage:
 *   bun run gitnexus:context                   # default: changed files only
 *   bun run gitnexus:context -- --all          # full workspace scan
 *   bun run gitnexus:context -- --dry-run      # print to stdout, no file write
 *   bun run gitnexus:context -- --base-ref HEAD~2  # custom base ref
 */

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

// ---------------------------------------------------------------------------
// Type interfaces
// ---------------------------------------------------------------------------

export interface RecentCommit {
  hash: string
  message: string
  author: string
  date: string
}

export interface RiskIndicator {
  module: string
  riskScore: number
  reason: string
  affectedBy: string[]
}

export interface GitNexusContext {
  schemaVersion: string
  generatedAt: string
  analysisMode: 'changed-only' | 'full'
  changedFiles: string[]
  impactedModules: string[]
  dependencyGraph: Record<string, string[]>
  architectureLayerMap: Record<string, string>
  recentCommits: RecentCommit[]
  riskIndicators: RiskIndicator[]
}

export interface AssembleOptions {
  changedFilesOnly: boolean
  dryRun: boolean
  output: string
  all: boolean
  baseRef: string
}

interface ArchitectureBrain {
  modules: string[]
  layers: Record<string, string>
  dependencies: Record<string, string[]>
  hotspots?: Array<{ module: string; score: number }>
  architectureScore?: number
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BRAIN_PATH = resolve(process.cwd(), 'docs/ai/context/ai-architecture-brain.json')
const DEFAULT_OUTPUT = resolve(process.cwd(), 'docs/ai/context/gitnexus-context.json')
const SCHEMA_VERSION = '1.0.0'

// ---------------------------------------------------------------------------
// Utility: validate CLI argument against an allowlist pattern (injection guard)
// ---------------------------------------------------------------------------

function sanitizeRef(ref: string): string {
  if (!/^[a-zA-Z0-9._\-/^~]+$/.test(ref)) {
    console.error(
      `[gitnexus-context] Invalid --base-ref value: "${ref}". Only alphanumeric, '.', '_', '-', '/', '^', '~' characters are allowed.`
    )
    process.exit(1)
  }
  return ref
}

function sanitizeOutputPath(outputPath: string): string {
  const resolved = resolve(process.cwd(), outputPath)
  const cwd = resolve(process.cwd())
  if (!resolved.startsWith(cwd)) {
    console.error(
      `[gitnexus-context] --output path must be within the workspace directory. Received: "${outputPath}"`
    )
    process.exit(1)
  }
  return resolved
}

// ---------------------------------------------------------------------------
// Pure exported functions (testable)
// ---------------------------------------------------------------------------

/**
 * Detect files changed relative to the base ref.
 * Falls back to `git status --porcelain` if the base ref does not exist.
 */
export function detectChangedFiles(options: { baseRef: string; all: boolean }): string[] {
  if (options.all) {
    return []
  }

  let rawOutput: string
  try {
    rawOutput = execFileSync('git', ['diff', '--name-only', options.baseRef, 'HEAD'], {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim()
  } catch {
    // Fall back to working tree status when base ref is unavailable
    try {
      const statusRaw = execFileSync('git', ['status', '--porcelain'], {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      rawOutput = statusRaw
        .split('\n')
        .filter(Boolean)
        .map((line) => line.slice(3))
        .join('\n')
    } catch (statusErr) {
      console.error('[gitnexus-context] git is unavailable:', statusErr)
      process.exit(1)
    }
  }

  return rawOutput
    .split('\n')
    .map((f) => f.trim())
    .filter(Boolean)
    .sort()
}

/**
 * Map changed file paths to their parent module paths using prefix matching.
 */
export function mapFilesToModules(files: string[], brainModules: string[]): string[] {
  const moduleSet = new Set<string>()
  for (const file of files) {
    for (const mod of brainModules) {
      if (file.startsWith(`${mod}/`) || file === mod) {
        moduleSet.add(mod)
        break
      }
    }
  }
  return [...moduleSet].sort()
}

/**
 * Build the dependency subgraph for the given set of impacted modules.
 * In 'changed-only' mode the graph is scoped to impacted modules.
 * In 'full' mode all modules from brain.dependencies are included.
 */
export function buildDependencyGraph(
  modules: string[],
  brain: ArchitectureBrain,
  full: boolean
): Record<string, string[]> {
  const graph: Record<string, string[]> = {}
  const targetModules = full ? brain.modules : modules

  for (const mod of targetModules) {
    const deps = brain.dependencies[mod] ?? []
    graph[mod] = [...deps].sort()
  }

  // Sort keys for determinism
  return Object.fromEntries(Object.entries(graph).sort(([a], [b]) => a.localeCompare(b)))
}

/**
 * Map each module to its architecture layer using the brain's layer definitions.
 */
export function buildArchitectureLayerMap(
  modules: string[],
  brain: ArchitectureBrain,
  full: boolean
): Record<string, string> {
  const map: Record<string, string> = {}
  const targetModules = full ? brain.modules : modules

  for (const mod of targetModules) {
    map[mod] = brain.layers[mod] ?? 'unknown'
  }

  return Object.fromEntries(Object.entries(map).sort(([a], [b]) => a.localeCompare(b)))
}

/**
 * Extract recent git commit history (up to 10 commits, newest first).
 */
export function extractGitHistory(): RecentCommit[] {
  let rawLog: string
  try {
    rawLog = execFileSync('git', ['log', '--format=%H|%s|%an|%aI', '-10'], {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim()
  } catch (err) {
    console.error('[gitnexus-context] Failed to read git log:', err)
    return []
  }

  return rawLog
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [hash, message, author, date] = line.split('|')
      return { hash: hash ?? '', message: message ?? '', author: author ?? '', date: date ?? '' }
    })
}

/**
 * Compute risk indicators for the impacted modules.
 * Scoring heuristics:
 *   - Modules in brain hotspots: base score from hotspot.score
 *   - Number of changed files in the module: +5 per file (capped at 40)
 *   - Modules with no outbound dependencies: +10 (likely foundational)
 */
export function computeRiskIndicators(
  modules: string[],
  brain: ArchitectureBrain,
  changedFiles: string[]
): RiskIndicator[] {
  const hotspotMap = new Map<string, number>()
  for (const h of brain.hotspots ?? []) {
    hotspotMap.set(h.module, h.score)
  }

  const indicators: RiskIndicator[] = modules.map((mod) => {
    const filesInModule = changedFiles.filter((f) => f.startsWith(`${mod}/`))
    const hotspotBase = hotspotMap.get(mod) ?? 0
    const fileBonus = Math.min(filesInModule.length * 5, 40)
    const noDepsBonus = (brain.dependencies[mod]?.length ?? 0) === 0 ? 10 : 0
    const rawScore = hotspotBase + fileBonus + noDepsBonus
    const riskScore = Math.min(Math.round(rawScore), 100)

    const reasons: string[] = []
    if (hotspotBase > 0) reasons.push(`architectural hotspot (score ${hotspotBase})`)
    if (filesInModule.length > 0) reasons.push(`${filesInModule.length} changed file(s)`)
    if (noDepsBonus > 0) reasons.push('foundational module with no outbound dependencies')

    return {
      module: mod,
      riskScore,
      reason: reasons.length > 0 ? reasons.join('; ') : 'no specific risk factors detected',
      affectedBy: filesInModule.sort(),
    }
  })

  // Sort by riskScore descending, then module name ascending for determinism
  return indicators.sort((a, b) => {
    if (b.riskScore !== a.riskScore) return b.riskScore - a.riskScore
    return a.module.localeCompare(b.module)
  })
}

/**
 * Check whether the gitnexus CLI is healthy and responding.
 */
export function checkGitNexusHealth(): { healthy: boolean; status: string } {
  try {
    const output = execFileSync('gitnexus', ['status'], {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 10000,
    }).trim()
    return { healthy: true, status: output }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { healthy: false, status: msg }
  }
}

/**
 * Load and parse the ai-architecture-brain.json file.
 */
function loadBrain(): ArchitectureBrain {
  if (!existsSync(BRAIN_PATH)) {
    console.error('[gitnexus-context] ai-architecture-brain.json not found.')
    console.error('[gitnexus-context] Run: bun run arch:audit')
    process.exit(1)
  }

  let raw: string
  try {
    raw = readFileSync(BRAIN_PATH, 'utf-8')
  } catch (err) {
    console.error('[gitnexus-context] Failed to read ai-architecture-brain.json:', err)
    process.exit(1)
  }

  try {
    return JSON.parse(raw) as ArchitectureBrain
  } catch (err) {
    console.error('[gitnexus-context] Failed to parse ai-architecture-brain.json:', err)
    process.exit(1)
  }
}

/**
 * Assemble the full GitNexusContext object from all data sources.
 */
export function assembleContext(options: AssembleOptions): GitNexusContext {
  const brain = loadBrain()

  const changedFiles = detectChangedFiles({ baseRef: options.baseRef, all: options.all })
  const impactedModules = options.all
    ? [...brain.modules].sort()
    : mapFilesToModules(changedFiles, brain.modules)

  const analysisMode: 'changed-only' | 'full' = options.all ? 'full' : 'changed-only'

  const dependencyGraph = buildDependencyGraph(impactedModules, brain, options.all)
  const architectureLayerMap = buildArchitectureLayerMap(impactedModules, brain, options.all)
  const recentCommits = extractGitHistory()
  const riskIndicators = computeRiskIndicators(impactedModules, brain, changedFiles)

  return {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    analysisMode,
    changedFiles,
    impactedModules,
    dependencyGraph,
    architectureLayerMap,
    recentCommits,
    riskIndicators,
  }
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

export function main(): void {
  const args = process.argv.slice(2)

  const changedFilesOnly = args.includes('--changed-files-only')
  const dryRun = args.includes('--dry-run')
  const all = args.includes('--all')

  const outputArgIdx = args.indexOf('--output')
  const rawOutput =
    outputArgIdx !== -1 && args[outputArgIdx + 1] ? (args[outputArgIdx + 1] as string) : null
  const outputPath = rawOutput ? sanitizeOutputPath(rawOutput) : DEFAULT_OUTPUT

  const baseRefArgIdx = args.indexOf('--base-ref')
  const rawBaseRef =
    baseRefArgIdx !== -1 && args[baseRefArgIdx + 1] ? (args[baseRefArgIdx + 1] as string) : 'HEAD~1'
  const baseRef = sanitizeRef(rawBaseRef)

  const options: AssembleOptions = {
    changedFilesOnly,
    dryRun,
    output: outputPath,
    all,
    baseRef,
  }

  const context = assembleContext(options)

  if (dryRun) {
    process.stdout.write(`${JSON.stringify(context, null, 2)}\n`)
    return
  }

  const outputDir = dirname(outputPath)
  if (!existsSync(outputDir)) {
    try {
      mkdirSync(outputDir, { recursive: true })
    } catch (err) {
      console.error(`[gitnexus-context] Failed to create output directory "${outputDir}":`, err)
      process.exit(1)
    }
  }

  try {
    writeFileSync(outputPath, JSON.stringify(context))
  } catch (err) {
    console.error(`[gitnexus-context] Failed to write output to "${outputPath}":`, err)
    process.exit(1)
  }

  const health = checkGitNexusHealth()
  if (!health.healthy) {
    console.error('[gitnexus-context] Warning: gitnexus CLI health check failed:', health.status)
  }

  process.stdout.write(
    `[gitnexus-context] Context written to ${outputPath} (${context.impactedModules.length} impacted modules, ${context.changedFiles.length} changed files)\n`
  )
}

if (import.meta.main) {
  main()
}
