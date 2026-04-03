/**
 * Staff Password Hashing & Verification (Argon2id)
 *
 * File: packages/domain-core/src/auth/staff-password.ts
 * Stage: STAGE_41_STAFF_MANAGEMENT
 *
 * Purpose:
 * Secure password hashing and verification for backoffice staff accounts.
 * Uses Argon2id — the OWASP/NIST recommended algorithm as of 2024.
 *
 * Parameters (OWASP Argon2id minimum recommendations):
 *   - Algorithm:   Argon2id (resistant to both side-channel and GPU attacks)
 *   - memoryCost:  65536 KB (64 MiB)
 *   - timeCost:    3 iterations
 *   - parallelism: 4 lanes
 *
 * Security Properties:
 *   - Memory-hard: GPU/ASIC attacks infeasible at 64 MiB per hash
 *   - Time-hard: Multiple passes prevent speed-up attacks
 *   - Side-channel resistant: hybrid d-node design in Argon2id
 *   - Constant-time comparison: argon2.verify() uses constant-time internally
 *
 * Compliance:
 *   - OWASP Password Storage CS 2024 (Argon2id with ≥19 MiB, ≥2 iterations)
 *   - NIST SP 800-63B Rev 4 (memory-hard KDF required)
 *
 * DUMMY_HASH contract:
 *   generateStaffDummyHash() returns a pre-computed constant string.
 *   It is synchronous and is ONLY used for timing-attack-safe negative path
 *   in login flows (to avoid revealing whether the email exists).
 *   The hash purposely will NOT match any real password.
 */

import argon2 from 'argon2'
import { StaffError } from '../staff/staff.errors'

// ---------------------------------------------------------------------------
// Argon2id parameters
// ---------------------------------------------------------------------------

const ARGON2_OPTIONS: argon2.Options & { raw: false } = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
  raw: false,
}

// Pre-computed dummy hash for timing-safe negative-path login.
// Generated with: argon2.hash('__dummy_staff_seed__', ARGON2_OPTIONS)
// Must be a valid PHC string so argon2.verify runs the full expensive computation
// (not a fast parse failure) — this prevents timing-based email enumeration.
const STAFF_DUMMY_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$QGRFQ/Ifjrv45NdkySnNLg$cbqtUlzBf2p3ZBpjE5p5eWApooDK49bx+c39Bc6sUtM'

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Hash a plaintext staff password using Argon2id.
 *
 * @param password - Plaintext password (must be non-empty)
 * @returns Argon2id encoded hash string (~97 characters)
 * @throws Error if password is empty or hashing fails
 */
export async function hashStaffPassword(password: string): Promise<string> {
  if (!password || typeof password !== 'string' || password.length === 0) {
    throw new StaffError('STAFF_INVALID_PASSWORD', 'Password must be a non-empty string')
  }
  return argon2.hash(password, ARGON2_OPTIONS)
}

/**
 * Verify a plaintext staff password against an Argon2id hash.
 *
 * @param hash    - Argon2id encoded hash from the database
 * @param password - Plaintext password attempt
 * @returns true if the password matches, false otherwise
 */
export async function verifyStaffPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password)
  } catch {
    return false
  }
}

/**
 * Return a pre-computed dummy hash for timing-safe negative-path login.
 *
 * Used when no staff account is found for a given email:
 * run verifyStaffPassword(generateStaffDummyHash(), password) to spend
 * equivalent time as a real verification, preventing email enumeration
 * via timing side-channel.
 *
 * This function is SYNCHRONOUS — it returns a constant, never computes.
 *
 * @returns A constant Argon2id-formatted dummy hash string
 */
export function generateStaffDummyHash(): string {
  return STAFF_DUMMY_HASH
}
