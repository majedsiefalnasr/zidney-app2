export async function closeTestDb(): Promise<void> {
  // Test-only stub used by global teardown. No-op if test DB not used.
  return Promise.resolve()
}

export default { closeTestDb }
