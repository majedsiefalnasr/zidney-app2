/**
 * Migration Loader: Dynamic migration file discovery and loading
 *
 * Responsibilities:
 * - Scan migrations directory
 * - Dynamically import migration files
 * - Extract version from filename
 * - Validate file format
 *
 * File: apps/api/src/db/master/loader.ts
 * Task: T003
 * Phase: 1 - Migration Infrastructure
 */

import fs from 'fs/promises'
import path from 'path'
import { PoolClient } from 'pg'

export interface Migration {
  version: string
  description: string
  up: (client: PoolClient) => Promise<void>
}

export class MigrationLoader {
  /**
   * Load all migration files from directory
   *
   * File naming convention: YYYYMMDD_###_description.ts
   * Example: 20250102_001_create_tenants_registry.ts
   *
   * Returns: Array of Migration objects sorted by version
   */
  async loadMigrations(migrationDir: string): Promise<Migration[]> {
    try {
      // Read directory
      const files = await fs.readdir(migrationDir)

      // Filter TypeScript files
      const tsFiles = files.filter(
        (f) => f.endsWith('.ts') && !f.endsWith('.d.ts')
      )

      const migrations: Migration[] = []

      for (const file of tsFiles) {
        const version = this.extractVersion(file)

        if (!version) {
          // Skip files with invalid naming convention silently
          // (e.g., .d.ts files or non-migration files)
          continue
        }

        try {
          const modulePath = path.join(migrationDir, file)
          const module = await import(modulePath)

          const migration: Migration = {
            version,
            description: module.description || file,
            up: module.up,
          }

          if (typeof migration.up !== 'function') {
            throw new Error(`Migration ${version} missing 'up' function`)
          }

          migrations.push(migration)
        } catch (error) {
          throw new Error(
            `Failed to load migration ${file}: ${
              error instanceof Error ? error.message : 'Unknown error'
            }`
          )
        }
      }

      return migrations
    } catch (error) {
      throw new Error(
        `Failed to load migrations from ${migrationDir}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      )
    }
  }

  /**
   * Extract version from filename
   *
   * Valid format: YYYYMMDD_###_description.ts
   * Example: 20250102_001_create_tenants_registry.ts
   * Extracted: 20250102001
   */
  private extractVersion(filename: string): string | null {
    const match = filename.match(/^(\d{8})_(\d{3})_/)
    if (!match) {
      return null
    }

    return `${match[1]}${match[2]}`
  }
}

export default MigrationLoader
