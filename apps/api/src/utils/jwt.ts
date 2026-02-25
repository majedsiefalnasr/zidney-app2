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

export interface MMCTokenPayload {
  sub: string // user ID
  issuer: 'mmc'
  role_id: string
  token_version: number
}

/**
 * Sign JWT token
 */
export async function signToken(payload: any, secret: string): Promise<string> {
  return sign(payload, secret)
}

/**
 * Verify JWT token
 */
export async function verifyToken(
  token: string,
  secret: string
): Promise<Record<string, any>> {
  return verify(token, secret) as Promise<Record<string, any>>
}

/**
 * Decode JWT token (without verification)
 */
export function decodeToken(token: string): Record<string, any> | null {
  try {
    return decode(token) as Record<string, any>
  } catch (error) {
    return null
  }
}

/**
 * Check if token is expired
 */
export function isTokenExpired(payload: any): boolean {
  if (!payload.exp) return false
  return payload.exp < Math.floor(Date.now() / 1000)
}

/**
 * Get token expiration time in seconds
 */
export function getTokenExpiresIn(payload: any): number {
  if (!payload.exp) return 0
  const secondsLeft = payload.exp - Math.floor(Date.now() / 1000)
  return Math.max(0, secondsLeft)
}
