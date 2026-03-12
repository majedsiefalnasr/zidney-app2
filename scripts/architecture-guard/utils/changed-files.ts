import { execSync } from 'node:child_process'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

export interface ChangedFilesResult {
  changedFiles: string[]
  source: 'env' | 'staged' | 'head' | 'none'
}

function commandOutput(command: string): string {
  try {
    return execSync(command, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] })
  } catch {
    return ''
  }
}

function sanitizeFiles(lines: string[]): string[] {
  return lines
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((file) => /\.(ts|tsx|js|jsx|vue|json|md)$/i.test(file))
}

export function discoverChangedFiles(): ChangedFilesResult {
  const stagedEnv = (process.env.STAGED_FILES ?? '').trim()
  if (stagedEnv.length > 0) {
    return {
      changedFiles: sanitizeFiles(stagedEnv.split('\n')),
      source: 'env',
    }
  }

  const staged = sanitizeFiles(commandOutput('git diff --cached --name-only').split('\n'))
  if (staged.length > 0) {
    return {
      changedFiles: staged,
      source: 'staged',
    }
  }

  const head = sanitizeFiles(commandOutput('git diff --name-only HEAD~1..HEAD').split('\n'))
  if (head.length > 0) {
    return {
      changedFiles: head,
      source: 'head',
    }
  }

  return {
    changedFiles: [],
    source: 'none',
  }
}

function walk(dirPath: string, output: string[]): void {
  const entries = readdirSync(dirPath, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    const full = join(dirPath, entry.name)
    if (entry.isDirectory()) {
      walk(full, output)
      continue
    }
    if (/\.(ts|tsx|js|jsx|vue)$/i.test(entry.name)) {
      output.push(full)
    }
  }
}

export function discoverGovernedFiles(repoRoot: string): string[] {
  const output: string[] = []
  for (const root of ['apps', 'packages']) {
    const path = join(repoRoot, root)
    if (!existsSync(path) || !statSync(path).isDirectory()) {
      continue
    }
    walk(path, output)
  }
  return output.map((file) => file.replace(`${repoRoot}/`, '')).sort((a, b) => a.localeCompare(b))
}

export function moduleFromPath(filePath: string): string | null {
  const normalized = filePath.replace(/\\/g, '/')
  if (normalized.startsWith('apps/')) {
    const [, moduleName] = normalized.split('/')
    return moduleName ? `apps/${moduleName}` : null
  }
  if (normalized.startsWith('packages/')) {
    const [, moduleName] = normalized.split('/')
    return moduleName ? `packages/${moduleName}` : null
  }
  return null
}
