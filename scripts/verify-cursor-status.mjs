#!/usr/bin/env node
/**
 * Prove bridge POST /status → GET /agents for Cursor rings.
 * Requires RYU running (`npm run dev`) on 127.0.0.1:41999.
 * Also smoke-tests hooks/ryu-cursor-status.mjs with synthetic stdin.
 */

import { spawnSync } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const BASE = 'http://127.0.0.1:41999'
const hookPath = resolve(dirname(fileURLToPath(import.meta.url)), '../hooks/ryu-cursor-status.mjs')

async function get(path) {
  const res = await fetch(`${BASE}${path}`)
  const text = await res.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    json = text
  }
  return { ok: res.ok, status: res.status, json }
}

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  const text = await res.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    json = text
  }
  return { ok: res.ok, status: res.status, json }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

async function main() {
  const health = await get('/health')
  assert(health.ok, `Bridge not up at ${BASE}/health — start npm run dev`)

  const running = await post('/status', {
    agent: 'cursor',
    status: 'running',
    detail: 'verify · Editing file'
  })
  assert(running.ok, `POST /status running failed: ${JSON.stringify(running.json)}`)
  assert(running.json?.agents?.cursor === 'running', 'GET agents after POST should be running')

  const agents1 = await get('/agents')
  assert(agents1.json?.agents?.cursor === 'running', 'GET /agents cursor !== running')

  const idle = await post('/status', {
    agent: 'cursor',
    status: 'idle',
    detail: 'Cursor · Idle'
  })
  assert(idle.ok, `POST /status idle failed: ${JSON.stringify(idle.json)}`)
  assert(idle.json?.agents?.cursor === 'idle', 'agents.cursor should be idle')

  const bad = await post('/status', { agent: 'nope', status: 'running' })
  assert(bad.status === 400, 'invalid agent should 400')

  // Hook smoke: argv event name + empty stdin (matches live Cursor on Windows)
  const child = spawnSync(process.execPath, [hookPath, 'beforeSubmitPrompt'], {
    input: '',
    encoding: 'utf8',
    timeout: 5000
  })
  assert(child.status === 0, `status hook exit ${child.status}: ${child.stderr}`)

  const agents2 = await get('/agents')
  assert(
    agents2.json?.agents?.cursor === 'running',
    `hook argv+empty-stdin should set cursor running, got ${JSON.stringify(agents2.json)}`
  )

  // Hook smoke: stop → idle (also empty stdin)
  const stop = spawnSync(process.execPath, [hookPath, 'stop'], {
    input: '',
    encoding: 'utf8',
    timeout: 5000
  })
  assert(stop.status === 0, `stop hook exit ${stop.status}: ${stop.stderr}`)

  const agents3 = await get('/agents')
  assert(
    agents3.json?.agents?.cursor === 'idle',
    `stop should set cursor idle, got ${JSON.stringify(agents3.json)}`
  )

  console.log('verify:cursor-status OK')
  console.log('  POST /status running → idle')
  console.log('  ryu-cursor-status.mjs argv+empty-stdin → running / idle')
  console.log('  GET /agents matches')
  console.log('')
  console.log('Live: reload Cursor window, run an agent edit, watch Cursor ring green → blue.')
  console.log('Debug: http://127.0.0.1:41999/agents')
  console.log('Log:   %USERPROFILE%\\.ryu\\cursor-hook.log')
}

main().catch((err) => {
  console.error('verify:cursor-status FAILED:', err.message || err)
  process.exit(1)
})
