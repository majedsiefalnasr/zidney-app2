import { mmc_members } from '@zidney/types/db-schema'
import { randomBytes } from 'crypto'
import { eq } from 'drizzle-orm'
import type { Database } from 'drizzle-orm/node-postgres'

/**
 * Generate a random alphanumeric suffix for username
 */
function generateRandomSuffix(length: number = 8): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  const bytes = randomBytes(length)

  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length]
  }

  return result
}

/**
 * Generate username from email prefix
 * Extracts the part before @ and normalizes it
 */
function generateUsernameFromEmail(email: string): string {
  const prefix = email.split('@')[0]

  // Normalize: lowercase, remove special chars, keep only alphanumeric and dots/underscores
  const normalized = prefix
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '')
    .slice(0, 20) // Max 20 chars for prefix

  if (!normalized) {
    return `user_${generateRandomSuffix(8)}`
  }

  return normalized
}

/**
 * Generate a unique username by combining email prefix with random suffix
 * Checks database to ensure username is unique
 */
export async function generateUniqueUsername(
  email: string,
  db: Database,
  maxAttempts: number = 10
): Promise<string> {
  const baseUsername = generateUsernameFromEmail(email)

  // Try without suffix first
  if (baseUsername.length > 0) {
    const existing = await db.query.mmc_members.findFirst({
      where: eq(mmc_members.username, baseUsername),
    })

    if (!existing) {
      return baseUsername
    }
  }

  // Add random suffix until we find a unique one
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const suffix = generateRandomSuffix(8)
    const candidate =
      baseUsername.length > 0
        ? `${baseUsername}_${suffix}`.slice(0, 30) // Max 30 chars total
        : `user_${suffix}`

    const existing = await db.query.mmc_members.findFirst({
      where: eq(mmc_members.username, candidate),
    })

    if (!existing) {
      return candidate
    }
  }

  // Fallback if we can't find unique after maxAttempts
  return `user_${Date.now()}_${generateRandomSuffix(4)}`
}

/**
 * Validate username format (alphanumeric, dots, underscores, hyphens)
 */
export function isValidUsername(username: string): boolean {
  if (!username || username.length < 3 || username.length > 30) {
    return false
  }

  return /^[a-z0-9._-]+$/i.test(username)
}

/**
 * Validate username uniqueness in database
 */
export async function isUsernameUnique(
  username: string,
  db: Database
): Promise<boolean> {
  const existing = await db.query.mmc_members.findFirst({
    where: eq(mmc_members.username, username),
  })

  return !existing
}
