/**
 * Shared helpers for RYU hooks: loopback host, token, authenticated fetch.
 */

import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '::1'])

export function ryuDir() {
  return join(homedir(), '.ryu')
}

export function readPort() {
  if (process.env.RYU_PORT) {
    const n = Number(process.env.RYU_PORT)
    if (Number.isFinite(n) && n > 0) return n
  }
  try {
    const n = Number(readFileSync(join(ryuDir(), 'port'), 'utf8').trim())
    if (Number.isFinite(n) && n > 0) return n
  } catch {
    // default
  }
  return 41999
}

/** Returns loopback host or null if configured host is non-loopback (must fail-open). */
export function readLoopbackHost() {
  let host = '127.0.0.1'
  if (process.env.RYU_HOST?.trim()) host = process.env.RYU_HOST.trim()
  else {
    try {
      const raw = readFileSync(join(ryuDir(), 'host'), 'utf8').trim()
      if (raw) host = raw
    } catch {
      // default
    }
  }
  if (!LOOPBACK.has(host.toLowerCase())) return null
  return host === 'localhost' || host === '::1' ? '127.0.0.1' : host
}

export function readToken() {
  if (process.env.RYU_TOKEN?.trim()) return process.env.RYU_TOKEN.trim()
  try {
    return readFileSync(join(ryuDir(), 'token'), 'utf8').trim()
  } catch {
    return ''
  }
}

export function authHeaders() {
  const token = readToken()
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['x-ryu-token'] = token
  return headers
}

export async function ryuFetch(path, { method = 'GET', body, signal } = {}) {
  const host = readLoopbackHost()
  if (!host) {
    const err = new Error('non-loopback RYU_HOST rejected')
    err.code = 'RYU_NON_LOOPBACK'
    throw err
  }
  const port = readPort()
  return fetch(`http://${host}:${port}${path}`, {
    method,
    headers: authHeaders(),
    body: body ? JSON.stringify(body) : undefined,
    signal
  })
}
