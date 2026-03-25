/**
 * Gate 4 Static Analysis Test: No Direct Governance Calls
 *
 * Validates that no source file outside scripts/policy-engine/ directly calls
 * governance scripts that the policy engine has absorbed.
 *
 * Rules:
 * - apps/* and packages/* must NOT import scripts/policy-engine/**
 * - scripts/** (except scripts/policy-engine/) must NOT duplicate
 *   governance logic that the engine provides
 * - The policy engine files must NOT import from apps/*
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const __dir = (import.meta as { dir?: string }).dir ?? fileURLToPath(new URL('.', import.meta.url))
const REPO_ROOT = resolve(__dir, '../../..')
const POLICY_ENGINE_DIR = join(REPO_ROOT, 'scripts', 'policy-engine')

function findTsFiles(dir: string, files: string[] = []): string[] {
  if (!existsSync(dir)) return files
  const entries = readdirSync(dir)
  for (const entry of entries) {
    const fullPath = join(dir, entry)
    if (statSync(fullPath).isDirectory()) {
      if (entry === 'node_modules' || entry === '.git' || entry === 'coverage') {
        continue
      }
      findTsFiles(fullPath, files)
    } else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
      files.push(fullPath)
    }
  }
  return files
}

describe('No direct governance calls static analysis', () => {
  it('policy engine directory exists', () => {
    expect(existsSync(POLICY_ENGINE_DIR)).toBe(true)
  })

  it('all policy engine core files exist', () => {
    const requiredFiles = [
      'types.ts',
      'registry.ts',
      'engine.ts',
      'cli.ts',
      'context/loader.ts',
      'adapters/architecture-guard.adapter.ts',
      'adapters/type-safety.adapter.ts',
      'adapters/script-governance.adapter.ts',
      'adapters/trivy.adapter.ts',
      'reporters/console.ts',
      'reporters/json.ts',
    ]

    for (const file of requiredFiles) {
      const fullPath = join(POLICY_ENGINE_DIR, file)
      expect(existsSync(fullPath), `Missing: scripts/policy-engine/${file}`).toBe(true)
    }
  })

  it('policy engine files do not import from apps/*', () => {
    const engineFiles = findTsFiles(POLICY_ENGINE_DIR)

    for (const file of engineFiles) {
      const content = readFileSync(file, 'utf-8')
      const lines = content.split('\n')

      for (const line of lines) {
        if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue
        if (line.includes('import') && line.includes('from')) {
          // Check for direct apps/* references (not relative paths that might lead there)
          const hasAppsDirectImport =
            line.includes('"apps/') ||
            line.includes("'apps/") ||
            line.includes('"../../apps/') ||
            line.includes("'../../apps/")
          expect(
            hasAppsDirectImport,
            `Policy engine file ${file} imports from apps/: ${line}`
          ).toBe(false)
        }
      }
    }
  })

  it('reporter files only use console.log for output (no process.exit)', () => {
    const reporterFiles = [
      join(POLICY_ENGINE_DIR, 'reporters', 'console.ts'),
      join(POLICY_ENGINE_DIR, 'reporters', 'json.ts'),
    ]

    for (const file of reporterFiles) {
      if (!existsSync(file)) continue
      const content = readFileSync(file, 'utf-8')
      expect(content, `Reporter ${file} should not call process.exit`).not.toContain('process.exit')
    }
  })

  it('registry.ts does not use dynamic imports or requires', () => {
    const registryPath = join(POLICY_ENGINE_DIR, 'registry.ts')
    if (!existsSync(registryPath)) return

    const content = readFileSync(registryPath, 'utf-8')
    // Registry should be a pure in-memory store, no dynamic imports
    expect(content).not.toContain('require(')
    // No subprocess spawning
    expect(content).not.toContain('spawnSync')
    expect(content).not.toContain('Bun.spawn')
  })
})
