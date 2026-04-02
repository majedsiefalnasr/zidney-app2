/**
 * Auto-Selection Selector Primitives
 *
 * Pure functions for deterministic, seeded question selection.
 * No HTTP, no framework dependencies, no side effects.
 *
 * Algorithm: Mulberry32 PRNG seeded from selection_seed, applied
 * to Fisher-Yates in-place shuffle. Same seed + same ordered pool
 * yields identical selected IDs every time.
 *
 * Stage: STAGE_39_AUTO_SELECTION_ENGINE
 * Task: T015
 */

// ── PRNG (Mulberry32) ────────────────────────────────────────────────────────

/**
 * Derive a 32-bit unsigned integer seed from an arbitrary string.
 * Uses FNV-1a-like mixing for distribution quality.
 */
export function deriveSeedInt(seed: string): number {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return h >>> 0
}

/**
 * Mulberry32 PRNG factory. Returns a function that yields floats in [0, 1).
 */
export function makePrng(seedInt: number): () => number {
  let s = seedInt
  return (): number => {
    s += 0x6d2b79f5
    let z = s
    z = Math.imul(z ^ (z >>> 15), z | 1)
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61)
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296
  }
}

// ── Core shuffle ─────────────────────────────────────────────────────────────

/**
 * Fisher-Yates in-place shuffle using a seeded PRNG.
 *
 * @returns A new shuffled array (does not mutate input).
 */
export function seededShuffle(ids: readonly string[], seed: string): string[] {
  const result = [...ids]
  const rand = makePrng(deriveSeedInt(seed))
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    // biome-ignore lint/style/noNonNullAssertion: bounds guaranteed
    ;[result[i]!, result[j]!] = [result[j]!, result[i]!]
  }
  return result
}

// ── Selection entry point ────────────────────────────────────────────────────

/**
 * Select `count` IDs from an eligible pool using deterministic seeded shuffle.
 *
 * Pool must already be deduplicated and sorted before calling (caller's
 * responsibility — sort by e.g. ID to guarantee stable ordering).
 *
 * @throws If pool is smaller than requested count.
 */
export function selectFromPool(
  pool: readonly string[],
  count: number,
  seed: string
): string[] {
  if (count > pool.length) {
    throw new Error(
      `Insufficient pool: need ${count} but got ${pool.length}`
    )
  }
  if (count === pool.length) {
    return [...pool]
  }
  return seededShuffle(pool, seed).slice(0, count)
}

// ── Candidate pool fingerprint ───────────────────────────────────────────────

/**
 * Compute a lightweight string fingerprint from a set of candidate IDs.
 *
 * Fingerprint is stable: order-independent sorted join.
 * Used to detect silent pool drift between two selection runs.
 */
export function computePoolFingerprint(candidateIds: readonly string[]): string {
  return [...candidateIds].sort().join(',')
}

// ── Count resolver ───────────────────────────────────────────────────────────

/**
 * Resolve the absolute question count for a criteria block.
 *
 * @param totalQuestions - Exam-configured total question count
 * @param percentage - Selection percentage (1-100), or null
 * @param fixedCount - Fixed integer count, or null
 */
export function resolveBlockCount(
  totalQuestions: number,
  percentage: number | null,
  fixedCount: number | null
): number {
  if (fixedCount != null) {
    return fixedCount
  }
  if (percentage != null) {
    return Math.round((percentage / 100) * totalQuestions)
  }
  throw new Error(
    'resolveBlockCount: either percentage or fixedCount must be provided'
  )
}
