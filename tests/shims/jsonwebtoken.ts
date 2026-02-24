import { createHmac, timingSafeEqual } from 'node:crypto'

export type Algorithm = 'HS256'

export interface SignOptions {
  algorithm?: Algorithm
  expiresIn?: string | number
  noTimestamp?: boolean
}

export interface VerifyOptions {
  algorithms?: Algorithm[]
}

export class JsonWebTokenError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'JsonWebTokenError'
  }
}

export class TokenExpiredError extends JsonWebTokenError {
  public expiredAt: Date

  constructor(message: string, expiredAt: Date) {
    super(message)
    this.name = 'TokenExpiredError'
    this.expiredAt = expiredAt
  }
}

function base64urlEncode(value: string): string {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function base64urlDecode(value: string): string {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const padding = (4 - (base64.length % 4)) % 4
  return Buffer.from(base64 + '='.repeat(padding), 'base64').toString('utf8')
}

function parseExpiresIn(expiresIn: string | number): number {
  if (typeof expiresIn === 'number' && Number.isFinite(expiresIn)) {
    return Math.trunc(expiresIn)
  }

  const source = String(expiresIn).trim()
  const match = /^(-?\d+)\s*(ms|s|m|h|d)?$/.exec(source)
  if (!match) {
    throw new JsonWebTokenError('invalid expiresIn option')
  }

  const value = Number(match[1])
  const unit = match[2] || 's'

  switch (unit) {
    case 'ms':
      return Math.trunc(value / 1000)
    case 's':
      return value
    case 'm':
      return value * 60
    case 'h':
      return value * 60 * 60
    case 'd':
      return value * 60 * 60 * 24
    default:
      throw new JsonWebTokenError('invalid expiresIn unit')
  }
}

function parseJsonPart<T>(part: string, label: string): T {
  try {
    return JSON.parse(base64urlDecode(part)) as T
  } catch {
    throw new JsonWebTokenError(`invalid ${label}`)
  }
}

function buildSignature(input: string, secret: string): string {
  return createHmac('sha256', secret)
    .update(input)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function assertValidAlgorithm(algorithm: string | undefined): Algorithm {
  const selected = algorithm || 'HS256'
  if (selected !== 'HS256') {
    throw new JsonWebTokenError('invalid algorithm')
  }
  return selected
}

function secureEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  if (leftBuffer.length !== rightBuffer.length) {
    return false
  }
  return timingSafeEqual(leftBuffer, rightBuffer)
}

export function sign(
  payload: Record<string, unknown>,
  secret: string,
  options: SignOptions = {}
): string {
  if (typeof secret !== 'string' || secret.length === 0) {
    throw new JsonWebTokenError('secret must be a non-empty string')
  }

  const algorithm = assertValidAlgorithm(options.algorithm)
  const issuedAt = Math.floor(Date.now() / 1000)
  const tokenPayload: Record<string, unknown> = { ...payload }

  if (!options.noTimestamp && tokenPayload.iat == null) {
    tokenPayload.iat = issuedAt
  }

  if (options.expiresIn != null) {
    const expSeconds = parseExpiresIn(options.expiresIn)
    const base = typeof tokenPayload.iat === 'number' ? tokenPayload.iat : issuedAt
    tokenPayload.exp = base + expSeconds
  }

  const header = base64urlEncode(JSON.stringify({ alg: algorithm, typ: 'JWT' }))
  const body = base64urlEncode(JSON.stringify(tokenPayload))
  const signature = buildSignature(`${header}.${body}`, secret)
  return `${header}.${body}.${signature}`
}

export function verify(
  token: string,
  secret: string,
  options: VerifyOptions = {}
): Record<string, unknown> {
  if (typeof token !== 'string' || token.length === 0) {
    throw new JsonWebTokenError('jwt malformed')
  }

  if (typeof secret !== 'string' || secret.length === 0) {
    throw new JsonWebTokenError('secret must be a non-empty string')
  }

  const parts = token.split('.')
  if (parts.length !== 3) {
    throw new JsonWebTokenError('jwt malformed')
  }

  const header = parseJsonPart<{ alg?: string }>(parts[0], 'header')
  const payload = parseJsonPart<Record<string, unknown>>(parts[1], 'payload')
  const alg = assertValidAlgorithm(header.alg)

  if (options.algorithms && !options.algorithms.includes(alg)) {
    throw new JsonWebTokenError('invalid algorithm')
  }

  const expectedSignature = buildSignature(`${parts[0]}.${parts[1]}`, secret)
  if (!secureEquals(parts[2], expectedSignature)) {
    throw new JsonWebTokenError('invalid signature')
  }

  if (typeof payload.exp === 'number') {
    const nowSeconds = Math.floor(Date.now() / 1000)
    if (nowSeconds >= payload.exp) {
      throw new TokenExpiredError('jwt expired', new Date(payload.exp * 1000))
    }
  }

  return payload
}
