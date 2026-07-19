#!/usr/bin/env node
/**
 * Proves the Claude Resume product path against a running RYU bridge:
 *   Write PermissionRequest → dock pending → Approve → correct Claude stdout
 *   Dual waiter (PermissionRequest + PreToolUse) share one Approve
 *   Deny blocks
 *   Fail-open when bridge down
 *
 * Live Claude Code still requires a human session (checklist printed at end).
 * Requires: npm run dev
 */

import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const hookPath = resolve(__dirname, '../hooks/ryu-hook.mjs')
const BASE = 'http://127.0.0.1:41999'
const cwd = resolve(__dirname, '..')

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms))
}

function spawnHook(payload) {
  const child = spawn(process.execPath, [hookPath], { stdio: ['pipe', 'pipe', 'pipe'] })
  let stdout = ''
  let stderr = ''
  child.stdout.on('data', (d) => {
    stdout += d
  })
  child.stderr.on('data', (d) => {
    stderr += d
  })
  child.stdin.write(JSON.stringify(payload))
  child.stdin.end()
  return {
    child,
    done: new Promise((resolveCode) => child.on('close', resolveCode)),
    getStdout: () => stdout,
    getStderr: () => stderr
  }
}

async function waitPending(maxAttempts = 40, agent = 'claude') {
  for (let i = 0; i < maxAttempts; i++) {
    await sleep(100)
    const pending = await fetch(`${BASE}/pending`).then((r) => r.json())
    const events = (pending.events || []).filter((e) => !agent || e.agent === agent)
    const ids = events.map((e) => e.id)
    if (ids.length) return { ids, events }
  }
  return null
}

async function decide(id, decision, reason) {
  return fetch(`${BASE}/decision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, decision, reason })
  }).then((r) => r.json())
}

async function main() {
  const health = await fetch(`${BASE}/health`).then((r) => r.json())
  if (!health.ok) throw new Error('bridge health failed — run npm run dev')
  console.log('[ok] bridge health', health)

  // 1) Write PermissionRequest → allow
  const writePayload = {
    hook_event_name: 'PermissionRequest',
    tool_name: 'Write',
    tool_input: {
      file_path: resolve(cwd, 'ryu-resume-test.txt'),
      content: 'hello from ryu resume verify'
    },
    cwd,
    session_id: 'resume-write-allow'
  }
  const h1 = spawnHook(writePayload)
  const pending1 = await waitPending()
  if (!pending1) {
    h1.child.kill()
    throw new Error('Write PermissionRequest did not register pending')
  }
  if (pending1.events[0]?.agent !== 'claude') {
    throw new Error(`expected agent claude, got ${pending1.events[0]?.agent}`)
  }
  if (!String(pending1.events[0]?.preview || '').includes('Write:')) {
    throw new Error(`expected Write preview, got ${pending1.events[0]?.preview}`)
  }
  console.log('[ok] Write PermissionRequest pending on dock', pending1.events[0].preview)

  const d1 = await decide(pending1.ids[0], 'allow', 'resume-allow')
  if (!d1.ok) throw new Error('allow decision failed')
  const code1 = await h1.done
  const out1 = JSON.parse(h1.getStdout().trim())
  if (
    code1 !== 0 ||
    out1?.hookSpecificOutput?.hookEventName !== 'PermissionRequest' ||
    out1?.hookSpecificOutput?.decision?.behavior !== 'allow'
  ) {
    throw new Error(`allow stdout unexpected: code=${code1} ${h1.getStdout()}`)
  }
  console.log('[ok] Approve → PermissionRequest decision.behavior=allow (Resume stdout)')

  // 2) Dual waiter: PreToolUse + PermissionRequest same tool → one Approve
  const dualBase = {
    tool_name: 'Write',
    tool_input: {
      file_path: resolve(cwd, 'ryu-dual-test.txt'),
      content: 'dual'
    },
    cwd,
    session_id: 'resume-dual'
  }
  const hPre = spawnHook({ ...dualBase, hook_event_name: 'PreToolUse' })
  await sleep(200)
  const hPerm = spawnHook({ ...dualBase, hook_event_name: 'PermissionRequest' })
  // Both hooks must register before we decide (same stable id → 2 waiters)
  await sleep(400)
  const pendingDual = await waitPending()
  if (!pendingDual?.ids?.length) {
    hPre.child.kill()
    hPerm.child.kill()
    throw new Error('dual waiters did not register')
  }
  if (pendingDual.ids.length !== 1) {
    hPre.child.kill()
    hPerm.child.kill()
    throw new Error(
      `expected 1 coalesced pending id, got ${pendingDual.ids.length}: ${pendingDual.ids.join(', ')}`
    )
  }
  await decide(pendingDual.ids[0], 'allow', 'dual-allow')
  const [codePre, codePerm] = await Promise.all([
    Promise.race([hPre.done, sleep(10000).then(() => -1)]),
    Promise.race([hPerm.done, sleep(10000).then(() => -1)])
  ])
  if (codePre === -1 || codePerm === -1) {
    hPre.child.kill()
    hPerm.child.kill()
    throw new Error(`dual waiter timed out pre=${codePre} perm=${codePerm}`)
  }
  const outPre = JSON.parse(hPre.getStdout().trim())
  const outPerm = JSON.parse(hPerm.getStdout().trim())
  if (codePre !== 0 || outPre?.hookSpecificOutput?.permissionDecision !== 'allow') {
    throw new Error(`PreToolUse dual failed: ${hPre.getStdout()}`)
  }
  if (codePerm !== 0 || outPerm?.hookSpecificOutput?.decision?.behavior !== 'allow') {
    throw new Error(`PermissionRequest dual failed: ${hPerm.getStdout()}`)
  }
  console.log('[ok] Dual PreToolUse + PermissionRequest unblocked by one Approve')

  // 3) Deny
  const hDeny = spawnHook({
    hook_event_name: 'PermissionRequest',
    tool_name: 'Write',
    tool_input: { file_path: resolve(cwd, 'ryu-deny.txt'), content: 'nope' },
    cwd,
    session_id: 'resume-deny'
  })
  const pendingDeny = await waitPending()
  if (!pendingDeny) {
    hDeny.child.kill()
    throw new Error('deny pending missing')
  }
  await decide(pendingDeny.ids[0], 'deny', 'resume-deny')
  const codeDeny = await hDeny.done
  const outDeny = JSON.parse(hDeny.getStdout().trim())
  if (codeDeny !== 0 || outDeny?.hookSpecificOutput?.decision?.behavior !== 'deny') {
    throw new Error(`deny unexpected: ${hDeny.getStdout()}`)
  }
  console.log('[ok] Deny → decision.behavior=deny')

  // 4) Fail-open
  const hFail = spawnHook({
    hook_event_name: 'PermissionRequest',
    tool_name: 'Write',
    tool_input: { file_path: '/tmp/x', content: 'x' },
    cwd,
    session_id: 'resume-failopen'
  })
  // Override by killing is hard; use bad port via env on a fresh spawn
  hFail.child.kill()
  const hFail2 = spawn(process.execPath, [hookPath], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, RYU_PORT: '41998' }
  })
  let failOut = ''
  hFail2.stdout.on('data', (d) => {
    failOut += d
  })
  hFail2.stdin.write(
    JSON.stringify({
      hook_event_name: 'PermissionRequest',
      tool_name: 'Write',
      tool_input: { file_path: '/tmp/x', content: 'x' },
      cwd,
      session_id: 'resume-failopen-2'
    })
  )
  hFail2.stdin.end()
  const failCode = await new Promise((r) => hFail2.on('close', r))
  if (failCode !== 0 || failOut.trim() !== '') {
    throw new Error(`fail-open unexpected code=${failCode} stdout=${failOut}`)
  }
  console.log('[ok] Fail-open when RYU unreachable (empty stdout, exit 0)')

  console.log('')
  console.log('[ok] Claude Resume product path verified against bridge')
  console.log('')
  console.log('=== LIVE Claude Code checklist (you) ===')
  console.log('1. npm run dev          # Windows, keep running')
  console.log('2. npm run hook:install # once')
  console.log('3. Restart Claude Code (WSL or Windows)')
  console.log('4. Prompt: Create ryu-live-test.txt with text hello')
  console.log('5. Dock should open (no stuck terminal Yes/No)')
  console.log('6. Approve → file created · Deny → blocked')
  console.log('7. Quit RYU mid-prompt → Claude normal prompt (fail-open)')
  console.log('Debug: %USERPROFILE%\\.ryu\\hook.log')
}

main().catch((err) => {
  console.error('[fail]', err.message || err)
  process.exit(1)
})
