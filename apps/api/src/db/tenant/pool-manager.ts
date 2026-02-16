import { Pool } from 'pg'

const tenantPools = new Map<string, Pool>()

export class TenantPoolManager {
  static getOrCreatePool(registry: any): Pool {
    const key = registry.id
    let pool = tenantPools.get(key)
    if (!pool) {
      pool = new Pool({
        host: registry.db_host,
        port: registry.db_port,
        database: registry.db_name,
        user: registry.db_user,
        password: registry.db_password,
        max: 10, // guardrail
      })
      tenantPools.set(key, pool)
    }
    return pool
  }

  static async shutdown() {
    for (const pool of tenantPools.values()) {
      await pool.end()
    }
    tenantPools.clear()
  }
}
