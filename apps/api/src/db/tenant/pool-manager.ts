import { Pool } from 'pg'

const tenantPools = new Map<string, Pool>()

interface TenantRegistryConnection {
  id: string
  db_host: string
  db_port: number | string
  db_name: string
  db_user: string
  db_password: string
}

function toPort(port: number | string): number {
  return typeof port === 'string' ? parseInt(port, 10) : port
}

export function getOrCreatePool(registry: TenantRegistryConnection): Pool {
  const key = registry.id
  let pool = tenantPools.get(key)
  if (!pool) {
    pool = new Pool({
      host: registry.db_host,
      port: toPort(registry.db_port),
      database: registry.db_name,
      user: registry.db_user,
      password: registry.db_password,
      max: 10, // guardrail
    })
    tenantPools.set(key, pool)
  }
  return pool
}

export async function shutdownTenantPools() {
  for (const pool of tenantPools.values()) {
    await pool.end()
  }
  tenantPools.clear()
}

export const TenantPoolManager = {
  getOrCreatePool,
  shutdown: shutdownTenantPools,
}
