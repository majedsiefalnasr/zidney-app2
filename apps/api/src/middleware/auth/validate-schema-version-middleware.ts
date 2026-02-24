import type { Context, Next } from 'hono'

/**
 * Compatibility middleware used by auth routes.
 * Full schema compatibility enforcement is handled in the main auth chain.
 */
export function validateSchemaVersionMiddleware() {
  return async (_c: Context, next: Next): Promise<void> => {
    await next()
  }
}

