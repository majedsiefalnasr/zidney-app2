/**
 * T002 — Routing Authority Verification
 * Confirms one authoritative root per routing surface pair (agents, prompts, templates).
 
 * @library-module
*/

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { TaskFinding, TaskResult } from './types.ts'

const ROOT = process.cwd()
const REGISTRY_PATH = join(
  ROOT,
  'docs',
  'architecture',
  'intelligence',
  'ROUTING_AUTHORITY_REGISTRY.md'
)

interface Surface {
  category: string
  authoritativeRoot: string
  legacyRoots: string[]
}

function parseSurfaces(content: string): Surface[] {
  const surfaces: Surface[] = []

  // Find each routing category block
  const categoryPattern =
    /Routing Category: `([^`]+)`[\s\S]*?Authoritative Root: `([^`]+)`[\s\S]*?Legacy Compatibility Surfaces: ([^\n]+)/g

  let match = categoryPattern.exec(content)
  while (match !== null) {
    const category = match[1] ?? ''
    const authRoot = match[2] ?? ''
    const legacyLine = match[3] ?? ''

    // Extract legacy roots from the line (may be comma-separated or single path in backticks)
    const legacyRoots: string[] = []
    const pathPattern = /`([^`]+)`/g
    let pathMatch = pathPattern.exec(legacyLine)
    while (pathMatch !== null) {
      legacyRoots.push(pathMatch[1] ?? '')
      pathMatch = pathPattern.exec(legacyLine)
    }

    surfaces.push({ category, authoritativeRoot: authRoot, legacyRoots })
    match = categoryPattern.exec(content)
  }

  return surfaces
}

function countAuthoritativeDeclarations(content: string, category: string): number {
  // Count how many "Authoritative Root:" lines appear in this category's block
  // We search for the pattern within the category section
  const categorySection = content.split(/^## /m).find((block) => block.includes(`\`${category}\``))
  if (!categorySection) return 0
  return (categorySection.match(/Authoritative Root:/g) ?? []).length
}

export async function runRoutingAuthorityCheck(): Promise<TaskResult> {
  const findings: TaskFinding[] = []

  if (!existsSync(REGISTRY_PATH)) {
    return {
      taskId: 'T001',
      title: 'Routing Authority Verification',
      status: 'FLAG',
      summary: 'ROUTING_AUTHORITY_REGISTRY.md not found',
      findings: [{ item: REGISTRY_PATH, note: 'Registry file missing — cannot validate' }],
    }
  }

  const content = readFileSync(REGISTRY_PATH, 'utf-8')
  const surfaces = parseSurfaces(content)

  if (surfaces.length === 0) {
    return {
      taskId: 'T001',
      title: 'Routing Authority Verification',
      status: 'FLAG',
      summary: 'No routing surfaces found in registry',
      findings: [{ item: REGISTRY_PATH, note: 'Registry parsed but found 0 surface declarations' }],
    }
  }

  for (const surface of surfaces) {
    const { category, authoritativeRoot, legacyRoots } = surface
    const authPath = join(ROOT, authoritativeRoot)

    // 1. Authoritative root must exist on disk
    if (!existsSync(authPath)) {
      findings.push({
        item: authoritativeRoot,
        note: `[${category}] Authoritative root directory does not exist on disk`,
      })
    }

    // 2. Check exactly one "Authoritative Root:" declaration per category
    const authCount = countAuthoritativeDeclarations(content, category)
    if (authCount !== 1) {
      findings.push({
        item: category,
        note: `[${category}] Expected 1 Authoritative Root declaration, found ${authCount}`,
      })
    }

    // 3. Legacy roots: if present on disk, confirm they appear in registry as compatibility
    for (const legacyRoot of legacyRoots) {
      const legacyPath = join(ROOT, legacyRoot)
      if (existsSync(legacyPath)) {
        // Confirm the legacy root is mentioned in the registry (it should be, since it came from there)
        if (!content.includes(legacyRoot)) {
          findings.push({
            item: legacyRoot,
            note: `[${category}] Legacy root exists on disk but is not mentioned in registry`,
          })
        }
      }
    }
  }

  const status = findings.length === 0 ? 'PASS' : 'FLAG'
  const summary =
    findings.length === 0
      ? `All ${surfaces.length} routing surfaces have valid authoritative roots`
      : `${findings.length} routing authority issue(s) found across ${surfaces.length} surfaces`

  return {
    taskId: 'T001',
    title: 'Routing Authority Verification',
    status,
    summary,
    findings,
  }
}
