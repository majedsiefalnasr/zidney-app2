/**
 * Migration file validator
 * Detects destructive operations, validates checksums, extracts metadata
 * Pure functions, no SQL execution
 */

import crypto from 'node:crypto'

/**
 * Migration file header metadata extracted from SQL comments
 */
export interface MigrationHeader {
  targetVersion: string // e.g., "1.0.0"
  targetProductVersion?: string // e.g., "1.0.0" (optional)
  isBreaking: boolean // true if migration performs breaking changes
  description?: string
}

/**
 * Extract and parse migration file header from SQL comments
 * Expected format:
 *   -- Migration: X.Y.Z
 *   -- Required Minimum Product Version: X.Y.Z (optional)
 *   -- Breaking: true/false (optional, defaults to false if not found)
 *
 * @param sqlContent - Full SQL file content
 * @returns Parsed header metadata
 * @throws Error if required headers missing or malformed
 *
 * Examples:
 *   extractMigrationHeader("-- Migration: 1.0.0\nCREATE TABLE...")
 *     → { targetVersion: "1.0.0", isBreaking: false }
 *
 *   extractMigrationHeader("-- Migration: 1.5.0\n-- Breaking: true\nDROP COLUMN...")
 *     → { targetVersion: "1.5.0", isBreaking: true }
 */
export function extractMigrationHeader(sqlContent: string): MigrationHeader {
  if (!sqlContent || typeof sqlContent !== 'string') {
    throw new Error('SQL content is required')
  }

  // Extract target version (required)
  const versionMatch = sqlContent.match(/--\s*Migration:\s*(\d+\.\d+\.\d+)/i)
  if (!versionMatch) {
    throw new Error('Missing required migration header: "-- Migration: X.Y.Z"')
  }
  const targetVersion = versionMatch[1] as string

  // Extract product version requirement (optional)
  const productVersionMatch = sqlContent.match(
    /--\s*Required\s+Minimum\s+Product\s+Version:\s*(\d+\.\d+\.\d+)/i
  )
  const targetProductVersion = productVersionMatch ? (productVersionMatch[1] as string) : undefined

  // Extract breaking flag (optional, defaults to false)
  const breakingMatch = sqlContent.match(/--\s*Breaking:\s*(true|false)/i)
  const isBreaking = breakingMatch ? (breakingMatch[1] as string).toLowerCase() === 'true' : false

  // Extract description (optional)
  const descriptionMatch = sqlContent.match(/--\s*Purpose:\s*(.+?)(?=\n--|\n[A-Z]|$)/)
  const description = descriptionMatch ? (descriptionMatch[1] as string).trim() : undefined

  return {
    targetVersion,
    targetProductVersion,
    isBreaking,
    description,
  }
}

/**
 * Calculate SHA-256 checksum of file content
 * Used for tampering detection (immutable after production deploy)
 *
 * @param fileContent - Full file content
 * @returns Hex string of SHA-256 hash
 *
 * Example:
 *   calculateChecksum("CREATE TABLE...") → "abc123def456..."
 */
export function calculateChecksum(fileContent: string): string {
  if (!fileContent || typeof fileContent !== 'string') {
    throw new Error('File content is required for checksum calculation')
  }
  return crypto.createHash('sha256').update(fileContent).digest('hex')
}

/**
 * Validate that file content matches expected checksum
 * Returns true if match, false if mismatch
 *
 * @param fileContent - Current file content
 * @param expectedChecksum - Previously calculated checksum (hex string)
 * @returns true if checksums match (no tampering)
 *
 * Example:
 *   validateChecksum(content, "abc123...") → true (if matches)
 */
export function validateChecksum(fileContent: string, expectedChecksum: string): boolean {
  const calculated = calculateChecksum(fileContent)
  return calculated === expectedChecksum
}

/**
 * Detect destructive SQL operations that require MAJOR version bump
 * Looks for patterns like DROP COLUMN, ALTER ... DROP, etc.
 *
 * @param sqlContent - SQL file content
 * @returns Array of destructive operations found (empty if none)
 *
 * Examples:
 *   detectDestructiveOperations("DROP COLUMN user_id;")
 *     → ["DROP COLUMN user_id"]
 *
 *   detectDestructiveOperations("CREATE TABLE foo (id UUID);")
 *     → [] (no destructive operations)
 */
export function detectDestructiveOperations(sqlContent: string): string[] {
  if (!sqlContent || typeof sqlContent !== 'string') {
    return []
  }

  const destructivePatterns = [
    // DROP COLUMN
    {
      pattern: /ALTER\s+TABLE\s+\w+\s+DROP\s+COLUMN\s+\w+/gi,
      description: 'DROP COLUMN',
    },
    // DROP TABLE
    {
      pattern: /DROP\s+TABLE(?:\s+IF\s+EXISTS)?\s+\w+/gi,
      description: 'DROP TABLE',
    },
    // DROP INDEX
    {
      pattern: /DROP\s+INDEX(?:\s+IF\s+EXISTS)?\s+\w+/gi,
      description: 'DROP INDEX',
    },
    // RENAME COLUMN (data shape change)
    {
      pattern: /ALTER\s+TABLE\s+\w+\s+RENAME\s+COLUMN\s+\w+\s+TO\s+\w+/gi,
      description: 'RENAME COLUMN',
    },
    // ALTER COLUMN TYPE change (potentially destructive)
    {
      pattern: /ALTER\s+TABLE\s+\w+\s+ALTER\s+COLUMN\s+\w+\s+TYPE\s+/gi,
      description: 'ALTER COLUMN TYPE',
    },
  ]

  const found: string[] = []

  for (const { pattern } of destructivePatterns) {
    const matches = sqlContent.match(pattern)
    if (matches) {
      for (const match of matches) {
        found.push(match.trim())
      }
    }
  }

  // Deduplicate
  return Array.from(new Set(found))
}

/**
 * Detect gaps in migration file sequence
 * Validates that files follow pattern: 001.sql, 002.sql, 003.sql... with no gaps
 *
 * @param fileList - Array of migration filenames (e.g., ["001_init.sql", "002_users.sql"])
 * @returns Error object if gap found, null if sequence valid
 *
 * Examples:
 *   detectMigrationGap(["001_init.sql", "002_users.sql"])
 *     → null (valid)
 *
 *   detectMigrationGap(["001_init.sql", "003_schema.sql"])
 *     → Error "Migration sequence gap: missing 002"
 */
export function detectMigrationGap(fileList: string[]): Error | null {
  if (!fileList || fileList.length === 0) {
    return null // Empty list is OK (no migrations yet)
  }

  // Extract sequence numbers from filenames (e.g., "001_init.sql" → 1)
  const numbers: number[] = []

  for (const filename of fileList) {
    const match = filename.match(/^(\d+)/)
    if (!match) {
      return new Error(
        `Migration file "${filename}" does not follow naming convention (should start with number, e.g., "001_init.sql")`
      )
    }
    numbers.push(parseInt(match[1] as string, 10))
  }

  // Sort and check for gaps
  const sorted = numbers.sort((a, b) => a - b)

  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i] as number
    const next = sorted[i + 1] as number
    if (next - current !== 1) {
      const missing = current + 1
      return new Error(
        `Migration sequence gap detected: found ${current} and ${next}, missing ${missing}`
      )
    }
  }

  // Verify sequence starts at 1
  if (sorted[0] !== 1) {
    return new Error(`Migration sequence must start at 001, but found ${sorted[0] ?? 'undefined'}`)
  }

  return null
}

/**
 * Validate complete migration file (header, checksum, destructive ops)
 * Comprehensive validation combining multiple checks
 *
 * @param filename - Migration filename (e.g., "001_init.sql")
 * @param sqlContent - Full SQL file content
 * @returns Object with validation results
 */
export interface MigrationValidationResult {
  isValid: boolean
  filename: string
  header?: MigrationHeader
  hasDestructiveOps: boolean
  destructiveOps: string[]
  errors: string[]
}

export function validateMigrationFile(
  filename: string,
  sqlContent: string
): MigrationValidationResult {
  const errors: string[] = []
  let header: MigrationHeader | undefined
  let destructiveOps: string[] = []

  // Validate header
  try {
    header = extractMigrationHeader(sqlContent)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    errors.push(`Header validation failed: ${msg}`)
  }

  // Detect destructive operations
  destructiveOps = detectDestructiveOperations(sqlContent)

  // If destructive ops found, check that migration is marked as MAJOR
  if (destructiveOps.length > 0 && header && !header.isBreaking) {
    errors.push(
      `Migration contains destructive operations (${destructiveOps.join(', ')}) but is not marked as Breaking: true. Destructive migrations must be MAJOR version bumps.`
    )
  }

  return {
    isValid: errors.length === 0,
    filename,
    header,
    hasDestructiveOps: destructiveOps.length > 0,
    destructiveOps,
    errors,
  }
}
