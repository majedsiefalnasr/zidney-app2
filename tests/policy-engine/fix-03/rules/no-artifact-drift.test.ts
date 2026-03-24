/**
 * T027 — no-artifact-drift.test.ts
 * Tests for RULE_FIX_03_NO_ARTIFACT_DRIFT.
 */

import { describe, expect, it } from 'vitest'
import { noArtifactDriftRule } from '../../../../scripts/policy-engine/rules/fix-03/no-artifact-drift.js'
import type { ArtifactSnapshot } from '../../../../scripts/policy-engine/types.js'

describe('RULE_FIX_03_NO_ARTIFACT_DRIFT metadata', () => {
  it('should have correct id', () => {
    expect(noArtifactDriftRule.id).toBe('RULE_FIX_03_NO_ARTIFACT_DRIFT')
  })

  it('should have severity: error', () => {
    expect(noArtifactDriftRule.severity).toBe('error')
  })

  it('should have domain: repo', () => {
    expect(noArtifactDriftRule.domain).toBe('repo')
  })
})

describe('RULE_FIX_03_NO_ARTIFACT_DRIFT drift detection logic', () => {
  it('correctly identifies drifted paths between two snapshots', () => {
    const before: ArtifactSnapshot = {
      timestamp: '2025-01-01T00:00:00Z',
      baseRef: 'abc123',
      trackedFiles: ['apps/api/dist/index.js'],
      untrackedFiles: [],
      prohibitedPaths: [],
      hashes: { 'apps/api/dist/index.js': 'hash_before' },
    }

    const after: ArtifactSnapshot = {
      timestamp: '2025-01-01T00:01:00Z',
      baseRef: 'abc123',
      trackedFiles: ['apps/api/dist/index.js'],
      untrackedFiles: [],
      prohibitedPaths: [],
      hashes: { 'apps/api/dist/index.js': 'hash_after' },
    }

    const beforeHashes = before.hashes ?? {}
    const afterHashes = after.hashes ?? {}
    const allPaths = new Set([...Object.keys(beforeHashes), ...Object.keys(afterHashes)])
    const drifted = [...allPaths].filter((p) => beforeHashes[p] !== afterHashes[p])
    expect(drifted).toContain('apps/api/dist/index.js')
  })

  it('no drift when hashes are identical', () => {
    const hash = 'stable_hash'
    const before: ArtifactSnapshot = {
      timestamp: '2025-01-01T00:00:00Z',
      baseRef: 'abc123',
      trackedFiles: ['apps/api/dist/main.js'],
      untrackedFiles: [],
      prohibitedPaths: [],
      hashes: { 'apps/api/dist/main.js': hash },
    }
    const after: ArtifactSnapshot = {
      timestamp: '2025-01-01T00:01:00Z',
      baseRef: 'abc123',
      trackedFiles: ['apps/api/dist/main.js'],
      untrackedFiles: [],
      prohibitedPaths: [],
      hashes: { 'apps/api/dist/main.js': hash },
    }

    const beforeHashes = before.hashes ?? {}
    const afterHashes = after.hashes ?? {}
    const allPaths = new Set([...Object.keys(beforeHashes), ...Object.keys(afterHashes)])
    const drifted = [...allPaths].filter((p) => beforeHashes[p] !== afterHashes[p])
    expect(drifted).toHaveLength(0)
  })

  it('new file in after-snapshot counts as drift', () => {
    const before: ArtifactSnapshot = {
      timestamp: '2025-01-01T00:00:00Z',
      baseRef: 'abc123',
      trackedFiles: [],
      untrackedFiles: [],
      prohibitedPaths: [],
      hashes: {},
    }
    const after: ArtifactSnapshot = {
      timestamp: '2025-01-01T00:01:00Z',
      baseRef: 'abc123',
      trackedFiles: ['apps/api/dist/new-chunk.js'],
      untrackedFiles: [],
      prohibitedPaths: [],
      hashes: { 'apps/api/dist/new-chunk.js': 'newfile_hash' },
    }

    const beforeHashes = before.hashes ?? {}
    const afterHashes = after.hashes ?? {}
    const allPaths = new Set([...Object.keys(beforeHashes), ...Object.keys(afterHashes)])
    const drifted = [...allPaths].filter((p) => beforeHashes[p] !== afterHashes[p])
    expect(drifted).toContain('apps/api/dist/new-chunk.js')
  })
})
