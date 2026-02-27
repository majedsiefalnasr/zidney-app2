/**
 * Password Hashing Utilities
 *
 * File: packages/domain-core/src/utils/password.ts
 * Task: T035
 * Phase: 5 - Authentication & Session Management
 *
 * Password hashing and comparison using bcrypt
 */

// @ts-ignore: bcryptjs not declared as dependency of domain-core [INFRA-001-DEPS-01]
import * as bcrypt from 'bcryptjs'

const BCRYPT_COST = 12

/**
 * Hash password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST)
}

/**
 * Compare password with hash
 */
export async function comparePassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

/**
 * Check if string looks like bcrypt hash (for sanity checks)
 */
export function isBcryptHash(value: string): boolean {
  // Bcrypt hashes start with $2a$, $2b$, $2x$, or $2y$ and are 60 characters long
  return /^\$2[aby]\$\d{2}\$/.test(value) && value.length >= 59
}
