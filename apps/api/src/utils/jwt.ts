/**
 * JWT Utilities
 *
 * File: apps/api/src/utils/jwt.ts
 * Task: T034
 * Phase: 5 - Authentication & Session Management
 *
 * JWT token creation and verification utilities
 * Used by authentication service and middleware
 */

import { decode, sign, verify } from 'hono/jwt'

type JwtPayload = Record<string, unknown> & { exp?: number }

export interface MMCTokenPayload {
  sub: string // user ID
  issuer: 'mmc'
  role_id: string
  token_version: number
}

/**
 * Sign JWT token
 */
export async function signToken(payload: JwtPayload, secret: string): Promise<string> {
  return sign(payload, secret)
}

/**
 * Verify JWT token
 */
export async function verifyToken(token: string, secret: string): Promise<JwtPayload> {
  return verify(token, secret, 'HS256') as Promise<JwtPayload>
}

/**
 * Decode JWT token (without verification)
 */
export function decodeToken(token: string): JwtPayload | null {
  try {
    return decode(token) as JwtPayload
  } catch (_error) {
    return null
  }
}

/**
 * Check if token is expired
 */
export function isTokenExpired(payload: JwtPayload): boolean {
  if (!payload.exp) return false
  return payload.exp < Math.floor(Date.now() / 1000)
}

/**
 * Get token expiration time in seconds
 */
export function getTokenExpiresIn(payload: JwtPayload): number {
  if (!payload.exp) return 0
  const secondsLeft = payload.exp - Math.floor(Date.now() / 1000)
  return Math.max(0, secondsLeft)
}
