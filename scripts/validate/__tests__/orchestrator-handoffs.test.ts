/** @library-module */

import { describe, expect, it } from 'vitest'
import {
  extractDeclaredAgents,
  extractDeclaredSkills,
  extractDelegatedSkills,
  extractHandoffTargets,
  findUnknownHandoffTargets,
} from '../../utils/orchestrator-agent'
import { validateOrchestratorHandoffs } from '../orchestrator-handoffs'

function buildOrchestratorContent(body: string): string {
  return `---
name: Orchestrator
description: Test orchestrator
agents:
  [
    'Technical Writer',
    'code-simplifier',
    'QA Engineer',
  ]
---

Loaded skills:

- documentation-writer-protocol
- post-implementation-simplification
- subagent-handoff-governance

${body}`
}

describe('extractDeclaredAgents', () => {
  it('parses declared agents from frontmatter', () => {
    const content = buildOrchestratorContent('')

    expect(extractDeclaredAgents(content)).toEqual([
      'Technical Writer',
      'code-simplifier',
      'QA Engineer',
    ])
  })
})

describe('extractDeclaredSkills', () => {
  it('collects loaded skills from the orchestrator body', () => {
    const content = buildOrchestratorContent('')

    expect(extractDeclaredSkills(content)).toEqual([
      'documentation-writer-protocol',
      'post-implementation-simplification',
      'subagent-handoff-governance',
    ])
  })
})

describe('extractDelegatedSkills', () => {
  it('collects delegated skill references from the orchestrator body', () => {
    const content = buildOrchestratorContent(
      [
        'See: `.agents/skills/documentation-writer-protocol/SKILL.md`',
        'See: `.agents/skills/post-implementation-simplification/SKILL.md`',
      ].join('\n')
    )

    expect(extractDelegatedSkills(content)).toEqual([
      'documentation-writer-protocol',
      'post-implementation-simplification',
    ])
  })
})

describe('extractHandoffTargets', () => {
  it('captures handoff targets with spaces and line numbers', () => {
    const content = buildOrchestratorContent(
      ['/handoff to=Technical Writer', '/handoff to=QA Engineer'].join('\n')
    )

    expect(extractHandoffTargets(content)).toEqual([
      { target: 'Technical Writer', line: 18 },
      { target: 'QA Engineer', line: 19 },
    ])
  })
})

describe('findUnknownHandoffTargets', () => {
  it('returns unknown handoff targets only', () => {
    const content = buildOrchestratorContent(
      ['/handoff to=Technical Writer', '/handoff to=Missing Agent'].join('\n')
    )

    expect(findUnknownHandoffTargets(content)).toEqual([{ target: 'Missing Agent', line: 19 }])
  })
})

describe('validateOrchestratorHandoffs', () => {
  it('passes when all handoffs and delegated skills are registered', () => {
    const content = buildOrchestratorContent(
      [
        'See: `.agents/skills/documentation-writer-protocol/SKILL.md`',
        'See: `.agents/skills/post-implementation-simplification/SKILL.md`',
        'See: `.agents/skills/subagent-handoff-governance/SKILL.md`',
        '/handoff to=Technical Writer',
        '/handoff to=code-simplifier',
      ].join('\n')
    )

    expect(validateOrchestratorHandoffs(content)).toEqual([])
  })

  it('reports unknown handoff targets and delegated skills missing from loaded skills', () => {
    const content = buildOrchestratorContent(
      [
        'See: `.agents/skills/documentation-writer-protocol/SKILL.md`',
        'See: `.agents/skills/non-listed-skill/SKILL.md`',
        '/handoff to=Technical Writer',
        '/handoff to=Architecture Guardian',
      ].join('\n')
    )

    const violations = validateOrchestratorHandoffs(content)

    expect(violations.map((violation) => violation.rule)).toEqual([
      'orchestrator-handoff-target-unknown',
      'orchestrator-delegated-skill-missing-from-loaded-list',
    ])
  })
})
