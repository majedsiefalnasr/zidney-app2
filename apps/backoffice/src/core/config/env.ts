interface AppConfig {
  apiBaseUrl: string
  buildEnv: 'development' | 'staging' | 'production'
  debugMode: boolean
  workspaceSlug?: string
}

export function resolveConfig(): AppConfig {
  const apiBaseUrl = import.meta.env['VITE_API_BASE_URL'] as string | undefined
  if (!apiBaseUrl) {
    throw new Error('[env] Missing required variable: VITE_API_BASE_URL')
  }

  const mode = import.meta.env['MODE'] as string
  const buildEnv: AppConfig['buildEnv'] =
    mode === 'staging'
      ? 'staging'
      : mode === 'production'
        ? 'production'
        : 'development'

  const debugMode = import.meta.env['VITE_DEBUG_MODE'] === 'true'

  // Optional: VITE_WORKSPACE_SLUG used for dev environment
  const workspaceSlug = import.meta.env['VITE_WORKSPACE_SLUG'] as
    | string
    | undefined

  return { apiBaseUrl, buildEnv, debugMode, workspaceSlug }
}

export const appConfig: AppConfig = resolveConfig()
export type { AppConfig }
