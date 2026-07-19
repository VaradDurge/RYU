#!/usr/bin/env node
/**
 * Prove Claude status hook → POST /status → GET /agents.
 * Requires RYU running (`npm run dev`).
 */

import { spawnSync } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const BASE = 'http://127.0.0.1:41999'
const hookPath = resolve(dirname(fileURLToPath(import.meta.url)), '../hooks/ryu-claude-status.mjs')

async function get(path) {
  const res = await fetch(`${BASE}${path}`)
  return { ok: res.ok, status: res.status, json: await res.json().catch(() => null) }
}

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  return { ok: res.ok, status: res.status, json: await res.json().catch(() => null) }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

async function main() {
  const health = await get('/health')
  assert(health.ok, `Bridge not up at ${BASE}/health — start npm run dev`)

  const running = await post('/status', {
    agent: 'claude',
    status: 'running',
    detail: 'verify · Working…'
  })
  assert(running.ok && running.json?.agents?.claude === 'running', 'POST running failed')

  const approval = await post('/status', {
    agent: 'claude',
    status: 'approval',
    detail: 'Claude · Needs approval'
  })
  assert(approval.ok && approval.json?.agents?.claude === 'approval', 'POST approval failed')

  // argv + empty stdin (install wires event name on argv)
  const child = spawnSync(process.execPath, [hookPath, 'UserPromptSubmit'], {
    input: '',
    encoding: 'utf8',
    timeout: 5000
  })
  assert(child.status === 0, `status hook exit ${child.status}: ${child.stderr}`)

  const agents1 = await get('/agents')
  assert(
    agents1.json?.agents?.claude === 'running',
    `UserPromptSubmit should set claude running, got ${JSON.stringify(agents1.json)}`
  )

  const stop = spawnSync(process.execPath, [hookPath, 'Stop'], {
    input: '',
    encoding: 'utf8',
    timeout: 5000
  })
  assert(stop.status === 0, `Stop hook exit ${stop.status}`)

  const agents2 = await get('/agents')
  assert(
    agents2.json?.agents?.claude === 'idle',
    `Stop should set claude idle, got ${JSON.stringify(agents2.json)}`
  )

  const perm = spawnSync(process.execPath, [hookPath, 'PermissionRequest'], {
    input: '',
    encoding: 'utf8',
    timeout: 5000
  })
  assert(perm.status === 0, `PermissionRequest status exit ${perm.status}`)
  const agents3 = await get('/agents')
  assert(
    agents3.json?.agents?.claude === 'approval',
    `PermissionRequest should set approval, got ${JSON.stringify(agents3.json)}`
  )

  // reset
  await post('/status', { agent: 'claude', status: 'idle', detail: 'Claude · Idle' })

  console.log('verify:claude-status OK')
  console.log('  POST /status running → approval → idle')
  console.log('  ryu-claude-status.mjs argv UserPromptSubmit/Stop/PermissionRequest')
  console.log('')
  console.log('Next: npm run hook:install && restart Claude')
  console.log('Live: prompt a Write → yellow Claude ring + dock Approve')
  console.log('Debug: %USERPROFILE%\\.ryu\\claude-hook.log · hook.log')
}

main().catch((err) => {
  console.error('verify:claude-status FAILED:', err.message || err)
  process.exit(1)
})
