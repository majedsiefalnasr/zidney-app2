import { existsSync, readdirSync } from 'node:fs'

const SKILLS_DIR = '.agents/skills'

const BASELINE_SKILLS = ['architecture-intelligence', 'terminal-safety', 'mcp-routing']

const KEYWORD_MAP: Array<{ pattern: RegExp; skills: string[] }> = [
  { pattern: /refactor|rename|extract|split|move/i, skills: ['gitnexus-refactoring'] },
  { pattern: /debug|error|fail|bug|trace/i, skills: ['gitnexus-debugging'] },
  { pattern: /impact|break|depend|blast/i, skills: ['gitnexus-impact-analysis'] },
  { pattern: /explore|understand|how.*work|flow/i, skills: ['gitnexus-exploring'] },
  { pattern: /git|commit|branch|pr|push/i, skills: ['git-governance'] },
  { pattern: /package|dependency|dep|install/i, skills: ['package-manager-governance'] },
  { pattern: /precommit|pre-commit|husky/i, skills: ['precommit-diagnostics'] },
]

/**
 * Select skills for the given task description (deterministic).
 * Returns a sorted union of baseline skills and keyword-matched skills,
 * filtered to only those that exist as directories under .agents/skills/.
 */
export function selectSkills(taskDescription: string): string[] {
  const available = existsSync(SKILLS_DIR)
    ? new Set(
        readdirSync(SKILLS_DIR, { withFileTypes: true })
          .filter((d) => d.isDirectory())
          .map((d) => d.name)
      )
    : new Set<string>()

  const matched = new Set<string>(BASELINE_SKILLS)
  for (const { pattern, skills } of KEYWORD_MAP) {
    if (pattern.test(taskDescription)) {
      for (const s of skills) matched.add(s)
    }
  }

  // Only include skills that actually exist in the registry
  return [...matched].filter((s) => available.has(s)).sort()
}
