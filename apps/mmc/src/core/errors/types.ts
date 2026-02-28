export interface NormalizedError {
  code: string
  message: string
  httpStatus: number
}

export interface ApiErrorResponse {
  success: false
  data: null
  error: {
    code: string
    message: string
  }
}
