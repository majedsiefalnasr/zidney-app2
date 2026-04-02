/** @library-module */

import { readFileSync } from 'node:fs'

export const ORCHESTRATOR_SOURCE_PATH = '.agents/agents/orchestrator.agent.md'

export interface HandoffTargetRecord {
  target: string
  line: number
}

function extractFrontmatter(content: string): string {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/)

  if (!frontmatterMatch || frontmatterMatch[1] === undefined) {
    throw new Error('Missing YAML frontmatter in orchestrator agent file')
  }

  return frontmatterMatch[1]
}

function extractArrayBlock(frontmatter: string, key: string): string {
  const lines = frontmatter.split('\n')
  const startIndex = lines.findIndex((line) => line.trim().startsWith(`${key}:`))

  if (startIndex === -1) {
    throw new Error(`Missing "${key}" block in orchestrator frontmatter`)
  }

  const blockLines: string[] = []

  for (let index = startIndex; index < lines.length; index += 1) {
    const line = lines[index]

    if (line === undefined) {
      continue
    }

    blockLines.push(line)

    if (index > startIndex && line.trim() === ']') {
      break
    }
  }

  return blockLines.join('\n')
}

function extractSingleQuotedEntries(block: string): string[] {
  return [...block.matchAll(/'([^']+)'/g)]
    .map((match) => match[1])
    .filter((value): value is string => value !== undefined)
}

export function extractDeclaredAgents(content: string): string[] {
  const frontmatter = extractFrontmatter(content)
  const agentsBlock = extractArrayBlock(frontmatter, 'agents')
  return extractSingleQuotedEntries(agentsBlock)
}

export function extractDeclaredSkills(content: string): string[] {
  const loadedSkillsHeader = 'Loaded skills:'
  const startIndex = content.indexOf(loadedSkillsHeader)

  if (startIndex === -1) {
    return []
  }

  const afterHeader = content.slice(startIndex + loadedSkillsHeader.length)
  const lines = afterHeader.split('\n')
  const skills: string[] = []

  for (const rawLine of lines) {
    const line = rawLine.trim()

    if (!line) {
      if (skills.length > 0) {
        break
      }
      continue
    }

    if (!line.startsWith('- ')) {
      if (skills.length > 0) {
        break
      }
      continue
    }

    skills.push(line.slice(2).trim())
  }

  return skills
}

export function extractDelegatedSkills(content: string): string[] {
  return [...content.matchAll(/\.agents\/skills\/([a-z0-9-]+)(?:\/SKILL\.md)?/gi)]
    .map((match) => match[1])
    .filter((value): value is string => value !== undefined)
}

export function extractHandoffTargets(content: string): HandoffTargetRecord[] {
  const lines = content.split('\n')
  const targets: HandoffTargetRecord[] = []

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]

    if (line === undefined) {
      continue
    }

    const trimmed = line.trim()

    if (!trimmed.startsWith('/handoff to=')) {
      continue
    }

    const target = trimmed.slice('/handoff to='.length).trim()

    if (!target) {
      continue
    }

    targets.push({ target, line: index + 1 })
  }

  return targets
}

export function findUnknownHandoffTargets(
  content: string,
  declaredAgents: readonly string[] = extractDeclaredAgents(content)
): HandoffTargetRecord[] {
  const declaredAgentSet = new Set(declaredAgents)
  return extractHandoffTargets(content).filter((record) => !declaredAgentSet.has(record.target))
}

export function readTextFile(filePath: string): string {
  return readFileSync(filePath, 'utf-8')
}
