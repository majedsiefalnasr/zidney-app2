/**
 * Divisions Domain — Public Barrel
 *
 * Re-exports all public symbols from the divisions subdomain.
 * Consumed via:
 *   - Root barrel: `export * from './divisions'` in domain-core/src/index.ts
 *   - Subpath:     `"./divisions"` entry in domain-core/package.json exports
 */

export * from './divisions.errors'
export * from './divisions.service'
export * from './divisions.types'
