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
  process.env.DATABASE_URL ??
  `postgresql://${dbUser}:${dbPassword}@${dbHost}:${dbPort}/${dbName}`

if (!('localStorage' in globalThis)) {
  const store = new Map<string, string>()
  const localStorageShim = {
    getItem(key: string): string | null {
      return store.has(key) ? store.get(key)! : null
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
