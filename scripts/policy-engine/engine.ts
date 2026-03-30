/**
 * Policy Engine — Core Orchestrator
 *
 * Loads rules from the registry, runs them against the provided context,
 * enforces timeout, and returns sorted PolicyResult[].
 *
 * @module scripts/policy-engine/engine
 
 * @library-module
*/

import { createLogger } from '../utils/logger'
import { getRules } from './registry'
import type { ContextWarning, PolicyContext, PolicyDomain, PolicyResult, PolicyRule } from './types'

const logger = createLogger('policy-engine')

const SEVERITY_ORDER: Record<string, number> = {
  error: 0,
  warning: 1,
  info: 2,
}

class TimeoutError extends Error {
  constructor(ms: number) {
    super(`Policy engine timed out after ${ms}ms`)
    this.name = 'TimeoutError'
  }
}

function timeoutPromise(ms: number): Promise<never> {
  return new Promise((_, reject) => setTimeout(() => reject(new TimeoutError(ms)), ms))
}

async function safeEvaluate(rule: PolicyRule, context: PolicyContext): Promise<PolicyResult[]> {
  try {
    return await rule.evaluate(context)
  } catch (err) {
    logger.error(`Rule ${rule.id} threw an unhandled exception`, {
      ruleId: rule.id,
      error: String(err),
    })
    return [
      {
        ruleId: rule.id,
        domain: rule.domain,
        severity: 'error',
        message: `Rule ${rule.id} threw an unhandled exception: ${String(err)}`,
      },
    ]
  }
}

function sortResults(results: PolicyResult[]): PolicyResult[] {
  return [...results].sort((a, b) => {
    const severityDiff = (SEVERITY_ORDER[a.severity] ?? 2) - (SEVERITY_ORDER[b.severity] ?? 2)
    if (severityDiff !== 0) return severityDiff
    return a.ruleId.localeCompare(b.ruleId)
  })
}

function warningToResult(warning: ContextWarning): PolicyResult {
  const ruleIdMap: Record<ContextWarning['code'], string> = {
    GIT_UNAVAILABLE: 'ENGINE-002',
    GITNEXUS_STALE: 'ENGINE-003',
    GITNEXUS_MISSING: 'ENGINE-003',
    GITNEXUS_MALFORMED: 'ENGINE-003',
  }

  const domain: PolicyDomain = 'ENGINE'

  return {
    ruleId: ruleIdMap[warning.code],
    domain,
    severity: 'warning',
    message: warning.message,
  }
}

export class PolicyEngine {
  /**
   * Execute all registered rules against the provided context.
   *
   * Execution order:
   * 0. Convert loaderWarnings to ENGINE-002/ENGINE-003 PolicyResult entries
   * 1. Create AbortController with timeout (2000ms changed, 30000ms full)
   * 2. Inject abortController.signal into context.abortSignal
   * 3. Separate sequential vs parallel rules
   * 4. Run parallel rules via Promise.all (with timeout race)
   * 5. Run sequential rules one by one
   * 6. Abort controller cleanup
   * 7. Collect all results
   * 8. Sort by severity (error > warning > info), then by ruleId
   * 9. Return [...warningResults, ...sortedResults]
   */
  async check(context: PolicyContext, loaderWarnings?: ContextWarning[]): Promise<PolicyResult[]> {
    // Step 0: convert loader warnings to ENGINE-002/ENGINE-003 results
    const warningResults: PolicyResult[] = loaderWarnings?.map(warningToResult) ?? []

    // Step 1: create AbortController with timeout
    const timeout = context.timeout ?? (context.mode === 'changed' ? 2000 : 30000)
    const abortController = new AbortController()

    // Step 2: inject signal into context
    context.abortSignal = abortController.signal

    // Step 3: separate sequential vs parallel rules
    const rules = getRules()
    const parallelRules = rules.filter((r) => !r.sequential)
    const sequentialRules = rules.filter((r) => r.sequential === true)

    logger.debug('Policy engine starting rule execution', {
      mode: context.mode,
      parallelCount: parallelRules.length,
      sequentialCount: sequentialRules.length,
      timeout,
    })

    const allResults: PolicyResult[] = []

    try {
      // Step 4: run parallel rules via Promise.all with timeout race
      const parallelResultsNested = await Promise.race([
        Promise.all(parallelRules.map((r) => safeEvaluate(r, context))),
        timeoutPromise(timeout),
      ])

      // Flatten parallel results
      for (const results of parallelResultsNested) {
        allResults.push(...results)
      }

      // Step 5: run sequential rules one by one
      for (const rule of sequentialRules) {
        if (abortController.signal.aborted) {
          break
        }
        const results = await safeEvaluate(rule, context)
        allResults.push(...results)
      }
    } catch (err) {
      if (err instanceof TimeoutError) {
        logger.error('Policy engine timed out', { timeout, mode: context.mode })
        // Step 6: abort in-flight subprocesses
        abortController.abort()
        return [
          ...warningResults,
          {
            ruleId: 'ENGINE-001',
            domain: 'ENGINE',
            severity: 'error',
            message: `Policy engine timed out after ${timeout}ms in ${context.mode} mode`,
          },
        ]
      }
      throw err
    }

    // Step 6: cleanup abort controller
    abortController.abort()

    // Steps 8-9: sort and return
    const sortedResults = sortResults(allResults)

    logger.debug('Policy engine completed', {
      total: sortedResults.length,
      errors: sortedResults.filter((r) => r.severity === 'error').length,
      warnings: sortedResults.filter((r) => r.severity === 'warning').length,
    })

    return [...warningResults, ...sortedResults]
  }
}
