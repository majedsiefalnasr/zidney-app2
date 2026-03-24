const DEFAULT_DB_USER = 'zidney_app'
const DEFAULT_DB_PASSWORD = 'change-me-in-production'
const DEFAULT_DB_HOST = 'localhost'
const DEFAULT_DB_PORT = '5432'
const DEFAULT_DB_NAME = 'zidney_master'

const dbUser = process.env.DB_USER ?? DEFAULT_DB_USER
const dbPassword = process.env.DB_PASSWORD ?? DEFAULT_DB_PASSWORD
const dbHost = process.env.DB_HOST ?? DEFAULT_DB_HOST
const dbPort = process.env.DB_PORT ?? DEFAULT_DB_PORT
const dbName = process.env.DB_NAME ?? process.env.DB_DATABASE ?? DEFAULT_DB_NAME

process.env.DB_USER = dbUser
process.env.DB_PASSWORD = dbPassword
process.env.DB_HOST = dbHost
process.env.DB_PORT = dbPort
process.env.DB_NAME = dbName
process.env.DB_DATABASE = process.env.DB_DATABASE ?? dbName
process.env.POSTGRES_PASSWORD = process.env.POSTGRES_PASSWORD ?? dbPassword

process.env.TEST_DB_USER = process.env.TEST_DB_USER ?? dbUser
process.env.TEST_DB_PASSWORD = process.env.TEST_DB_PASSWORD ?? dbPassword
process.env.TEST_DB_HOST = process.env.TEST_DB_HOST ?? dbHost
process.env.TEST_DB_PORT = process.env.TEST_DB_PORT ?? dbPort
process.env.TEST_DB_NAME = process.env.TEST_DB_NAME ?? dbName
process.env.TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  `postgresql://${process.env.TEST_DB_USER}:${process.env.TEST_DB_PASSWORD}@${process.env.TEST_DB_HOST}:${process.env.TEST_DB_PORT}/${process.env.TEST_DB_NAME}`

process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? `postgresql://${dbUser}:${dbPassword}@${dbHost}:${dbPort}/${dbName}`

if (!('localStorage' in globalThis)) {
  const store = new Map<string, string>()
  const localStorageShim = {
    getItem(key: string): string | null {
      return store.has(key) ? (store.get(key) as string) : null
    },
    setItem(key: string, value: string): void {
      store.set(key, value)
    },
    removeItem(key: string): void {
      store.delete(key)
    },
    clear(): void {
      store.clear()
    },
    key(index: number): string | null {
      return Array.from(store.keys())[index] ?? null
    },
    get length(): number {
      return store.size
    },
  }

  Object.defineProperty(globalThis, 'localStorage', {
    value: localStorageShim,
    configurable: true,
    writable: true,
  })
}

// Global teardown: attempt to close persistent connections that tests may open.
// Vitest keeps the process alive if pg Pools, Redis clients, or other handles remain open.
// Register an afterAll hook here to run once per worker and close common singletons.
import { afterAll } from 'vitest'

// Track timers for potential cleanup
const trackedTimers = new Set<NodeJS.Timeout>()
const originalSetTimeout = global.setTimeout
const originalSetInterval = global.setInterval

// Wrap setTimeout to track timers
global.setTimeout = ((...args: Parameters<typeof setTimeout>) => {
  const timer = originalSetTimeout(...args)
  trackedTimers.add(timer as NodeJS.Timeout)
  return timer
}) as typeof setTimeout

// Wrap setInterval to track intervals
global.setInterval = ((...args: Parameters<typeof setInterval>) => {
  const timer = originalSetInterval(...args)
  trackedTimers.add(timer as NodeJS.Timeout)
  return timer
}) as typeof setInterval

/**
 * Detect and report remaining open handles (for diagnostics)
 */
function reportOpenHandles(source: string = 'vitest-diagnostics'): void {
  if (process.stdout.isTTY) {
    // Only run handle detection in TTY mode (not in CI)
    return
  }

  // Get list of active handles via internal Node API (unstable but useful for diagnostics)
  if (typeof (process as any)._getActiveHandles === 'function') {
    const handles = (process as any)._getActiveHandles()
    if (handles && handles.length > 0) {
      const handleTypes = handles
        .map((h: any) => h.constructor.name)
        .reduce((acc: Record<string, number>, type: string) => {
          acc[type] = (acc[type] || 0) + 1
          return acc
        }, {})

      console.debug('[vitest.setup] Open handles detected at', source, ':', handleTypes)
    }
  }
}

afterAll(async () => {
  // Clear all tracked timers
  for (const timer of trackedTimers) {
    clearTimeout(timer)
    clearInterval(timer)
  }
  trackedTimers.clear()

  // Close API postgres pool if initialized
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pgMod = await import('../apps/api/src/infrastructure/postgres')
    if (typeof pgMod?.db?.end === 'function') {
      await pgMod.db.end()
    }
  } catch (_e) {
    // ignore
  }

  // Close API redis pool if initialized
  try {
    const redisMod = await import('../apps/api/src/infrastructure/redis')
    if (redisMod && typeof redisMod.closeRedisPool === 'function') {
      await redisMod.closeRedisPool()
    }
  } catch (_e) {
    // ignore
  }

  // Close test fixture DB pool if present
  try {
    const testDbMod: any = await import('./fixtures/test-db').catch(() => ({}))
    const testDb: any = testDbMod.default ?? testDbMod
    if (testDb && typeof testDb.closeTestDb === 'function') {
      await testDb.closeTestDb()
    }
  } catch (_e) {
    // ignore
  }

  // Close job-queue redis if present
  try {
    const jobQueueMod: any = await import('packages/job-queue/src/index').catch(() => ({}))
    if (jobQueueMod && typeof jobQueueMod.closeQueue === 'function') {
      await jobQueueMod.closeQueue()
    }
  } catch (_e) {
    // ignore
  }

  // Close redis-utils if present
  try {
    const redisUtilsMod: any = await import('packages/redis-utils/src/index').catch(() => ({}))
    if (redisUtilsMod && typeof redisUtilsMod.closeConnection === 'function') {
      await redisUtilsMod.closeConnection()
    }
  } catch (_e) {
    // ignore
  }

  // Close any remaining databases from DbManager
  try {
    const dbMgrMod: any = await import('./db-manager').catch(() => ({}))
    if (dbMgrMod && dbMgrMod.DbManager && typeof dbMgrMod.DbManager.teardownAll === 'function') {
      await dbMgrMod.DbManager.teardownAll()
    }
  } catch (_e) {
    // ignore
  }

  // Give a small delay for cleanup to settle
  await new Promise((resolve) => setTimeout(resolve, 50))

  // Report any remaining open handles
  reportOpenHandles('after-teardown')
})
