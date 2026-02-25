import { createHash, randomBytes } from 'crypto'

/**
 * Generate a random token suitable for one-time use invitations
 * Returns a 32-byte random string encoded as hex (64 characters)
 */
export function generateInvitationToken(): string {
  const buffer = randomBytes(32)
  return buffer.toString('hex')
}

/**
 * Hash a token using SHA256
 * Used for storing token hashes in database (never store plaintext)
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/**
 * Verify a token against its hash
 * Safe comparison to prevent timing attacks
 */
export function verifyTokenHash(token: string, tokenHash: string): boolean {
  const computed = hashToken(token)
  // Use timingSafeEqual for constant-time comparison
  const { timingSafeEqual } = require('crypto')

  try {
    return timingSafeEqual(Buffer.from(computed), Buffer.from(tokenHash))
  } catch {
    // Length mismatch or other error - hashes don't match
    return false
  }
}

/**
 * Generate and hash a token in one operation
 * Returns both plaintext (for email) and hash (for DB storage)
 */
export function generateAndHashToken(): {
  plaintext: string
  hash: string
} {
  const plaintext = generateInvitationToken()
  const hash = hashToken(plaintext)
  return { plaintext, hash }
}
