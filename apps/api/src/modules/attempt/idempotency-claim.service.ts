/**
 * Idempotency Claim Service — Attempt Start
 *
 * File: apps/api/src/modules/attempt/idempotency-claim.service.ts
 * Stage: STAGE_39_AUTO_SELECTION_ENGINE
 * Task: T046
 *
 * Exactly-once semantics for attempt start operations.
 *
 * Lifecycle:
 *   1. `findExistingClaim` — check for an existing claim before the advisory lock
 *   2. `claimIdempotencyKey` — atomically INSERT the claim inside the advisory lock
 *   3. `verifyPayloadHash` — compare request hash against stored hash on replay
 *
 * All writes take a PoolClient — they must run inside the transaction that
 * holds the advisory lock. No commits or rollbacks here.
 *
 * ADRs: ADR-0001 (workspace isolation)
 */

import { createLogger } from '@zidney/logger'
import type { PoolClient } from 'pg'

const logger = createLogger('idempotency-claim')

// ── TTL ───────────────────────────────────────────────────────────────────────

/** Idempotency claims expire after 24 hours by default. */
const CLAIM_TTL_MS = 24 * 60 * 60 * 1000

// ── Types ─────────────────────────────────────────────────────────────────────

export interface IdempotencyClaim {
  id: string
  workspace_id: string
  user_id: string
  exam_id: string
  idempotency_key: string
  attempt_id: string | null
  payload_hash: string | null
  claimed_at: Date
  expires_at: Date
}

export interface ClaimIdempotencyKeyInput {
  client: PoolClient
  workspaceId: string
  userId: string
  examId: string
  idempotencyKey: string
  /** UUID of the attempt being started — stored for replay response. */
  attemptId: string
  /** SHA-256 hex of the request body — used to detect payload conflicts. */
  payloadHash: string
}

export interface FindExistingClaimInput {
  client: PoolClient
  workspaceId: string
  userId: string
  examId: string
  idempotencyKey: string
}

// ── Queries ───────────────────────────────────────────────────────────────────

/**
 * Look up an existing idempotency claim for the given key.
 * Returns null when no claim exists or the claim has expired.
 */
export async function findExistingClaim(
  input: FindExistingClaimInput
): Promise<IdempotencyClaim | null> {
  const { client, workspaceId, userId, examId, idempotencyKey } = input

  const result = await client.query(
    `
    SELECT *
    FROM attempt_start_idempotency_claims
    WHERE workspace_id = $1
      AND user_id       = $2
      AND exam_id       = $3
      AND idempotency_key = $4
      AND expires_at > NOW()
    LIMIT 1
    `,
    [workspaceId, userId, examId, idempotencyKey]
  )

  return (result.rows[0] as IdempotencyClaim | undefined) ?? null
}

/**
 * Atomically insert a new idempotency claim.
 *
 * Must be called AFTER acquiring the advisory lock and BEFORE any side effects.
 * The INSERT uses ON CONFLICT DO NOTHING; callers must call `findExistingClaim`
 * first to distinguish new claims from replay.
 *
 * @throws Error on unexpected database failure
 */
export async function claimIdempotencyKey(input: ClaimIdempotencyKeyInput): Promise<void> {
  const { client, workspaceId, userId, examId, idempotencyKey, attemptId, payloadHash } = input

  const expiresAt = new Date(Date.now() + CLAIM_TTL_MS)

  const result = await client.query(
    `
    INSERT INTO attempt_start_idempotency_claims
      (workspace_id, user_id, exam_id, idempotency_key, attempt_id, payload_hash, expires_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (workspace_id, user_id, exam_id, idempotency_key) DO NOTHING
    `,
    [workspaceId, userId, examId, idempotencyKey, attemptId, payloadHash, expiresAt]
  )

  if (result.rowCount === 0) {
    // Another concurrent request already claimed this key milliseconds ago —
    // treat as if the claim already existed. Callers re-check findExistingClaim.
    logger.warn('idempotency-claim: conflict on insert — key already claimed', {
      workspaceId,
      userId,
      examId,
      idempotencyKey,
    })
  }
}

/**
 * Verify that the request payload hash matches the stored claim hash.
 *
 * Returns true when hashes match (safe replay) or when the stored hash is null
 * (legacy claim without hash — allow replay).
 * Returns false when hashes differ (IDEMPOTENCY_CONFLICT).
 */
export function verifyPayloadHash(claim: IdempotencyClaim, requestHash: string): boolean {
  if (claim.payload_hash == null) return true
  const match = claim.payload_hash === requestHash
  if (!match) {
    logger.warn('idempotency-claim: payload hash mismatch — conflict', {
      stored: claim.payload_hash,
      request: requestHash,
    })
  }
  return match
}
