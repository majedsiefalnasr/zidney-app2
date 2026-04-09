import { describe, expect, it } from 'vitest'
import {
  findStaleDocFiles,
  generateRegistry,
  normalizeGeneratedDocContent,
  resolveDocFileName,
} from '../script-docs'

describe('script-docs utilities', () => {
  it('resolveDocFileName uses existing filename when provided', () => {
    const name = resolveDocFileName('test:one', 'existing-file.md')
    expect(name).toBe('existing-file.md')
  })

  it('resolveDocFileName converts script name to filename when none provided', () => {
    const name = resolveDocFileName('group:task')
    expect(name).toBe('group-task.md')
  })

  it('normalizeGeneratedDocContent strips last generated line for registry path', () => {
    const filePath = 'docs/scripts/SCRIPT_REGISTRY.md'
    const content = `# Registry\n> Last generated: 2026-04-09T00:00:00Z\n\n- item`
    const normalized = normalizeGeneratedDocContent(filePath, content)
    expect(normalized).not.toContain('Last generated')
  })

  it('findStaleDocFiles returns unexpected md files', () => {
    const existing = ['README.md', 'SCRIPT_REGISTRY.md', 'extra.md']
    const expected = ['README.md', 'SCRIPT_REGISTRY.md']
    const stale = findStaleDocFiles(existing, expected)
    expect(stale).toContain('extra.md')
  })

  it('generateRegistry produces a registry with domain headings and scripts', () => {
    const metas: any[] = [
      {
        script: 'a:one',
        domain: 'dev',
        category: 'dev',
        description: 'd',
        usage: 'u',
        filePath: 'p',
      },
      {
        script: 'b:two',
        domain: 'db',
        category: 'db',
        description: 'd2',
        usage: 'u2',
        filePath: 'p2',
      },
    ]
    const out = generateRegistry(metas)
    expect(out).toContain('## db')
    expect(out).toContain('## dev')
    expect(out).toContain('`a:one`')
    expect(out).toContain('`b:two`')
  })
})
