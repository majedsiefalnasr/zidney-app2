// Assume logger
const logger = {
  info: (msg: string, meta: any) =>
    console.log(JSON.stringify({ level: 'info', message: msg, ...meta })),
  warn: (msg: string, meta: any) =>
    console.warn(JSON.stringify({ level: 'warn', message: msg, ...meta })),
}

import semver from 'semver'
import { config } from '../config/index'
import { TenantPoolManager } from '../db/tenant/pool-manager'
import { TenantRegistryRepository } from '../repositories/master/tenant-registry.repository'

export async function tenantResolver(c: any, next: any) {
  const correlationId = c.get('correlationId')
  const slug = extractWorkspaceSlug(c)

  if (!slug) {
    c.status(404)
    return c.json(formatError('TENANT_NOT_FOUND', 'unknown', correlationId))
  }

  try {
    const registry = await loadRegistry(slug)
    if (!registry) {
      c.status(404)
      return c.json(formatError('TENANT_NOT_FOUND', slug, correlationId))
    }

    const license = await loadLicense(slug)
    if (!license) {
      c.status(404)
      return c.json(formatError('TENANT_NOT_FOUND', slug, correlationId))
    }

    enforceLicenseStatus(license)
    enforceSchemaVersion(registry)
    enforceProductVersion(license)

    const pool = getOrCreatePool(registry)

    c.set('tenant', {
      workspaceId: registry.id,
      workspaceSlug: slug,
      tenantDb: pool,
      license,
      schemaVersion: registry.schema_version,
      productVersion: license.product_version,
      requestId: correlationId,
    })

    logResolution(slug, correlationId)

    await next()
  } catch (error: any) {
    const code = error.message
    const status = getStatusCode(code)
    c.status(status)
    return c.json(formatError(code, slug, correlationId))
  }
}

function getStatusCode(code: string): number {
  switch (code) {
    case 'TENANT_NOT_FOUND':
      return 404
    case 'LICENSE_BLOCKED':
      return 423
    case 'VERSION_MISMATCH':
      return 426
    case 'DATABASE_UNAVAILABLE':
      return 503
    default:
      return 500
  }
}

function formatError(error: string, workspace: string, requestId: string) {
  return {
    error: {
      code: error,
      message: getErrorMessage(error),
      workspace,
      request_id: requestId,
    },
  }
}

function getErrorMessage(code: string): string {
  switch (code) {
    case 'TENANT_NOT_FOUND':
      return 'Workspace not found'
    case 'LICENSE_BLOCKED':
      return 'License status prevents access'
    case 'VERSION_MISMATCH':
      return 'Version incompatible'
    case 'DATABASE_UNAVAILABLE':
      return 'Database connection failed'
    default:
      return 'Unknown error'
  }
}

const registryCache = new Map<string, { data: any; timestamp: number }>()
const CACHE_TTL = 60 * 1000 // 60 seconds

export function extractWorkspaceSlug(c: any): string | null {
  // Check subdomain: <slug>.zidney.com
  const host = c.req.header('host')
  if (host) {
    const parts = host.split('.')
    if (parts.length > 2 && parts[0] !== 'www') {
      return parts[0]
    }
  }

  // Check path: /workspace/<slug>/
  const path = c.req.path
  const match = path.match(/^\/workspace\/([^/]+)/)
  if (match) {
    return match[1]
  }

  return null
}

async function loadRegistry(slug: string) {
  const now = Date.now()
  const cached = registryCache.get(slug)
  if (cached && now - cached.timestamp < CACHE_TTL) {
    return cached.data
  }

  const repo = new TenantRegistryRepository()
  const data = await repo.findBySlug(slug)
  registryCache.set(slug, { data, timestamp: now })
  return data
}

async function loadLicense(slug: string) {
  const repo = new TenantRegistryRepository()
  return await repo.findLicenseByWorkspaceSlug(slug)
}

function enforceSchemaVersion(registry: any) {
  // Assume current schema version is known
  const currentSchemaVersion = '1.0.0'
  if (registry.schema_version !== currentSchemaVersion) {
    throw new Error('VERSION_MISMATCH')
  }
}

export function enforceLicenseStatus(license: any) {
  if (license.status === 'SOFT_LOCKED') {
    throw new Error('LICENSE_BLOCKED')
  }
  if (license.status === 'ARCHIVED') {
    throw new Error('LICENSE_BLOCKED')
  }
  if (license.status !== 'ACTIVE') {
    throw new Error('LICENSE_BLOCKED')
  }
}

function enforceProductVersion(license: any) {
  if (
    !semver.satisfies(config.platformProductVersion, license.product_version)
  ) {
    throw new Error('VERSION_MISMATCH')
  }
}

/**
 * Get or create connection pool for tenant
 *
 * HARDENING (STAGE_02B):
 * - Explicit max pool size: 10 connections per workspace
 * - Prevents silent unbounded connection pool growth
 * - Logs warning when pool approaches limit (>8 connections)
 * - Prevents cascade failures from connection exhaustion
 */
function getOrCreatePool(registry: any) {
  const pool = TenantPoolManager.getOrCreatePool(registry)

  // Hardening: Monitor pool usage
  if (pool.totalCount > 8) {
    logger.warn('Connection pool near capacity', {
      workspace_id: registry.id,
      totalCount: pool.totalCount,
      maxLimit: 10,
      message:
        'Approaching connection limit - consider reviewing query patterns',
    })
  }

  return pool
}

function logResolution(slug: string, correlationId: string) {
  logger.info('Tenant resolved', {
    workspace_slug: slug,
    correlation_id: correlationId,
  })
}
