/**
 * T005 — Dependency Hygiene Check
 * Collects workspace roots; for each, identifies unused and duplicate deps.
 * Uses verify-dependency-usage.ts as subprocess for the root workspace (30s per-workspace timeout).
 *
 * verify-dependency-usage.ts subprocess output contract:
 *   stdout format: lines with "USED:" or "UNUSED:" prefix per dependency
 *   exit code 0: analysis complete (unused deps are STATUS: UNUSED in output)
 *   exit code non-zero: script error — fall back to direct source scan
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { TaskFinding, TaskResult } from './types.ts'

const ROOT = process.cwd()
const SUBPROCESS_TIMEOUT_MS = 30_000

interface WorkspaceInfo {
  root: string
  label: string
  pkgJson: Record<string, unknown>
  sourceDir: string
}

function getWorkspaces(): WorkspaceInfo[] {
  const workspaces: WorkspaceInfo[] = []

  function addWorkspace(root: string, label: string): void {
    const pkgPath = join(root, 'package.json')
    if (!existsSync(pkgPath)) return
    try {
      const pkgJson = JSON.parse(readFileSync(pkgPath, 'utf-8'))
      const sourceDir = existsSync(join(root, 'src')) ? join(root, 'src') : root
      workspaces.push({ root, label, pkgJson, sourceDir })
    } catch {
      // skip malformed package.json
    }
  }

  addWorkspace(ROOT, 'root')

  const packagesDir = join(ROOT, 'packages')
  if (existsSync(packagesDir)) {
    for (const entry of readdirSync(packagesDir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        addWorkspace(join(packagesDir, entry.name), `packages/${entry.name}`)
      }
    }
  }

  const appsDir = join(ROOT, 'apps')
  if (existsSync(appsDir)) {
    for (const entry of readdirSync(appsDir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        addWorkspace(join(appsDir, entry.name), `apps/${entry.name}`)
      }
    }
  }

  return workspaces
}

function collectSourceFiles(dir: string, maxDepth = 5, depth = 0): string[] {
  if (depth > maxDepth || !existsSync(dir)) return []

  try {
    const entries = readdirSync(dir, { withFileTypes: true })
    const files: string[] = []

    for (const entry of entries) {
      const fullPath = join(dir, entry.name)

      if (entry.isDirectory()) {
        if (['node_modules', 'dist', '.nuxt', '.output', 'build'].includes(entry.name)) continue
        files.push(...collectSourceFiles(fullPath, maxDepth, depth + 1))
      } else if (
        entry.name.endsWith('.ts') ||
        entry.name.endsWith('.tsx') ||
        entry.name.endsWith('.vue')
      ) {
        files.push(fullPath)
      }
    }
    return files
  } catch {
    return []
  }
}

function isPackageImported(
  pkgName: string,
  sourceFiles: string[],
  fallbackContent: string
): boolean {
  // Build import regex patterns for the package
  // Handle scoped packages (@org/pkg) and regular packages
  const escapedName = pkgName.replace(/[/\\^$*+?.()|[\]{}]/g, '\\$&')
  const importPattern = new RegExp(`from\\s+['"]${escapedName}|require\\(['"]${escapedName}`, 'i')

  // Check source files
  for (const file of sourceFiles) {
    try {
      const content = readFileSync(file, 'utf-8')
      if (importPattern.test(content)) return true
    } catch {}
  }

  // Fallback: broader text search in the workspace content
  return importPattern.test(fallbackContent)
}

async function runVerifyDependencySubprocess(workspaceRoot: string): Promise<string | null> {
  const scriptPath = join(ROOT, 'scripts', 'dev', 'verify-dependency-usage.ts')
  if (!existsSync(scriptPath)) return null

  try {
    const proc = Bun.spawn(['bun', scriptPath], {
      cwd: workspaceRoot,
      stdout: 'pipe',
      stderr: 'pipe',
    })

    const timeoutHandle = setTimeout(() => {
      proc.kill()
    }, SUBPROCESS_TIMEOUT_MS)

    const [exitCode, stdout] = await Promise.all([proc.exited, new Response(proc.stdout).text()])

    clearTimeout(timeoutHandle)

    if (exitCode === 0) {
      return stdout
    }
    return null
  } catch {
    return null
  }
}

function parseSubprocessOutput(output: string): Set<string> {
  const unused = new Set<string>()
  for (const line of output.split('\n')) {
    const trimmed = line.trim()
    // Output contract: lines with "UNUSED:" prefix or "Status: UNUSED" pattern
    if (trimmed.startsWith('UNUSED:') || trimmed.includes('Status: UNUSED')) {
      const match =
        trimmed.match(/UNUSED:\s*([^\s]+)/) ?? trimmed.match(/^([^\s]+).*Status: UNUSED/)
      if (match?.[1]) {
        unused.add(match[1])
      }
    }
  }
  return unused
}

export async function runDependencyHygieneCheck(): Promise<TaskResult> {
  const findings: TaskFinding[] = []
  const workspaces = getWorkspaces()

  // Track version conflicts: pkgName -> [version@workspace]
  const versionMap = new Map<string, string[]>()

  for (const ws of workspaces) {
    const pkg = ws.pkgJson
    const deps = {
      ...((pkg.dependencies as Record<string, string> | undefined) ?? {}),
      ...((pkg.devDependencies as Record<string, string> | undefined) ?? {}),
    }

    if (Object.keys(deps).length === 0) continue

    // Build fallback broad-search content (config files, md, scripts)
    let broadContent = ''
    try {
      const readIfExists = (p: string) => {
        try {
          return existsSync(p) ? readFileSync(p, 'utf-8') : ''
        } catch {
          return ''
        }
      }
      broadContent = [
        readIfExists(join(ws.root, 'package.json')),
        readIfExists(join(ws.root, 'README.md')),
        readIfExists(join(ws.root, 'vite.config.ts')),
        readIfExists(join(ws.root, 'vitest.config.ts')),
      ].join('\n')
    } catch {
      // ignore
    }

    const sourceFiles = collectSourceFiles(ws.sourceDir)

    // Try subprocess for root workspace
    let subprocessUnused: Set<string> | null = null
    if (ws.label === 'root') {
      const output = await runVerifyDependencySubprocess(ws.root)
      if (output !== null) {
        subprocessUnused = parseSubprocessOutput(output)
      }
    }

    for (const [pkgName, version] of Object.entries(deps)) {
      // Track for cross-workspace version comparison
      const key = pkgName
      const entry = `${version}@${ws.label}`
      const existing = versionMap.get(key) ?? []
      existing.push(entry)
      versionMap.set(key, existing)

      // Check if used
      let isUsed: boolean
      if (subprocessUnused !== null) {
        isUsed = !subprocessUnused.has(pkgName)
      } else {
        isUsed = isPackageImported(pkgName, sourceFiles, broadContent)
      }

      if (!isUsed) {
        findings.push({
          item: `${ws.label}: ${pkgName}`,
          note: `UNUSED — no import found in source files for ${pkgName} (advisory: verify before removal)`,
        })
      }
    }
  }

  // Check cross-workspace version conflicts
  for (const [pkgName, entries] of versionMap.entries()) {
    if (entries.length > 1) {
      const versions = new Set(entries.map((e) => e.split('@')[0]))
      if (versions.size > 1) {
        findings.push({
          item: pkgName,
          note: `DUPLICATE — different versions across workspaces: ${entries.join(', ')}`,
        })
      }
    }
  }

  const status = findings.length === 0 ? 'PASS' : 'FLAG'
  const unusedCount = findings.filter((f) => f.note.startsWith('UNUSED')).length
  const dupCount = findings.filter((f) => f.note.startsWith('DUPLICATE')).length
  const summary =
    findings.length === 0
      ? `All dependencies appear to be in use across ${workspaces.length} workspaces`
      : `${unusedCount} unused and ${dupCount} version-conflict(s) found across ${workspaces.length} workspaces (advisory)`

  return {
    taskId: 'T004',
    title: 'Dependency Hygiene',
    status,
    summary,
    findings,
  }
}
