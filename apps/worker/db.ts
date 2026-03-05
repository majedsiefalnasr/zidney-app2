import { Pool } from 'pg'

function toInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback
  const parsed = Number.parseInt(value, 10)
  return Number.isNaN(parsed) ? fallback : parsed
}

function buildFallbackMasterPool(): Pool {
  return new Pool({
    host: process.env.MASTER_DB_HOST || process.env.DB_HOST || 'localhost',
    port: toInt(process.env.MASTER_DB_PORT || process.env.DB_PORT, 5432),
    database:
      process.env.MASTER_DB_NAME ||
      process.env.DB_DATABASE ||
      process.env.DB_NAME ||
      'zidney_master',
    user: process.env.MASTER_DB_USER || process.env.DB_USER || 'zidney_app',
    password:
      process.env.MASTER_DB_PASSWORD ||
      process.env.DB_PASSWORD ||
      'change-me-in-production',
    max: 20,
    idleTimeoutMillis: 900000,
    connectionTimeoutMillis: 30000,
  })
}

const masterPool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 900000,
      connectionTimeoutMillis: 30000,
    })
  : buildFallbackMasterPool()

const tenantPoolMap = new Map<string, Pool>()

function resolveTenantDatabaseUrl(workspaceId: string): string | null {
  const template = process.env.TENANT_DATABASE_URL_TEMPLATE
  if (template) {
    return template.replace('{workspace_id}', workspaceId)
  }

  if (process.env.TENANT_DATABASE_URL) {
    return process.env.TENANT_DATABASE_URL
  }

  // Test/dev fallback: use the same database when dedicated tenant URLs are absent.
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL
  }

  return null
}

export const db = {
  master: masterPool,
}

export function getTenantPool(workspaceId: string): Pool {
  const existing = tenantPoolMap.get(workspaceId)
  if (existing) {
    return existing
  }

  const tenantUrl = resolveTenantDatabaseUrl(workspaceId)
  if (!tenantUrl) {
    return masterPool
  }

  const pool = new Pool({
    connectionString: tenantUrl,
    max: 10,
    idleTimeoutMillis: 900000,
    connectionTimeoutMillis: 30000,
  })

  tenantPoolMap.set(workspaceId, pool)
  return pool
}
