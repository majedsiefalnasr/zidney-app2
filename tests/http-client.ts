/**
 * Test HTTP Client
 * Factory for creating mock HTTP requests with proper headers and authentication
 */

export interface HttpResponse {
  status: number
  data: any
  error: any
  headers: Record<string, string>
}

export class HttpClient {
  private headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  setJWT(token: string): this {
    this.headers['Authorization'] = `Bearer ${token}`
    return this
  }

  getHeaders(): Record<string, string> {
    return { ...this.headers }
  }

  setHeader(key: string, value: string): this {
    this.headers[key] = value
    return this
  }

  clearHeaders(): this {
    this.headers = {
      'Content-Type': 'application/json',
    }
    return this
  }

  /**
   * Verify error response matches RFC 7807 format
   */
  async toMatchRFC7807(
    response: HttpResponse,
    expectedStatus: number,
    expectedCode: string
  ): Promise<boolean> {
    if (response.status !== expectedStatus) {
      console.error(`Status mismatch: expected ${expectedStatus}, got ${response.status}`)
      return false
    }

    const error = response.error
    if (!error) {
      console.error('Missing error object')
      return false
    }

    // RFC 7807 fields
    const requiredFields = ['code', 'message']
    for (const field of requiredFields) {
      if (!(field in error)) {
        console.error(`Missing RFC 7807 field: ${field}`)
        return false
      }
    }

    if (error.code !== expectedCode) {
      console.error(`Error code mismatch: expected ${expectedCode}, got ${error.code}`)
      return false
    }

    return true
  }

  /**
   * Verify response has required fields for success
   */
  async toBeSuccessResponse(
    response: HttpResponse,
    expectedStatus: number = 200
  ): Promise<boolean> {
    if (response.status !== expectedStatus) {
      console.error(`Status mismatch: expected ${expectedStatus}, got ${response.status}`)
      return false
    }

    if (response.data === null || response.data === undefined) {
      console.error('Missing data object')
      return false
    }

    if (response.error !== null) {
      console.error('Unexpected error object in success response')
      return false
    }

    return true
  }
}

/**
 * Factory function to create HTTP client
 */
export function createHttpClient(): HttpClient {
  return new HttpClient()
}
