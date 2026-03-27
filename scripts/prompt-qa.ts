/**
 * @script ai:validate:prompts
 * @domain ai
 * @category validation
 * @description Validates AI agent and prompt file structural integrity
 * @mode validation
 * @usage bun run ai:validate:prompts
 * @dependencies fs, path, yaml (built-in Bun)
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { flushAi, log } from './utils/logger'

const ROOT = join(import.meta.dir, '..')
const AGENTS_DIR = join(ROOT, '.agents', 'agents')
const PROMPTS_DIR = join(ROOT, '.agents', 'prompts')
const SKILLS_DIR = join(ROOT, '.agents', 'skills')

interface Violation {
  file: string
  rule: string
  message: string
}

const violations: Violation[] = []

function addViolation(file: string, rule: string, message: string) {
  violations.push({ file, rule, message })
}

// --- Rule 1: Every agent must have a matching prompt ---
function checkAgentPromptParity() {
  const agents = readdirSync(AGENTS_DIR).filter(
    (f) => f.endsWith('.agent.md') && f !== 'copilot-instructions.md'
  )
  const prompts = new Set(
    readdirSync(PROMPTS_DIR)
      .filter((f) => f.endsWith('.prompt.md'))
      .map((f) => f.replace('.prompt.md', ''))
  )

  for (const agent of agents) {
    const name = agent.replace('.agent.md', '')
    if (!prompts.has(name)) {
      addViolation(agent, 'agent-prompt-parity', `Agent "${name}" has no matching prompt file`)
    }
  }

  // Reverse: prompt without agent
  const agentNames = new Set(agents.map((a) => a.replace('.agent.md', '')))
  for (const prompt of prompts) {
    if (!agentNames.has(prompt)) {
      addViolation(
        `${prompt}.prompt.md`,
        'prompt-agent-parity',
        `Prompt "${prompt}" has no matching agent file`
      )
    }
  }
}

// --- Rule 2: All agent files must have YAML frontmatter with required fields ---
function checkAgentFrontmatter() {
  const agents = readdirSync(AGENTS_DIR).filter(
    (f) => f.endsWith('.agent.md') && f !== 'copilot-instructions.md'
  )

  for (const agent of agents) {
    const content = readFileSync(join(AGENTS_DIR, agent), 'utf-8')
    if (!content.startsWith('---')) {
      addViolation(agent, 'frontmatter-missing', 'Agent file has no YAML frontmatter')
      continue
    }

    const endIdx = content.indexOf('---', 3)
    if (endIdx === -1) {
      addViolation(agent, 'frontmatter-malformed', 'YAML frontmatter not closed')
      continue
    }

    const frontmatter = content.slice(3, endIdx)

    // Check for version field
    if (!frontmatter.includes('version:')) {
      addViolation(agent, 'version-missing', 'Agent file missing version field')
    }

    // Check for tools field (Zidney agents only)
    if (agent.startsWith('zidney-') && !frontmatter.includes('tools:')) {
      addViolation(agent, 'tools-missing', 'Zidney agent missing tools declaration')
    }
  }
}

// --- Rule 3: Prompt files must have agent field in frontmatter ---
function checkPromptFrontmatter() {
  const prompts = readdirSync(PROMPTS_DIR).filter((f) => f.endsWith('.prompt.md'))

  for (const prompt of prompts) {
    const content = readFileSync(join(PROMPTS_DIR, prompt), 'utf-8')
    if (!content.startsWith('---')) {
      addViolation(prompt, 'prompt-frontmatter-missing', 'Prompt file has no YAML frontmatter')
      continue
    }

    const endIdx = content.indexOf('---', 3)
    if (endIdx === -1) {
      addViolation(prompt, 'prompt-frontmatter-malformed', 'YAML frontmatter not closed')
      continue
    }

    const frontmatter = content.slice(3, endIdx)
    if (!frontmatter.includes('agent:')) {
      addViolation(prompt, 'prompt-agent-missing', 'Prompt file missing agent field')
    }
  }
}

// --- Rule 4: Skill directories must not have spaces ---
function checkSkillDirectoryNames() {
  if (!existsSync(SKILLS_DIR)) return

  const entries = readdirSync(SKILLS_DIR, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.isDirectory() && entry.name.includes(' ')) {
      addViolation(
        entry.name,
        'skill-dir-spaces',
        `Skill directory "${entry.name}" contains spaces — use kebab-case`
      )
    }
  }
}

// --- Rule 5: Skill files must be under 500 lines ---
function checkSkillSizes() {
  if (!existsSync(SKILLS_DIR)) return

  function walkSkills(dir: string) {
    const entries = readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = join(dir, entry.name)
      if (entry.isDirectory() && entry.name !== '_archived') {
        walkSkills(fullPath)
      } else if (entry.name === 'SKILL.md') {
        const content = readFileSync(fullPath, 'utf-8')
        const lines = content.split('\n').length
        if (lines > 500) {
          const relPath = fullPath.replace(`${ROOT}/`, '')
          addViolation(relPath, 'skill-size-exceeded', `SKILL.md has ${lines} lines (max 500)`)
        }
      }
    }
  }

  walkSkills(SKILLS_DIR)
}

// --- Rule 6: No orphaned skills (skill dir without SKILL.md) ---
const SKILL_SUPPORT_DIRS = new Set(['references', 'examples', 'lib', 'assets', 'templates'])

function checkOrphanedSkillDirs() {
  if (!existsSync(SKILLS_DIR)) return

  function walkForOrphans(dir: string, depth: number) {
    const entries = readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name === '_archived') continue
      // Skip known support subdirectories inside skill folders
      if (depth > 0 && SKILL_SUPPORT_DIRS.has(entry.name)) continue

      const fullPath = join(dir, entry.name)
      const skillFile = join(fullPath, 'SKILL.md')

      const subEntries = readdirSync(fullPath, { withFileTypes: true })
      const hasSubDirs = subEntries.some((e) => e.isDirectory() && !SKILL_SUPPORT_DIRS.has(e.name))
      const hasSkillFile = existsSync(skillFile)

      if (hasSubDirs) {
        walkForOrphans(fullPath, depth + 1)
      } else if (!hasSkillFile) {
        const relPath = fullPath.replace(`${ROOT}/`, '')
        addViolation(relPath, 'orphaned-skill-dir', 'Skill directory has no SKILL.md')
      }
    }
  }

  walkForOrphans(SKILLS_DIR, 0)
}

// --- Run all checks ---
log.header('PROMPT & AGENT QA VALIDATOR', 'Validates AI agent and prompt file structural integrity')

checkAgentPromptParity()
checkAgentFrontmatter()
checkPromptFrontmatter()
checkSkillDirectoryNames()
checkSkillSizes()
checkOrphanedSkillDirs()

// --- Report ---
if (violations.length === 0) {
  log.result({ total: 0, passed: 0, failed: 0, message: 'All checks passed — 0 violations' })
  flushAi()
  process.exit(0)
} else {
  log.error(`${violations.length} violation(s) found:`)
  for (const v of violations) {
    log.step(`[${v.rule}] ${v.file}`)
    log.step(`  → ${v.message}`)
  }
  log.result({
    total: violations.length,
    passed: 0,
    failed: violations.length,
    message: 'Fix violations before merging.',
  })
  flushAi()
  process.exit(1)
}
