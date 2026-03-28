/** @library-module */
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import type {
  ArchitectureIntelligenceSnapshot,
  HealthFinding,
  IntelligenceArtifactStatus,
  IntelligenceArtifactStatusKind,
} from './types'

interface RequiredArtifact {
  artifact_name: string
  path: string
  validator?: string
}

const REQUIRED_ARTIFACTS: RequiredArtifact[] = [
  { artifact_name: 'ai-dependency-graph.json', path: 'docs/ai/context/ai-dependency-graph.json' },
  { artifact_name: 'ai-module-map.json', path: 'docs/ai/context/ai-module-map.json' },
  { artifact_name: 'ai-layer-model.json', path: 'docs/ai/context/ai-layer-model.json' },
  { artifact_name: 'ai-runtime-map.json', path: 'docs/ai/context/ai-runtime-map.json' },
  {
    artifact_name: 'ai-architecture-brain.json',
    path: 'docs/ai/context/ai-architecture-brain.json',
    validator: 'bun run arch:validate:brain',
  },
]

function toIsoTimestamp(filePath: string): string | undefined {
  try {
    return statSync(filePath).mtime.toISOString()
  } catch {
    return undefined
  }
}

function determineArtifactStatus(
  repoRoot: string,
  relativePath: string,
  baselineTimestamp: number
): IntelligenceArtifactStatusKind {
  const absolutePath = join(repoRoot, relativePath)
  if (!existsSync(absolutePath)) return 'MISSING'

  try {
    const content = JSON.parse(readFileSync(absolutePath, 'utf-8')) as { schema_version?: string }
    if (!content.schema_version) return 'INVALID'
  } catch {
    return 'INVALID'
  }

  try {
    const modifiedTime = statSync(absolutePath).mtime.getTime()
    if (modifiedTime < baselineTimestamp) return 'STALE'
  } catch {
    return 'INVALID'
  }

  return 'CURRENT'
}

function overallStatus(artifacts: IntelligenceArtifactStatus[]): IntelligenceArtifactStatusKind {
  if (artifacts.some((artifact) => artifact.status === 'INVALID')) return 'INVALID'
  if (artifacts.some((artifact) => artifact.status === 'MISSING')) return 'MISSING'
  if (artifacts.some((artifact) => artifact.status === 'STALE')) return 'STALE'
  return 'CURRENT'
}

export function inspectArchitectureIntelligence(repoRoot: string): {
  snapshot: ArchitectureIntelligenceSnapshot
  findings: HealthFinding[]
} {
  const baselinePath = join(repoRoot, 'docs/architecture/intelligence/ARCHITECTURE_MAP.json')
  const baselineTimestamp = existsSync(baselinePath) ? statSync(baselinePath).mtime.getTime() : 0

  const artifacts: IntelligenceArtifactStatus[] = REQUIRED_ARTIFACTS.map((artifact) => {
    const absolutePath = join(repoRoot, artifact.path)
    return {
      artifact_name: artifact.artifact_name,
      path: artifact.path,
      required: true,
      exists: existsSync(absolutePath),
      status: determineArtifactStatus(repoRoot, artifact.path, baselineTimestamp),
      last_modified_at: toIsoTimestamp(absolutePath),
      validator: artifact.validator,
    }
  })

  const validation_status = overallStatus(artifacts)
  const findings: HealthFinding[] = artifacts
    .filter((artifact) => artifact.status !== 'CURRENT')
    .map((artifact) => ({
      finding_id: `intelligence-${artifact.artifact_name}-${artifact.status.toLowerCase()}`,
      signal_ids: ['intelligence_synchronization'],
      classification: 'synchronization',
      severity: artifact.status === 'INVALID' || artifact.status === 'MISSING' ? 'high' : 'medium',
      impacted_surface: artifact.path,
      message: `${artifact.artifact_name} is ${artifact.status.toLowerCase()}`,
      remediation:
        artifact.validator ??
        'Refresh AI context artifacts and rerun the architecture health scanner',
      source_tools: ['architecture-health'],
    }))

  return {
    snapshot: {
      snapshot_id: `${validation_status.toLowerCase()}-${artifacts.length}`,
      artifacts,
      validation_status,
      validation_notes:
        validation_status === 'CURRENT'
          ? 'All required architecture intelligence artifacts are present and current.'
          : 'One or more required architecture intelligence artifacts are stale, missing, or invalid.',
    },
    findings,
  }
}

export function createRefreshResolutionFinding(
  previousStatus: IntelligenceArtifactStatusKind,
  currentStatus: IntelligenceArtifactStatusKind
): HealthFinding {
  return {
    finding_id: `intelligence-refresh-${previousStatus.toLowerCase()}-to-${currentStatus.toLowerCase()}`,
    signal_ids: ['intelligence_synchronization'],
    classification: 'synchronization',
    severity: currentStatus === 'CURRENT' ? 'low' : 'medium',
    impacted_surface: 'docs/ai/context',
    message: `Architecture intelligence refresh follow-up moved synchronization from ${previousStatus} to ${currentStatus}.`,
    remediation:
      currentStatus === 'CURRENT'
        ? 'Refresh completed successfully; keep generated context committed with the implementation.'
        : 'Review the regenerated AI context artifacts and rerun validation until synchronization is current.',
    source_tools: ['ai-context:refresh', 'arch:validate-brain'],
  }
}
