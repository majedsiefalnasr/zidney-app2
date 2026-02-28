interface AppConfig {
  apiBaseUrl: string
  buildEnv: 'development' | 'staging' | 'production'
  debugMode: boolean
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

  return { apiBaseUrl, buildEnv, debugMode }
}

export const appConfig: AppConfig = resolveConfig()
export type { AppConfig }
