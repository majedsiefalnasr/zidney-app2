/** @library-module */
import { execSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

interface LegacyBrain {
  modules?: Record<string, unknown> | string[]
  dependencies?: Record<string, { imports?: string[] }>
  edges?: Array<{ from: string; to: string }>
}

function normalizeBrainShape(brainPath: string): void {
  if (!existsSync(brainPath)) {
    return
  }

  const parsed = JSON.parse(readFileSync(brainPath, 'utf-8')) as LegacyBrain
  let touched = false

  if (!Array.isArray(parsed.modules) && parsed.modules && typeof parsed.modules === 'object') {
    parsed.modules = Object.keys(parsed.modules)
    touched = true
  }

  if (!Array.isArray(parsed.edges)) {
    const edges: Array<{ from: string; to: string }> = []
    for (const [source, relation] of Object.entries(parsed.dependencies ?? {})) {
      for (const target of relation.imports ?? []) {
        edges.push({ from: source, to: target })
      }
    }
    parsed.edges = edges
    touched = true
  }

  if (touched) {
    writeFileSync(brainPath, `${JSON.stringify(parsed, null, 2)}\n`, 'utf-8')
  }
}

export function runBrainValidationHook(): void {
  normalizeBrainShape(`${process.cwd()}/docs/ai/context/ai-architecture-brain.json`)
  execSync('bun scripts/governance/validate-architecture-brain.ts', {
    stdio: 'pipe',
    encoding: 'utf-8',
  })
}
