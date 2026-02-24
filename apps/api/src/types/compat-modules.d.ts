declare module 'postgres' {
  export type Database<T = unknown> = any
  const postgres: any
  export default postgres
}

declare module 'jsonwebtoken' {
  export type Algorithm = string

  export class TokenExpiredError extends Error {}
  export class JsonWebTokenError extends Error {}

  export function sign(payload: any, secret: string, options?: any): string
  export function verify(token: string, secret: string, options?: any): any

  const jwt: {
    sign: typeof sign
    verify: typeof verify
    TokenExpiredError: typeof TokenExpiredError
    JsonWebTokenError: typeof JsonWebTokenError
  }

  export default jwt
}

declare module 'bcrypt' {
  const bcrypt: any
  export = bcrypt
}

declare module 'zod' {
  export namespace z {
    type infer<T> = any
    type ZodError = any
  }

  export const z: any
  export type infer<T> = any
  export type ZodError = any

  const defaultExport: any
  export default defaultExport
}

declare module '@hono/zod-validator' {
  export function zValidator(
    target: string,
    schema: any,
    hook?: (result: any, c: any) => void
  ): any
}

declare module '@zidney/app/worker/queue/job-queue' {
  export const jobQueue: any
  export const JobQueue: any
  const defaultExport: any
  export default defaultExport
}

declare module '@zidney/app/worker/types/job-schema' {
  export type AttemptSnapshot = any
  export type SubmissionData = any
  export type GradeAttemptJob = any
  export type JobResult = any
  export type JobPayload = any
  export function createGradeAttemptJob(...args: any[]): any
}

declare module 'pg' {
  export interface QueryResult<R = any> {
    rows: R[]
    rowCount: number
    length: number
  }

  export interface PoolClient {
    query: (query: string, values?: any[]) => Promise<QueryResult>
    release: () => void
    [key: string]: any
  }

  export class Pool {
    constructor(config?: any)
    connect: () => Promise<PoolClient>
    query: (query: string, values?: any[]) => Promise<QueryResult>
    end: () => Promise<void>
    on: (event: string, handler: (...args: any[]) => void) => void
    totalCount: number
    idleCount: number
    waitingCount: number
    [key: string]: any
  }

}
