import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

// Assume master DB connection
const masterClient = postgres(process.env.DATABASE_URL!)
const masterDb = drizzle(masterClient)

// Define schema (simplified)
const tenantsRegistry = sql`tenants_registry`
const licenses = sql`licenses`

export class TenantRegistryRepository {
  async findBySlug(slug: string) {
    const result = await masterDb.execute(sql`
      SELECT * FROM ${tenantsRegistry}
      WHERE workspace_slug = ${slug}
    `)
    return result[0]
  }

  async findLicenseByWorkspaceSlug(slug: string) {
    const result = await masterDb.execute(sql`
      SELECT * FROM ${licenses}
      WHERE workspace_slug = ${slug}
    `)
    return result[0]
  }
}
