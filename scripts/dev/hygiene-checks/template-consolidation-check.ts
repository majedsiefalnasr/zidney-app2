/**
 * T003 — Template System Consolidation Check
 * Scans for legacy .specify/templates/ path references across key surfaces.
 * Checks template parity gap between legacy and canonical roots.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { TaskFinding, TaskResult } from './types.ts'

const ROOT = process.cwd()
const LEGACY_TEMPLATE_ROOT = join(ROOT, '.specify', 'templates')
const CANONICAL_TEMPLATE_ROOT = join(ROOT, 'specs', 'templates')
const LEGACY_PATH_FRAGMENT = '.specify/templates/'

// Surfaces to scan for legacy path references
const SCAN_ROOTS = [
  join(ROOT, '.specify', 'scripts', 'bash'),
  join(ROOT, '.github', 'workflows'),
  join(ROOT, 'docs'),
  join(ROOT, 'AGENTS.md'),
]

const APP_AGENTS_GLOB = join(ROOT, 'apps')

function findFiles(dir: string, extensions: string[], maxDepth = 10, depth = 0): string[] {
  if (depth > maxDepth || !existsSync(dir)) return []

  try {
    const entries = readdirSync(dir, { withFileTypes: true })
    const files: string[] = []

    for (const entry of entries) {
      if (entry.name.startsWith('.') && depth > 0) continue
      const fullPath = join(dir, entry.name)

      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') {
          continue
        }
        files.push(...findFiles(fullPath, extensions, maxDepth, depth + 1))
      } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
        files.push(fullPath)
      }
    }
    return files
  } catch {
    return []
  }
}

function scanForLegacyRefs(filePath: string): { file: string; line: number; text: string }[] {
  const matches: { file: string; line: number; text: string }[] = []
  try {
    const content = readFileSync(filePath, 'utf-8')
    const lines = content.split('\n')
    lines.forEach((line, i) => {
      if (line.includes(LEGACY_PATH_FRAGMENT)) {
        matches.push({ file: filePath.replace(`${ROOT}/`, ''), line: i + 1, text: line.trim() })
      }
    })
  } catch {
    // Skip unreadable files
  }
  return matches
}

export async function runTemplateConsolidationCheck(): Promise<TaskResult> {
  const findings: TaskFinding[] = []

  // 1. Collect files to scan
  const filesToScan: string[] = []

  for (const root of SCAN_ROOTS) {
    if (!existsSync(root)) continue

    if (root.endsWith('.md')) {
      filesToScan.push(root)
    } else {
      const exts = root.includes('bash')
        ? ['.sh']
        : root.includes('workflows')
          ? ['.yml', '.yaml']
          : ['.md', '.sh', '.yml']
      filesToScan.push(...findFiles(root, exts))
    }
  }

  // Add apps/*/AGENTS.md
  if (existsSync(APP_AGENTS_GLOB)) {
    const appDirs = readdirSync(APP_AGENTS_GLOB, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => join(APP_AGENTS_GLOB, d.name, 'AGENTS.md'))
      .filter((p) => existsSync(p))
    filesToScan.push(...appDirs)
  }

  // 2. Scan for legacy references
  const legacyConsumers: { file: string; line: number; text: string }[] = []
  for (const file of filesToScan) {
    legacyConsumers.push(...scanForLegacyRefs(file))
  }

  for (const ref of legacyConsumers) {
    findings.push({
      item: `${ref.file}:${ref.line}`,
      note: `Legacy template consumer: "${ref.text.substring(0, 120)}"`,
    })
  }

  // 3. Check template parity gap
  if (existsSync(LEGACY_TEMPLATE_ROOT) && existsSync(CANONICAL_TEMPLATE_ROOT)) {
    const legacyFiles = findFiles(LEGACY_TEMPLATE_ROOT, ['.md', '.txt', '.sh'], 3).map((f) =>
      f.replace(`${LEGACY_TEMPLATE_ROOT}/`, '')
    )
    const canonicalFiles = new Set(
      findFiles(CANONICAL_TEMPLATE_ROOT, ['.md', '.txt', '.sh'], 3).map((f) =>
        f.replace(`${CANONICAL_TEMPLATE_ROOT}/`, '')
      )
    )

    for (const legacyFile of legacyFiles) {
      if (!canonicalFiles.has(legacyFile)) {
        findings.push({
          item: `.specify/templates/${legacyFile}`,
          note: `Template parity gap — file exists in legacy root but not in specs/templates/`,
        })
      }
    }
  }

  const status = findings.length === 0 ? 'PASS' : 'FLAG'
  const summary =
    findings.length === 0
      ? 'No legacy template consumers detected and no parity gaps found'
      : `${legacyConsumers.length} legacy consumer(s) and ${findings.length - legacyConsumers.length} parity gap(s) found`

  return {
    taskId: 'T002',
    title: 'Template System Consolidation',
    status,
    summary,
    findings,
  }
}
