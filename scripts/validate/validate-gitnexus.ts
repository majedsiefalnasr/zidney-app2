#!/usr/bin/env bun

/**
 * @script arch:gitnexus:validate
 * @domain arch
 * @category governance
 * @description Validates the gitnexus-context.json artifact for file presence, structure, semantics, and freshness.
 * @usage bun run arch:gitnexus:validate
 */

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { exit, log } from '../utils/logger'

log.setScript('arch:gitnexus:validate')

const CONTEXT_PATH = resolve(process.cwd(), 'docs/ai/context/gitnexus-context.json')
const SCHEMA_PATH = resolve(process.cwd(), 'docs/ai/gitnexus-context.schema.json')

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

function parseContextJson(): {
  context: Record<string, unknown> | null
  errors: ValidationError[]
} {
  const errors: ValidationError[] = []

  let raw: string
  try {
    raw = readFileSync(CONTEXT_PATH, 'utf-8')
  } catch (error) {
    errors.push({ step: 'json-parse', message: `Failed to read context file: ${String(error)}` })
    return { context: null, errors }
  }

  try {
    return { context: JSON.parse(raw) as Record<string, unknown>, errors }
  } catch (error) {
    errors.push({ step: 'json-parse', message: `Context file is not valid JSON: ${String(error)}` })
    return { context: null, errors }
  }
}

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

function checkSemanticConstraints(context: Record<string, unknown>): ValidationError[] {
  const errors: ValidationError[] = []
  const analysisMode = context.analysisMode

  if (analysisMode !== 'changed-only' && analysisMode !== 'full') {
    errors.push({
      step: 'semantic-constraints',
      message: `"analysisMode" must be "changed-only" or "full", got: "${String(analysisMode)}"`,
    })
  }

  const generatedAt = context.generatedAt
  if (typeof generatedAt === 'string' && Number.isNaN(Date.parse(generatedAt))) {
    errors.push({
      step: 'semantic-constraints',
      message: `"generatedAt" is not a valid ISO 8601 timestamp: "${generatedAt}"`,
    })
  }

  const recentCommits = context.recentCommits
  if (Array.isArray(recentCommits)) {
    const shaPattern = /^[0-9a-f]{40}$/
    for (let index = 0; index < recentCommits.length; index += 1) {
      const commit = recentCommits[index] as Record<string, unknown>
      if (typeof commit !== 'object' || commit === null) {
        errors.push({
          step: 'semantic-constraints',
          message: `recentCommits[${index}] is not an object`,
        })
        continue
      }

      for (const requiredKey of ['hash', 'message', 'author', 'date']) {
        if (typeof commit[requiredKey] !== 'string') {
          errors.push({
            step: 'semantic-constraints',
            message: `recentCommits[${index}].${requiredKey} must be a string`,
          })
        }
      }

      if (typeof commit.hash === 'string' && !shaPattern.test(commit.hash)) {
        errors.push({
          step: 'semantic-constraints',
          message: `recentCommits[${index}].hash must be a 40-char hex SHA, got: "${commit.hash}"`,
        })
      }
    }
  }

  const riskIndicators = context.riskIndicators
  if (Array.isArray(riskIndicators)) {
    for (let index = 0; index < riskIndicators.length; index += 1) {
      const indicator = riskIndicators[index] as Record<string, unknown>
      if (typeof indicator !== 'object' || indicator === null) {
        errors.push({
          step: 'semantic-constraints',
          message: `riskIndicators[${index}] is not an object`,
        })
        continue
      }

      if (typeof indicator.riskScore !== 'number') {
        errors.push({
          step: 'semantic-constraints',
          message: `riskIndicators[${index}].riskScore must be a number`,
        })
        continue
      }

      if (indicator.riskScore < 0 || indicator.riskScore > 100) {
        errors.push({
          step: 'semantic-constraints',
          message: `riskIndicators[${index}].riskScore must be between 0 and 100, got: ${indicator.riskScore}`,
        })
      }
    }
  }

  return errors
}

function checkFreshness(context: Record<string, unknown>): ValidationError[] {
  const generatedAt = context.generatedAt
  if (typeof generatedAt !== 'string') {
    return []
  }

  const generatedMs = Date.parse(generatedAt)
  if (Number.isNaN(generatedMs)) {
    return []
  }

  const maxAgeMs = 24 * 60 * 60 * 1000
  const ageMs = Date.now() - generatedMs
  if (ageMs <= maxAgeMs) {
    return []
  }

  const ageHours = Math.round(ageMs / (1000 * 60 * 60))
  return [
    {
      step: 'freshness',
      message: `gitnexus-context.json is ${ageHours}h old (>24h). Run: bun run arch:gitnexus:context`,
    },
  ]
}

function buildReport(errors: ValidationError[], totalChecks: number): ValidationReport {
  const failed = errors.length
  const passed = totalChecks - Math.min(failed, totalChecks)

  return {
    valid: failed === 0,
    contextPath: CONTEXT_PATH,
    errors,
    summary: {
      totalChecks,
      passed,
      failed,
    },
  }
}

function validate(): ValidationReport {
  const allErrors: ValidationError[] = []
  let totalChecks = 0

  totalChecks += 1
  const fileErrors = checkFilesExist()
  allErrors.push(...fileErrors)
  if (fileErrors.length > 0) {
    return buildReport(allErrors, totalChecks)
  }

  totalChecks += 1
  const { context, errors: parseErrors } = parseContextJson()
  allErrors.push(...parseErrors)
  if (context === null) {
    return buildReport(allErrors, totalChecks)
  }

  totalChecks += 1
  allErrors.push(...checkRequiredFields(context))

  totalChecks += 1
  allErrors.push(...checkSemanticConstraints(context))

  totalChecks += 1
  allErrors.push(...checkFreshness(context))

  return buildReport(allErrors, totalChecks)
}

function main(): void {
  log.header(
    'GITNEXUS CONTEXT VALIDATION',
    'Validates gitnexus-context.json structure, semantics, and freshness'
  )

  const report = validate()

  if (report.valid) {
    log.success(`Context artifact valid: ${report.contextPath}`)
    log.result({
      total: report.summary.totalChecks,
      passed: report.summary.passed,
      failed: 0,
      message: 'GitNexus context artifact is valid',
      details: {
        contextPath: report.contextPath,
      },
    })
    exit(0)
  }

  log.failList(
    'Validation errors',
    report.errors.map((error) => `[${error.step}] ${error.message}`)
  )
  log.result({
    total: report.summary.totalChecks,
    passed: report.summary.passed,
    failed: report.summary.failed,
    message: 'GitNexus context artifact validation failed',
    details: {
      contextPath: report.contextPath,
    },
  })
  exit(1)
}

main()
