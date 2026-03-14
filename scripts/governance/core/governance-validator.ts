/**
 * Governance Validator Module
 *
 * Consolidates validation logic for type safety and architecture artifacts.
 * Provides shared validation utilities used by type-safety-guard and validate-architecture-brain.
 *
 * T035 — Consolidates validation logic for:
 * - Type safety violations (explicit-any, as-any, generic-any patterns)
 * - Architecture brain artifacts (modules, edges, path validation)
 * - Exception registry validation
 *
 * Phase 2: Script Modularization — Governance Tools
 */

/**
 * Type Safety Violation Patterns
 */
export const TypeSafetyPatterns = {
  explicitAny: /:\s*any\b/,
  asAny: /\bas\s+any\b/,
  genericAny: /<any>/,
} as const

export type TypeSafetyPattern = keyof typeof TypeSafetyPatterns

/**
 * Check if a violation pattern matches the given line of code
 */
export function matchesTypeSafetyPattern(line: string, pattern: TypeSafetyPattern): boolean {
  return TypeSafetyPatterns[pattern].test(line)
}

/**
 * Get all type safety violations in a line of code
 */
export interface TypeSafetyViolation {
  pattern: TypeSafetyPattern
  column: number
  code: string
  message: string
}

export function findTypeSafetyViolations(line: string): TypeSafetyViolation[] {
  const violations: TypeSafetyViolation[] = []

  // Check for `: any`
  const explicitAnyMatch = line.match(TypeSafetyPatterns.explicitAny)
  if (explicitAnyMatch) {
    violations.push({
      pattern: 'explicitAny',
      column: (explicitAnyMatch.index || 0) + 1,
      code: line.trim(),
      message: 'Explicit "any" type detected',
    })
  }

  // Check for `as any`
  const asAnyMatch = line.match(TypeSafetyPatterns.asAny)
  if (asAnyMatch) {
    violations.push({
      pattern: 'asAny',
      column: (asAnyMatch.index || 0) + 1,
      code: line.trim(),
      message: '"as any" type assertion detected',
    })
  }

  // Check for `<any>`
  const genericAnyMatch = line.match(TypeSafetyPatterns.genericAny)
  if (genericAnyMatch) {
    violations.push({
      pattern: 'genericAny',
      column: (genericAnyMatch.index || 0) + 1,
      code: line.trim(),
      message: 'Generic "any" type detected',
    })
  }

  return violations
}

/**
 * Module Path Validation
 *
 * Valid paths: apps/<name>, packages/<name>
 * Invalid paths: ./src/module, relative paths, single-segment paths
 */
export function isValidModulePath(path: string | undefined): boolean {
  if (!path) return false

  // Check for relative path prefix
  if (path.startsWith('./') || path.startsWith('../')) {
    return false
  }

  // Check for path segments beyond module root
  if (path.includes('/src/') || path.includes('/dist/') || path.includes('/lib/')) {
    return false
  }

  const parts = path.split('/')
  return (
    parts.length === 2 && (parts[0] === 'packages' || parts[0] === 'apps') && parts[1].length > 0
  )
}

/**
 * Validate module path structure
 * Returns error messages if invalid, empty array if valid
 */
export function validateModulePath(
  path: string | undefined,
  context: 'source' | 'target'
): string[] {
  const errors: string[] = []

  if (!path) {
    errors.push(`Missing ${context} module path`)
    return errors
  }

  if (path.startsWith('./') || path.startsWith('../')) {
    errors.push(
      `${context} module path "${path}" contains relative prefix (./ or ../) - use absolute paths`
    )
  }

  if (path.includes('/src/') || path.includes('/dist/') || path.includes('/lib/')) {
    errors.push(
      `${context} module path "${path}" contains invalid segments - use only apps/<name> or packages/<name>`
    )
  }

  const parts = path.split('/')
  if (parts.length > 2) {
    errors.push(
      `${context} module path "${path}" has too many segments - expected apps/<name> or packages/<name>`
    )
  }

  if (parts.length > 0 && parts[0] !== 'packages' && parts[0] !== 'apps') {
    errors.push(
      `${context} module path "${path}" has invalid root - expected apps or packages, got ${parts[0]}`
    )
  }

  return errors
}

/**
 * Architecture Brain Edge Validation
 */
export interface ArchitectureEdge {
  from?: string
  to?: string
  type?: string
}

export interface EdgeValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

export function validateArchitectureEdge(
  edge: ArchitectureEdge,
  index: number
): EdgeValidationResult {
  const result: EdgeValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
  }

  // Check for required fields
  if (!edge.from || !edge.to) {
    result.errors.push(`Edge #${index} is missing from or to field: ${JSON.stringify(edge)}`)
    result.valid = false
    return result
  }

  // Validate source module path
  const sourceErrors = validateModulePath(edge.from, 'source')
  if (sourceErrors.length > 0) {
    result.errors.push(...sourceErrors.map((err) => `Edge #${index}: ${err}`))
    result.valid = false
  }

  // Validate target module path
  const targetErrors = validateModulePath(edge.to, 'target')
  if (targetErrors.length > 0) {
    result.errors.push(...targetErrors.map((err) => `Edge #${index}: ${err}`))
    result.valid = false
  }

  // Check for self-loops (module depending on itself)
  if (edge.from === edge.to) {
    result.warnings.push(
      `Edge #${index}: Module "${edge.from}" has a self-loop (depends on itself)`
    )
  }

  return result
}

/**
 * Exception Registry Validation
 *
 * Validates that exception entries follow required schema
 */
export interface AllowedException {
  file: string
  line: number
  pattern: string
  justification: string
  sunsetDate?: string
  approved_by: string
  approved_date: string
}

export interface AllowedExceptions {
  exceptions: AllowedException[]
}

export function validateExceptionRegistry(data: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Exception registry must be a JSON object'] }
  }

  const obj = data as Record<string, unknown>

  if (!Array.isArray(obj.exceptions)) {
    errors.push('Exception registry missing "exceptions" array field')
    return { valid: false, errors }
  }

  const exceptions = obj.exceptions as unknown[]

  for (let i = 0; i < exceptions.length; i++) {
    const exc = exceptions[i]
    if (!exc || typeof exc !== 'object') {
      errors.push(`Exception #${i} is not an object`)
      continue
    }

    const excObj = exc as Record<string, unknown>

    // Validate required fields
    if (typeof excObj.file !== 'string') {
      errors.push(`Exception #${i}: missing or invalid "file" field (string required)`)
    }
    if (typeof excObj.line !== 'number') {
      errors.push(`Exception #${i}: missing or invalid "line" field (number required)`)
    }
    if (typeof excObj.pattern !== 'string') {
      errors.push(`Exception #${i}: missing or invalid "pattern" field (string required)`)
    }
    if (typeof excObj.approved_by !== 'string') {
      errors.push(`Exception #${i}: missing or invalid "approved_by" field (string required)`)
    }
    if (typeof excObj.approved_date !== 'string') {
      errors.push(`Exception #${i}: missing or invalid "approved_date" field (string required)`)
    }

    // Validate optional fields
    if ('sunsetDate' in excObj && typeof excObj.sunsetDate !== 'string') {
      errors.push(`Exception #${i}: invalid "sunsetDate" field (string required if present)`)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Violation History Tracking
 *
 * Utilities for tracking approved vs unapproved violations
 */
export interface ViolationTracker {
  approved: Map<string, number>
  unapproved: Map<string, number>
}

export function createViolationTracker(): ViolationTracker {
  return {
    approved: new Map(),
    unapproved: new Map(),
  }
}

export function recordViolation(tracker: ViolationTracker, file: string, approved: boolean): void {
  const map = approved ? tracker.approved : tracker.unapproved
  map.set(file, (map.get(file) || 0) + 1)
}

export function getViolationStats(tracker: ViolationTracker) {
  let totalApproved = 0
  let totalUnapproved = 0

  for (const count of tracker.approved.values()) {
    totalApproved += count
  }

  for (const count of tracker.unapproved.values()) {
    totalUnapproved += count
  }

  return {
    approved: totalApproved,
    unapproved: totalUnapproved,
    total: totalApproved + totalUnapproved,
    filesWithApproved: tracker.approved.size,
    filesWithUnapproved: tracker.unapproved.size,
  }
}

/**
 * Governance Validation Summary
 *
 * Produces a summary report of all validations
 */
export interface GovernanceValidationSummary {
  timestamp: string
  typeSafetyViolations: number
  architectureErrors: number
  exceptionValidationErrors: number
  totalErrors: number
  health: 'PASS' | 'WARN' | 'FAIL'
}

export function createValidationSummary(
  typeSafetyViolations: number,
  architectureErrors: number,
  exceptionValidationErrors: number
): GovernanceValidationSummary {
  const totalErrors = typeSafetyViolations + architectureErrors + exceptionValidationErrors

  return {
    timestamp: new Date().toISOString(),
    typeSafetyViolations,
    architectureErrors,
    exceptionValidationErrors,
    totalErrors,
    health: totalErrors === 0 ? 'PASS' : totalErrors < 10 ? 'WARN' : 'FAIL',
  }
}

// Exports
export default {
  TypeSafetyPatterns,
  matchesTypeSafetyPattern,
  findTypeSafetyViolations,
  isValidModulePath,
  validateModulePath,
  validateArchitectureEdge,
  validateExceptionRegistry,
  createViolationTracker,
  recordViolation,
  getViolationStats,
  createValidationSummary,
}
