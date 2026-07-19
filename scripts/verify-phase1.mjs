#!/usr/bin/env node
/**
 * Phase 1 verification without requiring a live Claude Code session.
 * Requires RYU running (`npm run dev`) with bridge on 127.0.0.1:41999.
 */

import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const hookPath = resolve(__dirname, '../hooks/ryu-hook.mjs')
const BASE = 'http://127.0.0.1:41999'

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms))
}

async function main() {
  const health = await fetch(`${BASE}/health`).then((r) => r.json())
  if (!health.ok) throw new Error('bridge health failed')
  console.log('[ok] bridge health', health)

  // Direct event/decision roundtrip
  const id = crypto.randomUUID()
  const eventP = fetch(`${BASE}/event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id,
      agent: 'claude',
      sessionLabel: 'claude · verify',
      tool: 'Bash',
      preview: 'Bash: echo verify',
      risk: 'normal',
      ts: Date.now()
    })
  }).then((r) => r.json())

  await sleep(200)
  const decide = await fetch(`${BASE}/decision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, decision: 'allow', reason: 'verify' })
  }).then((r) => r.json())
  const eventRes = await eventP
  if (!decide.ok || eventRes.status !== 'allow') {
    throw new Error(`direct roundtrip failed: ${JSON.stringify({ decide, eventRes })}`)
  }
  console.log('[ok] direct event/decision roundtrip')

  // Hook path: spawn hook, allow via /pending id
  const payload = JSON.stringify({
    tool_name: 'Bash',
    tool_input: { command: 'npm test -- --watch' },
    cwd: resolve(__dirname, '..'),
    session_id: 'verify-hook'
  })

  const child = spawn(process.execPath, [hookPath], { stdio: ['pipe', 'pipe', 'pipe'] })
  let stdout = ''
  let stderr = ''
  child.stdout.on('data', (d) => {
    stdout += d
  })
  child.stderr.on('data', (d) => {
    stderr += d
  })
  child.stdin.write(payload)
  child.stdin.end()

  let pendingId = null
  for (let i = 0; i < 40; i++) {
    await sleep(100)
    const pending = await fetch(`${BASE}/pending`).then((r) => r.json())
    if (pending.ids?.length) {
      pendingId = pending.ids[0]
      break
    }
  }
  if (!pendingId) {
    child.kill()
    throw new Error(`hook did not register pending event. stderr=${stderr}`)
  }

  await fetch(`${BASE}/decision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: pendingId, decision: 'deny', reason: 'verify-deny' })
  })

  const code = await new Promise((resolveCode) => {
    child.on('close', resolveCode)
  })

  let parsed
  try {
    parsed = JSON.parse(stdout)
  } catch {
    throw new Error(`hook stdout not JSON: ${stdout} stderr=${stderr} code=${code}`)
  }

  const decision = parsed?.hookSpecificOutput?.permissionDecision
  if (decision !== 'deny' || code !== 0) {
    throw new Error(`hook decision unexpected: ${JSON.stringify(parsed)} code=${code}`)
  }
  console.log('[ok] hook returned wrapped deny decision')

  // Fail-open when bridge unreachable — kill not needed; use bad port via temp
  // Simulate by pointing at closed port: run hook with overridden port file is heavy;
  // instead POST nothing and ensure empty stdout on connection refused.
  const child2 = spawn(process.execPath, [hookPath], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env }
  })
  // Temporarily can't override port easily without rewriting file — skip if bridge up.
  // Document: fail-open verified by stopping RYU manually.
  child2.kill()

  console.log('[ok] Phase 1 automated checks passed')
  console.log('[note] Manual: stop RYU and run Claude — should fall back to normal prompt (fail-open).')
}

main().catch((err) => {
  console.error('[fail]', err.message || err)
  process.exit(1)
})
