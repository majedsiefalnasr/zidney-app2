import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

function getErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message
  if (typeof e === 'object' && e !== null && 'message' in e) {
    const m = (e as { message?: unknown }).message
    return typeof m === 'string' ? m : String(m)
  }
  return String(e)
}

/**
 * T052: Migration File Generator
 * Creates versioned migration files with checksums
 */

export interface GeneratedMigration {
  filePath: string
  checksum: string
  version: string
  migrationType: 'major' | 'minor' | 'patch'
}

/**
 * Generate migration file with transaction wrapper
 * @param options - Generation options
 * @returns Generated migration metadata
 */
export function generateMigrationFile(options: {
  version: string
  changeType: 'major' | 'minor' | 'patch'
  sqlStatements: string[]
  outputDir?: string
}): GeneratedMigration {
  const { version, changeType, sqlStatements } = options
  const outputDir = options.outputDir || `apps/api/src/db/tenant/migrations/v${version}`

  // Ensure directory exists
  try {
    mkdirSync(outputDir, { recursive: true })
  } catch (err: unknown) {
    const msg = getErrorMessage(err)
    // mkdirSync with recursive should not usually throw, but guard anyway
    if (!msg.includes('EEXIST')) {
      throw new Error(`Failed to create migration directory: ${msg}`)
    }
  }

  // Wrap SQL in transaction
  const wrappedSQL = generateTransactionWrapper(sqlStatements)

  // Calculate checksum before writing
  const checksum = createHash('sha256').update(wrappedSQL).digest('hex')

  // Generate file path
  const filePath = join(outputDir, 'migration.sql')

  // Write file
  try {
    writeFileSync(filePath, wrappedSQL, 'utf-8')
  } catch (err: unknown) {
    throw new Error(`Failed to write migration file: ${getErrorMessage(err)}`)
  }

  return {
    filePath,
    checksum,
    version,
    migrationType: changeType,
  }
}

/**
 * Wrap SQL statements in transaction with safety guards
 */
function generateTransactionWrapper(sqlStatements: string[]): string {
  const header = `-- Migration Generated: ${new Date().toISOString()}
-- Wrapped in transaction for atomicity

BEGIN TRANSACTION ISOLATION LEVEL READ COMMITTED;

-- Lock timeout prevents stuck migrations
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

`

  const footer = `
-- Migration complete
COMMIT;

-- Verify schema_version update if not already done
-- This should be handled by the worker task
`

  // Combine all statements, cleaning up extra semicolons
  const cleanStatements = sqlStatements
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => (s.endsWith(';') ? s : `${s};`))
    .join('\n\n')

  return header + cleanStatements + footer
}

/**
 * Generate migration metadata file (for documentation)
 */
export function generateMigrationMetadata(options: {
  version: string
  changeType: string
  fromVersion: string
  description: string
  author: string
  checksum: string
}): string {
  const metadata = `{
  "version": "${options.version}",
  "changeType": "${options.changeType}",
  "fromVersion": "${options.fromVersion}",
  "description": "${options.description}",
  "author": "${options.author}",
  "timestamp": "${new Date().toISOString()}",
  "checksum": "${options.checksum}",
  "status": "pending"
}
`
  return metadata
}

/**
 * Validate generated migration SQL for common issues
 */
export function validateMigrationSQL(sql: string): {
  valid: boolean
  issues: string[]
} {
  const issues: string[] = []

  // Check for dangerous patterns (not exhaustive, for safety only)
  if (sql.includes('DROP TABLE') && !sql.includes('IF EXISTS')) {
    issues.push('DROP TABLE without IF EXISTS detected')
  }

  if (sql.includes('DELETE FROM') && !sql.includes('WHERE')) {
    issues.push('DELETE without WHERE clause detected (will delete all records)')
  }

  // Check for proper transaction wrapping
  if (!sql.toUpperCase().includes('BEGIN')) {
    issues.push('Migration not wrapped in BEGIN transaction')
  }

  if (!sql.toUpperCase().includes('COMMIT')) {
    issues.push('Migration does not end with COMMIT')
  }

  return {
    valid: issues.length === 0,
    issues,
  }
}
