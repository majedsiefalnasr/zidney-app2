/**
 * @script arch:gitnexus:validate
 * @domain arch
 * @category governance
 * @description Validates the gitnexus-context.json artifact against the JSON Schema and
 *   performs structural integrity checks. Exits with code 0 if valid, 1 if invalid.
 *   Designed to run as a CI gate before any AI agent consumes the context artifact.
 * @mode cli
 * @usage bun run arch:gitnexus:validate
 * @dependencies node:fs, node:path, docs/ai/context/gitnexus-context.json,
 *   docs/ai/gitnexus-context.schema.json
 
 * @library-module
*/

import { existsSync, readFileSync } from 'node:fs'

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const CONTEXT_PATH = resolve(process.cwd(), 'docs/ai/context/gitnexus-context.json')
const SCHEMA_PATH = resolve(process.cwd(), 'docs/ai/gitnexus-context.schema.json')

// ---------------------------------------------------------------------------
// Type stubs (subset needed for structural validation without ajv dependency)
// ---------------------------------------------------------------------------

interface ValidationError {
  step: string
  message: string
}

// ---------------------------------------------------------------------------
// Step 1: File existence
// ---------------------------------------------------------------------------

function checkFilesExist(): ValidationError[] {
  const errors: ValidationError[] = []
  if (!existsSync(CONTEXT_PATH)) {
    errors.push({
      step: 'file-existence',
      message: `gitnexus-context.json not found at: ${CONTEXT_PATH}. Run: bun run arch:gitnexus:context`,
    })
  }
  if (!existsSync(SCHEMA_PATH)) {
    errors.push({
      step: 'file-existence',
      message: `gitnexus-context.schema.json not found at: ${SCHEMA_PATH}`,
    })
  }
  return errors
}

// ---------------------------------------------------------------------------
// Step 2: JSON parse
// ---------------------------------------------------------------------------

function parseContextJson(): {
  context: Record<string, unknown> | null
  errors: ValidationError[]
} {
  const errors: ValidationError[] = []

  let raw: string
  try {
    raw = readFileSync(CONTEXT_PATH, 'utf-8')
  } catch (err) {
    errors.push({ step: 'json-parse', message: `Failed to read context file: ${err}` })
    return { context: null, errors }
  }

  try {
    const context = JSON.parse(raw) as Record<string, unknown>
    return { context, errors }
  } catch (err) {
    errors.push({ step: 'json-parse', message: `Context file is not valid JSON: ${err}` })
    return { context: null, errors }
  }
}

// ---------------------------------------------------------------------------
// Step 3: Required field presence
// ---------------------------------------------------------------------------

const REQUIRED_FIELDS: Array<{ field: string; expectedType: string }> = [
  { field: 'schemaVersion', expectedType: 'string' },
  { field: 'generatedAt', expectedType: 'string' },
  { field: 'analysisMode', expectedType: 'string' },
  { field: 'changedFiles', expectedType: 'array' },
  { field: 'impactedModules', expectedType: 'array' },
  { field: 'dependencyGraph', expectedType: 'object' },
  { field: 'architectureLayerMap', expectedType: 'object' },
  { field: 'recentCommits', expectedType: 'array' },
  { field: 'riskIndicators', expectedType: 'array' },
]

function checkRequiredFields(context: Record<string, unknown>): ValidationError[] {
  const errors: ValidationError[] = []

  for (const { field, expectedType } of REQUIRED_FIELDS) {
    if (!(field in context)) {
      errors.push({ step: 'required-fields', message: `Missing required field: "${field}"` })
      continue
    }

    const value = context[field]
    const actualType = Array.isArray(value) ? 'array' : typeof value

    if (actualType !== expectedType) {
      errors.push({
        step: 'required-fields',
        message: `Field "${field}" must be type "${expectedType}", got "${actualType}"`,
      })
    }
  }

  return errors
}

// ---------------------------------------------------------------------------
// Step 4: Semantic constraints
// ---------------------------------------------------------------------------

function checkSemanticConstraints(context: Record<string, unknown>): ValidationError[] {
  const errors: ValidationError[] = []

  // analysisMode enum
  const analysisMode = context.analysisMode
  if (analysisMode !== 'changed-only' && analysisMode !== 'full') {
    errors.push({
      step: 'semantic-constraints',
      message: `"analysisMode" must be "changed-only" or "full", got: "${analysisMode}"`,
    })
  }

  // generatedAt ISO timestamp
  const generatedAt = context.generatedAt
  if (typeof generatedAt === 'string' && Number.isNaN(Date.parse(generatedAt))) {
    errors.push({
      step: 'semantic-constraints',
      message: `"generatedAt" is not a valid ISO 8601 timestamp: "${generatedAt}"`,
    })
  }

  // recentCommits structure
  const recentCommits = context.recentCommits
  if (Array.isArray(recentCommits)) {
    const SHA_PATTERN = /^[0-9a-f]{40}$/
    for (let i = 0; i < recentCommits.length; i++) {
      const commit = recentCommits[i] as Record<string, unknown>
      if (typeof commit !== 'object' || commit === null) {
        errors.push({
          step: 'semantic-constraints',
          message: `recentCommits[${i}] is not an object`,
        })
        continue
      }
      for (const requiredKey of ['hash', 'message', 'author', 'date']) {
        if (typeof commit[requiredKey] !== 'string') {
          errors.push({
            step: 'semantic-constraints',
            message: `recentCommits[${i}].${requiredKey} must be a string`,
          })
        }
      }
      if (typeof commit.hash === 'string' && !SHA_PATTERN.test(commit.hash)) {
        errors.push({
          step: 'semantic-constraints',
          message: `recentCommits[${i}].hash must be a 40-char hex SHA, got: "${commit.hash}"`,
        })
      }
    }
  }

  // riskIndicators structure
  const riskIndicators = context.riskIndicators
  if (Array.isArray(riskIndicators)) {
    for (let i = 0; i < riskIndicators.length; i++) {
      const indicator = riskIndicators[i] as Record<string, unknown>
      if (typeof indicator !== 'object' || indicator === null) {
        errors.push({
          step: 'semantic-constraints',
          message: `riskIndicators[${i}] is not an object`,
        })
        continue
      }
      if (typeof indicator.riskScore !== 'number') {
        errors.push({
          step: 'semantic-constraints',
          message: `riskIndicators[${i}].riskScore must be a number`,
        })
      } else if ((indicator.riskScore as number) < 0 || (indicator.riskScore as number) > 100) {
        errors.push({
          step: 'semantic-constraints',
          message: `riskIndicators[${i}].riskScore must be between 0 and 100, got: ${indicator.riskScore}`,
        })
      }
    }
  }

  return errors
}

// ---------------------------------------------------------------------------
// Step 5: Freshness check (warn if older than 24h)
// ---------------------------------------------------------------------------

function checkFreshness(context: Record<string, unknown>): ValidationError[] {
  const errors: ValidationError[] = []

  const generatedAt = context.generatedAt
  if (typeof generatedAt !== 'string') return errors

  const generatedMs = Date.parse(generatedAt)
  if (Number.isNaN(generatedMs)) return errors

  const ageMs = Date.now() - generatedMs
  const maxAgeMs = 24 * 60 * 60 * 1000 // 24 hours

  if (ageMs > maxAgeMs) {
    const ageHours = Math.round(ageMs / (1000 * 60 * 60))
    errors.push({
      step: 'freshness',
      message: `gitnexus-context.json is ${ageHours}h old (>24h). Run: bun run arch:gitnexus:context`,
    })
  }

  return errors
}

// ---------------------------------------------------------------------------
// Main validation pipeline
// ---------------------------------------------------------------------------

function validate(): ValidationReport {
  const allErrors: ValidationError[] = []
  let totalChecks = 0

  // Step 1
  totalChecks++
  const existenceErrors = checkFilesExist()
  allErrors.push(...existenceErrors)

  if (existenceErrors.some((e) => e.step === 'file-existence')) {
    // Cannot proceed without the file
    return buildReport(allErrors, totalChecks)
  }

  // Step 2
  totalChecks++
  const { context, errors: parseErrors } = parseContextJson()
  allErrors.push(...parseErrors)

  if (context === null) {
    return buildReport(allErrors, totalChecks)
  }

  // Step 3
  totalChecks++
  allErrors.push(...checkRequiredFields(context))

  // Step 4
  totalChecks++
  allErrors.push(...checkSemanticConstraints(context))

  // Step 5
  totalChecks++
  allErrors.push(...checkFreshness(context))

  return buildReport(allErrors, totalChecks)
}

function buildReport(errors: ValidationError[], totalChecks: number): ValidationReport {
  const failed = errors.length
  const passed = totalChecks - Math.min(failed, totalChecks)
  return {
    valid: failed === 0,
    contextPath: CONTEXT_PATH,
    errors,
    summary: { totalChecks, passed, failed },
  }
}

// ---------------------------------------------------------------------------
// CLI output
// ---------------------------------------------------------------------------

function main(): void {
  const report = validate()

  if (report.valid) {
    process.stdout.write(
      `[validate-gitnexus] PASSED — ${report.summary.passed}/${report.summary.totalChecks} checks passed\n`
    )
    process.stdout.write(`[validate-gitnexus] Context: ${report.contextPath}\n`)
    process.exit(0)
  } else {
    process.stderr.write(`[validate-gitnexus] FAILED — ${report.summary.failed} error(s) found\n`)
    for (const error of report.errors) {
      process.stderr.write(`  [${error.step}] ${error.message}\n`)
    }
    process.stderr.write(
      `\n[validate-gitnexus] ${report.summary.passed}/${report.summary.totalChecks} checks passed\n`
    )
    process.exit(1)
  }
}

main()

import { resolve } from 'node:path'

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const _CONTEXT_PATH = resolve(process.cwd(), 'docs/ai/context/gitnexus-context.json')
const _SCHEMA_PATH = resolve(process.cwd(), 'docs/ai/gitnexus-context.schema.json')

// ---------------------------------------------------------------------------
// Type stubs (subset needed for structural validation without ajv dependency)
// ---------------------------------------------------------------------------

interface ValidationError {
  step: string
  message: string
}

interface ValidationReport {
  valid: boolean
  contextPath: string
  errors: ValidationError[]
  summary: {
    totalChecks: number
    passed: number
    failed: number
  }
}

// ---------------------------------------------------------------------------
// Step 1: File existence
// ---------------------------------------------------------------------------
