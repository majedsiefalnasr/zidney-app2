#!/usr/bin/env bun

/**
 * validate-runtime-env.ts
 * Checks PostgreSQL reachability, Redis reachability, Bun version, and Node >= 20.
 * Exit 0 on full pass, exit 1 on any failure.
 * Structured JSON output to stdout on failure.
 */

import { readFileSync } from 'node:fs'
import net from 'node:net'
import { join } from 'node:path'

interface EnvCheckResult {
  success: boolean
  data: {
    postgres: boolean
    redis: boolean
    bunVersion: { ok: boolean; found: string; required: string }
    nodeVersion: { ok: boolean; found: string; required: string }
  } | null
  error: { code: string; message: string } | null
}

function probePort(host: string, port: number, timeoutMs = 3000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port })
    socket.setTimeout(timeoutMs)
    socket.on('connect', () => {
      socket.destroy()
      resolve(true)
    })
    socket.on('error', () => resolve(false))
    socket.on('timeout', () => {
      socket.destroy()
      resolve(false)
    })
  })
}

function parseVersion(v: string): number[] {
  return v
    .replace(/^[^0-9]*/, '')
    .split('.')
    .map(Number)
}

function versionGte(found: string, required: string): boolean {
  const a = parseVersion(found)
  const b = parseVersion(required)
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const av = a[i] ?? 0
    const bv = b[i] ?? 0
    if (av > bv) return true
    if (av < bv) return false
  }
  return true
}

const pgHost = process.env.POSTGRES_HOST ?? 'localhost'
const pgPort = Number(process.env.POSTGRES_PORT ?? 5432)
const redisHost = process.env.REDIS_HOST ?? 'localhost'
const redisPort = Number(process.env.REDIS_PORT ?? 6379)

const [pgOk, redisOk] = await Promise.all([
  probePort(pgHost, pgPort),
  probePort(redisHost, redisPort),
])

// Bun version check
const foundBun = Bun.version
let requiredBun = '1.0.0'
try {
  const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8'))
  requiredBun = pkg.engines?.bun ?? requiredBun
} catch (_) {
  // fallback to default
}
const bunOk = versionGte(foundBun, requiredBun)

// Node version check
const foundNode = process.version.replace(/^v/, '')
const requiredNode = '20.0.0'
const nodeOk = versionGte(foundNode, requiredNode)

const failures: string[] = []
if (!pgOk) failures.push(`PostgreSQL unreachable at ${pgHost}:${pgPort}`)
if (!redisOk) failures.push(`Redis unreachable at ${redisHost}:${redisPort}`)
if (!bunOk) failures.push(`Bun version ${foundBun} does not meet required ${requiredBun}`)
if (!nodeOk) failures.push(`Node version ${foundNode} does not meet required >= ${requiredNode}`)

const result: EnvCheckResult = {
  success: failures.length === 0,
  data: {
    postgres: pgOk,
    redis: redisOk,
    bunVersion: { ok: bunOk, found: foundBun, required: requiredBun },
    nodeVersion: { ok: nodeOk, found: foundNode, required: requiredNode },
  },
  error: failures.length > 0 ? { code: 'ENV_NOT_READY', message: failures.join('; ') } : null,
}

process.stdout.write(`${JSON.stringify(result)}\n`)
process.exit(failures.length > 0 ? 1 : 0)
