/**
 * Parse Workspace Middleware
 *
 * File: apps/api/src/middleware/auth/parse-workspace-middleware.ts
 * Phase: STAGE_03_AUTHENTICATION_SYSTEM
 * Status: IN PROGRESS
 *
 * Purpose:
 * Resolve workspace context from request (subdomain or path).
 * Sets workspace_slug + workspace_id in context for all downstream handlers.
 *
 * Workspace Resolution Rules:
 * 1. Subdomain-based (primary):
 *    - https://{workspace_slug}.zidney.com/api/auth/login
 *    - Extract slug from subdomain
 *
 * 2. Path-based (fallback):
 *    - https://api.zidney.com/workspaces/{workspace_slug}/auth/login
 *    - Extract slug from path parameter
 *
 * 3. MMC routes (special):
 *    - https://mmc.zidney.com/auth/login (no workspace)
 *    - Skip workspace resolution for MMC-prefixed routes
 *
 * Execution Order: 2nd (after correlation-id, before JWT)
 * Requirement: Mandatory for all tenant-bound routes
 *
 * Multi-Tenancy Contract (ADR-0001):
 * - Database-per-tenant model
 * - workspace_slug is the only tenant identifier needed
 * - workspace_id is looked up from master DB
 * - Every route must validate workspace context before accessing tenant DB
 */

import { Context, Next } from 'hono'
import { createLogger } from '@zidney/logger'
import { db } from '../../db'

const logger = createLogger('parse-workspace')

/**
 * Workspace context
 */
export interface WorkspaceContext {
  workspace_id: string
  workspace_slug: string
  workspace_name: string
}

/**
 * Extract workspace slug from subdomain
 *
 * Examples:
 * - tenant.zidney.com → "tenant"
 * - workspace-1.zidney.com → "workspace-1"
 * - mmc.zidney.com → "mmc" (special)
 * - api.zidney.com → null (platform API)
 */
function extractSlugFromSubdomain(host: string): string | null {
  // Remove port if present
  const [hostWithoutPort] = host.split(':')

  // Split by dots
  const parts = hostWithoutPort.split('.')

  // If less than 2 parts or only "api", "mmc" → no workspace
  if (parts.length < 2) {
    return null
  }

  const subdomain = parts[0]

  // Skip reserved subdomains
  if (['api', 'mmc', 'www', 'admin', 'support', 'docs'].includes(subdomain)) {
    return null
  }

  return subdomain
}

/**
 * Extract workspace slug from URL path
 *
 * Examples:
 * - /workspaces/tenant-1/auth/login → "tenant-1"
 * - /workspaces/workspace-2/attempts/123 → "workspace-2"
 * - /auth/login → null (not a workspace path)
 */
function extractSlugFromPath(path: string): string | null {
  const match = path.match(/^\/workspaces\/([a-zA-Z0-9_-]+)/)

  if (match && match[1]) {
    return match[1]
  }

  return null
}

/**
 * Parse workspace from host and path
 *
 * Priority:
 * 1. Path-based (highest): /workspaces/{slug}/...
 * 2. Subdomain-based: {slug}.zidney.com
 * 3. Not found: null
 */
export function parseWorkspaceSlug(host: string, path: string): string | null {
  // Priority 1: Path-based
  const pathSlug = extractSlugFromPath(path)
  if (pathSlug) {
    return pathSlug
  }

  // Priority 2: Subdomain-based
  const subdomainSlug = extractSlugFromSubdomain(host)
  if (subdomainSlug) {
    return subdomainSlug
  }

  return null
}

/**
 * Validate workspace slug format
 *
 * Valid format: alphanumeric + dash/underscore, 3-63 chars
 */
export function isValidWorkspaceSlug(slug: string): boolean {
  const regex = /^[a-zA-Z0-9_-]{3,63}$/
  return regex.test(slug)
}

/**
 * Resolve workspace from master DB by slug
 *
 * Returns: workspace_id, workspace_name
 * Throws: If workspace not found
 */
async function resolveWorkspaceFromDb(slug: string): Promise<WorkspaceContext> {
  // Query master database for workspace
  const result = await db.master.query(
    `
    SELECT id, slug, name FROM workspaces WHERE slug = $1 AND archived_at IS NULL
    `,
    [slug]
  )

  if (result.rows.length === 0) {
    throw new Error(`Workspace not found: ${slug}`)
  }

  const row = result.rows[0]

  return {
    workspace_id: row.id,
    workspace_slug: row.slug,
    workspace_name: row.name,
  }
}

/**
 * Parse workspace middleware
 *
 * Execution order: 2nd (after correlation-id)
 *
 * - Extracts workspace slug from subdomain or path
 * - Validates format
 * - Looks up workspace_id from master DB
 * - Sets context for downstream handlers
 * - Skips for MMC routes
 */
export async function parseWorkspaceMiddleware(c: Context, next: Next) {
  // Get host and path
  const host = c.req.header('Host') || 'localhost'
  const path = c.req.path

  // Check if this is an MMC route (skip workspace resolution)
  if (
    host.includes('mmc') ||
    path.startsWith('/mmc/') ||
    path.startsWith('/platform/')
  ) {
    logger.debug(
      { path, host },
      '[Parse Workspace] Skipping workspace resolution for MMC route'
    )

    // Set sentinel values for MMC
    c.set('workspaceSlug', 'mmc')
    c.set('workspaceId', 'mmc')

    return next()
  }

  // Extract workspace slug
  const slug = parseWorkspaceSlug(host, path)

  if (!slug) {
    logger.warn(
      { host, path },
      '[Parse Workspace] No workspace found in host or path'
    )
    c.status(400)
    return c.json({
      success: false,
      data: null,
      error: {
        code: 'workspace_invalid',
        message: 'Workspace not found. Check your URL.',
      },
    })
  }

  // Validate format
  if (!isValidWorkspaceSlug(slug)) {
    logger.warn(
      { slug, host, path },
      '[Parse Workspace] Invalid workspace slug format'
    )
    c.status(400)
    return c.json({
      success: false,
      data: null,
      error: {
        code: 'workspace_invalid',
        message: 'Invalid workspace identifier.',
      },
    })
  }

  try {
    // Resolve from DB
    const workspace = await resolveWorkspaceFromDb(slug)

    // Set context for downstream handlers
    c.set('workspaceSlug', workspace.workspace_slug)
    c.set('workspaceId', workspace.workspace_id)
    c.set('workspaceName', workspace.workspace_name)

    logger.debug(
      { workspace_slug: slug, workspace_id: workspace.workspace_id },
      '[Parse Workspace] Workspace resolved'
    )
  } catch (err) {
    logger.warn(
      {
        slug,
        error: err instanceof Error ? err.message : 'unknown',
      },
      '[Parse Workspace] Failed to resolve workspace'
    )

    c.status(404)
    return c.json({
      success: false,
      data: null,
      error: {
        code: 'workspace_not_found',
        message: 'Workspace not found. Check your URL.',
      },
    })
  }

  return next()
}

/**
 * Require workspace context middleware
 * Throws if workspace not set (missing parse-workspace middleware in chain)
 */
export function requireWorkspaceContext(c: Context): WorkspaceContext {
  const workspaceId = c.get('workspaceId')
  const workspaceSlug = c.get('workspaceSlug')
  const workspaceName = c.get('workspaceName')

  if (!workspaceId || !workspaceSlug) {
    throw new Error(
      'Workspace context not found. Parse workspace middleware missing.'
    )
  }

  return {
    workspace_id: workspaceId,
    workspace_slug: workspaceSlug,
    workspace_name: workspaceName || 'unknown',
  }
}
