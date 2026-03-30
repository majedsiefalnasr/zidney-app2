/**
 * Policy Engine — Context Loader
 *
 * Assembles the PolicyContext object from controlled local sources.
 * All assembly steps that are independent run in parallel.
 *
 * Steps:
 * 1. changedFiles — git diff --name-only HEAD
 * 2. dependencyGraph — docs/ai/context/gitnexus-context.json
 * 3. scripts — root package.json scripts field
 * 4. vulnerabilities — tmp/trivy-report.json (optional)
 * 5. existingScriptPaths — Bun.Glob scan of scripts/
 * 6. documentedScriptNames — docs/scripts/*.md filenames (stem = name)
 *
 * @module scripts/policy-engine/context/loader
 * @library-module
 */

import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createLogger } from '../../utils/logger'
import type {
  ContextLoadResult,
  ContextWarning,
  DependencyGraph,
  PolicyContext,
  TrivyVulnerability,
} from '../types'

const logger = createLogger('policy-engine:loader')

const __dir = (import.meta as { dir?: string }).dir ?? fileURLToPath(new URL('.', import.meta.url))
const REPO_ROOT = join(__dir, '../../..')
const GITNEXUS_PATH = join(REPO_ROOT, 'docs/ai/context/gitnexus-context.json')
const PACKAGE_JSON_PATH = join(REPO_ROOT, 'package.json')
const TRIVY_PATH = join(REPO_ROOT, 'tmp/trivy-report.json')
const SCRIPTS_DIR = join(REPO_ROOT, 'scripts')
const SCRIPTS_DOCS_DIR = join(REPO_ROOT, 'docs/scripts')

function getMaxAgeHours(): number {
  const envVal = process.env.GITNEXUS_MAX_AGE_HOURS
  if (envVal) {
    const parsed = Number(envVal)
    if (!Number.isNaN(parsed) && parsed > 0) return parsed
  }
  return 24
}

async function loadChangedFiles(): Promise<{
  changedFiles: string[]
  gitUnavailable: boolean
}> {
  try {
    const result = Bun.spawnSync(['git', 'diff', '--name-only', 'HEAD'], {
      cwd: REPO_ROOT,
    })

    if (result.exitCode !== 0) {
      logger.warn('git diff failed — falling back to full mode', {
        exitCode: result.exitCode,
      })
      return { changedFiles: [], gitUnavailable: true }
    }

    const stdout = new TextDecoder().decode(result.stdout)
    const changedFiles = stdout
      .split('\n')
      .map((f) => f.trim())
      .filter(Boolean)

    return { changedFiles, gitUnavailable: false }
  } catch (err) {
    logger.warn('git command unavailable — falling back to full mode', {
      error: String(err),
    })
    return { changedFiles: [], gitUnavailable: true }
  }
}

async function loadDependencyGraph(): Promise<{
  graph: DependencyGraph | null
  warning: ContextWarning | null
}> {
  try {
    const file = Bun.file(GITNEXUS_PATH)
    const exists = await file.exists()

    if (!exists) {
      return {
        graph: null,
        warning: {
          code: 'GITNEXUS_MISSING',
          message:
            'docs/ai/context/gitnexus-context.json not found — dependency graph unavailable. Run: bun run arch:gitnexus:context',
        },
      }
    }

    let rawData: unknown
    try {
      rawData = await file.json()
    } catch {
      return {
        graph: null,
        warning: {
          code: 'GITNEXUS_MALFORMED',
          message:
            'gitnexus-context.json is not valid JSON — ignoring dependency graph. Run: bun run arch:gitnexus:context',
        },
      }
    }

    const data = rawData as Record<string, unknown>
    const analyzedAt = data.analyzedAt as string | undefined

    if (!analyzedAt) {
      return {
        graph: null,
        warning: {
          code: 'GITNEXUS_MALFORMED',
          message: 'gitnexus-context.json is missing analyzedAt field — ignoring dependency graph.',
        },
      }
    }

    const maxAgeMs = getMaxAgeHours() * 60 * 60 * 1000
    const analyzedAtMs = new Date(analyzedAt).getTime()
    const ageMs = Date.now() - analyzedAtMs

    if (ageMs > maxAgeMs) {
      logger.warn('GitNexus context is stale', {
        analyzedAt,
        ageHours: (ageMs / (60 * 60 * 1000)).toFixed(1),
        maxAgeHours: getMaxAgeHours(),
      })
      return {
        graph: null,
        warning: {
          code: 'GITNEXUS_STALE',
          message: `gitnexus-context.json is stale (analyzed ${new Date(analyzedAt).toISOString()}, max age ${getMaxAgeHours()}h). Run: bun run arch:gitnexus:context`,
        },
      }
    }

    return { graph: data as unknown as DependencyGraph, warning: null }
  } catch (err) {
    logger.warn('Failed to load GitNexus context', { error: String(err) })
    return {
      graph: null,
      warning: {
        code: 'GITNEXUS_MISSING',
        message: `Failed to load gitnexus-context.json: ${String(err)}`,
      },
    }
  }
}

async function loadScripts(): Promise<Record<string, string>> {
  try {
    const file = Bun.file(PACKAGE_JSON_PATH)
    const data = (await file.json()) as Record<string, unknown>
    const scripts = data.scripts
    if (scripts && typeof scripts === 'object') {
      return scripts as Record<string, string>
    }
  } catch (err) {
    logger.warn('Failed to load root package.json scripts', { error: String(err) })
  }
  return {}
}

async function loadVulnerabilities(): Promise<TrivyVulnerability[] | undefined> {
  try {
    const file = Bun.file(TRIVY_PATH)
    const exists = await file.exists()
    if (!exists) return undefined

    const data = (await file.json()) as unknown
    if (Array.isArray(data)) {
      return data as TrivyVulnerability[]
    }

    // Trivy JSON report can be nested: { Results: [{ Vulnerabilities: [...] }] }
    const report = data as Record<string, unknown>
    const results = report.Results as Array<Record<string, unknown>> | undefined
    if (results) {
      const vulns: TrivyVulnerability[] = []
      for (const result of results) {
        const vulnerabilities = result.Vulnerabilities as Array<Record<string, unknown>> | undefined
        if (vulnerabilities) {
          for (const v of vulnerabilities) {
            vulns.push({
              vulnerabilityId: String(v.VulnerabilityID ?? ''),
              packageName: String(v.PkgName ?? ''),
              installedVersion: String(v.InstalledVersion ?? ''),
              fixedVersion: v.FixedVersion ? String(v.FixedVersion) : undefined,
              severity: (v.Severity ?? 'UNKNOWN') as TrivyVulnerability['severity'],
              description: v.Description ? String(v.Description) : undefined,
              target: v.Target ? String(v.Target) : undefined,
            })
          }
        }
      }
      return vulns
    }
  } catch {
    // Trivy report is optional in dev — no error
  }
  return undefined
}

async function loadExistingScriptPaths(): Promise<string[]> {
  try {
    const glob = new Bun.Glob('**/*')
    const paths: string[] = []
    for await (const file of glob.scan({ cwd: SCRIPTS_DIR, dot: true })) {
      // Return paths relative to repo root (scripts/...)
      paths.push(`scripts/${file}`)
    }
    return paths
  } catch (err) {
    logger.warn('Failed to scan scripts/ directory', { error: String(err) })
    return []
  }
}

async function loadDocumentedScriptNames(): Promise<string[]> {
  try {
    const glob = new Bun.Glob('*.md')
    const names: string[] = []
    for await (const file of glob.scan({ cwd: SCRIPTS_DOCS_DIR })) {
      // Strip .md extension to get script name
      names.push(file.replace(/\.md$/, ''))
    }
    return names
  } catch {
    // docs/scripts/ may not exist — return empty
    return []
  }
}

/**
 * Assemble the PolicyContext from controlled local sources.
 *
 * @param mode - 'changed' (git diff) or 'full' (entire repo)
 * @param timeout - Timeout in milliseconds for the engine invocation
 */
export async function loadContext(
  mode: 'changed' | 'full',
  timeout: number
): Promise<ContextLoadResult> {
  const warnings: ContextWarning[] = []

  // Run all independent assembly steps in parallel
  const [
    changedFilesResult,
    dependencyGraphResult,
    scripts,
    vulnerabilities,
    existingScriptPaths,
    documentedScriptNames,
  ] = await Promise.all([
    loadChangedFiles(),
    loadDependencyGraph(),
    loadScripts(),
    loadVulnerabilities(),
    loadExistingScriptPaths(),
    loadDocumentedScriptNames(),
  ])

  // Process git result
  let resolvedMode = mode
  if (changedFilesResult.gitUnavailable) {
    warnings.push({
      code: 'GIT_UNAVAILABLE',
      message:
        'git is unavailable or returned non-zero exit — changedFiles is empty. Engine will run in full mode.',
    })
    resolvedMode = 'full'
  }

  // Process dependency graph result
  if (dependencyGraphResult.warning) {
    warnings.push(dependencyGraphResult.warning)
  }

  const context: PolicyContext = {
    mode: resolvedMode,
    timeout,
    changedFiles: changedFilesResult.changedFiles,
    dependencyGraph: dependencyGraphResult.graph,
    scripts,
    vulnerabilities,
    existingScriptPaths,
    documentedScriptNames,
  }

  logger.debug('Context loaded', {
    mode: context.mode,
    changedFiles: context.changedFiles.length,
    hasDependencyGraph: context.dependencyGraph !== null,
    scriptsCount: Object.keys(context.scripts ?? {}).length,
    existingScriptPaths: existingScriptPaths.length,
    documentedScriptNames: documentedScriptNames.length,
    warnings: warnings.length,
  })

  return { context, warnings }
}
