/**
 * Type declarations for jsonwebtoken
 *
 * Minimal type definitions for JWT handling.
 */

declare module 'jsonwebtoken' {
  export interface JwtPayload {
    [key: string]: unknown
    iat?: number
    exp?: number
    sub?: string
    iss?: string
    aud?: string | string[]
  }

  export interface Jwt {
    header: {
      alg: string
      typ: string
    }
    payload: JwtPayload
    signature: string
  }

  export type Algorithm =
    | 'HS256'
    | 'HS384'
    | 'HS512'
    | 'RS256'
    | 'RS384'
    | 'RS512'
    | 'ES256'
    | 'ES384'
    | 'ES512'
    | 'PS256'
    | 'PS384'
    | 'PS512'
    | 'none'

  export interface SignOptions {
    algorithm?: Algorithm
    expiresIn?: string | number
    notBefore?: string | number
    audience?: string | string[]
    issuer?: string
    jwtid?: string
    subject?: string
    noTimestamp?: boolean
    header?: Record<string, unknown>
    encoding?: string
  }

  export interface VerifyOptions {
    algorithms?: Algorithm[]
    audience?: string | string[]
    issuer?: string | string[]
    jwtid?: string
    subject?: string
    ignoreExpiration?: boolean
    ignoreNotBefore?: boolean
    clockTolerance?: number
    maxAge?: string | number
    clockTimestamp?: number
  }

  export interface DecodeOptions {
    complete?: boolean
    json?: boolean
  }

  export class TokenExpiredError extends Error {
    expiredAt: Date
    constructor(message: string, expiredAt: Date)
  }

  export class JsonWebTokenError extends Error {
    constructor(message: string)
  }

  export class NotBeforeError extends Error {
    date: Date
    constructor(message: string, date: Date)
  }

  export function sign(
    payload: string | Buffer | Record<string, unknown>,
    secretOrPrivateKey: string | Buffer,
    options?: SignOptions
  ): string

  export function sign(
    payload: string | Buffer | Record<string, unknown>,
    secretOrPrivateKey: string | Buffer,
    callback: (err: Error | null, token: string) => void
  ): void

  export function verify(
    token: string,
    secretOrPublicKey: string | Buffer,
    options?: VerifyOptions
  ): JwtPayload | string

  export function verify(
    token: string,
    secretOrPublicKey: string | Buffer,
    callback: (err: Error | null, decoded: JwtPayload | string) => void
  ): void

  export function decode(
    token: string,
    options?: DecodeOptions
  ): JwtPayload | string | Jwt | null
}
