/** @library-module */
import { existsSync, readFileSync } from 'node:fs'
import type { GuardRule, RuleContext, RuleResult, ViolationRecord } from '../types'
import { moduleFromPath } from '../utils/changed-files'

const SUPPRESSION_PATTERNS: Array<{ regex: RegExp; label: string }> = [
  { regex: /@ts-ignore/, label: '@ts-ignore suppression' },
  { regex: /@ts-nocheck/, label: '@ts-nocheck suppression' },
  {
    regex:
      /eslint-disable(?:-next-line|-line)?\s+@typescript-eslint\/(?:no-explicit-any|ban-ts-comment)/,
    label: 'eslint typescript suppression',
  },
]

function scanFile(filePath: string): ViolationRecord[] {
  if (!existsSync(filePath)) {
    return []
  }

  const source = readFileSync(filePath, 'utf-8')
  const lines = source.split('\n')
  const sourceModule = moduleFromPath(filePath) ?? 'unknown'

  const violations: ViolationRecord[] = []
  lines.forEach((line, index) => {
    for (const pattern of SUPPRESSION_PATTERNS) {
      if (!pattern.regex.test(line)) {
        continue
      }
      violations.push({
        rule: 'type-safety-suppression',
        severity: 'error',
        message: `Unsafe TypeScript suppression detected (${pattern.label})`,
        location: {
          file: filePath,
          line: index + 1,
          column: Math.max(line.search(pattern.regex), 0) + 1,
        },
        source_module: sourceModule,
        remediation: '',
      })
    }
  })

  return violations
}

export async function runTypeSafetySuppressionRule(context: RuleContext): Promise<RuleResult> {
  const files = context.targetFiles.filter(
    (file) => /\.(ts|tsx|js|jsx|vue)$/.test(file) && !file.includes('/tests/')
  )
  const violations = files.flatMap(scanFile)

  return {
    rule: 'type-safety-suppression',
    violations,
  }
}

export const typeSafetySuppressionRule: GuardRule = {
  id: 'type-safety-suppression',
  order: 40,
  enabledIn: ['development', 'strict', 'changed'],
  run: runTypeSafetySuppressionRule,
}
