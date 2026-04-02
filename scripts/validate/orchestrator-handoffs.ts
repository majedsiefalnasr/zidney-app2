#!/usr/bin/env bun

/**
 * @script validate:orchestrator:handoffs
 * @domain validate
 * @category governance
 * @description Validates orchestrator handoff targets against the declared agent registry and checks delegated skills are listed in the loaded-skills section.
 * @usage bun run validate:orchestrator:handoffs
 */

import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { createLogger, exit, hasCiFlag, log } from '../utils/logger'
import {
  extractDeclaredAgents,
  extractDeclaredSkills,
  extractDelegatedSkills,
  findUnknownHandoffTargets,
  ORCHESTRATOR_SOURCE_PATH,
  readTextFile,
} from '../utils/orchestrator-agent'
import type { ViolationRecord } from './types'

const correlationId = randomUUID()
const args = process.argv.slice(2)
const isCi = hasCiFlag(args)
const logger = createLogger('validate:orchestrator:handoffs')
logger.setContext({ correlationId, ci: isCi })

try {
  log.setScript('validate:orchestrator:handoffs')
} catch {
  // Ignore logger adapter differences.
}

export function validateOrchestratorHandoffs(sourceContent: string): ViolationRecord[] {
  const violations: ViolationRecord[] = []
  const declaredAgents = extractDeclaredAgents(sourceContent)
  const unknownTargets = findUnknownHandoffTargets(sourceContent, declaredAgents)

  for (const target of unknownTargets) {
    violations.push({
      rule: 'orchestrator-handoff-target-unknown',
      file: ORCHESTRATOR_SOURCE_PATH,
      line: target.line,
      scriptName: target.target,
      message: `Handoff target "${target.target}" is not declared in the orchestrator agent registry`,
      hint: 'Add the exact agent name to the frontmatter agents array or change the /handoff target to a registered name.',
    })
  }

  const declaredSkills = new Set(extractDeclaredSkills(sourceContent))
  const delegatedSkills = extractDelegatedSkills(sourceContent)

  for (const skillName of delegatedSkills) {
    if (!declaredSkills.has(skillName)) {
      violations.push({
        rule: 'orchestrator-delegated-skill-missing-from-loaded-list',
        file: ORCHESTRATOR_SOURCE_PATH,
        scriptName: skillName,
        message: `Delegated skill "${skillName}" is referenced but not listed under Loaded skills`,
        hint: 'Add the skill to the Loaded skills section so skill health checks and delegation stay aligned.',
      })
    }
  }

  return violations
}

function isDirectExecution(): boolean {
  const entry = process.argv[1] ?? ''
  return /(?:^|[\\/])orchestrator-handoffs\.ts$/.test(entry)
}

function main(): void {
  log.header(
    'Validate orchestrator handoffs',
    'Check handoff targets against the agent registry and delegated skills against the loaded-skills list'
  )

  if (!existsSync(ORCHESTRATOR_SOURCE_PATH)) {
    logger.error('Canonical orchestrator source file is missing', {
      path: ORCHESTRATOR_SOURCE_PATH,
    })
    log.badge('SOURCE MISSING', 'error')
    exit(1)
  }

  const sourceContent = readTextFile(ORCHESTRATOR_SOURCE_PATH)
  const violations = validateOrchestratorHandoffs(sourceContent)

  if (violations.length === 0) {
    logger.info('Orchestrator registry and delegated-skill checks passed', {
      source: ORCHESTRATOR_SOURCE_PATH,
      declaredAgents: extractDeclaredAgents(sourceContent).length,
      delegatedSkills: extractDelegatedSkills(sourceContent).length,
    })
    log.badge('ORCHESTRATOR VALID', 'success')
    exit(0)
  }

  logger.error('Orchestrator validation failed', { count: violations.length })

  for (const violation of violations) {
    logger.error(`${violation.file}:${violation.line ?? '?'} — ${violation.message}`, {
      hint: violation.hint,
      rule: violation.rule,
    })
  }

  log.badge('ORCHESTRATOR VIOLATIONS', 'error')
  exit(1)
}

if (isDirectExecution()) {
  main()
}
