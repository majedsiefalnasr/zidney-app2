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

  const parsed = JSON.parse(readFileSync(brainPath, 'utf-8')) as LegacyBrain & {
    schema_version?: string
  }
  let touched = false

  // Only normalize legacy format: if modules is an object but WITHOUT rich structure.
  // The new format (from ai:context:refresh) has modules like: { "app/name": { "dependencies": [...], "layer": "...", ... } }
  // The legacy format has modules like: { "app/name": {} } or just names.
  // Detect new format by checking if any module has the rich keys we expect.
  const hasRichModuleStructure =
    parsed.modules &&
    typeof parsed.modules === 'object' &&
    !Array.isArray(parsed.modules) &&
    Object.values(parsed.modules).some(
      (module: unknown) =>
        module && typeof module === 'object' && ('dependencies' in module || 'layer' in module)
    )

  // Only convert to array if this is NOT the rich new format
  if (
    !hasRichModuleStructure &&
    !Array.isArray(parsed.modules) &&
    parsed.modules &&
    typeof parsed.modules === 'object'
  ) {
    parsed.modules = Object.keys(parsed.modules)
    touched = true
  }

  // Only normalize edges if they don't exist
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

  // Only write back if we actually made changes
  if (touched) {
    writeFileSync(brainPath, `${JSON.stringify(parsed, null, 2)}\n`, 'utf-8')
  }
}

export function runBrainValidationHook(): void {
  normalizeBrainShape(`${process.cwd()}/docs/ai/context/ai-architecture-brain.json`)
  execSync('bun run arch:validate:brain', {
    stdio: 'pipe',
    encoding: 'utf-8',
  })
}
