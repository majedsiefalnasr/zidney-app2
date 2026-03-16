/**
 * T004 — Dead Script Detection
 * Enumerates all *.ts and *.sh under scripts/; classifies each as
 * ACTIVE, DUPLICATE_ROOT_STUB, or POTENTIALLY_DEAD.
 * Reports only — no deletions.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { basename, join, relative } from 'node:path'
import type { TaskFinding, TaskResult } from './types.ts'

const ROOT = process.cwd()
const SCRIPTS_DIR = join(ROOT, 'scripts')

function findScripts(dir: string, maxDepth = 8, depth = 0): string[] {
  if (depth > maxDepth || !existsSync(dir)) return []

  try {
    const entries = readdirSync(dir, { withFileTypes: true })
    const result: string[] = []

    for (const entry of entries) {
      const fullPath = join(dir, entry.name)

      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === 'dist') continue
        result.push(...findScripts(fullPath, maxDepth, depth + 1))
      } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.sh')) {
        result.push(fullPath)
      }
    }
    return result
  } catch {
    return []
  }
}

function buildReferenceCorpus(): string {
  const parts: string[] = []

  // 1. Root package.json scripts
  try {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'))
    const scriptValues = Object.values(pkg.scripts as Record<string, string>).join('\n')
    parts.push(scriptValues)
  } catch {
    // ignore
  }

  // 2. GitHub workflow run: blocks
  const workflowsDir = join(ROOT, '.github', 'workflows')
  if (existsSync(workflowsDir)) {
    try {
      const files = readdirSync(workflowsDir).filter(
        (f) => f.endsWith('.yml') || f.endsWith('.yaml')
      )
      for (const file of files) {
        try {
          parts.push(readFileSync(join(workflowsDir, file), 'utf-8'))
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    }
  }

  // 3. Markdown docs + AGENTS.md
  function walkDocs(dir: string, maxDepth = 6, depth = 0): void {
    if (depth > maxDepth || !existsSync(dir)) return
    try {
      const entries = readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = join(dir, entry.name)
        if (entry.isDirectory()) {
          if (entry.name === 'node_modules') continue
          walkDocs(fullPath, maxDepth, depth + 1)
        } else if (entry.name.endsWith('.md')) {
          try {
            parts.push(readFileSync(fullPath, 'utf-8'))
          } catch {
            // ignore
          }
        }
      }
    } catch {
      // ignore
    }
  }

  walkDocs(join(ROOT, 'docs'))
  walkDocs(join(ROOT, 'specs'))

  try {
    parts.push(readFileSync(join(ROOT, 'AGENTS.md'), 'utf-8'))
  } catch {
    // ignore
  }

  // apps/*/AGENTS.md
  const appsDir = join(ROOT, 'apps')
  if (existsSync(appsDir)) {
    try {
      const appDirs = readdirSync(appsDir, { withFileTypes: true }).filter((d) => d.isDirectory())
      for (const appDir of appDirs) {
        const agentsMd = join(appsDir, appDir.name, 'AGENTS.md')
        if (existsSync(agentsMd)) {
          try {
            parts.push(readFileSync(agentsMd, 'utf-8'))
          } catch {
            // ignore
          }
        }
      }
    } catch {
      // ignore
    }
  }

  // 4. Shell script invocations
  const allScriptFiles = findScripts(SCRIPTS_DIR)
  for (const scriptFile of allScriptFiles) {
    if (scriptFile.endsWith('.sh')) {
      try {
        parts.push(readFileSync(scriptFile, 'utf-8'))
      } catch {
        // ignore
      }
    }
  }

  return parts.join('\n')
}

function isReferenced(script: string, corpus: string): boolean {
  const rel = relative(ROOT, script) // e.g. scripts/infra-audit.ts
  const base = basename(script) // e.g. infra-audit.ts
  const noExt = base.replace(/\.(ts|sh)$/, '') // e.g. infra-audit

  return (
    corpus.includes(rel) ||
    corpus.includes(base) ||
    corpus.includes(noExt) ||
    // Check for common reference patterns like "scripts/infra-audit"
    corpus.includes(`scripts/${noExt}`)
  )
}

export async function runDeadScriptCheck(): Promise<TaskResult> {
  const findings: TaskFinding[] = []

  if (!existsSync(SCRIPTS_DIR)) {
    return {
      taskId: 'T003',
      title: 'Dead Script Detection',
      status: 'PASS',
      summary: 'scripts/ directory not found (nothing to check)',
      findings: [],
    }
  }

  const allScripts = findScripts(SCRIPTS_DIR)
  const corpus = buildReferenceCorpus()

  // Build basename → paths map to detect duplicate root stubs
  const baseToSubdirPaths = new Map<string, string[]>()
  for (const script of allScripts) {
    const rel = relative(SCRIPTS_DIR, script)
    // Only consider files NOT in root (those in subdirs)
    if (rel.includes('/')) {
      const base = basename(script)
      const existing = baseToSubdirPaths.get(base) ?? []
      existing.push(rel)
      baseToSubdirPaths.set(base, existing)
    }
  }

  const active: string[] = []
  const duplicateRootStubs: Array<{ root: string; subdirCounterpart: string }> = []
  const potentiallyDead: string[] = []

  for (const script of allScripts) {
    const rel = relative(ROOT, script)
    const relToScripts = relative(SCRIPTS_DIR, script)
    const isRootLevel = !relToScripts.includes('/')
    const base = basename(script)

    if (isRootLevel && baseToSubdirPaths.has(base)) {
      // Root-level file shares basename with a subdirectory version
      const subdirPaths = baseToSubdirPaths.get(base) ?? []
      // Check whether the root stub is also referenced — it might still be ACTIVE
      if (isReferenced(script, corpus)) {
        duplicateRootStubs.push({
          root: relToScripts,
          subdirCounterpart: subdirPaths[0] ?? '',
        })
        active.push(rel) // Still mark as active since it IS referenced
      } else {
        duplicateRootStubs.push({
          root: relToScripts,
          subdirCounterpart: subdirPaths[0] ?? '',
        })
      }
    } else if (isReferenced(script, corpus)) {
      active.push(rel)
    } else {
      potentiallyDead.push(rel)
    }
  }

  // Build findings
  for (const stub of duplicateRootStubs) {
    findings.push({
      item: `scripts/${stub.root}`,
      note: `DUPLICATE_ROOT_STUB — root-level file shares basename with scripts/${stub.subdirCounterpart} (flagged for human review)`,
    })
  }

  for (const dead of potentiallyDead) {
    findings.push({
      item: dead,
      note: 'POTENTIALLY_DEAD — not referenced in package.json, workflows, docs, or shell scripts (flagged for human review)',
    })
  }

  const status = findings.length === 0 ? 'PASS' : 'FLAG'
  const summary = `${allScripts.length} scripts scanned: ${active.length} active, ${duplicateRootStubs.length} duplicate-root-stubs, ${potentiallyDead.length} potentially dead`

  return {
    taskId: 'T003',
    title: 'Dead Script Detection',
    status,
    summary,
    findings,
    rawOutput: `Active: ${active.length}\nDuplicate Root Stubs: ${duplicateRootStubs.length}\nPotentially Dead: ${potentiallyDead.length}`,
  }
}
