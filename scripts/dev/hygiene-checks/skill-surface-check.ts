/**
 * T007 — Skill Surface Validation
 * Checks every .agents/skills/ subdirectory is referenced in SKILLS_INDEX.md and/or AGENTS.md.
 * Also flags stale index entries (in index but directory missing on disk).
 
 * @library-module
*/

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { TaskFinding, TaskResult } from './types.ts'

const ROOT = process.cwd()
const SKILLS_DIR = join(ROOT, '.agents', 'skills')
const SKILLS_INDEX = join(SKILLS_DIR, 'SKILLS_INDEX.md')
const ROOT_AGENTS_MD = join(ROOT, 'AGENTS.md')
const APPS_DIR = join(ROOT, 'apps')

// Parent container directories (no root SKILL.md expected — valid)
const CONTAINER_DIRS = new Set(['aws-skills', 'gitnexus'])

function getAppAgentsFiles(): string[] {
  const result: string[] = []
  if (!existsSync(APPS_DIR)) return result
  try {
    const appDirs = readdirSync(APPS_DIR, { withFileTypes: true }).filter((d) => d.isDirectory())
    for (const appDir of appDirs) {
      const agentsMd = join(APPS_DIR, appDir.name, 'AGENTS.md')
      if (existsSync(agentsMd)) result.push(agentsMd)
    }
  } catch {
    // ignore
  }
  return result
}

function readSafe(filePath: string): string {
  try {
    return readFileSync(filePath, 'utf-8')
  } catch {
    return ''
  }
}

export async function runSkillSurfaceCheck(): Promise<TaskResult> {
  const findings: TaskFinding[] = []

  if (!existsSync(SKILLS_DIR)) {
    return {
      taskId: 'T006',
      title: 'Skill Surface Validation',
      status: 'SKIP',
      summary: '.agents/skills/ directory not found',
      findings: [],
    }
  }

  // Read reference surfaces
  const indexContent = readSafe(SKILLS_INDEX)
  const rootAgentsContent = readSafe(ROOT_AGENTS_MD)
  const appAgentsContents = getAppAgentsFiles().map(readSafe).join('\n')
  const allReferenceContent = `${indexContent}\n${rootAgentsContent}\n${appAgentsContents}`

  // 1. Enumerate immediate subdirectories of .agents/skills/
  let skillDirs: string[] = []
  try {
    skillDirs = readdirSync(SKILLS_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
  } catch {
    return {
      taskId: 'T006',
      title: 'Skill Surface Validation',
      status: 'INCONCLUSIVE',
      summary: 'Failed to read .agents/skills/ directory',
      findings: [],
    }
  }

  // 2. For each skill directory (excluding container dirs without SKILL.md)
  for (const skillDir of skillDirs) {
    if (CONTAINER_DIRS.has(skillDir)) {
      // Container directories are valid without SKILL.md — skip
      continue
    }

    const mentionedInIndex = indexContent.includes(skillDir)
    const mentionedInAgents = allReferenceContent.includes(skillDir)

    if (!mentionedInIndex && !mentionedInAgents) {
      findings.push({
        item: `.agents/skills/${skillDir}`,
        note: `Skill directory not referenced in SKILLS_INDEX.md or any AGENTS.md`,
      })
    }
  }

  // 3. Check for stale index entries (in SKILLS_INDEX.md but no directory on disk)
  if (indexContent) {
    const diskDirSet = new Set(skillDirs)

    // Extract skill names from index — look for table rows with skill directory patterns
    const tableRowPattern = /\|\s*([a-z0-9_-]+)\s*\|/g
    let match = tableRowPattern.exec(indexContent)
    const indexedSkills = new Set<string>()

    while (match !== null) {
      const name = match[1]?.trim()
      if (name && name.length > 2 && name !== 'Domain' && name !== 'Skill' && name !== 'Lines') {
        indexedSkills.add(name)
      }
      match = tableRowPattern.exec(indexContent)
    }

    for (const indexedSkill of indexedSkills) {
      if (!diskDirSet.has(indexedSkill) && !CONTAINER_DIRS.has(indexedSkill)) {
        // Only flag if it looks like a real skill name (avoid false positives from table content)
        if (indexedSkill.includes('-') || indexedSkill.length > 5) {
          findings.push({
            item: indexedSkill,
            note: `STALE INDEX ENTRY — mentioned in SKILLS_INDEX.md but no directory found at .agents/skills/${indexedSkill}`,
          })
        }
      }
    }
  }

  const status = findings.length === 0 ? 'PASS' : 'FLAG'
  const summary =
    findings.length === 0
      ? `All ${skillDirs.length} skill directories are properly referenced`
      : `${findings.length} skill surface issue(s) found`

  return {
    taskId: 'T006',
    title: 'Skill Surface Validation',
    status,
    summary,
    findings,
  }
}
