import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
export const ROOT = resolve(__dirname, '..')
export const BASE = 'http://127.0.0.1:41999'
export const bridgePath = resolve(__dirname, 'headless-bridge.mjs')

export function readToken() {
  if (process.env.RYU_TOKEN?.trim()) return process.env.RYU_TOKEN.trim()
  try {
    return readFileSync(join(homedir(), '.ryu', 'token'), 'utf8').trim()
  } catch {
    return ''
  }
}

export function authHeaders() {
  const headers = { 'Content-Type': 'application/json' }
  const token = readToken()
  if (token) headers['x-ryu-token'] = token
  return headers
}

export async function get(path) {
  const res = await fetch(`${BASE}${path}`, { headers: authHeaders() })
  return { ok: res.ok, status: res.status, json: await res.json().catch(() => null) }
}

export async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body)
  })
  return { ok: res.ok, status: res.status, json: await res.json().catch(() => null) }
}

export async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms))
}

export async function waitHealth(maxAttempts = 50) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(`${BASE}/health`)
      const json = await res.json()
      if (res.ok && json?.ok) return json
    } catch {
      // not up
    }
    await sleep(100)
  }
  throw new Error('headless bridge did not become healthy')
}

export function startBridge(env = {}) {
  return spawn(process.execPath, [bridgePath, '41999'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: ROOT,
    env: { ...process.env, ...env }
  })
}

export async function stopBridge(child) {
  child.kill('SIGTERM')
  await sleep(200)
  try {
    child.kill('SIGKILL')
  } catch {
    // ignore
  }
  await sleep(150)
}

export function makeEvent(overrides = {}) {
  return {
    id: overrides.id,
    agent: overrides.agent || 'claude',
    sessionLabel: overrides.sessionLabel || 'claude · test',
    tool: overrides.tool || 'Write',
    preview: overrides.preview || 'Write: test.txt',
    path: overrides.path || ROOT,
    risk: overrides.risk || 'normal',
    ts: overrides.ts || Date.now(),
    pairKey: overrides.pairKey,
    hookKind: overrides.hookKind,
    detail: overrides.detail,
    detailTruncated: overrides.detailTruncated
  }
}
