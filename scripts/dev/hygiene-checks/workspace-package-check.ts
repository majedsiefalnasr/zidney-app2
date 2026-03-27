/**
 * T006 — Workspace Package Validation
 * Checks that every package under packages/ is consumed by at least one app.
 
 * @library-module
*/

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { TaskFinding, TaskResult } from './types.ts'

const _ROOT = process.cwd()
const PACKAGES_DIR = join(ROOT, 'packages')
const APPS_DIR = join(ROOT, 'apps')

interface PackageInfo {
  dirName: string
  packageName: string
}

function getPackages(): PackageInfo[] {
  if (!existsSync(PACKAGES_DIR)) return []

  const result: PackageInfo[] = []
  try {
    const entries = readdirSync(PACKAGES_DIR, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const pkgPath = join(PACKAGES_DIR, entry.name, 'package.json')
      if (!existsSync(pkgPath)) continue

      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
        result.push({
          dirName: entry.name,
          packageName: (pkg.name as string | undefined) ?? `@zidney/${entry.name}`,
        })
      } catch {
        // skip malformed
      }
    }
  } catch {
    // ignore
  }
  return result
}

function findSourceFiles(dir: string, maxDepth = 5, depth = 0): string[] {
  if (depth > maxDepth || !existsSync(dir)) return []

  try {
    const entries = readdirSync(dir, { withFileTypes: true })
    const files: string[] = []

    for (const entry of entries) {
      const fullPath = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (['node_modules', 'dist', '.nuxt', '.output'].includes(entry.name)) continue
        files.push(...findSourceFiles(fullPath, maxDepth, depth + 1))
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

function hasConsumer(pkgInfo: PackageInfo, appDirs: string[]): boolean {
  const { packageName } = pkgInfo
  const escapedName = packageName.replace(/[/\\^$*+?.()|[\]{}]/g, '\\$&')
  const importPattern = new RegExp(`from\\s+['"]${escapedName}|require\\(['"]${escapedName}`, 'i')

  for (const appDir of appDirs) {
    // 1. Check package.json dependency entries
    const pkgJsonPath = join(appDir, 'package.json')
    if (existsSync(pkgJsonPath)) {
      try {
        const content = readFileSync(pkgJsonPath, 'utf-8')
        if (content.includes(`"${packageName}"`)) return true
      } catch {
        // ignore
      }
    }

    // 2. Check source files for import statements
    const srcDir = join(appDir, 'src')
    const sourceFiles = findSourceFiles(existsSync(srcDir) ? srcDir : appDir)
    for (const file of sourceFiles) {
      try {
        const content = readFileSync(file, 'utf-8')
        if (importPattern.test(content)) return true
      } catch {}
    }
  }

  return false
}

export async function runWorkspacePackageCheck(): Promise<TaskResult> {
  const findings: TaskFinding[] = []
  const packages = getPackages()

  if (packages.length === 0) {
    return {
      taskId: 'T005',
      title: 'Workspace Package Validation',
      status: 'PASS',
      summary: 'No packages found under packages/ (nothing to check)',
      findings: [],
    }
  }

  const appDirs: string[] = []
  if (existsSync(APPS_DIR)) {
    try {
      const entries = readdirSync(APPS_DIR, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.isDirectory()) {
          appDirs.push(join(APPS_DIR, entry.name))
        }
      }
    } catch {
      // ignore
    }
  }

  const active: string[] = []
  const orphaned: string[] = []

  for (const pkg of packages) {
    if (hasConsumer(pkg, appDirs)) {
      active.push(pkg.packageName)
    } else {
      orphaned.push(pkg.packageName)
      findings.push({
        item: pkg.packageName,
        note: `ORPHANED — no import or dependency entry found in any apps/ workspace`,
      })
    }
  }

  const status = findings.length === 0 ? 'PASS' : 'FLAG'
  const summary =
    findings.length === 0
      ? `All ${packages.length} workspace packages have at least one app consumer`
      : `${orphaned.length} orphaned package(s) found: ${orphaned.join(', ')}`

  return {
    taskId: 'T005',
    title: 'Workspace Package Validation',
    status,
    summary,
    findings,
  }
}
