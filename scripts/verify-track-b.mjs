#!/usr/bin/env node
/**
 * Track B — S9–S12 (+ Track A gate) against shared headless bridge.
 */

import { spawn, spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import {
  ROOT,
  get,
  post,
  sleep,
  waitHealth,
  startBridge,
  stopBridge,
  makeEvent
} from './ryu-test-util.mjs'

const codexHookPath = resolve(ROOT, 'hooks/ryu-codex-hook.mjs')
const trackAPath = resolve(ROOT, 'scripts/verify-track-a.mjs')
const WATCHDOG_MS = 400
const results = []

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

async function caseRun(id, label, fn) {
  try {
    await fn()
    console.log(`[${id}] PASS — ${label}`)
    results.push({ id, ok: true })
  } catch (err) {
    console.error(`[${id}] FAIL — ${label}: ${err.message || err}`)
    results.push({ id, ok: false })
  }
}

function spawnHook(hookPath, payload, env = {}) {
  const child = spawn(process.execPath, [hookPath], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, ...env }
  })
  let stdout = ''
  child.stdout.on('data', (d) => {
    stdout += d
  })
  child.stdin.write(JSON.stringify(payload))
  child.stdin.end()
  return {
    child,
    done: new Promise((resolveCode) => child.on('close', resolveCode)),
    getStdout: () => stdout
  }
}

async function waitPending(agent, maxAttempts = 40) {
  for (let i = 0; i < maxAttempts; i++) {
    await sleep(100)
    const pending = await get('/pending')
    const events = (pending.json?.events || []).filter((e) => !agent || e.agent === agent)
    if (events.length) return { ids: events.map((e) => e.id), events }
  }
  return null
}

async function main() {
  console.log('Track B verify — S9–S12 (headless) + Track A gate\n')
  const bridge = startBridge({ RYU_WATCHDOG_MS: String(WATCHDOG_MS) })
  try {
    await waitHealth()
    console.log(`[ok] headless bridge up (watchdog ${WATCHDOG_MS}ms)\n`)

    await caseRun('S9', 'Queue — two pendings; decide first; second remains', async () => {
      const id1 = randomUUID()
      const id2 = randomUUID()
      const p1 = post('/event', makeEvent({ id: id1, agent: 'claude', preview: 'Write: q1.txt' }))
      const p2 = post(
        '/event',
        makeEvent({
          id: id2,
          agent: 'codex',
          sessionLabel: 'codex · q2',
          tool: 'Bash',
          preview: 'Bash: echo q2'
        })
      )
      await sleep(200)
      let pending = await get('/pending')
      assert(pending.json.ids.includes(id1) && pending.json.ids.includes(id2), 'both pending')
      await post('/decision', { id: id1, decision: 'allow', reason: 's9-first' })
      await p1
      pending = await get('/pending')
      assert(!pending.json.ids.includes(id1) && pending.json.ids.includes(id2), 'second remains')
      await post('/decision', { id: id2, decision: 'allow', reason: 's9-second' })
      await p2
      pending = await get('/pending')
      assert((pending.json.ids || []).length === 0, 'empty')
    })

    await caseRun('S10', 'Dismiss — pending cleared; waiter cancelled (not allow)', async () => {
      const id = randomUUID()
      const eventP = post('/event', makeEvent({ id, preview: 'Write: stale.txt' }))
      await sleep(150)
      const dismissed = await post('/dismiss', { id })
      assert(dismissed.json?.ok, 'dismiss not ok')
      const body = await eventP
      assert(body.json?.status === 'cancelled', 'expected cancelled')
      assert(!(await get('/pending')).json.ids.includes(id), 'gone')

      const h = spawnHook(codexHookPath, {
        hook_event_name: 'PermissionRequest',
        tool_name: 'Write',
        tool_input: { file_path: resolve(ROOT, 'ryu-track-b-dismiss.txt'), content: 'x' },
        cwd: ROOT,
        session_id: 'track-b-s10-hook'
      })
      const hookPending = await waitPending('codex')
      assert(hookPending, 'codex hook pending')
      await post('/dismiss', { id: hookPending.ids[0] })
      const code = await h.done
      assert(code === 0 && h.getStdout().trim() === '', 'fail-open empty stdout')
    })

    await caseRun('S11', 'Codex allow/deny/fail-open + status parity', async () => {
      for (const status of ['running', 'approval', 'error', 'idle']) {
        const r = await post('/status', { agent: 'codex', status, detail: `s11 ${status}` })
        assert(r.ok && r.json?.agents?.codex === status, `codex ${status}`)
      }
      const hAllow = spawnHook(codexHookPath, {
        hook_event_name: 'PermissionRequest',
        tool_name: 'Write',
        tool_input: { file_path: resolve(ROOT, 'ryu-track-b-codex-allow.txt'), content: 'ok' },
        cwd: ROOT,
        session_id: 'track-b-s11-allow'
      })
      const pendAllow = await waitPending('codex')
      assert(pendAllow, 'allow pending')
      await post('/decision', { id: pendAllow.ids[0], decision: 'allow', reason: 's11' })
      const codeAllow = await hAllow.done
      assert(codeAllow === 0)
      assert(JSON.parse(hAllow.getStdout().trim())?.hookSpecificOutput?.decision?.behavior === 'allow')
      await sleep(100)
      assert((await get('/agents')).json?.agents?.codex === 'running', 'running after allow')

      const hDeny = spawnHook(codexHookPath, {
        hook_event_name: 'PermissionRequest',
        tool_name: 'Write',
        tool_input: { file_path: resolve(ROOT, 'ryu-track-b-codex-deny.txt'), content: 'no' },
        cwd: ROOT,
        session_id: 'track-b-s11-deny'
      })
      const pendDeny = await waitPending('codex')
      await post('/decision', { id: pendDeny.ids[0], decision: 'deny', reason: 's11-deny' })
      await hDeny.done
      assert(JSON.parse(hDeny.getStdout().trim())?.hookSpecificOutput?.decision?.behavior === 'deny')
      await sleep(100)
      assert((await get('/agents')).json?.agents?.codex === 'error', 'error after deny')

      const hFail = spawnHook(
        codexHookPath,
        {
          hook_event_name: 'PermissionRequest',
          tool_name: 'Bash',
          tool_input: { command: 'echo x' },
          cwd: ROOT,
          session_id: 'track-b-s11-fail'
        },
        { RYU_PORT: '41998' }
      )
      assert((await hFail.done) === 0 && hFail.getStdout().trim() === '', 'codex fail-open')
    })

    await caseRun('S12', 'Watchdog — running → idle without refresh', async () => {
      await post('/status', { agent: 'cursor', status: 'running', detail: 'watchdog run' })
      await sleep(WATCHDOG_MS + 250)
      assert((await get('/agents')).json?.agents?.cursor === 'idle', 'cursor idle')
      await post('/status', { agent: 'claude', status: 'approval', detail: 'watchdog approval' })
      await sleep(WATCHDOG_MS + 250)
      assert((await get('/agents')).json?.agents?.claude === 'idle', 'claude idle')
    })
  } finally {
    await stopBridge(bridge)
  }

  if (results.some((r) => !r.ok)) {
    console.error('Track B FAILED')
    process.exit(1)
  }

  console.log('\n[ok] S9–S12 PASS — running Track A gate…\n')
  const trackA = spawnSync(process.execPath, [trackAPath], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: 'inherit'
  })
  if (trackA.status !== 0) {
    console.error('\n[S8′] FAIL — Track A regression')
    process.exit(1)
  }
  console.log('\n[S8′] PASS — Track A still green')
  console.log('Track B OK — S9–S12 + Track A')
}

main().catch((err) => {
  console.error('verify:track-b FAILED:', err.message || err)
  process.exit(1)
})
