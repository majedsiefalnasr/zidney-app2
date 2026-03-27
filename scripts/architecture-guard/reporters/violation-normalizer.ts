/** @library-module */
import type { ViolationRecord } from '../types'

const REMEDIATION_BY_RULE: Record<string, string> = {
  'dependency-boundaries':
    'Move shared logic into an allowed package and update imports to respect module boundaries.',
  'circular-dependency':
    'Break the cycle by extracting shared contracts into a lower-level package and invert one dependency edge.',
  'non-negotiables.database-per-tenant':
    'Restore authoritative database-per-tenant signals in governance contracts before merging changes.',
  'non-negotiables.cross-tenant-join':
    'Remove cross-tenant join patterns and keep all data access tenant-scoped through resolver context.',
  'non-negotiables.license-middleware':
    'Ensure workspace routes enforce tenant resolver followed by license middleware in API contracts.',
  'non-negotiables.arch-drift':
    'Regenerate architecture context artifacts and align map/graph consistency before merging.',
  'type-safety-suppression':
    'Remove unsafe TypeScript suppression and use explicit, constrained types or approved exceptions.',
}

export function normalizeViolation(input: ViolationRecord): ViolationRecord {
  return {
    ...input,
    remediation:
      input.remediation ||
      REMEDIATION_BY_RULE[input.rule] ||
      'Follow architecture governance remediation guidance.',
  }
}

export function normalizeViolations(violations: ViolationRecord[]): ViolationRecord[] {
  return violations.map(normalizeViolation).sort((a, b) => {
    const fileCompare = a.location.file.localeCompare(b.location.file)
    if (fileCompare !== 0) return fileCompare
    const lineA = a.location.line ?? 0
    const lineB = b.location.line ?? 0
    if (lineA !== lineB) return lineA - lineB
    return a.rule.localeCompare(b.rule)
  })
}
