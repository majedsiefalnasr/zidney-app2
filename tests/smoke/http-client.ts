/**
 * HTTP Client stub for smoke tests
 * Provides a simple HTTP client for staging smoke tests
 */

export interface SmokeHttpClient {
  get(
    path: string,
    token?: string
  ): Promise<{ status: number; data: unknown; headers: Record<string, string> }>
  post(
    path: string,
    body: unknown,
    token?: string
  ): Promise<{ status: number; data: unknown; headers: Record<string, string> }>
}

export function createClient(
  options: string | { baseURL: string; token?: string }
): SmokeHttpClient {
  const baseUrl = typeof options === 'string' ? options : options.baseURL
  const defaultToken = typeof options === 'string' ? undefined : options.token

  async function request(method: string, path: string, body?: unknown, token?: string) {
    const authToken = token ?? defaultToken
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (authToken) {
      headers.Authorization = authToken.startsWith('Bearer ') ? authToken : `Bearer ${authToken}`
    }
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })
    const data = await response.json().catch(() => null)
    const responseHeaders: Record<string, string> = {}
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value
    })
    return { status: response.status, data, headers: responseHeaders }
  }

  return {
    get: (path, token) => request('GET', path, undefined, token),
    post: (path, body, token) => request('POST', path, body, token),
  }
}
