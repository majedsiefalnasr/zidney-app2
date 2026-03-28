/** @library-module */
import type { GovernanceCommandSpec } from './source-runner'
import { resolveGovernanceCommand } from './source-runner'
import type { HealthFinding } from './types'

export interface GitNexusEnrichmentPlan {
  query: GovernanceCommandSpec
  impact: GovernanceCommandSpec
}

export function buildGitNexusEnrichmentPlan(
  queryText: string,
  impactTarget: string
): GitNexusEnrichmentPlan {
  return {
    query: {
      ...resolveGovernanceCommand('gitnexus_query'),
      args: ['query', queryText],
    },
    impact: {
      ...resolveGovernanceCommand('gitnexus_impact'),
      args: ['impact', impactTarget],
    },
  }
}

export function createGitNexusUnavailableFinding(reason: string): HealthFinding {
  return {
    finding_id: 'gitnexus-enrichment-unavailable',
    signal_ids: ['architecture_drift'],
    classification: 'drift',
    severity: 'medium',
    impacted_surface: 'gitnexus',
    message: `GitNexus enrichment unavailable: ${reason}`,
    remediation: 'Run npx gitnexus analyze and re-run the architecture health scanner',
    source_tools: ['gitnexus'],
  }
}

export function createGitNexusExecutionFinding(
  tool: 'query' | 'impact',
  stderr: string
): HealthFinding {
  return {
    finding_id: `gitnexus-${tool}-failed`,
    signal_ids: ['architecture_drift'],
    classification: 'drift',
    severity: 'medium',
    impacted_surface: `gitnexus ${tool}`,
    message: `GitNexus ${tool} failed during architecture-health enrichment.`,
    remediation: stderr.trim() || 'Run npx gitnexus analyze and verify the GitNexus CLI arguments.',
    source_tools: ['gitnexus'],
  }
}
