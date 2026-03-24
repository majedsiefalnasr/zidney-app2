declare module './fixtures/test-db' {
  export function closeTestDb(): Promise<void>
  const _default: { closeTestDb?: () => Promise<void> }
  export default _default
}

declare module 'packages/job-queue/src/index' {
  export function closeQueue(): Promise<void> | void
  const _default: any
  export default _default
}

declare module 'packages/redis-utils/src/index' {
  export function closeConnection(): Promise<void> | void
  const _default: any
  export default _default
}

declare module './db-manager' {
  export const DbManager: { teardownAll?: () => Promise<void> | void }
}
