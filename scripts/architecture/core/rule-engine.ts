/**
 * Rule Engine Module
 *
 * Purpose: Extract rule validation logic from ai-guard
 * Used by: ai-guard, boundary validation
 *
 * Provides:
 * - Rule evaluation engine
 * - Violation reporting
 * - Rule matching logic
 
 * @library-module
*/

export interface Rule {
  name: string
  description?: string
  pattern?: RegExp
  forbidden?: Record<string, string[]>
}

export interface ValidationViolation {
  rule: string
  source: string
  target: string
  message: string
}

/**
 * Validate rules against imports
 */
export function validateRules(
  ruleType: 'Dependency' | 'Layer',
  sourceModule: string,
  imports: string[],
  forbiddenRules?: Record<string, string[]>
): string[] {
  const violations: string[] = []

  if (!forbiddenRules) {
    return violations
  }

  for (const [source, targets] of Object.entries(forbiddenRules)) {
    // Check if source matches
    if (!moduleMatches(sourceModule, source)) {
      continue
    }

    // Check if any import targets the forbidden modules
    for (const target of targets) {
      for (const importPath of imports) {
        if (moduleMatches(importPath, target)) {
          violations.push(
            `${ruleType} violation: ${sourceModule} cannot import from ${importPath} (rule: ${source} → ${target})`
          )
        }
      }
    }
  }

  return violations
}

/**
 * Check if a module path matches a rule pattern
 */
export function moduleMatches(modulePath: string, pattern: string): boolean {
  // Exact match
  if (modulePath === pattern) {
    return true
  }

  // Wildcard match: packages/* matches packages/domain-core
  if (pattern.endsWith('/*')) {
    const prefix = pattern.slice(0, -2)
    return modulePath.startsWith(`${prefix}/`)
  }

  // Wildcard match: * matches any
  if (pattern === '*') {
    return true
  }

  return false
}

/**
 * Validate layer boundaries
 */
export function validateLayerBoundary(
  source: string,
  target: string,
  layerRules?: Record<string, string[]>
): boolean {
  if (!layerRules) {
    return true
  }

  // Check if this cross-layer import is forbidden
  return !isLayerViolation(source, target, layerRules)
}

/**
 * Check if import violates layer rules
 */
export function isLayerViolation(
  source: string,
  target: string,
  layerRules: Record<string, string[]>
): boolean {
  for (const [sourceLayer, forbiddenTargets] of Object.entries(layerRules)) {
    if (moduleMatches(source, sourceLayer)) {
      for (const forbiddenTarget of forbiddenTargets) {
        if (moduleMatches(target, forbiddenTarget)) {
          return true
        }
      }
    }
  }

  return false
}

/**
 * Validate architecture map compliance
 */
export function validateArchitectureMapCompliance(
  sourceModule: string,
  imports: string[],
  archMap?: Record<
    string,
    {
      layer?: string
      allowed_dependencies?: string[]
      forbidden_dependencies?: string[]
    }
  >
): string[] {
  const violations: string[] = []

  if (!archMap || !archMap[sourceModule]) {
    return violations
  }

  const moduleConfig = archMap[sourceModule]

  // Check forbidden dependencies
  if (moduleConfig.forbidden_dependencies) {
    for (const forbidden of moduleConfig.forbidden_dependencies) {
      for (const importPath of imports) {
        if (moduleMatches(importPath, forbidden)) {
          violations.push(
            `Architecture map violation: ${sourceModule} cannot depend on ${importPath} (explicitly forbidden)`
          )
        }
      }
    }
  }

  // Check allowed dependencies (if whitelist is defined)
  if (moduleConfig.allowed_dependencies && moduleConfig.allowed_dependencies.length > 0) {
    for (const importPath of imports) {
      // Skip external packages
      if (!importPath.startsWith('packages/') && !importPath.startsWith('apps/')) {
        continue
      }

      // Check if import is in allowed list
      const isAllowed = moduleConfig.allowed_dependencies.some((allowed) =>
        moduleMatches(importPath, allowed)
      )

      if (!isAllowed) {
        violations.push(
          `Architecture map violation: ${sourceModule} is not allowed to depend on ${importPath} (not in allowed_dependencies)`
        )
      }
    }
  }

  return violations
}

/**
 * Detect cross-app imports (apps should not import from other apps)
 */
export function validateCrossAppImports(sourceModule: string, imports: string[]): string[] {
  const violations: string[] = []

  // Only check if source is an app
  if (!sourceModule.startsWith('apps/')) {
    return violations
  }

  for (const importPath of imports) {
    // Flag if importing from another app
    if (importPath.startsWith('apps/') && importPath !== sourceModule) {
      violations.push(
        `Cross-app violation: ${sourceModule} cannot import from ${importPath} (apps should be independent)`
      )
    }
  }

  return violations
}

/**
 * Validate relative imports don't leak across boundaries
 */
export function validateRelativeImportBoundaries(
  filePath: string,
  relativeImports: string[]
): string[] {
  const violations: string[] = []

  // Extract module from file path
  let module = ''
  if (filePath.includes('packages/')) {
    const match = filePath.match(/packages\/([^/]+)/)
    if (match) module = `packages/${match[1]}`
  } else if (filePath.includes('apps/')) {
    const match = filePath.match(/apps\/([^/]+)/)
    if (match) module = `apps/${match[1]}`
  }

  if (!module) {
    return violations
  }

  // Check for imports going outside the module
  const _modulePath = module.split('/').join('/')
  for (const relImport of relativeImports) {
    // Count the .. segments
    const upCount = (relImport.match(/\.\.\//g) || []).length
    const _currentDepth = filePath.split('/').length

    // If going up more than module depth, it's escaping the module
    const moduleDepth = module.split('/').length + 1
    if (upCount >= moduleDepth) {
      violations.push(
        `Relative import boundary leak: ${filePath} → ${relImport} (escapes module boundary)`
      )
    }
  }

  return violations
}

/**
 * Check if a violation should be reported
 */
export function shouldReportViolation(violation: string, exceptions?: string[]): boolean {
  if (!exceptions) {
    return true
  }

  // Check if violation matches any exception
  for (const exception of exceptions) {
    if (violation.includes(exception)) {
      return false
    }
  }

  return true
}

/**
 * Filter violations by module
 */
export function filterViolationsByModule(violations: string[], module: string): string[] {
  return violations.filter((v) => v.includes(module))
}

/**
 * Check if rules are satisfied
 */
export function checkRulesSatisfied(
  violations: ValidationViolation[],
  maxAllowed: number = 0
): boolean {
  return violations.length <= maxAllowed
}

export interface Rule {
  name: string
  description?: string
  pattern?: RegExp
  forbidden?: Record<string, string[]>
}

export interface ValidationViolation {
  rule: string
  source: string
  target: string
  message: string
}
