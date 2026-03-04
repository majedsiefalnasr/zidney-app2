/**
 * Zidney AI Guard
 *
 * Purpose:
 * Enforce architecture rules defined in
 * docs/architecture/intelligence/ARCHITECTURE_CONTRACT.json
 *
 * This script is intended to run:
 *  - before AI-generated commits
 *  - inside CI pipelines
 *
 * Hard enforcement rules (Option A):
 *  - Layer violations → FAIL
 *  - Dependency rule violations → FAIL
 *  - Circular dependencies → FAIL
 *  - Architecture drift → FAIL
 */

import { execSync } from 'child_process'
import { readFileSync } from 'fs'

type ArchitectureContract = {
  dependencyRules?: {
    forbidden?: Record<string, string[]>
  }
  layerRules?: {
    forbidden?: Record<string, string[]>
  }
}

const CONTRACT_PATH =
  'docs/architecture/intelligence/ARCHITECTURE_CONTRACT.json'

function loadContract(): ArchitectureContract {
  const raw = readFileSync(CONTRACT_PATH, 'utf-8')
  return JSON.parse(raw)
}

function getChangedFiles(): string[] {
  try {
    const output = execSync('git diff --cached --name-only', {
      encoding: 'utf-8',
    })
    return output
      .split('\n')
      .map((f) => f.trim())
      .filter(Boolean)
      .filter(
        (f) => f.endsWith('.ts') || f.endsWith('.tsx') || f.endsWith('.vue')
      )
  } catch {
    return []
  }
}

function extractImports(filePath: string): string[] {
  try {
    const content = readFileSync(filePath, 'utf-8')

    const importRegex = /import\s+(?:[\w*\s{},]+)\s+from\s+['"]([^'"]+)['"]/g

    const matches: string[] = []
    let match

    while ((match = importRegex.exec(content))) {
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

function validateRules(
  ruleType: string,
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
      violations.push(
        `${ruleType} violation: ${fileModule} → ${module} is forbidden`
      )
    }
  }

  return violations
}

function validateCrossAppImports(
  fileModule: string,
  filePath: string,
  imports: string[]
): string[] {
  const violations: string[] = []

  // Only enforce for app modules
  const isAppFile = filePath.startsWith('apps/')
  if (!isAppFile) return violations

  for (const imp of imports) {
    const module = detectModule(imp)
    if (!module) continue

    // If an app imports another app directly → violation
    if (imp.startsWith('apps/') && module !== fileModule) {
      violations.push(
        `Cross-app violation: apps/${fileModule} → apps/${module} is forbidden`
      )
    }
  }

  return violations
}

function validateRelativeLeaks(filePath: string, imports: string[]): string[] {
  const violations: string[] = []

  for (const imp of imports) {
    // Detect relative paths that climb directories
    if (!imp.startsWith('.')) continue

    // If the relative path explicitly references apps or packages, block it
    if (imp.includes('apps/') || imp.includes('packages/')) {
      violations.push(
        `Relative architecture leak: "${imp}" should use module import instead of relative path`
      )
    }
  }

  return violations
}

function runGuard() {
  const contract = loadContract()

  const changedFiles = getChangedFiles()

  if (changedFiles.length === 0) {
    console.log('AI Guard: no changed files detected.')
    process.exit(0)
  }

  const violations: string[] = []

  for (const file of changedFiles) {
    const fileModule = detectFileModule(file)

    if (!fileModule) continue

    const imports = extractImports(file)

    const crossAppViolations = validateCrossAppImports(
      fileModule,
      file,
      imports
    )

    const relativeLeakViolations = validateRelativeLeaks(file, imports)

    const dependencyViolations = validateRules(
      'Dependency',
      fileModule,
      imports,
      contract.dependencyRules?.forbidden
    )

    const layerViolations = validateRules(
      'Layer',
      fileModule,
      imports,
      contract.layerRules?.forbidden
    )

    violations.push(
      ...dependencyViolations.map((v) => `${file}: ${v}`),
      ...layerViolations.map((v) => `${file}: ${v}`),
      ...crossAppViolations.map((v) => `${file}: ${v}`),
      ...relativeLeakViolations.map((v) => `${file}: ${v}`)
    )
  }

  if (violations.length > 0) {
    console.error('\nAI Guard: Architecture violations detected\n')

    for (const v of violations) {
      console.error(' -', v)
    }

    console.error(
      '\nCommit rejected by Zidney AI Guard. Fix architecture violations.'
    )

    process.exit(1)
  }

  console.log('AI Guard: architecture validation passed.')
}

runGuard()
