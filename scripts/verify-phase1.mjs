#!/usr/bin/env node
/**
 * Phase 1 verification without requiring a live Claude/Cursor session.
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

async function roundtrip(agent, preview, tool = 'Bash') {
  const id = crypto.randomUUID()
  const eventP = fetch(`${BASE}/event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id,
      agent,
      sessionLabel: `${agent} · verify`,
      tool,
      preview,
      path: resolve(__dirname, '..'),
      risk: 'normal',
      ts: Date.now()
    })
  }).then((r) => r.json())

  await sleep(200)
  const decide = await fetch(`${BASE}/decision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, decision: 'allow', reason: `verify-${agent}` })
  }).then((r) => r.json())
  const eventRes = await eventP
  if (!decide.ok || eventRes.status !== 'allow') {
    throw new Error(`${agent} roundtrip failed: ${JSON.stringify({ decide, eventRes })}`)
  }
  console.log(`[ok] ${agent} event/decision roundtrip`)
}

async function main() {
  const health = await fetch(`${BASE}/health`).then((r) => r.json())
  if (!health.ok) throw new Error('bridge health failed')
  console.log('[ok] bridge health', health)

  // Cursor-first (primary Path A)
  await roundtrip('cursor', 'Write: temp.txt', 'Write')
  await roundtrip('codex', 'Bash: npm test -- --watch')
  await roundtrip('claude', 'Bash: echo verify')

  // Claude hook path: spawn hook, deny via /pending id
  const payload = JSON.stringify({
    hook_event_name: 'PermissionRequest',
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

  const decision =
    parsed?.hookSpecificOutput?.permissionDecision ||
    parsed?.hookSpecificOutput?.decision?.behavior
  if (decision !== 'deny' || code !== 0) {
    throw new Error(`hook decision unexpected: ${JSON.stringify(parsed)} code=${code}`)
  }
  console.log('[ok] Claude hook returned wrapped PermissionRequest deny decision')

  // Fail-open when bridge unreachable
  const payload2 = JSON.stringify({
    tool_name: 'Bash',
    tool_input: { command: 'echo fail-open' },
    cwd: resolve(__dirname, '..'),
    session_id: 'verify-fail-open'
  })
  const child2 = spawn(process.execPath, [hookPath], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, RYU_PORT: '41998' }
  })
  let stdout2 = ''
  child2.stdout.on('data', (d) => {
    stdout2 += d
  })
  child2.stdin.write(payload2)
  child2.stdin.end()
  const code2 = await new Promise((resolveCode) => {
    child2.on('close', resolveCode)
  })
  if (code2 !== 0 || stdout2.trim() !== '') {
    throw new Error(`fail-open check failed: code=${code2} stdout=${stdout2}`)
  }
  console.log('[ok] Claude hook fail-open when bridge unreachable (empty stdout, exit 0)')

  console.log('[ok] Phase 1 automated checks passed (Cursor + Codex + Claude)')
  console.log('')
  console.log('Cursor Path A (proven by this script):')
  console.log('  POST /event agent=cursor → dock → POST /decision allow')
  console.log('Cursor Path B (spike): see .cursor/hooks.json + hooks/ryu-cursor-hook.mjs')
  console.log('  Note: Cursor hooks are deny-strong / allow-weak — may still show native UI.')
}

main().catch((err) => {
  console.error('[fail]', err.message || err)
  process.exit(1)
})
