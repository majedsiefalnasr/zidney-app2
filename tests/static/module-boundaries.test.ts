/**
 * Static test: module-boundaries.json structure validation
 *
 * FR-001: docs/architecture/module-boundaries.json exists and is valid JSON
 * FR-002: All 13 modules are classified across 4 layers with exact counts
 *
 * NOTE: No mocking, no behavioral logic — this is a pure static analysis test.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const BOUNDARIES_PATH = join(process.cwd(), 'docs/architecture/module-boundaries.json')

describe('module-boundaries.json — static structure validation', () => {
  it('exists and is parseable as valid JSON', () => {
    let raw: string
    try {
      raw = readFileSync(BOUNDARIES_PATH, 'utf-8')
    } catch {
      throw new Error(`module-boundaries.json not found at: ${BOUNDARIES_PATH}`)
    }
    expect(() => JSON.parse(raw)).not.toThrow()
  })

  it('has exactly 5 infrastructure modules', () => {
    const data = JSON.parse(readFileSync(BOUNDARIES_PATH, 'utf-8'))
    expect(Array.isArray(data.layers.infrastructure)).toBe(true)
    expect(data.layers.infrastructure.length).toBe(5)
  })

  it('has exactly 2 domain modules', () => {
    const data = JSON.parse(readFileSync(BOUNDARIES_PATH, 'utf-8'))
    expect(Array.isArray(data.layers.domain)).toBe(true)
    expect(data.layers.domain.length).toBe(2)
  })

  it('has exactly 2 runtime modules', () => {
    const data = JSON.parse(readFileSync(BOUNDARIES_PATH, 'utf-8'))
    expect(Array.isArray(data.layers.runtime)).toBe(true)
    expect(data.layers.runtime.length).toBe(2)
  })

  it('has exactly 5 ui modules', () => {
    const data = JSON.parse(readFileSync(BOUNDARIES_PATH, 'utf-8'))
    expect(Array.isArray(data.layers.ui)).toBe(true)
    expect(data.layers.ui.length).toBe(5)
  })

  it('has exactly 14 total modules across all layers', () => {
    const data = JSON.parse(readFileSync(BOUNDARIES_PATH, 'utf-8'))
    const totalModules = Object.values(data.layers as Record<string, string[]>).reduce(
      (sum, modules) => sum + modules.length,
      0
    )
    expect(totalModules).toBe(14)
  })

  it('has well-formed required top-level fields', () => {
    const data = JSON.parse(readFileSync(BOUNDARIES_PATH, 'utf-8'))
    expect(typeof data.version).toBe('string')
    expect(typeof data.layers).toBe('object')
    expect(Array.isArray(data.layers)).toBe(false)
    expect(typeof data.allowed_dependencies).toBe('object')
    expect(Array.isArray(data.allowed_dependencies)).toBe(false)
    expect(typeof data.forbidden_dependencies).toBe('object')
    expect(Array.isArray(data.forbidden_dependencies)).toBe(false)
  })
})
