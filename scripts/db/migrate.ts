#!/usr/bin/env bun

/**
 * @script db:migrate
 * @domain db
 * @category runtime
 * @description Validate migration inputs and delegate master migration execution guidance.
 * @usage bun run db:migrate
 */

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { exit, hasCiFlag, log } from '../utils/logger'

log.setScript('db:migrate')

const REPO_ROOT = process.cwd()
const MASTER_MIGRATIONS = join(REPO_ROOT, 'apps/api/src/db/master/migrations')
const TENANT_MIGRATIONS = join(REPO_ROOT, 'apps/api/src/db/tenant/migrations')

interface ParsedArgs {
  workspace?: string
  migration?: string
  help: boolean
}

function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2)
  const getValue = (prefix: string) =>
    args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length)

  return {
    workspace: getValue('--workspace='),
    migration: getValue('--migration='),
    help: args.includes('--help') || args.includes('-h'),
  }
}

function printHelp(): void {
  log.header(
    'DB MIGRATE',
    'Validates migration inputs and reports the available migration surfaces'
  )
  log.info('Usage: bun run db:migrate [--workspace=<slug>] [--migration=<name>]')
  log.info('Examples:')
  log.info('  bun run db:migrate')
  log.info('  bun run db:migrate --migration=20260321_007_lessons.ts')
  log.info(
    '  bun run db:migrate --workspace=demo-school --migration=20260301_002_workflow_engine.ts'
  )
  log.result({ total: 1, passed: 1, failed: 0, message: 'Help displayed' })
}

function resolveMigrationPath(
  migration: string
): { path: string; scope: 'master' | 'tenant' } | null {
  const masterPath = join(MASTER_MIGRATIONS, migration)
  if (existsSync(masterPath)) {
    return { path: masterPath, scope: 'master' }
  }

  const tenantPath = join(TENANT_MIGRATIONS, migration)
  if (existsSync(tenantPath)) {
    return { path: tenantPath, scope: 'tenant' }
  }

  return null
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv)
  const isCi = hasCiFlag(process.argv.slice(2))

  if (args.help) {
    printHelp()
    exit(0)
  }

  log.header('DB MIGRATE', 'Checks migration prerequisites and reports the execution path')
  if (isCi) {
    log.info('[db:migrate] CI mode enabled')
  }

  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    log.warn('DATABASE_URL not set; skipping migration execution')
    log.result({
      total: 1,
      passed: 1,
      failed: 0,
      warnings: 1,
      status: 'warning',
      message: 'Migration skipped',
      details: {
        infraDependent: true,
      },
    })
    exit(0)
  }

  const masterExists = existsSync(MASTER_MIGRATIONS)
  const tenantExists = existsSync(TENANT_MIGRATIONS)

  if (!masterExists) {
    log.error(`Master migration directory not found: ${MASTER_MIGRATIONS}`)
    log.result({
      total: 1,
      passed: 0,
      failed: 1,
      message: 'Migration directories are incomplete',
      details: {
        masterMigrations: false,
        tenantMigrations: tenantExists,
      },
    })
    exit(1)
  }

  if (args.migration) {
    const resolvedMigration = resolveMigrationPath(args.migration)
    if (!resolvedMigration) {
      log.error(`Migration not found: ${args.migration}`)
      log.result({
        total: 1,
        passed: 0,
        failed: 1,
        message: 'Requested migration was not found',
      })
      exit(1)
    }

    if (resolvedMigration.scope === 'tenant' && !args.workspace) {
      log.warn('Tenant migration selected without --workspace; reporting only')
    }

    log.step(`Resolved ${resolvedMigration.scope} migration: ${resolvedMigration.path}`)
    log.info('Live migration execution is delegated to the API migration surface for now')
    log.result({
      total: 1,
      passed: 1,
      failed: 0,
      warnings: resolvedMigration.scope === 'tenant' && !args.workspace ? 1 : 0,
      status: resolvedMigration.scope === 'tenant' && !args.workspace ? 'warning' : 'success',
      message: 'Migration prerequisites validated',
      details: {
        masterMigrations: masterExists,
        tenantMigrations: tenantExists,
        scope: resolvedMigration.scope,
        workspaceProvided: Boolean(args.workspace),
      },
    })
    exit(0)
  }

  log.info('Master and tenant migration directories are available')
  log.info('This wrapper validates inputs and leaves live execution to the API migration runner')
  log.result({
    total: 2,
    passed: masterExists ? 1 : 0 + (tenantExists ? 1 : 0),
    failed: tenantExists ? 0 : 1,
    warnings: 1,
    status: tenantExists ? 'warning' : 'error',
    message: tenantExists
      ? 'Migration prerequisites validated; live execution delegated'
      : 'Tenant migration directory missing',
    details: {
      masterMigrations: masterExists,
      tenantMigrations: tenantExists,
      workspaceProvided: Boolean(args.workspace),
    },
  })
  exit(tenantExists ? 0 : 1)
}

void main()
