import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import {
  formatAssessmentAsJson,
  formatAssessmentAsMarkdown,
  formatDriftReportAsMarkdown,
} from './formatters'
import type { ArchitectureHealthArtifacts, ArchitectureHealthAssessment } from './types'

function writeAtomic(filePath: string, content: string): void {
  const tmpPath = `${filePath}.tmp`
  writeFileSync(tmpPath, content, 'utf-8')
  renameSync(tmpPath, filePath)
}

function ensureDirectory(dirPath: string): void {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true })
  }
}

function sanitizeTimestamp(timestamp: string): string {
  return timestamp.replace(/:/g, '-').replace(/\./g, '-')
}

function historyAlreadyContainsAssessment(historyDir: string, assessmentId: string): boolean {
  if (!existsSync(historyDir)) return false

  return readdirSync(historyDir)
    .filter((entry) => entry.endsWith('.json'))
    .some((entry) => {
      try {
        const content = JSON.parse(readFileSync(join(historyDir, entry), 'utf-8')) as {
          assessment_id?: string
        }
        return content.assessment_id === assessmentId
      } catch {
        return false
      }
    })
}

export function writeAssessmentArtifacts(
  repoRoot: string,
  assessment: ArchitectureHealthAssessment
): ArchitectureHealthArtifacts {
  const healthDir = join(repoRoot, 'docs/architecture/health')
  const historyDir = join(healthDir, 'history')
  ensureDirectory(healthDir)
  ensureDirectory(historyDir)

  const jsonPath = join(healthDir, 'architecture-health.json')
  const summaryPath = join(healthDir, 'architecture-health-summary.md')
  const driftPath = join(healthDir, 'architecture-drift-report.md')

  writeAtomic(jsonPath, formatAssessmentAsJson(assessment))
  writeAtomic(summaryPath, formatAssessmentAsMarkdown(assessment))
  writeAtomic(driftPath, formatDriftReportAsMarkdown(assessment))

  let historyPath: string | undefined
  if (!historyAlreadyContainsAssessment(historyDir, assessment.assessment_id)) {
    historyPath = join(historyDir, `health-${sanitizeTimestamp(assessment.generated_at)}.json`)
    writeAtomic(historyPath, formatAssessmentAsJson(assessment))
  }

  return {
    jsonPath,
    summaryPath,
    driftPath,
    historyPath,
  }
}

export function shouldPersistHistorySnapshot(
  existingHistoryPayloads: Array<{ assessment_id?: string }>,
  assessmentId: string
): boolean {
  return !existingHistoryPayloads.some((payload) => payload.assessment_id === assessmentId)
}
