/**
 * T008 — CI Workflow Hygiene Check
 * Reads .github/workflows/*.yml; flags duplicate run: step commands across workflows.
 * Identifies consolidation candidates. No changes made.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { TaskFinding, TaskResult } from './types.ts'

const ROOT = process.cwd()
const WORKFLOWS_DIR = join(ROOT, '.github', 'workflows')

interface WorkflowStep {
  workflowFile: string
  stepName: string | undefined
  runCommand: string
}

function normalizeCommand(cmd: string): string {
  return cmd.trim().replace(/\s+/g, ' ').toLowerCase()
}

function extractRunSteps(workflowFile: string, content: string): WorkflowStep[] {
  const steps: WorkflowStep[] = []

  // Parse YAML-like structure to extract job steps
  // We look for "run:" blocks with optional preceding "name:" lines
  const lines = content.split('\n')
  let currentStepName: string | undefined

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? ''
    const trimmed = line.trim()

    // Detect step name (preceded by "- name:" or "name:")
    const nameMatch = trimmed.match(/^-?\s*name:\s*(.+)$/)
    if (nameMatch) {
      currentStepName = nameMatch[1]?.trim()
    }

    // Reset step name at new step boundaries
    if (trimmed.startsWith('- ') && !nameMatch) {
      currentStepName = undefined
    }

    // Detect run: blocks
    const runMatch = trimmed.match(/^run:\s*(.+)$/)
    if (runMatch) {
      // Single-line run command
      const cmd = runMatch[1]?.trim()
      if (cmd && cmd !== '|' && cmd !== '>') {
        steps.push({
          workflowFile: workflowFile.replace(`${ROOT}/`, ''),
          stepName: currentStepName,
          runCommand: normalizeCommand(cmd),
        })
      }
      // Multi-line ("|" or ">") — collect following indented lines
      if (cmd === '|' || cmd === '>') {
        const indent = (line.match(/^\s*/)?.[0]?.length ?? 0) + 2
        const multiLineCmd: string[] = []

        for (let j = i + 1; j < lines.length; j++) {
          const nextLine = lines[j] ?? ''
          const nextIndent = nextLine.match(/^\s*/)?.[0]?.length ?? 0

          if (nextLine.trim() === '') {
            // blank line — might be continuation
            multiLineCmd.push('')
            continue
          }

          if (nextIndent < indent) break

          multiLineCmd.push(nextLine.trim())
        }

        if (multiLineCmd.length > 0) {
          steps.push({
            workflowFile: workflowFile.replace(`${ROOT}/`, ''),
            stepName: currentStepName,
            runCommand: normalizeCommand(multiLineCmd.join(' ')),
          })
        }
      }
    }
  }

  return steps
}

export async function runCiWorkflowCheck(): Promise<TaskResult> {
  const findings: TaskFinding[] = []

  if (!existsSync(WORKFLOWS_DIR)) {
    return {
      taskId: 'T007',
      title: 'CI Workflow Hygiene',
      status: 'SKIP',
      summary: '.github/workflows/ directory not found',
      findings: [],
    }
  }

  let workflowFiles: string[] = []
  try {
    workflowFiles = readdirSync(WORKFLOWS_DIR)
      .filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))
      .map((f) => join(WORKFLOWS_DIR, f))
  } catch {
    return {
      taskId: 'T007',
      title: 'CI Workflow Hygiene',
      status: 'INCONCLUSIVE',
      summary: 'Failed to read .github/workflows/ directory',
      findings: [],
    }
  }

  if (workflowFiles.length === 0) {
    return {
      taskId: 'T007',
      title: 'CI Workflow Hygiene',
      status: 'PASS',
      summary: 'No workflow files found',
      findings: [],
    }
  }

  // Collect all steps
  const allSteps: WorkflowStep[] = []
  for (const wfFile of workflowFiles) {
    try {
      const content = readFileSync(wfFile, 'utf-8')
      allSteps.push(...extractRunSteps(wfFile, content))
    } catch {}
  }

  // Build command → workflows map
  const cmdToWorkflows = new Map<string, Set<string>>()
  for (const step of allSteps) {
    if (!step.runCommand || step.runCommand.length < 5) continue
    const existing = cmdToWorkflows.get(step.runCommand) ?? new Set<string>()
    existing.add(step.workflowFile)
    cmdToWorkflows.set(step.runCommand, existing)
  }

  // Flag commands in more than one workflow
  for (const [cmd, workflows] of cmdToWorkflows.entries()) {
    if (workflows.size > 1) {
      const wfList = Array.from(workflows).join(', ')
      // Truncate long commands for display
      const displayCmd = cmd.length > 100 ? `${cmd.substring(0, 100)}...` : cmd
      findings.push({
        item: displayCmd,
        note: `Duplicate run: command found in ${workflows.size} workflows: ${wfList} — consolidation candidate`,
      })
    }
  }

  // Check step names for semantic overlap
  const stepNameToWorkflows = new Map<string, Set<string>>()
  for (const step of allSteps) {
    if (!step.stepName) continue
    const normName = step.stepName.toLowerCase().trim()
    const existing = stepNameToWorkflows.get(normName) ?? new Set<string>()
    existing.add(step.workflowFile)
    stepNameToWorkflows.set(normName, existing)
  }

  for (const [name, workflows] of stepNameToWorkflows.entries()) {
    if (workflows.size > 1 && name.length > 3) {
      const wfList = Array.from(workflows).join(', ')
      findings.push({
        item: `Step: "${name}"`,
        note: `Duplicate step label in ${workflows.size} workflows: ${wfList} — semantic overlap candidate`,
      })
    }
  }

  const status = findings.length === 0 ? 'PASS' : 'FLAG'
  const duplicateCount = findings.filter((f) => !f.item.startsWith('Step:')).length
  const semanticCount = findings.filter((f) => f.item.startsWith('Step:')).length
  const summary =
    findings.length === 0
      ? `${workflowFiles.length} workflow files checked; no duplicate steps found`
      : `${duplicateCount} duplicate run: command(s) and ${semanticCount} step label overlap(s) across ${workflowFiles.length} workflows`

  return {
    taskId: 'T007',
    title: 'CI Workflow Hygiene',
    status,
    summary,
    findings,
  }
}
