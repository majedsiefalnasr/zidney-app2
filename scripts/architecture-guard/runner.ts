#!/usr/bin/env bun

import { existsSync, readFileSync } from 'node:fs'
import { flushAi, log } from '../utils/logger'
import { runContextGenerationHook } from './hooks/generate-context'
import { runBrainValidationHook } from './hooks/validate-brain'
import { resolveMode } from './mode'
import { buildJsonReport, reportToJson } from './reporters/json-reporter'
import { getRulesForMode } from './rule-registry'
import type { RuleContext, ViolationRecord } from './types'
import { discoverChangedFiles, discoverGovernedFiles, moduleFromPath } from './utils/changed-files'
import { expandChangedScope } from './utils/impact-expansion'
import { buildScopeMetrics } from './utils/scope-accounting'

function loadAllModules(repoRoot: string): string[] {
  const mapPath = `${repoRoot}/docs/architecture/intelligence/ARCHITECTURE_MAP.json`
  if (!existsSync(mapPath)) {
    return []
  }
  try {
    const parsed = JSON.parse(readFileSync(mapPath, 'utf-8')) as {
      modules?: Record<string, unknown>
    }
    return Object.keys(parsed.modules ?? {}).sort((a, b) => a.localeCompare(b))
  } catch {
    return []
  }
}

function toRelativePath(path: string, repoRoot: string): string {
  const normalizedRoot = repoRoot.endsWith('/') ? repoRoot : `${repoRoot}/`
  return path.startsWith(normalizedRoot) ? path.slice(normalizedRoot.length) : path
}

function buildTargetFiles(
  repoRoot: string,
  mode: ReturnType<typeof resolveMode>,
  allModules: string[]
): {
  scopeModules: Set<string>
  fallbackReason: ReturnType<typeof expandChangedScope>['fallbackReason']
  targetFiles: string[]
  changedFiles: string[]
  skippedUnmappedFiles: string[]
} {
  const governedFiles = discoverGovernedFiles(repoRoot)

  if (mode.mode !== 'changed') {
    return {
      scopeModules: new Set(allModules),
      fallbackReason: null,
      targetFiles: governedFiles,
      changedFiles: [],
      skippedUnmappedFiles: [],
    }
  }

  const changed = discoverChangedFiles()
  if (changed.changedFiles.length === 0) {
    return {
      scopeModules: new Set(),
      fallbackReason: null,
      targetFiles: [],
      changedFiles: [],
      skippedUnmappedFiles: [],
    }
  }

  const expanded = expandChangedScope(repoRoot, changed.changedFiles, allModules, mode.modules)
  const fallbackToFull = expanded.fallbackReason !== null

  const targetFiles = fallbackToFull
    ? governedFiles
    : governedFiles.filter((file) => {
        const module = moduleFromPath(file)
        return module ? expanded.scopeModules.has(module) : false
      })

  return {
    scopeModules: fallbackToFull ? new Set(allModules) : expanded.scopeModules,
    fallbackReason: expanded.fallbackReason,
    targetFiles,
    changedFiles: changed.changedFiles,
    skippedUnmappedFiles: expanded.skippedUnmappedFiles,
  }
}

function downgradeToWarnings(violations: ViolationRecord[]): ViolationRecord[] {
  return violations.map((violation) => ({
    ...violation,
    severity: 'warning',
  }))
}

export async function runUnifiedArchitectureGuard(args = process.argv.slice(2)): Promise<number> {
  log.header('UNIFIED ARCHITECTURE GUARD', 'Validates architecture rules and import boundaries')
  const start = Date.now()
  const repoRoot = process.cwd()
  const mode = resolveMode(args)
  const allModules = loadAllModules(repoRoot)

  const scope = buildTargetFiles(repoRoot, mode, allModules)
  const rules = getRulesForMode(mode.mode)

  const context: RuleContext = {
    repoRoot,
    mode: mode.mode,
    allModules,
    scopeModules: scope.scopeModules,
    changedFiles: scope.changedFiles,
    targetFiles: scope.targetFiles,
  }

  const ruleViolations: ViolationRecord[] = []
  let contractError = false

  for (const rule of rules) {
    try {
      const result = await rule.run(context)
      ruleViolations.push(...result.violations)
    } catch (error) {
      contractError = true
      ruleViolations.push({
        rule: rule.id,
        severity: 'error',
        message: `Rule execution failed: ${error instanceof Error ? error.message : String(error)}`,
        location: {
          file: 'scripts/architecture-guard/runner.ts',
        },
        source_module: 'scripts/architecture-guard',
        remediation: 'Fix rule execution error before running governance checks.',
      })
    }
  }

  if (mode.mode !== 'development') {
    try {
      runContextGenerationHook()
      runBrainValidationHook()
    } catch (error) {
      contractError = true
      ruleViolations.push({
        rule: 'non-negotiables.arch-drift',
        severity: 'error',
        message: `Architecture context hook failed: ${error instanceof Error ? error.message : String(error)}`,
        location: {
          file: 'scripts/architecture-guard/hooks',
        },
        source_module: 'scripts/architecture-guard',
        remediation:
          'Run infrastructure audit and architecture context generation scripts until validation passes.',
      })
    }
  }

  const normalizedFiles = scope.targetFiles.map((file) => toRelativePath(file, repoRoot))
  const effectiveScopeModules =
    mode.mode === 'changed' && normalizedFiles.length === 0 ? new Set<string>() : scope.scopeModules

  const report = buildJsonReport({
    mode: mode.mode,
    scope: buildScopeMetrics(allModules, effectiveScopeModules, scope.skippedUnmappedFiles),
    fallbackReason: scope.fallbackReason,
    contractError,
    violations: mode.mode === 'development' ? downgradeToWarnings(ruleViolations) : ruleViolations,
    durationMs: Date.now() - start,
  })

  if (mode.outputJson) {
    process.stdout.write(`${reportToJson(report)}\n`)
  } else {
    log.info(`Unified Architecture Guard mode=${report.validation_mode} verdict=${report.verdict}`)
    log.info(`Rules executed: ${rules.map((rule) => rule.id).join(', ')}`)
    log.info(
      `Scope: validated=${report.scope.modules_validated} skipped=${report.scope.modules_skipped}`
    )
    if (report.fallback_reason) {
      log.warn(`Fallback reason: ${report.fallback_reason}`)
    }

    if (report.violations.length > 0) {
      log.warn('Violations:')
      for (const violation of report.violations) {
        const location = violation.location.line
          ? `${violation.location.file}:${violation.location.line}`
          : violation.location.file
        log.error(` - [${violation.rule}] ${location} ${violation.message}`)
      }
    }
  }

  const exitCode = report.verdict === 'BLOCKED' ? 1 : 0
  log.result({
    total: report.violations.length,
    passed: report.violations.filter((v) => v.severity !== 'error').length,
    failed: report.violations.filter((v) => v.severity === 'error').length,
    message: `verdict=${report.verdict}`,
  })
  flushAi()
  return exitCode
}

if ((import.meta as { main?: boolean }).main) {
  runUnifiedArchitectureGuard().then((code) => process.exit(code))
}
