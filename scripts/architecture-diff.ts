/**
 * @script arch:diff
 * @domain arch
 * @category governance
 * @description Detect architecture violations in the current change set (PR/staged diff) by comparing changed imports against ARCHITECTURE_CONTRACT.json rules.
 * @usage bun run arch:diff
 *
 * Zidney Architecture Diff Analyzer
 *
 * Purpose
 * -------
 * Detect architecture violations introduced in the current change set
 * (PR / staged diff) by comparing changed imports against the
 * ARCHITECTURE_CONTRACT.json rules.
 *
 * Used in CI to prevent architecture drift.
 * Support-surface routing authority remains governed separately by
 * docs/architecture/intelligence/ROUTING_AUTHORITY_REGISTRY.md.
 */

import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

type ArchitectureContract = {
  dependencyRules?: {
    forbidden?: Record<string, string[]>
  }
  layerRules?: {
    forbidden?: Record<string, string[]>
  }
}

const CONTRACT_PATH = 'docs/architecture/intelligence/ARCHITECTURE_CONTRACT.json'

function loadContract(): ArchitectureContract {
  const raw = readFileSync(CONTRACT_PATH, 'utf-8')
  return JSON.parse(raw)
}

/**
 * Get changed files in the current PR / diff.
 * Works locally and inside CI.
 */
function getChangedFiles(): string[] {
  try {
    const output = execSync('git diff --name-only origin/main...HEAD', {
      encoding: 'utf-8',
    })

    return output
      .split('\n')
      .map((f) => f.trim())
      .filter(Boolean)
      .filter((f) => f.endsWith('.ts') || f.endsWith('.tsx') || f.endsWith('.vue'))
  } catch {
    return []
  }
}

function extractImports(filePath: string): string[] {
  try {
    const content = readFileSync(filePath, 'utf-8')

    const importRegex = /import\s+(?:[\w*\s{},]+)\s+from\s+['"]([^'"]+)['"]/g

    const matches: string[] = []
    let match: RegExpExecArray | null = null

    while (true) {
      match = importRegex.exec(content)
      if (match === null) break
      matches.push(match[1])
    }

    return matches
  } catch {
    return []
  }
}

function detectModule(importPath: string): string | null {
  if (importPath.startsWith('@zidney/')) {
    return importPath.replace('@zidney/', '')
  }

  if (importPath.startsWith('packages/')) {
    return importPath.split('/')[1]
  }

  if (importPath.startsWith('apps/')) {
    return importPath.split('/')[1]
  }

  return null
}

function detectFileModule(file: string): string | null {
  if (file.startsWith('packages/')) {
    return file.split('/')[1]
  }

  if (file.startsWith('apps/')) {
    return file.split('/')[1]
  }

  return null
}

function validateDependencyRules(
  fileModule: string,
  imports: string[],
  rules?: Record<string, string[]>
): string[] {
  if (!rules) return []

  const violations: string[] = []

  const forbidden = rules[fileModule] || []

  for (const imp of imports) {
    const module = detectModule(imp)
    if (!module) continue

    if (forbidden.includes(module)) {
      violations.push(`Forbidden dependency: ${fileModule} → ${module}`)
    }
  }

  return violations
}

function runArchitectureDiff() {
  const contract = loadContract()

  const changedFiles = getChangedFiles()

  if (changedFiles.length === 0) {
    console.log('Architecture Diff: no changed files detected.')
    process.exit(0)
  }

  const violations: string[] = []

  for (const file of changedFiles) {
    const fileModule = detectFileModule(file)
    if (!fileModule) continue

    const imports = extractImports(file)

    const dependencyViolations = validateDependencyRules(
      fileModule,
      imports,
      contract.dependencyRules?.forbidden
    )

    violations.push(...dependencyViolations.map((v) => `${file}: ${v}`))
  }

  if (violations.length > 0) {
    console.error('\nArchitecture Diff: violations detected\n')

    for (const v of violations) {
      console.error(' -', v)
    }

    console.error('\nPR rejected due to architecture rule violations.')

    process.exit(1)
  }

  console.log('Architecture Diff: no violations detected.')
  console.log(
    'Architecture Diff: support-surface routing decisions must consult docs/architecture/intelligence/ROUTING_AUTHORITY_REGISTRY.md.'
  )
}

runArchitectureDiff()
